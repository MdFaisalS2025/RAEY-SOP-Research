"""Tests for SOP version history, protocol comparison, and gap report
routes/services (app/services/sop_comparison.py, app/api/routes_sop_versions.py,
app/api/routes_comparison.py, app/api/routes_gap_reports.py)."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import SOP, SOPVersionRecord
from app.services.sop_comparison import (
    compare_sop_to_reference,
    compare_sop_to_dynamic_evidence,
    build_dynamic_reference_items,
    REFERENCE_PROTOCOLS,
)


# ─── Pure comparison-engine tests (no DB/HTTP needed) ──────────────────────

def test_returns_none_for_sop_without_reference_protocol():
    assert compare_sop_to_reference("SOP-DOES-NOT-EXIST", ["step one"]) is None


def test_exact_match_classified_as_match():
    reference_step = REFERENCE_PROTOCOLS["SOP-ICU-001"]["steps"][0]  # "Screen for suspected sepsis"
    result = compare_sop_to_reference("SOP-ICU-001", [reference_step])
    row = result["rows"][0]
    assert row["status"] == "match"
    assert row["reference_step"] == reference_step


def test_unrelated_internal_steps_classified_as_missing():
    result = compare_sop_to_reference("SOP-ICU-001", ["Verify patient wristband before administering medication."])
    assert all(r["status"] == "missing_from_sop" for r in result["rows"])
    assert result["summary"]["missing_count"] == len(REFERENCE_PROTOCOLS["SOP-ICU-001"]["steps"])
    assert result["summary"]["overall_alignment"] == "Needs Review"


def test_full_bundle_coverage_is_aligned():
    steps = REFERENCE_PROTOCOLS["SOP-ICU-001"]["steps"]
    result = compare_sop_to_reference("SOP-ICU-001", list(steps))
    assert result["summary"]["match_count"] == len(steps)
    assert result["summary"]["overall_alignment"] == "Aligned"


def test_sop_only_step_flagged_when_unrelated_to_any_reference_step():
    steps = list(REFERENCE_PROTOCOLS["SOP-ICU-001"]["steps"])
    steps.append("Document patient consent for central line placement.")
    result = compare_sop_to_reference("SOP-ICU-001", steps)
    assert "Document patient consent for central line placement." in result["sop_only_steps"]


def test_curated_comparison_marks_mode_curated():
    result = compare_sop_to_reference("SOP-ICU-001", ["Measure lactate"])
    assert result["mode"] == "curated"
    assert result["reference_source"]["name"] == "Surviving Sepsis Campaign - Hour-1 Bundle"


# ─── Dynamic (any-SOP) comparison tests ─────────────────────────────────────

def _fake_record(title, study_type=None, trust_tier=None, pub_date_parsed="2024-01-01"):
    return {
        "title": title, "study_type": study_type, "trust_tier": trust_tier,
        "pub_date_parsed": pub_date_parsed, "pub_date": pub_date_parsed,
        "source_type": "pubmed", "journal": "Test Journal", "url": "https://example.com",
        "evidence_grade": None,
    }


def test_build_dynamic_reference_items_filters_to_strong_and_moderate():
    from app.integrations.evidence_source import grade_evidence
    records = [
        _fake_record("A meta-analysis of heat stroke cooling", study_type="Meta-Analysis"),
        _fake_record("A random case report of heat stroke", study_type="Case Reports"),
        _fake_record("An RCT of cooling methods", study_type="Randomized Controlled Trial"),
    ]
    for r in records:
        r["evidence_grade"] = grade_evidence(r)
    items = build_dynamic_reference_items(records)
    texts = [it["text"] for it in items]
    assert "A meta-analysis of heat stroke cooling" in texts
    assert "An RCT of cooling methods" in texts
    assert "A random case report of heat stroke" not in texts  # Limited grade, excluded


def test_build_dynamic_reference_items_empty_when_nothing_qualifies():
    from app.integrations.evidence_source import grade_evidence
    records = [_fake_record("Some case report", study_type="Case Reports")]
    for r in records:
        r["evidence_grade"] = grade_evidence(r)
    assert build_dynamic_reference_items(records) == []


def test_compare_sop_to_dynamic_evidence_returns_none_when_no_qualifying_evidence():
    assert compare_sop_to_dynamic_evidence("SOP-XYZ", ["some step"], []) is None


def test_compare_sop_to_dynamic_evidence_builds_real_comparison():
    from app.integrations.evidence_source import grade_evidence
    records = [_fake_record("Apply active cooling for heat stroke", study_type="Meta-Analysis")]
    for r in records:
        r["evidence_grade"] = grade_evidence(r)
    result = compare_sop_to_dynamic_evidence("SOP-XYZ", ["Apply active cooling for heat stroke"], records)
    assert result is not None
    assert result["mode"] == "dynamic"
    assert result["reference_source"] is None
    assert result["rows"][0]["status"] == "match"
    assert result["rows"][0]["source_type"] == "Meta-Analysis"


# ─── Route-level tests ──────────────────────────────────────────────────────

@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_versions.db'}"
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(engine, expire_on_commit=False)

    async def _override_get_db():
        async with TestSession() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    async with TestSession() as session:
        session.add(SOP(
            sop_id="SOP-ICU-001", title="Sepsis Management Protocol", department="ICU",
            version="2.1", structured_json={"steps": [
                {"step": 1, "action": "Screen for suspected sepsis"},
                {"step": 2, "action": "Measure lactate"},
            ]},
        ))
        session.add(SOP(
            sop_id="SOP-GEN-002", title="Blood Transfusion Protocol", department="General",
            version="2.4", structured_json={"steps": [
                {"step": 1, "action": "Verify two patient identifiers before transfusion"},
            ]},
        ))
        session.add(SOPVersionRecord(
            sop_id="SOP-ICU-001", version_number="1.0", status="archived",
            effective_date="2023-06-01", new_text="v1 text", committee_comment="Initial standardization.",
        ))
        session.add(SOPVersionRecord(
            sop_id="SOP-ICU-001", version_number="2.1", status="current",
            effective_date="2025-01-15", old_text="v1 text", new_text="v2.1 text",
            committee_comment="Clarified reassessment criteria.",
        ))
        await session.commit()

    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.pop(get_db, None)
    await engine.dispose()


async def test_version_history_endpoint_orders_versions_numerically(client):
    resp = await client.get("/api/sops/SOP-ICU-001/version-history")
    assert resp.status_code == 200, resp.text
    versions = resp.json()["versions"]
    assert [v["version_number"] for v in versions] == ["1.0", "2.1"]
    assert versions[-1]["status"] == "current"


async def test_version_diff_endpoint_returns_segments(client):
    resp = await client.get("/api/sops/SOP-ICU-001/version-history/2.1/diff")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["available"] is True
    assert len(data["segments"]) > 0


async def test_version_diff_404_for_unknown_version(client):
    resp = await client.get("/api/sops/SOP-ICU-001/version-history/9.9/diff")
    assert resp.status_code == 404


async def test_version_diff_defaults_to_immediately_preceding_version(client):
    resp = await client.get("/api/sops/SOP-ICU-001/version-history/2.1/diff")
    assert resp.status_code == 200, resp.text
    assert resp.json()["from_version"] == "1.0"


async def test_version_diff_accepts_explicit_from_version(client):
    # Same pair as the default case here (only two versions exist), but
    # exercised via the explicit query param to confirm it's honored.
    resp = await client.get("/api/sops/SOP-ICU-001/version-history/2.1/diff?from_version=1.0")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["from_version"] == "1.0"
    assert data["available"] is True


async def test_version_diff_404_for_unknown_from_version(client):
    resp = await client.get("/api/sops/SOP-ICU-001/version-history/2.1/diff?from_version=9.9")
    assert resp.status_code == 404


async def test_protocol_comparison_endpoint_returns_available_result(client):
    resp = await client.get("/api/sops/SOP-ICU-001/protocol-comparison")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["available"] is True
    assert data["summary"]["total_reference_steps"] == len(REFERENCE_PROTOCOLS["SOP-ICU-001"]["steps"])


async def test_protocol_comparison_404_for_unknown_sop(client):
    resp = await client.get("/api/sops/SOP-NOT-SEEDED/protocol-comparison")
    assert resp.status_code == 404


async def test_protocol_comparison_dynamic_mode_for_sop_without_curated_bundle(client, monkeypatch):
    # SOP-GEN-002 exists in the fixture but has no curated reference
    # protocol - the route should fall back to a live-evidence-based
    # dynamic comparison instead of refusing outright.
    async def fake_search(term, max_results=15):
        return [{
            "title": "Verify two patient identifiers before transfusion",
            "study_type": "Practice Guideline", "trust_tier": None,
            "pub_date_parsed": "2023-01-01", "pub_date": "2023-01-01",
            "source_type": "who", "journal": "", "url": "https://example.com/guideline",
        }]

    import app.api.routes_comparison as routes_comparison
    monkeypatch.setattr(routes_comparison, "search_external_evidence", fake_search)

    resp = await client.get("/api/sops/SOP-GEN-002/protocol-comparison")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["available"] is True
    assert data["mode"] == "dynamic"
    assert data["reference_source"] is None
    assert data["rows"][0]["status"] == "match"


async def test_protocol_comparison_dynamic_mode_unavailable_when_no_strong_evidence(client, monkeypatch):
    async def fake_search(term, max_results=15):
        return [{
            "title": "An unrelated case report",
            "study_type": "Case Reports", "trust_tier": None,
            "pub_date_parsed": "2023-01-01", "pub_date": "2023-01-01",
            "source_type": "pubmed", "journal": "", "url": "",
        }]

    import app.api.routes_comparison as routes_comparison
    monkeypatch.setattr(routes_comparison, "search_external_evidence", fake_search)

    resp = await client.get("/api/sops/SOP-GEN-002/protocol-comparison")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["available"] is False


async def test_gap_report_create_list_and_send_to_committee(client):
    create_resp = await client.post("/api/sop-gap-reports", json={
        "question": "What is the protocol for managing heat stroke in the emergency department?",
        "no_match_reason": "No internal SOP covers heat stroke management.",
        "risk_level": "high",
        "affected_department": "Emergency",
        "recommended_committee": "Emergency Medicine Committee",
    })
    assert create_resp.status_code == 200, create_resp.text
    report = create_resp.json()
    assert report["status"] == "open"

    list_resp = await client.get("/api/sop-gap-reports")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 1

    send_resp = await client.post(f"/api/sop-gap-reports/{report['id']}/send-to-committee")
    assert send_resp.status_code == 200, send_resp.text
    assert send_resp.json()["status"] == "sent_to_committee"


async def test_send_gap_report_404_for_unknown_id(client):
    resp = await client.post("/api/sop-gap-reports/99999/send-to-committee")
    assert resp.status_code == 404


async def test_gap_report_summary_clusters_similar_questions(client):
    for q in [
        "What is the protocol for managing heat stroke in the emergency department?",
        "What is the emergency department protocol for heat stroke management?",
        "How do we handle cold exposure in the ICU?",
    ]:
        await client.post("/api/sop-gap-reports", json={
            "question": q, "affected_department": "Emergency",
            "recommended_committee": "Emergency Medicine Committee", "risk_level": "high",
        })

    resp = await client.get("/api/sop-gap-reports/summary")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total_reports"] == 3
    # The two heat-stroke phrasings should cluster together; cold exposure is separate.
    counts = sorted(c["count"] for c in data["clusters"])
    assert counts == [1, 2]
    top_cluster = data["clusters"][0]
    assert top_cluster["count"] == 2
    assert top_cluster["most_common_department"] == "Emergency"


async def test_activity_endpoint_rejects_unknown_action(client):
    resp = await client.post("/api/activity", json={"action": "something_made_up"})
    assert resp.status_code == 200
    assert resp.json()["logged"] is False


async def test_activity_endpoint_accepts_allowed_action(client):
    resp = await client.post("/api/activity", json={"action": "answer_flagged", "details": "test"})
    assert resp.status_code == 200
    assert resp.json()["logged"] is True
