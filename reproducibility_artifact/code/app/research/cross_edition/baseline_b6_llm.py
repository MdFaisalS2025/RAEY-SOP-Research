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

# AUDIT ROUND 4 FIX (2026-08-22): MODEL_ID previously read "gemini-2.5-flash",
# which is NOT the model that produced this study's reported B6 result -
# that model hit the free tier's real 20-requests/day cap (95.3% forced
# NONE fallback, discarded per PREREGISTRATION.md's 2026-08-18 B6 entry)
# and was replaced with gemini-3.5-flash-lite, run to completion with zero
# failures. Pinned to what actually ran, not what was originally intended.
MODEL_ID = "gemini-3.5-flash-lite"
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


def call_llm(client, prompt: str, model_id: str) -> str:
    from google.genai import types
    resp = client.models.generate_content(
        model=model_id,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.0),
    )
    return (resp.text or "").strip()


def _extract_retry_delay(exc: Exception) -> float | None:
    """Parses the API's own suggested retry delay (e.g. "Please retry in
    39.002060453s.") out of a 429 error, so backoff respects what the
    server actually asked for instead of a fixed/guessed schedule."""
    import re
    m = re.search(r"retryDelay['\"]?\s*:\s*['\"]?(\d+(?:\.\d+)?)s", str(exc))
    if m:
        return float(m.group(1))
    m = re.search(r"retry in (\d+(?:\.\d+)?)s", str(exc))
    return float(m.group(1)) if m else None


def parse_llm_reply(reply: str, candidates: list[tuple[float, object]]) -> str:
    """Returns the chosen item's item_id, or 'NONE'.

    AUDIT ROUND 4 FIX (2026-08-22): previously concatenated ALL digits in
    the reply before parsing, so a verbose reply like "1 or 2" became
    "12" (out of range -> silently NONE) and "Candidate 3 (100% match)"
    became "3100" (out of range -> silently NONE) - a real answer
    degrading to a false "no correspondence" prediction with no signal
    that parsing, not judgement, produced it. Not triggered in this
    study's actual 240 replies (all bare digits or "NONE" - verified by
    inspecting every cached raw_reply directly), but unguarded against
    any future run with a more verbose model. Now extracts the reply's
    FIRST standalone integer token (1-2 digits, matching the 1-10 range
    the prompt asks for) instead of concatenating every digit found."""
    import re
    cleaned = reply.strip().upper()
    if cleaned == "NONE" or not cleaned:
        return "NONE"
    m = re.search(r"\b(\d{1,2})\b", cleaned)
    if not m:
        return "NONE"
    idx = int(m.group(1)) - 1
    if 0 <= idx < len(candidates):
        return candidates[idx][1].item_id
    return "NONE"


def align_items_b6_for_sample(
    old_pdf: str, new_pdf: str, sample_old_item_ids: list[str],
    cache_path: str | None = None, model_id: str | None = None,
) -> dict:
    """Scores B6 ONLY for the given old_item_ids (parse-order-stable ids
    expected - callers should pass raw parse() ids, joined by the caller
    via sample_join.py, not the post-remap ids align_items produces).

    model_id overrides the module default MODEL_ID - used to test
    alternate models (e.g. gemini-2.5-flash-lite) against a SEPARATE
    cache path, never mixed with another model's cached responses."""
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set in environment")
    client = genai.Client(api_key=api_key)
    active_model = model_id or MODEL_ID

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

        # AUDIT ROUND 4 FIX (2026-08-22): cache key previously was bare
        # a.item_id, with no model/TOP_K/retrieval-model component. Changing
        # TOP_K or RETRIEVAL_MODEL would have silently reused a cached reply
        # of e.g. "3" against a DIFFERENT candidate list under the new
        # config - the same class of index-mismatch bug sample_join.py
        # exists to fix elsewhere in this study. Composite key makes a
        # config change a cache miss (forcing a fresh, correct call)
        # instead of a silent wrong answer.
        cache_key = f"{a.item_id}::{active_model}::top{TOP_K}::{RETRIEVAL_MODEL}"
        if cache_key in cache and cache[cache_key].get("call_succeeded"):
            reply = cache[cache_key]["raw_reply"]
        else:
            succeeded = False
            reply = "NONE"
            for attempt in range(5):
                try:
                    reply = call_llm(client, prompt, active_model)
                    succeeded = True
                    break
                except Exception as e:
                    delay = _extract_retry_delay(e) or (2 ** attempt)
                    if attempt == 4:
                        print(f"  WARNING: LLM call failed for {a.item_id!r} "
                              f"after 5 attempts, marking NONE (NOT a genuine "
                              f"LLM judgement - excluded from any trusted "
                              f"result): {e}")
                    else:
                        time.sleep(delay + 1)
            cache[cache_key] = {
                "prompt": prompt, "raw_reply": reply,
                "candidate_ids": [c[1].item_id for c in candidates],
                "call_succeeded": succeeded,  # False = forced NONE fallback,
                                                # not a real LLM answer
            }
            if cache_path:
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(cache, f, indent=2, ensure_ascii=False)

        predicted_id = parse_llm_reply(reply, candidates)
        results[a.item_id] = {
            "old_item_id": a.item_id,
            "b6_predicted_item_id": predicted_id,
            "raw_reply": reply,
            "call_succeeded": cache[cache_key].get("call_succeeded", False),
        }

    return {"model": active_model, "retrieval_model": RETRIEVAL_MODEL, "top_k": TOP_K,
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
