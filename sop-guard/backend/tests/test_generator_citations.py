"""
Tests for MockGenerator's inline [N] citations and template follow-ups.

Regression coverage for a real bug: the mock generator (the default,
no-LLM-configured generation mode) previously returned empty
inline_citations/followup_questions, and citation_coverage in the
ragas_lite eval was always 0.0 as a direct result. Also covers the
llm_generator.py mock-fallback overwrite bug found while fixing this -
it was unconditionally resetting inline_citations/followup_questions to
[] after calling the mock generator, discarding this data.
"""

import re

from app.rag.generator import MockGenerator

_THRESHOLD_CHUNK = {
    "sop_id": "SOP-TEST-001",
    "sop_title": "Test Protocol",
    "section_title": "Thresholds",
    "chunk_type": "threshold",
    "chunk_text": "MAP target: >=65 mmHg\nLactate threshold: >2 mmol/L",
    "relevance_score": 0.4,
}

_STEP_CHUNK_1 = {
    "sop_id": "SOP-TEST-001",
    "sop_title": "Test Protocol",
    "section_title": "Procedure",
    "chunk_type": "step",
    "chunk_text": "Step 1: Assess the patient.",
    "relevance_score": 0.35,
}

_STEP_CHUNK_2 = {
    "sop_id": "SOP-TEST-001",
    "sop_title": "Test Protocol",
    "section_title": "Procedure",
    "chunk_type": "step",
    "chunk_text": "Step 2: Administer treatment.",
    "relevance_score": 0.3,
}


class TestMockGeneratorInlineCitations:
    def test_threshold_answer_has_numbered_markers(self):
        gen = MockGenerator()
        result = gen.generate_answer("What is the MAP target?", [_THRESHOLD_CHUNK], "threshold")
        assert re.search(r"\[\d+\]", result["answer"]), "expected a [N] citation marker in the answer"
        assert result["inline_citations"], "expected non-empty inline_citations"
        assert result["inline_citations"][0]["sop_title"] == "Test Protocol"

    def test_sequence_answer_has_numbered_markers_per_step_chunk(self):
        gen = MockGenerator()
        result = gen.generate_answer(
            "What are the steps?", [_STEP_CHUNK_1, _STEP_CHUNK_2], "sequence"
        )
        assert "[1]" in result["answer"] or "[2]" in result["answer"]
        assert len(result["inline_citations"]) == 2

    def test_cited_in_answer_is_marked_correctly(self):
        gen = MockGenerator()
        result = gen.generate_answer("What is the MAP target?", [_THRESHOLD_CHUNK], "threshold")
        cited_flags = [c["cited_in_answer"] for c in result["inline_citations"]]
        assert any(cited_flags), "at least one citation record should be marked cited_in_answer"

    def test_followup_questions_are_populated_by_query_type(self):
        gen = MockGenerator()
        result = gen.generate_answer("What is the MAP target?", [_THRESHOLD_CHUNK], "threshold")
        assert result["followup_questions"], "expected non-empty followup_questions"
        assert all(isinstance(q, str) for q in result["followup_questions"])

    def test_abstained_response_has_empty_citations_and_followups(self):
        gen = MockGenerator()
        result = gen.generate_answer("completely unrelated question", [], "general")
        assert result["abstained"] is True
        assert result["inline_citations"] == []
        assert result["followup_questions"] == []

    def test_max_dose_query_without_stated_max_gets_honest_caveat(self):
        """Real gap found in a full-app audit: asking for the maximum
        norepinephrine dose returned only a starting dose and an
        escalation-to-vasopressin trigger - neither is a stated maximum -
        with nothing telling the reader that. The answer must now flag
        this instead of silently presenting the nearest related values."""
        gen = MockGenerator()
        chunk = {
            "sop_id": "SOP-TEST-002",
            "sop_title": "Vasopressor Protocol",
            "section_title": "Thresholds",
            "chunk_type": "threshold",
            "chunk_text": (
                "Start norepinephrine at 0.05 mcg/kg/min.\n"
                "If >0.5 mcg/kg/min, add vasopressin."
            ),
            "relevance_score": 0.4,
        }
        result = gen.generate_answer(
            "What is the maximum norepinephrine dose?", [chunk], "threshold"
        )
        assert "does not state an explicit maximum" in result["answer"].lower()

    def test_non_bound_query_gets_no_caveat(self):
        gen = MockGenerator()
        result = gen.generate_answer("What is the MAP target?", [_THRESHOLD_CHUNK], "threshold")
        assert "does not state an explicit" not in result["answer"].lower()

    def test_max_query_with_stated_max_gets_no_caveat(self):
        gen = MockGenerator()
        chunk = {
            "sop_id": "SOP-TEST-003",
            "sop_title": "Test Protocol",
            "section_title": "Thresholds",
            "chunk_type": "threshold",
            "chunk_text": "Maximum norepinephrine dose: 3 mcg/kg/min.",
            "relevance_score": 0.4,
        }
        result = gen.generate_answer(
            "What is the maximum norepinephrine dose?", [chunk], "threshold"
        )
        assert "does not state an explicit" not in result["answer"].lower()


class TestLLMGeneratorMockFallbackPreservesCitations:
    async def test_mock_mode_preserves_mock_generator_citations(self):
        from app.rag.llm_generator import LLMGenerator

        gen = LLMGenerator(provider="mock")
        result = await gen.generate_answer(
            "What is the MAP target?", [_THRESHOLD_CHUNK], "threshold"
        )
        assert result["generation_mode"] == "mock"
        assert result["inline_citations"], (
            "llm_generator's mock-mode branch must not overwrite the mock "
            "generator's own inline_citations with an empty list"
        )
        assert result["followup_questions"]
