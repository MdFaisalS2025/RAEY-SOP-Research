"""
SOP-Guard Evidence Source Interface
------------------------------------
Common contract every external evidence integration (PubMed, Europe PMC,
CDC, WHO, ClinicalTrials.gov, ...) implements, so the query pipeline and
Evidence Watch page can treat them uniformly: one normalized record shape,
one way to merge + sort results by recency, and one registry to add a new
source without touching any calling code.

Normalized record fields (all sources must return dicts with at least):
  title, authors, journal, pub_date (raw string), pub_date_parsed
  ("YYYY-MM-DD" or None), url, source_type, study_type

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import re
import time
from abc import ABC, abstractmethod
from typing import Any, Optional

#: Some public APIs (e.g. clinicaltrials.gov) return 403 Forbidden for
#: requests with no User-Agent header at all, which is httpx's default.
DEFAULT_HEADERS = {"User-Agent": "SOP-Guard-Research-Prototype/1.0 (+https://github.com)"}

_MONTHS = {
    name: i
    for i, name in enumerate(
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        start=1,
    )
}


def parse_pub_date(raw: Optional[str]) -> Optional[str]:
    """Best-effort parse of a free-text publication date into 'YYYY-MM-DD'
    (unknown month/day default to 01) so records from different evidence
    sources - which each format dates differently - can be sorted on one
    recency axis. Returns None if no year can be found."""
    if not raw:
        return None
    raw = raw.strip()

    m = re.match(r"^(\d{4})-(\d{2})(?:-(\d{2}))?", raw)
    if m:
        y, mo, d = m.group(1), m.group(2), m.group(3) or "01"
        return f"{y}-{mo}-{d}"

    m = re.match(r"^(\d{4})(?:\s+([A-Za-z]{3,})\s*(\d{0,2}))?", raw)
    if m:
        y = m.group(1)
        mo_name = (m.group(2) or "")[:3].title()
        mo = _MONTHS.get(mo_name, 1)
        d = int(m.group(3)) if m.group(3) else 1
        return f"{y}-{mo:02d}-{d:02d}"

    return None


#: Coarse title-only stance heuristic (Consensus.app-style Yes/Possibly/No
#: signal), NOT a claim-vs-evidence entailment classifier - we only have
#: the title text, not the abstract or full text, from any of these APIs.
#: Purely keyword-based, same spirit as the query-classification heuristics
#: elsewhere in the pipeline (query_agent.py, evidence_sufficiency.py).
_SUPPORT_KEYWORDS = [
    "effective", "efficacy", "improves", "reduces", "reduced", "benefit",
    "recommended", "associated with improved", "successful", "superior",
    "supports", "confirmed", "significant improvement", "safe and effective",
]
_REFUTE_KEYWORDS = [
    "no evidence", "not associated", "ineffective", "no benefit",
    "no significant difference", "failed to", "contraindicated",
    "increased risk", "adverse", "not recommended", "does not improve",
    "no improvement", "lack of evidence", "insufficient evidence",
]


def classify_stance(title: str) -> str:
    """Best-effort 'yes' | 'no' | 'unclear' signal from a title's wording
    alone. Deliberately coarse - a real evidence-agreement read requires
    the abstract/full text and ideally an LLM judgment, neither of which
    any of these APIs' summary endpoints provide. 'unclear' is the honest
    default, not a fallback to hide - most titles are purely descriptive
    and don't state a directional finding at all."""
    t = (title or "").lower()
    supports = any(kw in t for kw in _SUPPORT_KEYWORDS)
    refutes = any(kw in t for kw in _REFUTE_KEYWORDS)
    if supports and not refutes:
        return "yes"
    if refutes and not supports:
        return "no"
    return "unclear"


class TTLCache:
    """Small in-memory TTL cache shared by evidence source implementations
    so each one doesn't reinvent request throttling/caching."""

    def __init__(self, ttl_seconds: float = 3600):
        self.ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[float, list[dict[str, Any]]]] = {}

    def get(self, key: str) -> Optional[list[dict[str, Any]]]:
        entry = self._store.get(key)
        if entry is None:
            return None
        ts, value = entry
        if time.time() - ts > self.ttl_seconds:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: list[dict[str, Any]]) -> None:
        self._store[key] = (time.time(), value)

    def clear(self) -> None:
        self._store.clear()


class EvidenceSource(ABC):
    """Base class for a pluggable external evidence integration."""

    #: short machine name used in API params/registry keys, e.g. "pubmed"
    source_type: str = "unknown"
    #: human label for the UI, e.g. "PubMed"
    display_name: str = "Unknown"

    @abstractmethod
    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        """Search for `term` and return up to `max_results` normalized
        records, most-recent-plausible first. Must never raise - any
        network/parse failure should be caught and result in []."""
        raise NotImplementedError
