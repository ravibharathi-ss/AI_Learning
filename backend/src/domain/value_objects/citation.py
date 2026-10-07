from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class Citation:
    document_id: str
    document_name: str
    chunk_id: int
    score: float
    snippet: str
    clause_reference: Optional[str] = None
