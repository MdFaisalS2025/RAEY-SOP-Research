"""
Scores Docling's guideline-boundary detection against the SAME
boundary-annotation ground truth section 64 used for our own parser,
using the identical corrected_f1 methodology (run_calibration.py, reused
unchanged) - a real, second mid-range anchor for the structure-quality
curve.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_docling_calibration
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.docling_boundaries import extract_docling_headers  # noqa: E402
from app.research.cross_edition.annotation_packets.run_boundary_scoring import (  # noqa: E402
    load_titles, ANNOTATOR_1, ANNOTATOR_2, EDITIONS,
)
from app.research.cross_edition.annotation_packets.run_calibration import corrected_f1  # noqa: E402

BASE = Path(__file__).parent


def main():
    results = {}
    all_f1 = []

    for slug, title, pdf in EDITIONS:
        print(f"\n=== {title} ===")
        print("  running Docling (this takes a few minutes per edition)...")
        headers = extract_docling_headers(pdf)
        print(f"  {len(headers)} distinct Docling section headers")

        edition_result = {"n_docling_headers": len(headers)}
        for a_label, a_path in [("1", ANNOTATOR_1), ("2", ANNOTATOR_2)]:
            annotator_titles = load_titles(a_path, title)
            f1 = corrected_f1(annotator_titles, headers)
            edition_result[f"annotator_{a_label}_f1"] = round(f1, 4)
            all_f1.append(f1)
            print(f"  annotator {a_label}: corrected F1={f1:.4f}")

        results[slug] = edition_result

    mean_f1 = sum(all_f1) / len(all_f1)
    print(f"\n=== Docling mean corrected F1 (n={len(all_f1)} edition x annotator points): "
          f"{mean_f1:.4f} ===")
    print("Reference: our own parser's mean corrected F1 (FEASIBILITY.md section 64.2): 0.8034")

    report = {"per_edition": results, "mean_f1": round(mean_f1, 4),
               "our_parser_mean_f1_reference": 0.8034}
    out = BASE / "boundary_annotation" / "docling_calibration_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
