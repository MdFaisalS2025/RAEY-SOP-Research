"""
One-off driver: scores H3'a/H3'b/H3'c (PREREGISTRATION.md's H3' entries)
against the completed, blind H3' annotation (E.xlsx, F.xlsx - perfect
agreement, kappa=1.0000, 0/92 disagreements, so no adjudication step is
needed; ground truth is simply the shared answer).

Per the user's explicit decision (PREREGISTRATION.md, the guideline-
boundary-bug entry): the 11 bullet-census items caught in the fresh
pair's "Delirium with HyperAgitation" boundary-bleed (FEASIBILITY.md
section 56) are excluded from scoring here, reported as a separate,
distinct finding rather than allowed to dilute the T2-fix result.

H3'a: v2 (fixed) vs v1 (original) accuracy, on the 21 clean bullet items.
H3'b: v2 (fixed) vs B2 accuracy, on the same 21 clean bullet items.
H3'c: v1(=v2, identical on ordinal items) vs B2 accuracy, on the 60
      ordinal items - an independent replication of the original H3's
      ordinal-item finding (FEASIBILITY.md section 54.1) on fresh data.

n=1 pair, so only item-level bootstrap is possible - stated as a scoping
fact in the pre-commitment entry, not a deviation.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.run_h3prime_test
"""
from __future__ import annotations

import csv
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.annotation import load_completed_xlsx, _norm_answer  # noqa: E402

BASE = Path(__file__).parent / "h3prime_tennessee_2022_2024"
ANNOTATOR_E = r"C:\Users\Faisal\Desktop\research paper\E.xlsx"
ANNOTATOR_F = r"C:\Users\Faisal\Desktop\research paper\F.xlsx"

CONTAMINATED_GUIDELINE = "Delirium with HyperAgitation"


def build_ground_truth() -> dict[str, str]:
    e = load_completed_xlsx(ANNOTATOR_E)
    f = load_completed_xlsx(ANNOTATOR_F)
    sheet_e = list(e.keys())[0]
    sheet_f = list(f.keys())[0]
    ea = {sid: _norm_answer(v["correspondence"]) for sid, v in e[sheet_e].items()}
    fa = {sid: _norm_answer(v["correspondence"]) for sid, v in f[sheet_f].items()}
    common = set(ea) & set(fa)
    disagreements = [sid for sid in common if ea[sid] != fa[sid]]
    if disagreements:
        raise RuntimeError(
            f"{len(disagreements)} unresolved disagreements - adjudication "
            f"required before scoring: {disagreements}"
        )
    return {sid: ea[sid] for sid in common}


def bootstrap_ci(pairs: list[tuple[int, int]], n_boot: int = 10000, seed: int = 20260818):
    """pairs: list of (a_correct, b_correct). Returns point estimate and
    95% CI for the paired difference (a - b), item-level resampling only
    (n=1 pair here, so no pair-level unit exists)."""
    n = len(pairs)
    point = sum(a - b for a, b in pairs) / n
    rng = random.Random(seed)
    diffs = []
    for _ in range(n_boot):
        sample = [pairs[rng.randrange(n)] for _ in range(n)]
        diffs.append(sum(a - b for a, b in sample) / n)
    diffs.sort()
    lo_i, hi_i = int(0.025 * n_boot), int(0.975 * n_boot) - 1
    return {
        "n": n, "point_estimate": round(point, 4),
        "ci95_low": round(diffs[lo_i], 4), "ci95_high": round(diffs[hi_i], 4),
    }


def main():
    gt = build_ground_truth()
    print(f"ground truth items: {len(gt)}")

    with open(BASE / "annotation_packet.csv", encoding="utf-8") as fh:
        packet = {r["sample_id"]: r for r in csv.DictReader(fh)}
    with open(BASE / "master_scoring.csv", encoding="utf-8") as fh:
        master = {r["sample_id"]: r for r in csv.DictReader(fh)}

    contaminated = {sid for sid, r in master.items()
                     if r["is_bullet_kind"] == "True"
                     and packet[sid]["old_guideline"] == CONTAMINATED_GUIDELINE}
    clean_bullet = [sid for sid, r in master.items()
                     if r["is_bullet_kind"] == "True" and sid not in contaminated]
    ordinal = [sid for sid, r in master.items() if r["is_bullet_kind"] != "True"]

    print(f"contaminated (excluded): {len(contaminated)}")
    print(f"clean bullet items: {len(clean_bullet)}")
    print(f"ordinal items: {len(ordinal)}")

    def scored(sids, pred_key_a, pred_key_b):
        pairs = []
        n_cannot_determine = 0
        for sid in sids:
            truth = gt.get(sid)
            if truth is None:
                continue
            if truth == "cannot_determine":
                n_cannot_determine += 1
                continue
            a_pred = _norm_answer(master[sid][pred_key_a])
            b_pred = _norm_answer(master[sid][pred_key_b])
            a_correct = 1 if a_pred == truth else 0
            b_correct = 1 if b_pred == truth else 0
            pairs.append((a_correct, b_correct))
        return pairs, n_cannot_determine

    h3a_pairs, h3a_cd = scored(clean_bullet, "v2_predicted_item_id", "v1_predicted_item_id")
    h3b_pairs, h3b_cd = scored(clean_bullet, "v2_predicted_item_id", "b2_predicted_item_id")
    h3c_pairs, h3c_cd = scored(ordinal, "v1_predicted_item_id", "b2_predicted_item_id")

    report = {}
    for name, pairs, cd, sids in [
        ("H3a_v2_vs_v1_bullet", h3a_pairs, h3a_cd, clean_bullet),
        ("H3b_v2_vs_B2_bullet", h3b_pairs, h3b_cd, clean_bullet),
        ("H3c_v1_vs_B2_ordinal", h3c_pairs, h3c_cd, ordinal),
    ]:
        boot = bootstrap_ci(pairs)
        a_acc = sum(a for a, _ in pairs) / len(pairs)
        b_acc = sum(b for _, b in pairs) / len(pairs)
        confirmed = boot["point_estimate"] > 0 and boot["ci95_low"] > 0
        report[name] = {
            "n_scored": len(pairs), "n_cannot_determine_excluded": cd,
            "n_total_population": len(sids),
            "a_accuracy": round(a_acc, 4), "b_accuracy": round(b_acc, 4),
            "bootstrap": boot, "confirmed": confirmed,
        }
        print(f"\n=== {name} ===")
        print(f"  n_scored={len(pairs)}  cannot_determine_excluded={cd}")
        print(f"  accuracy: a={a_acc:.4f}  b={b_acc:.4f}")
        print(f"  paired diff (a-b): {boot}")
        print(f"  CONFIRMED: {confirmed}")

    out_path = BASE / "h3prime_test_report.json"
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
