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
from app.integrations.openevidence import provider_status as openevidence_status

router = APIRouter(tags=["Evidence"])

#: Real, always-queryable sources (no API key, no "requires configuration"
#: story) - everything in the registry except the OpenEvidence placeholder,
#: which reports its own honest status via openevidence_status().
_ACTIVE_SOURCE_LABELS = {
    "pubmed": "PubMed", "europepmc": "Europe PMC", "cdc": "CDC", "who": "WHO",
    "clinicaltrials": "ClinicalTrials.gov", "fda": "FDA", "medlineplus": "MedlinePlus", "cms": "CMS",
}


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
    sort: str = Query("grade", description="'grade' (default - highest-rated evidence first) or 'recency'."),
):
    """
    Search across all registered external evidence sources for `term` and
    return the combined results, ranked by evidence grade (Strong/Moderate
    study types and Tier-1/2 journals first) by default so the highest-
    quality sources aren't buried under a pile of recent low-grade noise;
    pass sort=recency for the old chronological ordering. Any individual
    source failure is swallowed (never 500) - a down source just contributes
    no results.
    """
    selected = [s.strip() for s in sources.split(",") if s.strip()] or None
    sort_by = "recency" if sort == "recency" else "grade"
    records = await search_all(term, sources=selected, max_results=max, sort_by=sort_by)
    return {
        "term": term,
        "count": len(records),
        "sources_queried": selected or source_names(),
        "sorted_by": sort_by,
        "disclaimer": "Research prototype. Live external evidence results are not clinical guidance.",
        "results": records,
    }


@router.get("/api/evidence/providers")
async def evidence_providers():
    """Honest status for every evidence source, real or placeholder - used
    by the Evidence Drawer's provider list instead of a hardcoded "coming
    soon" chip. Real sources need no key and are always "active"; only
    OpenEvidence reports a configuration-dependent status."""
    providers = [
        {
            "key": key, "name": label, "status": "active",
            "capabilities": ["live search"], "requires": [], "notes": "",
        }
        for key, label in _ACTIVE_SOURCE_LABELS.items()
    ]
    providers.append(openevidence_status())
    return {"providers": providers}
