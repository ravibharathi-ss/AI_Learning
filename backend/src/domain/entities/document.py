from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
import uuid
from ..enums.document_status import DocumentStatus

@dataclass
class DocumentChunkEntity:
    id: Optional[int]
    document_id: str
    content: str
    chunk_index: int = 0
    embedding: Optional[List[float]] = None
    metadata: dict = field(default_factory=dict)

@dataclass
class DocumentEntity:
    id: str
    filename: str
    status: DocumentStatus = DocumentStatus.PENDING
    uploaded_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    chunks: List[DocumentChunkEntity] = field(default_factory=list)
    error_message: Optional[str] = None
    file_size_bytes: int = 0
    content_type: str = "application/pdf"

    @classmethod
    def create(cls, filename: str, file_size_bytes: int = 0, content_type: str = "application/pdf") -> "DocumentEntity":
        return cls(
            id=str(uuid.uuid4()),
            filename=filename,
            status=DocumentStatus.PENDING,
            file_size_bytes=file_size_bytes,
            content_type=content_type
        )
