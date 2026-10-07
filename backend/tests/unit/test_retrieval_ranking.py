"""
Unit Tests for Retrieval, Ranking, and Similarity Thresholds
"""

import pytest
from infrastructure.vector_store.chroma_vector_store import ChromaVectorStore
from domain.interfaces.vector_store import VectorRecord
from infrastructure.embeddings.ollama_embedding_service import MockEmbeddingService

class TestRetrievalRanking:

    def setup_method(self):
        self.vector_store = ChromaVectorStore(persist_directory="./test_chroma_db", collection_name="test_collection")
        self.embed_service = MockEmbeddingService(dimension=64)

        # Seed test vectors
        records = [
            VectorRecord(
                id="chunk_1",
                vector=self.embed_service.generate_embedding("Section 12.3 Termination for Convenience 60 days notice"),
                document_text="Section 12.3 Termination for Convenience: 60 days prior written notice required.",
                metadata={"document_id": "doc_1", "clause_reference": "Section 12.3", "filename": "MSA.pdf"}
            ),
            VectorRecord(
                id="chunk_2",
                vector=self.embed_service.generate_embedding("Section 15.1 Governing Law in Delaware state courts"),
                document_text="Section 15.1 Governing Law: This agreement is governed by the laws of Delaware.",
                metadata={"document_id": "doc_1", "clause_reference": "Section 15.1", "filename": "MSA.pdf"}
            )
        ]
        self.vector_store.upsert(records)

    def test_relevant_query_retrieves_matching_chunk(self):
        query = "How can we terminate for convenience?"
        query_vec = self.embed_service.generate_embedding(query)
        results = self.vector_store.search(query_vec, top_k=2, min_score=0.1)

        assert len(results) > 0
        top_result = results[0]
        assert "Termination" in top_result.content
        assert top_result.metadata.get("clause_reference") == "Section 12.3"

    def test_similarity_threshold_filters_unrelated_queries(self):
        # High similarity threshold should filter out low matches
        unrelated_query = "Recipe for chocolate chip cookies with almond milk"
        unrelated_vec = self.embed_service.generate_embedding(unrelated_query)
        results = self.vector_store.search(unrelated_vec, top_k=2, min_score=0.95)

        assert len(results) == 0, "High similarity threshold must reject unrelated queries"
