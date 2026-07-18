"""
Meridian Evaluation Routes
----------------------------
Research prototype  - NOT for clinical use.
"""

from typing import Any

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database.db import get_db
from app.models.models import SOP, SOPChunk, EvalSnapshotRecord
from app.schemas.schemas import EvaluationResult
from app.agents.pipeline import MeridianPipeline
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

    pipeline = MeridianPipeline(chunks, structured_sops)
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
    pipeline = MeridianPipeline(chunks, structured_sops)
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
        pipeline = MeridianPipeline(chunks, structured_sops)

    return await run_eval(pipeline)


def _pipeline_from_rows(rows) -> MeridianPipeline | None:
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
    return MeridianPipeline(chunks, structured_sops)


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


@router.get("/api/evaluation/ragas")
async def run_ragas_evaluation(force: bool = False, db: AsyncSession = Depends(get_db)):
    """
    Real RAGAS library metrics (faithfulness, response relevancy, context
    precision), judged by our self-hosted Ollama model - not a third-party
    API. Falls back to an "available: false" payload with an explanation
    when Ollama isn't reachable; the ragas-lite proxy metrics at
    /api/evaluation/ragas-lite remain the zero-dependency default the
    dashboard can always show.
    """
    from app.evaluation.ragas_real import get_ragas_summary

    rows = (await db.execute(
        select(SOPChunk, SOP.sop_id.label("sop_sop_id"), SOP.title.label("sop_title"), SOP.structured_json)
        .join(SOP, SOPChunk.sop_id == SOP.id)
    )).all()
    pipeline = _pipeline_from_rows(rows)
    return await get_ragas_summary(pipeline, force=force)


@router.get("/api/evaluation/chunk-distribution")
async def chunk_type_distribution(db: AsyncSession = Depends(get_db)):
    """Real chunk_type counts across the current live corpus (not a fixed test set)."""
    rows = (await db.execute(select(SOPChunk.chunk_type))).all()
    total = len(rows)
    counts: dict[str, int] = {}
    for (chunk_type,) in rows:
        key = chunk_type or "section"
        counts[key] = counts.get(key, 0) + 1
    distribution = [
        {"type": t, "count": c, "pct": round(c / total * 100, 1) if total else 0}
        for t, c in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    ]
    return {"total_chunks": total, "distribution": distribution}


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


def _run_verifier_over_cases(verifier, test_cases: list[dict], structured_lookup: dict) -> dict[str, Any]:
    """Run one verifier over all test cases and return sensitivity/specificity/separation."""
    caught = 0
    passed_correct = 0
    adv_scores: list[float] = []
    correct_scores: list[float] = []
    for test in test_cases:
        structured = structured_lookup.get(
            test.get("sop_id", ""), {"steps": [], "thresholds": [], "contraindications": []}
        )
        adv_result = verifier.verify(test["adversarial_answer"], [], structured)
        correct_result = verifier.verify(test["correct_answer"], [], structured)
        if adv_result.status.value in ("failed", "warning"):
            caught += 1
        if correct_result.status.value == "passed":
            passed_correct += 1
        adv_scores.append(adv_result.overall_score)
        correct_scores.append(correct_result.overall_score)

    total = len(test_cases)
    pairwise_wins = sum(1 for c, a in zip(correct_scores, adv_scores) if c > a)
    pairwise_ties = sum(1 for c, a in zip(correct_scores, adv_scores) if c == a)
    return {
        "sensitivity": round(caught / total, 3) if total else 0,
        "specificity": round(passed_correct / total, 3) if total else 0,
        "pairwise_separation": round((pairwise_wins + 0.5 * pairwise_ties) / total, 3) if total else 0,
        "mean_adversarial_score": round(sum(adv_scores) / total, 3) if total else 0,
        "mean_correct_score": round(sum(correct_scores) / total, 3) if total else 0,
    }


