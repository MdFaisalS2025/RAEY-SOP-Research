"""
SOP-Guard SOP Management Routes
--------------------------------
Research prototype  - NOT for clinical use.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from app.database.db import get_db
from app.models.models import SOP, SOPChunk, SOPUpdate
from app.services.permissions import get_user_role, require_permission
from app.services.activity import log_activity, purge_activity_for_sop
from app.schemas.schemas import (
    SOPResponse, SOPDetailResponse, SOPListResponse,
    SOPUploadResponse, SOPUpdateRequest, SOPUpdateResponse,
    RetrievedChunk,
)
from app.services.document_parser import parse_file
from app.services.sop_structurer import structure_sop
from app.rag.chunker import create_sop_chunks

router = APIRouter(tags=["SOPs"])


@router.get("/api/sops", response_model=SOPListResponse)
async def list_sops(db: AsyncSession = Depends(get_db)):
    """List all SOPs with chunk counts."""
    rows = (await db.execute(
        select(SOP, func.count(SOPChunk.id).label("chunk_count"))
        .outerjoin(SOPChunk, SOP.id == SOPChunk.sop_id)
        .group_by(SOP.id)
        .order_by(SOP.created_at.desc())
    )).all()

    sops = []
    for sop, count in rows:
        sops.append(SOPResponse(
            id=sop.id,
            sop_id=sop.sop_id,
            title=sop.title,
            department=sop.department,
            version=sop.version,
            effective_date=sop.effective_date or "",
            review_date=sop.review_date or "",
            status=sop.status,
            structured_json=sop.structured_json or {},
            chunk_count=count,
            created_at=sop.created_at,
        ))

    return SOPListResponse(sops=sops, total=len(sops))


@router.get("/api/sops/{sop_id}", response_model=SOPDetailResponse)
async def get_sop(sop_id: str, db: AsyncSession = Depends(get_db)):
    """Get SOP detail with all chunks."""
    sop = (await db.execute(
        select(SOP).where(SOP.sop_id == sop_id)
    )).scalar_one_or_none()

    if not sop:
        raise HTTPException(status_code=404, detail=f"SOP '{sop_id}' not found.")

    log_activity("sop_viewed", sop_id=sop.sop_id, sop_title=sop.title)

    chunk_rows = (await db.execute(
        select(SOPChunk).where(SOPChunk.sop_id == sop.id).order_by(SOPChunk.chunk_index)
    )).scalars().all()

    chunks = [
        RetrievedChunk(
            chunk_text=c.chunk_text,
            section_title=c.section_title,
            sop_title=sop.title,
            sop_id=sop.sop_id,
        )
        for c in chunk_rows
    ]

    return SOPDetailResponse(
        id=sop.id,
        sop_id=sop.sop_id,
        title=sop.title,
        department=sop.department,
        version=sop.version,
        effective_date=sop.effective_date or "",
        review_date=sop.review_date or "",
        status=sop.status,
        structured_json=sop.structured_json or {},
        chunk_count=len(chunks),
        created_at=sop.created_at,
        raw_text=sop.raw_text or "",
        chunks=chunks,
    )


@router.post("/api/upload-sop", response_model=SOPUploadResponse)
async def upload_sop(
    file: UploadFile = File(...),
    title: str = Form(""),
    department: str = Form("General"),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF, DOCX, or TXT file as a new SOP."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file.")

    # Parse document
    try:
        raw_text = parse_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No text extracted from file.")

    sop_id = f"SOP-{department[:3].upper()}-{uuid.uuid4().hex[:6].upper()}"
    sop_title = title or file.filename.rsplit(".", 1)[0]

    # Structure the SOP
    structured = structure_sop(raw_text, sop_title)

    # Create DB records
    sop = SOP(
        sop_id=sop_id,
        title=sop_title,
        department=department,
        raw_text=raw_text,
        structured_json=structured,
    )
    db.add(sop)
    await db.flush()

    # SOP-aware chunking
    sop_chunks = create_sop_chunks(
        raw_text=raw_text,
        structured=structured,
        sop_id=sop_id,
        sop_title=sop_title,
        department=department,
    )
    for idx, ch in enumerate(sop_chunks):
        db.add(SOPChunk(
            sop_id=sop.id,
            section_title=ch.get("section_title", ""),
            chunk_text=ch.get("text", ""),
            chunk_index=idx,
        ))

    return SOPUploadResponse(
        sop_id=sop_id,
        title=sop_title,
        chunk_count=len(sop_chunks),
        message=f"SOP uploaded and chunked into {len(sop_chunks)} segments.",
    )


@router.post("/api/sops/{sop_id}/propose-update", response_model=SOPUpdateResponse)
async def propose_update(
    sop_id: str,
    req: SOPUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Propose an update to an SOP section."""
    sop = (await db.execute(
        select(SOP).where(SOP.sop_id == sop_id)
    )).scalar_one_or_none()

    if not sop:
        raise HTTPException(status_code=404, detail=f"SOP '{sop_id}' not found.")

    update = SOPUpdate(
        sop_id=sop.id,
        section=req.section,
        old_text=req.old_text,
        new_text=req.new_text,
        reason=req.reason,
        proposed_by=req.proposed_by,
        status="pending",
    )
    db.add(update)
    await db.flush()

    return SOPUpdateResponse(
        id=update.id,
        sop_id=update.sop_id,
        section=update.section,
        old_text=update.old_text,
        new_text=update.new_text,
        reason=update.reason,
        proposed_by=update.proposed_by,
        status=update.status,
        created_at=update.created_at,
    )


