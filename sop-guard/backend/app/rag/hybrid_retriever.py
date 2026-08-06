"""
Meridian Hybrid Retriever
Combines TF-IDF scoring with chunk-type boosting, metadata filtering,
and clinical synonym expansion.
Research prototype. Not for clinical use.
"""

import logging
import re
import math
from collections import Counter
from typing import Any, Optional

from app.config import settings
from app.rag.clinical_terms import expand_query as clinical_expand_query, SYNONYM_GROUPS
from app.rag.reranker import NoOpReranker
from app.rag.embedding_cache import is_dense_backend_active, dense_similarity, get_shared_embedding_provider
from app.rag.entity_graph import DRUG_LEXICON, CONDITION_LEXICON

logger = logging.getLogger(__name__)

# Standard RRF constant (Cormack/Clarke/Buettcher 2009's original paper,
# widely reused since): dampens the influence of rank 1 vs rank 2 so a
# single signal's top pick doesn't dominate fusion as strongly as it would
# with a smaller k. Not tuned against this corpus specifically - it's the
# well-established default, not a free parameter worth ablating at 22 SOPs.
_RRF_K = 60

# Same lexicon entity_sufficiency.py's entity_grounding check reads at the
# other end of this pipeline. Reused here (not duplicated) so a query
# naming a specific drug/condition ranks the chunk that actually contains
# it above same-chunk-type chunks from unrelated SOPs - chunk-type
# boosting alone (CHUNK_TYPE_BOOSTS below) can't tell "the sepsis SOP's
# norepinephrine dosing" from "the code blue SOP's compression rate",
# since both are just "threshold" chunks under a "medication" query.
_ENTITY_TERMS = DRUG_LEXICON + CONDITION_LEXICON
_ENTITY_MATCH_BOOST = 1.8


def _query_entities(query: str) -> list[str]:
    low = query.lower()
    return [term for term in _ENTITY_TERMS if re.search(r"\b" + re.escape(term) + r"\b", low)]

# Weight given to dense (semantic) similarity vs sparse (TF-IDF) score when
# a real embedding model is available. Sparse stays in the mix because exact
# drug names, abbreviations, and numeric thresholds are still best caught by
# keyword overlap.
_DENSE_WEIGHT = 0.55
_SPARSE_WEIGHT = 0.45

# Chunk type boost factors based on query type
CHUNK_TYPE_BOOSTS = {
    "procedure_steps": {"step_sequence": 4.0, "step": 2.5, "section": 0.8, "summary": 0.5, "threshold": 0.6, "threshold_sequence": 0.5, "contraindication": 0.6},
    "sequence": {"step_sequence": 4.0, "step": 2.5, "section": 0.8, "summary": 0.5, "threshold": 0.6, "threshold_sequence": 0.5, "contraindication": 0.6},
    "threshold": {"threshold": 4.0, "threshold_sequence": 0.9, "step": 1.0, "section": 0.8, "summary": 0.5, "step_sequence": 0.8},
    "contraindication": {"contraindication": 4.0, "step": 0.8, "section": 0.8, "summary": 0.5, "threshold": 0.6, "threshold_sequence": 0.5},
    "monitoring": {"step": 2.0, "step_sequence": 2.5, "section": 1.5, "threshold": 1.5, "threshold_sequence": 0.8, "summary": 0.5, "contraindication": 0.8},
    "medication": {"threshold": 3.0, "threshold_sequence": 0.8, "contraindication": 2.5, "step": 1.5, "section": 1.0, "summary": 0.5},
    "role_responsibility": {"section": 2.0, "step": 1.5, "step_sequence": 1.0, "summary": 0.8},
    "general": {"summary": 1.5, "section": 1.2, "step_sequence": 1.0, "threshold_sequence": 0.8, "step": 0.8},
}


