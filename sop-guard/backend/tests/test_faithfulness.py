"""Tests for semantic faithfulness scoring.

A grounded sentence should score higher than an invented one. We inject a
deterministic token-overlap similarity so the test does not depend on whether
sentence-transformers is installed.
"""

import re

from app.rag.faithfulness_nli import check_faithfulness_semantic


def _token_overlap_sim(a: str, b: str) -> float:
    ta = set(re.findall(r"[a-z0-9]+", a.lower()))
    tb = set(re.findall(r"[a-z0-9]+", b.lower()))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


CHUNKS = [
    {"sop_title": "Sepsis SOP",
     "text": "The maximum norepinephrine dose is 3 mcg per kg per min in septic shock."},
]


def test_grounded_scores_higher_than_invented():
    grounded = "The maximum norepinephrine dose is 3 mcg per kg per min in septic shock."
    invented = "Patients should be given 500 mg of an unrelated antibiotic every fortnight."

    g = check_faithfulness_semantic(grounded, CHUNKS, embed_fn=_token_overlap_sim)
    inv = check_faithfulness_semantic(invented, CHUNKS, embed_fn=_token_overlap_sim)

    assert g["method"] == "semantic"
    g_sim = g["sentences"][0]["similarity"]
    inv_sim = inv["sentences"][0]["similarity"]
    assert g_sim > inv_sim
    assert g["overall_faithfulness"] >= inv["overall_faithfulness"]


def test_keyword_fallback_shape():
    # No embed_fn and (typically) no dense backend -> keyword fallback.
    res = check_faithfulness_semantic(
        "The maximum norepinephrine dose is 3 mcg per kg per min.", CHUNKS
    )
    assert "overall_faithfulness" in res
    assert "sentences" in res
    assert res["method"] in ("semantic", "keyword_fallback")
