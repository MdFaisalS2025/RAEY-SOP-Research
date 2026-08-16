"""
Item-level cross-edition alignment: the study's decision experiment.

WHY THIS DECIDES WHETHER THERE IS A PAPER
-----------------------------------------
`edition_align.py` matched 87% of guidelines across editions using nothing more
than an exact normalised-title match. That is a trivially simple method, and if
the same holds at item level - if most recommendations keep their
guideline/section/marker path across editions - then cross-edition provenance
is a solved problem needing only a dictionary lookup, and this work is a corpus
contribution rather than a method contribution.

So the question this module answers is deliberately hostile to the paper:

    What fraction of items align trivially, and what fraction require
    something harder than an identifier match?

The tiering below is designed so the answer cannot be flattered. Tier 1 is the
free case. Every later tier is work the trivial method cannot do.

  T1  id_exact        same guideline / section / marker path, text unchanged.
                      Free. A dictionary lookup finds these.
  T2  id_text_changed same path, text reworded. Free to FIND, but the change
                      itself is the study's object of interest.
  T3  renumbered      same guideline+section, text identical, different marker
                      path. The trivial method MISSES these entirely and
                      reports them as delete+add.
  T4  reworded        same guideline+section, no id match, high text
                      similarity. Requires similarity matching.
  T5  moved           matched on text across a DIFFERENT section or guideline.
  T6  unmatched       no counterpart found - genuine deletion (old) or
                      insertion (new), or a matching failure. These are
                      indistinguishable without annotation, which is precisely
                      why FEASIBILITY §3.2's free-label hope mattered and why
                      its loss is expensive.

READING THE RESULT
------------------
  T1+T2 dominant, T3-T5 negligible  -> no method contribution. Publish the
                                       corpus as a resource paper and stop.
  T3-T5 substantial                 -> the trivial method fails on a real
                                       fraction, and there is a method paper.

STATUS: exploratory. No pre-registration covers the cross-edition study.
Research prototype. Not for clinical use.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.item_align old.pdf new.pdf
"""

from __future__ import annotations

import re
import sys
from collections import defaultdict

from app.research.cross_edition.item_parser import parse, Item

# Text-similarity floor for calling two items "the same recommendation,
# reworded". Deliberately high: this probe should under-claim matches rather
# than inflate the interesting tiers, since inflating them flatters the paper.
_SIM_FLOOR = 0.75


def _norm(t: str) -> str:
    t = re.sub(r"\s+", " ", t).strip().lower()
    return re.sub(r"[^a-z0-9 ]", "", t)


