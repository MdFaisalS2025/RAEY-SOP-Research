"""
Meridian Human Evaluation Routes
--------------------------------
Persistence for the /human-eval clinician sensitivity study. Previously
the frontend wrote ratings only to localStorage - real data from a real
evaluation instrument, visible to nobody but the person who ran it, gone
on a cache clear. Mirrors the routes_feedback.py model+schema+router
pattern.

Research prototype. Not for clinical use.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.db import get_db
from app.models.models import HumanEvalRating
from app.schemas.schemas import (
    HumanEvalRatingRequest,
    HumanEvalRatingResponse,
    HumanEvalRatingItem,
    HumanEvalRatingListResponse,
)

router = APIRouter(tags=["Human Evaluation"])


@router.post("/api/human-eval/ratings", response_model=HumanEvalRatingResponse)
async def submit_rating(req: HumanEvalRatingRequest, db: AsyncSession = Depends(get_db)):
    rating = HumanEvalRating(
        evaluator_role=req.evaluator_role,
        evaluator_name=req.evaluator_name,
        item_id=req.item_id,
        correctness=req.correctness,
        completeness=req.completeness,
        safety=req.safety,
        comment=req.comment,
    )
    db.add(rating)
    await db.flush()
    return HumanEvalRatingResponse(id=rating.id, message="Rating recorded.")


@router.get("/api/human-eval/ratings", response_model=HumanEvalRatingListResponse)
async def list_ratings(limit: int = 200, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(HumanEvalRating).order_by(HumanEvalRating.created_at.desc()).limit(limit)
    )).scalars().all()
    return HumanEvalRatingListResponse(ratings=[
        HumanEvalRatingItem(
            id=r.id,
            evaluator_role=r.evaluator_role,
            evaluator_name=r.evaluator_name,
            item_id=r.item_id,
            correctness=r.correctness,
            completeness=r.completeness,
            safety=r.safety,
            comment=r.comment,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rows
    ])


@router.delete("/api/human-eval/ratings")
async def clear_my_ratings(evaluator_name: str, db: AsyncSession = Depends(get_db)):
    """Backs the page's "Restart" action - only clears this evaluator's own
    ratings (matched by name), never the whole table, so one rater
    restarting can't silently wipe another rater's real submitted data."""
    if not evaluator_name:
        raise HTTPException(status_code=400, detail="evaluator_name is required.")
    rows = (await db.execute(
        select(HumanEvalRating).where(HumanEvalRating.evaluator_name == evaluator_name)
    )).scalars().all()
    for r in rows:
        await db.delete(r)
    await db.flush()
    return {"deleted": len(rows)}
