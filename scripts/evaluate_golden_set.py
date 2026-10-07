"""
CLI Evaluation Runner for the 32 Golden Set Legal Contract Cases
Usage:
    python scripts/evaluate_golden_set.py [--limit N] [--case GS-001]
"""

import sys
import os
import argparse
import json
from pathlib import Path

# Setup paths
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
from application.features.evaluation.golden_set_evaluator import GoldenSetEvaluator, EvaluationReport

def main():
    parser = argparse.ArgumentParser(description="Evaluate Legal RAG System against Golden Set")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of cases to run")
    parser.add_argument("--case", type=str, default=None, help="Run a specific case ID (e.g. GS-005)")
    args = parser.parse_args()

    print("=" * 75)
    print("SOFT SUAVE AI LEAGUE - LEGAL RAG GOLDEN SET EVALUATION")
    print("=" * 75)

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
        timeout=settings.llm.timeout_seconds
    )
    chat_use_case = ChatRagUseCase(
        vector_store=vector_store,
        embedding_service=embedding_service,
        llm_service=llm_service,
        doc_repo=doc_repo,
        similarity_threshold=0.25
    )

    evaluator = GoldenSetEvaluator(chat_use_case=chat_use_case)

    if args.case:
        golden_data = evaluator.load_golden_set()
        matching = [c for c in golden_data.get("cases", []) if c["id"] == args.case]
        if not matching:
            print(f"Error: Case {args.case} not found in Golden Set.")
            sys.exit(1)
        case = matching[0]
        print(f"\n[Evaluating Single Case: {case['id']}]")
        print(f"Question: {case['question']}")
        print(f"Class:    {case.get('class')}")
        print(f"Expected: {case.get('expected_answer')}")
        res = evaluator.evaluate_case(case)
        print("-" * 75)
        print(f"Status:   {res.status.upper()}")
        print(f"Latency:  {res.latency_ms} ms")
        print(f"Actual:   {res.actual_answer}")
        print(f"Sources:  {res.cited_sources}")
        if res.notes:
            print(f"Notes:    {res.notes}")
        sys.exit(0)

    print(f"\nRunning evaluation on {'all 32' if not args.limit else args.limit} test cases...")
    report: EvaluationReport = evaluator.evaluate_all(limit=args.limit)

    print("\n" + "=" * 75)
    print("EVALUATION SUMMARY RESULTS")
    print("=" * 75)
    print(f"Total Test Cases Evaluated : {report.total_cases}")
    print(f"Passed Cases               : {report.passed_cases}")
    print(f"Accuracy Rate              : {report.accuracy_percentage}%")
    print(f"Average Latency            : {report.avg_latency_ms} ms")
    print("-" * 75)
    print(f"{'Category / Class':<35} {'Passed':<8} {'Total':<8} {'Accuracy':<10}")
    print("-" * 75)
    for c_name, stats in report.class_breakdown.items():
        print(f"{c_name:<35} {stats['passed']:<8} {stats['total']:<8} {stats['accuracy']}%")

    if report.failure_breakdown:
        print("\n" + "-" * 75)
        print("FAILURE TAXONOMY BREAKDOWN")
        print("-" * 75)
        for f_type, count in report.failure_breakdown.items():
            print(f"  - {f_type}: {count}")

    # Save detailed JSON report
    out_dir = ROOT_DIR / "evaluation_results"
    out_dir.mkdir(exist_ok=True)
    out_file = out_dir / "golden_set_run_report.json"
    
    report_dict = {
        "total_cases": report.total_cases,
        "passed_cases": report.passed_cases,
        "accuracy_percentage": report.accuracy_percentage,
        "avg_latency_ms": report.avg_latency_ms,
        "class_breakdown": report.class_breakdown,
        "failure_breakdown": report.failure_breakdown,
        "cases": [
            {
                "id": c.id,
                "question": c.question,
                "class": c.case_class,
                "status": c.status,
                "latency_ms": c.latency_ms,
                "actual_answer": c.actual_answer,
                "expected_answer": c.expected_answer,
                "notes": c.notes,
                "cited_sources": c.cited_sources
            }
            for c in report.case_results
        ]
    }
    out_file.write_text(json.dumps(report_dict, indent=2), encoding="utf-8")
    print(f"\nDetailed evaluation report saved to: {out_file}")
    print("=" * 75)

    db.close()

if __name__ == "__main__":
    main()
