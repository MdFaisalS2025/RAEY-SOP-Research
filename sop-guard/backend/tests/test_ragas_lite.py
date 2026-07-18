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


async def test_external_evidence_queries_excluded_from_faithfulness_average():
    """Real bug found in a full-app audit: queries that routed to external
    evidence never go through the generator's faithfulness check at all
    (there are no internal SOP chunks to check faithfulness against), so
    result.faithfulness is None for them - not 0.0. Coercing that None to
    0.0 before averaging previously made every such query count as a total
    faithfulness failure, driving avg_faithfulness to ~0 even when every
    LLM-generated answer in the same run scored perfectly. Queries that
    were never scored must be excluded from the average, not zeroed."""
    result = await run_eval()
    aggregate = result["aggregate"]
    per_query = result["per_query"]

    external_evidence_queries = [
        q for q in per_query if q.get("generation_mode") == "external_evidence"
    ]
    for q in external_evidence_queries:
        assert q["faithfulness"] is None

    scored = [q["faithfulness"] for q in per_query if q.get("faithfulness") is not None]
    assert aggregate["faithfulness_scored_count"] == len(scored)
    if scored:
        assert aggregate["avg_faithfulness"] == round(sum(scored) / len(scored), 3)
