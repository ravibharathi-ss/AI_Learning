"""
Traces & Observability Router
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from database import get_db
from data_access.repositories.trace_repo import TraceRepository

router = APIRouter(prefix="/api/traces", tags=["Observability & Traces"])

class DrillSliceRequest(BaseModel):
    slice_type: str = Field(..., description="time, user, prompt_version, input_keyword, output_keyword, cost_outlier, cited_clause")
    slice_value: Optional[str] = Field(None, description="Value to match (e.g. '2026-10-01' or 'Section 14.2')")
    limit: Optional[int] = Field(50, description="Max traces to return")

@router.get("")
def list_traces(
    limit: int = Query(50, ge=1, le=200),
    slice_type: Optional[str] = None,
    slice_value: Optional[str] = None,
    db: Session = Depends(get_db)
):
    repo = TraceRepository(db)
    if slice_type:
        return repo.query_slice(slice_type=slice_type, slice_value=slice_value, limit=limit)
    return repo.query_slice(slice_type="prompt_version", slice_value="v2.1", limit=limit)

@router.post("/drill/slice")
def execute_drill_slice(payload: DrillSliceRequest, db: Session = Depends(get_db)):
    repo = TraceRepository(db)
    matches = repo.query_slice(
        slice_type=payload.slice_type,
        slice_value=payload.slice_value,
        limit=payload.limit or 50
    )
    total_matches = repo.count_slice(
        slice_type=payload.slice_type,
        slice_value=payload.slice_value
    )
    return {
        "slice_type": payload.slice_type,
        "slice_value": payload.slice_value,
        "total_matches": total_matches,
        "returned_count": len(matches),
        "traces": matches
    }

@router.get("/observability/stats")
def get_aggregate_stats(db: Session = Depends(get_db)):
    repo = TraceRepository(db)
    return repo.get_aggregate_stats()

@router.get("/{trace_id}")
def get_trace_detail(trace_id: str, db: Session = Depends(get_db)):
    repo = TraceRepository(db)
    trace = repo.get_by_id(trace_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    return trace
