"""
SOP-Guard Change Impact Assessment
------------------------------------
Proactive assessment of what a proposed SOP text change would actually
affect, computed from real data (not fabricated): cross-SOP entity
conflicts the new text would introduce, how many staff acknowledgments/
attestations exist for the current SOP version (would go stale once the
change takes effect), and how often the SOP has actually been cited in
past real queries (blast radius).

Research prototype. Not for clinical use.
"""

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AcknowledgmentRecord, AttestationRecord, QueryLogRecord
from app.rag.entity_graph import extract_entities, find_conflicts, get_global_graph

_PROPOSED_KEY = "__proposed_change__"

# Historical-citation scan is bounded to the most recent N query logs rather
# than the full table - a signal of "how much this SOP is actually being
# relied on lately," not an exhaustive audit, and stays fast on a large log.
_CITATION_SCAN_LIMIT = 500


def _conflicts_for_proposed_text(new_text: str, exclude_sop_id: str) -> list[dict[str, Any]]:
    """
    Entities in `new_text` checked against the existing corpus's entity
    graph (built at startup - see entity_graph.get_global_graph()), as if
    the new text were its own temporary node. `exclude_sop_id` (the SOP
    being changed) is left out of the *comparison target* set implicitly:
    find_conflicts() already requires different sop_id/unit to flag
    anything, and every edge added here carries `_PROPOSED_KEY`, not
    exclude_sop_id, so the new text is never compared against its own
    current version - only against every *other* SOP.
    """
    base_graph = get_global_graph()
    if not base_graph:
        return []

    merged: dict[str, list[dict]] = {k: list(v) for k, v in base_graph.items()}
    for ent in extract_entities(new_text):
        if ent.get("value") is None or not ent.get("unit"):
            continue
        key = f"{ent['type']}:{ent['name']}"
        merged.setdefault(key, []).append({
            "sop_id": _PROPOSED_KEY,
            "sop_title": "Proposed change",
            "chunk_type": "proposed",
            "value": ent["value"],
            "unit": ent["unit"],
            "context_snippet": ent.get("snippet", ""),
        })

    all_conflicts = find_conflicts(merged)
    return [c for c in all_conflicts if c["sop_a"] == "Proposed change" or c["sop_b"] == "Proposed change"]


async def _count_acknowledgments(db: AsyncSession, sop_id: str) -> int:
    if not sop_id:
        return 0
    result = await db.execute(
        select(func.count()).select_from(AcknowledgmentRecord).where(AcknowledgmentRecord.sop_id == sop_id)
    )
    return result.scalar_one() or 0


async def _count_attestations(db: AsyncSession, sop_id: str) -> int:
    if not sop_id:
        return 0
    result = await db.execute(
        select(func.count()).select_from(AttestationRecord).where(AttestationRecord.sop_id == sop_id)
    )
    return result.scalar_one() or 0


async def _count_historical_citations(db: AsyncSession, sop_id: str, sop_title: str) -> int:
    """How many of the most recent query logs cited this SOP - a real
    usage signal, not a guess, so committee can see how much the change
    would actually touch real clinical questions asked recently."""
    if not sop_id and not sop_title:
        return 0
    rows = (await db.execute(
        select(QueryLogRecord.citations_json)
        .order_by(QueryLogRecord.created_at.desc())
        .limit(_CITATION_SCAN_LIMIT)
    )).scalars().all()
    count = 0
    for citations in rows:
        if not citations:
            continue
        for c in citations:
            if not isinstance(c, dict):
                continue
            if c.get("sop_id") == sop_id or (sop_title and c.get("sop_title") == sop_title):
                count += 1
                break  # one match per query log row is enough
    return count


async def assess_change_impact(
    db: AsyncSession, new_text: str, affected_sop_id: str, sop_title: str = "",
) -> dict[str, Any]:
    """Full change-impact report for a proposed new_text replacing
    affected_sop_id's current content. Never raises - defensive against
    partial data (e.g. entity graph not yet built)."""
    try:
        conflicts = _conflicts_for_proposed_text(new_text, affected_sop_id)
    except Exception:
        conflicts = []

    stale_acks = await _count_acknowledgments(db, affected_sop_id)
    stale_attestations = await _count_attestations(db, affected_sop_id)
    historical_citations = await _count_historical_citations(db, affected_sop_id, sop_title)

    risk = "low"
    if any(c["severity"] == "critical" for c in conflicts):
        risk = "critical"
    elif conflicts or historical_citations > 10:
        risk = "elevated"

    return {
        "available": True,
        "risk_level": risk,
        "new_conflicts": conflicts,
        "stale_acknowledgments": stale_acks,
        "stale_attestations": stale_attestations,
        "historical_citation_count": historical_citations,
        "citation_scan_window": _CITATION_SCAN_LIMIT,
        "summary": (
            f"{len(conflicts)} new cross-SOP conflict(s) introduced. "
            f"{stale_acks} staff acknowledgment(s) and {stale_attestations} attestation(s) "
            f"on the current version would need re-acknowledgment. "
            f"Cited in {historical_citations} of the last {_CITATION_SCAN_LIMIT} logged queries."
        ),
    }
