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

from app.integrations.evidence_source import EvidenceSource, classify_stance, is_title_relevant, grade_evidence, evidence_grade_rank, _significant_words, clean_search_term, pick_supporting_excerpt

# Real bug this guards against: is_title_relevant is pure lexical overlap
# (any shared significant word), so "heat stroke" matched a WHO paper
# titled "Health economic assessment tools (HEAT) for walking and for
# cycling" purely because "heat"/"HEAT" collide after lowercasing - the
# exact same same-token-different-meaning failure the cross-encoder
# semantic gate already fixed for internal SOP retrieval (see
# evidence_sufficiency.py's semantic_relevance check). Applied here as a
# second gate on top of (not instead of) is_title_relevant, since the
# lexical check is a cheap, useful pre-filter and this is genuinely
# expensive per-title.
#
# Threshold calibrated separately from the internal-SOP one (-2.0) because
# titles are much shorter than SOP chunks and score systematically lower:
# real weakest-true-positive titles scored ~-7.2, strongest false
# positives (the HEAT/heat-stroke collision, etc.) scored ~-8.9 - -8.0
# sits at the midpoint of that real, measured gap.
_MIN_TITLE_RELEVANCE = -8.0


def _semantic_scores(term: str, titles: list[str]) -> list[float] | None:
    """Cross-encoder relevance score for `term` against each title, or
    None if the real cross-encoder isn't available (falls back to
    lexical-only filtering, same as before this gate existed)."""
    from app.config import settings
    from app.rag.reranker import get_shared_reranker, CrossEncoderReranker

    reranker = get_shared_reranker(backend=settings.RAG_RERANKER_BACKEND, model_name=settings.RAG_RERANKER_MODEL)
    if not isinstance(reranker, CrossEncoderReranker) or not titles:
        return None
    try:
        return [float(s) for s in reranker.model.predict([(term, t) for t in titles])]
    except Exception:
        return None
from app.integrations.pubmed import PubMedSource
from app.integrations.europepmc import EuropePMCSource
from app.integrations.cdc import CDCSource
from app.integrations.who import WHOSource
from app.integrations.clinicaltrials import ClinicalTrialsSource
from app.integrations.fda import FDASource
from app.integrations.medlineplus import MedlinePlusSource
from app.integrations.cms import CMSSource
from app.integrations.openevidence import OpenEvidenceSource

_REGISTRY: dict[str, EvidenceSource] = {
    "pubmed": PubMedSource(),
    "europepmc": EuropePMCSource(),
    "cdc": CDCSource(),
    "who": WHOSource(),
    "clinicaltrials": ClinicalTrialsSource(),
    "fda": FDASource(),
    "medlineplus": MedlinePlusSource(),
    "cms": CMSSource(),
    # Always returns [] - see openevidence.py's module docstring for why
    # this is registered (so the pluggable-source shape is real) but never
    # produces results.
    "openevidence": OpenEvidenceSource(),
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
    # Clean, keyword-only term for the provider APIs (fixes openFDA 400s and
    # improves relevance on every source); the original question is kept for
    # the relevance gates below, which judge natural questions better.
    api_term = clean_search_term(term)
    for name in names:
        src = _REGISTRY.get(name)
        if src is None:
            continue
        records = await src.search(api_term, max_results=fetch_n)
        for r in records:
            r["stance"] = classify_stance(r.get("title", ""))
            r["evidence_grade"] = grade_evidence(r)
        relevant = [r for r in records if is_title_relevant(term, r.get("title", ""))]

        # Second, real gate on top of the lexical one above - see
        # _semantic_scores' docstring for the exact bug this catches
        # (shared-token, different-meaning title collisions the lexical
        # check can't tell apart). Only judges titles that actually have
        # distinctive content words, same "can't judge, don't penalize"
        # leniency is_title_relevant itself uses for sparse/empty titles.
        judgeable = [r for r in relevant if _significant_words(r.get("title", ""))]
        scores = _semantic_scores(term, [r.get("title", "") for r in judgeable])
        if scores is not None:
            below_threshold = set()
            for r, s in zip(judgeable, scores):
                r["semantic_relevance"] = round(s, 3)
                if s < _MIN_TITLE_RELEVANCE:
                    below_threshold.add(id(r))
            relevant = [r for r in relevant if id(r) not in below_threshold]

        if sort_by == "grade":
            relevant.sort(key=lambda r: (evidence_grade_rank(r), r.get("pub_date_parsed") or "0000-00-00"), reverse=True)
        else:
            relevant.sort(key=lambda r: r.get("pub_date_parsed") or "0000-00-00", reverse=True)
        combined.extend(relevant[:max_results] if len(relevant) > max_results else relevant)

    if sort_by == "grade":
        combined.sort(key=lambda r: (evidence_grade_rank(r), r.get("pub_date_parsed") or "0000-00-00"), reverse=True)
    else:
        combined.sort(key=lambda r: r.get("pub_date_parsed") or "0000-00-00", reverse=True)

    # Supporting excerpt: computed only on the final set actually returned
    # (not every over-fetched candidate) - the sentence from the abstract
    # most relevant to the query, so an evidence card can show *why* a
    # source supports the answer instead of just a title. Empty when no
    # abstract was fetched for this record (e.g. a source that doesn't
    # provide one, or the abstract fetch itself failed) - a missing excerpt
    # degrades the card gracefully rather than showing something fabricated.
    for r in combined:
        excerpt = pick_supporting_excerpt(r.get("abstract", ""), term)
        # Some records (short case reports, non-English titles) have no real
        # abstract body; a source's raw abstract text for those can still
        # contain a citation block whose only long line is the title itself,
        # which the excerpt picker can mistake for body text. Never surface
        # the title back as if it were a supporting excerpt - every
        # consumer (the Route B answer text, the standalone Evidence Panel,
        # the citation popover) gets this for free from one place.
        title = (r.get("title") or "").strip().rstrip(".")
        r["supporting_excerpt"] = "" if excerpt.strip().rstrip(".") == title else excerpt

    return combined
