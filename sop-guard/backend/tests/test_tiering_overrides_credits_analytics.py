"""Tests for alert tiering, override capture, CME/CPD credits, adoption
analytics, and the SMART on FHIR launch simulation.

Uses the same isolated-DB fixture pattern as test_governance_api.py.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.api.routes_governance import classify_tier


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_tiering.db'}"
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


# ── Notification tiering ────────────────────────────────────────


def test_classify_tier_critical_is_interruptive():
    assert classify_tier("conflict", "critical") == "interruptive"


def test_classify_tier_legal_flag_is_interruptive():
    assert classify_tier("legal_flag", "normal") == "interruptive"


def test_classify_tier_expiry_within_48h_is_interruptive():
    assert classify_tier("expiry", "normal", hours_until_deadline=24) == "interruptive"


def test_classify_tier_expiry_beyond_48h_not_interruptive():
    assert classify_tier("expiry", "normal", hours_until_deadline=200) != "interruptive"


def test_classify_tier_high_is_banner():
    assert classify_tier("info", "high") == "banner"


def test_classify_tier_normal_is_passive():
    assert classify_tier("info", "normal") == "passive"
    assert classify_tier("info", "low") == "passive"


async def test_notifications_include_tier_and_interruptive_count(client):
    resp = await client.get("/api/notifications")
    assert resp.status_code == 200
    data = resp.json()
    assert "interruptive_count_today" in data
    assert isinstance(data["interruptive_count_today"], int)
    for n in data["notifications"]:
        assert "tier" in n


# ── Overrides ────────────────────────────────────────────────────


async def test_override_create_list_summary(client):
    created = await client.post("/api/overrides", json={
        "context_type": "conflict",
        "context_id": "conflict-1",
        "user_id": "u1",
        "user_name": "Dr. Smith",
        "reason": "will_monitor",
        "note": "Monitoring patient closely.",
    })
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["reason"] == "will_monitor"
    assert body["context_type"] == "conflict"

    created2 = await client.post("/api/overrides", json={
        "context_type": "answer",
        "context_id": "answer-1",
        "user_id": "u2",
        "user_name": "Nurse Jones",
        "reason": "disagree_with_sop",
        "note": "",
    })
    assert created2.status_code == 200

    listed = await client.get("/api/overrides")
    assert listed.status_code == 200
    overrides = listed.json()["overrides"]
    assert len(overrides) == 2

    filtered = await client.get("/api/overrides?context_type=conflict")
    assert filtered.status_code == 200
    filtered_overrides = filtered.json()["overrides"]
    assert len(filtered_overrides) == 1
    assert filtered_overrides[0]["context_type"] == "conflict"

    summary = await client.get("/api/overrides/summary")
    assert summary.status_code == 200
    summary_data = summary.json()
    assert summary_data["total"] == 2
    assert summary_data["by_reason"]["will_monitor"] == 1
    assert summary_data["by_reason"]["disagree_with_sop"] == 1
    assert summary_data["by_context_type"]["conflict"] == 1
    assert summary_data["by_context_type"]["answer"] == 1


async def test_overrides_stewardship_ranks_repeated_alerts(client):
    """
    A stewardship view should surface alerts overridden more than once as
    candidates for review, and leave one-off overrides out by default.
    """
    # "conflict-1" overridden 3 times (by different users) -> a repeat offender.
    for i in range(3):
        resp = await client.post("/api/overrides", json={
            "context_type": "conflict",
            "context_id": "conflict-1",
            "context_label": "Sepsis vs. Cardiac Arrest MAP threshold conflict",
            "user_id": f"u{i}",
            "user_name": f"User {i}",
            "reason": "will_monitor",
            "note": "",
        })
        assert resp.status_code == 200

    # "answer-1" overridden only once -> should not appear with the default min_overrides=2.
    resp = await client.post("/api/overrides", json={
        "context_type": "answer",
        "context_id": "answer-1",
        "context_label": "What is the sepsis lactate threshold?",
        "user_id": "u9",
        "user_name": "User 9",
        "reason": "disagree_with_sop",
        "note": "",
    })
    assert resp.status_code == 200

    stewardship = await client.get("/api/overrides/stewardship")
    assert stewardship.status_code == 200
    data = stewardship.json()
    assert data["total_distinct_contexts"] == 2

    ids = [c["context_id"] for c in data["candidates"]]
    assert "conflict-1" in ids
    assert "answer-1" not in ids

    top = data["candidates"][0]
    assert top["context_id"] == "conflict-1"
    assert top["count"] == 3
    assert top["context_label"] == "Sepsis vs. Cardiac Arrest MAP threshold conflict"
    assert top["reasons"]["will_monitor"] == 3

    # min_overrides=1 should include the one-off answer override too.
    all_contexts = await client.get("/api/overrides/stewardship?min_overrides=1")
    all_ids = [c["context_id"] for c in all_contexts.json()["candidates"]]
    assert "answer-1" in all_ids


# ── Credits ──────────────────────────────────────────────────────


async def test_credit_create_user_total_and_leaderboard(client):
    r1 = await client.post("/api/credits", json={
        "user_id": "u1", "user_name": "Dr. Smith",
        "activity_type": "scenario_completed", "activity_title": "Sepsis drill",
        "credits": 1.5,
    })
    assert r1.status_code == 200, r1.text

    r2 = await client.post("/api/credits", json={
        "user_id": "u1", "user_name": "Dr. Smith",
        "activity_type": "sop_reviewed", "activity_title": "PPE Protocol review",
        "credits": 0.5,
    })
    assert r2.status_code == 200

    r3 = await client.post("/api/credits", json={
        "user_id": "u2", "user_name": "Nurse Jones",
        "activity_type": "committee_participation", "activity_title": "Governance meeting",
        "credits": 3.0,
    })
    assert r3.status_code == 200

    user_credits = await client.get("/api/credits?user_id=u1")
    assert user_credits.status_code == 200
    data = user_credits.json()
    assert len(data["credits"]) == 2
    assert data["total_credits"] == pytest.approx(2.0)

    leaderboard = await client.get("/api/credits/leaderboard")
    assert leaderboard.status_code == 200
    board = leaderboard.json()["leaderboard"]
    assert len(board) <= 5
    assert board[0]["user_id"] == "u2"
    assert board[0]["total_credits"] == pytest.approx(3.0)


async def test_credits_list_limit_does_not_shrink_total(client):
    """
    total_credits must sum ALL of a user's records even when the returned
    page (limit) is smaller than their full history - pagination changes
    what's displayed, not the aggregate.
    """
    for i in range(4):
        r = await client.post("/api/credits", json={
            "user_id": "u5", "user_name": "User Five",
            "activity_type": "scenario_completed", "activity_title": f"Drill {i}",
            "credits": 1.0,
        })
        assert r.status_code == 200

    limited = await client.get("/api/credits?user_id=u5&limit=2")
    assert limited.status_code == 200
    data = limited.json()
    assert len(data["credits"]) == 2
    assert data["total_credits"] == pytest.approx(4.0)


# ── Analytics ──────────────────────────────────────────────────


async def test_adoption_analytics_returns_expected_keys(client):
    resp = await client.get("/api/analytics/adoption")
    assert resp.status_code == 200
    data = resp.json()
    expected_keys = {
        "activation_funnel", "queries_total", "queries_this_week",
        "avg_faithfulness", "estimated_minutes_saved", "overrides_total",
        "overrides_by_reason", "credits_awarded_total",
        "notifications_by_tier", "note",
    }
    assert expected_keys.issubset(data.keys())
    funnel_keys = {"logged_in", "ran_query", "acknowledged_sop", "voted_on_proposal"}
    assert funnel_keys.issubset(data["activation_funnel"].keys())
    tier_keys = {"passive", "banner", "interruptive"}
    assert tier_keys.issubset(data["notifications_by_tier"].keys())


# ── SMART on FHIR launch simulation ───────────────────────────────


async def test_smart_launch_returns_expected_keys(client):
    resp = await client.get("/smart/launch", params={"iss": "https://ehr.example.org/fhir", "launch": "abc123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "authorization_url" in data
    assert data["authorization_url"].startswith("/smart/authorize")
    assert "launch_context" in data
    assert data["launch_context"]["patient"] == "sim-patient-12"
    assert data["launch_context"]["encounter"] == "sim-encounter-7"


async def test_smart_launch_missing_params_400(client):
    resp = await client.get("/smart/launch", params={"iss": "", "launch": ""})
    assert resp.status_code in (400, 422)


async def test_smart_authorize_returns_expected_keys(client):
    resp = await client.get("/smart/authorize", params={"state": "xyz"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"] == "sop-guard-demo-token"
    assert data["patient"] == "sim-patient-12"
    assert "scope" in data
