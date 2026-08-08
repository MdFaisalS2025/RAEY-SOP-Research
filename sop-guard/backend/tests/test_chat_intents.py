"""Tests for Phase B.1: version-history/comparison chat-intent routing
(app/services/chat_intents.py, wired into app/api/routes_chat.py).

Real gap this closes: "what changed in the sepsis SOP?" and "compare the
sepsis SOP with current clinical evidence" are real chat questions with
real backend data behind them (SOPVersionRecord, sop_comparison.py) - but
previously fell straight into normal RAG retrieval/generation, which has
no access to that data and would either hallucinate or abstain.

Uses the same isolated-DB pattern as test_chat_cds_entity_notifications.py.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import SOP, SOPChunk, SOPVersionRecord, StaffUser
from app.services.sop_comparison import REFERENCE_PROTOCOLS
from app.services.auth import get_current_user


async def _seed_sepsis_sop(session_factory):
    """Sepsis SOP with a chunk (so retrieval can identify it), version
    history, and structured steps that match REFERENCE_PROTOCOLS so the
    curated comparison path has something to align against."""
    async with session_factory() as session:
        sop = SOP(
            sop_id="SOP-ICU-001",
            title="Sepsis Management Protocol",
            department="ICU",
            version="2.1",
            raw_text="",
            structured_json={
                "steps": [{"step": i + 1, "action": step["text"]}
                          for i, step in enumerate(REFERENCE_PROTOCOLS["SOP-ICU-001"]["steps"])]
            },
        )
        session.add(sop)
        await session.flush()
        session.add(SOPChunk(
            sop_id=sop.id,
            section_title="Sepsis Overview",
            chunk_text=(
                "Sepsis Management Protocol: screen for suspected sepsis, measure "
                "lactate, obtain blood cultures, administer broad-spectrum antibiotics, "
                "begin fluid resuscitation for hypotension or lactate >= 4 mmol/L."
            ),
            chunk_type="summary",
            chunk_index=0,
        ))
        session.add(SOPVersionRecord(
            sop_id="SOP-ICU-001", version_number="1.0", status="archived",
            effective_date="2023-06-01", new_text="v1 text",
            summary_of_changes="Original sepsis response protocol.",
        ))
        session.add(SOPVersionRecord(
            sop_id="SOP-ICU-001", version_number="2.1", status="current",
            effective_date="2025-01-15", old_text="v1 text", new_text="v2.1 text",
            summary_of_changes="Clarified reassessment criteria and lactate thresholds.",
        ))
        await session.commit()


@pytest.fixture
async def client_with_sop(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_chat_intents.db'}"
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    await _seed_sepsis_sop(TestSession)

    async def _override_get_db():
        async with TestSession() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    # Chat session endpoints now require a session (ownership check) -
    # fixed-identity override, same pattern as test_chat_cds_entity_notifications.py.
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


async def _new_session(client):
    created = await client.post("/api/chat/sessions", json={"title": "test"})
    assert created.status_code == 200, created.text
    return created.json()["id"]


async def test_version_history_question_routes_to_chat_intent(client_with_sop):
    client = client_with_sop
    session_id = await _new_session(client)

    resp = await client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "Show me the version history of the sepsis SOP."},
    )
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["query_type"] == "version_history"
    assert payload["route"] == "sop_library"
    assert "v1.0" in payload["answer"]
    assert "v2.1" in payload["answer"]
    assert "no generation model used" in payload["reasoning_trace"][-1]


async def test_comparison_question_routes_to_chat_intent(client_with_sop, monkeypatch):
    # Live guideline retrieval is tried first for every SOP (Q3.6) - disable
    # it so this test deterministically exercises the curated fallback path
    # instead of depending on whatever a live search happens to find for
    # "Sepsis Management Protocol" at test-run time.
    async def fake_no_guideline(sop_id, sop_title, internal_steps, sim_fn=None):
        return None

    import app.services.sop_comparison as sop_comparison_mod
    monkeypatch.setattr(sop_comparison_mod, "compare_sop_to_guideline", fake_no_guideline)

    client = client_with_sop
    session_id = await _new_session(client)

    resp = await client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "Compare the sepsis SOP with current clinical evidence."},
    )
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["query_type"] == "comparison"
    assert payload["route"] == "hybrid"
    assert "curated" in payload["answer"] or "Aligned" in payload["answer"] or "alignment" in payload["answer"].lower()
    assert "no generation model used" in payload["reasoning_trace"][-1]


async def test_version_history_falls_through_when_no_history(client_with_sop):
    """A SOP with no SOPVersionRecord rows must fall through to normal
    RAG rather than crash or return an empty special-cased answer."""
    client = client_with_sop
    session_id = await _new_session(client)

    resp = await client.post(
        f"/api/chat/sessions/{session_id}/messages",
        json={"content": "What is the version history of a nonexistent protocol xyz123?"},
    )
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload["query_type"] != "version_history" or "Version History" not in payload.get("reasoning_trace", [""])[0]


async def test_streaming_version_history_emits_final_event(client_with_sop):
    client = client_with_sop
    session_id = await _new_session(client)

    async with client.stream(
        "POST",
        f"/api/chat/sessions/{session_id}/messages/stream",
        json={"content": "Show me the version history of the sepsis SOP."},
    ) as resp:
        assert resp.status_code == 200
        body = b""
        async for chunk in resp.aiter_bytes():
            body += chunk
    text = body.decode("utf-8")
    assert '"type": "final"' in text or '"type":"final"' in text
    assert "v2.1" in text
