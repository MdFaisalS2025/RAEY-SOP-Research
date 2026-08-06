"""
Meridian Semantic Faithfulness Checker
---------------------------------------
Grades each answer sentence by semantic similarity to the retrieved chunks
using the EXISTING embedding provider (embedding_cache.py). When dense
embeddings are unavailable it falls back to the keyword grounding in
hallucination_checker.py, so this never requires new heavy dependencies.

Classification thresholds (cosine):
  supported   >= 0.55
  partial     0.40 - 0.55
  unsupported < 0.40

Calibration attempt (2026-08-05, bge-small-en-v1.5, the model this backend
actually uses): 4 (faithful-paraphrase, unrelated-sentence) pairs against
real demo-corpus chunks (SOP-ICU-001's norepinephrine/blood-culture/
antibiotics/lactate steps), each paraphrase checked against its own source
chunk and each unrelated sentence checked against a different chunk's text
(PPE donning / insulin-hold / code-blue epinephrine / transfusion
contraindications - all real chunks from other SOPs). Measured: supported
scores 0.832-0.952, unrelated scores 0.431-0.656.

That is NOT a clean separation - one unrelated pair ("epinephrine dosing in
code blue" vs. an antibiotics-in-sepsis chunk) scored 0.656, above the
current 0.55 supported threshold, because both sentences share the same
"give drug X within/every Y minutes in an emergency" template; general-
purpose sentence embeddings pick up on that structural similarity as if it
were topical agreement. On this fixture the current threshold would have
mislabeled that pair "supported". n=4 is too small to responsibly move the
threshold on (a different unrelated pair could as easily land at 0.35 as at
0.656, and raising the floor to e.g. 0.75 to clear this one case is not
validated against enough genuine paraphrases to know it wouldn't cost real
recall) - documented here as a known, measured risk rather than silently
assumed away. A properly-sized labeled fixture (dozens of pairs, held-out
split) is exactly the kind of measurement the Phase U research plan's real
corpus would support; until then, treat "supported" as "probably grounded"
and lean on numeric_verifier.py / the procedural verifiers in app/verifier/
for the specific-fact checks this method structurally cannot make (see the
naming note below).

Returns the same shape the frontend expects (overall_faithfulness + sentences)
plus a `method` field ("semantic" or "keyword_fallback").

Naming note: this module was previously named faithfulness_nli.py, which
overclaimed - cosine similarity measures topical relatedness, not entailment,
and cannot itself detect a sentence that contradicts its source on a fact
(that's what numeric_verifier.py and the rule-based/NLI-lite procedural
verifiers in app/verifier/ are for; see nli_verifier.py's docstring for a
verifier that genuinely does model entailment signals - numeric equality,
negation/polarity agreement, step-order agreement, still without a neural
NLI model, but closer to the concept). Renamed to describe what the
similarity-based method actually measures.

Research prototype. Not for clinical use.
"""

import re
from typing import Any, Callable, Optional

from app.rag.hallucination_checker import check_faithfulness
from app.rag.citation_tracker import attach_citation_numbers

_SUPPORTED_THRESHOLD = 0.55
_PARTIAL_THRESHOLD = 0.40


def _split_sentences(answer: str) -> list[str]:
    """Reuse the hallucination_checker sentence approach."""
    raw = re.split(r"(?<=[.!?])\s+|(?=\d+\.\s)", answer.strip())
    out = []
    for s in raw:
        s = s.strip()
        if len(s) <= 20:
            continue
        if s.startswith("#") or s.startswith("Source:") or s.startswith("---"):
            continue
        if "research prototype" in s.lower():
            continue
        out.append(s)
    return out


def _default_embed_similarity():
    """
    Return (available, sim_fn). sim_fn(a, b) -> cosine in [0,1].
    Uses the shared dense embedding provider only when a real model is loaded.
    """
    try:
        from app.rag.embedding_cache import is_dense_backend_active, dense_similarity
        if is_dense_backend_active():
            return True, dense_similarity
    except Exception:
        pass
    return False, None


