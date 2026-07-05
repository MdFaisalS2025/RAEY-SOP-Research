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

    fastapi_app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.pop(get_db, None)
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
