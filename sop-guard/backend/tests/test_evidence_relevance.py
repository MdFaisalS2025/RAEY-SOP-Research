"""Tests for the evidence-relevance fix: sources no longer force a
date-descending sort that sacrifices topical relevance (see pubmed.py /
europepmc.py / who.py / clinicaltrials.py comments), and evidence_registry
.search_all now over-fetches and drops off-topic titles via
is_title_relevant as a source-agnostic safety net.
"""

from app.integrations.evidence_source import is_title_relevant
from app.integrations.evidence_registry import search_all


class TestIsTitleRelevant:
    def test_unrelated_title_is_filtered(self):
        assert is_title_relevant("blood transfusion contraindications", "Afghanistan annual report 2025") is False

    def test_shared_distinctive_word_passes(self):
        assert is_title_relevant("maximum norepinephrine dose", "Norepinephrine titration in septic shock") is True

    def test_question_stopwords_do_not_count_as_overlap(self):
        # "what", "is", "the" are the only shared words - none distinctive.
        assert is_title_relevant("what is the treatment", "What are the outcomes of surgery") is False

    def test_empty_term_never_filters(self):
        assert is_title_relevant("", "Anything at all") is True

    def test_empty_title_is_not_penalized(self):
        assert is_title_relevant("sepsis", "") is True


class _FakeSource:
    """Returns a fixed, over-fetchable list of (title) records regardless
    of term, so tests can control exactly what search_all has to filter."""
    def __init__(self, titles: list[str]):
        self.source_type = "fake"
        self.display_name = "Fake"
        self._titles = titles

    async def search(self, term, max_results=5):
        return [
            {
                "title": t, "authors": "", "journal": "", "pub_date": "2024",
                "pub_date_parsed": "2024-01-01", "pmid": str(i), "url": "",
                "source_type": "fake", "study_type": "Journal Article",
            }
            for i, t in enumerate(self._titles[:max_results])
        ]


async def test_search_all_drops_irrelevant_titles(monkeypatch):
    from app.integrations import evidence_registry
    fake = _FakeSource([
        "Sepsis management in the emergency department",
        "Afghanistan annual report 2025",
        "Norepinephrine dosing in septic shock",
        "Standards for donor human milk banking",
    ])
    monkeypatch.setattr(evidence_registry, "_REGISTRY", {"fake": fake})
    results = await search_all("sepsis norepinephrine", sources=["fake"], max_results=5)
    titles = [r["title"] for r in results]
    assert "Afghanistan annual report 2025" not in titles
    assert "Standards for donor human milk banking" not in titles
    assert "Sepsis management in the emergency department" in titles
    assert "Norepinephrine dosing in septic shock" in titles
