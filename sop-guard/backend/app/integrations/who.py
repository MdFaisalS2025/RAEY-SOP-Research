"""
Meridian WHO Guidelines Integration
--------------------------------------
Live WHO guideline/publication search via the WHO IRIS institutional
repository's public DSpace REST API (free, no API key required).
Docs: https://iris.who.int (DSpace 7 "server/api/discover" search endpoint).

WHO does not publish a stable, versioned search API the way NCBI/EBI do -
this integration is best-effort and, like every EvidenceSource, degrades to
[] on any shape mismatch or failure rather than raising.

Research prototype. Not for clinical use.
"""

import logging
from typing import Any

import httpx

from app.integrations.evidence_source import DEFAULT_HEADERS, EvidenceSource, TTLCache, parse_pub_date

logger = logging.getLogger(__name__)

_BASE = "https://iris.who.int/server/api/discover/search/objects"
_TIMEOUT = 6.0
_cache = TTLCache(ttl_seconds=3600)


def _first_value(metadata: dict[str, Any], key: str) -> str:
    entries = metadata.get(key) or []
    if entries and isinstance(entries, list):
        return (entries[0].get("value") or "").strip()
    return ""


def _parse_object(obj: dict[str, Any]) -> dict[str, Any]:
    indexable = ((obj.get("_embedded") or {}).get("indexableObject") or {})
    metadata = indexable.get("metadata") or {}
    handle = indexable.get("handle") or ""
    pub_date = _first_value(metadata, "dc.date.issued")

    return {
        "title": _first_value(metadata, "dc.title"),
        "authors": _first_value(metadata, "dc.contributor.author") or "World Health Organization",
        "journal": "WHO IRIS",
        "pub_date": pub_date,
        "pub_date_parsed": parse_pub_date(pub_date),
        "pmid": handle,
        "url": f"https://iris.who.int/handle/{handle}" if handle else "https://iris.who.int",
        "source_type": "who",
        "pub_types": [],
        "study_type": "Guideline",
    }


async def search_who(term: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search WHO IRIS for `term`. Returns [] on empty term or ANY failure."""
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
                # No sort override - see pubmed.py's comment on the same
                # change; forcing date-descending on a small result size
                # surfaced unrelated recent WHO reports (e.g. regional
                # annual reports) ahead of topically relevant guidelines.
                params={"query": term, "size": max_results},
            )
            resp.raise_for_status()
            data = resp.json()
            objects = (
                (((data.get("_embedded") or {}).get("searchResult") or {}).get("_embedded") or {}).get("objects")
                or []
            )
            records = [_parse_object(o) for o in objects[:max_results]]
            records = [r for r in records if r["title"]]
        _cache.set(cache_key, records)
        return records
    except Exception as e:  # noqa: BLE001 - deliberately swallow all failures
        logger.warning(f"WHO lookup failed for term '{term}': {e}")
        return []


class WHOSource(EvidenceSource):
    source_type = "who"
    display_name = "WHO Guidelines"

    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        return await search_who(term, max_results=max_results)
