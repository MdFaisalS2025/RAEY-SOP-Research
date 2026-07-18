"""
Tests for the answer-correctness harness (app/evaluation/answer_correctness.py).

Runs in deterministic (completeness-only) mode - use_judge=False - so the
suite is fast and never depends on a live/rate-limited model. A separate unit
test covers the judge-response parser directly.
"""

import pytest

from app.evaluation.answer_correctness import (
    completeness,
    _parse_judge,
    run_correctness_eval,
)


class TestCompleteness:
    def test_all_facts_present(self):
        assert completeness("Give 30 mL/kg within 3 hours", ("30 ml/kg", "3 hour")) == 1.0

    def test_partial(self):
        assert completeness("Give 30 mL/kg", ("30 ml/kg", "3 hour")) == 0.5

    def test_no_required_facts_is_full(self):
        assert completeness("anything", ()) == 1.0


class TestJudgeParser:
    def test_parses_plain_json(self):
        out = _parse_judge('{"equivalent": 0.9, "missing": [], "wrong": []}')
        assert out["equivalent"] == 0.9

    def test_parses_json_in_code_fence_with_prose(self):
        raw = 'Here is my judgment:\n```json\n{"equivalent": 1.0, "missing": []}\n```\nDone.'
        assert _parse_judge(raw)["equivalent"] == 1.0

    def test_clamps_out_of_range(self):
        assert _parse_judge('{"equivalent": 1.7}')["equivalent"] == 1.0

    def test_returns_none_on_garbage(self):
        assert _parse_judge("no json here") is None
        assert _parse_judge('{"no_equivalent_key": 1}') is None


class TestHarness:
    # NOTE ON THE BASELINE: this harness deliberately uses *reworded* clinical
    # questions ("What temperature rise requires stopping a transfusion?")
    # rather than the canonical phrasings the routing eval (test_quality_eval)
    # uses. It originally surfaced a real gap (P1.1): query-type
    # misclassification (delta-threshold phrasing like "temperature RISE"
    # scored zero threshold-keyword hits, so "stop" in "stopping" won a
    # false contraindication classification) and an over-narrow entity-
    # grounding check (a bucket-style "Clinical Thresholds" chunk doesn't
    # repeat the SOP's drug name on every line) were causing correct
    # SOP-library answers to abstain instead. Both are now fixed
    # (query_agent.py's delta-word keywords, query_clarification.py's
    # dominance check, chunker.py's SOP-level clinical_entities).
    #
    # The set was grown from 27 to 36 cases (P1.5), adding Code Blue,
    # Contrast Allergy, Fall Prevention, and Medication Reconciliation
    # coverage. That growth surfaced one more gap (P2.5, now fixed): the
    # single bucket "Clinical Thresholds and Values" chunk per SOP was
    # topically diffuse - the cross-encoder reranker scores a multi-fact
    # passage far lower than a focused single-fact one even when the fact
    # asked for is right there, and a query naming no specific SOP fell
    # back on raw TF-IDF, where a rival SOP's chunk could out-score the
    # correct one purely by repeating a shared word ("target") more often.
    # Fixed by chunking thresholds individually (chunker.py, mirrors the
    # existing per-step chunking), as natural sentences with abbreviations
    # spelled out (reusing the ABBREVIATIONS lexicon) instead of "value:
    # parameter" bullet notation, which the reranker also scores poorly.
    # That change also exposed a real pre-existing bug in the semantic-
    # relevance dominance fallback (evidence_sufficiency.py): when every
    # top-5 candidate came from one SOP (no rival present), an empty
    # rival-score list defaulted the margin to infinity, trivially passing
    # a mediocre score - fixed to require an actual rival to be dominant
    # over.
    #
    # The set was grown again (P2.3) from 36 to 55 cases, adding coverage
    # for the 9 SOPs the harness previously never asked about (Code Stroke
    # plus all 8 administrative/compliance/quality SOPs), closing the "only
    # sepsis gets tested" gap. That pass also found and fixed two real bugs
    # it exposed: generator.py's MockGenerator read a chunk's text under the
    # key "chunk_text" in one spot while every other accessor in the file
    # fell back to "text" first - chunks that only carried "text" silently
    # produced an empty answer body - and query_agent.py's contraindication
    # keyword list included the bare word "risk", which matched as a
    # substring of "Risk Management" and misclassified any query mentioning
    # that department, starving the real threshold chunk.
    #
    # Mock-mode (fully reproducible, not rate-limit-dependent) is the floor
    # basis: 0.673 pass-rate / 0.653 completeness on the current 55-case
    # set, up from 0.64 / 0.6 on the prior 36-case set. Floors sit just
    # under that so an occasional rate-limit-induced mock fallback mid-run
    # doesn't flake CI. Ratchet up as retrieval improves further - not an
    # aspirational bar to hit by hiding a real deficiency, an honest floor
    # at the measured baseline.
    _PASS_RATE_FLOOR = 0.60
    _COMPLETENESS_FLOOR = 0.55

    @pytest.mark.asyncio
    async def test_harness_produces_valid_scored_report(self):
        report = await run_correctness_eval(use_judge=False)
        agg = report["aggregate"]
        assert agg["total_cases"] == len(report["results"])
        # Completeness is actually being measured on the SOP cases.
        assert agg["avg_completeness_sop"] is not None
        # Every result row has the expected structured fields.
        for r in report["results"]:
            assert "passed" in r and "route" in r

    @pytest.mark.asyncio
    async def test_non_sop_behavior_is_correct(self):
        """The external-fallback and out-of-scope cases must route correctly -
        this part of correctness already works and must not regress."""
        report = await run_correctness_eval(use_judge=False)
        non_sop = [r for r in report["results"] if r["category"] in ("external", "out_of_scope")]
        assert non_sop
        for r in non_sop:
            assert r["passed"], f"{r['id']} routed to {r['route']} unexpectedly"

    @pytest.mark.asyncio
    async def test_regression_floor(self):
        report = await run_correctness_eval(use_judge=False)
        agg = report["aggregate"]
        assert agg["pass_rate"] >= self._PASS_RATE_FLOOR, (
            f"correctness pass rate {agg['pass_rate']} fell below the baseline "
            f"floor {self._PASS_RATE_FLOOR} - retrieval/sufficiency regressed"
        )
        assert agg["avg_completeness_sop"] >= self._COMPLETENESS_FLOOR

    @pytest.mark.asyncio
    async def test_judge_off_means_no_judge_scores(self):
        report = await run_correctness_eval(use_judge=False)
        assert report["aggregate"]["judge_scored_count"] == 0
        assert report["aggregate"]["judge_available"] is False
        for r in report["results"]:
            assert r["judge_equivalent"] is None
