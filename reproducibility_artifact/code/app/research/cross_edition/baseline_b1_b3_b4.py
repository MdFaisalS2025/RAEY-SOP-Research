"""
Baselines B1, B3, B4 (PREREGISTRATION.md section 4.2). B2 (text-only
nearest-neighbour) already exists in baseline_b2.py; this file completes
the four-baseline table.

None of these modify corpus_probe.py, item_parser.py, edition_align.py,
or item_align.py - the four files PREREGISTRATION.md pins as the frozen
pipeline (section 4.3). B4 reuses item_align.match_guidelines and
item_align._norm as black-box functions, unchanged, the same discipline
baseline_b2.py already used for _sim/_SIM_FLOOR.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.baseline_b1_b3_b4 old.pdf new.pdf
"""
from __future__ import annotations

import difflib
import sys

from app.research.cross_edition.item_parser import parse
from app.research.cross_edition.item_align import match_guidelines, _norm


# ---------------------------------------------------------------------------
# B1 - exact identifier lookup
# ---------------------------------------------------------------------------
def align_items_b1(old_pdf: str, new_pdf: str) -> dict:
    """Match iff guideline/section/marker_path (Item.item_id) is identical
    in the new edition, else NONE. The baseline H1, H2 and H5 are all
    defined against (section 4.2, 7). No fuzzy matching, no guideline
    remapping - a pure dict lookup on the identifier as constructed by
    item_parser.py, which is exactly what a practitioner reaching for "just
    use the ID" would build."""
    old_ed, new_ed = parse(old_pdf), parse(new_pdf)
    new_by_id = {x.item_id: x for x in new_ed.items}

    all_results: list[dict] = []
    for a in old_ed.items:
        hit = new_by_id.get(a.item_id)
        all_results.append({
            "old_item_id": a.item_id,
            "b1_predicted_item_id": hit.item_id if hit is not None else "NONE",
        })
    return {
        "old_items": len(old_ed.items), "new_items": len(new_ed.items),
        "_all_results": all_results,
    }


# ---------------------------------------------------------------------------
# B4 - identifier lookup, then exact-text fallback within the matched
# guideline
# ---------------------------------------------------------------------------
def align_items_b4(old_pdf: str, new_pdf: str) -> dict:
    """B1 first; on miss, exact normalised-text match restricted to the new
    guideline that item_align.match_guidelines (unchanged, floor 0.5,
    containment-biased token overlap) maps the old item's guideline to.
    Isolates the value of the *fuzzy* tiers specifically (T3-T6) by giving
    a baseline every structural advantage except fuzzy text similarity."""
    old_ed, new_ed = parse(old_pdf), parse(new_pdf)
    new_by_id = {x.item_id: x for x in new_ed.items}

    gmap = match_guidelines(old_ed.guidelines, new_ed.guidelines)

    new_by_guideline: dict[str, list] = {}
    for x in new_ed.items:
        new_by_guideline.setdefault(x.guideline, []).append(x)

    consumed: set[str] = set()
    all_results: list[dict] = []
    for a in old_ed.items:
        # Step 1: exact identifier lookup (B1's rule).
        hit = new_by_id.get(a.item_id)
        if hit is not None and hit.item_id not in consumed:
            consumed.add(hit.item_id)
            all_results.append({
                "old_item_id": a.item_id,
                "b4_predicted_item_id": hit.item_id,
                "b4_step": "id_exact",
            })
            continue

        # Step 2: exact-text match within the guideline B1 fell through on,
        # scoped by the frozen guideline mapping.
        new_guideline = gmap.get(a.guideline)
        pool = new_by_guideline.get(new_guideline, []) if new_guideline else []
        a_norm = _norm(a.text)
        match = None
        if a_norm:
            for x in pool:
                if x.item_id in consumed:
                    continue
                if _norm(x.text) == a_norm:
                    match = x
                    break

        if match is not None:
            consumed.add(match.item_id)
            all_results.append({
                "old_item_id": a.item_id,
                "b4_predicted_item_id": match.item_id,
                "b4_step": "text_exact_in_guideline",
            })
        else:
            all_results.append({
                "old_item_id": a.item_id,
                "b4_predicted_item_id": "NONE",
                "b4_step": "unmatched",
            })

    return {
        "old_items": len(old_ed.items), "new_items": len(new_ed.items),
        "_all_results": all_results,
    }


