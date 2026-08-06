"""
Tests for EnsembleVerifier: unit-level behavior of the WARNING-rescue
strategy, plus a benchmark-level regression test confirming the combined
verifier actually beats both individual verifiers on the full perturbation
benchmark (hand-written cases + the programmatically-generated set, which
scales with corpus size - see generate_perturbed_benchmark; the exact case
count therefore isn't asserted here, only the relative sensitivity/
specificity balance, which is the actual claim being tested). This is the
empirical justification for choosing the WARNING-rescue strategy over a
naive union/veto - see ensemble_verifier.py's docstring for the current
numbers.
"""

from app.verifier.ensemble_verifier import EnsembleVerifier
from app.demo_data.adversarial_tests import ADVERSARIAL_TESTS
from app.services.sop_structurer import structure_sop
from app.demo_data.demo_sops import DEMO_SOPS
from app.evaluation.perturbation import generate_perturbed_benchmark
from app.verifier.verifier import ProceduralFaithfulnessVerifier
from app.verifier.nli_verifier import NLIVerifier


def _structured(**kwargs):
    base = {"steps": [], "thresholds": [], "contraindications": []}
    base.update(kwargs)
    return base


class TestEnsembleUnitBehavior:
    def test_clear_violation_still_caught(self):
        """A blatant threshold violation both verifiers agree on stays failed/warning."""
        structured = _structured(thresholds=[
            {"parameter": "MAP", "value": ">=65 mmHg", "action": "Start vasopressors"}
        ])
        result = EnsembleVerifier().verify("MAP: >=120 mmHg. Start vasopressors.", [], structured)
        assert result.status.value in ("failed", "warning")

    def test_clean_answer_with_no_applicable_checks_passes_or_warns(self):
        result = EnsembleVerifier().verify("Some general answer with no checkable claims.", [], _structured())
        assert result.status.value in ("passed", "warning")

    def test_explanation_mentions_ensemble(self):
        structured = _structured(thresholds=[
            {"parameter": "MAP", "value": ">=65 mmHg", "action": "Start vasopressors"}
        ])
        result = EnsembleVerifier().verify("MAP: >=65 mmHg. Start vasopressors.", [], structured)
        assert "Ensemble" in result.explanation


def _run_verifier(verifier, test_cases, structured_lookup):
    n = len(test_cases)
    caught = 0
    passed_correct = 0
    for t in test_cases:
        structured = structured_lookup.get(t.get("sop_id", ""), _structured())
        adv = verifier.verify(t["adversarial_answer"], [], structured)
        cor = verifier.verify(t["correct_answer"], [], structured)
        if adv.status.value in ("failed", "warning"):
            caught += 1
        if cor.status.value == "passed":
            passed_correct += 1
    return caught / n, passed_correct / n


def _harmonic_mean(a: float, b: float) -> float:
    return 0.0 if (a + b) == 0 else 2 * a * b / (a + b)


class TestEnsembleBeatsIndividualVerifiers:
    def test_ensemble_has_better_sensitivity_specificity_balance(self):
        structured_lookup = {}
        for sop in DEMO_SOPS:
            sid = sop["sop_id"]
            structured_lookup[sid] = sop.get("structured_json") or structure_sop(sop["raw_text"], sop["title"])
        test_cases = list(ADVERSARIAL_TESTS) + generate_perturbed_benchmark(DEMO_SOPS, structured_lookup)

        rb_sens, rb_spec = _run_verifier(ProceduralFaithfulnessVerifier(), test_cases, structured_lookup)
        nl_sens, nl_spec = _run_verifier(NLIVerifier(), test_cases, structured_lookup)
        en_sens, en_spec = _run_verifier(EnsembleVerifier(), test_cases, structured_lookup)

        rb_balance = _harmonic_mean(rb_sens, rb_spec)
        nl_balance = _harmonic_mean(nl_sens, nl_spec)
        en_balance = _harmonic_mean(en_sens, en_spec)

        # The ensemble should have a materially better sensitivity/
        # specificity balance than either verifier alone - this is the
        # entire justification for building it rather than picking one.
        assert en_balance > rb_balance
        assert en_balance > nl_balance

        # Specificity should be substantially rescued from rule-based's
        # weak point without collapsing sensitivity.
        assert en_spec > rb_spec + 0.2
        assert en_sens > 0.7
