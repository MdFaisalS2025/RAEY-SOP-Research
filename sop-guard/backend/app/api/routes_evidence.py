"""
SOP-Guard Evidence Routes (Evidence Watch)
------------------------------------------
Live PubMed literature lookup via NCBI E-utilities.
Research prototype  - NOT for clinical use.
"""

from fastapi import APIRouter, Query

from app.integrations.pubmed import search_pubmed

router = APIRouter(tags=["Evidence"])


@router.get("/api/evidence/pubmed")
async def evidence_pubmed(
    term: str = Query(..., description="Search term, e.g. a drug or condition."),
    max: int = Query(5, ge=1, le=20, description="Max number of results."),
):
    """
    Search PubMed for recent literature on `term`.
    Returns [] gracefully on any upstream failure (never 500).
    """
    records = await search_pubmed(term, max_results=max)
    return {
        "term": term,
        "count": len(records),
        "source": "pubmed",
        "disclaimer": "Research prototype. Live PubMed results are not clinical guidance.",
        "results": records,
    }
