"""
Meridian Answer-Quality Evaluation (5-category route harness)

Complements ragas_lite.py (which measures faithfulness/citation-coverage/
abstention as continuous metrics) with a routing-correctness harness: for
each query, does the pipeline choose the *right kind* of answer?

Categories, matching the product's four documented answer modes plus
multi-turn:
  A - SOP-supported:      an approved SOP answers the question directly.
  B - Partial SOP support: the SOP covers some but not all of what was asked.
  C - No internal SOP:     no SOP covers the topic; must fall back to
                            external evidence (or an honest "no evidence"
                            answer) rather than force-matching an unrelated SOP.
  D - Non-clinical:        query is outside SOP scope entirely; must not
                            match any SOP and must not hallucinate coverage.
  E - Follow-up:           a second question in the same conversation must
                            still work (context carried, still cited).

Run standalone:  python -m app.evaluation.quality_eval
Run as a test:   tests/test_quality_eval.py

Research prototype. Reference-free proxy checks, not clinical validation.
"""

import asyncio
from dataclasses import dataclass, field
from typing import Any, Optional

from app.agents.pipeline import MeridianPipeline

# Friendly labels for the pipeline's internal route names.
_ROUTE_LABEL = {
    "sop_library": "Internal SOP",
    "hybrid": "SOP + External Evidence",
    "external_evidence": "External Evidence Only",
    "no_evidence": "No Evidence Found",
    "clarification": "Clarification Requested",
}


@dataclass
class QualityCase:
    query: str
    category: str  # "A" | "B" | "C" | "D" | "E"
    label: str
    # Routes the pipeline is allowed to land on for this case to count as a
    # structurally-correct decision. Order doesn't matter.
    acceptable_routes: tuple[str, ...]
    # Routes that would indicate a real correctness failure if hit (e.g. a
    # non-clinical query landing on sop_library = a false-positive SOP match).
    forbidden_routes: tuple[str, ...] = ()
    expected_sop_title: Optional[str] = None
    # Substrings the answer should contain if it's actually answering the
    # question (case-insensitive). Not required for D (out-of-scope).
    expect_keywords: tuple[str, ...] = ()
    require_citations: bool = False
    # For category E: prior turns to run first, building conversation history.
    prior_turns: tuple[str, ...] = field(default_factory=tuple)


