"""
One-off driver: sensitivity analysis for the guideline-boundary-detection
bug documented in FEASIBILITY.md section 56. Recomputes every section 6
metric and H3/H4/H5 EXCLUDING items whose old-edition guideline is a
size outlier (the same mechanical rule section 56 already established:
more than 4x the edition's median guideline size, floor 50 items,
excluding "<preamble>"), and reports headline-vs-sensitivity side by
side.

Applied consistently across ALL FOUR pairs, not just Tennessee (section
56 only checked Tennessee). Spot-checking two Connecticut outliers
during this analysis's design found the same partial-contamination
pattern in "NEW Central Line Access" (unrelated newborn-transport
content in its tail) but NOT in "Abuse and Neglect of Children and the
Elderly" (topically coherent throughout, despite being a size outlier) -
the mechanical size rule is a known-imperfect proxy, not a content
judgement, and is used here anyway because a per-guideline manual
inclusion/exclusion call would itself be a new, undisclosed source of
discretion. This limitation is stated in the report, not hidden.

Reuses build_records(), bootstrap_stat(), the stat-function factories,
and the BH machinery from run_full_comparison.py completely unchanged -
this script only adds the exclusion filter and a same-shape "raw metric"
computation (accuracy / provenance loss / false-correspondence / T3
precision / deletion recall+precision) for reporting headline vs
sensitivity, since run_full_comparison.py only ever computed DIFFERENCES
between two methods, not a single method's standalone rate.

Does not modify item_parser.py or any frozen file - only reads guideline
names and item counts already produced by parse().

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_sensitivity_analysis
"""
from __future__ import annotations

import json
import statistics
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.item_parser import parse  # noqa: E402
import app.research.cross_edition.annotation_packets.run_h3_test as _rt  # noqa: E402

# The default paths in run_h3_test.py point to files that were later moved;
# the real completed files live here (same override used for every re-run
# since that move).
_rt.ANNOTATOR_FILES = {k: rf"C:\Users\Faisal\Desktop\research paper\Annotator_{k}.xlsx" for k in "ABCD"}
_rt.ADJUDICATION_FILE = r"C:\Users\Faisal\Desktop\research paper\Adjudication_43_items_completed.xlsx"

from app.research.cross_edition.annotation_packets.run_full_comparison import (  # noqa: E402
    build_records, bootstrap_stat, make_accuracy_diff_fn,
    make_false_corr_diff_fn, make_provenance_loss_fn, t3_precision_fn,
    bootstrap_p_h3, bootstrap_p_h4, bootstrap_p_h5, benjamini_hochberg,
    PAIRS, BASE as COMPARISON_BASE,
)

BASE = Path(__file__).parent


def affected_guidelines_by_pair() -> dict[str, set[str]]:
    """The section 56 outlier rule (>4x median guideline size, >50 items,
    excluding <preamble>), applied to each pair's OLD edition."""
    out: dict[str, set[str]] = {}
    for pair, (slug, old_pdf, new_pdf) in PAIRS.items():
        ed = parse(old_pdf)
        c = Counter(it.guideline for it in ed.items)
        sizes = list(c.values())
        med = statistics.median(sizes)
        outliers = {g for g, n in c.items()
                     if n > 4 * med and n > 50 and g != "<preamble>"}
        out[pair] = outliers
    return out


def attach_guideline(records: list[dict]) -> list[dict]:
    """build_records() records don't carry old_guideline - join it in from
    each pair's annotation_packet.csv (already has it per sample_id)."""
    import csv
    by_pair_csv: dict[str, dict[str, str]] = {}
    for pair, (slug, _, _) in PAIRS.items():
        with open(COMPARISON_BASE / slug / "annotation_packet.csv", encoding="utf-8") as f:
            by_pair_csv[pair] = {r["sample_id"]: r["old_guideline"] for r in csv.DictReader(f)}
    for r in records:
        r["old_guideline"] = by_pair_csv[r["pair"]].get(r["sample_id"], "")
    return records


# --- standalone (non-diff) rate functions, mirroring run_full_comparison's
# diff functions but returning one method's raw rate for headline reporting.
def _weighted_mean(vals_weights):
    wsum = sum(w for _, w in vals_weights)
    return None if wsum == 0 else sum(v * w for v, w in vals_weights) / wsum


def accuracy_fn(key: str, weighted: bool):
    def fn(records):
        if not records:
            return None
        if weighted:
            return _weighted_mean([(r["correct"][key], r["weight"]) for r in records])
        return sum(r["correct"][key] for r in records) / len(records)
    return fn


def provenance_loss_fn(key: str, weighted: bool):
    def fn(records):
        true_corr = [r for r in records if r["truth"] != "none"]
        if not true_corr:
            return None
        if weighted:
            return _weighted_mean([(1 if r["preds"][key] == "none" else 0, r["weight"]) for r in true_corr])
        return sum(1 for r in true_corr if r["preds"][key] == "none") / len(true_corr)
    return fn


