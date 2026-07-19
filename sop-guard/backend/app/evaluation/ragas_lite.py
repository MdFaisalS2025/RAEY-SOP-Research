"""
Meridian RAGAS-Lite Evaluation
Lightweight reference-free evaluation inspired by RAGAS. No external deps.
Metrics per query:
  - faithfulness: overall_faithfulness from the pipeline's hallucination
    checker. Calibration note: in mock mode this sits at a near-1.0
    ceiling for almost every query, not because faithfulness is perfect
    but because the mock generator is purely extractive (it copies phrases
    directly from retrieved chunks), so keyword-grounding checks trivially
    pass. This metric is only discriminating for LLM-generated answers,
    which can genuinely paraphrase or hallucinate - see faithfulness_note
    in the aggregate output.
  - citation_coverage: fraction of answer sentences carrying a [N] marker.
    Requires the generator to emit real markers - both MockGenerator and
    LLMGenerator do this now (see generator.py / llm_generator.py).
  - abstention_correct: out-of-scope queries should abstain (or refuse)
  - top_chunk_relevance_score: raw TF-IDF relevance score of the top
    retrieved chunk (renamed from the old "retrieval_precision_proxy" -
    it is NOT a precision metric: it is unbounded (can exceed 1.0) and
    not comparable across queries with different vocabulary overlap. See
    /api/evaluate/rag for an actual precision metric, which measures
    whether the top-retrieved SOP matches the expected SOP for the query).
Research prototype. Not for clinical use.
"""

import json
import os
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Optional

from app.agents.pipeline import MeridianPipeline
from app.rag.citation_tracker import citation_coverage as _citation_coverage

_CACHE_PATH = os.path.join(os.path.dirname(__file__), "last_eval.json")

# 20 eval queries. category: medication / threshold / sequence /
# contraindication / monitoring / out_of_scope / cross_sop
EVAL_QUERIES: list[dict[str, Any]] = [
    {"query": "What is the maximum dose of norepinephrine for septic shock?", "category": "medication", "out_of_scope": False},
    {"query": "What is the initial fluid bolus dose for sepsis resuscitation?", "category": "medication", "out_of_scope": False},
    {"query": "When should vasopressors be started in sepsis management?", "category": "medication", "out_of_scope": False},
    {"query": "What antibiotics timing is required after sepsis recognition?", "category": "medication", "out_of_scope": False},
    {"query": "What lactate level indicates severe sepsis requiring immediate action?", "category": "threshold", "out_of_scope": False},
    {"query": "What is the target mean arterial pressure in septic shock?", "category": "threshold", "out_of_scope": False},
    {"query": "At what hemoglobin level is a blood transfusion indicated?", "category": "threshold", "out_of_scope": False},
    {"query": "What NEWS2 score requires urgent clinical review?", "category": "threshold", "out_of_scope": False},
    {"query": "What are the steps for donning PPE in the correct order?", "category": "sequence", "out_of_scope": False},
    {"query": "Walk me through the blood transfusion procedure step by step.", "category": "sequence", "out_of_scope": False},
    {"query": "What is the correct sequence for doffing PPE after patient contact?", "category": "sequence", "out_of_scope": False},
    {"query": "What are the initial assessment steps for a suspected sepsis patient?", "category": "sequence", "out_of_scope": False},
    {"query": "When should a blood transfusion NOT be given?", "category": "contraindication", "out_of_scope": False},
    {"query": "What are the contraindications for aggressive fluid resuscitation?", "category": "contraindication", "out_of_scope": False},
    {"query": "What must be avoided during a transfusion reaction?", "category": "contraindication", "out_of_scope": False},
    {"query": "How often should vital signs be monitored during a blood transfusion?", "category": "monitoring", "out_of_scope": False},
    {"query": "What should be monitored after starting vasopressors?", "category": "monitoring", "out_of_scope": False},
    {"query": "What is the recommended dose of chemotherapy for stage 3 lung cancer?", "category": "out_of_scope", "out_of_scope": True},
    {"query": "How do I calibrate the hospital MRI scanner magnets?", "category": "out_of_scope", "out_of_scope": True},
    {"query": "If a septic patient also needs a transfusion, which monitoring rules from both protocols apply?", "category": "cross_sop", "out_of_scope": False},
]

