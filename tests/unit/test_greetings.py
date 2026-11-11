"""
Unit Tests for Task 1: Greeting Section
Validates greeting detection, time-aware salutations, and dynamic response generation.
"""

import pytest
import re
from services.ollama_service import OllamaService

@pytest.fixture
def ollama_svc():
    return OllamaService()

def is_greeting(query: str) -> bool:
    """Helper mirroring greeting detection logic in API."""
    cleaned = re.sub(r'[^\w\s]', '', query).strip().lower()
    words = cleaned.split()
    exact_greetings = {
        'hi', 'hello', 'hey', 'hola', 'greetings', 'morning', 'evening',
        'good morning', 'good evening', 'good afternoon', 'how are you',
        'who are you', 'what can you do', 'help', 'thanks', 'thank you',
        'bye', 'goodbye', 'namaste', 'welcome'
    }
    if cleaned in exact_greetings:
        return True
    if len(words) <= 3 and words:
        if words[0] in {'hi', 'hello', 'hey', 'greetings', 'welcome'}:
            return True
        if len(words) >= 2 and ' '.join(words[:2]) in {'good morning', 'good afternoon', 'good evening'}:
            return True
    return False

class TestGreetingSection:

    @pytest.mark.parametrize("greeting_input", [
        "Hello",
        "Hi",
        "hey there",
        "Good morning",
        "Good afternoon",
        "Good evening",
        "Greetings",
        "help",
        "who are you",
        "what can you do"
    ])
    def test_greeting_detection_positive(self, greeting_input):
        """Validates that common greetings are correctly identified."""
        assert is_greeting(greeting_input) is True

    @pytest.mark.parametrize("non_greeting_input", [
        "What are the payment terms under Section 3.3?",
        "Who is the current Chief Minister of Tamil Nadu?",
        "List all documents in the knowledge base",
        "What is the limitation of liability cap?",
        "Explain indemnification in MSA-2026-014"
    ])
    def test_greeting_detection_negative(self, non_greeting_input):
        """Validates that contract questions and out-of-scope questions are not misclassified as greetings."""
        assert is_greeting(non_greeting_input) is False

    def test_dynamic_greeting_generation_content(self, ollama_svc):
        """Validates that dynamic greeting response contains professional persona and invitations."""
        greeting = ollama_svc.generate_dynamic_greeting("Hello")
        assert isinstance(greeting, str)
        assert len(greeting) > 20
        # Ensure it introduces as Legal & Contracts assistant and mentions contracts/knowledge base
        assert any(term in greeting.lower() for term in ["legal", "contract", "assistant", "agreements", "clauses"])

    def test_dynamic_greeting_generation_variety(self, ollama_svc):
        """Validates that repeated calls generate natural variations rather than a frozen static string."""
        greetings = [ollama_svc.generate_dynamic_greeting("Hi") for _ in range(15)]
        unique_greetings = set(greetings)
        # Should generate multiple distinct natural phrasing variations
        assert len(unique_greetings) > 1
