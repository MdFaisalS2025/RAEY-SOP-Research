"""Tests for the WHO IRIS integration: search parsing + the full-text
bitstream discovery chain added alongside PubMed's PMC mirror and Europe
PMC's fullTextUrlList.

httpx is monkeypatched so no real network calls are made.
"""

import httpx
import pytest

from app.integrations import who


SEARCH_JSON = {
    "_embedded": {
        "searchResult": {
            "_embedded": {
                "objects": [
                    {
                        "_embedded": {
                            "indexableObject": {
                                "uuid": "ee565438-e7d8-4fc7-9106-52a606022bd0",
                                "handle": "10665/254608",
                                "metadata": {
                                    "dc.title": [{"value": "Statement on maternal sepsis"}],
                                    "dc.contributor.author": [{"value": "World Health Organization"}],
                                    "dc.date.issued": [{"value": "2017-02-13"}],
                                    "dc.type": [{"value": "Guideline"}],
                                },
                            }
                        }
                    }
                ]
            }
        }
    }
}

BUNDLES_JSON = {
    "_embedded": {
        "bundles": [
            {"name": "LICENSE", "_links": {"bitstreams": {"href": "https://iris.who.int/server/api/core/bundles/lic/bitstreams"}}},
            {"name": "ORIGINAL", "_links": {"bitstreams": {"href": "https://iris.who.int/server/api/core/bundles/orig/bitstreams"}}},
        ]
    }
}

BITSTREAMS_JSON = {
    "_embedded": {
        "bitstreams": [
            {"name": "license.txt", "_links": {"content": {"href": "https://iris.who.int/server/api/core/bitstreams/lic/content"}}},
            {"name": "WHO-RHR-17.02-eng.pdf", "_links": {"content": {"href": "https://iris.who.int/server/api/core/bitstreams/pdf/content"}}},
        ]
    }
}

BUNDLES_NO_ORIGINAL_JSON = {"_embedded": {"bundles": [{"name": "LICENSE", "_links": {"bitstreams": {"href": "x"}}}]}}
BITSTREAMS_NO_PDF_JSON = {"_embedded": {"bitstreams": [{"name": "readme.txt", "_links": {"content": {"href": "x"}}}]}}


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
        return _FakeResponse(SEARCH_JSON)


class _FailingClient(_FakeClient):
    async def get(self, url, params=None):
        raise httpx.ConnectError("network down")


class _BitstreamChainClient:
    """Dispatches on URL substring so one fake client can serve the
    bundles -> bitstreams two-hop chain get_iris_full_text_link walks."""

    def __init__(self, bundles_payload, bitstreams_payload):
        self._bundles = bundles_payload
        self._bitstreams = bitstreams_payload

    def __call__(self, *args, **kwargs):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, params=None):
        if "/bundles/" in url and "/bitstreams" in url:
            return _FakeResponse(self._bitstreams)
        return _FakeResponse(self._bundles)


@pytest.fixture(autouse=True)
def _clear_cache():
    who._cache.clear()
    yield
    who._cache.clear()


async def test_search_parses_records_including_item_uuid(monkeypatch):
    monkeypatch.setattr(who.httpx, "AsyncClient", _FakeClient)
    records = await who.search_who("sepsis")
    assert len(records) == 1
    r = records[0]
    assert r["title"] == "Statement on maternal sepsis"
    assert r["source_type"] == "who"
    assert r["study_type"] == "Guideline"
    assert r["item_uuid"] == "ee565438-e7d8-4fc7-9106-52a606022bd0"
    assert r["pmid"] == "10665/254608"


async def test_search_graceful_empty_on_failure(monkeypatch):
    monkeypatch.setattr(who.httpx, "AsyncClient", _FailingClient)
    assert await who.search_who("anything") == []


async def test_search_empty_term_returns_empty():
    assert await who.search_who("   ") == []


class TestGetIrisFullTextLink:
    async def test_finds_original_bundle_pdf(self, monkeypatch):
        monkeypatch.setattr(
            who.httpx, "AsyncClient",
            _BitstreamChainClient(BUNDLES_JSON, BITSTREAMS_JSON),
        )
        url = await who.get_iris_full_text_link("ee565438-e7d8-4fc7-9106-52a606022bd0")
        assert url == "https://iris.who.int/server/api/core/bitstreams/pdf/content"

    async def test_no_original_bundle_returns_empty(self, monkeypatch):
        monkeypatch.setattr(
            who.httpx, "AsyncClient",
            _BitstreamChainClient(BUNDLES_NO_ORIGINAL_JSON, BITSTREAMS_JSON),
        )
        assert await who.get_iris_full_text_link("some-uuid") == ""

    async def test_no_pdf_bitstream_returns_empty(self, monkeypatch):
        monkeypatch.setattr(
            who.httpx, "AsyncClient",
            _BitstreamChainClient(BUNDLES_JSON, BITSTREAMS_NO_PDF_JSON),
        )
        assert await who.get_iris_full_text_link("some-uuid") == ""

    async def test_empty_uuid_returns_empty(self):
        assert await who.get_iris_full_text_link("") == ""

    async def test_network_failure_returns_empty(self, monkeypatch):
        monkeypatch.setattr(who.httpx, "AsyncClient", _FailingClient)
        assert await who.get_iris_full_text_link("some-uuid") == ""
