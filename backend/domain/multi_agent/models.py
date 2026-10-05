import re
import uuid
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone
import threading

logger = logging.getLogger("multi_agent_domain")

class MultiAgentError(Exception):
    """Base exception for Multi-Agent domain errors."""
    pass

class InputValidationError(MultiAgentError):
    """Raised when user input fails validation constraints."""
    pass

class AgentExecutionError(MultiAgentError):
    """Raised when an individual agent fails during execution."""
    pass

class SecuritySanitizer:
    MAX_QUERY_LENGTH = 10000
    INJECTION_PATTERNS = [
        re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions", re.IGNORECASE),
        re.compile(r"disregard\s+(all\s+)?(previous|prior)\s+rules", re.IGNORECASE),
        re.compile(r"reveal\s+(system\s+prompt|secret|api[_\s]key)", re.IGNORECASE),
        re.compile(r"bypass\s+safety\s+filter", re.IGNORECASE),
        re.compile(r"you\s+are\s+now\s+in\s+developer\s+mode", re.IGNORECASE),
    ]

    @classmethod
    def sanitize(cls, query: Any) -> Tuple[str, List[str]]:
        if query is None:
            raise InputValidationError("Query cannot be None.")
        if not isinstance(query, str):
            query = str(query)

        query = query.strip()
        if not query:
            raise InputValidationError("Query cannot be empty or pure whitespace.")

        if len(query) > cls.MAX_QUERY_LENGTH:
            logger.warning(f"Query length {len(query)} exceeded max {cls.MAX_QUERY_LENGTH}; truncating.")
            query = query[:cls.MAX_QUERY_LENGTH]

        security_flags = []
        for pattern in cls.INJECTION_PATTERNS:
            if pattern.search(query):
                flag = f"PROMPT_INJECTION_SUSPECT: matched '{pattern.pattern}'"
                security_flags.append(flag)
                logger.warning(f"Security Alert: {flag} in query: '{query[:80]}...'")

        return query, security_flags

class TokenPricingCalculator:
    def __init__(self, input_cost_per_m: float = 3.00, output_cost_per_m: float = 15.00):
        self.input_cost_per_m = input_cost_per_m
        self.output_cost_per_m = output_cost_per_m

    def estimate_tokens(self, text: str, base_overhead: int = 100) -> int:
        if not text:
            return base_overhead
        words = len(text.split())
        return int(words * 1.33) + base_overhead

    def compute_cost_usd(self, input_tokens: int, output_tokens: int) -> float:
        input_tokens = max(0, input_tokens)
        output_tokens = max(0, output_tokens)
        cost = (input_tokens / 1_000_000 * self.input_cost_per_m) + (output_tokens / 1_000_000 * self.output_cost_per_m)
        return round(cost, 6)

    def calculate_resend_analysis(
        self,
        total_tokens: int,
        total_input_tokens: int,
        mgr_decomp_input: int,
        single_tokens: int = 1500
    ) -> Dict[str, Any]:
        ratio = round(total_tokens / max(single_tokens, 1), 2)
        if total_input_tokens > 0:
            resend_tax = round(((total_input_tokens - mgr_decomp_input) / total_input_tokens) * 100, 1)
            resend_tax = max(0.0, min(100.0, resend_tax))
        else:
            resend_tax = 0.0

        return {
            "total_llm_invocations": 4,
            "single_vs_multi_token_ratio": ratio,
            "re_send_tax_percentage": resend_tax,
            "explanation": (
                "Every delegation to Specialist 1, Specialist 2, and the Aggregator re-transmits "
                "the task context, leading to a substantial token and cost tax."
            )
        }

class A2ATaskManager:
    def __init__(self, max_tasks: int = 500):
        self._tasks: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self.max_tasks = max_tasks

    def record_task_lifecycle(
        self,
        caller_agent: str,
        target_agent: str,
        task_description: str,
        simulate_failure: bool = False,
        failure_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        task_id = f"a2a-task-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()

        logs = [
            {
                "timestamp": now,
                "state": "submitted",
                "message": f"Caller Agent '{caller_agent}' dispatched task to Target Agent '{target_agent}'.",
                "payload": {"task_id": task_id, "description": task_description}
            },
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "state": "working",
                "message": f"Target Agent '{target_agent}' validated input schema and is executing internal domain workflow.",
                "payload": {"status": "in_progress", "active_subtask": "domain_reasoning"}
            }
        ]

        if simulate_failure:
            final_state = "failed"
            error_msg = failure_reason or f"Target Agent '{target_agent}' encountered unrecoverable internal error."
            logs.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "state": "failed",
                "message": error_msg,
                "payload": {"status": "error", "error_code": "A2A_AGENT_UNAVAILABLE", "detail": error_msg}
            })
            logger.warning(f"A2A Task {task_id} failed: {error_msg}")
        else:
            final_state = "completed"
            logs.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "state": "completed",
                "message": f"Target Agent '{target_agent}' finalized structured result and returned payload over A2A protocol.",
                "payload": {
                    "status": "success",
                    "execution_time_ms": 342,
                    "findings": f"Verified analysis for query: '{task_description}'."
                }
            })
            logger.info(f"A2A Task {task_id} completed successfully from {caller_agent} to {target_agent}.")

        record = {
            "task_id": task_id,
            "caller_agent": caller_agent,
            "target_agent": target_agent,
            "final_state": final_state,
            "lifecycle_logs": logs
        }

        with self._lock:
            if len(self._tasks) >= self.max_tasks:
                oldest_key = next(iter(self._tasks))
                del self._tasks[oldest_key]
            self._tasks[task_id] = record

        return record

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._tasks.get(task_id)
