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
from typing import Any

import httpx

from app.integrations.evidence_source import DEFAULT_HEADERS, EvidenceSource, TTLCache, parse_pub_date

logger = logging.getLogger(__name__)

_BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
_TIMEOUT = 6.0
_cache = TTLCache(ttl_seconds=3600)


def _parse_result(doc: dict[str, Any]) -> dict[str, Any]:
    pub_date = (doc.get("firstPublicationDate") or doc.get("pubYear") or "").strip()
    pmid = doc.get("pmid") or doc.get("id") or ""
    doc_id = doc.get("id") or ""
    url = f"https://europepmc.org/article/{doc.get('source', 'MED')}/{doc_id}" if doc_id else "https://europepmc.org"
    pub_types = [doc.get("pubTypeList", {}).get("pubType", [])] if isinstance(doc.get("pubTypeList"), dict) else []
    pub_types_flat = pub_types[0] if pub_types else []
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
        "study_type": "Preprint" if doc.get("pubType") == "preprint" else "Journal Article",
    }


async def search_europepmc(term: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search Europe PMC for `term`. Returns [] on empty term or ANY failure."""
    term = (term or "").strip()
    if not term:
        return []
    max_results = max(1, min(int(max_results or 5), 25))

    cache_key = f"{term.lower()}|{max_results}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=DEFAULT_HEADERS) as client:
            resp = await client.get(
                _BASE,
                params={
                    "query": term,
                    "format": "json",
                    "pageSize": max_results,
                    "sort": "P_PDATE_D desc",
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
