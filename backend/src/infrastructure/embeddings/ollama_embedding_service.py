"""
Ollama and Mock Embedding Services Implementing IEmbeddingService
"""

import json
import urllib.request
import urllib.error
import hashlib
from typing import List, Dict
from domain.interfaces.embedding_service import IEmbeddingService
from domain.exceptions.domain_exceptions import LlmProviderException

class OllamaEmbeddingService(IEmbeddingService):
    def __init__(self, host: str = "http://host.docker.internal:11434", model: str = "nomic-embed-text", timeout: float = 2.0):
        self.host = host.rstrip("/")
        self.model = model
        self.timeout = timeout
        self._cache: Dict[str, List[float]] = {}

    def generate_embedding(self, text: str) -> List[float]:
        if not text or not text.strip():
            return [0.0] * self.get_dimension()

        cache_key = hashlib.md5(text.strip().lower().encode("utf-8")).hexdigest()
        if cache_key in self._cache:
            return self._cache[cache_key]

        url = f"{self.host}/api/embed"
        payload = {"model": self.model, "input": text, "keep_alive": "10m"}

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                res_json = json.loads(response.read().decode("utf-8"))
                embeddings = res_json.get("embeddings", [])
                if embeddings and len(embeddings) > 0:
                    vec = embeddings[0]
                    self._cache[cache_key] = vec
                    return vec
        except Exception as e:
            # Fallback to deterministic pseudo-embedding to keep offline RAG operative
            pass

        return self._fallback_pseudo_embedding(text)

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.generate_embedding(t) for t in texts]

    def get_dimension(self) -> int:
        return 768

    def _fallback_pseudo_embedding(self, text: str) -> List[float]:
        """Generates deterministic unit vector from text hash when Ollama daemon is offline."""
        import math
        vec = [0.0] * self.get_dimension()
        words = text.lower().split()
        for w in words:
            h = int(hashlib.md5(w.encode("utf-8")).hexdigest(), 16)
            idx = h % self.get_dimension()
            vec[idx] += 1.0
        norm = math.sqrt(sum(x * x for x in vec))
        return [x / norm for x in vec] if norm > 0 else vec

class MockEmbeddingService(IEmbeddingService):
    """Deterministic embedding service for offline unit/API tests."""
    def __init__(self, dimension: int = 128):
        self.dimension = dimension

    def generate_embedding(self, text: str) -> List[float]:
        import math
        vec = [0.0] * self.dimension
        words = text.lower().split()
        for w in words:
            h = int(hashlib.md5(w.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dimension
            vec[idx] += 1.0
        norm = math.sqrt(sum(x * x for x in vec))
        return [x / norm for x in vec] if norm > 0 else vec

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.generate_embedding(t) for t in texts]

    def get_dimension(self) -> int:
        return self.dimension