QUALITY_EVAL_CASES: list[QualityCase] = [
    # ---- Category A: SOP-supported ----
    QualityCase(
        query="What are the steps for sepsis management?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Sepsis Management Protocol",
        expect_keywords=("lactate", "fluid"),
        require_citations=True,
    ),
    QualityCase(
        query="What norepinephrine dose is mentioned?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Sepsis Management Protocol",
        expect_keywords=("0.05", "mcg"),
        require_citations=True,
    ),
    QualityCase(
        query="What should be monitored after central line insertion?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Central Line Insertion Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="What contraindications apply before blood transfusion?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Blood Transfusion Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="When should insulin be held for hypoglycemia?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Insulin and Hypoglycemia Management Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="What PPE is required for high-risk respiratory isolation?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Infection Control Isolation Protocol",
        require_citations=True,
    ),

    QualityCase(
        query="What is the door-to-needle target for stroke thrombolysis?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Code Stroke Response Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="How quickly should a bed be assigned after an admission order?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Patient Flow and Bed Management Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="How soon must the expected date of discharge be set after admission?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Discharge Planning Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="How soon must the admission history and physical be completed?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Clinical Documentation Standards Policy",
        require_citations=True,
    ),
    QualityCase(
        query="What is the minimum chart sample size for a compliance audit?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Internal Compliance Audit Procedure",
        require_citations=True,
    ),
    QualityCase(
        query="How soon must primary source verification be initiated for a new hire?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Staff Onboarding and Credentialing Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="How soon after hire must core competency training be completed?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Mandatory Training Compliance Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="How quickly must a sentinel event be reported to Risk Management?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Patient Safety Incident Reporting Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="How long must baseline measurement run before a quality improvement intervention?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Quality Improvement Review Cycle Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="What are contraindications before starting anticoagulation?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Anticoagulation Safety Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="How soon after admission must the best possible medication history be completed?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Medication Reconciliation Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="How soon must a post-fall huddle occur after a patient fall?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Fall Prevention Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="What is the initial epinephrine dose for a Code Blue?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Code Blue Response Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="What is the observation window after IV contrast administration?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Contrast Allergy and Reaction Protocol",
        require_citations=True,
    ),

    QualityCase(
        query="What ANC is required before giving chemotherapy?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Chemotherapy Administration Safety Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="What cardiac index defines cardiogenic shock?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Cardiogenic Shock and Vasopressor Management Protocol",
        require_citations=True,
    ),
    QualityCase(
        query="What is the naloxone dose for opioid overdose reversal?",
        category="A", label="SOP-supported",
        acceptable_routes=("sop_library",),
        expected_sop_title="Opioid Analgesia and Overdose Prevention Protocol",
        require_citations=True,
    ),

    # ---- Category B: partial SOP support ----
    # These ask for something adjacent to, but not squarely inside, what the
    # SOP states - the pipeline should still answer from the SOP (possibly
    # at moderate/weak confidence) rather than either fabricating the
    # missing detail or wrongly abstaining outright.
    QualityCase(
        query="Does the sepsis SOP mention repeat lactate measurement?",
        category="B", label="Partial SOP support",
        acceptable_routes=("sop_library", "hybrid", "no_evidence"),
        expected_sop_title="Sepsis Management Protocol",
    ),
    QualityCase(
        query="Does the isolation SOP mention N95 requirements for aerosol-generating procedures?",
        category="B", label="Partial SOP support",
        acceptable_routes=("sop_library", "hybrid", "no_evidence"),
        expected_sop_title="Infection Control Isolation Protocol",
    ),
    QualityCase(
        query="Compare the sepsis SOP with current clinical evidence.",
        category="B", label="Partial SOP support / comparison",
        acceptable_routes=("hybrid", "sop_library"),
        expected_sop_title="Sepsis Management Protocol",
    ),

    # ---- Category C: no internal SOP, external fallback ----
    # Real clinical topics with no matching internal SOP. Must not
    # force-match an unrelated SOP just because of shared vocabulary
    # (e.g. "sting"/"envenomation" near infection-control language).
    QualityCase(
        query="What is the protocol for jellyfish sting treatment?",
        category="C", label="No internal SOP / external fallback",
        acceptable_routes=("external_evidence", "no_evidence"),
        forbidden_routes=("sop_library",),
    ),
    QualityCase(
        query="What is the protocol for heat stroke management?",
        category="C", label="No internal SOP / external fallback",
        acceptable_routes=("external_evidence", "no_evidence"),
        # The known false-positive risk this case exists to catch: matching
        # "Code Stroke Response Protocol" purely on the shared word "stroke".
        forbidden_routes=("sop_library",),
    ),
    QualityCase(
        query="What is the protocol for scorpion envenomation?",
        category="C", label="No internal SOP / external fallback",
        acceptable_routes=("external_evidence", "no_evidence"),
        forbidden_routes=("sop_library",),
    ),

    # ---- Category D: non-clinical ----
    QualityCase(
        query="How do I fix a leaking kitchen faucet?",
        category="D", label="Non-clinical / out of scope",
        acceptable_routes=("no_evidence", "clarification"),
        forbidden_routes=("sop_library",),
    ),
    QualityCase(
        query="What is the cafeteria menu today?",
        category="D", label="Non-clinical / out of scope",
        acceptable_routes=("no_evidence", "clarification"),
        forbidden_routes=("sop_library",),
    ),
    QualityCase(
        query="How do I reset my laptop password?",
        category="D", label="Non-clinical / out of scope",
        acceptable_routes=("no_evidence", "clarification"),
        forbidden_routes=("sop_library",),
    ),

    # ---- Category E: follow-up (multi-turn) ----
    QualityCase(
        query="What dose of norepinephrine does it mention?",
        category="E", label="Follow-up",
        acceptable_routes=("sop_library",),
        expected_sop_title="Sepsis Management Protocol",
        expect_keywords=("0.05", "mcg"),
        require_citations=True,
        prior_turns=("What are the steps for sepsis management?",),
    ),
    QualityCase(
        query="Does it say when to escalate?",
        category="E", label="Follow-up",
        acceptable_routes=("sop_library",),
        expected_sop_title="Sepsis Management Protocol",
        prior_turns=(
            "What are the steps for sepsis management?",
            "What dose of norepinephrine does it mention?",
        ),
    ),
]


def _history_block(turns: list[tuple[str, str]]) -> str:
    """Mirror routes_chat.py's Q/A history format (last 2 pairs, 200 chars each)."""
    lines: list[str] = []
    for q, a in turns[-2:]:
        lines.append(f"Q: {q[:200]}")
        lines.append(f"A: {a[:200]}")
    return "\n".join(lines)


