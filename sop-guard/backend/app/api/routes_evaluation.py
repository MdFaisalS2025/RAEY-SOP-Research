"""
SOP-Guard Evaluation Routes
----------------------------
Research prototype  - NOT for clinical use.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.db import get_db
from app.models.models import SOP, SOPChunk
from app.schemas.schemas import EvaluationResult
from app.agents.pipeline import SOPGuardPipeline
from app.evaluation.evaluator import Evaluator
from app.rag.hybrid_retriever import HybridRetriever
from app.rag.evaluator import evaluate_retrieval

router = APIRouter(tags=["Evaluation"])

# Cache latest evaluation results in-memory
_latest_result: EvaluationResult | None = None
_latest_rag_result: dict | None = None


@router.post("/api/evaluate", response_model=EvaluationResult)
async def run_evaluation(db: AsyncSession = Depends(get_db)):
    """Run the evaluation suite against the current pipeline and SOP data."""
    global _latest_result

    # Load chunks and structured SOPs
    rows = (await db.execute(
        select(SOPChunk, SOP.sop_id.label("sop_sop_id"), SOP.title.label("sop_title"), SOP.structured_json)
        .join(SOP, SOPChunk.sop_id == SOP.id)
    )).all()

    chunks = []
    structured_sops: dict[str, dict] = {}
    for row in rows:
        chunk = row[0]
        chunks.append({
            "chunk_text": chunk.chunk_text,
            "section_title": chunk.section_title,
            "sop_title": row.sop_title,
            "sop_id": row.sop_sop_id,
            "chunk_index": chunk.chunk_index,
        })
        if row.sop_sop_id not in structured_sops and row.structured_json:
            structured_sops[row.sop_sop_id] = row.structured_json

    pipeline = SOPGuardPipeline(chunks, structured_sops)
    evaluator = Evaluator(pipeline)
    _latest_result = await evaluator.run_evaluation()
    return _latest_result


@router.get("/api/evaluation/results", response_model=EvaluationResult)
async def get_evaluation_results():
    """Get the latest evaluation results."""
    if _latest_result is None:
        return EvaluationResult(total_cases=0, details=[])
    return _latest_result


@router.post("/api/evaluate/rag")
async def run_rag_evaluation(db: AsyncSession = Depends(get_db)):
    """Run RAG-specific evaluation (retrieval quality, keyword coverage, refusal accuracy)."""
    global _latest_rag_result

    # Load chunks and structured SOPs
    rows = (await db.execute(
        select(SOPChunk, SOP.sop_id.label("sop_sop_id"), SOP.title.label("sop_title"), SOP.structured_json)
        .join(SOP, SOPChunk.sop_id == SOP.id)
    )).all()

    chunks = []
    structured_sops: dict[str, dict] = {}
    for row in rows:
        chunk = row[0]
        chunks.append({
            "chunk_text": chunk.chunk_text,
            "section_title": chunk.section_title,
            "sop_title": row.sop_title,
            "sop_id": row.sop_sop_id,
            "chunk_index": chunk.chunk_index,
        })
        if row.sop_sop_id not in structured_sops and row.structured_json:
            structured_sops[row.sop_sop_id] = row.structured_json

    retriever = HybridRetriever(chunks)
    pipeline = SOPGuardPipeline(chunks, structured_sops)
    _latest_rag_result = evaluate_retrieval(retriever, pipeline)
    return _latest_rag_result


@router.get("/api/evaluate/rag/results")
async def get_rag_evaluation_results():
    """Get the latest RAG evaluation results."""
    if _latest_rag_result is None:
        return {"total_cases": 0, "details": []}
    return _latest_rag_result


@router.get("/api/evaluation/ragas-lite")
async def run_ragas_lite_evaluation(db: AsyncSession = Depends(get_db)):
    """Run the RAGAS-lite reference-free evaluation suite and return JSON."""
    from app.evaluation.ragas_lite import run_eval

    # Load chunks and structured SOPs from DB; fall back to demo data if empty
    rows = (await db.execute(
        select(SOPChunk, SOP.sop_id.label("sop_sop_id"), SOP.title.label("sop_title"), SOP.structured_json)
        .join(SOP, SOPChunk.sop_id == SOP.id)
    )).all()

    pipeline = None
    if rows:
        chunks = []
        structured_sops: dict[str, dict] = {}
        for row in rows:
            chunk = row[0]
            chunks.append({
                "chunk_text": chunk.chunk_text,
                "text": chunk.chunk_text,
                "section_title": chunk.section_title,
                "sop_title": row.sop_title,
                "sop_id": row.sop_sop_id,
                "chunk_type": getattr(chunk, "chunk_type", "section") or "section",
                "chunk_index": chunk.chunk_index,
            })
            if row.sop_sop_id not in structured_sops and row.structured_json:
                structured_sops[row.sop_sop_id] = row.structured_json
        pipeline = SOPGuardPipeline(chunks, structured_sops)

    return await run_eval(pipeline)


def _pipeline_from_rows(rows) -> SOPGuardPipeline | None:
    if not rows:
        return None
    chunks = []
    structured_sops: dict[str, dict] = {}
    for row in rows:
        chunk = row[0]
        chunks.append({
            "chunk_text": chunk.chunk_text,
            "text": chunk.chunk_text,
            "section_title": chunk.section_title,
            "sop_title": row.sop_title,
            "sop_id": row.sop_sop_id,
            "chunk_type": getattr(chunk, "chunk_type", "section") or "section",
            "chunk_index": chunk.chunk_index,
        })
        if row.sop_sop_id not in structured_sops and row.structured_json:
            structured_sops[row.sop_sop_id] = row.structured_json
    return SOPGuardPipeline(chunks, structured_sops)


@router.get("/api/evaluation/summary")
async def evaluation_summary_eval(force: bool = False, db: AsyncSession = Depends(get_db)):
    """
    Return the LAST cached RAGAS-lite eval run, or run + cache a fresh one.
    Never 500s: returns structured results whatever mode ran.
    """
    from app.evaluation.ragas_lite import get_eval_summary

    rows = (await db.execute(
        select(SOPChunk, SOP.sop_id.label("sop_sop_id"), SOP.title.label("sop_title"), SOP.structured_json)
        .join(SOP, SOPChunk.sop_id == SOP.id)
    )).all()
    pipeline = _pipeline_from_rows(rows)
    return await get_eval_summary(pipeline, force=force)


@router.get("/api/evaluation/ablation")
async def evaluation_ablation(db: AsyncSession = Depends(get_db)):
    """Reranker on-vs-off ablation over the eval set (retrieval-only, never 500s)."""
    from app.evaluation.ragas_lite import run_ablation

    rows = (await db.execute(
        select(SOPChunk, SOP.sop_id.label("sop_sop_id"), SOP.title.label("sop_title"), SOP.structured_json)
        .join(SOP, SOPChunk.sop_id == SOP.id)
    )).all()
    pipeline = _pipeline_from_rows(rows)
    try:
        return await run_ablation(pipeline)
    except Exception as e:
        return {"eval": "ablation_reranker", "error": str(e), "reranker_on": {}, "reranker_off": {}}


@router.post("/api/evaluate/adversarial")
async def run_adversarial_evaluation(db: AsyncSession = Depends(get_db)):
    """Run the verifier against adversarial test cases."""
    from app.demo_data.adversarial_tests import ADVERSARIAL_TESTS
    from app.verifier.verifier import ProceduralFaithfulnessVerifier
    from app.services.sop_structurer import structure_sop
    from app.demo_data.demo_sops import DEMO_SOPS

    verifier = ProceduralFaithfulnessVerifier()
    results = []

    # Build structured SOP lookup
    structured_lookup: dict[str, dict] = {}
    for sop in DEMO_SOPS:
        sid = sop["sop_id"]
        structured_lookup[sid] = sop.get("structured_json") or structure_sop(
            sop["raw_text"], sop["title"]
        )

    correct_detections = 0
    total = len(ADVERSARIAL_TESTS)

    for test in ADVERSARIAL_TESTS:
        sop_id = test.get("sop_id", "")
        structured = structured_lookup.get(
            sop_id, {"steps": [], "thresholds": [], "contraindications": []}
        )

        # Verify the ADVERSARIAL (wrong) answer
        adv_result = verifier.verify(test["adversarial_answer"], [], structured)

        # Verify the CORRECT answer
        correct_result = verifier.verify(test["correct_answer"], [], structured)

        # Did verifier catch the adversarial answer? (it should fail or warn)
        caught = adv_result.status.value in ("failed", "warning")
        if caught:
            correct_detections += 1

        results.append({
            "test_id": test.get("test_id", ""),
            "query": test["query"],
            "violation_type": test["violation_type"],
            "violation_detail": test["violation_detail"],
            "adversarial_status": adv_result.status.value,
            "adversarial_score": adv_result.overall_score,
            "correct_status": correct_result.status.value,
            "correct_score": correct_result.overall_score,
            "caught": caught,
        })

    return {
        "total_tests": total,
        "detections": correct_detections,
        "detection_rate": round(correct_detections / total, 3) if total else 0,
        "results": results,
    }


@router.get("/api/evaluate/summary")
async def evaluation_summary():
    """Return a complete metrics summary for thesis documentation."""
    from app.demo_data.demo_sops import DEMO_SOPS
    from app.demo_data.adversarial_tests import ADVERSARIAL_TESTS

    return {
        "project": "SOP-Guard",
        "version": "0.1.0-research",
        "disclaimer": "Research prototype. Not for clinical use.",
        "dataset": {
            "total_sops": len(DEMO_SOPS),
            "sop_departments": list(set(s["department"] for s in DEMO_SOPS)),
            "adversarial_tests": len(ADVERSARIAL_TESTS),
            "adversarial_types": {
                "threshold": sum(1 for t in ADVERSARIAL_TESTS if t["violation_type"] == "threshold"),
                "sequence": sum(1 for t in ADVERSARIAL_TESTS if t["violation_type"] == "sequence"),
                "contraindication": sum(1 for t in ADVERSARIAL_TESTS if t["violation_type"] == "contraindication"),
            },
        },
        "rag_pipeline": {
            "embedding_backend": "TF-IDF (local, no API key required)",
            "retrieval": "Hybrid (TF-IDF + chunk-type boosting + clinical synonym expansion)",
            "reranker": "Heuristic (term coverage, phrase match, numeric overlap)",
            "query_understanding": "Rule-based (keyword classification + entity extraction + abbreviation expansion)",
            "multi_hop": "Regex-based cross-reference detection (max 2 hops)",
            "evidence_sufficiency": "4-criteria check (relevance, count, overlap, type match)",
            "generation": "Extractive mock (structured output from chunks) with optional Ollama/OpenAI LLM",
            "verification": "Procedural Faithfulness Verifier (threshold, sequence, contraindication checks)",
        },
        "capabilities": {
            "sop_aware_chunking": True,
            "typed_chunks": ["summary", "step", "step_sequence", "threshold", "contraindication", "section", "full_text"],
            "clinical_synonym_expansion": True,
            "multi_hop_retrieval": True,
            "evidence_sufficiency_check": True,
            "safe_refusal": True,
            "role_based_permissions": True,
            "voice_input": True,
            "activity_logging": True,
            "adversarial_evaluation": True,
        },
        "instructions": {
            "run_rag_eval": "POST /api/evaluate/rag",
            "run_adversarial_eval": "POST /api/evaluate/adversarial",
            "export_query_report": "POST /api/query/export",
            "check_llm_status": "GET /api/llm/status",
        },
    }
