"""Tests for the pluggable EvidenceSource sources (Europe PMC, CDC, WHO,
ClinicalTrials.gov) and the registry's recency-first merge/sort.

httpx is monkeypatched per-module so no real network calls are made.
"""

import httpx
import pytest

from app.integrations import europepmc, cdc, who, clinicaltrials
from app.integrations.evidence_source import parse_pub_date
from app.integrations.evidence_registry import search_all


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


def _fake_client(payload):
    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url, params=None):
            return _FakeResponse(payload)

    return _Client


def _failing_client():
    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url, params=None):
            raise httpx.ConnectError("down")

    return _Client


@pytest.fixture(autouse=True)
def _clear_caches():
    europepmc._cache.clear()
    cdc._cache.clear()
    who._cache.clear()
    clinicaltrials._cache.clear()
    yield


def test_parse_pub_date_variants():
    assert parse_pub_date("2024-03-15") == "2024-03-15"
    assert parse_pub_date("2024 Jan 15") == "2024-01-15"
    assert parse_pub_date("2023") == "2023-01-01"
    assert parse_pub_date("") is None
    assert parse_pub_date(None) is None


async def test_europepmc_parses_and_sorts_by_date(monkeypatch):
    payload = {
        "resultList": {
            "result": [
                {"id": "1", "title": "Older sepsis study", "authorString": "A B",
                 "journalTitle": "JAMA", "firstPublicationDate": "2019-01-01"},
                {"id": "2", "title": "Newer sepsis study", "authorString": "C D",
                 "journalTitle": "NEJM", "firstPublicationDate": "2024-06-01"},
            ]
        }
    }
    monkeypatch.setattr(europepmc.httpx, "AsyncClient", _fake_client(payload))
    records = await europepmc.search_europepmc("sepsis", max_results=5)
    assert len(records) == 2
    assert records[0]["source_type"] == "europepmc"
    assert records[0]["pub_date_parsed"] == "2019-01-01"


async def test_europepmc_graceful_on_failure(monkeypatch):
    monkeypatch.setattr(europepmc.httpx, "AsyncClient", _failing_client())
    assert await europepmc.search_europepmc("sepsis") == []


async def test_cdc_parses(monkeypatch):
    payload = {"results": [
        {"title": "Sepsis prevention guidance", "sourceURL": "https://cdc.gov/x",
         "dateOfSourceModification": "2024-02-01", "resourceId": "abc"}
    ]}
    monkeypatch.setattr(cdc.httpx, "AsyncClient", _fake_client(payload))
    records = await cdc.search_cdc("sepsis")
    assert len(records) == 1
    assert records[0]["source_type"] == "cdc"
    assert records[0]["url"] == "https://cdc.gov/x"


async def test_cdc_graceful_on_failure(monkeypatch):
    monkeypatch.setattr(cdc.httpx, "AsyncClient", _failing_client())
    assert await cdc.search_cdc("sepsis") == []


async def test_who_parses(monkeypatch):
    payload = {
        "_embedded": {
            "searchResult": {
                "_embedded": {
                    "objects": [
                        {
                            "_embedded": {
                                "indexableObject": {
                                    "handle": "10665/123",
                                    "metadata": {
                                        "dc.title": [{"value": "WHO sepsis guideline"}],
                                        "dc.date.issued": [{"value": "2023-05-01"}],
                                    },
                                }
                            }
                        }
                    ]
                }
            }
        }
    }
    monkeypatch.setattr(who.httpx, "AsyncClient", _fake_client(payload))
    records = await who.search_who("sepsis")
    assert len(records) == 1
    assert records[0]["title"] == "WHO sepsis guideline"
    assert records[0]["source_type"] == "who"


async def test_who_graceful_on_malformed_shape(monkeypatch):
    monkeypatch.setattr(who.httpx, "AsyncClient", _fake_client({"unexpected": "shape"}))
    assert await who.search_who("sepsis") == []


async def test_who_graceful_on_failure(monkeypatch):
    monkeypatch.setattr(who.httpx, "AsyncClient", _failing_client())
    assert await who.search_who("sepsis") == []


