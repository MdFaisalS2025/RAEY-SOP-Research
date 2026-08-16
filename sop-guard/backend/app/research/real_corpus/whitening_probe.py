"""
H6 probe: is within-document sibling confusability global-geometric or
local-semantic?

WHY THIS EXISTS
---------------
The pilot's headline negative result is that no absolute similarity
threshold separates a paraphrase's true source item from its siblings in
the same document (FINDINGS.md §6: 1,767 same-document negative pairs, best
operating point 0.970 recall at 10.4% FPR; a clause-level gate scored a
perfect 1.0 on 77% of wrong pairs).

That result, on its own, is NOT novel. Three literatures already predict
difficulty here:

  1. Embedding anisotropy - transformer embeddings occupy a narrow cone,
     so average pairwise cosine is high and the usable range is compressed
     (Ethayarajh 2019; Li et al. 2020; Su et al. 2021).
  2. Score-distribution modelling - IR has known since ~2001 that raw
     scores are not comparable across queries, and models them explicitly
     to set thresholds anyway (Manmatha et al.; Arampatzis & Robertson).
  3. Steck et al. (WWW 2024) - cosine over learned embeddings can be
     arbitrary in absolute terms.

If the paper's claim is to survive review, the compression we observe must
be shown to be something those corrections do NOT fix. Anisotropy is a
GLOBAL, GEOMETRIC property of the embedding space; whitening is the
standard closed-form correction for it. Sibling confusability is claimed
to be a LOCAL, SEMANTIC property of the candidate set - siblings genuinely
are about the same thing, which is not an artefact and not correctable.

This module tests that claim directly and cheaply.

  If whitening (and per-document normalisation) RESTORE a usable absolute
  threshold, hypothesis H2's mechanism claim is attributable to anisotropy,
  H6 is disconfirmed, and the paper must be reframed (see
  novelty-upgrade.html §3). Better to learn that in a day than in week 7.

STATUS: EXPLORATORY, DEV-ONLY.
All five current documents are assigned to dev by PREREGISTRATION.md §3.1
(they generated the hypotheses and are treated as contaminated). Nothing
here touches held-out data, because none exists yet. Every number this
produces is exploratory and must be labelled as such. The confirmatory H6
test is run once, on test documents, per PREREGISTRATION.md §9.

Whitening is fit on dev vectors only. When the corpus is split, refit on
dev and APPLY to test - never fit on test.

Run: cd sop-guard/backend && python -m app.research.real_corpus.whitening_probe
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

import numpy as np

from app.research.real_corpus.corpus import load_real_corpus, RealDocument
from app.research.real_corpus.paraphrases import PARAPHRASES

# The decoy fixture is synthetic and its "items" are bait, not content
# (corpus.py::_parse_adversarial_decoy_markers). Including it would
# conflate the H6 question (is the effect geometric or semantic?) with the
# separate adversarial-robustness question. Reported separately instead.
_ADVERSARIAL_DOC_IDS = {"adversarial_decoy_markers"}

# H6's decision rule, copied from PREREGISTRATION.md §8 so this file is
# self-contained and the rule cannot drift from the registration.
_TARGET_RECALL = 0.95
_MAX_FPR = 0.05


# --------------------------------------------------------------------------
# scoring schemes
# --------------------------------------------------------------------------

def _l2(X: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(X, axis=1, keepdims=True)
    return X / np.maximum(n, 1e-12)


def fit_whitening(X: np.ndarray, n_components: int | None = None) -> tuple[np.ndarray, np.ndarray, dict]:
    """Closed-form whitening (Su et al. 2021): translate the mean to zero
    and set the covariance to identity.

    RANK GUARD - the reason this is not three lines.
    With n samples and d dimensions, the sample covariance has rank <=
    n-1. Here n=157 and d=384, so ~228 of the 384 singular values are
    numerically zero. Naive whitening divides by sqrt(S), so those
    directions get multiplied by ~1/sqrt(1e-9) ~ 31,600, amplifying pure
    floating-point noise until it dominates the signal. After L2
    normalisation every pairwise cosine then collapses to essentially the
    same constant, and any threshold computed on those scores is
    meaningless.

    That is not hypothetical: the first run of this probe (results/
    whitening_probe_20260816T041810Z.json) produced exactly that
    degeneracy - pos_min, neg_max, pos_mean and neg_mean all equal to
    -0.0064 - and the naive version reported a "separating threshold",
    which was an artefact of constant scores rather than a real result.

    Fix: PCA-whitening. Keep only components with real support, defaulting
    to a conservative fraction of n rather than all of d. This is standard
    practice in the sentence-embedding whitening literature, which
    routinely reduces dimensionality as part of the transform.

    Returns (mu, W, diagnostics) so the transform can be FIT on dev and
    APPLIED to test without refitting - the split discipline
    PREREGISTRATION.md §3.2 requires."""
    n, d = X.shape
    mu = X.mean(axis=0, keepdims=True)
    Xc = X - mu
    cov = (Xc.T @ Xc) / max(1, n - 1)
    U, S, _ = np.linalg.svd(cov)

    max_supported = max(1, n - 1)
    if n_components is None:
        # Conservative: at most a third of the sample size, never more
        # than the rank the data can actually support.
        n_components = int(min(d, max_supported, max(2, n // 3)))
    n_components = int(min(n_components, d, max_supported))

    S_k = S[:n_components]
    W = U[:, :n_components] @ np.diag(1.0 / np.sqrt(S_k + 1e-9))

    diagnostics = {
        "n_samples": int(n),
        "n_dims": int(d),
        "n_components_kept": int(n_components),
        "rank_deficient": bool(n <= d),
        "explained_variance_ratio": round(float(S_k.sum() / S.sum()), 4) if S.sum() > 0 else 0.0,
        "smallest_kept_singular_value": float(S_k[-1]),
        # If this is huge, the transform is amplifying noise and the
        # result should not be trusted regardless of what it reports.
        "max_amplification": round(float(1.0 / np.sqrt(S_k[-1] + 1e-9)), 2),
        "warning": (
            "n <= d: covariance is rank-deficient. PCA-whitening applied with reduced "
            "components. Interpret with caution and re-run on the expanded corpus."
        ) if n <= d else "",
    }
    return mu, W, diagnostics


def apply_whitening(X: np.ndarray, mu: np.ndarray, W: np.ndarray) -> np.ndarray:
    return (X - mu) @ W


def _normalise_within_group(scores: list[float], mode: str) -> list[float]:
    """Rescale one paraphrase's scores against its own document's items.

    This is the cheap fix a reviewer thinks of in ten seconds: if raw
    scores are incomparable, normalise them per query. If it rescues the
    absolute gate, the relative-margin gate is redundant.

    MIN-MAX IS NOT A VALID ABSOLUTE BASELINE, and is retained only to
    demonstrate why. Min-max rescales by the group's own max. Whenever the
    true item is the argmax - which it is in 33/33 dev pairs under raw
    cosine - min-max maps the true item to EXACTLY 1.0 and every sibling
    strictly below it. A threshold at 1.0 then "separates" perfectly, but
    it is the rank-1 test wearing absolute clothing, not an absolute
    threshold. The first run of this probe reported raw+minmax as
    separating at FPR=0.000 with pos_min=pos_mean=1.0, which is the
    signature of exactly this tautology.

    Z-score has the same flavour but is far weaker: it rescales by the
    group mean and sd rather than pinning the max to a constant, so the
    true item's normalised value still varies across paraphrases (dev
    pos_min 1.329 vs pos_mean 3.175) and the threshold is doing real work.
    Z-score is a legitimate baseline; min-max is not."""
    a = np.asarray(scores, dtype=float)
    if mode == "zscore":
        sd = a.std()
        return ((a - a.mean()) / sd).tolist() if sd > 1e-9 else (a - a.mean()).tolist()
    if mode == "minmax":
        lo, hi = a.min(), a.max()
        return ((a - lo) / (hi - lo)).tolist() if hi - lo > 1e-9 else np.zeros_like(a).tolist()
    return scores


# Schemes that cannot be read as evidence about absolute gating, with the
# reason. Printed inline in the report so a future reader cannot mistake
# them for results.
_INVALID_ABSOLUTE = {
    "minmax": "tautological - pins the argmax to 1.0; equivalent to the rank-1 test",
}


# --------------------------------------------------------------------------
# the H6 question
# --------------------------------------------------------------------------

def best_operating_point(pos: list[float], neg: list[float]) -> dict:
    """Sweep every threshold and find the lowest FPR attainable at
    recall >= _TARGET_RECALL. This is literally H2/H6's decision rule:
    a separating threshold EXISTS iff that FPR <= _MAX_FPR.

    Also reports AUC, which is threshold-free and therefore measures
    whether the RANKING is informative even when no threshold works -
    the distinction the whole paper turns on."""
    if not pos or not neg:
        return {"error": "empty class"}
    p = np.asarray(pos, dtype=float)
    n = np.asarray(neg, dtype=float)

    # DEGENERACY GUARD. If every score is (near) identical, the threshold
    # sweep below will still return a "best" operating point, but it is
    # numerical noise, not discrimination. The first run of this probe hit
    # exactly this via rank-deficient whitening and reported a separating
    # threshold that did not exist. Refuse rather than mislead.
    spread = float(np.concatenate([p, n]).std())
    if spread < 1e-6:
        return {
            "error": "degenerate: all scores identical to within 1e-6",
            "spread": spread,
            "separating_threshold_exists": None,
        }

    # AUC via the Mann-Whitney U identity, ties counted as half.
    order = np.argsort(np.concatenate([p, n]), kind="mergesort")
    ranks = np.empty(len(order), dtype=float)
    ranks[order] = np.arange(1, len(order) + 1)
    # average ranks for ties
    allv = np.concatenate([p, n])
    for v in np.unique(allv):
        m = allv == v
        if m.sum() > 1:
            ranks[m] = ranks[m].mean()
    auc = (ranks[: len(p)].sum() - len(p) * (len(p) + 1) / 2) / (len(p) * len(n))

    thresholds = np.unique(np.concatenate([p, n]))
    best = None
    for t in thresholds:
        recall = float((p >= t).mean())
        if recall < _TARGET_RECALL:
            continue
        fpr = float((n >= t).mean())
        if best is None or fpr < best["fpr"]:
            best = {"threshold": float(t), "recall": recall, "fpr": fpr}

    return {
        "auc": round(float(auc), 4),
        "n_pos": len(pos),
        "n_neg": len(neg),
        "pos_mean": round(float(p.mean()), 4),
        "pos_min": round(float(p.min()), 4),
        "neg_mean": round(float(n.mean()), 4),
        "neg_max": round(float(n.max()), 4),
        # The headline: does a usable absolute threshold exist at all?
        "best_at_target_recall": best,
        "separating_threshold_exists": bool(best and best["fpr"] <= _MAX_FPR),
    }


def rank_and_margin(per_paraphrase: list[tuple[float, list[float]]]) -> dict:
    """The relative view, for contrast with the absolute view above.

    rank1_accuracy - fraction of paraphrases whose TRUE item outscores
      every sibling. This is what method_structural_margin relies on.
    margin - true score minus best sibling score. This is the natural
      conformal score (novelty-upgrade.html §5): calibrate a quantile of
      it and you get a distribution-free false-anchor bound instead of an
      empirical zero."""
    wins, margins = 0, []
    for true_score, sib_scores in per_paraphrase:
        best_sib = max(sib_scores) if sib_scores else -1e9
        if true_score > best_sib:
            wins += 1
        margins.append(true_score - best_sib)
    m = np.asarray(margins, dtype=float)
    return {
        "n": len(per_paraphrase),
        "rank1_accuracy": round(wins / len(per_paraphrase), 4) if per_paraphrase else 0.0,
        "margin_mean": round(float(m.mean()), 4),
        "margin_min": round(float(m.min()), 4),
        "margin_p05": round(float(np.percentile(m, 5)), 4),
        "margin_negative_count": int((m <= 0).sum()),
    }


# --------------------------------------------------------------------------
# driver
# --------------------------------------------------------------------------

def run_probe(include_adversarial: bool = False) -> dict:
    try:
        from app.rag.embedding_cache import is_dense_backend_active, embed_cached
    except ImportError as e:
        print(f"FATAL: embedding backend unavailable ({e}).", file=sys.stderr)
        raise
    if not is_dense_backend_active():
        # Loud, per PREREGISTRATION.md §11 item 2 - a partial result here
        # would be actively misleading, so refuse rather than degrade.
        raise RuntimeError(
            "Dense embedding backend is not active. H6 cannot be probed with the "
            "TF-IDF fallback: the hypothesis is specifically about dense embedding "
            "geometry. Configure RAG_EMBEDDING_MODEL and re-run."
        )

    docs: dict[str, RealDocument] = {d.doc_id: d for d in load_real_corpus()}
    doc_ids = [d for d in docs if include_adversarial or d not in _ADVERSARIAL_DOC_IDS]
    pairs = [p for p in PARAPHRASES if p["doc_id"] in doc_ids]

    # ---- collect every text once, embed once ----
    texts: list[str] = []
    index: dict[str, int] = {}

    def _idx(t: str) -> int:
        if t not in index:
            index[t] = len(texts)
            texts.append(t)
        return index[t]

    for d in doc_ids:
        for item in docs[d].items:
            _idx(item["text"])
    for p in pairs:
        _idx(p["paraphrase"])

    print(f"embedding {len(texts)} unique texts ...", file=sys.stderr)
    X = np.asarray([embed_cached(t) for t in texts], dtype=float)

    # ---- the two vector spaces under comparison ----
    # Whitening fit on dev vectors only. Every document is dev today
    # (PREREGISTRATION.md §3.1); when test documents exist, fit here and
    # apply to test without refitting.
    mu, W, whiten_diag = fit_whitening(X)
    spaces = {
        "raw": _l2(X),
        "whitened": _l2(apply_whitening(X, mu, W)),
    }

    report: dict = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "EXPLORATORY / DEV-ONLY - see module docstring",
        "include_adversarial": include_adversarial,
        "n_documents": len(doc_ids),
        "n_paraphrase_pairs": len(pairs),
        "n_unique_texts": len(texts),
        "embedding_dim": int(X.shape[1]),
        "decision_rule": {"target_recall": _TARGET_RECALL, "max_fpr": _MAX_FPR},
        "whitening_diagnostics": whiten_diag,
        "invalid_absolute_schemes": _INVALID_ABSOLUTE,
        "schemes": {},
    }

    # Anisotropy sanity check: mean pairwise cosine over all item vectors.
    # The literature reports 0.8-0.99 for un-corrected transformer
    # embeddings; if `raw` is low here, the anisotropy framing does not
    # apply to this backend and §1 of the paper needs rewriting.
    for name, V in spaces.items():
        S = V @ V.T
        iu = np.triu_indices(len(V), k=1)
        report[f"mean_pairwise_cosine_{name}"] = round(float(S[iu].mean()), 4)

    # ---- score every (paraphrase, sibling) pair in both spaces ----
    for space_name, V in spaces.items():
        for norm in ("none", "zscore", "minmax"):
            pos_all: list[float] = []
            neg_all: list[float] = []
            per_paraphrase: list[tuple[float, list[float]]] = []

            for p in pairs:
                doc = docs[p["doc_id"]]
                q = V[_idx(p["paraphrase"])]
                item_ids = [i["item_id"] for i in doc.items]
                raw_scores = [float(q @ V[_idx(i["text"])]) for i in doc.items]
                scores = _normalise_within_group(raw_scores, norm)

                true_score, sib_scores = None, []
                for iid, s in zip(item_ids, scores):
                    if iid == p["item_id"]:
                        true_score = s
                    else:
                        sib_scores.append(s)
                if true_score is None:
                    continue  # item_id not present in parsed items; skip, don't guess
                pos_all.append(true_score)
                neg_all.extend(sib_scores)
                per_paraphrase.append((true_score, sib_scores))

            key = f"{space_name}+{norm}"
            record = {
                "absolute": best_operating_point(pos_all, neg_all),
                "relative": rank_and_margin(per_paraphrase),
            }
            if norm in _INVALID_ABSOLUTE:
                record["absolute_invalid_reason"] = _INVALID_ABSOLUTE[norm]
                record["absolute"]["separating_threshold_exists"] = None
            report["schemes"][key] = record

    return report


_RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")


def print_report(report: dict) -> None:
    print("\n" + "=" * 78)
    print("H6 PROBE - global-geometric vs local-semantic  [EXPLORATORY, DEV-ONLY]")
    print("=" * 78)
    print(f"{report['n_documents']} documents, {report['n_paraphrase_pairs']} paraphrase pairs, "
          f"dim={report['embedding_dim']}")
    print(f"mean pairwise cosine   raw={report['mean_pairwise_cosine_raw']}   "
          f"whitened={report['mean_pairwise_cosine_whitened']}")
    wd = report["whitening_diagnostics"]
    print(f"whitening: kept {wd['n_components_kept']}/{wd['n_dims']} components "
          f"(n={wd['n_samples']}), explained var {wd['explained_variance_ratio']}, "
          f"max amplification {wd['max_amplification']}x")
    if wd["warning"]:
        print(f"  WARNING: {wd['warning']}")
    print(f"decision rule: separating threshold exists iff FPR <= "
          f"{report['decision_rule']['max_fpr']} at recall >= {report['decision_rule']['target_recall']}\n")

    hdr = f"{'scheme':<22}{'AUC':<8}{'FPR@R95':<10}{'SEPARATES?':<13}{'rank1':<8}{'min margin':<12}"
    print(hdr)
    print("-" * len(hdr))
    for name, s in report["schemes"].items():
        a, r = s["absolute"], s["relative"]
        bop = a.get("best_at_target_recall")
        fpr = f"{bop['fpr']:.3f}" if bop else "n/a"
        if a.get("error"):
            sep = "DEGENERATE"
        elif "absolute_invalid_reason" in s:
            sep = "INVALID"
        else:
            sep = "YES" if a.get("separating_threshold_exists") else "no"
        print(f"{name:<22}{a.get('auc', 0):<8}{fpr:<10}{sep:<13}"
              f"{r['rank1_accuracy']:<8}{r['margin_min']:<12}")

    print("\nINTERPRETATION")
    print("-" * 78)
    valid = {k: v for k, v in report["schemes"].items()
             if "absolute_invalid_reason" not in v and not v["absolute"].get("error")}
    for k, v in report["schemes"].items():
        if "absolute_invalid_reason" in v:
            print(f"  EXCLUDED {k}: {v['absolute_invalid_reason']}")
        elif v["absolute"].get("error"):
            print(f"  EXCLUDED {k}: {v['absolute']['error']}")
    any_sep = any(v["absolute"].get("separating_threshold_exists") for v in valid.values())
    if any_sep:
        print("  At least one correction RESTORES a usable absolute threshold.")
        print("  -> H6 is DISCONFIRMED on dev. The compression is (at least partly)")
        print("     the known global-geometric effect, not a distinct local one.")
        print("     Reframe per novelty-upgrade.html §3 BEFORE expanding the corpus.")
    else:
        print("  No correction restores a usable absolute threshold.")
        print("  -> Consistent with H6: the effect survives isotropy whitening and")
        print("     per-document normalisation, so it is not merely anisotropy.")
        print("     This is DEV evidence only and does not confirm H6 - the")
        print("     confirmatory test runs once on held-out documents (PREREG §9).")
    print("  Compare the 'rank1' column against 'SEPARATES?': high rank-1 accuracy")
    print("  with no separating threshold is the paper's central dissociation.")

    os.makedirs(_RESULTS_DIR, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(_RESULTS_DIR, f"whitening_probe_{ts}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nSaved: {path}")


if __name__ == "__main__":
    print_report(run_probe(include_adversarial="--with-adversarial" in sys.argv))
