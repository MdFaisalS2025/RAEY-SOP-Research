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
