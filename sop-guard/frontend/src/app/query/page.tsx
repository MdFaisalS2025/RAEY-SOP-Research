"use client"

import { useState, useEffect, useRef, useLayoutEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Send,
  History,
  RotateCcw,
  ShieldAlert,
  Square,
  Pencil,
  MessageSquare,
  Trash2,
} from "lucide-react"
import { type InlineCitation } from "@/components/query/citation-chip"
import { AnswerRenderer } from "@/components/query/answer-renderer"
import { ChatAnswerMessage } from "@/components/query/chat-answer-message"
import { READING_LEVEL_KEY, type ReadingLevel } from "@/components/query/plain-language"
import AppShell from "@/components/layout/app-shell"
import { SafetyNote } from "@/components/ui/safety-note"
import { VoiceRecorder } from "@/components/voice/voice-recorder"
import { cn } from "@/lib/utils"

const suggestedQueries = [
"What are the steps for sepsis management?",
"What is the maximum norepinephrine dose?",
"What contraindications apply before blood transfusion?",
"What should a nurse monitor after central line insertion?",
]

// Answers are typed out for the reader rather than popping in whole - see
// the revealedText buffer below. Structured/cached/special-intent answers
// (most of the demo's best content) arrive from the backend as a single
// SSE token event carrying the entire answer at once (routes_chat.py's
// special-intent branch, pipeline.py's cache hit) - there's nothing to
// progressively reveal at the network layer, so pacing has to happen
// client-side regardless of how the text arrived.
//
// A line that already looks like a numbered step / bullet / table row /
// heading / "Label: value" pair is held back until it's complete, then
// revealed in one jump instead of word-by-word - typing out "1." then
// " Screen" then " with" reads as broken, not "typed". Matches the same
// line-shape heuristics parseAnswer() uses in answer-renderer.tsx.
const STRUCTURED_LINE_RE = /^(#{1,3}\s+|\d+[.)]\s+|[-*]\s+|[A-Z][A-Za-z /]{1,28}:\s+\S|>\s+)/

/** Given the full text received so far (`target`) and how much of it has
 * already been revealed (`revealedLen`), returns the next reveal length:
 * the next word boundary for prose, or the end of the current line if that
 * line is complete and looks structured (held at the current length -
 * i.e. no progress - until the line finishes, so it always snaps in whole
 * rather than partially). */
function nextRevealLen(target: string, revealedLen: number): number {
  if (revealedLen >= target.length) return target.length
  const lineStart = target.lastIndexOf("\n", Math.max(revealedLen - 1, 0)) + 1
  const newlineIdx = target.indexOf("\n", lineStart)
  const lineComplete = newlineIdx !== -1
  const lineEnd = lineComplete ? newlineIdx + 1 : target.length
  const lineSoFar = target.slice(lineStart, lineComplete ? newlineIdx : target.length)
  if (STRUCTURED_LINE_RE.test(lineSoFar.trimStart())) {
    return lineComplete ? lineEnd : revealedLen
  }
  const spaceIdx = target.indexOf(" ", revealedLen)
  if (spaceIdx === -1 || spaceIdx >= lineEnd) return lineComplete ? lineEnd : target.length
  return spaceIdx + 1
}

// Base pace for small/live increments (feels like natural typing); scales
// up for a large backlog (e.g. an entire cached answer landing at once) so
// it still finishes within REVEAL_MAX_MS instead of crawling.
const REVEAL_BASE_CPS = 45
const REVEAL_MAX_MS = 2200

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
  /** Set when the reader clicked Stop mid-generation - the answer text is
   * whatever had streamed in by that point, not a complete response. */
  stopped?: boolean
  /** Set when the conversational (session-backed) path failed and this
   * answer was generated by the stateless fallback instead - it was
   * answered without the conversation history the session path would
   * have sent, so a follow-up referencing earlier turns may not land. */
  contextDegraded?: boolean
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
  signal?: AbortSignal,
): Promise<any | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
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

// A single quiet line - a pulsing dot plus a rotating status phrase, in the
// same idiom as Claude/ChatGPT/Copilot - instead of a full card-shaped
// skeleton. The old skeleton (a bordered Card with 8 shimmer bars and 3
// avatar rows, ~320px tall) was meant to read as "the answer is forming"
// but at that size it read as a large empty box. A step-by-step trace of
// internal pipeline stages wouldn't tell the reader anything useful about
// a 30-50s wait either, so this stays a single rotating line, just smaller.
const LOADING_PHRASES = ["Searching approved SOPs…", "Reviewing clinical evidence…", "Preparing answer…"]

function AnswerLoadingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(0)
  useEffect(() => {
    // Chained setTimeout, not setInterval: LOADING_PHRASES is a one-way
    // progression (there's nothing to cycle back to), so the timer should
    // stop once it reaches the last phrase instead of firing forever.
    if (phraseIndex >= LOADING_PHRASES.length - 1) return
    const t = setTimeout(() => setPhraseIndex((i) => i + 1), 1800)
    return () => clearTimeout(t)
  }, [phraseIndex])
  return (
    <>
      {/* Sibling to the aria-hidden visual below, not nested inside it -
          screen readers get the phase text ("Searching approved SOPs…" etc.)
          without the decorative dot/shimmer being announced. */}
      <span role="status" aria-live="polite" className="sr-only">{LOADING_PHRASES[phraseIndex]}</span>
      {/* px-1 matches the streaming shell below (and ChatAnswerMessage's
          answer body) so the phrase and the first token share a left edge -
          nothing shifts horizontally when this is replaced. */}
      <div className="flex items-center gap-2 px-1 py-1" aria-hidden="true">
        <span className="loading-dot w-1.5 h-1.5 rounded-full bg-[#0B6BCB] shrink-0" />
        <span className="text-shimmer text-sm leading-5">{LOADING_PHRASES[phraseIndex]}</span>
      </div>
    </>
  )
}

