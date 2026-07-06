"""
SOP-Guard SOP-Aware Chunker
Creates typed chunks that preserve clinical structure.
Research prototype. Not for clinical use.
"""

import re
from typing import Any
from datetime import datetime


def create_sop_chunks(
    raw_text: str,
    structured: dict[str, Any],
    sop_id: str = "",
    sop_title: str = "",
    department: str = "",
    version: str = "",
    status: str = "active",
    effective_date: str = "",
    review_date: str = "",
) -> list[dict[str, Any]]:
    """
    Create SOP-aware typed chunks from raw text and structured extraction.

    Returns chunks with metadata including chunk_type, section info, etc.
    """
    chunks = []
    base_meta = {
        "sop_id": sop_id,
        "sop_title": sop_title,
        "department": department,
        "version": version,
        "status": status,
        "effective_date": effective_date,
        "review_date": review_date,
        "created_at": datetime.utcnow().isoformat(),
    }

    # 1. Summary chunk - first ~300 chars + title + department
    summary = _create_summary(raw_text, sop_title, department)
    chunks.append({
        **base_meta,
        "chunk_id": f"{sop_id}_summary",
        "chunk_type": "summary",
        "section_id": "summary",
        "section_title": "Summary",
        "text": summary,
        "step_order": None,
        "tokens": _estimate_tokens(summary),
    })

    # 2. Step chunks - one per procedure step, grouped when sequential
    steps = structured.get("steps", [])
    if steps:
        # Create individual step chunks
        for i, step in enumerate(steps):
            if isinstance(step, str):
                step_num = i + 1
                step_text = step
            else:
                step_num = step.get("step_number", step.get("step", i + 1))
                step_text = step.get("text", step.get("action", ""))
            if not step_text:
                continue
            full_text = f"Step {step_num}: {step_text}"
            chunks.append({
                **base_meta,
                "chunk_id": f"{sop_id}_step_{step_num}",
                "chunk_type": "step",
                "section_id": "procedure",
                "section_title": "Procedure Steps",
                "text": full_text,
                "step_order": step_num,
                "tokens": _estimate_tokens(full_text),
            })

        # Also create a combined steps chunk (parent)
        all_steps_text = f"{sop_title} - Complete Procedure Steps:\n\n"
        def _step_sort_key(s):
            if isinstance(s, str):
                return 0
            return s.get("step_number", s.get("step", 0))
        for i, step in enumerate(sorted(steps, key=_step_sort_key)):
            if isinstance(step, str):
                num, txt = i + 1, step
            else:
                num = step.get("step_number", step.get("step", i + 1))
                txt = step.get("text", step.get("action", ""))
            all_steps_text += f"Step {num}: {txt}\n"
        chunks.append({
            **base_meta,
            "chunk_id": f"{sop_id}_all_steps",
            "chunk_type": "step_sequence",
            "section_id": "procedure",
            "section_title": "Complete Procedure",
            "text": all_steps_text.strip(),
            "step_order": None,
            "tokens": _estimate_tokens(all_steps_text),
        })

    # 3. Threshold chunks
    thresholds = structured.get("thresholds", [])
    if thresholds:
        threshold_text = f"{sop_title} - Clinical Thresholds and Values:\n\n"
        for t in thresholds:
            if isinstance(t, str):
                threshold_text += f"- {t}\n"
                continue
            val = t.get("value", "")
            ctx = t.get("context", t.get("parameter", ""))
            if val:
                threshold_text += f"- {val}: {ctx[:150]}\n"
        chunks.append({
            **base_meta,
            "chunk_id": f"{sop_id}_thresholds",
            "chunk_type": "threshold",
            "section_id": "thresholds",
            "section_title": "Clinical Thresholds",
            "text": threshold_text.strip(),
            "step_order": None,
            "tokens": _estimate_tokens(threshold_text),
        })

    # 4. Contraindication chunks
    contras = structured.get("contraindications", [])
    if contras:
        contra_text = f"{sop_title} - Contraindications and Warnings:\n\n"
        for c in contras:
            if isinstance(c, str):
                contra_text += f"- {c}\n"
                continue
            txt = c.get("text", c.get("condition", ""))
            detail = c.get("detail", c.get("action_to_avoid", ""))
            if txt:
                contra_text += f"- {txt}"
                if detail and detail != txt:
                    contra_text += f" ({detail})"
                contra_text += "\n"
        chunks.append({
            **base_meta,
            "chunk_id": f"{sop_id}_contraindications",
            "chunk_type": "contraindication",
            "section_id": "contraindications",
            "section_title": "Contraindications and Warnings",
            "text": contra_text.strip(),
            "step_order": None,
            "tokens": _estimate_tokens(contra_text),
        })

    # 5. Section chunks - extract sections from raw text
    sections = _extract_section_chunks(raw_text, sop_id, base_meta)
    chunks.extend(sections)

    # 6. Full text chunk (for fallback retrieval)
    if len(raw_text) < 8000:
        chunks.append({
            **base_meta,
            "chunk_id": f"{sop_id}_full",
            "chunk_type": "full_text",
            "section_id": "full",
            "section_title": "Full Document",
            "text": raw_text,
            "step_order": None,
            "tokens": _estimate_tokens(raw_text),
        })

    return chunks


