"""
SOP-Guard Pydantic Schemas
--------------------------
Research prototype  - NOT for clinical use.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


# ── Enums ──────────────────────────────────────────────────────

class VerificationStatus(str, Enum):
    passed = "passed"
    warning = "warning"
    failed = "failed"


class QueryType(str, Enum):
    threshold = "threshold"
    sequence = "sequence"
    contraindication = "contraindication"
    general = "general"


# ── Verification ───────────────────────────────────────────────

class CheckResult(BaseModel):
    check_type: str
    status: str  # pass / fail / warning
    detail: str
    source_reference: str = ""


class VerificationResult(BaseModel):
    status: VerificationStatus
    overall_score: float = Field(ge=0.0, le=1.0)
    threshold_checks: list[CheckResult] = []
    sequence_checks: list[CheckResult] = []
    contraindication_checks: list[CheckResult] = []
    safe_to_display: bool = True
    explanation: str = ""


# ── Query ──────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str
    user_role: Optional[str] = "nurse"
    department: Optional[str] = ""
    news2_score: Optional[int] = None
    use_hyde: bool = False


class RetrievedChunk(BaseModel):
    chunk_text: str
    section_title: str = ""
    sop_title: str = ""
    sop_id: str = ""
    relevance_score: float = 0.0


class QueryResponse(BaseModel):
    answer: str
    citations: list[str] = []
    confidence: float = 0.0
    verification_result: Optional[VerificationResult] = None
    retrieved_chunks: list[RetrievedChunk] = []
    reasoning_trace: list[str] = []
    query_type: str = "general"
    faithfulness: Optional[dict] = None
    sop_conflicts: list[dict] = []
    inline_citations: list[dict] = []
    followup_questions: list[str] = []
    abstained: bool = False
    answer_id: Optional[int] = None


# ── SOP ────────────────────────────────────────────────────────

class SOPResponse(BaseModel):
    id: int
    sop_id: str
    title: str
    department: str = ""
    version: str = "1.0"
    effective_date: str = ""
    status: str = "active"
    structured_json: dict = {}
    chunk_count: int = 0
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class SOPDetailResponse(SOPResponse):
    raw_text: str = ""
    chunks: list[RetrievedChunk] = []


class SOPListResponse(BaseModel):
    sops: list[SOPResponse]
    total: int


class SOPUploadResponse(BaseModel):
    sop_id: str
    title: str
    chunk_count: int
    message: str


# ── SOP Update ─────────────────────────────────────────────────

class SOPUpdateRequest(BaseModel):
    section: str
    old_text: str = ""
    new_text: str
    reason: str = ""
    proposed_by: str = ""


class SOPUpdateResponse(BaseModel):
    id: int
    sop_id: int
    section: str
    old_text: str
    new_text: str
    reason: str
    proposed_by: str
    status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Feedback ───────────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    query_id: int
    feedback_type: str  # positive / negative / correction
    feedback_text: str = ""


class FeedbackResponse(BaseModel):
    id: int
    message: str


# ── Analytics ──────────────────────────────────────────────────

class AnalyticsResponse(BaseModel):
    total_queries: int = 0
    queries_by_type: dict[str, int] = {}
    feedback_counts: dict[str, int] = {}
    verification_stats: dict[str, int] = {}
    most_queried_departments: dict[str, int] = {}
    avg_confidence: float = 0.0


# ── Voice ──────────────────────────────────────────────────────

class TranscriptionResponse(BaseModel):
    text: str
    duration_seconds: float = 0.0
    mode: str = "mock"


# ── Evaluation ─────────────────────────────────────────────────

class EvaluationResult(BaseModel):
    total_cases: int = 0
    retrieval_precision: float = 0.0
    answer_accuracy: float = 0.0
    verification_detection_rate: float = 0.0
    details: list[dict] = []
    timestamp: Optional[datetime] = None


# ── Governance ─────────────────────────────────────────────────

class ProposalCreate(BaseModel):
    title: str
    affected_sop_id: str = ""
    department: str = ""
    priority: str = "normal"
    initiated_by: str = ""
    ai_summary: str = ""
    legal_review_required: bool = False
    payload: dict = {}


class ProposalResponse(BaseModel):
    id: int
    title: str
    affected_sop_id: str = ""
    department: str = ""
    status: str = "open"
    priority: str = "normal"
    initiated_by: str = ""
    ai_summary: str = ""
    legal_review_required: bool = False
    payload: dict = {}
    created_at: Optional[datetime] = None
    tally: dict = {}
    quorum: dict = {}
    votes: list[dict] = []


class VoteCreate(BaseModel):
    user_id: str = ""
    user_name: str = ""
    vote: str  # approve | reject | abstain | request_changes
    notes: str = ""


class AttestationCreate(BaseModel):
    sop_id: str
    sop_version: str = ""
    user_id: str = ""
    user_name: str = ""
    user_role: str = ""
    department: str = ""
    legal_text: str = ""


class AttestationResponse(BaseModel):
    id: int
    sop_id: str
    sop_version: str = ""
    user_id: str = ""
    user_name: str = ""
    user_role: str = ""
    department: str = ""
    ip_address: str = ""
    legal_text: str = ""
    attested_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AcknowledgmentCreate(BaseModel):
    sop_id: str
    user_id: str = ""
    user_name: str = ""


class AcknowledgmentResponse(BaseModel):
    id: int
    sop_id: str
    user_id: str = ""
    user_name: str = ""
    acknowledged_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Overrides ──────────────────────────────────────────────────

class OverrideCreate(BaseModel):
    context_type: str  # conflict | answer | cds_card
    context_id: str = ""
    context_label: str = ""
    user_id: str = ""
    user_name: str = ""
    reason: str = "other"  # will_monitor | not_applicable | disagree_with_sop | other
    note: str = ""


class OverrideResponse(BaseModel):
    id: int
    context_type: str
    context_id: str = ""
    context_label: str = ""
    user_id: str = ""
    user_name: str = ""
    reason: str = "other"
    note: str = ""
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Credits ────────────────────────────────────────────────────

class CreditCreate(BaseModel):
    user_id: str = ""
    user_name: str = ""
    activity_type: str  # scenario_completed | sop_reviewed | committee_participation
    activity_title: str = ""
    credits: float = 0.0


class CreditResponse(BaseModel):
    id: int
    user_id: str = ""
    user_name: str = ""
    activity_type: str
    activity_title: str = ""
    credits: float = 0.0
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
