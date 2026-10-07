from pydantic import BaseModel, Field
from typing import Generic, TypeVar, Optional, List, Any

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    trace_id: Optional[str] = None

class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str

class ErrorResponse(BaseModel):
    status: int
    title: str
    trace_id: str
    errors: List[ErrorDetail] = Field(default_factory=list)

class HealthStatusDto(BaseModel):
    status: str = "healthy"
    database: str = "connected"
    vector_store: str = "ready"
    embedding_service: str = "ready"
    llm_service: str = "ready"
    version: str = "2.2.0"
