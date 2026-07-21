"""
Tests for the numeric-claim verifier (verifier/numeric_verifier.py) and its
pipeline integration: a dose/threshold stated in an answer must appear in the
cited evidence, or confidence is capped and the specific value is flagged.
"""

import pytest

from app.verifier.numeric_verifier import (
    extract_numeric_claims,
    redact_unsupported_claims,
    verify_numeric_claims,
)

_CHUNKS = [{
    "text": (
        "Start norepinephrine at 0.05 mcg/kg/min and titrate to MAP >=65 mmHg. "
        "Give 30 mL/kg crystalloid within 3 hours. Antibiotics within 1 hour. "
        "Lactate >2 mmol/L triggers repeat measurement."
    )
}]


class TestExtraction:
    def test_extracts_value_unit_pairs(self):
        claims = extract_numeric_claims("Norepinephrine 0.05 mcg/kg/min, MAP 65 mmHg.")
        pairs = {(c["value"], c["unit"]) for c in claims}
        assert ("0.05", "mcg/kg/min") in pairs
        assert ("65", "mmhg") in pairs

    def test_ignores_step_numbers_versions_years_and_markers(self):
        claims = extract_numeric_claims("See Step 7, step 10. Version 3.1, 2025. As in [1] and [2].")
        assert claims == []

    def test_dedupes_repeated_claims(self):
        claims = extract_numeric_claims("65 mmHg ... target 65 mmHg again")
        assert len([c for c in claims if c["unit"] == "mmhg"]) == 1


class TestVerification:
    def test_grounded_answer_all_pass(self):
        answer = "Start norepinephrine at 0.05 mcg/kg/min; target MAP >=65 mmHg; 30 mL/kg over 3 hours. [1]"
        result = verify_numeric_claims(answer, _CHUNKS)
        assert result["all_grounded"] is True
        assert result["unsupported"] == []
        assert result["claims_total"] >= 3

    def test_hallucinated_dose_is_flagged(self):
        # 0.5 instead of 0.05 - the classic paraphrase error
        answer = "Start norepinephrine at 0.5 mcg/kg/min."
        result = verify_numeric_claims(answer, _CHUNKS)
        assert result["all_grounded"] is False
        assert any(c["text"] == "0.5 mcg/kg/min" for c in result["unsupported"])

    def test_invented_value_is_flagged(self):
        answer = "Target MAP 70 mmHg and give 50 mL/kg."
        result = verify_numeric_claims(answer, _CHUNKS)
        assert {c["text"] for c in result["unsupported"]} == {"70 mmhg", "50 ml/kg"}

    def test_no_numeric_claims_is_grounded(self):
        result = verify_numeric_claims("Obtain blood cultures before antibiotics.", _CHUNKS)
        assert result["all_grounded"] is True
        assert result["claims_total"] == 0

    def test_spacing_differences_still_match(self):
        # SOP writes "0.05mcg/kg/min" (no space), answer writes with a space
        chunks = [{"text": "norepinephrine 0.05mcg/kg/min"}]
        result = verify_numeric_claims("norepinephrine 0.05 mcg/kg/min", chunks)
        assert result["all_grounded"] is True


class TestRedaction:
    """redact_unsupported_claims is the D1 'structured decoding' guard: an
    ungrounded dose/threshold must never reach the reader as displayed text,
    not just get a lowered confidence score they might not notice."""

    def test_unsupported_claim_is_removed_from_text(self):
        answer = "Start norepinephrine at 0.5 mcg/kg/min."
        unsupported = [{"value": "0.5", "unit": "mcg/kg/min", "text": "0.5 mcg/kg/min"}]
        redacted, count = redact_unsupported_claims(answer, unsupported)
        assert "0.5 mcg/kg/min" not in redacted
        assert count == 1
        assert "verify in source SOP" in redacted

    def test_supported_claims_are_left_alone(self):
        # Only the unsupported claim should be passed in by the caller, so a
        # grounded value elsewhere in the same sentence must survive intact.
        answer = "Titrate to MAP >=65 mmHg; norepinephrine at 0.5 mcg/kg/min."
        unsupported = [{"value": "0.5", "unit": "mcg/kg/min", "text": "0.5 mcg/kg/min"}]
        redacted, _ = redact_unsupported_claims(answer, unsupported)
        assert "65 mmHg" in redacted
        assert "0.5 mcg/kg/min" not in redacted

    def test_multiple_occurrences_all_redacted(self):
        answer = "Give 0.5 mcg/kg/min initially. If unstable, continue at 0.5 mcg/kg/min."
        unsupported = [{"value": "0.5", "unit": "mcg/kg/min", "text": "0.5 mcg/kg/min"}]
        redacted, count = redact_unsupported_claims(answer, unsupported)
        assert count == 2
        assert "0.5 mcg/kg/min" not in redacted

    def test_no_unsupported_claims_is_a_no_op(self):
        answer = "Start norepinephrine at 0.05 mcg/kg/min."
        redacted, count = redact_unsupported_claims(answer, [])
        assert redacted == answer
        assert count == 0

    def test_citation_markers_survive_redaction(self):
        answer = "Give 0.5 mcg/kg/min. [1]"
        unsupported = [{"value": "0.5", "unit": "mcg/kg/min", "text": "0.5 mcg/kg/min"}]
        redacted, _ = redact_unsupported_claims(answer, unsupported)
        assert "[1]" in redacted