def _build_demo_pipeline() -> MeridianPipeline:
    """Build a pipeline from bundled demo SOPs (used when no pipeline is given)."""
    from app.demo_data.demo_sops import DEMO_SOPS
    from app.services.sop_structurer import structure_sop
    from app.rag.chunker import create_sop_chunks

    chunks: list[dict] = []
    structured_sops: dict[str, dict] = {}
    for sop in DEMO_SOPS:
        structured = sop.get("structured_json") or structure_sop(sop["raw_text"], sop["title"])
        structured_sops[sop["sop_id"]] = structured
        chunks.extend(create_sop_chunks(
            raw_text=sop["raw_text"],
            structured=structured,
            sop_id=sop["sop_id"],
            sop_title=sop["title"],
            department=sop.get("department", ""),
        ))
    return MeridianPipeline(chunks, structured_sops)


async def run_eval(pipeline: Optional[MeridianPipeline] = None) -> dict:
    """
    Run the RAGAS-lite evaluation suite against the pipeline.
    Returns aggregate metrics plus per-query results.
    """
    if pipeline is None:
        pipeline = _build_demo_pipeline()

    per_query: list[dict] = []
    faith_scores: list[float] = []
    coverage_scores: list[float] = []
    precision_scores: list[float] = []
    abstention_hits = 0
    abstention_total = 0

    for case in EVAL_QUERIES:
        query = case["query"]
        try:
            result = await pipeline.run(query=query)
        except Exception as e:
            per_query.append({"query": query, "category": case["category"], "error": str(e)})
            continue

        # None (not 0.0) when the answer never went through faithfulness
        # scoring at all - e.g. Route B/external-evidence answers are built
        # from external literature, not retrieved SOP chunks, so
        # "faithfulness to source chunks" isn't a meaningful concept for
        # them and the generator never computes it. Coercing that to 0.0
        # previously counted every such answer as a total faithfulness
        # failure, dragging the average down to ~0 even when every
        # LLM-generated answer scored perfectly - directly contradicting
        # this file's own faithfulness_note below about mock-mode scores.
        faith = result.faithfulness.get("overall_faithfulness") if result.faithfulness else None
        coverage = _citation_coverage(result.answer)
        top_chunk_score = result.retrieved_chunks[0].relevance_score if result.retrieved_chunks else 0.0

        # Abstention: explicit flag from the generator, or a low-confidence refusal
        did_abstain = result.abstained or (
            result.confidence <= 0.2 and "could not find enough support" in result.answer.lower()
        )
        abstention_correct = None
        if case["out_of_scope"]:
            abstention_total += 1
            abstention_correct = did_abstain
            if did_abstain:
                abstention_hits += 1

        if faith is not None:
            faith_scores.append(faith)
        coverage_scores.append(coverage)
        precision_scores.append(top_chunk_score)

        per_query.append({
            "query": query,
            "category": case["category"],
            "faithfulness": faith,
            "citation_coverage": coverage,
            "top_chunk_relevance_score": round(top_chunk_score, 4),
            "abstained": did_abstain,
            "abstention_correct": abstention_correct,
            "confidence": result.confidence,
            # Real bug this fixes: this used to parse reasoning_trace text
            # for a "Generation mode: X" line, but that line is only ever
            # appended when the generator actually ran (pipeline.py:443) -
            # routes that short-circuit before generation (no_evidence,
            # clarification, and some external_evidence answers) legitimately
            # never call the generator, so result.generation_mode is "" for
            # them - a known, expected state, not missing data. The old
            # trace-parsing fallback mapped that (and any other parsing miss)
            # to "unknown", which reads as "we don't know the mode" rather
            # than "no generation happened" - the Trends chip labeling
            # quirk. Reading the structured field directly and labeling its
            # empty state "no_generation" makes both cases honest: real
            # gaps in the data stay visibly wrong, while "no answer was
            # generated for this query" is labeled as exactly that.
            "generation_mode": result.generation_mode or "no_generation",
        })

    n = len(coverage_scores)
    n_faith = len(faith_scores)
    mode_counts = Counter(
        q.get("generation_mode", "unknown") for q in per_query if "generation_mode" in q
    )
    dominant_mode = mode_counts.most_common(1)[0][0] if mode_counts else "unknown"

    aggregate = {
        "total_queries": len(EVAL_QUERIES),
        "completed": n,
        "avg_faithfulness": round(sum(faith_scores) / n_faith, 3) if n_faith else None,
        "faithfulness_scored_count": n_faith,
        "avg_citation_coverage": round(sum(coverage_scores) / n, 3) if n else 0.0,
        "avg_top_chunk_relevance_score": round(sum(precision_scores) / n, 4) if n else 0.0,
        "abstention_accuracy": round(abstention_hits / abstention_total, 3) if abstention_total else None,
        "out_of_scope_cases": abstention_total,
        "generation_mode": dominant_mode,
        "generation_mode_breakdown": dict(mode_counts),
        "faithfulness_note": (
            (
                "avg_faithfulness sits near its 1.0 ceiling in mock mode because "
                "the mock generator is purely extractive (answers are built from "
                "verbatim chunk phrases), so keyword-grounding checks trivially "
                "pass. It only becomes a meaningful discriminator for LLM-"
                "generated answers, which can paraphrase or add unsupported "
                "content."
                if dominant_mode in ("mock", "mock_fallback")
                else "LLM-generated answers: faithfulness reflects real "
                     "grounding checks, not an extractive-generation ceiling."
            )
            + (
                f" Faithfulness was scored for {n_faith} of {n} completed queries - "
                "the rest routed to external evidence (no internal SOP chunks to "
                "check faithfulness against) and are excluded from the average "
                "rather than counted as failures."
                if n_faith < n
                else ""
            )
        ),
    }

    return {
        "eval": "ragas_lite",
        "disclaimer": "Research prototype. Reference-free proxy metrics, not clinical validation.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "aggregate": aggregate,
        "per_query": per_query,
    }


