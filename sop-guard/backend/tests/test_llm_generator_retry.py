"""Tests for the Ollama concurrency limiter and retry-with-backoff logic
added after observing a real 500 from a second concurrent request against
a local Ollama instance mid-generation.

httpx and asyncio.sleep are monkeypatched so the suite runs instantly and
makes no real network calls.
"""

import httpx
import pytest

from app.rag import llm_generator as llm_generator_module
from app.rag.llm_generator import LLMGenerator, _is_retryable


class _FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=None, response=self)

    def json(self):
        return self._payload


class _FlakyThenSucceedsClient:
    """First POST /api/generate 503s (transient), second succeeds."""
    calls = 0

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url):
        return _FakeResponse(200)

    async def post(self, url, json=None):
        type(self).calls += 1
        if type(self).calls == 1:
            return _FakeResponse(503)
        return _FakeResponse(200, {"response": "Give 500mL bolus."})


class _AlwaysServerErrorClient(_FlakyThenSucceedsClient):
    calls = 0

    async def post(self, url, json=None):
        type(self).calls += 1
        return _FakeResponse(500)


class _AlwaysBadRequestClient(_FlakyThenSucceedsClient):
    calls = 0

    async def post(self, url, json=None):
        type(self).calls += 1
        return _FakeResponse(400)


def test_is_retryable_classifies_5xx_and_network_errors_only():
    assert _is_retryable(httpx.ConnectError("down")) is True
    assert _is_retryable(httpx.ReadTimeout("slow")) is True
    server_err = httpx.HTTPStatusError("x", request=None, response=_FakeResponse(500))
    assert _is_retryable(server_err) is True
    client_err = httpx.HTTPStatusError("x", request=None, response=_FakeResponse(404))
    assert _is_retryable(client_err) is False


async def test_call_ollama_retries_transient_failure_and_succeeds(monkeypatch):
    monkeypatch.setattr(llm_generator_module.httpx, "AsyncClient", _FlakyThenSucceedsClient)
    monkeypatch.setattr(llm_generator_module.asyncio, "sleep", _no_sleep)
    _FlakyThenSucceedsClient.calls = 0

    gen = LLMGenerator(provider="ollama", model="llama3.2")
    result = await gen._call_ollama("prompt")
    assert result == "Give 500mL bolus."
    assert _FlakyThenSucceedsClient.calls == 2


async def test_call_ollama_gives_up_after_max_retries(monkeypatch):
    monkeypatch.setattr(llm_generator_module.httpx, "AsyncClient", _AlwaysServerErrorClient)
    monkeypatch.setattr(llm_generator_module.asyncio, "sleep", _no_sleep)
    monkeypatch.setattr(llm_generator_module.settings, "LLM_MAX_RETRIES", 2)
    _AlwaysServerErrorClient.calls = 0

    gen = LLMGenerator(provider="ollama", model="llama3.2")
    with pytest.raises(httpx.HTTPStatusError):
        await gen._call_ollama("prompt")
    assert _AlwaysServerErrorClient.calls == 3  # initial attempt + 2 retries


async def test_call_ollama_does_not_retry_client_errors(monkeypatch):
    monkeypatch.setattr(llm_generator_module.httpx, "AsyncClient", _AlwaysBadRequestClient)
    monkeypatch.setattr(llm_generator_module.asyncio, "sleep", _no_sleep)
    _AlwaysBadRequestClient.calls = 0

    gen = LLMGenerator(provider="ollama", model="llama3.2")
    with pytest.raises(httpx.HTTPStatusError):
        await gen._call_ollama("prompt")
    assert _AlwaysBadRequestClient.calls == 1  # no retry on a 4xx


async def test_generate_answer_falls_back_to_mock_after_exhausting_retries(monkeypatch):
    """End-to-end: a persistently-failing Ollama call still degrades to a
    mock answer rather than surfacing a 500 to the user, same as the
    existing "unreachable" fallback path."""
    monkeypatch.setattr(llm_generator_module.httpx, "AsyncClient", _AlwaysServerErrorClient)
    monkeypatch.setattr(llm_generator_module.asyncio, "sleep", _no_sleep)
    _AlwaysServerErrorClient.calls = 0

    gen = LLMGenerator(provider="ollama", model="llama3.2")
    result = await gen.generate_answer("What is the bolus dose?", [
        {"sop_title": "Sepsis SOP", "text": "Give 500mL bolus.", "relevance_score": 0.9}
    ])
    assert result["generation_mode"] == "mock_fallback"
    assert result["faithfulness"] is not None


async def _no_sleep(_seconds):
    return None
