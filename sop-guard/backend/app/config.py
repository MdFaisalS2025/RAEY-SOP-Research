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
    # In-house only: no patient/query data is ever sent to a third-party LLM API.
    # mock = no model, template answers (offline demo). ollama = local self-hosted model.
    LLM_PROVIDER: str = "ollama"  # mock | ollama
    LLM_MODEL: str = "llama3.2"
    LLM_BASE_URL: Optional[str] = "http://localhost:11434"

    # --- Embeddings ---
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # --- Vector DB ---
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None

    # --- Voice ---
    WHISPER_MODE: str = "mock"  # mock | api

    # --- RAG ---
    RAG_EMBEDDING_BACKEND: str = "auto"  # auto | sentence_transformers | tfidf
    RAG_EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    RAG_RERANKER_BACKEND: str = "auto"  # auto | cross_encoder | heuristic
    RAG_RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    RAG_MAX_CHUNKS: int = 8
    RAG_MIN_CONFIDENCE: float = 0.3

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
