"""
Shared join helper - fixes the silent item-drop bug found in the 2026-08-18
full-project audit.

THE BUG
-------
item_align.align_items MUTATES item_id: it rewrites every old item into the
NEW edition's guideline vocabulary (item_align.py, the `it.item_id =
f"{_norm_title(mapped)}/..."` line) so that identifier comparison across
editions is meaningful. annotation.write_annotation_packet then saves that
POST-REMAP id into annotation_packet.csv.

Every baseline (baseline_b2, baseline_b1_b3_b4, baseline_b5) instead calls
parse() directly and keys its results by RAW parse ids. So for any sampled
item whose guideline title changed between editions, the packet CSV's id and
the baseline's id disagree, the lookup returns None, and the driver silently
`continue`d past it. The "# should not happen" comment that guarded that
branch in run_h3_test.py was simply wrong.

Measured impact before the fix: 24 of 233 usable items (10.3%) dropped -
Tennessee 1, Pennsylvania 2, Connecticut #1 21 (36% of that pair's usable
sample!), Connecticut #2 0. The dropped items scored ~37.5% method accuracy
versus 75.1% for the retained ones - i.e. they are the HARDEST cases
(guideline renamed), dropped non-randomly, and their removal inflated the
method's reported accuracy from 71.24% to 75.12%.

THE FIX
-------
Join by PARSE-ORDER INDEX rather than by the mutated id. align_items and
every baseline iterate the same parse()d `old_items` list in the same order
and emit exactly one `_all_results` entry per old item, so `_all_results[i]`
refers to the same underlying item in all of them. This is exact, not
approximate.

Why this is safe to do now, without re-annotating: the sampled items are
unchanged. annotation.stratified_sample is deterministic given its frozen
seed, and re-deriving it reproduces each existing annotation_packet.csv's
old_item_id list exactly, in order (verified for all four pairs by
verify_sample_identity() below). The fix changes how results are JOINED, not
which items were sampled or what the annotators judged.

Does not modify item_align.py, item_parser.py, or any other frozen file.
"""
from __future__ import annotations

import csv
from pathlib import Path

from app.research.cross_edition.item_align import align_items


def build_index_join(old_pdf: str, new_pdf: str) -> tuple[dict[str, int], dict]:
    """Returns ({post_remap_item_id: parse_order_index}, align_items_result).

    The align_items result is returned alongside so callers that also need
    the method's own predictions/tiers do not have to re-run the (expensive)
    alignment a second time.
    """
    result = align_items(old_pdf, new_pdf)
    all_results = result["_all_results"]

    id_to_index: dict[str, int] = {}
    for idx, rec in enumerate(all_results):
        item_id = rec["old_item"].item_id
        if item_id in id_to_index:
            # Greedy one-to-one guideline matching should make post-remap ids
            # unique. Assert rather than assume - a collision here would make
            # the join ambiguous and silently wrong, which is exactly the class
            # of bug this module exists to fix.
            raise RuntimeError(
                f"post-remap item_id collision on {item_id!r} (indices "
                f"{id_to_index[item_id]} and {idx}) - index join is unsafe"
            )
        id_to_index[item_id] = idx

    return id_to_index, result


def join_baseline(
    baseline_result: dict, index: int, key: str,
) -> str:
    """Pull one baseline's prediction for the item at parse-order `index`.

    Fails loudly on an out-of-range index rather than returning a default -
    a mismatch means the baseline did not iterate the same item list, which
    invalidates the join and must not be papered over.
    """
    rows = baseline_result["_all_results"]
    if index >= len(rows):
        raise RuntimeError(
            f"index {index} out of range for baseline with {len(rows)} results "
            f"- baseline did not iterate the same old_items list"
        )
    return rows[index][key]


def verify_sample_identity(packet_csv: str | Path, id_to_index: dict[str, int]) -> dict:
    """Verify every sampled old_item_id in the packet CSV resolves through the
    index map. Returns a small report; raises if any row fails to resolve.

    This is the check that would have caught the original bug: before the fix,
    24 rows across the four pairs did not resolve and were silently skipped.
    """
    with open(packet_csv, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    unresolved = [r["sample_id"] for r in rows if r["old_item_id"] not in id_to_index]
    if unresolved:
        raise RuntimeError(
            f"{len(unresolved)} sampled items do not resolve against the index "
            f"map (e.g. {unresolved[:5]}) - the join is broken, not merely lossy"
        )
    return {"n_rows": len(rows), "n_resolved": len(rows) - len(unresolved)}
