"""
Unit Tests for Task 2: Unique Response Generation
Validates that unsupported/out-of-scope queries generate unique, dynamic, and natural responses
even when the user repeats the exact same query multiple times.
"""

import pytest
from services.ollama_service import OllamaService

@pytest.fixture
def ollama_svc():
    return OllamaService()

class TestUniqueResponseGeneration:

    def test_unsupported_response_contains_domain_boundary(self, ollama_svc):
        """Validates that unsupported response clearly communicates domain restriction to legal contracts."""
        query = "What is the capital of France?"
        response = ollama_svc.generate_dynamic_unsupported_response(query)
        assert isinstance(response, str)
        assert len(response) > 30

        # Verify it mentions legal contracts / knowledge base boundary
        lower_resp = response.lower()
        has_domain_guidance = any(
            phrase in lower_resp for phrase in [
                "legal", "contract", "knowledge base", "agreements", "uploaded", "repository"
            ]
        )
        assert has_domain_guidance is True

    def test_unsupported_response_uniqueness_on_repeated_queries(self, ollama_svc):
        """
        Task 2 Critical Requirement:
        Ensure each response is unique and natural, even when users repeat the same question.
        Calling generate_dynamic_unsupported_response 20 times for the exact same query
        must produce rich variations, not a single static string.
        """
        repeated_query = "who is current cm in tamilnadu"
        responses = [ollama_svc.generate_dynamic_unsupported_response(repeated_query) for _ in range(20)]
        unique_responses = set(responses)

        # Must have significant diversity (at least 8 distinct variations in 20 generations)
        assert len(unique_responses) >= 8

    def test_unsupported_response_does_not_hallucinate(self, ollama_svc):
        """Validates that the refusal does not fabricate answers or cite external unverified websites."""
        query = "What is the population of Tokyo?"
        response = ollama_svc.generate_dynamic_unsupported_response(query)
        assert "http://" not in response
        assert "https://" not in response
        assert "wikipedia" not in response.lower()
