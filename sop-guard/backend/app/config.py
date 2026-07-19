"""
Meridian Configuration
-----------------------
Research prototype  - NOT for clinical use.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    # --- Application ---
    APP_NAME: str = "Meridian"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-in-production"
    ENVIRONMENT: str = "development"  # development | staging | production

    # --- Database ---
    DATABASE_URL: str = "sqlite+aiosqlite:///./meridian.db"
    # For PostgreSQL: postgresql+asyncpg://user:pass@localhost:5432/sopguard

    # --- LLM ---
    # mock = no model, template answers (offline demo). ollama = local
    # self-hosted model, no data ever leaves the hospital network. groq =
    # opt-in third-party hosted inference for faster demo output - only
    # active if GROQ_API_KEY is set, and query/answer text does leave the
    # local network for that provider. Default stays "ollama" for any real
    # deployment; groq is meant for live demos where response latency
    # matters more than data locality.
    LLM_PROVIDER: str = "ollama"  # mock | ollama | groq
    LLM_MODEL: str = "llama3.2"
    LLM_BASE_URL: Optional[str] = "http://localhost:11434"
    # A single local Ollama instance serializes inference internally - firing
    # concurrent requests at it doesn't parallelize, it contends and can
    # error out (observed: a second concurrent request mid-generation
    # returned 500). Cap concurrent calls so requests queue politely instead
    # of failing; raise this only if LLM_BASE_URL points at infrastructure
    # that can actually handle concurrent inference (e.g. a scaled endpoint).
    LLM_MAX_CONCURRENT_REQUESTS: int = 1
    LLM_MAX_RETRIES: int = 2

    # --- Groq (opt-in, see LLM_PROVIDER above) ---
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # --- Embeddings ---
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # --- Vector DB ---
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None

    # --- Voice ---
    WHISPER_MODE: str = "mock"  # mock | api

    # --- OpenEvidence (provider-ready placeholder - see app/integrations/openevidence.py) ---
    # No public OpenEvidence API is configured in this deployment - these are
    # unset by default and the provider always reports "not_configured" via
    # GET /api/evidence/providers regardless of whether they're set, since
    # there's no real call path here to verify a key actually works. Wiring
    # a real OpenEvidence integration later means implementing OpenEvidenceSource
    # .search() for real and updating the status check - not just setting these.
    OPENEVIDENCE_API_KEY: Optional[str] = None
    OPENEVIDENCE_BASE_URL: Optional[str] = None
    OPENEVIDENCE_ORG_ID: Optional[str] = None

    # --- RAG ---
    RAG_EMBEDDING_BACKEND: str = "auto"  # auto | sentence_transformers | tfidf
    RAG_EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    RAG_RERANKER_BACKEND: str = "auto"  # auto | cross_encoder | heuristic
    RAG_RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    RAG_MAX_CHUNKS: int = 8
    RAG_MIN_CONFIDENCE: float = 0.3
    # Sparse (lexical) scoring backend for HybridRetriever. "tfidf" (default)
    # is the original hand-rolled TF-IDF scorer; "bm25" uses rank-bm25's
    # BM25Okapi, a real ranking-function upgrade (saturating term frequency,
    # document-length normalization) over the plain TF-IDF weighted sum.
    # Falls back to "tfidf" with a logged warning if rank_bm25 isn't
    # installed - same graceful-degradation pattern as RAG_RERANKER_BACKEND.
    RAG_SPARSE_BACKEND: str = "tfidf"  # tfidf | bm25
    # How sparse and dense (embedding) scores are combined. "weighted"
    # (default, current behavior) sums _SPARSE_WEIGHT*sparse +
    # _DENSE_WEIGHT*dense - a raw-score blend that implicitly assumes both
    # scores live on comparable scales, which TF-IDF/BM25 and cosine
    # similarity don't really share. "rrf" (reciprocal rank fusion) instead
    # combines each signal's RANK within the filtered candidate pool -
    # 1/(k+rank) per signal - which needs no score normalization and is
    # the standard production choice for hybrid retrieval. Chunk-type and
    # entity-match boosts still apply as multipliers AFTER fusion either way.
    RAG_FUSION: str = "weighted"  # weighted | rrf

    # --- Privacy / PHI guard (see app/privacy/phi_guard.py) ---
    # "rule" = fast, dependency-free regex/heuristic PHI detector (default,
    # always available). "openmed" selects an optional OpenMed-based clinical
    # NER adapter that is NOT bundled - it degrades gracefully back to the
    # rule provider with a logged warning if the package isn't installed,
    # exactly like RAG_RERANKER_BACKEND's cross-encoder fallback. The guard
    # is OpenMed-INSPIRED, not OpenMed-integrated, under the default.
    PHI_PROVIDER_BACKEND: str = "rule"  # rule | openmed

    # --- Security ---
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    SESSION_EXPIRY_HOURS: int = 24
    MAX_QUERY_LENGTH: int = 1000
    RATE_LIMIT_PER_MINUTE: int = 30

    # --- Logging ---
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json | text

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
