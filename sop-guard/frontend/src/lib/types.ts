export interface QueryRequest {
  query: string
  user_role?: string
  department?: string
}

export interface CheckResult {
  check_type: string
  status: string // "pass" | "fail" | "warning"
  detail: string
  source_reference: string
}

export interface VerificationResult {
  status: string // "passed" | "warning" | "failed"
  overall_score: number
  threshold_checks: CheckResult[]
  sequence_checks: CheckResult[]
  contraindication_checks: CheckResult[]
  safe_to_display: boolean
  explanation: string
}

export interface RetrievedChunk {
  chunk_text: string
  section_title: string
  sop_title: string
  sop_id: string
  relevance_score: number
}

export interface QueryResponse {
  answer: string
  citations: string[]
  confidence: number
  verification_result: VerificationResult | null
  retrieved_chunks: RetrievedChunk[]
  reasoning_trace: string[]
  query_type: string
  faithfulness?: Record<string, unknown> | null
  sop_conflicts?: Record<string, unknown>[]
}

export interface SOP {
  id: number
  sop_id: string
  title: string
  department: string
  version: string
  effective_date: string
  status: string
  structured_json: Record<string, unknown>
  chunk_count: number
}

export interface SOPListResponse {
  sops: SOP[]
  total: number
}

export interface FeedbackRequest {
  query_id: number
  feedback_type: string
  feedback_text: string
}
