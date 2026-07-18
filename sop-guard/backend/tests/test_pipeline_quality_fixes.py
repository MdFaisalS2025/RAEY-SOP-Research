"""
Regression tests for two real bugs found by app/evaluation/quality_eval.py's
5-category (A-E) route-correctness harness:

1. Non-clinical queries ("What is the cafeteria menu today?") had no
   _looks_clinical() gate on the main Route B trigger in pipeline.py's
   _prepare() - only the separate _post_generation_fallback path checked
   it. A broad external-provider search on an off-domain query could
   surface a loosely-matching paper and produce a "Based on external
   literature" answer to a hospital-admin question.

2. A short referential follow-up ("Does it say when to escalate?" after
   asking about sepsis management) retrieved a completely unrelated SOP
   (Patient Flow and Bed Management, which also uses the word "escalate")
   because the discounted context_query pass (weight 0.25) couldn't
   outweigh a competing SOP's direct lexical match on the query's own
   generic vocabulary. Fixed by detecting referential follow-ups (no
   drug/condition entity of their own, contains a pronoun like "it"/
   "this") and both weighting conversation context more heavily and
   skipping the semantic-relevance hard gate (which has no way to judge
   a pronoun-only query against a chunk on its own terms).
"""

import pytest

from app.agents.pipeline import MeridianPipeline, _is_referential_followup, _looks_clinical
from app.demo_data.demo_sops import DEMO_SOPS
from app.rag.chunker import create_sop_chunks
from app.rag.clinical_terms import expand_query
from app.services.sop_structurer import structure_sop


@pytest.fixture(scope="module")
def demo_chunks() -> list[dict]:
    all_chunks: list[dict] = []
    for data in DEMO_SOPS:
        structured = data.get("structured_json") or structure_sop(data["raw_text"], data["title"])
        all_chunks.extend(create_sop_chunks(
            raw_text=data["raw_text"],
            structured=structured,
            sop_id=data["sop_id"],
            sop_title=data["title"],
            department=data.get("department", "General"),
            version=data.get("version", "1.0"),
            status="active",
            effective_date=data.get("effective_date", ""),
            review_date=data.get("review_date", ""),
        ))
    return all_chunks


@pytest.fixture
def pipeline(demo_chunks) -> MeridianPipeline:
    return MeridianPipeline(chunks=demo_chunks, structured_sops={})


class TestNonClinicalQueryNeverTriggersExternalSearch:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("query", [
        "What is the cafeteria menu today?",
        "How do I fix a leaking kitchen faucet?",
        "How do I reset my laptop password?",
    ])
    async def test_non_clinical_query_routes_to_no_evidence_not_external(self, pipeline, query):
        response = await pipeline.run(query)
        assert response.route not in ("sop_library", "external_evidence"), (
            f"{query!r} is non-clinical and should route to no_evidence "
            f"(or clarification), never sop_library or external_evidence; "
            f"got route={response.route!r}"
        )

    def test_looks_clinical_rejects_non_clinical_admin_queries(self):
        assert _looks_clinical("What is the cafeteria menu today?") is False
        assert _looks_clinical("How do I reset my laptop password?") is False

    def test_looks_clinical_accepts_named_drug_or_condition(self):
        assert _looks_clinical("What is the norepinephrine dose for sepsis?") is True


class TestReferentialFollowupRetrieval:
    def test_is_referential_followup_detects_pronoun_with_no_entity(self):
        assert _is_referential_followup(
            "Does it say when to escalate?",
            entities={"drugs": [], "conditions": []},
            context_query="What are the steps for sepsis management?",
        ) is True

    def test_is_referential_followup_false_when_query_names_its_own_entity(self):
        assert _is_referential_followup(
            "Does it mention norepinephrine?",
            entities={"drugs": ["norepinephrine"], "conditions": []},
            context_query="What are the steps for sepsis management?",
        ) is False

    def test_is_referential_followup_false_without_context(self):
        assert _is_referential_followup(
            "Does it say when to escalate?", entities={"drugs": [], "conditions": []}, context_query="",
        ) is False

    @pytest.mark.asyncio
    async def test_pronoun_followup_after_sepsis_retrieves_sepsis_not_bed_management(self, pipeline):
        """The real bug: 'escalate' also appears in the Patient Flow and Bed
        Management Protocol (bed-placement escalation), which previously
        outranked the sepsis SOP for this pronoun-only follow-up despite
        the conversation being about sepsis the whole time."""
        response = await pipeline.run(
            query="Does it say when to escalate?",
            context_query="What are the steps for sepsis management? What dose of norepinephrine does it mention?",
            history_context=(
                "Q: What are the steps for sepsis management?\n"
                "A: (sepsis management steps)\n"
                "Q: What dose of norepinephrine does it mention?\n"
                "A: (0.05 mcg/kg/min)"
            ),
        )
        assert response.route == "sop_library"
        assert response.retrieved_chunks, "expected retrieved chunks for a sufficient-evidence route"
        assert response.retrieved_chunks[0].sop_title == "Sepsis Management Protocol"


class TestBrandNameSynonymExpansion:
    def test_levophed_expands_to_norepinephrine(self):
        variants = expand_query("What is the levophed dose for septic shock?")
        assert any("norepinephrine" in v for v in variants), (
            f"expected a variant containing 'norepinephrine' for a levophed query, got {variants}"
        )
