"""
Scores the VLM boundary anchor (vlm_boundaries.py) against the SAME
boundary-annotation ground truth section 64/70 used for our own parser
and Docling - reports precision and recall SEPARATELY, never F1 alone,
per the explicit lesson from section 70.3 (Docling's F1 alone would have
misrepresented a real precision/recall asymmetry).

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_vlm_calibration
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.vlm_boundaries import extract_vlm_titles  # noqa: E402
from app.research.cross_edition.annotation_packets.run_boundary_scoring import (  # noqa: E402
    load_titles, ANNOTATOR_1, ANNOTATOR_2, EDITIONS,
)
from app.research.cross_edition.annotation_packets.run_boundary_scoring_corrected import (  # noqa: E402
    score_edition_corrected,
)

BASE = Path(__file__).parent


def main():
    corrected_path = BASE / "boundary_annotation" / "boundary_scoring_corrected.json"
    with open(corrected_path, encoding="utf-8") as f:
        our_parser_scores = json.load(f)
    our_parser_all_f1 = [
        edition["corrected_f1"]
        for annotator in our_parser_scores.values()
        for edition in annotator.values()
    ]
    our_parser_mean_f1 = round(sum(our_parser_all_f1) / len(our_parser_all_f1), 4)

    results = {}
    all_f1 = []
    vlm_titles_by_edition = {}

    for slug, title, pdf in EDITIONS:
        print(f"\n=== {title} ===")
        cache_path = str(BASE / "boundary_annotation" / f"vlm_response_cache_{slug}.json")
        print("  querying VLM (gemini-3.5-flash-lite, native PDF understanding)...")
        vlm_result = extract_vlm_titles(pdf, cache_path)
        vlm_titles = vlm_result["titles"]
        print(f"  {len(vlm_titles)} VLM-reported protocol titles")
        vlm_titles_by_edition[slug] = vlm_titles

        edition_result = {"n_vlm_titles": len(vlm_titles)}
        for a_label, a_path in [("1", ANNOTATOR_1), ("2", ANNOTATOR_2)]:
            annotator_titles = load_titles(a_path, title)
            scored = score_edition_corrected(annotator_titles, vlm_titles)
            edition_result[f"annotator_{a_label}"] = scored
            all_f1.append(scored["corrected_f1"])
            print(f"  annotator {a_label}: raw_recall={scored['raw_recall']:.4f} "
                  f"corrected_recall={scored['corrected_recall']:.4f} "
                  f"precision={scored['precision']:.4f} "
                  f"corrected_f1={scored['corrected_f1']:.4f}")

        results[slug] = edition_result

    mean_f1 = sum(all_f1) / len(all_f1)
    mean_recall = sum(
        results[slug][f"annotator_{a}"]["corrected_recall"]
        for slug in results for a in ("1", "2")
    ) / (len(results) * 2)
    mean_precision = sum(
        results[slug][f"annotator_{a}"]["precision"]
        for slug in results for a in ("1", "2")
    ) / (len(results) * 2)

    print(f"\n=== VLM mean corrected F1 (n={len(all_f1)} edition x annotator points): "
          f"{mean_f1:.4f} ===")
    print(f"    mean recall: {mean_recall:.4f}   mean precision: {mean_precision:.4f}")
    print(f"Reference: our own parser's mean corrected F1: {our_parser_mean_f1}")
    print("Reference: Docling's mean corrected F1 (section 70): 0.4069 "
          "(recall 0.8765, precision 0.2572, one-point decomposition)")

    report = {
        "per_edition": results,
        "mean_f1": round(mean_f1, 4),
        "mean_recall": round(mean_recall, 4),
        "mean_precision": round(mean_precision, 4),
        "our_parser_mean_f1_reference": our_parser_mean_f1,
        "docling_reference": {"mean_f1": 0.4069, "recall": 0.8765, "precision": 0.2572},
    }
    out = BASE / "boundary_annotation" / "vlm_calibration_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out}")

    titles_out = BASE / "boundary_annotation" / "vlm_raw_titles.json"
    with open(titles_out, "w", encoding="utf-8") as f:
        json.dump(vlm_titles_by_edition, f, indent=2, ensure_ascii=False)
    print(f"wrote {titles_out}")


if __name__ == "__main__":
    main()
