"""
One-off diagnostic: does H4 actually test anything, or is it tautological?

The objection (raised in the audit): T3_renumbered is DEFINED by
item_align.py as "same guideline+section, byte-identical normalised text,
different marker path". So asking "are T3 items true correspondences?"
looks close to asking "is identical text in a matched guideline the same
item?" - which would be near-guaranteed, making H4's 97-100% precision
uninformative.

There are exactly two ways a T3 assignment can actually be WRONG, both
visible in item_align.align_items's own code path:

  1. BOILERPLATE COLLISION - the identical text occurs more than once in
     the candidate pool, so "the item with identical text" is ambiguous
     and align_items takes the first unconsumed one (`next((x for x in
     pool if _norm(x.text) == _norm(a.text)), None)`). If only one
     candidate ever exists, this failure mode is impossible.
  2. GUIDELINE MISMAPPING - the T3 search pool is scoped to
     (mapped_guideline, section). If match_guidelines mapped the old
     guideline to the WRONG new guideline, the whole pool is wrong. If
     every T3 item's guideline mapped to an identically-titled guideline,
     this failure mode is close to impossible.

This script measures how often each failure mode was POSSIBLE among the
T3 items that were actually sampled and annotated. If both are near zero,
H4 was tautological and must be demoted. If they are non-trivial, H4
tested something real and can be defended.

Reuses item_align's own functions unchanged (align_items, match_guidelines,
_norm) so the exposure is measured against exactly the code path H4
scored, not a reimplementation.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_h4_exposure
"""
from __future__ import annotations

import csv
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

import app.research.cross_edition.annotation_packets.run_h3_test as _rt  # noqa: E402
_rt.ANNOTATOR_FILES = {k: rf"C:\Users\Faisal\Desktop\research paper\Annotator_{k}.xlsx" for k in "ABCD"}
_rt.ADJUDICATION_FILE = r"C:\Users\Faisal\Desktop\research paper\Adjudication_43_items_completed.xlsx"

from app.research.cross_edition.item_align import align_items, _norm  # noqa: E402
from app.research.cross_edition.item_parser import parse  # noqa: E402
from app.research.cross_edition.annotation_packets.run_h3_test import (  # noqa: E402
    PAIRS, build_ground_truth,
)

BASE = Path(__file__).parent


