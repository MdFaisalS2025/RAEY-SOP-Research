"""
Scores B7 (local cross-encoder reranker, baseline_b7_reranker.py) against
the same 233-item ground truth every other corrected analysis in this
study uses. Joined by parse-order index (sample_join.py) - B7 is only
ever asked about the exact 233 already-sampled items, never the whole
document (see baseline_b7_reranker.py's module docstring for the
disclosed design asymmetry this implies relative to B1-B5, identical in
kind to B6's).

Reports B7 at every floor in FLOOR_GRID against the method, against B6
(gemini-3.5-flash-lite, audit round 3), and against the naive
top-1-retrieval-only shortcut - the same comparison that made B6's null
result interpretable.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_b7_comparison
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.annotation import _norm_answer  # noqa: E402
from app.research.cross_edition.item_parser import parse  # noqa: E402
from app.research.cross_edition.baseline_b7_reranker import (  # noqa: E402
    align_items_b7_for_sample, FLOOR_GRID,
)
from app.research.cross_edition.annotation_packets.run_h3_test import (  # noqa: E402
    PAIRS, build_ground_truth,
)
from app.research.cross_edition.annotation_packets.run_full_comparison import (  # noqa: E402
    bootstrap_stat, make_accuracy_diff_fn,
)
from app.research.cross_edition.annotation_packets.sample_join import (  # noqa: E402
    build_index_join,
)

BASE = Path(__file__).parent

FLOOR_KEYS = [f"b7_floor{floor}" for floor in FLOOR_GRID]


def build_records_with_b7() -> list[dict]:
    import csv

    ground_truth = build_ground_truth()
    records: list[dict] = []

    for pair_idx, (pair, (slug, old_pdf, new_pdf)) in enumerate(PAIRS.items()):
        packet_csv = BASE / slug / "annotation_packet.csv"
        with open(packet_csv, encoding="utf-8") as f:
            method_rows = {r["sample_id"]: r for r in csv.DictReader(f)}

        id_to_index, _ = build_index_join(old_pdf, new_pdf)

        # RAW (un-remapped) old_item_ids for the sampled items, at the SAME
        # parse-order indices - identical pattern to run_b6_comparison.py.
        raw_old_items = parse(old_pdf).items
        index_to_raw_id = {i: it.item_id for i, it in enumerate(raw_old_items)}

        sampled_raw_ids = []
        for sid, row in method_rows.items():
            idx = id_to_index[row["old_item_id"]]
            sampled_raw_ids.append(index_to_raw_id[idx])

        print(f"  {pair}: scoring B7 for {len(sampled_raw_ids)} sampled items "
              f"(no API calls, local model)")
        b7 = align_items_b7_for_sample(old_pdf, new_pdf, sampled_raw_ids)
        b7_by_raw_id = b7["_results_by_old_id"]

        gt = ground_truth[pair]
        for sid, row in method_rows.items():
            if sid not in gt:
                continue
            truth = gt[sid]
            if truth == "cannot_determine":
                continue
            idx = id_to_index[row["old_item_id"]]
            raw_id = index_to_raw_id[idx]
            b7_rec = b7_by_raw_id.get(raw_id)
            if b7_rec is None:
                continue

            method_pred = _norm_answer(row["method_predicted_item_id"])
            weight = float(row.get("sample_weight", 1.0) or 1.0)

            preds = {"method": method_pred}
            correct = {"method": 1 if method_pred == truth else 0}
            for floor, key in zip(FLOOR_GRID, FLOOR_KEYS):
                pred = _norm_answer(b7_rec["preds_by_floor"][str(floor)])
                preds[key] = pred
                correct[key] = 1 if pred == truth else 0
            naive_pred = _norm_answer(b7_rec["naive_top1_predicted_item_id"])
            preds["naive_top1"] = naive_pred
            correct["naive_top1"] = 1 if naive_pred == truth else 0

            records.append({
                "pair": pair, "pair_idx": pair_idx, "sample_id": sid,
                "tier": row["tier"], "truth": truth, "weight": weight,
                "preds": preds, "correct": correct,
                "reranker_best_score": b7_rec["reranker_best_score"],
            })

    return records


def main():
    print("Scoring B7 (local cross-encoder reranker, bge-reranker-v2-m3, "
          "no API calls) - FULL RUN...")
    records = build_records_with_b7()
    print(f"\nusable items: {len(records)}")

    method_acc = sum(r["correct"]["method"] for r in records) / len(records)
    naive_acc = sum(r["correct"]["naive_top1"] for r in records) / len(records)
    print(f"method accuracy (raw): {method_acc:.4f}")
    print(f"naive top-1-retrieval-only accuracy (raw, no reranking): {naive_acc:.4f}")

    per_floor_report = {}
    for floor, key in zip(FLOOR_GRID, FLOOR_KEYS):
        b7_acc = sum(r["correct"][key] for r in records) / len(records)
        vs_method = bootstrap_stat(records, make_accuracy_diff_fn("method", key, False))
        vs_naive = bootstrap_stat(records, make_accuracy_diff_fn(key, "naive_top1", False))
        n_none = sum(1 for r in records if r["preds"][key] == "none")
        print(f"\nfloor={floor}: B7 accuracy={b7_acc:.4f}  "
              f"(n_NONE_predicted={n_none}/{len(records)})")
        print(f"  method vs B7 (raw): {vs_method['item']}")
        print(f"  B7 vs naive-top1 (raw): {vs_naive['item']}")
        per_floor_report[str(floor)] = {
            "b7_accuracy_raw": round(b7_acc, 4),
            "n_none_predicted": n_none,
            "method_minus_b7_raw": vs_method["item"],
            "b7_minus_naive_top1_raw": vs_naive["item"],
        }

    result = {
        "n_items": len(records),
        "reranker_model": "BAAI/bge-reranker-v2-m3",
        "retrieval_model": "BAAI/bge-small-en-v1.5",
        "method_accuracy_raw": round(method_acc, 4),
        "naive_top1_accuracy_raw": round(naive_acc, 4),
        "per_floor": per_floor_report,
    }
    out = BASE / "b7_comparison_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
