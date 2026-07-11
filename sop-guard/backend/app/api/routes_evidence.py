"""
Meridian Evidence Routes (Evidence Watch)
------------------------------------------
Live external evidence lookup across multiple sources (PubMed, Europe PMC,
CDC, WHO, ClinicalTrials.gov) via the EvidenceSource registry.
Research prototype  - NOT for clinical use.
"""

from fastapi import APIRouter, Query

from app.integrations.pubmed import search_pubmed
from app.integrations.evidence_registry import search_all, source_names

router = APIRouter(tags=["Evidence"])


@router.get("/api/evidence/pubmed")
async def evidence_pubmed(
    term: str = Query(..., description="Search term, e.g. a drug or condition."),
    max: int = Query(5, ge=1, le=20, description="Max number of results."),
):
    """
    Search PubMed for recent literature on `term`.
    Returns [] gracefully on any upstream failure (never 500).
    Kept as a dedicated route for backward compatibility; prefer
    /api/evidence/search for multi-source, recency-sorted results.
    """
    records = await search_pubmed(term, max_results=max)
    return {
        "term": term,
        "count": len(records),
        "source": "pubmed",
        "disclaimer": "Research prototype. Live PubMed results are not clinical guidance.",
        "results": records,
    }


@router.get("/api/evidence/search")
async def evidence_search(
    term: str = Query(..., description="Search term, e.g. a drug or condition."),
    sources: str = Query(
        "",
        description="Comma-separated source names to search (default: all). "
        f"Available: {', '.join(source_names())}",
    ),
    max: int = Query(5, ge=1, le=20, description="Max results per source."),
):
    """
    Search across all registered external evidence sources for `term` and
    return the combined results sorted most-recent-first. Any individual
    source failure is swallowed (never 500) - a down source just contributes
    no results.
    """
    selected = [s.strip() for s in sources.split(",") if s.strip()] or None
    records = await search_all(term, sources=selected, max_results=max)
    return {
        "term": term,
        "count": len(records),
        "sources_queried": selected or source_names(),
        "disclaimer": "Research prototype. Live external evidence results are not clinical guidance.",
        "results": records,
    }
