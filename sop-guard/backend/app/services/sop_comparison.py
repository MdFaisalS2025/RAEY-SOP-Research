"""
Meridian SOP vs External Protocol Comparison
-----------------------------------------------
Compares an internal SOP's procedure steps against an external reference
point-by-point. Two ways a reference gets built:

1. Curated (REFERENCE_PROTOCOLS below) - real steps hand-transcribed from
   one specific, named published guideline bundle (e.g. the Surviving
   Sepsis Campaign Hour-1 Bundle). Highest quality: every "step" is a real
   step from a real structured guideline, not a title fragment.

2. Dynamic (build_dynamic_reference_items) - for any SOP without a curated
   bundle, built on the fly from the highest-graded results already
   returned by evidence_registry.search_all() for that SOP's topic (only
   Strong/Moderate-grade sources: guidelines, systematic reviews,
   meta-analyses, RCTs, Tier-1/2 journals - see evidence_source.py's
   grade_evidence()). This makes comparison available for *any* question,
   not just the ones we've hand-curated, but each "reference step" is
   really an external source's title, not a parsed procedural step - PubMed/
   WHO/etc. APIs return titles and abstracts, not structured guideline
   text, so this is honestly a topic-coverage comparison rather than a
   step-by-step one. The mode is returned on every response so the UI can
   label it accurately instead of implying more precision than exists.

A production system would replace REFERENCE_PROTOCOLS with a real
guideline-ingestion service (structured parsing of WHO/CDC/society
guideline documents into discrete steps) and could then retire dynamic
mode's title-level fallback for topics it now covers - the comparison
engine itself doesn't care which path built its input.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import re
from typing import Any, Optional

MATCH_THRESHOLD = 0.75
PARTIAL_THRESHOLD = 0.5
SOP_ONLY_THRESHOLD = 0.4  # below this, an internal step isn't "explained" by any reference step
MIN_DYNAMIC_GRADE_RANK = 4  # evidence_grade_rank: Strong=5, Moderate=4 - only these qualify as reference material
MAX_DYNAMIC_ITEMS = 8

#: sop_id -> curated reference protocol. Real steps from one named,
#: real published bundle - the highest-quality path, used whenever
#: available; every other SOP falls back to dynamic mode (see module
#: docstring) rather than getting no comparison at all.
REFERENCE_PROTOCOLS: dict[str, dict[str, Any]] = {
    "SOP-ICU-001": {
        "source_name": "Surviving Sepsis Campaign - Hour-1 Bundle",
        "source_type": "Professional Society Guideline",
        "publisher": "Society of Critical Care Medicine / European Society of Intensive Care Medicine",
        "year": 2021,
        "url": "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines",
        "steps": [
            "Screen for suspected sepsis",
            "Measure lactate",
            "Obtain blood cultures before antibiotics when feasible",
            "Administer broad-spectrum antibiotics rapidly",
            "Begin fluid resuscitation when indicated",
            "Reassess hemodynamic status",
            "Consider vasopressors if hypotension persists",
            "Monitor urine output and organ dysfunction",
            "Escalate to ICU/critical care when needed",
        ],
    },
}


def _significant_words(text: str) -> set[str]:
    return set(re.findall(r"[a-z]{3,}", (text or "").lower()))


def _lexical_similarity(a: str, b: str) -> float:
    """Jaccard overlap on significant words - the fallback used whenever a
    dense embedding model isn't loaded (see get_similarity_fn()), so the
    comparison still produces a meaningful classification in "Extractive
    (no model configured)" mode rather than failing to run at all."""
    wa, wb = _significant_words(a), _significant_words(b)
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)


def _best_match(text: str, candidates: list[str], sim_fn) -> tuple[Optional[int], float]:
    best_idx, best_score = None, 0.0
    for i, cand in enumerate(candidates):
        try:
            score = float(sim_fn(text, cand)) if sim_fn else _lexical_similarity(text, cand)
        except Exception:
            score = _lexical_similarity(text, cand)
        if score > best_score:
            best_score, best_idx = score, i
    return best_idx, best_score


