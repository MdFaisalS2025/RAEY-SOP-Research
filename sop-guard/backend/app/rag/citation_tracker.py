"""
SOP-Guard Citation Tracker
Numbered inline citation pipeline: builds numbered context blocks for the
LLM prompt, validates [N] markers in the generated answer, and returns
citation metadata records.
Research prototype. Not for clinical use.
"""

import re
from typing import Any


def _chunk_id(chunk: dict[str, Any]) -> str:
    """Build a stable-ish identity key for deduping chunks."""
    explicit = chunk.get("chunk_id") or chunk.get("id")
    if explicit:
        return str(explicit)
    return "|".join([
        str(chunk.get("sop_id", "")),
        str(chunk.get("section_title", "")),
        str(chunk.get("chunk_index", "")),
        (chunk.get("text") or chunk.get("chunk_text") or "")[:80],
    ])


def build_numbered_context(chunks: list[dict], max_chars: int = 4000) -> tuple[str, list[dict]]:
    """
    Assign citation numbers [1], [2], ... to retrieved chunks in order
    (deduped by chunk id) and build a labeled context block for the LLM.

    Returns (context_string, citation_records).
    """
    context_parts: list[str] = []
    citation_records: list[dict] = []
    seen: set[str] = set()
    total = 0
    number = 0

    for chunk in chunks:
        cid = _chunk_id(chunk)
        if cid in seen:
            continue

        text = chunk.get("text", chunk.get("chunk_text", "")) or ""
        sop_title = chunk.get("sop_title", "Unknown SOP")
        section = chunk.get("section_title", "")
        chunk_type = chunk.get("chunk_type", "")

        label = sop_title
        if section:
            label += f" - {section}"
        if chunk_type:
            label += f", {chunk_type}"

        entry = f"[{number + 1}] ({label})\n{text}\n"
        if total + len(entry) > max_chars:
            break

        seen.add(cid)
        number += 1
        context_parts.append(entry)
        total += len(entry)

        citation_records.append({
            "number": number,
            "sop_id": chunk.get("sop_id", ""),
            "sop_title": sop_title,
            "section_title": section,
            "chunk_type": chunk_type,
            "snippet": text[:200],
            "relevance_score": chunk.get("relevance_score", 0.0),
            "cited_in_answer": False,
            "version": chunk.get("version", ""),
            "effective_date": chunk.get("effective_date", ""),
            "review_date": chunk.get("review_date", ""),
            "status": chunk.get("status", "active"),
        })

    return "\n".join(context_parts), citation_records


_MARKER_RE = re.compile(r"\[(\d+)\]")


def extract_citations(answer: str, citation_records: list[dict]) -> tuple[str, list[dict]]:
    """
    Validate [N] markers in the answer against citation_records.
    Marks cited_in_answer on valid records, strips invalid markers.

    Returns (cleaned_answer, updated_records).
    """
    valid_numbers = {rec["number"] for rec in citation_records}
    cited: set[int] = set()

    def _replace(match: re.Match) -> str:
        n = int(match.group(1))
        if n in valid_numbers:
            cited.add(n)
            return match.group(0)
        return ""

    cleaned = _MARKER_RE.sub(_replace, answer)
    # Tidy whitespace left behind by stripped markers
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r" +([.,;:!?])", r"\1", cleaned)

    updated = []
    for rec in citation_records:
        rec = dict(rec)
        rec["cited_in_answer"] = rec["number"] in cited
        updated.append(rec)

    return cleaned, updated


def citation_coverage(answer: str) -> float:
    """
    Fraction of substantive answer sentences that carry a [N] marker.

    Shared by the RAGAS-lite eval (app/evaluation/ragas_lite.py) and the
    live pipeline's confidence gate (app/agents/pipeline.py) - moved here
    so both read the same definition of "substantive sentence" instead of
    two regexes silently drifting apart.
    """
    raw = re.split(r"(?<=[.!?])\s+|\n+", answer.strip())
    sentences = [
        s.strip() for s in raw
        if len(s.strip()) > 20
        and not s.strip().startswith("#")
        and not s.strip().startswith("Source:")
        and "research prototype" not in s.lower()
        and not s.strip().startswith("---")
    ]
    if not sentences:
        return 0.0
    cited = sum(1 for s in sentences if _MARKER_RE.search(s))
    return round(cited / len(sentences), 3)
