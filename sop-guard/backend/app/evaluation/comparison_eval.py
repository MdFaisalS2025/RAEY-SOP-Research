"""
Meridian Protocol-Comparison Metric Calibration (Phase Q3.4)

Empirical basis for sop_comparison.py's _THRESHOLDS: a labeled fixture of
(reference step, corresponding internal SOP step, expected classification)
triples, scored directly with both similarity methods (lexical - the
no-embedding-model fallback - and cosine, when a dense model is loaded),
then swept across a threshold grid to report a confusion matrix per
threshold. Ship the harness alongside any threshold change, per the rule
this project has followed since prior phases: numbers asserted without a
harness backing them are just opinions.

Scope, deliberately narrow: this validates the SCORING function - given a
reference point and its genuinely-corresponding internal step, does the
score land in the right classification bucket. It does NOT validate
top-1 retrieval (_best_match's job of picking the right internal step out
of many candidates), which is a separate, harder problem - greedy
best-match over a general-purpose embedding model measurably picks the
wrong step sometimes even for cosine (e.g. "Screen for suspected sepsis"
best-matched an antibiotics step at 0.742, edging out the actual
screening step at 0.665, when searched against all 10 internal steps).
That's a retrieval-quality question or a re-ranking project, not a
threshold-calibration one.

The fixture is ground-truthed against the real demo corpus (SOP-ICU-001,
backend/app/demo_data/demo_sops.py) and the curated Surviving Sepsis
Campaign reference (sop_comparison.REFERENCE_PROTOCOLS) - not synthetic
examples. Two pairs are deliberately labeled to their MEASURED
classification rather than an idealized clinical one, and flagged as
known method limitations rather than silently baked into the test suite
as if they were correct:

  - "Screen for suspected sepsis" vs the qSOFA screening step shares no
    significant word under lexical scoring (0.250 - synonym blindness:
    neither "suspected" nor "sepsis" appears in the step text, which says
    "qSOFA" instead). Lexical scoring classifies this as missing; cosine
    (0.665) gets closer but still lands as partial, not match.
  - "Consider vasopressors if hypotension persists" vs the norepinephrine
    step: 0.000 under lexical scoring ("vasopressors" and "norepinephrine"
    share no token even though norepinephrine IS the vasopressor being
    started). Cosine (0.667) again only reaches partial.

Both are real, honest limitations of matching short clinical phrases by
word overlap or a general-purpose sentence embedding - not bugs in this
harness. A future improvement (e.g. a clinical synonym table, or a
domain-tuned embedding model) would show up here as these two rows moving
from "documented limitation" to "match", which is exactly what this
harness exists to catch.

Run standalone: python -m app.evaluation.comparison_eval
Run as a test:  tests/test_comparison_eval.py

Research prototype. Not for clinical use.
"""

from dataclasses import dataclass, field
from typing import Callable, Optional

from app.services.sop_comparison import _lexical_similarity, _THRESHOLDS


@dataclass
class LabeledPair:
    reference_step: str
    internal_step: str
    # Expected classification per method, at the CURRENTLY SHIPPED
    # thresholds in sop_comparison._THRESHOLDS. "match" | "partial_match"
    # | "missing_from_sop".
    expected_lexical: str
    expected_cosine: str
    note: str = ""


# Ground truth: SOP-ICU-001's real structured_json steps (indices below
# refer to that list, 0-indexed) against sop_comparison.REFERENCE_PROTOCOLS's
# curated Surviving Sepsis Campaign steps for the same SOP. Scores were
# measured directly (see the module docstring for the run that produced
# them) - not guessed.
INTERNAL_STEPS = [
    "Screen with qSOFA (altered mentation, SBP <=100, RR >=22). If qSOFA >=2, perform full SOFA assessment.",              # 0
    "Obtain TWO sets of blood cultures (aerobic and anaerobic) from two separate sites BEFORE starting antibiotics.",       # 1
    "Measure serum lactate. If >2 mmol/L, repeat within 2-4 hours.",                                                        # 2
    "Administer broad-spectrum IV antibiotics within 1 hour of sepsis recognition.",                                        # 3
    "Begin IV fluid resuscitation with 30 mL/kg balanced crystalloid within 3 hours.",                                      # 4
    "Reassess hemodynamic status: perfusion, capillary refill, HR, BP, urine output (>=0.5 mL/kg/hr), lactate clearance.",  # 5
    "If MAP <65 mmHg after fluids, start norepinephrine (first-line) at 0.05 mcg/kg/min, titrate to MAP >=65.",             # 6
]

