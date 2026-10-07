"""
SQLAlchemy Document Repository Implementing IDocumentRepository
"""

import json
from typing import List, Optional
from sqlalchemy.orm import Session
from domain.interfaces.document_repository import IDocumentRepository
from domain.entities.document import DocumentEntity, DocumentChunkEntity
from domain.enums.document_status import DocumentStatus
from data_access.models import Document, DocumentChunk

class SqliteDocumentRepository(IDocumentRepository):
    def __init__(self, db: Session):
        self.db = db

    def _to_entity(self, model: Document) -> DocumentEntity:
        return DocumentEntity(
            id=model.id,
            filename=model.filename,
            status=DocumentStatus.COMPLETED if model.chunks else DocumentStatus.PENDING,
            uploaded_at=model.uploaded_at,
            chunks=[
                DocumentChunkEntity(
                    id=c.id,
                    document_id=c.document_id,
                    content=c.content,
                    chunk_index=i,
                    embedding=json.loads(c.embedding_json) if c.embedding_json else None
                )
                for i, c in enumerate(model.chunks)
            ]
        )

    def get_by_id(self, document_id: str) -> Optional[DocumentEntity]:
        m = self.db.query(Document).filter(Document.id == document_id).first()
        return self._to_entity(m) if m else None

    def get_by_filename(self, filename: str) -> Optional[DocumentEntity]:
        m = self.db.query(Document).filter(Document.filename == filename).first()
        return self._to_entity(m) if m else None

    def list_all(self, skip: int = 0, limit: int = 50) -> List[DocumentEntity]:
        models = self.db.query(Document).order_by(Document.uploaded_at.desc()).offset(skip).limit(limit).all()
        return [self._to_entity(m) for m in models]

    def save(self, document: DocumentEntity) -> DocumentEntity:
        m = self.db.query(Document).filter(Document.id == document.id).first()
        if not m:
            m = Document(
                id=document.id,
                filename=document.filename,
                uploaded_at=document.uploaded_at
            )
            self.db.add(m)
        else:
            m.filename = document.filename

        self.db.commit()
        self.db.refresh(m)
        return self._to_entity(m)

    def update_status(self, document_id: str, status: DocumentStatus, error_message: Optional[str] = None) -> bool:
        m = self.db.query(Document).filter(Document.id == document_id).first()
        if not m:
            return False
        # status can be recorded or logged
        return True

    def delete(self, document_id: str) -> bool:
        m = self.db.query(Document).filter(Document.id == document_id).first()
        if not m:
            return False
        self.db.delete(m)
        self.db.commit()
        return True

    def get_chunks(self, document_id: str) -> List[DocumentChunkEntity]:
        chunks = self.db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).all()
        return [
            DocumentChunkEntity(
                id=c.id,
                document_id=c.document_id,
                content=c.content,
                chunk_index=i,
                embedding=json.loads(c.embedding_json) if c.embedding_json else None
            )
            for i, c in enumerate(chunks)
        ]

    def save_chunks(self, chunks: List[DocumentChunkEntity]) -> List[DocumentChunkEntity]:
        saved = []
        for c in chunks:
            model = DocumentChunk(
                document_id=c.document_id,
                content=c.content,
                embedding_json=json.dumps(c.embedding or [])
            )
            self.db.add(model)
            self.db.flush()
            c.id = model.id
            saved.append(c)
        self.db.commit()
        return saved
