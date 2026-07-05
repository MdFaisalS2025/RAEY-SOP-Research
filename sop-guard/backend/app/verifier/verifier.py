"""
SOP-Guard Procedural Faithfulness Verifier
-------------------------------------------
CORE RESEARCH COMPONENT.

Verifies that generated answers faithfully represent SOP content by checking:
  1. Thresholds  - numeric values match source SOPs
  2. Sequences  - procedural steps are in correct order, none missing
  3. Contraindications  - relevant warnings/prohibitions are not omitted

Research prototype  - NOT for clinical use.
"""

import re
from typing import Any

from app.schemas.schemas import VerificationResult, VerificationStatus, CheckResult

# Generic words that appear in almost every threshold/contraindication's
# surrounding text but carry no topical signal on their own (e.g. "dose",
# "level", "patient"). Used to keep relevance-matching scoped to the actual
# clinical concept rather than incidental vocabulary overlap.
_GENERIC_CLINICAL_WORDS = {
    "target", "count", "level", "range", "value", "action", "maintain",
    "dose", "administer", "patient", "patients", "therapy", "therapeutic",
    "management", "protocol", "consider", "initiate", "hold", "give",
    "adjust", "monitor", "assess", "check", "within", "before", "after",
}

# Negation / prohibition cues that indicate a contraindication or warning is
# actually being stated in the answer (as opposed to the topic merely being
# mentioned). Uses word-stems (contraindicat*, prohibit*) so both the noun
# ("contraindication") and adjective ("contraindicated") forms match, and
# covers standalone negation ("is not", "was not") in addition to modal
# phrases ("must not", "should not").
_NEGATION_RE = re.compile(
    r"\b(do\s*n[o']t|does\s*n[o']t|is\s+not|are\s+not|was\s+not|were\s+not|"
    r"must\s+not|should\s+not|shall\s+not|cannot|can't|"
    r"never|avoid|contraindicat\w*|prohibit\w*|warning|caution)\b"
    r"|^\s*no[.,;:]",
    re.IGNORECASE,
)


def _has_negation_cue(text: str) -> bool:
    return bool(_NEGATION_RE.search(text))


def _numbers_equal(a: str, b: str) -> bool:
    """Numeric-value comparison that tolerates formatting differences (e.g. '65' vs '65.0')."""
    try:
        return float(a) == float(b)
    except ValueError:
        return a == b


# Unit token immediately following a number, e.g. "2 mmol/L" -> "mmol/l",
# "30 mL/kg" -> "ml/kg", "5 minutes" -> "minutes". Matched right after the
# number (allowing one space) so two different numbers in the same short
# sentence - e.g. a threshold value and an unrelated time window - can be
# told apart even when a generic word-overlap context check would consider
# the whole sentence "the same context".
_UNIT_AFTER_RE = re.compile(
    r"^\s*"
    r"(mcg/kg/min|mcg/kg/hr|mg/kg/min|mg/kg/hr|ml/kg/hr|ml/kg|mcg/min|mg/hr|"
    r"units?/min|units?/hr|mmol/l|mg/dl|meq/l|mmhg|bpm|mcg|mg|ml|"
    r"hours?|hrs?|h(?=\b)|minutes?|mins?|seconds?|secs?|%)\b",
    re.IGNORECASE,
)


_UNIT_ALIASES = {
    "hr": "hours", "hrs": "hours", "h": "hours", "hour": "hours",
    "min": "minutes", "mins": "minutes", "minute": "minutes",
    "sec": "seconds", "secs": "seconds", "second": "seconds",
    "u": "units", "unit": "units",
}


def _normalize_unit(unit: str) -> str:
    return _UNIT_ALIASES.get(unit, unit)


def _unit_after(text: str, pos: int) -> str:
    """Best-effort unit token starting at `pos` in `text` (e.g. right after a matched number)."""
    m = _UNIT_AFTER_RE.match(text[pos:pos + 20])
    if not m:
        return ""
    return _normalize_unit(m.group(1).lower().replace(" ", ""))


