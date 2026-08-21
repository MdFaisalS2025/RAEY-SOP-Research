"""
Decompose the unmatched tail: genuine deletion, or recoverable failure?

WHY
---
`item_align` reports 16.2% of items unmatched on the major NASEMSO pair
(4.5% on the minor one). That number is currently uninterpretable, and
reporting it as "deleted" would overstate deletion — some of it is certainly
matching failure. Until it is decomposed, the study's headline
("10.9% require more than an identifier") is unstable, because any item
recovered from the tail moves into a matched tier and changes the split.

This matters before corpus retrieval, not after: annotating six edition pairs
against an unstable denominator wastes the annotation budget.

THE DECOMPOSITION
-----------------
Each unmatched old item is assigned exactly one cause, checked in order:

  U1 guideline_unmatched   its guideline has no counterpart in the new
                           edition, so no item under it could match. A
                           PARSER/matching problem, not a deletion.
  U2 section_absent        guideline matched, but that section does not exist
                           in the new edition. Ambiguous: a section can be
                           genuinely dropped, or renamed, or mis-parsed.
  U3 near_miss             a candidate in the same section scores between
                           `_NEAR` and the T4 floor. RECOVERABLE - these are
                           rewordings that fell just below the acceptance
                           threshold.
  U4 consumed_rival        the best candidate corpus-wide scores above the T4
                           floor but was already claimed by another old item.
                           A greedy-matching collision, RECOVERABLE with
                           global assignment instead of first-come-first-served.
  U5 no_candidate          nothing in the new edition scores above `_NEAR`.
                           This is the honest deletion estimate.

U1+U2 are method/parsing debt. U3+U4 are recoverable with better matching.
Only U5 is a defensible deletion claim.

STATUS: exploratory, dev-only. Research prototype. Not for clinical use.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.unmatched_probe old.pdf new.pdf
"""

from __future__ import annotations

import sys
from collections import Counter, defaultdict

from app.research.cross_edition.item_align import (
    align_items, _norm, _sim, _SIM_FLOOR,
)

# Below this, two items are not plausibly the same recommendation at all.
# Above it but below _SIM_FLOOR is the "near miss" band the T4 gate rejects.
_NEAR = 0.40


def decompose(old_pdf: str, new_pdf: str) -> dict:
    r = align_items(old_pdf, new_pdf)
    unmatched = r["_unmatched_items"]
    consumed = r["_consumed_ids"]
    gmap = r["_guideline_map"]
    new_items = r["_new_items"]

    new_by_sec: dict[tuple[str, str], list] = defaultdict(list)
    for i in new_items:
        new_by_sec[(_norm(i.guideline), i.section)].append(i)
    new_guidelines = {_norm(i.guideline) for i in new_items}

    causes = Counter()
    examples: dict[str, list] = defaultdict(list)
    recoverable_pairs: list[tuple[str, str, float]] = []

    for a in unmatched:
        gkey = _norm(a.guideline)

        # U1 - the guideline itself never matched
        if gkey not in new_guidelines and a.guideline not in gmap:
            causes["U1_guideline_unmatched"] += 1
            _ex(examples, "U1_guideline_unmatched", a, "-", 0.0)
            continue

        pool = new_by_sec.get((gkey, a.section), [])

        # U2 - guideline present, section absent
        if not pool:
            causes["U2_section_absent"] += 1
            _ex(examples, "U2_section_absent", a, "-", 0.0)
            continue

        # Mirror align_items: it only ever considered UNCONSUMED
        # candidates. Scoring against all of them here made U3 absorb
        # collision cases that belong in U4, and let pairs above the
        # T4 floor appear as 'near misses' when they had in fact been
        # blocked rather than rejected.
        avail = [x for x in pool if x.item_id not in consumed]
        best_local, s_local = _best(a, avail)

        # U3 - near miss inside the right section
        if s_local >= _NEAR:
            causes["U3_near_miss"] += 1
            _ex(examples, "U3_near_miss", a, best_local.item_id, s_local)
            recoverable_pairs.append((a.item_id, best_local.item_id, s_local))
            continue

        # U4 - a strong candidate exists corpus-wide but was already claimed
        best_any, s_any = _best(a, new_items)
        if s_any >= _SIM_FLOOR and best_any.item_id in consumed:
            causes["U4_consumed_rival"] += 1
            _ex(examples, "U4_consumed_rival", a, best_any.item_id, s_any)
            recoverable_pairs.append((a.item_id, best_any.item_id, s_any))
            continue

        # A plausible counterpart elsewhere in the corpus, too weak for the
        # T4 floor and outside the item's own section, is "moved and
        # reworded" - not deletion. Counting it as deletion (as the first
        # version did) inflated the deletion estimate: one such item scored
        # 0.688 corpus-wide and was still reported as deleted.
        if s_any >= _NEAR:
            causes["U6_weak_distant_match"] += 1
            _ex(examples, "U6_weak_distant_match", a, best_any.item_id, s_any)
            continue

        causes["U5_no_candidate"] += 1
        _ex(examples, "U5_no_candidate", a, "-", s_any)

    n = len(unmatched)
    recoverable = causes["U3_near_miss"] + causes["U4_consumed_rival"]
    uncertain = causes["U6_weak_distant_match"]
    debt = causes["U1_guideline_unmatched"] + causes["U2_section_absent"]
    return {
        "old_items": r["old_items"],
        "unmatched": n,
        "unmatched_pct_of_old": round(100 * n / max(1, r["old_items"]), 1),
        "causes": dict(causes),
        "recoverable": recoverable,
        "uncertain": uncertain,
        "method_debt": debt,
        "defensible_deletion": causes["U5_no_candidate"],
        "defensible_deletion_pct_of_old": round(
            100 * causes["U5_no_candidate"] / max(1, r["old_items"]), 1),
        "examples": {k: v for k, v in examples.items()},
        "recoverable_pairs": recoverable_pairs[:200],
    }


