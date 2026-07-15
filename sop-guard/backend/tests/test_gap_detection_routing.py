"""
Pipeline-level regression test for real semantic-relevance gap detection.

Context: live testing found the pipeline confidently matching off-topic
questions to the wrong SOP instead of triggering gap detection - "heat
stroke" -> Code Stroke Response Protocol, "jellyfish sting" and "kitchen
faucet" -> Infection Control Isolation Protocol. Root cause: no semantic
domain-disambiguation signal existed anywhere in the pipeline (see
app/rag/reranker.py's CrossEncoderReranker, wired into
app/agents/pipeline.py, and the `semantic_relevance` hard gate in
app/rag/evidence_sufficiency.py). This test runs the *real* pipeline
against the *real* demo SOP corpus - not synthetic fixtures - so it
actually exercises retrieval, the cross-encoder, and the sufficiency gate
together, the same way app/main.py._load_demo_data builds the corpus at
startup.

Deliberately not a hardcoded-keyword check: these queries are fixtures for
the general semantic-relevance mechanism, not the mechanism itself.
"""

import pytest

from app.agents.pipeline import MeridianPipeline
from app.demo_data.demo_sops import DEMO_SOPS
from app.rag.chunker import create_sop_chunks
from app.services.sop_structurer import structure_sop


@pytest.fixture(scope="module")
def demo_chunks() -> list[dict]:
    all_chunks: list[dict] = []
    for data in DEMO_SOPS:
        structured = data.get("structured_json") or structure_sop(data["raw_text"], data["title"])
        chunks = create_sop_chunks(
            raw_text=data["raw_text"],
            structured=structured,
            sop_id=data["sop_id"],
            sop_title=data["title"],
            department=data.get("department", "General"),
            version=data.get("version", "1.0"),
            status="active",
            effective_date=data.get("effective_date", ""),
            review_date=data.get("review_date", ""),
        )
        all_chunks.extend(chunks)
    return all_chunks


@pytest.fixture
def pipeline(demo_chunks) -> MeridianPipeline:
    return MeridianPipeline(chunks=demo_chunks, structured_sops={})


LEGITIMATE_QUERIES = [
    "What are the steps for sepsis management?",
    "What is the central line infection prevention procedure?",
    "What is the blood transfusion protocol?",
    "When should insulin be held for hypoglycemia?",
    "What contraindications apply before blood transfusion?",
    "What is the door-to-CT target time for code stroke?",
    "What are the steps for fall prevention?",
]

GAP_QUERIES = [
    "What is the protocol for heat stroke?",
    "Jellyfish sting treatment",
    "How do I fix a leaking kitchen faucet?",
    "How do I repair a broken elevator?",
    "What is the cafeteria menu?",
]


class TestGapDetectionRouting:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("query", LEGITIMATE_QUERIES)
    async def test_legitimate_clinical_question_routes_to_sop_library(self, pipeline, query):
        response = await pipeline.run(query)
        # "clarification" (pre-existing ambiguity detection, unrelated to
        # this fix - see detect_ambiguity in pipeline.py) is also an
        # acceptable outcome here: it's an honest request for
        # disambiguation, not a false-positive wrong-SOP match, which is
        # the failure mode this test guards against.
        assert response.route in ("sop_library", "clarification"), (
            f"{query!r} should match an internal SOP (or ask for disambiguation); "
            f"got route={response.route!r}, abstained={response.abstained}"
        )
        assert response.abstained is False

    @pytest.mark.asyncio
    @pytest.mark.parametrize("query", GAP_QUERIES)
    async def test_off_topic_question_does_not_confidently_match_wrong_sop(self, pipeline, query):
        """
        The core regression: these must NOT route to sop_library (which
        would mean the system silently attached the wrong SOP's guidance
        to an unrelated question). Insufficient SOP evidence should fall
        through to external_evidence or no_evidence instead.
        """
        response = await pipeline.run(query)
        assert response.route != "sop_library", (
            f"{query!r} should not confidently match any internal SOP; "
            f"got route={response.route!r} (false-positive SOP match)"
        )
