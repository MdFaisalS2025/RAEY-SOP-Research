"use client"

import { useState, useEffect, useRef, useLayoutEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send,
  History,
  RotateCcw,
  ShieldAlert,
  Loader2,
} from "lucide-react"
import { type InlineCitation } from "@/components/query/citation-chip"
import { AnswerRenderer } from "@/components/query/answer-renderer"
import { ChatAnswerMessage } from "@/components/query/chat-answer-message"
import { READING_LEVEL_KEY, type ReadingLevel } from "@/components/query/plain-language"
import AppShell from "@/components/layout/app-shell"
import { SafetyNote } from "@/components/ui/safety-note"
import { VoiceRecorder } from "@/components/voice/voice-recorder"
import { querySOPs } from "@/lib/api"
import { cn } from "@/lib/utils"

const suggestedQueries = [
"What are the steps for sepsis management?",
"What is the maximum norepinephrine dose?",
"What contraindications apply before blood transfusion?",
"What should a nurse monitor after central line insertion?",
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
  /** "High Confidence" | "Moderate Confidence" | "Weak Match" | "No
   * Reliable Match" | "" (not computed, e.g. clarification/gap routes) -
   * see backend evidence_sufficiency.py's confidence_tier(). */
  confidenceTier: string
  /** True when the pipeline found a dose/threshold value in the generated
   * answer that wasn't grounded in the cited SOP and removed it from the
   * displayed text rather than show an unverified number as fact (see
   * verifier/numeric_verifier.py's redact_unsupported_claims). The answer
   * text itself already contains the "[value not confirmed...]" marker;
   * this flag is only used to surface a visible caution banner alongside it. */
  numericRedactionApplied: boolean
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
    confidenceTier: typeof ext.confidence_tier === "string" ? ext.confidence_tier : "",
    numericRedactionApplied: Boolean(
      ext.numeric_verification && typeof ext.numeric_verification === "object" &&
      (ext.numeric_verification as any).redacted
    ),
    answeredAt: Date.now(),
  }
}

// ─── Badges and small components ─────────────────────────────────────────────

// Pulsing placeholder shaped like the answer card that's about to arrive
// (heading, a few text lines, a couple of step rows) - a quiet shimmer
// reads as "the answer is forming" without the theatrics of a fake
// progress checklist, since a self-hosted model can take 30-50s per
// answer and a step-by-step list of internal pipeline stages doesn't
// actually tell the reader anything useful about that wait. A single
// rotating status line above it gives a sense of progress without
// exposing pipeline internals - closer to ChatGPT/Claude/Copilot's "..."
// than a research prototype's stage-by-stage trace.
const LOADING_PHRASES = ["Searching approved SOPs…", "Reviewing clinical evidence…", "Preparing answer…"]

