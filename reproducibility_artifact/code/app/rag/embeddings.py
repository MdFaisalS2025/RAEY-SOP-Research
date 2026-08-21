"""
RAEY Embedding Provider
Supports sentence-transformers with TF-IDF fallback.
Research prototype. Not for clinical use.
"""

import math
import re
from collections import Counter
from typing import Any, Optional, Protocol
import logging

logger = logging.getLogger(__name__)


class EmbeddingProvider(Protocol):
    """Interface for embedding providers."""
    def embed_texts(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, query: str) -> list[float]: ...
    def similarity(self, query_embedding: list[float], doc_embedding: list[float]) -> float: ...
    @property
    def backend_name(self) -> str: ...


class SentenceTransformerProvider:
    """Real embedding provider using sentence-transformers."""

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self._model_name = model_name

    @property
    def backend_name(self) -> str:
        return f"sentence_transformers:{self._model_name}"

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return [e.tolist() for e in embeddings]

    def embed_query(self, query: str) -> list[float]:
        return self.model.encode(query, normalize_embeddings=True).tolist()

    def similarity(self, q: list[float], d: list[float]) -> float:
        dot = sum(a * b for a, b in zip(q, d))
        return max(0.0, min(1.0, dot))


class TfidfFallbackProvider:
    """TF-IDF based similarity when sentence-transformers is unavailable."""

    def __init__(self):
        self._idf: dict[str, float] = {}
        self._fitted = False

    @property
    def backend_name(self) -> str:
        return "tfidf_fallback"

    def _tokenize(self, text: str) -> list[str]:
        tokens = re.findall(r"[a-z0-9]+", text.lower())
        stop = {"the", "a", "an", "is", "are", "was", "were", "be", "been",
                "to", "of", "in", "for", "on", "with", "at", "by", "from",
                "and", "or", "not", "it", "this", "that", "as", "but", "if",
                "do", "does", "did", "will", "would", "can", "could", "should"}
        return [t for t in tokens if t not in stop and len(t) > 1]

    def fit(self, texts: list[str]):
        n = len(texts)
        if n == 0:
            return
        df: Counter = Counter()
        for text in texts:
            for token in set(self._tokenize(text)):
                df[token] += 1
        self._idf = {t: math.log((n + 1) / (c + 1)) + 1 for t, c in df.items()}
        self._fitted = True

    def _to_vector(self, text: str) -> dict[str, float]:
        tokens = self._tokenize(text)
        if not tokens:
            return {}
        tf = Counter(tokens)
        vec = {}
        for token, count in tf.items():
            tfidf = (count / len(tokens)) * self._idf.get(token, 1.0)
            vec[token] = tfidf
        return vec

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not self._fitted:
            self.fit(texts)
        # Return empty lists since we use dict-based similarity
        return [[] for _ in texts]

    def embed_query(self, query: str) -> list[float]:
        return []  # Not used directly

    def similarity(self, q: list[float], d: list[float]) -> float:
        return 0.0  # Use tfidf_score instead

    def tfidf_score(self, query: str, text: str) -> float:
        q_vec = self._to_vector(query)
        d_vec = self._to_vector(text)
        if not q_vec or not d_vec:
            return 0.0
        # Cosine-like: dot product of normalized vectors
        dot = sum(q_vec.get(k, 0) * d_vec.get(k, 0) for k in set(q_vec) | set(d_vec))
        q_norm = math.sqrt(sum(v * v for v in q_vec.values()))
        d_norm = math.sqrt(sum(v * v for v in d_vec.values()))
        if q_norm == 0 or d_norm == 0:
            return 0.0
        return dot / (q_norm * d_norm)


#: The verified-safe default model - small (~130MB), no network dependency
#: once cached, and the one every eval floor/regression test in this repo
#: is calibrated against. Swapping RAG_EMBEDDING_MODEL to a domain-specific
#: model (e.g. clinical embeddings) is meant to be a config-only upgrade,
#: not a risk of losing dense retrieval entirely - see the tiered fallback
#: below for why that distinction matters.
_DEFAULT_MODEL = "BAAI/bge-small-en-v1.5"


def get_embedding_provider(
    backend: str = "auto",
    model_name: str = _DEFAULT_MODEL,
) -> TfidfFallbackProvider | SentenceTransformerProvider:
    """
    Get the best available embedding provider.
    backend: 'auto' | 'sentence_transformers' | 'tfidf'

    Real gap this closes: a custom RAG_EMBEDDING_MODEL (e.g. a clinical
    embedding model) that fails to load - wrong model id, no network
    access to Hugging Face, out-of-memory on a large model - used to fall
    straight through to the TF-IDF stub, silently losing dense retrieval
    entirely even though the known-good default model would likely have
    loaded fine. Now a custom model gets one extra attempt at the default
    before giving up on dense retrieval altogether.
    """
    if backend == "tfidf":
        logger.info("Using TF-IDF fallback embedding provider")
        return TfidfFallbackProvider()

    if backend in ("auto", "sentence_transformers"):
        try:
            provider = SentenceTransformerProvider(model_name)
            logger.info(f"Using sentence-transformers: {model_name}")
            return provider
        except (ImportError, Exception) as e:
            if backend == "sentence_transformers":
                logger.error(f"sentence-transformers required but failed: {e}")
                raise
            logger.warning(f"Embedding model '{model_name}' failed to load ({e}).")

            if model_name != _DEFAULT_MODEL:
                try:
                    provider = SentenceTransformerProvider(_DEFAULT_MODEL)
                    logger.info(f"Falling back to default embedding model: {_DEFAULT_MODEL}")
                    return provider
                except Exception as fallback_e:
                    logger.info(f"Default embedding model also failed ({fallback_e}), using TF-IDF fallback")
            else:
                logger.info("sentence-transformers not available, using TF-IDF fallback")

    return TfidfFallbackProvider()