// A sent question, with a hover-revealed Edit affordance (Claude/ChatGPT
// pattern) - editing and saving discards this message and everything
// after it, then resubmits the edited text as a new turn, exactly like
// asking again with a corrected question.
function UserMessageBubble({ content, onEdit }: { content: string; onEdit: (newText: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => { if (editing) { taRef.current?.focus(); taRef.current?.select() } }, [editing])

  if (editing) {
    return (
      <div className="w-full max-w-[85%] sm:max-w-[65%] ml-auto">
        <textarea
          ref={taRef}
          aria-label="Edit question"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setEditing(false); setDraft(content) }
            if (e.key === "Enter" && !e.shiftKey && draft.trim()) { e.preventDefault(); setEditing(false); onEdit(draft.trim()) }
          }}
          rows={Math.min(8, draft.split("\n").length + 1)}
          className="w-full px-4 py-2.5 rounded-2xl border border-[#0B6BCB]/40 bg-card text-[15px] leading-relaxed text-foreground resize-none focus:outline-none"
        />
        <div className="flex justify-end gap-2 mt-1.5">
          <button onClick={() => { setEditing(false); setDraft(content) }}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button onClick={() => { setEditing(false); onEdit(draft.trim()) }} disabled={!draft.trim()}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0B6BCB] hover:bg-[#0959AC] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Save &amp; Submit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-1 justify-end">
      <button onClick={() => setEditing(true)} title="Edit and resend" aria-label="Edit and resend"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted shrink-0">
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <div className="max-w-[85%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[#0B6BCB]/[0.08] border border-[#0B6BCB]/15 text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
        {content}
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
  // Screen-reader-only completion announcement: fires once per answer when
  // `loading` flips back to false, giving non-visual users a clear signal
  // without literally announcing every typed word of the reveal (that would
  // be unusably noisy - the typewriter effect is a sighted-user affordance).
  const [completionAnnouncement, setCompletionAnnouncement] = useState("")
  const wasLoadingRef = useRef(false)
  useEffect(() => {
    if (wasLoadingRef.current && !loading) setCompletionAnnouncement("Answer ready")
    else if (loading) setCompletionAnnouncement("")
    wasLoadingRef.current = loading
  }, [loading])
  const [streamingText, setStreamingText] = useState("")
  // What's actually shown while an answer is in flight - paced toward
  // streamingText by the RAF loop below instead of rendering the full
  // buffer the instant it arrives, so a one-shot cached/special-intent
  // answer still reads as typed rather than popping in whole.
  const [revealedText, setRevealedText] = useState("")
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; confidence: number; type: string; timestamp: number }>>([])
  const [showHistory, setShowHistory] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)
  // Past conversations (distinct from the query-only History popover
  // above) - opening one loads its full thread via loadSession, closing
  // the gap where History only ever filled the composer with a past
  // question rather than actually reopening a conversation.
  const [showConversations, setShowConversations] = useState(false)
  const [conversations, setConversations] = useState<Array<{ id: number; title: string; created_at: string; message_count: number }> | null>(null)
  const conversationsRef = useRef<HTMLDivElement>(null)
  // Respects the Voice Input toggle on Settings ("meridian-settings" in
  // localStorage) - that toggle previously had no consumer anywhere, so
  // turning it off did nothing. Defaults to on (matches the toggle's
  // own default) if unset or unreadable.
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(true)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("meridian-settings")
      if (stored) {
        const s = JSON.parse(stored)
        if (typeof s.voiceEnabled === "boolean") setVoiceInputEnabled(s.voiceEnabled)
      }
    } catch { /* ignore */ }
  }, [])
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

  // Lets Stop actually cancel an in-flight generation - see handleStop.
  const abortControllerRef = useRef<AbortController | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)
  const wasNearBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)
  const streamingTextRef = useRef("")
  const revealedTextRef = useRef("")
  // Sticky composer + the growing skeleton/streaming-answer placeholder -
  // both are measured to reserve scroll room per turn (see the spacer
  // effect below) instead of the hardcoded pixel guess this replaced.
  const composerWrapRef = useRef<HTMLDivElement | null>(null)
  const growingContentRef = useRef<HTMLDivElement | null>(null)
  const [spacerPx, setSpacerPx] = useState(0)
  useEffect(() => { streamingTextRef.current = streamingText }, [streamingText])
  useEffect(() => { revealedTextRef.current = revealedText }, [revealedText])

  // Paces revealedText toward streamingText for the lifetime of the page -
  // idle (no-op, same state reference so React bails out of re-rendering)
  // whenever there's nothing new to reveal. Runs once; reduced-motion users
  // skip pacing and always see the full buffer immediately.
  //
  // Deliberately setInterval, not requestAnimationFrame: rAF is throttled
  // to near-zero (and can be suspended entirely, confirmed live - it never
  // fired once in a background/non-composited tab during testing) whenever
  // the tab isn't the foreground, actively-rendering one. A clinician very
  // plausibly leaves Ask Meridian in a background tab while an answer
  // generates; rAF-driven pacing would silently strand the reveal there
  // forever. setInterval keeps firing (browsers clamp its rate in
  // background tabs, but never fully suspend it), so the buffer always
  // keeps moving and finalization is never stuck waiting on it.
  useEffect(() => {
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const TICK_MS = 40
    let lastTs = performance.now()
    const intervalId = setInterval(() => {
      const ts = performance.now()
      try {
        const target = streamingTextRef.current
        setRevealedText((prev) => {
          if (prev.length >= target.length) return prev.length === target.length ? prev : target
          if (reduceMotion) return target
          const backlog = target.length - prev.length
          const cps = Math.max(REVEAL_BASE_CPS, backlog / (REVEAL_MAX_MS / 1000))
          const dt = (ts - lastTs) / 1000
          let budget = Math.max(1, Math.round(cps * dt))
          let next = prev.length
          while (budget > 0) {
            const advanced = nextRevealLen(target, next)
            if (advanced === next) break
            budget -= advanced - next
            next = advanced
          }
          return next === prev.length ? prev : target.slice(0, next)
        })
      } catch (err) {
        // Pacing is presentation-only - never let a bug here strand the
        // answer mid-reveal. Log it, then jump straight to the full text
        // so the conversation still completes.
        console.error("reveal tick failed", err)
        setRevealedText(streamingTextRef.current)
      }
      lastTs = ts
    }, TICK_MS)
    return () => clearInterval(intervalId)
  }, [])

  /** Resolves once revealedText has caught up to `target` (or maxWaitMs
   * elapses) - used right before finalizing an answer so the typing
   * animation finishes instead of being cut off mid-word. setTimeout, not
   * requestAnimationFrame - see the reveal-loop comment above; the same
   * background-tab throttling would otherwise strand this await forever. */
  function waitForRevealCatchUp(target: string, maxWaitMs = 3000): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now()
      const check = () => {
        if (revealedTextRef.current.length >= target.length || performance.now() - start > maxWaitMs) {
          resolve()
          return
        }
        setTimeout(check, 40)
      }
      check()
    })
  }

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

  // Loads a chat session's full message history, non-lossy: each
  // assistant message is rehydrated through the same mapResponse() used
  // for a live answer (backed by the `extra` column persisted at
  // generation time - see routes_chat.py's _persist_chat_messages) rather
  // than filling in blank defaults, so the Version History link,
  // generation-mode tag, follow-up chips and Trust panel contents all
  // survive a reload instead of silently vanishing.
  const loadSession = (sid: string): Promise<boolean> => {
    return fetch(`/api/chat/sessions/${sid}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((session: any) => {
        if (!Array.isArray(session?.messages)) return false
        const restored: ChatMessage[] = []
        let pendingQuery = ""
        for (const m of session.messages) {
          if (m.role === "user") {
            pendingQuery = String(m.content ?? "")
            restored.push({ id: nextId(), role: "user" as const, content: pendingQuery })
            continue
          }
          const extra = (m.extra && typeof m.extra === "object") ? m.extra : {}
          const synthetic = {
            answer: m.content ?? "",
            confidence: extra.confidence,
            verification_result: extra.verification_result ?? null,
            retrieved_chunks: [],
            reasoning_trace: [],
            sop_conflicts: [],
            inline_citations: m.citations ?? [],
            followup_questions: extra.followup_questions ?? [],
            abstained: extra.abstained ?? /not covered in the available SOPs/i.test(String(m.content ?? "")),
            route: extra.route ?? "sop_library",
            generation_mode: extra.generation_mode ?? "",
            answer_id: null,
            entities: {},
            confidence_tier: extra.confidence_tier ?? "",
            numeric_verification: extra.numeric_verification ?? null,
          }
          const data = mapResponse(pendingQuery, synthetic, m.created_at ? new Date(m.created_at).getTime() : Date.now())
          data.answeredAt = m.created_at ? new Date(m.created_at).getTime() : Date.now()
          restored.push({ id: nextId(), role: "assistant" as const, data })
        }
        setMessages(restored)
        setSessionId(sid)
        return true
      })
      .catch(() => false)
  }

  // Restore chat session on mount
  useEffect(() => {
    const sid = localStorage.getItem(CHAT_SESSION_KEY)
    if (!sid) return
    loadSession(sid).then(ok => { if (!ok) localStorage.removeItem(CHAT_SESSION_KEY) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track whether the reader is already near the bottom, so a new answer
  // never yanks them away from something they scrolled up to read. The
  // threshold is the sticky composer's real height (not a pixel guess) -
  // a guess smaller than the composer could read "near bottom" as false
  // even while the composer is fully visible, silently disabling the
  // follow-scroll below.
  useEffect(() => {
    const updateNearBottom = () => {
      const scrollable = document.documentElement
      const composerH = composerWrapRef.current?.offsetHeight ?? 160
      wasNearBottomRef.current =
        window.innerHeight + window.scrollY >= scrollable.scrollHeight - composerH - 24
    }
    updateNearBottom()
    window.addEventListener("scroll", updateNearBottom, { passive: true })
    window.addEventListener("resize", updateNearBottom)
    return () => {
      window.removeEventListener("scroll", updateNearBottom)
      window.removeEventListener("resize", updateNearBottom)
    }
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

  // Reserves scroll room for the turn currently in flight, so the document
  // never gets SHORTER while the reader is scrolled to (or past) its
  // current bottom - that shrink-while-pinned-to-bottom is what forces the
  // browser to clamp scrollY, which reads as the page jumping up.
  //
  // spacerPx tops up whatever the growing loading-indicator/streaming
  // placeholder is short of one full viewport (minus the sticky composer),
  // so the combined height never drops below what it was when the turn
  // started, and shrinks to 0 automatically once the real answer grows
  // past that. Now that the loading indicator (~28px) is roughly the same
  // height as the first sliver of streamed text (~27px), the skeleton-to-
  // stream transition itself no longer collapses the document by any
  // meaningful amount - this spacer's remaining job is long answers
  // outgrowing the reserved room, not masking a height cliff.
  //
  // useLayoutEffect, not useEffect: recompute() must land before the
  // browser paints the first frame of a new turn, so there's never a
  // paint where the spacer hasn't caught up yet.
  useLayoutEffect(() => {
    if (!loading) { setSpacerPx(0); return }
    const el = growingContentRef.current
    if (!el) return
    const recompute = () => {
      const composerH = composerWrapRef.current?.offsetHeight ?? 0
      const needed = window.innerHeight - composerH
      setSpacerPx(Math.max(0, needed - el.offsetHeight))
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    window.addEventListener("resize", recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", recompute)
    }
  }, [loading])

  // Gentle follow-scroll while an answer is streaming in - but only once
  // the growing content has actually outgrown the reserved spacer (i.e.
  // it would overflow the viewport), and only when the reader is already
  // at the bottom. With the spacer above holding position steady for
  // normal-length answers, this now only fires for genuinely long ones,
  // and uses an explicit instant jump rather than relying on `scroll-
  // behavior: smooth` (removed globally - see globals.css), which used to
  // turn every 40ms reveal tick into a competing, never-finishing glide.
  useEffect(() => {
    if (!loading || !revealedText || !wasNearBottomRef.current) return
    if (spacerPx > 0) return
    threadEndRef.current?.scrollIntoView({ behavior: "instant", block: "end" })
  }, [revealedText, loading, spacerPx])

  // Click-outside/Escape close for the History popover (role-switcher.tsx /
  // answer-action-toolbar.tsx pattern), only attached while open.
  useEffect(() => {
    if (!showHistory) return
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) setShowHistory(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setShowHistory(false) }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [showHistory])

  // Click-outside/Escape close for the Conversations popover, and a fresh
  // fetch each time it opens (a session finished elsewhere - or deleted -
  // since the last open shouldn't show stale data).
  useEffect(() => {
    if (!showConversations) return
    fetch("/api/chat/sessions")
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => setConversations(Array.isArray(d?.sessions) ? d.sessions : []))
      .catch(() => setConversations([]))
    const handleClickOutside = (e: MouseEvent) => {
      if (conversationsRef.current && !conversationsRef.current.contains(e.target as Node)) setShowConversations(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setShowConversations(false) }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [showConversations])

  const handleOpenConversation = async (id: number) => {
    setShowConversations(false)
    const ok = await loadSession(String(id))
    if (ok) { try { localStorage.setItem(CHAT_SESSION_KEY, String(id)) } catch { /* ignore */ } }
  }

  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setConversations(prev => prev ? prev.filter(c => c.id !== id) : prev)
    try {
      await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" })
    } catch { /* best-effort - it'll reappear on next open if this failed */ }
    if (sessionId === String(id)) resetConversation()
  }

  const allHistory = [
    ...queryHistory,
    ...serverHistory
      .filter(sh => !queryHistory.some(qh => qh.query === sh.query))
      .map(sh => ({ query: sh.query, confidence: sh.confidence, type: sh.query_type, timestamp: new Date(sh.timestamp).getTime() }))
  ].slice(0, 15)

  const resetConversation = () => {
    abortControllerRef.current?.abort()
    setMessages([])
    setSessionId(null)
    setQuery("")
    setLoading(false)
    setStreamingText("")
    setRevealedText("")
    try { localStorage.removeItem(CHAT_SESSION_KEY) } catch { /* ignore */ }
    // The submitted->empty-state transition remounts the composer (same
    // reason as the effect above), so put focus back on it explicitly
    // rather than leaving it stranded on the button just clicked.
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  // Cancels the in-flight generation. Whatever text had streamed in so far
  // is kept as the final answer (marked `stopped`) rather than discarded -
  // there is no retry chain after a user-initiated stop.
  const handleStop = () => {
    abortControllerRef.current?.abort()
  }

  // Discards the latest answer and asks the same question again -
  // without re-appending the question itself (it's already in the
  // thread; only the answer to it is being replaced).
  const handleRegenerate = (q: string) => {
    if (loading) return
    setMessages(prev => prev.slice(0, -1))
    handleSubmit(q, true, true)
  }

  // Edit-and-resend: drops the edited message and everything after it
  // (its old answer, and any later turns that were built on top of it),
  // then resubmits the edited text as a fresh question.
  const handleEditResend = (messageId: string, newText: string) => {
    if (!newText || loading) return
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId)
      return idx === -1 ? prev : prev.slice(0, idx)
    })
    handleSubmit(newText, true)
  }

  // `skipUserMessage` is Regenerate's escape hatch: it needs everything
  // else handleSubmit does (PHI gate bypassed, generate, finalize) but
  // must NOT append a new user bubble - the question was already asked,
  // regenerate is only replacing the answer to it.
  const handleSubmit = async (overrideQuery?: string, skipPhiGate = false, skipUserMessage = false) => {
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
    if (!skipUserMessage) setMessages(prev => [...prev, { id: nextId(), role: "user", content: q }])
    setLoading(true)
    setStreamingText("")
    setRevealedText("")

    const controller = new AbortController()
    abortControllerRef.current = controller

    const startedAt = Date.now()
    let data: AssistantData | null = null
    const onToken = (t: string) => setStreamingText(prev => prev + t)

    try {
      let response: any = null
      // True once the conversational (session-backed) attempt below has
      // failed and the stateless fallback below has taken over - surfaced
      // on the answer as `contextDegraded` so the reader knows this
      // specific turn didn't have the conversation history behind it.
      let usedFallback = false

      // Primary: conversational flow via a chat session, so the backend
      // sees prior turns. Always attempted fresh each turn (no permanent
      // "chat is broken, don't bother" latch) - a session or a single
      // request failing once shouldn't silently and permanently drop
      // conversation memory for the rest of the page's life, which is
      // exactly what a sticky disable flag here used to do.
      try {
        let sid = sessionId
        if (!sid) {
          const r = await fetch("/api/chat/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: controller.signal })
          if (!r.ok) throw new Error("no chat routes")
          const created = await r.json()
          if (created?.id == null) throw new Error("bad session response")
          sid = String(created.id)
          setSessionId(sid)
          try { localStorage.setItem(CHAT_SESSION_KEY, sid) } catch { /* ignore */ }
        }
        response = await streamSSE(
          `/api/chat/sessions/${sid}/messages/stream`,
          { content: q },
          onToken,
          controller.signal,
        )
        if (!response) throw new Error("chat stream failed")
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err
        response = null
      }

      // Exactly one fallback, not a chain of three - a second and third
      // full generation off one flaky connection cost 90s+ and looked
      // like the answer vanishing and restarting from a blank skeleton.
      if (!response) {
        usedFallback = true
        setStreamingText("")
        setRevealedText("")
        response = await streamSSE("/api/query/stream", { query: q }, onToken, controller.signal)
        if (!response) throw new Error("fallback stream failed")
      }

      data = mapResponse(q, response, startedAt)
      if (usedFallback) data.contextDegraded = true
      setQueryHistory(prev => [{ query: q, confidence: response.confidence || 0.5, type: response.query_type || "query", timestamp: Date.now() }, ...prev].slice(0, 10))
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Stopped by the reader - keep whatever had already streamed in
        // rather than discarding it as an error.
        data = {
          query: q,
          answer: streamingTextRef.current,
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
          stopped: true,
        }
      } else {
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
    }

    // Let the typing animation finish catching up to the authoritative
    // final answer text (which can differ slightly from the raw streamed
    // tokens - e.g. numeric redaction applied post-generation) before
    // swapping in the finalized message, so finalization only adds the
    // caption line/source strip/toolbar rather than also cutting the
    // typing effect short.
    if (data) {
      setStreamingText(data.answer)
      await waitForRevealCatchUp(data.answer)
    }
    setLoading(false)
    setStreamingText("")
    setRevealedText("")
    abortControllerRef.current = null
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

  // The composer is one JSX value (`composer` below) rendered into two
  // mutually-exclusive parent trees - the centered empty-state block and
  // the sticky footer - so React unmounts/remounts it, and the textarea,
  // the moment the first message flips `submitted` from false to true.
  // That silently drops keyboard focus after the very first send. Put it
  // back on the newly-mounted textarea rather than restructuring the two
  // layouts into one (a bigger, riskier change for a one-line symptom).
  useEffect(() => {
    if (submitted) textareaRef.current?.focus()
  }, [submitted])

  // Focus the composer on first load too, like Claude/ChatGPT - a fresh
  // visit should be ready to type immediately.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const canSend = !!query.trim() && !loading && !(phi?.has_phi && !phiAcknowledged)

  const composer = (
    <div className="rounded-2xl border border-border bg-muted focus-within:ring-2 focus-within:ring-[#0B6BCB]/40 transition-shadow">
      <textarea
        ref={textareaRef}
        aria-label={submitted ? "Ask a follow-up question" : "Ask about a protocol or procedure"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSubmit() } }}
        placeholder={submitted ? "Ask a follow-up…" : "Ask about a protocol or procedure…"}
        rows={1}
        className="w-full bg-transparent border-0 px-4 pt-3.5 pb-1 resize-none focus:outline-none focus:ring-0 text-foreground placeholder:text-subtle caret-[#0B6BCB] text-base max-h-[200px] overflow-y-auto"
      />
      <div className="flex items-center justify-end gap-1.5 px-2.5 pb-2.5">
        {voiceInputEnabled && (
          <VoiceRecorder onTranscript={(t) => {
            // Append to, rather than replace, anything already typed -
            // voice input is a second way to add to the question, not a
            // reset of it.
            setQuery(q => (q.trim() ? `${q.trim()} ${t}` : t))
          }} />
        )}
        <button
          onClick={loading ? handleStop : () => handleSubmit()}
          disabled={loading ? false : !canSend}
          title={loading ? "Stop generating" : phi?.has_phi && !phiAcknowledged ? "Possible patient identifier detected - redact or confirm before sending" : "Send"}
          aria-label={loading ? "Stop generating" : "Send"}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0">
          {loading ? <Square className="w-3.5 h-3.5 fill-current" /> : <Send className="w-4 h-4" />}
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

  // Focus-mode chrome (see AppShell's chrome="minimal"): New chat,
  // Conversations and History used to live in this page's own header row
  // under the full TopNav. That row is gone - these same controls (moved
  // verbatim, including their popovers' click-outside/Escape effects,
  // which live in refs/effects elsewhere in this component and are
  // untouched by this move) now render inside FocusBar's slim bar instead.
  const chromeActions = (
    <div className="flex items-center gap-1">
      <button onClick={resetConversation}
        className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Start a new conversation">
        <RotateCcw className="w-4 h-4" />
        <span className="hidden sm:inline">New chat</span>
      </button>
      <div className="relative" ref={conversationsRef}>
        <button onClick={() => setShowConversations(!showConversations)}
          className={cn("inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors",
            showConversations ? "bg-[#0B6BCB]/10 text-[#0B6BCB]" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
          title="Past conversations" aria-expanded={showConversations} aria-haspopup="menu">
          <MessageSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Conversations</span>
        </button>
        {showConversations && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute right-0 top-full mt-1.5 z-30 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-card border border-border shadow-lg">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0B6BCB]" />
              Conversations
            </h3>
            {conversations === null ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No saved conversations yet - ask a question to start one.</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {conversations.map((c) => (
                  <div key={c.id}
                    onClick={() => handleOpenConversation(c.id)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOpenConversation(c.id) } }}
                    className={cn("w-full text-left p-2.5 rounded-xl hover:bg-muted border border-transparent hover:border-border transition-all cursor-pointer flex items-center gap-2 group",
                      sessionId === String(c.id) && "bg-[#0B6BCB]/[0.06] border-[#0B6BCB]/20")}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{c.title || "New conversation"}</p>
                      <p className="text-xs text-muted-foreground">{Math.ceil(c.message_count / 2)} {c.message_count === 2 ? "turn" : "turns"}</p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      title="Delete conversation" aria-label={`Delete conversation: ${c.title || "New conversation"}`}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-[#B91C1C] dark:hover:text-red-400 hover:bg-[#FEE2E2] dark:hover:bg-red-500/10 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
      <div className="relative" ref={historyRef}>
        <button onClick={() => setShowHistory(!showHistory)}
          className={cn("inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors",
            showHistory ? "bg-[#0B6BCB]/10 text-[#0B6BCB]" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
          title="Query history" aria-expanded={showHistory} aria-haspopup="menu">
          <History className="w-4 h-4" />
          <span className="hidden sm:inline">History</span>
        </button>
        {showHistory && allHistory.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute right-0 top-full mt-1.5 z-30 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-card border border-border shadow-lg">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-[#0B6BCB]" />
              Recent Queries
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
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
      </div>
    </div>
  )

  return (
    <AppShell chrome="minimal" chromeActions={chromeActions}>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
        {/* Empty state - greeting, composer, and suggested prompts as one
            vertically-centered block (Claude-style), instead of the
            composer pinned at the very top with a lone title stranded in
            the empty space below it. min-h accounts for FocusBar's 52px
            (vs. the old ~106px TopNav+header combo) plus this container's
            own p-4/sm:p-6 padding, so the block still centers in the
            actual remaining viewport instead of sitting high with dead
            space below it. */}
        {!submitted && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="min-h-[calc(100dvh-52px-2rem)] sm:min-h-[calc(100dvh-52px-3rem)] flex flex-col items-center justify-center gap-6">
            <div className="text-center">
              {/* Real h1 now that the page header row (which held one) is
                  gone - promoted from h2 rather than adding a second,
                  duplicate heading. */}
              <h1 className="text-3xl font-semibold text-foreground">Ask Meridian</h1>
              <p className="text-sm text-muted-foreground mt-1.5">Search approved SOPs and clinical evidence.</p>
            </div>
            <div className="w-full">
              {composer}
              <SafetyNote className="mt-2" />
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin sm:flex-wrap sm:justify-center">
                {suggestedQueries.map((q) => (
                  <button key={q} onClick={() => handleSubmit(q)}
                    className="px-3 py-1.5 rounded-lg bg-muted text-sm text-muted-foreground hover:text-foreground border border-border transition-colors whitespace-nowrap shrink-0 sm:whitespace-normal sm:shrink">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* The empty-state h1 above unmounts once submitted - this keeps
            the document outline valid without a second visible heading. */}
        {submitted && <h1 className="sr-only">Ask Meridian</h1>}

        {/* Conversation Thread */}
        <div className="space-y-5">
          {messages.map((m) => {
            if (m.role === "user") {
              return (
                <div key={m.id} id={`msg-${m.id}`} className="scroll-mt-20">
                  <UserMessageBubble content={m.content} onEdit={(newText) => handleEditResend(m.id, newText)} />
                </div>
              )
            }
            return (
              <ChatAnswerMessage
                key={m.id}
                data={m.data}
                onFollowup={(q) => handleSubmit(q)}
                onRetry={m.data.error ? () => handleSubmit(m.data.query) : undefined}
                onRegenerate={m.id === lastAssistantId && !m.data.error && !m.data.stopped ? () => handleRegenerate(m.data.query) : undefined}
                readingLevel={readingLevel}
                onReadingLevelChange={changeReadingLevel}
                isLatest={m.id === lastAssistantId}
              />
            )
          })}

          {/* Inline placeholder where the next answer will appear. Once
              real tokens start arriving from the model, the growing text
              itself is the progress signal; before that, a single quiet
              loading line - no card, no fake step checklist. No
              AnimatePresence/exit here on purpose: an exit-animated node
              that doesn't unmount cleanly (seen live - the indicator stayed
              mounted after `loading` had already gone false, per the Send
              button's own icon state) leaves a permanent ghost placeholder
              under a completed answer. A plain conditional removes the
              node the instant loading flips, so correctness doesn't depend
              on the exit transition completing. The streaming shell
              (`px-1`, no card border/shadow) matches ChatAnswerMessage's
              answer body exactly, so when `loading` flips false and this
              placeholder is replaced by the real message, the prose
              doesn't jump position or padding - only the caption line,
              source strip, and toolbar are new.
              No `minHeight` on this wrapper (there used to be one, pinned
              to the old skeleton's ~320px) - the loading indicator and the
              first sliver of streamed text are now close enough in height
              that there's nothing left to reserve against; see the
              spacerPx effect above for what actually guards the scroll
              position. */}
          {loading && (
            <motion.div
              ref={growingContentRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {revealedText ? (
                <div className="px-1">
                  <AnswerRenderer text={revealedText} citations={[]} streaming />
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#0B6BCB] animate-pulse align-text-bottom" />
                </div>
              ) : (
                <AnswerLoadingIndicator />
              )}
            </motion.div>
          )}
          {/* Tops up the space below the growing placeholder above to a
              full viewport (minus the composer) so the newest question can
              reach the top of the viewport and STAY there as the real
              answer fills in - see the spacerPx effect for the full
              rationale. Shrinks to 0 automatically once the answer is long
              enough to need no help. */}
          {loading && spacerPx > 0 && <div aria-hidden="true" style={{ height: spacerPx }} />}
          <div ref={threadEndRef} />
          <span role="status" aria-live="polite" className="sr-only">{completionAnnouncement}</span>
        </div>

        {/* Composer follows the thread once a conversation exists, like a
            real chat input, and stays pinned to the bottom of the viewport
            instead of scrolling away above the messages it's about to add
            to. */}
        {submitted && (
          <div ref={composerWrapRef} className="sticky bottom-0 mt-6 pt-4 pb-4 border-t border-border bg-background/95 backdrop-blur-sm">
            {composer}
            {/* Quieter here than the empty-state instance above (still a
                safety disclosure, not decoration - kept, just smaller and
                centered so it reads as a footnote once a conversation is
                already under way rather than competing with the composer
                for attention on every turn). */}
            <SafetyNote className="mt-1.5 text-[11px] text-center" />
          </div>
        )}
      </div>
    </AppShell>
  )
}
