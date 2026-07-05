"""
Detects conflicts between retrieved SOP chunks and between SOP content and external evidence.
"""
from typing import Any


def detect_sop_conflicts(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Looks for contradictory instructions across chunks from different SOPs.
    Returns list of conflict records.
    """
    conflicts = []

    # Check if two chunks from different SOPs contain contradictory threshold values
    for i, chunk_a in enumerate(chunks):
        for chunk_b in chunks[i+1:]:
            if chunk_a.get("sop_title") == chunk_b.get("sop_title"):
                continue

            text_a = chunk_a.get("text", chunk_a.get("chunk_text", "")).lower()
            text_b = chunk_b.get("text", chunk_b.get("chunk_text", "")).lower()

            # Look for numeric value conflicts (e.g., "3 mcg/kg/min" vs "5 mcg/kg/min")
            import re
            nums_a = set(re.findall(r'\b\d+\.?\d*\s*(?:mcg|mg|ml|mmhg|mmol|%|units?|hours?|minutes?)\b', text_a))
            nums_b = set(re.findall(r'\b\d+\.?\d*\s*(?:mcg|mg|ml|mmhg|mmol|%|units?|hours?|minutes?)\b', text_b))

            if nums_a and nums_b and not nums_a.intersection(nums_b):
                # Different numeric values — potential conflict
                for term in ["dose", "maximum", "minimum", "threshold", "rate"]:
                    if term in text_a and term in text_b:
                        conflicts.append({
                            "type": "value_conflict",
                            "sop_a": chunk_a.get("sop_title", "Unknown"),
                            "sop_b": chunk_b.get("sop_title", "Unknown"),
                            "values_a": list(nums_a)[:3],
                            "values_b": list(nums_b)[:3],
                            "topic": term,
                            "severity": "high",
                            "message": f"Conflicting {term} values between {chunk_a.get('sop_title')} and {chunk_b.get('sop_title')}",
                        })

    return conflicts


def detect_evidence_conflicts(answer: str, external_evidence: list[dict]) -> list[dict]:
    """
    Checks if the generated answer conflicts with known external evidence items.
    Returns list of conflict flags.
    """
    flags = []

    for ev in external_evidence:
        alignment = ev.get("alignment_status", "not_reviewed")
        if alignment in ("conflict_detected", "possible_update"):
            flags.append({
                "type": "evidence_conflict",
                "source": ev.get("source_name", "External source"),
                "title": ev.get("title", ""),
                "alignment_status": alignment,
                "severity": "high" if alignment == "conflict_detected" else "medium",
                "message": f"External evidence ({ev.get('source_name')}) may conflict with internal SOP guidance.",
                "evidence_summary": ev.get("summary", "")[:200],
            })

    return flags
