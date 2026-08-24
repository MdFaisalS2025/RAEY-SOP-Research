"""
One-off driver: computes PREREGISTRATION.md section 6's metrics (primary
outcome: provenance loss rate) pooled across the FULL 8-pair, 480-item
confirmatory dataset (467 usable, 2 pending Massachusetts adjudication) -
the number section6_final_metrics.json (4 pairs), new_pairs_final_metrics.json
(pairs 5-6), and ma_pairs_final_metrics.json (pairs 7-8) each computed
separately for their own subset, but never pooled across all eight together
until now.

Reuses build_ground_truth() from run_h3_test.py (pairs 1-4),
build_new_pairs_ground_truth() from run_full_comparison_6pairs.py (pairs
5-6), and build_ma_ground_truth() from run_full_comparison_8pairs.py
(pairs 7-8) unchanged - no ground-truth logic is reimplemented here, only
pooled. Does not modify item_align.py, item_parser.py, corpus_probe.py,
or edition_align.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_final_section6_metrics
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.annotation import compute_section6_metrics  # noqa: E402
from app.research.cross_edition.annotation_packets.run_h3_test import (  # noqa: E402
    PAIRS as ORIGINAL_PAIRS, build_ground_truth as build_original_ground_truth,
)
from app.research.cross_edition.annotation_packets.run_full_comparison_6pairs import (  # noqa: E402
    NEW_PAIRS, build_new_pairs_ground_truth,
)
from app.research.cross_edition.annotation_packets.run_full_comparison_8pairs import (  # noqa: E402
    MA_PAIRS, build_ma_ground_truth,
)

BASE = Path(__file__).parent

PAIR_GROUPS = [
    ("original_4", ORIGINAL_PAIRS, build_original_ground_truth, None),
    ("fifth_sixth", NEW_PAIRS, None, build_new_pairs_ground_truth),
    ("seventh_eighth_ma", MA_PAIRS, None, build_ma_ground_truth),
]


def load_rows(slug: str) -> list[dict]:
    with open(BASE / slug / "annotation_packet.csv", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    pooled_gt: dict[str, str] = {}
    pooled_rows: list[dict] = []
    total_pending = 0

    for group_name, pairs, gt_fn_simple, gt_fn_pending in PAIR_GROUPS:
        if gt_fn_simple is not None:
            ground_truth = gt_fn_simple()
            pending = {}
        else:
            ground_truth, pending = gt_fn_pending()
        n_pending = sum(len(v) for v in pending.values())
        total_pending += n_pending
        print(f"{group_name}: {len(pairs)} pairs, {n_pending} pending adjudication")

        for pair, (slug, *_rest) in pairs.items():
            rows = load_rows(slug)
            gt = ground_truth[pair]
            for sid, ans in gt.items():
                pooled_gt[f"{pair}::{sid}"] = ans
            for r in rows:
                r2 = dict(r)
                r2["sample_id"] = f"{pair}::{r['sample_id']}"
                pooled_rows.append(r2)

    print(f"\ntotal pending adjudication across all 8 pairs (excluded below): {total_pending}")
    metrics = compute_section6_metrics(pooled_gt, pooled_rows)
    metrics["_pooled_pending_adjudication"] = total_pending
    metrics["_n_pairs"] = 8
    metrics["_n_publishers"] = 4

    print("\n=== FINAL POOLED SECTION 6 METRICS (8 pairs, 4 publishers) ===")
    print(json.dumps(metrics, indent=2))

    out_path = BASE / "final_pooled_section6_metrics.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
