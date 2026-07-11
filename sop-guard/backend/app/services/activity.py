"""
Meridian Activity Logger
Research prototype. Not for clinical use.
"""

from datetime import datetime
from typing import Optional
import json

_activity_log: list[dict] = []

DEMO_USERS = [
    {"name": "Dr. Patel", "role": "physician", "department": "ICU"},
    {"name": "Nurse Lopez", "role": "nurse", "department": "Emergency"},
    {"name": "Quality Admin", "role": "admin", "department": "Quality"},
    {"name": "Pharmacy Reviewer", "role": "pharmacist", "department": "Pharmacy"},
]

def log_activity(
    action: str,
    sop_id: str = "",
    sop_title: str = "",
    user_role: str = "viewer",
    department: str = "",
    details: str = "",
    query: str = "",
    confidence: float = 0.0,
):
    import random
    demo_user = random.choice(DEMO_USERS)
    entry = {
        "id": len(_activity_log) + 1,
        "timestamp": datetime.utcnow().isoformat(),
        "action": action,
        "sop_id": sop_id,
        "sop_title": sop_title,
        "user_name": demo_user["name"],
        "user_role": user_role or demo_user["role"],
        "department": department or demo_user["department"],
        "details": details,
        "query": query,
        "confidence": confidence,
    }
    _activity_log.append(entry)
    return entry

def get_activity_log(limit: int = 50) -> list[dict]:
    return list(reversed(_activity_log[-limit:]))

def purge_activity_for_sop(sop_id: str) -> None:
    """Remove all logged activity for a permanently-deleted SOP.

    The activity log is the source of truth for get_sop_usage() - without
    this, a hard-deleted SOP's views/queries/source_clicks keep showing up
    in sop-usage forever (until process restart), which is exactly the kind
    of stale ghost data a permanent delete is supposed to eliminate.
    """
    global _activity_log
    _activity_log = [e for e in _activity_log if e.get("sop_id") != sop_id]

def has_any_activity() -> bool:
    """Whether anything has been logged yet in this process's lifetime.

    The log is in-memory (resets on every process restart) - this must
    not be confused with whether the SQLite SOP data already exists,
    which persists across restarts. Demo activity seeding should be
    gated on this, not on SOP count.
    """
    return len(_activity_log) > 0

def get_sop_usage() -> list[dict]:
    usage: dict[str, dict] = {}
    for entry in _activity_log:
        sid = entry.get("sop_id", "")
        # A deletion record must stay in the audit trail (get_activity_log)
        # but a permanently-deleted SOP has no "usage" to report - without
        # this it re-appears as a 0-views ghost row in the usage list right
        # after purge_activity_for_sop() clears its real history.
        if not sid or entry.get("action") == "sop_deleted":
            continue
        if sid not in usage:
            usage[sid] = {
                "sop_id": sid,
                "sop_title": entry.get("sop_title", ""),
                "views": 0,
                "queries": 0,
                "source_clicks": 0,
                "last_accessed": entry["timestamp"],
            }
        if entry["action"] == "sop_viewed":
            usage[sid]["views"] += 1
        elif entry["action"] == "query_submitted":
            usage[sid]["queries"] += 1
        elif entry["action"] == "source_clicked":
            usage[sid]["source_clicks"] += 1
        usage[sid]["last_accessed"] = entry["timestamp"]
    return sorted(usage.values(), key=lambda x: x["views"], reverse=True)