LABELED_PAIRS: list[LabeledPair] = [
    LabeledPair(
        "Screen for suspected sepsis", INTERNAL_STEPS[0],
        expected_lexical="missing_from_sop", expected_cosine="partial_match",
        note="Known limitation: no shared token/embedding-space overlap strong enough to reach 'match' under either method - see module docstring.",
    ),
    LabeledPair(
        "Measure lactate", INTERNAL_STEPS[2],
        expected_lexical="match", expected_cosine="match",
    ),
    LabeledPair(
        "Obtain blood cultures before antibiotics when feasible", INTERNAL_STEPS[1],
        expected_lexical="match", expected_cosine="match",
    ),
    LabeledPair(
        "Administer broad-spectrum antibiotics rapidly", INTERNAL_STEPS[3],
        expected_lexical="match", expected_cosine="match",
    ),
    LabeledPair(
        "Begin fluid resuscitation when indicated", INTERNAL_STEPS[4],
        expected_lexical="partial_match", expected_cosine="match",
    ),
    LabeledPair(
        "Reassess hemodynamic status", INTERNAL_STEPS[5],
        expected_lexical="match", expected_cosine="match",
    ),
    LabeledPair(
        "Consider vasopressors if hypotension persists", INTERNAL_STEPS[6],
        expected_lexical="missing_from_sop", expected_cosine="partial_match",
        note="Known limitation: 'vasopressors' vs 'norepinephrine' is a clinical synonym neither method resolves - see module docstring.",
    ),
    LabeledPair(
        "Monitor urine output and organ dysfunction", INTERNAL_STEPS[5],
        expected_lexical="missing_from_sop", expected_cosine="match",
    ),
    LabeledPair(
        "Escalate to ICU/critical care when needed", INTERNAL_STEPS[3],
        expected_lexical="missing_from_sop", expected_cosine="partial_match",
        note="Genuine negative (SOP-ICU-001 has no escalation-to-higher-care step) matched against the nearest unrelated internal step; cosine's 0.675 here shows the method's noise floor for short clinical phrases.",
    ),
]


def _classify(score: float, thresholds: dict[str, float]) -> str:
    if score >= thresholds["match"]:
        return "match"
    if score >= thresholds["partial"]:
        return "partial_match"
    return "missing_from_sop"


def score_fixture(method: str, sim_fn: Optional[Callable[[str, str], float]]) -> list[dict]:
    """Score every labeled pair with the given method's sim_fn (None for
    lexical, which uses sop_comparison._lexical_similarity directly)."""
    thresholds = _THRESHOLDS[method]
    expected_key = f"expected_{method}"
    rows = []
    for pair in LABELED_PAIRS:
        score = sim_fn(pair.reference_step, pair.internal_step) if sim_fn else _lexical_similarity(pair.reference_step, pair.internal_step)
        classification = _classify(score, thresholds)
        expected = getattr(pair, expected_key)
        rows.append({
            "reference_step": pair.reference_step,
            "score": round(score, 3),
            "classification": classification,
            "expected": expected,
            "correct": classification == expected,
            "note": pair.note,
        })
    return rows


def sweep_thresholds(method: str, sim_fn: Optional[Callable[[str, str], float]], step: float = 0.05) -> list[dict]:
    """For every (match, partial) threshold pair on a `step` grid, report
    how many of the fixture's expected labels the pair reproduces - the
    empirical search that justified the shipped _THRESHOLDS values."""
    scored = [
        (sim_fn(p.reference_step, p.internal_step) if sim_fn else _lexical_similarity(p.reference_step, p.internal_step),
         getattr(p, f"expected_{method}"))
        for p in LABELED_PAIRS
    ]
    results = []
    grid = [round(i * step, 2) for i in range(1, int(1 / step))]
    for match_t in grid:
        for partial_t in grid:
            if partial_t >= match_t:
                continue
            thresholds = {"match": match_t, "partial": partial_t, "sop_only": max(0.0, partial_t - 0.1)}
            correct = sum(1 for score, expected in scored if _classify(score, thresholds) == expected)
            results.append({"match": match_t, "partial": partial_t, "correct": correct, "total": len(scored)})
    return sorted(results, key=lambda r: -r["correct"])


