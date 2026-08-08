"""
Meridian Database Setup
Supports PostgreSQL (production) and SQLite (development).
Research prototype. Not for clinical use.
"""

import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

from app.config import settings

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _resolve_database_url(url: str) -> str:
    """
    Anchor a relative sqlite path to the backend project root, independent of
    the process's current working directory. Without this, "./meridian.db"
    resolves to a different file depending on whether the process was
    started from the backend directory or the repo root (uvicorn via the
    launch config uses the repo root as cwd), which previously caused two
    meridian.db files to silently diverge into different demo states.
    """
    prefix = "sqlite+aiosqlite:///./"
    if url.startswith(prefix):
        db_filename = url[len(prefix):]
        abs_path = os.path.join(_BACKEND_ROOT, db_filename).replace("\\", "/")
        return f"sqlite+aiosqlite:///{abs_path}"
    return url


def _build_engine():
    url = _resolve_database_url(settings.DATABASE_URL)
    connect_args = {}

    if "sqlite" in url:
        connect_args = {"check_same_thread": False}

    return create_async_engine(
        url,
        echo=settings.DEBUG,
        connect_args=connect_args,
        pool_pre_ping=True,  # Production: detect stale connections
    )


engine = _build_engine()
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Create all tables."""
    async with engine.begin() as conn:
        from app.models.models import (  # noqa: F401
            SOP, SOPChunk, Query, Feedback, SOPUpdate,
            ProposalRecord, VoteRecord, AttestationRecord,
            AcknowledgmentRecord, QueryLogRecord,
            ChatSessionRecord, ChatMessageRecord, NotificationRecord, NotificationReadRecord,
            OverrideRecord, CreditRecord,
            IncidentRecord, CAPARecord, ExceptionRecord,
            SOPVersionRecord, SOPGapReportRecord,
            EvalSnapshotRecord, StaffUser,
        )
        await conn.run_sync(Base.metadata.create_all)

    # Lightweight migration: add columns introduced after the table existed.
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE query_log_records ADD COLUMN citations_json JSON"
            ))
    except Exception:
        pass  # Column already exists (or backend handles it via create_all)

    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE notification_records ADD COLUMN tier VARCHAR(16) DEFAULT 'passive'"
            ))
    except Exception:
        pass  # Column already exists (or backend handles it via create_all)

    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE override_records ADD COLUMN context_label VARCHAR(512) DEFAULT ''"
            ))
    except Exception:
        pass  # Column already exists (or backend handles it via create_all)

    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE sops ADD COLUMN review_date VARCHAR(32) DEFAULT ''"
            ))
    except Exception:
        pass  # Column already exists (or backend handles it via create_all)

    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE proposal_records ADD COLUMN scheduled_effective_date VARCHAR(32) DEFAULT ''"
            ))
    except Exception:
        pass  # Column already exists (or backend handles it via create_all)

    for ddl in (
        "ALTER TABLE attestation_records ADD COLUMN signature_meaning TEXT DEFAULT ''",
        "ALTER TABLE attestation_records ADD COLUMN second_factor_confirmation VARCHAR(256) DEFAULT ''",
        "ALTER TABLE attestation_records ADD COLUMN content_hash VARCHAR(64) DEFAULT ''",
        "ALTER TABLE attestation_records ADD COLUMN prev_hash VARCHAR(64) DEFAULT ''",
        "ALTER TABLE query_log_records ADD COLUMN route VARCHAR(32) DEFAULT 'sop_library'",
        "ALTER TABLE feedbacks ADD COLUMN answer_id INTEGER",
        "ALTER TABLE feedbacks ADD COLUMN status VARCHAR(16) DEFAULT 'new'",
        # These three were added to the QueryLogRecord model by Phase E
        # (token usage logging) but never got a matching migration here -
        # every query's audit-log INSERT against a pre-existing dev DB has
        # been silently failing since (caught and logged as a warning),
        # meaning no QueryLogRecord row - and no real answer_id - ever got
        # created. Found while verifying the new feedback flow, which
        # depends on a real answer_id existing.
        "ALTER TABLE query_log_records ADD COLUMN prompt_tokens INTEGER",
        "ALTER TABLE query_log_records ADD COLUMN completion_tokens INTEGER",
        "ALTER TABLE query_log_records ADD COLUMN total_tokens INTEGER",
        # Non-lossy chat reload (N-B.9): without this, restoring a chat
        # session after a page reload had to fall back to blank defaults
        # for route/generation_mode/confidence_tier/followup_questions/
        # verification_result, silently dropping the Version History link,
        # generation-mode tag, follow-up chips and Trust panel contents.
        "ALTER TABLE chat_message_records ADD COLUMN extra JSON",
        # Citation deep-linking (Phase P3): exact character offsets into
        # the SOP's raw_text, so clicking a citation can open the SOP at
        # the precise line instead of a view-time text match against the
        # wrong paragraph. NULL-able, no default - see models.py.
        "ALTER TABLE sop_chunks ADD COLUMN char_start INTEGER",
        "ALTER TABLE sop_chunks ADD COLUMN char_end INTEGER",
        "ALTER TABLE sop_chunks ADD COLUMN offset_source VARCHAR(24) DEFAULT ''",
        # Phase Q2.1: the offset sanity check used to compare stored offsets
        # against the citation's display snippet, which is title-prefixed
        # for section chunks - so it rejected every correct section offset.
        # offset_anchor is a verbatim, un-prefixed slice of raw_text at the
        # stored span, purpose-built for that check. NULL-able, no default -
        # see models.py.
        "ALTER TABLE sop_chunks ADD COLUMN offset_anchor TEXT",
        # Chat session ownership: without this, any authenticated user could
        # list, open, or delete any other user's conversation (no user_id
        # column existed to check against at all). NULL-able, no default -
        # see models.py and routes_chat.py's NULL-is-legacy handling.
        "ALTER TABLE chat_session_records ADD COLUMN user_id INTEGER",
    ):
        try:
            from sqlalchemy import text
            async with engine.begin() as conn:
                await conn.execute(text(ddl))
        except Exception:
            pass  # Column already exists (or backend handles it via create_all)
