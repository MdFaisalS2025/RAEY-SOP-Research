"""
Meridian Reranker
Cross-encoder reranking with heuristic fallback.
Research prototype. Not for clinical use.
"""

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)


class CrossEncoderReranker:
    """Reranker using sentence-transformers CrossEncoder."""

    def __init__(self, model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"):
        from sentence_transformers import CrossEncoder
        logger.info(f"Loading reranker model: {model_name}")
        self.model = CrossEncoder(model_name)
        self._model_name = model_name

    @property
    def backend_name(self) -> str:
        return f"cross_encoder:{self._model_name}"

    def rerank(
        self, query: str, chunks: list[dict[str, Any]], top_k: int = 8
    ) -> list[dict[str, Any]]:
        if not chunks:
            return []
        pairs = [(query, c.get("text", c.get("chunk_text", ""))) for c in chunks]
        scores = self.model.predict(pairs)
        for i, chunk in enumerate(chunks):
            chunk["rerank_score"] = float(scores[i])
        chunks.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        for i, chunk in enumerate(chunks[:top_k]):
            chunk["rank"] = i + 1
        return chunks[:top_k]


class HeuristicReranker:
    """Lightweight fallback reranker using text matching heuristics."""

    @property
    def backend_name(self) -> str:
        return "heuristic"

    def rerank(
        self, query: str, chunks: list[dict[str, Any]], top_k: int = 8
    ) -> list[dict[str, Any]]:
        if not chunks:
            return []

        q_lower = query.lower()
        q_tokens = set(re.findall(r"[a-z0-9]+", q_lower))
        q_numbers = set(re.findall(r"\d+\.?\d*", query))

        for chunk in chunks:
            text = chunk.get("text", chunk.get("chunk_text", "")).lower()
            base_score = chunk.get("relevance_score", 0)

            # 1. Query term coverage (how many query words appear in chunk)
            text_tokens = set(re.findall(r"[a-z0-9]+", text))
            overlap = len(q_tokens & text_tokens)
            coverage = overlap / max(len(q_tokens), 1)

            # 2. Exact phrase match bonus
            phrase_bonus = 0.3 if q_lower in text else 0.0

            # 3. Numeric match bonus
            text_numbers = set(re.findall(r"\d+\.?\d*", text))
            num_bonus = 0.2 * len(q_numbers & text_numbers) if q_numbers else 0.0

            # 4. Section title relevance
            section = chunk.get("section_title", "").lower()
            section_bonus = 0.15 if any(t in section for t in q_tokens if len(t) > 3) else 0.0

            # 5. Chunk type alignment (already boosted, but add small bonus for exact match)
            chunk_type = chunk.get("chunk_type", "")
            type_bonus = 0.0
            if "step" in q_lower and chunk_type in ("step", "step_sequence"):
                type_bonus = 0.1
            elif any(w in q_lower for w in ("threshold", "dose", "maximum", "minimum", "target")) and chunk_type == "threshold":
                type_bonus = 0.1
            elif any(w in q_lower for w in ("contraindication", "avoid", "warning", "do not")) and chunk_type == "contraindication":
                type_bonus = 0.1

            rerank_score = base_score + coverage * 0.3 + phrase_bonus + num_bonus + section_bonus + type_bonus
            chunk["rerank_score"] = round(rerank_score, 4)

        chunks.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        for i, chunk in enumerate(chunks[:top_k]):
            chunk["rank"] = i + 1
        return chunks[:top_k]


class NoOpReranker:
    """Reranker that preserves the incoming order (used for ablation: reranker OFF)."""

    @property
    def backend_name(self) -> str:
        return "none"

    def rerank(
        self, query: str, chunks: list[dict[str, Any]], top_k: int = 8
    ) -> list[dict[str, Any]]:
        for i, chunk in enumerate(chunks[:top_k]):
            chunk["rank"] = i + 1
        return chunks[:top_k]


def get_reranker(
    backend: str = "auto",
    model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
) -> CrossEncoderReranker | HeuristicReranker:
    """Get the best available reranker."""
    if backend == "heuristic":
        return HeuristicReranker()

    if backend in ("auto", "cross_encoder"):
        try:
            return CrossEncoderReranker(model_name)
        except (ImportError, Exception) as e:
            if backend == "cross_encoder":
                raise
            logger.info(f"CrossEncoder not available ({e}), using heuristic reranker")

    return HeuristicReranker()


_shared_reranker: "CrossEncoderReranker | HeuristicReranker | None" = None


def get_shared_reranker(
    backend: str = "auto",
    model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
) -> CrossEncoderReranker | HeuristicReranker:
    """
    Process-wide singleton, mirroring app.rag.embedding_cache's pattern for
    the embedding model - a MeridianPipeline is constructed fresh on every
    request (see app/agents/pipeline.py call sites), so without this the
    cross-encoder model would reload from disk on every single query.
    """
    global _shared_reranker
    if _shared_reranker is None:
        _shared_reranker = get_reranker(backend=backend, model_name=model_name)
    return _shared_reranker
