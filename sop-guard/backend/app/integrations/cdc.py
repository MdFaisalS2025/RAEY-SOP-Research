"""
Meridian CDC Integration
--------------------------
Live CDC clinical/public-health guidance via the CDC Content Syndication
API (free, no API key required). High relevance for infection-control,
outbreak, and prevention SOPs.
Docs: https://tools.cdc.gov/api/v2/

Known limitation: the Content Syndication API only indexes content CDC has
explicitly tagged for syndication (widgets, campaign pages), not the full
CDC.gov guidance corpus - many clinical terms legitimately return zero
results even though matching CDC guidance exists on the site. Per the
EvidenceSource contract this degrades to [] rather than raising.

Research prototype. Not for clinical use.
"""

import logging
from typing import Any

import httpx

from app.integrations.evidence_source import DEFAULT_HEADERS, EvidenceSource, TTLCache, parse_pub_date

logger = logging.getLogger(__name__)

_BASE = "https://tools.cdc.gov/api/v2/resources/media"
_TIMEOUT = 6.0
_cache = TTLCache(ttl_seconds=3600)


#: The Content Syndication API's `type` field spans everything CDC tags
#: for syndication - real clinical guidance ("Guideline", "Recommendation")
#: alongside syndicated widgets, campaign pages, and images that carry no
#: clinical authority. Only the former should grade as a guideline; every
#: object was hardcoded "study_type": "Guideline" is checked against the
#: literal item type instead, so a syndication widget lands as "" (grades
#: "Unknown" via grade_evidence, correctly dropping below the Strong/
#: Moderate bar that selects guideline-comparison reference material)
#: rather than "Strong".
_GUIDELINE_TYPES = {"guideline", "recommendation", "guidance"}


def _study_type_for(item: dict[str, Any]) -> str:
    item_type = str(item.get("type") or "").strip().lower()
    return "Guideline" if item_type in _GUIDELINE_TYPES else ""


def _parse_item(item: dict[str, Any]) -> dict[str, Any]:
    pub_date = (item.get("dateOfSourceModification") or item.get("dateOfSourceCreation") or "").strip()
    url = item.get("sourceURL") or item.get("resourceURL") or "https://www.cdc.gov"
    return {
        "title": (item.get("title") or "").strip(),
        "authors": "CDC",
        "journal": "CDC.gov",
        "pub_date": pub_date,
        "pub_date_parsed": parse_pub_date(pub_date),
        "pmid": str(item.get("resourceId") or item.get("id") or ""),
        "url": url,
        "source_type": "cdc",
        "pub_types": [item.get("type")] if item.get("type") else [],
        "study_type": _study_type_for(item),
    }


async def search_cdc(term: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search CDC guidance content for `term`. Returns [] on empty term or ANY failure."""
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
                params={"q": term, "max": max_results},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("results") or []
            records = [_parse_item(i) for i in items[:max_results]]
        _cache.set(cache_key, records)
        return records
    except Exception as e:  # noqa: BLE001 - deliberately swallow all failures
        logger.warning(f"CDC lookup failed for term '{term}': {e}")
        return []


class CDCSource(EvidenceSource):
    source_type = "cdc"
    display_name = "CDC"

    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        return await search_cdc(term, max_results=max_results)