async def _run_case(pipeline: MeridianPipeline, case: QualityCase) -> dict[str, Any]:
    history: list[tuple[str, str]] = []
    for prior_q in case.prior_turns:
        prior_response = await pipeline.run(
            query=prior_q,
            history_context=_history_block(history),
            context_query=" ".join(q for q, _ in history),
        )
        history.append((prior_q, prior_response.answer))

    response = await pipeline.run(
        query=case.query,
        history_context=_history_block(history),
        context_query=" ".join(q for q, _ in history),
    )

    top_chunk = response.retrieved_chunks[0] if response.retrieved_chunks else None
    citation_count = len([c for c in response.inline_citations if c.get("cited_in_answer")])
    answer_lower = response.answer.lower()

    reasons: list[str] = []
    passed = True

    if response.route not in case.acceptable_routes:
        passed = False
        reasons.append(f"route '{response.route}' not in acceptable {case.acceptable_routes}")
    if response.route in case.forbidden_routes:
        passed = False
        reasons.append(f"route '{response.route}' is forbidden for this case")
    if case.expected_sop_title and top_chunk and top_chunk.sop_title != case.expected_sop_title:
        passed = False
        reasons.append(f"top SOP '{top_chunk.sop_title}' != expected '{case.expected_sop_title}'")
    if case.require_citations and citation_count == 0:
        passed = False
        reasons.append("expected at least one cited claim, got 0")
    missing_keywords = [kw for kw in case.expect_keywords if kw.lower() not in answer_lower]
    if missing_keywords:
        passed = False
        reasons.append(f"answer missing expected keyword(s): {missing_keywords}")

    return {
        "query": case.query,
        "category": case.category,
        "label": case.label,
        "route": response.route,
        "route_label": _ROUTE_LABEL.get(response.route, response.route),
        "top_sop": top_chunk.sop_title if top_chunk else None,
        "retrieval_score": round(top_chunk.relevance_score, 4) if top_chunk else 0.0,
        "confidence_tier": response.confidence_tier,
        "abstained": response.abstained,
        "citation_count": citation_count,
        "external_evidence_count": len(response.external_evidence),
        "passed": passed,
        "fail_reasons": reasons,
    }


async def run_quality_eval(pipeline: Optional[MeridianPipeline] = None) -> dict[str, Any]:
    if pipeline is None:
        from app.evaluation.ragas_lite import _build_demo_pipeline
        pipeline = _build_demo_pipeline()

    results: list[dict[str, Any]] = []
    for case in QUALITY_EVAL_CASES:
        try:
            results.append(await _run_case(pipeline, case))
        except Exception as e:
            results.append({
                "query": case.query, "category": case.category, "label": case.label,
                "passed": False, "fail_reasons": [f"exception: {e}"],
            })

    by_category: dict[str, dict[str, int]] = {}
    for r in results:
        cat = by_category.setdefault(r["category"], {"total": 0, "passed": 0})
        cat["total"] += 1
        if r["passed"]:
            cat["passed"] += 1

    total = len(results)
    total_passed = sum(1 for r in results if r["passed"])

    return {
        "eval": "quality_eval",
        "disclaimer": "Research prototype. Route-correctness checks, not clinical validation.",
        "total_cases": total,
        "total_passed": total_passed,
        "pass_rate": round(total_passed / total, 3) if total else 0.0,
        "by_category": by_category,
        "results": results,
    }


def print_report(report: dict[str, Any]) -> None:
    print(f"\nMeridian Answer-Quality Evaluation")
    print(f"{report['total_passed']}/{report['total_cases']} passed "
          f"({report['pass_rate'] * 100:.0f}%)\n")
    for r in report["results"]:
        status = "PASS" if r["passed"] else "FAIL"
        print(f"[{status}] ({r['category']}) {r['query']}")
        print(f"       route={r.get('route')} top_sop={r.get('top_sop')} "
              f"score={r.get('retrieval_score')} tier={r.get('confidence_tier')} "
              f"citations={r.get('citation_count')}")
        if r["fail_reasons"]:
            for reason in r["fail_reasons"]:
                print(f"       - {reason}")
    print()
    print("By category:")
    for cat, stats in sorted(report["by_category"].items()):
        print(f"  {cat}: {stats['passed']}/{stats['total']}")


if __name__ == "__main__":
    result = asyncio.run(run_quality_eval())
    print_report(result)
