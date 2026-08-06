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


def _study_type_for(design: dict[str, Any]) -> str:
    """`overallStatus` (recruitment status: Recruiting/Completed/...) is not
    a study design and grading a trial's design off it was wrong - it put
    "Recruiting"/"Completed" in the same column real study designs occupy.
    designModule.studyType + designInfo.allocation are the API's actual
    design fields; derive from those instead, matching
    grade_evidence's _MODERATE_STUDY_TYPES vocabulary so an interventional
    RCT still grades Moderate and everything else falls through to the
    "clinicaltrials" source_type's Research Only default."""
    study_type = (design.get("studyType") or "").strip().upper()
    allocation = ((design.get("designInfo") or {}).get("allocation") or "").strip().upper()
    if study_type == "INTERVENTIONAL":
        return "Randomized Controlled Trial" if allocation == "RANDOMIZED" else "Clinical Trial"
    if study_type == "OBSERVATIONAL":
        return "Observational Study"
    return ""


def _parse_study(study: dict[str, Any]) -> dict[str, Any]:
    protocol = study.get("protocolSection") or {}
    ident = protocol.get("identificationModule") or {}
    status = protocol.get("statusModule") or {}
    design = protocol.get("designModule") or {}
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
        "study_type": _study_type_for(design),
        # Recruitment status (Recruiting/Completed/Terminated/...) - kept
        # separate from study_type now that the latter is a real design
        # classification. Not consumed by grade_evidence; available for
        # display so a card can still show "Recruiting" etc. without it
        # masquerading as a study design.
        "recruitment_status": overall_status.replace("_", " ").title(),
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
                    # No sort override - see pubmed.py's comment on the same
                    # change. The default relevance ranking matters more
                    # here than usual: with this endpoint already blocked
                    # for some requests (see module docstring), the few
                    # trials that do come through should be on-topic, not
                    # just "recently touched".
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
