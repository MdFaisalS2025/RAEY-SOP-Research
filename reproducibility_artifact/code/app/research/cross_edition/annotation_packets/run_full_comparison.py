"""
One-off driver (not part of the pipeline): runs every remaining registered
analysis committed in PREREGISTRATION.md section 11's "B1, B3, B4
implemented... test procedure committed" entry, against the same 240
sampled items and complete adjudicated ground truth already used for
section 6 and the H3 test.

Computes:
  - H5: method vs B1 false-correspondence rate, confirmed iff the CI
    upper bound is below +0.05 (an equivalence-style bound - a CI that
    merely includes zero does NOT confirm it).
  - H3 re-run: method vs B2 accuracy, now with pair-level bootstrap added
    alongside the existing item-level numbers (section 8.2 deviation).
  - Descriptive (no hypothesis attached): method vs B3, method vs B4
    accuracy and provenance-loss rate; B1's own provenance loss rate on
    the minor test pairs.
  - Every contrast reported as a 2x2 grid: {item-level, pair-level} x
    {raw, section-5.1-weighted}, neither cell primary.
  - Benjamini-Hochberg across {H3, H4, H5} using a bootstrap p-value for
    each (H3: P(diff <= 0); H4: P(T3 precision < 0.80); H5: P(diff >=
    +0.05)), all computed from the SAME resamples used for the CIs so the
    correction is not a second, differently-sampled test.
"""
import csv
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

import app.research.cross_edition.annotation_packets.run_h3_test as _rt  # noqa: E402
# The completed annotator files were moved after run_h3_test.py's module
# defaults were written; every other driver in this study overrides these
# before use, and this one was missed until the 2026-08-18 audit.
_rt.ANNOTATOR_FILES = {k: rf"C:\Users\Faisal\Desktop\research paper\Annotator_{k}.xlsx" for k in "ABCD"}
_rt.ADJUDICATION_FILE = r"C:\Users\Faisal\Desktop\research paper\Adjudication_43_items_completed.xlsx"

from app.research.cross_edition.annotation import _norm_answer  # noqa: E402
from app.research.cross_edition.baseline_b2 import align_items_b2  # noqa: E402
from app.research.cross_edition.baseline_b1_b3_b4 import (  # noqa: E402
    align_items_b1, align_items_b3, align_items_b4,
)
from app.research.cross_edition.annotation_packets.run_h3_test import (  # noqa: E402
    PAIRS, build_ground_truth,
)
from app.research.cross_edition.annotation_packets.sample_join import (  # noqa: E402
    build_index_join, verify_sample_identity, join_baseline,
)

BASE = Path(__file__).parent
N_BOOT = 10000
SEED = 20261018


