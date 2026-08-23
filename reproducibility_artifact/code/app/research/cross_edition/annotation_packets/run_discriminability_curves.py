"""
Discriminability curves for B2/B5 against §61's structure-quality
ablation (audit round 4, Phase 3b).

BACKGROUND: structure_ablation.py holds B2/B5's accuracy FIXED as flat
reference lines across every corruption rate, on the argument that both
operate purely on `.text` and the corruption only ever mutates
`.guideline`/`.item_id` - so their predictions are "provably invariant."
structure_ablation.py cites a function, verify_b2_b5_invariance, as
having checked this. Audit round 4's code sweep found that function is
never called anywhere, and its body doesn't actually compare corrupted
vs clean predictions even if it were - the invariance claim was asserted,
not verified. See PREREGISTRATION.md's 2026-08-23 pre-commitment entry
for the full account.

This script actually runs B2 and B5 against the SAME corrupted editions,
at the SAME (rate, seed) pairs, using the IDENTICAL random corruption
instance structure_ablation.run_trial already used for the method's own
curve - so any accuracy difference is a true discriminability comparison,
not an artifact of independently-sampled corruption.

SCORING SUBTLETY: corruption rewrites `.item_id` to reflect the new
merged guideline title. A predicted item's corrupted id string would
therefore spuriously fail to match ground truth even when the correct
underlying item (by position) was selected. Scored via `_orig_id`
(stamped pre-corruption), exactly mirroring how structure_ablation's own
run_trial scores the method - not a new scoring convention invented for
this script.

B2 reimplemented inline using item_align._sim/_SIM_FLOOR imported
unchanged (the identical functions baseline_b2.py itself uses - not a
new similarity metric). B5 reuses baseline_b5.greedy_match_from_embeddings
unchanged, called directly on corrupted items. Embeddings for B5 are
computed ONCE on the clean item texts and reused across every rate/seed,
since corruption never touches `.text` and item order is preserved by
corrupt_edition's deepcopy.

Does not modify item_align.py, item_parser.py, structure_ablation.py,
baseline_b2.py, or baseline_b5.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_discriminability_curves
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.item_align import _sim, _SIM_FLOOR  # noqa: E402
from app.research.cross_edition.baseline_b5 import (  # noqa: E402
    greedy_match_from_embeddings, _SIM_FLOOR as B5_SIM_FLOOR,
)
from app.rag.embeddings import get_embedding_provider  # noqa: E402
from app.research.cross_edition.annotation_packets.run_h3_test import PAIRS  # noqa: E402
from app.research.cross_edition.structure_ablation import (  # noqa: E402
    corrupt_edition, load_and_stamp, build_sample_index, RATES,
)
from app.research.cross_edition.annotation import _norm_answer  # noqa: E402

BASE = Path(__file__).parent

# Known-good r=0 reference values (n=233), confirmed exactly reproduced by
# every other driver in this study (run_full_comparison.py, b5_comparison_report.json).
EXPECTED_B2_R0 = 0.7597
EXPECTED_B5_R0 = 0.7811

# Seed count reduced from the method's own 5 to 2 per non-zero rate (r=0
# needs none - corrupt_edition returns unrandomized when rate<=0), decided
# BEFORE running per the 2026-08-23 PREREGISTRATION.md pre-commitment entry:
# a single B2 trial timed at 21.6s/pair x 4 pairs; the full 6x5x4 grid would
# run ~70 minutes. 2 seeds still spans the full rate range; since B2/B5 never
# read .guideline/.item_id, a specific corruption instance mattering at one
# seed but not another would itself be informative, not merely under-sampled.
SEEDS_FOR_RATE = {rate: ([1] if rate <= 0 else [1, 2]) for rate in RATES}


def b2_predict_corrupted(old_items, new_items) -> dict[str, str]:
    """Reimplements baseline_b2.align_items_b2's exact matching loop
    (item_align._sim, item_align._SIM_FLOOR, greedy one-to-one consumption,
    unchanged) against already-parsed (possibly corrupted) item lists,
    scored by _orig_id rather than the (possibly corrupted) .item_id."""
    consumed: set[str] = set()  # keyed by corrupted item_id - consumption
                                  # is about which OBJECT is taken, and the
                                  # corrupted item_id remains a valid unique
                                  # key for that (it's still 1:1 with items).
    preds: dict[str, str] = {}  # orig_id -> predicted _orig_id or "NONE"
    for a in old_items:
        pool = [x for x in new_items if x.item_id not in consumed]
        best, best_s = None, 0.0
        for x in pool:
            s = _sim(a.text, x.text)
            if s > best_s:
                best, best_s = x, s
        matched = best is not None and best_s >= _SIM_FLOOR
        if matched:
            consumed.add(best.item_id)
        preds[a._orig_id] = best._orig_id if matched else "NONE"
    return preds


def b5_predict_corrupted(old_items, new_items, old_vecs, new_vecs, provider) -> dict[str, str]:
    """Reuses baseline_b5.greedy_match_from_embeddings unchanged - the
    embeddings passed in are the CLEAN-text embeddings (identical to
    corrupted-text embeddings since corruption never touches .text),
    computed once by the caller and reused across every rate/seed."""
    raw = greedy_match_from_embeddings(old_items, new_items, old_vecs, new_vecs,
                                        provider, B5_SIM_FLOOR)
    preds: dict[str, str] = {}
    by_item_id = {it.item_id: it for it in new_items}
    for a, rec in zip(old_items, raw):
        pred_id = rec["b5_predicted_item_id"]
        if pred_id == "NONE":
            preds[a._orig_id] = "NONE"
        else:
            preds[a._orig_id] = by_item_id[pred_id]._orig_id
    return preds


def main():
    pair_paths = {pair: (old_pdf, new_pdf) for pair, (slug, old_pdf, new_pdf) in PAIRS.items()}

    print("Loading and stamping corpus (reusing structure_ablation.load_and_stamp)...")
    cache = load_and_stamp()
    sample_index = build_sample_index()

    print("Pre-computing B5 embeddings ONCE on clean item text "
          "(reused across every rate/seed - corruption never touches .text)...")
    provider = get_embedding_provider(backend="auto", model_name="BAAI/bge-small-en-v1.5")
    clean_vecs: dict[str, list] = {}
    for pair, (old_pdf, new_pdf) in pair_paths.items():
        for path in (old_pdf, new_pdf):
            if path in clean_vecs:
                continue
            clean_vecs[path] = provider.embed_texts([it.text for it in cache[path].items])

    summary = {}
    all_trials = []
    for rate in RATES:
        b2_accs, b5_accs = [], []
        for seed in SEEDS_FOR_RATE[rate]:
            b2_correct = b2_total = 0
            b5_correct = b5_total = 0
            for pair, (old_pdf, new_pdf) in pair_paths.items():
                rng_old = random.Random(seed * 2)      # IDENTICAL seed scheme to
                rng_new = random.Random(seed * 2 + 1)  # structure_ablation.run_trial
                corrupted_old = corrupt_edition(cache[old_pdf], rate, rng_old)
                corrupted_new = corrupt_edition(cache[new_pdf], rate, rng_new)

                b2_preds = b2_predict_corrupted(corrupted_old.items, corrupted_new.items)
                b5_preds = b5_predict_corrupted(
                    corrupted_old.items, corrupted_new.items,
                    clean_vecs[old_pdf], clean_vecs[new_pdf], provider,
                )

                for idx, truth in sample_index.get(pair, []):
                    old_orig_id = cache[old_pdf].items[idx]._orig_id
                    b2_pred = _norm_answer(b2_preds.get(old_orig_id, "NONE"))
                    b5_pred = _norm_answer(b5_preds.get(old_orig_id, "NONE"))
                    b2_correct += 1 if b2_pred == truth else 0
                    b5_correct += 1 if b5_pred == truth else 0
                    b2_total += 1
                    b5_total += 1

            b2_acc = round(b2_correct / b2_total, 4)
            b5_acc = round(b5_correct / b5_total, 4)
            b2_accs.append(b2_acc)
            b5_accs.append(b5_acc)
            all_trials.append({"rate": rate, "seed": seed, "b2_accuracy": b2_acc,
                                "b5_accuracy": b5_acc, "n": b2_total})
            print(f"  r={rate:.2f} seed={seed}: B2={b2_acc}  B5={b5_acc}  n={b2_total}")

        summary[rate] = {
            "b2_mean": round(sum(b2_accs) / len(b2_accs), 4),
            "b2_range": [round(min(b2_accs), 4), round(max(b2_accs), 4)],
            "b5_mean": round(sum(b5_accs) / len(b5_accs), 4),
            "b5_range": [round(min(b5_accs), 4), round(max(b5_accs), 4)],
        }

    print("\n=== Invariance check: r=0 must match the known-good reference values ===")
    r0 = summary[0.0]
    b2_invariant = r0["b2_range"] == [r0["b2_mean"], r0["b2_mean"]] and \
        abs(r0["b2_mean"] - EXPECTED_B2_R0) < 0.0001
    b5_invariant = r0["b5_range"] == [r0["b5_mean"], r0["b5_mean"]] and \
        abs(r0["b5_mean"] - EXPECTED_B5_R0) < 0.0001
    print(f"  B2 @ r=0: mean={r0['b2_mean']} range={r0['b2_range']} "
          f"(expected {EXPECTED_B2_R0}) -> {'PASS' if b2_invariant else 'FAIL'}")
    print(f"  B5 @ r=0: mean={r0['b5_mean']} range={r0['b5_range']} "
          f"(expected {EXPECTED_B5_R0}) -> {'PASS' if b5_invariant else 'FAIL'}")

    print("\n=== Full-sweep invariance: is accuracy bit-identical across EVERY rate? ===")
    all_b2 = {t["b2_accuracy"] for t in all_trials}
    all_b5 = {t["b5_accuracy"] for t in all_trials}
    b2_fully_invariant = len(all_b2) == 1
    b5_fully_invariant = len(all_b5) == 1
    print(f"  B2 distinct accuracy values across all {len(all_trials)} trials: "
          f"{sorted(all_b2)} -> {'INVARIANT' if b2_fully_invariant else 'NOT INVARIANT'}")
    print(f"  B5 distinct accuracy values across all {len(all_trials)} trials: "
          f"{sorted(all_b5)} -> {'INVARIANT' if b5_fully_invariant else 'NOT INVARIANT'}")

    report = {
        "per_rate": {str(r): summary[r] for r in RATES},
        "all_trials": all_trials,
        "r0_validity": {
            "b2_pass": b2_invariant, "b5_pass": b5_invariant,
            "expected_b2_r0": EXPECTED_B2_R0, "expected_b5_r0": EXPECTED_B5_R0,
        },
        "full_sweep_invariance": {
            "b2_invariant": b2_fully_invariant, "b2_distinct_values": sorted(all_b2),
            "b5_invariant": b5_fully_invariant, "b5_distinct_values": sorted(all_b5),
        },
    }
    out = BASE / "discriminability_curves_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
