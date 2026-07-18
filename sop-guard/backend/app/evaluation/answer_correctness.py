"""
Meridian Answer-Correctness Harness
------------------------------------
Scores generated answers against the gold-answer set (gold_answers.py). Two
independent signals, so the harness is useful with or without a live model:

  1. Completeness (deterministic, always runs) - the fraction of a case's
     must_include facts that appear in the answer. No LLM needed, so this is
     the backbone metric and what CI can gate on.

  2. Judge equivalence (best-effort) - an LLM rates how well the answer
     matches the reference answer (0-1). Returns None per case when no model
     is available or the call fails, so a rate-limited/offline environment
     degrades to completeness-only instead of erroring.

A "correct" case = right route AND (for SOP cases) the expected SOP retrieved
AND completeness above threshold. External/out-of-scope cases are correct on
route/behavior alone (there is no fact list to complete).

Run standalone:  python -m app.evaluation.answer_correctness
Run as a test:   tests/test_answer_correctness.py

Research prototype. Reference-based proxy metrics, not clinical validation.
"""

import asyncio
import json
import re
from typing import Any, Optional

from app.agents.pipeline import MeridianPipeline
from app.evaluation.gold_answers import GOLD_CASES, GoldCase

_COMPLETENESS_PASS = 0.6  # a SOP answer must contain >=60% of its key facts

_JUDGE_SYSTEM = (
    "You are a strict clinical QA evaluator. You are given a QUESTION, a "
    "REFERENCE answer (known correct), and a CANDIDATE answer produced by a "
    "system. Judge only whether the CANDIDATE conveys the same clinically "
    "important facts as the REFERENCE - correct values, doses, thresholds, "
    "and actions. Ignore wording, formatting, and extra citations. A wrong "
    "or invented numeric value is a serious error. Respond with ONLY a JSON "
    'object: {"equivalent": <0.0-1.0>, "missing": ["..."], "wrong": ["..."]}. '
    "equivalent=1.0 means fully correct and complete; 0.0 means wrong or "
    "irrelevant. No prose outside the JSON."
)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower())


def completeness(answer: str, must_include: tuple[str, ...]) -> float:
    if not must_include:
        return 1.0
    blob = _norm(answer)
    hits = sum(1 for fact in must_include if _norm(fact) in blob)
    return hits / len(must_include)


def _parse_judge(raw: str) -> Optional[dict[str, Any]]:
    """Pull the JSON object out of a judge response, tolerant of code fences
    or stray prose around it. Returns None if nothing parseable is found."""
    if not raw:
        return None
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict) or "equivalent" not in obj:
        return None
    try:
        obj["equivalent"] = max(0.0, min(1.0, float(obj["equivalent"])))
    except (TypeError, ValueError):
        return None
    return obj


async def _judge(generator, case: GoldCase, candidate: str) -> Optional[dict[str, Any]]:
    """Best-effort LLM equivalence judgment. None when unavailable/failed."""
    user = (
        f"QUESTION:\n{case.query}\n\n"
        f"REFERENCE answer:\n{case.reference_answer}\n\n"
        f"CANDIDATE answer:\n{candidate}\n\n"
        "Return the JSON judgment now."
    )
    raw = await generator.complete(user, _JUDGE_SYSTEM)
    if raw is None:
        return None
    return _parse_judge(raw)


async def run_correctness_eval(
    pipeline: Optional[MeridianPipeline] = None,
    use_judge: bool = True,
) -> dict[str, Any]:
    if pipeline is None:
        from app.evaluation.ragas_lite import _build_demo_pipeline
        pipeline = _build_demo_pipeline()

    from app.rag.llm_generator import LLMGenerator
    judge_gen = LLMGenerator() if use_judge else None

    results: list[dict[str, Any]] = []
    for case in GOLD_CASES:
        try:
            response = await pipeline.run(query=case.query)
        except Exception as e:
            results.append({"id": case.id, "category": case.category, "error": str(e), "passed": False})
            continue

        top_sop = response.retrieved_chunks[0].sop_title if response.retrieved_chunks else None
        route_ok = (not case.acceptable_routes) or (response.route in case.acceptable_routes)

        comp = completeness(response.answer, case.must_include) if case.category == "sop" else None
        sop_ok = (top_sop == case.expected_sop) if (case.category == "sop" and case.expected_sop) else True

        if case.category == "sop":
            passed = route_ok and sop_ok and (comp >= _COMPLETENESS_PASS)
        else:
            passed = route_ok

        judgment = None
        if judge_gen is not None and case.category == "sop" and not response.abstained:
            judgment = await _judge(judge_gen, case, response.answer)

        results.append({
            "id": case.id,
            "category": case.category,
            "route": response.route,
            "top_sop": top_sop,
            "expected_sop": case.expected_sop,
            "completeness": round(comp, 3) if comp is not None else None,
            "sop_ok": sop_ok,
            "route_ok": route_ok,
            "numeric_grounded": (response.numeric_verification or {}).get("all_grounded", True),
            "judge_equivalent": judgment["equivalent"] if judgment else None,
            "passed": passed,
        })

    sop_results = [r for r in results if r["category"] == "sop" and "error" not in r]
    comp_scores = [r["completeness"] for r in sop_results if r["completeness"] is not None]
    judge_scores = [r["judge_equivalent"] for r in results if r.get("judge_equivalent") is not None]
    total_passed = sum(1 for r in results if r["passed"])

    aggregate = {
        "total_cases": len(results),
        "total_passed": total_passed,
        "pass_rate": round(total_passed / len(results), 3) if results else 0.0,
        "avg_completeness_sop": round(sum(comp_scores) / len(comp_scores), 3) if comp_scores else None,
        "judge_scored_count": len(judge_scores),
        "avg_judge_equivalent": round(sum(judge_scores) / len(judge_scores), 3) if judge_scores else None,
        "judge_available": len(judge_scores) > 0,
    }
    return {
        "eval": "answer_correctness",
        "disclaimer": "Research prototype. Reference-based proxy metrics, not clinical validation.",
        "aggregate": aggregate,
        "results": results,
    }


def print_report(report: dict[str, Any]) -> None:
    agg = report["aggregate"]
    print("\nMeridian Answer-Correctness Evaluation")
    print(f"{agg['total_passed']}/{agg['total_cases']} passed ({agg['pass_rate'] * 100:.0f}%)")
    print(f"avg completeness (SOP cases): {agg['avg_completeness_sop']}")
    if agg["judge_available"]:
        print(f"avg judge equivalence: {agg['avg_judge_equivalent']} (scored {agg['judge_scored_count']})")
    else:
        print("LLM judge: unavailable this run - completeness-only (deterministic).")
    print()
    for r in report["results"]:
        if "error" in r:
            print(f"[ERR ] {r['id']}: {r['error']}")
            continue
        status = "PASS" if r["passed"] else "FAIL"
        extra = f"comp={r['completeness']}" if r["completeness"] is not None else f"route={r['route']}"
        judge = f" judge={r['judge_equivalent']}" if r["judge_equivalent"] is not None else ""
        print(f"[{status}] ({r['category']}) {r['id']}: {extra}{judge}")


if __name__ == "__main__":
    report = asyncio.run(run_correctness_eval())
    print_report(report)
