"""
One-off driver: scores B5 (embedding baseline, PREREGISTRATION.md's B5
pre-commitment entry) against the same 209-item ground truth already used
for B1-B4/H3/H5. Post-hoc, descriptive only - no hypothesis is attached
to B5, so no confirmation criterion is evaluated here, only accuracy
comparisons with bootstrap CIs for context.

Reuses build_records()'s ground-truth loading and bootstrap machinery
from run_full_comparison.py; only adds B5's predictions to the joined
record set.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_b5_comparison
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

import app.research.cross_edition.annotation_packets.run_h3_test as _rt  # noqa: E402
_rt.ANNOTATOR_FILES = {k: rf"C:\Users\Faisal\Desktop\research paper\Annotator_{k}.xlsx" for k in "ABCD"}
_rt.ADJUDICATION_FILE = r"C:\Users\Faisal\Desktop\research paper\Adjudication_43_items_completed.xlsx"

from app.research.cross_edition.annotation import _norm_answer  # noqa: E402
from app.research.cross_edition.baseline_b5 import align_items_b5  # noqa: E402
from app.research.cross_edition.baseline_b2 import align_items_b2  # noqa: E402
from app.research.cross_edition.annotation_packets.run_h3_test import (  # noqa: E402
    PAIRS, build_ground_truth,
)
from app.research.cross_edition.annotation_packets.run_full_comparison import (  # noqa: E402
    bootstrap_stat, make_accuracy_diff_fn, BASE,
)
from app.research.cross_edition.annotation_packets.run_sensitivity_analysis import (  # noqa: E402
    affected_guidelines_by_pair,
)

N_BOOT_LABEL = "10000 resamples, item-level (matching every other descriptive baseline comparison)"


def build_records_with_b5() -> list[dict]:
    ground_truth = build_ground_truth()
    records: list[dict] = []

    for pair_idx, (pair, (slug, old_pdf, new_pdf)) in enumerate(PAIRS.items()):
        with open(BASE / slug / "annotation_packet.csv", encoding="utf-8") as f:
            method_rows = {r["sample_id"]: r for r in csv.DictReader(f)}

        b5 = {r["old_item_id"]: r["b5_predicted_item_id"]
              for r in align_items_b5(old_pdf, new_pdf)["_all_results"]}
        b2 = {r["old_item_id"]: r["b2_predicted_item_id"]
              for r in align_items_b2(old_pdf, new_pdf)["_all_results"]}
        print(f"  {pair}: B5 encoded, {len(b5)} old items")

        gt = ground_truth[pair]
        for sid, row in method_rows.items():
            if sid not in gt:
                continue
            truth = gt[sid]
            if truth == "cannot_determine":
                continue
            old_id = row["old_item_id"]
            if old_id not in b5 or old_id not in b2:
                continue

            method_pred = _norm_answer(row["method_predicted_item_id"])
            b5_pred = _norm_answer(b5[old_id])
            b2_pred = _norm_answer(b2[old_id])
            weight = float(row.get("sample_weight", 1.0) or 1.0)

            records.append({
                "pair": pair, "pair_idx": pair_idx, "sample_id": sid,
                "tier": row["tier"], "truth": truth, "weight": weight,
                "preds": {"method": method_pred, "b5": b5_pred, "b2": b2_pred},
                "correct": {
                    "method": 1 if method_pred == truth else 0,
                    "b5": 1 if b5_pred == truth else 0,
                    "b2": 1 if b2_pred == truth else 0,
                },
            })

    return records


def main():
    print("Encoding all four pairs with B5 (this takes a while)...")
    records = build_records_with_b5()
    print(f"\nusable items: {len(records)} (expect 209)")

    result: dict = {"n_items": len(records), "bootstrap_note": N_BOOT_LABEL}

    method_acc_raw = sum(r["correct"]["method"] for r in records) / len(records)
    b5_acc_raw = sum(r["correct"]["b5"] for r in records) / len(records)
    print(f"\nmethod accuracy (raw): {method_acc_raw:.4f}")
    print(f"B5 accuracy (raw): {b5_acc_raw:.4f}")

    d = {}
    for weighted, label in ((False, "raw"), (True, "weighted")):
        d[label] = bootstrap_stat(records, make_accuracy_diff_fn("method", "b5", weighted))
    result["method_minus_b5_accuracy"] = d
    print(f"method vs B5: item-raw={d['raw']['item']}  item-weighted={d['weighted']['item']}")

    b2_acc_raw = sum(r["correct"]["b2"] for r in records) / len(records)
    d2 = {}
    for weighted, label in ((False, "raw"), (True, "weighted")):
        d2[label] = bootstrap_stat(records, make_accuracy_diff_fn("b2", "b5", weighted))
    result["b2_minus_b5_accuracy"] = d2
    print(f"B2 vs B5: item-raw={d2['raw']['item']}  item-weighted={d2['weighted']['item']}")

    result["method_accuracy_raw"] = round(method_acc_raw, 4)
    result["b5_accuracy_raw"] = round(b5_acc_raw, 4)
    result["b2_accuracy_raw"] = round(b2_acc_raw, 4)

    # --- sensitivity check: same section 56/58 boundary-bug exclusion -------
    print("\n=== Sensitivity check: excluding section 56/58 boundary-bug items ===")
    import csv as _csv
    affected = affected_guidelines_by_pair()
    by_pair_csv = {}
    for pair, (slug, _, _) in PAIRS.items():
        with open(BASE / slug / "annotation_packet.csv", encoding="utf-8") as f:
            by_pair_csv[pair] = {r["sample_id"]: r["old_guideline"] for r in _csv.DictReader(f)}
    for r in records:
        r["old_guideline"] = by_pair_csv[r["pair"]].get(r["sample_id"], "")
    clean = [r for r in records if r["old_guideline"] not in affected[r["pair"]]]

    method_acc_clean = sum(r["correct"]["method"] for r in clean) / len(clean)
    b5_acc_clean = sum(r["correct"]["b5"] for r in clean) / len(clean)
    b2_acc_clean = sum(r["correct"]["b2"] for r in clean) / len(clean)
    diff_clean = bootstrap_stat(clean, make_accuracy_diff_fn("method", "b5", False))
    print(f"n: all={len(records)} clean={len(clean)}")
    print(f"method accuracy: all={method_acc_raw:.4f} clean={method_acc_clean:.4f}")
    print(f"B5 accuracy: all={b5_acc_raw:.4f} clean={b5_acc_clean:.4f}")
    print(f"B2 accuracy: all={b2_acc_raw:.4f} clean={b2_acc_clean:.4f}")
    print(f"method-B5 diff (raw): all={d['raw']['item']}  clean={diff_clean['item']}")
    result["sensitivity_clean_subset"] = {
        "n_clean": len(clean),
        "method_accuracy_raw": round(method_acc_clean, 4),
        "b5_accuracy_raw": round(b5_acc_clean, 4),
        "b2_accuracy_raw": round(b2_acc_clean, 4),
        "method_minus_b5_diff_raw": diff_clean["item"],
    }

    out_path = BASE / "b5_comparison_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