# ---------------------------------------------------------------------------
# Build the joined per-item record set: one dict per usable sampled item,
# with the method's and every baseline's prediction plus ground truth.
# ---------------------------------------------------------------------------
def build_records() -> list[dict]:
    """Joins by PARSE-ORDER INDEX, not by old_item_id string - see
    sample_join.py's module docstring for why the id-based join used here
    until the 2026-08-18 audit was a real bug: item_align.align_items
    mutates item_id into the new edition's guideline vocabulary, but
    annotation_packet.csv stores that post-remap id while the baselines key
    their own results by the raw parse() id. 24 of 233 usable items (the
    hardest ones - guideline renamed between editions) silently failed the
    old id-based lookup and were dropped, non-randomly inflating the
    method's reported accuracy. Index join is exact because align_items and
    every baseline iterate the identical parse()d old_items list in the
    identical order (verified in the audit, not assumed)."""
    ground_truth = build_ground_truth()
    records: list[dict] = []

    for pair_idx, (pair, (slug, old_pdf, new_pdf)) in enumerate(PAIRS.items()):
        packet_csv = BASE / slug / "annotation_packet.csv"
        with open(packet_csv, encoding="utf-8") as f:
            method_rows = {r["sample_id"]: r for r in csv.DictReader(f)}

        id_to_index, _ = build_index_join(old_pdf, new_pdf)
        verify_sample_identity(packet_csv, id_to_index)  # fail loudly, not silently

        b1 = align_items_b1(old_pdf, new_pdf)
        b2 = align_items_b2(old_pdf, new_pdf)
        b3 = align_items_b3(old_pdf, new_pdf)
        b4 = align_items_b4(old_pdf, new_pdf)

        gt = ground_truth[pair]
        for sid, row in method_rows.items():
            if sid not in gt:
                continue
            truth = gt[sid]
            if truth == "cannot_determine":
                continue
            idx = id_to_index[row["old_item_id"]]  # KeyError, not silent skip, if this ever fails

            method_pred = _norm_answer(row["method_predicted_item_id"])
            preds = {
                "method": method_pred,
                "b1": _norm_answer(join_baseline(b1, idx, "b1_predicted_item_id")),
                "b2": _norm_answer(join_baseline(b2, idx, "b2_predicted_item_id")),
                "b3": _norm_answer(join_baseline(b3, idx, "b3_predicted_item_id")),
                "b4": _norm_answer(join_baseline(b4, idx, "b4_predicted_item_id")),
            }
            weight = float(row.get("sample_weight", 1.0) or 1.0)

            records.append({
                "pair": pair, "pair_idx": pair_idx, "sample_id": sid,
                "tier": row["tier"], "truth": truth, "weight": weight,
                "preds": preds,
                "correct": {k: (1 if v == truth else 0) for k, v in preds.items()},
            })

    return records


# ---------------------------------------------------------------------------
# Generic dual-level bootstrap.
# ---------------------------------------------------------------------------
def _resample_items(records: list[dict], rng: random.Random) -> list[dict]:
    n = len(records)
    return [records[rng.randrange(n)] for _ in range(n)]


def _resample_pairs(records: list[dict], pair_ids: list[int], rng: random.Random) -> list[dict]:
    by_pair: dict[int, list[dict]] = {}
    for r in records:
        by_pair.setdefault(r["pair_idx"], []).append(r)
    chosen = [pair_ids[rng.randrange(len(pair_ids))] for _ in range(len(pair_ids))]
    out: list[dict] = []
    for p in chosen:
        out.extend(by_pair[p])
    return out


def bootstrap_stat(records: list[dict], stat_fn, n_boot: int = N_BOOT, seed: int = SEED) -> dict:
    """Runs stat_fn (records -> float | None) at item-level and pair-level
    resampling, returns a 2x2-shaped result: {"item": {...}, "pair": {...}},
    each with point_estimate/ci95_low/ci95_high/n_valid (resamples where
    stat_fn didn't return None, e.g. a zero-denominator rate)."""
    pair_ids = sorted({r["pair_idx"] for r in records})
    point = stat_fn(records)

    out = {}
    for level in ("item", "pair"):
        rng = random.Random(seed)
        diffs = []
        for _ in range(n_boot):
            sample = _resample_items(records, rng) if level == "item" \
                else _resample_pairs(records, pair_ids, rng)
            v = stat_fn(sample)
            if v is not None:
                diffs.append(v)
        diffs.sort()
        n_valid = len(diffs)
        if n_valid < 2:
            out[level] = {"point_estimate": point, "ci95_low": None,
                          "ci95_high": None, "n_valid": n_valid}
            continue
        lo_i = int(0.025 * n_valid)
        hi_i = min(int(0.975 * n_valid), n_valid - 1)
        out[level] = {
            "point_estimate": round(point, 4) if point is not None else None,
            "ci95_low": round(diffs[lo_i], 4),
            "ci95_high": round(diffs[hi_i], 4),
            "n_valid": n_valid,
        }
    return out


def _weighted_mean(vals_weights: list[tuple[float, float]]) -> float | None:
    wsum = sum(w for _, w in vals_weights)
    if wsum == 0:
        return None
    return sum(v * w for v, w in vals_weights) / wsum


