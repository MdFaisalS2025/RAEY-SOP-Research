"""
SOP-Guard SQLAlchemy Models
---------------------------
Research prototype  - NOT for clinical use.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON, Boolean, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum

from app.database.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SOPStatus(str, enum.Enum):
    active = "active"
    draft = "draft"
    archived = "archived"


class UpdateStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class SOP(Base):
    __tablename__ = "sops"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sop_id = Column(String(64), unique=True, nullable=False, index=True)
    title = Column(String(512), nullable=False)
    department = Column(String(128), default="General")
    version = Column(String(32), default="1.0")
    effective_date = Column(String(32), default="")
    review_date = Column(String(32), default="")  # ISO date (YYYY-MM-DD); next scheduled review/expiry
    status = Column(String(16), default=SOPStatus.active.value)
    raw_text = Column(Text, default="")
    structured_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    chunks = relationship("SOPChunk", back_populates="sop", cascade="all, delete-orphan")
    updates = relationship("SOPUpdate", back_populates="sop", cascade="all, delete-orphan")


class SOPChunk(Base):
    __tablename__ = "sop_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sop_id = Column(Integer, ForeignKey("sops.id", ondelete="CASCADE"), nullable=False)
    section_title = Column(String(256), default="")
    chunk_text = Column(Text, nullable=False)
    chunk_type = Column(String(32), default="section")
    chunk_index = Column(Integer, default=0)
    embedding_id = Column(String(128), default="")

    sop = relationship("SOP", back_populates="chunks")


class Query(Base):
    __tablename__ = "queries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query_text = Column(Text, nullable=False)
    query_type = Column(String(64), default="general")
    user_role = Column(String(64), default="")
    department = Column(String(128), default="")
    answer_text = Column(Text, default="")
    confidence_score = Column(Float, default=0.0)
    verification_status = Column(String(32), default="")
    created_at = Column(DateTime, default=_utcnow)

    feedbacks = relationship("Feedback", back_populates="query", cascade="all, delete-orphan")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query_id = Column(Integer, ForeignKey("queries.id", ondelete="CASCADE"), nullable=False)
    feedback_type = Column(String(32), nullable=False)  # positive / negative / correction
    feedback_text = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)

    query = relationship("Query", back_populates="feedbacks")


class SOPUpdate(Base):
    __tablename__ = "sop_updates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sop_id = Column(Integer, ForeignKey("sops.id", ondelete="CASCADE"), nullable=False)
    section = Column(String(256), default="")
    old_text = Column(Text, default="")
    new_text = Column(Text, default="")
    reason = Column(Text, default="")
    proposed_by = Column(String(128), default="")
    status = Column(String(16), default=UpdateStatus.draft.value)
    created_at = Column(DateTime, default=_utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    sop = relationship("SOP", back_populates="updates")


# ── Governance & audit models ──────────────────────────────────


class ProposalRecord(Base):
    """A proposed change to an SOP, subject to a governance vote."""
    __tablename__ = "proposal_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(512), nullable=False)
    affected_sop_id = Column(String(64), default="")
    department = Column(String(128), default="")
    status = Column(String(32), default="open")  # open | approved | rejected | withdrawn
    priority = Column(String(32), default="normal")  # low | normal | high | urgent
    initiated_by = Column(String(128), default="")
    created_at = Column(DateTime, default=_utcnow)
    ai_summary = Column(Text, default="")
    legal_review_required = Column(String(8), default="false")  # stored as "true"/"false"
    payload = Column(JSON, default=dict)  # free-form rest of the proposal

    votes = relationship(
        "VoteRecord", back_populates="proposal", cascade="all, delete-orphan"
    )


class VoteRecord(Base):
    """A single committee vote on a proposal."""
    __tablename__ = "vote_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    proposal_id = Column(
        Integer, ForeignKey("proposal_records.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(String(128), default="")
    user_name = Column(String(256), default="")
    vote = Column(String(32), nullable=False)  # approve | reject | abstain | request_changes
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)

    proposal = relationship("ProposalRecord", back_populates="votes")


class AttestationRecord(Base):
    """A legally binding attestation that a user has read/accepted an SOP version."""
    __tablename__ = "attestation_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sop_id = Column(String(64), default="")
    sop_version = Column(String(32), default="")
    user_id = Column(String(128), default="")
    user_name = Column(String(256), default="")
    user_role = Column(String(64), default="")
    department = Column(String(128), default="")
    attested_at = Column(DateTime, default=_utcnow)
    ip_address = Column(String(64), default="")
    legal_text = Column(Text, default="")


class AcknowledgmentRecord(Base):
    """A lightweight acknowledgment that a user has seen an SOP."""
    __tablename__ = "acknowledgment_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sop_id = Column(String(64), default="")
    user_id = Column(String(128), default="")
    user_name = Column(String(256), default="")
    acknowledged_at = Column(DateTime, default=_utcnow)


class QueryLogRecord(Base):
    """Audit trail of AI usage: one row per answered query."""
    __tablename__ = "query_log_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query_text = Column(Text, default="")
    answer_text = Column(Text, default="")
    query_type = Column(String(64), default="general")
    generation_mode = Column(String(32), default="")
    confidence = Column(Float, default=0.0)
    faithfulness_score = Column(Float, default=0.0)
    citation_count = Column(Integer, default=0)
    abstained = Column(String(8), default="false")  # stored as "true"/"false"
    news2_score = Column(Integer, nullable=True)
    user_id = Column(String(128), default="")
    citations_json = Column(JSON, default=list)
    created_at = Column(DateTime, default=_utcnow)


# ── Chat models ────────────────────────────────────────────────


class ChatSessionRecord(Base):
    """A multi-turn conversational chat session."""
    __tablename__ = "chat_session_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(512), default="")
    created_at = Column(DateTime, default=_utcnow)

    messages = relationship(
        "ChatMessageRecord", back_populates="session", cascade="all, delete-orphan"
    )


class ChatMessageRecord(Base):
    """A single message within a chat session."""
    __tablename__ = "chat_message_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        Integer, ForeignKey("chat_session_records.id", ondelete="CASCADE"), nullable=False
    )
    role = Column(String(16), nullable=False)  # 'user' | 'assistant'
    content = Column(Text, default="")
    citations = Column(JSON, default=list)
    created_at = Column(DateTime, default=_utcnow)

    session = relationship("ChatSessionRecord", back_populates="messages")


# ── Notifications ──────────────────────────────────────────────


class NotificationRecord(Base):
    """A real-event notification for the UI."""
    __tablename__ = "notification_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(64), default="info")
    title = Column(String(512), default="")
    description = Column(Text, default="")
    priority = Column(String(32), default="normal")  # low | normal | high | critical
    tier = Column(String(16), default="passive")  # passive | banner | interruptive
    read = Column(Boolean, default=False)
    link = Column(String(512), default="")
    created_at = Column(DateTime, default=_utcnow)


# ── Override capture ───────────────────────────────────────────


class OverrideRecord(Base):
    """Captures why a clinician dismissed a conflict warning or overrode an AI answer.

    Supports FDA non-device CDS 'independent review' documentation.
    """
    __tablename__ = "override_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    context_type = Column(String(32), default="conflict")  # conflict | answer | cds_card
    context_id = Column(String(128), default="")
    context_label = Column(String(512), default="")  # human-readable text (e.g. the query), for stewardship review
    user_id = Column(String(128), default="")
    user_name = Column(String(256), default="")
    reason = Column(String(32), default="other")  # will_monitor | not_applicable | disagree_with_sop | other
    note = Column(Text, default="")
    created_at = Column(DateTime, default=_utcnow)


# ── CME / CPD credit tracking ───────────────────────────────────


class CreditRecord(Base):
    """A single CME/CPD credit-earning activity for the habit loop."""
    __tablename__ = "credit_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), default="")
    user_name = Column(String(256), default="")
    activity_type = Column(String(32), default="scenario_completed")  # scenario_completed | sop_reviewed | committee_participation
    activity_title = Column(String(512), default="")
    credits = Column(Float, default=0.0)
    created_at = Column(DateTime, default=_utcnow)
