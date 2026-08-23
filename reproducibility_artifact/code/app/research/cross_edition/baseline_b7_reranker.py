"""
Baseline B7: local cross-encoder reranker matching (audit round 4, Phase 3).

Motivated by B6's null result (audit round 3): the LLM reranker
(gemini-3.5-flash-lite) was statistically indistinguishable from a naive
"always pick the top-1 retrieval candidate" shortcut, and fresh
literature research (Voyage AI's 2025 benchmark, ZeroEntropy) reports
purpose-built cross-encoder rerankers beating LLM rerankers by up to 15%
NDCG@10, cheaper and faster, on modern retrieval benchmarks. B7 tests
whether a reranker purpose-built for this task class does better than
B6's general LLM did.

IDENTICAL RETRIEVAL TO B6: reuses baseline_b6_llm.get_topk_candidates
unchanged (top-k=10 by cosine similarity, bge-small-en-v1.5, unscoped
across the whole new document) - any accuracy difference between B6 and
B7 isolates the reranking step itself, not a retrieval change.

RERANKER: BAAI/bge-reranker-v2-m3 via sentence_transformers.CrossEncoder,
run locally - no API key, no rate limit, no cost. Sigmoid-activated,
scores in [0,1] (smoke-tested: identical-text pair 0.99998, unrelated
pair 0.00015, before any real item was scored).

DESIGN ASYMMETRY, DISCLOSED (identical in kind to B6's): no one-to-one
consumption constraint across the 233 sampled items, each scored
independently. Plausibly advantages B7 the same way it plausibly
advantaged B6, and must be reported as a limitation, not smoothed over.

FLOOR: swept over {0.0, 0.3, 0.5, 0.7} rather than a single calibrated
choice - the same discipline b5_model_floor_sweep.py already established
for handling calibration transparently. 0.0 means "always predict the
top-scoring candidate, NONE is never possible."

Does not modify item_align.py, item_parser.py, corpus_probe.py,
edition_align.py, baseline_b5.py, or baseline_b6_llm.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.baseline_b7_reranker
"""
from __future__ import annotations

import sys

from app.research.cross_edition.item_parser import parse
from app.research.cross_edition.baseline_b6_llm import get_topk_candidates
from app.rag.embeddings import get_embedding_provider

RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"
TOP_K = 10
RETRIEVAL_MODEL = "BAAI/bge-small-en-v1.5"  # identical to B6's retrieval
FLOOR_GRID = (0.0, 0.3, 0.5, 0.7)

_reranker = None


def _get_reranker():
    global _reranker
    if _reranker is None:
        from sentence_transformers import CrossEncoder
        _reranker = CrossEncoder(RERANKER_MODEL, max_length=512)
    return _reranker


def align_items_b7_for_sample(
    old_pdf: str, new_pdf: str, sample_old_item_ids: list[str],
) -> dict:
    """Scores B7 ONLY for the given old_item_ids (parse-order-stable raw
    parse() ids expected - callers should join via sample_join.py, not
    align_items' post-remap ids, matching baseline_b6_llm's contract).

    Returns, per floor in FLOOR_GRID, a predicted item_id or 'NONE' for
    every wanted old item, plus the naive top-1-retrieval-only prediction
    (no reranking) for the same comparison B6's null result used."""
    reranker = _get_reranker()

    old_ed, new_ed = parse(old_pdf), parse(new_pdf)
    old_items, new_items = old_ed.items, new_ed.items
    wanted = set(sample_old_item_ids)

    provider = get_embedding_provider(backend="auto", model_name=RETRIEVAL_MODEL)
    old_vecs = provider.embed_texts([it.text for it in old_items])
    new_vecs = provider.embed_texts([it.text for it in new_items])

    results = {}
    for a, a_vec in zip(old_items, old_vecs):
        if a.item_id not in wanted:
            continue
        candidates = get_topk_candidates(a, new_items, a_vec, new_vecs, provider, TOP_K)

        pairs = [(a.text, c[1].text) for c in candidates]
        rerank_scores = reranker.predict(pairs)

        best_idx = int(rerank_scores.argmax())
        best_score = float(rerank_scores[best_idx])
        best_item_id = candidates[best_idx][1].item_id

        preds_by_floor = {}
        for floor in FLOOR_GRID:
            preds_by_floor[str(floor)] = best_item_id if best_score >= floor else "NONE"

        # Naive top-1-retrieval-only shortcut (no reranking at all) - the
        # same comparison that made B6's null result interpretable.
        naive_top1_id = candidates[0][1].item_id

        results[a.item_id] = {
            "old_item_id": a.item_id,
            "preds_by_floor": preds_by_floor,
            "naive_top1_predicted_item_id": naive_top1_id,
            "reranker_best_score": round(best_score, 4),
            "reranker_best_item_id": best_item_id,
        }

    return {"reranker_model": RERANKER_MODEL, "retrieval_model": RETRIEVAL_MODEL,
            "top_k": TOP_K, "floor_grid": list(FLOOR_GRID),
            "_results_by_old_id": results}


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    print("This module is invoked via run_b7_comparison.py, not standalone -")
    print("it needs the specific 233 sampled old_item_ids, not the whole document.")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
