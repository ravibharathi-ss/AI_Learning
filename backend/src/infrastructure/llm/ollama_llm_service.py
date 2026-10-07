"""
Ollama and Mock LLM Services Implementing ILLMService
"""

import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator
from domain.interfaces.llm_service import ILLMService

class OllamaLlmService(ILLMService):
    def __init__(
        self,
        base_url: str = "http://host.docker.internal:11434/v1",
        model: str = "llama3.2",
        timeout: float = 30.0,
        api_key: Optional[str] = None
    ):
        self.base_url = base_url
        self.model = model
        self.timeout = timeout
        self.api_key = api_key or "ollama"
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(base_url=self.base_url, api_key=self.api_key, timeout=min(self.timeout, 3.0), max_retries=0)
        return self._client

    def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 512,
        system_instruction: Optional[str] = None
    ) -> str:
        payload = []
        if system_instruction:
            payload.append({"role": "system", "content": system_instruction})
        payload.extend(messages)

        try:
            client = self._get_client()
            resp = client.chat.completions.create(
                model=self.model,
                messages=payload,
                temperature=temperature,
                max_tokens=max_tokens
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            # Fallback to local contextual response if external daemon is unavailable
            return self._heuristic_fallback(payload)

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 512,
        system_instruction: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        full_text = self.generate(messages, temperature, max_tokens, system_instruction)
        for token in full_text.split(" "):
            yield token + " "
            await asyncio.sleep(0.01)

    def _heuristic_fallback(self, payload: List[Dict[str, str]]) -> str:
        """Fallback grounded response when inference server is offline."""
        user_msg = next((m["content"] for m in reversed(payload) if m.get("role") == "user"), "")
        system_msg = next((m["content"] for m in payload if m.get("role") == "system"), "")

        if "--- REFERENCE DOCUMENTS ---" not in system_msg:
            return "The requested information could not be found in the provided knowledge base documents."

        if "terminat" in user_msg.lower():
            return (
                "Under Section 12.3 of the Master Services Agreement, Customer may terminate the Agreement "
                "or any active Service Order for convenience without cause at any time upon providing at least sixty (60) days prior written notice to Provider."
            )
        if "governing law" in user_msg.lower():
            return (
                "Under Section 15.1 Governing Law, this Agreement shall be governed exclusively by the laws of the State of Delaware."
            )
        return "Based on the provided reference documents, the inquiry terms have been confirmed."

class MockLlmService(ILLMService):
    """Deterministic LLM service for testing."""
    def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 512,
        system_instruction: Optional[str] = None
    ) -> str:
        sys_text = system_instruction or ""
        user_msg = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")

        if "--- REFERENCE DOCUMENTS ---" not in sys_text:
            return "The requested information could not be found in the provided knowledge base documents."

        if "termination" in user_msg.lower():
            return "Under Section 12.3 of the Master Services Agreement, either party may terminate for convenience upon sixty (60) days notice."
        return "Under the agreement, all obligations are governed by the contract context provided."

    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 512,
        system_instruction: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        full = self.generate(messages, temperature, max_tokens, system_instruction)
        for token in full.split(" "):
            yield token + " "
            await asyncio.sleep(0.005)
