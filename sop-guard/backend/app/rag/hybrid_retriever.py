"""
Meridian Hybrid Retriever
Combines TF-IDF scoring with chunk-type boosting, metadata filtering,
and clinical synonym expansion.
Research prototype. Not for clinical use.
"""

import re
import math
from collections import Counter
from typing import Any, Optional

from app.rag.clinical_terms import expand_query as clinical_expand_query, SYNONYM_GROUPS
from app.rag.reranker import NoOpReranker
from app.rag.embedding_cache import is_dense_backend_active, dense_similarity, get_shared_embedding_provider

# Weight given to dense (semantic) similarity vs sparse (TF-IDF) score when
# a real embedding model is available. Sparse stays in the mix because exact
# drug names, abbreviations, and numeric thresholds are still best caught by
# keyword overlap.
_DENSE_WEIGHT = 0.55
_SPARSE_WEIGHT = 0.45

# Chunk type boost factors based on query type
CHUNK_TYPE_BOOSTS = {
    "procedure_steps": {"step_sequence": 4.0, "step": 2.5, "section": 0.8, "summary": 0.5, "threshold": 0.6, "contraindication": 0.6},
    "sequence": {"step_sequence": 4.0, "step": 2.5, "section": 0.8, "summary": 0.5, "threshold": 0.6, "contraindication": 0.6},
    "threshold": {"threshold": 4.0, "step": 1.0, "section": 0.8, "summary": 0.5, "step_sequence": 0.8},
    "contraindication": {"contraindication": 4.0, "step": 0.8, "section": 0.8, "summary": 0.5, "threshold": 0.6},
    "monitoring": {"step": 2.0, "step_sequence": 2.5, "section": 1.5, "threshold": 1.5, "summary": 0.5, "contraindication": 0.8},
    "medication": {"threshold": 3.0, "contraindication": 2.5, "step": 1.5, "section": 1.0, "summary": 0.5},
    "role_responsibility": {"section": 2.0, "step": 1.5, "step_sequence": 1.0, "summary": 0.8},
    "general": {"summary": 1.5, "section": 1.2, "step_sequence": 1.0, "step": 0.8},
}


