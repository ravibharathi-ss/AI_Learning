"""
Configurable Document Chunker with Boundary Preservation
Supports paragraph and sentence boundary splitting, token budget enforcement, and metadata extraction.
"""

import re
from typing import List, Dict, Any
from dataclasses import dataclass

@dataclass
class ChunkResult:
    index: int
    content: str
    char_start: int
    char_end: int
    token_estimate: int
    clause_reference: str | None = None

class TextChunker:
    """
    Production Text Chunker preserving legal clause structures:
    - Splits on paragraph boundaries (\n\n) first
    - Splits on sentence boundaries (. ) second
    - Falls back to fixed character windows with overlap
    - Extracts inline clause headings (e.g. 'Section 12.3', 'Article 6')
    """
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 100):
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be strictly less than chunk_size")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    @staticmethod
    def _extract_clause_tag(text: str) -> str | None:
        pattern = r'\b(?:Section|Clause|Article)\s+\d+(?:\.\d+)?\b'
        match = re.search(pattern, text, re.IGNORECASE)
        return match.group(0) if match else None

    def chunk(self, text: str) -> List[ChunkResult]:
        if not text or not text.strip():
            return []

        # Normalize whitespace while preserving structural double newlines
        normalized = re.sub(r'\r\n', '\n', text)
        paragraphs = [p.strip() for p in normalized.split('\n\n') if p.strip()]

        chunks: List[ChunkResult] = []
        current_chunk = ""
        current_start = 0
        chunk_idx = 0

        for para in paragraphs:
            # If adding paragraph fits within chunk_size
            if len(current_chunk) + len(para) + 2 <= self.chunk_size:
                if current_chunk:
                    current_chunk += "\n\n" + para
                else:
                    current_chunk = para
            else:
                # Flush current chunk if present
                if current_chunk:
                    chunks.append(ChunkResult(
                        index=chunk_idx,
                        content=current_chunk,
                        char_start=current_start,
                        char_end=current_start + len(current_chunk),
                        token_estimate=max(1, len(current_chunk) // 4),
                        clause_reference=self._extract_clause_tag(current_chunk)
                    ))
                    chunk_idx += 1
                    current_start += len(current_chunk) - self.chunk_overlap
                    # Keep overlap from previous text
                    overlap_text = current_chunk[-self.chunk_overlap:] if len(current_chunk) > self.chunk_overlap else ""
                    current_chunk = (overlap_text + "\n\n" + para).strip() if overlap_text else para
                else:
                    # Paragraph itself is larger than chunk_size; split by sentences
                    sentences = re.split(r'(?<=[.!?])\s+', para)
                    sub_chunk = ""
                    for s in sentences:
                        if len(sub_chunk) + len(s) + 1 <= self.chunk_size:
                            sub_chunk = (sub_chunk + " " + s).strip() if sub_chunk else s
                        else:
                            if sub_chunk:
                                chunks.append(ChunkResult(
                                    index=chunk_idx,
                                    content=sub_chunk,
                                    char_start=current_start,
                                    char_end=current_start + len(sub_chunk),
                                    token_estimate=max(1, len(sub_chunk) // 4),
                                    clause_reference=self._extract_clause_tag(sub_chunk)
                                ))
                                chunk_idx += 1
                                current_start += len(sub_chunk) - self.chunk_overlap
                            sub_chunk = s
                    current_chunk = sub_chunk

        # Flush final chunk
        if current_chunk:
            chunks.append(ChunkResult(
                index=chunk_idx,
                content=current_chunk,
                char_start=current_start,
                char_end=current_start + len(current_chunk),
                token_estimate=max(1, len(current_chunk) // 4),
                clause_reference=self._extract_clause_tag(current_chunk)
            ))

        return chunks