class ThresholdVerifier:
    """Verify that numeric thresholds in the answer match the source SOP."""

    # Common abbreviations and their expanded forms for relevance matching
    _ABBREVIATION_MAP = {
        "inr": ["inr", "international", "normalized", "ratio"],
        "afib": ["atrial", "fibrillation"],
        "dvt": ["deep", "vein", "thrombosis"],
        "map": ["mean", "arterial", "pressure"],
        "sbp": ["systolic", "blood", "pressure"],
        "dbp": ["diastolic", "blood", "pressure"],
        "hr": ["heart", "rate"],
        "aptt": ["activated", "partial", "thromboplastin"],
        "crcl": ["creatinine", "clearance"],
        "egfr": ["glomerular", "filtration"],
    }

    def check(
        self, answer: str, structured_sop: dict[str, Any]
    ) -> list[CheckResult]:
        results: list[CheckResult] = []
        sop_thresholds = structured_sop.get("thresholds", [])
        if not sop_thresholds:
            return results

        # Extract all numbers with surrounding context from the answer
        answer_numbers = self._extract_numbers_with_context(answer)
        # Also extract ranges from the answer
        answer_ranges = self._extract_ranges(answer)

        for thresh in sop_thresholds:
            thresh_value = thresh.get("value", "")
            thresh_action = thresh.get("action", "")
            thresh_parameter = thresh.get("parameter", "")
            thresh_context = thresh.get("context", "") or f"{thresh_parameter} {thresh_action}"
            # Scoped to parameter+value only (not the action field) for
            # single-number matching below: the action text often contains
            # unrelated numbers (e.g. a time window like "within 2-4 hours")
            # that can coincidentally equal the threshold's own value and
            # falsely inherit its context via the shared action wording.
            value_context = f"{thresh_parameter} {thresh_value}"

            if not self._is_relevant_threshold(thresh_parameter, answer):
                continue

            # Extract numbers (with their immediately-following unit, if any)
            # from the value field, and plain numbers from the action field.
            nums_in_value = [
                (m.group(), _unit_after(thresh_value, m.end()))
                for m in re.finditer(r"\d+\.?\d*", thresh_value)
            ]
            nums_in_action = re.findall(r"\d+\.?\d*", thresh_action)

            if not nums_in_value and not nums_in_action:
                continue

            # Extract ranges from value and action
            sop_ranges_val = self._extract_ranges(thresh_value)
            sop_ranges_act = self._extract_ranges(thresh_action)
            sop_ranges = sop_ranges_val + sop_ranges_act

            # Check range mismatches first (more precise than individual numbers)
            range_mismatch = False
            if sop_ranges:
                for sop_lo, sop_hi, sop_range_ctx in sop_ranges:
                    for ans_lo, ans_hi, ans_range_ctx in answer_ranges:
                        # Check if ranges are about the same thing (context overlap)
                        if self._context_matches(ans_range_ctx, thresh_context):
                            if not _numbers_equal(sop_lo, ans_lo) or not _numbers_equal(sop_hi, ans_hi):
                                range_mismatch = True
                                results.append(CheckResult(
                                    check_type="threshold",
                                    status="fail",
                                    detail=(
                                        f"Range mismatch: SOP specifies "
                                        f"'{sop_lo}-{sop_hi}' but answer states "
                                        f"'{ans_lo}-{ans_hi}' for {thresh_parameter}."
                                    ),
                                    source_reference=thresh_context[:120],
                                ))

            if range_mismatch:
                continue

            # Check individual number matching for value field. Each number
            # in the SOP value is checked independently and must be found in
            # the answer - a value like "50 mg PO at 13h, 7h, 1h before"
            # specifies three required administration times, and an answer
            # that only states one of them is missing two doses, not "close
            # enough" because at least one number happened to match.
            #
            # When the SOP value has a recognizable unit attached (e.g.
            # "2 mmol/L"), the answer's matching number must carry the SAME
            # unit - this is what actually disambiguates two different
            # numbers that happen to coincide in a short sentence (a
            # threshold value and an unrelated time window both containing
            # the digit "2"), which a generic word-overlap context check
            # cannot reliably do.
            for num, sop_unit in nums_in_value:
                num_matched = False
                for ans_num, ans_ctx, ans_unit in answer_numbers:
                    if not _numbers_equal(num, ans_num):
                        continue
                    # If the SOP value has a defined unit, the answer's
                    # occurrence of this number must carry that same unit -
                    # an occurrence with no unit at all (e.g. one side of an
                    # unrelated "2-4 hours" range) is not good enough
                    # evidence, since it's exactly the ambiguous case a
                    # coincidental digit match needs to be screened out for.
                    if sop_unit and ans_unit != sop_unit:
                        continue
                    num_matched = True
                    if self._context_matches(ans_ctx, value_context):
                        results.append(CheckResult(
                            check_type="threshold",
                            status="pass",
                            detail=f"Threshold '{thresh_value}' correctly cited in answer.",
                            source_reference=thresh_context[:120],
                        ))
                    else:
                        results.append(CheckResult(
                            check_type="threshold",
                            status="warning",
                            detail=f"Value '{num}' appears in answer but context may differ from SOP.",
                            source_reference=thresh_context[:120],
                        ))
                    break

                if not num_matched:
                    results.append(CheckResult(
                        check_type="threshold",
                        status="fail",
                        detail=f"SOP threshold '{thresh_value}' is relevant but missing from answer.",
                        source_reference=thresh_context[:120],
                    ))

        return results

    def _extract_numbers_with_context(self, text: str) -> list[tuple[str, str, str]]:
        """Extract numbers, their surrounding context, and their immediately-following unit (if any)."""
        results = []
        for match in re.finditer(r"\d+\.?\d*", text):
            start = max(0, match.start() - 50)
            end = min(len(text), match.end() + 50)
            unit = _unit_after(text, match.end())
            results.append((match.group(), text[start:end], unit))
        return results

    def _extract_ranges(self, text: str) -> list[tuple[str, str, str]]:
        """Extract numeric ranges (e.g., '3-5', '2.0-3.0') with context.

        Returns list of (low, high, surrounding_context) tuples.
        """
        results = []
        for match in re.finditer(r"(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)", text):
            start = max(0, match.start() - 50)
            end = min(len(text), match.end() + 50)
            results.append((match.group(1), match.group(2), text[start:end]))
        return results

    def _context_matches(self, answer_ctx: str, sop_ctx: str) -> bool:
        """Check if answer context roughly matches SOP context."""
        a_words = set(re.findall(r"[a-z]+", answer_ctx.lower()))
        s_words = set(re.findall(r"[a-z]+", sop_ctx.lower()))
        if not s_words:
            return True
        overlap = len(a_words & s_words) / max(len(s_words), 1)
        return overlap > 0.15

    def _is_relevant_threshold(self, thresh_parameter: str, answer: str) -> bool:
        """
        Check if a threshold's specific measured parameter (e.g. "Platelet
        count", "MAP") appears in the answer - not just any word from its
        surrounding action/context text, which is full of generic clinical
        vocabulary ("maintain", "administer", "anticoagulation") that would
        make almost any answer look "relevant" to almost any threshold.
        """
        answer_lower = answer.lower()
        param_lower = thresh_parameter.lower()

        # Abbreviation matches (MAP, INR, etc.) are a strong, precise signal.
        for abbrev, expansions in self._ABBREVIATION_MAP.items():
            if abbrev in param_lower:
                if abbrev in answer_lower or any(exp in answer_lower for exp in expansions):
                    return True

        # Otherwise require a distinctive (non-generic) word from the
        # parameter name itself to appear in the answer.
        param_words = set(re.findall(r"[a-z]{4,}", param_lower)) - _GENERIC_CLINICAL_WORDS
        if not param_words:
            # Parameter name is too generic to extract a distinctive word from -
            # fall back to requiring the full parameter phrase (short ones only).
            return param_lower in answer_lower if len(param_lower) <= 20 else False

        return any(w in answer_lower for w in param_words)


