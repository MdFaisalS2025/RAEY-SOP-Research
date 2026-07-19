"""Tests for the short-TTL external-evidence-source cache
(app/services/evidence_cache.py) and its wiring into
evidence_registry.search_all() (Phase C).
"""

import time

import pytest

from app.services import evidence_cache


@pytest.fixture(autouse=True)
def _clear_cache():
    evidence_cache.clear()
    yield
    evidence_cache.clear()


def _records(n=1):
    return [{"title": f"Record {i}", "pub_date_parsed": "2024-01-01"} for i in range(n)]


class TestEvidenceCacheUnit:
    def test_miss_then_hit(self):
        assert evidence_cache.get("pubmed", "sepsis", 5) is None
        recs = _records(2)
        evidence_cache.set("pubmed", "sepsis", 5, recs)
        got = evidence_cache.get("pubmed", "sepsis", 5)
        assert got == recs

    def test_returns_copies_not_shared_references(self):
        """Real bug this guards against: search_all mutates records in
        place per-call (stance, evidence_grade, supporting_excerpt - the
        last depends on the CALLER's query term, not the cached search
        term). Returning the cached objects themselves would let two
        different questions that share a cached search clobber each
        other's fields under concurrent requests."""
        recs = _records(1)
        evidence_cache.set("pubmed", "sepsis", 5, recs)
        got1 = evidence_cache.get("pubmed", "sepsis", 5)
        got1[0]["supporting_excerpt"] = "answer for question A"
        got2 = evidence_cache.get("pubmed", "sepsis", 5)
        assert "supporting_excerpt" not in got2[0]

    def test_different_source_is_a_different_key(self):
        evidence_cache.set("pubmed", "sepsis", 5, _records(1))
        assert evidence_cache.get("cdc", "sepsis", 5) is None

    def test_different_max_results_is_a_different_key(self):
        evidence_cache.set("pubmed", "sepsis", 5, _records(1))
        assert evidence_cache.get("pubmed", "sepsis", 10) is None

    def test_term_is_case_insensitive(self):
        evidence_cache.set("pubmed", "Sepsis Management", 5, _records(1))
        assert evidence_cache.get("pubmed", "sepsis management", 5) is not None

    def test_expires_after_ttl(self, monkeypatch):
        evidence_cache.set("pubmed", "sepsis", 5, _records(1))
        future = time.time() + evidence_cache._TTL_SECONDS + 1
        monkeypatch.setattr(evidence_cache.time, "time", lambda: future)
        assert evidence_cache.get("pubmed", "sepsis", 5) is None

    def test_evicts_oldest_when_full(self, monkeypatch):
        monkeypatch.setattr(evidence_cache, "_MAX_ENTRIES", 2)
        evidence_cache.set("pubmed", "a", 5, _records(1))
        evidence_cache.set("pubmed", "b", 5, _records(1))
        evidence_cache.set("pubmed", "c", 5, _records(1))
        assert evidence_cache.get("pubmed", "a", 5) is None
        assert evidence_cache.get("pubmed", "c", 5) is not None


class _CountingSource:
    """Fake EvidenceSource that counts how many times .search() actually runs,
    so tests can assert a repeat search_all() call didn't hit it again."""
    def __init__(self, titles):
        self.source_type = "fake"
        self.display_name = "Fake"
        self._titles = titles
        self.call_count = 0

    async def search(self, term, max_results=5):
        self.call_count += 1
        return [
            {
                "title": t, "authors": "", "journal": "", "pub_date": "2024",
                "pub_date_parsed": "2024-01-01", "pmid": str(i), "url": "",
                "source_type": "fake", "study_type": "Journal Article",
            }
            for i, t in enumerate(self._titles[:max_results])
        ]


class TestSearchAllCacheWiring:
    async def test_repeat_search_all_does_not_call_source_again(self, monkeypatch):
        from app.integrations import evidence_registry
        fake = _CountingSource(["Sepsis management outcomes in the ICU"])
        monkeypatch.setattr(evidence_registry, "_REGISTRY", {"fake": fake})

        await evidence_registry.search_all("sepsis management", sources=["fake"], max_results=5)
        await evidence_registry.search_all("sepsis management", sources=["fake"], max_results=5)

        assert fake.call_count == 1

    async def test_different_term_still_calls_source(self, monkeypatch):
        from app.integrations import evidence_registry
        fake = _CountingSource(["Sepsis management outcomes in the ICU", "Anticoagulation dosing guidelines"])
        monkeypatch.setattr(evidence_registry, "_REGISTRY", {"fake": fake})

        await evidence_registry.search_all("sepsis management", sources=["fake"], max_results=5)
        await evidence_registry.search_all("anticoagulation dosing", sources=["fake"], max_results=5)

        assert fake.call_count == 2
