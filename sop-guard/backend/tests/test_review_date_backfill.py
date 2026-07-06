"""
Tests for review_date backfill on pre-existing demo SOP rows.

review_date was added to the SOP model after this project's databases
already had demo SOPs loaded. The ALTER TABLE migration adds the column
with an empty default, but the SOP-count-based demo seed (which sets
review_date for freshly-created rows) is skipped whenever the DB is
non-empty - so already-populated databases needed a separate backfill
path, or every existing dev database would silently show no review
dates on the expiry page.
"""

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.database.db import Base
from app.models.models import SOP
from app.main import _backfill_review_dates
from app.demo_data.demo_sops import DEMO_SOPS


@pytest.fixture
async def session(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_backfill.db'}"
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    await engine.dispose()


async def test_backfill_sets_review_date_on_matching_existing_rows(session):
    demo_sop = DEMO_SOPS[0]
    sop = SOP(sop_id=demo_sop["sop_id"], title=demo_sop["title"], review_date="")
    session.add(sop)
    await session.commit()

    await _backfill_review_dates(session)

    refreshed = (await session.execute(
        SOP.__table__.select().where(SOP.sop_id == demo_sop["sop_id"])
    )).mappings().first()
    assert refreshed["review_date"] == demo_sop["review_date"]


async def test_backfill_does_not_overwrite_existing_review_date(session):
    demo_sop = DEMO_SOPS[0]
    sop = SOP(sop_id=demo_sop["sop_id"], title=demo_sop["title"], review_date="2099-01-01")
    session.add(sop)
    await session.commit()

    await _backfill_review_dates(session)

    refreshed = (await session.execute(
        SOP.__table__.select().where(SOP.sop_id == demo_sop["sop_id"])
    )).mappings().first()
    assert refreshed["review_date"] == "2099-01-01"


async def test_backfill_ignores_non_demo_sop_ids(session):
    sop = SOP(sop_id="SOP-CUSTOM-999", title="Custom uploaded SOP", review_date="")
    session.add(sop)
    await session.commit()

    await _backfill_review_dates(session)

    refreshed = (await session.execute(
        SOP.__table__.select().where(SOP.sop_id == "SOP-CUSTOM-999")
    )).mappings().first()
    assert refreshed["review_date"] == ""
