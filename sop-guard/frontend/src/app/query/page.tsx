"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send,
  ChevronDown,
  ChevronRight,
  Search,
  Sparkles,
  CheckCircle2,
  Circle,
  Loader2,
  History,
  User,
  Activity,
  RotateCcw,
} from "lucide-react"
import { type InlineCitation } from "@/components/query/citation-chip"
import { AnswerRenderer } from "@/components/query/answer-renderer"
import { ChatAnswerMessage } from "@/components/query/chat-answer-message"
import { READING_LEVEL_KEY, type ReadingLevel } from "@/components/query/plain-language"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { VoiceRecorder } from "@/components/voice/voice-recorder"
import { querySOPs } from "@/lib/api"
import { cn } from "@/lib/utils"

const suggestedQueries = [
"What are the steps for sepsis management?",
"What is the maximum norepinephrine dose?",
"What contraindications apply before blood transfusion?",
"What should a nurse monitor after central line insertion?",
"When should insulin be held for hypoglycemia?",
]

const pipelineStages = [
  { label: "Understanding your question...", duration: 1000 },
  { label: "Searching SOP database...", duration: 1500 },
  { label: "Generating grounded answer...", duration: 1500 },
  { label: "Running faithfulness verification...", duration: 1000 },
  { label: "Computing confidence score...", duration: 500 },
]

const CHAT_SESSION_KEY = "meridian-chat-session"

// ─── Types ────────────────────────────────────────────────────────────────────

type VerificationData = {
  status: "passed" | "warning" | "failed"
  confidence: number
  thresholdChecks: { parameter: string; value: string; status: string; source: string }[]
  sequenceChecks: { procedure: string; steps: string[]; correct: boolean; source: string }[]
  contraindicationChecks: { item: string; safe: boolean; note: string; source: string }[]
}

type SourceData = { id: string; sop_title: string; section: string; content: string; score: number }

export type AssistantData = {
  query: string
  answer: string
  verification: VerificationData
  sources: SourceData[]
  reasoning: string
  faithfulness: any
  sopConflicts: any[]
  inlineCitations: InlineCitation[]
  followupQuestions: string[]
  abstained: boolean
  route: string
  generationMode: string | null
  responseTimeMs: number | null
  answerId: string | null
  entities: { drugs?: string[]; conditions?: string[] }
  answeredAt: number
  error?: boolean
  needsClarification: boolean
  clarificationQuestion: string
  clarificationOptions: string[]
}

/** Pulls "Evidence: sufficient (score: 0.83)" out of the joined reasoning trace. */
function extractEvidenceScore(reasoning: string): number | null {
  const m = reasoning.match(/Evidence:\s*\w+\s*\(score:\s*([\d.]+)\)/)
  return m ? parseFloat(m[1]) : null
}

type ChatMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; data: AssistantData }

function emptyVerification(): VerificationData {
  return { status: "warning", confidence: 0.5, thresholdChecks: [], sequenceChecks: [], contraindicationChecks: [] }
}

function mapCitations(raw: unknown): InlineCitation[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c: any) => c && typeof c.number === "number")
    .map((c: any) => ({
      number: c.number,
      sop_id: c.sop_id ?? "",
      sop_title: c.sop_title ?? "Unknown SOP",
      section_title: c.section_title ?? "",
      chunk_type: c.chunk_type ?? "",
      snippet: c.snippet ?? "",
      relevance_score: typeof c.relevance_score === "number" ? c.relevance_score : 0,
      cited_in_answer: c.cited_in_answer ?? false,
      version: c.version ?? "",
      effective_date: c.effective_date ?? "",
      review_date: c.review_date ?? "",
      status: c.status ?? "active",
      url: c.url ?? "",
      is_external: c.is_external ?? false,
      pub_date: c.pub_date ?? "",
    }))
}

/**
 * POSTs to an SSE endpoint and parses "data: {...}\n\n" frames as they
 * arrive, invoking onToken live and resolving with the final response
 * payload once the "final" event lands. Falls back to null on any
 * failure so callers can retry against the non-streaming endpoint.
 */
