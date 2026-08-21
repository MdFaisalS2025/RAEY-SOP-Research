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
"""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.annotation import _norm_answer  # noqa: E402
from app.research.cross_edition.baseline_b2 import align_items_b2  # noqa: E402
from app.research.cross_edition.annotation_packets.run_h3_test import (  # noqa: E402
    PAIRS, build_ground_truth,
)

BASE = Path(__file__).parent

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
        with open(BASE / slug / "annotation_packet.csv", encoding="utf-8") as f:
            method_rows = {r["sample_id"]: r for r in csv.DictReader(f)}

        b2 = align_items_b2(old_pdf, new_pdf)
        b2_by_old_id = {r["old_item_id"]: r for r in b2["_all_results"]}

        gt = ground_truth[pair]
        for sid, row in method_rows.items():
            if sid not in gt:
                continue
            truth = gt[sid]
            if truth == "cannot_determine":
                continue
            old_id = row["old_item_id"]
            b2_row = b2_by_old_id.get(old_id)
            if b2_row is None:
                continue

            method_answer = _norm_answer(row["method_predicted_item_id"])
            b2_answer = _norm_answer(b2_row["b2_predicted_item_id"])
            m_correct = 1 if method_answer == truth else 0
            b_correct = 1 if b2_answer == truth else 0

            kind = "bullet" if _is_bullet_kind(row["old_marker_path"]) else "ordinal"
            rows_by_kind[kind].append({
                "pair": pair, "sample_id": sid, "tier": row["tier"],
                "m_correct": m_correct, "b_correct": b_correct,
            })

    print(f"{'kind':<10} {'n':>4} {'method_acc':>11} {'b2_acc':>8} {'diff':>8}  tier_T2_share")
    for kind, rows in rows_by_kind.items():
        n = len(rows)
        m_acc = sum(r["m_correct"] for r in rows) / n
        b_acc = sum(r["b_correct"] for r in rows) / n
        t2_share = sum(1 for r in rows if r["tier"].startswith("T2")) / n
        print(f"{kind:<10} {n:>4} {m_acc:>11.4f} {b_acc:>8.4f} {m_acc-b_acc:>8.4f}  {t2_share:.4f}")

    # Within bullet-kind items only, break out by tier the method assigned.
    print("\nBullet-kind items only, by method's assigned tier:")
    from collections import defaultdict
    by_tier = defaultdict(list)
    for r in rows_by_kind["bullet"]:
        by_tier[r["tier"]].append(r)
    for tier, rows in sorted(by_tier.items()):
        n = len(rows)
        m_acc = sum(r["m_correct"] for r in rows) / n
        b_acc = sum(r["b_correct"] for r in rows) / n
        print(f"  {tier:<22} n={n:>3}  method_acc={m_acc:.4f}  b2_acc={b_acc:.4f}")

    # Same breakdown restricted to Connecticut v2023.1->v2024.1, the pair
    # driving the statistically significant pooled effect.
    print("\nConnecticut 2023.1->2024.1 only, bullet vs ordinal:")
    for kind in ("bullet", "ordinal"):
        rows = [r for r in rows_by_kind[kind] if r["pair"] == "Connecticut 2023.1→2024.1"]
        if not rows:
            print(f"  {kind:<10} n=0")
            continue
        n = len(rows)
        m_acc = sum(r["m_correct"] for r in rows) / n
        b_acc = sum(r["b_correct"] for r in rows) / n
        print(f"  {kind:<10} n={n:>3}  method_acc={m_acc:.4f}  b2_acc={b_acc:.4f}  diff={m_acc-b_acc:.4f}")


if __name__ == "__main__":
    main()
