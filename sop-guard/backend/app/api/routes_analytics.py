"""
Meridian Value / Adoption Analytics Routes
----------------------------------------------
A CFO/CMIO-facing view of adoption and value signals. Computed from real
data where possible; fields that would require production usage logs
(session/login tracking) are clearly labeled as illustrative estimates.

Research prototype  - NOT for clinical use.
"""

from collections import Counter
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

_WINDOW_DAYS = {"day": 1, "week": 7, "month": 30}

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


@router.get("/api/analytics/top-sops")
async def top_sops(
    window: str = "week",
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """Most-cited SOPs over a rolling window, derived from real logged
    queries (QueryLogRecord.citations_json) - no separate aggregation
    table, same "unpack JSON in Python" approach as the auto-detected-gaps
    endpoint, since SQLite's JSON aggregation support is limited.
    """
    window_days = _WINDOW_DAYS.get(window, 7)
    since = datetime.now(timezone.utc) - timedelta(days=window_days)

    rows = (await db.execute(
        select(QueryLogRecord.citations_json, QueryLogRecord.created_at)
        .where(QueryLogRecord.created_at >= since)
    )).all()

    counts: Counter[str] = Counter()
    titles: dict[str, str] = {}
    last_queried: dict[str, datetime] = {}

    for citations_json, created_at in rows:
        if not citations_json:
            continue
        # Prefer citations the answer actually used; if a row has none
        # marked cited_in_answer (older rows / routes that don't set it),
        # fall back to every internal citation the query retrieved rather
        # than silently dropping that row from the count.
        internal = [
            c for c in citations_json
            if isinstance(c, dict) and c.get("sop_id") and not c.get("is_external")
        ]
        cited = [c for c in internal if c.get("cited_in_answer")] or internal
        for c in cited:
            sop_id = c["sop_id"]
            counts[sop_id] += 1
            titles.setdefault(sop_id, c.get("sop_title") or sop_id)
            if sop_id not in last_queried or created_at > last_queried[sop_id]:
                last_queried[sop_id] = created_at

    ranked = [
        {
            "sop_id": sop_id,
            "sop_title": titles.get(sop_id, sop_id),
            "count": count,
            "last_queried": last_queried[sop_id].isoformat() if last_queried.get(sop_id) else None,
        }
        for sop_id, count in counts.most_common(limit)
    ]

    return {"window": window, "window_days": window_days, "since": since.isoformat(), "sops": ranked}
