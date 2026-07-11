"""Tests for the short-TTL answer cache (app/services/answer_cache.py) and
its wiring into MeridianPipeline.run()/run_streaming() - cache hits should
skip generation entirely for repeat standalone questions, and conversation
follow-ups (history_context set) should never be cached or served from cache.
"""

import time

import pytest

from app.services import answer_cache
from app.schemas.schemas import QueryResponse
from app.agents.pipeline import MeridianPipeline


@pytest.fixture(autouse=True)
def _clear_cache():
    answer_cache.clear()
    yield
    answer_cache.clear()


def _response(answer="cached answer", abstained=False) -> QueryResponse:
    return QueryResponse(answer=answer, confidence=0.8, abstained=abstained)


class TestAnswerCacheUnit:
    def test_miss_then_hit(self):
        assert answer_cache.get("What is the max dose?", None) is None
        resp = _response()
        answer_cache.set("What is the max dose?", None, resp)
        assert answer_cache.get("What is the max dose?", None) is resp

    def test_normalizes_whitespace_and_case(self):
        resp = _response()
        answer_cache.set("What   is the MAX dose?", None, resp)
        assert answer_cache.get("what is the max dose?", None) is resp

    def test_different_news2_score_is_a_different_key(self):
        resp = _response()
        answer_cache.set("q", 5, resp)
        assert answer_cache.get("q", None) is None
        assert answer_cache.get("q", 7) is None
        assert answer_cache.get("q", 5) is resp

    def test_expires_after_ttl(self, monkeypatch):
        resp = _response()
        answer_cache.set("q", None, resp)
        future = time.time() + answer_cache._TTL_SECONDS + 1
        monkeypatch.setattr(answer_cache.time, "time", lambda: future)
        assert answer_cache.get("q", None) is None

    def test_evicts_oldest_when_over_capacity(self, monkeypatch):
        monkeypatch.setattr(answer_cache, "_MAX_ENTRIES", 2)
        answer_cache.set("q1", None, _response("a1"))
        answer_cache.set("q2", None, _response("a2"))
        answer_cache.set("q3", None, _response("a3"))
        assert len(answer_cache._store) == 2
        assert answer_cache.get("q1", None) is None  # oldest evicted
        assert answer_cache.get("q3", None) is not None


class TestPipelineCacheIntegration:
    """MeridianPipeline.run() should skip generation entirely on a cache
    hit for a standalone question, and never cache/serve a follow-up
    (history_context set)."""

    def _pipeline_with_forced_sufficiency(self, monkeypatch):
        pipeline = MeridianPipeline(chunks=[{"sop_id": "X", "text": "irrelevant"}], structured_sops={})
        monkeypatch.setattr(
            pipeline.evidence_checker, "check",
            lambda query, retrieved, query_type: {
                "sufficient": True, "score": 1.0, "reason": "forced", "missing": [], "recommendations": [],
            },
        )
        return pipeline

    async def test_second_standalone_call_skips_generation(self, monkeypatch):
        pipeline = self._pipeline_with_forced_sufficiency(monkeypatch)
        call_count = 0

        async def _fake_generate_answer(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return {
                "answer": "The max dose is 3 mcg/kg/min.", "citations": [], "inline_citations": [],
                "followup_questions": [], "reasoning_trace": [], "confidence": 0.8,
                "generation_mode": "mock", "abstained": False,
            }

        monkeypatch.setattr(pipeline.generator, "generate_answer", _fake_generate_answer)

        first = await pipeline.run(query="What is the max dose?")
        second = await pipeline.run(query="What is the max dose?")

        assert call_count == 1  # second call was served from cache
        assert second.answer == first.answer

    async def test_followup_with_history_is_never_cached_or_served(self, monkeypatch):
        pipeline = self._pipeline_with_forced_sufficiency(monkeypatch)
        call_count = 0

        async def _fake_generate_answer(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return {
                "answer": f"answer #{call_count}", "citations": [], "inline_citations": [],
                "followup_questions": [], "reasoning_trace": [], "confidence": 0.8,
                "generation_mode": "mock", "abstained": False,
            }

        monkeypatch.setattr(pipeline.generator, "generate_answer", _fake_generate_answer)

        first = await pipeline.run(query="Same question", history_context="Q: prior\nA: prior answer")
        second = await pipeline.run(query="Same question", history_context="Q: prior\nA: prior answer")

        assert call_count == 2  # neither call was cached/served
        assert first.answer != second.answer
