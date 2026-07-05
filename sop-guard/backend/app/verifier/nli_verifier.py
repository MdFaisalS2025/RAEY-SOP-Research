"""
SOP-Guard NLI-Lite Verifier
---------------------------
A second, independently-implemented procedural faithfulness checker, built
to compare against the type-specific rule-based ProceduralFaithfulnessVerifier
(verifier.py) on the same adversarial/perturbation benchmark.

Unlike verifier.py - which has a dedicated checker class per violation type
(ThresholdVerifier, SequenceVerifier, ContraindicationVerifier) that each know
how to parse that type's structured fields - this module treats verification
as a single generic (premise, hypothesis) entailment problem, the way a real
NLI model would: build one premise text from all structured SOP facts, split
the answer into hypothesis sentences, and classify each sentence as
entailed / contradicted / neutral against its best-matching premise sentence.

This is a heuristic entailment proxy, NOT a neural NLI model - no
transformers/torch dependency is available in this environment (see
faithfulness_nli.py's docstring for the same constraint). The entailment
signals used are: numeric equality, negation/polarity agreement, and step-
order agreement - the same three violation classes verifier.py targets, but
detected generically rather than per-type.

Research prototype. Not for clinical use.
"""

import re
from typing import Any

from app.schemas.schemas import CheckResult, VerificationResult, VerificationStatus

_NUM_RE = re.compile(r"\d+\.?\d*")
# Deliberately narrow to leading prohibition markers, not any occurrence of
# "no"/"without" - those appear inside the contraindicated action itself
# (e.g. "transfuse without consent" is the prohibited act, not a negation of
# the prohibition), which would otherwise false-positive as "still negated".
_NEGATION_RE = re.compile(
    r"\b(do\s*n[o']t|does\s*n[o']t|must\s+not|should\s+not|shall\s+not|never|contraindicated|avoid)\b",
    re.IGNORECASE,
)
_STEP_RE = re.compile(r"\bstep\s+(\d+)\b", re.IGNORECASE)
_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "to", "of",
    "in", "on", "for", "and", "or", "this", "that", "it", "with", "as", "at",
    "by", "from", "should", "must", "will", "step",
}


def _split_sentences(text: str) -> list[str]:
    raw = re.split(r"(?<=[.!?])\s+|(?=\d+\.\s)", text.strip())
    return [s.strip() for s in raw if len(s.strip()) > 3]


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-z]{3,}", text.lower())
    return {w for w in words if w not in _STOPWORDS}


