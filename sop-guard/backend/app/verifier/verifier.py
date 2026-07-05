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

            # Extract numbers from both value AND action fields
            nums_in_value = re.findall(r"\d+\.?\d*", thresh_value)
            nums_in_action = re.findall(r"\d+\.?\d*", thresh_action)
            all_sop_nums = nums_in_value + nums_in_action

            if not all_sop_nums:
                continue

            # Extract ranges from value and action
            sop_ranges_val = self._extract_ranges(thresh_value)
            sop_ranges_act = self._extract_ranges(thresh_action)
            sop_ranges = sop_ranges_val + sop_ranges_act

            # Check range mismatches first (more precise than individual numbers)
            range_mismatch = False
            if sop_ranges and self._is_relevant_threshold(thresh_context, thresh_parameter, answer):
                for sop_lo, sop_hi, sop_range_ctx in sop_ranges:
                    for ans_lo, ans_hi, ans_range_ctx in answer_ranges:
                        # Check if ranges are about the same thing (context overlap)
                        if self._context_matches(ans_range_ctx, thresh_context):
                            if sop_lo != ans_lo or sop_hi != ans_hi:
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

            # Check individual number matching for value field
            matched = False
            for num in nums_in_value:
                for ans_num, ans_ctx in answer_numbers:
                    if num == ans_num:
                        matched = True
                        if self._context_matches(ans_ctx, thresh_context):
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

            # Also check action field numbers if relevant
            if nums_in_action and self._is_relevant_threshold(thresh_context, thresh_parameter, answer):
                for num in nums_in_action:
                    action_num_found = False
                    for ans_num, ans_ctx in answer_numbers:
                        if num == ans_num:
                            action_num_found = True
                            break
                    if not action_num_found and not range_mismatch:
                        # Check if this is part of a range that was already handled
                        in_sop_range = any(
                            num == lo or num == hi for lo, hi, _ in sop_ranges_act
                        )
                        in_ans_range = any(
                            num == lo or num == hi for lo, hi, _ in answer_ranges
                        )
                        if in_sop_range and not in_ans_range:
                            # The range exists in SOP action but answer has a different range
                            pass  # Handled by range check above

            if not matched and self._is_relevant_threshold(thresh_context, thresh_parameter, answer):
                results.append(CheckResult(
                    check_type="threshold",
                    status="fail",
                    detail=f"SOP threshold '{thresh_value}' is relevant but missing from answer.",
                    source_reference=thresh_context[:120],
                ))

        return results

    def _extract_numbers_with_context(self, text: str) -> list[tuple[str, str]]:
        """Extract numbers and their surrounding context from text."""
        results = []
        for match in re.finditer(r"\d+\.?\d*", text):
            start = max(0, match.start() - 50)
            end = min(len(text), match.end() + 50)
            results.append((match.group(), text[start:end]))
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

    def _is_relevant_threshold(self, thresh_context: str, thresh_parameter: str, answer: str) -> bool:
        """Check if a threshold's topic appears in the answer."""
        answer_lower = answer.lower()
        context_lower = thresh_context.lower()
        param_lower = thresh_parameter.lower()

        # Check for abbreviation matches
        for abbrev, expansions in self._ABBREVIATION_MAP.items():
            if abbrev in context_lower or abbrev in param_lower:
                if abbrev in answer_lower or any(exp in answer_lower for exp in expansions):
                    return True

        # Extract key medical terms from threshold context
        keywords = set(re.findall(r"[a-z]{3,}", context_lower))
        answer_words = set(re.findall(r"[a-z]{3,}", answer_lower))
        overlap = keywords & answer_words
        # Use lower threshold: 1 match of length >= 4 or 2 matches of length >= 3
        long_overlap = {w for w in overlap if len(w) >= 4}
        if len(long_overlap) >= 1:
            return True
        return len(overlap) >= 2


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

        # Check for missing critical steps
        mentioned_nums = {s[0] for s in mentioned_steps}
        all_nums = {s.get("step_number", 0) or s.get("step", 0) for s in sop_steps}
        missing = all_nums - mentioned_nums

        if missing and len(mentioned_nums) > 0:
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

    def check(
        self, answer: str, structured_sop: dict[str, Any]
    ) -> list[CheckResult]:
        results: list[CheckResult] = []
        contras = structured_sop.get("contraindications", [])
        if not contras:
            return results

        answer_lower = answer.lower()

        for contra in contras:
            # Support both dict format and plain string format
            if isinstance(contra, str):
                contra_text = contra.lower()
                contra_detail = contra.lower()
            else:
                contra_text = (contra.get("text", "") or str(contra)).lower()
                contra_detail = (contra.get("detail", "") or contra.get("text", "") or str(contra)).lower()

            # Check if the contraindication topic is relevant to the answer
            contra_keywords = set(re.findall(r"[a-z]{4,}", contra_detail))
            answer_keywords = set(re.findall(r"[a-z]{4,}", answer_lower))
            overlap = contra_keywords & answer_keywords

            if len(overlap) < 2:
                # Contraindication topic not relevant to this answer
                continue

            # Check if the prohibition/warning is actually mentioned
            prohibition_terms = ["do not", "don't", "avoid", "never", "must not",
                                 "should not", "contraindicated", "prohibited",
                                 "warning", "caution"]

            warning_present = any(term in answer_lower for term in prohibition_terms)
            detail_words_present = len(overlap) / max(len(contra_keywords), 1) > 0.3

            if warning_present and detail_words_present:
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
