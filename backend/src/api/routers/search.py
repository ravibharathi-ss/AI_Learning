"""
Semantic & Hybrid Search API Router
"""

from fastapi import APIRouter, Depends, HTTPException
from application.dtos.search_dtos import SearchRequestDto, SearchResponseDto
from application.features.search.search_use_case import SearchUseCase
from infrastructure.vector_store.chroma_vector_store import ChromaVectorStore
from infrastructure.embeddings.ollama_embedding_service import OllamaEmbeddingService
from infrastructure.configuration.settings import settings

router = APIRouter(prefix="/api/search", tags=["Search & Retrieval"])

def get_search_use_case():
    vector_store = ChromaVectorStore(
        persist_directory=settings.vector_store.persist_directory,
        collection_name=settings.vector_store.collection_name
    )
    embedding_service = OllamaEmbeddingService(
        host=settings.embedding.ollama_host,
        model=settings.embedding.model
    )
    return SearchUseCase(vector_store=vector_store, embedding_service=embedding_service)

@router.post("", response_model=SearchResponseDto)
def search_documents(
    payload: SearchRequestDto,
    use_case: SearchUseCase = Depends(get_search_use_case)
):
    """
    Executes similarity vector search across knowledge base chunks with score thresholding.
    """
    return use_case.execute(payload)
