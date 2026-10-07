"""
Chat & Grounded Question-Answering API Router
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db

from application.dtos.chat_dtos import ChatRequestDto, ChatResponseDto
from application.features.chat.chat_rag_use_case import ChatRagUseCase
from infrastructure.vector_store.chroma_vector_store import ChromaVectorStore
from infrastructure.embeddings.ollama_embedding_service import OllamaEmbeddingService
from infrastructure.llm.ollama_llm_service import OllamaLlmService
from infrastructure.persistence.repositories.document_repository import SqliteDocumentRepository
from data_access.repositories.trace_repo import TraceRepository
from infrastructure.configuration.settings import settings
from domain.exceptions.domain_exceptions import SecurityViolationException

router = APIRouter(prefix="/api/chat", tags=["Chat & Grounded Q&A"])

def get_chat_use_case(db: Session = Depends(get_db)):
    vector_store = ChromaVectorStore(
        persist_directory=settings.vector_store.persist_directory,
        collection_name=settings.vector_store.collection_name
    )
    embedding_service = OllamaEmbeddingService(
        host=settings.embedding.ollama_host,
        model=settings.embedding.model
    )
    llm_service = OllamaLlmService(
        base_url=settings.llm.ollama_base_url,
        model=settings.llm.model,
        timeout=settings.llm.timeout_seconds
    )
    doc_repo = SqliteDocumentRepository(db)
    trace_repo = TraceRepository(db)

    return ChatRagUseCase(
        vector_store=vector_store,
        embedding_service=embedding_service,
        llm_service=llm_service,
        doc_repo=doc_repo,
        similarity_threshold=settings.rag.similarity_threshold,
        trace_repo=trace_repo
    )

@router.post("", response_model=ChatResponseDto)
def ask_question(
    payload: ChatRequestDto,
    use_case: ChatRagUseCase = Depends(get_chat_use_case)
):
    """
    Executes end-to-end Grounded RAG query answering:
    - Rejects prompt injection attempts
    - Retrieves top-K relevant chunks with similarity threshold
    - Returns citations and explicit ungrounded refusal if information is missing
    """
    try:
        return use_case.execute(payload)
    except SecurityViolationException as sve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Security violation detected: {sve.threat_type}"
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
