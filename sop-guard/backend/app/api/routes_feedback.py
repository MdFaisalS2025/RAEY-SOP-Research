"""
SOP-Guard Feedback & Analytics Routes
--------------------------------------
Research prototype  - NOT for clinical use.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.db import get_db
from app.models.models import Query, Feedback
from app.schemas.schemas import FeedbackRequest, FeedbackResponse, AnalyticsResponse

router = APIRouter(tags=["Feedback & Analytics"])


@router.post("/api/feedback", response_model=FeedbackResponse)
async def submit_feedback(req: FeedbackRequest, db: AsyncSession = Depends(get_db)):
    """Submit feedback for a query response."""
    query = (await db.execute(
        select(Query).where(Query.id == req.query_id)
    )).scalar_one_or_none()

    if not query:
        raise HTTPException(status_code=404, detail=f"Query {req.query_id} not found.")

    if req.feedback_type not in ("positive", "negative", "correction"):
        raise HTTPException(status_code=400, detail="feedback_type must be positive, negative, or correction.")

    fb = Feedback(
        query_id=req.query_id,
        feedback_type=req.feedback_type,
        feedback_text=req.feedback_text,
    )
    db.add(fb)
    await db.flush()

    return FeedbackResponse(id=fb.id, message="Feedback recorded.")


@router.get("/api/analytics", response_model=AnalyticsResponse)
async def get_analytics(db: AsyncSession = Depends(get_db)):
    """Return aggregated analytics."""
    # Total queries
    total = (await db.execute(select(func.count(Query.id)))).scalar() or 0

    # Queries by type
    type_rows = (await db.execute(
        select(Query.query_type, func.count(Query.id))
        .group_by(Query.query_type)
    )).all()
    queries_by_type = {row[0] or "unknown": row[1] for row in type_rows}

    # Feedback counts
    fb_rows = (await db.execute(
        select(Feedback.feedback_type, func.count(Feedback.id))
        .group_by(Feedback.feedback_type)
    )).all()
    feedback_counts = {row[0]: row[1] for row in fb_rows}

    # Verification stats
    ver_rows = (await db.execute(
        select(Query.verification_status, func.count(Query.id))
        .where(Query.verification_status != "")
        .group_by(Query.verification_status)
    )).all()
    verification_stats = {row[0]: row[1] for row in ver_rows}

    # Most queried departments
    dept_rows = (await db.execute(
        select(Query.department, func.count(Query.id))
        .where(Query.department != "")
        .group_by(Query.department)
        .order_by(func.count(Query.id).desc())
        .limit(10)
    )).all()
    most_queried_departments = {row[0]: row[1] for row in dept_rows}

    # Average confidence
    avg_conf = (await db.execute(
        select(func.avg(Query.confidence_score))
    )).scalar() or 0.0

    return AnalyticsResponse(
        total_queries=total,
        queries_by_type=queries_by_type,
        feedback_counts=feedback_counts,
        verification_stats=verification_stats,
        most_queried_departments=most_queried_departments,
        avg_confidence=round(float(avg_conf), 3),
    )