_CLASSES = ("match", "partial_match", "missing_from_sop")


def confusion_matrix(rows: list[dict]) -> dict:
    """Build a {expected: {predicted: count}} confusion matrix plus
    per-class precision/recall, from score_fixture()'s rows.

    A single pass_rate hides which classes are confused with which - on a
    fixture this small (n=9) that's the difference between "89% correct"
    and knowing that the one miss was 'partial_match' predicted as 'match',
    say, versus a class the method can't distinguish at all. Precision/
    recall on n=9 has enormous variance and should be read as descriptive
    (what happened on this fixture), not as a generalizable rate - see the
    module docstring's existing caveat about what this harness does and
    doesn't validate.
    """
    matrix = {expected: {predicted: 0 for predicted in _CLASSES} for expected in _CLASSES}
    for r in rows:
        matrix[r["expected"]][r["classification"]] += 1

    per_class: dict[str, dict] = {}
    for c in _CLASSES:
        tp = matrix[c][c]
        fn = sum(matrix[c][p] for p in _CLASSES if p != c)
        fp = sum(matrix[e][c] for e in _CLASSES if e != c)
        support = tp + fn
        per_class[c] = {
            "support": support,
            "precision": round(tp / (tp + fp), 3) if (tp + fp) else None,
            "recall": round(tp / (tp + fn), 3) if (tp + fn) else None,
        }
    return {"matrix": matrix, "per_class": per_class}


def run_comparison_eval() -> dict:
    lexical_rows = score_fixture("lexical", None)
    try:
        from app.rag.embedding_cache import is_dense_backend_active, dense_similarity
        cosine_rows = score_fixture("cosine", dense_similarity) if is_dense_backend_active() else None
    except Exception:
        cosine_rows = None

    return {
        "eval": "comparison_eval",
        "disclaimer": "Research prototype. Validates threshold calibration on a hand-labeled fixture, not clinical correctness.",
        "lexical": lexical_rows,
        "lexical_pass_rate": round(sum(1 for r in lexical_rows if r["correct"]) / len(lexical_rows), 3),
        "lexical_confusion": confusion_matrix(lexical_rows),
        "cosine": cosine_rows,
        "cosine_pass_rate": round(sum(1 for r in cosine_rows if r["correct"]) / len(cosine_rows), 3) if cosine_rows else None,
        "cosine_confusion": confusion_matrix(cosine_rows) if cosine_rows else None,
    }


def print_report(report: dict) -> None:
    print("\nMeridian Protocol-Comparison Metric Calibration")
    for method_key in ("lexical", "cosine"):
        rows = report[method_key]
        if rows is None:
            print(f"\n{method_key}: skipped (no dense model loaded)")
            continue
        print(f"\n{method_key}: {report[f'{method_key}_pass_rate'] * 100:.0f}% reproduce expected label")
        for r in rows:
            status = "OK" if r["correct"] else "MISS"
            print(f"  [{status}] {r['score']:.3f} {r['classification']:<15} (expected {r['expected']:<15}) {r['reference_step']}")
            if r["note"]:
                print(f"         note: {r['note']}")

        confusion = report[f"{method_key}_confusion"]
        print(f"\n  confusion matrix (rows=expected, cols=predicted, n={len(rows)}):")
        header = "expected \\ predicted".ljust(22) + "".join(c[:12].ljust(14) for c in _CLASSES)
        print(f"  {header}")
        for expected in _CLASSES:
            row_str = expected.ljust(22) + "".join(str(confusion["matrix"][expected][p]).ljust(14) for p in _CLASSES)
            print(f"  {row_str}")
        print("  per-class precision/recall (n this small: descriptive, not generalizable):")
        for c in _CLASSES:
            pc = confusion["per_class"][c]
            print(f"    {c}: support={pc['support']} precision={pc['precision']} recall={pc['recall']}")


if __name__ == "__main__":
    print_report(run_comparison_eval())
