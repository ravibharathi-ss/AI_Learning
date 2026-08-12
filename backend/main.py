import os
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import engine, get_db
from services.openai_service import OpenAiService

# Initialize database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Customer Support Chatbot API")

# Configure CORS to allow React frontend (default Vite ports: 5173, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development, allow all. Or specify http://localhost:5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

openai_service = OpenAiService()

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "mock_mode": openai_service.client is None}

# 1. Create a new conversation
@app.post("/api/conversations", response_model=schemas.ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(conv_in: schemas.ConversationCreate, db: Session = Depends(get_db)):
    db_conv = models.Conversation(
        title=conv_in.title,
        agent_type=conv_in.agent_type
    )
    db.add(db_conv)
    db.commit()
    db.refresh(db_conv)
    return db_conv

# 2. Get list of conversation history (without message payloads for light payload)
@app.get("/api/conversations", response_model=List[schemas.ConversationListItem])
def get_conversations(db: Session = Depends(get_db)):
    conversations = db.query(models.Conversation).order_by(models.Conversation.created_at.desc()).all()
    return conversations

# 3. Get messages for a specific conversation
@app.get("/api/conversations/{conversation_id}/messages", response_model=List[schemas.MessageResponse])
def get_conversation_messages(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv.messages

# 4. Delete a conversation
@app.delete("/api/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return

# 5. Send a user message and return user message + bot placeholder message
from pydantic import BaseModel
class SendMessageRequest(BaseModel):
    content: str

@app.post("/api/conversations/{conversation_id}/messages")
def send_message(conversation_id: str, payload: SendMessageRequest, db: Session = Depends(get_db)):
    # 1. Verify conversation
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 2. Save User message
    user_msg = models.Message(
        conversation_id=conversation_id,
        sender="user",
        content=payload.content
    )
    db.add(user_msg)
    
    # 3. Create Bot placeholder message
    bot_msg = models.Message(
        conversation_id=conversation_id,
        sender="bot",
        content=""
    )
    db.add(bot_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(bot_msg)

    # Return responses matching schemas.MessageResponse
    return {
        "user_message": schemas.MessageResponse.model_validate(user_msg),
        "bot_message": schemas.MessageResponse.model_validate(bot_msg)
    }

# 6. Stream bot response for a specific bot message and update the database
@app.get("/api/conversations/{conversation_id}/messages/{message_id}/stream")
def stream_bot_message(conversation_id: str, message_id: int, db: Session = Depends(get_db)):
    # 1. Validate conversation and message
    conv = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    bot_msg = db.query(models.Message).filter(models.Message.id == message_id, models.Message.conversation_id == conversation_id).first()
    if not bot_msg or bot_msg.sender != "bot":
        raise HTTPException(status_code=404, detail="Bot message not found")

    # 2. Retrieve history up to the user's latest message (excluding current bot placeholder)
    # We order by timestamp / id ascending
    history_messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id,
        models.Message.id < message_id
    ).order_by(models.Message.id.asc()).all()

    # Formulate messages for GPT api: List[Dict[str, str]]
    openai_history = []
    for msg in history_messages:
        role = "user" if msg.sender == "user" else "assistant"
        openai_history.append({"role": role, "content": msg.content})

    async def event_generator():
        accumulated_response = []
        try:
            async for chunk in openai_service.get_chat_stream(conv.agent_type, openai_history):
                accumulated_response.append(chunk)
                # SSE data needs to be prefixed with 'data: ' and followed by double newlines
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_msg = f"Error during streaming: {str(e)}"
            yield f"data: {error_msg}\n\n"
            accumulated_response.append(error_msg)
        finally:
            # Update database with the full content
            full_text = "".join(accumulated_response)
            # Fetch a fresh session to ensure thread safety in finally block
            from database import SessionLocal
            fresh_db = SessionLocal()
            try:
                db_bot_msg = fresh_db.query(models.Message).filter(models.Message.id == message_id).first()
                if db_bot_msg:
                    db_bot_msg.content = full_text
                    fresh_db.commit()
            except Exception as e:
                print(f"Error saving streamed response: {str(e)}")
            finally:
                fresh_db.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# 7. Feedback endpoint
@app.post("/api/messages/{message_id}/feedback", response_model=schemas.FeedbackResponse)
def submit_feedback(message_id: int, feedback_in: schemas.FeedbackBase, db: Session = Depends(get_db)):
    # Verify message exists and is a bot message
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender != "bot":
        raise HTTPException(status_code=400, detail="Feedback can only be submitted for chatbot responses")

    # Check if feedback already exists for this message
    existing_fb = db.query(models.Feedback).filter(models.Feedback.message_id == message_id).first()
    if existing_fb:
        existing_fb.rating = feedback_in.rating
        existing_fb.comment = feedback_in.comment
        existing_fb.timestamp = models.datetime.datetime.utcnow()
        db.commit()
        db.refresh(existing_fb)
        return existing_fb

    # Otherwise create new feedback
    db_fb = models.Feedback(
        message_id=message_id,
        rating=feedback_in.rating,
        comment=feedback_in.comment
    )
    db.add(db_fb)
    db.commit()
    db.refresh(db_fb)
    return db_fb

if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host=host, port=port, reload=True)
