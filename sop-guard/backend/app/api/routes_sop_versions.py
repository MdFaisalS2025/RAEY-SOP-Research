"""
Meridian SOP Version History Routes
--------------------------------------
Read access to the full historical record of an SOP's versions - what it
said at each version, why it changed, and who/which committee approved the
change. Distinct from routes_sops.py's `/versions` endpoint (which actually
returns pending/approved SOPUpdate section-edits, not historical document
snapshots) and from routes_governance.py's proposal diff (which diffs a
proposal's proposed text against the *current* SOP text, not between two
historical versions).

Research prototype - NOT for clinical use.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.db import get_db
from app.models.models import SOPVersionRecord
from app.services.text_diff import compute_word_diff, diff_stats
from app.services.activity import log_activity

router = APIRouter(tags=["SOP Version History"])


def _version_sort_key(version_number: str):
    """Sorts "1.0", "1.1", "2.0", "2.1" numerically rather than lexically."""
    parts = version_number.split(".")
    try:
        return tuple(int(p) for p in parts)
    except ValueError:
        return (0,)


@router.get("/api/sops/{sop_id}/version-history")
async def get_version_history(sop_id: str, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(SOPVersionRecord).where(SOPVersionRecord.sop_id == sop_id)
    )).scalars().all()
    ordered = sorted(rows, key=lambda r: _version_sort_key(r.version_number))

    log_activity(action="version_history_viewed", sop_id=sop_id, details=f"{len(ordered)} versions")

    return {
        "sop_id": sop_id,
        "versions": [
            {
                "id": v.id,
                "version_number": v.version_number,
                "status": v.status,
                "effective_date": v.effective_date,
                "archived_date": v.archived_date,
                "changed_by": v.changed_by,
                "changed_by_role": v.changed_by_role,
                "approved_by": v.approved_by,
                "committee_name": v.committee_name,
                "committee_comment": v.committee_comment,
                "reason_for_change": v.reason_for_change,
                "evidence_used": v.evidence_used,
                "change_category": v.change_category,
                "summary_of_changes": v.summary_of_changes,
                "affected_sections": v.affected_sections or [],
                "training_required": v.training_required,
                "acknowledgment_required": v.acknowledgment_required,
                "created_at": v.created_at,
            }
            for v in ordered
        ],
    }


@router.get("/api/sops/{sop_id}/version-history/{version_number}/diff")
async def get_version_diff(
    sop_id: str,
    version_number: str,
    db: AsyncSession = Depends(get_db),
    from_version: Optional[str] = Query(
        None,
        description="Diff against this specific version instead of the one immediately before "
        "`version_number` - lets a user compare any two versions (e.g. v1.0 vs v2.1), not just adjacent ones.",
    ),
):
    """Word-level diff between `version_number` and either `from_version`
    (if given) or the version immediately before it. Reuses the same
    compute_word_diff engine as the governance proposal redline viewer -
    no second diff implementation."""
    rows = (await db.execute(
        select(SOPVersionRecord).where(SOPVersionRecord.sop_id == sop_id)
    )).scalars().all()
    ordered = sorted(rows, key=lambda r: _version_sort_key(r.version_number))

    target_idx = next((i for i, v in enumerate(ordered) if v.version_number == version_number), None)
    if target_idx is None:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found for SOP {sop_id}.")
    target = ordered[target_idx]

    if from_version is not None:
        from_idx = next((i for i, v in enumerate(ordered) if v.version_number == from_version), None)
        if from_idx is None:
            raise HTTPException(status_code=404, detail=f"Version {from_version} not found for SOP {sop_id}.")
        old_text = ordered[from_idx].new_text
    else:
        old_text = ordered[target_idx - 1].new_text if target_idx > 0 else (target.old_text or "")

    if not old_text and not target.new_text:
        return {"available": False, "reason": "No text recorded for this version.", "segments": []}

    segments = compute_word_diff(old_text, target.new_text)
    return {
        "available": True,
        "version_number": version_number,
        "from_version": from_version or (ordered[target_idx - 1].version_number if target_idx > 0 else None),
        "segments": segments,
        "stats": diff_stats(segments),
    }