def _best(a, pool):
    best, score = None, 0.0
    for x in pool:
        s = _sim(a.text, x.text)
        if s > score:
            best, score = x, s
    return best, score


def _ex(store, key, a, other, score):
    if len(store[key]) < 3:
        store[key].append({"old": a.item_id[:52], "new": other[:52],
                           "sim": round(score, 3), "text": a.text[:70]})


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    d = decompose(argv[1], argv[2])
    order = ["U1_guideline_unmatched", "U2_section_absent", "U3_near_miss",
             "U4_consumed_rival", "U6_weak_distant_match", "U5_no_candidate"]
    print("=" * 74)
    print("UNMATCHED TAIL DECOMPOSITION   [exploratory]")
    print("=" * 74)
    print(f"  old items {d['old_items']:,}   unmatched {d['unmatched']:,} "
          f"({d['unmatched_pct_of_old']}% of old)\n")
    for c in order:
        k = d["causes"].get(c, 0)
        pct_tail = 100 * k / max(1, d["unmatched"])
        print(f"  {c:<26}{k:>6}  {pct_tail:>5.1f}% of tail  {'#' * int(pct_tail / 3)}")
    print()
    print(f"  method/parsing debt (U1+U2) : {d['method_debt']:>6}")
    print(f"  RECOVERABLE (U3+U4)         : {d['recoverable']:>6}")
    print(f"  uncertain (U6)              : {d['uncertain']:>6}"
          f"   plausible distant match, below the T4 floor")
    print(f"  defensible deletion (U5)    : {d['defensible_deletion']:>6}"
          f"   = {d['defensible_deletion_pct_of_old']}% of old items")
    print("\n  --- examples ---")
    for c in order:
        for e in d["examples"].get(c, [])[:2]:
            print(f"   {c:<26} sim={e['sim']:<6} {e['old'][:40]}")
            print(f"        -> {e['new'][:44]}   | {e['text'][:44]}")
    print("\n  READING")
    print("  " + "-" * 70)
    print(f"  Only U5 supports a deletion claim. The tail's headline"
          f" {d['unmatched_pct_of_old']}% of old")
    print(f"  items falls to {d['defensible_deletion_pct_of_old']}% once"
          f" recoverable failures and parsing debt")
    print("  are separated out. U3+U4 would move INTO matched tiers under better")
    print("  matching, which would raise the 'requires more than an identifier'")
    print("  figure rather than lower it.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
