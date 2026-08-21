"""
Fixed method (v2): repairs the T2 identifier-trust failure mode diagnosed
in FEASIBILITY.md section 54 for bullet/sub-bullet marker items.

BACKGROUND (already established and published, not re-derived here)
---------------------------------------------------------------------
item_align.py's T2 tier accepts an identifier match ("same guideline/
section/marker_path") as a correct correspondence whenever marker_path is
identical, regardless of how different the text is. That is safe for
markers carrying a true ordinal (numeric/alpha/roman/paren/dotted), which
item_parser.py assigns from the document's own explicit numbering. It is
NOT safe for bullet and sub-bullet markers (item_parser.py lines 86-93),
which item_parser.py itself numbers purely by POSITION within their
level - "Bullets carry no ordinal, so siblings are counted by position."
Insert one item into a bulleted list and every later sibling's
position-derived marker shifts, so "same marker_path" stops meaning "same
conceptual item" for this marker kind specifically. FEASIBILITY.md
section 54 found this fully explains the method's item-level disadvantage
against baseline B2 on the original test set: on ordinal-marker items the
method already wins (76.64% vs 71.53%); on bullet-marker items it loses
badly (72.22% vs 94.44%), concentrated in T2 (40.00% vs 90.00%) and T6
(41.67% vs 91.67% - the method manufactures false "deleted" calls there).

THE FIX
-------
Scoped narrowly to the diagnosed mechanism, nothing else: for bullet/
sub-bullet marker old items ONLY, an identifier match is no longer
accepted on its own. It must also clear the SAME similarity floor
(item_align._SIM_FLOOR = 0.75) item_align.py already uses everywhere else
to decide "reworded, same item" versus "different item" - not a new
number invented to flatter this test, the exact already-frozen threshold
applied at one more decision point. If it fails that check, the
identifier is treated as coincidence, not a match: the item falls through
to the identical guideline/section-scoped search item_align.py already
performs for T3/T4/T5. Tier labels (T1-T6) are unchanged from item_align.py
so results stay directly comparable; a separate boolean
`fix_overrode_id_match` marks which items the fix actually touched.

Deliberately NOT changed: ordinal-marker items - the majority, and the
population where the original method already beats B2 - go through
IDENTICAL, untouched logic. No similarity check is added for them.

Deliberately NOT addressed: T6's guideline-mis-mapping mechanism,
flagged in FEASIBILITY.md section 54 as a distinct, not-yet-diagnosed
phenomenon. This fix targets T2's id-trust mechanism only, not a general
"search harder" change. Any T6 items it rescues as a side effect (because
a rejected T2 candidate now goes through the same guideline-scoped T3/T4/T5
search) are a secondary, reported-but-not-targeted outcome, not a claim
that T6's cascade failure is fixed.

Does not modify item_align.py, item_parser.py, corpus_probe.py, or
edition_align.py - imports and reuses their functions completely
unchanged (match_guidelines, _norm, _sim, _SIM_FLOOR).

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.item_align_v2 old.pdf new.pdf
"""
from __future__ import annotations

import sys
from collections import defaultdict

from app.research.cross_edition.item_parser import parse, Item
from app.research.cross_edition.edition_align import _norm_title
from app.research.cross_edition.item_align import (
    match_guidelines, _norm, _sim, _SIM_FLOOR,
)

# Identical classification to annotation_packets/diagnose_t2_mechanism.py.
_BULLET_GLYPHS = {"�", "•", "▪", "●", "-"}


def _is_bullet_kind(marker_path: str) -> bool:
    """Bullet/sub-bullet markers carry no true ordinal (item_parser.py
    lines 86-93) and are numbered by position - exactly the property that
    makes an identifier match untrustworthy on its own for this kind."""
    if not marker_path:
        return False
    last = marker_path.split(".")[-1].split("#")[0]
    return last in _BULLET_GLYPHS or last == "o"


