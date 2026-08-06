"""
Meridian CME/CPD Credit Tracking Routes
------------------------------------------
Lightweight "habit loop" tracking: scenario completions, SOP reviews, and
committee participation earn credits. Supports a leaderboard for a
lightweight engagement view.

Research prototype  - NOT for clinical use.
"""

from fastapi import APIRouter, Depends, Query as QueryParam
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.db import get_db
from app.models.models import CreditRecord, StaffUser
from app.schemas.schemas import CreditCreate, CreditResponse
from app.services.auth import get_current_user

router = APIRouter(tags=["Credits"])

_VALID_ACTIVITY_TYPES = {"scenario_completed", "sop_reviewed", "committee_participation"}


@router.post("/api/credits", response_model=CreditResponse)
async def create_credit(
    req: CreditCreate,
    db: AsyncSession = Depends(get_db),
    user: StaffUser = Depends(get_current_user),
):
    activity_type = req.activity_type if req.activity_type in _VALID_ACTIVITY_TYPES else "scenario_completed"
    rec = CreditRecord(
        # Always the session's real identity - self-attributed training
        # credit, never client-supplied.
        user_id=user.staff_id,
        user_name=user.name,
        activity_type=activity_type,
        activity_title=req.activity_title,
        credits=req.credits,
    )
    db.add(rec)
    await db.flush()
    return CreditResponse.model_validate(rec)


@router.get("/api/credits")
async def list_credits(
    user_id: str | None = QueryParam(None),
    limit: int = QueryParam(100, ge=1, le=1000),
    offset: int = QueryParam(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CreditRecord).order_by(CreditRecord.created_at.desc())
    if user_id:
        stmt = stmt.where(CreditRecord.user_id == user_id)
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()

    result = {"credits": [CreditResponse.model_validate(r).model_dump() for r in rows]}
    if user_id:
        # Sum over ALL of the user's records, not just this page - the
        # displayed total must not shrink just because of pagination.
        total_stmt = select(func.sum(CreditRecord.credits)).where(CreditRecord.user_id == user_id)
        result["total_credits"] = (await db.execute(total_stmt)).scalar() or 0.0
    return result


@router.get("/api/credits/leaderboard")
async def credits_leaderboard(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(
            CreditRecord.user_id,
            CreditRecord.user_name,
            func.sum(CreditRecord.credits).label("total"),
        )
        .group_by(CreditRecord.user_id, CreditRecord.user_name)
        .order_by(func.sum(CreditRecord.credits).desc())
        .limit(5)
    )).all()
    return {
        "leaderboard": [
            {"user_id": user_id, "user_name": user_name, "total_credits": total or 0.0}
            for user_id, user_name, total in rows
        ]
    }