# --- stat functions -----------------------------------------------------
def make_accuracy_diff_fn(a: str, b: str, weighted: bool):
    def fn(records: list[dict]) -> float | None:
        if not records:
            return None
        if weighted:
            a_vals = [(r["correct"][a], r["weight"]) for r in records]
            b_vals = [(r["correct"][b], r["weight"]) for r in records]
            ma, mb = _weighted_mean(a_vals), _weighted_mean(b_vals)
            if ma is None or mb is None:
                return None
            return ma - mb
        return sum(r["correct"][a] for r in records) / len(records) - \
               sum(r["correct"][b] for r in records) / len(records)
    return fn


def _false_corr_rate(records: list[dict], key: str, weighted: bool) -> float | None:
    said = [r for r in records if r["preds"][key] != "none"]
    if not said:
        return None
    if weighted:
        num = [(1 if r["preds"][key] != r["truth"] else 0, r["weight"]) for r in said]
        return _weighted_mean(num)
    wrong = sum(1 for r in said if r["preds"][key] != r["truth"])
    return wrong / len(said)


def make_false_corr_diff_fn(a: str, b: str, weighted: bool):
    def fn(records: list[dict]) -> float | None:
        ra = _false_corr_rate(records, a, weighted)
        rb = _false_corr_rate(records, b, weighted)
        if ra is None or rb is None:
            return None
        return ra - rb
    return fn


def _provenance_loss_rate(records: list[dict], key: str, weighted: bool) -> float | None:
    true_corr = [r for r in records if r["truth"] != "none"]
    if not true_corr:
        return None
    if weighted:
        num = [(1 if r["preds"][key] == "none" else 0, r["weight"]) for r in true_corr]
        return _weighted_mean(num)
    lost = sum(1 for r in true_corr if r["preds"][key] == "none")
    return lost / len(true_corr)


def make_provenance_loss_fn(key: str, weighted: bool):
    def fn(records: list[dict]) -> float | None:
        return _provenance_loss_rate(records, key, weighted)
    return fn


def make_provenance_loss_diff_fn(a: str, b: str, weighted: bool):
    def fn(records: list[dict]) -> float | None:
        ra = _provenance_loss_rate(records, a, weighted)
        rb = _provenance_loss_rate(records, b, weighted)
        if ra is None or rb is None:
            return None
        return ra - rb
    return fn


def t3_precision_fn(records: list[dict]) -> float | None:
    t3 = [r for r in records if r["tier"] == "T3_renumbered"]
    if not t3:
        return None
    return sum(r["correct"]["method"] for r in t3) / len(t3)


# --- bootstrap p-values for BH (against each hypothesis's registered null) --
def bootstrap_p_h3(records: list[dict], rng_seed: int = SEED) -> float:
    """H3 null: method - B2 accuracy <= 0. p = P(resampled diff <= 0),
    item-level pooled (matches the resampling unit already used for the CI
    reported as primary alongside pair-level; BH uses item-level p-values
    for consistency with H4/H5 below, which are naturally item-scale)."""
    fn = make_accuracy_diff_fn("method", "b2", weighted=False)
    rng = random.Random(rng_seed)
    diffs = [fn(_resample_items(records, rng)) for _ in range(N_BOOT)]
    diffs = [d for d in diffs if d is not None]
    return sum(1 for d in diffs if d <= 0) / len(diffs)


def bootstrap_p_h4(records: list[dict], rng_seed: int = SEED) -> float:
    """H4 null: T3 tier precision < 0.80. p = P(resampled precision < 0.80)."""
    rng = random.Random(rng_seed)
    vals = [t3_precision_fn(_resample_items(records, rng)) for _ in range(N_BOOT)]
    vals = [v for v in vals if v is not None]
    return sum(1 for v in vals if v < 0.80) / len(vals)


