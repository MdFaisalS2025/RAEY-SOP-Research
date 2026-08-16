"""
RAEY SOP-Aware Chunker
Creates typed chunks that preserve clinical structure.
Research prototype. Not for clinical use.
"""

import re
from typing import Any
from datetime import datetime

from app.rag.entity_graph import DRUG_LEXICON, CONDITION_LEXICON
from app.rag.clinical_terms import ABBREVIATIONS

# Shared with _extract_section_chunks (which builds section chunks from
# these same boundaries) and _section_heading_at (which looks up which
# section a given char offset falls inside, for step chunks - see
# _locate_step_by_number).
_SECTION_HEADING_PATTERN = re.compile(
    r"(?:^|\n)(\d+\.\s+[A-Z].*|[A-Z][A-Z\s]{4,60}(?:\n)|(?:Section|SECTION)\s+\d+.*)",
    re.MULTILINE,
)


def _locate_span(raw_text: str, needle: str) -> tuple[int | None, int | None, str]:
    """Locate `needle` inside `raw_text`, for citation deep-linking offsets.

    Never fabricates: returns (None, None, "") rather than guessing. Tries
    an exact substring match first ("verbatim"), then a whitespace-
    normalized search ("normalized") for text that differs only in
    line-wrapping/spacing, via an index map back to the original string.
    """
    if not needle:
        return None, None, ""

    idx = raw_text.find(needle)
    if idx != -1:
        return idx, idx + len(needle), "verbatim"

    # Whitespace-normalized fallback: collapse runs of whitespace to a
    # single space in both strings, search in the normalized text, then
    # map the match position back to the original raw_text index via a
    # position map built alongside the normalization.
    norm_chars: list[str] = []
    index_map: list[int] = []  # index_map[i] = original raw_text index of norm_chars[i]
    prev_was_space = False
    for i, ch in enumerate(raw_text):
        if ch.isspace():
            if not prev_was_space:
                norm_chars.append(" ")
                index_map.append(i)
            prev_was_space = True
        else:
            norm_chars.append(ch)
            index_map.append(i)
            prev_was_space = False
    normalized = "".join(norm_chars)

    norm_needle = re.sub(r"\s+", " ", needle).strip()
    if not norm_needle:
        return None, None, ""

    norm_idx = normalized.find(norm_needle)
    if norm_idx == -1:
        return None, None, ""

    start = index_map[norm_idx]
    norm_end = norm_idx + len(norm_needle) - 1
    if norm_end >= len(index_map):
        norm_end = len(index_map) - 1
    end = index_map[norm_end] + 1
    return start, end, "normalized"


_ANCHOR_LEN = 160


def _anchor_for(raw_text: str, start: int | None, end: int | None) -> str:
    """Verbatim head of raw_text[start:end], so the frontend can verify a
    stored offset still points at the same text before trusting it.

    Always derived from raw_text - never from a chunk's display text, which
    is title-prefixed for section chunks (see _extract_section_chunks) and
    would make that check fail on every correctly-located section offset.
    """
    if start is None or end is None:
        return ""
    return raw_text[start:min(end, start + _ANCHOR_LEN)]


_STEP_ANCHOR_MIN_CONTAINMENT = 0.60

_CONTAINMENT_STOPWORDS = {
    "the", "and", "for", "with", "into", "from", "that", "this", "then",
    "should", "shall", "must", "when", "than", "within", "over", "under",
    "not", "are", "was", "were", "has", "have", "had", "can", "will",
    "step", "using",
}


def _containment_tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]{3,}", (text or "").lower()) if w not in _CONTAINMENT_STOPWORDS}


def _containment(a: str, b: str) -> float:
    """Fraction of `a`'s significant word tokens present in `b` -
    asymmetric on purpose. Used to gate step-number anchoring, where `a`
    is a compressed paraphrase (the structured extraction's step text)
    and `b` is the longer raw block it's being anchored to: the question
    is "does b cover a", not "are a and b interchangeable". A symmetric
    metric like Jaccard collapses on exactly that length difference - a
    difflib.SequenceMatcher prototype of this gate produced wrong spans
    at scores that would otherwise pass, because it penalized the
    paraphrase for being shorter than the block containing it."""
    ta = _containment_tokens(a)
    if not ta:
        return 0.0
    tb = _containment_tokens(b)
    return len(ta & tb) / len(ta)


def _locate_step_by_number(raw_text: str, step_num: Any, step_text: str) -> tuple[int | None, int | None, str]:
    """Anchor a paraphrased step to the SOP's own "Step N:" marker in
    raw_text - not a text-similarity guess, a structural fact about the
    document's own numbering. Gated by _containment so a mismatched or
    reordered SOP still returns NULL rather than confidently pointing at
    the wrong step.

    Calibrated against the demo corpus (219 step pairs, hand-inspected):
    correct anchors have median containment 0.90 (p5 0.625); wrong
    anchors have median 0.0 (p95 0.333, max 0.667). The 0.60 threshold
    recovers ~211/216 previously-unlocatable step chunks at a measured
    false-positive rate of 0.5%; 0.50 trades a small FP-rate increase for
    slightly higher recall, 0.70 trades recall for zero measured FPs.
    """
    if not step_text:
        return None, None, ""
    pattern = re.compile(
        rf"(?m)^[ \t]*Step[ \t]+{re.escape(str(step_num))}[:.\)][ \t]*"
        rf"(?:.+(?:\n(?![ \t]*Step[ \t]+\d)(?!\s*$).+)*)"
    )
    m = pattern.search(raw_text)
    if not m:
        return None, None, ""
    if _containment(step_text, m.group(0)) < _STEP_ANCHOR_MIN_CONTAINMENT:
        return None, None, ""
    return m.start(), m.end(), "step_anchor"


