"""
Vector Store Interface Abstraction
Decouples application logic from ChromaDB, Qdrant, Pinecone, etc.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class VectorRecord:
    id: str
    vector: List[float]
    document_text: str
    metadata: Dict[str, Any]

@dataclass
class SearchResult:
    chunk_id: str
    document_id: str
    content: str
    score: float
    metadata: Dict[str, Any]

class IVectorStore(ABC):
    @abstractmethod
    def upsert(self, records: List[VectorRecord]) -> bool:
        """Upsert records with embeddings and metadata into vector store."""
        pass

    @abstractmethod
    def search(
        self,
        query_vector: List[float],
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        min_score: float = 0.0
    ) -> List[SearchResult]:
        """Perform nearest-neighbor similarity search."""
        pass

    @abstractmethod
    def delete(self, document_id: str) -> bool:
        """Delete all vectors associated with document_id."""
        pass

    @abstractmethod
    def count(self) -> int:
        """Return total indexed vectors."""
        pass