class SequenceVerifier:
    """Verify that procedural steps are mentioned in correct order."""

    def check(
        self, answer: str, structured_sop: dict[str, Any]
    ) -> list[CheckResult]:
        results: list[CheckResult] = []
        sop_steps = structured_sop.get("steps", [])
        if not sop_steps:
            return results

        # Find which steps are mentioned in the answer and in what order
        mentioned_steps = []
        answer_lower = answer.lower()

        for step in sop_steps:
            step_text = (step.get("text", "") or step.get("action", "")).lower()
            step_num = step.get("step_number", 0) or step.get("step", 0)

            # Check for explicit step number mention or key content overlap
            explicitly_mentioned = (
                f"step {step_num}" in answer_lower
                or f"step{step_num}" in answer_lower
            )

            # Check content overlap  - extract key phrases from step
            key_words = set(re.findall(r"[a-z]{4,}", step_text))
            answer_words = set(re.findall(r"[a-z]{4,}", answer_lower))
            content_overlap = len(key_words & answer_words) / max(len(key_words), 1)

            if explicitly_mentioned or content_overlap > 0.4:
                # Find position in answer for ordering check
                if explicitly_mentioned:
                    pos = answer_lower.find(f"step {step_num}")
                else:
                    # Use position of first matching keyword
                    positions = [answer_lower.find(w) for w in (key_words & answer_words) if answer_lower.find(w) >= 0]
                    pos = min(positions) if positions else -1

                mentioned_steps.append((step_num, pos))

        # Check for missing critical steps. Only applies when the answer is
        # clearly attempting a multi-step procedure walkthrough (it mentions
        # a meaningful fraction of all the SOP's steps) - an answer that
        # narrowly compares two specific steps of a ten-or-more-step SOP
        # (e.g. "which of these two things happens first") is a targeted
        # Q&A response, not an incomplete procedure summary, and flagging
        # the other eight steps as "omitted" would fail almost every
        # well-scoped answer that happens to touch exactly two steps.
        mentioned_nums = {s[0] for s in mentioned_steps}
        all_nums = {s.get("step_number", 0) or s.get("step", 0) for s in sop_steps}
        missing = all_nums - mentioned_nums
        coverage = len(mentioned_nums) / len(all_nums) if all_nums else 0

        if missing and len(mentioned_nums) >= 2 and coverage >= 0.3:
            results.append(CheckResult(
                check_type="sequence",
                status="warning" if len(missing) <= 1 else "fail",
                detail=f"Steps {sorted(missing)} not mentioned in answer (mentioned: {sorted(mentioned_nums)}).",
                source_reference=f"SOP defines steps: {sorted(all_nums)}",
            ))

        # Check ordering of mentioned steps
        if len(mentioned_steps) >= 2:
            mentioned_steps.sort(key=lambda x: x[1])  # sort by position in answer
            step_order = [s[0] for s in mentioned_steps]

            # Check if step numbers are in increasing order
            is_ordered = all(
                step_order[i] <= step_order[i + 1]
                for i in range(len(step_order) - 1)
            )

            if is_ordered:
                results.append(CheckResult(
                    check_type="sequence",
                    status="pass",
                    detail=f"Steps mentioned in correct order: {step_order}.",
                    source_reference="",
                ))
            else:
                results.append(CheckResult(
                    check_type="sequence",
                    status="fail",
                    detail=f"Steps out of order in answer: {step_order}. Expected ascending.",
                    source_reference=f"SOP step order: {sorted(all_nums)}",
                ))

        return results


