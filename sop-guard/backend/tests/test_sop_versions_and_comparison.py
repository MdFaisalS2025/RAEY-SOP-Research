"""Tests for SOP version history, protocol comparison, and gap report
routes/services (app/services/sop_comparison.py, app/api/routes_sop_versions.py,
app/api/routes_comparison.py, app/api/routes_gap_reports.py)."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import SOP, SOPVersionRecord, StaffUser
from app.services.auth import get_current_user
from app.services.sop_comparison import (
    compare_sop_to_reference,
    compare_sop_to_dynamic_evidence,
    build_dynamic_reference_items,
    REFERENCE_PROTOCOLS,
    _run_comparison,
)


# ─── Pure comparison-engine tests (no DB/HTTP needed) ──────────────────────

def test_returns_none_for_sop_without_reference_protocol():
    assert compare_sop_to_reference("SOP-DOES-NOT-EXIST", ["step one"]) is None


def test_exact_match_classified_as_match():
    reference_step = REFERENCE_PROTOCOLS["SOP-ICU-001"]["steps"][0]["text"]  # "Screen for suspected sepsis"
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
    result = compare_sop_to_reference("SOP-ICU-001", [s["text"] for s in steps])
    assert result["summary"]["match_count"] == len(steps)
    assert result["summary"]["overall_alignment"] == "Aligned"


@pytest.mark.parametrize("sop_id", ["SOP-ICU-003", "SOP-NEURO-011"])
def test_expanded_curated_fallback_entries_are_well_formed(sop_id):
    reference = REFERENCE_PROTOCOLS[sop_id]
    assert reference["steps"], f"{sop_id} must carry at least one reference step"
    for step in reference["steps"]:
        # Neither new entry's primary source could be fetched directly
        # during verification (see reference_protocols.py's module
        # docstring) - every step must therefore be honestly marked as a
        # paraphrase of a secondary source, never claimed verbatim.
        assert step["fidelity"] == "paraphrase"
        assert step["grade"] in {"Strong", "Moderate", "Limited", "Research Only", "Unknown", "Outdated"}
        assert step["source_locus"]


def test_expanded_curated_fallback_full_coverage_is_aligned():
    for sop_id in ("SOP-ICU-003", "SOP-NEURO-011"):
        steps = REFERENCE_PROTOCOLS[sop_id]["steps"]
        result = compare_sop_to_reference(sop_id, [s["text"] for s in steps])
        assert result["summary"]["match_count"] == len(steps)
        assert result["summary"]["overall_alignment"] == "Aligned"


# ─── Weighted overall_alignment (Q3.5) ──────────────────────────────────────
# Replaces the old boolean cascade (any missing -> Needs Review, any partial
# -> Partially Aligned, else Aligned), which made 8/9 match + 1 missing
# indistinguishable from 0/9 match + 9 missing and required a perfect sweep
# to ever reach "Aligned".

def _items(*grades_and_texts):
    """Build reference_items for _run_comparison directly - grades_and_texts
    is (grade, text) pairs. Uses exact-text internal steps so lexical
    matching (no sim_fn) scores every pair 1.0 (a match), keeping the test
    only about the alignment-score math, not the matcher."""
    return [{"text": t, "grade": g, "source_name": "", "source_type": "", "url": "", "pub_date": ""}
            for g, t in grades_and_texts]


def test_one_low_grade_missing_does_not_force_needs_review():
    """The scenario the boolean cascade couldn't express: 8/9 Strong-grade
    matches plus one Limited-grade miss used to read identically to 0/9
    matching (both "any missing -> Needs Review"). Weighted, a single
    Limited-grade gap barely moves the score (8.0/8.4 = 0.952) and must not
    trigger the same alarm level as a comparison with nothing right."""
    matched_steps = [f"step {i}" for i in range(8)]
    items = _items(*[("Strong", s) for s in matched_steps], ("Limited", "an unrelated low-grade point"))
    result = _run_comparison("SOP-TEST", matched_steps, items, sim_fn=None, mode="dynamic", reference_source=None)
    assert result["summary"]["missing_count"] == 1
    assert result["summary"]["match_count"] == 8
    assert result["summary"]["alignment_score"] == pytest.approx(8 / 8.4, abs=0.01)
    assert result["summary"]["overall_alignment"] == "Aligned"


def test_one_strong_grade_missing_forces_needs_review_regardless_of_ratio():
    """The hard override: even with a high weighted ratio, one Strong-grade
    reference point genuinely missing from the SOP must still surface as
    Needs Review - a good average can't hide a guideline-grade gap."""
    matched_steps = [f"step {i}" for i in range(9)]
    items = _items(*[("Strong", s) for s in matched_steps], ("Strong", "a genuinely missing strong point"))
    result = _run_comparison("SOP-TEST", matched_steps, items, sim_fn=None, mode="dynamic", reference_source=None)
    assert result["summary"]["missing_count"] == 1
    assert result["summary"]["overall_alignment"] == "Needs Review"