@router.post("/api/evaluate/adversarial")
async def run_adversarial_evaluation(
    include_generated: bool = False, compare_nli: bool = False, db: AsyncSession = Depends(get_db)
):
    """
    Run the verifier against adversarial test cases.

    include_generated=true additionally runs the programmatically-generated
    perturbation benchmark (app/evaluation/perturbation.py), which scales
    with the corpus's own structured data instead of staying fixed at the
    17 hand-written cases - useful when the hand-written set is too small
    to support a percentage claim on its own.

    compare_nli=true additionally runs the same test cases through
    NLIVerifier (app/verifier/nli_verifier.py) and EnsembleVerifier
    (app/verifier/ensemble_verifier.py), reporting all three alongside the
    primary rule-based verifier for comparison. On the full 120-case
    perturbation benchmark the two base verifiers disagree in an
    informative way: the rule-based verifier has much higher sensitivity
    but lower specificity (it over-flags correct answers), while the
    NLI-lite verifier is the opposite (conservative: it misses more
    violations but rarely false-alarms). The ensemble combines them with a
    measured, better sensitivity/specificity balance than either alone -
    see ensemble_verifier.py's docstring for why naive union/veto
    strategies were tried first and didn't work.
    """
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

    test_cases = list(ADVERSARIAL_TESTS)
    if include_generated:
        from app.evaluation.perturbation import generate_perturbed_benchmark
        test_cases.extend(generate_perturbed_benchmark(DEMO_SOPS, structured_lookup))

    correct_detections = 0
    correct_passes = 0
    total = len(test_cases)
    adv_scores: list[float] = []
    correct_scores: list[float] = []

    for test in test_cases:
        sop_id = test.get("sop_id", "")
        structured = structured_lookup.get(
            sop_id, {"steps": [], "thresholds": [], "contraindications": []}
        )

        # Verify the ADVERSARIAL (wrong) answer
        adv_result = verifier.verify(test["adversarial_answer"], [], structured)

        # Verify the CORRECT answer
        correct_result = verifier.verify(test["correct_answer"], [], structured)

        # Sensitivity: did the verifier catch the adversarial (wrong) answer?
        caught = adv_result.status.value in ("failed", "warning")
        if caught:
            correct_detections += 1

        # Specificity: did the verifier NOT flag the correct answer?
        passed_correct = correct_result.status.value == "passed"
        if passed_correct:
            correct_passes += 1

        adv_scores.append(adv_result.overall_score)
        correct_scores.append(correct_result.overall_score)

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
            "correct_answer_passed": passed_correct,
        })

    # Pairwise separation: fraction of test pairs where the correct answer's
    # score is strictly higher than its paired adversarial answer's score.
    # A verifier with no discriminative power at all would score ~0.5 here
    # even while "catching" 100% of violations (see specificity above for
    # why detection rate alone is a misleading headline number).
    pairwise_wins = sum(1 for c, a in zip(correct_scores, adv_scores) if c > a)
    pairwise_ties = sum(1 for c, a in zip(correct_scores, adv_scores) if c == a)
    separation = round((pairwise_wins + 0.5 * pairwise_ties) / total, 3) if total else 0.0

    # Stratify by violation type - an aggregate number hides whether the
    # verifier is actually strong across the board or just doing well on
    # one easy category (contraindications, in practice) while being much
    # weaker on another (sequence, in practice).
    by_type: dict[str, dict[str, Any]] = {}
    for r in results:
        vt = r["violation_type"]
        bucket = by_type.setdefault(vt, {"n": 0, "caught": 0, "correct_passed": 0})
        bucket["n"] += 1
        bucket["caught"] += int(r["caught"])
        bucket["correct_passed"] += int(r["correct_answer_passed"])
    breakdown = {
        vt: {
            "n": b["n"],
            "sensitivity": round(b["caught"] / b["n"], 3) if b["n"] else 0,
            "specificity": round(b["correct_passed"] / b["n"], 3) if b["n"] else 0,
        }
        for vt, b in by_type.items()
    }

    response: dict[str, Any] = {
        "total_tests": total,
        "generated_cases_included": include_generated,
        "detections": correct_detections,
        "sensitivity": round(correct_detections / total, 3) if total else 0,
        "specificity": round(correct_passes / total, 3) if total else 0,
        "pairwise_separation": separation,
        "mean_adversarial_score": round(sum(adv_scores) / total, 3) if total else 0,
        "mean_correct_score": round(sum(correct_scores) / total, 3) if total else 0,
        "by_violation_type": breakdown,
        "disclaimer": (
            "Sensitivity alone is a misleading headline metric: a verifier "
            "that flags every answer as suspicious trivially scores 100% "
            "sensitivity while providing no useful signal. Specificity "
            "(correct answers that pass cleanly) and pairwise_separation "
            "(does the verifier actually score correct answers higher than "
            "wrong ones) show whether it can tell them apart. "
            + ("Includes the programmatically-generated perturbation benchmark."
               if include_generated else
               "17 hand-written cases only - pass include_generated=true for "
               "the larger perturbation-based benchmark.")
        ),
        "results": results,
    }

    if compare_nli:
        from app.verifier.nli_verifier import NLIVerifier
        from app.verifier.ensemble_verifier import EnsembleVerifier

        rule_based_metrics = {
            "sensitivity": response["sensitivity"],
            "specificity": response["specificity"],
            "pairwise_separation": response["pairwise_separation"],
            "mean_adversarial_score": response["mean_adversarial_score"],
            "mean_correct_score": response["mean_correct_score"],
        }
        nli_metrics = _run_verifier_over_cases(NLIVerifier(), test_cases, structured_lookup)
        ensemble_metrics = _run_verifier_over_cases(EnsembleVerifier(), test_cases, structured_lookup)
        response["verifier_comparison"] = {
            "rule_based": rule_based_metrics,
            "nli_lite": nli_metrics,
            "ensemble": ensemble_metrics,
            "note": (
                "Two independently-implemented verifiers over the same test cases. "
                "rule_based (ProceduralFaithfulnessVerifier) uses type-specific "
                "regex extraction per violation class; nli_lite (NLIVerifier) "
                "treats every answer generically as an entailment problem against "
                "a combined premise built from the SOP's structured facts. They "
                "trade off differently: rule_based tends toward higher sensitivity "
                "and lower specificity, nli_lite the reverse - neither dominates. "
                "ensemble (EnsembleVerifier) trusts rule_based as primary but "
                "upgrades its WARNING verdicts to PASSED when nli_lite confidently "
                "disagrees - rule_based's specificity problem turned out to live "
                "almost entirely in its WARNING bucket (51/120 correct answers) "
                "rather than FAILED (14/120), so this is where nli_lite actually "
                "helps. Naive union/veto combinations were tried first and didn't "
                "improve the sensitivity/specificity balance - see "
                "ensemble_verifier.py's docstring for the comparison."
            ),
        }

    return response