class ContraindicationVerifier:
    """Verify that relevant contraindications are not omitted."""

    # Minimum fraction of a contraindication's distinctive keywords that must
    # appear in the answer before we treat the topic as being discussed at
    # all. Used both to decide relevance (is this contraindication even about
    # what the answer is about?) and completeness (was it adequately covered?)
    # so a contraindication sharing one or two generic words with the answer
    # isn't wrongly treated as an on-topic omission.
    _TOPIC_OVERLAP_RATIO = 0.3

    def check(
        self, answer: str, structured_sop: dict[str, Any]
    ) -> list[CheckResult]:
        results: list[CheckResult] = []
        contras = structured_sop.get("contraindications", [])
        if not contras:
            return results

        answer_lower = answer.lower()
        answer_keywords = set(re.findall(r"[a-z]{4,}", answer_lower)) - _GENERIC_CLINICAL_WORDS

        for contra in contras:
            # Support both dict format and plain string format
            if isinstance(contra, str):
                contra_text = contra.lower()
                contra_detail = contra.lower()
            else:
                contra_text = (contra.get("text", "") or str(contra)).lower()
                contra_detail = (contra.get("detail", "") or contra.get("text", "") or str(contra)).lower()

            contra_keywords = set(re.findall(r"[a-z]{4,}", contra_detail)) - _GENERIC_CLINICAL_WORDS
            if not contra_keywords:
                continue
            overlap = contra_keywords & answer_keywords
            overlap_ratio = len(overlap) / len(contra_keywords)

            # Relevance gate: the SAME bar used below to judge whether the
            # contraindication was adequately addressed. A contraindication
            # that only shares one or two incidental words with the answer
            # (e.g. both mention "anticoagulation" in a 6-contraindication
            # SOP) is not "on topic" just because of that coincidence.
            if len(overlap) < 2 or overlap_ratio < self._TOPIC_OVERLAP_RATIO:
                continue

            warning_present = _has_negation_cue(answer_lower)

            if warning_present:
                results.append(CheckResult(
                    check_type="contraindication",
                    status="pass",
                    detail=f"Contraindication referenced: '{contra_detail[:80]}'.",
                    source_reference=contra_text[:120],
                ))
            else:
                results.append(CheckResult(
                    check_type="contraindication",
                    status="fail",
                    detail=f"Relevant contraindication may be omitted: '{contra_detail[:80]}'.",
                    source_reference=contra_text[:120],
                ))

        return results