def test_zero_of_nine_matching_is_needs_review():
    """0/9 matching must still land on Needs Review - the low end of the
    old cascade's behavior is preserved, just no longer indistinguishable
    from the 8/9 case above."""
    items = _items(*[("Strong", f"reference point {i}") for i in range(9)])
    result = _run_comparison("SOP-TEST", ["a completely unrelated internal step"], items, sim_fn=None, mode="dynamic", reference_source=None)
    assert result["summary"]["match_count"] == 0
    assert result["summary"]["overall_alignment"] == "Needs Review"


def test_summary_tiles_reconcile_to_their_own_denominators():
    """Each side's tile counts must sum exactly to that side's own total -
    the old four-tile layout mixed a reference-side denominator with an
    internal-side one as if they shared one."""
    matched_steps = ["antibiotics within one hour", "measure lactate level"]
    extra_internal = "an SOP step with no reference counterpart at all xyz"
    items = _items(("Strong", "antibiotics within one hour"), ("Strong", "measure lactate level"),
                   ("Strong", "a reference point missing from the sop"))
    result = _run_comparison("SOP-TEST", matched_steps + [extra_internal], items, sim_fn=None, mode="dynamic", reference_source=None)
    summary = result["summary"]
    ref = summary["reference_side"]
    assert ref["match"] + ref["partial"] + ref["missing"] == ref["total"]
    sop = summary["sop_side"]
    assert sop["covered"] + sop["weakly_related"] + sop["sop_only"] == sop["total"]


def test_weakly_related_steps_no_longer_silently_dropped():
    """Regression for the old 0.40-0.50 dead zone: an internal step whose
    best reference-side score sits between the sop_only and partial
    thresholds used to appear in no list and no count at all."""
    # "fluid resuscitation" shares exactly one significant word ("fluid")
    # with "iv fluid bolus protocol" under lexical scoring - containment
    # 1/2 = 0.5, which is >= the lexical sop_only threshold (0.25) and
    # < the partial threshold (0.35)... use a pair calibrated to land in
    # the dead zone specifically for the lexical metric used here (no sim_fn).
    dead_zone_step = "administer fluid resuscitation now"
    items = _items(("Strong", "fluid status"))
    result = _run_comparison("SOP-TEST", [dead_zone_step], items, sim_fn=None, mode="dynamic", reference_source=None)
    sop = result["summary"]["sop_side"]
    accounted_for = sop["covered"] + sop["weakly_related"] + sop["sop_only"]
    assert accounted_for == sop["total"] == 1


def test_sop_only_step_flagged_when_unrelated_to_any_reference_step():
    steps = [s["text"] for s in REFERENCE_PROTOCOLS["SOP-ICU-001"]["steps"]]
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

    # POST /api/activity and the gap-report create/send-to-committee routes
    # now require a session (Phase T2) - fixed-identity override, this
    # suite is about SOP versions/comparison/gap-reports, not auth.
    async def _override_current_user() -> StaffUser:
        return StaffUser(
            id=1, staff_id="test-admin", name="Test Admin", role="system_admin",
            department="Test", title="Test", password_hash="",
        )

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    fastapi_app.dependency_overrides[get_current_user] = _override_current_user
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
    fastapi_app.dependency_overrides.pop(get_current_user, None)
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


async def test_protocol_comparison_endpoint_returns_available_result(client, monkeypatch):
    # Live guideline retrieval is tried first for every SOP (Q3.6), even
    # SOP-ICU-001 which has a stored offline-fallback bundle - disable it
    # here so this test deterministically exercises the curated fallback
    # path rather than depending on whatever a live search happens to find.
    async def fake_no_guideline(sop_id, sop_title, internal_steps, sim_fn=None):
        return None

    import app.api.routes_comparison as routes_comparison
    monkeypatch.setattr(routes_comparison, "compare_sop_to_guideline", fake_no_guideline)

    resp = await client.get("/api/sops/SOP-ICU-001/protocol-comparison")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["available"] is True
    assert data["mode"] == "curated"
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


# ─── internal_steps_from() key-shape regression ─────────────────────────────
# routes_comparison.py and chat_intents.py previously read step.get("action"),
# which only matches the hand-authored demo shape. structure_sop()'s real
# extractor (sop_structurer.py) emits {"step_number", "text"} - so every
# uploaded SOP silently compared against a list of empty strings and always
# came back "Needs Review" regardless of content.

def test_internal_steps_from_handles_action_key():
    from app.services.sop_comparison import internal_steps_from
    assert internal_steps_from({"steps": [{"step": 1, "action": "Measure lactate"}]}) == ["Measure lactate"]


