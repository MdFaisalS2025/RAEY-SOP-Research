"""
Meridian Answer Cache
------------------------------------
Short-TTL cache for full pipeline responses, keyed by the exact question
text (+ any parameter that changes the generated prompt, like news2_score).
Cuts repeat latency for the common "same FAQ asked again" case (the
suggested-question chips on the query page are the obvious example - many
users will click the same one) without a full generation + verification
pass every time.

Also serves paraphrased questions that are near-identical in meaning but
not in exact text (e.g. "max dose of norepinephrine" vs "what's the
maximum norepinephrine dose") via a semantic fallback: when there's no
exact-key hit, and a real dense embedding model is loaded (see
app/rag/embedding_cache.py - this is a no-op, not a false-positive risk,
when only the TF-IDF stub is active, since dense_similarity returns 0.0
for everything in that case), scan same-news2_score entries for a cosine
similarity above SEMANTIC_MATCH_THRESHOLD. The threshold is set high
(0.94) deliberately - this cache skips the entire verification/faithfulness
pipeline, so a false-positive "close enough" match would silently serve an
answer to a different question. When in doubt, miss and regenerate.

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
SEMANTIC_MATCH_THRESHOLD = 0.94

#: key -> (timestamp, normalized_query, news2_score, response)
_store: dict[str, tuple[float, str, Optional[int], QueryResponse]] = {}


def _normalize(query: str) -> str:
    return re.sub(r"\s+", " ", query.strip().lower())


def make_key(query: str, news2_score: Optional[int]) -> str:
    return f"{_normalize(query)}|news2={news2_score if news2_score is not None else ''}"


def _prune_expired() -> None:
    now = time.time()
    expired = [k for k, (ts, *_rest) in _store.items() if now - ts > _TTL_SECONDS]
    for k in expired:
        _store.pop(k, None)


def _semantic_match(query: str, news2_score: Optional[int]) -> Optional[QueryResponse]:
    try:
        from app.rag.embedding_cache import is_dense_backend_active, dense_similarity
    except Exception:
        return None
    if not is_dense_backend_active():
        return None

    normalized = _normalize(query)
    best_score, best_response = 0.0, None
    for ts, stored_query, stored_news2, response in _store.values():
        if stored_news2 != news2_score:
            continue
        if stored_query == normalized:
            continue  # already handled by the exact-key path
        try:
            score = dense_similarity(normalized, stored_query)
        except Exception:
            continue
        if score > best_score:
            best_score, best_response = score, response

    if best_response is not None and best_score >= SEMANTIC_MATCH_THRESHOLD:
        return best_response
    return None


def get(query: str, news2_score: Optional[int]) -> Optional[QueryResponse]:
    key = make_key(query, news2_score)
    entry = _store.get(key)
    if entry is not None:
        ts, _normalized, _news2, response = entry
        if time.time() - ts <= _TTL_SECONDS:
            return response
        _store.pop(key, None)

    _prune_expired()
    return _semantic_match(query, news2_score)


def set(query: str, news2_score: Optional[int], response: QueryResponse) -> None:
    if len(_store) >= _MAX_ENTRIES:
        # Evict the oldest entry rather than growing unbounded. A proper
        # LRU isn't worth the complexity for a cache this small and
        # short-lived - this only fires under sustained unique-query load.
        oldest_key = min(_store, key=lambda k: _store[k][0])
        _store.pop(oldest_key, None)
    key = make_key(query, news2_score)
    _store[key] = (time.time(), _normalize(query), news2_score, response)


def clear() -> None:
    """Exposed for tests and for a future admin/settings "flush cache" action."""
    _store.clear()
