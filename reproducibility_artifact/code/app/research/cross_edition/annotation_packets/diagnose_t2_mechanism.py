"""
One-off diagnostic (not part of the pipeline, does not touch or re-run the
frozen H3 test): quantifies how much of B2's pooled advantage over the
method (FEASIBILITY.md §53) is concentrated in bullet/sub-bullet marker
items - the marker kinds item_parser.py assigns no ordinal to, numbering
siblings purely by position, and therefore the kinds where an inserted
item shifts every later sibling's marker (item_parser.py lines 86-93) -
versus ordinary numbered/alpha/roman items, whose marker does carry an
ordinal and is not repositioned by insertion.

Classifies each of the 240 sampled items by its OLD-edition marker's last
path segment (old_marker_path, already in each annotation_packet.csv - no
re-parsing): bullet-kind if it is one of the bullet glyphs item_parser.py
recognises (the corpus_probe comment there notes NASEMSO-style glyphs
arrive as U+FFFD) or a bare "o" sub-bullet, else ordinal-kind (numeric,
alpha, roman, paren, dotted).

Reuses the identical ground-truth and B2 loading already validated in
run_h3_test.py (same functions, same files) - not a new measurement, a
different cross-tab of the same one.

AUDIT ROUND 4 FIX (2026-08-22): this script previously joined the method's
predictions to B2's by the raw old_item_id string, which item_align.py's
own remapping had already invalidated (see sample_join.py's module
docstring) - the exact "should not happen" bug run_h3_test.py carried
until the 2026-08-18 audit, present here independently because this
script pre-dates sample_join.py and was never converted. Since this
script produced FEASIBILITY.md section 54's bullet-vs-ordinal
decomposition, and Connecticut #1 (bullet-heavy) lost 21 of 58 items
(36%) to the bug, that decomposition is recomputed under the fix below,
reported side by side with the original numbers rather than silently
replacing them. A bootstrap CI on each subgroup's diff is added, closing
the gap the 2026-08-18 entry explicitly left open ("no bootstrap CI was
computed for the subgroup split").
"""
import csv
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.annotation import _norm_answer  # noqa: E402
from app.research.cross_edition.baseline_b2 import align_items_b2  # noqa: E402
from app.research.cross_edition.annotation_packets.run_h3_test import (  # noqa: E402
    PAIRS, build_ground_truth,
)
from app.research.cross_edition.annotation_packets.sample_join import (  # noqa: E402
    build_index_join, verify_sample_identity, join_baseline,
)

BASE = Path(__file__).parent

# Pre-fix numbers (id-string join, the bug), kept only as a documented
# comparison point - see FEASIBILITY.md section 54.1. Not used in any
# computation below.
PRE_FIX_REFERENCE = {
    "bullet": {"n": 72, "method_acc": 0.7222, "b2_acc": 0.9444, "diff": -0.2222},
    "ordinal": {"n": 137, "method_acc": 0.7664, "b2_acc": 0.7153, "diff": 0.0511},
}


def bootstrap_diff_ci(rows: list[dict], n_boot: int = 10000, seed: int = 20261022) -> dict:
    """Bootstrap 95% CI on the mean (method_correct - b2_correct) diff for
    one subgroup, resampling items with replacement. Unweighted (this
    diagnostic, like its pre-fix version, does not apply section 5.1's
    population reweighting - it is a descriptive decomposition, not a
    hypothesis test)."""
    rng = random.Random(seed)
    n = len(rows)
    diffs = [r["m_correct"] - r["b_correct"] for r in rows]
    point = sum(diffs) / n
    boot = []
    for _ in range(n_boot):
        sample = [diffs[rng.randrange(n)] for _ in range(n)]
        boot.append(sum(sample) / n)
    boot.sort()
    lo_i, hi_i = int(0.025 * n_boot), int(0.975 * n_boot) - 1
    return {
        "n": n, "n_bootstrap": n_boot,
        "point_estimate": round(point, 4),
        "ci95_low": round(boot[lo_i], 4),
        "ci95_high": round(boot[hi_i], 4),
    }

_BULLET_GLYPHS = {"�", "•", "▪", "●", "-"}


def _is_bullet_kind(marker_path: str) -> bool:
    if not marker_path:
        return False
    last = marker_path.split(".")[-1]
    # strip a trailing positional counter item_parser appends for uniqueness
    last = last.split("#")[0]
    return last in _BULLET_GLYPHS or last == "o"


