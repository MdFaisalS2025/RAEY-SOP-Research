"""
Meridian Document Parser
-------------------------
Parse PDF, DOCX, and TXT files into text and chunks.
Research prototype  - NOT for clinical use.
"""

import io
import re
from typing import Optional


def parse_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes using PyMuPDF (fitz)."""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n\n".join(pages)


def parse_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    from docx import Document

    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def parse_txt(file_bytes: bytes) -> str:
    """Decode plain text bytes."""
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except (UnicodeDecodeError, ValueError):
            continue
    return file_bytes.decode("utf-8", errors="replace")


def chunk_text(
    text: str,
    chunk_size: int = 1200,
    overlap: int = 150,
) -> list[dict]:
    """
    Split text into overlapping chunks. Returns list of dicts with
    chunk_text, chunk_index, and heuristic section_title.
    """
    # Try to split on paragraph boundaries first
    paragraphs = re.split(r"\n{2,}", text.strip())
    chunks: list[dict] = []
    current_chunk = ""
    current_section = ""
    idx = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Detect section headers (lines that look like headings)
        if _is_heading(para):
            current_section = para[:200]

        if len(current_chunk) + len(para) + 1 > chunk_size and current_chunk:
            chunks.append({
                "chunk_text": current_chunk.strip(),
                "chunk_index": idx,
                "section_title": current_section,
            })
            idx += 1
            # Keep overlap from end of previous chunk
            if overlap > 0 and len(current_chunk) > overlap:
                current_chunk = current_chunk[-overlap:] + "\n" + para
            else:
                current_chunk = para
        else:
            current_chunk = (current_chunk + "\n" + para) if current_chunk else para

    if current_chunk.strip():
        chunks.append({
            "chunk_text": current_chunk.strip(),
            "chunk_index": idx,
            "section_title": current_section,
        })

    # If text was small enough to be a single chunk, ensure at least one
    if not chunks and text.strip():
        chunks.append({
            "chunk_text": text.strip()[:chunk_size],
            "chunk_index": 0,
            "section_title": "",
        })

    return chunks


def _is_heading(text: str) -> bool:
    """Heuristic: short line, possibly numbered, possibly uppercase."""
    text = text.strip()
    if len(text) > 120:
        return False
    if re.match(r"^(\d+[\.\)]\s|[A-Z][A-Z\s]{4,}|#{1,3}\s|Section\s|SECTION\s|Chapter\s)", text):
        return True
    if text.isupper() and len(text) > 3:
        return True
    return False


def detect_format(filename: str) -> str:
    """Return file format from filename extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext


def parse_file(file_bytes: bytes, filename: str) -> str:
    """Parse file based on extension."""
    fmt = detect_format(filename)
    if fmt == "pdf":
        return parse_pdf(file_bytes)
    elif fmt in ("docx", "doc"):
        return parse_docx(file_bytes)
    elif fmt in ("txt", "text", "md"):
        return parse_txt(file_bytes)
    else:
        # Fallback: try as text
        return parse_txt(file_bytes)
