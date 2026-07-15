"""
Meridian Evidence Source Registry
------------------------------------
One place that knows about every EvidenceSource implementation. Adding a new
source (another literature API, a regional health authority, ...) means
writing one EvidenceSource subclass and registering it here - nothing else
in the app needs to change.

Research prototype. Not for clinical use.
"""

from typing import Any, Optional

from app.integrations.evidence_source import EvidenceSource, classify_stance, is_title_relevant, grade_evidence, evidence_grade_rank
from app.integrations.pubmed import PubMedSource
from app.integrations.europepmc import EuropePMCSource
from app.integrations.cdc import CDCSource
from app.integrations.who import WHOSource
from app.integrations.clinicaltrials import ClinicalTrialsSource
from app.integrations.fda import FDASource
from app.integrations.medlineplus import MedlinePlusSource
from app.integrations.cms import CMSSource

_REGISTRY: dict[str, EvidenceSource] = {
    "pubmed": PubMedSource(),
    "europepmc": EuropePMCSource(),
    "cdc": CDCSource(),
    "who": WHOSource(),
    "clinicaltrials": ClinicalTrialsSource(),
    "fda": FDASource(),
    "medlineplus": MedlinePlusSource(),
    "cms": CMSSource(),
}


def get_source(name: str) -> Optional[EvidenceSource]:
    return _REGISTRY.get(name)


def all_sources() -> list[EvidenceSource]:
    return list(_REGISTRY.values())


def source_names() -> list[str]:
    return list(_REGISTRY.keys())


async def search_all(
    term: str,
    sources: Optional[list[str]] = None,
    max_results: int = 5,
    sort_by: str = "grade",
) -> list[dict[str, Any]]:
    """Query the given sources (default: all registered) for `term` and
    return their combined records. Unparseable dates sort last rather than
    raising or being dropped.

    Each source is over-fetched (see fetch_n below) and the merged results
    are filtered through is_title_relevant before trimming to max_results -
    a source's own search can still return a handful of off-topic hits even
    with relevance-first ranking (see pubmed.py/europepmc.py/who.py/
    clinicaltrials.py), so fetching extra and dropping the irrelevant ones
    leaves a fuller, genuinely on-topic result set instead of silently
    ending up with fewer results than requested.

    sort_by="grade" (default) ranks by evidence_grade first and recency
    second, so a 2019 systematic review outranks a 2026 case report - "most
    recent" alone was surfacing low-quality noise ahead of the guidance
    that actually matters. sort_by="recency" keeps the old pure-date order
    for callers that specifically want a chronological feed (e.g. Evidence
    Watch's "what's new" framing).
    """
    if sources:
        names = sources
    else:
        from app.services.app_settings import get_enabled_evidence_sources
        names = get_enabled_evidence_sources()

    # Over-fetch further than max_results so grade-sorting has a real pool
    # of candidates to pick the best from per source, rather than just
    # keeping whichever max_results the source's own (usually relevance/
    # recency) ranking happened to return first.
    fetch_n = min(max_results * 4, 30)
    combined: list[dict[str, Any]] = []
    for name in names:
        src = _REGISTRY.get(name)
        if src is None:
            continue
        records = await src.search(term, max_results=fetch_n)
        for r in records:
            r["stance"] = classify_stance(r.get("title", ""))
            r["evidence_grade"] = grade_evidence(r)
        relevant = [r for r in records if is_title_relevant(term, r.get("title", ""))]
        if sort_by == "grade":
            relevant.sort(key=lambda r: (evidence_grade_rank(r), r.get("pub_date_parsed") or "0000-00-00"), reverse=True)
        else:
            relevant.sort(key=lambda r: r.get("pub_date_parsed") or "0000-00-00", reverse=True)
        combined.extend(relevant[:max_results] if len(relevant) > max_results else relevant)

    if sort_by == "grade":
        combined.sort(key=lambda r: (evidence_grade_rank(r), r.get("pub_date_parsed") or "0000-00-00"), reverse=True)
    else:
        combined.sort(key=lambda r: r.get("pub_date_parsed") or "0000-00-00", reverse=True)
    return combined
