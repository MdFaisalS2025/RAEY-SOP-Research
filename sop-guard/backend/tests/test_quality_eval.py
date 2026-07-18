"""
Tests for the 5-category (A-E) answer-quality/routing eval harness in
app/evaluation/quality_eval.py.

This harness checks routing *correctness* (did the pipeline pick the right
kind of answer for the question - SOP-supported, partial, external
fallback, non-clinical, or follow-up) as a complement to ragas_lite.py's
continuous faithfulness/citation-coverage metrics.
"""

from app.evaluation.quality_eval import run_quality_eval


async def test_quality_eval_pass_rate_is_high():
    report = await run_quality_eval()
    failures = [r for r in report["results"] if not r["passed"]]
    assert report["pass_rate"] >= 0.85, (
        f"quality eval pass rate dropped to {report['pass_rate']}: "
        f"{[(r['query'], r['fail_reasons']) for r in failures]}"
    )


async def test_quality_eval_covers_all_five_categories():
    report = await run_quality_eval()
    assert set(report["by_category"].keys()) == {"A", "B", "C", "D", "E"}


async def test_non_clinical_category_never_false_positive_matches_sop():
    """Category D is the sharpest correctness signal: a non-clinical query
    routing to sop_library means the system attached real SOP guidance to
    an unrelated question - always a failure, never partial credit."""
    report = await run_quality_eval()
    category_d = [r for r in report["results"] if r["category"] == "D"]
    assert category_d, "expected at least one category D case"
    for r in category_d:
        assert r["route"] != "sop_library", (
            f"{r['query']!r} (non-clinical) incorrectly matched an internal SOP"
        )
