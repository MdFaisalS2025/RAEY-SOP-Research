"""
Tests for the NLI-lite verifier (app/verifier/nli_verifier.py), the
generic-entailment alternative to the type-specific rule-based
ProceduralFaithfulnessVerifier.
"""

from app.verifier.nli_verifier import NLIVerifier


def _structured(**kwargs):
    base = {"steps": [], "thresholds": [], "contraindications": []}
    base.update(kwargs)
    return base


class TestThresholdEntailment:
    def test_matching_number_passes(self):
        structured = _structured(thresholds=[
            {"parameter": "MAP", "value": ">=65 mmHg", "action": "Start vasopressors"}
        ])
        result = NLIVerifier().verify("MAP: >=65 mmHg. Start vasopressors.", [], structured)
        assert result.status.value == "passed"

    def test_perturbed_number_fails(self):
        structured = _structured(thresholds=[
            {"parameter": "MAP", "value": ">=65 mmHg", "action": "Start vasopressors"}
        ])
        result = NLIVerifier().verify("MAP: >=90 mmHg. Start vasopressors.", [], structured)
        assert result.status.value == "failed"


class TestContraindicationEntailment:
    def test_negation_preserved_passes(self):
        structured = _structured(contraindications=["Do not transfuse without consent."])
        result = NLIVerifier().verify("No. Do not transfuse without consent.", [], structured)
        assert result.status.value in ("passed", "warning")

    def test_negation_flipped_fails(self):
        structured = _structured(contraindications=["Do not transfuse without consent."])
        result = NLIVerifier().verify("Yes, transfuse without consent.", [], structured)
        assert result.status.value == "failed"


class TestSequenceEntailment:
    def test_correct_order_passes(self):
        structured = _structured(steps=[
            {"step_number": 1, "text": "Don gloves"},
            {"step_number": 2, "text": "Don gown"},
        ])
        result = NLIVerifier().verify("Step 1: Don gloves Step 2: Don gown", [], structured)
        assert result.status.value in ("passed", "warning")

    def test_reversed_order_fails(self):
        structured = _structured(steps=[
            {"step_number": 1, "text": "Don gloves"},
            {"step_number": 2, "text": "Don gown"},
        ])
        result = NLIVerifier().verify("Step 2: Don gown Step 1: Don gloves", [], structured)
        assert result.status.value == "failed"


class TestNoApplicablePremises:
    def test_no_structured_data_is_warning(self):
        result = NLIVerifier().verify("Some answer with no matching facts.", [], _structured())
        assert result.status.value == "warning"
        assert result.overall_score == 0.5
