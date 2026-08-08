"""
Meridian Guideline Finder (Phase Q3.1/Q3.2)
--------------------------------------------
Retrieves a real, published guideline document for an SOP's topic and
extracts real recommendation sentences from it (full text when available,
abstract otherwise - see get_guideline_text) - the online alternative to
sop_comparison.py's hand-transcribed REFERENCE_PROTOCOLS, built on the
existing EvidenceSource registry (no new providers).

One thing this deliberately does NOT do:
- Replace the general evidence search used elsewhere (Evidence Watch, the
  answer pipeline's external-evidence route). This module always opts into
  guideline-specific behavior (preserve_domain_terms, publication-type
  filters, a longer cache TTL) via explicit parameters - it never changes
  clean_search_term's or search_pubmed/search_europepmc's default behavior
  for any other caller.

Full-text coverage, stated plainly: Europe PMC (a real, verified-free link
in fullTextUrlList - europepmc.py's _free_full_text_link), PubMed (via its
PMC mirror - pubmed.py's get_pmc_full_text_link), and WHO (via IRIS's
bitstream chain - who.py's get_iris_full_text_link, and WHO is only
searched as a guideline candidate at all as of this addition - see
find_guideline below). CDC and ClinicalTrials.gov remain abstract-only/
not-applicable: CDC's Content Syndication API returned zero results for
real clinical terms in live testing (see fulltext_fetch.py's module
docstring), and ClinicalTrials.gov trial records are structured data with
no separate "full text" document to fetch. See get_guideline_text's
docstring for the honest per-candidate breakdown.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import re
import time
from typing import Any, Optional

from app.integrations.evidence_source import clean_search_term, evidence_grade_rank, grade_evidence
from app.integrations.pubmed import search_pubmed
from app.integrations.europepmc import search_europepmc
from app.integrations.who import search_who
from app.rag.citation_tracker import _split_sentences_for_citation

#: PubMed publication-type field tags and Europe PMC PUB_TYPE values that
#: signal structured clinical guidance rather than a primary research paper.
_GUIDELINE_PUBLICATION_TYPES = (
    "guideline", "practice guideline", "consensus development conference",
    "systematic review", "meta-analysis",
)
#: Only guidelines from roughly the last decade are worth surfacing as
#: current practice - older guidance is superseded often enough in clinical
#: medicine that presenting it as "the" comparison reference would mislead.
_MIN_GUIDELINE_YEAR = 2015

#: Guideline selection is cached longer than the 1h TTL general evidence
#: search uses (evidence_source.TTLCache) - which guideline governs a given
#: clinical topic changes on the order of years, not hours, and re-running
#: two provider searches on every comparison-panel open is wasted latency.
_GUIDELINE_CACHE_TTL = 24 * 3600
_guideline_cache: dict[str, tuple[float, Optional[dict[str, Any]]]] = {}


def _cache_get(key: str) -> tuple[bool, Optional[dict[str, Any]]]:
    entry = _guideline_cache.get(key)
    if entry is None:
        return False, None
    ts, value = entry
    if time.time() - ts > _GUIDELINE_CACHE_TTL:
        _guideline_cache.pop(key, None)
        return False, None
    return True, value


def _cache_set(key: str, value: Optional[dict[str, Any]]) -> None:
    _guideline_cache[key] = (time.time(), value)


def _is_guideline_type(record: dict[str, Any]) -> bool:
    study_type = (record.get("study_type") or "").lower()
    pub_types = [str(p).lower() for p in (record.get("pub_types") or [])]
    return "guideline" in study_type or any("guideline" in p for p in pub_types)


def _selection_key(record: dict[str, Any]) -> tuple:
    """Ranks candidates for "the one guideline to compare against": a
    genuine guideline-typed document first, then evidence grade, then
    recency. Ties broken deterministically (title) so selection doesn't
    depend on provider response order."""
    return (
        _is_guideline_type(record),
        evidence_grade_rank(record),
        record.get("pub_date_parsed") or "0000-00-00",
        record.get("title") or "",
    )


def _meets_min_year(record: dict[str, Any], min_year: int) -> bool:
    """WHO IRIS has no server-side date filter (see search_who), so unlike
    PubMed/Europe PMC this is applied client-side after the search. A record
    with no parseable date is kept rather than dropped - an unparseable
    date is missing information, not evidence the document is old."""
    parsed = record.get("pub_date_parsed") or ""
    year = parsed[:4]
    return not year.isdigit() or int(year) >= min_year


async def find_guideline(topic: str, min_year: int = _MIN_GUIDELINE_YEAR) -> Optional[dict[str, Any]]:
    """Search PubMed + Europe PMC + WHO IRIS for a real guideline document on
    `topic`, return the single best candidate (or None if nothing
    qualifies). Never raises - provider failures degrade to "no guideline
    found", the same outcome as a genuine empty result
    (routes_comparison.py distinguishes these at the reason_code level, not
    here).

    WHO IRIS has no publication-type/date field filter the way PubMed/
    Europe PMC do (search_who takes no such parameters - see who.py), so its
    candidates rely entirely on the post-hoc _is_guideline_type/
    grade_evidence scoring below to keep non-guideline IRIS content
    (technical reports, regional bulletins - the bulk of the repository,
    per who.py's own docstring) from ever winning selection over a real
    guideline-typed candidate from another source."""
    topic = (topic or "").strip()
    if not topic:
        return None

    cache_key = f"{topic.lower()}|{min_year}"
    hit, cached = _cache_get(cache_key)
    if hit:
        return cached

    # preserve_domain_terms=True: keep "guideline"/"protocol" in the search
    # term, since this call is specifically hunting for one - the opposite
    # of the default (evidence_registry.search_all strips those words
    # because they're noise for a general clinical-fact search).
    api_term = clean_search_term(topic, preserve_domain_terms=True)

    candidates: list[dict[str, Any]] = []
    try:
        pubmed_records = await search_pubmed(
            api_term, max_results=10,
            publication_types=_GUIDELINE_PUBLICATION_TYPES, min_year=min_year,
        )
        candidates.extend(pubmed_records)
    except Exception:
        pass
    try:
        europepmc_records = await search_europepmc(
            api_term, max_results=10,
            publication_types=_GUIDELINE_PUBLICATION_TYPES, min_year=min_year,
        )
        candidates.extend(europepmc_records)
    except Exception:
        pass
    try:
        who_records = await search_who(api_term, max_results=10)
        candidates.extend(r for r in who_records if _meets_min_year(r, min_year))
    except Exception:
        pass

    if not candidates:
        _cache_set(cache_key, None)
        return None

    for r in candidates:
        r["evidence_grade"] = grade_evidence(r)

    best = max(candidates, key=_selection_key)
    _cache_set(cache_key, best)
    return best


async def get_guideline_text(guideline: dict[str, Any]) -> tuple[str, str]:
    """The text to run extract_recommendations against, plus an honest
    label for where it came from: ("full_text", text) when a real, freely-
    available full document was fetched, ("abstract", text) when that
    wasn't possible and the pre-existing abstract-only behavior is used
    instead - never a silent guess at which happened.

    Three independent full-text paths are tried, in order, stopping at the
    first that actually yields usable text - each is a real, verified-live
    discovery mechanism (see this module's docstring), never a guess:
    1. Europe PMC candidates already carry full_text_url/full_text_style
       from the search response itself (no extra call).
    2. PubMed candidates (source_type == "pubmed", carrying a pmid) are
       checked against their PMC mirror, one extra elink call.
    3. WHO candidates (source_type == "who", carrying item_uuid) are
       checked against IRIS's bitstream chain, two extra calls.
    A candidate only ever matches one of these three shapes, so trying all
    three in sequence is not redundant work - it is a plain if/elif/elif
    dispatch on which provider produced this particular guideline dict.
    fetch_full_text already never raises and returns None on any failure
    (network, oversized, too little extracted text), so this function
    can't raise either - a failed fetch just falls through to the next
    path, and a failure on every path falls through to the abstract, the
    same outcome as never having attempted one."""
    from app.services.fulltext_fetch import fetch_full_text

    full_text_url = guideline.get("full_text_url") or ""
    full_text_style = guideline.get("full_text_style") or ""
    if full_text_url and full_text_style:
        text = await fetch_full_text(full_text_url, full_text_style)
        if text:
            return "full_text", text

    if guideline.get("source_type") == "pubmed" and guideline.get("pmid"):
        from app.integrations.pubmed import get_pmc_full_text_link

        pmc_url, pmc_style = await get_pmc_full_text_link(guideline["pmid"])
        if pmc_url:
            text = await fetch_full_text(pmc_url, pmc_style)
            if text:
                return "full_text", text

    if guideline.get("source_type") == "who" and guideline.get("item_uuid"):
        from app.integrations.who import get_iris_full_text_link

        pdf_url = await get_iris_full_text_link(guideline["item_uuid"])
        if pdf_url:
            text = await fetch_full_text(pdf_url, "pdf")
            if text:
                return "full_text", text

    return "abstract", guideline.get("abstract", "")


#: A recommendation sentence either states a directive (what to do) or
#: carries a concrete clinical quantity (a dose, threshold, or timeframe) -
#: the two shapes of sentence worth extracting from an abstract as a
#: comparable "reference step". Purely descriptive background/methods
#: sentences (what follows _BOILERPLATE_PREFIXES) carry neither.
_DIRECTIVE_RE = re.compile(
    r"\b(should|recommend(?:s|ed|ation)?|must|advis(?:e|ed|es)|initiat(?:e|ed|ion)|"
    r"administer(?:ed)?|obtain(?:ed)?|measure(?:d)?|target(?:ed)?|avoid(?:ed)?|"
    r"do not|consider(?:ed)?|monitor(?:ed)?|maintain(?:ed)?)\b",
    re.IGNORECASE,
)
_QUANTITY_RE = re.compile(
    r"\d+(\.\d+)?\s*(mg|mcg|g|mL|L|mmHg|mmol|kg|%|hour|hr|min|minute|day|week)s?\b",
    re.IGNORECASE,
)
_BOILERPLATE_PREFIXES = (
    "objective:", "objectives:", "background:", "methods:", "method:",
    "design:", "setting:", "participants:", "results:", "conclusion:",
    "conclusions:", "purpose:", "introduction:", "we searched", "we reviewed",
    "this review", "this guideline", "this document", "this article",
)
_MAX_RECOMMENDATIONS = 12


def extract_recommendations(text: str, locus_label: str = "Abstract") -> list[dict[str, Any]]:
    """Extract candidate recommendation sentences from guideline text - the
    substance of "real sentences from the right guideline" rather than
    comparing against a bare title.

    `text` is whatever get_guideline_text resolved (full document or
    abstract-only) - this function itself doesn't care which, it just
    extracts sentences. `locus_label` is what actually discloses the
    provenance honestly on every returned item's `source_locus`
    ("Full text, sentence N" vs "Abstract, sentence N"), so a caller who
    got real full text can't be silently mistaken for one that only ever
    saw an abstract, and vice versa. Defaults to "Abstract" so any
    pre-existing caller that only ever passed an abstract keeps identical
    output without changes."""
    text = (text or "").strip()
    if not text:
        return []

    sentences = _split_sentences_for_citation(text)
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for i, sent in enumerate(sentences):
        normalized = sent.strip().rstrip(".")
        lower = normalized.lower()
        if any(lower.startswith(p) for p in _BOILERPLATE_PREFIXES):
            continue
        if not (_DIRECTIVE_RE.search(sent) or _QUANTITY_RE.search(sent)):
            continue
        dedup_key = re.sub(r"\s+", " ", lower)
        if dedup_key in seen or len(normalized) < 15:
            continue
        seen.add(dedup_key)
        out.append({
            "text": normalized,
            "fidelity": "verbatim",
            "source_locus": f"{locus_label}, sentence {i + 1}",
        })
        if len(out) >= _MAX_RECOMMENDATIONS:
            break
    return out
