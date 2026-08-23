"""
H3' second-annotator validation (audit round 4, Phase 4): closes the
2026-08-18 CRITICAL CORRECTION's open commitment - "A genuinely
independent second annotator for the same 92-item H3' packet is needed
before H3''s reliability can be stated; this is tracked as an open
follow-up, not resolved by this entry."

Two prior H3' annotators (E, F) were found to be the same duplication
failure that hit the main round's A/B pair (run_boundary_scoring.py's
docstring: "the same pattern already caught once this study - main
round A/B, H3' E/F") and were retired. Annotator_G_ANNOTATION.xlsx
exists in this directory with no generating script referencing it -
provenance not independently confirmed by any code in this tree, so it
is treated as ONE annotator whose independence has not yet been
verified, not as already-trustworthy ground truth. A fresh blind
workbook, Annotator_H_ANNOTATION.xlsx, was generated (audit round 4) to
pair with it, reusing build_annotator_workbooks.py's own instructions/
column layout/blind-design formatting unchanged.

MANDATORY FIRST STEP, before any kappa is computed: verify G and H are
NOT identical - by file hash AND by cell-level answer comparison -
exactly the independence check that should have caught the ORIGINAL
E/F duplication and now, thanks to run_boundary_scoring.py's precedent,
is applied here from the start rather than after the fact.

Does not modify item_align.py, item_parser.py, corpus_probe.py,
edition_align.py, or the frozen pipeline in any way - this is ground-
truth collection, not the method.

Run (once BOTH Annotator_G_ANNOTATION.xlsx and Annotator_H_ANNOTATION.xlsx
are completed):
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_h3prime_second_annotator
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.annotation import load_completed_xlsx, _norm_answer  # noqa: E402
from app.research.cross_edition.annotation_packets.run_4rater_analysis import cohens_kappa  # noqa: E402

BASE = Path(__file__).parent / "h3prime_tennessee_2022_2024"
ANNOTATOR_G = BASE / "Annotator_G_ANNOTATION.xlsx"
ANNOTATOR_H = BASE / "Annotator_H_ANNOTATION.xlsx"
SHEET_TITLE = "Tennessee 2022-23 -> Sept2024 (H3' follow-up)"


def verify_independence(path_g: Path, path_h: Path) -> dict:
    """Mirrors run_boundary_scoring.py's verify_independence exactly -
    the check that would have caught the ORIGINAL E/F duplication.
    Raises rather than silently proceeding on a suspicious match."""
    hash_g = hashlib.md5(path_g.read_bytes()).hexdigest()
    hash_h = hashlib.md5(path_h.read_bytes()).hexdigest()
    identical_bytes = hash_g == hash_h

    raw_g = load_completed_xlsx(str(path_g))
    raw_h = load_completed_xlsx(str(path_h))
    sheet = SHEET_TITLE[:31]
    ans_g = {sid: _norm_answer(v["correspondence"]) for sid, v in raw_g.get(sheet, {}).items()}
    ans_h = {sid: _norm_answer(v["correspondence"]) for sid, v in raw_h.get(sheet, {}).items()}
    identical_answers = ans_g == ans_h and len(ans_g) > 0

    report = {
        "hash_g": hash_g, "hash_h": hash_h, "identical_bytes": identical_bytes,
        "n_answers_g": len(ans_g), "n_answers_h": len(ans_h),
        "identical_answers": identical_answers,
    }
    print(f"Independence check: {report}")
    if identical_bytes:
        raise RuntimeError("Annotator G/H files are byte-identical - collection "
                            "failure, not agreement. Do not proceed.")
    if identical_answers:
        raise RuntimeError("Annotator G/H answers are identical despite different "
                            "file bytes - the same pattern that caught the original "
                            "E/F duplication (and the main round's A/B pair). "
                            "Treat as unverified until re-collected.")
    return report


def _n_filled(path: Path) -> int:
    """Distinguishes 'file missing' from 'file exists but is still a blank
    template' - audit round 4 found Annotator_G_ANNOTATION.xlsx exists but
    has 0/92 filled correspondence cells, which the original 'file exists'
    check alone would have missed, treating a blank template as complete."""
    raw = load_completed_xlsx(str(path))
    sheet = SHEET_TITLE[:31]
    return sum(1 for v in raw.get(sheet, {}).values() if v.get("correspondence"))


def main():
    if not ANNOTATOR_G.exists() or not ANNOTATOR_H.exists():
        print(f"Waiting for both files to exist at:\n  {ANNOTATOR_G}\n  {ANNOTATOR_H}")
        return

    n_g, n_h = _n_filled(ANNOTATOR_G), _n_filled(ANNOTATOR_H)
    if n_g == 0 or n_h == 0:
        print(f"Files exist but are not yet completed - {n_g}/92 filled (G), "
              f"{n_h}/92 filled (H). Waiting for both to be filled in.")
        return
    if n_g < 92 or n_h < 92:
        print(f"WARNING: partially completed - {n_g}/92 (G), {n_h}/92 (H). "
              f"Proceeding to score only the rows both annotators completed.")

    verify_independence(ANNOTATOR_G, ANNOTATOR_H)

    raw_g = load_completed_xlsx(str(ANNOTATOR_G))
    raw_h = load_completed_xlsx(str(ANNOTATOR_H))
    sheet = SHEET_TITLE[:31]
    ans_g = {sid: _norm_answer(v["correspondence"]) for sid, v in raw_g[sheet].items()}
    ans_h = {sid: _norm_answer(v["correspondence"]) for sid, v in raw_h[sheet].items()}

    kappa_report = cohens_kappa(ans_g, ans_h)
    print(f"\nCohen's kappa (G/H, H3' 92-item packet): {kappa_report['cohens_kappa']}")
    print(f"  observed agreement: {kappa_report['observed_agreement']}  "
          f"n={kappa_report['n']}  disagreements={len(kappa_report['disagreements'])}")

    out = BASE / "h3prime_second_annotator_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"independence_check": verify_independence(ANNOTATOR_G, ANNOTATOR_H),
                    "cohens_kappa": kappa_report}, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
