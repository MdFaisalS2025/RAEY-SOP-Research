"""
SOP-Guard Governance Routes
---------------------------
Persistence for proposals, votes, attestations, acknowledgments, and the
AI query audit log. CRUD-lite over async SQLAlchemy.

Research prototype  - NOT for clinical use.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Query as QueryParam
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database.db import get_db
from app.models.models import (
    ProposalRecord,
    VoteRecord,
    AttestationRecord,
    AcknowledgmentRecord,
    QueryLogRecord,
    NotificationRecord,
)
from app.schemas.schemas import (
    ProposalCreate,
    ProposalResponse,
    VoteCreate,
    AttestationCreate,
    AttestationResponse,
    AcknowledgmentCreate,
    AcknowledgmentResponse,
)

router = APIRouter(tags=["Governance"])

QUORUM_THRESHOLD = 3  # votes cast
COMMITTEE_SIZE = 5

_VALID_VOTES = {"approve", "reject", "abstain", "request_changes"}


def classify_tier(type_: str, priority: str, hours_until_deadline: float | None = None) -> str:
    """Classify a notification into an alert tier for the frontend alert budget.

    - "interruptive": blocking modal, reserved for conflicts affecting active
      proposals or compliance deadlines within 48 hours (critical priority,
      legal_flag type, or an expiry-type deadline within 48h).
    - "banner": non-blocking inline banner, for high priority items.
    - "passive": badge only, everything else.
    """
    type_ = (type_ or "").lower()
    priority = (priority or "").lower()

    if priority == "critical" or type_ == "legal_flag":
        return "interruptive"
    if type_ == "expiry" and hours_until_deadline is not None and hours_until_deadline <= 48:
        return "interruptive"
    if priority == "high":
        return "banner"
    return "passive"


def _emit_notification(
    db: AsyncSession,
    type_: str,
    title: str,
    description: str = "",
    priority: str = "normal",
    link: str = "",
    hours_until_deadline: float | None = None,
) -> None:
    """Best-effort notification insert. Never raises."""
    try:
        db.add(NotificationRecord(
            type=type_,
            title=title,
            description=description,
            priority=priority,
            tier=classify_tier(type_, priority, hours_until_deadline),
            link=link,
        ))
    except Exception as e:
        print(f"[SOP-Guard] Warning: failed to emit notification: {e}")


def _compute_tally(votes: list[VoteRecord]) -> dict:
    tally = {"approve": 0, "reject": 0, "abstain": 0, "request_changes": 0}
    for v in votes:
        if v.vote in tally:
            tally[v.vote] += 1
    tally["total"] = len(votes)
    return tally


def _compute_quorum(votes: list[VoteRecord]) -> dict:
    total = len(votes)
    tally = _compute_tally(votes)
    reached = total >= QUORUM_THRESHOLD
    # Simple decision: quorum reached and approvals are a strict majority of cast votes.
    decision = "pending"
    if reached:
        if tally["approve"] > (tally["reject"] + tally["request_changes"]):
            decision = "approved"
        elif tally["reject"] >= tally["approve"]:
            decision = "rejected"
    return {
        "threshold": QUORUM_THRESHOLD,
        "committee_size": COMMITTEE_SIZE,
        "votes_cast": total,
        "reached": reached,
        "decision": decision,
    }


def _proposal_to_response(p: ProposalRecord) -> ProposalResponse:
    votes = list(p.votes) if p.votes is not None else []
    return ProposalResponse(
        id=p.id,
        title=p.title,
        affected_sop_id=p.affected_sop_id or "",
        department=p.department or "",
        status=p.status or "open",
        priority=p.priority or "normal",
        initiated_by=p.initiated_by or "",
        ai_summary=p.ai_summary or "",
        legal_review_required=(str(p.legal_review_required).lower() == "true"),
        payload=p.payload or {},
        created_at=p.created_at,
        tally=_compute_tally(votes),
        quorum=_compute_quorum(votes),
        votes=[
            {
                "id": v.id,
                "user_id": v.user_id,
                "user_name": v.user_name,
                "vote": v.vote,
                "notes": v.notes,
                "created_at": v.created_at.isoformat() if v.created_at else "",
            }
            for v in votes
        ],
    )


# ── Proposals ──────────────────────────────────────────────────


@router.get("/api/governance/proposals")
async def list_proposals(
    limit: int = QueryParam(200, ge=1, le=1000),
    offset: int = QueryParam(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(ProposalRecord)
        .options(selectinload(ProposalRecord.votes))
        .order_by(ProposalRecord.created_at.desc())
        .limit(limit)
        .offset(offset)
    )).scalars().all()
    return {"proposals": [_proposal_to_response(p).model_dump() for p in rows]}


@router.post("/api/governance/proposals", response_model=ProposalResponse)
async def create_proposal(req: ProposalCreate, db: AsyncSession = Depends(get_db)):
    proposal = ProposalRecord(
        title=req.title,
        affected_sop_id=req.affected_sop_id,
        department=req.department,
        priority=req.priority,
        initiated_by=req.initiated_by,
        ai_summary=req.ai_summary,
        legal_review_required="true" if req.legal_review_required else "false",
        payload=req.payload or {},
        status="open",
    )
    db.add(proposal)
    await db.flush()
    await db.refresh(proposal, attribute_names=["votes"])
    _emit_notification(
        db, "proposal",
        f"New proposal: {proposal.title}",
        f"Proposed by {proposal.initiated_by or 'unknown'} for {proposal.affected_sop_id or 'general'}.",
        priority="high" if proposal.priority in ("high", "urgent") else "normal",
        link=f"/governance/proposals/{proposal.id}",
    )
    return _proposal_to_response(proposal)


@router.get("/api/governance/proposals/{proposal_id}", response_model=ProposalResponse)
async def get_proposal(proposal_id: int, db: AsyncSession = Depends(get_db)):
    proposal = (await db.execute(
        select(ProposalRecord)
        .options(selectinload(ProposalRecord.votes))
        .where(ProposalRecord.id == proposal_id)
    )).scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail=f"Proposal {proposal_id} not found.")
    return _proposal_to_response(proposal)


@router.delete("/api/governance/proposals/{proposal_id}")
async def delete_proposal(proposal_id: int, db: AsyncSession = Depends(get_db)):
    proposal = (await db.execute(
        select(ProposalRecord).where(ProposalRecord.id == proposal_id)
    )).scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail=f"Proposal {proposal_id} not found.")
    await db.delete(proposal)
    return {"message": f"Proposal {proposal_id} deleted.", "proposal_id": proposal_id}


@router.post("/api/governance/proposals/{proposal_id}/vote", response_model=ProposalResponse)
async def cast_vote(proposal_id: int, req: VoteCreate, db: AsyncSession = Depends(get_db)):
    if req.vote not in _VALID_VOTES:
        raise HTTPException(
            status_code=400,
            detail=f"vote must be one of {sorted(_VALID_VOTES)}.",
        )
    proposal = (await db.execute(
        select(ProposalRecord)
        .options(selectinload(ProposalRecord.votes))
        .where(ProposalRecord.id == proposal_id)
    )).scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail=f"Proposal {proposal_id} not found.")

    vote = VoteRecord(
        proposal_id=proposal_id,
        user_id=req.user_id,
        user_name=req.user_name,
        vote=req.vote,
        notes=req.notes,
    )
    db.add(vote)
    await db.flush()

    # Update proposal status if quorum decides.
    await db.refresh(proposal, attribute_names=["votes"])
    quorum = _compute_quorum(list(proposal.votes))
    quorum_just_reached = quorum["reached"] and len(proposal.votes) == QUORUM_THRESHOLD
    if quorum["reached"] and quorum["decision"] in ("approved", "rejected"):
        proposal.status = quorum["decision"]
    _emit_notification(
        db, "vote",
        f"Vote cast on {proposal.title}",
        f"{req.user_name or req.user_id or 'A committee member'} voted '{req.vote}'.",
        link=f"/governance/proposals/{proposal.id}",
    )
    if quorum_just_reached:
        _emit_notification(
            db, "quorum",
            f"Quorum reached on {proposal.title}",
            f"Decision: {quorum['decision']}.",
            priority="high",
            link=f"/governance/proposals/{proposal.id}",
        )
    await db.flush()
    return _proposal_to_response(proposal)


# ── Attestations ───────────────────────────────────────────────


@router.get("/api/governance/attestations")
async def list_attestations(
    limit: int = QueryParam(200, ge=1, le=1000),
    offset: int = QueryParam(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(AttestationRecord).order_by(AttestationRecord.attested_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    return {"attestations": [AttestationResponse.model_validate(r).model_dump() for r in rows]}


@router.post("/api/governance/attestations", response_model=AttestationResponse)
async def create_attestation(
    req: AttestationCreate, request: Request, db: AsyncSession = Depends(get_db)
):
    ip = request.client.host if request.client else ""
    rec = AttestationRecord(
        sop_id=req.sop_id,
        sop_version=req.sop_version,
        user_id=req.user_id,
        user_name=req.user_name,
        user_role=req.user_role,
        department=req.department,
        legal_text=req.legal_text,
        ip_address=ip,
    )
    db.add(rec)
    await db.flush()
    _emit_notification(
        db, "attestation",
        f"New attestation for {rec.sop_id}",
        f"{rec.user_name or rec.user_id or 'A user'} attested to {rec.sop_id} v{rec.sop_version or '?'}.",
        link="/governance/attestations",
    )
    return AttestationResponse.model_validate(rec)


# ── Acknowledgments ────────────────────────────────────────────


@router.get("/api/governance/acknowledgments")
async def list_acknowledgments(
    user_id: str | None = QueryParam(None),
    limit: int = QueryParam(200, ge=1, le=1000),
    offset: int = QueryParam(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AcknowledgmentRecord).order_by(AcknowledgmentRecord.acknowledged_at.desc())
    if user_id:
        stmt = stmt.where(AcknowledgmentRecord.user_id == user_id)
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return {"acknowledgments": [AcknowledgmentResponse.model_validate(r).model_dump() for r in rows]}


@router.post("/api/governance/acknowledgments", response_model=AcknowledgmentResponse)
async def create_acknowledgment(req: AcknowledgmentCreate, db: AsyncSession = Depends(get_db)):
    rec = AcknowledgmentRecord(
        sop_id=req.sop_id,
        user_id=req.user_id,
        user_name=req.user_name,
    )
    db.add(rec)
    await db.flush()
    return AcknowledgmentResponse.model_validate(rec)


# ── Query audit log ────────────────────────────────────────────


@router.get("/api/governance/query-log")
async def query_log(limit: int = 50, db: AsyncSession = Depends(get_db)):
    limit = max(1, min(limit, 500))
    rows = (await db.execute(
        select(QueryLogRecord).order_by(QueryLogRecord.created_at.desc()).limit(limit)
    )).scalars().all()
    return {
        "count": len(rows),
        "logs": [
            {
                "id": r.id,
                "query_text": r.query_text,
                "answer_text": r.answer_text,
                "query_type": r.query_type,
                "generation_mode": r.generation_mode,
                "confidence": r.confidence,
                "faithfulness_score": r.faithfulness_score,
                "citation_count": r.citation_count,
                "abstained": str(r.abstained).lower() == "true",
                "news2_score": r.news2_score,
                "user_id": r.user_id,
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in rows
        ],
    }


# ── Notifications ──────────────────────────────────────────────


def _notification_dict(n: NotificationRecord) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "description": n.description,
        "priority": n.priority,
        "tier": n.tier or "passive",
        "read": bool(n.read),
        "link": n.link,
        "created_at": n.created_at.isoformat() if n.created_at else "",
    }


@router.get("/api/notifications")
async def list_notifications(
    limit: int = QueryParam(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NotificationRecord).order_by(NotificationRecord.created_at.desc()).limit(limit)
    )
    rows = result.scalars().all()
    unread = sum(1 for r in rows if not r.read)

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_count_result = await db.execute(
        select(func.count(NotificationRecord.id)).where(
            NotificationRecord.tier == "interruptive",
            NotificationRecord.created_at >= today_start,
        )
    )
    interruptive_count_today = today_count_result.scalar() or 0
    return {
        "notifications": [_notification_dict(r) for r in rows],
        "unread_count": unread,
        "interruptive_count_today": interruptive_count_today,
    }


@router.post("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NotificationRecord).where(NotificationRecord.id == notification_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail=f"Notification {notification_id} not found.")
    record.read = True
    await db.commit()
    return {"ok": True}


@router.post("/api/notifications/read-all")
async def mark_all_notifications_read(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NotificationRecord).where(NotificationRecord.read == False))  # noqa: E712
    rows = result.scalars().all()
    for r in rows:
        r.read = True
    await db.commit()
    return {"ok": True, "marked": len(rows)}


async def seed_notifications_if_empty(db: AsyncSession) -> None:
    """Best-effort seed so the UI has content on first run. Never raises."""
    try:
        result = await db.execute(select(NotificationRecord.id).limit(1))
        if result.scalar_one_or_none() is not None:
            return
        db.add_all([
            NotificationRecord(
                type="expiry",
                title="SOP review due soon",
                description="High-Risk Respiratory Isolation and PPE Protocol is due for review within 30 days.",
                priority="high",
                tier=classify_tier("expiry", "high"),
                link="/expiry",
            ),
            NotificationRecord(
                type="evidence_watch",
                title="New external guidance detected",
                description="CDC HICPAC updated PPE recommendations. Review for possible SOP conflict.",
                priority="high",
                tier=classify_tier("evidence_watch", "high"),
                link="/evidence-watch",
            ),
            NotificationRecord(
                type="training_due",
                title="Training assignment due",
                description="High-alert medication double-check training is due for 12 staff members.",
                priority="normal",
                tier=classify_tier("training_due", "normal"),
                link="/training",
            ),
        ])
        await db.commit()
    except Exception as e:
        print(f"[SOP-Guard] Warning: failed to seed notifications: {e}")