class ProceduralFaithfulnessVerifier:
    """
    Main verifier that orchestrates threshold, sequence, and
    contraindication checks.
    """

    def __init__(self):
        self.threshold_verifier = ThresholdVerifier()
        self.sequence_verifier = SequenceVerifier()
        self.contraindication_verifier = ContraindicationVerifier()

    def verify(
        self,
        answer: str,
        retrieved_chunks: list[dict[str, Any]],
        structured_sop: dict[str, Any],
    ) -> VerificationResult:
        """
        Run all verification checks and produce an aggregate result.

        Args:
            answer: The generated answer text.
            retrieved_chunks: Chunks used to generate the answer.
            structured_sop: Structured SOP data with steps, thresholds, contraindications.

        Returns:
            VerificationResult with per-check details and overall status.
        """
        threshold_checks = self.threshold_verifier.check(answer, structured_sop)
        sequence_checks = self.sequence_verifier.check(answer, structured_sop)
        contra_checks = self.contraindication_verifier.check(answer, structured_sop)

        all_checks = threshold_checks + sequence_checks + contra_checks

        # Compute overall score
        if not all_checks:
            # No checks applicable  - cannot verify, treat as warning
            return VerificationResult(
                status=VerificationStatus.warning,
                overall_score=0.5,
                threshold_checks=threshold_checks,
                sequence_checks=sequence_checks,
                contraindication_checks=contra_checks,
                safe_to_display=True,
                explanation="No verifiable claims found in the answer.",
            )

        pass_count = sum(1 for c in all_checks if c.status == "pass")
        warn_count = sum(1 for c in all_checks if c.status == "warning")
        fail_count = sum(1 for c in all_checks if c.status == "fail")
        total = len(all_checks)

        # Score weights: pass=1, warning=0.5, fail=0
        score = (pass_count + warn_count * 0.5) / total if total else 0.5

        # Determine status: distinguish "wrong values" from "missing values"
        # fail = wrong value or reversed sequence (dangerous)
        # warning = missing but not wrong (incomplete)
        wrong_value_fails = sum(
            1 for c in all_checks
            if c.status == "fail" and "missing" not in c.detail.lower() and "omitted" not in c.detail.lower()
        )
        missing_fails = fail_count - wrong_value_fails

        if fail_count == 0 and warn_count == 0:
            status = VerificationStatus.passed
            safe = True
            explanation = f"All {total} checks passed."
        elif wrong_value_fails == 0 and fail_count <= 2:
            # Only missing/omitted issues, no wrong values
            status = VerificationStatus.warning if fail_count > 0 else VerificationStatus.passed
            safe = True
            explanation = f"{pass_count} of {total} checks passed. {fail_count + warn_count} items flagged for review."
        elif wrong_value_fails <= 1 and total >= 4:
            status = VerificationStatus.warning
            safe = True
            explanation = f"{wrong_value_fails} potential value mismatch, {missing_fails} missing items. Review recommended."
        else:
            status = VerificationStatus.failed
            safe = wrong_value_fails < total / 3
            explanation = f"{wrong_value_fails} value mismatches and {missing_fails} missing items of {total} checks. Answer may be unsafe."

        return VerificationResult(
            status=status,
            overall_score=round(score, 2),
            threshold_checks=threshold_checks,
            sequence_checks=sequence_checks,
            contraindication_checks=contra_checks,
            safe_to_display=safe,
            explanation=explanation,
        )
