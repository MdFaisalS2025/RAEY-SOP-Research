"""
SOP-Guard PubMed Integration (Evidence Watch)
---------------------------------------------
Live literature lookup via NCBI E-utilities (free, no API key required).
Flow: esearch.fcgi (find PMIDs) then esummary.fcgi (fetch metadata, JSON).

Design rules:
- Single esearch + single esummary call per query (be polite to NCBI).
- 6 second httpx timeout.
- On ANY failure (network, rate limit, parse) return [] and log a warning.
  This function never raises.
- Small in-memory TTL cache (1 hour) so repeated terms do not hammer NCBI.

Research prototype. Not for clinical use.
"""

import time
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
_TIMEOUT = 6.0
_TTL_SECONDS = 3600  # 1 hour

# term|max -> (timestamp, records)
_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def _cache_key(term: str, max_results: int) -> str:
    return f"{term.strip().lower()}|{max_results}"


def _cache_get(term: str, max_results: int) -> list[dict[str, Any]] | None:
    key = _cache_key(term, max_results)
    entry = _cache.get(key)
    if entry is None:
        return None
    ts, records = entry
    if time.time() - ts > _TTL_SECONDS:
        _cache.pop(key, None)
        return None
    return records


def _cache_set(term: str, max_results: int, records: list[dict[str, Any]]) -> None:
    _cache[_cache_key(term, max_results)] = (time.time(), records)


def _format_authors(author_list: list[dict[str, Any]] | None) -> str:
    """Turn the esummary author list into a compact 'Last F, Last F, et al' string."""
    if not author_list:
        return ""
    names = [a.get("name", "") for a in author_list if a.get("name")]
    if not names:
        return ""
    if len(names) > 3:
        return ", ".join(names[:3]) + ", et al"
    return ", ".join(names)


def _parse_summary(uid: str, doc: dict[str, Any]) -> dict[str, Any]:
    """Map a single esummary document to a normalized record."""
    pmid = str(doc.get("uid", uid))
    return {
        "title": (doc.get("title") or "").strip(),
        "authors": _format_authors(doc.get("authors")),
        "journal": (doc.get("fulljournalname") or doc.get("source") or "").strip(),
        "pub_date": (doc.get("pubdate") or "").strip(),
        "pmid": pmid,
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "source_type": "pubmed",
    }


def parse_esummary(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Parse an NCBI esummary JSON payload into normalized records.
    Kept separate so it can be unit tested without network access.
    """
    result = payload.get("result") or {}
    uids = result.get("uids") or []
    records: list[dict[str, Any]] = []
    for uid in uids:
        doc = result.get(uid)
        if isinstance(doc, dict):
            records.append(_parse_summary(uid, doc))
    return records


async def search_pubmed(term: str, max_results: int = 5) -> list[dict[str, Any]]:
    """
    Search PubMed for `term` and return up to `max_results` normalized records.

    Each record: title, authors, journal, pub_date, pmid, url, source_type.
    Returns [] on empty term or ANY failure. Never raises.
    """
    term = (term or "").strip()
    if not term:
        return []

    max_results = max(1, min(int(max_results or 5), 20))

    cached = _cache_get(term, max_results)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            # 1. esearch: term -> list of PMIDs
            esearch = await client.get(
                f"{_EUTILS_BASE}/esearch.fcgi",
                params={
                    "db": "pubmed",
                    "term": term,
                    "retmax": max_results,
                    "retmode": "json",
                    "sort": "relevance",
                },
            )
            esearch.raise_for_status()
            search_data = esearch.json()
            id_list = (
                search_data.get("esearchresult", {}).get("idlist", [])
            )
            if not id_list:
                _cache_set(term, max_results, [])
                return []

            # 2. esummary: PMIDs -> metadata
            esummary = await client.get(
                f"{_EUTILS_BASE}/esummary.fcgi",
                params={
                    "db": "pubmed",
                    "id": ",".join(id_list),
                    "retmode": "json",
                },
            )
            esummary.raise_for_status()
            records = parse_esummary(esummary.json())

        _cache_set(term, max_results, records)
        return records
    except Exception as e:  # noqa: BLE001 - deliberately swallow all failures
        logger.warning(f"PubMed lookup failed for term '{term}': {e}")
        return []
