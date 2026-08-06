"""Tests for the incidents + CAPA workflow (app/api/routes_capa.py)."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import StaffUser
from app.services.auth import get_current_user


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_capa.db'}"
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

    # This suite predates Phase S and only touches /api/governance/proposals
    # incidentally (test_capa_links_to_proposal) - same fixed-identity
    # pattern as test_governance_api.py, since this suite is about CAPA
    # lifecycle, not auth.
    async def _override_current_user() -> StaffUser:
        return StaffUser(
            id=1, staff_id="test-admin", name="Test Admin", role="system_admin",
            department="Test", title="Test",
            password_hash="",
        )

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    fastapi_app.dependency_overrides[get_current_user] = _override_current_user
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.pop(get_db, None)
    fastapi_app.dependency_overrides.pop(get_current_user, None)
    await engine.dispose()


async def test_create_and_get_incident(client):
    resp = await client.post("/api/incidents", json={
        "incident_type": "near_miss",
        "title": "PPE shortage during isolation admission",
        "description": "N95 supply depleted during night shift.",
        "department": "ICU",
        "severity": "high",
        "reporter": "Charge Nurse",
        "linked_sop_ids": ["IC-PPE-001"],
    })
    assert resp.status_code == 200, resp.text
    incident = resp.json()
    assert incident["capa_count"] == 0
    assert incident["open_capa_count"] == 0

    got = await client.get(f"/api/incidents/{incident['id']}")
    assert got.status_code == 200
    assert got.json()["title"] == "PPE shortage during isolation admission"


async def test_incidents_list_sorted_and_paginated(client):
    for i in range(3):
        await client.post("/api/incidents", json={"title": f"Incident {i}"})
    listed = await client.get("/api/incidents?limit=2")
    assert listed.status_code == 200
    assert len(listed.json()["incidents"]) == 2


async def test_capa_lifecycle(client):
    inc = (await client.post("/api/incidents", json={"title": "Delayed sepsis bundle"})).json()
    incident_id = inc["id"]

    created = await client.post(f"/api/incidents/{incident_id}/capa", json={
        "root_cause": "Blood culture delay due to phlebotomy staffing gap.",
        "corrective_action": "Immediate re-training on concurrent draw protocol.",
        "preventive_action": "Add concurrent lactate + culture step to the SOP.",
        "owner": "Dr. Smith",
        "due_date": "2026-08-01",
    })
    assert created.status_code == 200, created.text
    capa = created.json()
    assert capa["status"] == "open"
    assert capa["incident_id"] == incident_id

    # Incident summary now reflects the open CAPA.
    got_incident = await client.get(f"/api/incidents/{incident_id}")
    assert got_incident.json()["capa_count"] == 1
    assert got_incident.json()["open_capa_count"] == 1

    # Move through statuses.
    updated = await client.put(f"/api/capa/{capa['id']}", json={"status": "investigating"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "investigating"
    assert updated.json()["closed_at"] is None

    closed = await client.put(f"/api/capa/{capa['id']}", json={"status": "closed"})
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"
    assert closed.json()["closed_at"] is not None

    # Incident summary now reflects zero open CAPAs.
    got_incident2 = await client.get(f"/api/incidents/{incident_id}")
    assert got_incident2.json()["open_capa_count"] == 0


async def test_capa_links_to_proposal(client):
    inc = (await client.post("/api/incidents", json={"title": "Fall risk assessment gap"})).json()
    capa = (await client.post(f"/api/incidents/{inc['id']}/capa", json={"root_cause": "Timing gap in SOP."})).json()

    proposal = (await client.post("/api/governance/proposals", json={"title": "Tighten fall-prevention timing"})).json()

    linked = await client.put(f"/api/capa/{capa['id']}", json={"linked_proposal_id": proposal["id"]})
    assert linked.status_code == 200
    assert linked.json()["linked_proposal_id"] == proposal["id"]


async def test_capa_rejects_invalid_status(client):
    inc = (await client.post("/api/incidents", json={"title": "Test"})).json()
    capa = (await client.post(f"/api/incidents/{inc['id']}/capa", json={})).json()
    bad = await client.put(f"/api/capa/{capa['id']}", json={"status": "not-a-real-status"})
    assert bad.status_code == 400


async def test_capa_for_nonexistent_incident_404s(client):
    resp = await client.post("/api/incidents/999/capa", json={"root_cause": "x"})
    assert resp.status_code == 404


async def test_list_all_capa_with_status_filter(client):
    inc = (await client.post("/api/incidents", json={"title": "Multi-CAPA incident"})).json()
    c1 = (await client.post(f"/api/incidents/{inc['id']}/capa", json={"title": "CAPA A"})).json()
    await client.post(f"/api/incidents/{inc['id']}/capa", json={"title": "CAPA B"})
    await client.put(f"/api/capa/{c1['id']}", json={"status": "closed"})

    open_only = await client.get("/api/capa?status=open")
    assert open_only.status_code == 200
    titles = [c["title"] for c in open_only.json()["capas"]]
    assert "CAPA B" in titles
    assert "CAPA A" not in titles


async def test_delete_capa(client):
    inc = (await client.post("/api/incidents", json={"title": "Deletable"})).json()
    capa = (await client.post(f"/api/incidents/{inc['id']}/capa", json={})).json()
    deleted = await client.delete(f"/api/capa/{capa['id']}")
    assert deleted.status_code == 200
    missing = await client.get(f"/api/capa/{capa['id']}")
    assert missing.status_code == 404
