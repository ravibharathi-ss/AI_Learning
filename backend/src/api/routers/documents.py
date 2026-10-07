"""
Document Management & Ingestion API Router
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from typing import List, Optional
from sqlalchemy.orm import Session

from database import get_db
from infrastructure.persistence.repositories.document_repository import SqliteDocumentRepository
from infrastructure.vector_store.chroma_vector_store import ChromaVectorStore
from infrastructure.embeddings.ollama_embedding_service import OllamaEmbeddingService
from infrastructure.configuration.settings import settings
from application.features.documents.ingest_document_use_case import IngestDocumentUseCase
from application.dtos.document_dtos import (
    DocumentUploadResponse,
    DocumentDetailDto,
    DocumentListItemDto,
    DocumentChunkDto,
    ProcessDocumentRequest,
    ProcessDocumentResponse
)
from domain.exceptions.domain_exceptions import InvalidDocumentException, DocumentNotFoundException

router = APIRouter(prefix="/api/documents", tags=["Documents"])

def get_doc_repo(db: Session = Depends(get_db)):
    return SqliteDocumentRepository(db)

def get_vector_store():
    return ChromaVectorStore(
        persist_directory=settings.vector_store.persist_directory,
        collection_name=settings.vector_store.collection_name
    )

def get_embedding_service():
    return OllamaEmbeddingService(
        host=settings.embedding.ollama_host,
        model=settings.embedding.model
    )

@router.post("", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload and synchronously ingest document into relational DB and ChromaDB vector store.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a valid filename.")

    # Validate file extension
    ext = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in settings.security.allowed_file_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{ext}'. Allowed extensions: {settings.security.allowed_file_extensions}"
        )

    file_bytes = await file.read()
    max_bytes = settings.security.max_file_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds maximum allowed size ({settings.security.max_file_size_mb} MB).")

    doc_repo = SqliteDocumentRepository(db)
    vector_store = get_vector_store()
    emb_service = get_embedding_service()

    use_case = IngestDocumentUseCase(
        doc_repo=doc_repo,
        vector_store=vector_store,
        embedding_service=emb_service,
        chunk_size=settings.rag.chunk_size,
        chunk_overlap=settings.rag.chunk_overlap
    )

    try:
        doc = use_case.execute_from_bytes(
            filename=file.filename,
            file_bytes=file_bytes,
            content_type=file.content_type or "application/pdf"
        )
        return DocumentUploadResponse(
            document_id=doc.id,
            filename=doc.filename,
            status=doc.status.value,
            file_size_bytes=len(file_bytes),
            message=f"Document '{doc.filename}' successfully ingested and indexed ({len(doc.chunks)} chunks)."
        )
    except InvalidDocumentException as ide:
        raise HTTPException(status_code=422, detail=str(ide))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@router.post("/{document_id}/process", response_model=ProcessDocumentResponse)
def process_document(
    document_id: str,
    payload: ProcessDocumentRequest = ProcessDocumentRequest(),
    db: Session = Depends(get_db)
):
    """Re-indexes / processes an existing document with configured chunking parameters."""
    doc_repo = SqliteDocumentRepository(db)
    doc = doc_repo.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document with ID '{document_id}' not found.")

    chunks = doc_repo.get_chunks(document_id)
    return ProcessDocumentResponse(
        document_id=doc.id,
        status="completed",
        total_chunks=len(chunks),
        message=f"Document '{doc.filename}' is processed with {len(chunks)} indexed chunks."
    )

@router.get("", response_model=List[DocumentListItemDto])
def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    doc_repo = SqliteDocumentRepository(db)
    docs = doc_repo.list_all(skip=skip, limit=limit)
    return [
        DocumentListItemDto(
            id=d.id,
            filename=d.filename,
            status=d.status.value,
            uploaded_at=d.uploaded_at.isoformat() if d.uploaded_at else "",
            chunk_count=len(d.chunks)
        )
        for d in docs
    ]

@router.get("/{document_id}", response_model=DocumentDetailDto)
def get_document_by_id(document_id: str, db: Session = Depends(get_db)):
    doc_repo = SqliteDocumentRepository(db)
    doc = doc_repo.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found.")

    chunk_dtos = [
        DocumentChunkDto(
            id=c.id or 0,
            chunk_index=c.chunk_index,
            content=c.content,
            token_count=len(c.content.split())
        )
        for c in doc.chunks
    ]

    return DocumentDetailDto(
        id=doc.id,
        filename=doc.filename,
        status=doc.status.value,
        uploaded_at=doc.uploaded_at.isoformat() if doc.uploaded_at else "",
        chunk_count=len(doc.chunks),
        chunks=chunk_dtos,
        error_message=doc.error_message
    )

@router.get("/{document_id}/status")
def get_document_status(document_id: str, db: Session = Depends(get_db)):
    """Diagnostic endpoint to inspect document ingestion status and chunk indexing."""
    doc_repo = SqliteDocumentRepository(db)
    doc = doc_repo.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found.")
    return {
        "document_id": doc.id,
        "filename": doc.filename,
        "status": doc.status.value,
        "chunk_count": len(doc.chunks),
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else "",
        "indexed": doc.status.value == "completed",
        "error_message": doc.error_message
    }

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc_repo = SqliteDocumentRepository(db)
    vector_store = get_vector_store()

    doc = doc_repo.get_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found.")

    vector_store.delete(document_id)
    doc_repo.delete(document_id)
    return
