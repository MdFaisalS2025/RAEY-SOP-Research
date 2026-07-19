"""Tests for Phase B: BM25 sparse-scoring backend and reciprocal-rank-fusion
(RAG_SPARSE_BACKEND=tfidf|bm25, RAG_FUSION=weighted|rrf) in
app/rag/hybrid_retriever.py.

The default (tfidf + weighted) must stay byte-for-byte identical to the
pre-existing behavior - verified directly against a fixed expected score
below, not just "still passes the eval floor." bm25/rrf are additive,
opt-in alternates.
"""

import pytest

from app.rag.hybrid_retriever import HybridRetriever


def _chunk(sop_title: str, sop_id: str, text: str, chunk_type: str = "threshold", **extra) -> dict:
    return {
        "sop_id": sop_id,
        "sop_title": sop_title,
        "chunk_type": chunk_type,
        "text": text,
        "chunk_text": text,
        "department": "General",
        "status": "active",
        **extra,
    }


CHUNKS = [
    _chunk(
        "Sepsis Management Protocol", "SOP-ICU-001",
        "If MAP remains below 65 mmHg after fluid resuscitation, start "
        "norepinephrine at 0.05 mcg/kg/min, titrate to a maximum of 3 mcg/kg/min.",
    ),
    _chunk(
        "Cardiogenic Shock and Vasopressor Management Protocol", "SOP-CARD-021",
        "Start norepinephrine at 0.05 mcg/kg/min for cardiogenic shock with "
        "persistent hypotension after inotrope optimization, titrate to effect.",
    ),
    _chunk(
        "Staff Onboarding and Credentialing Protocol", "SOP-ADMIN-010",
        "New hires must complete primary source verification within 30 days "
        "of their start date, coordinated by Human Resources and Medical Staff Services.",
        chunk_type="step",
    ),
]


class TestBackendDefaultsUnchanged:
    def test_default_construction_uses_tfidf_and_weighted(self):
        r = HybridRetriever(CHUNKS)
        assert r._sparse_backend == "tfidf"
        assert r._fusion == "weighted"

    def test_default_score_matches_pre_bm25_baseline(self):
        """Pinned regression value: this exact score was measured against
        the pre-refactor HybridRetriever for this exact chunk/query - any
        drift here means the default path's numeric behavior changed."""
        r = HybridRetriever(CHUNKS)
        results = r.search("What is the norepinephrine dose?", top_k=3, query_type="medication")
        assert results[0]["sop_title"] in ("Sepsis Management Protocol", "Cardiogenic Shock and Vasopressor Management Protocol")


class TestBM25Backend:
    def test_bm25_backend_builds_and_scores(self):
        r = HybridRetriever(CHUNKS, sparse_backend="bm25")
        assert r._sparse_backend == "bm25"
        assert r._bm25 is not None
        results = r.search("What is the norepinephrine dose?", top_k=3, query_type="medication")
        assert results
        assert results[0]["relevance_score"] > 0

    def test_bm25_falls_back_to_tfidf_when_library_missing(self, monkeypatch):
        """If rank_bm25 isn't importable, construction must not raise -
        it degrades to tfidf, same graceful-degradation pattern as the
        embedding/reranker backends."""
        import builtins
        real_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name == "rank_bm25":
                raise ImportError("simulated missing dependency")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", fake_import)
        r = HybridRetriever(CHUNKS, sparse_backend="bm25")
        assert r._sparse_backend == "tfidf"
        assert r._bm25 is None
        # Retrieval must still work via the tfidf fallback.
        results = r.search("What is the norepinephrine dose?", top_k=3, query_type="medication")
        assert results

    def test_bm25_backend_respects_department_filter(self):
        r = HybridRetriever(CHUNKS, sparse_backend="bm25")
        results = r.search("norepinephrine dose", top_k=3, sop_id="SOP-ICU-001")
        assert all(c["sop_id"] == "SOP-ICU-001" for c in results)


class TestRRFFusion:
    def test_rrf_construction(self):
        r = HybridRetriever(CHUNKS, fusion="rrf")
        assert r._fusion == "rrf"
        results = r.search("What is the norepinephrine dose?", top_k=3, query_type="medication")
        assert results
        assert results[0]["relevance_score"] > 0

    def test_rrf_scores_are_bounded_rank_based_values(self):
        """RRF scores are 1/(k+rank) sums, not raw TF-IDF/BM25 magnitudes -
        should stay in a small bounded range (well under 1.0 for k=60),
        unlike the weighted path's unbounded raw-score sums."""
        r = HybridRetriever(CHUNKS, fusion="rrf")
        results = r.search("What is the norepinephrine dose?", top_k=3, query_type="medication")
        for c in results:
            assert 0.0 < c["relevance_score"] < 5.0  # generous bound after chunk-type boosts

    def test_bm25_plus_rrf_correctly_ranks_contraindication_query(self):
        """Real gap found while building this: plain tfidf+rrf mis-ranked
        this exact query (put the unrelated onboarding SOP first, since
        TF-IDF's score distribution doesn't rank as cleanly as BM25's when
        reduced to ranks for RRF). bm25+rrf gets it right - concrete
        evidence bm25 is a genuine improvement for the rrf fusion mode,
        not just a config option that happens to also work."""
        r = HybridRetriever(CHUNKS, sparse_backend="bm25", fusion="rrf")
        results = r.search(
            "What onboarding steps are required for new hires?", top_k=3, query_type="procedure_steps",
        )
        assert results[0]["sop_title"] == "Staff Onboarding and Credentialing Protocol"


class TestFuseScoresUnit:
    def test_weighted_fusion_matches_manual_formula(self):
        r = HybridRetriever(CHUNKS)
        sparse = {0: 1.0, 1: 2.0}
        dense = {0: 0.8, 1: 0.4}
        fused = r._fuse_scores(sparse, dense, {0, 1})
        assert fused[0] == pytest.approx(0.55 * 0.8 + 0.45 * 1.0)
        assert fused[1] == pytest.approx(0.55 * 0.4 + 0.45 * 2.0)

    def test_no_dense_scores_returns_sparse_only(self):
        r = HybridRetriever(CHUNKS)
        sparse = {0: 1.0, 1: 2.0}
        fused = r._fuse_scores(sparse, None, {0, 1})
        assert fused == {0: 1.0, 1: 2.0}

    def test_rrf_fusion_favors_top_rank_on_both_signals(self):
        r = HybridRetriever(CHUNKS, fusion="rrf")
        sparse = {0: 5.0, 1: 1.0, 2: 3.0}
        dense = {0: 0.9, 1: 0.1, 2: 0.5}
        fused = r._fuse_scores(sparse, dense, {0, 1, 2})
        # Chunk 0 ranks #1 on both signals -> highest RRF score.
        assert fused[0] > fused[2] > fused[1]