async def test_clinicaltrials_parses(monkeypatch):
    payload = {"studies": [
        {
            "protocolSection": {
                "identificationModule": {"nctId": "NCT001", "briefTitle": "Sepsis trial"},
                "statusModule": {"lastUpdatePostDateStruct": {"date": "2024-04-01"}, "overallStatus": "RECRUITING"},
                "sponsorCollaboratorsModule": {"leadSponsor": {"name": "Test Hospital"}},
            }
        }
    ]}
    monkeypatch.setattr(clinicaltrials.httpx, "AsyncClient", _fake_client(payload))
    records = await clinicaltrials.search_clinicaltrials("sepsis")
    assert len(records) == 1
    assert records[0]["source_type"] == "clinicaltrials"
    assert records[0]["pmid"] == "NCT001"


async def test_clinicaltrials_graceful_on_failure(monkeypatch):
    monkeypatch.setattr(clinicaltrials.httpx, "AsyncClient", _failing_client())
    assert await clinicaltrials.search_clinicaltrials("sepsis") == []


async def test_registry_merges_and_sorts_by_recency(monkeypatch):
    """All integration modules do `import httpx`, i.e. they share the same
    module object - patching httpx.AsyncClient on one module's reference
    patches it everywhere. So a mixed-source test needs one client that
    dispatches (or fails) by URL, not one monkeypatch per module."""
    from app.integrations import pubmed as pubmed_mod

    europepmc_payload = {
        "resultList": {"result": [
            {"id": "1", "title": "Old", "firstPublicationDate": "2015-01-01"},
            {"id": "2", "title": "New", "firstPublicationDate": "2025-01-01"},
        ]}
    }

    class _DispatchClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url, params=None):
            if "eutils.ncbi.nlm.nih.gov" in url:
                return _FakeResponse({"esearchresult": {"idlist": []}})
            if "ebi.ac.uk" in url:
                return _FakeResponse(europepmc_payload)
            raise httpx.ConnectError("down")

    monkeypatch.setattr(pubmed_mod.httpx, "AsyncClient", _DispatchClient)
    pubmed_mod._cache.clear()

    records = await search_all("sepsis", sources=["pubmed", "europepmc", "cdc", "who", "clinicaltrials"])
    assert [r["title"] for r in records] == ["New", "Old"]


class TestCleanSearchTerm:
    def test_strips_question_phrasing_and_punctuation(self):
        from app.integrations.evidence_source import clean_search_term
        assert clean_search_term("What is the protocol for jellyfish sting treatment?") == "jellyfish sting treatment"

    def test_no_query_breaking_characters_survive(self):
        """The openFDA 400 bug: a '?' inside a Lucene phrase query is
        rejected. The cleaned term must never contain query-parser-breaking
        characters."""
        from app.integrations.evidence_source import clean_search_term
        out = clean_search_term('Compare "our SOP" vs. the guideline: (2024)?')
        for ch in '?":()[]{}^~*\\/<>=&|':
            assert ch not in out

    def test_falls_back_to_stripped_original_when_all_stopwords(self):
        from app.integrations.evidence_source import clean_search_term
        # every token is a dropped function word - must not return empty
        out = clean_search_term("what is the?")
        assert out and "?" not in out

    def test_preserves_drug_name_unchanged(self):
        from app.integrations.evidence_source import clean_search_term
        assert clean_search_term("norepinephrine") == "norepinephrine"

    async def test_registry_sends_cleaned_term_to_sources(self, monkeypatch):
        """Regression: the raw question used to be handed to each provider,
        breaking openFDA and hurting relevance. search_all must clean it
        first."""
        from app.integrations import pubmed as pubmed_mod
        seen_terms: list[str] = []

        class _CaptureClient:
            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc):
                return False

            async def get(self, url, params=None):
                # PubMed puts the term in `term`, most others in a query param
                term = (params or {}).get("term") or (params or {}).get("query.term") or ""
                if term:
                    seen_terms.append(term)
                return _FakeResponse({"esearchresult": {"idlist": []}})

        monkeypatch.setattr(pubmed_mod.httpx, "AsyncClient", _CaptureClient)
        pubmed_mod._cache.clear()

        await search_all("What is the protocol for heat stroke management?", sources=["pubmed"])
        assert seen_terms, "expected the source to be queried"
        assert seen_terms[0] == "heat stroke management"
        assert "?" not in seen_terms[0]