def _create_summary(raw_text: str, title: str, department: str) -> str:
    """Create a summary chunk from the beginning of the document."""
    # Take first meaningful paragraph after title
    lines = raw_text.split("\n")
    summary_parts = [f"{title} ({department})"]
    char_count = len(summary_parts[0])

    for line in lines:
        line = line.strip()
        if not line or line.upper() == title.upper():
            continue
        if char_count + len(line) > 500:
            break
        summary_parts.append(line)
        char_count += len(line)

    return "\n".join(summary_parts)


def _extract_section_chunks(raw_text: str, sop_id: str, base_meta: dict) -> list[dict]:
    """Split document into section-based chunks."""
    chunks = []

    # Find section boundaries
    section_pattern = re.compile(
        r"(?:^|\n)(\d+\.\s+[A-Z].*|[A-Z][A-Z\s]{4,60}(?:\n)|(?:Section|SECTION)\s+\d+.*)",
        re.MULTILINE
    )

    matches = list(section_pattern.finditer(raw_text))

    if not matches:
        # No sections found - create paragraph chunks as fallback
        return _paragraph_chunks(raw_text, sop_id, base_meta)

    for i, match in enumerate(matches):
        section_title = match.group(0).strip()
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw_text)
        section_text = raw_text[start:end].strip()

        if len(section_text) < 20:
            continue

        # Prepend SOP title for context
        full_text = f"{base_meta['sop_title']} - {section_title}:\n{section_text}"

        chunks.append({
            **base_meta,
            "chunk_id": f"{sop_id}_section_{i}",
            "chunk_type": "section",
            "section_id": f"section_{i}",
            "section_title": section_title[:100],
            "text": full_text[:2000],  # Cap section chunk size
            "step_order": None,
            "tokens": _estimate_tokens(full_text[:2000]),
        })

    return chunks


def _paragraph_chunks(raw_text: str, sop_id: str, base_meta: dict) -> list[dict]:
    """Fallback: split into paragraph-based chunks."""
    paragraphs = re.split(r"\n{2,}", raw_text.strip())
    chunks = []
    current = ""
    idx = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) > 1200 and current:
            chunks.append({
                **base_meta,
                "chunk_id": f"{sop_id}_para_{idx}",
                "chunk_type": "section",
                "section_id": f"paragraph_{idx}",
                "section_title": "",
                "text": f"{base_meta['sop_title']}:\n{current.strip()}",
                "step_order": None,
                "tokens": _estimate_tokens(current),
            })
            idx += 1
            current = para
        else:
            current = f"{current}\n{para}" if current else para

    if current.strip():
        chunks.append({
            **base_meta,
            "chunk_id": f"{sop_id}_para_{idx}",
            "chunk_type": "section",
            "section_id": f"paragraph_{idx}",
            "section_title": "",
            "text": f"{base_meta['sop_title']}:\n{current.strip()}",
            "step_order": None,
            "tokens": _estimate_tokens(current),
        })

    return chunks


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (1 token ~ 4 chars)."""
    return len(text) // 4
