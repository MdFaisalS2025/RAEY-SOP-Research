"""
Scores B6 (LLM retrieve-then-rerank, baseline_b6_llm.py) against the same
233-item ground truth every other corrected analysis in this study uses.
Joined by parse-order index (sample_join.py) - B6 is only ever asked
about the exact 233 already-sampled items, never the whole document (see
baseline_b6_llm.py's module docstring for the disclosed design
asymmetry this implies relative to B1-B5).

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_b6_comparison
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

import app.research.cross_edition.annotation_packets.run_h3_test as _rt  # noqa: E402
_rt.ANNOTATOR_FILES = {k: rf"C:\Users\Faisal\Desktop\research paper\Annotator_{k}.xlsx" for k in "ABCD"}
_rt.ADJUDICATION_FILE = r"C:\Users\Faisal\Desktop\research paper\Adjudication_43_items_completed.xlsx"

from app.research.cross_edition.annotation import _norm_answer  # noqa: E402
from app.research.cross_edition.item_parser import parse  # noqa: E402
from app.research.cross_edition.baseline_b6_llm import align_items_b6_for_sample  # noqa: E402
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


def build_records_with_b6() -> list[dict]:
    import csv
    ground_truth = build_ground_truth()
    records: list[dict] = []

    for pair_idx, (pair, (slug, old_pdf, new_pdf)) in enumerate(PAIRS.items()):
        packet_csv = BASE / slug / "annotation_packet.csv"
        with open(packet_csv, encoding="utf-8") as f:
            method_rows = {r["sample_id"]: r for r in csv.DictReader(f)}

        id_to_index, _ = build_index_join(old_pdf, new_pdf)

        # RAW (un-remapped) old_item_ids for the sampled items, at the SAME
        # parse-order indices - a fresh parse() call, never touched by
        # align_items' in-place guideline-remap mutation.
        raw_old_items = parse(old_pdf).items
        index_to_raw_id = {i: it.item_id for i, it in enumerate(raw_old_items)}

        sampled_raw_ids = []
        sid_by_raw_id = {}
        for sid, row in method_rows.items():
            idx = id_to_index[row["old_item_id"]]
            raw_id = index_to_raw_id[idx]
            sampled_raw_ids.append(raw_id)
            sid_by_raw_id[raw_id] = sid

        cache_path = str(BASE / slug / "b6_response_cache.json")
        print(f"  {pair}: scoring B6 for {len(sampled_raw_ids)} sampled items "
              f"(cache: {cache_path})")
        b6 = align_items_b6_for_sample(old_pdf, new_pdf, sampled_raw_ids, cache_path)
        b6_by_raw_id = b6["_results_by_old_id"]

        gt = ground_truth[pair]
        for sid, row in method_rows.items():
            if sid not in gt:
                continue
            truth = gt[sid]
            if truth == "cannot_determine":
                continue
            idx = id_to_index[row["old_item_id"]]
            raw_id = index_to_raw_id[idx]
            b6_rec = b6_by_raw_id.get(raw_id)
            if b6_rec is None:
                continue

            method_pred = _norm_answer(row["method_predicted_item_id"])
            b6_pred = _norm_answer(b6_rec["b6_predicted_item_id"])
            weight = float(row.get("sample_weight", 1.0) or 1.0)

            records.append({
                "pair": pair, "pair_idx": pair_idx, "sample_id": sid,
                "tier": row["tier"], "truth": truth, "weight": weight,
                "preds": {"method": method_pred, "b6": b6_pred},
                "correct": {
                    "method": 1 if method_pred == truth else 0,
                    "b6": 1 if b6_pred == truth else 0,
                },
            })

    return records


def main():
    print("Scoring B6 (LLM retrieve-then-rerank) - this makes real API calls, "
          "cached per pair for reproducibility...")
    records = build_records_with_b6()
    print(f"\nusable items: {len(records)} (expect 233)")

    method_acc = sum(r["correct"]["method"] for r in records) / len(records)
    b6_acc = sum(r["correct"]["b6"] for r in records) / len(records)
    print(f"method accuracy (raw): {method_acc:.4f}")
    print(f"B6 accuracy (raw): {b6_acc:.4f}")

    d = bootstrap_stat(records, make_accuracy_diff_fn("method", "b6", False))
    print(f"method vs B6 (raw): {d['item']}")

    result = {
        "n_items": len(records),
        "method_accuracy_raw": round(method_acc, 4),
        "b6_accuracy_raw": round(b6_acc, 4),
        "method_minus_b6_raw": d["item"],
    }
    out = BASE / "b6_comparison_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