class TestPickSupportingExcerpt:
    def test_picks_sentence_with_most_term_overlap(self):
        from app.integrations.evidence_source import pick_supporting_excerpt
        abstract = (
            "Background: sepsis is common. "
            "Norepinephrine at doses above 0.5 mcg/kg/min was associated with increased mortality. "
            "Conclusion: caution advised."
        )
        excerpt = pick_supporting_excerpt(abstract, "norepinephrine dose mortality")
        assert "0.5 mcg/kg/min" in excerpt

    def test_empty_abstract_returns_empty_string(self):
        from app.integrations.evidence_source import pick_supporting_excerpt
        assert pick_supporting_excerpt("", "anything") == ""

    def test_falls_back_to_first_sentence_when_no_term_overlap(self):
        from app.integrations.evidence_source import pick_supporting_excerpt
        excerpt = pick_supporting_excerpt("First sentence here. Second sentence here.", "zzz nomatch")
        assert excerpt == "First sentence here."

    def test_long_sentence_truncated_on_word_boundary(self):
        from app.integrations.evidence_source import pick_supporting_excerpt
        long_sentence = "The dose was studied extensively in a large cohort of patients over many years."
        excerpt = pick_supporting_excerpt(long_sentence, "dose", max_chars=30)
        assert excerpt.endswith("...")
        assert len(excerpt) <= 33  # 30 + "..."
        # truncated on a word boundary - no partial word before "..."
        body = excerpt[:-3]
        assert long_sentence.startswith(body)
        assert not long_sentence[len(body):len(body) + 1].isalpha()


class TestEuropePMCAbstractCleaning:
    async def test_strips_structured_html_tags(self, monkeypatch):
        from app.integrations import europepmc as epmc_mod
        payload = {"resultList": {"result": [
            {"id": "1", "title": "Heat stroke study",
             "abstractText": "<h4>Background</h4>Heat stroke is dangerous.<h4>Methods</h4>We reviewed cases."},
        ]}}
        monkeypatch.setattr(epmc_mod.httpx, "AsyncClient", _fake_client(payload))
        epmc_mod._cache.clear()
        records = await epmc_mod.search_europepmc("heat stroke", max_results=1)
        assert "<h4>" not in records[0]["abstract"]
        assert "<" not in records[0]["abstract"] and ">" not in records[0]["abstract"]
        assert "Heat stroke is dangerous." in records[0]["abstract"]

    async def test_search_all_drops_excerpt_that_duplicates_the_title(self, monkeypatch):
        """Real bug (P1.4): a short case report with no true abstract can
        have an efetch abstract body that's just the citation's title line
        repeated - showing that back as a 'supporting excerpt' is redundant
        and misleading (it looks like real supporting prose but isn't).
        search_all must drop it, not just the title-only fallback case."""
        from app.integrations import pubmed as pubmed_mod

        class _TextResponse:
            def __init__(self, text):
                self.text = text

            def raise_for_status(self):
                return None

        class _DispatchClient:
            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc):
                return False

            async def get(self, url, params=None):
                if "esearch" in url:
                    return _FakeResponse({"esearchresult": {"idlist": ["1"]}})
                if "esummary" in url:
                    return _FakeResponse({"result": {"uids": ["1"], "1": {
                        "uid": "1", "title": "Heat stroke case report in a teenager",
                        "fulljournalname": "Acta Medica", "pubdate": "2024",
                    }}})
                # efetch: abstract text is literally just the title again
                return _TextResponse("1. Heat stroke case report in a teenager.\nActa Medica. 2024.\nPMID: 1")

        monkeypatch.setattr(pubmed_mod.httpx, "AsyncClient", _DispatchClient)
        pubmed_mod._cache.clear()
        records = await search_all("heat stroke", sources=["pubmed"], max_results=1)
        assert records
        assert records[0]["supporting_excerpt"] == ""

    async def test_requests_core_result_type_for_abstracts(self, monkeypatch):
        from app.integrations import europepmc as epmc_mod
        seen_params = {}

        class _CaptureClient:
            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *exc):
                return False

            async def get(self, url, params=None):
                seen_params.update(params or {})
                return _FakeResponse({"resultList": {"result": []}})

        monkeypatch.setattr(epmc_mod.httpx, "AsyncClient", _CaptureClient)
        epmc_mod._cache.clear()
        await epmc_mod.search_europepmc("sepsis", max_results=1)
        assert seen_params.get("resultType") == "core"
