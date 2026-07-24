"""
Meridian Pydantic Schemas
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
    entities: dict[str, list[str]] = {}
    # Answer-routing transparency (see agents/routing.py): which source(s)
    # actually grounded this answer, so the UI can render "Sourced from:
    # SOP Library" / "External Literature" / "SOP Library + External
    # Literature" / "No source available" rather than leaving it implicit.
    route: str = "sop_library"  # "sop_library" | "external_evidence" | "hybrid" | "no_evidence" | "clarification"
    external_evidence: list[dict] = []
    # Set when the query is too ambiguous to answer safely (e.g. "what's the
    # max dose?" with no drug named, or top matches split evenly across
    # multiple unrelated SOPs) - the UI shows clarification_question with
    # clarification_options as quick-reply chips instead of a guessed answer.
    needs_clarification: bool = False
    clarification_question: str = ""
    clarification_options: list[str] = []
    # Physician-readable label for the evidence-sufficiency score (High /
    # Moderate / Weak / No Reliable Match - see evidence_sufficiency.py's
    # confidence_tier()) - calibrated honesty instead of a bare percentage.
    confidence_tier: str = ""
    # How the answer text was produced: "llm" (the configured model),
    # "mock" (no model configured - template generator), or "mock_fallback"
    # (a configured model was tried but failed/rate-limited and we fell back
    # to the template generator). Surfaced as a first-class field - not just
    # buried in reasoning_trace - so the UI can flag a degraded answer and
    # the eval harness can detect a silent quality drop instead of scoring a
    # template answer as if the real model produced it.
    generation_mode: str = ""
    # Result of the numeric-claim grounding check (verifier/numeric_verifier):
    # every dose/threshold stated in the answer must appear verbatim in the
    # cited evidence. Shape: {claims_total, supported, unsupported:[...],
    # all_grounded}. When a value is ungrounded, confidence is capped so a
    # possibly-hallucinated dose can never render as a high-confidence answer,
    # and the UI can surface which value could not be verified.
    numeric_verification: Optional[dict] = None
    # Token counts from the underlying provider call, when it reports them:
    # {prompt_tokens, completion_tokens, total_tokens}. None whenever no
    # generation happened (no_evidence/clarification routes, mock mode) or
    # the provider's response didn't include usage data - see
    # LLMGenerator._call_groq/_call_ollama for what each provider reports.
    # Not populated on the streaming answer path (see _last_token_usage's
    # docstring for why). Feeds QueryLogRecord for per-request cost
    # observability (Phase E) - not billing-accurate, since Ollama has no
    # per-token cost, but real usage data rather than an estimate.
    token_usage: Optional[dict] = None


# ── SOP ────────────────────────────────────────────────────────

class SOPResponse(BaseModel):
    id: int
    sop_id: str
    title: str
    department: str = ""
    version: str = "1.0"
    effective_date: str = ""
    review_date: str = ""
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
    # Either query_id (legacy) or answer_id (QueryLogRecord.id - the real
    # per-answer identifier the chat/query pipeline actually uses) must be
    # given; answer_id is preferred for anything originating from Ask Meridian.
    query_id: int | None = None
    answer_id: int | None = None
    feedback_type: str  # positive / negative / correction / clarification / incorrect / unsafe / missing
    feedback_text: str = ""


class FeedbackResponse(BaseModel):
    id: int
    message: str


class FeedbackItem(BaseModel):
    id: int
    status: str
    type: str
    sop: str
    query: str
    role: str = ""
    time: str


class FeedbackListResponse(BaseModel):
    items: list[FeedbackItem] = []


# ── Human Evaluation ───────────────────────────────────────────

class HumanEvalRatingRequest(BaseModel):
    evaluator_role: str = ""
    evaluator_name: str = ""
    item_id: str
    correctness: int = Field(ge=1, le=5)
    completeness: int = Field(ge=1, le=5)
    safety: int = Field(ge=1, le=5)
    comment: str = ""


class HumanEvalRatingResponse(BaseModel):
    id: int
    message: str


class HumanEvalRatingItem(BaseModel):
    id: int
    evaluator_role: str
    evaluator_name: str
    item_id: str
    correctness: int
    completeness: int
    safety: int
    comment: str
    created_at: str


class HumanEvalRatingListResponse(BaseModel):
    ratings: list[HumanEvalRatingItem] = []


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
    scheduled_effective_date: str = ""


class ProposalScheduleUpdate(BaseModel):
    scheduled_effective_date: str  # "" clears scheduling (effective immediately on approval)


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
    scheduled_effective_date: str = ""
    effective_status: Optional[str] = None  # None | "pending" | "effective" (only meaningful when status == "approved")
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
    signature_meaning: str = ""
    # Second identification factor: the signer re-types their own full
    # name at the moment of signing (see AttestationRecord docstring for
    # why this - not a password/PIN - is what this app can honestly offer
    # as a second factor). Server validates this matches user_name.
    second_factor_confirmation: str = ""


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
    signature_meaning: str = ""
    second_factor_confirmation: str = ""
    content_hash: str = ""
    prev_hash: str = ""
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


# ── Incidents + CAPA ───────────────────────────────────────────

class IncidentCreate(BaseModel):
    incident_type: str = "near_miss"  # near_miss | adverse_event | sentinel_event
    title: str
    description: str = ""
    department: str = ""
    severity: str = "medium"  # low | medium | high | critical
    reporter: str = ""
    linked_sop_ids: list[str] = []


class IncidentResponse(BaseModel):
    id: int
    incident_type: str = "near_miss"
    title: str
    description: str = ""
    department: str = ""
    severity: str = "medium"
    reporter: str = ""
    linked_sop_ids: list[str] = []
    occurred_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    capa_count: int = 0
    open_capa_count: int = 0


class CAPACreate(BaseModel):
    title: str = ""
    root_cause: str = ""
    corrective_action: str = ""
    preventive_action: str = ""
    owner: str = ""
    due_date: str = ""


class CAPAUpdate(BaseModel):
    title: Optional[str] = None
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    preventive_action: Optional[str] = None
    status: Optional[str] = None  # open | investigating | action_planned | closed
    owner: Optional[str] = None
    due_date: Optional[str] = None
    linked_proposal_id: Optional[int] = None


class CAPAResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    incident_id: int
    title: str = ""
    root_cause: str = ""
    corrective_action: str = ""
    preventive_action: str = ""
    status: str = "open"
    owner: str = ""
    due_date: str = ""
    linked_proposal_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


# ── Exceptions (in-the-moment SOP deviations) ───────────────────

class ExceptionCreate(BaseModel):
    sop_id: str = ""
    sop_title: str = ""
    reported_by: str = ""
    reporter_role: str = ""
    department: str = ""
    date_of_deviation: Optional[datetime] = None
    deviation_type: str = "other"
    description: str = ""
    immediate_action_taken: str = ""
    patient_harm: bool = False
    severity: str = "medium"  # low | medium | high | critical


class ExceptionUpdate(BaseModel):
    status: Optional[str] = None  # open | under_review | resolved | escalated
    reviewed_by: Optional[str] = None
    resolution: Optional[str] = None
    sop_update_required: Optional[bool] = None
    follow_up_required: Optional[str] = None


class ExceptionResponse(BaseModel):
    id: int
    sop_id: str = ""
    sop_title: str = ""
    reported_by: str = ""
    reporter_role: str = ""
    department: str = ""
    date_reported: Optional[datetime] = None
    date_of_deviation: Optional[datetime] = None
    deviation_type: str = "other"
    description: str = ""
    immediate_action_taken: str = ""
    patient_harm: bool = False
    severity: str = "medium"
    status: str = "open"
    reviewed_by: Optional[str] = None
    resolution: Optional[str] = None
    sop_update_required: bool = False
    follow_up_required: Optional[str] = None

    model_config = {"from_attributes": True}

    model_config = {"from_attributes": True}
