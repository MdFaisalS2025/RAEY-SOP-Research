"""
Regenerates boundary_scoring_corrected.json (audit round 4, Phase 2).

BACKGROUND: this file supplies 0.8034, the structure-detection F1 anchor
quoted throughout FEASIBILITY.md/PREREGISTRATION.md and used as the
reference point in run_docling_calibration.py. Audit round 4's code
sweep found nothing in the tree actually writes it - run_boundary_scoring.py
writes only the raw (uncorrected) boundary_scoring_report.json;
run_calibration.py's r=0 sanity-check loop computes the same per-point
corrected F1 values inline but never persists the per-edition/annotator
breakdown, only the pooled numbers folded into calibration_report.json.
The file was evidently produced once, by hand or by a since-deleted
script, and never had a reproducible generator - the exact class of gap
section 10's standing discipline exists to catch, just discovered late.

This script closes that gap: it reuses run_calibration.py's exact
correction logic (toks/best_score/the >=0.5 collision-match rule) and
run_boundary_scoring.py's raw recall/precision computation UNCHANGED -
no new methodology is introduced - and decomposes corrected_f1() into
its four constituent numbers (raw_recall, corrected_recall, precision,
corrected_f1) to match the existing file's structure exactly, so this
is a like-for-like regeneration, not a new measurement.

VALIDATION: main() asserts the regenerated pooled mean equals 0.8034
(the figure quoted everywhere in the governance documents) to 4 decimal
places. If it does not, per section 10 the discrepancy is the finding
and gets reported, not silently tuned away - see the assertion below.

Does not modify item_align.py, item_parser.py, run_boundary_scoring.py,
or run_calibration.py - imports match_guidelines, parse(), toks, and
best_score unchanged.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_boundary_scoring_corrected
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.item_parser import parse  # noqa: E402
from app.research.cross_edition.item_align import match_guidelines  # noqa: E402
from app.research.cross_edition.annotation_packets.run_boundary_scoring import (  # noqa: E402
    load_titles, ANNOTATOR_1, ANNOTATOR_2, EDITIONS,
)
from app.research.cross_edition.annotation_packets.run_calibration import (  # noqa: E402
    toks, best_score,
)

BASE = Path(__file__).parent / "boundary_annotation"

EXPECTED_POOLED_MEAN = 0.8034  # the figure quoted throughout both governance docs


def score_edition_corrected(annotator_titles: list[str], parser_titles: list[str]) -> dict:
    """Decomposes run_calibration.corrected_f1 into its four constituent
    numbers, matching boundary_scoring_corrected.json's existing
    structure exactly. Logic (match, collision detection, >=0.5 floor)
    is identical to corrected_f1 - this only separates the return value."""
    mapping = match_guidelines(annotator_titles, parser_titles)
    matched_parser = set(mapping.values())
    missed = [t for t in annotator_titles if t not in mapping]
    collision = sum(1 for t in missed if best_score(t, parser_titles) >= 0.5)

    n_annotator = max(1, len(annotator_titles))
    raw_recall = len(mapping) / n_annotator
    corrected_recall = (len(mapping) + collision) / n_annotator
    precision = len(matched_parser) / max(1, len(parser_titles))
    corrected_f1 = 2 * precision * corrected_recall / max(1e-9, precision + corrected_recall)

    return {
        "raw_recall": round(raw_recall, 4),
        "corrected_recall": round(corrected_recall, 4),
        "precision": round(precision, 4),
        "corrected_f1": round(corrected_f1, 4),
    }


def main():
    report: dict[str, dict] = {"1": {}, "2": {}}
    all_f1s: list[float] = []

    for annotator_key, path in [("1", ANNOTATOR_1), ("2", ANNOTATOR_2)]:
        for slug, title, pdf in EDITIONS:
            annotator_titles = load_titles(path, title)
            parser_titles = parse(pdf).guidelines
            result = score_edition_corrected(annotator_titles, parser_titles)
            report[annotator_key][slug] = result
            all_f1s.append(result["corrected_f1"])
            print(f"annotator {annotator_key} / {slug}: "
                  f"raw_recall={result['raw_recall']:.4f} "
                  f"corrected_recall={result['corrected_recall']:.4f} "
                  f"precision={result['precision']:.4f} "
                  f"corrected_f1={result['corrected_f1']:.4f}")

    pooled_mean = sum(all_f1s) / len(all_f1s)
    print(f"\nPooled mean corrected F1 (n={len(all_f1s)} edition x annotator points): "
          f"{pooled_mean:.4f}")
    print(f"Expected (quoted throughout governance docs): {EXPECTED_POOLED_MEAN}")

    if round(pooled_mean, 4) != EXPECTED_POOLED_MEAN:
        raise RuntimeError(
            f"REGENERATION MISMATCH: recomputed pooled mean {pooled_mean:.4f} "
            f"does not equal the {EXPECTED_POOLED_MEAN} quoted throughout "
            f"FEASIBILITY.md/PREREGISTRATION.md. Per section 10, this "
            f"discrepancy must be investigated and reported, not silently "
            f"resolved by adjusting either number to match the other."
        )
    print("MATCH: regenerated file reproduces the quoted 0.8034 anchor exactly.")

    out = BASE / "boundary_scoring_corrected.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
