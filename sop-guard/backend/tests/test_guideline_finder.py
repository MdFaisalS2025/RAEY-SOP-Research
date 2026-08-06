"""
Tests for app/services/guideline_finder.py (Phase Q3.1/Q3.2).

find_guideline's provider calls are monkeypatched directly (search_pubmed/
search_europepmc are already independently tested for their own HTTP
behavior in test_pubmed.py / test_evidence_sources.py) - this file tests
guideline_finder's own logic: candidate selection, caching, and graceful
degradation. extract_recommendations needs no network at all.
"""

import pytest

from app.services import guideline_finder


@pytest.fixture(autouse=True)
def _clear_cache():
    guideline_finder._guideline_cache.clear()
    yield
    guideline_finder._guideline_cache.clear()


# ---- extract_recommendations ------------------------------------------------

def test_extracts_directive_and_quantity_sentences():
    abstract = (
        "OBJECTIVE: To provide updated guidance. "
        "Patients should receive broad-spectrum antibiotics within 1 hour of recognition. "
        "Administer 30 mL/kg of balanced crystalloid within 3 hours. "
        "We searched the literature from 2015 to 2024. "
        "Clinicians must obtain blood cultures before antibiotics when feasible."
    )
    items = guideline_finder.extract_recommendations(abstract)
    texts = [i["text"] for i in items]
    assert any("broad-spectrum antibiotics" in t for t in texts)
    assert any("30 mL/kg" in t for t in texts)
    assert any("blood cultures" in t for t in texts)
    # Boilerplate lines dropped.
    assert not any("OBJECTIVE" in t or "We searched" in t for t in texts)


def test_every_item_discloses_verbatim_fidelity_and_locus():
    abstract = "Vasopressors should be started when MAP remains below 65 mmHg despite fluids."
    items = guideline_finder.extract_recommendations(abstract)
    assert len(items) == 1
    assert items[0]["fidelity"] == "verbatim"
    assert items[0]["source_locus"] == "Abstract, sentence 1"
    # Verbatim really means verbatim - the extracted text is a substring of
    # the source (after stripping the sentence splitter's own boundary).
    assert items[0]["text"] in abstract


def test_empty_abstract_returns_nothing():
    assert guideline_finder.extract_recommendations("") == []
    assert guideline_finder.extract_recommendations("   ") == []


def test_purely_descriptive_abstract_yields_no_recommendations():
    abstract = "This paper describes the epidemiology of sepsis in the United States."
    assert guideline_finder.extract_recommendations(abstract) == []


def test_deduplicates_repeated_sentences():
    abstract = "Antibiotics should be given within 1 hour. Antibiotics should be given within 1 hour."
    items = guideline_finder.extract_recommendations(abstract)
    assert len(items) == 1


def test_caps_at_twelve_recommendations():
    sentences = " ".join(f"Clinicians should perform step {i} within {i} hours." for i in range(1, 20))
    items = guideline_finder.extract_recommendations(sentences)
    assert len(items) == guideline_finder._MAX_RECOMMENDATIONS


# ---- find_guideline ----------------------------------------------------------

async def test_find_guideline_returns_none_for_empty_topic():
    assert await guideline_finder.find_guideline("") is None


async def test_find_guideline_returns_none_when_no_candidates(monkeypatch):
    async def _empty(*args, **kwargs):
        return []
    monkeypatch.setattr(guideline_finder, "search_pubmed", _empty)
    monkeypatch.setattr(guideline_finder, "search_europepmc", _empty)
    assert await guideline_finder.find_guideline("sepsis management") is None


async def test_find_guideline_prefers_guideline_typed_candidate(monkeypatch):
    strong_review = {
        "title": "A systematic review of sepsis outcomes", "study_type": "Systematic Review",
        "pub_types": [], "pub_date_parsed": "2024-01-01", "abstract": "...",
    }
    real_guideline = {
        "title": "Surviving Sepsis Campaign: International Guidelines", "study_type": "Practice Guideline",
        "pub_types": ["Guideline"], "pub_date_parsed": "2021-01-01", "abstract": "...",
    }

    async def _pubmed(*args, **kwargs):
        return [strong_review]

    async def _epmc(*args, **kwargs):
        return [real_guideline]

    monkeypatch.setattr(guideline_finder, "search_pubmed", _pubmed)
    monkeypatch.setattr(guideline_finder, "search_europepmc", _epmc)

    result = await guideline_finder.find_guideline("sepsis management")
    assert result is not None
    assert result["title"] == "Surviving Sepsis Campaign: International Guidelines"


async def test_find_guideline_caches_result(monkeypatch):
    calls = {"count": 0}

    async def _pubmed(*args, **kwargs):
        calls["count"] += 1
        return [{"title": "Guideline X", "study_type": "Guideline", "pub_types": [], "pub_date_parsed": "2020-01-01", "abstract": ""}]

    async def _empty(*args, **kwargs):
        return []

    monkeypatch.setattr(guideline_finder, "search_pubmed", _pubmed)
    monkeypatch.setattr(guideline_finder, "search_europepmc", _empty)

    first = await guideline_finder.find_guideline("heat stroke")
    second = await guideline_finder.find_guideline("heat stroke")
    assert first == second
    assert calls["count"] == 1  # second call served from cache, no re-search


async def test_find_guideline_degrades_gracefully_on_provider_exception(monkeypatch):
    async def _raises(*args, **kwargs):
        raise RuntimeError("network down")

    async def _empty(*args, **kwargs):
        return []

    monkeypatch.setattr(guideline_finder, "search_pubmed", _raises)
    monkeypatch.setattr(guideline_finder, "search_europepmc", _empty)

    # Must not raise - a provider outage degrades to "no guideline found",
    # not a 500.
    result = await guideline_finder.find_guideline("sepsis management")
    assert result is None
