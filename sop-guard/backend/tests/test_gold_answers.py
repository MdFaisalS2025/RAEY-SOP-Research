"""
Guards the gold-answer set (app/evaluation/gold_answers.py) against drift: a
"correct" answer must be defined by what the demo SOP corpus actually states,
never by outside facts the system was never given. If a must_include fact is
edited to something the corpus doesn't contain, this test fails - so the
correctness harness can't silently start grading against unsupported facts.
"""

import re

from app.demo_data.demo_sops import DEMO_SOPS
from app.evaluation.gold_answers import GOLD_CASES


def _norm(t: str) -> str:
    return re.sub(r"\s+", " ", (t or "").lower())


_BY_TITLE = {s["title"]: s for s in DEMO_SOPS}


def test_every_sop_case_names_a_real_sop():
    for c in GOLD_CASES:
        if c.category == "sop":
            assert c.expected_sop in _BY_TITLE, f"{c.id}: unknown SOP {c.expected_sop!r}"


def test_every_must_include_fact_exists_in_its_sop():
    failures = []
    for c in GOLD_CASES:
        if c.category != "sop":
            continue
        sop = _BY_TITLE[c.expected_sop]
        blob = _norm(sop["raw_text"] + " " + str(sop.get("structured_json", "")))
        for fact in c.must_include:
            if _norm(fact) not in blob:
                failures.append((c.id, fact))
    assert not failures, f"gold facts not present in their SOP: {failures}"


def test_case_ids_are_unique():
    ids = [c.id for c in GOLD_CASES]
    assert len(ids) == len(set(ids))


def test_all_five_intents_represented():
    cats = {c.category for c in GOLD_CASES}
    assert cats == {"sop", "external", "out_of_scope"}
    # a meaningful number of scored SOP cases
    assert sum(1 for c in GOLD_CASES if c.category == "sop") >= 15
