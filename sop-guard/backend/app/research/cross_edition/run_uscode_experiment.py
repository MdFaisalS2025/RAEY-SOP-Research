"""
Second-domain replication experiment (Workstream B/C, novelty-audit plan).
Tests HC1-HC3 (PREREGISTRATION.md's HC pre-commitment entry) on US Code
Title 18, a domain with clean, machine-readable, near-perfect structure -
the opposite end of the structure-quality spectrum from EMS protocol
PDFs (item_parser.py's heuristic anchor detection, section 56's real
boundary bug).

Reuses structure_ablation.py's corrupt_edition() and the same
monkeypatch-parse() pattern COMPLETELY UNCHANGED, so the real,
unmodified item_align.align_items runs on this corpus exactly as it
does on the EMS corpus - no parallel alignment logic, no risk of
divergence between domains being an artifact of different code paths.

Ground truth: uscode_corpus.usc_ground_truth - identifier persistence
across release points, excluding repealed-placeholder false positives.
B1/B4 (identifier-based baselines) are DELIBERATELY EXCLUDED from the
headline comparison: since ground truth here is defined by identifier
persistence, an identifier-lookup baseline would be checking against a
close paraphrase of its own definition, not a meaningful comparison -
an a priori structural fact about this domain, not something requiring
a wasted empirical run to demonstrate.

Because USC's chapter boundaries come directly from unambiguous XML
tags, r=0 here is not just "as-parsed" (section 61's caveat for EMS) but
genuinely nearly node-perfect structure - and because corruption is
synthetic and its ground truth is exactly known, this ALSO gives an
exact, domain-independent check of the corruption model's own r-to-
structure-error relationship, complementing Workstream A's real,
annotated EMS calibration once it returns.

Does not modify item_align.py, item_parser.py, or uscode_corpus.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.run_uscode_experiment
"""
from __future__ import annotations

import copy
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))  # backend/ on sys.path

import app.research.cross_edition.item_align as item_align  # noqa: E402
from app.research.cross_edition.item_parser import Item  # noqa: E402
from app.research.cross_edition.uscode_corpus import (  # noqa: E402
    parse_uscode_xml, to_parsed_edition, usc_ground_truth,
)
from app.research.cross_edition.structure_ablation import corrupt_edition  # noqa: E402
from app.research.cross_edition.baseline_b2 import align_items_b2  # noqa: E402
from app.research.cross_edition.baseline_b5 import align_items_b5  # noqa: E402
from app.research.cross_edition.annotation import _norm_answer  # noqa: E402

SP = r"C:\Users\Faisal\AppData\Local\Temp\claude\C--Users-Faisal-Desktop-research-paper\1642f160-3dba-4100-baa8-850fde74b388\scratchpad\protocols\uscode"
OLD_XML = f"{SP}\\117-81\\usc18.xml"
NEW_XML = f"{SP}\\118-158\\usc18.xml"
OLD_ID = "usc18@117-81"
NEW_ID = "usc18@118-158"

RATES = [0.0, 0.05, 0.10, 0.20, 0.35, 0.50]
N_SEEDS = 5
BASE = Path(__file__).parent / "annotation_packets"


def build_corpus():
    old_sections = parse_uscode_xml(OLD_XML)
    new_sections = parse_uscode_xml(NEW_XML)
    old_ed = to_parsed_edition(old_sections, OLD_ID)
    new_ed = to_parsed_edition(new_sections, NEW_ID)
    for it in old_ed.items:
        it._orig_id = it.item_id
    for it in new_ed.items:
        it._orig_id = it.item_id
    gt = usc_ground_truth(old_sections, new_sections)
    return old_ed, new_ed, gt


def score_method_result(all_results, gt: dict[str, str]) -> tuple[int, int]:
    correct = total = 0
    by_orig = {rec["old_item"]._orig_id: rec for rec in all_results}
    for old_id, truth in gt.items():
        rec = by_orig.get(old_id)
        if rec is None:
            continue
        total += 1
        pred = rec["new_item"].item_id if rec["new_item"] is not None else "NONE"
        pred_norm = _norm_answer(pred)
        truth_norm = _norm_answer(truth)
        if pred_norm == truth_norm:
            correct += 1
    return correct, total


def run_method_at_rate(old_ed, new_ed, rate: float, seed: int, gt: dict[str, str]) -> float:
    rng_old = random.Random(seed * 2)
    rng_new = random.Random(seed * 2 + 1)
    corrupted_old = corrupt_edition(old_ed, rate, rng_old)
    corrupted_new = corrupt_edition(new_ed, rate, rng_new)
    fake = {OLD_ID: corrupted_old, NEW_ID: corrupted_new}

    def fake_parse(path, doc_id=None, _fe=fake):
        return _fe[path]

    orig_parse = item_align.parse
    item_align.parse = fake_parse
    try:
        result = item_align.align_items(OLD_ID, NEW_ID)
    finally:
        item_align.parse = orig_parse

    correct, total = score_method_result(result["_all_results"], gt)
    return correct / total if total else 0.0


