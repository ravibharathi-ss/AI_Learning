"""
PDF and Document Parser with Format Validation
"""

import io
from typing import Tuple
from domain.exceptions.domain_exceptions import InvalidDocumentException

class PdfDocumentParser:
    """
    Extracts text from PDF file bytes with validation against malformed or empty payloads.
    """
    @staticmethod
    def parse_pdf(file_bytes: bytes) -> str:
        if not file_bytes:
            raise InvalidDocumentException("File is empty (0 bytes).")

        # Verify PDF header signature (%PDF-)
        if not file_bytes.startswith(b"%PDF-"):
            # Check if plaintext fallback
            try:
                decoded = file_bytes.decode("utf-8")
                return decoded
            except UnicodeDecodeError:
                raise InvalidDocumentException("Invalid document header: expected PDF magic bytes (%PDF-).")

        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            if len(reader.pages) == 0:
                raise InvalidDocumentException("PDF document contains 0 pages.")

            extracted_text = []
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    extracted_text.append(page_text.strip())

            full_text = "\n\n".join(extracted_text)
            if not full_text.strip():
                raise InvalidDocumentException("PDF contains no readable text content (scanned image or empty).")

            return full_text
        except Exception as e:
            if isinstance(e, InvalidDocumentException):
                raise
            raise InvalidDocumentException(f"Failed to parse PDF document: {str(e)}")