@router.get("/api/project/summary")
async def project_summary():
    """
    Return static project/dataset metadata (SOP counts, pipeline
    components, capabilities) for thesis documentation.

    Not to be confused with GET /api/evaluation/summary, which returns
    the dynamic, computed RAGAS-lite evaluation results - this endpoint
    was previously at the near-identical /api/evaluate/summary
    ("evaluate" vs "evaluation"), which made the two easy to mix up.
    """
    from app.demo_data.demo_sops import DEMO_SOPS
    from app.demo_data.adversarial_tests import ADVERSARIAL_TESTS

    return {
        "project": "Meridian",
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


def _serialize_snapshot(r: EvalSnapshotRecord) -> dict:
    return {
        "id": r.id,
        "metrics": r.metrics or {},
        "corpus_sop_count": r.corpus_sop_count,
        "generation_mode": r.generation_mode,
        "label": r.label,
        "created_at": r.created_at,
    }


@router.post("/api/evaluation/snapshot")
async def record_eval_snapshot(label: str = "", db: AsyncSession = Depends(get_db)):
    """
    Run the full evaluation suite once against the current corpus and
    persist the result as a snapshot, so metrics can be tracked release
    over release instead of only ever showing the last ad-hoc run (see
    EvalSnapshotRecord and GET /api/evaluation/snapshots).

    Runs in mock-mode-equivalent settings (use_judge=False for the
    correctness harness) for the same reason the CI regression-floor tests
    do: fast, deterministic, and not dependent on a live LLM provider being
    reachable. A snapshot recorded here is directly comparable to the
    committed test-suite floors in tests/test_answer_correctness.py and
    tests/test_quality_eval.py.
    """
    from app.evaluation.ragas_lite import run_eval
    from app.evaluation.quality_eval import run_quality_eval
    from app.evaluation.answer_correctness import run_correctness_eval
    from app.verifier.verifier import ProceduralFaithfulnessVerifier
    from app.services.sop_structurer import structure_sop
    from app.demo_data.adversarial_tests import ADVERSARIAL_TESTS
    from app.demo_data.demo_sops import DEMO_SOPS

    rows = (await db.execute(
        select(SOPChunk, SOP.sop_id.label("sop_sop_id"), SOP.title.label("sop_title"), SOP.structured_json)
        .join(SOP, SOPChunk.sop_id == SOP.id)
    )).all()
    pipeline = _pipeline_from_rows(rows)

    metrics: dict[str, Any] = {}
    generation_mode = "mock"

    if pipeline is not None:
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

        faith_result = await run_eval(pipeline)
        metrics["faithfulness"] = faith_result["aggregate"]["avg_faithfulness"]
        metrics["citation_coverage"] = faith_result["aggregate"]["avg_citation_coverage"]
        generation_mode = faith_result["aggregate"]["generation_mode"]

        retriever = HybridRetriever(chunks)
        rag_result = evaluate_retrieval(retriever, pipeline)
        metrics["retrieval_precision"] = rag_result["retrieval_precision"]

        quality_result = await run_quality_eval(pipeline)
        metrics["route_accuracy"] = quality_result["pass_rate"]

        correctness_result = await run_correctness_eval(pipeline, use_judge=False)
        metrics["correctness_pass_rate"] = correctness_result["aggregate"]["pass_rate"]
        metrics["correctness_completeness"] = correctness_result["aggregate"]["avg_completeness_sop"]

    # Adversarial verifier metrics don't need the live corpus/pipeline at
    # all - they run the verifier directly against fixed adversarial cases
    # (see routes_evaluation.py's own /api/evaluate/adversarial), so this
    # runs regardless of whether any SOPs are currently loaded.
    verifier = ProceduralFaithfulnessVerifier()
    structured_lookup: dict[str, dict] = {}
    for sop in DEMO_SOPS:
        sid = sop["sop_id"]
        structured_lookup[sid] = sop.get("structured_json") or structure_sop(
            sop["raw_text"], sop["title"]
        )
    adv_metrics = _run_verifier_over_cases(verifier, list(ADVERSARIAL_TESTS), structured_lookup)
    metrics["adversarial_sensitivity"] = adv_metrics["sensitivity"]
    metrics["adversarial_specificity"] = adv_metrics["specificity"]
    metrics["adversarial_pairwise_separation"] = adv_metrics["pairwise_separation"]

    sop_count = (await db.execute(select(func.count(SOP.id)))).scalar() or 0

    record = EvalSnapshotRecord(
        metrics=metrics,
        corpus_sop_count=sop_count,
        generation_mode=generation_mode,
        label=label,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return _serialize_snapshot(record)


@router.get("/api/evaluation/snapshots")
async def list_eval_snapshots(limit: int = 30, db: AsyncSession = Depends(get_db)):
    """History of recorded eval snapshots, newest first, for the trend view
    on the frontend Evaluation page. Empty until at least one snapshot has
    been recorded via POST /api/evaluation/snapshot."""
    rows = (await db.execute(
        select(EvalSnapshotRecord)
        .order_by(EvalSnapshotRecord.created_at.desc())
        .limit(max(1, min(limit, 200)))
    )).scalars().all()
    snapshots = [_serialize_snapshot(r) for r in rows]
    # Chronological order for charting (oldest first), while the query
    # itself stays newest-first so `limit` keeps the most recent runs.
    snapshots.reverse()
    return {"snapshots": snapshots, "total": len(snapshots)}
