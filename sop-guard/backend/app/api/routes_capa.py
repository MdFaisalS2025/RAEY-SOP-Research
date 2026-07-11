"""
Meridian Incidents + CAPA Routes
-----------------------------------
Patient-safety incident reports and the Corrective and Preventive Action
(CAPA) workflow that closes the loop from an incident to a documented root
cause, corrective action, and preventive action - the standard QMS
mechanism, optionally linked to a governance ProposalRecord when the
preventive action is an SOP change going through committee review.

Research prototype  - NOT for clinical use.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query as QueryParam
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database.db import get_db
from app.models.models import IncidentRecord, CAPARecord
from app.schemas.schemas import (
    IncidentCreate, IncidentResponse,
    CAPACreate, CAPAUpdate, CAPAResponse,
)

router = APIRouter(tags=["Incidents & CAPA"])


def _incident_to_response(inc: IncidentRecord) -> IncidentResponse:
    capas = list(inc.capas) if inc.capas is not None else []
    return IncidentResponse(
        id=inc.id,
        incident_type=inc.incident_type or "near_miss",
        title=inc.title,
        description=inc.description or "",
        department=inc.department or "",
        severity=inc.severity or "medium",
        reporter=inc.reporter or "",
        linked_sop_ids=inc.linked_sop_ids or [],
        occurred_at=inc.occurred_at,
        created_at=inc.created_at,
        capa_count=len(capas),
        open_capa_count=sum(1 for c in capas if c.status != "closed"),
    )


@router.get("/api/incidents")
async def list_incidents(
    limit: int = QueryParam(200, ge=1, le=1000),
    offset: int = QueryParam(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(IncidentRecord)
        .options(selectinload(IncidentRecord.capas))
        .order_by(IncidentRecord.occurred_at.desc())
        .limit(limit)
        .offset(offset)
    )).scalars().all()
    return {"incidents": [_incident_to_response(i).model_dump() for i in rows]}


@router.post("/api/incidents", response_model=IncidentResponse)
async def create_incident(req: IncidentCreate, db: AsyncSession = Depends(get_db)):
    incident = IncidentRecord(
        incident_type=req.incident_type,
        title=req.title,
        description=req.description,
        department=req.department,
        severity=req.severity,
        reporter=req.reporter,
        linked_sop_ids=req.linked_sop_ids or [],
    )
    db.add(incident)
    await db.flush()
    await db.refresh(incident, attribute_names=["capas"])
    return _incident_to_response(incident)


@router.get("/api/incidents/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: int, db: AsyncSession = Depends(get_db)):
    incident = (await db.execute(
        select(IncidentRecord)
        .options(selectinload(IncidentRecord.capas))
        .where(IncidentRecord.id == incident_id)
    )).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found.")
    return _incident_to_response(incident)


@router.get("/api/incidents/{incident_id}/capa")
async def list_capa_for_incident(incident_id: int, db: AsyncSession = Depends(get_db)):
    incident = (await db.execute(
        select(IncidentRecord).where(IncidentRecord.id == incident_id)
    )).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found.")
    rows = (await db.execute(
        select(CAPARecord).where(CAPARecord.incident_id == incident_id).order_by(CAPARecord.created_at.desc())
    )).scalars().all()
    return {"capas": [CAPAResponse.model_validate(c).model_dump() for c in rows]}


@router.post("/api/incidents/{incident_id}/capa", response_model=CAPAResponse)
async def create_capa(incident_id: int, req: CAPACreate, db: AsyncSession = Depends(get_db)):
    incident = (await db.execute(
        select(IncidentRecord).where(IncidentRecord.id == incident_id)
    )).scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found.")

    capa = CAPARecord(
        incident_id=incident_id,
        title=req.title or f"CAPA for: {incident.title}",
        root_cause=req.root_cause,
        corrective_action=req.corrective_action,
        preventive_action=req.preventive_action,
        owner=req.owner,
        due_date=req.due_date,
        status="open",
    )
    db.add(capa)
    await db.flush()
    await db.refresh(capa)
    return capa


@router.get("/api/capa")
async def list_all_capa(
    status: str = QueryParam("", description="Filter by status: open | investigating | action_planned | closed"),
    limit: int = QueryParam(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CAPARecord).order_by(CAPARecord.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(CAPARecord.status == status)
    rows = (await db.execute(stmt)).scalars().all()
    return {"capas": [CAPAResponse.model_validate(c).model_dump() for c in rows]}


@router.get("/api/capa/{capa_id}", response_model=CAPAResponse)
async def get_capa(capa_id: int, db: AsyncSession = Depends(get_db)):
    capa = (await db.execute(select(CAPARecord).where(CAPARecord.id == capa_id))).scalar_one_or_none()
    if not capa:
        raise HTTPException(status_code=404, detail=f"CAPA {capa_id} not found.")
    return capa


_VALID_CAPA_STATUSES = {"open", "investigating", "action_planned", "closed"}


@router.put("/api/capa/{capa_id}", response_model=CAPAResponse)
async def update_capa(capa_id: int, req: CAPAUpdate, db: AsyncSession = Depends(get_db)):
    capa = (await db.execute(select(CAPARecord).where(CAPARecord.id == capa_id))).scalar_one_or_none()
    if not capa:
        raise HTTPException(status_code=404, detail=f"CAPA {capa_id} not found.")

    if req.status is not None:
        if req.status not in _VALID_CAPA_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {sorted(_VALID_CAPA_STATUSES)}.")
        capa.status = req.status
        capa.closed_at = datetime.now(timezone.utc) if req.status == "closed" else None

    for field in ("title", "root_cause", "corrective_action", "preventive_action", "owner", "due_date", "linked_proposal_id"):
        value = getattr(req, field)
        if value is not None:
            setattr(capa, field, value)

    await db.flush()
    await db.refresh(capa)
    return capa


@router.delete("/api/capa/{capa_id}")
async def delete_capa(capa_id: int, db: AsyncSession = Depends(get_db)):
    capa = (await db.execute(select(CAPARecord).where(CAPARecord.id == capa_id))).scalar_one_or_none()
    if not capa:
        raise HTTPException(status_code=404, detail=f"CAPA {capa_id} not found.")
    await db.delete(capa)
    return {"message": f"CAPA {capa_id} deleted.", "capa_id": capa_id}