def bootstrap_p_h5(records: list[dict], rng_seed: int = SEED) -> float:
    """H5 null: (method false-corr rate - B1's) >= +0.05. p = P(resampled
    diff >= +0.05)."""
    fn = make_false_corr_diff_fn("method", "b1", weighted=False)
    rng = random.Random(rng_seed)
    diffs = [fn(_resample_items(records, rng)) for _ in range(N_BOOT)]
    diffs = [d for d in diffs if d is not None]
    return sum(1 for d in diffs if d >= 0.05) / len(diffs)


# --- NULL-CENTERED bootstrap p-values (2026-08-18 audit round 3, Phase 1) --
# The three functions above are PERCENTILE bootstrap p-values: they read the
# tail probability directly off the bootstrap distribution of the statistic,
# which is naturally centered at the OBSERVED estimate theta_hat, not at the
# null value theta0. This is a common, defensible shortcut but is informal -
# it implicitly assumes the sampling distribution's shape near theta0 matches
# its shape near theta_hat. The functions below instead use the standard
# pivot construction: shift the bootstrap distribution so it is centered at
# theta0 (T*_null = T* - theta_hat + theta0), then ask how extreme the
# OBSERVED theta_hat is relative to that null-centered distribution. Reported
# ALONGSIDE the percentile versions, not as a replacement - any divergence
# between the two is itself informative and is disclosed, not resolved by
# picking whichever is more favourable.
def bootstrap_p_h3_centered(records: list[dict], rng_seed: int = SEED) -> float:
    """H3 null: theta<=0. One-sided pivot p = P(T* >= 2*theta_hat - 0)."""
    fn = make_accuracy_diff_fn("method", "b2", weighted=False)
    theta_hat = fn(records)
    rng = random.Random(rng_seed)
    diffs = [fn(_resample_items(records, rng)) for _ in range(N_BOOT)]
    diffs = [d for d in diffs if d is not None]
    threshold = 2 * theta_hat - 0.0
    return sum(1 for d in diffs if d >= threshold) / len(diffs)


def bootstrap_p_h4_centered(records: list[dict], rng_seed: int = SEED) -> float:
    """H4 null: theta<0.80. One-sided pivot p = P(T* >= 2*theta_hat - 0.80)."""
    theta_hat = t3_precision_fn(records)
    rng = random.Random(rng_seed)
    vals = [t3_precision_fn(_resample_items(records, rng)) for _ in range(N_BOOT)]
    vals = [v for v in vals if v is not None]
    threshold = 2 * theta_hat - 0.80
    return sum(1 for v in vals if v >= threshold) / len(vals)


def bootstrap_p_h5_centered(records: list[dict], rng_seed: int = SEED) -> float:
    """H5 null: theta>=+0.05. One-sided pivot p = P(T* <= 2*theta_hat - 0.05)."""
    fn = make_false_corr_diff_fn("method", "b1", weighted=False)
    theta_hat = fn(records)
    rng = random.Random(rng_seed)
    diffs = [fn(_resample_items(records, rng)) for _ in range(N_BOOT)]
    diffs = [d for d in diffs if d is not None]
    threshold = 2 * theta_hat - 0.05
    return sum(1 for d in diffs if d <= threshold) / len(diffs)


def benjamini_hochberg(pvals: dict[str, float]) -> dict[str, dict]:
    items = sorted(pvals.items(), key=lambda kv: kv[1])
    m = len(items)
    adjusted = {}
    prev = 1.0
    for rank, (name, p) in enumerate(reversed(items), start=1):
        i = m - rank + 1
        adj = min(prev, p * m / i)
        adjusted[name] = adj
        prev = adj
    return {name: {"p_raw": round(pvals[name], 4), "p_adjusted": round(adjusted[name], 4)}
            for name in pvals}


