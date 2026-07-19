"""Tests for Phase E: token usage capture (LLMGenerator._call_groq/
_call_ollama -> generate_answer -> QueryResponse.token_usage) and its
logging into QueryLogRecord (app/services/query_log.py).

httpx is monkeypatched, same pattern as test_llm_generator_ollama.py - no
real network calls, no local Ollama/Groq needed.
"""

import httpx
import pytest

from app.config import settings
from app.rag.llm_generator import LLMGenerator
from app.schemas.schemas import QueryResponse


class _FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._payload


class _FakeGroqClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, headers=None, json=None):
        return _FakeResponse(200, {
            "choices": [{"message": {"content": "Give 500mL bolus. FOLLOWUPS:\nWhat next?"}}],
            "usage": {"prompt_tokens": 120, "completion_tokens": 40, "total_tokens": 160},
        })


class _FakeGroqClientNoUsage(_FakeGroqClient):
    async def post(self, url, headers=None, json=None):
        return _FakeResponse(200, {
            "choices": [{"message": {"content": "Give 500mL bolus."}}],
        })


class _FakeOllamaAvailableClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url):
        assert url.endswith("/api/tags")
        return _FakeResponse(200)

    async def post(self, url, json=None):
        return _FakeResponse(200, {
            "response": "Give 500mL bolus. FOLLOWUPS:\nWhat next?",
            "prompt_eval_count": 200,
            "eval_count": 55,
        })


class TestGroqTokenUsage:
    async def test_generate_answer_captures_groq_usage(self, monkeypatch):
        monkeypatch.setattr(settings, "GROQ_API_KEY", "fake-key")
        monkeypatch.setattr("app.rag.llm_generator.httpx.AsyncClient", _FakeGroqClient)
        gen = LLMGenerator(provider="groq", model="llama-3.1-8b-instant")
        result = await gen.generate_answer("What is the bolus dose?", [
            {"sop_title": "Sepsis SOP", "text": "Give 500mL bolus.", "relevance_score": 0.9}
        ])
        assert result["token_usage"] == {
            "prompt_tokens": 120, "completion_tokens": 40, "total_tokens": 160,
        }

    async def test_missing_usage_field_leaves_token_usage_none(self, monkeypatch):
        monkeypatch.setattr(settings, "GROQ_API_KEY", "fake-key")
        monkeypatch.setattr("app.rag.llm_generator.httpx.AsyncClient", _FakeGroqClientNoUsage)
        gen = LLMGenerator(provider="groq", model="llama-3.1-8b-instant")
        result = await gen.generate_answer("What is the bolus dose?", [
            {"sop_title": "Sepsis SOP", "text": "Give 500mL bolus.", "relevance_score": 0.9}
        ])
        assert result["token_usage"] is None

    async def test_usage_does_not_leak_across_calls(self, monkeypatch):
        """Real bug this guards against: _last_token_usage is an instance
        attribute set by _call_groq - if generate_answer didn't reset it
        before each call, a later request whose provider response omits
        usage would silently report the PREVIOUS request's token counts."""
        monkeypatch.setattr(settings, "GROQ_API_KEY", "fake-key")
        monkeypatch.setattr("app.rag.llm_generator.httpx.AsyncClient", _FakeGroqClient)
        gen = LLMGenerator(provider="groq", model="llama-3.1-8b-instant")
        first = await gen.generate_answer("q1", [
            {"sop_title": "Sepsis SOP", "text": "Give 500mL bolus.", "relevance_score": 0.9}
        ])
        assert first["token_usage"] is not None

        monkeypatch.setattr("app.rag.llm_generator.httpx.AsyncClient", _FakeGroqClientNoUsage)
        second = await gen.generate_answer("q2", [
            {"sop_title": "Sepsis SOP", "text": "Give 500mL bolus.", "relevance_score": 0.9}
        ])
        assert second["token_usage"] is None


class TestOllamaTokenUsage:
    async def test_generate_answer_captures_ollama_usage(self, monkeypatch):
        monkeypatch.setattr("app.rag.llm_generator.httpx.AsyncClient", _FakeOllamaAvailableClient)
        gen = LLMGenerator(provider="ollama", model="llama3.2")
        result = await gen.generate_answer("What is the bolus dose?", [
            {"sop_title": "Sepsis SOP", "text": "Give 500mL bolus.", "relevance_score": 0.9}
        ])
        assert result["token_usage"] == {
            "prompt_tokens": 200, "completion_tokens": 55, "total_tokens": 255,
        }


class TestMockModeTokenUsage:
    async def test_mock_mode_has_no_token_usage(self, monkeypatch):
        monkeypatch.setattr(settings, "GROQ_API_KEY", "")
        gen = LLMGenerator(provider="groq", model="llama-3.1-8b-instant")
        result = await gen.generate_answer("What is the bolus dose?", [
            {"sop_title": "Sepsis SOP", "text": "Give 500mL bolus.", "relevance_score": 0.9}
        ])
        assert result["generation_mode"] == "mock"
        assert result["token_usage"] is None


class TestQueryLogTokenUsage:
    async def test_log_query_result_stores_token_counts(self):
        from app.services.query_log import log_query_result
        from app.database.db import Base
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        Session = async_sessionmaker(engine, expire_on_commit=False)

        response = QueryResponse(
            answer="Give 500mL bolus.", confidence=0.8, generation_mode="llm",
            route="sop_library",
            token_usage={"prompt_tokens": 120, "completion_tokens": 40, "total_tokens": 160},
        )
        async with Session() as db:
            log_id = await log_query_result(db, "What is the bolus dose?", response)
            assert log_id is not None

            from app.models.models import QueryLogRecord
            row = await db.get(QueryLogRecord, log_id)
            assert row.prompt_tokens == 120
            assert row.completion_tokens == 40
            assert row.total_tokens == 160
            assert row.generation_mode == "llm"
        await engine.dispose()

    async def test_log_query_result_handles_no_token_usage(self):
        """A no_evidence/clarification answer has generation_mode="" and
        token_usage=None - the log row must store NULLs, not zeros, so a
        usage report can distinguish "not measured" from "measured at 0"."""
        from app.services.query_log import log_query_result
        from app.database.db import Base
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        Session = async_sessionmaker(engine, expire_on_commit=False)

        response = QueryResponse(answer="No matching SOP found.", confidence=0.1, route="no_evidence")
        async with Session() as db:
            log_id = await log_query_result(db, "unrelated question", response)
            from app.models.models import QueryLogRecord
            row = await db.get(QueryLogRecord, log_id)
            assert row.prompt_tokens is None
            assert row.completion_tokens is None
            assert row.total_tokens is None
            assert row.generation_mode == ""
        await engine.dispose()