def false_corr_fn(key: str, weighted: bool):
    def fn(records):
        said = [r for r in records if r["preds"][key] != "none"]
        if not said:
            return None
        if weighted:
            return _weighted_mean([(1 if r["preds"][key] != r["truth"] else 0, r["weight"]) for r in said])
        return sum(1 for r in said if r["preds"][key] != r["truth"]) / len(said)
    return fn


def deletion_recall_fn(key: str):
    def fn(records):
        true_deleted = [r for r in records if r["truth"] == "none"]
        if not true_deleted:
            return None
        return sum(1 for r in true_deleted if r["preds"][key] == "none") / len(true_deleted)
    return fn


def deletion_precision_fn(key: str):
    def fn(records):
        pred_deleted = [r for r in records if r["preds"][key] == "none"]
        if not pred_deleted:
            return None
        return sum(1 for r in pred_deleted if r["truth"] == "none") / len(pred_deleted)
    return fn


def t3_precision_only(records):
    return t3_precision_fn(records)


def main():
    affected = affected_guidelines_by_pair()
    print("Affected (outlier) guidelines by pair:")
    for pair, gs in affected.items():
        print(f"  {pair}: {sorted(gs)}")
    print()

    records = attach_guideline(build_records())
    clean = [r for r in records if r["old_guideline"] not in affected[r["pair"]]]
    print(f"all usable items: {len(records)}")
    print(f"clean (bug-affected guidelines excluded): {len(clean)}  "
          f"({len(records) - len(clean)} excluded)")
    print()

    report: dict = {
        "affected_guidelines_by_pair": {k: sorted(v) for k, v in affected.items()},
        "n_all": len(records), "n_clean": len(clean),
        "n_excluded": len(records) - len(clean),
    }

    # --- headline vs sensitivity: single-method rates ----------------------
    metrics = {}
    for label, key in [("method", "method"), ("B1", "b1"), ("B2", "b2")]:
        metrics[label] = {}
        for weighted, wlabel in ((False, "raw"), (True, "weighted")):
            metrics[label][f"accuracy_{wlabel}"] = {
                "all": accuracy_fn(key, weighted)(records),
                "clean": accuracy_fn(key, weighted)(clean),
            }
            metrics[label][f"provenance_loss_{wlabel}"] = {
                "all": provenance_loss_fn(key, weighted)(records),
                "clean": provenance_loss_fn(key, weighted)(clean),
            }
            metrics[label][f"false_correspondence_{wlabel}"] = {
                "all": false_corr_fn(key, weighted)(records),
                "clean": false_corr_fn(key, weighted)(clean),
            }
        metrics[label]["deletion_recall"] = {
            "all": deletion_recall_fn(key)(records), "clean": deletion_recall_fn(key)(clean),
        }
        metrics[label]["deletion_precision"] = {
            "all": deletion_precision_fn(key)(records), "clean": deletion_precision_fn(key)(clean),
        }
    metrics["method"]["t3_precision"] = {
        "all": t3_precision_only(records), "clean": t3_precision_only(clean),
    }
    report["metrics"] = metrics

    print("=== Headline (all) vs sensitivity (clean) ===")
    for label in ("method", "B1", "B2"):
        print(f"-- {label} --")
        for m, v in metrics[label].items():
            a, c = v["all"], v["clean"]
            if a is None or c is None:
                print(f"  {m}: all={a} clean={c}")
                continue
            print(f"  {m}: all={a:.4f}  clean={c:.4f}  shift={c - a:+.4f}")

    # --- H3/H4/H5 re-run on the clean subset --------------------------------
    print("\n=== H3/H4/H5 on clean subset (item-level, matching run_full_comparison's primary reporting) ===")
    h_results = {}
    for name, fn in [
        ("H3_method_minus_B2", make_accuracy_diff_fn("method", "b2", False)),
        ("H5_method_minus_B1_false_corr", make_false_corr_diff_fn("method", "b1", False)),
    ]:
        boot_all = bootstrap_stat(records, fn)
        boot_clean = bootstrap_stat(clean, fn)
        h_results[name] = {"all": boot_all["item"], "clean": boot_clean["item"]}
        print(f"{name}: all={boot_all['item']}  clean={boot_clean['item']}")

    t3_all = bootstrap_stat(records, t3_precision_only)
    t3_clean = bootstrap_stat(clean, t3_precision_only)
    h_results["H4_T3_precision"] = {"all": t3_all["item"], "clean": t3_clean["item"]}
    print(f"H4_T3_precision: all={t3_all['item']}  clean={t3_clean['item']}")
    report["hypothesis_bootstrap"] = h_results

    pvals_clean = {
        "H3": bootstrap_p_h3(clean), "H4": bootstrap_p_h4(clean), "H5": bootstrap_p_h5(clean),
    }
    report["bh_clean"] = benjamini_hochberg(pvals_clean)
    print(f"\nBH on clean subset: {report['bh_clean']}")

    out_path = BASE / "sensitivity_analysis_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
