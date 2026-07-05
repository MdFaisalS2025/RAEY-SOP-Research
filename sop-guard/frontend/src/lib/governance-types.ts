// SOP-Guard Governance Platform — Core Type Definitions
// Replace stub IDs/names with real database entities when integrating

export type UserRole =
  | "physician"
  | "nurse"
  | "department_admin"
  | "compliance_officer"
  | "committee_member"
  | "legal_risk"
  | "nurse_educator"
  | "system_admin"

export type SOPStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "archived"
  | "needs_update"
  | "on_hold"

export type ProposalStatus =
  | "draft"
  | "submitted"
  | "evidence_review"
  | "department_review"
  | "committee_review"
  | "legal_review"
  | "training_review"
  | "approved"
  | "rejected"
  | "published"
  | "archived"

export type EvidenceStrength = "high" | "moderate" | "low" | "insufficient" | "expert_opinion"
export type AlignmentStatus =
  | "aligned"
  | "partially_aligned"
  | "possible_update"
  | "conflict_detected"
  | "insufficient_evidence"
  | "not_reviewed"

export type RiskLevel = "critical" | "high" | "medium" | "low"

export interface DemoUser {
  id: string
  name: string
  role: UserRole
  department: string
  title: string
  initials: string
  avatar?: string
}

export interface EnhancedSOP {
  id: string
  sop_id: string
  title: string
  department: string
  category: string
  version: string
  status: SOPStatus
  owner: string
  committee: string
  effective_date: string
  review_due_date: string
  last_updated: string
  tags: string[]
  training_required: boolean
  legal_risk_flag: boolean
  compliance_acknowledgment_required: boolean
  evidence_alignment: AlignmentStatus
  source_trust_score: number
  review_frequency_months: number
  related_sop_ids: string[]
  assigned_staff_groups: string[]
  risk_classification: RiskLevel
  regulatory_mapping: string[]
  purpose: string
  scope: string
  responsible_roles: string[]
  procedure_steps: ProcedureStep[]
  warnings: string[]
  contraindications: string[]
  required_documentation: string[]
  related_forms: string[]
  internal_citations: string[]
  version_history: VersionRecord[]
  change_log: ChangeLogEntry[]
  acknowledgment_stats: AcknowledgmentStats
  training_assignments: TrainingAssignment[]
  legal_notes: string
  liability_notes: string
  summary: string
  external_evidence_count: number
  open_proposals: number
}

export interface ProcedureStep {
  step_number: number
  title: string
  description: string
  responsible_role: string
  documentation_required: boolean
  critical: boolean
}

export interface VersionRecord {
  version: string
  date: string
  author: string
  summary: string
  reason: string
  approved_by: string
}

export interface ChangeLogEntry {
  id: string
  date: string
  user: string
  action: string
  description: string
  section?: string
}

export interface AcknowledgmentStats {
  required_count: number
  acknowledged_count: number
  overdue_count: number
  completion_rate: number
}

export interface TrainingAssignment {
  id: string
  title: string
  assigned_to_group: string
  due_date: string
  completion_rate: number
  triggered_by: string
}

export interface ExternalEvidence {
  id: string
  title: string
  source_type:
    | "pubmed"
    | "pmc"
    | "cdc"
    | "fda"
    | "who"
    | "nccn"
    | "jama"
    | "nejm"
    | "cochrane"
    | "professional_society"
    | "internal_memo"
    | "guideline"
  source_name: string
  publication_date: string
  last_updated?: string
  evidence_strength: EvidenceStrength
  source_trust_score: number
  summary: string
  relevant_excerpt: string
  url?: string
  doi?: string
  pmid?: string
  authors?: string[]
  journal?: string
  related_sop_ids: string[]
  alignment_status: AlignmentStatus
  clinical_relevance: string
  impact_level: RiskLevel
  departments_affected: string[]
  requires_committee_review: boolean
  watch_category: string
  freshness_days: number
  is_mock: boolean
}

