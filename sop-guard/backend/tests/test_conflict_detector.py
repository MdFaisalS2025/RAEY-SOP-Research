"""Tests for value-conflict detection across SOP chunks."""

from app.rag.conflict_detector import detect_sop_conflicts


def test_detects_value_conflict_between_sops():
    chunks = [
        {"sop_title": "Sepsis SOP A",
         "text": "The maximum dose is 3 mcg per protocol."},
        {"sop_title": "Sepsis SOP B",
         "text": "The maximum dose is 5 mcg per protocol."},
    ]
    conflicts = detect_sop_conflicts(chunks)
    assert conflicts, "expected a conflict to be detected"
    c = conflicts[0]
    assert c["type"] == "value_conflict"
    assert c["topic"] in ("dose", "maximum")
    assert {t for conf in conflicts for t in (conf["topic"],)} & {"dose", "maximum"}
    assert {c["sop_a"], c["sop_b"]} == {"Sepsis SOP A", "Sepsis SOP B"}


def test_no_conflict_same_values():
    chunks = [
        {"sop_title": "SOP A", "text": "The maximum dose is 3 mcg."},
        {"sop_title": "SOP B", "text": "The maximum dose is 3 mcg."},
    ]
    assert detect_sop_conflicts(chunks) == []


def test_no_conflict_same_sop():
    chunks = [
        {"sop_title": "SOP A", "text": "The maximum dose is 3 mcg."},
        {"sop_title": "SOP A", "text": "The maximum dose is 5 mcg."},
    ]
    # Same SOP title -> skipped.
    assert detect_sop_conflicts(chunks) == []


def test_no_conflict_between_unrelated_values_sharing_a_topic_word():
    """
    Regression test: two chunks about entirely different drugs/measurements
    that both happen to contain a topic word (e.g. "dose") must not be
    flagged just because *some* numbers elsewhere in the text differ. Only
    values found near the shared keyword should be compared.
    """
    chunks = [
        {"sop_title": "Code Blue Response Protocol",
         "text": "Give epinephrine 1 mg IV push. Target MAP is above 10 mmhg increase. "
                  "Defibrillate at 150 mg." + " padding text " * 5 +
                  "The maximum dose of amiodarone is 300 mg."},
        {"sop_title": "Sepsis Management Protocol",
         "text": "Administer 0.5 ml normal saline bolus. Reassess in 4 hours. "
                  "Vancomycin trough target is 50 mg." + " padding text " * 5 +
                  "The maximum dose of amiodarone is 300 mg."},
    ]
    conflicts = detect_sop_conflicts(chunks)
    assert conflicts == [], f"expected no conflicts, got: {conflicts}"


def test_conflict_when_same_topic_value_differs_despite_unrelated_noise():
    """Same shared-keyword value genuinely differs -> still detected, even with unrelated numbers nearby."""
    chunks = [
        {"sop_title": "Code Blue Response Protocol",
         "text": "Give epinephrine 1 mg IV push. The maximum dose is 3 mcg per protocol."},
        {"sop_title": "Sepsis Management Protocol",
         "text": "Administer 0.5 ml normal saline bolus. The maximum dose is 5 mcg per protocol."},
    ]
    conflicts = detect_sop_conflicts(chunks)
    assert conflicts, "expected a conflict on the shared 'maximum dose' value"
    assert all(c["topic"] in ("dose", "maximum") for c in conflicts)


def test_dose_topic_never_matches_a_pressure_unit():
    """
    Regression test: mmHg is a pressure/threshold unit, never a dose unit.
    A "dose"-keyword conflict must not fire just because an mmHg value happens
    to fall within the proximity window of the word "dose" in both chunks.
    """
    chunks = [
        {"sop_title": "Code Blue Response Protocol",
         "text": "ETCO2 target during dose titration is above 10 mmhg sustained."},
        {"sop_title": "Sepsis Management Protocol",
         "text": "MAP threshold to guide vasopressor dose is above 65 mmhg."},
    ]
    conflicts = detect_sop_conflicts(chunks)
    assert conflicts == [], f"expected no dose conflict from mmHg values, got: {conflicts}"
