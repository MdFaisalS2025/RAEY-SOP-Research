"""
Meridian Value / Adoption Analytics Routes
----------------------------------------------
A CFO/CMIO-facing view of adoption and value signals. Computed from real
data where possible; fields that would require production usage logs
(session/login tracking) are clearly labeled as illustrative estimates.

Research prototype  - NOT for clinical use.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.db import get_db
from app.models.models import (
    QueryLogRecord,
    AcknowledgmentRecord,
    VoteRecord,
    OverrideRecord,
    CreditRecord,
    NotificationRecord,
)

router = APIRouter(tags=["Analytics"])

MINUTES_SAVED_PER_QUERY = 12
# Illustrative estimate for a research prototype; not derived from real usage logs.
SIMULATED_LOGGED_IN = 8


@router.get("/api/analytics/adoption")
async def adoption_analytics(db: AsyncSession = Depends(get_db)):
    queries_total = (await db.execute(select(func.count(QueryLogRecord.id)))).scalar() or 0

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    queries_this_week = (await db.execute(
        select(func.count(QueryLogRecord.id)).where(QueryLogRecord.created_at >= week_ago)
    )).scalar() or 0

    avg_faithfulness_row = (await db.execute(
        select(func.avg(QueryLogRecord.faithfulness_score)).where(
            QueryLogRecord.faithfulness_score.isnot(None)
        )
    )).scalar()
    avg_faithfulness = float(avg_faithfulness_row) if avg_faithfulness_row is not None else 0.0

    acknowledged_sop = (await db.execute(select(func.count(AcknowledgmentRecord.id)))).scalar() or 0
    voted_on_proposal = (await db.execute(
        select(func.count(func.distinct(VoteRecord.user_id)))
    )).scalar() or 0

    overrides_total = (await db.execute(select(func.count(OverrideRecord.id)))).scalar() or 0
    overrides_by_reason_rows = (await db.execute(
        select(OverrideRecord.reason, func.count(OverrideRecord.id)).group_by(OverrideRecord.reason)
    )).all()

    credits_awarded_total = (await db.execute(select(func.sum(CreditRecord.credits)))).scalar() or 0.0

    notifications_by_tier_rows = (await db.execute(
        select(NotificationRecord.tier, func.count(NotificationRecord.id)).group_by(NotificationRecord.tier)
    )).all()
    notifications_by_tier = {"passive": 0, "banner": 0, "interruptive": 0}
    for tier, count in notifications_by_tier_rows:
        notifications_by_tier[tier or "passive"] = count

    return {
        "activation_funnel": {
            "logged_in": SIMULATED_LOGGED_IN,
            "ran_query": queries_total,
            "acknowledged_sop": acknowledged_sop,
            "voted_on_proposal": voted_on_proposal,
        },
        "queries_total": queries_total,
        "queries_this_week": queries_this_week,
        "avg_faithfulness": round(avg_faithfulness, 4),
        "estimated_minutes_saved": queries_total * MINUTES_SAVED_PER_QUERY,
        "overrides_total": overrides_total,
        "overrides_by_reason": {reason: count for reason, count in overrides_by_reason_rows},
        "credits_awarded_total": float(credits_awarded_total),
        "notifications_by_tier": notifications_by_tier,
        "note": (
            "Activation funnel and time-saved figures are illustrative estimates "
            "for a research prototype; production deployment would compute these "
            "from real usage logs."
        ),
    }
