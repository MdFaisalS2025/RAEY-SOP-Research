"""
Tests for the RAGAS-lite eval's headline metrics.

Regression coverage for a real bug: avg_citation_coverage was always 0.0
because the mock generator never emitted [N] markers (fixed in
generator.py). Also covers the retrieval_precision_proxy rename -
the old name overclaimed "precision" for a raw, unbounded TF-IDF score.
"""

from app.evaluation.ragas_lite import run_eval


async def test_citation_coverage_is_nonzero_in_mock_mode():
    result = await run_eval()
    assert result["aggregate"]["avg_citation_coverage"] > 0.0, (
        "citation_coverage should no longer be stuck at 0.0 now that the "
        "mock generator emits real [N] markers"
    )


async def test_top_chunk_relevance_score_replaces_old_precision_proxy_name():
    result = await run_eval()
    aggregate = result["aggregate"]
    assert "avg_top_chunk_relevance_score" in aggregate
    assert "avg_retrieval_precision_proxy" not in aggregate
    for q in result["per_query"]:
        if "error" not in q:
            assert "top_chunk_relevance_score" in q
            assert "retrieval_precision_proxy" not in q


async def test_faithfulness_note_flags_mock_mode_ceiling():
    result = await run_eval()
    aggregate = result["aggregate"]
    assert "faithfulness_note" in aggregate
    if aggregate["generation_mode"] in ("mock", "mock_fallback"):
        assert "ceiling" in aggregate["faithfulness_note"].lower()
