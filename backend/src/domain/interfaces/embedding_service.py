"""
Embedding Service Interface Abstraction
Decouples application logic from Ollama, OpenAI, Cohere, etc.
"""

from abc import ABC, abstractmethod
from typing import List

class IEmbeddingService(ABC):
    @abstractmethod
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for a single string."""
        pass

    @abstractmethod
    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for a batch of strings."""
        pass

    @abstractmethod
    def get_dimension(self) -> int:
        """Return the vector dimension."""
        pass
