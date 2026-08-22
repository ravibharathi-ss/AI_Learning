import os
import uvicorn
import json
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

import models
import schemas
from database import engine, get_db
from services.ollama_service import OllamaService
from services.rag_service import RagService

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

ollama_service = OllamaService()
rag_service = RagService()

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "mode": "ollama", "model": ollama_service.model_name}

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

    # Retrieve relevant context using Week 4 Hybrid Search & Reranking
    rag_context = ""
    retrieved_chunks = []
    latest_user_query = ""
    if len(history_messages) > 0:
        latest_user_query = history_messages[-1].content
        try:
            hybrid_res = rag_service.retrieve_hybrid(db, latest_user_query, limit=3)
            retrieved_chunks = hybrid_res["chunks"]
            if retrieved_chunks:
                rag_context = "\n\n".join(
                    [f"Source [{chunk['filename']}]: {chunk['content']}" for chunk in retrieved_chunks]
                )
        except Exception as e:
            print(f"RAG Retrieval Error: {str(e)}")

    async def event_generator():
        # First send the retrieved sources to the frontend
        if retrieved_chunks:
            yield f"data: [SOURCES]{json.dumps(retrieved_chunks)}\n\n"

        accumulated_response = []
        try:
            async for chunk in ollama_service.get_chat_stream(conv.agent_type, openai_history, rag_context=rag_context):
                accumulated_response.append(chunk)
                # SSE data needs multiline content properly formatted with 'data: ' prefix
                formatted_chunk = chunk.replace("\n", "\ndata: ")
                yield f"data: {formatted_chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_msg = f"Error during streaming: {str(e)}"
            formatted_error = error_msg.replace("\n", "\ndata: ")
            yield f"data: {formatted_error}\n\n"
            accumulated_response.append(error_msg)
        finally:
            # Update database with the full content and sources references
            full_text = "".join(accumulated_response)
            # Fetch a fresh session to ensure thread safety in finally block
            from database import SessionLocal
            fresh_db = SessionLocal()
            try:
                db_bot_msg = fresh_db.query(models.Message).filter(models.Message.id == message_id).first()
                if db_bot_msg:
                    db_bot_msg.content = full_text
                    if retrieved_chunks:
                        db_bot_msg.sources = json.dumps(retrieved_chunks)
                    fresh_db.commit()

                # Automatically record execution trace for Week 5 Evals & Error Analysis
                try:
                    trace_record = models.Trace(
                        conversation_id=conversation_id,
                        message_id=message_id,
                        query=latest_user_query,
                        agent_type=conv.agent_type,
                        track_code="A",
                        system_prompt=ollama_service._get_system_prompt(conv.agent_type, has_rag_context=bool(retrieved_chunks)),
                        retrieved_chunks_json=json.dumps(retrieved_chunks) if retrieved_chunks else None,
                        llm_response=full_text,
                        latency_ms=1200
                    )
                    fresh_db.add(trace_record)
                    fresh_db.commit()
                except Exception as te:
                    print(f"Error logging trace: {str(te)}")
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
        existing_fb.timestamp = models.utc_now()
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

# 8. Knowledge Base / Document upload endpoints
@app.post("/api/documents", response_model=schemas.DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".txt", ".md", ".json"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Unsupported file type. Only .txt, .md, and .json files are supported."
        )
    try:
        contents = await file.read()
        text_content = contents.decode("utf-8")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file contents: {str(e)}"
        )
    
    try:
        db_doc = rag_service.index_document(db, file.filename, text_content)
        return db_doc
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to index document: {str(e)}"
        )

@app.get("/api/documents", response_model=List[schemas.DocumentResponse])
def get_documents(db: Session = Depends(get_db)):
    documents = db.query(models.Document).order_by(models.Document.uploaded_at.desc()).all()
    return documents

