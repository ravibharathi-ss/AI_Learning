"""
Search Use Case: Semantic, Keyword & Hybrid Vector Retrieval
"""

from typing import List, Optional
from domain.interfaces.vector_store import IVectorStore
from domain.interfaces.embedding_service import IEmbeddingService
from application.dtos.search_dtos import SearchRequestDto, SearchResponseDto, SearchResultItemDto

class SearchUseCase:
    def __init__(self, vector_store: IVectorStore, embedding_service: IEmbeddingService):
        self.vector_store = vector_store
        self.embedding_service = embedding_service

    def execute(self, request: SearchRequestDto) -> SearchResponseDto:
        # 1. Generate query embedding
        query_vector = self.embedding_service.generate_embedding(request.query)

        # 2. Build metadata filters if specified
        filters = None
        if request.document_id:
            filters = {"document_id": request.document_id}

        # 3. Search vector store with similarity threshold
        raw_results = self.vector_store.search(
            query_vector=query_vector,
            top_k=request.top_k or 3,
            filters=filters,
            min_score=request.similarity_threshold or 0.35
        )

        items = []
        for r in raw_results:
            items.append(SearchResultItemDto(
                chunk_id=r.chunk_id,
                document_id=r.document_id,
                document_name=r.metadata.get("filename", "Unknown Document"),
                content=r.content,
                score=r.score,
                clause_reference=r.metadata.get("clause_reference")
            ))

        return SearchResponseDto(
            query=request.query,
            total_results=len(items),
            results=items
        )
