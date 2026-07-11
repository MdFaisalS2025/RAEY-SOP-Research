"""
SOP-Guard Real RAGAS Evaluation
--------------------------------
Runs the actual RAGAS library (github.com/explodinggradients/ragas) against
the pipeline, using our own self-hosted Ollama model as the judge LLM and a
local sentence-transformers model for embeddings - no query, answer, or SOP
content is ever sent to a third-party API. This replaces the proxy metrics
in ragas_lite.py with RAGAS's real, published metric implementations:

  - Faithfulness: decomposes the answer into atomic claims and checks each
    one against the retrieved context via LLM judgment (not our own
    keyword-overlap heuristic).
  - ResponseRelevancy: generates candidate questions from the answer and
    measures embedding similarity to the original query - penalizes
    incomplete or off-topic answers.
  - LLMContextPrecisionWithoutReference: judges whether each retrieved
    chunk was actually useful for answering the query (reference-free,
    since we don't maintain ground-truth answers for the eval set).

Requires a live Ollama server (LLM_PROVIDER=ollama, model pulled). If Ollama
is unavailable, this is skipped entirely and the caller falls back to
ragas_lite's zero-dependency proxy metrics - real judge-LLM evaluation
cannot run without a judge LLM, and we do not fall back to a cloud one.

Research prototype. Not for clinical use.
"""

import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

from app.config import settings
from app.agents.pipeline import SOPGuardPipeline
from app.evaluation.ragas_lite import EVAL_QUERIES, _build_demo_pipeline

_CACHE_PATH = os.path.join(os.path.dirname(__file__), "last_ragas_eval.json")

# RAGAS's judge-LLM calls are slow (multiple LLM round-trips per metric per
# query) - a full 20-query sweep against a local model would take minutes.
# Sample a representative subset (kept small and reproducible: same slice
# every run) rather than the full eval set.
_SAMPLE_SIZE = 8


async def _llm_available() -> bool:
    from app.rag.llm_generator import LLMGenerator
    return await LLMGenerator()._check_available()


def _run_worker_blocking(rows: list[dict], timeout_s: float) -> dict:
    """Blocking half of _run_worker - runs on a thread via asyncio.to_thread."""
    import subprocess
    import sys

    job = json.dumps({
        "rows": rows,
        "model": settings.LLM_MODEL,
        "base_url": settings.LLM_BASE_URL,
        "embedding_model": settings.RAG_EMBEDDING_MODEL,
    })

    # "app" is only importable from the backend root, not from whatever
    # directory the parent process (e.g. uvicorn) happened to be launched
    # from - -m app.evaluation._ragas_worker fails with ModuleNotFoundError
    # otherwise.
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    try:
        proc = subprocess.run(
            [sys.executable, "-m", "app.evaluation._ragas_worker"],
            input=job.encode("utf-8"),
            capture_output=True,
            timeout=timeout_s,
            cwd=backend_root,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"RAGAS worker timed out after {timeout_s}s"}

    if proc.returncode != 0 and not proc.stdout:
        return {"ok": False, "error": f"RAGAS worker crashed: {proc.stderr.decode('utf-8', 'replace')[-2000:]}"}

    # The worker's own stdout may carry progress-bar noise from tqdm before
    # its final JSON line - take the last non-empty line.
    lines = [ln for ln in proc.stdout.decode("utf-8", "replace").splitlines() if ln.strip()]
    if not lines:
        return {"ok": False, "error": f"RAGAS worker produced no output: {proc.stderr.decode('utf-8', 'replace')[-1000:]}"}
    try:
        return json.loads(lines[-1])
    except json.JSONDecodeError:
        return {"ok": False, "error": f"RAGAS worker returned malformed output: {lines[-1][:500]}"}


async def _run_worker(rows: list[dict], timeout_s: float = 150) -> dict:
    """
    Run the actual ragas.evaluate() call in a dedicated subprocess.

    ragas.evaluate() manages its own event loop internally (via
    nest_asyncio) and is not safe to call from inside our already-running
    asyncio loop - on this stack it corrupts the parent loop's executor
    shutdown instead of raising a clean error. A subprocess has no parent
    loop to collide with, so this sidesteps the issue entirely. See
    _ragas_worker.py.

    Uses subprocess.run() on a worker thread (asyncio.to_thread), not
    asyncio.create_subprocess_exec: the latter requires a loop with
    subprocess-transport support, which uvicorn's default event loop on
    Windows does not provide (raises NotImplementedError).
    """
    import asyncio

    return await asyncio.to_thread(_run_worker_blocking, rows, timeout_s)


