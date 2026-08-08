"""
Tests for app/services/fulltext_fetch.py (full guideline-text ingestion,
small first slice) and europepmc.py's real-API-verified free-link parsing.

httpx is monkeypatched per-module, same pattern as test_evidence_sources.py -
no real network calls.
"""

import httpx
import pytest

from app.services import fulltext_fetch
from app.integrations import europepmc


class _FakeResponse:
    def __init__(self, content: bytes = b"", text: str = ""):
        self.content = content
        self.text = text

    def raise_for_status(self):
        return None


def _fake_client(response: _FakeResponse):
    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url):
            return response

    return _Client


def _failing_client():
    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, url):
            raise httpx.ConnectError("down")

    return _Client


# ---- fetch_full_text: HTML path -----------------------------------------


async def test_fetch_full_text_html_strips_tags(monkeypatch):
    html = "<html><body><h1>Guideline</h1><p>" + ("Give antibiotics within one hour. " * 10) + "</p></body></html>"
    monkeypatch.setattr(fulltext_fetch.httpx, "AsyncClient", _fake_client(_FakeResponse(content=html.encode(), text=html)))
    text = await fulltext_fetch.fetch_full_text("https://example.org/guideline", "html")
    assert text is not None
    assert "<h1>" not in text
    assert "Give antibiotics within one hour." in text


async def test_fetch_full_text_rejects_unsupported_style(monkeypatch):
    # No network attempted at all - the style check short-circuits first.
    assert await fulltext_fetch.fetch_full_text("https://example.org/x", "doi") is None
    assert await fulltext_fetch.fetch_full_text("", "html") is None


async def test_fetch_full_text_returns_none_below_min_chars(monkeypatch):
    html = "<p>Too short.</p>"
    monkeypatch.setattr(fulltext_fetch.httpx, "AsyncClient", _fake_client(_FakeResponse(content=html.encode(), text=html)))
    assert await fulltext_fetch.fetch_full_text("https://example.org/x", "html") is None


async def test_fetch_full_text_returns_none_on_network_failure(monkeypatch):
    monkeypatch.setattr(fulltext_fetch.httpx, "AsyncClient", _failing_client())
    assert await fulltext_fetch.fetch_full_text("https://example.org/x", "html") is None


async def test_fetch_full_text_returns_none_over_size_cap(monkeypatch):
    big = b"x" * (fulltext_fetch._MAX_BYTES + 1)
    monkeypatch.setattr(fulltext_fetch.httpx, "AsyncClient", _fake_client(_FakeResponse(content=big, text="x" * len(big))))
    assert await fulltext_fetch.fetch_full_text("https://example.org/x", "html") is None


# ---- fetch_full_text: pmc_xml path -----------------------------------------


async def test_fetch_full_text_pmc_xml_extracts_body_only(monkeypatch):
    xml = (
        "<pmc-articleset><article>"
        "<front><journal-meta><journal-title>Fake Journal</journal-title></journal-meta></front>"
        "<body><p>" + ("Give antibiotics within one hour of recognition. " * 10) + "</p></body>"
        "<back><ref-list><ref>Some Citation 2021</ref></ref-list></back>"
        "</article></pmc-articleset>"
    )
    monkeypatch.setattr(fulltext_fetch.httpx, "AsyncClient", _fake_client(_FakeResponse(content=xml.encode(), text=xml)))
    text = await fulltext_fetch.fetch_full_text("https://eutils.ncbi.nlm.nih.gov/x", "pmc_xml")
    assert text is not None
    assert "Give antibiotics within one hour" in text
    assert "Fake Journal" not in text
    assert "Some Citation" not in text


async def test_fetch_full_text_pmc_xml_returns_none_without_body_tag(monkeypatch):
    xml = "<pmc-articleset><article><front><journal-meta>no body here</journal-meta></front></article></pmc-articleset>"
    monkeypatch.setattr(fulltext_fetch.httpx, "AsyncClient", _fake_client(_FakeResponse(content=xml.encode(), text=xml)))
    assert await fulltext_fetch.fetch_full_text("https://eutils.ncbi.nlm.nih.gov/x", "pmc_xml") is None


# ---- europepmc._free_full_text_link: real-shape parsing -------------------


def test_free_full_text_link_picks_free_pdf_over_subscription_doi():
    doc = {
        "fullTextUrlList": {
            "fullTextUrl": [
                {"availability": "Subscription required", "availabilityCode": "S", "documentStyle": "doi", "url": "https://doi.org/x"},
                {"availability": "Free", "availabilityCode": "F", "documentStyle": "pdf", "url": "https://example.org/x.pdf"},
            ]
        }
    }
    url, style = europepmc._free_full_text_link(doc)
    assert url == "https://example.org/x.pdf"
    assert style == "pdf"


def test_free_full_text_link_accepts_free_html():
    doc = {
        "fullTextUrlList": {
            "fullTextUrl": [
                {"availability": "Free", "availabilityCode": "F", "documentStyle": "html", "url": "https://ncbi.nlm.nih.gov/books/x"},
            ]
        }
    }
    url, style = europepmc._free_full_text_link(doc)
    assert url == "https://ncbi.nlm.nih.gov/books/x"
    assert style == "html"


