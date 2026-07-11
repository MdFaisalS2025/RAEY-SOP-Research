"""Regression tests for two verifier false positives observed live:

1. SequenceVerifier flagged a numbered-list answer that was genuinely in
   order 1-10 as "out of order", because position-finding for steps with
   no explicit "step N" phrase used the earliest occurrence of ANY shared
   4+-letter word - including generic words like "hours"/"administer"
   that also appear in other, unrelated steps earlier in the answer.

2. ThresholdVerifier's range-mismatch check matched a "6-12 hours" source-
   control timing statement against an unrelated "2-4 hours" lactate
   threshold, because _context_matches counted shared filler words
   ("within", "hours") as topical overlap.
"""

from app.verifier.verifier import SequenceVerifier, ThresholdVerifier


def test_sequence_verifier_does_not_flag_correctly_ordered_numbered_answer():
    """Mirrors the real sepsis-protocol answer: 10 numbered steps, in
    order, where several steps share generic vocabulary (hours, mmHg,
    administer) with each other."""
    sop_steps = [
        {"step": 1, "action": "Screen with qSOFA criteria."},
        {"step": 2, "action": "Obtain blood cultures before antibiotics."},
        {"step": 3, "action": "Measure serum lactate."},
        {"step": 4, "action": "Administer antibiotics within 1 hour."},
        {"step": 5, "action": "Begin fluid resuscitation within 3 hours."},
        {"step": 6, "action": "Reassess hemodynamic status and urine output."},
        {"step": 7, "action": "Start norepinephrine if MAP below 65 mmHg."},
        {"step": 8, "action": "Add vasopressin above 0.5 mcg/kg/min."},
        {"step": 9, "action": "Consider hydrocortisone if instability persists."},
        {"step": 10, "action": "Obtain source control within 6-12 hours."},
    ]
    answer = (
        "1. Screen with qSOFA criteria.\n"
        "2. Obtain blood cultures before antibiotics.\n"
        "3. Measure serum lactate.\n"
        "4. Administer antibiotics within 1 hour.\n"
        "5. Begin fluid resuscitation within 3 hours.\n"
        "6. Reassess hemodynamic status and urine output.\n"
        "7. Start norepinephrine if MAP below 65 mmHg.\n"
        "8. Add vasopressin above 0.5 mcg/kg/min.\n"
        "9. Consider hydrocortisone if instability persists.\n"
        "10. Obtain source control within 6-12 hours.\n"
    )
    results = SequenceVerifier().check(answer, {"steps": sop_steps})
    sequence_results = [r for r in results if r.check_type == "sequence"]
    fail_results = [r for r in sequence_results if r.status == "fail" and "out of order" in r.detail.lower()]
    assert fail_results == [], f"False 'out of order' flag: {[r.detail for r in fail_results]}"


def test_threshold_verifier_does_not_match_unrelated_ranges_sharing_generic_words():
    """The lactate threshold's '2-4 hours' should not be matched against
    an unrelated '6-12 hours' source-control statement just because both
    windows are phrased as '... within N-M hours'."""
    structured_sop = {
        "thresholds": [
            {"parameter": "Lactate", "value": ">2 mmol/L", "action": "Repeat within 2-4 hours, aggressive resuscitation"},
        ]
    }
    answer = "10. Obtain source control within 6-12 hours."
    results = ThresholdVerifier().check(answer, structured_sop)
    range_mismatches = [r for r in results if "Range mismatch" in r.detail]
    assert range_mismatches == [], f"False range-mismatch flag: {[r.detail for r in range_mismatches]}"


def test_threshold_verifier_still_catches_genuine_range_mismatch():
    """Regression guard: the generic-word filtering above must not make
    the range-mismatch check blind to real, on-topic mismatches."""
    structured_sop = {
        "thresholds": [
            {"parameter": "Lactate", "value": ">2 mmol/L", "action": "Repeat lactate within 2-4 hours"},
        ]
    }
    answer = "Repeat lactate within 6-12 hours if elevated."
    results = ThresholdVerifier().check(answer, structured_sop)
    range_mismatches = [r for r in results if "Range mismatch" in r.detail]
    assert len(range_mismatches) == 1


def test_sequence_verifier_still_catches_genuinely_reversed_steps():
    """Regression guard: numbered-marker position-finding must still
    catch a real reversed-order answer."""
    sop_steps = [
        {"step": 1, "action": "Screen with qSOFA criteria first."},
        {"step": 2, "action": "Obtain blood cultures before antibiotics second."},
    ]
    answer = "1. Obtain blood cultures before antibiotics second.\n2. Screen with qSOFA criteria first.\n"
    # Deliberately swapped: step 2's content appears first, step 1's second.
    answer_reversed = "2. Screen with qSOFA criteria first.\n1. Obtain blood cultures before antibiotics second.\n"
    results = SequenceVerifier().check(answer_reversed, {"steps": sop_steps})
    fail_results = [r for r in results if r.status == "fail" and "out of order" in r.detail.lower()]
    assert len(fail_results) == 1
