"""
Meridian Exceptions Routes
--------------------------
In-the-moment, documented deviations from an approved SOP (e.g. a step
skipped for a patient-specific or equipment-availability reason) - as
opposed to Incidents, which are reported after the fact. Mirrors the
Incidents/CAPA router's shape and conventions.

Research prototype - NOT for clinical use.
"""

from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.db import get_db
from app.models.models import ExceptionRecord, StaffUser
from app.schemas.schemas import ExceptionCreate, ExceptionUpdate, ExceptionResponse
from app.services.auth import get_current_user, require_permission

router = APIRouter(tags=["Exceptions"])

_VALID_STATUSES = {"open", "under_review", "resolved", "escalated"}


@router.get("/api/exceptions")
async def list_exceptions(
    limit: int = QueryParam(200, ge=1, le=1000),
    offset: int = QueryParam(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(ExceptionRecord)
        .order_by(ExceptionRecord.date_reported.desc())
        .limit(limit)
        .offset(offset)
    )).scalars().all()
    return {"exceptions": [ExceptionResponse.model_validate(r).model_dump() for r in rows]}


@router.post("/api/exceptions", response_model=ExceptionResponse)
async def create_exception(
    req: ExceptionCreate,
    db: AsyncSession = Depends(get_db),
    user: StaffUser = Depends(get_current_user),
):
    record = ExceptionRecord(
        sop_id=req.sop_id,
        sop_title=req.sop_title or req.sop_id,
        # Always the session's real identity, never req.reported_by/
        # reporter_role - same spoofing gap the S6 vote/incident fixes closed.
        reported_by=user.name,
        reporter_role=user.role,
        department=req.department,
        date_of_deviation=req.date_of_deviation,
        deviation_type=req.deviation_type,
        description=req.description,
        immediate_action_taken=req.immediate_action_taken,
        patient_harm=req.patient_harm,
        severity=req.severity,
        status="open",
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


@router.put("/api/exceptions/{exception_id}", response_model=ExceptionResponse)
async def update_exception(
    exception_id: int,
    req: ExceptionUpdate,
    db: AsyncSession = Depends(get_db),
    user: StaffUser = Depends(require_permission("manage_quality")),
):
    record = (await db.execute(
        select(ExceptionRecord).where(ExceptionRecord.id == exception_id)
    )).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail=f"Exception {exception_id} not found.")

    if req.status is not None:
        if req.status not in _VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {sorted(_VALID_STATUSES)}.")
        record.status = req.status

    for field in ("resolution", "sop_update_required", "follow_up_required"):
        value = getattr(req, field)
        if value is not None:
            setattr(record, field, value)
    # reviewed_by is always the session's real reviewer, never client-supplied.
    record.reviewed_by = user.name

    await db.flush()
    await db.refresh(record)
    return record