class TestPipelineIntegration:
    @pytest.mark.asyncio
    async def test_ungrounded_number_caps_confidence_and_flags(self):
        from app.agents.pipeline import MeridianPipeline, _NUMERIC_UNGROUNDED_CONFIDENCE_CAP

        chunk = {
            "sop_id": "SOP-X", "sop_title": "Test SOP", "section_title": "Dosing",
            "chunk_type": "threshold",
            "chunk_text": "Start norepinephrine at 0.05 mcg/kg/min.",
            "text": "Start norepinephrine at 0.05 mcg/kg/min.",
            "relevance_score": 0.9,
        }
        pipeline = MeridianPipeline(chunks=[chunk], structured_sops={})
        # Feed a gen_result with a hallucinated dose straight into _finalize
        gen_result = {
            "answer": "Give norepinephrine at 0.5 mcg/kg/min. [1]",
            "citations": [], "confidence": 0.9, "reasoning_trace": [],
            "generation_mode": "llm", "inline_citations": [], "followup_questions": [],
        }
        response = pipeline._finalize(
            gen_result, [chunk], "threshold", ["trace"],
            evidence={"score": 0.9}, analysis={"entities": {}},
            t_start=0.0, t_generate=1, route="sop_library",
        )
        assert response.numeric_verification is not None
        assert response.numeric_verification["all_grounded"] is False
        assert response.confidence <= _NUMERIC_UNGROUNDED_CONFIDENCE_CAP
        assert response.confidence_tier in ("Weak Match", "No Reliable Match")

    @pytest.mark.asyncio
    async def test_threshold_query_redacts_ungrounded_value_from_displayed_answer(self):
        """The core D1 behavior: for a threshold query, an ungrounded dose
        must not appear anywhere in the text actually shown to the user,
        confidence cap or not."""
        from app.agents.pipeline import MeridianPipeline

        chunk = {
            "sop_id": "SOP-X", "sop_title": "Test SOP", "section_title": "Dosing",
            "chunk_type": "threshold",
            "chunk_text": "Start norepinephrine at 0.05 mcg/kg/min.",
            "text": "Start norepinephrine at 0.05 mcg/kg/min.",
            "relevance_score": 0.9,
        }
        pipeline = MeridianPipeline(chunks=[chunk], structured_sops={})
        gen_result = {
            "answer": "Give norepinephrine at 0.5 mcg/kg/min. [1]",
            "citations": [], "confidence": 0.9, "reasoning_trace": [],
            "generation_mode": "llm", "inline_citations": [], "followup_questions": [],
        }
        response = pipeline._finalize(
            gen_result, [chunk], "threshold", ["trace"],
            evidence={"score": 0.9}, analysis={"entities": {}},
            t_start=0.0, t_generate=1, route="sop_library",
        )
        assert "0.5 mcg/kg/min" not in response.answer
        assert "verify in source SOP" in response.answer
        assert response.numeric_verification["redacted"] is True
        # Citation marker and the rest of the sentence structure survive.
        assert "[1]" in response.answer

    @pytest.mark.asyncio
    async def test_medication_query_also_redacts(self):
        from app.agents.pipeline import MeridianPipeline

        chunk = {
            "sop_id": "SOP-X", "sop_title": "Test SOP", "section_title": "Dosing",
            "chunk_type": "threshold",
            "chunk_text": "Start norepinephrine at 0.05 mcg/kg/min.",
            "text": "Start norepinephrine at 0.05 mcg/kg/min.",
            "relevance_score": 0.9,
        }
        pipeline = MeridianPipeline(chunks=[chunk], structured_sops={})
        gen_result = {
            "answer": "Give norepinephrine at 0.5 mcg/kg/min.",
            "citations": [], "confidence": 0.9, "reasoning_trace": [],
            "generation_mode": "llm", "inline_citations": [], "followup_questions": [],
        }
        response = pipeline._finalize(
            gen_result, [chunk], "medication", ["trace"],
            evidence={"score": 0.9}, analysis={"entities": {}},
            t_start=0.0, t_generate=1, route="sop_library",
        )
        assert "0.5 mcg/kg/min" not in response.answer

    @pytest.mark.asyncio
    async def test_non_threshold_query_does_not_redact_incidental_number(self):
        """A general/procedural answer shouldn't have unrelated prose mangled
        by redaction - the guard is scoped to the query types where a wrong
        number is the entire point of the question."""
        from app.agents.pipeline import MeridianPipeline, _NUMERIC_UNGROUNDED_CONFIDENCE_CAP

        chunk = {
            "sop_id": "SOP-X", "sop_title": "Test SOP", "section_title": "Procedure",
            "chunk_type": "step",
            "chunk_text": "Screen the patient and document findings.",
            "text": "Screen the patient and document findings.",
            "relevance_score": 0.9,
        }
        pipeline = MeridianPipeline(chunks=[chunk], structured_sops={})
        gen_result = {
            "answer": "Screen the patient (target within 0.5 mcg/kg/min of baseline, per Step 3).",
            "citations": [], "confidence": 0.9, "reasoning_trace": [],
            "generation_mode": "llm", "inline_citations": [], "followup_questions": [],
        }
        response = pipeline._finalize(
            gen_result, [chunk], "general", ["trace"],
            evidence={"score": 0.9}, analysis={"entities": {}},
            t_start=0.0, t_generate=1, route="sop_library",
        )
        assert "0.5 mcg/kg/min" in response.answer
        assert response.numeric_verification["redacted"] is False
        # Confidence is still capped even without redaction - the guard adds
        # a stronger response for the highest-stakes query types, it doesn't
        # replace the existing safety net for everything else.
        assert response.confidence <= _NUMERIC_UNGROUNDED_CONFIDENCE_CAP
