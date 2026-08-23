"""
One-off driver: draws the H3' sample committed in PREREGISTRATION.md
section 11 (the "follow-up study" entry) - a full census of Tennessee
22-23 -> Sept24's 32 bullet/sub-bullet-marker old items, plus a standard
section 5.1-style stratified draw (10 per tier, redistributed) of 60
ordinal-marker old items - and writes the same annotator-facing packet
format annotation.write_annotation_packet() already produces, reusing it
unchanged rather than reimplementing it.

Also writes a separate master_scoring.csv (NOT given to annotators) with
the original method (v1), the fixed method (v2), and B2's predictions for
every sampled item, so H3'a/H3'b/H3'c can be scored later against
whatever blind ground truth the annotators produce. Annotators only ever
see old_item_id/old_text/the full new-edition guideline text - identical
to the original 4-pair packets' blind design (section 5.3).

Does not modify item_align.py, item_align_v2.py, item_parser.py, or
annotation.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.build_h3prime_sample
"""
from __future__ import annotations

import csv
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.item_align import align_items, _norm  # noqa: E402
from app.research.cross_edition.item_align_v2 import align_items_v2, _is_bullet_kind  # noqa: E402
from app.research.cross_edition.baseline_b2 import align_items_b2  # noqa: E402
from app.research.cross_edition.annotation import write_annotation_packet  # noqa: E402

SP = r"C:\Users\Faisal\Desktop\Hospital SOP's Research\corpus\protocols"
OLD_PDF = f"{SP}\\tn_2022_23.pdf"
NEW_PDF = f"{SP}\\tn_sept2024.pdf"
BASE = Path(__file__).parent / "h3prime_tennessee_2022_2024"

SEED = 20260818
PER_TIER_TARGET = 10
TIERS = ["T1_id_exact", "T2_id_text_changed", "T3_renumbered",
          "T4_reworded", "T5_moved", "T6_unmatched_old"]


def _stratified_from_pool(pool_by_tier: dict[str, list[dict]], rng: random.Random) -> tuple[list[dict], dict[str, float]]:
    """Identical redistribution logic to annotation.stratified_sample,
    operating on a caller-supplied pool (here: ordinal-marker items only)
    rather than re-deriving it, so the ordinal draw cannot include any
    bullet-marker item (those are censused separately)."""
    drawn_per_tier: dict[str, int] = {}
    shortfall = 0
    for tier in TIERS:
        pool = pool_by_tier.get(tier, [])
        k = min(PER_TIER_TARGET, len(pool))
        drawn_per_tier[tier] = k
        shortfall += PER_TIER_TARGET - k

    if shortfall > 0:
        remaining = {t: len(pool_by_tier.get(t, [])) - drawn_per_tier[t] for t in TIERS}
        total_remaining = sum(max(0, v) for v in remaining.values())
        if total_remaining > 0:
            extra_allocated = 0
            for tier in TIERS:
                if remaining[tier] <= 0:
                    continue
                extra = int(shortfall * remaining[tier] / total_remaining)
                extra = min(extra, remaining[tier])
                drawn_per_tier[tier] += extra
                extra_allocated += extra
            leftover = shortfall - extra_allocated
            if leftover > 0:
                biggest = max(TIERS, key=lambda t: remaining.get(t, 0) -
                              (drawn_per_tier[t] - min(PER_TIER_TARGET, len(pool_by_tier.get(t, [])))))
                drawn_per_tier[biggest] = min(
                    drawn_per_tier[biggest] + leftover, len(pool_by_tier.get(biggest, []))
                )

    sample: list[dict] = []
    weights: dict[str, float] = {}
    for tier in TIERS:
        pool = pool_by_tier.get(tier, [])
        k = drawn_per_tier[tier]
        if k == 0:
            weights[tier] = 0.0
            continue
        chosen = rng.sample(pool, k)
        weights[tier] = len(pool) / k
        for r in chosen:
            sample.append({**r, "sample_weight": round(len(pool) / k, 4)})
    return sample, weights