def test_free_full_text_link_none_when_only_subscription_or_doi():
    doc = {
        "fullTextUrlList": {
            "fullTextUrl": [
                {"availability": "Subscription required", "availabilityCode": "S", "documentStyle": "doi", "url": "https://doi.org/x"},
            ]
        }
    }
    assert europepmc._free_full_text_link(doc) == ("", "")


def test_free_full_text_link_none_when_missing_entirely():
    assert europepmc._free_full_text_link({}) == ("", "")


# ---- guideline_finder.get_guideline_text -----------------------------------


async def test_get_guideline_text_uses_full_text_when_available(monkeypatch):
    from app.services import guideline_finder

    async def _fake_fetch(url, style):
        return "Real full guideline text. " * 20

    monkeypatch.setattr("app.services.fulltext_fetch.fetch_full_text", _fake_fetch)
    guideline = {
        "abstract": "Short abstract only.",
        "full_text_url": "https://example.org/g.pdf",
        "full_text_style": "pdf",
    }
    basis, text = await guideline_finder.get_guideline_text(guideline)
    assert basis == "full_text"
    assert "Real full guideline text." in text


async def test_get_guideline_text_falls_back_to_abstract_when_fetch_fails(monkeypatch):
    from app.services import guideline_finder

    async def _fake_fetch(url, style):
        return None  # simulates any fetch failure - never raises

    monkeypatch.setattr("app.services.fulltext_fetch.fetch_full_text", _fake_fetch)
    guideline = {
        "abstract": "Short abstract only.",
        "full_text_url": "https://example.org/g.pdf",
        "full_text_style": "pdf",
    }
    basis, text = await guideline_finder.get_guideline_text(guideline)
    assert basis == "abstract"
    assert text == "Short abstract only."


async def test_get_guideline_text_falls_back_when_no_full_text_link():
    from app.services import guideline_finder

    guideline = {"abstract": "Only an abstract here.", "full_text_url": "", "full_text_style": ""}
    basis, text = await guideline_finder.get_guideline_text(guideline)
    assert basis == "abstract"
    assert text == "Only an abstract here."


async def test_get_guideline_text_tries_pmc_mirror_for_pubmed_candidate(monkeypatch):
    from app.services import guideline_finder
    from app.integrations import pubmed as pubmed_module

    async def _fake_pmc_link(pmid):
        return "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=999&rettype=full&retmode=xml", "pmc_xml"

    async def _fake_fetch(url, style):
        assert style == "pmc_xml"
        return "Real PMC full text via elink. " * 20

    monkeypatch.setattr(pubmed_module, "get_pmc_full_text_link", _fake_pmc_link)
    monkeypatch.setattr("app.services.fulltext_fetch.fetch_full_text", _fake_fetch)
    guideline = {"abstract": "abstract only", "source_type": "pubmed", "pmid": "34599691"}
    basis, text = await guideline_finder.get_guideline_text(guideline)
    assert basis == "full_text"
    assert "Real PMC full text" in text


async def test_get_guideline_text_falls_back_when_pmc_lookup_finds_nothing(monkeypatch):
    from app.services import guideline_finder
    from app.integrations import pubmed as pubmed_module

    async def _fake_pmc_link(pmid):
        return "", ""

    monkeypatch.setattr(pubmed_module, "get_pmc_full_text_link", _fake_pmc_link)
    guideline = {"abstract": "abstract only", "source_type": "pubmed", "pmid": "12345"}
    basis, text = await guideline_finder.get_guideline_text(guideline)
    assert basis == "abstract"
    assert text == "abstract only"


async def test_get_guideline_text_tries_iris_pdf_for_who_candidate(monkeypatch):
    from app.services import guideline_finder
    from app.integrations import who as who_module

    async def _fake_iris_link(item_uuid):
        return "https://iris.who.int/server/api/core/bitstreams/x/content"

    async def _fake_fetch(url, style):
        assert style == "pdf"
        return "Real WHO IRIS PDF full text. " * 20

    monkeypatch.setattr(who_module, "get_iris_full_text_link", _fake_iris_link)
    monkeypatch.setattr("app.services.fulltext_fetch.fetch_full_text", _fake_fetch)
    guideline = {"abstract": "abstract only", "source_type": "who", "item_uuid": "some-uuid"}
    basis, text = await guideline_finder.get_guideline_text(guideline)
    assert basis == "full_text"
    assert "Real WHO IRIS PDF" in text


async def test_get_guideline_text_falls_back_when_no_iris_link(monkeypatch):
    from app.services import guideline_finder
    from app.integrations import who as who_module

    async def _fake_iris_link(item_uuid):
        return ""

    monkeypatch.setattr(who_module, "get_iris_full_text_link", _fake_iris_link)
    guideline = {"abstract": "abstract only", "source_type": "who", "item_uuid": "some-uuid"}
    basis, text = await guideline_finder.get_guideline_text(guideline)
    assert basis == "abstract"
    assert text == "abstract only"


# ---- extract_recommendations locus_label ------------------------------------


def test_extract_recommendations_honest_locus_label_when_full_text():
    from app.services import guideline_finder

    text = "Clinicians should give antibiotics within one hour of recognition."
    items = guideline_finder.extract_recommendations(text, locus_label="Full text")
    assert items[0]["source_locus"] == "Full text, sentence 1"
