"""Tests for the Ollama-only LLM generator path.

httpx is monkeypatched so no real network calls are made and no local
Ollama server needs to be running for this suite to pass.
"""

import httpx
import pytest

from app.rag.llm_generator import LLMGenerator


class _FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._payload


class _FakeAvailableClient:
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
        assert url.endswith("/api/generate")
        assert json["model"] == "llama3.2"
        return _FakeResponse(200, {"response": "Give 500mL bolus. FOLLOWUPS:\nWhat next?"})


class _FakeUnavailableClient(_FakeAvailableClient):
    async def get(self, url):
        raise httpx.ConnectError("ollama not running")


class _FakeReachableButGenerateFailsClient(_FakeAvailableClient):
    """Server reachable (GET /api/tags succeeds) but the configured model
    isn't pulled, so POST /api/generate 404s - exercises the mock_fallback
    branch (as opposed to the "not available at all" mock branch)."""

    async def post(self, url, json=None):
        return _FakeResponse(404)


def test_provider_defaults_to_ollama():
    gen = LLMGenerator()
    assert gen.provider == "ollama"
    assert gen.base_url == "http://localhost:11434"
    assert gen.model == "llama3.2"


def test_no_openai_or_anthropic_call_path():
    """The generator must not expose any third-party API call methods."""
    assert not hasattr(LLMGenerator, "_call_openai")
    assert not hasattr(LLMGenerator, "_call_anthropic")


async def test_unknown_provider_raises():
    gen = LLMGenerator(provider="groq")
    with pytest.raises(ValueError, match="only 'ollama' and 'mock' are supported"):
        await gen._call_llm("prompt")


async def test_ollama_available_and_generates(monkeypatch):
    monkeypatch.setattr("app.rag.llm_generator.httpx.AsyncClient", _FakeAvailableClient)
    gen = LLMGenerator(provider="ollama", model="llama3.2")
    assert await gen._check_available() is True

    result = await gen.generate_answer("What is the bolus dose?", [
        {"sop_title": "Sepsis SOP", "text": "Give 500mL bolus.", "relevance_score": 0.9}
    ])
    assert result["generation_mode"] == "llm"
    assert "500mL bolus" in result["answer"]


async def test_ollama_unavailable_falls_back_to_mock(monkeypatch):
    monkeypatch.setattr("app.rag.llm_generator.httpx.AsyncClient", _FakeUnavailableClient)
    gen = LLMGenerator(provider="ollama", model="llama3.2")
    assert await gen._check_available() is False

    result = await gen.generate_answer("What is the bolus dose?", [
        {"sop_title": "Sepsis SOP", "text": "Give 500mL bolus.", "relevance_score": 0.9}
    ])
    assert result["generation_mode"] == "mock"
    assert result["faithfulness"] is not None


async def test_ollama_generate_fails_falls_back_to_mock_with_faithfulness(monkeypatch):
    """Regression test: the mock_fallback branch (server reachable but the
    generate call itself fails, e.g. model not pulled) used to skip
    faithfulness/sop_conflicts entirely, unlike the "not available" mock
    branch - silently leaving QueryResponse.faithfulness null for a common
    real-world case (misconfigured model name)."""
    monkeypatch.setattr("app.rag.llm_generator.httpx.AsyncClient", _FakeReachableButGenerateFailsClient)
    gen = LLMGenerator(provider="ollama", model="llama3.2")
    assert await gen._check_available() is True

    result = await gen.generate_answer("What is the bolus dose?", [
        {"sop_title": "Sepsis SOP", "text": "Give 500mL bolus.", "relevance_score": 0.9}
    ])
    assert result["generation_mode"] == "mock_fallback"
    assert result["faithfulness"] is not None
    assert "sentences" in result["faithfulness"]
    assert result["sop_conflicts"] == []
