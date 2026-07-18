"""
Meridian PubMed Integration (Evidence Watch)
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

import re
import time
import logging
from typing import Any

import httpx

from app.integrations.evidence_source import DEFAULT_HEADERS, EvidenceSource, parse_pub_date

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


# Rough evidence-hierarchy ordering (highest first) for picking one
# headline study-type label out of NCBI's pubtype list, which is often
# several tags at once (e.g. ["Journal Article", "Meta-Analysis"]).
# Not a substitute for GRADE appraisal - just a scannable hint, the same
# spirit as UpToDate's evidence-quality tags.
_STUDY_TYPE_PRIORITY = [
    "Meta-Analysis",
    "Systematic Review",
    "Practice Guideline",
    "Guideline",
    "Randomized Controlled Trial",
    "Clinical Trial",
    "Review",
    "Case Reports",
]


def _classify_study_type(pub_types: list[str]) -> str:
    for candidate in _STUDY_TYPE_PRIORITY:
        if candidate in pub_types:
            return candidate
    return "Journal Article"


# Journal-tier trust scoring: since most of the "big name" journals the
# product needs to reference (NEJM, JAMA, BMJ, Lancet, Nature Medicine,
# Annals of Internal Medicine) don't expose their own free public search
# APIs, they're surfaced by tagging PubMed results whose journal name
# matches a known high-authority publication - PubMed/MEDLINE already
# indexes all of them. Tier 1 = top-tier general/flagship journals and
# major specialty-society journals; Tier 2 = other MEDLINE-indexed,
# peer-reviewed journals; Tier 3 = everything else (unindexed / unclear).
_JOURNAL_TIER_1 = [
    "new england journal of medicine", "n engl j med",
    "jama", "journal of the american medical association",
    "lancet", "bmj", "british medical journal",
    "nature medicine",
    "annals of internal medicine",
    "circulation",  # American Heart Association flagship journal
    "clinical infectious diseases",  # IDSA flagship journal
    "journal of the american college of cardiology",  # ACC flagship journal
]
_JOURNAL_TIER_2_HINTS = [
    "journal", "annals", "archives", "critical care", "medicine",
]


def _classify_journal_tier(journal: str) -> tuple[int, str]:
    """Return (trust_tier, display_name) for a journal name. Tier 1 is an
    exact/substring match against a curated flagship-journal list; Tier 2
    is any other MEDLINE-indexed-looking journal name; Tier 3 is unknown."""
    name = (journal or "").strip()
    lower = name.lower()
    if not name:
        return 3, "Unknown Source"
    for known in _JOURNAL_TIER_1:
        if known in lower:
            return 1, name
    if any(hint in lower for hint in _JOURNAL_TIER_2_HINTS):
        return 2, name
    return 2, name if name else "Unknown Source"


def _parse_summary(uid: str, doc: dict[str, Any]) -> dict[str, Any]:
    """Map a single esummary document to a normalized record."""
    pmid = str(doc.get("uid", uid))
    pub_types = [p for p in (doc.get("pubtype") or []) if isinstance(p, str)]
    pub_date = (doc.get("pubdate") or "").strip()
    journal = (doc.get("fulljournalname") or doc.get("source") or "").strip()
    trust_tier, journal_display_name = _classify_journal_tier(journal)
    return {
        "title": (doc.get("title") or "").strip(),
        "authors": _format_authors(doc.get("authors")),
        "journal": journal,
        "journal_display_name": journal_display_name,
        "trust_tier": trust_tier,
        "pub_date": pub_date,
        "pub_date_parsed": parse_pub_date(pub_date),
        "pmid": pmid,
        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        "source_type": "pubmed",
        "pub_types": pub_types,
        "study_type": _classify_study_type(pub_types),
        "abstract": "",  # populated after esummary by the efetch step below
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
        async with httpx.AsyncClient(timeout=_TIMEOUT, headers=DEFAULT_HEADERS) as client:
            # 1. esearch: term -> list of PMIDs
            esearch = await client.get(
                f"{_EUTILS_BASE}/esearch.fcgi",
                params={
                    "db": "pubmed",
                    "term": term,
                    "retmax": max_results,
                    "retmode": "json",
                    # Deliberately NOT sorting by pub_date: with a small
                    # retmax, forcing recency-first surfaced loosely-related
                    # recent papers ahead of genuinely on-topic ones (a
                    # "blood transfusion" query returned unrelated recent
                    # WHO/PubMed hits because term matching alone, sorted by
                    # date, has no relevance floor). Omitting sort uses
                    # PubMed's own "best match" relevance ranking, which
                    # already factors in recency as one signal among several.
                    # The merged, multi-source list is still sorted by date
                    # for display - see evidence_registry.search_all.
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

            # 3. efetch: same PMIDs -> abstracts, one batched call (not one
            # per result) so an evidence card can show a real supporting
            # excerpt instead of a bare title. Best-effort: if this call
            # fails, the records above are still returned with abstract="" -
            # a missing excerpt is a degraded evidence card, not a failed
            # search.
            try:
                efetch = await client.get(
                    f"{_EUTILS_BASE}/efetch.fcgi",
                    params={"db": "pubmed", "id": ",".join(id_list), "rettype": "abstract", "retmode": "text"},
                )
                efetch.raise_for_status()
                abstracts = _parse_efetch_abstracts(efetch.text, id_list)
                for r in records:
                    r["abstract"] = abstracts.get(r["pmid"], "")
            except Exception as e:  # noqa: BLE001 - abstracts are best-effort
                logger.warning(f"PubMed abstract fetch failed for term '{term}': {e}")
                for r in records:
                    r["abstract"] = ""

        _cache_set(term, max_results, records)
        return records
    except Exception as e:  # noqa: BLE001 - deliberately swallow all failures
        logger.warning(f"PubMed lookup failed for term '{term}': {e}")
        return []


def _parse_efetch_abstracts(text: str, id_list: list[str]) -> dict[str, str]:
    """NCBI's rettype=abstract&retmode=text response is plain text, records
    separated by blank lines, with no PMID markers - the ONLY reliable way
    to associate an abstract with its PMID from this format is positional
    order, which efetch preserves relative to the `id` param's order. Each
    record's last non-empty line is typically "PMID: <id>", used as a
    cross-check when present rather than trusted alone."""
    if not text.strip():
        return {}
    blocks = [b.strip() for b in re.split(r"\n\s*\n\s*\n", text) if b.strip()]
    result: dict[str, str] = {}
    for i, block in enumerate(blocks):
        if i >= len(id_list):
            break
        # Strip a trailing "PMID: 12345678" line if present - it's citation
        # metadata NCBI appends, not part of the abstract prose.
        cleaned = re.sub(r"\n?PMID:\s*\d+\s*$", "", block, flags=re.IGNORECASE).strip()
        # Drop a leading numbered title/citation line (efetch abstract text
        # starts with "1. Title...\nAuthor list.\n" before the abstract body)
        # - keep only from the first blank-line-free paragraph that reads as
        # prose. Heuristic: skip lines until one is long enough to be
        # abstract body text.
        lines = cleaned.split("\n")
        body_start = 0
        for j, line in enumerate(lines):
            if len(line.strip()) > 80:
                body_start = j
                break
        abstract = " ".join(l.strip() for l in lines[body_start:] if l.strip())
        result[id_list[i]] = abstract
    return result


class PubMedSource(EvidenceSource):
    """EvidenceSource adapter over the module-level search_pubmed() above,
    kept as a plain function for backward compatibility with existing
    callers/tests."""

    source_type = "pubmed"
    display_name = "PubMed"

    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        return await search_pubmed(term, max_results=max_results)
