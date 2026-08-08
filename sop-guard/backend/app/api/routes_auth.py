"""
Meridian Authentication Routes (Phase S)
------------------------------------------
Login/logout/me. All three exist because the frontend needs to: (1) submit
real credentials and receive a real session, (2) end that session, and
(3) rehydrate identity on page load without re-prompting for a password -
GET /me reads the same httpOnly cookie every other route will check.

Research prototype. Not for clinical use.
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.models import StaffUser
from app.services.auth import (
    clear_session_cookie,
    get_current_user,
    set_session_cookie,
    verify_password,
)
from app.services.rate_limit import (
    record_failure,
    record_success,
    seconds_until_unlocked,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    staff_id: str
    password: str


class UserOut(BaseModel):
    staff_id: str
    name: str
    role: str
    department: str
    title: str


def _to_user_out(user: StaffUser) -> UserOut:
    return UserOut(
        staff_id=user.staff_id, name=user.name, role=user.role,
        department=user.department or "", title=user.title or "",
    )


@router.post("/login", response_model=UserOut)
async def login(req: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    # Checked (and recorded) by staff_id, not by outcome-revealing account
    # existence - a locked-out account gets the same 429 whether or not it's
    # real, for the same enumeration reason the 401 below is deliberately
    # generic.
    remaining = seconds_until_unlocked(req.staff_id)
    if remaining > 0:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {int(remaining // 60) + 1} minute(s).",
        )

    user = (await db.execute(
        select(StaffUser).where(StaffUser.staff_id == req.staff_id)
    )).scalar_one_or_none()
    # Same error for "no such account" and "wrong password" - distinguishing
    # them lets an attacker enumerate valid staff_ids.
    if user is None or not verify_password(req.password, user.password_hash):
        record_failure(req.staff_id)
        raise HTTPException(status_code=401, detail="Invalid staff ID or password.")
    record_success(req.staff_id)
    set_session_cookie(response, user)
    return _to_user_out(user)


@router.post("/logout")
async def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: StaffUser = Depends(get_current_user)):
    return _to_user_out(user)
