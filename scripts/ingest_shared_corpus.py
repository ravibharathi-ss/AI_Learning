"""
Ingest Standard Shared Legal Contract Corpus
Cleans legacy mock documents, loads all 6 legal contracts (.md, .docx, .pdf parity),
chunks with legal clause boundary preservation, generates embeddings, and saves to SQLite & ChromaDB.
"""

import sys
import os
from pathlib import Path

# Set up backend paths
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "src"))

from database import SessionLocal, engine, Base
from infrastructure.configuration.settings import settings
from infrastructure.persistence.repositories.document_repository import SqliteDocumentRepository
from infrastructure.vector_store.chroma_vector_store import ChromaVectorStore
from infrastructure.embeddings.ollama_embedding_service import OllamaEmbeddingService
from application.features.documents.ingest_document_use_case import IngestDocumentUseCase
from infrastructure.observability.structured_logger import logger
import data_access.models as models

def main():
    print("=" * 70)
    print("INGESTING STANDARD SHARED LEGAL CONTRACT CORPUS")
    print("=" * 70)

    # 1. Initialize DB tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 2. Clear legacy / contaminated documents
    print("[1/4] Cleaning legacy documents and ChromaDB collection...")
    existing_docs = db.query(models.Document).all()
    if existing_docs:
        print(f"  Removing {len(existing_docs)} legacy documents from SQLite...")
        for doc in existing_docs:
            db.delete(doc)
        db.commit()

    # Clear ChromaDB collection
    vector_store = ChromaVectorStore(
        persist_directory=settings.vector_store.persist_directory,
        collection_name=settings.vector_store.collection_name
    )
    if vector_store.client and vector_store.collection:
        try:
            vector_store.client.delete_collection(settings.vector_store.collection_name)
            vector_store.collection = vector_store.client.create_collection(
                name=settings.vector_store.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            print("  ChromaDB collection reset successfully.")
        except Exception as e:
            print(f"  ChromaDB reset notice: {e}")

    # 3. Locate Shared Corpus Contracts
    corpus_dir = ROOT_DIR / "shared-corpus" / "contracts"
    if not corpus_dir.exists():
        print(f"ERROR: Shared corpus not found at {corpus_dir}")
        sys.exit(1)

    contract_files = sorted(list(corpus_dir.glob("*.md")))
    print(f"[2/4] Found {len(contract_files)} contracts in {corpus_dir}:")
    for f in contract_files:
        print(f"  - {f.name}")

    # 4. Ingest Documents
    print("\n[3/4] Ingesting documents with MultiFormatDocumentLoader & TextChunker...")
    doc_repo = SqliteDocumentRepository(db)
    embedding_service = OllamaEmbeddingService(
        host=settings.embedding.ollama_host,
        model=settings.embedding.model
    )
    ingest_use_case = IngestDocumentUseCase(
        doc_repo=doc_repo,
        vector_store=vector_store,
        embedding_service=embedding_service,
        chunk_size=750,
        chunk_overlap=150
    )

    total_chunks = 0
    for contract_file in contract_files:
        print(f"\nProcessing: {contract_file.name}...")
        file_bytes = contract_file.read_bytes()
        doc_entity = ingest_use_case.execute_from_bytes(
            filename=contract_file.name,
            file_bytes=file_bytes,
            content_type="text/markdown"
        )
        chunk_count = len(doc_entity.chunks)
        total_chunks += chunk_count
        print(f"  -> Ingested doc ID: {doc_entity.id} ({chunk_count} chunks indexed)")

    # 5. Verification
    print("\n" + "=" * 70)
    print(f"[4/4] INGESTION COMPLETE: {len(contract_files)} documents, {total_chunks} total chunks.")
    chroma_count = vector_store.count()
    print(f"ChromaDB total indexed vectors: {chroma_count}")
    print("=" * 70)

    db.close()

if __name__ == "__main__":
    main()