def _sim(a: str, b: str) -> float:
    """Token-level Jaccard. Cheap, order-insensitive, and adequate for
    deciding whether two items are the same recommendation. Deliberately not
    an embedding: this probe should not depend on the embedding backend, and
    a lexical floor is the conservative choice."""
    ta, tb = set(_norm(a).split()), set(_norm(b).split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def align_items(old_pdf: str, new_pdf: str) -> dict:
    old_ed, new_ed = parse(old_pdf), parse(new_pdf)
    old_items, new_items = old_ed.items, new_ed.items

    new_by_id = {i.item_id: i for i in new_items}
    # Bucket by (guideline, section) so renumber/reword search stays local.
    new_by_sec: dict[tuple[str, str], list[Item]] = defaultdict(list)
    for i in new_items:
        new_by_sec[(_norm(i.guideline), i.section)].append(i)
    new_by_text: dict[str, list[Item]] = defaultdict(list)
    for i in new_items:
        new_by_text[_norm(i.text)].append(i)

    tiers = defaultdict(int)
    consumed: set[str] = set()
    examples: dict[str, list[tuple[str, str]]] = defaultdict(list)

    def note(tier: str, a: Item, b: Item | None):
        tiers[tier] += 1
        if len(examples[tier]) < 3:
            examples[tier].append(
                (f"{a.item_id}", f"{b.item_id}" if b else "-")
            )

    for a in old_items:
        # T1 / T2 - identifier survives
        b = new_by_id.get(a.item_id)
        if b is not None and b.item_id not in consumed:
            consumed.add(b.item_id)
            note("T1_id_exact" if _norm(a.text) == _norm(b.text)
                 else "T2_id_text_changed", a, b)
            continue

        key = (_norm(a.guideline), a.section)
        pool = [x for x in new_by_sec.get(key, []) if x.item_id not in consumed]

        # T3 - identical text, different marker path (renumbered)
        exact = next((x for x in pool if _norm(x.text) == _norm(a.text)), None)
        if exact is not None:
            consumed.add(exact.item_id)
            note("T3_renumbered", a, exact)
            continue

        # T4 - same section, reworded
        best, best_s = None, 0.0
        for x in pool:
            s = _sim(a.text, x.text)
            if s > best_s:
                best, best_s = x, s
        if best is not None and best_s >= _SIM_FLOOR:
            consumed.add(best.item_id)
            note("T4_reworded", a, best)
            continue

        # T5 - same text, different section or guideline (moved)
        moved = next((x for x in new_by_text.get(_norm(a.text), [])
                      if x.item_id not in consumed), None)
        if moved is not None and len(_norm(a.text)) > 25:
            consumed.add(moved.item_id)
            note("T5_moved", a, moved)
            continue

        note("T6_unmatched_old", a, None)

    added = [i for i in new_items if i.item_id not in consumed]
    total_old = len(old_items)
    trivial = tiers["T1_id_exact"] + tiers["T2_id_text_changed"]
    hard = tiers["T3_renumbered"] + tiers["T4_reworded"] + tiers["T5_moved"]

    return {
        "old_items": total_old, "new_items": len(new_items),
        "tiers": dict(tiers),
        "added_new_items": len(added),
        "trivially_alignable": trivial,
        "trivially_alignable_pct": round(100 * trivial / max(1, total_old), 1),
        "requires_more_than_id": hard,
        "requires_more_than_id_pct": round(100 * hard / max(1, total_old), 1),
        "unmatched_pct": round(100 * tiers["T6_unmatched_old"] / max(1, total_old), 1),
        "examples": {k: v for k, v in examples.items()},
    }


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    r = align_items(argv[1], argv[2])
    order = ["T1_id_exact", "T2_id_text_changed", "T3_renumbered",
             "T4_reworded", "T5_moved", "T6_unmatched_old"]
    print("=" * 74)
    print("ITEM-LEVEL CROSS-EDITION ALIGNMENT   [exploratory]")
    print("=" * 74)
    print(f"  old items: {r['old_items']:,}   new items: {r['new_items']:,}"
          f"   new-only: {r['added_new_items']:,}\n")
    for t in order:
        n = r["tiers"].get(t, 0)
        pct = 100 * n / max(1, r["old_items"])
        bar = "#" * int(pct / 2)
        print(f"  {t:<22}{n:>6}  {pct:>5.1f}%  {bar}")
    print()
    print(f"  trivially alignable (T1+T2) : {r['trivially_alignable']:>6}  "
          f"{r['trivially_alignable_pct']}%")
    print(f"  needs more than an id (T3-5): {r['requires_more_than_id']:>6}  "
          f"{r['requires_more_than_id_pct']}%")
    print(f"  unmatched (T6)              : {r['tiers'].get('T6_unmatched_old',0):>6}  "
          f"{r['unmatched_pct']}%")
    print("\n  --- examples ---")
    for t in order:
        for a, b in r["examples"].get(t, [])[:2]:
            print(f"   {t:<22} {a[:44]:<46} -> {b[:40]}")
    print("\n  VERDICT")
    print("  " + "-" * 70)
    if r["requires_more_than_id_pct"] < 5:
        print("  Item identifiers survive almost everywhere. A dictionary lookup")
        print("  solves this. NO METHOD CONTRIBUTION - publish the corpus as a")
        print("  resource paper and stop.")
    elif r["requires_more_than_id_pct"] < 15:
        print("  A modest fraction needs more than an id match. Borderline:")
        print("  strongest as a resource paper with a method section.")
    else:
        print("  A substantial fraction of items CANNOT be aligned by identifier.")
        print("  The trivial method reports these as delete+add, losing the")
        print("  provenance link. That is a real method contribution.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
