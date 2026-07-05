"""
SOP-Guard Activity Routes
-------------------------
Research prototype - NOT for clinical use.
"""

from fastapi import APIRouter
from app.services.activity import get_activity_log, get_sop_usage

router = APIRouter(tags=["Activity"])

@router.get("/api/activity")
async def activity_log(limit: int = 50):
    return {"entries": get_activity_log(limit)}

@router.get("/api/sop-usage")
async def sop_usage():
    return {"usage": get_sop_usage()}
