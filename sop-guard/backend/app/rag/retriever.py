"""
SOP-Guard Mock Retriever
------------------------
TF-IDF / word-overlap retrieval for mock mode.
Research prototype  - NOT for clinical use.
"""

import re
import math
from collections import Counter
from typing import Any


class MockRetriever:
    """Simple word-overlap retriever for development without embedding models."""

    def __init__(self, chunks: list[dict[str, Any]]):
        """
        Args:
            chunks: list of dicts with keys: chunk_text, section_title, sop_title, sop_id, chunk_index
        """
        self.chunks = chunks
        self._idf: dict[str, float] = {}
        self._build_idf()

    def _tokenize(self, text: str) -> list[str]:
        """Lowercase tokenization with basic stop-word removal."""
        tokens = re.findall(r"[a-z0-9]+", text.lower())
        stop = {"the", "a", "an", "is", "are", "was", "were", "be", "been",
                "to", "of", "in", "for", "on", "with", "at", "by", "from",
                "and", "or", "not", "it", "this", "that", "as", "but", "if"}
        return [t for t in tokens if t not in stop and len(t) > 1]

    def _build_idf(self) -> None:
        """Compute inverse document frequency across all chunks."""
        n = len(self.chunks)
        if n == 0:
            return
        df: Counter = Counter()
        for chunk in self.chunks:
            unique_tokens = set(self._tokenize(chunk.get("chunk_text", "")))
            for token in unique_tokens:
                df[token] += 1
        self._idf = {
            token: math.log((n + 1) / (count + 1)) + 1
            for token, count in df.items()
        }

    def _score(self, query_tokens: list[str], chunk_text: str) -> float:
        """TF-IDF weighted overlap score."""
        chunk_tokens = self._tokenize(chunk_text)
        if not chunk_tokens or not query_tokens:
            return 0.0

        chunk_tf = Counter(chunk_tokens)
        score = 0.0
        for qt in query_tokens:
            if qt in chunk_tf:
                tf = chunk_tf[qt] / len(chunk_tokens)
                idf = self._idf.get(qt, 1.0)
                score += tf * idf

        # Normalize by query length
        return score / len(query_tokens) if query_tokens else 0.0

    def search(self, query: str, top_k: int = 5) -> list[dict[str, Any]]:
        """
        Search chunks for the given query, returning top_k ranked results.

        Returns list of dicts with original chunk data plus 'relevance_score'.
        """
        query_tokens = self._tokenize(query)
        if not query_tokens or not self.chunks:
            return []

        scored = []
        for chunk in self.chunks:
            score = self._score(query_tokens, chunk.get("chunk_text", ""))
            if score > 0:
                result = {**chunk, "relevance_score": round(score, 4)}
                scored.append(result)

        scored.sort(key=lambda x: x["relevance_score"], reverse=True)
        return scored[:top_k]
