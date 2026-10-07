from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class CitationDto(BaseModel):
    document_id: str
    document_name: str
    chunk_id: int
    score: float
    snippet: str
    clause_reference: Optional[str] = None

class ChatRequestDto(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="User question")
    conversation_id: Optional[str] = Field(None, description="Optional conversation session ID")
    prompt_version: Optional[str] = Field("v2.2", description="Calibrated prompt version (v2.1 or v2.2)")
    agent_type: Optional[str] = Field("legal_specialist", description="Specialist agent role")
    user_id: Optional[str] = Field("alex.vance@legalpartners.com", description="User ID / counsel email")

class ChatResponseDto(BaseModel):
    answer: str
    is_grounded: bool
    sources: List[CitationDto] = Field(default_factory=list)
    cited_clause: Optional[str] = None
    prompt_version: str
    latency_ms: int
    total_tokens: int
    cost_usd: float
    trace_id: str
