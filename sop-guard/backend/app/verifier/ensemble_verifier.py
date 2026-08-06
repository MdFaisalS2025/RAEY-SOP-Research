"""
Meridian Ensemble Verifier
---------------------------
Combines the two independently-implemented verifiers (rule-based
ProceduralFaithfulnessVerifier and NLIVerifier) into a single verdict.

On the full perturbation benchmark (17 hand-written + the programmatically-
generated set, app/evaluation/perturbation.py - 218 cases as of this
measurement; it scales with corpus size, see the note below), the two
disagree in an informative way (see nli_verifier.py's docstring and the
compare_nli route for the raw numbers):
  rule_based:  sensitivity=0.991  specificity=0.394
  nli_lite:    sensitivity=0.550  specificity=0.936

Rule-based catches almost every violation but also flags most correct
answers as suspicious (mostly WARNING, not FAILED - see the strategy
below). NLI-lite rarely false-alarms but misses more real violations.
Neither alone is a good detector; naive combinations (union = flag if
either fails; agreement = flag only if both fail) were tried first and
didn't help - union pushed almost everything into WARNING without
improving specificity, and a veto on rule-based's FAILED verdicts barely
fired, because rule-based's specificity problem turned out to live
almost entirely in its WARNING bucket, not FAILED (101 of 218 correct
answers land on WARNING vs. 31 on FAILED).

The strategy that actually works empirically: trust rule-based as the
primary signal (it has the sensitivity), but when rule-based says
WARNING and NLI-lite confidently says PASSED, upgrade the ensemble
verdict to PASSED - i.e. use NLI-lite specifically to rescue rule-
based's over-cautious WARNING calls, not to override its FAILED calls.
Measured result:
  ensemble:    sensitivity=0.849  specificity=0.821  separation=0.862
Harmonic mean of sensitivity/specificity (an F1-style balance metric):
  rule_based=0.564  nli_lite=0.693  ensemble=0.835

Two honesty notes on these numbers, not to be dropped on the next
re-measurement:
1. generate_perturbed_benchmark() scales with the current SOP corpus, so
   the case count (and these exact numbers) will drift as SOPs are
   added/edited - re-measure rather than assume these hold. Report the
   case count alongside any percentage, not just the percentage.
2. _NLI_CONFIDENCE_THRESHOLD below was chosen by inspecting its effect on
   this same 218-case set - it is an in-sample-tuned constant, not
   validated on a held-out split. Treat the ensemble numbers as a
   demonstration that the rescue strategy can work, not as a claim that
   generalizes past this corpus. See the Phase U research plan for the
   held-out evaluation this would need before it could be reported as a
   result rather than a design choice.

Research prototype. Not for clinical use.
"""

from typing import Any

from app.schemas.schemas import VerificationResult, VerificationStatus
from app.verifier.verifier import ProceduralFaithfulnessVerifier
from app.verifier.nli_verifier import NLIVerifier

# NLI-lite's overall_score must be at least this high (i.e. "confidently"
# passed, not just barely) before it's trusted to rescue a rule-based
# WARNING - a low-confidence NLI pass shouldn't override caution.
# In-sample tuned (see module docstring note 2) - not validated on a
# held-out split.
_NLI_CONFIDENCE_THRESHOLD = 0.9


class EnsembleVerifier:
    """
    Combines ProceduralFaithfulnessVerifier (primary, high sensitivity)
    with NLIVerifier (used to rescue over-cautious WARNING verdicts when
    it confidently disagrees), rather than a naive union or veto.
    """

    def __init__(self) -> None:
        self.rule_based = ProceduralFaithfulnessVerifier()
        self.nli_lite = NLIVerifier()

    def verify(
        self,
        answer: str,
        retrieved_chunks: list[dict[str, Any]],
        structured_sop: dict[str, Any],
    ) -> VerificationResult:
        rb_result = self.rule_based.verify(answer, retrieved_chunks, structured_sop)
        nl_result = self.nli_lite.verify(answer, retrieved_chunks, structured_sop)

        status = rb_result.status
        score = rb_result.overall_score
        explanation = f"Ensemble (rule-based primary): {rb_result.explanation}"

        if (
            rb_result.status == VerificationStatus.warning
            and nl_result.status == VerificationStatus.passed
            and nl_result.overall_score >= _NLI_CONFIDENCE_THRESHOLD
        ):
            status = VerificationStatus.passed
            score = max(rb_result.overall_score, nl_result.overall_score)
            explanation = (
                f"Ensemble: rule-based flagged a caution (score {rb_result.overall_score}), "
                f"but NLI-lite confidently found the claims entailed by the SOP "
                f"(score {nl_result.overall_score}) - upgraded to passed."
            )

        return VerificationResult(
            status=status,
            overall_score=round(score, 3),
            threshold_checks=rb_result.threshold_checks,
            sequence_checks=rb_result.sequence_checks,
            contraindication_checks=rb_result.contraindication_checks,
            safe_to_display=status != VerificationStatus.failed,
            explanation=explanation,
        )
