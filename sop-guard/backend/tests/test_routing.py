"""Tests for the Route A/B/C/D intent classifier and message builders in app/agents/routing.py."""

from app.agents.routing import classify_intent, build_external_evidence_answer, build_no_evidence_answer


def test_classify_intent_internal_default():
    assert classify_intent("What is the patient discharge procedure?") == "internal"


def test_classify_intent_external():
    assert classify_intent("What are the latest recommendations for sepsis detection?") == "external"


def test_classify_intent_hybrid():
    assert classify_intent("Compare our SOP with current literature on sepsis.") == "hybrid"


def test_build_external_evidence_answer_cites_sources():
    records = [
        {"title": "A Study", "journal_display_name": "NEJM", "pub_date": "2025"},
        {"title": "Another Study", "journal": "BMJ", "pub_date": "2024"},
    ]
    result = build_external_evidence_answer("latest sepsis guidance", records)
    assert "No matching internal SOP" in result["answer"]
    assert "NEJM" in result["answer"]
    assert len(result["citations"]) == 2
    assert result["generation_mode"] == "external_evidence"
    assert 0 < result["confidence"] <= 0.6


def test_build_no_evidence_answer_leads_with_required_phrase():
    msg = build_no_evidence_answer(["Try rephrasing your question."])
    assert msg.startswith("No validated evidence found.")


def test_build_external_evidence_answer_includes_supporting_excerpt_when_present():
    """P1.3: a record with a fetched abstract should show the sentence that
    actually supports the claim, not just the title - so external evidence
    reads as verifiable rather than asserted."""
    records = [{
        "title": "A Study", "journal_display_name": "NEJM", "pub_date": "2025",
        "supporting_excerpt": "Norepinephrine above 0.5 mcg/kg/min was associated with increased mortality.",
    }]
    result = build_external_evidence_answer("norepinephrine mortality", records)
    assert "Norepinephrine above 0.5 mcg/kg/min" in result["answer"]


def test_build_external_evidence_answer_omits_excerpt_when_absent():
    """No fabricated excerpt when no abstract was fetched - degrades to
    title-only, exactly the pre-P1.3 behavior."""
    records = [{"title": "A Study", "journal_display_name": "NEJM", "pub_date": "2025"}]
    result = build_external_evidence_answer("sepsis", records)
    assert '"' not in result["answer"]
