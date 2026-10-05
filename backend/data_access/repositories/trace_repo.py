import json
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from ..models import Trace, SpanLog, TraceAnnotation

class TraceRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_trace(
        self,
        query: str,
        llm_response: str,
        latency_ms: int,
        prompt_version: str = "v2.1",
        user_id: str = "anonymous",
        cited_clause: Optional[str] = None,
        cost_usd: float = 0.0,
        track_code: str = "F",
        retrieved_chunks: Optional[List[Dict[str, Any]]] = None,
        system_prompt: Optional[str] = None,
        conversation_id: Optional[str] = None,
        spans_data: Optional[List[Dict[str, Any]]] = None
    ) -> Trace:
        trace = Trace(
            query=query,
            llm_response=llm_response,
            latency_ms=latency_ms,
            prompt_version=prompt_version,
            user_id=user_id,
            cited_clause=cited_clause,
            cost_usd=cost_usd,
            track_code=track_code,
            retrieved_chunks_json=json.dumps(retrieved_chunks or []),
            system_prompt=system_prompt,
            conversation_id=conversation_id
        )
        self.db.add(trace)
        self.db.flush()

        if spans_data:
            for s in spans_data:
                span = SpanLog(
                    trace_id=trace.id,
                    span_name=s.get("span_name", "step"),
                    duration_ms=s.get("duration_ms", 0),
                    tokens_in=s.get("tokens_in", 0),
                    tokens_out=s.get("tokens_out", 0),
                    cost_usd=s.get("cost_usd", 0.0),
                    prompt_version=s.get("prompt_version", prompt_version),
                    retrieved_context_ids_json=json.dumps(s.get("retrieved_context_ids", [])),
                    cited_clause=s.get("cited_clause", cited_clause),
                    status=s.get("status", "ok")
                )
                self.db.add(span)

        self.db.commit()
        self.db.refresh(trace)
        return trace

    def query_slice(
        self,
        slice_type: str,
        slice_value: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Slices production logs based on the support drill criteria:
        - 'time': date/day slice (e.g. 'Thursday' or '2026-10-01')
        - 'user': user_id slice
        - 'prompt_version': prompt version tag (e.g. 'v2.1', 'v2.2')
        - 'input_keyword': search query string
        - 'output_keyword': search LLM response string
        - 'cost_outlier': cost higher than threshold
        - 'cited_clause': search cited_clause tag
        """
        query = self.db.query(Trace)

        if slice_type == "time" and slice_value:
            # Filter by date substring or day
            query = query.filter(Trace.timestamp.cast(str).like(f"%{slice_value}%"))
        elif slice_type == "user" and slice_value:
            query = query.filter(Trace.user_id.like(f"%{slice_value}%"))
        elif slice_type == "prompt_version" and slice_value:
            query = query.filter(Trace.prompt_version == slice_value)
        elif slice_type == "input_keyword" and slice_value:
            query = query.filter(Trace.query.ilike(f"%{slice_value}%"))
        elif slice_type == "output_keyword" and slice_value:
            query = query.filter(Trace.llm_response.ilike(f"%{slice_value}%"))
        elif slice_type == "cost_outlier":
            threshold = float(slice_value or 0.005)
            query = query.filter(Trace.cost_usd >= threshold)
        elif slice_type == "cited_clause" and slice_value:
            query = query.filter(Trace.cited_clause.ilike(f"%{slice_value}%"))

        traces = query.order_by(desc(Trace.timestamp)).limit(limit).all()

        results = []
        for t in traces:
            spans = []
            for s in t.spans:
                spans.append({
                    "span_id": s.id,
                    "span_name": s.span_name,
                    "duration_ms": s.duration_ms,
                    "tokens_in": s.tokens_in,
                    "tokens_out": s.tokens_out,
                    "cost_usd": s.cost_usd,
                    "prompt_version": s.prompt_version,
                    "retrieved_context_ids": json.loads(s.retrieved_context_ids_json or "[]"),
                    "cited_clause": s.cited_clause
                })

            results.append({
                "trace_id": t.id,
                "timestamp": t.timestamp.isoformat() if t.timestamp else "",
                "user_id": t.user_id,
                "prompt_version": t.prompt_version,
                "query": t.query,
                "llm_response": t.llm_response,
                "latency_ms": t.latency_ms,
                "cost_usd": t.cost_usd,
                "cited_clause": t.cited_clause,
                "spans": spans
            })

        return results
