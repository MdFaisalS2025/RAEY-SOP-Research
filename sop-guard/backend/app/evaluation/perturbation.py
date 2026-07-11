"""
Meridian Perturbation-Based Adversarial Benchmark
----------------------------------------------------
The hand-written ADVERSARIAL_TESTS (17 cases) can't support a percentage
claim on its own - one flipped case moves the rate by ~6 points. This
module programmatically generates many more labeled (correct, adversarial)
answer pairs directly from the structured SOP data already extracted by
sop_structurer.py (thresholds, steps, contraindications), stratified by
violation type, so the benchmark scales with the corpus instead of staying
fixed at 17 examples.

Research prototype. Not for clinical use.
"""

import random
import re
from typing import Any

_NUM_RE = re.compile(r"\d+\.?\d*")


def _fmt_num(x: float) -> str:
    return f"{x:g}"


def _perturb_number(num_str: str, rng: random.Random) -> str | None:
    """Shift a numeric value by 15-40%, in a random direction, formatted like the original."""
    try:
        value = float(num_str)
    except ValueError:
        return None
    if value == 0:
        delta = rng.choice([1, 2, 5])
    else:
        pct = rng.uniform(0.15, 0.40)
        delta = value * pct
    new_value = value + delta if rng.random() < 0.5 else value - delta
    if new_value < 0:
        new_value = value + delta
    # Preserve integer-looking values as integers where the original was one,
    # and match decimal precision otherwise (avoids e.g. "0.5" perturbing
    # into an unrealistic "0.578973").
    if "." not in num_str:
        new_value = round(new_value)
    else:
        decimals = len(num_str.split(".", 1)[1])
        new_value = round(new_value, decimals)
    return _fmt_num(new_value)


def generate_threshold_perturbations(
    sop_id: str, structured: dict[str, Any], rng: random.Random, max_per_sop: int = 6,
) -> list[dict[str, Any]]:
    """One perturbed case per threshold: shift the first number in its value by 15-40%."""
    cases = []
    thresholds = list(structured.get("thresholds", []))
    rng.shuffle(thresholds)
    for thresh in thresholds[:max_per_sop]:
        parameter = thresh.get("parameter", "")
        value = thresh.get("value", "")
        action = thresh.get("action", "")
        nums = _NUM_RE.findall(value)
        if not nums:
            continue
        original_num = nums[0]
        perturbed_num = _perturb_number(original_num, rng)
        if perturbed_num is None or perturbed_num == original_num:
            continue
        perturbed_value = value.replace(original_num, perturbed_num, 1)

        correct_answer = f"{parameter}: {value}. {action}.".strip()
        adversarial_answer = f"{parameter}: {perturbed_value}. {action}.".strip()

        cases.append({
            "test_id": f"GEN-THRESH-{sop_id}-{parameter[:24].replace(' ', '_')}",
            "sop_id": sop_id,
            "query": f"What is the {parameter} threshold or value?",
            "correct_answer": correct_answer,
            "adversarial_answer": adversarial_answer,
            "violation_type": "threshold",
            "violation_detail": f"{parameter} should be '{value}', not '{perturbed_value}'.",
            "generated": True,
        })
    return cases


def generate_sequence_perturbations(
    sop_id: str, structured: dict[str, Any], rng: random.Random, max_per_sop: int = 4,
) -> list[dict[str, Any]]:
    """One perturbed case per SOP: describe two adjacent steps in reversed order."""
    cases = []
    steps = structured.get("steps", [])
    if len(steps) < 2:
        return cases

    pairs = list(range(len(steps) - 1))
    rng.shuffle(pairs)
    for i in pairs[:max_per_sop]:
        step_a, step_b = steps[i], steps[i + 1]
        num_a = step_a.get("step_number", 0) or step_a.get("step", 0)
        num_b = step_b.get("step_number", 0) or step_b.get("step", 0)
        text_a = (step_a.get("text", "") or step_a.get("action", "")).strip()
        text_b = (step_b.get("text", "") or step_b.get("action", "")).strip()
        if not text_a or not text_b:
            continue

        correct_answer = f"Step {num_a}: {text_a} Step {num_b}: {text_b}"
        adversarial_answer = f"Step {num_b}: {text_b} Step {num_a}: {text_a}"

        cases.append({
            "test_id": f"GEN-SEQ-{sop_id}-{num_a}-{num_b}",
            "sop_id": sop_id,
            "query": f"What is the correct order for steps {num_a} and {num_b}?",
            "correct_answer": correct_answer,
            "adversarial_answer": adversarial_answer,
            "violation_type": "sequence",
            "violation_detail": f"Step {num_a} must come before step {num_b}, not after.",
            "generated": True,
        })
    return cases


def generate_contraindication_perturbations(
    sop_id: str, structured: dict[str, Any], rng: random.Random, max_per_sop: int = 6,
) -> list[dict[str, Any]]:
    """One perturbed case per contraindication: state the exact opposite of the warning."""
    cases = []
    contras = list(structured.get("contraindications", []))
    rng.shuffle(contras)

    _NEGATION_STRIP_RE = re.compile(
        r"\b(do\s*n[o']t|does\s*n[o']t|must\s+not|should\s+not|shall\s+not|never)\b\s*",
        re.IGNORECASE,
    )

    for contra in contras[:max_per_sop]:
        text = contra if isinstance(contra, str) else (contra.get("text") or str(contra))
        text = text.strip()
        if not text:
            continue

        stripped, n_subs = _NEGATION_STRIP_RE.subn("", text, count=1)
        if n_subs == 0:
            # No clean negation to strip - flip a leading "No." instead.
            if re.match(r"^\s*no[.,]", text, re.IGNORECASE):
                stripped = re.sub(r"^\s*no[.,]\s*", "", text, count=1, flags=re.IGNORECASE)
            else:
                continue

        correct_answer = f"No. {text}"
        adversarial_answer = f"Yes, {stripped[0].lower() + stripped[1:] if stripped else stripped}"

        cases.append({
            "test_id": f"GEN-CONTRA-{sop_id}-{abs(hash(text)) % 10000}",
            "sop_id": sop_id,
            "query": "Is this permitted?",
            "correct_answer": correct_answer,
            "adversarial_answer": adversarial_answer,
            "violation_type": "contraindication",
            "violation_detail": f"This is a contraindication and must be flagged: '{text}'.",
            "generated": True,
        })
    return cases


def generate_perturbed_benchmark(
    demo_sops: list[dict[str, Any]],
    structured_lookup: dict[str, dict[str, Any]],
    seed: int = 42,
) -> list[dict[str, Any]]:
    """
    Generate a stratified perturbation benchmark across all demo SOPs.
    Deterministic given the same seed, so the reported benchmark size and
    composition don't drift between runs.
    """
    rng = random.Random(seed)
    cases: list[dict[str, Any]] = []
    for sop in demo_sops:
        sop_id = sop["sop_id"]
        structured = structured_lookup.get(sop_id, {})
        cases.extend(generate_threshold_perturbations(sop_id, structured, rng))
        cases.extend(generate_sequence_perturbations(sop_id, structured, rng))
        cases.extend(generate_contraindication_perturbations(sop_id, structured, rng))
    return cases
