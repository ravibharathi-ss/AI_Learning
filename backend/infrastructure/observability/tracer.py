import time
import json
import uuid
from typing import Dict, List, Any, Optional

class RequestSpan:
    def __init__(self, name: str, prompt_version: str = "v2.1"):
        self.span_id = f"span-{uuid.uuid4().hex[:8]}"
        self.name = name
        self.prompt_version = prompt_version
        self.start_time = 0.0
        self.end_time = 0.0
        self.duration_ms = 0
        self.tokens_in = 0
        self.tokens_out = 0
        self.cost_usd = 0.0
        self.retrieved_context_ids: List[str] = []
        self.cited_clause: Optional[str] = None
        self.metadata: Dict[str, Any] = {}

    def __enter__(self):
        self.start_time = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.duration_ms = int((self.end_time - self.start_time) * 1000)

    def set_tokens(self, tokens_in: int, tokens_out: int, cost_per_m_in: float = 3.00, cost_per_m_out: float = 15.00):
        self.tokens_in = tokens_in
        self.tokens_out = tokens_out
        self.cost_usd = round(
            (tokens_in / 1_000_000 * cost_per_m_in) + (tokens_out / 1_000_000 * cost_per_m_out),
            6
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "span_id": self.span_id,
            "span_name": self.name,
            "duration_ms": self.duration_ms,
            "tokens_in": self.tokens_in,
            "tokens_out": self.tokens_out,
            "cost_usd": self.cost_usd,
            "prompt_version": self.prompt_version,
            "retrieved_context_ids": self.retrieved_context_ids,
            "cited_clause": self.cited_clause,
            "metadata": self.metadata
        }

class RequestTracer:
    """
    OpenTelemetry-style per-request tracer tracking stages:
    1. Retrieval (embeddings + ChromaDB context lookup)
    2. Generation (LLM prompt + completion)
    3. Tools (deterministic assertions & post-checks)
    """
    def __init__(self, trace_id: Optional[str] = None, prompt_version: str = "v2.1", user_id: str = "anonymous"):
        self.trace_id = trace_id or f"trace-{uuid.uuid4().hex[:12]}"
        self.prompt_version = prompt_version
        self.user_id = user_id
        self.spans: List[RequestSpan] = []
        self.start_time = time.perf_counter()
        self.query = ""
        self.answer = ""
        self.cited_clause: Optional[str] = None
        self.status = "ok"

    def span(self, name: str) -> RequestSpan:
        s = RequestSpan(name=name, prompt_version=self.prompt_version)
        self.spans.append(s)
        return s

    def finalize(self, query: str, answer: str, cited_clause: Optional[str] = None) -> Dict[str, Any]:
        self.query = query
        self.answer = answer
        self.cited_clause = cited_clause
        total_duration_ms = int((time.perf_counter() - self.start_time) * 1000)

        total_tokens_in = sum(s.tokens_in for s in self.spans)
        total_tokens_out = sum(s.tokens_out for s in self.spans)
        total_cost = sum(s.cost_usd for s in self.spans)

        # Collect all context ids across spans
        all_context_ids = []
        for s in self.spans:
            all_context_ids.extend(s.retrieved_context_ids)

        return {
            "trace_id": self.trace_id,
            "user_id": self.user_id,
            "prompt_version": self.prompt_version,
            "total_latency_ms": total_duration_ms,
            "total_tokens_in": total_tokens_in,
            "total_tokens_out": total_tokens_out,
            "total_tokens": total_tokens_in + total_tokens_out,
            "total_cost_usd": round(total_cost, 6),
            "retrieved_context_ids": list(set(all_context_ids)),
            "cited_clause": self.cited_clause,
            "query": self.query,
            "answer": self.answer,
            "status": self.status,
            "spans": [s.to_dict() for s in self.spans]
        }
