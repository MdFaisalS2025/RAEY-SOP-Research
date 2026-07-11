"""
Meridian ClinicalTrials.gov Integration
------------------------------------------
Surfaces what is actively being studied for a condition/drug - complements
retrospective literature (PubMed/Europe PMC) with in-progress and recently
completed trials, which are often the leading edge of "most recent evidence".
Free public REST API v2, no API key required.
Docs: https://clinicaltrials.gov/data-api/api

Known limitation: clinicaltrials.gov currently returns 403 to some non-browser
HTTP clients (TLS-fingerprint-based bot mitigation, not header/UA based - a
plain curl request succeeds where an identical httpx request with the same
headers does not). This is outside our control; per the EvidenceSource
contract this degrades to [] rather than raising, so a blocked source just
doesn't contribute results instead of breaking the page.

Research prototype. Not for clinical use.
"""

import logging
from typing import Any

import httpx

from app.integrations.evidence_source import DEFAULT_HEADERS, EvidenceSource, TTLCache, parse_pub_date

logger = logging.getLogger(__name__)

_BASE = "https://clinicaltrials.gov/api/v2/studies"
_TIMEOUT = 6.0
_cache = TTLCache(ttl_seconds=3600)


def _parse_study(study: dict[str, Any]) -> dict[str, Any]:
    protocol = study.get("protocolSection") or {}
    ident = protocol.get("identificationModule") or {}
    status = protocol.get("statusModule") or {}
    sponsor = (protocol.get("sponsorCollaboratorsModule") or {}).get("leadSponsor") or {}

    nct_id = ident.get("nctId", "")
    pub_date = ((status.get("lastUpdatePostDateStruct") or {}).get("date")
                or (status.get("startDateStruct") or {}).get("date") or "")
    overall_status = status.get("overallStatus", "")

    return {
        "title": (ident.get("briefTitle") or "").strip(),
        "authors": (sponsor.get("name") or "").strip(),
        "journal": "ClinicalTrials.gov",
        "pub_date": pub_date,
        "pub_date_parsed": parse_pub_date(pub_date),
        "pmid": nct_id,
        "url": f"https://clinicaltrials.gov/study/{nct_id}" if nct_id else "https://clinicaltrials.gov",
        "source_type": "clinicaltrials",
        "pub_types": [overall_status] if overall_status else [],
        "study_type": overall_status.replace("_", " ").title() or "Clinical Trial",
    }


async def search_clinicaltrials(term: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search ClinicalTrials.gov for `term`. Returns [] on empty term or ANY failure."""
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
                    "query.term": term,
                    "pageSize": max_results,
                    "sort": "LastUpdatePostDate:desc",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            studies = data.get("studies") or []
            records = [_parse_study(s) for s in studies[:max_results]]
        _cache.set(cache_key, records)
        return records
    except Exception as e:  # noqa: BLE001 - deliberately swallow all failures
        logger.warning(f"ClinicalTrials.gov lookup failed for term '{term}': {e}")
        return []


class ClinicalTrialsSource(EvidenceSource):
    source_type = "clinicaltrials"
    display_name = "ClinicalTrials.gov"

    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        return await search_clinicaltrials(term, max_results=max_results)
