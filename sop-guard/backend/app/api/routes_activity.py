"""
Meridian Activity Routes
-------------------------
Research prototype - NOT for clinical use.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.services.activity import get_activity_log, get_sop_usage, log_activity
from app.models.models import StaffUser
from app.services.auth import get_current_user, require_permission

router = APIRouter(tags=["Activity"])

#: Frontend-triggerable audit actions (Ask page action buttons that don't
#: already have a dedicated endpoint of their own, e.g. gap reports and
#: version-history views log via their own routes). Restricting to a known
#: set keeps this generic endpoint from becoming an arbitrary event sink.
_ALLOWED_CLIENT_ACTIONS = {"answer_flagged", "evidence_watchlist_added", "department_review_requested"}


class ActivityLogCreate(BaseModel):
    action: str
    sop_id: str = ""
    sop_title: str = ""
    department: str = ""
    details: str = ""
    query: str = ""


@router.get("/api/activity")
async def activity_log(limit: int = 50, user: StaffUser = Depends(require_permission("view_audit"))):
    return {"entries": get_activity_log(limit)}


@router.post("/api/activity")
async def create_activity_entry(payload: ActivityLogCreate, user: StaffUser = Depends(get_current_user)):
    if payload.action not in _ALLOWED_CLIENT_ACTIONS:
        return {"logged": False, "reason": "Unrecognized action type."}
    entry = log_activity(
        action=payload.action, sop_id=payload.sop_id, sop_title=payload.sop_title,
        department=payload.department, details=payload.details, query=payload.query,
    )
    return {"logged": True, "entry": entry}

@router.get("/api/sop-usage")
async def sop_usage(user: StaffUser = Depends(require_permission("view_audit"))):
    return {"usage": get_sop_usage()}
