"""Tests for chat sessions, CDS Hooks service, entity-graph conflicts, and notifications.

Uses the same isolated-DB pattern as test_governance_api.py.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import SOP, SOPChunk
from app.rag.entity_graph import build_graph, find_conflicts


async def _seed_demo_sop(session_factory):
    """Insert one minimal SOP + chunk so pipeline/CDS routes have content to retrieve."""
    async with session_factory() as session:
        sop = SOP(
            sop_id="SOP-SEPSIS-001",
            title="Sepsis Management Protocol",
            department="ICU",
            version="1.0",
            raw_text="",
        )
        session.add(sop)
        await session.flush()
        session.add(SOPChunk(
            sop_id=sop.id,
            section_title="Vasopressor Therapy",
            chunk_text=(
                "If MAP remains below 65 mmHg after fluid resuscitation, start "
                "norepinephrine at 0.05 mcg/kg/min, titrate to a maximum of 3 mcg/kg/min. "
                "If norepinephrine dose exceeds 0.5 mcg/kg/min, add vasopressin 0.03 units/min."
            ),
            chunk_type="threshold",
            chunk_index=0,
        ))
        await session.commit()


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_chat.db'}"
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


@pytest.fixture
async def client_with_sop(tmp_path):
    """Same as `client`, but with a demo SOP + chunk pre-seeded."""
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_chat_seeded.db'}"
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    await _seed_demo_sop(TestSession)

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


# ── Chat sessions ────────────────────────────────────────────────


async def test_chat_session_flow(client_with_sop):
    client = client_with_sop
    created = await client.post("/api/chat/sessions", json={"title": "Sepsis question"})
    assert created.status_code == 200, created.text
    session_id = created.json()["id"]

    first = await client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "What is the maximum norepinephrine dose?"},
    )
    assert first.status_code == 200, first.text
    payload = first.json()
    assert payload["session_id"] == session_id
    assert payload["message_id"] is not None
    assert "answer" in payload

    second = await client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "What if the patient is also on vasopressin?"},
    )
    assert second.status_code == 200, second.text

    got = await client.get(f"/api/chat/sessions/{session_id}")
    assert got.status_code == 200
    data = got.json()
    # 2 user + 2 assistant messages persisted
    assert len(data["messages"]) == 4
    assert data["messages"][0]["role"] == "user"


async def test_chat_session_not_found(client):
    resp = await client.get("/api/chat/sessions/999999")
    assert resp.status_code == 404


# ── CDS Hooks ────────────────────────────────────────────────────


async def test_cds_discovery(client):
    resp = await client.get("/cds-services")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["services"]) >= 1
    assert data["services"][0]["hook"] == "order-select"


async def test_cds_protocol_check_returns_card(client_with_sop):
    client = client_with_sop
    resp = await client.post(
        "/cds-services/sop-guard-protocol-check",
        json={"context": {"medication": "norepinephrine", "dose": "0.1 mcg/kg/min"}},
    )
    assert resp.status_code == 200, resp.text
    cards = resp.json()["cards"]
    assert isinstance(cards, list)
    # Demo SOPs mention norepinephrine, so at least one card should come back.
    assert len(cards) >= 1
    assert cards[0]["indicator"] in ("info", "warning", "critical")


async def test_cds_protocol_check_no_medication(client):
    resp = await client.post("/cds-services/sop-guard-protocol-check", json={})
    assert resp.status_code == 200
    assert resp.json()["cards"] == []


# ── Entity graph conflicts ───────────────────────────────────────


def test_entity_graph_detects_conflicting_dose():
    chunks = [
        {
            "sop_id": "SOP-A",
            "sop_title": "Sepsis Protocol",
            "chunk_type": "threshold",
            "chunk_text": "Norepinephrine maximum dose is 3 mcg/kg/min before adding a second agent.",
        },
        {
            "sop_id": "SOP-B",
            "sop_title": "Rapid Response Protocol",
            "chunk_type": "threshold",
            "chunk_text": "Norepinephrine maximum dose is 5 mcg/kg/min per standard vasopressor protocol.",
        },
    ]
    graph = build_graph(chunks)
    conflicts = find_conflicts(graph)
    assert any(c["entity"] == "norepinephrine" for c in conflicts)


def test_entity_graph_no_conflict_when_values_match():
    chunks = [
        {
            "sop_id": "SOP-A",
            "sop_title": "Sepsis Protocol",
            "chunk_type": "threshold",
            "chunk_text": "Norepinephrine maximum dose is 3 mcg/kg/min.",
        },
        {
            "sop_id": "SOP-B",
            "sop_title": "Rapid Response Protocol",
            "chunk_type": "threshold",
            "chunk_text": "Norepinephrine maximum dose is 3 mcg/kg/min per protocol.",
        },
    ]
    graph = build_graph(chunks)
    conflicts = find_conflicts(graph)
    assert not any(c["entity"] == "norepinephrine" for c in conflicts)


# ── Notifications ────────────────────────────────────────────────


async def test_notifications_crud(client):
    listed = await client.get("/api/notifications?limit=20")
    assert listed.status_code == 200
    data = listed.json()
    assert "notifications" in data
    assert "unread_count" in data

    # Seed happens at app startup (lifespan), not in this isolated-DB fixture,
    # so this test DB may start empty. Exercise the read endpoints defensively.
    if data["notifications"]:
        first_id = data["notifications"][0]["id"]
        marked = await client.post(f"/api/notifications/{first_id}/read")
        assert marked.status_code == 200

    read_all = await client.post("/api/notifications/read-all")
    assert read_all.status_code == 200
    assert "marked" in read_all.json()


async def test_mark_missing_notification_404(client):
    resp = await client.post("/api/notifications/999999/read")
    assert resp.status_code == 404