def main():
    v1 = align_items(OLD_PDF, NEW_PDF)
    all_results = v1["_all_results"]

    bullet_recs = [r for r in all_results if _is_bullet_kind(r["old_item"].marker_path)]
    ordinal_recs = [r for r in all_results if not _is_bullet_kind(r["old_item"].marker_path)]
    print(f"bullet old items (census): {len(bullet_recs)}")
    print(f"ordinal old items (population for stratified draw): {len(ordinal_recs)}")

    ordinal_by_tier: dict[str, list[dict]] = {}
    for tier in TIERS:
        ordinal_by_tier[tier] = [r for r in ordinal_recs if r["tier"] == tier]

    rng = random.Random(SEED)
    ordinal_sample, weights = _stratified_from_pool(ordinal_by_tier, rng)
    print(f"ordinal items drawn: {len(ordinal_sample)}  weights: {weights}")

    # Bullet census: sample_weight 1.0 (full population, no reweighting needed).
    bullet_sample = [{**r, "sample_weight": 1.0} for r in bullet_recs]

    combined_sample = bullet_sample + ordinal_sample
    sample_result = {
        "old_pdf": OLD_PDF, "new_pdf": NEW_PDF, "seed": SEED,
        "population_by_tier": {t: len(ordinal_by_tier.get(t, [])) for t in TIERS},
        "drawn_by_tier": {t: sum(1 for r in ordinal_sample if r["tier"] == t) for t in TIERS},
        "sample_weight_by_tier": weights,
        "sample": combined_sample,
        "total_drawn": len(combined_sample),
        "total_target": len(bullet_sample) + 60,
    }

    csv_path, ctx_path = write_annotation_packet(sample_result, str(BASE))
    print(f"wrote {csv_path}")
    print(f"wrote {ctx_path}")

    # Master scoring file (NOT for annotators): v1 / v2 / B2 predictions for
    # every sampled item, joined by PARSE-ORDER INDEX, not old_item_id string.
    # 2026-08-18 audit finding: v2 (item_align_v2) applies the identical
    # guideline-id-remap align_items does, so v1/v2 ids happened to agree,
    # but B2 never remaps .guideline at all - align_items_b2's old_item_id is
    # the RAW parse id, while this packet's old_item_id (from v1's
    # write_annotation_packet) is POST-remap. String-keyed lookup silently
    # mismatched B2's predictions whenever a guideline was renamed - the same
    # bug class already fixed in run_full_comparison.py; see sample_join.py.
    from app.research.cross_edition.annotation_packets.sample_join import (
        build_index_join, verify_sample_identity, join_baseline,
    )
    id_to_index, _ = build_index_join(OLD_PDF, NEW_PDF)
    verify_sample_identity(csv_path, id_to_index)

    v2 = align_items_v2(OLD_PDF, NEW_PDF)
    b2 = align_items_b2(OLD_PDF, NEW_PDF)

    with open(csv_path, encoding="utf-8") as f:
        packet_rows = list(csv.DictReader(f))

    master_path = BASE / "master_scoring.csv"
    with open(master_path, "w", encoding="utf-8", newline="") as f:
        fieldnames = ["sample_id", "old_item_id", "is_bullet_kind", "sample_weight",
                      "v1_tier", "v1_predicted_item_id",
                      "v2_tier", "v2_predicted_item_id", "v2_fix_overrode",
                      "b2_predicted_item_id"]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in packet_rows:
            oid = row["old_item_id"]
            idx = id_to_index[oid]
            v2r = v2["_all_results"][idx]
            b2r = {"b2_predicted_item_id": join_baseline(b2, idx, "b2_predicted_item_id")}
            w.writerow({
                "sample_id": row["sample_id"],
                "old_item_id": oid,
                "is_bullet_kind": row["tier"] == row["tier"] and (row["old_marker_path"] and _is_bullet_kind(row["old_marker_path"])),
                "sample_weight": row["sample_weight"],
                "v1_tier": row["tier"],
                "v1_predicted_item_id": row["method_predicted_item_id"],
                "v2_tier": v2r.get("tier", ""),
                "v2_predicted_item_id": v2r.get("predicted_item_id", ""),
                "v2_fix_overrode": v2r.get("fix_overrode_id_match", ""),
                "b2_predicted_item_id": b2r.get("b2_predicted_item_id", ""),
            })
    print(f"wrote {master_path}")


if __name__ == "__main__":
    main()
