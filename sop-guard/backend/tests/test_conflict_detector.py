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
