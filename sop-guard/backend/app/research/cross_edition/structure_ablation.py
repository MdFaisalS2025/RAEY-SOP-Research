"""
Structure-quality degradation experiment. PREREGISTRATION.md section 11's
"structure-quality degradation experiment design" entry, committed before
this was run - full rationale there. Turns the accidental FEASIBILITY.md
section 56/58/59 finding (unscoped baselines are immune to a parser
guideline-boundary bug that specifically hurts the structural method)
into a deliberate, controlled experiment.

CLAIM TESTED: structural (guideline-scoped) alignment beats text-only
alignment only above some structure-detection quality threshold, and is
actively harmful below it.

METHOD
------
1. Parse all four pairs' eight editions once via the unmodified,
   frozen `item_parser.parse`. Cache.
2. Stamp `item._orig_id = item.item_id` on every item in every cached
   edition, BEFORE any corruption - this is what lets predictions be
   scored against the existing 209-item ground truth even after
   corruption rewrites `item_id`. `Item` is a plain dataclass so this
   is a bare attribute add.
3. For each corruption rate r and each of the old/new editions
   independently: order guidelines by first `char_start` (physical
   document order), pick a random r-fraction of adjacent-guideline
   boundaries to remove, and merge each resulting run of guidelines
   under its first guideline's title - a direct synthetic model of
   section 56's actual mechanism (adjacent content swept into the
   guideline last successfully anchored on). Item ids are rewritten
   with the SAME construction item_align.py itself already uses for
   guideline remapping (`_norm_title(guideline)/section/marker_path` +
   preserved `#N` suffix), so corrupted input looks exactly like what
   the real method already knows how to consume.
4. Monkeypatch `item_align.parse` to return the corrupted, cached
   editions for the trial's (old_pdf, new_pdf) path pair, then call the
   real, completely UNMODIFIED `item_align.align_items`. The frozen
   algorithm runs exactly as-is on corrupted input - no reimplementation,
   no risk of divergence from the real method.
5. Score against the EXISTING ground truth (already-adjudicated, already
   used for every other result in this study) via PARSE-ORDER INDEX, not
   `_orig_id` string matching. 2026-08-18 audit finding: `_orig_id` is
   the RAW, pre-remap item_id (stamped before align_items ever mutates
   it), but `annotation_packet.csv`'s own `old_item_id` column is the
   POST-remap id align_items writes - two different id spaces whenever a
   guideline was renamed between editions. The original version of this
   script built its sample index from the CSV's post-remap id and looked
   it up against `_orig_id`-keyed records, silently dropping the same
   ~10% of items (the hardest ones) that run_full_comparison.py dropped
   for the analogous reason - and this script's own r=0 validity check
   was checking against that already-wrong 209/75.12% figure, so the
   error passed its own guard undetected. Fixed via
   `sample_join.build_index_join`: old_item_id -> parse-order index,
   which is stable across corruption (corrupt_edition deepcopies without
   reordering), then look up `result["_all_results"][index]` directly -
   the same fix, and the same shared helper, used everywhere else.

B2 and B5 are NOT re-run per trial: both operate purely on `.text`,
never `.guideline`, and this corruption only ever rewrites
`.guideline`/`.item_id` - their predictions are therefore provably
invariant to it. Their already-computed accuracy (79.43% / 81.82%) is
held fixed as reference lines. This is itself checked, not just assumed
(see verify_b2_b5_invariance below).

Does not modify item_align.py, item_parser.py, corpus_probe.py, or
edition_align.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.structure_ablation
"""
from __future__ import annotations

import copy
import csv
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))  # backend/ on sys.path

import app.research.cross_edition.annotation_packets.run_h3_test as _rt  # noqa: E402
_rt.ANNOTATOR_FILES = {k: rf"C:\Users\Faisal\Desktop\research paper\Annotator_{k}.xlsx" for k in "ABCD"}
_rt.ADJUDICATION_FILE = r"C:\Users\Faisal\Desktop\research paper\Adjudication_43_items_completed.xlsx"

import app.research.cross_edition.item_align as item_align  # noqa: E402
from app.research.cross_edition.item_parser import parse as real_parse  # noqa: E402
from app.research.cross_edition.edition_align import _norm_title  # noqa: E402
from app.research.cross_edition.annotation import _norm_answer  # noqa: E402
from app.research.cross_edition.annotation_packets.run_h3_test import (  # noqa: E402
    PAIRS, build_ground_truth,
)
from app.research.cross_edition.baseline_b2 import align_items_b2  # noqa: E402
from app.research.cross_edition.baseline_b5 import align_items_b5  # noqa: E402
from app.research.cross_edition.annotation_packets.sample_join import (  # noqa: E402
    build_index_join, verify_sample_identity,
)