export interface UpdateProposal {
  id: string
  title: string
  affected_sop_id: string
  affected_sop_title: string
  department: string
  reason: string
  initiated_by: DemoUser
  created_date: string
  due_date: string
  status: ProposalStatus
  priority: RiskLevel
  evidence_source_ids: string[]
  ai_summary: string
  proposed_changes: ProposedChange[]
  risk_level: RiskLevel
  clinical_impact: string
  legal_impact: string
  training_impact: string
  affected_roles: string[]
  affected_departments: string[]
  approvers: ApproverRecord[]
  committee_members: string[]
  comments: ProposalComment[]
  audit_trail: AuditEntry[]
  final_decision?: string
  final_decision_date?: string
  final_decision_by?: string
  training_triggered: boolean
  legal_review_required: boolean
}

export interface ProposedChange {
  section: string
  current_text: string
  proposed_text: string
  change_reason: string
  evidence_reference: string
}

export interface ApproverRecord {
  user_id: string
  user_name: string
  role: string
  status: "pending" | "approved" | "rejected" | "abstained" | "requested_changes"
  date?: string
  notes?: string
}

export interface ProposalComment {
  id: string
  author: string
  author_role: string
  date: string
  content: string
  type: "comment" | "request_change" | "approval" | "rejection" | "escalation"
  replies?: ProposalComment[]
}

export interface AuditEntry {
  id: string
  event_type: AuditEventType
  user: string
  user_role: UserRole
  timestamp: string
  affected_resource: string
  affected_resource_id: string
  action_summary: string
  before_value?: string
  after_value?: string
  evidence_references?: string[]
  compliance_impact?: string
  ip_address?: string
}

export type AuditEventType =
  | "sop_created"
  | "sop_updated"
  | "sop_published"
  | "sop_archived"
  | "evidence_linked"
  | "proposal_created"
  | "proposal_submitted"
  | "proposal_approved"
  | "proposal_rejected"
  | "committee_vote"
  | "legal_review_completed"
  | "training_assigned"
  | "training_completed"
  | "acknowledgment_completed"
  | "ai_recommendation_generated"
  | "ai_answer_flagged"
  | "admin_config_updated"
  | "user_login"
  | "export_generated"
  | "cross_reference_run"

export interface ComplianceStat {
  department: string
  total_sops: number
  acknowledged: number
  overdue_acknowledgments: number
  overdue_reviews: number
  training_completion_rate: number
  open_proposals: number
  last_audit_date: string
  compliance_score: number
  risk_flags: number
}

export interface TrainingModule {
  id: string
  title: string
  sop_id: string
  sop_title: string
  triggered_by: string
  assigned_groups: string[]
  department: string
  due_date: string
  created_date: string
  total_assigned: number
  completed: number
  in_progress: number
  not_started: number
  overdue: number
  completion_rate: number
  estimated_duration_minutes: number
  format: "module" | "quiz" | "checklist" | "video" | "attestation"
  status: "active" | "completed" | "overdue" | "upcoming"
}

export interface LegalRiskItem {
  id: string
  sop_id: string
  sop_title: string
  department: string
  risk_classification: RiskLevel
  issue_type: "liability" | "compliance" | "regulatory" | "privacy" | "documentation" | "consent"
  description: string
  identified_date: string
  identified_by: string
  status: "open" | "under_review" | "resolved" | "on_hold" | "escalated"
  legal_notes: string
  resolution_required_by?: string
  resolved_date?: string
  resolved_by?: string
  resolution_notes?: string
  proposal_id?: string
  regulatory_reference?: string
}

export interface EvidenceWatchItem {
  id: string
  evidence_id: string
  title: string
  source_type: ExternalEvidence["source_type"]
  source_name: string
  published_date: string
  detected_date: string
  impact_level: RiskLevel
  departments_affected: string[]
  related_sop_titles: string[]
  related_sop_ids: string[]
  action_required: boolean
  action_taken?: string
  review_status: "new" | "reviewing" | "actioned" | "dismissed" | "proposal_created"
  assigned_to?: string
  summary: string
  categories: string[]
}

