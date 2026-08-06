"""Tests for the eval-metrics snapshot history (routes_evaluation.py's
POST /api/evaluation/snapshot and GET /api/evaluation/snapshots).

Real gap this closes (D9): every eval harness (ragas-lite faithfulness,
quality_eval route accuracy, gold-answer correctness, the adversarial
verifier check) was computed on demand and shown once, then discarded -
there was no way to see whether a metric moved release over release. These
endpoints persist a point-in-time snapshot so a trend can actually be
plotted, without needing to touch the harnesses themselves.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import SOP, SOPChunk, StaffUser
from app.services.auth import get_current_user


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_snapshots.db'}"
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

    # /api/evaluation/snapshot* is nav-gated to system_admin (Phase T2) -
    # fixed-identity override, this suite is about snapshot persistence,
    # not auth.
    async def _override_current_user() -> StaffUser:
        return StaffUser(
            id=1, staff_id="test-admin", name="Test Admin", role="system_admin",
            department="Test", title="Test", password_hash="",
        )

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    fastapi_app.dependency_overrides[get_current_user] = _override_current_user
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=60.0) as ac:
        yield ac
    fastapi_app.dependency_overrides.pop(get_db, None)
    fastapi_app.dependency_overrides.pop(get_current_user, None)
    await engine.dispose()


@pytest.fixture
async def client_with_sop(client, tmp_path):
    # Reuses the same engine/session as `client` by calling through the
    # already-overridden get_db dependency's generator function, which
    # closes over the fixture's own TestSession/engine.
    get_session = fastapi_app.dependency_overrides[get_db]
    async for session in get_session():
        sop = SOP(
            sop_id="SOP-SEPSIS-001", title="Sepsis Management Protocol",
            department="ICU", version="1.0", raw_text="",
        )
        session.add(sop)
        await session.flush()
        session.add(SOPChunk(
            sop_id=sop.id, section_title="Vasopressor Therapy",
            chunk_text=(
                "If MAP remains below 65 mmHg after fluid resuscitation, start "
                "norepinephrine at 0.05 mcg/kg/min, titrate to a maximum of 3 mcg/kg/min."
            ),
            chunk_type="threshold", chunk_index=0,
        ))
        await session.commit()
        break
    return client


async def test_no_snapshots_returns_empty(client):
    resp = await client.get("/api/evaluation/snapshots")
    assert resp.status_code == 200
    assert resp.json() == {"snapshots": [], "total": 0}


async def test_snapshot_with_no_corpus_still_reports_adversarial_metrics(client):
    """Adversarial metrics run against fixed test cases, not the live
    corpus - a snapshot should still be recordable even with zero SOPs
    loaded, rather than erroring or silently omitting all metrics."""
    resp = await client.post("/api/evaluation/snapshot")
    assert resp.status_code == 200
    data = resp.json()
    assert "adversarial_sensitivity" in data["metrics"]
    assert "adversarial_specificity" in data["metrics"]
    assert data["corpus_sop_count"] == 0
    # No pipeline-dependent metrics when nothing is loaded.
    assert "faithfulness" not in data["metrics"]


async def test_snapshot_with_corpus_reports_all_metrics(client_with_sop):
    resp = await client_with_sop.post("/api/evaluation/snapshot", params={"label": "test run"})
    assert resp.status_code == 200
    data = resp.json()

    for key in (
        "faithfulness", "citation_coverage", "retrieval_precision",
        "route_accuracy", "correctness_pass_rate", "correctness_completeness",
        "adversarial_sensitivity", "adversarial_specificity",
    ):
        assert key in data["metrics"], f"missing metric: {key}"
        assert isinstance(data["metrics"][key], (int, float)) or data["metrics"][key] is None

    assert data["corpus_sop_count"] == 1
    assert data["label"] == "test run"
    assert data["id"] is not None
    assert data["created_at"] is not None


async def test_recorded_snapshots_appear_in_history_oldest_first(client_with_sop):
    first = await client_with_sop.post("/api/evaluation/snapshot", params={"label": "first"})
    second = await client_with_sop.post("/api/evaluation/snapshot", params={"label": "second"})
    assert first.status_code == 200 and second.status_code == 200

    resp = await client_with_sop.get("/api/evaluation/snapshots")
    data = resp.json()
    assert data["total"] == 2
    labels = [s["label"] for s in data["snapshots"]]
    assert labels == ["first", "second"]


async def test_limit_caps_history_size(client_with_sop):
    for i in range(3):
        await client_with_sop.post("/api/evaluation/snapshot", params={"label": f"run-{i}"})

    resp = await client_with_sop.get("/api/evaluation/snapshots", params={"limit": 2})
    data = resp.json()
    assert data["total"] == 2
    # The two most recent runs, still returned oldest-first within that window.
    assert [s["label"] for s in data["snapshots"]] == ["run-1", "run-2"]