@router.post("/api/sops/{sop_id}/approve-update/{update_id}")
async def approve_update(
    sop_id: str,
    update_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Approve a proposed SOP update."""
    update = (await db.execute(
        select(SOPUpdate)
        .join(SOP, SOPUpdate.sop_id == SOP.id)
        .where(SOP.sop_id == sop_id, SOPUpdate.id == update_id)
    )).scalar_one_or_none()

    if not update:
        raise HTTPException(status_code=404, detail="Update proposal not found.")

    if update.status != "pending":
        raise HTTPException(status_code=400, detail=f"Update is already '{update.status}'.")

    update.status = "approved"
    update.reviewed_at = datetime.now(timezone.utc)

    return {"message": "Update approved.", "update_id": update_id}


@router.get("/api/sops/{sop_id}/versions")
async def get_versions(sop_id: str, db: AsyncSession = Depends(get_db)):
    """Get version/update history for an SOP."""
    sop = (await db.execute(
        select(SOP).where(SOP.sop_id == sop_id)
    )).scalar_one_or_none()

    if not sop:
        raise HTTPException(status_code=404, detail=f"SOP '{sop_id}' not found.")

    updates = (await db.execute(
        select(SOPUpdate).where(SOPUpdate.sop_id == sop.id).order_by(SOPUpdate.created_at.desc())
    )).scalars().all()

    return {
        "sop_id": sop_id,
        "current_version": sop.version,
        "updates": [
            {
                "id": u.id,
                "section": u.section,
                "old_text": u.old_text,
                "new_text": u.new_text,
                "reason": u.reason,
                "proposed_by": u.proposed_by,
                "status": u.status,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "reviewed_at": u.reviewed_at.isoformat() if u.reviewed_at else None,
            }
            for u in updates
        ],
    }


# ── CRUD Endpoints ────────────────────────────────────────────


@router.post("/api/sops")
async def create_sop(
    body: dict,
    role: str = Depends(get_user_role),
    db: AsyncSession = Depends(get_db),
):
    """Create a new SOP (admin or editor only)."""
    require_permission(role, "create")

    sop_id = body.get("sop_id") or f"SOP-{body.get('department', 'GEN')[:3].upper()}-{uuid.uuid4().hex[:6].upper()}"
    title = body.get("title", "Untitled SOP")
    department = body.get("department", "General")
    version = body.get("version", "1.0")
    effective_date = body.get("effective_date", "")
    review_date = body.get("review_date", "")
    raw_text = body.get("raw_text", "")
    status = body.get("status", "active")

    # Check for duplicate sop_id
    existing = (await db.execute(
        select(SOP).where(SOP.sop_id == sop_id)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"SOP '{sop_id}' already exists.")

    structured = {}
    if raw_text:
        structured = structure_sop(raw_text, title)

    sop = SOP(
        sop_id=sop_id,
        title=title,
        department=department,
        version=version,
        effective_date=effective_date,
        review_date=review_date,
        status=status,
        raw_text=raw_text,
        structured_json=structured,
    )
    db.add(sop)
    await db.flush()

    # Chunk the text if provided
    if raw_text:
        sop_chunks = create_sop_chunks(
            raw_text=raw_text,
            structured=structured,
            sop_id=sop_id,
            sop_title=title,
            department=department,
            version=version,
            status=status,
            effective_date=effective_date,
            review_date=review_date,
        )
        for idx, ch in enumerate(sop_chunks):
            db.add(SOPChunk(
                sop_id=sop.id,
                section_title=ch.get("section_title", ""),
                chunk_text=ch.get("text", ""),
                chunk_index=idx,
            ))

    log_activity("sop_created", sop_id=sop.sop_id, sop_title=title, user_role=role)

    return {
        "sop_id": sop.sop_id,
        "title": sop.title,
        "department": sop.department,
        "version": sop.version,
        "status": sop.status,
        "message": f"SOP '{title}' created successfully.",
    }


@router.put("/api/sops/{sop_id}")
async def update_sop(
    sop_id: str,
    body: dict,
    role: str = Depends(get_user_role),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing SOP (admin or editor only)."""
    require_permission(role, "edit")

    sop = (await db.execute(
        select(SOP).where(SOP.sop_id == sop_id)
    )).scalar_one_or_none()

    if not sop:
        raise HTTPException(status_code=404, detail=f"SOP '{sop_id}' not found.")

    # Update allowed fields
    updatable_fields = ["title", "department", "version", "effective_date", "review_date", "status", "raw_text"]
    for field in updatable_fields:
        if field in body:
            setattr(sop, field, body[field])

    # Re-structure if raw_text changed
    if "raw_text" in body and body["raw_text"]:
        sop.structured_json = structure_sop(body["raw_text"], sop.title)

    sop.updated_at = datetime.now(timezone.utc)

    log_activity("sop_updated", sop_id=sop.sop_id, sop_title=sop.title, user_role=role)

    return {
        "sop_id": sop.sop_id,
        "title": sop.title,
        "department": sop.department,
        "version": sop.version,
        "status": sop.status,
        "message": f"SOP '{sop.title}' updated successfully.",
    }


@router.delete("/api/sops/{sop_id}")
async def delete_sop(
    sop_id: str,
    permanent: bool = False,
    role: str = Depends(get_user_role),
    db: AsyncSession = Depends(get_db),
):
    """Archive or permanently delete an SOP (admin only)."""
    require_permission(role, "delete")

    sop = (await db.execute(
        select(SOP).where(SOP.sop_id == sop_id)
    )).scalar_one_or_none()

    if not sop:
        raise HTTPException(status_code=404, detail=f"SOP '{sop_id}' not found.")

    if permanent:
        await db.execute(delete(SOPChunk).where(SOPChunk.sop_id == sop.id))
        await db.execute(delete(SOPUpdate).where(SOPUpdate.sop_id == sop.id))
        await db.delete(sop)
        purge_activity_for_sop(sop_id)
        log_activity("sop_deleted", sop_id=sop_id, sop_title=sop.title, user_role=role,
                      details="Permanently deleted")
        return {"message": f"SOP '{sop_id}' permanently deleted.", "sop_id": sop_id}
    else:
        sop.status = "archived"
        sop.updated_at = datetime.now(timezone.utc)
        log_activity("sop_archived", sop_id=sop.sop_id, sop_title=sop.title, user_role=role)
        return {"message": f"SOP '{sop_id}' archived.", "sop_id": sop_id, "status": "archived"}
