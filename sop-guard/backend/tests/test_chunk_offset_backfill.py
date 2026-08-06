"""
Tests for _backfill_chunk_offsets on pre-existing SOPChunk rows (Phase P3.4,
extended in Q2.1/Q2.2).

Two things this guards against, both real bugs caught during Q2.2's live
verification:

1. The obvious case: char_start/char_end/offset_source/offset_anchor were
   added by ALTER TABLE with no value, so already-populated databases need
   a backfill path or citation deep-linking silently shows "not located"
   forever on any pre-existing dev database.

2. The matching-key regression: the backfill matches persisted rows against
   freshly recomputed chunks by a tuple key. Phase Q2.2 changed step chunks'
   section_title from a hardcoded constant ("Procedure Steps") to the raw
   text's own enclosing section heading - so a persisted row's section_title
   and the recomputed chunk's section_title now legitimately differ for
   exactly the rows this backfill exists to fix. Keying on section_title
   (the original implementation) made every such row fail to match and
   silently stay unbackfilled forever, which is exactly what happened when
   this was manually verified against the live dev database.
"""

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.models.models  # noqa: F401 - register models on Base
from app.database.db import Base
from app.models.models import SOP, SOPChunk
from app.main import _backfill_chunk_offsets
from app.rag.chunker import create_sop_chunks, _create_summary

RAW_TEXT = """SEPSIS MANAGEMENT PROTOCOL

1. PURPOSE
This protocol establishes management of sepsis.

4. PROCEDURE
Step 1: Screen for sepsis using qSOFA (altered mentation, systolic BP <=100 mmHg, respiratory rate >=22/min). If qSOFA >=2, proceed to full SOFA assessment.
Step 2: Obtain blood cultures before antibiotics.
"""

STRUCTURED_JSON = {
    "steps": [
        {"step_number": 1, "text": "Screen with qSOFA (altered mentation, SBP <=100, RR >=22). If qSOFA >=2, perform full SOFA assessment."},
        {"step_number": 2, "text": "Obtain blood cultures before antibiotics."},
    ],
}


@pytest.fixture
async def session(tmp_path):
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_offset_backfill.db'}"
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    await engine.dispose()


async def _seed_sop_with_unbackfilled_step_chunk(session, *, persisted_section_title: str) -> int:
    """Insert an SOP plus one step chunk row shaped like a pre-Q2.2 database:
    offsets/anchor unset, and section_title whatever it was persisted as
    (the old hardcoded "Procedure Steps" constant, to reproduce the
    matching-key regression)."""
    sop = SOP(
        sop_id="SOP-TEST-BACKFILL", title="Sepsis Management Protocol",
        department="ICU", version="1.0", raw_text=RAW_TEXT, structured_json=STRUCTURED_JSON,
    )
    session.add(sop)
    await session.commit()

    chunk_text = "Step 1: Screen with qSOFA (altered mentation, SBP <=100, RR >=22). If qSOFA >=2, perform full SOFA assessment."
    chunk = SOPChunk(
        sop_id=sop.id, section_title=persisted_section_title, chunk_text=chunk_text,
        chunk_type="step", chunk_index=0,
        char_start=None, char_end=None, offset_source="", offset_anchor=None,
    )
    session.add(chunk)
    await session.commit()
    return sop.id


async def test_backfill_locates_step_chunk_offsets_on_matching_section_title(session):
    """Baseline: when the persisted section_title already matches what
    create_sop_chunks recomputes, the backfill must fill in offsets."""
    await _seed_sop_with_unbackfilled_step_chunk(session, persisted_section_title="4. PROCEDURE")

    await _backfill_chunk_offsets(session)

    row = (await session.execute(
        SOPChunk.__table__.select().where(SOPChunk.chunk_type == "step")
    )).mappings().first()
    assert row["char_start"] is not None
    assert row["offset_source"] == "step_anchor"
    assert row["offset_anchor"] != ""
    assert RAW_TEXT.startswith(row["offset_anchor"], row["char_start"])


async def test_backfill_survives_a_section_title_change(session):
    """Regression guard: the persisted row carries the OLD hardcoded
    section_title ("Procedure Steps"), which no longer matches what
    create_sop_chunks recomputes for this raw_text ("4. PROCEDURE") after
    Q2.2. The backfill must still find and fill this row - keying the
    match on section_title (the original implementation) would silently
    skip it forever."""
    await _seed_sop_with_unbackfilled_step_chunk(session, persisted_section_title="Procedure Steps")

    await _backfill_chunk_offsets(session)

    row = (await session.execute(
        SOPChunk.__table__.select().where(SOPChunk.chunk_type == "step")
    )).mappings().first()
    assert row["char_start"] is not None, "backfill must not silently skip a row whose section_title changed"
    assert row["offset_source"] == "step_anchor"
    # The stale section_title should also be refreshed to the real
    # enclosing heading - otherwise the citation panel's header would
    # still show the wrong section even with a correct highlight.
    assert row["section_title"] == "4. PROCEDURE"


async def test_backfill_is_idempotent(session):
    """A second run over already-backfilled rows must not error or
    change anything (offset_source is no longer "" and offset_anchor is
    no longer NULL, so the row drops out of the candidate set)."""
    await _seed_sop_with_unbackfilled_step_chunk(session, persisted_section_title="Procedure Steps")
    await _backfill_chunk_offsets(session)

    first_pass = (await session.execute(
        SOPChunk.__table__.select().where(SOPChunk.chunk_type == "step")
    )).mappings().first()

    await _backfill_chunk_offsets(session)

    second_pass = (await session.execute(
        SOPChunk.__table__.select().where(SOPChunk.chunk_type == "step")
    )).mappings().first()
    assert second_pass["char_start"] == first_pass["char_start"]
    assert second_pass["offset_anchor"] == first_pass["offset_anchor"]


async def test_backfill_records_empty_anchor_for_genuinely_unlocatable_chunks(session):
    """A chunk type that never gets offsets (e.g. summary, always "")
    should have its offset_anchor set to "" rather than left NULL - so
    it stops being rescanned by every future backfill run, without being
    confused with "not yet processed"."""
    sop = SOP(
        sop_id="SOP-TEST-NOOFFSET", title="Sepsis Management Protocol",
        department="ICU", version="1.0", raw_text=RAW_TEXT, structured_json=STRUCTURED_JSON,
    )
    session.add(sop)
    await session.commit()

    # Must match what create_sop_chunks' recomputation actually produces
    # for the "summary" chunk_type, or the backfill's by_key lookup finds
    # no match at all and never reaches the offset_anchor-defaulting branch
    # this test targets.
    summary_text = _create_summary(RAW_TEXT, "Sepsis Management Protocol", "ICU")
    chunk = SOPChunk(
        sop_id=sop.id, section_title="Summary", chunk_text=summary_text,
        chunk_type="summary", chunk_index=0,
        char_start=None, char_end=None, offset_source="", offset_anchor=None,
    )
    session.add(chunk)
    await session.commit()

    await _backfill_chunk_offsets(session)

    row = (await session.execute(
        SOPChunk.__table__.select().where(SOPChunk.chunk_type == "summary")
    )).mappings().first()
    assert row["char_start"] is None
    assert row["offset_anchor"] == ""