def _overlap(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _build_premises(structured: dict[str, Any]) -> list[dict[str, Any]]:
    """One premise entry per structured fact, tagged with its violation type."""
    premises: list[dict[str, Any]] = []

    for thresh in structured.get("thresholds", []) or []:
        parameter = thresh.get("parameter", "")
        value = thresh.get("value", "")
        action = thresh.get("action", "")
        text = f"{parameter}: {value}. {action}".strip()
        premises.append({"type": "threshold", "text": text, "parameter": parameter, "numbers": _NUM_RE.findall(value)})

    steps = structured.get("steps", []) or []
    for step in steps:
        num = step.get("step_number", 0) or step.get("step", 0)
        text = (step.get("text", "") or step.get("action", "")).strip()
        premises.append({"type": "sequence", "text": f"Step {num}: {text}", "step_number": num})

    for contra in structured.get("contraindications", []) or []:
        text = contra if isinstance(contra, str) else (contra.get("text") or str(contra))
        premises.append({"type": "contraindication", "text": text.strip()})

    return premises


def _best_match(hyp_tokens: set[str], premises: list[dict[str, Any]]) -> dict[str, Any] | None:
    best = None
    best_score = 0.0
    for p in premises:
        score = _overlap(hyp_tokens, _tokens(p["text"]))
        if score > best_score:
            best_score = score
            best = p
    if best_score < 0.15:
        return None
    return best


def _classify(hyp_sentence: str, premise: dict[str, Any]) -> tuple[str, str]:
    """Returns (label, detail) where label is entailment/contradiction/neutral."""
    hyp_lower = hyp_sentence.lower()
    premise_lower = premise["text"].lower()

    if premise["type"] == "threshold":
        premise_nums = premise.get("numbers", [])
        hyp_nums = _NUM_RE.findall(hyp_sentence)
        if premise_nums and hyp_nums:
            if premise_nums[0] not in hyp_nums:
                return "contradiction", (
                    f"Numeric mismatch for '{premise.get('parameter', '')}': "
                    f"premise states {premise_nums[0]}, answer states {hyp_nums[0]}."
                )
        return "entailment", "Numeric value matches the SOP threshold."

    if premise["type"] == "contraindication":
        hyp_negated = bool(_NEGATION_RE.search(hyp_lower))
        premise_negated = bool(_NEGATION_RE.search(premise_lower))
        if premise_negated and not hyp_negated:
            return "contradiction", (
                f"Polarity mismatch: SOP states a contraindication ('{premise['text'][:80]}') "
                "but the answer asserts it without the warning/negation."
            )
        return "entailment", "Contraindication polarity matches the SOP."

    if premise["type"] == "sequence":
        step_nums = [int(n) for n in _STEP_RE.findall(hyp_sentence)]
        if len(step_nums) >= 2:
            if step_nums != sorted(step_nums):
                return "contradiction", f"Step order reversed: answer states {step_nums}, should be ascending."
        return "entailment", "Step order matches the SOP sequence."

    return "neutral", "No specific numeric/polarity/order claim detected."


class NLIVerifier:
    """
    Generic entailment-style verifier: same VerificationResult shape as
    ProceduralFaithfulnessVerifier, so the two can be swapped in the same
    evaluation harness for a side-by-side comparison.
    """

    def verify(
        self,
        answer: str,
        retrieved_chunks: list[dict[str, Any]],
        structured_sop: dict[str, Any],
    ) -> VerificationResult:
        premises = _build_premises(structured_sop)
        sentences = _split_sentences(answer)

        checks: list[CheckResult] = []
        by_type: dict[str, list[CheckResult]] = {"threshold": [], "sequence": [], "contraindication": []}

        for sentence in sentences:
            hyp_tokens = _tokens(sentence)
            premise = _best_match(hyp_tokens, premises)
            if premise is None:
                continue
            label, detail = _classify(sentence, premise)
            if label == "neutral":
                continue
            status = "pass" if label == "entailment" else "fail"
            check = CheckResult(
                check_type=f"nli_{premise['type']}",
                status=status,
                detail=detail,
                source_reference=premise["text"][:120],
            )
            checks.append(check)
            by_type.setdefault(premise["type"], []).append(check)

        if not checks:
            return VerificationResult(
                status=VerificationStatus.warning,
                overall_score=0.5,
                threshold_checks=by_type["threshold"],
                sequence_checks=by_type["sequence"],
                contraindication_checks=by_type["contraindication"],
                safe_to_display=True,
                explanation="No matching premises found for the answer's claims (NLI-lite).",
            )

        pass_count = sum(1 for c in checks if c.status == "pass")
        fail_count = sum(1 for c in checks if c.status == "fail")
        total = len(checks)
        score = pass_count / total

        if fail_count > 0:
            status = VerificationStatus.failed
        elif score < 1.0:
            status = VerificationStatus.warning
        else:
            status = VerificationStatus.passed

        explanation = f"NLI-lite: {pass_count}/{total} claims entailed by the SOP." + (
            f" {fail_count} contradiction(s) found." if fail_count else ""
        )

        return VerificationResult(
            status=status,
            overall_score=round(score, 3),
            threshold_checks=by_type["threshold"],
            sequence_checks=by_type["sequence"],
            contraindication_checks=by_type["contraindication"],
            safe_to_display=status != VerificationStatus.failed,
            explanation=explanation,
        )
