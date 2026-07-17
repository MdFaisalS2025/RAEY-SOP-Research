"""Tests for the OpenMed-inspired rule-based PHI guard (app/privacy/phi_guard.py)
and the /api/privacy/scan endpoint.

Two properties matter most and are asserted hardest here:
  1. Ordinary clinical questions come back CLEAN (no false positives) - a guard
     that flags "maximum norepinephrine dose" is worse than no guard.
  2. Direct identifiers that show up when someone pastes patient context are
     caught and redact cleanly without corrupting the surrounding text.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.privacy.phi_guard import (
    RuleBasedPhiProvider,
    get_phi_provider,
    redact,
    scan,
)

provider = RuleBasedPhiProvider()


# --- Clinical negatives: must NEVER be flagged ---------------------------------

CLEAN_QUERIES = [
    "What are the steps for sepsis management?",
    "What is the maximum norepinephrine dose?",
    "When should insulin be held for hypoglycemia?",
    "What should a nurse monitor after central line insertion?",
    "What contraindications apply before blood transfusion?",
    "Start norepinephrine at 8 mcg/min and titrate to MAP 65",
    "Refer to Sepsis Management Protocol v4.2",
    "Lactate of 4 mmol/L with hypotension",
    "How often should vitals be checked for fall risk patients?",
]


@pytest.mark.parametrize("text", CLEAN_QUERIES)
def test_clinical_queries_are_not_flagged(text):
    result = scan(text)
    assert result["has_phi"] is False, f"false positive on: {text!r} -> {result['types']}"
    assert result["redacted_text"] == text


# --- Direct identifiers: must be detected --------------------------------------

def test_detects_name_after_trigger():
    spans = provider.detect("What do I do for patient John Smith?")
    assert any(s.type == "NAME" for s in spans)


def test_detects_mrn_with_label():
    spans = provider.detect("Patient MRN 4451982 needs review")
    assert any(s.type == "MRN" for s in spans)


def test_detects_ssn():
    assert any(s.type == "SSN" for s in provider.detect("SSN 123-45-6789"))


def test_detects_email_and_phone():
    types = {s.type for s in provider.detect("call (415) 555-0132 or email jane.doe@x.org")}
    assert "PHONE" in types
    assert "EMAIL" in types


def test_detects_numeric_and_written_dates():
    assert any(s.type == "DATE" for s in provider.detect("DOB 03/14/1980"))
    assert any(s.type == "DATE" for s in provider.detect("admitted January 5, 2001"))


def test_detects_street_address():
    assert any(s.type == "ADDRESS" for s in provider.detect("lives at 1420 Oakwood Avenue"))


# --- Redaction correctness -----------------------------------------------------

def test_redaction_preserves_clinical_context_and_offsets():
    text = "What should I do for patient John Smith, MRN 4451982, with a lactate of 4?"
    result = scan(text)
    assert result["has_phi"] is True
    red = result["redacted_text"]
    # Identifiers gone, clinical content intact, no leftover name fragments.
    assert "John" not in red and "Smith" not in red
    assert "4451982" not in red
    assert "[REDACTED-NAME]" in red and "[REDACTED-MRN]" in red
    assert "lactate of 4" in red


def test_redact_with_no_spans_is_identity():
    assert redact("plain clinical text", []) == "plain clinical text"


def test_empty_input_is_clean():
    r = scan("")
    assert r["has_phi"] is False
    assert r["spans"] == []


# --- Provider factory / graceful degradation -----------------------------------

def test_default_provider_is_rule_based():
    assert get_phi_provider("rule").name == "rule-based"


def test_openmed_backend_degrades_to_rule_based():
    # Selecting the unbundled OpenMed backend must not crash - it falls back to
    # the working rule provider (mirrors the cross-encoder reranker fallback).
    prov = get_phi_provider("openmed")
    assert prov.name == "rule-based"
    assert prov.detect("patient John Smith")  # still functions


# --- API endpoint --------------------------------------------------------------

@pytest.fixture
async def client():
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_scan_endpoint_flags_phi(client):
    resp = await client.post("/api/privacy/scan", json={"text": "patient John Smith MRN 4451982"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["has_phi"] is True
    assert "NAME" in body["types"] or "MRN" in body["types"]
    assert "[REDACTED" in body["redacted_text"]


@pytest.mark.asyncio
async def test_scan_endpoint_clean_query(client):
    resp = await client.post("/api/privacy/scan", json={"text": "What is the maximum norepinephrine dose?"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["has_phi"] is False
    assert body["spans"] == []
