"""
SOP-Guard Database Setup
Supports PostgreSQL (production) and SQLite (development).
Research prototype. Not for clinical use.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

from app.config import settings


def _build_engine():
    url = settings.DATABASE_URL
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
            ChatSessionRecord, ChatMessageRecord, NotificationRecord,
            OverrideRecord, CreditRecord,
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
