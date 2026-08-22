"""
Calibrates structure_ablation.py's synthetic corruption-rate axis (r) against
REAL, measured structure-detection F1 (Workstream A, novelty-audit plan).

Two things happened when the boundary-annotation workbooks were scored
(run_boundary_scoring.py) that are folded in here, both logged as dated
deviations in PREREGISTRATION.md rather than silently corrected:

1. The independence check failed on the first submission (a genuine user
   mistake - the same file re-uploaded under the wrong name) and passed
   on the corrected resubmission (0/4 editions with identical title
   lists - real, independent data).

2. A real measurement artifact was found in match_guidelines' containment-
   biased scoring (already documented as a known weakness, Appendix B
   item 3 of PREREGISTRATION.md): a short annotator title (e.g.
   "Hypothermia") can lose its rightful match to a longer sibling title
   containing it as a substring (e.g. "Induced Hypothermia Following
   ROSC"), because both score a perfect 1.0 against a short parser
   guideline title under j = overlap / min(len_a, len_b). Confirmed
   directly: parser's "Hypothermia" guideline was matched by "Induced
   Hypothermia Following ROSC", not the annotator's own "Hypothermia"
   entry. Quantified: this collision explains ~20-27% of "missed"
   entries; the majority (~73-80%) have no plausible parser match at
   all under ANY consumption order - genuine recall failures, not an
   artifact. A corrected recall/F1 (treating collision-artifact misses
   as matched, since they represent a real, findable correspondence the
   greedy algorithm lost the race on, not a genuine gap) is used for
   calibration. Raw (uncorrected) numbers remain in
   boundary_scoring_report.json, unedited.

Does not modify item_align.py, item_parser.py, or structure_ablation.py -
reuses corrupt_edition() and match_guidelines() unchanged.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_calibration
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.item_parser import parse as real_parse  # noqa: E402
from app.research.cross_edition.item_align import match_guidelines, _norm  # noqa: E402
from app.research.cross_edition.structure_ablation import corrupt_edition, RATES, N_SEEDS  # noqa: E402
from app.research.cross_edition.annotation_packets.run_boundary_scoring import (  # noqa: E402
    load_titles, ANNOTATOR_1, ANNOTATOR_2, EDITIONS,
)

BASE = Path(__file__).parent / "boundary_annotation"


def toks(t: str) -> set[str]:
    return {w for w in _norm(t).split() if len(w) > 2}


def best_score(title: str, parser_titles: list[str]) -> float:
    tt = toks(title)
    if not tt:
        return 0.0
    best = 0.0
    for p in parser_titles:
        tp = toks(p)
        if not tp:
            continue
        j = len(tt & tp) / min(len(tt), len(tp))
        if j > best:
            best = j
    return best


def corrected_f1(annotator_titles: list[str], parser_titles: list[str]) -> float:
    mapping = match_guidelines(annotator_titles, parser_titles)
    matched_parser = set(mapping.values())
    missed = [t for t in annotator_titles if t not in mapping]
    collision = sum(1 for t in missed if best_score(t, parser_titles) >= 0.5)

    corrected_matched = len(mapping) + collision
    recall = corrected_matched / max(1, len(annotator_titles))
    precision = len(matched_parser) / max(1, len(parser_titles))
    return 2 * precision * recall / max(1e-9, precision + recall)


def main():
    # Load annotator ground truth once.
    gt = {}
    for slug, title, pdf in EDITIONS:
        gt[slug] = {
            "1": load_titles(ANNOTATOR_1, title),
            "2": load_titles(ANNOTATOR_2, title),
            "pdf": pdf,
        }

    # r=0 sanity check: must reproduce boundary_scoring_corrected.json's
    # numbers exactly (no corruption applied = the real parsed edition).
    print("=== r=0 sanity check (must match boundary_scoring_corrected.json) ===")
    for slug, d in gt.items():
        parser_titles = real_parse(d["pdf"]).guidelines
        for a in ("1", "2"):
            f1 = corrected_f1(d[a], parser_titles)
            print(f"  {slug} / annotator {a}: F1={f1:.4f}")

    print("\n=== Sweep: F1 vs corruption rate r ===")
    report: dict = {"per_rate": {}}
    for r in RATES:
        rng_base_seed = 1000  # independent of structure_ablation's own seeds
        f1s = []
        for seed in range(1, N_SEEDS + 1):
            rng = random.Random(rng_base_seed + seed)
            for slug, d in gt.items():
                ed = real_parse(d["pdf"])
                for it in ed.items:
                    it._orig_id = it.item_id
                corrupted = corrupt_edition(ed, r, rng)
                parser_titles = sorted({it.guideline for it in corrupted.items})
                for a in ("1", "2"):
                    f1s.append(corrected_f1(d[a], parser_titles))
        mean_f1 = sum(f1s) / len(f1s)
        report["per_rate"][str(r)] = {"mean_f1": round(mean_f1, 4), "n": len(f1s)}
        print(f"  r={r:.2f}: mean_F1={mean_f1:.4f}  (n={len(f1s)})")

    # Where does the REAL observed corpus (r=0, measured F1≈0.80) sit,
    # and what does that say about the already-computed accuracy curve
    # (structure_ablation_report.json)?
    real_f1 = report["per_rate"][str(RATES[0])]["mean_f1"]
    report["real_corpus_f1_at_r0"] = real_f1
    report["note_on_r0_discrepancy"] = (
        "This sweep's r=0 F1 differs slightly (~1 point) from the standalone "
        "boundary_scoring_corrected.json r=0 numbers (0.8034 pooled-by-edition "
        "mean vs this sweep's 0.7940 flat mean): parser_titles here is derived "
        "from corrupt_edition's output items (sorted({it.guideline for it in "
        "corrupted.items})), which necessarily excludes zero-item guidelines "
        "the raw ParsedEdition.guidelines attribute includes (corrupt_edition "
        "only ever operates on items, so it cannot preserve or corrupt a "
        "guideline with no items under it). Used here for consistency across "
        "every r in this sweep (the same derivation at every point), at the "
        "cost of a small, well-understood offset from the standalone check. "
        "Both are legitimate, slightly different definitions of a 'detected "
        "guideline' - stated plainly rather than silently reconciled."
    )
    print(f"\nReal corpus (r=0) measured structure F1: {real_f1:.4f}")
    print("Cross-reference: DocLayNet (diverse real documents) ~0.81-0.816 mAP; "
          "PubLayNet (scientific only) ~0.97.")

    out = BASE / "calibration_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