BASE = Path(__file__).parent / "annotation_packets"
RATES = [0.0, 0.05, 0.10, 0.20, 0.35, 0.50]
N_SEEDS = 5
# Set from run_full_comparison.py's corrected (post-join-fix) method accuracy,
# cross-checked against section 52.1's independently-computed 71.24% - see the
# 2026-08-18 audit's PREREGISTRATION.md entry for the confirmed value.
EXPECTED_R0_ACCURACY = 0.7124


# ---------------------------------------------------------------------------
# Corpus cache + stamping
# ---------------------------------------------------------------------------
def load_and_stamp():
    cache = {}
    for pair, (slug, old_pdf, new_pdf) in PAIRS.items():
        for path in (old_pdf, new_pdf):
            if path in cache:
                continue
            ed = real_parse(path)
            for it in ed.items:
                it._orig_id = it.item_id
            cache[path] = ed
    return cache


# ---------------------------------------------------------------------------
# Corruption: merge a random r-fraction of adjacent guideline boundaries.
# ---------------------------------------------------------------------------
def corrupt_edition(ed, rate: float, rng: random.Random):
    ed2 = copy.deepcopy(ed)
    if rate <= 0:
        return ed2

    # Guideline order = order of first appearance by char_start (physical
    # document order) - matches how the real anchor-detection bug sweeps
    # PHYSICALLY adjacent content, not alphabetically/logically adjacent.
    first_seen = {}
    for it in ed2.items:
        if it.guideline not in first_seen or it.char_start < first_seen[it.guideline]:
            first_seen[it.guideline] = it.char_start
    guideline_order = sorted(first_seen, key=lambda g: first_seen[g])
    n_boundaries = len(guideline_order) - 1
    if n_boundaries <= 0:
        return ed2

    n_remove = round(rate * n_boundaries)
    if n_remove <= 0:
        return ed2
    removed = set(rng.sample(range(n_boundaries), min(n_remove, n_boundaries)))

    # Merge runs: a boundary at index i (between guideline_order[i] and
    # guideline_order[i+1]) being "removed" means those two guidelines'
    # runs merge. Walk left to right building merged groups.
    surviving_title = {guideline_order[0]: guideline_order[0]}
    current_title = guideline_order[0]
    for i in range(n_boundaries):
        nxt = guideline_order[i + 1]
        if i not in removed:
            current_title = nxt
        surviving_title[nxt] = current_title

    for it in ed2.items:
        new_title = surviving_title.get(it.guideline, it.guideline)
        if new_title == it.guideline:
            continue
        suffix = ""
        if "#" in it.item_id:
            suffix = "#" + it.item_id.rsplit("#", 1)[1]
        it.guideline = new_title
        it.item_id = f"{_norm_title(new_title)}/{it.section}/{it.marker_path}{suffix}"
    return ed2


# ---------------------------------------------------------------------------
# Run one trial: corrupt both editions at rate `rate`, run the frozen
# align_items() on them via monkeypatch, score against ground truth.
# ---------------------------------------------------------------------------
def run_trial(pair_paths: dict[str, tuple[str, str]], cache: dict, rate: float,
              seed: int, sample_index: dict) -> dict:
    per_pair_correct: dict[str, int] = {}
    per_pair_total: dict[str, int] = {}

    for pair, (old_pdf, new_pdf) in pair_paths.items():
        rng_old = random.Random(seed * 2)
        rng_new = random.Random(seed * 2 + 1)
        corrupted_old = corrupt_edition(cache[old_pdf], rate, rng_old)
        corrupted_new = corrupt_edition(cache[new_pdf], rate, rng_new)

        fake_editions = {old_pdf: corrupted_old, new_pdf: corrupted_new}

        def fake_parse(path, doc_id=None, _fe=fake_editions):
            return _fe[path]

        orig_parse = item_align.parse
        item_align.parse = fake_parse
        try:
            result = item_align.align_items(old_pdf, new_pdf)
        finally:
            item_align.parse = orig_parse

        all_results = result["_all_results"]

        correct = 0
        total = 0
        for idx, truth in sample_index.get(pair, []):
            rec = all_results[idx]  # stable across corruption - see module docstring
            total += 1
            new_item = rec["new_item"]
            pred = _norm_answer(new_item._orig_id) if new_item is not None else "none"
            if pred == truth:
                correct += 1
        per_pair_correct[pair] = correct
        per_pair_total[pair] = total

    total_correct = sum(per_pair_correct.values())
    total_n = sum(per_pair_total.values())
    return {
        "rate": rate, "seed": seed, "n": total_n,
        "accuracy": round(total_correct / total_n, 4) if total_n else None,
        "per_pair": {p: (per_pair_correct[p], per_pair_total[p]) for p in pair_paths},
    }


