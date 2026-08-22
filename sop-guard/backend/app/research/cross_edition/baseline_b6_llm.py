"""
Baseline B6: LLM retrieve-then-rerank matching (audit round 3, Phase 2).

Field-standard pattern for LLM-based ontology/entity matching (MapperGPT,
LLMs4OM, Agent-OM - see FEASIBILITY.md's ontology-matching related-work
note): a high-recall retriever supplies top-k candidates, and the LLM
reviews/reranks rather than generating a match from scratch across the
whole document. This keeps cost to O(sample size), not O(n*m) - only the
233 already-sampled items are ever scored, never the full ~1500-2000
item document, which is what actually makes LLM matching prohibitively
expensive in general (one documented study spent $290 on OpenAI calls
for a comparable task; a 10k-class ontology implies ~10^8 pairwise
comparisons).

DESIGN ASYMMETRY, DISCLOSED (not buried): unlike B1-B5, which each solve
the FULL document alignment problem under a global one-to-one
consumption constraint, B6 is only ever asked about the 233 sampled
items, each independently, with no consumption tracking across items.
This plausibly ADVANTAGES B6 - it never loses a candidate to an earlier
item's greedy claim the way B1-B5 can - and this is stated as a
limitation of the comparison, not smoothed over.

Retrieval: the SAME B5 configuration already reported throughout this
study (bge-small-en-v1.5, unchanged) supplies the top-k=10 candidates
for each sampled old item, by cosine similarity across the WHOLE new
document (matching B5's own unscoped character, not a different,
more-favourable retriever chosen after seeing the floor-sweep grid).

Reproducibility: model id pinned, temperature=0, every raw response
cached to JSON so the artifact reproduces even if the API or model
changes later.

Does not modify item_align.py, item_parser.py, corpus_probe.py,
edition_align.py, or baseline_b5.py.

Requires GEMINI_API_KEY in the environment (never read back or logged
by this module).

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.baseline_b6_llm
"""
from __future__ import annotations

import json
import os
import sys
import time

from app.research.cross_edition.item_parser import parse
from app.rag.embeddings import get_embedding_provider

MODEL_ID = "gemini-2.5-flash"
TOP_K = 10
RETRIEVAL_MODEL = "BAAI/bge-small-en-v1.5"  # matches baseline_b5.py's default


def get_topk_candidates(old_item, new_items, old_vec, new_vecs, provider, k: int):
    """Top-k by cosine similarity, NO consumption tracking - retrieval
    only, independent of any downstream one-to-one matching decision."""
    scored = [(provider.similarity(old_vec, nv), ni) for ni, nv in zip(new_items, new_vecs)]
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:k]


def build_prompt(old_text: str, candidates: list[tuple[float, object]]) -> str:
    lines = [
        "You are comparing a recommendation from an OLD edition of a document",
        "to candidate recommendations from a NEW edition, to determine whether",
        "the same recommendation persists (possibly reworded) or was removed.",
        "",
        "OLD ITEM:",
        old_text.strip(),
        "",
        "CANDIDATE NEW ITEMS (numbered, most similar first):",
    ]
    for i, (_score, item) in enumerate(candidates, start=1):
        lines.append(f"{i}. {item.text.strip()}")
    lines += [
        "",
        "Which candidate is the SAME recommendation as the OLD ITEM (reworded",
        "or not)? Reply with ONLY the number (1-10) of the best match, or reply",
        "NONE if none of the candidates represent the same recommendation.",
        "Reply with nothing else - just the number or the word NONE.",
    ]
    return "\n".join(lines)


def call_llm(client, prompt: str) -> str:
    from google.genai import types
    resp = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.0),
    )
    return (resp.text or "").strip()


def parse_llm_reply(reply: str, candidates: list[tuple[float, object]]) -> str:
    """Returns the chosen item's item_id, or 'NONE'."""
    cleaned = reply.strip().upper()
    if cleaned == "NONE" or not cleaned:
        return "NONE"
    digits = "".join(c for c in cleaned if c.isdigit())
    if not digits:
        return "NONE"
    idx = int(digits) - 1
    if 0 <= idx < len(candidates):
        return candidates[idx][1].item_id
    return "NONE"


def align_items_b6_for_sample(
    old_pdf: str, new_pdf: str, sample_old_item_ids: list[str],
    cache_path: str | None = None,
) -> dict:
    """Scores B6 ONLY for the given old_item_ids (parse-order-stable ids
    expected - callers should pass raw parse() ids, joined by the caller
    via sample_join.py, not the post-remap ids align_items produces)."""
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set in environment")
    client = genai.Client(api_key=api_key)

    old_ed, new_ed = parse(old_pdf), parse(new_pdf)
    old_items, new_items = old_ed.items, new_ed.items
    wanted = set(sample_old_item_ids)

    provider = get_embedding_provider(backend="auto", model_name=RETRIEVAL_MODEL)
    old_vecs = provider.embed_texts([it.text for it in old_items])
    new_vecs = provider.embed_texts([it.text for it in new_items])

    cache: dict = {}
    if cache_path and os.path.exists(cache_path):
        with open(cache_path, encoding="utf-8") as f:
            cache = json.load(f)

    results = {}
    for a, a_vec in zip(old_items, old_vecs):
        if a.item_id not in wanted:
            continue
        candidates = get_topk_candidates(a, new_items, a_vec, new_vecs, provider, TOP_K)
        prompt = build_prompt(a.text, candidates)

        cache_key = a.item_id
        if cache_key in cache:
            reply = cache[cache_key]["raw_reply"]
        else:
            for attempt in range(3):
                try:
                    reply = call_llm(client, prompt)
                    break
                except Exception as e:
                    if attempt == 2:
                        reply = "NONE"
                        print(f"  WARNING: LLM call failed for {a.item_id!r} after 3 attempts: {e}")
                    else:
                        time.sleep(2 ** attempt)
            cache[cache_key] = {
                "prompt": prompt, "raw_reply": reply,
                "candidate_ids": [c[1].item_id for c in candidates],
            }
            if cache_path:
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(cache, f, indent=2, ensure_ascii=False)

        predicted_id = parse_llm_reply(reply, candidates)
        results[a.item_id] = {
            "old_item_id": a.item_id,
            "b6_predicted_item_id": predicted_id,
            "raw_reply": reply,
        }

    return {"model": MODEL_ID, "retrieval_model": RETRIEVAL_MODEL, "top_k": TOP_K,
             "_results_by_old_id": results}


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    print("This module is invoked via run_b6_comparison.py, not standalone -")
    print("it needs the specific 233 sampled old_item_ids, not the whole document.")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
