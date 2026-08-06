"""
Meridian Guideline Finder (Phase Q3.1/Q3.2)
--------------------------------------------
Retrieves a real, published guideline document for an SOP's topic and
extracts real recommendation sentences from its abstract - the online
alternative to sop_comparison.py's hand-transcribed REFERENCE_PROTOCOLS,
built on the existing EvidenceSource registry (no new providers).

Two things this deliberately does NOT do:
- Parse full guideline text (PDF/HTML). Only the abstract is available from
  any of these APIs' summary endpoints - see extract_recommendations'
  docstring for how that's disclosed rather than presented as complete
  coverage.
- Replace the general evidence search used elsewhere (Evidence Watch, the
  answer pipeline's external-evidence route). This module always opts into
  guideline-specific behavior (preserve_domain_terms, publication-type
  filters, a longer cache TTL) via explicit parameters - it never changes
  clean_search_term's or search_pubmed/search_europepmc's default behavior
  for any other caller.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import re
import time
from typing import Any, Optional

from app.integrations.evidence_source import clean_search_term, evidence_grade_rank, grade_evidence
from app.integrations.pubmed import search_pubmed
from app.integrations.europepmc import search_europepmc
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


async def find_guideline(topic: str, min_year: int = _MIN_GUIDELINE_YEAR) -> Optional[dict[str, Any]]:
    """Search PubMed + Europe PMC for a real guideline document on `topic`,
    return the single best candidate (or None if nothing qualifies). Never
    raises - provider failures degrade to "no guideline found", the same
    outcome as a genuine empty result (routes_comparison.py distinguishes
    these at the reason_code level, not here)."""
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

    if not candidates:
        _cache_set(cache_key, None)
        return None

    for r in candidates:
        r["evidence_grade"] = grade_evidence(r)

    best = max(candidates, key=_selection_key)
    _cache_set(cache_key, best)
    return best


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


def extract_recommendations(abstract_text: str) -> list[dict[str, Any]]:
    """Extract candidate recommendation sentences from a guideline's
    abstract - the substance of "real sentences from the right guideline"
    rather than comparing against a bare title.

    Deliberate scope limit, disclosed via `fidelity`/`source_locus` on
    every returned item: this reads the ABSTRACT only. No provider used
    here (PubMed, Europe PMC) exposes full guideline text through its
    summary API - getting the complete document would mean parsing a PDF
    or HTML page per source, which is real integration work each guideline
    publisher would need its own scraper for for (the same reason
    sop_comparison.py's REFERENCE_PROTOCOLS module docstring gives for not
    building one). An abstract-derived recommendation is real, verbatim
    text from the actual retrieved guideline - just not the whole of it,
    and every item says so."""
    abstract_text = (abstract_text or "").strip()
    if not abstract_text:
        return []

    sentences = _split_sentences_for_citation(abstract_text)
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
            "source_locus": f"Abstract, sentence {i + 1}",
        })
        if len(out) >= _MAX_RECOMMENDATIONS:
            break
    return out
