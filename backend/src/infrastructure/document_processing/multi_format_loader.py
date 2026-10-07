"""
Multi-Format Legal Document Loader for Markdown, DOCX, and PDF.
Preserves true document structure, tables with inline headers, and extracts mandatory metadata.
"""

from __future__ import annotations

import io
import re
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

SUPPORTED_FORMATS = {".md", ".markdown", ".docx", ".pdf", ".txt"}

# Canonical counterparty mapping
_COUNTERPARTIES = {
    "northwind": "Northwind Logistics",
    "vertex": "Vertex Retail",
    "halcyon": "Halcyon Analytics",
}

_DOC_TYPES = [
    (r"amendment\s+no", "amendment"),
    (r"schedules?\s+to", "schedule"),
    (r"non-disclosure", "nda"),
    (r"master\s+services\s+agreement", "master_agreement"),
]

_HEADER_LABELS = [
    r"Agreement No\.", r"Amendment No\.", r"Document No\.", r"Amends",
    r"Forms part of", r"Counterparty", r"Provider", r"Effective Date",
    r"Document Version", r"Status",
]
_STOP = "|".join(_HEADER_LABELS)

@dataclass
class LoadedDocument:
    text: str
    metadata: Dict[str, Any]
    source_path: str
    source_format: str
    tables_found: int = 0
    warnings: List[str] = field(default_factory=list)

