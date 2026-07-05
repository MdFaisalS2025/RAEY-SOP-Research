"""Governance API test: create a proposal, cast 3 approve votes, assert quorum.

Uses an isolated in-memory-ish SQLite file and overrides the get_db dependency
so the real demo database is untouched.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_gov.db'}"
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(engine, expire_on_commit=False)

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


async def test_proposal_vote_quorum(client):
    # Create a proposal.
    resp = await client.post("/api/governance/proposals", json={
        "title": "Update sepsis antibiotic timing",
        "affected_sop_id": "SOP-ICU-001",
        "department": "ICU",
        "priority": "high",
        "initiated_by": "dr.smith",
    })
    assert resp.status_code == 200, resp.text
    proposal = resp.json()
    pid = proposal["id"]
    assert proposal["quorum"]["reached"] is False

    # Cast 3 approve votes.
    for i in range(3):
        vr = await client.post(f"/api/governance/proposals/{pid}/vote", json={
            "user_id": f"member{i}",
            "user_name": f"Member {i}",
            "vote": "approve",
        })
        assert vr.status_code == 200, vr.text

    # Fetch proposal and assert quorum reached and approved.
    got = await client.get(f"/api/governance/proposals/{pid}")
    assert got.status_code == 200
    data = got.json()
    assert data["tally"]["approve"] == 3
    assert data["quorum"]["reached"] is True
    assert data["quorum"]["decision"] == "approved"
    assert data["status"] == "approved"


async def test_invalid_vote_rejected(client):
    resp = await client.post("/api/governance/proposals", json={"title": "P2"})
    pid = resp.json()["id"]
    bad = await client.post(f"/api/governance/proposals/{pid}/vote", json={"vote": "maybe"})
    assert bad.status_code == 400


async def test_acknowledgment_roundtrip(client):
    r = await client.post("/api/governance/acknowledgments", json={
        "sop_id": "SOP-ICU-001", "user_id": "u1", "user_name": "User One",
    })
    assert r.status_code == 200
    listed = await client.get("/api/governance/acknowledgments?user_id=u1")
    assert listed.status_code == 200
    assert len(listed.json()["acknowledgments"]) == 1
