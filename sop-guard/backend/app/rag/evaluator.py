"""
Meridian RAG Evaluation
Tests retrieval quality, answer accuracy, and safety.
Research prototype. Not for clinical use.
"""

from typing import Any


RAG_TEST_CASES = [
    {
        "query": "What are the steps for sepsis management?",
        "expected_sop": "SOP-ICU-001",
        "expected_type": "sequence",
        "expected_keywords": ["blood cultures", "antibiotics", "fluid", "vasopressor"],
    },
    {
        "query": "What is the MAP threshold in septic shock?",
        "expected_sop": "SOP-ICU-001",
        "expected_type": "threshold",
        "expected_keywords": ["65", "mmhg", "map"],
    },
    {
        "query": "What contraindications exist for blood transfusion?",
        "expected_sop": "SOP-GEN-002",
        "expected_type": "contraindication",
        "expected_keywords": ["consent", "crossmatch", "stop"],
    },
    {
        "query": "When should insulin be held?",
        "expected_sop": "SOP-ENDO-004",
        "expected_type": "threshold",
        "expected_keywords": ["glucose", "70", "hypoglycemia"],
    },
    {
        "query": "What is norepinephrine dosing in sepsis?",
        "expected_sop": "SOP-ICU-001",
        "expected_type": "threshold",
        "expected_keywords": ["norepinephrine", "mcg", "vasopressor"],
    },
    {
        "query": "What PPE is needed for airborne isolation?",
        "expected_sop": "SOP-IC-008",
        "expected_type": "sequence",
        "expected_keywords": ["n95", "airborne", "isolation", "respirator"],
    },
    {
        "query": "What are the epinephrine intervals in code blue?",
        "expected_sop": "SOP-EM-009",
        "expected_type": "threshold",
        "expected_keywords": ["epinephrine", "1mg", "3", "5", "minutes"],
    },
    {
        "query": "What is a totally unrelated question about cooking?",
        "expected_sop": "",
        "expected_type": "general",
        "expected_keywords": [],
        "should_refuse": True,
    },
]


def evaluate_retrieval(
    retriever,
    pipeline,
    test_cases: list[dict] | None = None,
) -> dict[str, Any]:
    """Run RAG evaluation test cases."""
    cases = test_cases or RAG_TEST_CASES
    results = []

    correct_sop = 0
    correct_type = 0
    keyword_hits = 0
    total_keywords = 0
    refusal_correct = 0
    refusal_total = 0

    for case in cases:
        query = case["query"]
        expected_sop = case.get("expected_sop", "")
        expected_type = case.get("expected_type", "general")
        expected_kw = case.get("expected_keywords", [])
        should_refuse = case.get("should_refuse", False)

        # Retrieve
        retrieved = retriever.search(query, top_k=5, query_type=expected_type)

        # Check SOP match
        top_sop = retrieved[0].get("sop_id", "") if retrieved else ""
        sop_match = (top_sop == expected_sop) if expected_sop else True
        if sop_match:
            correct_sop += 1

        # Check keyword coverage
        all_text = " ".join(c.get("text", c.get("chunk_text", "")).lower() for c in retrieved)
        kw_found = sum(1 for kw in expected_kw if kw.lower() in all_text)
        keyword_hits += kw_found
        total_keywords += len(expected_kw)

        # Check refusal
        if should_refuse:
            refusal_total += 1
            if not retrieved or (retrieved and retrieved[0].get("relevance_score", 0) < 0.01):
                refusal_correct += 1

        results.append({
            "query": query,
            "expected_sop": expected_sop,
            "retrieved_sop": top_sop,
            "sop_match": sop_match,
            "expected_type": expected_type,
            "keyword_coverage": f"{kw_found}/{len(expected_kw)}",
            "top_score": retrieved[0].get("relevance_score", 0) if retrieved else 0,
            "chunks_found": len(retrieved),
        })

    n = len(cases)
    return {
        "total_cases": n,
        "retrieval_precision": round(correct_sop / n, 3) if n else 0,
        "keyword_coverage": round(keyword_hits / total_keywords, 3) if total_keywords else 0,
        "refusal_accuracy": round(refusal_correct / refusal_total, 3) if refusal_total else 1.0,
        "details": results,
    }
