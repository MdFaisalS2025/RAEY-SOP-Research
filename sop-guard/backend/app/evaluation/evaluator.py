"""
SOP-Guard Evaluation Runner
----------------------------
Run test cases against the pipeline and compute metrics.
Research prototype  - NOT for clinical use.
"""

from datetime import datetime, timezone
from typing import Any

from app.agents.pipeline import SOPGuardPipeline
from app.schemas.schemas import EvaluationResult


# Hardcoded test cases with expected results
TEST_CASES = [
    {
        "query": "What is the target MAP for sepsis patients in ICU?",
        "expected_query_type": "threshold",
        "expected_keywords": ["65", "mmhg", "map"],
        "expected_sop": "SOP-ICU-001",
        "should_verify_pass": True,
    },
    {
        "query": "What are the steps for sepsis management in the ICU?",
        "expected_query_type": "sequence",
        "expected_keywords": ["step", "assessment", "blood cultures", "antibiotics"],
        "expected_sop": "SOP-ICU-001",
        "should_verify_pass": True,
    },
    {
        "query": "What are the contraindications for fluid resuscitation in sepsis?",
        "expected_query_type": "contraindication",
        "expected_keywords": ["heart failure", "30", "ml/kg"],
        "expected_sop": "SOP-ICU-001",
        "should_verify_pass": True,
    },
    {
        "query": "What are the blood glucose thresholds for hypoglycemia treatment?",
        "expected_query_type": "threshold",
        "expected_keywords": ["70", "54", "glucose"],
        "expected_sop": "SOP-ENDO-004",
        "should_verify_pass": True,
    },
    {
        "query": "What are the steps for blood transfusion administration?",
        "expected_query_type": "sequence",
        "expected_keywords": ["verify", "consent", "vital signs", "transfusion"],
        "expected_sop": "SOP-GEN-002",
        "should_verify_pass": True,
    },
    {
        "query": "What is the recipe for chocolate cake?",
        "expected_query_type": "general",
        "expected_keywords": [],
        "expected_sop": "",
        "should_verify_pass": False,  # Should abstain
    },
]


class Evaluator:
    """Run evaluation test cases against the pipeline."""

    def __init__(self, pipeline: SOPGuardPipeline):
        self.pipeline = pipeline

    async def run_evaluation(self) -> EvaluationResult:
        """Execute all test cases and compute metrics."""
        details = []
        retrieval_hits = 0
        answer_hits = 0
        verification_correct = 0
        total = len(TEST_CASES)

        for case in TEST_CASES:
            result = await self.pipeline.run(case["query"])

            # Check retrieval: did we get chunks from the expected SOP?
            retrieved_sop_ids = {c.sop_id for c in result.retrieved_chunks}
            retrieval_ok = (
                case["expected_sop"] in retrieved_sop_ids
                if case["expected_sop"]
                else len(result.retrieved_chunks) == 0 or result.confidence < 0.3
            )
            if retrieval_ok:
                retrieval_hits += 1

            # Check answer: do expected keywords appear?
            answer_lower = result.answer.lower()
            if case["expected_keywords"]:
                kw_found = sum(1 for kw in case["expected_keywords"] if kw in answer_lower)
                answer_ok = kw_found >= len(case["expected_keywords"]) * 0.5
            else:
                # For irrelevant queries, answer should abstain
                answer_ok = "cannot safely answer" in answer_lower or result.confidence < 0.3
            if answer_ok:
                answer_hits += 1

            # Check verification
            if result.verification_result:
                ver_passed = result.verification_result.status.value in ("passed", "warning")
                ver_ok = ver_passed == case["should_verify_pass"]
            else:
                ver_ok = not case["should_verify_pass"]
            if ver_ok:
                verification_correct += 1

            details.append({
                "query": case["query"],
                "expected_type": case["expected_query_type"],
                "actual_type": result.query_type,
                "retrieval_ok": retrieval_ok,
                "answer_ok": answer_ok,
                "verification_ok": ver_ok,
                "confidence": result.confidence,
                "verification_status": result.verification_result.status.value if result.verification_result else "none",
            })

        return EvaluationResult(
            total_cases=total,
            retrieval_precision=round(retrieval_hits / max(total, 1), 3),
            answer_accuracy=round(answer_hits / max(total, 1), 3),
            verification_detection_rate=round(verification_correct / max(total, 1), 3),
            details=details,
            timestamp=datetime.now(timezone.utc),
        )