async function streamSSE(
  url: string,
  body: unknown,
  onToken: (text: string) => void,
): Promise<any | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) return null

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let final: any = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const frames = buffer.split("\n\n")
    buffer = frames.pop() ?? ""
    for (const frame of frames) {
      const line = frame.trim()
      if (!line.startsWith("data: ")) continue
      const payload = line.slice("data: ".length)
      if (payload === "[DONE]") continue
      try {
        const event = JSON.parse(payload)
        if (event.type === "token") onToken(event.text)
        else if (event.type === "final") final = event.response
      } catch { /* ignore malformed frame */ }
    }
  }
  return final
}

function mapResponse(query: string, response: any, startedAt: number): AssistantData {
  const ext = response as Record<string, unknown>
  const vr = response.verification_result
  return {
    query,
    answer: response.answer ?? "",
    verification: {
      status: (vr?.status || "warning") as "passed" | "warning" | "failed",
      confidence: response.confidence || 0.5,
      thresholdChecks: (vr?.threshold_checks || []).map((c: any) => ({
        parameter: c.detail.split("'")[1] || c.detail.substring(0, 40),
        value: c.detail,
        status: c.status,
        source: c.source_reference,
      })),
      sequenceChecks: (vr?.sequence_checks || []).map((c: any) => ({
        procedure: "Procedural sequence",
        steps: [c.detail],
        correct: c.status === "pass",
        source: c.source_reference,
      })),
      contraindicationChecks: (vr?.contraindication_checks || []).map((c: any) => ({
        item: c.detail.substring(0, 50),
        safe: c.status === "pass",
        note: c.detail,
        source: c.source_reference,
      })),
    },
    sources: (response.retrieved_chunks || []).map((c: any, i: number) => ({
      id: String(i + 1),
      sop_title: c.sop_title,
      section: c.section_title,
      content: (c.chunk_text || "").substring(0, 300),
      score: c.relevance_score,
    })),
    reasoning: (response.reasoning_trace || []).join("\n"),
    faithfulness: response.faithfulness ?? null,
    sopConflicts: response.sop_conflicts ?? [],
    inlineCitations: mapCitations(ext.inline_citations),
    followupQuestions: Array.isArray(ext.followup_questions) ? (ext.followup_questions as string[]).filter((f) => typeof f === "string") : [],
    abstained:
      (ext.abstained as boolean | undefined) ??
      /not covered in the available SOPs/i.test(response.answer || ""),
    route: typeof ext.route === "string" ? ext.route : "sop_library",
    generationMode: typeof ext.generation_mode === "string" ? ext.generation_mode : null,
    responseTimeMs: typeof ext.response_time_ms === "number" ? ext.response_time_ms : Date.now() - startedAt,
    answerId: ext.answer_id != null ? String(ext.answer_id) : null,
    entities: (ext.entities && typeof ext.entities === "object") ? ext.entities as { drugs?: string[]; conditions?: string[] } : {},
    needsClarification: (ext.needs_clarification as boolean | undefined) ?? false,
    clarificationQuestion: typeof ext.clarification_question === "string" ? ext.clarification_question : "",
    clarificationOptions: Array.isArray(ext.clarification_options) ? (ext.clarification_options as string[]).filter((o) => typeof o === "string") : [],
    answeredAt: Date.now(),
  }
}

// ─── Badges and small components ─────────────────────────────────────────────

