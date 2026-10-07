from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    status: str
    file_size_bytes: int
    message: str

class DocumentChunkDto(BaseModel):
    id: int
    chunk_index: int
    content: str
    token_count: Optional[int] = None

class DocumentDetailDto(BaseModel):
    id: str
    filename: str
    status: str
    uploaded_at: str
    chunk_count: int
    chunks: List[DocumentChunkDto] = Field(default_factory=list)
    error_message: Optional[str] = None

class DocumentListItemDto(BaseModel):
    id: str
    filename: str
    status: str
    uploaded_at: str
    chunk_count: int

class ProcessDocumentRequest(BaseModel):
    chunk_size: Optional[int] = Field(None, ge=100, le=2000)
    chunk_overlap: Optional[int] = Field(None, ge=0, le=500)

class ProcessDocumentResponse(BaseModel):
    document_id: str
    status: str
    total_chunks: int
    message: str
