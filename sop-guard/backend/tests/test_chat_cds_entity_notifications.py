"""Tests for chat sessions, CDS Hooks service, entity-graph conflicts, and notifications.

Uses the same isolated-DB pattern as test_governance_api.py.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import SOP, SOPChunk, StaffUser
from app.rag.entity_graph import build_graph, find_conflicts
from app.services.auth import get_current_user


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

    # POST /api/notifications/{id}/read and /read-all now require a
    # session (Phase T2) - fixed-identity override, this suite is about
    # chat/CDS/entity-graph/notification behavior, not auth.
    async def _override_current_user() -> StaffUser:
        return StaffUser(
            id=1, staff_id="test-admin", name="Test Admin", role="system_admin",
            department="Test", title="Test", password_hash="",
        )

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    fastapi_app.dependency_overrides[get_current_user] = _override_current_user
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.pop(get_db, None)
    fastapi_app.dependency_overrides.pop(get_current_user, None)
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

    # Chat session endpoints now require a session (ownership check) - fixed-
    # identity override, same as `client` above.
    async def _override_current_user() -> StaffUser:
        return StaffUser(
            id=1, staff_id="test-admin", name="Test Admin", role="system_admin",
            department="Test", title="Test", password_hash="",
        )

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    fastapi_app.dependency_overrides[get_current_user] = _override_current_user
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.pop(get_db, None)
    fastapi_app.dependency_overrides.pop(get_current_user, None)
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


async def test_chat_message_logs_query_with_route(client_with_sop):
    """Real gap this closes (P2.4): the chat endpoints - the actual "Ask
    Meridian" UI most users hit - never wrote a QueryLogRecord at all, only
    the separate one-shot /api/query endpoint did. That silently blinded
    any route-based coverage-gap analytics to the primary usage path."""
    client = client_with_sop
    created = await client.post("/api/chat/sessions", json={"title": "Sepsis question"})
    session_id = created.json()["id"]

    resp = await client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "What is the maximum norepinephrine dose?"},
    )
    assert resp.status_code == 200, resp.text

    gaps = await client.get("/api/sop-gap-reports/auto-detected")
    assert gaps.status_code == 200
    assert gaps.json()["total_logged_queries"] >= 1


async def test_chat_session_not_found(client):
    resp = await client.get("/api/chat/sessions/999999")
    assert resp.status_code == 404


async def test_chat_session_ownership_blocks_other_users(client):
    """The real gap this closes: routes_chat.py previously had no user_id
    column to check at all, so any authenticated user could list, open, or
    delete any other user's conversation. Created as user 1 (the `client`
    fixture's fixed identity); re-override to user 2 mid-test to prove that
    user can't read, post into, or delete user 1's session - each surfaces
    as a 404, not a 403, so a guessed session_id can't even confirm the
    session exists."""
    created = await client.post("/api/chat/sessions", json={"title": "User 1's session"})
    session_id = created.json()["id"]

    async def _override_as_user_2() -> StaffUser:
        return StaffUser(
            id=2, staff_id="test-other", name="Other User", role="clinical_staff",
            department="Test", title="Test", password_hash="",
        )

    fastapi_app.dependency_overrides[get_current_user] = _override_as_user_2
    try:
        got = await client.get(f"/api/chat/sessions/{session_id}")
        assert got.status_code == 404

        posted = await client.post(
            f"/api/chat/sessions/{session_id}/messages", json={"content": "snooping"}
        )
        assert posted.status_code == 404

        deleted = await client.delete(f"/api/chat/sessions/{session_id}")
        assert deleted.status_code == 404

        listed = await client.get("/api/chat/sessions")
        assert session_id not in [s["id"] for s in listed.json()["sessions"]]
    finally:
        # Restore user 1 so the fixture's own teardown pop() targets the
        # override it actually installed.
        async def _override_current_user() -> StaffUser:
            return StaffUser(
                id=1, staff_id="test-admin", name="Test Admin", role="system_admin",
                department="Test", title="Test", password_hash="",
            )
        fastapi_app.dependency_overrides[get_current_user] = _override_current_user

    # User 1 (the owner) can still reach it.
    still_owner = await client.get(f"/api/chat/sessions/{session_id}")
    assert still_owner.status_code == 200


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
        "/cds-services/meridian-protocol-check",
        json={"context": {"medication": "norepinephrine", "dose": "0.1 mcg/kg/min"}},
    )
    assert resp.status_code == 200, resp.text
    cards = resp.json()["cards"]
    assert isinstance(cards, list)
    # Demo SOPs mention norepinephrine, so at least one card should come back.
    assert len(cards) >= 1
    assert cards[0]["indicator"] in ("info", "warning", "critical")


async def test_cds_protocol_check_no_medication(client):
    resp = await client.post("/cds-services/meridian-protocol-check", json={})
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


def test_entity_graph_no_false_positive_between_delta_and_absolute_threshold():
    """Real bug found in a full-app audit: 'SBP drop >=30 mmHg' (a
    transfusion-reaction trigger - a *change* in blood pressure) and
    'SBP >200 mmHg' (an absolute hypertension contraindication) were
    flagged as conflicting SBP values, even though they describe
    different clinical facts that only share a parameter name and unit."""
    chunks = [
        {
            "sop_id": "GEN-002",
            "sop_title": "Blood Transfusion Protocol",
            "chunk_type": "threshold",
            "chunk_text": "Stop transfusion for fever, urticaria/anaphylaxis, SBP drop >=30 mmHg, HR increase >=20 bpm.",
        },
        {
            "sop_id": "PHARM-005",
            "sop_title": "Anticoagulation Safety Protocol",
            "chunk_type": "contraindication",
            "chunk_text": "Contraindicated: severe uncontrolled hypertension (SBP >200 mmHg or DBP >120 mmHg).",
        },
    ]
    graph = build_graph(chunks)
    conflicts = find_conflicts(graph)
    assert not any(c["entity"] == "sbp" for c in conflicts)


def test_entity_graph_still_detects_two_absolute_sbp_thresholds():
    """The delta-vs-absolute distinction must not swallow real conflicts
    between two genuinely absolute readings for the same parameter."""
    chunks = [
        {
            "sop_id": "SOP-A",
            "sop_title": "Protocol A",
            "chunk_type": "threshold",
            "chunk_text": "Hold medication if SBP <90 mmHg.",
        },
        {
            "sop_id": "SOP-B",
            "sop_title": "Protocol B",
            "chunk_type": "threshold",
            "chunk_text": "Hold medication if SBP <100 mmHg.",
        },
    ]
    graph = build_graph(chunks)
    conflicts = find_conflicts(graph)
    assert any(c["entity"] == "sbp" for c in conflicts)


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


@pytest.fixture
async def client_with_notification(tmp_path):
    """Same isolated-DB pattern as `client`, but seeds one real
    NotificationRecord directly (there's no public POST endpoint to create
    one - they're only emitted internally via _emit_notification), so the
    per-user read-state test below has something real to mark read."""
    from app.models.models import NotificationRecord

    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_notif.db'}"
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async with TestSession() as session:
        session.add(NotificationRecord(
            type="info", title="Test notification", description="",
            priority="normal", tier="passive",
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


async def test_notification_read_state_is_per_user(client_with_notification):
    """The real bug this closes: NotificationRecord.read used to be one
    boolean shared by every viewer, so user A marking a notification read
    silently cleared it for user B too, even though B never opened it."""
    client = client_with_notification

    async def _as_user(user_id: str, role: str = "clinical_staff"):
        async def _override() -> StaffUser:
            return StaffUser(
                id=1 if user_id == "user-a" else 2, staff_id=user_id, name=user_id,
                role=role, department="Test", title="Test", password_hash="",
            )
        fastapi_app.dependency_overrides[get_current_user] = _override

    await _as_user("user-a")
    listed = await client.get("/api/notifications")
    notification_id = listed.json()["notifications"][0]["id"]
    assert listed.json()["notifications"][0]["read"] is False
    assert listed.json()["unread_count"] == 1

    marked = await client.post(f"/api/notifications/{notification_id}/read")
    assert marked.status_code == 200

    # User A now sees it as read.
    after_a = await client.get("/api/notifications")
    assert after_a.json()["notifications"][0]["read"] is True
    assert after_a.json()["unread_count"] == 0

    # User B, who never marked anything, still sees it unread.
    await _as_user("user-b")
    as_b = await client.get("/api/notifications")
    assert as_b.json()["notifications"][0]["read"] is False
    assert as_b.json()["unread_count"] == 1

    fastapi_app.dependency_overrides.pop(get_current_user, None)
