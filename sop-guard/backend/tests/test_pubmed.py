"""Tests for the PubMed integration: parsing + graceful failure.

httpx is monkeypatched so no real network calls are made.
"""

import httpx
import pytest

from app.integrations import pubmed


ESEARCH_JSON = {"esearchresult": {"idlist": ["111", "222"]}}
ESUMMARY_JSON = {
    "result": {
        "uids": ["111", "222"],
        "111": {
            "uid": "111",
            "title": "Sepsis bundle compliance study",
            "fulljournalname": "Critical Care Medicine",
            "pubdate": "2024 Jan",
            "authors": [{"name": "Smith J"}, {"name": "Doe A"}],
        },
        "222": {
            "uid": "222",
            "title": "Norepinephrine dosing in shock",
            "source": "JAMA",
            "pubdate": "2023",
            "authors": [{"name": "A"}, {"name": "B"}, {"name": "C"}, {"name": "D"}],
        },
    }
}


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None):
        if "esearch" in url:
            return _FakeResponse(ESEARCH_JSON)
        return _FakeResponse(ESUMMARY_JSON)


class _FailingClient(_FakeClient):
    async def get(self, url, params=None):
        raise httpx.ConnectError("network down")


@pytest.fixture(autouse=True)
def _clear_cache():
    pubmed._cache.clear()
    yield
    pubmed._cache.clear()


async def test_parses_records(monkeypatch):
    monkeypatch.setattr(pubmed.httpx, "AsyncClient", _FakeClient)
    records = await pubmed.search_pubmed("sepsis", max_results=2)
    assert len(records) == 2
    first = records[0]
    assert first["pmid"] == "111"
    assert first["title"] == "Sepsis bundle compliance study"
    assert first["journal"] == "Critical Care Medicine"
    assert first["url"] == "https://pubmed.ncbi.nlm.nih.gov/111/"
    assert first["source_type"] == "pubmed"
    assert first["authors"] == "Smith J, Doe A"
    # More than 3 authors -> truncated with et al.
    assert records[1]["authors"].endswith("et al")


async def test_graceful_empty_on_failure(monkeypatch):
    monkeypatch.setattr(pubmed.httpx, "AsyncClient", _FailingClient)
    records = await pubmed.search_pubmed("anything", max_results=3)
    assert records == []


async def test_empty_term_returns_empty():
    assert await pubmed.search_pubmed("   ") == []


def test_parse_esummary_unit():
    records = pubmed.parse_esummary(ESUMMARY_JSON)
    assert [r["pmid"] for r in records] == ["111", "222"]


class TestStudyTypeClassification:
    def test_meta_analysis_ranked_above_journal_article(self):
        result = pubmed._classify_study_type(["Journal Article", "Meta-Analysis"])
        assert result == "Meta-Analysis"

    def test_practice_guideline_ranked_above_review(self):
        result = pubmed._classify_study_type(["Review", "Practice Guideline"])
        assert result == "Practice Guideline"

    def test_defaults_to_journal_article_when_no_priority_match(self):
        result = pubmed._classify_study_type(["Journal Article", "Comment"])
        assert result == "Journal Article"

    def test_defaults_to_journal_article_when_pubtype_empty(self):
        assert pubmed._classify_study_type([]) == "Journal Article"

    async def test_parsed_record_includes_study_type(self, monkeypatch):
        payload = {
            "result": {
                "uids": ["333"],
                "333": {
                    "uid": "333",
                    "title": "RCT of vasopressor timing in septic shock",
                    "pubtype": ["Journal Article", "Randomized Controlled Trial"],
                },
            }
        }
        records = pubmed.parse_esummary(payload)
        assert records[0]["study_type"] == "Randomized Controlled Trial"
        assert records[0]["pub_types"] == ["Journal Article", "Randomized Controlled Trial"]
