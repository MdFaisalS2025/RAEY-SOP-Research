"""
Tie-break stability check (2026-08-18 full-project audit, Phase 2).

`item_align.match_guidelines`' containment-biased score
(`j = overlap / min(len_a, len_b)`) produces MULTIPLE perfect (1.0)
candidates for a substantial fraction of old guidelines in the two
Connecticut pairs - measured directly (not estimated): 31/92 (34%) for
v2022.1->v2023.1, 33/93 (35%) for v2023.1->v2024.1. Tennessee: 0/69.
Pennsylvania: 2/51. Ties are broken by `pairs.sort(reverse=True)` -
alphabetical descending order on the title strings themselves, which is
deterministic but arbitrary with respect to anything the method is
actually trying to measure. For roughly a third of Connecticut, which
new guideline an old one maps to has never been tested for whether it
would come out the same way under a different, equally-valid tie-break
rule.

THE CHECK
---------
`match_guidelines_randomized(old_titles, new_titles, rng)`: an EXACT
copy of the frozen `match_guidelines`'s scoring logic (same token-set
overlap, same _TITLE_FLOOR=0.5, same containment bias) - the ONLY
difference is that ties are broken by a per-pair random draw instead of
alphabetical string order. This is a sensitivity-analysis variant, not
a replacement; `item_align.py` is never modified.

Monkeypatches `item_align.match_guidelines` for the duration of each
trial (same pattern `structure_ablation.py` already uses for `parse`),
re-runs the real, otherwise-unmodified `align_items` on the four
already-sampled pairs, and rescores the SAME 233 already-sampled items
(sample is held fixed - only how the method's own prediction is
computed varies) against the SAME already-collected ground truth.

Identity across trials is tracked by PARSE-ORDER INDEX (see
sample_join.py), not by the post-remap item_id - remapped ids are
exactly what varies here by construction, so string identity would be
meaningless; parse order (item_parser.py's own deterministic output
order) does not depend on match_guidelines at all and is stable across
every trial.

Does not modify item_align.py, item_parser.py, corpus_probe.py, or
edition_align.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.tiebreak_sensitivity
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

import app.research.cross_edition.item_align as item_align  # noqa: E402
from app.research.cross_edition.item_align import _norm, _TITLE_FLOOR  # noqa: E402

import app.research.cross_edition.annotation_packets.run_h3_test as _rt  # noqa: E402
_rt.ANNOTATOR_FILES = {k: rf"C:\Users\Faisal\Desktop\research paper\Annotator_{k}.xlsx" for k in "ABCD"}
_rt.ADJUDICATION_FILE = r"C:\Users\Faisal\Desktop\research paper\Adjudication_43_items_completed.xlsx"

from app.research.cross_edition.annotation import _norm_answer  # noqa: E402
from app.research.cross_edition.annotation_packets.run_h3_test import (  # noqa: E402
    PAIRS, build_ground_truth,
)
from app.research.cross_edition.annotation_packets.sample_join import (  # noqa: E402
    build_index_join,
)

BASE = Path(__file__).parent
N_SEEDS = 20  # more than structure_ablation's 5: this checks stability of a
              # discrete combinatorial choice, not a continuous rate, and
              # cheaper per-trial (no PDF re-parsing, guideline titles only)


def match_guidelines_randomized(old_titles, new_titles, rng: random.Random):
    """Identical to item_align.match_guidelines except tie-break: a random
    per-pair draw instead of alphabetical descending string order."""
    def toks(t):
        return {w for w in _norm(t).split() if len(w) > 2}

    pairs = []
    for o in old_titles:
        to = toks(o)
        if not to:
            continue
        for n in new_titles:
            tn = toks(n)
            if not tn:
                continue
            j = len(to & tn) / min(len(to), len(tn))
            if j >= _TITLE_FLOOR:
                pairs.append((j, rng.random(), o, n))

    pairs.sort(key=lambda p: (p[0], p[1]), reverse=True)
    mapping: dict[str, str] = {}
    used_new: set[str] = set()
    for _, _, o, n in pairs:
        if o in mapping or n in used_new:
            continue
        mapping[o] = n
        used_new.add(n)
    return mapping


def run_trial(seed: int, sample_index: dict[str, list[tuple[str, int, str]]],
              ground_truth: dict) -> float:
    """sample_index: {pair: [(sample_id, parse_order_index, tier), ...]}
    (built once, outside the trial loop, from the ORIGINAL unpatched run).
    Returns pooled raw accuracy for this trial's randomized-tiebreak method."""
    rng = random.Random(seed)

    def patched(old_titles, new_titles):
        return match_guidelines_randomized(old_titles, new_titles, rng)

    orig_fn = item_align.match_guidelines
    item_align.match_guidelines = patched
    try:
        correct = total = 0
        for pair, (slug, old_pdf, new_pdf) in PAIRS.items():
            result = item_align.align_items(old_pdf, new_pdf)
            all_results = result["_all_results"]
            gt = ground_truth[pair]
            for sid, idx, _tier in sample_index[pair]:
                if sid not in gt:
                    continue
                truth = gt[sid]
                if truth == "cannot_determine":
                    continue
                rec = all_results[idx]
                new_item = rec["new_item"]
                pred = _norm_answer(new_item.item_id if new_item else "NONE")
                total += 1
                if pred == truth:
                    correct += 1
        return correct / total if total else 0.0
    finally:
        item_align.match_guidelines = orig_fn


def build_sample_index() -> dict[str, list[tuple[str, int, str]]]:
    """One-time, using the ORIGINAL (unpatched) match_guidelines - this is
    what the sample was actually drawn against, unaffected by this check."""
    import csv
    out: dict[str, list[tuple[str, int, str]]] = {}
    for pair, (slug, old_pdf, new_pdf) in PAIRS.items():
        id_to_index, _ = build_index_join(old_pdf, new_pdf)
        with open(BASE / slug / "annotation_packet.csv", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        out[pair] = [(r["sample_id"], id_to_index[r["old_item_id"]], r["tier"]) for r in rows]
    return out


def main():
    print("Building sample index (original, unpatched match_guidelines)...")
    sample_index = build_sample_index()
    ground_truth = build_ground_truth()

    baseline_acc = run_trial(seed=-1, sample_index=sample_index, ground_truth=ground_truth)
    print(f"Baseline check (seed=-1, should differ from the real alphabetical "
          f"tie-break only where ties exist): accuracy={baseline_acc:.4f}")

    accs = []
    for seed in range(1, N_SEEDS + 1):
        acc = run_trial(seed, sample_index, ground_truth)
        accs.append(acc)
        print(f"  seed={seed}: accuracy={acc:.4f}")

    mean_acc = sum(accs) / len(accs)
    spread = max(accs) - min(accs)
    print(f"\nmean={mean_acc:.4f}  min={min(accs):.4f}  max={max(accs):.4f}  "
          f"spread={spread:.4f}")
    print("Reference (alphabetical tie-break, the actually-reported number): 0.7124")

    report = {
        "n_seeds": N_SEEDS, "accuracies": accs,
        "mean": round(mean_acc, 4), "min": round(min(accs), 4),
        "max": round(max(accs), 4), "spread": round(spread, 4),
        "reference_alphabetical_tiebreak_accuracy": 0.7124,
    }
    out = BASE / "tiebreak_sensitivity_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