class HybridRetriever:
    """
    Hybrid retriever combining TF-IDF with chunk-type boosting,
    query expansion, and metadata filtering.
    """

    def __init__(
        self,
        chunks: list[dict[str, Any]],
        reranker=None,
        sparse_backend: Optional[str] = None,
        fusion: Optional[str] = None,
    ):
        self.chunks = chunks
        self._idf: dict[str, float] = {}
        self._build_idf()

        self._sparse_backend = sparse_backend or settings.RAG_SPARSE_BACKEND
        self._fusion = fusion or settings.RAG_FUSION
        self._bm25 = None
        if self._sparse_backend == "bm25":
            self._bm25 = self._build_bm25()
            if self._bm25 is None:
                # rank_bm25 not installed, or nothing to index - degrade to
                # the always-available scorer rather than fail retrieval.
                self._sparse_backend = "tfidf"

        # Defaults to no-op. HeuristicReranker double-counts signals the base
        # TF-IDF + chunk-type-boost score already accounts for (raw,
        # non-IDF-weighted term overlap and numeric-match bonuses), so a
        # chunk that repeats common query words can plausibly outrank one the
        # base score correctly preferred - a real, structural risk, not
        # measured away.
        #
        # An earlier version of this comment cited a "measured" 0.305 (on) vs
        # 0.334 (off) top-1-relevance result from GET /api/evaluation/ablation
        # as evidence the reranker hurts retrieval. That comparison is
        # invalid and has been retracted: run_ablation() (ragas_lite.py)
        # scores each arm's top-1 chunk using `relevance_score`, the PRE-
        # rerank base score - so the no-op arm's "top-1 relevance" is, by
        # construction, the maximum base score over all candidates (no-op
        # preserves base-score order), while the reranked arm's top-1 chunk
        # is whichever chunk `rerank_score` promoted, which can only match or
        # undercut that maximum. "Reranker off wins" was therefore a
        # mathematical identity of the metric, not an empirical finding about
        # retrieval quality - the ablation never had access to any ground
        # truth independent of the score it was comparing.
        #
        # NoOpReranker remains the default because the double-counting risk
        # above is real and unresolved, not because of the retracted number.
        # Whether reranking actually helps or hurts on this corpus is
        # currently unknown; answering that needs a relevance judgment that
        # doesn't come from either arm's own scoring (e.g. expected-SOP
        # ground truth per query, as app/rag/evaluator.py uses for a much
        # smaller case set) - see the Phase U research plan for the
        # broader effort to build one. Pass reranker=HeuristicReranker() or
        # CrossEncoderReranker() explicitly to enable a reranker; nothing in
        # this codebase currently measures whether that's a good idea.
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

    def _build_bm25(self):
        """Build a BM25Okapi index over every chunk's tokenized text.
        Returns None (caller falls back to tfidf) if rank_bm25 isn't
        installed or there are no chunks to index - same graceful-
        degradation pattern as the embedding/reranker backends."""
        if not self.chunks:
            return None
        try:
            from rank_bm25 import BM25Okapi
        except ImportError:
            logger.warning("RAG_SPARSE_BACKEND=bm25 requested but rank_bm25 is not installed - falling back to tfidf.")
            return None
        corpus_tokens = [
            self._tokenize(c.get("text", c.get("chunk_text", ""))) for c in self.chunks
        ]
        return BM25Okapi(corpus_tokens)

    def _sparse_scores_all(self, query_tokens: list[str]) -> dict[int, float]:
        """Sparse score for every chunk in the corpus, via whichever
        backend is configured. Computing the full array (rather than only
        for pre-filtered chunks, as the single-chunk _tfidf_score caller
        does inline) is required for bm25 (BM25Okapi scores the whole
        corpus in one call) and is numerically identical to the per-chunk
        tfidf path since _tfidf_score doesn't depend on any other chunk -
        filtering afterward gives the same result either way."""
        if self._sparse_backend == "bm25" and self._bm25 is not None:
            if not query_tokens:
                return {}
            scores = self._bm25.get_scores(query_tokens)
            return {i: float(s) for i, s in enumerate(scores)}
        return {
            i: self._tfidf_score(query_tokens, c.get("text", c.get("chunk_text", "")))
            for i, c in enumerate(self.chunks)
        }

    def _fuse_scores(
        self,
        sparse_scores: dict[int, float],
        dense_scores: Optional[dict[int, float]],
        candidate_indices: set[int],
    ) -> dict[int, float]:
        """Combine sparse + dense signals into one base score per
        candidate chunk index. "weighted" reproduces the original raw-
        score blend exactly; "rrf" fuses by each signal's rank within
        `candidate_indices` instead, so no score-scale assumption is
        needed. Chunk-type/entity boosts are applied by the caller
        afterward, on top of whichever base score this returns."""
        if dense_scores is None:
            return {i: sparse_scores.get(i, 0.0) for i in candidate_indices}

        if self._fusion == "rrf":
            sparse_ranked = sorted(candidate_indices, key=lambda i: sparse_scores.get(i, 0.0), reverse=True)
            dense_ranked = sorted(candidate_indices, key=lambda i: dense_scores.get(i, 0.0), reverse=True)
            sparse_rank = {idx: r for r, idx in enumerate(sparse_ranked)}
            dense_rank = {idx: r for r, idx in enumerate(dense_ranked)}
            return {
                i: 1.0 / (_RRF_K + sparse_rank[i] + 1) + 1.0 / (_RRF_K + dense_rank[i] + 1)
                for i in candidate_indices
            }

        # "weighted" (default): identical formula to the pre-BM25/RRF code.
        return {
            i: (_DENSE_WEIGHT * dense_scores.get(i, 0.0)) + (_SPARSE_WEIGHT * sparse_scores.get(i, 0.0))
            for i in candidate_indices
        }

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
        context_query: str = "",
        context_weight: float = 0.25,
    ) -> list[dict[str, Any]]:
        """
        Hybrid search with query expansion, chunk-type boosting, and metadata filtering.

        context_query (optional): prior conversation turns (e.g. earlier
        questions in the same chat session), scored as a separate,
        discounted signal rather than concatenated into `query`.
        Concatenating let a strong earlier question (e.g. "sepsis
        management") dominate TF-IDF/dense scoring for every follow-up
        regardless of what the follow-up actually asked, since both ended
        up baked into one bag-of-words string - every reply in the
        conversation kept retrieving (and thus answering from) the same
        chunks. Scored independently at `context_weight` so it can
        nudge/tie-break, or contribute chunks a too-vague-to-stand-alone
        follow-up misses on its own, without ever outweighing the current
        question's own relevance.
        """
        # 1. Expand query with synonyms
        query_variants = self._expand_query(query) if expand_query else [query]

        # 1b. Dense (semantic) similarity is only computed if a real
        # embedding model is loaded; otherwise this stays a no-op and
        # behavior is identical to the TF-IDF-only retriever.
        use_dense = is_dense_backend_active()

        # 2. Score all chunks across query variants
        chunk_scores: dict[int, float] = {}

        # Named drugs/conditions the query mentions - see _ENTITY_TERMS
        # above for why this matters more than chunk-type boosting alone
        # can express.
        query_entities = _query_entities(query)

        # Metadata-filtered candidate pool - shared across every variant,
        # since department/sop_id/status don't depend on query text. Also
        # exactly what RRF needs to rank *within*: fusing by rank over the
        # full unfiltered corpus would let excluded chunks' ranks distort
        # the ranks of the chunks actually eligible to be returned.
        candidate_indices = {
            i for i, chunk in enumerate(self.chunks)
            if not (department and chunk.get("department", "").lower() != department.lower())
            and not (sop_id and chunk.get("sop_id", "") != sop_id)
            and not (status_filter and chunk.get("status", "active") == "archived")
        }

        for variant in query_variants:
            variant_tokens = self._tokenize(variant)
            if not variant_tokens:
                continue

            sparse_scores = self._sparse_scores_all(variant_tokens)
            dense_scores = (
                {i: dense_similarity(variant, self.chunks[i].get("text", self.chunks[i].get("chunk_text", "")))
                 for i in candidate_indices}
                if use_dense else None
            )
            base_scores = self._fuse_scores(sparse_scores, dense_scores, candidate_indices)

            for i in candidate_indices:
                chunk = self.chunks[i]
                base_score = base_scores.get(i, 0.0)

                if base_score > 0:
                    # Apply chunk-type boost
                    chunk_type = chunk.get("chunk_type", "section")
                    boosts = CHUNK_TYPE_BOOSTS.get(query_type, CHUNK_TYPE_BOOSTS["general"])
                    type_boost = boosts.get(chunk_type, 1.0)

                    boosted_score = base_score * type_boost

                    if query_entities:
                        # Checked two ways: literal substring in this
                        # specific chunk's own text, OR membership in the
                        # chunk's SOP-level clinical_entities (attached at
                        # index time - see chunker.py's _sop_level_entities).
                        # The literal-only check systematically disadvantaged
                        # a SOP's own threshold/summary chunks when the
                        # chunk's condition name lives in a different section
                        # (e.g. the Sepsis SOP's "Definitions" section says
                        # "septic shock", but its Thresholds chunk just
                        # lists ">=65 mmHg: MAP" - no condition name at all)
                        # while a rival SOP's chunk happened to repeat a
                        # shared word like "target" more often, letting a
                        # less-relevant SOP win on raw TF-IDF. Real bug this
                        # fixes: "target mean arterial pressure in septic
                        # shock" ranked Anticoagulation Safety Protocol's
                        # INR-target chunk above the Sepsis SOP's own MAP
                        # threshold.
                        text_low = chunk.get("text", chunk.get("chunk_text", "")).lower()
                        chunk_entities = set(chunk.get("clinical_entities", []))
                        if (
                            any(re.search(r"\b" + re.escape(e) + r"\b", text_low) for e in query_entities)
                            or any(e in chunk_entities for e in query_entities)
                        ):
                            boosted_score *= _ENTITY_MATCH_BOOST

                    # Keep best score across variants
                    if i not in chunk_scores or boosted_score > chunk_scores[i]:
                        chunk_scores[i] = boosted_score

        # 2c. Discounted context pass (see context_query docstring above) -
        # a single, unboosted score added on top of whatever the primary
        # query found, so prior conversation turns can only nudge/assist,
        # never dominate.
        context_tokens = self._tokenize(context_query) if context_query else []
        if context_tokens:
            for i, chunk in enumerate(self.chunks):
                if department and chunk.get("department", "").lower() != department.lower():
                    continue
                if sop_id and chunk.get("sop_id", "") != sop_id:
                    continue
                if status_filter and chunk.get("status", "active") == "archived":
                    continue

                text = chunk.get("text", chunk.get("chunk_text", ""))
                sparse_score = self._tfidf_score(context_tokens, text)

                if use_dense:
                    dense_score = dense_similarity(context_query, text)
                    context_base = (_DENSE_WEIGHT * dense_score) + (_SPARSE_WEIGHT * sparse_score)
                else:
                    context_base = sparse_score

                if context_base > 0:
                    chunk_scores[i] = chunk_scores.get(i, 0.0) + context_base * context_weight

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
            "sparse_backend": self._sparse_backend,
            "fusion": self._fusion,
        }
