"""
Re-export ORM models from data_access.models
Maintains a single source of truth for all database tables and entities.
"""

from data_access.models import (
    Base,
    utc_now,
    Conversation,
    Message,
    Feedback,
    Document,
    DocumentChunk,
    Trace,
    SpanLog,
    TraceAnnotation,
    ErrorTaxonomyCategory
)

__all__ = [
    "Base",
    "utc_now",
    "Conversation",
    "Message",
    "Feedback",
    "Document",
    "DocumentChunk",
    "Trace",
    "SpanLog",
    "TraceAnnotation",
    "ErrorTaxonomyCategory"
]
