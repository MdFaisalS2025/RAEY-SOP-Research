"""
Baseline B5: embedding-based text-only correspondence matching. A
post-hoc, NOT pre-registered addition (see PREREGISTRATION.md section 11,
the B5 pre-commitment entry, logged before this was run) - answers the
question a 2026 reviewer will ask first: does the structural method (or
even the lexical B2/B3/B4 baselines) hold up against a modern embedding
matcher, not just Jaccard/difflib?

Design: identical scope and consumption rule to baseline_b2.align_items_b2
- for each old item, search similarity against every item in the WHOLE
new-edition document (no guideline/section restriction, no identifier
lookup), greedy one-to-one consumption in old-item document order. The
ONLY thing that differs from B2 is the similarity function: cosine
similarity between sentence embeddings (app.rag.embeddings, the same
provider the production RAG pipeline uses - BAAI/bge-small-en-v1.5 via
sentence-transformers, with a TF-IDF fallback if that backend is
unavailable) instead of token-level Jaccard.

The similarity floor (0.85) is a documented convention for near-duplicate
detection with sentence embeddings, NOT calibrated against this study's
ground truth - no threshold search was run against the 209-item sample
before choosing it, matching this study's standing discipline against
tuning parameters on test data (PREREGISTRATION.md section 3.4), applied
here even though B5 itself is post-hoc.

Does not modify item_align.py, item_parser.py, corpus_probe.py, or
edition_align.py - imports parse() as a black box and app.rag.embeddings
unchanged.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.baseline_b5 old.pdf new.pdf
"""
from __future__ import annotations

import sys

from app.research.cross_edition.item_parser import parse
from app.rag.embeddings import get_embedding_provider

_SIM_FLOOR = 0.85


def align_items_b5(old_pdf: str, new_pdf: str, backend: str = "auto") -> dict:
    old_ed, new_ed = parse(old_pdf), parse(new_pdf)
    old_items, new_items = old_ed.items, new_ed.items

    provider = get_embedding_provider(backend=backend)
    old_vecs = provider.embed_texts([it.text for it in old_items])
    new_vecs = provider.embed_texts([it.text for it in new_items])

    consumed: set[str] = set()
    all_results: list[dict] = []

    for a, a_vec in zip(old_items, old_vecs):
        best, best_s, best_idx = None, 0.0, -1
        for idx, (x, x_vec) in enumerate(zip(new_items, new_vecs)):
            if x.item_id in consumed:
                continue
            s = provider.similarity(a_vec, x_vec)
            if s > best_s:
                best, best_s, best_idx = x, s, idx
        matched = best is not None and best_s >= _SIM_FLOOR
        if matched:
            consumed.add(best.item_id)
        all_results.append({
            "old_item_id": a.item_id,
            "b5_predicted_item_id": best.item_id if matched else "NONE",
            "b5_similarity": round(best_s, 4),
        })

    return {
        "old_items": len(old_items), "new_items": len(new_items),
        "backend": provider.backend_name,
        "_all_results": all_results,
    }


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    r = align_items_b5(argv[1], argv[2])
    matched = sum(1 for x in r["_all_results"] if x["b5_predicted_item_id"] != "NONE")
    print(f"backend: {r['backend']}")
    print(f"old_items: {r['old_items']}  new_items: {r['new_items']}")
    print(f"B5 matched: {matched}/{r['old_items']} "
          f"({100*matched/max(1, r['old_items']):.1f}%)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
