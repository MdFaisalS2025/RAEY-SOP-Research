"""Tests for the automatic unanswered-question analytics
(app/api/routes_gap_reports.py's /api/sop-gap-reports/auto-detected).

Unlike the manual gap-report flow (a user clicks "flag to committee" on a
single answer), this endpoint aggregates every logged query the pipeline
itself routed away from an SOP - so it surfaces coverage gaps whether or
not anyone bothered to flag them by hand.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import QueryLogRecord


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_gaps.db'}"
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
        ac._session_factory = TestSession
        yield ac
    fastapi_app.dependency_overrides.pop(get_db, None)
    await engine.dispose()


async def _seed(client, rows: list[dict]) -> None:
    async with client._session_factory() as session:
        for row in rows:
            session.add(QueryLogRecord(**row))
        await session.commit()


async def test_no_logged_queries_returns_empty(client):
    resp = await client.get("/api/sop-gap-reports/auto-detected")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_unanswered"] == 0
    assert data["clusters"] == []


async def test_sop_answered_queries_are_excluded(client):
    await _seed(client, [
        {"query_text": "What is the sepsis lactate threshold?", "route": "sop_library", "abstained": "false"},
        {"query_text": "What PPE is required for isolation?", "route": "hybrid", "abstained": "false"},
    ])
    resp = await client.get("/api/sop-gap-reports/auto-detected")
    data = resp.json()
    assert data["total_logged_queries"] == 2
    assert data["total_unanswered"] == 0


async def test_unanswered_routes_are_clustered_and_counted(client):
    await _seed(client, [
        {"query_text": "What is the protocol for jellyfish sting treatment?", "route": "external_evidence", "abstained": "false"},
        {"query_text": "What is the treatment protocol for jellyfish stings?", "route": "external_evidence", "abstained": "false"},
        {"query_text": "How do I fix a leaking kitchen faucet?", "route": "no_evidence", "abstained": "true"},
        {"query_text": "What is the sepsis lactate threshold?", "route": "sop_library", "abstained": "false"},
    ])
    resp = await client.get("/api/sop-gap-reports/auto-detected")
    data = resp.json()
    assert data["total_logged_queries"] == 4
    assert data["total_unanswered"] == 3
    # The two jellyfish-sting rephrasings should cluster together.
    jellyfish_cluster = next(
        c for c in data["clusters"] if "jellyfish" in c["representative_question"].lower()
    )
    assert jellyfish_cluster["count"] == 2
    assert jellyfish_cluster["most_common_route"] == "external_evidence"


async def test_legacy_abstained_row_with_default_route_is_labeled_honestly(client):
    """The route column was added after this table already had rows (see
    db.py's ALTER TABLE migration shim), so pre-existing abstained rows
    backfilled to the column default "sop_library" - a combination that
    should never occur for a row logged going forward. The endpoint must
    not pass that default through as if an SOP actually answered it."""
    await _seed(client, [
        {"query_text": "What is the cafeteria menu today?", "route": "sop_library", "abstained": "true"},
    ])
    resp = await client.get("/api/sop-gap-reports/auto-detected")
    data = resp.json()
    assert data["total_unanswered"] == 1
    cluster = data["clusters"][0]
    assert cluster["most_common_route"] == "unknown_prior_to_tracking"


async def test_min_count_filters_singleton_clusters(client):
    await _seed(client, [
        {"query_text": "What is the protocol for scorpion envenomation?", "route": "no_evidence", "abstained": "true"},
    ])
    resp = await client.get("/api/sop-gap-reports/auto-detected", params={"min_count": 2})
    data = resp.json()
    assert data["total_unanswered"] == 1
    assert data["clusters"] == []