def align_items_v2(old_pdf: str, new_pdf: str) -> dict:
    old_ed, new_ed = parse(old_pdf), parse(new_pdf)
    old_items, new_items = old_ed.items, new_ed.items

    # Guideline resolution and id-rewrite: identical to item_align.align_items.
    gmap = match_guidelines(
        sorted({i.guideline for i in old_items}),
        sorted({i.guideline for i in new_items}),
    )
    for it in old_items:
        mapped = gmap.get(it.guideline)
        if mapped and mapped != it.guideline:
            suffix = ""
            if "#" in it.item_id:
                suffix = "#" + it.item_id.rsplit("#", 1)[1]
            it.item_id = f"{_norm_title(mapped)}/{it.section}/{it.marker_path}{suffix}"
            it.guideline = mapped

    new_by_id = {i.item_id: i for i in new_items}
    new_by_sec: dict[tuple[str, str], list[Item]] = defaultdict(list)
    for i in new_items:
        new_by_sec[(_norm(i.guideline), i.section)].append(i)
    new_by_text: dict[str, list[Item]] = defaultdict(list)
    for i in new_items:
        new_by_text[_norm(i.text)].append(i)

    tiers = defaultdict(int)
    unmatched_old: list[Item] = []
    consumed: set[str] = set()
    all_results: list[dict] = []
    bullet_stats = {"total_bullet_old_items": 0, "id_rejected": 0,
                     "rejected_landed": defaultdict(int)}

    def note(tier: str, a: Item, b: Item | None, similarity: float = 1.0,
              fix_overrode: bool = False):
        tiers[tier] += 1
        all_results.append({
            "tier": tier, "old_item_id": a.item_id,
            "predicted_item_id": b.item_id if b else "NONE",
            "similarity": round(similarity, 4),
            "fix_overrode_id_match": fix_overrode,
        })

    for a in old_items:
        if _is_bullet_kind(a.marker_path):
            bullet_stats["total_bullet_old_items"] += 1

        b = new_by_id.get(a.item_id)
        id_available = b is not None and b.item_id not in consumed
        id_text_matches = id_available and _norm(a.text) == _norm(b.text)

        if id_available and id_text_matches:
            consumed.add(b.item_id)
            note("T1_id_exact", a, b)
            continue

        fix_overrode = False
        if id_available and not id_text_matches:
            # THE FIX: bullet/sub-bullet markers must also clear the
            # similarity floor before the identifier match is trusted.
            # Ordinal markers are untouched - accept exactly as before.
            if not _is_bullet_kind(a.marker_path) or _sim(a.text, b.text) >= _SIM_FLOOR:
                consumed.add(b.item_id)
                note("T2_id_text_changed", a, b, _sim(a.text, b.text))
                continue
            fix_overrode = True
            bullet_stats["id_rejected"] += 1
            # b stays unconsumed - the id match is rejected as coincidental,
            # not withdrawn from the pool other old items may still use.

        key = (_norm(a.guideline), a.section)
        pool = [x for x in new_by_sec.get(key, []) if x.item_id not in consumed]

        exact = next((x for x in pool if _norm(x.text) == _norm(a.text)), None)
        if exact is not None:
            consumed.add(exact.item_id)
            note("T3_renumbered", a, exact, fix_overrode=fix_overrode)
            if fix_overrode:
                bullet_stats["rejected_landed"]["T3_renumbered"] += 1
            continue

        best, best_s = None, 0.0
        for x in pool:
            s = _sim(a.text, x.text)
            if s > best_s:
                best, best_s = x, s
        if best is not None and best_s >= _SIM_FLOOR:
            consumed.add(best.item_id)
            note("T4_reworded", a, best, best_s, fix_overrode=fix_overrode)
            if fix_overrode:
                bullet_stats["rejected_landed"]["T4_reworded"] += 1
            continue

        moved = next((x for x in new_by_text.get(_norm(a.text), [])
                      if x.item_id not in consumed), None)
        if moved is not None and len(_norm(a.text)) > 25:
            consumed.add(moved.item_id)
            note("T5_moved", a, moved, 1.0, fix_overrode=fix_overrode)
            if fix_overrode:
                bullet_stats["rejected_landed"]["T5_moved"] += 1
            continue

        note("T6_unmatched_old", a, None, fix_overrode=fix_overrode)
        if fix_overrode:
            bullet_stats["rejected_landed"]["T6_unmatched_old"] += 1
        unmatched_old.append(a)

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
        "bullet_stats": {
            "total_bullet_old_items": bullet_stats["total_bullet_old_items"],
            "id_rejected": bullet_stats["id_rejected"],
            "rejected_landed": dict(bullet_stats["rejected_landed"]),
        },
        "_all_results": all_results,
        "_unmatched_items": unmatched_old,
        "_consumed_ids": consumed,
        "_guideline_map": gmap,
        "_new_items": new_items,
    }


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    r = align_items_v2(argv[1], argv[2])
    order = ["T1_id_exact", "T2_id_text_changed", "T3_renumbered",
              "T4_reworded", "T5_moved", "T6_unmatched_old"]
    print("=" * 74)
    print("ITEM-LEVEL CROSS-EDITION ALIGNMENT (v2: bullet id-trust fix)")
    print("=" * 74)
    print(f"  old items: {r['old_items']:,}   new items: {r['new_items']:,}\n")
    for t in order:
        n = r["tiers"].get(t, 0)
        pct = 100 * n / max(1, r["old_items"])
        print(f"  {t:<22}{n:>6}  {pct:>5.1f}%")
    print(f"\n  bullet old items       : {r['bullet_stats']['total_bullet_old_items']}")
    print(f"  bullet id-matches rejected by the fix: {r['bullet_stats']['id_rejected']}")
    print(f"  where rejected items landed instead  : {r['bullet_stats']['rejected_landed']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