def main():
    ground_truth = build_ground_truth()

    rows_by_kind = {"bullet": [], "ordinal": []}

    for pair, (slug, old_pdf, new_pdf) in PAIRS.items():
        packet_csv = BASE / slug / "annotation_packet.csv"
        with open(packet_csv, encoding="utf-8") as f:
            method_rows = {r["sample_id"]: r for r in csv.DictReader(f)}

        b2 = align_items_b2(old_pdf, new_pdf)
        id_to_index, _ = build_index_join(old_pdf, new_pdf)
        verify_sample_identity(packet_csv, id_to_index)  # fail loudly, not silently

        gt = ground_truth[pair]
        for sid, row in method_rows.items():
            if sid not in gt:
                continue
            truth = gt[sid]
            if truth == "cannot_determine":
                continue
            idx = id_to_index[row["old_item_id"]]  # KeyError, not silent skip, if this ever fails

            method_answer = _norm_answer(row["method_predicted_item_id"])
            b2_answer = _norm_answer(join_baseline(b2, idx, "b2_predicted_item_id"))
            m_correct = 1 if method_answer == truth else 0
            b_correct = 1 if b2_answer == truth else 0

            kind = "bullet" if _is_bullet_kind(row["old_marker_path"]) else "ordinal"
            rows_by_kind[kind].append({
                "pair": pair, "sample_id": sid, "tier": row["tier"],
                "m_correct": m_correct, "b_correct": b_correct,
            })

    print(f"{'kind':<10} {'n':>4} {'method_acc':>11} {'b2_acc':>8} {'diff':>8}  tier_T2_share")
    kind_summary = {}
    for kind, rows in rows_by_kind.items():
        n = len(rows)
        m_acc = sum(r["m_correct"] for r in rows) / n
        b_acc = sum(r["b_correct"] for r in rows) / n
        t2_share = sum(1 for r in rows if r["tier"].startswith("T2")) / n
        ci = bootstrap_diff_ci(rows)
        print(f"{kind:<10} {n:>4} {m_acc:>11.4f} {b_acc:>8.4f} {m_acc-b_acc:>8.4f}  {t2_share:.4f}")
        print(f"           bootstrap 95% CI on diff: [{ci['ci95_low']}, {ci['ci95_high']}]"
              f"  (pre-fix reference: n={PRE_FIX_REFERENCE[kind]['n']}, "
              f"diff={PRE_FIX_REFERENCE[kind]['diff']})")
        kind_summary[kind] = {
            "n": n, "method_accuracy": round(m_acc, 4), "b2_accuracy": round(b_acc, 4),
            "diff": round(m_acc - b_acc, 4), "tier_t2_share": round(t2_share, 4),
            "bootstrap_ci_on_diff": ci,
            "pre_fix_reference": PRE_FIX_REFERENCE[kind],
        }

    # Within bullet-kind items only, break out by tier the method assigned.
    print("\nBullet-kind items only, by method's assigned tier:")
    from collections import defaultdict
    by_tier = defaultdict(list)
    for r in rows_by_kind["bullet"]:
        by_tier[r["tier"]].append(r)
    bullet_by_tier = {}
    for tier, rows in sorted(by_tier.items()):
        n = len(rows)
        m_acc = sum(r["m_correct"] for r in rows) / n
        b_acc = sum(r["b_correct"] for r in rows) / n
        print(f"  {tier:<22} n={n:>3}  method_acc={m_acc:.4f}  b2_acc={b_acc:.4f}")
        bullet_by_tier[tier] = {"n": n, "method_accuracy": round(m_acc, 4), "b2_accuracy": round(b_acc, 4)}

    # Same breakdown restricted to Connecticut v2023.1->v2024.1, the pair
    # driving the statistically significant pooled effect.
    print("\nConnecticut 2023.1->2024.1 only, bullet vs ordinal:")
    ct2_breakdown = {}
    for kind in ("bullet", "ordinal"):
        rows = [r for r in rows_by_kind[kind] if r["pair"] == "Connecticut 2023.1→2024.1"]
        if not rows:
            print(f"  {kind:<10} n=0")
            ct2_breakdown[kind] = {"n": 0}
            continue
        n = len(rows)
        m_acc = sum(r["m_correct"] for r in rows) / n
        b_acc = sum(r["b_correct"] for r in rows) / n
        print(f"  {kind:<10} n={n:>3}  method_acc={m_acc:.4f}  b2_acc={b_acc:.4f}  diff={m_acc-b_acc:.4f}")
        ct2_breakdown[kind] = {
            "n": n, "method_accuracy": round(m_acc, 4), "b2_accuracy": round(b_acc, 4),
            "diff": round(m_acc - b_acc, 4),
        }

    report = {
        "_note": (
            "Recomputed under the audit-round-4 join-bug fix (see this "
            "file's module docstring). 'pre_fix_reference' in each kind's "
            "entry is the number originally reported in FEASIBILITY.md "
            "section 54.1, kept for direct comparison, not recomputed."
        ),
        "by_marker_kind": kind_summary,
        "bullet_kind_by_tier": bullet_by_tier,
        "connecticut_2023_2024_only": ct2_breakdown,
    }
    out_path = BASE / "diagnose_t2_mechanism_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
