import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("langfuse_service")

class LangfuseService:
    def __init__(self):
        self.public_key = os.getenv("LANGFUSE_PUBLIC_KEY", "")
        self.secret_key = os.getenv("LANGFUSE_SECRET_KEY", "")
        self.host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
        self.enabled = os.getenv("LANGFUSE_ENABLED", "false").lower() in ("true", "1", "yes")

        self.client = None
        if self.enabled and self.public_key and self.secret_key:
            try:
                from langfuse import Langfuse
                self.client = Langfuse(
                    public_key=self.public_key,
                    secret_key=self.secret_key,
                    host=self.host
                )
                logger.info(f"Langfuse initialized successfully pointing to host: {self.host}")
            except Exception as e:
                logger.warning(f"Failed to initialize Langfuse client: {e}. Falling back to no-op.")
                self.client = None
        else:
            logger.info("Langfuse is inactive (credentials not configured or LANGFUSE_ENABLED is false).")

    def is_active(self) -> bool:
        return self.client is not None

    def trace(
        self,
        name: str,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[list] = None
    ):
        """Creates and returns a Langfuse trace object or dummy wrapper."""
        if not self.is_active():
            return DummyTrace()

        try:
            return self.client.trace(
                name=name,
                session_id=session_id,
                user_id=user_id,
                metadata=metadata or {},
                tags=tags or ["rag-chatbot", "production"]
            )
        except Exception as e:
            logger.warning(f"Langfuse trace creation failed: {e}")
            return DummyTrace()

    def record_chat_turn(
        self,
        trace_name: str,
        user_query: str,
        bot_response: str,
        model_name: str,
        session_id: Optional[str] = None,
        execution_time_s: Optional[float] = None,
        retrieved_sources: Optional[list] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Convenience function to log a full RAG turn (prompt, response, sources, latency)."""
        if not self.is_active():
            return None

        try:
            tr = self.trace(
                name=trace_name,
                session_id=session_id,
                metadata={
                    **(metadata or {}),
                    "retrieved_chunk_count": len(retrieved_sources) if retrieved_sources else 0
                }
            )

            # Record retrieval span if sources were returned
            if retrieved_sources:
                tr.span(
                    name="rag_retrieval",
                    input={"query": user_query},
                    output={"chunks": retrieved_sources}
                )

            # Record generation
            tr.generation(
                name="ollama_generation",
                model=model_name,
                input=user_query,
                output=bot_response,
                metadata={"execution_time_s": execution_time_s}
            )

            # Flush asynchronously in background
            self.client.flush()
            return tr
        except Exception as e:
            logger.warning(f"Failed to record chat turn in Langfuse: {e}")
            return None

    def flush(self):
        if self.is_active():
            try:
                self.client.flush()
            except Exception as e:
                logger.warning(f"Error flushing Langfuse events: {e}")


class DummyTrace:
    """Safe no-op wrapper when Langfuse is not enabled or credentials are missing."""
    def span(self, *args, **kwargs):
        return self

    def generation(self, *args, **kwargs):
        return self

    def event(self, *args, **kwargs):
        return self

    def update(self, *args, **kwargs):
        return self

    def end(self, *args, **kwargs):
        return self


# Global singleton instance
langfuse_tracker = LangfuseService()

