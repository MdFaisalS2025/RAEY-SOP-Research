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


async def test_proposal_diff_from_payload(client):
    resp = await client.post("/api/governance/proposals", json={
        "title": "Update norepinephrine max dose",
        "payload": {
            "old_text": "Max norepinephrine dose is 3 mcg/kg/min.",
            "new_text": "Max norepinephrine dose is 3.5 mcg/kg/min, per updated guidance.",
        },
    })
    pid = resp.json()["id"]

    diff = await client.get(f"/api/governance/proposals/{pid}/diff")
    assert diff.status_code == 200
    data = diff.json()
    assert data["available"] is True
    types = [s["type"] for s in data["segments"]]
    assert "insert" in types and "delete" in types
    assert data["stats"]["words_added"] > 0


async def test_proposal_diff_unavailable_without_text(client):
    resp = await client.post("/api/governance/proposals", json={"title": "Process-only proposal, no SOP text"})
    pid = resp.json()["id"]

    diff = await client.get(f"/api/governance/proposals/{pid}/diff")
    assert diff.status_code == 200
    data = diff.json()
    assert data["available"] is False
    assert data["segments"] == []


async def test_proposal_diff_falls_back_to_current_sop_text(client):
    created = await client.post(
        "/api/sops",
        json={"sop_id": "SOP-TEST-001", "title": "Test Protocol", "raw_text": "Original SOP text here."},
        headers={"X-User-Role": "admin"},
    )
    assert created.status_code == 200, created.text

    resp = await client.post("/api/governance/proposals", json={
        "title": "Revise Test Protocol",
        "affected_sop_id": "SOP-TEST-001",
        "payload": {"new_text": "Revised SOP text here."},
    })
    pid = resp.json()["id"]

    diff = await client.get(f"/api/governance/proposals/{pid}/diff")
    assert diff.status_code == 200
    data = diff.json()
    assert data["available"] is True
    assert data["sop_title"] == "Test Protocol"


async def test_approval_without_scheduled_date_is_immediately_effective(client):
    resp = await client.post("/api/governance/proposals", json={"title": "Immediate change"})
    pid = resp.json()["id"]
    for i in range(3):
        await client.post(f"/api/governance/proposals/{pid}/vote", json={
            "user_id": f"m{i}", "user_name": f"M{i}", "vote": "approve",
        })
    got = (await client.get(f"/api/governance/proposals/{pid}")).json()
    assert got["status"] == "approved"
    assert got["effective_status"] == "effective"


async def test_approval_with_future_scheduled_date_is_pending(client):
    resp = await client.post("/api/governance/proposals", json={
        "title": "Deferred change", "scheduled_effective_date": "2099-01-01",
    })
    pid = resp.json()["id"]
    for i in range(3):
        await client.post(f"/api/governance/proposals/{pid}/vote", json={
            "user_id": f"m{i}", "user_name": f"M{i}", "vote": "approve",
        })
    got = (await client.get(f"/api/governance/proposals/{pid}")).json()
    assert got["status"] == "approved"
    assert got["effective_status"] == "pending"


async def test_open_proposal_has_no_effective_status(client):
    resp = await client.post("/api/governance/proposals", json={"title": "Still open"})
    pid = resp.json()["id"]
    got = (await client.get(f"/api/governance/proposals/{pid}")).json()
    assert got["status"] == "open"
    assert got["effective_status"] is None


async def test_schedule_endpoint_sets_and_clears_date(client):
    resp = await client.post("/api/governance/proposals", json={"title": "Schedulable"})
    pid = resp.json()["id"]

    scheduled = await client.put(f"/api/governance/proposals/{pid}/schedule", json={
        "scheduled_effective_date": "2099-06-01",
    })
    assert scheduled.status_code == 200
    assert scheduled.json()["scheduled_effective_date"] == "2099-06-01"

    cleared = await client.put(f"/api/governance/proposals/{pid}/schedule", json={
        "scheduled_effective_date": "",
    })
    assert cleared.status_code == 200
    assert cleared.json()["scheduled_effective_date"] == ""


async def test_schedule_endpoint_rejects_bad_date(client):
    resp = await client.post("/api/governance/proposals", json={"title": "Bad date test"})
    pid = resp.json()["id"]
    bad = await client.put(f"/api/governance/proposals/{pid}/schedule", json={
        "scheduled_effective_date": "not-a-date",
    })
    assert bad.status_code == 400


async def test_proposals_list_respects_limit(client):
    """
    list_proposals previously had no limit/offset - a growing proposals
    table would be returned to the client in full on every request.
    """
    for i in range(5):
        resp = await client.post("/api/governance/proposals", json={"title": f"Proposal {i}"})
        assert resp.status_code == 200

    limited = await client.get("/api/governance/proposals?limit=2")
    assert limited.status_code == 200
    assert len(limited.json()["proposals"]) == 2

    paged = await client.get("/api/governance/proposals?limit=2&offset=2")
    assert paged.status_code == 200
    assert len(paged.json()["proposals"]) == 2

    all_of_them = await client.get("/api/governance/proposals")
    assert len(all_of_them.json()["proposals"]) == 5
