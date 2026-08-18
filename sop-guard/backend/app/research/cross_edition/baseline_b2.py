"""
Baseline B2: text-only correspondence matching, no structural information.

Tests H3 (PREREGISTRATION.md section 7): "The method's correspondence
accuracy exceeds B2's (text-only)."

Design: B2 uses the IDENTICAL text-similarity function the real method
already uses for its own T4 "reworded" fallback - item_align._sim
(token-level Jaccard) and item_align._SIM_FLOOR (0.75) - imported and
used completely unchanged. The only difference from the real method is
scope: B2 searches every item in the WHOLE new-edition document as a
candidate for every old item, with no guideline/section restriction and
no identifier lookup. This isolates exactly the variable H3 asks about -
does knowing which guideline structurally corresponds to which help
beyond finding the most textually similar item anywhere in the new
document? - by holding the similarity metric, the floor, and the greedy
one-to-one consumption rule fixed, and varying only whether the
candidate pool is structurally scoped or global.

Does not modify corpus_probe.py, item_parser.py, or item_align.py - the
three files PREREGISTRATION.md pins as the frozen pipeline. Only reuses
item_align._sim and item_align._SIM_FLOOR as black-box functions.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.baseline_b2 old.pdf new.pdf
"""
from __future__ import annotations

import sys

from app.research.cross_edition.item_parser import parse
from app.research.cross_edition.item_align import _sim, _SIM_FLOOR


def align_items_b2(old_pdf: str, new_pdf: str) -> dict:
    """B2's full alignment over an edition pair - one row per OLD item,
    in document order, exactly like item_align.align_items's
    _all_results, so it can be filtered down to a specific sample the
    same way."""
    old_ed, new_ed = parse(old_pdf), parse(new_pdf)
    old_items, new_items = old_ed.items, new_ed.items

    consumed: set[str] = set()
    all_results: list[dict] = []

    for a in old_items:
        pool = [x for x in new_items if x.item_id not in consumed]
        best, best_s = None, 0.0
        for x in pool:
            s = _sim(a.text, x.text)
            if s > best_s:
                best, best_s = x, s
        matched = best is not None and best_s >= _SIM_FLOOR
        if matched:
            consumed.add(best.item_id)
        all_results.append({
            "old_item_id": a.item_id,
            "b2_predicted_item_id": best.item_id if matched else "NONE",
            "b2_similarity": round(best_s, 4),
        })

    return {
        "old_items": len(old_items), "new_items": len(new_items),
        "_all_results": all_results,
    }


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    r = align_items_b2(argv[1], argv[2])
    matched = sum(1 for x in r["_all_results"] if x["b2_predicted_item_id"] != "NONE")
    print(f"old_items: {r['old_items']}  new_items: {r['new_items']}")
    print(f"B2 matched: {matched}/{r['old_items']} "
          f"({100*matched/max(1, r['old_items']):.1f}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
