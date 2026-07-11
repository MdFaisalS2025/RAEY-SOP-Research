"""Tests for the streaming query endpoint (/api/query/stream).

No live Ollama server is expected in CI, so these exercise the same
mock-fallback path the non-streaming endpoint already relies on
(LLMGenerator._check_available() returns False -> stream_answer() emits the
whole mock answer as a single token chunk, then a final event) - the point
of these tests is the SSE framing and event sequencing, not live generation.
"""

import json

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import SOP, SOPChunk


async def _seed_demo_sop(session_factory):
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
                "norepinephrine at 0.05 mcg/kg/min, titrate to a maximum of 3 mcg/kg/min."
            ),
            chunk_type="threshold",
            chunk_index=0,
        ))
        await session.commit()


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_stream.db'}"
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
async def client_with_sop(client, tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_stream_seeded.db'}"
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
    yield client
    await engine.dispose()


def _parse_sse_events(raw_text: str) -> list[dict]:
    events = []
    for line in raw_text.splitlines():
        line = line.strip()
        if not line.startswith("data: "):
            continue
        payload = line[len("data: "):]
        if payload == "[DONE]":
            continue
        events.append(json.loads(payload))
    return events


async def test_stream_returns_sse_content_type(client_with_sop):
    resp = await client_with_sop.post(
        "/api/query/stream",
        json={"query": "What is the maximum norepinephrine dose?"},
    )
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]


async def test_stream_emits_token_then_final_event(client_with_sop):
    resp = await client_with_sop.post(
        "/api/query/stream",
        json={"query": "What is the maximum norepinephrine dose?"},
    )
    events = _parse_sse_events(resp.text)
    assert len(events) >= 2

    token_events = [e for e in events if e["type"] == "token"]
    final_events = [e for e in events if e["type"] == "final"]

    assert len(token_events) >= 1
    assert all(isinstance(e["text"], str) and e["text"] for e in token_events)

    assert len(final_events) == 1
    final = final_events[0]["response"]
    assert "answer" in final and final["answer"]
    assert "retrieved_chunks" in final
    assert "query_type" in final


async def test_stream_no_sops_returns_404(client):
    resp = await client.post(
        "/api/query/stream",
        json={"query": "What is the maximum norepinephrine dose?"},
    )
    assert resp.status_code == 404


async def test_stream_final_event_matches_non_streaming_shape(client_with_sop):
    """The streamed final response should carry the same fields the
    non-streaming /api/query endpoint returns, just delivered over SSE."""
    non_streaming = await client_with_sop.post(
        "/api/query", json={"query": "What is the maximum norepinephrine dose?"}
    )
    assert non_streaming.status_code == 200
    non_streaming_keys = set(non_streaming.json().keys())

    streamed = await client_with_sop.post(
        "/api/query/stream", json={"query": "What is the maximum norepinephrine dose?"}
    )
    events = _parse_sse_events(streamed.text)
    final = next(e for e in events if e["type"] == "final")["response"]

    assert set(final.keys()) == non_streaming_keys
