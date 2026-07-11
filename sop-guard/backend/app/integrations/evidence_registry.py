"""
Meridian Evidence Source Registry
------------------------------------
One place that knows about every EvidenceSource implementation. Adding a new
source (another literature API, a regional health authority, ...) means
writing one EvidenceSource subclass and registering it here - nothing else
in the app needs to change.

Research prototype. Not for clinical use.
"""

from typing import Any, Optional

from app.integrations.evidence_source import EvidenceSource, classify_stance
from app.integrations.pubmed import PubMedSource
from app.integrations.europepmc import EuropePMCSource
from app.integrations.cdc import CDCSource
from app.integrations.who import WHOSource
from app.integrations.clinicaltrials import ClinicalTrialsSource
from app.integrations.fda import FDASource
from app.integrations.medlineplus import MedlinePlusSource
from app.integrations.cms import CMSSource

_REGISTRY: dict[str, EvidenceSource] = {
    "pubmed": PubMedSource(),
    "europepmc": EuropePMCSource(),
    "cdc": CDCSource(),
    "who": WHOSource(),
    "clinicaltrials": ClinicalTrialsSource(),
    "fda": FDASource(),
    "medlineplus": MedlinePlusSource(),
    "cms": CMSSource(),
}


def get_source(name: str) -> Optional[EvidenceSource]:
    return _REGISTRY.get(name)


def all_sources() -> list[EvidenceSource]:
    return list(_REGISTRY.values())


def source_names() -> list[str]:
    return list(_REGISTRY.keys())


async def search_all(
    term: str,
    sources: Optional[list[str]] = None,
    max_results: int = 5,
) -> list[dict[str, Any]]:
    """Query the given sources (default: all registered) for `term` and
    return their combined records sorted most-recent-first. Unparseable
    dates sort last rather than raising or being dropped."""
    if sources:
        names = sources
    else:
        from app.services.app_settings import get_enabled_evidence_sources
        names = get_enabled_evidence_sources()
    combined: list[dict[str, Any]] = []
    for name in names:
        src = _REGISTRY.get(name)
        if src is None:
            continue
        records = await src.search(term, max_results=max_results)
        for r in records:
            r["stance"] = classify_stance(r.get("title", ""))
        combined.extend(records)

    combined.sort(key=lambda r: r.get("pub_date_parsed") or "0000-00-00", reverse=True)
    return combined