function PipelineStages({ currentStage }: { currentStage: number }) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-border">
      <h3 className="text-sm font-semibold mb-4">Processing Pipeline</h3>
      <div className="space-y-3">
        {pipelineStages.map((stage, i) => {
          const completed = i < currentStage
          const active = i === currentStage
          return (
            <div key={i} className={cn("flex items-center gap-3 text-sm transition-all duration-300", completed ? "text-[#15803D] dark:text-green-400" : active ? "text-[#0B6BCB]" : "text-subtle")}>
              {completed ? <CheckCircle2 className="w-5 h-5 text-[#15803D] dark:text-green-400 shrink-0" /> : active ? <Loader2 className="w-5 h-5 text-[#0B6BCB] animate-spin shrink-0" /> : <Circle className="w-5 h-5 shrink-0" />}
              <span className={cn("font-medium", active && "text-foreground")}>{stage.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Pulsing placeholder shaped like the answer card that's about to arrive
// (heading, a few text lines, a couple of step rows) - shown alongside the
// pipeline checklist so the wait reads as "the answer is forming" rather
// than blank space, since a self-hosted model can take 30-50s per answer.
function AnswerSkeleton() {
  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm space-y-4 animate-pulse" aria-hidden="true">
      <div className="h-4 w-2/5 rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-11/12 rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
      <div className="space-y-3 pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function news2RiskConfig(score: number) {
  if (score >= 7) return { label: "HIGH RISK: Consider ICU", className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30" }
  if (score >= 5) return { label: "Medium Risk: Urgent Review", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30" }
  if (score >= 3) return { label: "Low-Medium Risk", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30" }
  return { label: "Low Risk", className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30" }
}

// ─── NEWS2 (National Early Warning Score 2) ─────────────────────────────────
// The real RCP scoring table (7 physiological parameters, each 0-3 points,
// summed). Letting a nurse enter vitals directly - rather than requiring
// them to already know their patient's NEWS2 total - is both more accurate
// (no mental-math transcription error) and more honest about what the
// number actually represents.
interface News2Vitals {
  respRate: string
  spo2: string
  onOxygen: boolean
  sbp: string
  pulse: string
  consciousness: "alert" | "cvpu"
  temp: string
}

const EMPTY_NEWS2_VITALS: News2Vitals = {
  respRate: "", spo2: "", onOxygen: false, sbp: "", pulse: "", consciousness: "alert", temp: "",
}

function scoreRespRate(v: number): number {
  if (v <= 8) return 3
  if (v <= 11) return 1
  if (v <= 20) return 0
  if (v <= 24) return 2
  return 3
}
function scoreSpo2(v: number): number {
  if (v <= 91) return 3
  if (v <= 93) return 2
  if (v <= 95) return 1
  return 0
}
function scoreSbp(v: number): number {
  if (v <= 90) return 3
  if (v <= 100) return 2
  if (v <= 110) return 1
  if (v <= 219) return 0
  return 3
}
function scorePulse(v: number): number {
  if (v <= 40) return 3
  if (v <= 50) return 1
  if (v <= 90) return 0
  if (v <= 110) return 1
  if (v <= 130) return 2
  return 3
}
function scoreTemp(v: number): number {
  if (v <= 35.0) return 3
  if (v <= 36.0) return 1
  if (v <= 38.0) return 0
  if (v <= 39.0) return 1
  return 2
}

/** Returns the computed NEWS2 total, or null if any required vital is
 * still missing/unparseable - a partial score is worse than no score. */
function computeNews2(v: News2Vitals): number | null {
  const respRate = Number(v.respRate), spo2 = Number(v.spo2), sbp = Number(v.sbp), pulse = Number(v.pulse), temp = Number(v.temp)
  if (![v.respRate, v.spo2, v.sbp, v.pulse, v.temp].every((f) => f !== "") ||
      [respRate, spo2, sbp, pulse, temp].some((n) => Number.isNaN(n))) {
    return null
  }
  return (
    scoreRespRate(respRate) + scoreSpo2(spo2) + (v.onOxygen ? 2 : 0) +
    scoreSbp(sbp) + scorePulse(pulse) + (v.consciousness === "cvpu" ? 3 : 0) + scoreTemp(temp)
  )
}


// ─── Main page ────────────────────────────────────────────────────────────────

let messageCounter = 0
function nextId() {
  messageCounter += 1
  return `msg-${Date.now()}-${messageCounter}`
}

export default function QueryPage() {
  const [query, setQuery] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentStage, setCurrentStage] = useState(0)
  const [streamingText, setStreamingText] = useState("")
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; confidence: number; type: string; timestamp: number }>>([])
  const [showHistory, setShowHistory] = useState(false)
  const [userRole, setUserRole] = useState("viewer")
  const [serverHistory, setServerHistory] = useState<Array<{ id: number; query: string; confidence: number; query_type: string; timestamp: string }>>([])
  const [news2Score, setNews2Score] = useState<number | null>(null)
  const [news2Mode, setNews2Mode] = useState<"manual" | "calculate">("calculate")
  const [news2Vitals, setNews2Vitals] = useState<News2Vitals>(EMPTY_NEWS2_VITALS)
  const [showPatientContext, setShowPatientContext] = useState(false)

  useEffect(() => {
    if (news2Mode === "calculate") setNews2Score(computeNews2(news2Vitals))
  }, [news2Mode, news2Vitals])
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>("clinical")

  const chatDisabledRef = useRef(false)
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)
  const wasNearBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)

  const submitted = messages.length > 0

  useEffect(() => {
    fetch("/api/query/history?limit=10")
      .then(r => r.json())
      .then(data => { if (data.queries) setServerHistory(data.queries) })
      .catch(() => {})
  }, [messages.length])

  useEffect(() => {
    setUserRole(localStorage.getItem("meridian-role") || "viewer")
    try {
      const saved = localStorage.getItem(READING_LEVEL_KEY)
      if (saved === "plain" || saved === "clinical") setReadingLevel(saved)
    } catch { /* ignore */ }
  }, [])

  const changeReadingLevel = (v: ReadingLevel) => {
    setReadingLevel(v)
    try { localStorage.setItem(READING_LEVEL_KEY, v) } catch { /* ignore */ }
  }

  // Restore chat session on mount
  useEffect(() => {
    const sid = sessionStorage.getItem(CHAT_SESSION_KEY)
    if (!sid) return
    fetch(`/api/chat/sessions/${sid}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((session: any) => {
        if (!Array.isArray(session?.messages)) return
        const restored: ChatMessage[] = session.messages.map((m: any) => {
          if (m.role === "user") return { id: nextId(), role: "user" as const, content: String(m.content ?? "") }
          return {
            id: nextId(),
            role: "assistant" as const,
            data: {
              query: "",
              answer: String(m.content ?? ""),
              verification: emptyVerification(),
              sources: [],
              reasoning: "",
              faithfulness: null,
              sopConflicts: [],
              inlineCitations: mapCitations(m.citations),
              followupQuestions: [],
              abstained: /not covered in the available SOPs/i.test(String(m.content ?? "")),
              generationMode: null,
              responseTimeMs: null,
              answerId: m.answer_id != null ? String(m.answer_id) : null,
              entities: {},
              answeredAt: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
            },
          }
        })
        // Backfill assistant query text from preceding user message
        for (let i = 0; i < restored.length; i++) {
          const m = restored[i]
          if (m.role === "assistant" && i > 0) {
            const prev = restored[i - 1]
            if (prev.role === "user") m.data.query = prev.content
          }
        }
        setMessages(restored)
        setSessionId(sid)
      })
      .catch(() => { sessionStorage.removeItem(CHAT_SESSION_KEY) })
  }, [])

  useEffect(() => {
    if (!loading) return
    setCurrentStage(0)
    let stage = 0
    const advanceStage = () => {
      stage++
      if (stage < pipelineStages.length) {
        setCurrentStage(stage)
        stageTimerRef.current = setTimeout(advanceStage, pipelineStages[stage].duration)
      }
    }
    stageTimerRef.current = setTimeout(advanceStage, pipelineStages[0].duration)
    return () => { if (stageTimerRef.current) clearTimeout(stageTimerRef.current) }
  }, [loading])

  // Track whether the reader is already near the bottom, so a new answer
  // never yanks them away from something they scrolled up to read.
  useEffect(() => {
    const NEAR_BOTTOM_PX = 120
    const updateNearBottom = () => {
      const scrollable = document.documentElement
      wasNearBottomRef.current =
        window.innerHeight + window.scrollY >= scrollable.scrollHeight - NEAR_BOTTOM_PX
    }
    updateNearBottom()
    window.addEventListener("scroll", updateNearBottom, { passive: true })
    return () => window.removeEventListener("scroll", updateNearBottom)
  }, [])

  // Auto-scroll only when the user submits a genuinely new question (not
  // on every loading-state flip, and not again when the assistant's reply
  // is appended a moment later) and only if the reader hadn't scrolled
  // away to review earlier history. Rather than snapping to the very
  // bottom of the page - which can jump straight past a long answer and
  // its sources to trailing whitespace - the new question bubble itself
  // is brought to the top of the viewport, the same pattern ChatGPT/
  // Claude use: the answer then streams in below without any further
  // forced scrolling, so the reader is never yanked mid-read.
  useEffect(() => {
    const isNewMessage = messages.length > prevMessageCountRef.current
    const isNewUserMessage = isNewMessage && messages[messages.length - 1]?.role === "user"
    prevMessageCountRef.current = messages.length
    if (isNewUserMessage && wasNearBottomRef.current) {
      const lastUserMessage = messages[messages.length - 1]
      requestAnimationFrame(() => {
        document.getElementById(`msg-${lastUserMessage.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  const allHistory = [
    ...queryHistory,
    ...serverHistory
      .filter(sh => !queryHistory.some(qh => qh.query === sh.query))
      .map(sh => ({ query: sh.query, confidence: sh.confidence, type: sh.query_type, timestamp: new Date(sh.timestamp).getTime() }))
  ].slice(0, 15)

  const resetConversation = () => {
    setMessages([])
    setSessionId(null)
    setQuery("")
    setLoading(false)
    setStreamingText("")
    chatDisabledRef.current = false
    try { sessionStorage.removeItem(CHAT_SESSION_KEY) } catch { /* ignore */ }
  }

  const handleSubmit = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim()
    if (!q || loading) return
    setQuery("")
    setMessages(prev => [...prev, { id: nextId(), role: "user", content: q }])
    setLoading(true)
    setStreamingText("")

    const startedAt = Date.now()
    let data: AssistantData | null = null
    const onToken = (t: string) => setStreamingText(prev => prev + t)

    try {
      let response: any = null

      // Conversational flow: create or reuse a chat session, fall back to single-shot.
      if (!chatDisabledRef.current) {
        let sid = sessionId
        if (!sid) {
          try {
            const r = await fetch("/api/chat/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
            if (!r.ok) throw new Error("no chat routes")
            const created = await r.json()
            if (created?.id == null) throw new Error("bad session response")
            sid = String(created.id)
            setSessionId(sid)
            try { sessionStorage.setItem(CHAT_SESSION_KEY, sid) } catch { /* ignore */ }
          } catch {
            chatDisabledRef.current = true
            sid = null
          }
        }
        if (sid) {
          try {
            response = await streamSSE(
              `/api/chat/sessions/${sid}/messages/stream`,
              { content: q, news2_score: news2Score ?? null },
              onToken,
            )
            if (!response) throw new Error("chat stream failed")
          } catch {
            chatDisabledRef.current = true
            response = null
          }
        }
      }

      if (!response) {
        setStreamingText("")
        try {
          response = await streamSSE(
            "/api/query/stream",
            { query: q, news2_score: news2Score ?? null },
            onToken,
          )
        } catch { /* fall through to non-streaming */ }
      }

      if (!response) {
        response = await querySOPs(q, news2Score !== null ? news2Score : undefined)
      }

      data = mapResponse(q, response, startedAt)
      setQueryHistory(prev => [{ query: q, confidence: response.confidence || 0.5, type: response.query_type || "query", timestamp: Date.now() }, ...prev].slice(0, 10))
    } catch {
      data = {
        query: q,
        answer: "",
        verification: emptyVerification(),
        sources: [],
        reasoning: "",
        faithfulness: null,
        sopConflicts: [],
        inlineCitations: [],
        followupQuestions: [],
        abstained: false,
        route: "no_evidence",
        generationMode: null,
        responseTimeMs: null,
        answerId: null,
        entities: {},
        needsClarification: false,
        clarificationQuestion: "",
        clarificationOptions: [],
        answeredAt: Date.now(),
        error: true,
      }
      setQueryHistory(prev => [{ query: q, confidence: 0, type: "error", timestamp: Date.now() }, ...prev].slice(0, 10))
    }

    setLoading(false)
    setStreamingText("")
    if (data) setMessages(prev => [...prev, { id: nextId(), role: "assistant", data }])
  }

  const lastAssistantId = [...messages].reverse().find(m => m.role === "assistant")?.id ?? null

  // Composer and patient-context toggle are defined once and placed
  // conditionally below: centered above an empty conversation, or pinned
  // after the thread once a conversation exists - so the page reads like a
  // real chat (history above, input where you'd expect it, near the latest
  // message) instead of a form bolted above a results list.
  const patientContextToggle = (
    <div className="mb-3">
      <button onClick={() => setShowPatientContext(!showPatientContext)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        {showPatientContext ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Activity className="w-4 h-4" />
        Add Patient Context (NEWS2)
      </button>
      <AnimatePresence>
        {showPatientContext && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-2">
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                NEWS2 (National Early Warning Score 2) is the NHS/Royal College of Physicians standard for scoring a
                patient&apos;s deterioration risk from six vital signs. Attaching a score lets Meridian frame its answer
                with matching urgency - e.g. surfacing escalation steps sooner for a high-risk patient - it does not
                change which SOP is retrieved, only how the answer is worded.
              </p>

              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted w-fit">
                {([
                  { key: "calculate" as const, label: "Calculate from vitals" },
                  { key: "manual" as const, label: "I already know the score" },
                ]).map((opt) => (
                  <button key={opt.key} onClick={() => setNews2Mode(opt.key)}
                    className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      news2Mode === opt.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {news2Mode === "manual" ? (
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium shrink-0">NEWS2 Score</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={news2Score ?? ""}
                    onChange={e => setNews2Score(e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="0-20"
                    className="w-24 px-3 py-1.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#0B6BCB]/40"
                  />
                  {news2Score !== null && (
                    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border", news2RiskConfig(news2Score).className)}>
                      {news2RiskConfig(news2Score).label}
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { key: "respRate" as const, label: "Resp. rate", unit: "/min" },
                      { key: "spo2" as const, label: "SpO₂", unit: "%" },
                      { key: "sbp" as const, label: "Systolic BP", unit: "mmHg" },
                      { key: "pulse" as const, label: "Pulse", unit: "bpm" },
                      { key: "temp" as const, label: "Temp", unit: "°C" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="text-xs text-muted-foreground">{f.label} ({f.unit})</label>
                        <input
                          type="number"
                          value={news2Vitals[f.key]}
                          onChange={(e) => setNews2Vitals((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#0B6BCB]/40"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs text-muted-foreground">Consciousness</label>
                      <select
                        value={news2Vitals.consciousness}
                        onChange={(e) => setNews2Vitals((prev) => ({ ...prev, consciousness: e.target.value as "alert" | "cvpu" }))}
                        className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#0B6BCB]/40">
                        <option value="alert">Alert</option>
                        <option value="cvpu">Confusion / Voice / Pain / Unresponsive</option>
                      </select>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={news2Vitals.onOxygen}
                      onChange={(e) => setNews2Vitals((prev) => ({ ...prev, onOxygen: e.target.checked }))}
                      className="rounded border-border" />
                    Patient is on supplemental oxygen
                  </label>
                  <div className="flex items-center gap-3 pt-1 border-t border-border">
                    {news2Score !== null ? (
                      <>
                        <span className="text-sm font-medium text-foreground">NEWS2 = {news2Score}</span>
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border", news2RiskConfig(news2Score).className)}>
                          {news2RiskConfig(news2Score).label}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Enter all five vitals to calculate the score.</span>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Applies to your next question. Higher scores indicate greater deterioration risk.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  const composer = (
    <div className="relative">
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
        placeholder={submitted ? "Ask a follow-up..." : "Ask a clinical SOP question..."}
        rows={3}
        className="w-full p-4 sm:pr-28 rounded-2xl bg-muted border border-border text-foreground placeholder:text-subtle caret-[#0B6BCB] resize-none focus:outline-none focus:ring-2 focus:ring-[#0B6BCB]/40 text-base"
      />
      <div className="max-sm:relative max-sm:mt-2 max-sm:justify-end absolute bottom-3 right-3 flex items-center gap-2">
        <VoiceRecorder onTranscript={(t) => { setQuery(t) }} />
        <button onClick={() => handleSubmit()} disabled={!query.trim() || loading}
          className="p-3 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )

  return (
    <AppShell>
      <div className="flex-1 p-4 sm:p-6 max-w-[880px] mx-auto w-full">
        <Breadcrumb items={[{ label: "Ask Meridian" }]} />

        {/* Chat header */}
        <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-foreground">Ask Meridian</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30">
                Research support only
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Ask questions across approved SOPs, external evidence, and protocol history.
            </p>
            <p className="text-[11px] text-subtle mt-0.5">
              Do not enter patient-identifiable information.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowHistory(!showHistory)}
              className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                showHistory ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30" : "border-border text-muted-foreground hover:text-foreground hover:border-input")}
              title="Query history">
              <History className="w-4 h-4" />
              History
            </button>
            {submitted && (
              <button onClick={resetConversation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:border-input transition-all"
                title="Start a new conversation">
                <RotateCcw className="w-4 h-4" />
                New conversation
              </button>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-1">
              <User className="w-3.5 h-3.5" />
              <span className="capitalize">{userRole}</span>
              {userRole === "admin" && <span className="px-1.5 py-0.5 rounded bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 text-[10px] font-semibold">ADMIN</span>}
              {userRole === "editor" && <span className="px-1.5 py-0.5 rounded bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 text-[10px] font-semibold">EDITOR</span>}
            </div>
          </div>
        </div>

        {/* Composer + suggested queries live above the empty state; once a
            conversation exists they move below the thread (see bottom). */}
        {!submitted && (
          <div className="mb-6">
            {patientContextToggle}
            {composer}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin sm:flex-wrap">
              {suggestedQueries.map((q) => (
                <button key={q} onClick={() => setQuery(q)}
                  className="px-3 py-1.5 rounded-lg bg-muted text-sm text-muted-foreground hover:text-foreground border border-border transition-colors whitespace-nowrap shrink-0 sm:whitespace-normal sm:shrink">
                  {q}
                </button>
              ))}
            </motion.div>
          </div>
        )}

        {/* Query History Panel */}
        <AnimatePresence>
          {showHistory && allHistory.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 rounded-2xl bg-card border border-border">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-[#0B6BCB]" />
                Recent Queries
              </h3>
              <div className="space-y-2">
                {allHistory.map((h) => (
                  <button key={h.timestamp} onClick={() => { setQuery(h.query); setShowHistory(false) }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-muted border border-transparent hover:border-border transition-all group">
                    <div className="flex items-center justify-between">
                      <span className="text-sm truncate flex-1 mr-3">{h.query}</span>
                      <span className={cn("text-xs font-mono shrink-0", h.confidence >= 0.7 ? "text-[#15803D] dark:text-green-400" : h.confidence >= 0.5 ? "text-[#B45309] dark:text-amber-400" : "text-[#B91C1C] dark:text-red-400")}>
                        {Math.round(h.confidence * 100)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!submitted && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-[#0B6BCB]" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ask a Clinical SOP Question</h2>
            <p className="text-muted-foreground text-sm max-w-md">
              Type or speak your question. Answers stay in one conversation so you can ask follow-ups.
            </p>
          </motion.div>
        )}

        {/* Conversation Thread */}
        <div className="space-y-5">
          {messages.map((m) => {
            if (m.role === "user") {
              return (
                <div key={m.id} id={`msg-${m.id}`} className="flex justify-end scroll-mt-20">
                  <div className="max-w-[85%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[#0B6BCB]/[0.08] border border-[#0B6BCB]/15 text-[15px] leading-relaxed text-foreground">
                    {m.content}
                  </div>
                </div>
              )
            }
            return (
              <ChatAnswerMessage
                key={m.id}
                data={m.data}
                onFollowup={(q) => handleSubmit(q)}
                readingLevel={readingLevel}
                onReadingLevelChange={changeReadingLevel}
                isLatest={m.id === lastAssistantId && !loading}
              />
            )
          })}

          {/* Inline processing pipeline where the next answer will appear.
              Once real tokens start arriving from the self-hosted model,
              swap the fake stage timer for the live text itself - the
              growing answer is a clearer progress signal than a checklist. */}
          <AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {streamingText ? (
                  <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm">
                    <AnswerRenderer text={streamingText} citations={[]} />
                    <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#0B6BCB] animate-pulse align-text-bottom" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <PipelineStages currentStage={currentStage} />
                    <AnswerSkeleton />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={threadEndRef} />
        </div>

        {/* Composer follows the thread once a conversation exists, like a
            real chat input, and stays pinned to the bottom of the viewport
            instead of scrolling away above the messages it's about to add
            to. */}
        {submitted && (
          <div className="sticky bottom-0 mt-6 pt-4 pb-4 border-t border-border bg-background/95 backdrop-blur-sm">
            {patientContextToggle}
            {composer}
          </div>
        )}
      </div>
    </AppShell>
  )
}
