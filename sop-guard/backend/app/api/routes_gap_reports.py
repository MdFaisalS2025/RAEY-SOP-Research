"""
Meridian SOP Gap Report Routes
----------------------------------
Created when a user's question has no matching approved internal SOP, so a
real coverage gap becomes a trackable, auditable committee item instead of
a dead-end "not covered" answer.

Research prototype - NOT for clinical use.
"""

import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.db import get_db
from app.models.models import SOPGapReportRecord, QueryLogRecord
from app.services.activity import log_activity

try:
    from app.api.routes_governance import _emit_notification
except Exception:  # pragma: no cover - defensive, governance routes always load in practice
    _emit_notification = None

router = APIRouter(tags=["SOP Gap Reports"])


class GapReportCreate(BaseModel):
    question: str
    searched_sops: list[str] = []
    no_match_reason: str = ""
    external_sources: list[dict] = []
    suggested_outline: list[str] = []
    risk_level: str = "moderate"
    affected_department: str = ""
    recommended_committee: str = ""
    recommended_action: str = ""


def _serialize(r: SOPGapReportRecord) -> dict:
    return {
        "id": r.id,
        "question": r.question,
        "asked_at": r.asked_at,
        "searched_sops": r.searched_sops or [],
        "no_match_reason": r.no_match_reason,
        "external_sources": r.external_sources or [],
        "suggested_outline": r.suggested_outline or [],
        "risk_level": r.risk_level,
        "affected_department": r.affected_department,
        "recommended_committee": r.recommended_committee,
        "recommended_action": r.recommended_action,
        "status": r.status,
        "created_at": r.created_at,
    }


@router.post("/api/sop-gap-reports")
async def create_gap_report(payload: GapReportCreate, db: AsyncSession = Depends(get_db)):
    record = SOPGapReportRecord(
        question=payload.question,
        asked_at=datetime.now(timezone.utc),
        searched_sops=payload.searched_sops,
        no_match_reason=payload.no_match_reason,
        external_sources=payload.external_sources,
        suggested_outline=payload.suggested_outline,
        risk_level=payload.risk_level,
        affected_department=payload.affected_department,
        recommended_committee=payload.recommended_committee,
        recommended_action=payload.recommended_action,
        status="open",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    log_activity(
        action="gap_report_created", details=payload.question,
        department=payload.affected_department, query=payload.question,
    )
    return _serialize(record)


@router.get("/api/sop-gap-reports")
async def list_gap_reports(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(SOPGapReportRecord).order_by(SOPGapReportRecord.created_at.desc())
    )).scalars().all()
    return {"reports": [_serialize(r) for r in rows], "total": len(rows)}


_STOPWORDS = {
    "what", "which", "who", "why", "when", "how", "does", "do", "did", "is",
    "are", "was", "were", "be", "been", "the", "a", "an", "of", "in", "on",
    "for", "and", "or", "to", "should", "must", "before", "after", "apply",
    "exist", "can", "could", "would", "will", "shall", "this", "that",
}


def _significant_words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{3,}", text.lower()) if w not in _STOPWORDS}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


@router.get("/api/sop-gap-reports/summary")
async def gap_report_summary(db: AsyncSession = Depends(get_db), min_count: int = 1):
    """Groups gap reports by question similarity (word-overlap clustering,
    not exact text) so a committee can see which coverage gaps keep coming
    up - "no SOP for this" said once is a data point, said five times in
    different phrasings is a prioritization signal. Clusters are greedy
    (first-seen representative wins) rather than an optimal clustering -
    good enough for triage, not a claim of statistical rigor.
    """
    rows = (await db.execute(
        select(SOPGapReportRecord).order_by(SOPGapReportRecord.created_at.asc())
    )).scalars().all()

    clusters: list[dict] = []  # each: {words, reports: [...]}
    for r in rows:
        words = _significant_words(r.question)
        best_cluster, best_score = None, 0.0
        for cluster in clusters:
            score = _jaccard(words, cluster["words"])
            if score > best_score:
                best_score, best_cluster = score, cluster
        if best_cluster is not None and best_score >= 0.5:
            best_cluster["reports"].append(r)
            best_cluster["words"] |= words
        else:
            clusters.append({"words": words, "reports": [r]})

    summary = []
    for cluster in clusters:
        reports = cluster["reports"]
        if len(reports) < min_count:
            continue
        departments = Counter(r.affected_department for r in reports if r.affected_department)
        committees = Counter(r.recommended_committee for r in reports if r.recommended_committee)
        risk_levels = Counter(r.risk_level for r in reports if r.risk_level)
        summary.append({
            "representative_question": reports[0].question,
            "count": len(reports),
            "report_ids": [r.id for r in reports],
            "statuses": dict(Counter(r.status for r in reports)),
            "most_common_department": departments.most_common(1)[0][0] if departments else "",
            "most_common_committee": committees.most_common(1)[0][0] if committees else "",
            "most_common_risk_level": risk_levels.most_common(1)[0][0] if risk_levels else "moderate",
            "first_asked": min(r.created_at for r in reports),
            "last_asked": max(r.created_at for r in reports),
        })

    summary.sort(key=lambda s: s["count"], reverse=True)
    return {"clusters": summary, "total_reports": len(rows), "total_clusters": len(clusters)}


