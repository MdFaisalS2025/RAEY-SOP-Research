"""
Tests for the abstention gate (EvidenceSufficiencyChecker + the mock
generator's own relevance floor).

Calibration note (read before changing thresholds): this corpus does not
have a single relevance-score cutoff that cleanly separates "genuinely
out of scope" from "genuinely in scope but weakly retrieved" queries.
Verified directly against the live query pipeline (plain TF-IDF, no
reranker - see hybrid_retriever.py for why): an off-topic oncology query
scored 0.165 top-chunk relevance, which is *higher* than several
genuinely in-scope queries in the same eval set (0.088, 0.153, 0.160).
There is no threshold that catches that oncology query without also
rejecting those legitimate ones.

The 0.05 floor here is deliberately modest: it only catches near-zero
relevance (queries with essentially no lexical overlap with the corpus
at all), which is real but narrow protection. It will NOT catch a
moderate-relevance wrong-domain query - that needs a different signal
(e.g. checking the query against a known corpus vocabulary/entity list)
that isn't implemented yet. Don't raise this threshold to try to close
that gap; the score distributions above show it will just break
legitimate weak queries without reliably catching the harder OOS cases.
"""

import pytest

from app.rag.evidence_sufficiency import EvidenceSufficiencyChecker
from app.rag.generator import MockGenerator, _MIN_RELEVANCE


@pytest.fixture
def checker():
    return EvidenceSufficiencyChecker()


def _chunk(score: float, text: str = "sepsis lactate vasopressor norepinephrine dose threshold") -> dict:
    return {"chunk_text": text, "text": text, "relevance_score": score, "chunk_type": "threshold"}


class TestEvidenceSufficiencyChecker:
    def test_very_low_relevance_is_insufficient(self, checker):
        """A near-zero top score (the old 0.005 floor let this through) must fail."""
        chunks = [_chunk(0.01)]
        result = checker.check("unrelated off-topic question", chunks, "general")
        assert result["sufficient"] is False

    def test_strong_relevance_and_overlap_is_sufficient(self, checker):
        chunks = [_chunk(0.3, "sepsis lactate threshold monitoring")]
        result = checker.check(
            "What lactate level indicates severe sepsis?", chunks, "threshold"
        )
        assert result["sufficient"] is True

    def test_no_chunks_is_insufficient(self, checker):
        result = checker.check("anything", [], "general")
        assert result["sufficient"] is False
        assert result["score"] == 0.0


class TestMockGeneratorAbstention:
    def test_abstains_and_flags_when_no_chunk_clears_relevance_floor(self):
        """
        Regression test for a real bug: the mock generator's own abstention
        decision (no chunk above _MIN_RELEVANCE) must be reflected in the
        returned "abstained" flag. It previously wasn't propagated by the
        caller in one code path, so a query the mock generator correctly
        refused to answer could still be reported as a confident,
        non-abstained response depending on which branch handled it.
        """
        gen = MockGenerator()
        chunks = [{"sop_title": "Unrelated Protocol", "chunk_text": "irrelevant text",
                   "relevance_score": _MIN_RELEVANCE / 2}]
        result = gen.generate_answer("some off-topic question", chunks, "general")
        assert result["abstained"] is True
        assert result["confidence"] <= 0.1

    def test_does_not_abstain_when_a_chunk_clears_the_floor(self):
        gen = MockGenerator()
        chunks = [{"sop_title": "Sepsis Management Protocol", "chunk_text": "Lactate >2 mmol/L triggers repeat measurement.",
                   "relevance_score": _MIN_RELEVANCE + 0.05}]
        result = gen.generate_answer("What lactate level triggers repeat measurement?", chunks, "threshold")
        assert result["abstained"] is False
