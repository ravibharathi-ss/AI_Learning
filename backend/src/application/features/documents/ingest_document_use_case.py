"""
Ingest Document Use Case
Orchestrates validation, text extraction, chunking, embedding, vector storage, and status tracking.
"""

from typing import Tuple
from domain.entities.document import DocumentEntity, DocumentChunkEntity
from domain.enums.document_status import DocumentStatus
from domain.interfaces.document_repository import IDocumentRepository
from domain.interfaces.vector_store import IVectorStore, VectorRecord
from domain.interfaces.embedding_service import IEmbeddingService
from domain.exceptions.domain_exceptions import InvalidDocumentException
from infrastructure.document_processing.multi_format_loader import MultiFormatDocumentLoader
from infrastructure.document_processing.text_chunker import TextChunker
from infrastructure.observability.structured_logger import logger
from application.dtos.document_dtos import ProcessDocumentResponse

class IngestDocumentUseCase:
    def __init__(
        self,
        doc_repo: IDocumentRepository,
        vector_store: IVectorStore,
        embedding_service: IEmbeddingService,
        chunk_size: int = 750,
        chunk_overlap: int = 150
    ):
        self.doc_repo = doc_repo
        self.vector_store = vector_store
        self.embedding_service = embedding_service
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def execute_from_bytes(
        self,
        filename: str,
        file_bytes: bytes,
        content_type: str = "application/pdf"
    ) -> DocumentEntity:
        if not file_bytes:
            raise InvalidDocumentException("Cannot ingest an empty document payload (0 bytes).")

        logger.log_event(
            event="document_processing_started",
            operation="document_ingestion",
            metadata={"filename": filename, "file_size_bytes": len(file_bytes), "content_type": content_type}
        )

        # 1. Create or retrieve document entity in PENDING status
        doc = self.doc_repo.get_by_filename(filename)
        if not doc:
            doc = DocumentEntity.create(
                filename=filename,
                file_size_bytes=len(file_bytes),
                content_type=content_type
            )
            doc = self.doc_repo.save(doc)

        # 2. Extract Text & Metadata using MultiFormatDocumentLoader
        try:
            self.doc_repo.update_status(doc.id, DocumentStatus.PROCESSING)
            loaded_doc = MultiFormatDocumentLoader.load_from_bytes(filename, file_bytes)
            text_content = loaded_doc.text
            doc_metadata = loaded_doc.metadata
        except Exception as e:
            self.doc_repo.update_status(doc.id, DocumentStatus.FAILED, str(e))
            logger.log_event(
                event="document_parsing_failed",
                operation="document_ingestion",
                status="failed",
                level="ERROR",
                metadata={"document_id": doc.id, "error": str(e)}
            )
            raise

        # 3. Chunk Text
        chunker = TextChunker(chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)
        chunk_results = chunker.chunk(text_content)
        if not chunk_results:
            raise InvalidDocumentException("Document produced zero text chunks.")

        logger.log_event(
            event="chunking_completed",
            operation="document_chunking",
            metadata={"document_id": doc.id, "chunk_count": len(chunk_results)}
        )

        # 4. Generate Embeddings & Prepare Vector Records
        chunk_entities = []
        vector_records = []
        texts_to_embed = [c.content for c in chunk_results]
        embeddings = self.embedding_service.generate_embeddings_batch(texts_to_embed)

        for i, (c_res, emb) in enumerate(zip(chunk_results, embeddings)):
            chunk_meta = {
                "clause_reference": c_res.clause_reference,
                "source_doc": doc_metadata.get("source_doc"),
                "counterparty": doc_metadata.get("counterparty"),
                "effective_date": doc_metadata.get("effective_date"),
                "doc_type": doc_metadata.get("doc_type"),
                "is_controlling": doc_metadata.get("is_controlling", False)
            }
            chunk_entity = DocumentChunkEntity(
                id=None,
                document_id=doc.id,
                content=c_res.content,
                chunk_index=i,
                embedding=emb,
                metadata=chunk_meta
            )
            chunk_entities.append(chunk_entity)

        # 5. Save Chunks to Relational Database
        saved_chunks = self.doc_repo.save_chunks(chunk_entities)

        # 6. Save to Vector Store
        for sc, emb in zip(saved_chunks, embeddings):
            vector_records.append(VectorRecord(
                id=f"chunk_{sc.id}",
                vector=emb,
                document_text=sc.content,
                metadata={
                    "document_id": str(doc.id),
                    "filename": str(filename),
                    "chunk_id": int(sc.id) if sc.id is not None else 0,
                    "clause_reference": str(sc.metadata.get("clause_reference") or ""),
                    "source_doc": str(sc.metadata.get("source_doc") or ""),
                    "counterparty": str(sc.metadata.get("counterparty") or ""),
                    "effective_date": str(sc.metadata.get("effective_date") or ""),
                    "doc_type": str(sc.metadata.get("doc_type") or ""),
                    "is_controlling": bool(sc.metadata.get("is_controlling", False))
                }
            ))
        self.vector_store.upsert(vector_records)

        # 7. Update status to COMPLETED
        doc.chunks = saved_chunks
        doc.status = DocumentStatus.COMPLETED
        self.doc_repo.update_status(doc.id, DocumentStatus.COMPLETED)

        logger.log_event(
            event="document_indexing_completed",
            operation="document_ingestion",
            status="completed",
            metadata={"document_id": doc.id, "filename": filename, "indexed_chunks": len(saved_chunks)}
        )
        return doc
