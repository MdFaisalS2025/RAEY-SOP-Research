"""
Meridian External Evidence Cache
------------------------------------
Short-TTL cache for individual external-evidence-source responses, keyed
by (source name, cleaned search term, requested result count).

Real gap this closes (Phase C): evidence_registry.search_all() called
every registered source's live API on every single query - repeat
questions (a suggested-question chip, a follow-up that re-triggers the
same comparison, several users asking the same thing) each paid the full
PubMed/CDC/WHO/etc. round-trip again, and asking the same question twice
in a row within an eval run doubled real network load and rate-limit
exposure for zero benefit, since none of these APIs return different
results a few minutes apart.

Distinct from app/services/answer_cache.py (which caches a full generated
answer, keyed by exact question text, and only for standalone/fresh
questions with no history): this cache sits one layer lower, in front of
each individual EvidenceSource.search() call, so it helps even when the
overall question differs but resolves to the same clean_search_term (e.g.
"compare X" and "what does current evidence say about X" both search
provider APIs for the same term).

Invalidation is TTL-only, matching answer_cache's rationale: these are
published literature searches, not something that changes minute to
minute, so a short TTL is a latency/rate-limit optimization, not a
staleness risk in the way SOP content would be.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import time
from typing import Any, Optional

_TTL_SECONDS = 900  # 15 minutes - longer than answer_cache's 10, since
# external literature changes far less often than an SOP might.
_MAX_ENTRIES = 300

#: key -> (timestamp, records)
_store: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def make_key(source_name: str, term: str, max_results: int) -> str:
    return f"{source_name}|{term.strip().lower()}|{max_results}"


def get(source_name: str, term: str, max_results: int) -> Optional[list[dict[str, Any]]]:
    key = make_key(source_name, term, max_results)
    entry = _store.get(key)
    if entry is None:
        return None
    ts, records = entry
    if time.time() - ts > _TTL_SECONDS:
        _store.pop(key, None)
        return None
    # Shallow-copy each record: callers (search_all) mutate per-call fields
    # (stance, evidence_grade, supporting_excerpt - the last one depends on
    # the *caller's* query term, not the cached search term) directly on
    # the dicts. Returning the cached objects themselves would let two
    # different questions that happen to share a cached search silently
    # clobber each other's supporting_excerpt under concurrent requests.
    return [dict(r) for r in records]


def set(source_name: str, term: str, max_results: int, records: list[dict[str, Any]]) -> None:
    if len(_store) >= _MAX_ENTRIES:
        oldest_key = min(_store, key=lambda k: _store[k][0])
        _store.pop(oldest_key, None)
    key = make_key(source_name, term, max_results)
    _store[key] = (time.time(), records)


def clear() -> None:
    """Exposed for tests and for a future admin/settings "flush cache" action."""
    _store.clear()
