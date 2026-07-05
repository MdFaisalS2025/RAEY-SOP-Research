"""
SOP-Guard Role-Based Permissions
Research prototype. Not for clinical use.
"""

from fastapi import Header, HTTPException
from typing import Optional

ROLES = {"admin", "editor", "viewer"}

PERMISSIONS = {
    "admin": {"view", "create", "edit", "delete", "archive", "approve", "upload"},
    "editor": {"view", "create", "edit", "upload", "propose"},
    "viewer": {"view", "query", "feedback"},
}

def get_user_role(x_user_role: Optional[str] = Header(default="viewer")) -> str:
    role = (x_user_role or "viewer").lower()
    if role not in ROLES:
        role = "viewer"
    return role

def require_permission(role: str, action: str):
    if action not in PERMISSIONS.get(role, set()):
        raise HTTPException(
            status_code=403,
            detail=f"Role '{role}' does not have permission to '{action}'. Required: admin or editor."
        )