# Routes the pipeline itself treats as "no approved SOP actually answered
# this" (see agents/routing.py) - the automatic signal, independent of
# whether any user bothered to click "flag to committee" on that answer.
_UNANSWERED_ROUTES = ("no_evidence", "external_evidence", "clarification")


def _effective_route(r: QueryLogRecord) -> str:
    """The route column was added after this table already had rows (see
    db.py's migration shim), so pre-existing logs backfilled to the column
    default "sop_library" even when they were actually abstained - that
    combination should never occur going forward (the pipeline always sets
    both together), so it only shows up on logs written before route
    tracking existed. Label those honestly rather than passing through a
    default that would misleadingly claim an SOP answered the question."""
    route = r.route or ""
    if route in _UNANSWERED_ROUTES:
        return route
    if r.abstained == "true":
        return "unknown_prior_to_tracking"
    return route or "sop_library"


@router.get("/api/sop-gap-reports/auto-detected")
async def auto_detected_gaps(db: AsyncSession = Depends(get_db), days: int = 30, min_count: int = 1):
    """Coverage-gap signal derived automatically from every logged query,
    not just the ones a user manually flagged via the gap-report panel.
    Every question routed away from an SOP (no_evidence/external_evidence/
    clarification) or that the pipeline abstained on is a real "the corpus
    didn't cover this" data point whether or not anyone flagged it -
    manual flagging under-counts real gaps because it depends on a user
    noticing and bothering to click a button. Clustered with the same
    word-overlap approach as the manual gap-report summary above, so a
    governance reviewer sees one consistent shape for both signals.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (await db.execute(
        select(QueryLogRecord)
        .where(QueryLogRecord.created_at >= since)
        .order_by(QueryLogRecord.created_at.asc())
    )).scalars().all()

    total_logged = len(rows)
    unanswered = [
        r for r in rows
        if r.abstained == "true" or (r.route or "") in _UNANSWERED_ROUTES
    ]

    clusters: list[dict] = []  # each: {words, rows: [...]}
    for r in unanswered:
        words = _significant_words(r.query_text)
        best_cluster, best_score = None, 0.0
        for cluster in clusters:
            score = _jaccard(words, cluster["words"])
            if score > best_score:
                best_score, best_cluster = score, cluster
        if best_cluster is not None and best_score >= 0.5:
            best_cluster["rows"].append(r)
            best_cluster["words"] |= words
        else:
            clusters.append({"words": words, "rows": [r]})

    summary = []
    for cluster in clusters:
        cluster_rows = cluster["rows"]
        if len(cluster_rows) < min_count:
            continue
        routes = Counter(_effective_route(r) for r in cluster_rows)
        summary.append({
            "representative_question": cluster_rows[0].query_text,
            "count": len(cluster_rows),
            "routes": dict(routes),
            "most_common_route": routes.most_common(1)[0][0],
            "first_asked": min(r.created_at for r in cluster_rows),
            "last_asked": max(r.created_at for r in cluster_rows),
        })

    summary.sort(key=lambda s: s["count"], reverse=True)
    return {
        "clusters": summary,
        "total_unanswered": len(unanswered),
        "total_logged_queries": total_logged,
        "total_clusters": len(clusters),
        "window_days": days,
    }


@router.post("/api/sop-gap-reports/{report_id}/send-to-committee")
async def send_gap_report_to_committee(report_id: int, db: AsyncSession = Depends(get_db)):
    record = (await db.execute(
        select(SOPGapReportRecord).where(SOPGapReportRecord.id == report_id)
    )).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail=f"Gap report {report_id} not found.")

    record.status = "sent_to_committee"
    if _emit_notification:
        _emit_notification(
            db, type_="gap_report", priority="high",
            title=f"SOP gap flagged for committee review: {record.affected_department or 'General'}",
            description=record.question,
            link="/proposals",
        )
    await db.commit()
    await db.refresh(record)

    log_activity(action="gap_report_sent_to_committee", details=record.question, department=record.affected_department)
    return _serialize(record)
