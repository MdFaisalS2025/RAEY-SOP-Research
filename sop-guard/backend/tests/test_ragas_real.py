"""
Tests for the real-RAGAS evaluation module (app/evaluation/ragas_real.py).

The actual ragas.evaluate() call happens in a subprocess (_ragas_worker.py)
and requires a live judge LLM, so these tests mock _llm_available and
_run_worker to exercise the surrounding logic (availability gating,
abstention skipping, NaN-vs-real-score handling, caching) without needing
Ollama running.
"""

import pytest

from app.config import settings
from app.evaluation import ragas_real


@pytest.fixture(autouse=True)
def _clear_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(ragas_real, "_CACHE_PATH", str(tmp_path / "last_ragas_eval.json"))
    # These tests exercise ragas_real's own gating/aggregation logic (mocked
    # via _llm_available/_run_worker below), not real generation - force
    # mock mode so pipeline.run() doesn't depend on a live local Ollama
    # server being reachable/fast during the test run.
    monkeypatch.setattr(settings, "LLM_PROVIDER", "mock")


async def test_unavailable_when_no_llm(monkeypatch):
    monkeypatch.setattr(ragas_real, "_llm_available", lambda: _async(False))
    result = await ragas_real.run_real_ragas_eval()
    assert result["available"] is False
    assert "reason" in result


async def test_worker_failure_reported_gracefully(monkeypatch):
    from app.evaluation.ragas_lite import _build_demo_pipeline

    monkeypatch.setattr(ragas_real, "_llm_available", lambda: _async(True))
    monkeypatch.setattr(ragas_real, "_run_worker", lambda rows, **kw: _async({"ok": False, "error": "boom"}))

    pipeline = _build_demo_pipeline()
    result = await ragas_real.run_real_ragas_eval(pipeline)
    assert result["available"] is False
    assert "boom" in result["reason"]


async def test_all_nan_scores_reported_as_unavailable(monkeypatch):
    from app.evaluation.ragas_lite import _build_demo_pipeline

    monkeypatch.setattr(ragas_real, "_llm_available", lambda: _async(True))

    async def fake_worker(rows, **kw):
        records = [
            {"faithfulness": None, "answer_relevancy": None, "llm_context_precision_without_reference": None}
            for _ in rows
        ]
        return {"ok": True, "records": records}

    monkeypatch.setattr(ragas_real, "_run_worker", fake_worker)

    pipeline = _build_demo_pipeline()
    result = await ragas_real.run_real_ragas_eval(pipeline)
    assert result["available"] is False
    assert "judge-LLM call failed" in result["reason"]


async def test_real_scores_produce_aggregate(monkeypatch):
    from app.evaluation.ragas_lite import _build_demo_pipeline

    monkeypatch.setattr(ragas_real, "_llm_available", lambda: _async(True))

    async def fake_worker(rows, **kw):
        records = [
            {"faithfulness": 0.8, "answer_relevancy": 0.7, "llm_context_precision_without_reference": 0.9}
            for _ in rows
        ]
        return {"ok": True, "records": records}

    monkeypatch.setattr(ragas_real, "_run_worker", fake_worker)

    pipeline = _build_demo_pipeline()
    result = await ragas_real.run_real_ragas_eval(pipeline)
    assert result["available"] is True
    assert result["aggregate"]["avg_faithfulness"] == 0.8
    assert result["aggregate"]["avg_response_relevancy"] == 0.7
    assert result["aggregate"]["avg_context_precision"] == 0.9
    assert result["sample_size"] > 0
    assert len(result["per_query"]) == result["sample_size"]


async def test_get_ragas_summary_caches_available_results(monkeypatch):
    from app.evaluation.ragas_lite import _build_demo_pipeline

    monkeypatch.setattr(ragas_real, "_llm_available", lambda: _async(True))
    calls = {"n": 0}

    async def fake_worker(rows, **kw):
        calls["n"] += 1
        records = [
            {"faithfulness": 0.5, "answer_relevancy": 0.5, "llm_context_precision_without_reference": 0.5}
            for _ in rows
        ]
        return {"ok": True, "records": records}

    monkeypatch.setattr(ragas_real, "_run_worker", fake_worker)

    pipeline = _build_demo_pipeline()
    first = await ragas_real.get_ragas_summary(pipeline)
    assert first["_cached"] is False
    second = await ragas_real.get_ragas_summary(pipeline)
    assert second["_cached"] is True
    assert calls["n"] == 1  # second call served from cache, not re-run

    third = await ragas_real.get_ragas_summary(pipeline, force=True)
    assert third["_cached"] is False
    assert calls["n"] == 2


async def _async(value):
    return value
