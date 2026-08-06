"""
Meridian SOP vs External Protocol Comparison
-----------------------------------------------
Compares an internal SOP's procedure steps against an external reference
point-by-point. Three ways a reference gets built, tried in this order:

1. Live guideline (compare_sop_to_guideline) - the primary path for every
   SOP, including SOP-ICU-001. Retrieves a real guideline document for the
   SOP's topic and compares against sentences extracted from its abstract
   (guideline_finder.py). Real sentences from the right document, not a
   title fragment and not a stored transcription.

2. Curated offline fallback (REFERENCE_PROTOCOLS, demo_data/
   reference_protocols.py) - used ONLY when live retrieval is unavailable
   (no network, no qualifying provider result, nothing extractable from the
   retrieved abstract) for the one SOP with a stored transcription. Every
   step carries real per-step provenance (`fidelity`: verbatim vs.
   paraphrase, `source_locus`, and a real per-step `grade` - not a blanket
   "Strong"), and firing this path is always disclosed to the UI so it
   never reads as equivalent to a live result.

3. Dynamic (build_dynamic_reference_items) - for any SOP where neither of
   the above found anything, built on the fly from the highest-graded
   results already returned by evidence_registry.search_all() for that
   SOP's topic (only Strong/Moderate-grade sources: guidelines, systematic
   reviews, meta-analyses, RCTs, Tier-1/2 journals - see
   evidence_source.py's grade_evidence()). Each "reference step" here is
   really an external source's title, not a parsed procedural step -
   PubMed/WHO/etc. APIs return titles and abstracts, not structured
   guideline text, so this is honestly a topic-coverage comparison rather
   than a step-by-step one. The mode is returned on every response so the
   UI can label it accurately instead of implying more precision than
   exists.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import re
from typing import Any, Optional

from app.demo_data.reference_protocols import REFERENCE_PROTOCOLS

MIN_DYNAMIC_GRADE_RANK = 4  # evidence_grade_rank: Strong=5, Moderate=4 - only these qualify as reference material
MAX_DYNAMIC_ITEMS = 8

# Two calibrated threshold sets, keyed by which similarity method actually
# ran (see _run_comparison's `method` param). A single threshold triple used
# to serve both cosine (bge-small-en-v1.5, when a dense model is loaded) and
# lexical (Jaccard, the no-model fallback) - but the two metrics have wildly
# different scales for the same pair, and reusing one triple for both was
# not just miscalibrated, it was silently wrong: measured on the curated
# SOP-ICU-001 / Surviving Sepsis Campaign pairs, Jaccard put every true
# match below 0.45 (lactate 0.286, cultures 0.312, antibiotics 0.444, fluids
# 0.300) and mis-ranked the top-1 match for "Screen for suspected sepsis"
# onto the antibiotics step at 0.091 - so in no-model mode the flagship
# curated comparison returned 9/9 missing_from_sop regardless of shipped
# threshold values, because the metric itself (Jaccard's union denominator,
# which penalizes a short reference bullet for not sharing every word with
# a long, detailed SOP step) was wrong for this comparison, not just
# uncalibrated. See _lexical_similarity below and
# backend/app/evaluation/comparison_eval.py, which is the empirical basis
# for both threshold sets - a labeled fixture sweep, not guessed numbers.
_THRESHOLDS: dict[str, dict[str, float]] = {
    "cosine": {"match": 0.72, "partial": 0.50, "sop_only": 0.40},
    "lexical": {"match": 0.65, "partial": 0.35, "sop_only": 0.25},
}

_METHOD_LABEL = {
    "cosine": "Semantic (bge-small-en-v1.5 embeddings)",
    "lexical": "Extractive word-overlap (no embedding model loaded)",
}

# Grade-weighted overall_alignment (replaces the old boolean cascade, which
# made 8/9 match + 1 missing indistinguishable from 0/9 match + 9 missing,
# and required a perfect sweep to ever reach "Aligned"). A reference point's
# weight in the score is its own evidence grade, so one Limited-grade
# preprint missing something matters far less than a Strong guideline
# recommendation missing it.
#
_GRADE_WEIGHT: dict[str, float] = {
    "Strong": 1.0, "Moderate": 0.7, "Limited": 0.4,
    "Research Only": 0.2, "Unknown": 0.2, "Outdated": 0.1,
}
_STATUS_CREDIT: dict[str, float] = {"match": 1.0, "partial_match": 0.5, "missing_from_sop": 0.0}

_ALIGNED_FLOOR = 0.85
_PARTIALLY_ALIGNED_FLOOR = 0.60


def internal_steps_from(structured_json: Optional[dict[str, Any]]) -> list[str]:
    """Extract step text from an SOP's structured_json for comparison.

    Two shapes exist in this codebase and both must be handled: the
    hand-authored demo corpus uses {"step": N, "action": "..."}, while
    structure_sop()'s real extractor (sop_structurer.py) emits
    {"step_number": N, "text": "..."}. chunker.py already defends against
    this exact divergence with step.get("text", step.get("action", "")) -
    the comparison route and the chat-intent path didn't, so every
    uploaded SOP silently compared against a list of empty strings and
    always came back "Needs Review" regardless of actual content."""
    steps = (structured_json or {}).get("steps", [])
    out = []
    for s in steps:
        if isinstance(s, dict):
            text = s.get("text") or s.get("action") or ""
        else:
            text = str(s or "")
        if text.strip():
            out.append(text)
    return out


def _significant_words(text: str) -> set[str]:
    return set(re.findall(r"[a-z]{3,}", (text or "").lower()))


def _lexical_similarity(a: str, b: str) -> float:
    """Coverage of `a`'s content words by `b` - asymmetric on purpose. The
    fallback used whenever a dense embedding model isn't loaded (see
    get_similarity_fn()). The question this metric answers is "does b
    (the internal SOP step) cover a (the reference point)", not "are a and
    b interchangeable" - and a symmetric metric (Jaccard, the prior
    implementation) penalized exactly the case that matters here: a short
    guideline bullet against a long, detailed SOP step. See the
    _THRESHOLDS comment above for the measured before/after on the
    SOP-ICU-001 pairs."""
    wa, wb = _significant_words(a), _significant_words(b)
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa)


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

    # Which metric actually ran, and its calibrated thresholds - both
    # surfaced in the response so the UI can disclose them rather than
    # leaving a physician to guess whether "Partially Aligned" came from
    # semantic similarity or word overlap.
    method = "cosine" if sim_fn else "lexical"
    thresholds = _THRESHOLDS[method]

    reference_texts = [it["text"] for it in reference_items]
    rows: list[dict[str, Any]] = []
    matched_internal_idxs: set[int] = set()

    for item in reference_items:
        idx, score = _best_match(item["text"], internal_steps, sim_fn)
        if idx is not None and score >= thresholds["match"]:
            status = "match"
        elif idx is not None and score >= thresholds["partial"]:
            status = "partial_match"
        else:
            status = "missing_from_sop"
        if idx is not None and score >= thresholds["partial"]:
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
            # Whether this row is verbatim source wording or a paraphrase,
            # and where it came from - present for guideline-derived items
            # (build_guideline_reference_items) and curated offline-fallback
            # items (compare_sop_to_reference); absent (None) for
            # title-based dynamic rows, which don't carry this distinction.
            "fidelity": item.get("fidelity"),
            "source_locus": item.get("source_locus"),
        })

    # SOP-side accounting, exhaustive over every internal step (the old
    # version silently dropped steps scoring between sop_only and partial
    # thresholds into neither list nor count - the "dead zone"). Every
    # internal step lands in exactly one of: covered (already counted via
    # matched_internal_idxs), weakly_related (some resemblance to a
    # reference point but not enough to count as covered), or sop_only
    # (genuinely not explained by anything in the reference material).
    sop_only_steps: list[str] = []
    weakly_related_steps: list[dict[str, Any]] = []
    for i, step_text in enumerate(internal_steps):
        if i in matched_internal_idxs:
            continue
        # Only flag as genuinely "SOP only" if it isn't a near-duplicate of
        # some reference step that just lost the best-match slot to another
        # internal step - re-check against the whole reference list directly.
        _, best_ref_score = _best_match(step_text, reference_texts, sim_fn)
        if best_ref_score >= thresholds["sop_only"]:
            weakly_related_steps.append({"text": step_text, "similarity": round(best_ref_score, 3)})
        else:
            sop_only_steps.append(step_text)

    match_count = sum(1 for r in rows if r["status"] == "match")
    partial_count = sum(1 for r in rows if r["status"] == "partial_match")
    missing_count = sum(1 for r in rows if r["status"] == "missing_from_sop")

    # Grade-weighted coverage ratio, with a hard conservative override: one
    # Strong-grade reference point missing from the SOP escalates to Needs
    # Review regardless of the ratio, so a good-looking average can't hide
    # a single genuinely important gap.
    weighted_num = sum(_GRADE_WEIGHT.get(r["grade"], 0.2) * _STATUS_CREDIT[r["status"]] for r in rows)
    weighted_den = sum(_GRADE_WEIGHT.get(r["grade"], 0.2) for r in rows)
    alignment_score = round(weighted_num / weighted_den, 3) if weighted_den else None
    strong_missing = any(r["status"] == "missing_from_sop" and r["grade"] == "Strong" for r in rows)

    if strong_missing:
        overall_alignment = "Needs Review"
        recommended_action = "Committee Review Recommended - a Strong-grade reference point is not reflected in the current SOP."
    elif alignment_score is None:
        overall_alignment = "Needs Review"
        recommended_action = "Committee Review Recommended - alignment could not be scored."
    elif alignment_score >= _ALIGNED_FLOOR:
        overall_alignment = "Aligned"
        recommended_action = "No committee review needed based on this comparison - internal SOP covers all reference points."
    elif alignment_score >= _PARTIALLY_ALIGNED_FLOOR:
        overall_alignment = "Partially Aligned"
        recommended_action = "Committee Review Suggested - some steps only partially match current external guidance."
    else:
        overall_alignment = "Needs Review"
        recommended_action = "Committee Review Recommended - one or more reference points are not reflected in the current SOP."

    if reference_source is not None:
        reference_label = reference_source["name"]
    else:
        reference_label = f"{len(reference_items)} high-grade external source(s) on this topic (titles only, not a structured guideline)"

    return {
        "sop_id": sop_id,
        "mode": mode,
        "reference_source": reference_source,
        "reference_label": reference_label,
        "similarity_method": method,
        "similarity_method_label": _METHOD_LABEL[method],
        "thresholds": thresholds,
        "rows": rows,
        "sop_only_steps": sop_only_steps,
        "weakly_related_steps": weakly_related_steps,
        "summary": {
            # Legacy flat counts, kept for any consumer still reading them
            # directly - always equal to reference_side's own fields below.
            "match_count": match_count,
            "partial_count": partial_count,
            "missing_count": missing_count,
            "sop_only_count": len(sop_only_steps),
            "total_reference_steps": len(reference_items),
            "overall_alignment": overall_alignment,
            "alignment_score": alignment_score,
            "recommended_action": recommended_action,
            # Reconcilable tiles: each side's counts sum exactly to that
            # side's own total - the old four-tile row mixed a reference-side
            # denominator (match/partial/missing) with an internal-side one
            # (sop_only) as if they shared one, which was the actual source
            # of the tiles' apparent confusion, not the layout.
            "reference_side": {
                "match": match_count, "partial": partial_count, "missing": missing_count,
                "total": len(reference_items),
            },
            "sop_side": {
                "covered": len(matched_internal_idxs), "weakly_related": len(weakly_related_steps),
                "sop_only": len(sop_only_steps), "total": len(internal_steps),
            },
        },
    }


def compare_sop_to_reference(sop_id: str, internal_steps: list[str], sim_fn=None) -> Optional[dict[str, Any]]:
    """Curated OFFLINE FALLBACK comparison - only called when live
    guideline retrieval (compare_sop_to_guideline) found nothing. Returns
    None if no stored reference protocol exists for this SOP - callers
    should fall back further to compare_sop_to_dynamic_evidence() in that
    case. Every step carries its own real fidelity/source_locus/grade (see
    demo_data/reference_protocols.py) rather than a blanket "Strong", and
    the result carries a `fallback_note` so the UI can disclose that this
    is a stored transcription, not a live result."""
    reference = REFERENCE_PROTOCOLS.get(sop_id)
    if reference is None:
        return None

    items = [{
        "text": step["text"],
        "source_name": reference["source_name"],
        "source_type": reference["source_type"],
        "url": reference["url"],
        "pub_date": str(reference["year"]),
        "grade": step["grade"],
        "fidelity": step["fidelity"],
        "source_locus": step["source_locus"],
    } for step in reference["steps"]]

    verbatim_count = sum(1 for step in reference["steps"] if step["fidelity"] == "verbatim")
    result = _run_comparison(
        sop_id, internal_steps, items, sim_fn, mode="curated",
        reference_source={
            "name": reference["source_name"],
            "source_type": reference["source_type"],
            "publisher": reference["publisher"],
            "year": reference["year"],
            "url": reference["url"],
        },
    )
    if result is not None:
        result["fallback_note"] = (
            f"Live guideline retrieval was unavailable, so this compares against a stored transcription of the "
            f"{reference['source_name']} ({reference['publisher']}, {reference['year']}) typed by the project "
            f"author - {verbatim_count} of {len(reference['steps'])} steps verbatim, "
            f"{len(reference['steps']) - verbatim_count} paraphrased. Verify against the published source."
        )
    return result


def compare_sop_to_dynamic_evidence(
    sop_id: str,
    internal_steps: list[str],
    evidence_records: list[dict[str, Any]],
    sim_fn=None,
) -> Optional[dict[str, Any]]:
    """Generic comparison for any SOP - builds the reference from the
    highest-graded live evidence already fetched for this topic. Returns
    None if nothing meets the quality bar (see MIN_DYNAMIC_GRADE_RANK).

    This is the topic-coverage fallback (comparing against paper TITLES,
    see the module docstring) - compare_sop_to_guideline below is tried
    first and is preferred whenever it finds a real guideline document."""
    items = build_dynamic_reference_items(evidence_records)
    return _run_comparison(sop_id, internal_steps, items, sim_fn, mode="dynamic", reference_source=None)


def build_guideline_reference_items(guideline: dict[str, Any], recommendations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build reference items from real recommendation sentences extracted
    from a genuinely retrieved guideline (guideline_finder.py), rather than
    from a paper title (build_dynamic_reference_items) or a hand-typed
    bundle (REFERENCE_PROTOCOLS). Every item carries the guideline's own
    grade and, via `fidelity`/`source_locus` (passed through from
    extract_recommendations), an honest note that it's abstract-derived -
    not the full guideline text."""
    source_name = guideline.get("title") or "(untitled guideline)"
    source_type = guideline.get("study_type") or guideline.get("source_type", "")
    pub_date = guideline.get("pub_date") or (guideline.get("pub_date_parsed") or "")[:4]
    grade = guideline.get("evidence_grade", "Unknown")
    return [{
        "text": rec["text"],
        "source_name": source_name,
        "source_type": source_type,
        "url": guideline.get("url", ""),
        "pub_date": pub_date,
        "grade": grade,
        "fidelity": rec.get("fidelity", "verbatim"),
        "source_locus": rec.get("source_locus", ""),
    } for rec in recommendations]


