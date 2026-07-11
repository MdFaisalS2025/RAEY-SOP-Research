"""Tests for the Part-11-styled attestation e-signature: second-factor
confirmation, captured signature meaning, and the tamper-evident hash
chain (app/services/signature_chain.py)."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.main import app as fastapi_app
from app.database.db import Base, get_db
from app.services.signature_chain import GENESIS_HASH, compute_content_hash, verify_chain


@pytest.fixture
async def client(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_attest.db'}"
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


def _payload(**overrides):
    base = {
        "sop_id": "SOP-ICU-001", "sop_version": "1.0",
        "user_id": "u1", "user_name": "Jane Doe", "user_role": "clinical_staff",
        "department": "ICU", "legal_text": "I attest I have read this SOP.",
        "signature_meaning": "I have read, understood, and will comply with this SOP.",
        "second_factor_confirmation": "Jane Doe",
    }
    base.update(overrides)
    return base


async def test_attestation_requires_second_factor(client):
    resp = await client.post("/api/governance/attestations", json=_payload(second_factor_confirmation=""))
    assert resp.status_code == 400


async def test_attestation_rejects_mismatched_second_factor(client):
    resp = await client.post("/api/governance/attestations", json=_payload(second_factor_confirmation="Someone Else"))
    assert resp.status_code == 400


async def test_attestation_second_factor_case_insensitive(client):
    resp = await client.post("/api/governance/attestations", json=_payload(
        user_name="Jane Doe", second_factor_confirmation="  jane doe  ",
    ))
    assert resp.status_code == 200


async def test_attestation_captures_meaning_and_hash(client):
    resp = await client.post("/api/governance/attestations", json=_payload())
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["signature_meaning"] == "I have read, understood, and will comply with this SOP."
    assert data["content_hash"] != ""
    assert data["prev_hash"] == GENESIS_HASH


async def test_attestation_chain_links_sequential_records(client):
    first = (await client.post("/api/governance/attestations", json=_payload(user_id="u1", user_name="Jane Doe", second_factor_confirmation="Jane Doe"))).json()
    second = (await client.post("/api/governance/attestations", json=_payload(user_id="u2", user_name="John Smith", second_factor_confirmation="John Smith"))).json()

    assert first["prev_hash"] == GENESIS_HASH
    assert second["prev_hash"] == first["content_hash"]
    assert second["content_hash"] != first["content_hash"]


async def test_verify_chain_intact_after_normal_signing(client):
    for i in range(3):
        await client.post("/api/governance/attestations", json=_payload(
            user_id=f"u{i}", user_name=f"User {i}", second_factor_confirmation=f"User {i}",
        ))
    verified = await client.get("/api/governance/attestations/verify-chain")
    assert verified.status_code == 200
    data = verified.json()
    assert data["intact"] is True
    assert data["checked"] == 3
    assert data["broken_at"] == []


async def test_verify_chain_empty_is_intact(client):
    verified = await client.get("/api/governance/attestations/verify-chain")
    data = verified.json()
    assert data["intact"] is True
    assert data["checked"] == 0


async def test_verify_chain_detects_direct_db_tamper(client):
    """Simulates bypassing the app entirely (a direct DB edit) - there is
    no UPDATE endpoint for attestations, so this can only happen outside
    the app, which is exactly the threat model the chain protects
    against."""
    from sqlalchemy import select, update
    from app.models.models import AttestationRecord

    created = (await client.post("/api/governance/attestations", json=_payload())).json()

    override = fastapi_app.dependency_overrides[get_db]
    async for session in override():
        await session.execute(
            update(AttestationRecord)
            .where(AttestationRecord.id == created["id"])
            .values(user_name="Tampered Name")
        )
        await session.commit()
        break

    verified = await client.get("/api/governance/attestations/verify-chain")
    data = verified.json()
    assert data["intact"] is False
    assert created["id"] in data["broken_at"]


def test_compute_content_hash_deterministic():
    record = {"sop_id": "A", "user_name": "X", "attested_at": "2026-01-01T00:00:00"}
    h1 = compute_content_hash(record, GENESIS_HASH)
    h2 = compute_content_hash(record, GENESIS_HASH)
    assert h1 == h2
    assert len(h1) == 64  # sha256 hex digest


def test_compute_content_hash_changes_with_prev_hash():
    record = {"sop_id": "A"}
    h1 = compute_content_hash(record, GENESIS_HASH)
    h2 = compute_content_hash(record, "a" * 64)
    assert h1 != h2


def test_verify_chain_single_tampered_record_does_not_cascade():
    """A single tampered record should be reported once, not treated as
    breaking every record signed after it (see verify_chain's docstring)."""
    r1 = {"id": 1, "sop_id": "A"}
    r1["content_hash"] = compute_content_hash(r1, GENESIS_HASH)
    r1["prev_hash"] = GENESIS_HASH

    r2 = {"id": 2, "sop_id": "B"}
    r2["prev_hash"] = r1["content_hash"]
    r2["content_hash"] = compute_content_hash(r2, r2["prev_hash"])

    # Tamper r1's field after the fact without recomputing its hash.
    tampered_r1 = dict(r1)
    tampered_r1["sop_id"] = "TAMPERED"

    result = verify_chain([tampered_r1, r2])
    assert result["intact"] is False
    assert result["broken_at"] == [1]