def test_internal_steps_from_handles_text_key():
    from app.services.sop_comparison import internal_steps_from
    assert internal_steps_from({"steps": [{"step_number": 1, "text": "Measure lactate"}]}) == ["Measure lactate"]


def test_internal_steps_from_drops_blank_steps():
    from app.services.sop_comparison import internal_steps_from
    assert internal_steps_from({"steps": [{"step_number": 1, "text": "  "}, {"step_number": 2, "text": "Real step"}]}) == ["Real step"]


def test_internal_steps_from_handles_missing_structured_json():
    from app.services.sop_comparison import internal_steps_from
    assert internal_steps_from(None) == []


async def test_protocol_comparison_endpoint_matches_real_upload_step_shape(client, monkeypatch):
    # SOP-GEN-002's fixture uses the hand-authored {"action": ...} shape.
    # Confirm the {"text": ...} shape structure_sop() actually produces on
    # a real upload also compares correctly, not against empty strings.
    async def fake_search(term, max_results=15):
        return [{
            "title": "Verify two patient identifiers before transfusion",
            "study_type": "Practice Guideline", "trust_tier": None,
            "pub_date_parsed": "2023-01-01", "pub_date": "2023-01-01",
            "source_type": "who", "journal": "", "url": "https://example.com/guideline",
        }]

    async def fake_no_guideline(sop_id, sop_title, internal_steps, sim_fn=None):
        return None

    import app.api.routes_comparison as routes_comparison
    monkeypatch.setattr(routes_comparison, "search_external_evidence", fake_search)
    # This test targets the title-based dynamic fallback specifically -
    # disable the guideline-retrieval path (tried first, see
    # routes_comparison.py) so the assertion below doesn't depend on
    # whatever a live PubMed/Europe PMC search happens to return for
    # "IV Line Insertion Protocol" at test-run time.
    monkeypatch.setattr(routes_comparison, "compare_sop_to_guideline", fake_no_guideline)

    # Insert an SOP whose structured_json uses the real-upload key shape,
    # through the same overridden session the client fixture wired up.
    async for session in fastapi_app.dependency_overrides[get_db]():
        session.add(SOP(
            sop_id="SOP-GEN-003", title="IV Line Insertion Protocol", department="General",
            version="1.0", structured_json={"steps": [
                {"step_number": 1, "text": "Verify two patient identifiers before transfusion"},
            ]},
        ))
        await session.commit()
        break

    resp = await client.get("/api/sops/SOP-GEN-003/protocol-comparison")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["available"] is True
    assert data["rows"][0]["status"] == "match"


# ─── chat_intents.try_comparison_answer() crash regression ─────────────────
# reference_source is None for every SOP except the one curated bundle
# (SOP-ICU-001), and the chat-intent path used to do
# result["reference_source"].get("name", ...) unconditionally - an
# AttributeError on every dynamic-mode comparison reached through chat.

async def test_try_comparison_answer_dynamic_mode_does_not_crash(client, monkeypatch):
    from app.services import chat_intents
    from app.services.chat_intents import try_comparison_answer

    async def fake_search(term, max_results=15):
        return [{
            "title": "Verify two patient identifiers before transfusion",
            "study_type": "Practice Guideline", "trust_tier": None,
            "pub_date_parsed": "2023-01-01", "pub_date": "2023-01-01",
            "source_type": "who", "journal": "", "url": "https://example.com/guideline",
        }]

    # search_external_evidence is imported locally inside try_comparison_answer
    # (from app.integrations.evidence_registry import search_all as
    # search_external_evidence), so it must be patched at its source module -
    # patching the chat_intents module attribute wouldn't be seen.
    import app.integrations.evidence_registry as evidence_registry
    monkeypatch.setattr(evidence_registry, "search_all", fake_search)

    async def fake_no_guideline(sop_id, sop_title, internal_steps, sim_fn=None):
        return None
    # compare_sop_to_guideline is imported locally inside try_comparison_answer
    # (same reason as search_external_evidence above) - patch it at its
    # source module so this test doesn't depend on live network results.
    import app.services.sop_comparison as sop_comparison_mod
    monkeypatch.setattr(sop_comparison_mod, "compare_sop_to_guideline", fake_no_guideline)

    class _FakeRetriever:
        pass

    def fake_identify(retriever, query):
        return ("SOP-GEN-002", "Blood Transfusion Protocol", 0.9)

    monkeypatch.setattr(chat_intents, "_identify_top_sop", fake_identify)

    async for session in fastapi_app.dependency_overrides[get_db]():
        response = await try_comparison_answer(session, _FakeRetriever(), "compare the transfusion SOP with current evidence")
        break

    assert response is not None
    assert "high-grade external source" in response.answer
    assert "Blood Transfusion Protocol" in response.answer


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
