import type {
  QueryResponse,
  SOP,
  SOPListResponse,
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

export async function submitFeedback({
  answerId,
  feedbackType,
  feedbackText,
}: {
  answerId?: string | number | null
  feedbackType: string
  feedbackText?: string
}): Promise<void> {
  await request("/api/feedback", {
    method: "POST",
    body: JSON.stringify({
      answer_id: answerId != null ? Number(answerId) : undefined,
      feedback_type: feedbackType,
      feedback_text: feedbackText || "",
    }),
  })
}

export async function healthCheck(): Promise<{ status: string }> {
  return request<{ status: string }>("/api/health")
}