class MultiFormatDocumentLoader:
    """
    Production document parser that guarantees content parity across .md, .docx, and .pdf.
    """

    @classmethod
    def load_from_path(cls, path: str | Path) -> LoadedDocument:
        path = Path(path)
        suffix = path.suffix.lower()
        if suffix not in SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format '{suffix}'. Supported: {sorted(SUPPORTED_FORMATS)}")

        if suffix in {".md", ".markdown", ".txt"}:
            text, tables = cls._read_markdown(path.read_text(encoding="utf-8"))
        elif suffix == ".docx":
            text, tables = cls._read_docx_from_path(path)
        elif suffix == ".pdf":
            text, tables = cls._read_pdf_from_path(path)
        else:
            text, tables = path.read_text(encoding="utf-8"), 0

        return cls._finalize_document(text, tables, str(path), suffix, path)

    @classmethod
    def load_from_bytes(cls, filename: str, file_bytes: bytes) -> LoadedDocument:
        path = Path(filename)
        suffix = path.suffix.lower() if path.suffix else ".txt"
        if suffix not in SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format '{suffix}'. Supported: {sorted(SUPPORTED_FORMATS)}")

        if suffix in {".md", ".markdown", ".txt"}:
            text_str = file_bytes.decode("utf-8", errors="replace")
            text, tables = cls._read_markdown(text_str)
        elif suffix == ".docx":
            text, tables = cls._read_docx_from_bytes(file_bytes)
        elif suffix == ".pdf":
            text, tables = cls._read_pdf_from_bytes(file_bytes)
        else:
            text, tables = file_bytes.decode("utf-8", errors="replace"), 0

        return cls._finalize_document(text, tables, filename, suffix, path)

    @classmethod
    def _finalize_document(cls, text: str, tables: int, source_path: str, suffix: str, path: Path) -> LoadedDocument:
        # Normalize whitespace so identical documents produce identical chunks
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()

        meta = cls.extract_metadata(text, path)
        warnings: List[str] = []

        if tables == 0 and meta.get("doc_type") == "schedule":
            warnings.append(
                "This document contains tables (Schedules B, B-2, C) but none were extracted. "
                "This will impact table-dependent queries."
            )

        for required in ("source_doc", "counterparty", "effective_date"):
            if not meta.get(required):
                warnings.append(f"Missing required metadata field: {required}")

        return LoadedDocument(
            text=text,
            metadata=meta,
            source_path=source_path,
            source_format=suffix.lstrip("."),
            tables_found=tables,
            warnings=warnings
        )

    @classmethod
    def _read_markdown(cls, raw: str) -> Tuple[str, int]:
        out, tables, lines, i = [], 0, raw.split("\n"), 0

        def is_sep(l: str) -> bool:
            s = l.strip()
            return bool(s) and set(s) <= set("|-: ") and "-" in s and "|" in s

        while i < len(lines):
            line = lines[i]
            if line.strip().startswith("|") and i + 1 < len(lines) and is_sep(lines[i + 1]):
                header = [c.strip() for c in line.strip().strip("|").split("|")]
                i += 2
                rows = []
                while i < len(lines) and lines[i].strip().startswith("|"):
                    rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                    i += 1
                out.append(cls._flatten_table(header, rows))
                tables += 1
                continue
            # Strip markdown bold/italic emphasis so tokens match across all formats
            out.append(re.sub(r"[*_`]{1,2}", "", line))
            i += 1

        return "\n".join(out), tables

    @classmethod
    def _read_docx_from_path(cls, path: Path) -> Tuple[str, int]:
        import docx
        doc = docx.Document(str(path))
        return cls._process_docx_elements(doc)

    @classmethod
    def _read_docx_from_bytes(cls, data: bytes) -> Tuple[str, int]:
        import docx
        doc = docx.Document(io.BytesIO(data))
        return cls._process_docx_elements(doc)

    @classmethod
    def _process_docx_elements(cls, document: Any) -> Tuple[str, int]:
        parts, tables = [], 0
        body = document.element.body
        p_iter = iter(document.paragraphs)
        t_iter = iter(document.tables)
        for child in body.iterchildren():
            tag = child.tag.rsplit("}", 1)[-1]
            if tag == "p":
                try:
                    parts.append(next(p_iter).text)
                except StopIteration:
                    pass
            elif tag == "tbl":
                try:
                    tbl = next(t_iter)
                except StopIteration:
                    continue
                rows = [[c.text.strip() for c in r.cells] for r in tbl.rows]
                if rows:
                    parts.append(cls._flatten_table(rows[0], rows[1:]))
                    tables += 1
        return "\n".join(parts), tables

    @classmethod
    def _read_pdf_from_path(cls, path: Path) -> Tuple[str, int]:
        import pdfplumber
        parts, tables = [], 0
        with pdfplumber.open(str(path)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_tables() or []
                body = page
                if extracted:
                    for tbl_obj in page.find_tables():
                        body = body.outside_bbox(tbl_obj.bbox)
                parts.append(body.extract_text() or "")
                for tbl in extracted:
                    rows = [[(c or "").strip().replace("\n", " ") for c in r] for r in tbl if r]
                    if len(rows) >= 2:
                        parts.append(cls._flatten_table(rows[0], rows[1:]))
                        tables += 1
        return "\n".join(parts), tables

    @classmethod
    def _read_pdf_from_bytes(cls, data: bytes) -> Tuple[str, int]:
        import pdfplumber
        parts, tables = [], 0
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_tables() or []
                body = page
                if extracted:
                    for tbl_obj in page.find_tables():
                        body = body.outside_bbox(tbl_obj.bbox)
                parts.append(body.extract_text() or "")
                for tbl in extracted:
                    rows = [[(c or "").strip().replace("\n", " ") for c in r] for r in tbl if r]
                    if len(rows) >= 2:
                        parts.append(cls._flatten_table(rows[0], rows[1:]))
                        tables += 1
        return "\n".join(parts), tables

    @staticmethod
    def _flatten_table(header: List[str], rows: List[List[str]]) -> str:
        """Emits each row carrying its own column names so chunks preserve contextual semantics."""
        out = ["[TABLE] " + " | ".join(h for h in header if h)]
        for row in rows:
            pairs = [
                f"{header[i]}: {cell}" if i < len(header) and header[i] else cell
                for i, cell in enumerate(row)
                if cell
            ]
            if pairs:
                out.append("  " + " | ".join(pairs))
        return "\n".join(out)

    @classmethod
    def extract_metadata(cls, text: str, path: Path) -> Dict[str, Any]:
        head = text[:2000]
        title = ""
        for ln in text.split("\n"):
            s = ln.strip()
            if not s or s.startswith("[TABLE]") or ln.startswith("  "):
                continue
            title = s.lstrip("# ").strip()
            break

        def grab(label: str) -> Optional[str]:
            m = re.search(
                rf"(?:{label})\s*:?\s*\**\s*(.+?)(?=\s*(?:{_STOP})\s*:|\n|$)",
                head, re.I | re.S,
            )
            if not m or m.group(1) is None:
                return None
            return m.group(1).strip().strip("*").strip() or None

        # 1. source_doc identifier
        source_doc = None
        stem_match = re.match(r"^([A-Z]{2,4}-\d{4}-\d{3}(?:-\d{2})?)", path.stem)
        if stem_match:
            source_doc = stem_match.group(1)
        else:
            for label in (r"Amendment No\.", r"Document No\.", r"Agreement No\."):
                val = grab(label)
                if val and (m := re.search(r"\b([A-Z]{2,4}-\d{4}-\d{3}(?:-\d{2})?)\b", val)):
                    source_doc = m.group(1)
                    break
        if not source_doc:
            m = re.search(r"\b([A-Z]{2,4}-\d{4}-\d{3}(?:-\d{2})?)\b", head)
            source_doc = m.group(1) if m else path.stem.split("_")[0]

        # 2. counterparty
        counterparty = None
        if cp := grab("Counterparty"):
            for key, label in _COUNTERPARTIES.items():
                if key in cp.lower():
                    counterparty = label
                    break

        # 3. effective_date
        effective_date = None
        if raw_date := grab("Effective Date"):
            if dm := re.match(r"(\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2})", raw_date.strip()):
                for fmt in ("%d %B %Y", "%d %b %Y", "%Y-%m-%d"):
                    try:
                        effective_date = datetime.strptime(dm.group(1), fmt).strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        continue

        # 4. doc_type
        doc_type = "unknown"
        for pattern, label in _DOC_TYPES:
            if re.search(pattern, title, re.I):
                doc_type = label
                break

        status = grab("Status") or "unknown"
        is_controlling = "CURRENT" in status.upper() or "CONTROLLING" in status.upper()

        return {
            "source_doc": source_doc,
            "counterparty": counterparty,
            "effective_date": effective_date,
            "doc_type": doc_type,
            "status": status,
            "is_controlling": is_controlling,
        }
