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
    sources: Optional[str] = None
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

# Document schemas
class DocumentResponse(BaseModel):
    id: str
    filename: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

# RAG Week 4 Inspection & Debugging schemas
class RagInspectRequest(BaseModel):
    query: str
    agent_type: str = "general"

class ChunkInspection(BaseModel):
    id: int
    document_id: str
    filename: str
    content: str
    score: float
    semantic_score: float
    bm25_score: float
    rrf_score: float

class FailureDiagnostic(BaseModel):
    classification: str  # 'RETRIEVAL_FAILURE' | 'GENERATION_FAILURE' | 'SUCCESS'
    subtype: str
    reason: str
    remedy: str

class RagInspectResponse(BaseModel):
    query: str
    query_info: dict
    retrieved_chunks: List[ChunkInspection]
    failure_diagnostic: FailureDiagnostic
    system_prompt: str
    llm_response: str

class TestCase(BaseModel):
    query: str
    expected_filename: Optional[str] = ""
    expected_keyword: Optional[str] = ""

class EvalMetricsRequest(BaseModel):
    test_cases: List[TestCase]

class EvalMetricsResponse(BaseModel):
    hit_rate_at_3: float
    mrr: float
    total_queries: int
