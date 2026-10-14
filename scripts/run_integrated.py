#!/usr/bin/env python3
"""
Single-Command Integrated Contract Review Assistant CLI
Runs end-to-end grounded query execution with amendment chain resolution,
counterparty scoping, defined-term Chase, and structured span telemetry.

Usage:
    python scripts/run_integrated.py "What is the liability cap in Section 8.3 of Northwind MSA?"
    python scripts/run_integrated.py --counterparty "Vertex Retail" "What is the liability cap?"
    python scripts/run_integrated.py --interactive
"""

import sys
import argparse
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "src"))

from database import SessionLocal
from infrastructure.configuration.settings import settings
from infrastructure.vector_store.chroma_vector_store import ChromaVectorStore
from infrastructure.embeddings.ollama_embedding_service import OllamaEmbeddingService
from infrastructure.llm.ollama_llm_service import OllamaLlmService
from infrastructure.persistence.repositories.document_repository import SqliteDocumentRepository
from application.features.chat.chat_rag_use_case import ChatRagUseCase
from application.dtos.chat_dtos import ChatRequestDto

def setup_use_case():
    db = SessionLocal()
    doc_repo = SqliteDocumentRepository(db)
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
        timeout=180.0
    )
    return ChatRagUseCase(
        vector_store=vector_store,
        embedding_service=embedding_service,
        llm_service=llm_service,
        doc_repo=doc_repo,
        similarity_threshold=0.25
    )

def execute_query(use_case, query: str):
    print("\n" + "=" * 78)
    print(f"QUERY: {query}")
    print("=" * 78)

    resp = use_case.execute(ChatRequestDto(query=query))

    print("\n--- LEGAL ASSISTANT RESPONSE ---")
    print(resp.answer)
    print("\n--- AUDITABLE CITATIONS & VERIFIED SOURCES ---")
    if resp.sources:
        for idx, src in enumerate(resp.sources, 1):
            doc = src.source_doc or src.document_name
            clause = src.clause_reference or "General"
            print(f"[{idx}] {doc} | {clause} | Match Score: {src.score}")
    else:
        print("(No positive document citations - Refusal path executed)")

    print("\n--- TELEMETRY & SPAN METRICS ---")
    print(f"Trace ID:    {resp.trace_id}")
    print(f"Latency:     {resp.latency_ms} ms")
    print(f"Cost (USD):  ${resp.cost_usd:.6f}")
    print(f"Grounded:    {resp.is_grounded}")
    print("=" * 78 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Integrated Contract Review Assistant")
    parser.add_argument("query", nargs="?", default=None, help="Contract query to execute")
    parser.add_argument("--interactive", action="store_true", help="Launch interactive CLI prompt")
    args = parser.parse_args()

    use_case = setup_use_case()

    if args.interactive:
        print("Interactive Contract Review Assistant. Type 'exit' to quit.")
        while True:
            try:
                q = input("\nEnter query > ").strip()
                if not q or q.lower() in ["exit", "quit", "q"]:
                    break
                execute_query(use_case, q)
            except (KeyboardInterrupt, EOFError):
                break
    elif args.query:
        execute_query(use_case, args.query)
    else:
        default_q = "What is the liability cap in Section 8.3 of the Northwind Master Services Agreement?"
        execute_query(use_case, default_q)

if __name__ == "__main__":
    main()
