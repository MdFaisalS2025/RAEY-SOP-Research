"""
RAEY Embedding Cache
Process-wide singleton for the embedding provider plus an in-memory vector
cache, so the model loads once and chunk embeddings are computed once per
process lifetime rather than on every query.
Research prototype. Not for clinical use.
"""

import hashlib
import logging
from typing import Optional

from app.config import settings
from app.rag.embeddings import (
    EmbeddingProvider,
    SentenceTransformerProvider,
    TfidfFallbackProvider,
    get_embedding_provider,
)

logger = logging.getLogger(__name__)

_provider: Optional[EmbeddingProvider] = None
_vector_cache: dict[str, list[float]] = {}


def _text_key(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def get_shared_embedding_provider() -> EmbeddingProvider:
    """
    Return the process-wide embedding provider, loading it once.
    Falls back to TF-IDF automatically if sentence-transformers is
    unavailable (see app.rag.embeddings.get_embedding_provider).
    """
    global _provider
    if _provider is None:
        _provider = get_embedding_provider(
            backend=settings.RAG_EMBEDDING_BACKEND,
            model_name=settings.RAG_EMBEDDING_MODEL,
        )
    return _provider


def is_dense_backend_active() -> bool:
    """True if a real sentence-transformers model is loaded (not the TF-IDF stub)."""
    return isinstance(get_shared_embedding_provider(), SentenceTransformerProvider)


def embed_cached(text: str) -> list[float]:
    """Embed a piece of text, reusing a cached vector when seen before."""
    provider = get_shared_embedding_provider()
    if not isinstance(provider, SentenceTransformerProvider):
        return []

    key = _text_key(text)
    cached = _vector_cache.get(key)
    if cached is not None:
        return cached

    vector = provider.embed_query(text)
    _vector_cache[key] = vector
    return vector


def dense_similarity(query: str, text: str) -> float:
    """Cosine similarity between query and text using the cached dense provider."""
    provider = get_shared_embedding_provider()
    if not isinstance(provider, SentenceTransformerProvider):
        return 0.0
    q_vec = embed_cached(query)
    d_vec = embed_cached(text)
    if not q_vec or not d_vec:
        return 0.0
    return provider.similarity(q_vec, d_vec)