function AnswerSkeleton() {
  const [phraseIndex, setPhraseIndex] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setPhraseIndex((i) => Math.min(i + 1, LOADING_PHRASES.length - 1)), 1800)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm space-y-4" aria-hidden="true">
      <p className="text-sm text-muted-foreground">{LOADING_PHRASES[phraseIndex]}</p>
      <div className="space-y-4 animate-pulse">
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
    </div>
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
  const [streamingText, setStreamingText] = useState("")
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; confidence: number; type: string; timestamp: number }>>([])
  const [showHistory, setShowHistory] = useState(false)
  const [serverHistory, setServerHistory] = useState<Array<{ id: number; query: string; confidence: number; query_type: string; timestamp: string }>>([])
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>("clinical")
  // PHI guard: result of scanning the current composer text (see
  // /api/privacy/scan). Soft-blocks sending until the user redacts or
  // explicitly confirms "Send anyway".
  const [phi, setPhi] = useState<{ has_phi: boolean; types: string[]; redacted_text: string } | null>(null)
  const [phiAcknowledged, setPhiAcknowledged] = useState(false)
  // Tracks which composer text `phi` was computed for, so a submit that
  // races ahead of the debounced scan can trigger a fresh synchronous check
  // instead of gating on a stale (or absent) result.
  const phiScannedTextRef = useRef<string>("")

  const chatDisabledRef = useRef(false)
  const threadEndRef = useRef<HTMLDivElement | null>(null)
  const wasNearBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)

  const submitted = messages.length > 0

  // Debounced PHI scan of the composer text. Skips very short input (no point
  // scanning "sepsis?") and clears the indicator when the box is emptied.
  useEffect(() => {
    // A new keystroke invalidates any prior acknowledgment - re-typing after
    // "Send anyway" re-gates on the new text.
    setPhiAcknowledged(false)
    const text = query.trim()
    if (text.length < 8) { setPhi(null); phiScannedTextRef.current = query; return }
    const t = setTimeout(() => {
      fetch("/api/privacy/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query }),
      })
        .then((r) => r.json())
        .then((d) => {
          setPhi({ has_phi: !!d.has_phi, types: d.types ?? [], redacted_text: d.redacted_text ?? query })
          phiScannedTextRef.current = query
        })
        .catch(() => setPhi(null))
    }, 400)
    return () => clearTimeout(t)
  }, [query])

  /** Ensures `phi` reflects the exact text about to be sent, running a
   * synchronous scan if the debounced background scan hasn't caught up yet
   * (e.g. a fast type-then-Enter). Returns the up-to-date PHI result. */
  async function scanForPhiBeforeSend(text: string) {
    if (phiScannedTextRef.current === text && phi) return phi
    try {
      const r = await fetch("/api/privacy/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      const d = await r.json()
      const result = { has_phi: !!d.has_phi, types: d.types ?? [], redacted_text: d.redacted_text ?? text }
      setPhi(result)
      phiScannedTextRef.current = text
      return result
    } catch {
      // Scan failed - don't block sending on a network hiccup (advisory
      // guard, fail-open), but don't claim a clean result either.
      return null
    }
  }

  useEffect(() => {
    fetch("/api/query/history?limit=10")
      .then(r => r.json())
      .then(data => { if (data.queries) setServerHistory(data.queries) })
      .catch(() => {})
  }, [messages.length])

  useEffect(() => {
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

  // Gentle follow-scroll while an answer is streaming in - but only when
  // the reader is already at the bottom (same wasNearBottomRef gate as the
  // new-question scroll above), so someone who has scrolled up to reread
  // an earlier answer is never yanked back down mid-generation.
  useEffect(() => {
    if (!loading || !streamingText || !wasNearBottomRef.current) return
    threadEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
  }, [streamingText, loading])

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

  const handleSubmit = async (overrideQuery?: string, skipPhiGate = false) => {
    const q = (overrideQuery ?? query).trim()
    if (!q || loading) return

    // PHI soft-block: only gate the user's own composer text (not
    // programmatic follow-up-question submits, which come from suggestions
    // rather than free text the user typed). `skipPhiGate` is set by the
    // explicit "Send anyway" action, so it bypasses re-checking rather than
    // relying on the `phiAcknowledged` state, which wouldn't have committed
    // yet if read in the same handler that just set it.
    if (overrideQuery === undefined && !skipPhiGate) {
      const result = await scanForPhiBeforeSend(query)
      if (result?.has_phi) return // amber warning + Send-anyway stays visible
    }

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
              { content: q },
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
            { query: q },
            onToken,
          )
        } catch { /* fall through to non-streaming */ }
      }

      if (!response) {
        response = await querySOPs(q)
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
        confidenceTier: "",
        numericRedactionApplied: false,
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

  // Auto-grow the composer textarea (1 row up to ~8 rows) instead of a fixed
  // rows={3} box - this also removes the need to reserve space for the
  // button row, since the buttons now live in their own flex row below the
  // text (in-flow), not absolutely positioned over the textarea's corner.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [query])

  const canSend = !!query.trim() && !loading && !(phi?.has_phi && !phiAcknowledged)

  const composer = (
    <div className="rounded-2xl border border-border bg-muted focus-within:ring-2 focus-within:ring-[#0B6BCB]/40 transition-shadow">
      <textarea
        ref={textareaRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
        placeholder={submitted ? "Ask a follow-up…" : "Ask about a protocol or procedure…"}
        rows={1}
        className="w-full bg-transparent border-0 px-4 pt-3.5 pb-1 resize-none focus:outline-none focus:ring-0 text-foreground placeholder:text-subtle caret-[#0B6BCB] text-base max-h-[200px] overflow-y-auto"
      />
      <div className="flex items-center justify-end gap-1.5 px-2.5 pb-2.5">
        <VoiceRecorder onTranscript={(t) => { setQuery(t) }} />
        <button
          onClick={() => handleSubmit()}
          disabled={!canSend}
          title={phi?.has_phi && !phiAcknowledged ? "Possible patient identifier detected - redact or confirm before sending" : "Send"}
          aria-label="Send"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {/* Only surfaces when a patient identifier is actually detected - a
          permanent "all clear" line under every keystroke is reassurance
          noise the default (clean) state doesn't need. */}
      {phi?.has_phi && (
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 px-4 pb-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
            <ShieldAlert className="w-3.5 h-3.5" />
            Possible patient identifier detected{phi.types.length ? ` (${phi.types.join(", ").toLowerCase()})` : ""} - sending is paused
          </span>
          <button
            onClick={() => setQuery(phi.redacted_text)}
            className="underline underline-offset-2 text-[#0B6BCB] dark:text-[#00E5FF] hover:opacity-80"
          >
            Redact before sending
          </button>
          <span className="text-subtle">·</span>
          <button
            onClick={() => { setPhiAcknowledged(true); handleSubmit(undefined, true) }}
            disabled={loading}
            className="underline underline-offset-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Send anyway
          </button>
        </div>
      )}
    </div>
  )

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        {/* Slim header - just page identity + the two thread-management
            actions. The old Viewer role chip duplicated the profile menu
            already in the top nav, so it's gone rather than repeated. */}
        <div className="mb-2 flex items-center justify-between gap-3">
          <h1 className="text-base font-semibold text-foreground">Ask Meridian</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHistory(!showHistory)}
              className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                showHistory ? "bg-[#0B6BCB]/10 text-[#0B6BCB]" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
              title="Query history">
              <History className="w-4 h-4" />
              History
            </button>
            {submitted && (
              <button onClick={resetConversation}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Start a new conversation">
                <RotateCcw className="w-4 h-4" />
                New conversation
              </button>
            )}
          </div>
        </div>

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

        {/* Empty state - greeting, composer, and suggested prompts as one
            vertically-centered block (Claude-style), instead of the
            composer pinned at the very top with a lone title stranded in
            the empty space below it. */}
        {!submitted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="min-h-[65vh] flex flex-col items-center justify-center gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-display font-semibold text-foreground">Ask Meridian</h2>
              <p className="text-sm text-muted-foreground mt-1.5">Search approved SOPs and clinical evidence.</p>
            </div>
            <div className="w-full">
              {composer}
              <SafetyNote className="mt-2" />
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin sm:flex-wrap sm:justify-center">
                {suggestedQueries.map((q) => (
                  <button key={q} onClick={() => setQuery(q)}
                    className="px-3 py-1.5 rounded-lg bg-muted text-sm text-muted-foreground hover:text-foreground border border-border transition-colors whitespace-nowrap shrink-0 sm:whitespace-normal sm:shrink">
                    {q}
                  </button>
                ))}
              </div>
            </div>
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

          {/* Inline placeholder where the next answer will appear. Once
              real tokens start arriving from the model, the growing text
              itself is the progress signal; before that, a quiet shimmer
              shaped like the answer that's coming - no fake step
              checklist. No AnimatePresence/exit here on purpose: an
              exit-animated node that doesn't unmount cleanly (seen live -
              the skeleton stayed mounted after `loading` had already gone
              false, per the Send button's own icon state) leaves a
              permanent ghost placeholder under a completed answer. A plain
              conditional removes the node the instant loading flips, so
              correctness doesn't depend on the exit transition completing.
              The streaming shell (`px-1`, no card border/shadow) matches
              ChatAnswerMessage's answer body exactly, so when `loading`
              flips false and this placeholder is replaced by the real
              message, the prose doesn't jump position or padding - only
              the caption line, source strip, and toolbar are new. */}
          {loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {streamingText ? (
                <div className="px-1">
                  <AnswerRenderer text={streamingText} citations={[]} streaming />
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#0B6BCB] animate-pulse align-text-bottom" />
                </div>
              ) : (
                <AnswerSkeleton />
              )}
            </motion.div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Composer follows the thread once a conversation exists, like a
            real chat input, and stays pinned to the bottom of the viewport
            instead of scrolling away above the messages it's about to add
            to. */}
        {submitted && (
          <div className="sticky bottom-0 mt-6 pt-4 pb-4 border-t border-border bg-background/95 backdrop-blur-sm">
            {composer}
            <SafetyNote className="mt-2" />
          </div>
        )}
      </div>
    </AppShell>
  )
}
