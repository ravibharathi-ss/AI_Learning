"""
Evaluation API Router
Provides API-first endpoints to inspect and execute the Golden Set evaluation suite.
"""

from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from database import get_db

from infrastructure.configuration.settings import settings
from infrastructure.vector_store.chroma_vector_store import ChromaVectorStore
from infrastructure.embeddings.ollama_embedding_service import OllamaEmbeddingService
from infrastructure.llm.ollama_llm_service import OllamaLlmService
from infrastructure.persistence.repositories.document_repository import SqliteDocumentRepository
from application.features.chat.chat_rag_use_case import ChatRagUseCase
from application.features.evaluation.golden_set_evaluator import GoldenSetEvaluator, EvaluationReport

router = APIRouter(prefix="/api/evaluation", tags=["Evaluation"])

def get_evaluator(db: Session = Depends(get_db)) -> GoldenSetEvaluator:
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
    return GoldenSetEvaluator(chat_use_case=chat_use_case)

@router.get("/golden-set/cases")
def list_golden_set_cases(
    evaluator: GoldenSetEvaluator = Depends(get_evaluator)
) -> Dict[str, Any]:
    """Inspect all Golden Set test cases, classes, and expected answers without executing."""
    try:
        return evaluator.load_golden_set()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/golden-set/run")
def run_golden_set_evaluation(
    limit: Optional[int] = Query(None, description="Limit number of test cases to run"),
    case_id: Optional[str] = Query(None, description="Run a single test case by ID, e.g. GS-005"),
    evaluator: GoldenSetEvaluator = Depends(get_evaluator)
) -> Dict[str, Any]:
    """
    Execute Golden Set evaluation against the live Clean Architecture RAG pipeline.
    Returns full accuracy, taxonomy breakdown, and case audit records.
    """
    try:
        if case_id:
            golden_data = evaluator.load_golden_set()
            cases = [c for c in golden_data.get("cases", []) if c["id"] == case_id]
            if not cases:
                raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
            res = evaluator.evaluate_case(cases[0])
            return {
                "case_id": res.id,
                "status": res.status,
                "latency_ms": res.latency_ms,
                "actual_answer": res.actual_answer,
                "expected_answer": res.expected_answer,
                "cited_sources": res.cited_sources,
                "notes": res.notes
            }

        report: EvaluationReport = evaluator.evaluate_all(limit=limit)
        return {
            "total_cases": report.total_cases,
            "passed_cases": report.passed_cases,
            "accuracy_percentage": report.accuracy_percentage,
            "avg_latency_ms": report.avg_latency_ms,
            "class_breakdown": report.class_breakdown,
            "failure_breakdown": report.failure_breakdown,
            "cases": [
                {
                    "id": c.id,
                    "class": c.case_class,
                    "status": c.status,
                    "latency_ms": c.latency_ms,
                    "actual_answer": c.actual_answer,
                    "notes": c.notes,
                    "cited_sources": c.cited_sources
                }
                for c in report.case_results
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
