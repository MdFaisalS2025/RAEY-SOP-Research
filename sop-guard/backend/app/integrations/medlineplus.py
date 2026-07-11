"""
Meridian MedlinePlus Integration
------------------------------------
Consumer/clinician-grade health topic summaries via the free NLM MedlinePlus
Web Service (no key required). Useful as a grounded fallback when a query
has no matching internal SOP and no primary-literature hit either - general
authoritative guidance rather than silence.
Docs: https://medlineplus.gov/webservices.html

Same "never raise, cache, timeout" pattern as pubmed.py / europepmc.py.
Response format is XML, parsed with the stdlib.

Research prototype. Not for clinical use.
"""

import logging
from typing import Any
from xml.etree import ElementTree

import httpx

from app.integrations.evidence_source import DEFAULT_HEADERS, EvidenceSource, TTLCache

logger = logging.getLogger(__name__)

_BASE = "https://wsearch.nlm.nih.gov/ws/query"
_TIMEOUT = 6.0
_cache = TTLCache(ttl_seconds=3600)


def _text_of(document: ElementTree.Element, content_name: str) -> str:
    for content in document.findall("content"):
        if content.get("name") == content_name:
            text = "".join(content.itertext()).strip()
            return text
    return ""


def parse_medlineplus_xml(raw: bytes | str) -> list[dict[str, Any]]:
    """Parse a MedlinePlus wsearch XML payload into normalized records.
    Kept separate so it can be unit tested without network access."""
    root = ElementTree.fromstring(raw)
    records: list[dict[str, Any]] = []
    for doc in root.findall(".//document"):
        title = _text_of(doc, "title")
        summary = _text_of(doc, "FullSummary") or _text_of(doc, "snippet")
        url = doc.get("url") or f"https://medlineplus.gov/search.html?query={title.replace(' ', '+')}"
        if not title:
            continue
        records.append({
            "title": title,
            "authors": "National Library of Medicine",
            "journal": "MedlinePlus",
            "journal_display_name": "MedlinePlus (NLM)",
            "trust_tier": 2,
            "pub_date": "",
            "pub_date_parsed": None,
            "pmid": "",
            "url": url,
            "source_type": "medlineplus",
            "pub_types": ["Consumer Health Summary"],
            "study_type": "Reference Summary",
            "summary": summary[:400],
        })
    return records


async def search_medlineplus(term: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search MedlinePlus health topics for `term`. Returns [] on empty term or ANY failure."""
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
                params={"db": "healthTopics", "term": term, "retmax": max_results},
            )
            resp.raise_for_status()
            records = parse_medlineplus_xml(resp.content)[:max_results]
        _cache.set(cache_key, records)
        return records
    except Exception as e:  # noqa: BLE001 - deliberately swallow all failures
        logger.warning(f"MedlinePlus lookup failed for term '{term}': {e}")
        return []


class MedlinePlusSource(EvidenceSource):
    source_type = "medlineplus"
    display_name = "MedlinePlus"

    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        return await search_medlineplus(term, max_results=max_results)
