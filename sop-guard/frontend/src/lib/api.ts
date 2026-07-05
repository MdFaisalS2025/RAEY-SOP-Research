import type {
  QueryResponse,
  SOP,
  SOPListResponse,
  SOPUpdate,
  AnalyticsData,
  EvaluationResult,
  TranscriptionResponse,
} from "./types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText)
    throw new Error(`API error ${res.status}: ${error}`)
  }

  return res.json()
}

export async function querySOPs(
  query: string,
  news2Score?: number,
  userRole?: string,
  department?: string
): Promise<QueryResponse> {
  return request<QueryResponse>("/api/query", {
    method: "POST",
    body: JSON.stringify({
      query,
      user_role: userRole,
      department,
      news2_score: news2Score ?? null,
    }),
  })
}

export async function getSOPs(): Promise<SOP[]> {
  const data = await request<SOPListResponse>("/api/sops")
  return data.sops
}

export async function getSOP(id: string): Promise<SOP> {
  return request<SOP>(`/api/sops/${id}`)
}

export async function uploadSOP(file: File): Promise<SOP> {
  const formData = new FormData()
  formData.append("file", file)

  const url = `${BASE_URL}/api/upload-sop`
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText)
    throw new Error(`API error ${res.status}: ${error}`)
  }

  return res.json()
}

export async function submitFeedback(
  queryId: number,
  type: string,
  text?: string
): Promise<void> {
  await request("/api/feedback", {
    method: "POST",
    body: JSON.stringify({
      query_id: queryId,
      feedback_type: type,
      feedback_text: text || "",
    }),
  })
}

export async function proposeUpdate(
  sopId: string,
  section: string,
  oldText: string,
  newText: string,
  reason: string,
  proposedBy: string
): Promise<SOPUpdate> {
  return request<SOPUpdate>(`/api/sops/${sopId}/propose-update`, {
    method: "POST",
    body: JSON.stringify({
      section,
      old_text: oldText,
      new_text: newText,
      reason,
      proposed_by: proposedBy,
    }),
  })
}

export async function approveUpdate(
  sopId: string,
  updateId: string
): Promise<SOPUpdate> {
  return request<SOPUpdate>(`/api/sops/${sopId}/approve-update/${updateId}`, {
    method: "POST",
  })
}

export async function getAnalytics(): Promise<AnalyticsData> {
  return request<AnalyticsData>("/api/analytics")
}

export async function transcribeVoice(audioBlob: Blob): Promise<TranscriptionResponse> {
  const formData = new FormData()
  formData.append("audio", audioBlob, "recording.webm")

  const url = `${BASE_URL}/api/voice/transcribe`
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText)
    throw new Error(`API error ${res.status}: ${error}`)
  }

  return res.json()
}

export async function runEvaluation(): Promise<EvaluationResult> {
  return request<EvaluationResult>("/api/evaluate", {
    method: "POST",
  })
}

export async function healthCheck(): Promise<{ status: string }> {
  return request<{ status: string }>("/api/health")
}
