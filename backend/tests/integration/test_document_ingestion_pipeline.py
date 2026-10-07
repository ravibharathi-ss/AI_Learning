"""
Integration Test: Document Ingestion Pipeline
Validates Upload -> Parsing -> Chunking -> Embedding -> Vector Store & DB Indexing.
"""

import pytest
from database import SessionLocal
from infrastructure.persistence.repositories.document_repository import SqliteDocumentRepository
from infrastructure.vector_store.chroma_vector_store import ChromaVectorStore
from infrastructure.embeddings.ollama_embedding_service import MockEmbeddingService
from application.features.documents.ingest_document_use_case import IngestDocumentUseCase
from domain.enums.document_status import DocumentStatus

class TestDocumentIngestionPipeline:

    def setup_method(self):
        self.session = SessionLocal()
        self.doc_repo = SqliteDocumentRepository(self.session)
        self.vector_store = ChromaVectorStore(persist_directory="./test_chroma_db", collection_name="test_integration")
        self.embed_service = MockEmbeddingService(dimension=64)
        self.use_case = IngestDocumentUseCase(
            doc_repo=self.doc_repo,
            vector_store=self.vector_store,
            embedding_service=self.embed_service,
            chunk_size=300,
            chunk_overlap=50
        )

    def teardown_method(self):
        self.session.close()

    def test_complete_ingestion_workflow(self):
        sample_legal_text = (
            "Section 1.1 Definitions: In this Master Services Agreement, terms are defined.\n\n"
            "Section 12.3 Termination for Convenience: Customer may terminate this Agreement upon providing at least sixty (60) days prior written notice.\n\n"
            "Section 15.1 Governing Law: This Agreement shall be governed exclusively by the laws of the State of Delaware."
        )
        file_bytes = sample_legal_text.encode("utf-8")
        filename = "Integration_Test_Contract.txt"

        # Execute Ingestion
        doc = self.use_case.execute_from_bytes(
            filename=filename,
            file_bytes=file_bytes,
            content_type="text/plain"
        )

        assert doc is not None
        assert doc.status == DocumentStatus.COMPLETED
        assert len(doc.chunks) >= 2

        # Verify chunks persisted in database
        persisted_doc = self.doc_repo.get_by_id(doc.id)
        assert persisted_doc is not None
        assert len(persisted_doc.chunks) == len(doc.chunks)

        # Verify indexed in vector store
        query_vec = self.embed_service.generate_embedding("termination convenience notice")
        search_res = self.vector_store.search(query_vec, top_k=2, filters={"document_id": doc.id})
        assert len(search_res) > 0
        assert "Termination" in search_res[0].content

        # Cleanup
        self.doc_repo.delete(doc.id)
        self.vector_store.delete(doc.id)
