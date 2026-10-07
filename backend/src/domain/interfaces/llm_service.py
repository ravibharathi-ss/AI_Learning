"""
LLM Service Interface Abstraction
Decouples application logic from Ollama, OpenAI, Groq, Anthropic, etc.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, AsyncGenerator

class ILLMService(ABC):
    @abstractmethod
    def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 512,
        system_instruction: Optional[str] = None
    ) -> str:
        """Generate complete text response from LLM."""
        pass

    @abstractmethod
    async def generate_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 512,
        system_instruction: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """Stream text response tokens asynchronously."""
        pass
