"""Tests for app/services/query_clarification.py and its wiring into
pipeline.py's _prepare()."""

from app.services.query_clarification import detect_ambiguity


def _chunk(sop_title, score=0.8):
    return {"sop_title": sop_title, "relevance_score": score}


def test_no_ambiguity_for_non_prone_query_type():
    retrieved = [_chunk("SOP A"), _chunk("SOP B")]
    assert detect_ambiguity("procedure_steps", {}, retrieved) is None


def test_no_ambiguity_when_drug_named():
    retrieved = [_chunk("SOP A"), _chunk("SOP B")]
    assert detect_ambiguity("threshold", {"drugs": ["norepinephrine"]}, retrieved) is None


def test_no_ambiguity_when_condition_named():
    retrieved = [_chunk("SOP A"), _chunk("SOP B")]
    assert detect_ambiguity("medication", {"conditions": ["sepsis"]}, retrieved) is None


def test_no_ambiguity_when_single_sop_matched():
    retrieved = [_chunk("SOP A"), _chunk("SOP A")]
    assert detect_ambiguity("threshold", {}, retrieved) is None


def test_ambiguity_detected_for_dose_question_across_multiple_sops():
    retrieved = [_chunk("Sepsis Management Protocol"), _chunk("Anticoagulation Safety Protocol"), _chunk("Insulin and Hypoglycemia Management Protocol")]
    result = detect_ambiguity("threshold", {}, retrieved)
    assert result is not None
    assert "Sepsis Management Protocol" in result["options"]
    assert "Anticoagulation Safety Protocol" in result["options"]
    assert len(result["options"]) <= 4


def test_ambiguity_detected_for_medication_query_type():
    retrieved = [_chunk("SOP A"), _chunk("SOP B")]
    result = detect_ambiguity("medication", {"drugs": [], "conditions": []}, retrieved)
    assert result is not None
    assert "medication" in result["question"].lower() or "protocol" in result["question"].lower()
