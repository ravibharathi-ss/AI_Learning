"""
Structured JSON Logger for Enterprise RAG & Antigravity Code-Level Debugging
Provides safe, contextual diagnostic logs with trace/correlation IDs.
"""

import os
import sys
import json
import time
import logging
from typing import Dict, Any, Optional
from datetime import datetime

# Filter out sensitive fields
SENSITIVE_KEYS = {
    "api_key", "password", "token", "secret", "authorization", 
    "openai_api_key", "groq_api_key", "bearer", "cookie"
}

def sanitize_metadata(data: Dict[str, Any]) -> Dict[str, Any]:
    sanitized = {}
    for k, v in data.items():
        if any(sk in k.lower() for sk in SENSITIVE_KEYS):
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_metadata(v)
        elif isinstance(v, str) and len(v) > 500:
            # Truncate overly long text snippets to keep logs concise and clean
            sanitized[k] = v[:200] + "... [TRUNCATED]"
        else:
            sanitized[k] = v
    return sanitized

class StructuredLogger:
    def __init__(self, logger_name: str = "rag_enterprise"):
        self.logger = logging.getLogger(logger_name)
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            formatter = logging.Formatter('%(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def log_event(
        self,
        event: str,
        trace_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        operation: Optional[str] = None,
        status: str = "ok",
        duration_ms: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        level: str = "INFO"
    ):
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "event": event,
            "status": status,
            "trace_id": trace_id or "trace-unassigned",
            "correlation_id": correlation_id or trace_id or "corr-unassigned",
            "operation": operation or event,
        }
        if duration_ms is not None:
            entry["duration_ms"] = duration_ms
        if metadata:
            entry["metadata"] = sanitize_metadata(metadata)

        msg = json.dumps(entry, default=str)
        if level.upper() == "ERROR":
            self.logger.error(msg)
        elif level.upper() == "WARNING":
            self.logger.warning(msg)
        else:
            self.logger.info(msg)

    def operation_scope(self, operation: str, trace_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None):
        return OperationContext(self, operation, trace_id, metadata)

class OperationContext:
    def __init__(self, logger: StructuredLogger, operation: str, trace_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None):
        self.logger = logger
        self.operation = operation
        self.trace_id = trace_id
        self.metadata = metadata or {}
        self.start_time = 0.0

    def __enter__(self):
        self.start_time = time.perf_counter()
        self.logger.log_event(
            event=f"{self.operation}_started",
            trace_id=self.trace_id,
            operation=self.operation,
            status="started",
            metadata=self.metadata
        )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = int((time.perf_counter() - self.start_time) * 1000)
        status = "failed" if exc_type else "completed"
        extra = dict(self.metadata)
        if exc_val:
            extra["error"] = str(exc_val)
        self.logger.log_event(
            event=f"{self.operation}_{status}",
            trace_id=self.trace_id,
            operation=self.operation,
            status=status,
            duration_ms=duration_ms,
            metadata=extra,
            level="ERROR" if exc_type else "INFO"
        )

# Global singleton
logger = StructuredLogger()
