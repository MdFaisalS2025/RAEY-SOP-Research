"""
Meridian Multi-Part Query Decomposition
--------------------------------------------
Splits a question that actually asks two things ("what's the dose and when
should I escalate?") into sub-questions so retrieval can be run against
each part separately, instead of one blended query that risks only
matching the topic mentioned first.

Deliberately conservative: only splits on " and "/"; " when what follows
reads like its own question (starts with a question word or auxiliary
verb) - "screening and management" or "signs and symptoms" must NOT
split, since those are compound nouns describing one topic, not two
questions. False negatives (an unsplit multi-part question) just behave
as before; false positives (splitting a single-topic question) would
dilute retrieval, so the pattern stays narrow.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import re

_SPLIT_RE = re.compile(
    r"\s*;\s*|\s+and\s+(?=(?:what|when|how|which|who|why|does|do|is|are|should|must|can)\b)",
    re.IGNORECASE,
)

MAX_PARTS = 3


def split_multi_part_query(query: str) -> list[str]:
    """Returns the sub-questions if `query` looks like it asks more than
    one thing, else [] (meaning: treat as a single question as before)."""
    parts = [p.strip() for p in _SPLIT_RE.split(query) if p.strip()]
    if len(parts) < 2:
        return []
    return parts[:MAX_PARTS]
