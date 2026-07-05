"""
SOP-Guard RAGAS-Lite Evaluation
Lightweight reference-free evaluation inspired by RAGAS. No external deps.
Metrics per query:
  - faithfulness: overall_faithfulness from the pipeline's hallucination checker
  - citation_coverage: fraction of answer sentences carrying a [N] marker
  - abstention_correct: out-of-scope queries should abstain (or refuse)
  - retrieval_precision_proxy: relevance score of the top retrieved chunk
Research prototype. Not for clinical use.
"""

import re
import json
import os
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Optional

from app.agents.pipeline import SOPGuardPipeline

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

_MARKER_RE = re.compile(r"\[\d+\]")


def _citation_coverage(answer: str) -> float:
    """Fraction of substantive answer sentences that carry a [N] marker."""
    raw = re.split(r"(?<=[.!?])\s+|\n+", answer.strip())
    sentences = [
        s.strip() for s in raw
        if len(s.strip()) > 20
        and not s.strip().startswith("#")
        and not s.strip().startswith("Source:")
        and "research prototype" not in s.lower()
        and not s.strip().startswith("---")
    ]
    if not sentences:
        return 0.0
    cited = sum(1 for s in sentences if _MARKER_RE.search(s))
    return round(cited / len(sentences), 3)


def _build_demo_pipeline() -> SOPGuardPipeline:
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
    return SOPGuardPipeline(chunks, structured_sops)


async def run_eval(pipeline: Optional[SOPGuardPipeline] = None) -> dict:
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

        faith = (result.faithfulness or {}).get("overall_faithfulness", 0.0) if result.faithfulness else 0.0
        coverage = _citation_coverage(result.answer)
        top_relevance = result.retrieved_chunks[0].relevance_score if result.retrieved_chunks else 0.0

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

        faith_scores.append(faith)
        coverage_scores.append(coverage)
        precision_scores.append(top_relevance)

        per_query.append({
            "query": query,
            "category": case["category"],
            "faithfulness": faith,
            "citation_coverage": coverage,
            "retrieval_precision_proxy": round(top_relevance, 4),
            "abstained": did_abstain,
            "abstention_correct": abstention_correct,
            "confidence": result.confidence,
            "generation_mode": next(
                (t.split(": ", 1)[1] for t in result.reasoning_trace if t.startswith("Generation mode:")),
                "unknown",
            ),
        })

    n = len(faith_scores)
    mode_counts = Counter(
        q.get("generation_mode", "unknown") for q in per_query if "generation_mode" in q
    )
    dominant_mode = mode_counts.most_common(1)[0][0] if mode_counts else "unknown"

    aggregate = {
        "total_queries": len(EVAL_QUERIES),
        "completed": n,
        "avg_faithfulness": round(sum(faith_scores) / n, 3) if n else 0.0,
        "avg_citation_coverage": round(sum(coverage_scores) / n, 3) if n else 0.0,
        "avg_retrieval_precision_proxy": round(sum(precision_scores) / n, 4) if n else 0.0,
        "abstention_accuracy": round(abstention_hits / abstention_total, 3) if abstention_total else None,
        "out_of_scope_cases": abstention_total,
        "generation_mode": dominant_mode,
        "generation_mode_breakdown": dict(mode_counts),
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
    pipeline: Optional[SOPGuardPipeline] = None, force: bool = False
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


async def run_ablation(pipeline: Optional[SOPGuardPipeline] = None) -> dict:
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
