from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class SearchRequestDto(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000, description="Search query")
    top_k: Optional[int] = Field(default=3, ge=1, le=20)
    similarity_threshold: Optional[float] = Field(default=0.35, ge=0.0, le=1.0)
    document_id: Optional[str] = Field(default=None, description="Optional document filter")

class SearchResultItemDto(BaseModel):
    chunk_id: str
    document_id: str
    document_name: str
    content: str
    score: float
    clause_reference: Optional[str] = None

class SearchResponseDto(BaseModel):
    query: str
    total_results: int
    results: List[SearchResultItemDto] = Field(default_factory=list)
