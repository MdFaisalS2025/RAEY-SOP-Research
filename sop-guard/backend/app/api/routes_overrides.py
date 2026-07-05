"""
SOP-Guard Override-with-Reason Routes
--------------------------------------
Captures why a clinician dismissed a conflict warning or overrode an AI
answer, to support FDA non-device CDS "independent review" documentation.

Research prototype  - NOT for clinical use.
"""

from fastapi import APIRouter, Depends, Query as QueryParam
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.db import get_db
from app.models.models import OverrideRecord
from app.schemas.schemas import OverrideCreate, OverrideResponse

router = APIRouter(tags=["Overrides"])

_VALID_CONTEXT_TYPES = {"conflict", "answer", "cds_card"}
_VALID_REASONS = {"will_monitor", "not_applicable", "disagree_with_sop", "other"}


@router.post("/api/overrides", response_model=OverrideResponse)
async def create_override(req: OverrideCreate, db: AsyncSession = Depends(get_db)):
    context_type = req.context_type if req.context_type in _VALID_CONTEXT_TYPES else "other"
    reason = req.reason if req.reason in _VALID_REASONS else "other"
    rec = OverrideRecord(
        context_type=context_type,
        context_id=req.context_id,
        context_label=req.context_label,
        user_id=req.user_id,
        user_name=req.user_name,
        reason=reason,
        note=req.note,
    )
    db.add(rec)
    await db.flush()
    return OverrideResponse.model_validate(rec)


@router.get("/api/overrides")
async def list_overrides(
    context_type: str | None = QueryParam(None),
    limit: int = QueryParam(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(OverrideRecord).order_by(OverrideRecord.created_at.desc()).limit(limit)
    if context_type:
        stmt = stmt.where(OverrideRecord.context_type == context_type)
    rows = (await db.execute(stmt)).scalars().all()
    return {"overrides": [OverrideResponse.model_validate(r).model_dump() for r in rows]}


@router.get("/api/overrides/summary")
async def overrides_summary(db: AsyncSession = Depends(get_db)):
    by_reason_rows = (await db.execute(
        select(OverrideRecord.reason, func.count(OverrideRecord.id)).group_by(OverrideRecord.reason)
    )).all()
    by_context_rows = (await db.execute(
        select(OverrideRecord.context_type, func.count(OverrideRecord.id)).group_by(OverrideRecord.context_type)
    )).all()
    total = (await db.execute(select(func.count(OverrideRecord.id)))).scalar() or 0
    return {
        "total": total,
        "by_reason": {reason: count for reason, count in by_reason_rows},
        "by_context_type": {ctx: count for ctx, count in by_context_rows},
    }


@router.get("/api/overrides/stewardship")
async def overrides_stewardship(
    min_overrides: int = QueryParam(2, ge=1),
    limit: int = QueryParam(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Rank distinct alerts/answers by how often clinicians override them.

    An alert or SOP-derived answer that gets overridden repeatedly - by the
    same or different users - is a candidate for retuning or demotion
    (classic alert-fatigue signal: a warning nobody heeds isn't doing its
    job). context_id is a stable hash of the underlying query/conflict, so
    it recurs across separate override events for the same alert; this
    groups by (context_type, context_id) and ranks by override count.

    min_overrides filters out one-off overrides (the common case, not a
    fatigue signal on its own) so the list only shows things that have
    actually recurred.
    """
    rows = (await db.execute(select(OverrideRecord).order_by(OverrideRecord.created_at.desc()))).scalars().all()

    groups: dict[tuple[str, str], dict] = {}
    for r in rows:
        key = (r.context_type, r.context_id)
        g = groups.setdefault(key, {
            "context_type": r.context_type,
            "context_id": r.context_id,
            "context_label": r.context_label,
            "count": 0,
            "reasons": {},
            "last_overridden_at": r.created_at,
        })
        g["count"] += 1
        g["reasons"][r.reason] = g["reasons"].get(r.reason, 0) + 1
        if not g["context_label"] and r.context_label:
            g["context_label"] = r.context_label

    candidates = [g for g in groups.values() if g["count"] >= min_overrides]
    candidates.sort(key=lambda g: g["count"], reverse=True)

    return {
        "total_distinct_contexts": len(groups),
        "candidates": candidates[:limit],
        "disclaimer": (
            "Repeated overrides suggest the alert/answer is miscalibrated for "
            "how it's actually being used in practice, not proof the SOP is "
            "wrong - use this list to prioritize manual review, not to "
            "auto-suppress anything."
        ),
    }
