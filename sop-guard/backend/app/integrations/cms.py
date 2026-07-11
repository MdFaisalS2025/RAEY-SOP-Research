"""
Meridian CMS Integration
------------------------------------
Regulatory/coverage-policy dataset lookup via the free CMS open-data catalog
(no key required). CMS does not expose a keyword-search API the way PubMed
does - data.cms.gov publishes a static DCAT catalog (data.json) of all
public datasets - so this source fetches that catalog (cached for longer,
it changes infrequently) and does a client-side substring match on dataset
title/description. Real data, honestly-scoped integration: a catalog
lookup, not a full-text search engine.
Docs: https://data.cms.gov/

Same "never raise, timeout" pattern as pubmed.py / europepmc.py.

Research prototype. Not for clinical use.
"""

import logging
from typing import Any

import httpx

from app.integrations.evidence_source import DEFAULT_HEADERS, EvidenceSource, TTLCache

logger = logging.getLogger(__name__)

_BASE = "https://data.cms.gov/data.json"
_TIMEOUT = 6.0
# The catalog changes rarely - cache far longer than the literature sources.
_cache = TTLCache(ttl_seconds=6 * 3600)
_CATALOG_CACHE_KEY = "__catalog__"


def _parse_dataset(doc: dict[str, Any]) -> dict[str, Any]:
    title = (doc.get("title") or "").strip()
    modified = (doc.get("modified") or "").strip()
    landing_page = doc.get("landingPage") or (doc.get("distribution") or [{}])[0].get("accessURL", "")
    return {
        "title": title,
        "authors": "Centers for Medicare & Medicaid Services",
        "journal": "CMS Open Data",
        "journal_display_name": "CMS",
        "trust_tier": 1,
        "pub_date": modified,
        "pub_date_parsed": modified[:10] if modified else None,
        "pmid": "",
        "url": landing_page or "https://data.cms.gov",
        "source_type": "cms",
        "pub_types": ["Regulatory Dataset"],
        "study_type": "Regulatory Guidance",
        "summary": (doc.get("description") or "")[:400],
    }


async def _fetch_catalog() -> list[dict[str, Any]]:
    cached = _cache.get(_CATALOG_CACHE_KEY)
    if cached is not None:
        return cached
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=DEFAULT_HEADERS) as client:
        resp = await client.get(_BASE)
        resp.raise_for_status()
        data = resp.json()
    datasets = data.get("dataset") or []
    _cache.set(_CATALOG_CACHE_KEY, datasets)
    return datasets


async def search_cms(term: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search the CMS open-data catalog for `term` in dataset title/description.
    Returns [] on empty term or ANY failure."""
    term = (term or "").strip()
    if not term:
        return []
    max_results = max(1, min(int(max_results or 5), 20))
    needle = term.lower()

    try:
        datasets = await _fetch_catalog()
        matches = [
            d for d in datasets
            if needle in (d.get("title") or "").lower() or needle in (d.get("description") or "").lower()
        ]
        records = [_parse_dataset(d) for d in matches[:max_results]]
        return records
    except Exception as e:  # noqa: BLE001 - deliberately swallow all failures
        logger.warning(f"CMS catalog lookup failed for term '{term}': {e}")
        return []


class CMSSource(EvidenceSource):
    source_type = "cms"
    display_name = "CMS"

    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        return await search_cms(term, max_results=max_results)