def main():
    records = build_records()
    print(f"usable items: {len(records)} (expect 233 - see sample_join.py for "
          f"why this was 209 before the 2026-08-18 join-bug fix)")

    result: dict = {"n_items": len(records)}

    # --- H5: method vs B1 false-correspondence rate --------------------
    h5 = {}
    for weighted, label in ((False, "raw"), (True, "weighted")):
        h5[label] = bootstrap_stat(records, make_false_corr_diff_fn("method", "b1", weighted))
    h5_confirmed_item_raw = (h5["raw"]["item"]["ci95_high"] is not None
                              and h5["raw"]["item"]["ci95_high"] < 0.05)
    h5_confirmed_pair_raw = (h5["raw"]["pair"]["ci95_high"] is not None
                              and h5["raw"]["pair"]["ci95_high"] < 0.05)
    result["H5_false_correspondence_method_minus_B1"] = h5
    result["H5_confirmed"] = {"item_raw": h5_confirmed_item_raw, "pair_raw": h5_confirmed_pair_raw}
    print(f"H5 (method - B1 false-corr rate): item-raw={h5['raw']['item']}  pair-raw={h5['raw']['pair']}")
    print(f"H5 confirmed: item-level={h5_confirmed_item_raw}  pair-level={h5_confirmed_pair_raw}")

    # --- H3 re-run: method vs B2, item + pair level ---------------------
    h3 = {}
    for weighted, label in ((False, "raw"), (True, "weighted")):
        h3[label] = bootstrap_stat(records, make_accuracy_diff_fn("method", "b2", weighted))
    result["H3_rerun_method_minus_B2_accuracy"] = h3
    print(f"H3 re-run: item-raw={h3['raw']['item']}  pair-raw={h3['raw']['pair']}")

    # --- Descriptive: method vs B3, method vs B4 -------------------------
    desc = {}
    for other in ("b3", "b4"):
        d = {}
        for weighted, label in ((False, "raw"), (True, "weighted")):
            d[label] = bootstrap_stat(records, make_accuracy_diff_fn("method", other, weighted))
        desc[f"method_minus_{other}_accuracy"] = d
    result["descriptive"] = desc
    for other in ("b3", "b4"):
        d = desc[f"method_minus_{other}_accuracy"]["raw"]
        print(f"method vs {other}: item-raw={d['item']}  pair-raw={d['pair']}")

    # --- Descriptive: B1's own provenance loss rate (what H1 would test) -
    b1_ploss = {}
    for weighted, label in ((False, "raw"), (True, "weighted")):
        b1_ploss[label] = bootstrap_stat(records, make_provenance_loss_fn("b1", weighted))
    result["descriptive"]["B1_provenance_loss_rate_minor_pairs"] = b1_ploss
    print(f"B1 provenance loss rate (minor pairs, descriptive): item-raw={b1_ploss['raw']['item']}")

    # --- BH across {H3, H4, H5} - PERCENTILE p-values (as originally run) --
    pvals = {
        "H3": bootstrap_p_h3(records),
        "H4": bootstrap_p_h4(records),
        "H5": bootstrap_p_h5(records),
    }
    bh = benjamini_hochberg(pvals)
    result["benjamini_hochberg"] = bh
    print(f"BH-adjusted p-values (percentile): {bh}")

    # --- Same, NULL-CENTERED (2026-08-18 audit round 3, Phase 1) ---------
    # Reported alongside, not in place of, the percentile version above.
    pvals_centered = {
        "H3": bootstrap_p_h3_centered(records),
        "H4": bootstrap_p_h4_centered(records),
        "H5": bootstrap_p_h5_centered(records),
    }
    bh_centered = benjamini_hochberg(pvals_centered)
    result["benjamini_hochberg_null_centered"] = bh_centered
    print(f"BH-adjusted p-values (null-centered): {bh_centered}")
    for h in ("H3", "H4", "H5"):
        divergence = abs(bh[h]["p_adjusted"] - bh_centered[h]["p_adjusted"])
        print(f"  {h}: percentile p_adj={bh[h]['p_adjusted']}  "
              f"null-centered p_adj={bh_centered[h]['p_adjusted']}  "
              f"divergence={divergence:.4f}")

    out_path = BASE / "full_comparison_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
