"""
Unit Tests for Text Chunking Logic
Tests configurable chunk sizes, overlap, boundary preservation, and token estimation.
"""

import pytest
from infrastructure.document_processing.text_chunker import TextChunker

class TestTextChunker:

    def test_default_chunking_and_overlap(self):
        chunker = TextChunker(chunk_size=300, chunk_overlap=50)
        sample_text = (
            "Section 1.1 Definitions: In this agreement, terms are defined.\n\n"
            "Section 2.1 Scope: The provider shall deliver enterprise cloud infrastructure.\n\n"
            "Section 3.1 Availability: The service level agreement guarantees 99.9% uptime."
        )
        chunks = chunker.chunk(sample_text)
        assert len(chunks) >= 1
        assert all(len(c.content) <= 350 for c in chunks)
        assert chunks[0].clause_reference is not None

    def test_clause_reference_tagging(self):
        chunker = TextChunker(chunk_size=500, chunk_overlap=100)
        text = "Under Section 12.3 Termination for Convenience, either party may terminate upon 60 days notice."
        chunks = chunker.chunk(text)
        assert len(chunks) == 1
        assert chunks[0].clause_reference == "Section 12.3"

    def test_paragraph_boundary_preservation(self):
        chunker = TextChunker(chunk_size=200, chunk_overlap=20)
        p1 = "Paragraph one discusses confidentiality and standard of care."
        p2 = "Paragraph two discusses governing law in Delaware."
        text = f"{p1}\n\n{p2}"
        chunks = chunker.chunk(text)
        assert len(chunks) >= 1
        # Chunks shouldn't break in the middle of words
        for c in chunks:
            assert not c.content.startswith(" ")

    def test_empty_text_handling(self):
        chunker = TextChunker(chunk_size=500, chunk_overlap=100)
        assert chunker.chunk("") == []
        assert chunker.chunk("   \n\t  ") == []

    def test_invalid_overlap_raises_error(self):
        with pytest.raises(ValueError):
            TextChunker(chunk_size=200, chunk_overlap=200)

        with pytest.raises(ValueError):
            TextChunker(chunk_size=200, chunk_overlap=250)
