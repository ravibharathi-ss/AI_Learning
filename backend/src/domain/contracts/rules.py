"""
Pure Domain Business Rules and Assertions for Legal Contracts
"""

import re
from typing import Tuple, Optional, List, Dict, Any

class ContractBusinessRules:
    """
    Deterministic domain assertions for legal contract review:
    1. Clause citation existence
    2. Exact numerical notice period matching
    3. Governing jurisdiction validation
    4. Superseded draft detection
    """

    @staticmethod
    def extract_cited_clause(text: str) -> Optional[str]:
        """Extracts cited clause like 'Section 12.3', 'Clause 14.2', 'Article 6.2'."""
        patterns = [
            r'\b(?:Section|Clause|Article)\s+\d+(?:\.\d+)?\b',
            r'\b(?:Section|Clause|Article)\s+[IVXLCDM]+\b'
        ]
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                return match.group(0)
        return None

    @staticmethod
    def extract_notice_days(text: str) -> Optional[int]:
        """Extracts notice days such as '60 days', 'sixty (60) days', '30 calendar days'."""
        pattern = r'(?:(\d+)\s*(?:calendar\s+|business\s+)?days?|(?:\([0-9]+\))\s*days?)'
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            digits = re.findall(r'\d+', match.group(0))
            if digits:
                return int(digits[0])
        return None

    @classmethod
    def assert_clause_reference_exists(cls, model_answer: str, expected_clause: str) -> Tuple[bool, str]:
        """
        Deterministic Assertion 1: Validates that the model cited the correct contract clause.
        """
        cited = cls.extract_cited_clause(model_answer)
        if not cited:
            return False, f"FAIL: No legal clause cited in response (expected {expected_clause})"
        if cited.lower() == expected_clause.lower():
            return True, f"PASS: Correctly cited {expected_clause}"
        return False, f"FAIL: Incorrect clause cited '{cited}' (expected {expected_clause})"

    @classmethod
    def assert_notice_period_numeric(cls, model_answer: str, expected_days: int) -> Tuple[bool, str]:
        """
        Deterministic Assertion 2: Validates that the notice days matches ground truth verbatim.
        """
        extracted = cls.extract_notice_days(model_answer)
        if extracted is None:
            return False, f"FAIL: No numerical notice period extracted (expected {expected_days} days)"
        if extracted == expected_days:
            return True, f"PASS: Exact notice period {expected_days} days verified"
        return False, f"FAIL: Notice period was {extracted} days (expected {expected_days} days)"

    @classmethod
    def assert_governing_jurisdiction(cls, model_answer: str, expected_jurisdiction: str) -> Tuple[bool, str]:
        """
        Deterministic Assertion 3: Validates governing law jurisdiction (e.g. Delaware).
        """
        if expected_jurisdiction.lower() in model_answer.lower():
            return True, f"PASS: Governing jurisdiction '{expected_jurisdiction}' verified"
        return False, f"FAIL: Missing expected governing jurisdiction '{expected_jurisdiction}'"
