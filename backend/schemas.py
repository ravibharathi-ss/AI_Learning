from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

# Feedback schemas
class FeedbackBase(BaseModel):
    rating: str = Field(..., pattern="^(thumbs_up|thumbs_down)$")
    comment: Optional[str] = None

class FeedbackCreate(FeedbackBase):
    message_id: int

class FeedbackResponse(FeedbackBase):
    id: int
    message_id: int
    timestamp: datetime

    class Config:
        from_attributes = True

# Message schemas
class MessageBase(BaseModel):
    sender: str = Field(..., pattern="^(user|bot)$")
    content: str

class MessageCreate(MessageBase):
    conversation_id: str

class MessageResponse(MessageBase):
    id: int
    conversation_id: str
    timestamp: datetime
    feedback: Optional[FeedbackResponse] = None

    class Config:
        from_attributes = True

# Conversation schemas
class ConversationBase(BaseModel):
    title: str
    agent_type: str = "general"

class ConversationCreate(ConversationBase):
    pass

class ConversationResponse(ConversationBase):
    id: str
    created_at: datetime
    messages: List[MessageResponse] = []

    class Config:
        from_attributes = True

class ConversationListItem(ConversationBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True