def build_dynamic_reference_items(evidence_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build reference items from the highest-graded records already
    fetched for this SOP's topic. Returns [] if nothing meets the quality
    bar - an honest empty comparison beats padding it with weak evidence."""
    from app.integrations.evidence_source import evidence_grade_rank

    graded = [r for r in evidence_records if evidence_grade_rank(r) >= MIN_DYNAMIC_GRADE_RANK]
    graded.sort(key=lambda r: (evidence_grade_rank(r), r.get("pub_date_parsed") or "0000-00-00"), reverse=True)

    items = []
    for r in graded[:MAX_DYNAMIC_ITEMS]:
        items.append({
            "text": r.get("title") or "(untitled)",
            "source_name": r.get("journal_display_name") or r.get("journal") or r.get("source_type", ""),
            "source_type": r.get("study_type") or r.get("source_type", ""),
            "url": r.get("url", ""),
            "pub_date": r.get("pub_date", ""),
            "grade": r.get("evidence_grade", "Unknown"),
        })
    return items


def _run_comparison(
    sop_id: str,
    internal_steps: list[str],
    reference_items: list[dict[str, Any]],
    sim_fn,
    mode: str,
    reference_source: Optional[dict[str, Any]],
) -> Optional[dict[str, Any]]:
    if not reference_items:
        return None

    reference_texts = [it["text"] for it in reference_items]
    rows: list[dict[str, Any]] = []
    matched_internal_idxs: set[int] = set()

    for item in reference_items:
        idx, score = _best_match(item["text"], internal_steps, sim_fn)
        if idx is not None and score >= MATCH_THRESHOLD:
            status = "match"
        elif idx is not None and score >= PARTIAL_THRESHOLD:
            status = "partial_match"
        else:
            status = "missing_from_sop"
        if idx is not None and score >= PARTIAL_THRESHOLD:
            matched_internal_idxs.add(idx)
        rows.append({
            "reference_step": item["text"],
            "matched_internal_step": internal_steps[idx] if (idx is not None and status != "missing_from_sop") else None,
            "status": status,
            "similarity": round(score, 3),
            "source_name": item.get("source_name", ""),
            "source_type": item.get("source_type", ""),
            "url": item.get("url", ""),
            "pub_date": item.get("pub_date", ""),
            "grade": item.get("grade"),
        })

    sop_only_steps: list[str] = []
    for i, step_text in enumerate(internal_steps):
        if i in matched_internal_idxs:
            continue
        # Only flag as genuinely "SOP only" if it isn't a near-duplicate of
        # some reference step that just lost the best-match slot to another
        # internal step - re-check against the whole reference list directly.
        _, best_ref_score = _best_match(step_text, reference_texts, sim_fn)
        if best_ref_score < SOP_ONLY_THRESHOLD:
            sop_only_steps.append(step_text)

    match_count = sum(1 for r in rows if r["status"] == "match")
    partial_count = sum(1 for r in rows if r["status"] == "partial_match")
    missing_count = sum(1 for r in rows if r["status"] == "missing_from_sop")

    if missing_count == 0 and partial_count == 0:
        overall_alignment = "Aligned"
        recommended_action = "No committee review needed based on this comparison - internal SOP covers all reference points."
    elif missing_count > 0:
        overall_alignment = "Needs Review"
        recommended_action = "Committee Review Recommended - one or more reference points are not reflected in the current SOP."
    else:
        overall_alignment = "Partially Aligned"
        recommended_action = "Committee Review Suggested - some steps only partially match current external guidance."

    return {
        "sop_id": sop_id,
        "mode": mode,
        "reference_source": reference_source,
        "rows": rows,
        "sop_only_steps": sop_only_steps,
        "summary": {
            "match_count": match_count,
            "partial_count": partial_count,
            "missing_count": missing_count,
            "sop_only_count": len(sop_only_steps),
            "total_reference_steps": len(reference_items),
            "overall_alignment": overall_alignment,
            "recommended_action": recommended_action,
        },
    }


def compare_sop_to_reference(sop_id: str, internal_steps: list[str], sim_fn=None) -> Optional[dict[str, Any]]:
    """Curated-bundle comparison. Returns None if no curated reference
    protocol exists for this SOP - callers should fall back to
    compare_sop_to_dynamic_evidence() in that case."""
    reference = REFERENCE_PROTOCOLS.get(sop_id)
    if reference is None:
        return None

    items = [{
        "text": step,
        "source_name": reference["source_name"],
        "source_type": reference["source_type"],
        "url": reference["url"],
        "pub_date": str(reference["year"]),
        "grade": "Strong",
    } for step in reference["steps"]]

    return _run_comparison(
        sop_id, internal_steps, items, sim_fn, mode="curated",
        reference_source={
            "name": reference["source_name"],
            "source_type": reference["source_type"],
            "publisher": reference["publisher"],
            "year": reference["year"],
            "url": reference["url"],
        },
    )


def compare_sop_to_dynamic_evidence(
    sop_id: str,
    internal_steps: list[str],
    evidence_records: list[dict[str, Any]],
    sim_fn=None,
) -> Optional[dict[str, Any]]:
    """Generic comparison for any SOP - builds the reference from the
    highest-graded live evidence already fetched for this topic. Returns
    None if nothing meets the quality bar (see MIN_DYNAMIC_GRADE_RANK)."""
    items = build_dynamic_reference_items(evidence_records)
    return _run_comparison(sop_id, internal_steps, items, sim_fn, mode="dynamic", reference_source=None)