def score_baseline(all_results_key: str, results, gt: dict[str, str]) -> float:
    by_old = {r["old_item_id"]: r[all_results_key] for r in results}
    correct = total = 0
    for old_id, truth in gt.items():
        pred = by_old.get(old_id, "NONE")
        total += 1
        if _norm_answer(pred) == _norm_answer(truth):
            correct += 1
    return correct / total if total else 0.0


def main():
    print("Building US Code Title 18 corpus (117-81 -> 118-158)...")
    old_ed, new_ed, gt = build_corpus()
    print(f"old items: {len(old_ed.items)}  new items: {len(new_ed.items)}  "
          f"ground-truth entries: {len(gt)}")

    report: dict = {"n_items": len(gt)}

    # r=0 validity: method accuracy at essentially-perfect structure.
    r0_acc = run_method_at_rate(old_ed, new_ed, 0.0, seed=1, gt=gt)
    print(f"\nr=0 (near-perfect structure) method accuracy: {r0_acc:.4f}")
    report["r0_method_accuracy"] = round(r0_acc, 4)

    print("\nRunning B2/B5 baselines (structure-invariant, computed once)...")
    # B2/B5 operate on parse() output directly - monkeypatch once, call, restore.
    fake0 = {OLD_ID: old_ed, NEW_ID: new_ed}

    def fake_parse0(path, doc_id=None, _fe=fake0):
        return _fe[path]

    import app.research.cross_edition.baseline_b2 as b2mod
    import app.research.cross_edition.baseline_b5 as b5mod
    orig_b2_parse = b2mod.parse
    orig_b5_parse = b5mod.parse
    b2mod.parse = fake_parse0
    b5mod.parse = fake_parse0
    try:
        b2_res = align_items_b2(OLD_ID, NEW_ID)
        b5_res = align_items_b5(OLD_ID, NEW_ID)
    finally:
        b2mod.parse = orig_b2_parse
        b5mod.parse = orig_b5_parse

    b2_acc = score_baseline("b2_predicted_item_id", b2_res["_all_results"], gt)
    b5_acc = score_baseline("b5_predicted_item_id", b5_res["_all_results"], gt)
    print(f"B2 accuracy: {b2_acc:.4f}   B5 accuracy: {b5_acc:.4f}  (backend: {b5_res['backend']})")
    report["b2_accuracy"] = round(b2_acc, 4)
    report["b5_accuracy"] = round(b5_acc, 4)

    print("\n=== Sweep ===")
    by_rate: dict[float, list[float]] = {}
    for rate in RATES:
        accs = []
        for seed in range(1, N_SEEDS + 1):
            acc = run_method_at_rate(old_ed, new_ed, rate, seed, gt)
            accs.append(acc)
            print(f"  r={rate:.2f} seed={seed}: accuracy={acc:.4f}")
        by_rate[rate] = accs

    report["sweep"] = {}
    print("\n=== Summary (method vs. fixed B2/B5 reference lines) ===")
    for rate in RATES:
        accs = by_rate[rate]
        mean = sum(accs) / len(accs)
        report["sweep"][str(rate)] = {
            "mean": round(mean, 4), "range": [round(min(accs), 4), round(max(accs), 4)],
            "gap_vs_b2": round(mean - b2_acc, 4), "gap_vs_b5": round(mean - b5_acc, 4),
        }
        print(f"r={rate:.2f}: method_mean={mean:.4f}  gap_vs_B2={mean-b2_acc:+.4f}  gap_vs_B5={mean-b5_acc:+.4f}")

    monotonic = all(
        by_rate[RATES[i]] and by_rate[RATES[i + 1]] and
        (sum(by_rate[RATES[i]]) / len(by_rate[RATES[i]])) >=
        (sum(by_rate[RATES[i + 1]]) / len(by_rate[RATES[i + 1]])) - 0.01
        for i in range(len(RATES) - 1)
    )
    print(f"\nMonotonic non-increasing (tolerance 0.01): {monotonic}")
    report["monotonic"] = monotonic

    crossover_present = any(
        report["sweep"][str(r)]["gap_vs_b2"] > 0 for r in RATES
    )
    print(f"Crossover vs B2 present in tested range: {crossover_present}")
    report["crossover_vs_b2_in_range"] = crossover_present

    out = BASE / "uscode_experiment_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
