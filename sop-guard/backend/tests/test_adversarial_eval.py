"""
Tests for the /api/evaluate/adversarial endpoint.

Guards against the verifier regressing into a "flags everything" detector:
sensitivity alone is a meaningless headline metric (a verifier with zero
discriminative power still scores 100% sensitivity), so these tests assert
on specificity and pairwise separation too.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.models.models import StaffUser
from app.services.auth import get_current_user


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_adv.db'}"
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

    # /api/evaluate/adversarial is nav-gated to system_admin (Phase T2) -
    # fixed-identity override, since this suite is about verifier metrics,
    # not auth.
    async def _override_current_user() -> StaffUser:
        return StaffUser(
            id=1, staff_id="test-admin", name="Test Admin", role="system_admin",
            department="Test", title="Test", password_hash="",
        )

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    fastapi_app.dependency_overrides[get_current_user] = _override_current_user
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.pop(get_db, None)
    fastapi_app.dependency_overrides.pop(get_current_user, None)
    await engine.dispose()


async def test_adversarial_eval_reports_sensitivity_and_specificity(client):
    resp = await client.post("/api/evaluate/adversarial")
    assert resp.status_code == 200
    data = resp.json()

    for key in ("sensitivity", "specificity", "pairwise_separation",
                "mean_adversarial_score", "mean_correct_score", "disclaimer"):
        assert key in data, f"missing key: {key}"

    # Sensitivity: the verifier should still catch the large majority of
    # adversarial (wrong) answers.
    assert data["sensitivity"] >= 0.8

    # Specificity: correct answers must not be flagged anywhere near as
    # often as wrong ones - this is the metric that "detection_rate" alone
    # used to hide entirely (it was possible to score 100% sensitivity with
    # 0% specificity, i.e. a verifier that flags every answer regardless of
    # correctness). A real regression back to that state should fail this.
    assert data["specificity"] >= 0.3

    # Pairwise separation: across paired (correct, adversarial) answers for
    # the same question, the correct answer's score should usually beat the
    # adversarial one. 0.5 would mean no discriminative power at all.
    assert data["pairwise_separation"] >= 0.6

    assert data["mean_correct_score"] > data["mean_adversarial_score"]


async def test_adversarial_eval_per_result_shape(client):
    resp = await client.post("/api/evaluate/adversarial")
    data = resp.json()
    assert data["total_tests"] == len(data["results"])
    for r in data["results"]:
        assert "correct_answer_passed" in r
        assert "caught" in r
        assert r["adversarial_status"] in ("passed", "warning", "failed")
        assert r["correct_status"] in ("passed", "warning", "failed")


async def test_adversarial_eval_with_generated_cases_scales_the_benchmark(client):
    """
    The 17 hand-written cases alone can't support a percentage claim - one
    flipped case moves the rate by ~6 points. include_generated=true should
    pull in the programmatic perturbation benchmark and report per-type
    breakdown so the numbers are backed by something more substantial.
    """
    resp = await client.post("/api/evaluate/adversarial?include_generated=true")
    assert resp.status_code == 200
    data = resp.json()

    assert data["generated_cases_included"] is True
    assert data["total_tests"] >= 80, "expected the generated perturbation cases to be included"

    assert "by_violation_type" in data
    for vt in ("threshold", "sequence", "contraindication"):
        assert vt in data["by_violation_type"]
        bucket = data["by_violation_type"][vt]
        assert bucket["n"] > 0
        assert 0.0 <= bucket["sensitivity"] <= 1.0
        assert 0.0 <= bucket["specificity"] <= 1.0

    # Sanity: the larger benchmark shouldn't collapse the verifier's overall
    # discriminative power relative to the smaller hand-written-only set.
    assert data["pairwise_separation"] >= 0.7


async def test_adversarial_eval_compare_nli(client):
    """
    compare_nli=true should run the second, independently-implemented
    NLIVerifier over the same cases and report both sets of metrics side
    by side, without changing the primary rule-based numbers.
    """
    resp = await client.post("/api/evaluate/adversarial?include_generated=true&compare_nli=true")
    assert resp.status_code == 200
    data = resp.json()

    assert "verifier_comparison" in data
    comparison = data["verifier_comparison"]
    for key in ("rule_based", "nli_lite", "ensemble", "note"):
        assert key in comparison

    for metrics in (comparison["rule_based"], comparison["nli_lite"], comparison["ensemble"]):
        for key in ("sensitivity", "specificity", "pairwise_separation"):
            assert 0.0 <= metrics[key] <= 1.0

    # rule_based in the comparison block must match the primary top-level
    # numbers - compare_nli should be additive, not change the main result.
    assert comparison["rule_based"]["sensitivity"] == data["sensitivity"]
    assert comparison["rule_based"]["specificity"] == data["specificity"]

    # The ensemble's whole reason to exist is a better sensitivity/
    # specificity balance than rule_based alone (its specificity problem)
    # without collapsing sensitivity.
    assert comparison["ensemble"]["specificity"] > comparison["rule_based"]["specificity"]
    assert comparison["ensemble"]["sensitivity"] > 0.7
