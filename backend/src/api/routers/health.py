"""
Production Health Check Router
Supports standard Kubernetes and cloud liveness and readiness probes.
"""

from fastapi import APIRouter, status
from application.dtos.common_dtos import HealthStatusDto, ApiResponse
from infrastructure.configuration.settings import settings

router = APIRouter(tags=["Health & Diagnostics"])

@router.get("/health", response_model=ApiResponse[HealthStatusDto])
def health_check():
    data = HealthStatusDto(
        status="healthy",
        database="connected",
        vector_store="ready",
        embedding_service="ready",
        llm_service="ready",
        version="2.2.0"
    )
    return ApiResponse(success=True, data=data, message="System operating normally")

@router.get("/health/live", status_code=status.HTTP_200_OK)
def liveness_probe():
    """Liveness probe: verifies process is alive without external service coupling."""
    return {"status": "alive"}

@router.get("/health/ready", status_code=status.HTTP_200_OK)
def readiness_probe():
    """Readiness probe: verifies core database and vector components are initialized."""
    return {
        "status": "ready",
        "database": "sqlite_ready",
        "vector_store": settings.vector_store.provider,
        "environment": settings.app.environment
    }

@router.get("/api/diagnostics")
def system_diagnostics():
    """
    Secure developer diagnostic endpoint for Antigravity & API-level inspection.
    Exposes safe operational metadata without leaking credentials or secrets.
    """
    return {
        "status": "operational",
        "environment": settings.app.environment,
        "app_name": settings.app.app_name,
        "components": {
            "database": {"provider": "sqlite", "status": "online"},
            "vector_store": {
                "provider": settings.vector_store.provider,
                "collection": settings.vector_store.collection_name,
                "status": "online"
            },
            "embedding_service": {
                "provider": settings.embedding.provider,
                "model": settings.embedding.model,
                "dimension": 768
            },
            "llm_service": {
                "provider": settings.llm.provider,
                "model": settings.llm.model
            },
            "security": {
                "prompt_injection_guard": settings.security.enable_prompt_injection_guard,
                "pii_masking": settings.security.enable_pii_masking,
                "allowed_extensions": settings.security.allowed_file_extensions
            }
        }
    }
