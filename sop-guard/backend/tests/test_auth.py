"""Tests for real authentication (Phase S): password hashing, JWT session
cookies, login/logout/me, and server-side permission enforcement.

Uses an isolated SQLite file per test (same pattern as
test_governance_api.py's `client` fixture) so demo-data seeding never
touches the real dev database.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import StaffUser
from app.services.auth import (
    ROLE_PERMISSIONS,
    hash_password,
    has_permission,
    verify_password,
)


def test_hash_password_never_stores_plaintext():
    hashed = hash_password("demo1234")
    assert hashed != "demo1234"
    assert hashed.startswith("$2b$")


def test_verify_password_accepts_correct_password():
    hashed = hash_password("demo1234")
    assert verify_password("demo1234", hashed) is True


def test_verify_password_rejects_wrong_password():
    hashed = hash_password("demo1234")
    assert verify_password("wrong-password", hashed) is False


def test_verify_password_fails_closed_on_malformed_hash():
    # A corrupted/legacy hash must never be treated as a match.
    assert verify_password("demo1234", "not-a-real-bcrypt-hash") is False


def test_role_permissions_match_frontend_vocabulary():
    # The four roles this backend enforces must be exactly the four the
    # frontend's role-context.tsx defines - a fifth or a typo here would
    # silently make every check for that role fail permission checks.
    assert set(ROLE_PERMISSIONS.keys()) == {
        "system_admin", "governance_compliance", "educator", "clinical_staff",
    }


def test_clinical_staff_lacks_review_proposal():
    # Deliberate exclusion (see role-context.tsx's matching comment) -
    # clinical_staff can raise a concern but not vote on proposals.
    assert has_permission("clinical_staff", "create_proposal") is True
    assert has_permission("clinical_staff", "review_proposal") is False


def test_unknown_role_has_no_permissions():
    assert has_permission("not_a_real_role", "view_sops") is False


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_auth.db'}"
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async with TestSession() as session:
        session.add(StaffUser(
            staff_id="u1", name="Dr. Sarah Mitchell", role="clinical_staff",
            department="ICU", title="Physician",
            password_hash=hash_password("demo1234"),
        ))
        await session.commit()

    async def _override_get_db():
        async with TestSession() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.pop(get_db, None)
    await engine.dispose()


async def test_login_with_correct_credentials_succeeds(client):
    resp = await client.post("/api/auth/login", json={"staff_id": "u1", "password": "demo1234"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["staff_id"] == "u1"
    assert data["role"] == "clinical_staff"
    assert "meridian_session" in resp.cookies


async def test_login_with_wrong_password_rejected(client):
    resp = await client.post("/api/auth/login", json={"staff_id": "u1", "password": "wrong"})
    assert resp.status_code == 401
    assert "meridian_session" not in resp.cookies


async def test_login_with_unknown_staff_id_rejected(client):
    resp = await client.post("/api/auth/login", json={"staff_id": "does-not-exist", "password": "demo1234"})
    assert resp.status_code == 401


async def test_me_without_session_is_401(client):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_me_after_login_returns_real_identity(client):
    await client.post("/api/auth/login", json={"staff_id": "u1", "password": "demo1234"})
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200, resp.text
    assert resp.json()["staff_id"] == "u1"


async def test_logout_clears_session(client):
    await client.post("/api/auth/login", json={"staff_id": "u1", "password": "demo1234"})
    assert (await client.get("/api/auth/me")).status_code == 200

    await client.post("/api/auth/logout")
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_role_gated_sop_creation_blocked_for_clinical_staff(client):
    # u1 is clinical_staff, which lacks publish_sop - server-side enforcement
    # (Phase S's actual point) must reject this regardless of what the
    # request body claims.
    await client.post("/api/auth/login", json={"staff_id": "u1", "password": "demo1234"})
    resp = await client.post("/api/sops", json={"sop_id": "SOP-X", "title": "X", "raw_text": "text"})
    assert resp.status_code == 403


async def test_login_lockout_after_repeated_failures(client):
    """Real gap this closes: /api/auth/login had zero brute-force protection
    - unlimited password guesses against any staff_id. A unique staff_id
    (not "u1"/"u4", which other tests in this file use) since the rate
    limiter's state is process-wide, not per-test."""
    from app.services.rate_limit import reset as reset_rate_limit
    key = "rate-limit-test-only"
    reset_rate_limit(key)
    try:
        for _ in range(5):
            resp = await client.post(
                "/api/auth/login", json={"staff_id": key, "password": "wrong"}
            )
            assert resp.status_code == 401

        # The 6th attempt is locked out even with the CORRECT password -
        # the account doesn't exist in this test DB at all, so this also
        # proves the lockout fires before any credential check runs.
        locked = await client.post(
            "/api/auth/login", json={"staff_id": key, "password": "anything"}
        )
        assert locked.status_code == 429
    finally:
        reset_rate_limit(key)


async def test_login_lockout_is_per_staff_id(client):
    """A lockout on one account must not block a different, unrelated one."""
    from app.services.rate_limit import reset as reset_rate_limit
    locked_key, other_key = "rate-limit-locked", "rate-limit-other"
    reset_rate_limit(locked_key)
    reset_rate_limit(other_key)
    try:
        for _ in range(5):
            await client.post("/api/auth/login", json={"staff_id": locked_key, "password": "wrong"})
        assert (await client.post(
            "/api/auth/login", json={"staff_id": locked_key, "password": "anything"}
        )).status_code == 429

        # u1 with the real (correct) password still works.
        resp = await client.post("/api/auth/login", json={"staff_id": "u1", "password": "demo1234"})
        assert resp.status_code == 200, resp.text
    finally:
        reset_rate_limit(locked_key)
        reset_rate_limit(other_key)


async def test_role_gated_sop_creation_allowed_for_system_admin(client, tmp_path):
    async with async_sessionmaker(
        create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'test_auth.db'}", connect_args={"check_same_thread": False}),
        expire_on_commit=False,
    )() as session:
        session.add(StaffUser(
            staff_id="u4", name="Tariq Farooq", role="system_admin",
            department="IT", title="Admin",
            password_hash=hash_password("demo1234"),
        ))
        await session.commit()

    resp = await client.post("/api/auth/login", json={"staff_id": "u4", "password": "demo1234"})
    assert resp.status_code == 200, resp.text
    created = await client.post("/api/sops", json={"sop_id": "SOP-Y", "title": "Y", "raw_text": "text"})
    assert created.status_code == 200, created.text