def _section_heading_at(raw_text: str, offset: int | None) -> str | None:
    """Which section heading (using the same boundary pattern
    _extract_section_chunks builds section chunks from) contains
    raw_text[offset]? None if offset is None or no section heading
    matches - callers fall back to a generic label in that case, since a
    step outside any recognized section shouldn't be given a fabricated
    section_title."""
    if offset is None:
        return None
    matches = list(_SECTION_HEADING_PATTERN.finditer(raw_text))
    if not matches:
        return None
    for i, m in enumerate(matches):
        start = m.start(1)
        end = matches[i + 1].start(1) if i + 1 < len(matches) else len(raw_text)
        if start <= offset < end:
            return m.group(1).strip()[:100]
    return None


def _sop_level_entities(raw_text: str) -> list[str]:
    """Drug/condition entities present anywhere in the SOP's full text, not
    just in the specific chunk being built. Attached to every chunk of this
    SOP so a bucket-style chunk (e.g. "Clinical Thresholds and Values" -
    every threshold for the SOP concatenated into one chunk without
    per-line drug-name context, see chunker below) still carries its SOP's
    defining entity.

    Real bug this fixes: "What is the target INR for warfarin?" correctly
    retrieved the Anticoagulation SOP's threshold chunk ("2.0-3.0: INR
    target (DVT/PE/AFib)") as the clear top match, but the entity-grounding
    sufficiency check (evidence_sufficiency.py) only ever looked for
    "warfarin" as a literal substring in that chunk's own text - which
    never repeats the drug name, only the SOP's separate procedure-step
    chunk does. The check failed even though the correct SOP was already
    found, causing a false abstention. Chunk-level clinical_entities lets
    that check ask "does the retrieved SOP cover this drug" instead of
    "does this exact 200-character snippet happen to repeat the word."
    """
    low = raw_text.lower()
    found = []
    for term in DRUG_LEXICON + CONDITION_LEXICON:
        if re.search(r"\b" + re.escape(term) + r"\b", low):
            found.append(term)
    return found


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
        "clinical_entities": _sop_level_entities(raw_text),
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
        # Assembled from scattered lines - no single contiguous span exists.
        "char_start": None,
        "char_end": None,
        "offset_source": "",
        "offset_anchor": "",
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
            # Search on the raw step text, not the synthesized "Step N: "
            # prefix (which the source SOP text rarely spells out
            # verbatim), then widen backward over a literal step prefix
            # if the raw text happens to have one right before it.
            step_start, step_end, step_offset_source = _locate_span(raw_text, step_text)
            if step_start is not None:
                for prefix in (f"Step {step_num}: ", f"Step {step_num}:", f"{step_num}. ", f"{step_num}: "):
                    if raw_text[max(0, step_start - len(prefix)):step_start] == prefix:
                        step_start -= len(prefix)
                        break
            else:
                # step_text is usually an editorial paraphrase of the raw
                # SOP text (structured_json is hand-authored/LLM-extracted,
                # not a verbatim slice), so an exact/whitespace-normalized
                # search often can't find it. Anchor to the document's own
                # "Step N:" numbering instead - a structural fact, not a
                # text-similarity guess (see _locate_step_by_number).
                step_start, step_end, step_offset_source = _locate_step_by_number(raw_text, step_num, step_text)
            step_section_title = _section_heading_at(raw_text, step_start) or "Procedure Steps"
            chunks.append({
                **base_meta,
                "chunk_id": f"{sop_id}_step_{step_num}",
                "chunk_type": "step",
                "section_id": "procedure",
                "section_title": step_section_title,
                "text": full_text,
                "step_order": step_num,
                "tokens": _estimate_tokens(full_text),
                "char_start": step_start,
                "char_end": step_end,
                "offset_source": step_offset_source,
                "offset_anchor": _anchor_for(raw_text, step_start, step_end),
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
            "char_start": None,
            "char_end": None,
            "offset_source": "",
            "offset_anchor": "",
        })

    # 3. Threshold chunks - one per entry (mirrors step chunking below),
    # plus one combined chunk for "what are all the thresholds" queries.
    #
    # Individual chunks matter for retrieval quality in a way steps don't:
    # a single bucket chunk concatenating every threshold for a SOP is
    # topically diffuse, and the cross-encoder reranker (see
    # evidence_sufficiency.py's semantic_relevance check) scores diffuse
    # multi-fact passages far lower than a focused single-fact one even
    # when the fact is exactly what was asked - measured on this corpus,
    # the same MAP-target fact scored -10.9 bundled with four other
    # thresholds vs +0.8 alone. Real bug this fixes: "What is the target
    # mean arterial pressure in septic shock?" hard-failed the semantic
    # gate because the retrieved evidence was the whole bundled chunk.
    #
    # Each line is a natural sentence (not "value: parameter" notation,
    # which the reranker also scores poorly - it wants prose, not a
    # bullet dump) and spells out the parameter's abbreviation inline
    # when known (ABBREVIATIONS, the same lexicon query expansion uses) -
    # "MAP" alone scored far worse than "MAP (mean arterial pressure)"
    # against a query that spelled the term out.
    thresholds = structured.get("thresholds", [])
    if thresholds:
        for i, t in enumerate(thresholds):
            if isinstance(t, str):
                text = f"{sop_title}. {t}"
                param_key = ""
            else:
                val = t.get("value", "")
                param = t.get("parameter", t.get("context", ""))
                action = t.get("action", "")
                if not val:
                    continue
                param_key = param.lower().strip()
                expansion = ABBREVIATIONS.get(param_key, "")
                param_label = f"{param} ({expansion})" if expansion else param
                text = f"{sop_title}. {param_label}: {val}."
                if action:
                    text += f" {action}."
            chunks.append({
                **base_meta,
                "chunk_id": f"{sop_id}_threshold_{i}",
                "chunk_type": "threshold",
                "section_id": "thresholds",
                "section_title": "Clinical Thresholds",
                "text": text,
                "step_order": None,
                "tokens": _estimate_tokens(text),
                # Assembled/reworded from structured extraction (parameter
                # label, expansion, action all synthesized) - not a
                # contiguous span in raw_text.
                "char_start": None,
                "char_end": None,
                "offset_source": "",
                "offset_anchor": "",
            })

        # Combined chunk (parent) - same backwards-compatible "value:
        # parameter" bullet format as before, since nothing needs this one
        # to score well on its own; it exists so a broad "what are all the
        # thresholds for this SOP" query still has one chunk covering all
        # of them at once.
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
            "chunk_type": "threshold_sequence",
            "section_id": "thresholds",
            "section_title": "Clinical Thresholds",
            "text": threshold_text.strip(),
            "step_order": None,
            "tokens": _estimate_tokens(threshold_text),
            "char_start": None,
            "char_end": None,
            "offset_source": "",
            "offset_anchor": "",
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
            "char_start": None,
            "char_end": None,
            "offset_source": "",
            "offset_anchor": "",
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
            "char_start": 0,
            "char_end": len(raw_text),
            "offset_source": "whole_doc",
            "offset_anchor": _anchor_for(raw_text, 0, len(raw_text)),
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

    # Find section boundaries (shared pattern - see _section_heading_at,
    # which looks up which of these same boundaries a given offset falls
    # inside for step chunks).
    matches = list(_SECTION_HEADING_PATTERN.finditer(raw_text))

    if not matches:
        # No sections found - create paragraph chunks as fallback
        return _paragraph_chunks(raw_text, sop_id, base_meta)

    for i, match in enumerate(matches):
        # match.start(1)/group(1), not match.start(0)/group(0) - the
        # regex's leading (?:^|\n) is one character earlier than the
        # section title actually starts, which threw every section's
        # offsets off by one against raw_text.
        section_title = match.group(1).strip()
        start = match.start(1)
        end = matches[i + 1].start(1) if i + 1 < len(matches) else len(raw_text)
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
            "char_start": start,
            "char_end": end,
            "offset_source": "verbatim",
            "offset_anchor": _anchor_for(raw_text, start, end),
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
            para_start, para_end, para_offset_source = _locate_span(raw_text, current.strip())
            chunks.append({
                **base_meta,
                "chunk_id": f"{sop_id}_para_{idx}",
                "chunk_type": "section",
                "section_id": f"paragraph_{idx}",
                "section_title": "",
                "text": f"{base_meta['sop_title']}:\n{current.strip()}",
                "step_order": None,
                "tokens": _estimate_tokens(current),
                "char_start": para_start,
                "char_end": para_end,
                "offset_source": para_offset_source,
                "offset_anchor": _anchor_for(raw_text, para_start, para_end),
            })
            idx += 1
            current = para
        else:
            current = f"{current}\n{para}" if current else para

    if current.strip():
        _para_start, _para_end, _para_offset_source = _locate_span(raw_text, current.strip())
        chunks.append({
            **base_meta,
            "chunk_id": f"{sop_id}_para_{idx}",
            "chunk_type": "section",
            "section_id": f"paragraph_{idx}",
            "section_title": "",
            "text": f"{base_meta['sop_title']}:\n{current.strip()}",
            "step_order": None,
            "tokens": _estimate_tokens(current),
            "char_start": _para_start,
            "char_end": _para_end,
            "offset_source": _para_offset_source,
            "offset_anchor": _anchor_for(raw_text, _para_start, _para_end),
        })

    return chunks


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (1 token ~ 4 chars)."""
    return len(text) // 4