def _save_cache(result: dict) -> None:
    try:
        with open(_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
    except Exception:
        pass


def _load_cache() -> Optional[dict]:
    try:
        if os.path.exists(_CACHE_PATH):
            with open(_CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        return None
    return None


async def get_eval_summary(
    pipeline: Optional[MeridianPipeline] = None, force: bool = False
) -> dict:
    """
    Return the last cached eval run, or run a fresh one and cache it.
    Never raises: on failure returns a structured error payload.
    """
    if not force:
        cached = _load_cache()
        if cached is not None:
            cached["_cached"] = True
            return cached
    try:
        result = await run_eval(pipeline)
    except Exception as e:  # pragma: no cover - defensive
        return {
            "eval": "ragas_lite",
            "error": str(e),
            "aggregate": {},
            "per_query": [],
        }
    result["_cached"] = False
    _save_cache(result)
    return result


async def run_ablation(pipeline: Optional[MeridianPipeline] = None) -> dict:
    """
    Compare retrieval quality with the reranker ON vs OFF.

    We rebuild two retrievers over the same chunks (one with the configured
    reranker, one with a NoOpReranker) and measure the average top-1 relevance
    proxy and rank stability across the eval queries. This isolates the effect
    of the rerank step without needing an LLM call, so it never 500s even when
    the LLM is rate-limited.
    """
    from app.rag.hybrid_retriever import HybridRetriever
    from app.rag.reranker import NoOpReranker, HeuristicReranker

    if pipeline is None:
        pipeline = _build_demo_pipeline()

    chunks = pipeline.retriever.chunks

    on_retriever = HybridRetriever(chunks, reranker=HeuristicReranker())
    off_retriever = HybridRetriever(chunks, reranker=NoOpReranker())

    from app.agents.query_agent import QueryUnderstandingAgent
    agent = QueryUnderstandingAgent()

    on_top1: list[float] = []
    off_top1: list[float] = []
    order_changed = 0
    compared = 0

    for case in EVAL_QUERIES:
        query = case["query"]
        try:
            qtype = agent.analyze(query)["query_type"]
        except Exception:
            qtype = "general"
        on_res = on_retriever.search(query, top_k=8, query_type=qtype)
        off_res = off_retriever.search(query, top_k=8, query_type=qtype)

        if on_res:
            on_top1.append(on_res[0].get("relevance_score", 0.0))
        if off_res:
            off_top1.append(off_res[0].get("relevance_score", 0.0))

        if on_res and off_res:
            compared += 1
            on_ids = [c.get("chunk_id", c.get("text", "")[:40]) for c in on_res[:3]]
            off_ids = [c.get("chunk_id", c.get("text", "")[:40]) for c in off_res[:3]]
            if on_ids != off_ids:
                order_changed += 1

    def _avg(xs: list[float]) -> float:
        return round(sum(xs) / len(xs), 4) if xs else 0.0

    return {
        "eval": "ablation_reranker",
        "disclaimer": "Research prototype. Retrieval-only ablation (no LLM required).",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "queries": len(EVAL_QUERIES),
        "reranker_on": {
            "reranker": on_retriever._reranker.backend_name,
            "avg_top1_relevance": _avg(on_top1),
        },
        "reranker_off": {
            "reranker": off_retriever._reranker.backend_name,
            "avg_top1_relevance": _avg(off_top1),
        },
        "top3_order_changed": order_changed,
        "queries_compared": compared,
        "order_change_rate": round(order_changed / compared, 3) if compared else 0.0,
    }
