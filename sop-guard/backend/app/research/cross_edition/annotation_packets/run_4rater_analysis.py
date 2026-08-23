"""
One-off driver: runs the analysis plan pre-committed in PREREGISTRATION.md
section 11 (2026-08-17, "Annotation upgraded from two annotators to four")
against the four completed annotator workbooks. Not part of the pipeline
itself - a report generator over already-collected annotation data.

Per that entry:
  (a) Cohen's kappa on Annotator A / Annotator B - the primary, pre-registered
      section 5.3 statistic, unaffected by the extra two raters.
  (b) Fleiss' kappa across all four raters - supplementary robustness check.
  (c) Majority vote (>=3 of 4) as adjudicated ground truth; items without a
      majority are flagged for real discussion-based adjudication, not
      auto-resolved.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.annotation import (  # noqa: E402
    load_completed_xlsx, _norm_answer, fleiss_kappa_correspondence,
    majority_vote,
)

FILES = {
    "A": r"C:\Users\Faisal\Desktop\research paper\Annotator_A.xlsx",
    "B": r"C:\Users\Faisal\Desktop\research paper\Annotator_B.xlsx",
    "C": r"C:\Users\Faisal\Desktop\research paper\Annotator_C.xlsx",
    "D": r"C:\Users\Faisal\Desktop\research paper\Annotator_D.xlsx",
}


def cohens_kappa(a: dict[str, str], b: dict[str, str]) -> dict:
    common = sorted(set(a) & set(b))
    n = len(common)
    pairs = [(a[k], b[k]) for k in common]
    agree = sum(1 for x, y in pairs if x == y)
    po = agree / n
    cats = sorted(set(x for x, _ in pairs) | set(y for _, y in pairs))
    pa = {c: sum(1 for x, _ in pairs if x == c) / n for c in cats}
    pb = {c: sum(1 for _, y in pairs if y == c) / n for c in cats}
    pe = sum(pa[c] * pb[c] for c in cats)
    kappa = (po - pe) / (1 - pe) if pe < 1 else float("nan")
    return {
        "n": n, "observed_agreement": round(po, 4),
        "expected_agreement": round(pe, 4), "cohens_kappa": round(kappa, 4),
        "disagreements": [{"sample_id": k, "a": a[k], "b": b[k]}
                           for k in common if a[k] != b[k]],
    }


def main():
    raw = {label: load_completed_xlsx(path) for label, path in FILES.items()}
    pairs = list(raw["A"].keys())

    report = {"pairs": {}, "pooled": {}}
    pooled_norm = {label: {} for label in FILES}

    for pair in pairs:
        norm = {
            label: {sid: _norm_answer(v["correspondence"])
                    for sid, v in raw[label][pair].items()}
            for label in FILES
        }
        for label in FILES:
            for sid, v in norm[label].items():
                pooled_norm[label][f"{pair}::{sid}"] = v

        ck = cohens_kappa(norm["A"], norm["B"])
        fk = fleiss_kappa_correspondence([norm["A"], norm["B"], norm["C"], norm["D"]])
        mv = majority_vote([norm["A"], norm["B"], norm["C"], norm["D"]])
        needs_adj = [sid for sid, v in mv.items() if v["needs_adjudication"]]

        report["pairs"][pair] = {
            "cohens_kappa_AB": ck,
            "fleiss_kappa_4rater": fk,
            "n_needing_adjudication": len(needs_adj),
            "needs_adjudication_sample_ids": needs_adj,
        }

        print(f"=== {pair} ===")
        print(f"  Cohen's kappa (A/B, primary):  {ck['cohens_kappa']}  "
              f"(observed agreement {ck['observed_agreement']}, "
              f"{len(ck['disagreements'])}/{ck['n']} disagreements)")
        print(f"  Fleiss' kappa (all 4, supplementary): {fk['fleiss_kappa']}  "
              f"(mean observed agreement {fk['mean_observed_agreement']})")
        print(f"  Items needing real adjudication (no majority of 4): "
              f"{len(needs_adj)} / {len(mv)}")
        print()

    # Pooled across all 4 pairs (240 items x 4 raters)
    ck_pooled = cohens_kappa(pooled_norm["A"], pooled_norm["B"])
    fk_pooled = fleiss_kappa_correspondence(
        [pooled_norm["A"], pooled_norm["B"], pooled_norm["C"], pooled_norm["D"]]
    )
    mv_pooled = majority_vote(
        [pooled_norm["A"], pooled_norm["B"], pooled_norm["C"], pooled_norm["D"]]
    )
    needs_adj_pooled = [sid for sid, v in mv_pooled.items() if v["needs_adjudication"]]

    report["pooled"] = {
        "cohens_kappa_AB": ck_pooled,
        "fleiss_kappa_4rater": fk_pooled,
        "n_items": len(mv_pooled),
        "n_needing_adjudication": len(needs_adj_pooled),
        "needs_adjudication": {sid: mv_pooled[sid] for sid in needs_adj_pooled},
    }

    print("=== POOLED (all 4 pairs, 240 items) ===")
    print(f"  Cohen's kappa (A/B, primary):  {ck_pooled['cohens_kappa']}  "
          f"(observed agreement {ck_pooled['observed_agreement']}, "
          f"{len(ck_pooled['disagreements'])}/{ck_pooled['n']} disagreements)")
    print(f"  Fleiss' kappa (all 4, supplementary): {fk_pooled['fleiss_kappa']}  "
          f"(mean observed agreement {fk_pooled['mean_observed_agreement']})")
    print(f"  Items needing real adjudication (no majority of 4): "
          f"{len(needs_adj_pooled)} / {len(mv_pooled)}")

    out_path = Path(__file__).parent / "4rater_analysis_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
