"""Tests for the programmatic perturbation-based benchmark generator."""

from app.demo_data.demo_sops import DEMO_SOPS
from app.services.sop_structurer import structure_sop
from app.evaluation.perturbation import generate_perturbed_benchmark


def _structured_lookup():
    lookup = {}
    for sop in DEMO_SOPS:
        lookup[sop["sop_id"]] = sop.get("structured_json") or structure_sop(
            sop["raw_text"], sop["title"]
        )
    return lookup


def test_generates_a_substantial_stratified_benchmark():
    cases = generate_perturbed_benchmark(DEMO_SOPS, _structured_lookup())
    assert len(cases) >= 50, "benchmark should scale well beyond the 17 hand-written cases"

    types = {c["violation_type"] for c in cases}
    assert types == {"threshold", "sequence", "contraindication"}


def test_every_case_has_a_distinct_correct_and_adversarial_answer():
    cases = generate_perturbed_benchmark(DEMO_SOPS, _structured_lookup())
    for c in cases:
        assert c["correct_answer"] != c["adversarial_answer"], c["test_id"]
        assert c["correct_answer"].strip()
        assert c["adversarial_answer"].strip()


def test_deterministic_given_same_seed():
    lookup = _structured_lookup()
    cases_a = generate_perturbed_benchmark(DEMO_SOPS, lookup, seed=42)
    cases_b = generate_perturbed_benchmark(DEMO_SOPS, lookup, seed=42)
    assert [c["test_id"] for c in cases_a] == [c["test_id"] for c in cases_b]
    assert [c["adversarial_answer"] for c in cases_a] == [c["adversarial_answer"] for c in cases_b]


def test_test_ids_are_unique():
    cases = generate_perturbed_benchmark(DEMO_SOPS, _structured_lookup())
    ids = [c["test_id"] for c in cases]
    assert len(ids) == len(set(ids))