async def run_real_ragas_eval(pipeline: Optional[SOPGuardPipeline] = None) -> dict[str, Any]:
    """
    Run the real RAGAS library against a sample of the eval queries.
    Returns a structured error payload (never raises) if Ollama or RAGAS
    itself is unavailable, so callers can fall back to ragas_lite.
    """
    if not await _llm_available():
        return {
            "eval": "ragas",
            "available": False,
            "reason": (
                f"No self-hosted LLM reachable at {settings.LLM_BASE_URL} "
                f"(model: {settings.LLM_MODEL}). Real RAGAS metrics require a "
                "judge LLM; start Ollama and pull the configured model to "
                "enable this evaluation. Falling back to ragas_lite proxy "
                "metrics, which require no LLM."
            ),
        }

    if pipeline is None:
        pipeline = _build_demo_pipeline()

    sample = EVAL_QUERIES[:_SAMPLE_SIZE]
    rows: list[dict] = []
    skipped: list[str] = []

    for case in sample:
        query = case["query"]
        try:
            result = await pipeline.run(query=query)
        except Exception as e:
            skipped.append(f"{query[:60]} ({e})")
            continue
        if result.abstained or not result.retrieved_chunks:
            # RAGAS's metrics assume a genuine grounded answer over
            # non-empty context; an abstention has neither, and scoring it
            # would just measure "did the model correctly refuse", which
            # ragas_lite's abstention_accuracy already covers directly.
            skipped.append(f"{query[:60]} (abstained)")
            continue
        rows.append({
            "user_input": query,
            "response": result.answer,
            "retrieved_contexts": [c.chunk_text for c in result.retrieved_chunks if c.chunk_text],
            "category": case["category"],
        })

    if not rows:
        return {
            "eval": "ragas",
            "available": False,
            "reason": "No sampled queries produced a groundable answer to evaluate (all abstained or errored).",
        }

    worker_rows = [{k: v for k, v in r.items() if k != "category"} for r in rows]
    outcome = await _run_worker(worker_rows)
    if not outcome.get("ok"):
        return {"eval": "ragas", "available": False, "reason": f"RAGAS evaluation run failed: {outcome.get('error', 'unknown error')}"}

    records = outcome["records"]
    # ragas returns NaN (-> JSON null) for a metric when the judge LLM call
    # itself failed for that row, rather than raising - e.g. the configured
    # model isn't actually pulled in Ollama and every call 404s. Coercing
    # null to 0.0 would silently present "the answer scored 0" as if it
    # were a real judgment, when actually no judgment happened at all.
    any_scored = any(
        record.get("faithfulness") is not None
        or record.get("answer_relevancy", record.get("response_relevancy")) is not None
        or record.get("llm_context_precision_without_reference") is not None
        for record in records
    )
    if not any_scored:
        return {
            "eval": "ragas",
            "available": False,
            "reason": (
                f"Every judge-LLM call failed for model '{settings.LLM_MODEL}'. Most likely "
                f"causes: the model isn't pulled in Ollama (run `ollama pull {settings.LLM_MODEL}`), "
                "or this Python version is incompatible with ragas's async executor (ragas 0.2.x's "
                "nest_asyncio-based executor is known to break on Python 3.14's stricter "
                "asyncio.wait_for/timeout semantics - if `ollama run <model>` works fine standalone, "
                "this is almost certainly the Python-version issue, not the model)."
            ),
        }

    per_query = []
    for row, record in zip(rows, records):
        per_query.append({
            "query": row["user_input"],
            "category": row["category"],
            "faithfulness": round(float(record.get("faithfulness") or 0.0), 3),
            "response_relevancy": round(float(record.get("answer_relevancy", record.get("response_relevancy")) or 0.0), 3),
            "context_precision": round(float(record.get("llm_context_precision_without_reference") or 0.0), 3),
        })

    def _avg(key: str) -> float:
        vals = [q[key] for q in per_query]
        return round(sum(vals) / len(vals), 3) if vals else 0.0

    return {
        "eval": "ragas",
        "available": True,
        "disclaimer": (
            "Real RAGAS library metrics (github.com/explodinggradients/ragas), judged by "
            f"the self-hosted Ollama model '{settings.LLM_MODEL}' - not a third-party API. "
            "Sampled subset of the eval set (judge-LLM calls are too slow for the full sweep "
            "on every request); not a substitute for clinical validation."
        ),
        "judge_model": settings.LLM_MODEL,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "sample_size": len(rows),
        "skipped": skipped,
        "aggregate": {
            "avg_faithfulness": _avg("faithfulness"),
            "avg_response_relevancy": _avg("response_relevancy"),
            "avg_context_precision": _avg("context_precision"),
        },
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


async def get_ragas_summary(pipeline: Optional[SOPGuardPipeline] = None, force: bool = False) -> dict:
    """
    Return the last cached real-RAGAS run, or run + cache a fresh one.
    Real RAGAS calls the judge LLM many times (metrics x sampled queries),
    so this is cached the same way ragas_lite.get_eval_summary is - re-run
    explicitly with force=true, not on every dashboard load.
    """
    if not force:
        cached = _load_cache()
        if cached is not None:
            cached["_cached"] = True
            return cached
    result = await run_real_ragas_eval(pipeline)
    result["_cached"] = False
    if result.get("available"):
        _save_cache(result)
    return result
