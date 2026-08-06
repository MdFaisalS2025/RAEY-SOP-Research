"""
Meridian Feedback & Analytics Routes
--------------------------------------
Research prototype  - NOT for clinical use.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.db import get_db
from app.models.models import Query, Feedback, QueryLogRecord, StaffUser
from app.schemas.schemas import FeedbackRequest, FeedbackResponse, AnalyticsResponse, FeedbackItem, FeedbackListResponse
from app.services.auth import get_current_user, require_permission

router = APIRouter(tags=["Feedback & Analytics"])

_VALID_FEEDBACK_TYPES = {
    "positive", "negative", "correction", "clarification",
    "incorrect", "unsafe", "missing",
}
# Positive signals don't need governance review; everything else surfaces
# in the /feedback page's Needs Review queue.
_NEEDS_REVIEW_TYPES = _VALID_FEEDBACK_TYPES - {"positive"}


@router.post("/api/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    req: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    user: StaffUser = Depends(get_current_user),
):
    """Submit feedback for a query response."""
    if req.feedback_type not in _VALID_FEEDBACK_TYPES:
        raise HTTPException(status_code=400, detail=f"feedback_type must be one of {sorted(_VALID_FEEDBACK_TYPES)}.")
    if req.answer_id is None and req.query_id is None:
        raise HTTPException(status_code=400, detail="Either answer_id or query_id is required.")

    query_id = req.query_id
    if req.answer_id is not None:
        record = (await db.execute(
            select(QueryLogRecord).where(QueryLogRecord.id == req.answer_id)
        )).scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=404, detail=f"Answer {req.answer_id} not found.")
        # `queries`/Query is a legacy table the current chat/query pipeline
        # doesn't otherwise use (real per-answer records live in
        # QueryLogRecord) - Feedback.query_id stays NOT NULL, so a small
        # bridging Query row mirrors the answer's text to satisfy the FK
        # without a schema migration.
        bridge = Query(
            query_text=record.query_text,
            query_type=record.query_type,
            answer_text=record.answer_text,
            confidence_score=record.confidence,
        )
        db.add(bridge)
        await db.flush()
        query_id = bridge.id
    else:
        query = (await db.execute(select(Query).where(Query.id == query_id))).scalar_one_or_none()
        if not query:
            raise HTTPException(status_code=404, detail=f"Query {query_id} not found.")

    fb = Feedback(
        query_id=query_id,
        answer_id=req.answer_id,
        feedback_type=req.feedback_type,
        feedback_text=req.feedback_text,
    )
    db.add(fb)
    await db.flush()

    return FeedbackResponse(id=fb.id, message="Feedback recorded.")


@router.get("/api/feedback", response_model=FeedbackListResponse)
async def list_feedback(
    needs_review: bool = False,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    user: StaffUser = Depends(require_permission("manage_quality")),
):
    """Recent feedback rows for the governance Needs Review queue."""
    stmt = select(Feedback).order_by(Feedback.created_at.desc()).limit(limit)
    if needs_review:
        stmt = stmt.where(Feedback.feedback_type.in_(_NEEDS_REVIEW_TYPES))
    rows = (await db.execute(stmt)).scalars().all()

    items: list[FeedbackItem] = []
    for fb in rows:
        query_text, sop_title = "", ""
        if fb.answer_id is not None:
            record = (await db.execute(
                select(QueryLogRecord).where(QueryLogRecord.id == fb.answer_id)
            )).scalar_one_or_none()
            if record:
                query_text = record.query_text
                citations = record.citations_json or []
                if citations:
                    sop_title = citations[0].get("sop_title", "")
        if not query_text:
            legacy = (await db.execute(select(Query).where(Query.id == fb.query_id))).scalar_one_or_none()
            if legacy:
                query_text = legacy.query_text

        items.append(FeedbackItem(
            id=fb.id,
            status=fb.status or "new",
            type=fb.feedback_type,
            sop=sop_title or "—",
            query=query_text,
            time=fb.created_at.isoformat() if fb.created_at else "",
        ))

    return FeedbackListResponse(items=items)


@router.patch("/api/feedback/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback_status(
    feedback_id: int,
    status: str = "reviewed",
    db: AsyncSession = Depends(get_db),
    user: StaffUser = Depends(require_permission("manage_quality")),
):
    fb = (await db.execute(select(Feedback).where(Feedback.id == feedback_id))).scalar_one_or_none()
    if not fb:
        raise HTTPException(status_code=404, detail=f"Feedback {feedback_id} not found.")
    fb.status = status
    await db.flush()
    return FeedbackResponse(id=fb.id, message="Feedback updated.")


@router.get("/api/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    user: StaffUser = Depends(require_permission("manage_quality")),
):
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
