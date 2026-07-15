"""Tests for the OpenEvidence provider-ready placeholder (app/integrations/
openevidence.py) and the GET /api/evidence/providers status endpoint."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app as fastapi_app
from app.integrations.openevidence import OpenEvidenceSource, provider_status


async def test_openevidence_search_always_returns_empty():
    source = OpenEvidenceSource()
    results = await source.search("sepsis", max_results=5)
    assert results == []


def test_provider_status_not_configured_by_default(monkeypatch):
    from app import config
    monkeypatch.setattr(config.settings, "OPENEVIDENCE_API_KEY", None)
    monkeypatch.setattr(config.settings, "OPENEVIDENCE_BASE_URL", None)
    status = provider_status()
    assert status["status"] == "not_configured"
    assert status["key"] == "openevidence"


def test_provider_status_never_reports_active(monkeypatch):
    # Even with both env vars set, there is no real call path to verify -
    # the status must never silently claim to be a working integration.
    from app import config
    monkeypatch.setattr(config.settings, "OPENEVIDENCE_API_KEY", "fake-key")
    monkeypatch.setattr(config.settings, "OPENEVIDENCE_BASE_URL", "https://example.com")
    status = provider_status()
    assert status["status"] != "active"
    assert status["status"] == "requires_api_key"


@pytest.fixture
async def client():
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_evidence_providers_endpoint_lists_real_and_placeholder(client):
    resp = await client.get("/api/evidence/providers")
    assert resp.status_code == 200, resp.text
    providers = resp.json()["providers"]
    keys = {p["key"] for p in providers}
    assert "pubmed" in keys
    assert "openevidence" in keys

    pubmed = next(p for p in providers if p["key"] == "pubmed")
    assert pubmed["status"] == "active"

    openevidence = next(p for p in providers if p["key"] == "openevidence")
    assert openevidence["status"] in ("not_configured", "requires_api_key")
    assert "notes" in openevidence and openevidence["notes"]
