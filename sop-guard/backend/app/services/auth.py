"""
Meridian Authentication (Phase S)
----------------------------------
Replaces the prior "auth", which was entirely client-side: a hardcoded
frontend array (DEMO_USERS) plus a localStorage flag holding a bare user
id, with a password check that accepted the literal string "demo1234" OR
the user's own department name lowercased - guessable from public-looking
data, and trivially bypassable anyway by just setting the localStorage key
in devtools. No request ever reached the backend, and no route ever
verified who was calling it.

This module is the real thing: bcrypt password hashing, JWT sessions
carried in an httpOnly cookie, and a get_current_user dependency every
role-gated route can require. Deliberately NOT full SSO/SAML - that needs
an external identity provider (Okta, Azure AD, etc.) this deployment has
no credentials for. What this closes is the actual credibility gap: role
is no longer a client-side switch nobody server-side ever checks.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Cookie, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database.db import get_db
from app.models.models import StaffUser

SESSION_COOKIE_NAME = "meridian_session"
_JWT_ALGORITHM = "HS256"

# Same 4-role vocabulary and permission set as the frontend's
# role-context.tsx (kept in sync by hand - there is no shared schema
# between the TS and Python sides). This is what makes server-side
# enforcement real: a route checks THIS mapping against the role read out
# of a verified JWT, not whatever role string a request body claims.
ROLE_PERMISSIONS: dict[str, set[str]] = {
    "system_admin": {
        "view_sops", "query_ai", "create_proposal", "review_proposal",
        "vote_committee", "publish_sop", "archive_sop", "view_audit",
        "manage_users", "manage_sources", "legal_review", "view_compliance",
        "manage_training", "view_legal", "export_reports", "emergency_override",
        "manage_committee", "view_all_departments", "configure_system",
        "acknowledge_sop", "complete_training", "manage_acknowledgments",
        "manage_quality",
    },
    "governance_compliance": {
        "view_sops", "query_ai", "create_proposal", "review_proposal",
        "vote_committee", "publish_sop", "view_audit", "manage_committee",
        "view_compliance", "view_legal", "legal_review", "export_reports",
        "view_all_departments", "manage_acknowledgments", "manage_quality",
    },
    "educator": {
        "view_sops", "query_ai", "manage_training", "view_compliance",
        "create_proposal",
    },
    # review_proposal deliberately excluded - see role-context.tsx's
    # matching comment. create_proposal (raising a concern) stays.
    "clinical_staff": {
        "view_sops", "query_ai", "create_proposal",
        "acknowledge_sop", "complete_training",
    },
}


def has_permission(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed/legacy hash - fail closed, never treat as a match.
        return False


def create_session_token(user: StaffUser) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.staff_id,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(hours=settings.SESSION_EXPIRY_HOURS),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=_JWT_ALGORITHM)


def decode_session_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[_JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def set_session_cookie(response: Response, user: StaffUser) -> None:
    token = create_session_token(user)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.SESSION_EXPIRY_HOURS * 3600,
        # Not `secure=True`: this dev/demo deployment is served over plain
        # HTTP on localhost. A production deployment behind HTTPS should
        # set this from settings.ENVIRONMENT rather than hardcode it here.
        secure=False,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


async def get_current_user(
    meridian_session: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> StaffUser:
    """FastAPI dependency: the real identity check. Raises 401 whenever the
    cookie is missing, expired, tampered with, or no longer matches a real
    account - never falls back to a default role the way the old
    services/permissions.py header-trusting stub did."""
    if not meridian_session:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    payload = decode_session_token(meridian_session)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired or invalid.")
    user = (await db.execute(
        select(StaffUser).where(StaffUser.staff_id == payload.get("sub"))
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="Account no longer exists.")
    return user


async def get_current_user_optional(
    meridian_session: Optional[str] = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> Optional[StaffUser]:
    """Non-raising variant for endpoints that want to log/attribute an
    identity when present but must not hard-block anonymous/legacy callers
    (e.g. read-mostly query routes that predate real auth)."""
    if not meridian_session:
        return None
    payload = decode_session_token(meridian_session)
    if not payload:
        return None
    return (await db.execute(
        select(StaffUser).where(StaffUser.staff_id == payload.get("sub"))
    )).scalar_one_or_none()


def require_permission(permission: str):
    """Dependency factory: `Depends(require_permission("create_proposal"))`.
    Raises 403 if the authenticated user's real, server-verified role
    doesn't carry the permission - the actual enforcement point that was
    entirely absent before Phase S (every route trusted a role string the
    client supplied in the request body)."""
    async def _check(user: StaffUser = Depends(get_current_user)) -> StaffUser:
        if not has_permission(user.role, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Your role ({user.role}) does not have the '{permission}' permission.",
            )
        return user
    return _check