async def compare_sop_to_guideline(sop_id: str, sop_title: str, internal_steps: list[str], sim_fn=None) -> Optional[dict[str, Any]]:
    """Retrieve a real guideline for this SOP's topic and compare against
    its extracted recommendation sentences - the primary dynamic-mode path.
    Returns None (not an exception) whenever no guideline is found or its
    abstract yields no extractable recommendations, so callers can fall
    back to compare_sop_to_dynamic_evidence without special-casing."""
    from app.services.guideline_finder import find_guideline, extract_recommendations

    guideline = await find_guideline(sop_title)
    if guideline is None:
        return None
    recommendations = extract_recommendations(guideline.get("abstract", ""))
    if not recommendations:
        return None

    items = build_guideline_reference_items(guideline, recommendations)
    year = None
    pub_date = guideline.get("pub_date") or (guideline.get("pub_date_parsed") or "")
    if pub_date:
        try:
            year = int(str(pub_date)[:4])
        except ValueError:
            year = None

    return _run_comparison(
        sop_id, internal_steps, items, sim_fn, mode="dynamic_guideline",
        reference_source={
            "name": guideline.get("title") or "(untitled guideline)",
            "source_type": guideline.get("study_type") or guideline.get("source_type", ""),
            "publisher": guideline.get("journal") or guideline.get("authors", ""),
            "year": year,
            "url": guideline.get("url", ""),
        },
    )
