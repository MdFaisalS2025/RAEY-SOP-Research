"""
Asserts sop_comparison.py's shipped _THRESHOLDS reproduce the hand-labeled
fixture in app/evaluation/comparison_eval.py - the harness that empirically
justifies those threshold values (see that module's docstring for the full
methodology and the two documented method limitations). A future change to
_lexical_similarity, _THRESHOLDS, or the embedding backend that regresses
this without anyone noticing is exactly what this test exists to catch.
"""

from app.evaluation.comparison_eval import score_fixture, LABELED_PAIRS


def test_lexical_thresholds_reproduce_the_labeled_fixture():
    rows = score_fixture("lexical", None)
    assert len(rows) == len(LABELED_PAIRS)
    wrong = [r for r in rows if not r["correct"]]
    assert not wrong, f"lexical threshold mismatches: {wrong}"


def test_cosine_thresholds_reproduce_the_labeled_fixture():
    from app.rag.embedding_cache import is_dense_backend_active, dense_similarity
    if not is_dense_backend_active():
        import pytest
        pytest.skip("no dense embedding model loaded in this environment")
    rows = score_fixture("cosine", dense_similarity)
    assert len(rows) == len(LABELED_PAIRS)
    wrong = [r for r in rows if not r["correct"]]
    assert not wrong, f"cosine threshold mismatches: {wrong}"


def test_lexical_fixture_covers_all_three_classifications():
    """A calibration fixture that never exercises "partial_match", say,
    proves nothing about that boundary - guard against the fixture itself
    silently degrading to only match/missing pairs over time."""
    expected_values = {p.expected_lexical for p in LABELED_PAIRS}
    assert expected_values == {"match", "partial_match", "missing_from_sop"}, (
        f"lexical fixture no longer covers all three classifications: {expected_values}"
    )


def test_cosine_fixture_never_reaches_missing_from_sop():
    """Documents a real calibration finding, not an oversight: even the
    fixture's one genuine negative pair (an "escalate to ICU" reference
    point against an unrelated internal step) scores 0.675 under
    bge-small-en-v1.5 cosine similarity - above the 0.50 partial
    threshold. Short clinical phrases apparently sit on a fairly high
    cosine noise floor with this model, so cosine mode may rarely or
    never produce "missing_from_sop" in practice. If a future embedding
    model change makes this fixture start producing "missing_from_sop"
    for cosine, that's an improvement worth updating this test to reflect
    - not a regression."""
    expected_values = {p.expected_cosine for p in LABELED_PAIRS}
    assert "missing_from_sop" not in expected_values