class HybridRetriever:
    """
    Hybrid retriever combining TF-IDF with chunk-type boosting,
    query expansion, and metadata filtering.
    """

    def __init__(self, chunks: list[dict[str, Any]], reranker=None):
        self.chunks = chunks
        self._idf: dict[str, float] = {}
        self._build_idf()
        # Defaults to no-op: the ablation endpoint (GET /api/evaluation/ablation)
        # measured HeuristicReranker actively making retrieval worse - average
        # top-1 relevance 0.305 with it enabled vs 0.334 disabled, reordering
        # the top-3 in 70% of the eval queries. It double-counts signals the
        # base TF-IDF + chunk-type-boost score already accounts for (raw,
        # non-IDF-weighted term overlap and numeric-match bonuses), so a
        # chunk that repeats common query words can outrank one the base
        # score correctly preferred. Pass reranker=HeuristicReranker()
        # explicitly to re-enable it once that scoring is fixed and
        # re-validated against the ablation.
        self._reranker = reranker or NoOpReranker()

    def _tokenize(self, text: str) -> list[str]:
        tokens = re.findall(r"[a-z0-9]+", text.lower())
        stop = {"the", "a", "an", "is", "are", "was", "were", "be", "been",
                "to", "of", "in", "for", "on", "with", "at", "by", "from",
                "and", "or", "not", "it", "this", "that", "as", "but", "if",
                "do", "does", "did", "will", "would", "can", "could", "should",
                "may", "might", "shall", "has", "have", "had", "what", "when",
                "where", "how", "which", "who", "whom"}
        return [t for t in tokens if t not in stop and len(t) > 1]

    def _build_idf(self) -> None:
        n = len(self.chunks)
        if n == 0:
            return
        df: Counter = Counter()
        for chunk in self.chunks:
            unique = set(self._tokenize(chunk.get("text", chunk.get("chunk_text", ""))))
            for token in unique:
                df[token] += 1
        self._idf = {t: math.log((n + 1) / (c + 1)) + 1 for t, c in df.items()}

    def _tfidf_score(self, query_tokens: list[str], text: str) -> float:
        chunk_tokens = self._tokenize(text)
        if not chunk_tokens or not query_tokens:
            return 0.0
        chunk_tf = Counter(chunk_tokens)
        score = 0.0
        for qt in query_tokens:
            if qt in chunk_tf:
                tf = chunk_tf[qt] / len(chunk_tokens)
                idf = self._idf.get(qt, 1.0)
                score += tf * idf
        return score / len(query_tokens)

    def _expand_query(self, query: str) -> list[str]:
        """Expand query with clinical synonyms and abbreviations."""
        return clinical_expand_query(query, max_variants=6)

    def search(
        self,
        query: str,
        top_k: int = 8,
        query_type: str = "general",
        department: Optional[str] = None,
        sop_id: Optional[str] = None,
        status_filter: str = "active",
        expand_query: bool = True,
    ) -> list[dict[str, Any]]:
        """
        Hybrid search with query expansion, chunk-type boosting, and metadata filtering.
        """
        # 1. Expand query with synonyms
        query_variants = self._expand_query(query) if expand_query else [query]

        # 1b. Dense (semantic) similarity is only computed if a real
        # embedding model is loaded; otherwise this stays a no-op and
        # behavior is identical to the TF-IDF-only retriever.
        use_dense = is_dense_backend_active()

        # 2. Score all chunks across query variants
        chunk_scores: dict[int, float] = {}

        for variant in query_variants:
            variant_tokens = self._tokenize(variant)
            if not variant_tokens:
                continue

            for i, chunk in enumerate(self.chunks):
                # Metadata filtering
                if department and chunk.get("department", "").lower() != department.lower():
                    continue
                if sop_id and chunk.get("sop_id", "") != sop_id:
                    continue
                if status_filter and chunk.get("status", "active") == "archived":
                    continue

                text = chunk.get("text", chunk.get("chunk_text", ""))
                sparse_score = self._tfidf_score(variant_tokens, text)

                if use_dense:
                    dense_score = dense_similarity(variant, text)
                    base_score = (_DENSE_WEIGHT * dense_score) + (_SPARSE_WEIGHT * sparse_score)
                else:
                    base_score = sparse_score

                if base_score > 0:
                    # Apply chunk-type boost
                    chunk_type = chunk.get("chunk_type", "section")
                    boosts = CHUNK_TYPE_BOOSTS.get(query_type, CHUNK_TYPE_BOOSTS["general"])
                    type_boost = boosts.get(chunk_type, 1.0)

                    boosted_score = base_score * type_boost

                    # Keep best score across variants
                    if i not in chunk_scores or boosted_score > chunk_scores[i]:
                        chunk_scores[i] = boosted_score

        # 3. Build results
        scored = []
        for idx, score in chunk_scores.items():
            chunk = self.chunks[idx]
            scored.append({
                **chunk,
                "relevance_score": round(score, 4),
                "retrieval_source": "hybrid",
                "rank": 0,
            })

        # 4. Sort and rank
        scored.sort(key=lambda x: x["relevance_score"], reverse=True)

        # 5. Apply reranker
        if len(scored) > 1:
            scored = self._reranker.rerank(query, scored, top_k=top_k)
        else:
            for i, item in enumerate(scored[:top_k]):
                item["rank"] = i + 1

        return scored[:top_k]

    def get_retrieval_trace(
        self, query: str, query_type: str = "general"
    ) -> dict[str, Any]:
        """Return trace info about retrieval for observability."""
        variants = self._expand_query(query)
        dense_active = is_dense_backend_active()
        embedding_backend = get_shared_embedding_provider().backend_name
        return {
            "original_query": query,
            "query_variants": variants,
            "query_type": query_type,
            "total_chunks_searched": len(self.chunks),
            "retrieval_method": "hybrid_dense_sparse_with_type_boost" if dense_active else "hybrid_tfidf_with_type_boost",
            "embedding_backend": embedding_backend,
            "synonym_expansion": len(variants) > 1,
            "reranker_backend": self._reranker.backend_name,
        }
