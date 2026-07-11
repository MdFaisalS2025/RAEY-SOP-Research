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

Returns the same shape the frontend expects (overall_faithfulness + sentences)
plus a `method` field ("semantic" or "keyword_fallback").

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
    overall = supported / total if total else 1.0

    return {
        "sentences": results,
        "overall_faithfulness": round(overall, 2),
        "method": "semantic",
        "supported_count": supported,
        "partial_count": partial,
        "unsupported_count": unsupported,
        "grounded_count": supported + partial,
        "total_checked": total,
    }
