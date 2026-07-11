"""
Meridian Answer Cache
------------------------------------
Short-TTL cache for full pipeline responses, keyed by the exact question
text (+ any parameter that changes the generated prompt, like news2_score).
Cuts repeat latency for the common "same FAQ asked again" case (the
suggested-question chips on the query page are the obvious example - many
users will click the same one) without a full generation + verification
pass every time.

Only applied to standalone/fresh questions (no conversation history) -
a follow-up question's answer can legitimately depend on what was asked
before it, so those are never cached or served from cache.

Invalidation is TTL-only (default 10 minutes), not tied to SOP edits.
This is a deliberate simplification, not an oversight: precise
invalidation would need every SOP-write path (direct edit, proposal
approval, effective-date rollover) to bump a shared version counter, and
a real deployment would want to weigh that complexity against just
turning the TTL down. A short TTL bounds how long a stale answer can
survive a SOP change to a few minutes, which is an acceptable tradeoff
for a research prototype; a production deployment with frequent SOP
edits should either shorten LLM_ANSWER_CACHE_TTL_SECONDS or wire in real
invalidation.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import re
import time
from typing import Optional

from app.schemas.schemas import QueryResponse

_TTL_SECONDS = 600  # 10 minutes
_MAX_ENTRIES = 500  # simple bound so a long-running process can't grow this unbounded

_store: dict[str, tuple[float, QueryResponse]] = {}


def _normalize(query: str) -> str:
    return re.sub(r"\s+", " ", query.strip().lower())


def make_key(query: str, news2_score: Optional[int]) -> str:
    return f"{_normalize(query)}|news2={news2_score if news2_score is not None else ''}"


def get(query: str, news2_score: Optional[int]) -> Optional[QueryResponse]:
    key = make_key(query, news2_score)
    entry = _store.get(key)
    if entry is None:
        return None
    ts, response = entry
    if time.time() - ts > _TTL_SECONDS:
        _store.pop(key, None)
        return None
    return response


def set(query: str, news2_score: Optional[int], response: QueryResponse) -> None:
    if len(_store) >= _MAX_ENTRIES:
        # Evict the oldest entry rather than growing unbounded. A proper
        # LRU isn't worth the complexity for a cache this small and
        # short-lived - this only fires under sustained unique-query load.
        oldest_key = min(_store, key=lambda k: _store[k][0])
        _store.pop(oldest_key, None)
    key = make_key(query, news2_score)
    _store[key] = (time.time(), response)


def clear() -> None:
    """Exposed for tests and for a future admin/settings "flush cache" action."""
    _store.clear()
