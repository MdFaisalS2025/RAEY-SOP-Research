"""Tests for the proactive change-impact assessment (app/services/change_impact.py)."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.rag import entity_graph


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_impact.db'}"
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


@pytest.fixture(autouse=True)
def _reset_entity_graph():
    """Isolate each test from the process-wide cached entity graph."""
    original = entity_graph.get_global_graph()
    entity_graph.set_global_graph({})
    yield
    entity_graph.set_global_graph(original)


async def test_impact_unavailable_without_new_text(client):
    resp = await client.post("/api/governance/proposals", json={"title": "No text proposal"})
    pid = resp.json()["id"]
    impact = await client.get(f"/api/governance/proposals/{pid}/impact")
    assert impact.status_code == 200
    assert impact.json()["available"] is False


async def test_impact_detects_new_conflict(client):
    # Seed the global entity graph with another SOP's norepinephrine max dose.
    entity_graph.set_global_graph({
        "DRUG:norepinephrine": [{
            "sop_id": "SOP-ICU-001", "sop_title": "Sepsis Protocol", "chunk_type": "threshold",
            "value": 3.0, "unit": "mcg/kg/min", "context_snippet": "Max norepinephrine 3 mcg/kg/min",
        }],
    })

    resp = await client.post("/api/governance/proposals", json={
        "title": "Conflicting dose change",
        "affected_sop_id": "SOP-OTHER-002",
        "payload": {"new_text": "Give norepinephrine up to 5 mcg/kg/min for refractory shock."},
    })
    pid = resp.json()["id"]

    impact = await client.get(f"/api/governance/proposals/{pid}/impact")
    assert impact.status_code == 200
    data = impact.json()
    assert data["available"] is True
    assert len(data["new_conflicts"]) >= 1
    assert data["risk_level"] == "critical"


async def test_impact_counts_stale_acknowledgments_and_attestations(client):
    await client.post("/api/governance/acknowledgments", json={
        "sop_id": "SOP-ACK-001", "user_id": "u1", "user_name": "User One",
    })
    await client.post("/api/governance/acknowledgments", json={
        "sop_id": "SOP-ACK-001", "user_id": "u2", "user_name": "User Two",
    })
    await client.post("/api/governance/attestations", json={
        "sop_id": "SOP-ACK-001", "sop_version": "1.0", "user_id": "u1", "user_name": "User One",
        "second_factor_confirmation": "User One",
    })

    resp = await client.post("/api/governance/proposals", json={
        "title": "Change to acknowledged SOP",
        "affected_sop_id": "SOP-ACK-001",
        "payload": {"new_text": "Updated procedure text with no clinical entities."},
    })
    pid = resp.json()["id"]

    impact = await client.get(f"/api/governance/proposals/{pid}/impact")
    data = impact.json()
    assert data["available"] is True
    assert data["stale_acknowledgments"] == 2
    assert data["stale_attestations"] == 1


async def test_impact_low_risk_when_no_conflicts_or_history(client):
    resp = await client.post("/api/governance/proposals", json={
        "title": "Harmless change",
        "affected_sop_id": "SOP-NEW-999",
        "payload": {"new_text": "A purely administrative wording change."},
    })
    pid = resp.json()["id"]

    impact = await client.get(f"/api/governance/proposals/{pid}/impact")
    data = impact.json()
    assert data["available"] is True
    assert data["risk_level"] == "low"
    assert data["new_conflicts"] == []