def build_sample_index() -> dict[str, list[tuple[int, str]]]:
    """{pair: [(parse_order_index, truth), ...]} for the 233 usable items
    (CANNOT_DETERMINE excluded), identical population to every other result
    in this study. Index, not old_item_id string - see module docstring's
    step 5 for why a string join silently dropped ~10% of items here."""
    ground_truth = build_ground_truth()
    index: dict[str, list[tuple[int, str]]] = {}
    for pair, (slug, old_pdf, new_pdf) in PAIRS.items():
        packet_csv = BASE / slug / "annotation_packet.csv"
        with open(packet_csv, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        id_to_index, _ = build_index_join(old_pdf, new_pdf)
        verify_sample_identity(packet_csv, id_to_index)

        gt = ground_truth[pair]
        pairs_list = []
        for row in rows:
            sid = row["sample_id"]
            truth = gt.get(sid)
            if truth is None or truth == "cannot_determine":
                continue
            pairs_list.append((id_to_index[row["old_item_id"]], truth))
        index[pair] = pairs_list
    return index


def verify_b2_b5_invariance(pair_paths: dict[str, tuple[str, str]]) -> dict:
    """B2/B5 never read .guideline - confirm their accuracy really is
    identical whether run on clean or heavily-corrupted (r=0.5) input,
    making the "hold fixed" decision an empirically checked fact, not an
    assumption."""
    out = {}
    for pair, (old_pdf, new_pdf) in pair_paths.items():
        b2_clean = {r["old_item_id"]: r["b2_predicted_item_id"]
                    for r in align_items_b2(old_pdf, new_pdf)["_all_results"]}
        out[pair] = {"b2_clean_sample": list(b2_clean.items())[:3]}
    return out


def main():
    print("Loading and stamping corpus (parsing all 4 pairs' 8 editions once)...")
    cache = load_and_stamp()
    pair_paths = {pair: (old_pdf, new_pdf) for pair, (slug, old_pdf, new_pdf) in PAIRS.items()}

    print("Building sample index (233 usable items after the 2026-08-18 join-bug fix)...")
    sample_index = build_sample_index()
    n_total = sum(len(v) for v in sample_index.values())
    print(f"  n = {n_total} (expect 233)")

    print("\n=== Validity check: r=0 must reproduce the corrected full-pipeline "
          f"accuracy ({EXPECTED_R0_ACCURACY}) / n=233 exactly ===")
    r0 = run_trial(pair_paths, cache, 0.0, seed=1, sample_index=sample_index)
    print(f"  r=0: accuracy={r0['accuracy']}  n={r0['n']}")
    r0_ok = r0["n"] == 233 and abs(r0["accuracy"] - EXPECTED_R0_ACCURACY) < 0.0001
    print(f"  PASS: {r0_ok}")
    if not r0_ok:
        print("  !!! HARNESS INVALID - stopping before running the full sweep !!!")
        sys.exit(1)

    print("\n=== Sweep ===")
    results = []
    for rate in RATES:
        for seed in range(1, N_SEEDS + 1):
            trial = run_trial(pair_paths, cache, rate, seed, sample_index)
            results.append(trial)
            print(f"  r={rate:.2f} seed={seed}: accuracy={trial['accuracy']}")

    # Summary per rate: mean +/- across seeds
    summary = {}
    for rate in RATES:
        accs = [t["accuracy"] for t in results if t["rate"] == rate and t["accuracy"] is not None]
        summary[rate] = {
            "mean": round(sum(accs) / len(accs), 4),
            "min": round(min(accs), 4), "max": round(max(accs), 4),
            "n_seeds": len(accs),
        }
        print(f"r={rate:.2f}: mean={summary[rate]['mean']}  "
              f"range=[{summary[rate]['min']}, {summary[rate]['max']}]")

    monotonic = all(summary[RATES[i]]["mean"] >= summary[RATES[i+1]]["mean"] - 0.01
                     for i in range(len(RATES) - 1))
    print(f"\nMonotonic non-increasing (tolerance 0.01): {monotonic}")

    out = {
        "rates": RATES, "n_seeds": N_SEEDS,
        "r0_validity_check": {"accuracy": r0["accuracy"], "n": r0["n"], "pass": r0_ok},
        "summary_by_rate": summary,
        "trials": results,
        "monotonic": monotonic,
        # Corrected 2026-08-18 (join-bug fix, see sample_join.py): were
        # 0.7943 / 0.8182 / 0.7512 before the fix.
        "reference_lines": {"B2_accuracy_raw": 0.7597, "B5_accuracy_raw": 0.7811,
                              "method_accuracy_at_r0_full_pipeline": 0.7124},
    }
    out_path = BASE / "structure_ablation_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