def main():
    ground_truth = build_ground_truth()
    report = {"per_pair": {}, "pooled": {}}

    pooled_t3 = 0
    pooled_collision_possible = 0
    pooled_mismap_possible = 0
    pooled_either = 0
    pooled_scored = 0
    pooled_correct = 0
    examples = []

    for pair, (slug, old_pdf, new_pdf) in PAIRS.items():
        # Parse the OLD edition independently, BEFORE align_items mutates its
        # items in place (item_align.py line 148's loop rewrites .guideline
        # and .item_id to the new-edition vocabulary for every mapped item).
        # align_items iterates old_items in parse()-order and appends exactly
        # one _all_results row per old item in that same order, so a fresh,
        # unmutated parse() call zipped by index recovers the true PRE-mapping
        # guideline title for every result row.
        pristine_old_items = parse(old_pdf).items

        r = align_items(old_pdf, new_pdf)
        new_items = r["_new_items"]
        pristine_guideline_by_index = {i: it.guideline for i, it in enumerate(pristine_old_items)}

        # Candidate pools exactly as align_items builds them for the T3 step.
        new_by_sec: dict[tuple[str, str], list] = defaultdict(list)
        for it in new_items:
            new_by_sec[(_norm(it.guideline), it.section)].append(it)

        # Which sampled items were assigned T3, per the packet actually annotated
        with open(BASE / slug / "annotation_packet.csv", encoding="utf-8") as f:
            rows = [x for x in csv.DictReader(f) if x["tier"] == "T3_renumbered"]

        # Map sample rows back to their align_items result records AND to the
        # pristine pre-mapping guideline, by matching (old_item_id) - the
        # RESULT's stored item_id is post-mapping, so build the lookup on the
        # index position instead: _all_results[i] corresponds to
        # pristine_old_items[i] by construction (see comment above).
        by_old_id = {}
        for idx, rec in enumerate(r["_all_results"]):
            by_old_id[rec["old_item"].item_id] = (rec, pristine_guideline_by_index[idx])

        n_t3 = 0
        n_collision = 0
        n_mismap = 0
        n_either = 0
        n_scored = 0
        n_correct = 0

        for row in rows:
            sid = row["sample_id"]
            truth = ground_truth[pair].get(sid)
            n_t3 += 1

            hit = by_old_id.get(row["old_item_id"])
            if hit is None:
                continue
            rec, orig_guideline = hit
            a = rec["old_item"]

            # a.guideline has already been rewritten by align_items to the
            # MAPPED new-edition title; orig_guideline is the true pre-mapping
            # title recovered from the independent parse() call above.
            mapped_guideline = a.guideline
            mismap_possible = _norm(orig_guideline) != _norm(mapped_guideline)

            pool = new_by_sec.get((_norm(a.guideline), a.section), [])
            identical = [x for x in pool if _norm(x.text) == _norm(a.text)]
            collision_possible = len(identical) > 1

            if collision_possible:
                n_collision += 1
            if mismap_possible:
                n_mismap += 1
            if collision_possible or mismap_possible:
                n_either += 1
                if len(examples) < 12:
                    examples.append({
                        "pair": pair, "sample_id": sid,
                        "old_guideline": orig_guideline,
                        "mapped_guideline": mapped_guideline,
                        "n_identical_candidates": len(identical),
                        "collision_possible": collision_possible,
                        "mismap_possible": mismap_possible,
                    })

            if truth is not None and truth != "cannot_determine":
                n_scored += 1
                from app.research.cross_edition.annotation import _norm_answer
                if _norm_answer(row["method_predicted_item_id"]) == truth:
                    n_correct += 1

        report["per_pair"][pair] = {
            "n_t3_sampled": n_t3,
            "n_collision_possible": n_collision,
            "n_guideline_mismap_possible": n_mismap,
            "n_either_failure_mode_possible": n_either,
            "n_scored": n_scored, "n_correct": n_correct,
        }
        print(f"{pair}:")
        print(f"  T3 sampled: {n_t3}   scored: {n_scored}  correct: {n_correct}")
        print(f"  boilerplate-collision possible: {n_collision}")
        print(f"  guideline-mismap possible:      {n_mismap}")
        print(f"  either failure mode possible:   {n_either}")

        pooled_t3 += n_t3
        pooled_collision_possible += n_collision
        pooled_mismap_possible += n_mismap
        pooled_either += n_either
        pooled_scored += n_scored
        pooled_correct += n_correct

    report["pooled"] = {
        "n_t3_sampled": pooled_t3,
        "n_collision_possible": pooled_collision_possible,
        "n_guideline_mismap_possible": pooled_mismap_possible,
        "n_either_failure_mode_possible": pooled_either,
        "pct_either_possible": round(100 * pooled_either / max(1, pooled_t3), 1),
        "n_scored": pooled_scored, "n_correct": pooled_correct,
        "t3_precision": round(pooled_correct / max(1, pooled_scored), 4),
    }
    report["examples"] = examples

    print("\n=== POOLED ===")
    print(f"T3 sampled: {pooled_t3}   scored: {pooled_scored}  precision: "
          f"{pooled_correct}/{pooled_scored} = {pooled_correct/max(1,pooled_scored):.4f}")
    print(f"boilerplate-collision possible: {pooled_collision_possible}")
    print(f"guideline-mismap possible:      {pooled_mismap_possible}")
    print(f"EITHER failure mode possible:   {pooled_either}/{pooled_t3} "
          f"({100*pooled_either/max(1,pooled_t3):.1f}%)")
    print("\nInterpretation: if 'either possible' is near 0%, H4 was tautological.")

    out = BASE / "h4_exposure_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
