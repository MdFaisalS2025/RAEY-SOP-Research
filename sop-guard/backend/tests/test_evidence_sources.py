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