def get_similarity_fn():
    """Public accessor for the same sim_fn check_faithfulness_semantic uses,
    for other post-processing steps (see citation_tracker.auto_insert_citations)
    that want the identical "how similar is this sentence to this chunk"
    signal rather than reimplementing their own. Returns None when dense
    embeddings aren't available."""
    _, sim_fn = _default_embed_similarity()
    return sim_fn


def check_faithfulness_semantic(
    answer: str,
    chunks: list[dict[str, Any]],
    embed_fn: Optional[Callable[[str, str], float]] = None,
) -> dict[str, Any]:
    """
    Semantic faithfulness scoring.

    Args:
        answer: generated answer text.
        chunks: retrieved chunks (each with "text" or "chunk_text").
        embed_fn: optional cosine similarity function sim(a, b) -> float in [0,1].
                  If None, the shared dense provider is used; if that is not
                  available, we fall back to keyword grounding.

    Returns dict with: sentences[], overall_faithfulness, method,
    plus supported/partial/unsupported counts.
    """
    sim_fn = embed_fn
    if sim_fn is None:
        available, sim_fn = _default_embed_similarity()
        if not available:
            # Keyword fallback: reuse the existing checker, annotate method.
            base = check_faithfulness(answer, chunks)
            base["method"] = "keyword_fallback"
            # Map grounded/ungrounded to supported/partial/unsupported for the UI.
            supported = base.get("grounded_count", 0)
            total = base.get("total_checked", 0)
            base["supported_count"] = supported
            base["partial_count"] = 0
            base["unsupported_count"] = total - supported
            return base

    chunk_texts = [
        (c.get("text") or c.get("chunk_text") or "") for c in chunks
    ]
    chunk_titles = [c.get("sop_title", "Unknown") for c in chunks]

    sentences = _split_sentences(answer)
    results: list[dict[str, Any]] = []
    supported = partial = unsupported = 0

    for sentence in sentences:
        best_sim = 0.0
        best_idx = -1
        for i, text in enumerate(chunk_texts):
            if not text:
                continue
            try:
                sim = float(sim_fn(sentence, text))
            except Exception:
                sim = 0.0
            if sim > best_sim:
                best_sim = sim
                best_idx = i

        if best_sim >= _SUPPORTED_THRESHOLD:
            label = "supported"
            grounded = True
            supported += 1
        elif best_sim >= _PARTIAL_THRESHOLD:
            label = "partial"
            grounded = True
            partial += 1
        else:
            label = "unsupported"
            grounded = False
            unsupported += 1

        results.append({
            "text": sentence[:200],
            "label": label,
            "grounded": grounded,
            "similarity": round(best_sim, 3),
            "confidence": round(best_sim, 3),
            "source_chunk": chunk_titles[best_idx] if best_idx >= 0 else "Unknown",
        })

    attach_citation_numbers(answer, results)

    total = len(results)
    # Strict: only "supported" (best_sim >= 0.55) counts toward the headline
    # score. "partial" sentences are real, non-trivial similarity (0.40-0.55)
    # but not confident enough to count as faithfulness - see
    # at_least_partial_count below for the looser reading, which is a
    # separate diagnostic figure, not an alternate definition of this one.
    overall = supported / total if total else 1.0

    return {
        "sentences": results,
        "overall_faithfulness": round(overall, 2),
        "method": "semantic",
        "supported_count": supported,
        "partial_count": partial,
        "unsupported_count": unsupported,
        # Diagnostic only - NOT used in overall_faithfulness above, which is
        # strict (supported-only). This counts "supported or partial" for
        # callers that want to distinguish "confidently wrong/unrelated"
        # from "somewhat related but not confidently grounded". Previously
        # named grounded_count, which read as a second definition of
        # "grounded" competing with overall_faithfulness's stricter one -
        # renamed to make the looser criterion explicit in the field name.
        "at_least_partial_count": supported + partial,
        "total_checked": total,
    }
