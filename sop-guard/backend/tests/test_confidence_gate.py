"""
Tests for SOPGuardPipeline._confidence_gate's citation-coverage cap.

Regression coverage for a real gap: the confidence gate could boost
confidence to 0.8+ purely from verification/evidence signals, even when
most of the answer's sentences weren't attributed to any specific
source chunk. Now that both generators emit real [N] citation markers
(see generator.py/llm_generator.py, fixed earlier this session), low
citation coverage is a genuine grounding-quality signal that should cap
how high confidence can climb.
"""

from app.agents.pipeline import SOPGuardPipeline
from app.schemas.schemas import VerificationResult, VerificationStatus


def _pipeline() -> SOPGuardPipeline:
    return SOPGuardPipeline(chunks=[], structured_sops={})


def _passed_verification(score: float = 0.9) -> VerificationResult:
    return VerificationResult(status=VerificationStatus.passed, overall_score=score)


class TestCitationCoverageCap:
    def test_low_coverage_caps_confidence_despite_passed_verification(self):
        pipeline = _pipeline()
        result = pipeline._confidence_gate(
            raw_confidence=0.7,
            verification=_passed_verification(),
            num_chunks=5,
            evidence_score=0.9,
            citation_coverage_score=0.1,
        )
        assert result <= 0.65

    def test_high_coverage_allows_full_boost_from_passed_verification(self):
        pipeline = _pipeline()
        result = pipeline._confidence_gate(
            raw_confidence=0.7,
            verification=_passed_verification(),
            num_chunks=5,
            evidence_score=0.9,
            citation_coverage_score=0.9,
        )
        assert result >= 0.8

    def test_missing_coverage_score_does_not_cap(self):
        """Backward compatible: omitting the new param behaves as before."""
        pipeline = _pipeline()
        result = pipeline._confidence_gate(
            raw_confidence=0.7,
            verification=_passed_verification(),
            num_chunks=5,
            evidence_score=0.9,
        )
        assert result >= 0.8

    def test_cap_never_raises_an_already_low_score(self):
        pipeline = _pipeline()
        result = pipeline._confidence_gate(
            raw_confidence=0.3,
            verification=VerificationResult(status=VerificationStatus.failed, overall_score=0.1),
            num_chunks=1,
            evidence_score=0.1,
            citation_coverage_score=0.0,
        )
        assert result <= 0.35