# ---------------------------------------------------------------------------
# B3 - difflib document diff
# ---------------------------------------------------------------------------
def align_items_b3(old_pdf: str, new_pdf: str) -> dict:
    """Sequence-align the two editions' canonical_text line-by-line with
    difflib.SequenceMatcher (the off-the-shelf answer a practitioner would
    reach for first, per section 4.2), then map each old item's own
    character span to whichever new item's span best overlaps the
    destination that span maps to under the resulting opcodes.

    Line-level, not char-level, for tractability at ~1500 items/document -
    difflib on ~400KB of raw character sequence is impractically slow;
    lines are the natural unit for a line-stream parser's own output
    (item_parser.py's docstring: "a normalised line stream"), and canonical
    line boundaries already exist in canonical_text.

    KNOWN RISK, stated before running rather than discovered after
    (PREREGISTRATION.md Appendix B item 4): item offsets carry an
    uninvestigated 3-4% mismatch tail against canonical_text. B3 is the
    only baseline that depends on offsets, so this tail lands on it
    directly and is measured and reported here as
    "offset_resolution_failures" - not silently dropped, and the frozen
    parser is not touched to repair it."""
    old_ed, new_ed = parse(old_pdf), parse(new_pdf)

    old_lines = old_ed.canonical_text.split("\n")
    new_lines = new_ed.canonical_text.split("\n")

    # Char offset -> line index, for both documents (canonical_text is
    # newline-joined, so offsets map directly).
    def line_starts(lines: list[str]) -> list[int]:
        starts = [0]
        for ln in lines:
            starts.append(starts[-1] + len(ln) + 1)  # +1 for the "\n"
        return starts

    old_starts = line_starts(old_lines)
    new_starts = line_starts(new_lines)

    def char_to_line(offset: int, starts: list[int]) -> int:
        # starts is sorted; find last start <= offset.
        lo, hi = 0, len(starts) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if starts[mid] <= offset:
                lo = mid
            else:
                hi = mid - 1
        return lo

    sm = difflib.SequenceMatcher(a=old_lines, b=new_lines, autojunk=False)
    opcodes = sm.get_opcodes()

    # Build an old-line -> new-line mapping from the opcodes: for "equal"
    # and "replace" blocks, map proportionally; "delete" blocks map to
    # nothing.
    old_to_new_line: dict[int, int] = {}
    for tag, i1, i2, j1, j2 in opcodes:
        if tag == "delete":
            continue
        old_span = i2 - i1
        new_span = j2 - j1
        if old_span == 0:
            continue
        for k in range(old_span):
            old_line = i1 + k
            frac = k / old_span
            new_line = j1 + int(frac * max(new_span, 1))
            new_line = min(new_line, j2 - 1) if new_span > 0 else j1
            old_to_new_line[old_line] = new_line

    # For each new item, know which line its span starts on, so a mapped
    # line can be resolved to the covering/nearest new item.
    new_items_by_line: dict[int, list] = {}
    for x in new_ed.items:
        ln = char_to_line(x.char_start, new_starts)
        new_items_by_line.setdefault(ln, []).append(x)
    new_item_lines = sorted(new_items_by_line)

    def nearest_new_item(target_line: int):
        if not new_item_lines:
            return None
        lo, hi = 0, len(new_item_lines) - 1
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if new_item_lines[mid] <= target_line:
                lo = mid
            else:
                hi = mid - 1
        return new_items_by_line[new_item_lines[lo]][0]

    consumed: set[str] = set()
    all_results: list[dict] = []
    offset_resolution_failures = 0

    for a in old_ed.items:
        old_line = char_to_line(a.char_start, old_starts)
        mapped_line = old_to_new_line.get(old_line)
        if mapped_line is None:
            offset_resolution_failures += 1
            all_results.append({
                "old_item_id": a.item_id,
                "b3_predicted_item_id": "NONE",
                "b3_offset_resolved": False,
            })
            continue

        cand = nearest_new_item(mapped_line)
        if cand is not None and cand.item_id in consumed:
            # Fall back to the next-nearest unconsumed candidate on the
            # same mapped line, if any; otherwise treat as unmatched
            # rather than double-assign.
            same_line = new_items_by_line.get(mapped_line, [])
            unconsumed = [x for x in same_line if x.item_id not in consumed]
            cand = unconsumed[0] if unconsumed else None

        if cand is not None:
            consumed.add(cand.item_id)
            all_results.append({
                "old_item_id": a.item_id,
                "b3_predicted_item_id": cand.item_id,
                "b3_offset_resolved": True,
            })
        else:
            all_results.append({
                "old_item_id": a.item_id,
                "b3_predicted_item_id": "NONE",
                "b3_offset_resolved": True,
            })

    return {
        "old_items": len(old_ed.items), "new_items": len(new_ed.items),
        "offset_resolution_failures": offset_resolution_failures,
        "offset_resolution_failure_rate": round(
            offset_resolution_failures / max(1, len(old_ed.items)), 4),
        "_all_results": all_results,
    }


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    old_pdf, new_pdf = argv[1], argv[2]

    r1 = align_items_b1(old_pdf, new_pdf)
    m1 = sum(1 for x in r1["_all_results"] if x["b1_predicted_item_id"] != "NONE")
    print(f"B1  old_items: {r1['old_items']}  new_items: {r1['new_items']}  "
          f"matched: {m1}/{r1['old_items']} ({100*m1/max(1, r1['old_items']):.1f}%)")

    r4 = align_items_b4(old_pdf, new_pdf)
    m4 = sum(1 for x in r4["_all_results"] if x["b4_predicted_item_id"] != "NONE")
    print(f"B4  old_items: {r4['old_items']}  new_items: {r4['new_items']}  "
          f"matched: {m4}/{r4['old_items']} ({100*m4/max(1, r4['old_items']):.1f}%)")

    r3 = align_items_b3(old_pdf, new_pdf)
    m3 = sum(1 for x in r3["_all_results"] if x["b3_predicted_item_id"] != "NONE")
    print(f"B3  old_items: {r3['old_items']}  new_items: {r3['new_items']}  "
          f"matched: {m3}/{r3['old_items']} ({100*m3/max(1, r3['old_items']):.1f}%)  "
          f"offset_resolution_failure_rate: {r3['offset_resolution_failure_rate']:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
