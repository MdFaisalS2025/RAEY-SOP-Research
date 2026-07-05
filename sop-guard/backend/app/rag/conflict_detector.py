"""
Detects conflicts between retrieved SOP chunks and between SOP content and external evidence.
"""
import re
from typing import Any

_VALUE_RE = re.compile(
    r'\b(\d+\.?\d*)\s*(mcg|mg|ml|mmhg|mmol|%|units?|hours?|minutes?)\b',
    re.IGNORECASE,
)

# Units each topic term may plausibly describe. "dose"/"rate" are dosing
# concepts (mcg/mg/ml/units, optionally per time) and should never match a
# pressure or lab-value unit like mmHg/mmol/% even if one happens to fall
# inside the proximity window - those describe thresholds, not doses.
_TOPIC_UNITS = {
    "dose": {"mcg", "mg", "ml", "units", "unit"},
    "maximum": {"mcg", "mg", "ml", "units", "unit", "hours", "hour", "minutes", "minute"},
    "minimum": {"mcg", "mg", "ml", "units", "unit", "hours", "hour", "minutes", "minute"},
    "rate": {"mcg", "mg", "ml", "units", "unit", "hours", "hour", "minutes", "minute"},
    "threshold": {"mmhg", "mmol", "%", "mcg", "mg", "ml", "units", "unit"},
}

# How many characters around a topic keyword count as "the value it's describing".
# Keeps comparisons scoped to the same clinical fact instead of any two numbers
# that happen to appear anywhere in a (possibly long, multi-topic) chunk.
_WINDOW = 60


def _values_near_keyword(text: str, keyword: str) -> set[tuple[float, str]]:
    """Numeric (value, unit) pairs found within a short window of each keyword occurrence, restricted to units that keyword can plausibly describe."""
    allowed_units = _TOPIC_UNITS.get(keyword, set())
    found: set[tuple[float, str]] = set()
    for m in re.finditer(r'\b' + re.escape(keyword) + r'\b', text):
        start = max(0, m.start() - _WINDOW)
        end = min(len(text), m.end() + _WINDOW)
        window = text[start:end]
        for vm in _VALUE_RE.finditer(window):
            unit = vm.group(2).lower()
            if unit not in allowed_units:
                continue
            found.add((float(vm.group(1)), unit))
    return found


def detect_sop_conflicts(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Looks for contradictory instructions across chunks from different SOPs.

    A conflict requires the same topic keyword (e.g. "dose") in both chunks AND
    a different numeric value of the SAME unit found near that keyword — not
    just any two different numbers appearing anywhere in either chunk. Without
    this scoping, two chunks about unrelated drugs/thresholds that both happen
    to contain the word "dose" would be flagged as conflicting on the strength
    of unrelated numbers elsewhere in the text.
    """
    conflicts = []

    for i, chunk_a in enumerate(chunks):
        for chunk_b in chunks[i + 1:]:
            if chunk_a.get("sop_title") == chunk_b.get("sop_title"):
                continue

            text_a = chunk_a.get("text", chunk_a.get("chunk_text", "")).lower()
            text_b = chunk_b.get("text", chunk_b.get("chunk_text", "")).lower()

            for term in _TOPIC_UNITS:
                if term not in text_a or term not in text_b:
                    continue

                values_a = _values_near_keyword(text_a, term)
                values_b = _values_near_keyword(text_b, term)
                if not values_a or not values_b:
                    continue

                # Only compare values that share a unit - mg vs ml isn't a
                # conflict, it's two different measurements.
                for unit in {u for _, u in values_a} & {u for _, u in values_b}:
                    a_for_unit = {v for v, u in values_a if u == unit}
                    b_for_unit = {v for v, u in values_b if u == unit}
                    if a_for_unit == b_for_unit:
                        continue
                    conflicts.append({
                        "type": "value_conflict",
                        "sop_a": chunk_a.get("sop_title", "Unknown"),
                        "sop_b": chunk_b.get("sop_title", "Unknown"),
                        "values_a": [f"{v:g} {unit}" for v in sorted(a_for_unit)],
                        "values_b": [f"{v:g} {unit}" for v in sorted(b_for_unit)],
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
