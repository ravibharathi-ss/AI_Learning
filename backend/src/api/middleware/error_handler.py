"""
Centralized Error Handling Middleware
Standardizes API error responses and prevents sensitive information leakage.
"""

import uuid
import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from domain.exceptions.domain_exceptions import DomainException, DocumentNotFoundException, SecurityViolationException

logger = logging.getLogger("rag_api.error_handler")

async def global_exception_handler(request: Request, exc: Exception):
    trace_id = str(uuid.uuid4())

    if isinstance(exc, DocumentNotFoundException):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "status": 404,
                "title": "Document Not Found",
                "traceId": trace_id,
                "errors": [{"message": str(exc)}]
            }
        )
    elif isinstance(exc, SecurityViolationException):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "status": 400,
                "title": "Security Violation Detected",
                "traceId": trace_id,
                "errors": [{"field": "query", "message": str(exc)}]
            }
        )
    elif isinstance(exc, DomainException):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "status": 422,
                "title": "Domain Rule Violation",
                "traceId": trace_id,
                "errors": [{"message": str(exc)}]
            }
        )

    # Unhandled Internal Server Errors
    logger.exception(f"Unhandled server error [Trace: {trace_id}]: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": 500,
            "title": "An unexpected server error occurred.",
            "traceId": trace_id,
            "errors": [{"message": "The server encountered an internal error. Please consult the traceId."}]
        }
    )