export interface NotificationItem {
  id: string
  type: "evidence_watch" | "proposal_update" | "training_due" | "acknowledgment_required" | "legal_flag" | "committee_action" | "sop_update"
  title: string
  description: string
  timestamp: string
  read: boolean
  priority: "urgent" | "high" | "normal" | "low"
  link?: string
  related_id?: string
}

export interface DashboardStats {
  total_sops: number
  sops_approved: number
  sops_needs_review: number
  sops_overdue: number
  open_proposals: number
  pending_approvals: number
  evidence_watch_alerts: number
  compliance_rate: number
  training_completion_rate: number
  legal_flags: number
  audit_events_today: number
  staff_acknowledged_today: number
}

// ─────────────────────────────────────────────
// FEATURE: Exception / Deviation Reporting
// ─────────────────────────────────────────────

export interface ExceptionReport {
  id: string
  sop_id: string
  sop_title: string
  reported_by: string
  reporter_role: UserRole
  department: string
  date_reported: string
  date_of_deviation: string
  deviation_type:
    | "equipment_unavailable"
    | "patient_specific_contraindication"
    | "staffing_constraint"
    | "emergency_circumstance"
    | "system_failure"
    | "other"
  description: string
  immediate_action_taken: string
  patient_harm: boolean
  severity: RiskLevel
  status: "open" | "under_review" | "resolved" | "escalated"
  reviewed_by: string | null
  resolution: string | null
  sop_update_required: boolean
  follow_up_required: string | null
}

// ─────────────────────────────────────────────
// FEATURE: Regulatory Mapping
// ─────────────────────────────────────────────

export interface RegulatoryStandard {
  id: string
  framework: "TJC" | "CMS" | "OSHA" | "State" | "Other"
  standard_code: string
  title: string
  description: string
  mapped_sop_ids: string[]
  compliance_status: "compliant" | "needs_review" | "non_compliant" | "not_assessed"
  last_assessed: string
  next_survey_due: string
}

// ─────────────────────────────────────────────
// FEATURE: SOP Expiry Alerts
// ─────────────────────────────────────────────

export interface SOPExpiryAlert {
  sop_id: string
  sop_title: string
  department: string
  owner: string
  review_due_date: string
  days_until_expiry: number
  status: "expired" | "due_soon" | "upcoming" | "current"
  last_reviewed_date: string
  version: string
}

// ─────────────────────────────────────────────
// FEATURE: Legal Attestation
// ─────────────────────────────────────────────

export interface AttestationRecord {
  id: string
  sop_id: string
  sop_title: string
  sop_version: string
  user_id: string
  user_name: string
  user_role: UserRole
  user_department: string
  attested_at: string
  ip_address: string
  user_agent: string
  legal_text: string
  is_valid: boolean
  revoked?: boolean
  revoked_reason?: string
}

// ─────────────────────────────────────────────
// FEATURE: SOP Conflict Resolution
// ─────────────────────────────────────────────

export interface SOPConflict {
  id: string
  title: string
  sop_a_id: string
  sop_a_title: string
  sop_b_id: string
  sop_b_title: string
  conflict_type: "contradictory_guidance" | "overlapping_scope" | "terminology_mismatch" | "procedure_conflict" | "dosage_discrepancy"
  description: string
  affected_departments: string[]
  clinical_risk: RiskLevel
  detected_date: string
  detected_by: string
  status: "open" | "under_review" | "resolved" | "accepted_variance"
  assigned_to: string | null
  resolution_notes: string | null
  resolved_date: string | null
  resolution_type: "sop_a_updated" | "sop_b_updated" | "both_updated" | "accepted_variance" | "escalated" | null
  proposal_ids: string[]
  evidence_refs: string[]
}

export interface IncidentSopLink {
  incident_id: string
  sop_id: string
  link_type: "caused_by_non_compliance" | "sop_gap_identified" | "sop_needs_update" | "training_gap"
  auto_detected: boolean
  confidence: number
}
