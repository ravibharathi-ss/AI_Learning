"""
Unit Tests for Document Parsing and Format Validation
"""

import pytest
from infrastructure.document_processing.pdf_parser import PdfDocumentParser
from domain.exceptions.domain_exceptions import InvalidDocumentException

class TestPdfDocumentParser:

    def test_empty_bytes_rejected(self):
        with pytest.raises(InvalidDocumentException) as exc:
            PdfDocumentParser.parse_pdf(b"")
        assert "empty document payload" in str(exc.value).lower() or "0 bytes" in str(exc.value)

    def test_plaintext_fallback_parsing(self):
        sample = b"Section 1.1 Definitions and Terms."
        parsed = PdfDocumentParser.parse_pdf(sample)
        assert "Section 1.1" in parsed

    def test_corrupted_binary_header_rejected(self):
        corrupted = b"\x00\x01\x02\x03\xff\xfe\xfd"
        with pytest.raises(InvalidDocumentException) as exc:
            PdfDocumentParser.parse_pdf(corrupted)
        assert "invalid document header" in str(exc.value).lower()
