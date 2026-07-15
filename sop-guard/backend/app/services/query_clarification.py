"""
Meridian Query Clarification
--------------------------------
Detects when a question is too ambiguous to answer safely and should be
turned back into a clarifying question instead of guessing (or abstaining
outright, which is unhelpful when the fix is just "which drug?").

Deliberately narrow: only fires for the concrete, well-understood case of
a dose/threshold/medication-type question naming no specific drug or
condition, where retrieval also found plausible matches in more than one
SOP (so there's a genuine choice to make, not just one obvious answer).
Broader ambiguity heuristics (e.g. "retrieval scores are close across
multiple SOPs") were considered and deliberately left out - many
legitimate multi-SOP questions (e.g. "sepsis management") retrieve
close-scoring chunks from several SOPs and are correctly answered as one
coherent response; a generic diversity trigger would misfire on those.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

from typing import Any, Optional

#: query_types where "no drug/condition named" genuinely leaves the
#: question underspecified - a procedure_steps or contraindication
#: question is usually answerable in general terms even without one.
_AMBIGUITY_PRONE_TYPES = {"threshold", "medication"}

MAX_OPTIONS = 4


def _distinct_sop_titles(retrieved: list[dict[str, Any]], limit: int = 5) -> list[str]:
    seen: list[str] = []
    for chunk in retrieved[:5]:
        title = chunk.get("sop_title", "")
        if title and title not in seen:
            seen.append(title)
        if len(seen) >= limit:
            break
    return seen


def detect_ambiguity(
    query_type: str,
    entities: dict[str, list[str]],
    retrieved: list[dict[str, Any]],
) -> Optional[dict[str, Any]]:
    """Returns {"question": str, "options": list[str]} if the query should
    be turned back into a clarifying question, else None."""
    if query_type not in _AMBIGUITY_PRONE_TYPES:
        return None
    if entities.get("drugs") or entities.get("conditions"):
        return None

    candidates = _distinct_sop_titles(retrieved, limit=MAX_OPTIONS)
    if len(candidates) < 2:
        return None

    return {
        "question": "This could relate to more than one medication or protocol. Which one did you mean?",
        "options": candidates,
    }
