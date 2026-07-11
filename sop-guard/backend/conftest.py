"""
Isolate the test session from the developer's local .env, resetting every
setting to its code-level default (not just LLM_PROVIDER).

Tests must be deterministic and runnable in CI without a live Ollama
server (see test_query_streaming.py's docstring for the same assumption),
and some tests assert the code defaults themselves (e.g.
test_llm_generator_ollama.py::test_provider_defaults_to_ollama checks that
LLMGenerator() defaults to provider="ollama", model="llama3.2" - the
in-house-only policy - regardless of what a developer's local .env
happens to point at for interactive use).

`settings` is a shared singleton imported via `from app.config import
settings` throughout the app, so modules already hold a reference to this
exact object - fields are reset in place (not by replacing the object)
so every consumer sees the reset values.

Tests that specifically exercise Ollama-backed behavior construct their
own LLMGenerator(provider=..., base_url=...) or monkeypatch settings
directly (see test_ragas_real.py) rather than relying on the global
default, so this doesn't remove real-LLM test coverage.
"""

from app.config import Settings, settings

_defaults = Settings(_env_file=None)
for _field in Settings.model_fields:
    setattr(settings, _field, getattr(_defaults, _field))