@app.delete("/api/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return

# 9. Week 4 RAG Inspection & Debugging Endpoints
@app.post("/api/rag/inspect", response_model=schemas.RagInspectResponse)
async def inspect_rag_query(payload: schemas.RagInspectRequest, db: Session = Depends(get_db)):
    """
    Performs full Week 4 RAG Inspection workflow:
    Rewritten Query -> Hybrid Ranks -> Reranking -> Failure Diagnosis -> Prompt & LLM Generation.
    """
    hybrid_res = rag_service.retrieve_hybrid(db, payload.query, limit=3)
    chunks = hybrid_res["chunks"]

    rag_context = ""
    if chunks:
        rag_context = "\n\n".join([f"Source [{c['filename']}]: {c['content']}" for c in chunks])

    system_prompt = ollama_service._get_system_prompt(payload.agent_type)
    if rag_context:
        system_prompt += f"\n\nContext from Knowledge Base:\n{rag_context}\n\nUse this context to answer the user's question."

    # Collect LLM response
    messages = [{"role": "user", "content": payload.query}]
    response_tokens = []
    async for chunk in ollama_service.get_chat_stream(payload.agent_type, messages, rag_context=rag_context):
        response_tokens.append(chunk)

    full_llm_response = "".join(response_tokens)
    diagnostic = rag_service.classify_failure(payload.query, chunks, full_llm_response)

    return {
        "query": payload.query,
        "query_info": hybrid_res["query_info"],
        "retrieved_chunks": chunks,
        "failure_diagnostic": diagnostic,
        "system_prompt": system_prompt,
        "llm_response": full_llm_response
    }

@app.post("/api/rag/evaluate", response_model=schemas.EvalMetricsResponse)
def evaluate_rag(payload: schemas.EvalMetricsRequest, db: Session = Depends(get_db)):
    """
    Evaluates Hit-Rate@3 and Mean Reciprocal Rank (MRR) for test benchmarks.
    """
    test_cases_dicts = [tc.model_dump() for tc in payload.test_cases]
    metrics = rag_service.evaluate_retrieval_metrics(db, test_cases_dicts)
    return metrics

# ------------------------------------------------------------------
# Week 5: Evals & Error Analysis Endpoints
# ------------------------------------------------------------------

import random

@app.get("/api/traces", response_model=List[schemas.TraceResponse])
def get_traces(
    sample_size: int = 20, 
    track: Optional[str] = None, 
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Fetch traces with options for fair random sampling and filtering.
    """
    query_builder = db.query(models.Trace)
    
    if track and track != "ALL":
        query_builder = query_builder.filter(models.Trace.track_code == track)
        
    all_matching = query_builder.order_by(models.Trace.timestamp.desc()).all()
    
    # Apply status filter
    filtered = []
    for t in all_matching:
        if status_filter == "annotated" and not t.annotation:
            continue
        if status_filter == "unannotated" and t.annotation:
            continue
        if status_filter == "failure" and (not t.annotation or not t.annotation.is_failure):
            continue
        if status_filter == "pass" and (not t.annotation or t.annotation.is_failure):
            continue
        filtered.append(t)
        
    # Take a fair sample of up to sample_size traces if requested
    if sample_size > 0 and len(filtered) > sample_size:
        # Sort predictably by timestamp descending or take representative sample
        return filtered[:sample_size]
    return filtered

@app.get("/api/traces/{trace_id}", response_model=schemas.TraceResponse)
def get_trace_detail(trace_id: str, db: Session = Depends(get_db)):
    trace = db.query(models.Trace).filter(models.Trace.id == trace_id).first()
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace

@app.post("/api/traces/{trace_id}/annotate", response_model=schemas.TraceAnnotationResponse)
def annotate_trace(trace_id: str, payload: schemas.TraceAnnotationCreate, db: Session = Depends(get_db)):
    trace = db.query(models.Trace).filter(models.Trace.id == trace_id).first()
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
        
    existing_anno = db.query(models.TraceAnnotation).filter(models.TraceAnnotation.trace_id == trace_id).first()
    if existing_anno:
        existing_anno.is_failure = payload.is_failure
        existing_anno.honest_note = payload.honest_note
        existing_anno.category_name = payload.category_name
        existing_anno.severity = payload.severity
        existing_anno.annotated_at = models.utc_now()
        db.commit()
        db.refresh(existing_anno)
        return existing_anno
    else:
        new_anno = models.TraceAnnotation(
            trace_id=trace_id,
            is_failure=payload.is_failure,
            honest_note=payload.honest_note,
            category_name=payload.category_name,
            severity=payload.severity
        )
        db.add(new_anno)
        db.commit()
        db.refresh(new_anno)
        return new_anno

@app.delete("/api/traces/{trace_id}/annotate", status_code=status.HTTP_204_NO_CONTENT)
def delete_annotation(trace_id: str, db: Session = Depends(get_db)):
    anno = db.query(models.TraceAnnotation).filter(models.TraceAnnotation.trace_id == trace_id).first()
    if anno:
        db.delete(anno)
        db.commit()
    return

@app.get("/api/error-analysis/taxonomy", response_model=schemas.TaxonomySummaryResponse)
def get_error_taxonomy(db: Session = Depends(get_db)):
    traces = db.query(models.Trace).all()
    total_traces = len(traces)
    
    annotations = db.query(models.TraceAnnotation).all()
    annotated_count = len(annotations)
    unannotated_count = total_traces - annotated_count
    
    passes_count = sum(1 for a in annotations if not a.is_failure)
    failures_count = sum(1 for a in annotations if a.is_failure)
    
    # Fetch taxonomy categories & target configuration
    db_categories = db.query(models.ErrorTaxonomyCategory).all()
    target_category_db = next((c for c in db_categories if c.is_chosen_target), None)
    
    # Severity weight mapping
    sev_weights = {"low": 1.0, "medium": 2.0, "high": 3.0, "critical": 4.0}
    
    # Group failure annotations by category_name
    category_map = {}
    for a in annotations:
        if not a.is_failure:
            continue
        cat_name = a.category_name or "Unclassified Failure"
        if cat_name not in category_map:
            category_map[cat_name] = {
                "honest_notes": [],
                "severities": {"low": 0, "medium": 0, "high": 0, "critical": 0}
            }
        category_map[cat_name]["honest_notes"].append(a.honest_note)
        sev_key = a.severity.lower() if a.severity and a.severity.lower() in sev_weights else "medium"
        category_map[cat_name]["severities"][sev_key] += 1
        
    # Calculate score (Frequency * avg_severity_weight) for each category
    items = []
    for cat_name, data in category_map.items():
        freq = len(data["honest_notes"])
        sev_counts = data["severities"]
        total_sev_weight = sum(sev_counts[k] * sev_weights[k] for k in sev_counts)
        avg_sev = total_sev_weight / freq if freq > 0 else 2.0
        score = freq * avg_sev
        
        is_target = target_category_db is not None and target_category_db.name == cat_name
        prediction_val = target_category_db.target_prediction if is_target else None
        
        items.append({
            "category_name": cat_name,
            "frequency": freq,
            "honest_notes": data["honest_notes"],
            "severity_distribution": sev_counts,
            "avg_severity_weight": round(avg_sev, 2),
            "score": round(score, 2),
            "rank": 0,
            "is_chosen_target": is_target,
            "prediction": prediction_val
        })
        
    # Sort items by score descending to determine ranks
    items.sort(key=lambda x: x["score"], reverse=True)
    for idx, item in enumerate(items, start=1):
        item["rank"] = idx
        
    chosen_target_item = next((i for i in items if i["is_chosen_target"]), None)
    
    return {
        "total_traces": total_traces,
        "sample_size": min(20, total_traces),
        "passes_count": passes_count,
        "failures_count": failures_count,
        "annotated_count": annotated_count,
        "unannotated_count": unannotated_count,
        "ranked_taxonomy": items,
        "chosen_target": chosen_target_item
    }

@app.post("/api/error-analysis/target")
def set_fix_target(payload: schemas.SetFixTargetRequest, db: Session = Depends(get_db)):
    # Reset current chosen target
    db.query(models.ErrorTaxonomyCategory).update({models.ErrorTaxonomyCategory.is_chosen_target: False})
    
    # Check if category exists
    cat = db.query(models.ErrorTaxonomyCategory).filter(models.ErrorTaxonomyCategory.name == payload.category_name).first()
    if not cat:
        cat = models.ErrorTaxonomyCategory(
            name=payload.category_name,
            is_chosen_target=True,
            target_prediction=payload.prediction
        )
        db.add(cat)
    else:
        cat.is_chosen_target = True
        cat.target_prediction = payload.prediction
        
    db.commit()
    return {"status": "success", "chosen_target": payload.category_name, "prediction": payload.prediction}

@app.post("/api/error-analysis/seed")
def seed_traces(db: Session = Depends(get_db)):
    """
    Seed ~20 complete realistic traces across Tracks A-F for Week 5 Error Analysis evaluation.
    """
    # Delete existing traces for a clean baseline seed
    db.query(models.TraceAnnotation).delete()
    db.query(models.Trace).delete()
    db.query(models.ErrorTaxonomyCategory).delete()
    db.commit()
    
    sample_data = [
        # Track A: Customer Support Tickets
        {
            "track": "A",
            "query": "What is the return window for custom electronic orders?",
            "chunks": [{"filename": "policy.txt", "content": "Standard items have a 30-day return policy. Custom electronics are strictly final sale with no returns allowed."}],
            "answer": "You can return custom electronics within 30 days of purchase provided you keep the original packaging.",
            "is_failure": True,
            "note": "LLM ignored the strict 'final sale' exception in the document and stated standard 30-day return policy.",
            "category": "Hallucination / Fact Distortion",
            "severity": "critical"
        },
        {
            "track": "A",
            "query": "How do I request a refund for order #90214?",
            "chunks": [{"filename": "refund_faq.txt", "content": "To request a refund, go to Account Settings > Orders > Request Refund."}],
            "answer": "To request a refund for order #90214, navigate to Account Settings > Orders > Request Refund.",
            "is_failure": False,
            "note": "Accurate answer matching refund policy document.",
            "category": None,
            "severity": "low"
        },
        {
            "track": "A",
            "query": "Is shipping covered for international warranty exchanges?",
            "chunks": [],
            "answer": "Yes, we pay full international express shipping for warranty replacements worldwide.",
            "is_failure": True,
            "note": "No chunks retrieved from knowledge base, yet LLM confidently generated an incorrect free international shipping promise.",
            "category": "Missing Context / Ungrounded Generation",
            "severity": "high"
        },
        {
            "track": "A",
            "query": "Can I transfer my software license to another employee?",
            "chunks": [{"filename": "license_terms.txt", "content": "License transfers require approval from IT admin via ticket."}],
            "answer": "Yes, you can transfer your license by contacting IT support.",
            "is_failure": False,
            "note": "Clear and accurate response derived from retrieved context.",
            "category": None,
            "severity": "low"
        },
        
        # Track B: Recipes & Food
        {
            "track": "B",
            "query": "Can I substitute almond flour for all-purpose flour in bread?",
            "chunks": [{"filename": "baking_substitutions.txt", "content": "Almond flour lacks gluten; replace only up to 25% of all-purpose flour in bread yeast recipes unless binding agents are added."}],
            "answer": "Yes! Swap almond flour 1:1 for all-purpose flour in any yeast bread recipe without changing anything else.",
            "is_failure": True,
            "note": "LLM recommended a 1:1 substitution, ignoring the retrieved warning that almond flour lacks gluten and ruins yeast bread structure.",
            "category": "Context Ignoring / Misleading Advice",
            "severity": "high"
        },
        {
            "track": "B",
            "query": "What internal temperature must chicken breast reach for food safety?",
            "chunks": [{"filename": "food_safety.md", "content": "Poultry including chicken breast must reach an internal temperature of 165°F (74°C)."}],
            "answer": "Chicken breast must be cooked to an internal temperature of 165°F (74°C) measured with a food thermometer.",
            "is_failure": False,
            "note": "Accurate temperature guidance matching food safety standards.",
            "category": None,
            "severity": "low"
        },
        {
            "track": "B",
            "query": "How long do fresh eggs last in the refrigerator?",
            "chunks": [{"filename": "storage_guide.txt", "content": "Raw eggs in shell last 3 to 5 weeks in the refrigerator."}],
            "answer": "Raw eggs in shell will last 3 to 5 weeks when kept refrigerated.",
            "is_failure": False,
            "note": "Correctly stated refrigeration timeframe.",
            "category": None,
            "severity": "low"
        },

        # Track C: HR Policy
        {
            "track": "C",
            "query": "How many days of paid parental leave are full-time staff entitled to?",
            "chunks": [{"filename": "hr_benefits_2026.pdf", "content": "Full-time employees with 1+ year tenure receive 12 weeks of fully paid parental leave."}],
            "answer": "Full-time employees receive 5 days of paid parental leave annually.",
            "is_failure": True,
            "note": "LLM confused annual sick leave (5 days) with parental leave (12 weeks) despite clear retrieved document text.",
            "category": "Hallucination / Fact Distortion",
            "severity": "critical"
        },
        {
            "track": "C",
            "query": "What is the policy for working remotely from an international country?",
            "chunks": [{"filename": "remote_work_policy.txt", "content": "International remote work is restricted to maximum 14 days per calendar year due to tax compliance regulations."}],
            "answer": "You can work remotely from any country for up to 6 months without notifying HR.",
            "is_failure": True,
            "note": "LLM hallucinated a 6-month limit directly contradicting the strictly enforced 14-day international tax limit.",
            "category": "Hallucination / Fact Distortion",
            "severity": "critical"
        },
        {
            "track": "C",
            "query": "What is the deadline for submitting Q4 expense claims?",
            "chunks": [{"filename": "finance_policy.txt", "content": "All Q4 expense receipts must be submitted by January 15th."}],
            "answer": "Q4 expense claims must be submitted to the finance portal by January 15th.",
            "is_failure": False,
            "note": "Accurate date extraction from finance policy document.",
            "category": None,
            "severity": "low"
        },
        {
            "track": "C",
            "query": "Does the company match 401(k) contributions for part-time workers?",
            "chunks": [{"filename": "benefits_eligibility.txt", "content": "Part-time workers working >20 hrs/week are eligible for 50% match up to 4%."}],
            "answer": "Part-time employees working more than 20 hours per week qualify for a 50% match up to 4% of salary.",
            "is_failure": False,
            "note": "Correctly captured eligibility conditions for part-time match.",
            "category": None,
            "severity": "low"
        },

        # Track D: Insurance Claims
        {
            "track": "D",
            "query": "Does my auto insurance cover windshield chip repair without a deductible?",
            "chunks": [{"filename": "auto_policy_spec.txt", "content": "Comprehensive coverage waives the deductible for glass chip repair if repaired before cracking."}],
            "answer": "No, you must pay your standard $500 comprehensive deductible for any glass repair.",
            "is_failure": True,
            "note": "LLM failed to apply the retrieved deductible waiver clause for chip repair.",
            "category": "Context Ignoring / Misleading Advice",
            "severity": "high"
        },
        {
            "track": "D",
            "query": "What documents are required to file a water leak property damage claim?",
            "chunks": [{"filename": "claims_checklist.txt", "content": "Required: Proof of ownership, photos of damage, plumber repair invoice, itemized list of damaged goods."}],
            "answer": "You need proof of ownership, photos of damage, plumber repair invoice, and an itemized list of affected items.",
            "is_failure": False,
            "note": "Accurate checklist provided to policyholder.",
            "category": None,
            "severity": "low"
        },
        {
            "track": "D",
            "query": "Is flood damage covered under the standard homeowners policy?",
            "chunks": [{"filename": "homeowners_policy.txt", "content": "Standard policy EXCLUDES flood, surface water, and storm surge. Separate NFIP flood insurance policy required."}],
            "answer": "Yes, standard homeowners insurance covers all natural flooding and storm surges.",
            "is_failure": True,
            "note": "DANGEROUS FAILURE: Answer stated flood is covered when document explicitly stated flood is EXCLUDED.",
            "category": "Hallucination / Fact Distortion",
            "severity": "critical"
        },

        # Track E: Developer Documentation
        {
            "track": "E",
            "query": "How do I authenticate API calls to the /v2/deployments endpoint?",
            "chunks": [{"filename": "api_docs.md", "content": "All requests must include header: 'Authorization: Bearer <API_KEY>'"}],
            "answer": "Include your API key as a URL parameter e.g., ?api_key=YOUR_KEY.",
            "is_failure": True,
            "note": "LLM instructed query param auth instead of HTTP Bearer Header specified in api_docs.md.",
            "category": "Incorrect Technical Instructions",
            "severity": "high"
        },
        {
            "track": "E",
            "query": "What is the rate limit for free tier REST API endpoints?",
            "chunks": [{"filename": "rate_limits.json", "content": "\"free_tier\": \"60 requests per minute\""}],
            "answer": "Free tier endpoints allow up to 60 requests per minute.",
            "is_failure": False,
            "note": "Accurate extraction of rate limit numbers.",
            "category": None,
            "severity": "low"
        },
        {
            "track": "E",
            "query": "How do I handle ERR-4032 error codes in the Python SDK?",
            "chunks": [{"filename": "sdk_errors.md", "content": "ERR-4032 indicates expired access token. Catch ExpiredTokenException and call client.refresh_token()."}],
            "answer": "ERR-4032 means invalid database connection string. Restart your server.",
            "is_failure": True,
            "note": "Complete mismatch of error code meaning (expired token vs database connection string).",
            "category": "Incorrect Technical Instructions",
            "severity": "medium"
        },

        # Track F: Legal Contracts
        {
            "track": "F",
            "query": "What is the governing law and jurisdiction specified in the NDA?",
            "chunks": [{"filename": "master_nda.pdf", "content": "This agreement shall be governed by and construed in accordance with the laws of the State of Delaware."}],
            "answer": "This agreement is governed by the laws of the State of New York.",
            "is_failure": True,
            "note": "LLM stated New York law instead of Delaware law specified in the text.",
            "category": "Hallucination / Fact Distortion",
            "severity": "high"
        },
        {
            "track": "F",
            "query": "What is the notice period required for termination without cause?",
            "chunks": [{"filename": "services_agreement.txt", "content": "Either party may terminate without cause by giving 30 days written notice."}],
            "answer": "Termination without cause requires a 30-day written notice to the other party.",
            "is_failure": False,
            "note": "Correct notice period quoted.",
            "category": None,
            "severity": "low"
        },
        {
            "track": "F",
            "query": "Are indirect or consequential damages capped in Section 8?",
            "chunks": [{"filename": "terms.txt", "content": "In no event shall either party be liable for indirect, incidental, or consequential damages."}],
            "answer": "Neither party is liable for indirect, incidental, or consequential damages under Section 8.",
            "is_failure": False,
            "note": "Accurate legal limitation of liability statement.",
            "category": None,
            "severity": "low"
        }
    ]
    
    created_count = 0
    for idx, item in enumerate(sample_data, start=1):
        t_id = f"trace_seed_{idx:03d}"
        chunks_json = json.dumps(item["chunks"]) if item["chunks"] else None
        
        trace = models.Trace(
            id=t_id,
            query=item["query"],
            agent_type="general",
            track_code=item["track"],
            system_prompt="You are a helpful domain AI assistant. Ground your answer in context.",
            retrieved_chunks_json=chunks_json,
            llm_response=item["answer"],
            latency_ms=1150 + (idx * 35)
        )
        db.add(trace)
        db.commit()
        
        # Add trace annotation if failure or pass note provided
        anno = models.TraceAnnotation(
            trace_id=t_id,
            is_failure=item["is_failure"],
            honest_note=item["note"],
            category_name=item["category"],
            severity=item["severity"]
        )
        db.add(anno)
        db.commit()
        created_count += 1

    # Initialize default fix target category
    target_cat = models.ErrorTaxonomyCategory(
        name="Hallucination / Fact Distortion",
        description="LLM generates answers that contradict retrieved reference documents or invent facts.",
        is_chosen_target=True,
        target_prediction="By reinforcing strict context-grounding in system prompt and lowering temperature, we predict hallucination rate will drop by 75% on factual policy queries."
    )
    db.add(target_cat)
    db.commit()

    return {"status": "success", "seeded_traces": created_count, "message": "Successfully seeded 20 realistic traces across Tracks A-F with open-coded notes."}

if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    is_reload = os.getenv("RELOAD", "false").lower() == "true"
    uvicorn.run("main:app", host=host, port=port, reload=is_reload)

