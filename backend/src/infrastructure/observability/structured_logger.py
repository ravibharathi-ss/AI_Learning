"""
Production Structured Logging Subsystem
Provides JSON structured logging, context propagation via contextvars,
sensitive data redaction, and HTTP access timing metrics.
"""

import os
import sys
import json
import time
import logging
import traceback
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Context Variables for Distributed Request & Session Correlation
request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
session_id_ctx: ContextVar[Optional[str]] = ContextVar("session_id", default=None)
trace_id_ctx: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)

# Sensitive keys to scrub from logs
SENSITIVE_KEYS = {
    "api_key", "password", "token", "secret", "authorization",
    "openai_api_key", "groq_api_key", "bearer", "cookie", "x-api-key"
}

def sanitize_metadata(data: Any) -> Any:
    """Recursively scrub sensitive keys and truncate oversized strings in log data."""
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if any(sk in k.lower() for sk in SENSITIVE_KEYS):
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = sanitize_metadata(v)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_metadata(item) for item in data]
    elif isinstance(data, str) and len(data) > 600:
        return data[:250] + "... [TRUNCATED]"
    return data

class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects for production ingestion."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        }

        # Contextual correlation
        req_id = request_id_ctx.get()
        if req_id:
            log_entry["request_id"] = req_id

        sess_id = session_id_ctx.get()
        if sess_id:
            log_entry["session_id"] = sess_id

        tr_id = trace_id_ctx.get()
        if tr_id:
            log_entry["trace_id"] = tr_id

        # Attach custom extra fields (e.g. latency, status_code, query_tokens)
        for key, value in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
                "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
                "created", "msecs", "relativeCreated", "thread", "threadName",
                "processName", "process", "message"
            }:
                log_entry[key] = sanitize_metadata(value)

        # Exception formatting
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else "UnknownException",
                "message": str(record.exc_info[1]),
                "stacktrace": traceback.format_exception(*record.exc_info)
            }

        return json.dumps(log_entry, default=str)

class StructuredConsoleFormatter(logging.Formatter):
    """Clean, high-readability formatter for local development console."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        req_id = request_id_ctx.get() or "-"
        sess_id = session_id_ctx.get() or "-"
        duration = getattr(record, "duration_ms", None)
        duration_str = f" [{duration}ms]" if duration is not None else ""

        status_code = getattr(record, "status_code", None)
        status_str = f" ({status_code})" if status_code is not None else ""

        base = f"[{timestamp}] [{record.levelname:<5}] [{req_id[:12]}] [{record.name}] {record.getMessage()}{status_str}{duration_str}"

        if record.exc_info:
            base += "\n" + "".join(traceback.format_exception(*record.exc_info))

        return base

def setup_production_logging():
    """
    Initializes root logger and standard library loggers with the production formatter.
    Respects LOG_FORMAT (json | console) and ENVIRONMENT (production | development).
    """
    env = os.getenv("ENVIRONMENT", "production").lower()
    log_format = os.getenv("LOG_FORMAT", "json" if env == "production" else "console").lower()
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    # Select Formatter
    if log_format == "json":
        formatter = StructuredJsonFormatter()
    else:
        formatter = StructuredConsoleFormatter()

    # Configure stdout stream handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.setLevel(log_level)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers = [handler]

    # Align standard web & framework loggers
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"]:
        l = logging.getLogger(logger_name)
        l.handlers = [handler]
        l.propagate = False
        l.setLevel(log_level)

    # Reduce noisy third-party loggers
    for noisy in ["chromadb", "urllib3", "httpx", "httpcore"]:
        logging.getLogger(noisy).setLevel(logging.WARNING)

def get_logger(name: str) -> logging.Logger:
    """Returns a named logger configured with production standards."""
    return logging.getLogger(name)

# High-level wrapper for backward compatibility with existing codebase
class StructuredLogger:
    def __init__(self, logger_name: str = "rag_enterprise"):
        self.logger = logging.getLogger(logger_name)

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
        extra: Dict[str, Any] = {
            "event": event,
            "status": status,
            "operation": operation or event,
        }
        if trace_id:
            extra["trace_id"] = trace_id
        if correlation_id:
            extra["correlation_id"] = correlation_id
        if duration_ms is not None:
            extra["duration_ms"] = duration_ms
        if metadata:
            extra["metadata"] = sanitize_metadata(metadata)

        log_fn = getattr(self.logger, level.lower(), self.logger.info)
        log_fn(f"{event} ({status})", extra=extra)

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

# Global singleton logger
logger = StructuredLogger()
