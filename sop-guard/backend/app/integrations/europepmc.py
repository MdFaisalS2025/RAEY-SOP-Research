"""
Meridian Europe PMC Integration
--------------------------------
Broader biomedical literature coverage than PubMed alone (preprints, grants,
patents, PMC-only articles), same "never raise, cache, timeout" pattern as
pubmed.py. Free public REST API, no API key required.
Docs: https://europepmc.org/RestfulWebService

Research prototype. Not for clinical use.
"""

import logging
import re
from typing import Any

import httpx

from app.integrations.evidence_source import DEFAULT_HEADERS, EvidenceSource, TTLCache, parse_pub_date

logger = logging.getLogger(__name__)

_BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
_TIMEOUT = 6.0
_cache = TTLCache(ttl_seconds=3600)


_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _clean_abstract(text: str) -> str:
    """Europe PMC's resultType=core abstractText comes as structured HTML
    ('<h4>Background</h4>...<h4>Methods</h4>...') - strip the tags to plain
    prose and collapse the resulting whitespace so an evidence card never
    shows raw markup."""
    if not text:
        return ""
    stripped = _HTML_TAG_RE.sub(" ", text)
    return re.sub(r"\s+", " ", stripped).strip()


# Priority order (highest evidence grade first) for picking one study_type
# out of a record's (possibly multi-valued) real pubTypeList - matched
# against grade_evidence's own vocabulary so a genuine "Guideline" or
# "Meta-Analysis" tag actually grades Strong/Moderate instead of being
# discarded in favor of a hardcoded "Journal Article" that could never
# grade above Limited/Unknown regardless of what the record really was.
_PUB_TYPE_PRIORITY = [
    "Practice Guideline", "Guideline", "Meta-Analysis", "Systematic Review",
    "Randomized Controlled Trial", "Clinical Trial", "Case Reports",
]


def _study_type_from_pub_types(pub_types: list[str], is_preprint: bool) -> str:
    if is_preprint:
        return "Preprint"
    lowered = {str(p).strip().lower() for p in pub_types}
    for candidate in _PUB_TYPE_PRIORITY:
        if candidate.lower() in lowered:
            return candidate
    return ""


def _parse_result(doc: dict[str, Any]) -> dict[str, Any]:
    pub_date = (doc.get("firstPublicationDate") or doc.get("pubYear") or "").strip()
    pmid = doc.get("pmid") or doc.get("id") or ""
    doc_id = doc.get("id") or ""
    url = f"https://europepmc.org/article/{doc.get('source', 'MED')}/{doc_id}" if doc_id else "https://europepmc.org"
    pub_types = [doc.get("pubTypeList", {}).get("pubType", [])] if isinstance(doc.get("pubTypeList"), dict) else []
    pub_types_flat = pub_types[0] if pub_types else []
    is_preprint = doc.get("pubType") == "preprint"
    return {
        "title": (doc.get("title") or "").strip(),
        "authors": (doc.get("authorString") or "").strip(),
        "journal": (doc.get("journalTitle") or "").strip(),
        "pub_date": pub_date,
        "pub_date_parsed": parse_pub_date(pub_date),
        "pmid": str(pmid),
        "url": url,
        "source_type": "europepmc",
        "pub_types": pub_types_flat,
        "study_type": _study_type_from_pub_types(pub_types_flat, is_preprint),
        # Only present when resultType=core is requested (see search_europepmc)
        # - the default "lite" result type doesn't include it. Europe PMC is
        # the one source where this comes back in the same request, no
        # second call needed (contrast pubmed.py's separate efetch).
        "abstract": _clean_abstract(doc.get("abstractText") or ""),
    }


async def search_europepmc(
    term: str,
    max_results: int = 5,
    publication_types: tuple[str, ...] = (),
    min_year: int | None = None,
) -> list[dict[str, Any]]:
    """Search Europe PMC for `term`. Returns [] on empty term or ANY failure.

    `publication_types`/`min_year` append Europe PMC query-syntax clauses
    (`PUB_TYPE:"Guideline"`, `PUB_YEAR:[YYYY TO 3000]`) - used by
    guideline_finder.py to narrow toward structured guidance specifically.
    Both default to unset (no behavior change for existing callers)."""
    term = (term or "").strip()
    if not term:
        return []
    max_results = max(1, min(int(max_results or 5), 25))

    query = term
    if publication_types:
        pt_clause = " OR ".join(f'PUB_TYPE:"{pt}"' for pt in publication_types)
        query = f"{query} AND ({pt_clause})"
    if min_year:
        query = f"{query} AND PUB_YEAR:[{min_year} TO 3000]"

    cache_key = f"{term.lower()}|{max_results}|{','.join(publication_types)}|{min_year or ''}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=DEFAULT_HEADERS) as client:
            resp = await client.get(
                _BASE,
                params={
                    "query": query,
                    "format": "json",
                    "pageSize": max_results,
                    # "core" includes abstractText in the same response (vs.
                    # the default "lite" shape) - lets evidence cards show a
                    # real supporting excerpt instead of a bare title, with
                    # no second network call.
                    "resultType": "core",
                    # No sort override - see pubmed.py's comment on the same
                    # change. Europe PMC's default is relevance-ranked;
                    # forcing date-descending on a small page size surfaced
                    # recent-but-unrelated results ahead of on-topic ones.
                },
            )
            resp.raise_for_status()
            data = resp.json()
            docs = (data.get("resultList") or {}).get("result") or []
            records = [_parse_result(d) for d in docs[:max_results]]
        _cache.set(cache_key, records)
        return records
    except Exception as e:  # noqa: BLE001 - deliberately swallow all failures
        logger.warning(f"Europe PMC lookup failed for term '{term}': {e}")
        return []


class EuropePMCSource(EvidenceSource):
    source_type = "europepmc"
    display_name = "Europe PMC"

    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        return await search_europepmc(term, max_results=max_results)
