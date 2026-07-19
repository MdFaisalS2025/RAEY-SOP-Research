"""Tests for the embedding-provider tiered fallback (app/rag/embeddings.py).

Real gap this closes: RAG_EMBEDDING_MODEL is meant to be a safe,
config-only swap (e.g. to a clinical embedding model) - but a custom
model name that fails to load (bad id, no network, out of memory) used
to fall straight through to the TF-IDF stub, silently losing dense
retrieval entirely even though the known-good default model would very
likely have loaded fine. Now a failing custom model gets one fallback
attempt at the default before giving up on dense retrieval.
"""

import pytest

from app.rag import embeddings as embeddings_module
from app.rag.embeddings import (
    get_embedding_provider,
    SentenceTransformerProvider,
    TfidfFallbackProvider,
    _DEFAULT_MODEL,
)


class _FakeSentenceTransformerProvider:
    """Stands in for SentenceTransformerProvider - raises for any model
    name in `fail_for`, otherwise "succeeds" (records the model name used)."""
    fail_for: set[str] = set()

    def __init__(self, model_name: str):
        if model_name in self.fail_for:
            raise RuntimeError(f"simulated load failure for {model_name}")
        self._model_name = model_name

    @property
    def backend_name(self) -> str:
        return f"fake:{self._model_name}"


@pytest.fixture
def fake_provider(monkeypatch):
    _FakeSentenceTransformerProvider.fail_for = set()
    monkeypatch.setattr(embeddings_module, "SentenceTransformerProvider", _FakeSentenceTransformerProvider)
    yield _FakeSentenceTransformerProvider
    _FakeSentenceTransformerProvider.fail_for = set()


class TestTieredFallback:
    def test_working_custom_model_is_used_directly(self, fake_provider):
        provider = get_embedding_provider(backend="auto", model_name="some/clinical-model")
        assert provider.backend_name == "fake:some/clinical-model"

    def test_failing_custom_model_falls_back_to_default(self, fake_provider):
        fake_provider.fail_for = {"bad/model-name"}
        provider = get_embedding_provider(backend="auto", model_name="bad/model-name")
        assert provider.backend_name == f"fake:{_DEFAULT_MODEL}"

    def test_failing_custom_and_failing_default_falls_back_to_tfidf(self, fake_provider):
        fake_provider.fail_for = {"bad/model-name", _DEFAULT_MODEL}
        provider = get_embedding_provider(backend="auto", model_name="bad/model-name")
        assert isinstance(provider, TfidfFallbackProvider)

    def test_failing_default_itself_goes_straight_to_tfidf(self, fake_provider):
        """When the caller already asked for the default model and it
        fails, there's no second default to fall back to - straight to
        TF-IDF, same as before this change."""
        fake_provider.fail_for = {_DEFAULT_MODEL}
        provider = get_embedding_provider(backend="auto", model_name=_DEFAULT_MODEL)
        assert isinstance(provider, TfidfFallbackProvider)

    def test_sentence_transformers_backend_raises_instead_of_falling_back(self, fake_provider):
        """backend="sentence_transformers" (not "auto") means the caller
        explicitly requires a real model - must raise, not silently
        degrade to TF-IDF or the default."""
        fake_provider.fail_for = {"bad/model-name"}
        with pytest.raises(RuntimeError):
            get_embedding_provider(backend="sentence_transformers", model_name="bad/model-name")

    def test_tfidf_backend_never_touches_sentence_transformers(self, fake_provider):
        provider = get_embedding_provider(backend="tfidf", model_name="irrelevant")
        assert isinstance(provider, TfidfFallbackProvider)
