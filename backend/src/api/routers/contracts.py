"""
Contracts & Canary Routing API Router
"""

import random
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from database import get_db
from domain.contracts.models import PROMPT_VERSIONS
from application.dtos.chat_dtos import ChatRequestDto
from api.routers.chat import get_chat_use_case
from application.features.chat.chat_rag_use_case import ChatRagUseCase

router = APIRouter(prefix="/api/contracts", tags=["Contracts QA"])

class ContractQueryRequest(BaseModel):
    query: str = Field(..., description="Legal question regarding contract terms")
    user_id: Optional[str] = Field("alex.vance@legalpartners.com", description="User ID or email")
    prompt_version: Optional[str] = Field("v2.2", description="Prompt version (v2.1 or v2.2)")
    canary_percent: Optional[float] = Field(None, description="Optional percentage routed to v2.2")

@router.post("/query")
def query_contract(
    payload: ContractQueryRequest,
    use_case: ChatRagUseCase = Depends(get_chat_use_case)
):
    effective_version = payload.prompt_version or "v2.2"
    if payload.canary_percent is not None:
        effective_version = "v2.2" if (random.random() * 100 < payload.canary_percent) else "v2.1"

    req_dto = ChatRequestDto(
        query=payload.query,
        user_id=payload.user_id,
        prompt_version=effective_version,
        agent_type="legal_specialist"
    )
    result = use_case.execute(req_dto)
    return {
        "success": True,
        "trace_id": result.trace_id,
        "prompt_version": result.prompt_version,
        "query": payload.query,
        "response": result.answer,
        "cited_clause": result.cited_clause,
        "latency_ms": result.latency_ms,
        "total_tokens": result.total_tokens,
        "cost_usd": result.cost_usd,
        "sources": [s.model_dump() for s in result.sources]
    }

@router.get("/versions")
def get_prompt_versions():
    return {
        "active_production_version": "v2.2",
        "previous_baseline_version": "v2.1",
        "registry": PROMPT_VERSIONS
    }
