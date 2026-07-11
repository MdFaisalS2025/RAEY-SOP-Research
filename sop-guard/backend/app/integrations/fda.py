"""
Meridian FDA (openFDA) Integration
------------------------------------
Drug label / safety-communication lookup via the free openFDA API (no key
required for the low-volume traffic this prototype generates). Relevant to
SOPs covering dosing, contraindications, and drug safety.
Docs: https://open.fda.gov/apis/drug/label/

Same "never raise, cache, timeout" pattern as pubmed.py / europepmc.py.

Research prototype. Not for clinical use.
"""

import logging
from typing import Any

import httpx

from app.integrations.evidence_source import DEFAULT_HEADERS, EvidenceSource, TTLCache, parse_pub_date

logger = logging.getLogger(__name__)

_BASE = "https://api.fda.gov/drug/label.json"
_TIMEOUT = 6.0
_cache = TTLCache(ttl_seconds=3600)


def _parse_result(doc: dict[str, Any]) -> dict[str, Any]:
    openfda = doc.get("openfda") or {}
    brand = (openfda.get("brand_name") or [""])[0]
    generic = (openfda.get("generic_name") or [""])[0]
    title = brand or generic or "FDA Drug Label"
    if brand and generic and brand.lower() != generic.lower():
        title = f"{brand} ({generic})"
    pub_date = (doc.get("effective_time") or "").strip()
    set_id = doc.get("set_id") or doc.get("id") or ""
    return {
        "title": f"{title} - Prescribing Information",
        "authors": "U.S. Food and Drug Administration",
        "journal": "FDA Drug Label",
        "journal_display_name": "FDA",
        "trust_tier": 1,
        "pub_date": pub_date,
        "pub_date_parsed": parse_pub_date(pub_date),
        "pmid": "",
        # DailyMed (NLM) is the real, stable public host for FDA structured
        # product labels keyed by the same set_id openFDA returns - there is
        # no public "labels.fda.gov" host.
        "url": f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={set_id}" if set_id else "https://www.fda.gov",
        "source_type": "fda",
        "pub_types": ["Regulatory Label"],
        "study_type": "Regulatory Guidance",
        "warnings": (doc.get("warnings") or doc.get("boxed_warning") or [""])[0][:400],
        "contraindications": (doc.get("contraindications") or [""])[0][:400],
    }


async def search_fda(term: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search FDA drug labels for `term`. Returns [] on empty term or ANY failure."""
    term = (term or "").strip()
    if not term:
        return []
    max_results = max(1, min(int(max_results or 5), 20))

    cache_key = f"{term.lower()}|{max_results}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=DEFAULT_HEADERS) as client:
            resp = await client.get(
                _BASE,
                params={
                    "search": f'openfda.generic_name:"{term}" OR openfda.brand_name:"{term}" OR indications_and_usage:"{term}"',
                    "limit": max_results,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            docs = data.get("results") or []
            records = [_parse_result(d) for d in docs[:max_results]]
        _cache.set(cache_key, records)
        return records
    except Exception as e:  # noqa: BLE001 - deliberately swallow all failures (incl. openFDA's 404-on-no-results)
        logger.warning(f"FDA lookup failed for term '{term}': {e}")
        return []


class FDASource(EvidenceSource):
    source_type = "fda"
    display_name = "FDA"

    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        return await search_fda(term, max_results=max_results)
