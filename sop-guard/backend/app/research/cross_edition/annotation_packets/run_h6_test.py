"""
One-off driver: tests H6 (PREREGISTRATION.md's 2026-08-24 "H6 (new)" entry)
- "T5 (moved guidelines) tier precision is below 50%" - against the
Massachusetts pairs' T5 population, per that entry's pre-committed design.

H6 is a "problem exists" claim, unlike H3/H4/H5's "method works" claims -
confirming H6 means the CI's UPPER bound sits below 0.50, the opposite
direction from every other confirmation criterion in this study. Stated
here exactly as pre-registered, before this script computes anything.

Ground truth: K/L majority vote on the seventh confirmatory pair
(Massachusetts v2025.1->v2026.1), the only one of the two new MA pairs
with a nonzero T5 population (v2026.1->v2026.2 has none, per
run_ma_pairs_metrics.py's own result).

Not part of the pipeline itself. Does not modify item_align.py,
item_parser.py, corpus_probe.py, or edition_align.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_h6_test
"""
from __future__ import annotations

import csv
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.annotation import (  # noqa: E402
    load_completed_xlsx, _norm_answer, majority_vote,
)

BASE = Path(__file__).parent
ANNOTATOR_K = BASE / "Annotator_K_ANNOTATION.xlsx"
ANNOTATOR_L = BASE / "Annotator_L_ANNOTATION.xlsx"
SHEET = "Massachusetts v2025.1→v2026.1 ("
SLUG = "massachusetts_v20251_v20261"
N_BOOT = 10000
SEED = 20261017
CONFIRM_THRESHOLD = 0.50


def build_ground_truth() -> dict[str, str]:
    raw_k = load_completed_xlsx(str(ANNOTATOR_K))
    raw_l = load_completed_xlsx(str(ANNOTATOR_L))
    norm_k = {sid: _norm_answer(v["correspondence"]) for sid, v in raw_k[SHEET].items()}
    norm_l = {sid: _norm_answer(v["correspondence"]) for sid, v in raw_l[SHEET].items()}
    mv = majority_vote([norm_k, norm_l])
    return {sid: r["answer"] for sid, r in mv.items() if r["answer"] is not None}


def main():
    with open(BASE / SLUG / "annotation_packet.csv", encoding="utf-8") as f:
        rows = {r["sample_id"]: r for r in csv.DictReader(f)}

    gt = build_ground_truth()
    t5_ids = [sid for sid, r in rows.items() if r["tier"] == "T5_moved"]
    print(f"T5 population: n={len(t5_ids)}")

    pairs = []
    excluded_cannot_determine = 0
    for sid in t5_ids:
        truth = gt.get(sid)
        if truth is None:
            continue
        if truth == "cannot_determine":
            excluded_cannot_determine += 1
            continue
        pred = _norm_answer(rows[sid]["method_predicted_item_id"])
        pairs.append(1 if pred == truth else 0)

    n = len(pairs)
    point = sum(pairs) / n
    rng = random.Random(SEED)
    boots = []
    for _ in range(N_BOOT):
        sample = [pairs[rng.randrange(n)] for _ in range(n)]
        boots.append(sum(sample) / n)
    boots.sort()
    lo = boots[int(0.025 * N_BOOT)]
    hi = boots[min(int(0.975 * N_BOOT), N_BOOT - 1)]
    confirmed = hi < CONFIRM_THRESHOLD

    report = {
        "hypothesis": "H6: T5 tier precision is below 50% (a 'problem exists' "
                       "claim - confirmed iff CI upper bound < 0.50)",
        "test_population": f"{SLUG} T5_moved tier",
        "n_scored": n,
        "n_cannot_determine_excluded": excluded_cannot_determine,
        "point_estimate": round(point, 4),
        "ci95_low": round(lo, 4),
        "ci95_high": round(hi, 4),
        "confirm_threshold": CONFIRM_THRESHOLD,
        "H6_confirmed": confirmed,
        "prior_disclosed_evidence_not_part_of_this_test": {
            "original_4pair_T5_raw": 0.1333,
            "original_4pair_T5_weighted": 0.0615,
            "original_4pair_n": 30,
            "fifth_sixth_pair_T5": 0.0,
            "fifth_sixth_pair_n": 20,
        },
    }
    print(f"n_scored={n}  point={point:.4f}  95% CI=[{lo:.4f}, {hi:.4f}]")
    print(f"H6 CONFIRMED (T5 is unreliable): {confirmed}")

    out_path = BASE / "h6_test_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
