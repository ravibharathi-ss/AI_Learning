"""
Security Guardrails: Prompt Injection Detection, Input Sanitization, and PII Masking
"""

import re
from typing import Tuple, Dict, Any, Optional

class SecurityGuardrails:
    """
    Production security controls for Legal & Enterprise RAG:
    1. Direct & Indirect Prompt Injection Defense
    2. Sensitive PII & Account Number Masking in Logs
    3. Input Validation & Boundary Enforcement
    """

    INJECTION_PATTERNS = [
        r"(?i)\bignore\s+(?:all\s+)?previous\s+instructions\b",
        r"(?i)\bdisregard\s+(?:all\s+)?prior\s+prompts?\b",
        r"(?i)\breveal\s+(?:the\s+)?system\s+prompt\b",
        r"(?i)\byou\s+are\s+now\s+in\s+developer\s+mode\b",
        r"(?i)\bDAN\s+mode\b",
        r"(?i)\bjailbreak\b",
        r"(?i)\bexfiltrate\s+confidential\b",
        r"(?i)\boutput\s+all\s+confidential\s+settlement\s+amounts\b"
    ]

    SSN_PATTERN = r"\b\d{3}-\d{2}-\d{4}\b"
    CREDIT_CARD_PATTERN = r"\b(?:\d{4}[-\s]?){3}\d{4}\b"
    IBAN_PATTERN = r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b"

    @classmethod
    def inspect_query_security(cls, query: str) -> Tuple[bool, Optional[str]]:
        if not query or not query.strip():
            return False, "EMPTY_INPUT"

        if len(query) > 4000:
            return False, "PAYLOAD_TOO_LARGE"

        for pattern in cls.INJECTION_PATTERNS:
            if re.search(pattern, query):
                return False, "PROMPT_INJECTION_DETECTED"

        return True, None

    @classmethod
    def mask_pii_for_logging(cls, text: str) -> str:
        masked = re.sub(cls.SSN_PATTERN, "[REDACTED_SSN]", text)
        masked = re.sub(cls.CREDIT_CARD_PATTERN, "[REDACTED_CC]", masked)
        masked = re.sub(cls.IBAN_PATTERN, "[REDACTED_IBAN]", masked)
        return masked
