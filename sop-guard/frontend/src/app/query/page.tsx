"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send,
  ThumbsUp,
  XCircle,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Search,
  Sparkles,
  CheckCircle2,
  Circle,
  Loader2,
  X,
  BookOpen,
  Brain,
  Crosshair,
  Database,
  FlaskConical,
  Gauge,
  GitBranch,
  ExternalLink,
  Download,
  History,
  Clock,
  Printer,
  User,
  PlusCircle,
  BeakerIcon,
  Activity,
  SearchX,
  Layers,
  RotateCcw,
  Link2,
  Check,
} from "lucide-react"
import { type InlineCitation } from "@/components/query/citation-chip"
import { SourcePanel } from "@/components/query/source-panel"
import { PubMedEvidencePanel } from "@/components/query/pubmed-evidence-panel"
import { FollowupChips } from "@/components/query/followup-chips"
import { FeedbackRow } from "@/components/query/feedback-row"
import { AnswerRenderer } from "@/components/query/answer-renderer"
import { ReadingLevelToggle, simplifyAnswer, READING_LEVEL_KEY, type ReadingLevel } from "@/components/query/plain-language"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { OverrideModal } from "@/components/ui/override-modal"
import { VoiceRecorder } from "@/components/voice/voice-recorder"
import { querySOPs, submitFeedback } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"

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

const CHAT_SESSION_KEY = "sop-guard-chat-session"

const mockComparisonAnswer = {
  answer: "Model B Answer (simulated, smaller context window): Sepsis management involves blood cultures, antibiotics within 1 hour, and IV fluids. Vasopressors may be needed if MAP is low.",
  confidence: 0.6,
  faithfulness: { overall_faithfulness: 0.7 },
  citations: ["ICU Sepsis Management Protocol"],
}

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
  generationMode: string | null
  responseTimeMs: number | null
  answerId: string | null
  entities: { drugs?: string[]; conditions?: string[] }
  error?: boolean
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
    }))
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
    generationMode: typeof ext.generation_mode === "string" ? ext.generation_mode : null,
    responseTimeMs: typeof ext.response_time_ms === "number" ? ext.response_time_ms : Date.now() - startedAt,
    answerId: ext.answer_id != null ? String(ext.answer_id) : null,
    entities: (ext.entities && typeof ext.entities === "object") ? ext.entities as { drugs?: string[]; conditions?: string[] } : {},
  }
}

// ─── Badges and small components ─────────────────────────────────────────────

function VerificationBadge({ status }: { status: "passed" | "warning" | "failed" }) {
  const config = {
    passed: { icon: ShieldCheck, label: "Verified", className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30" },
    warning: { icon: ShieldAlert, label: "Caution", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30" },
    failed: { icon: ShieldX, label: "Unverified", className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30" },
  }
  const c = config[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border", c.className)}>
      <c.icon className="w-4 h-4" />
      {c.label}
    </span>
  )
}

function ConfidenceGauge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const level = confidence >= 0.7 ? "high" : confidence >= 0.5 ? "medium" : "low"
  const colors = {
    high: { ring: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10", label: "High Confidence", text: "text-[#15803D] dark:text-green-400", explanation: "Well supported by SOP evidence. All key details verified." },
    medium: { ring: "text-[#B45309] dark:text-amber-400", bg: "bg-[#FEF3C7] dark:bg-amber-500/10", label: "Medium Confidence", text: "text-[#B45309] dark:text-amber-400", explanation: "Partially supported. Some details may need manual verification." },
    low: { ring: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10", label: "Low Confidence", text: "text-[#B91C1C] dark:text-red-400", explanation: "Limited evidence found. Check the source SOP before acting." },
  }
  const c = colors[level]
  return (
    <div className="flex items-center gap-3">
      <div className={cn("relative w-14 h-14 rounded-full flex items-center justify-center", c.bg)}>
        <svg className="absolute inset-0 w-14 h-14 -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-[#E2E8F0]" />
          <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className={c.ring}
            strokeDasharray={`${pct * 1.508} 150.8`} strokeLinecap="round" />
        </svg>
        <span className={cn("text-sm font-bold", c.text)}>{pct}</span>
      </div>
      <div>
        <p className={cn("text-sm font-semibold", c.text)}>{c.label}</p>
        <p className="text-xs text-[#64748B]">Verification score</p>
        <p className="text-xs text-[#64748B] mt-0.5">{c.explanation}</p>
      </div>
    </div>
  )
}

function PipelineStages({ currentStage }: { currentStage: number }) {
  return (
    <div className="p-6 rounded-2xl bg-card border border-[#E2E8F0]">
      <h3 className="text-sm font-semibold mb-4">Processing Pipeline</h3>
      <div className="space-y-3">
        {pipelineStages.map((stage, i) => {
          const completed = i < currentStage
          const active = i === currentStage
          return (
            <div key={i} className={cn("flex items-center gap-3 text-sm transition-all duration-300", completed ? "text-[#15803D] dark:text-green-400" : active ? "text-[#0B6BCB]" : "text-[#94A3B8]")}>
              {completed ? <CheckCircle2 className="w-5 h-5 text-[#15803D] dark:text-green-400 shrink-0" /> : active ? <Loader2 className="w-5 h-5 text-[#0B6BCB] animate-spin shrink-0" /> : <Circle className="w-5 h-5 shrink-0" />}
              <span className={cn("font-medium", active && "text-[#1A2332]")}>{stage.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function mapReasoningToTimeline(reasoning: string) {
  const lines = reasoning.split("\n").filter(Boolean)
  const stageMap: { pattern: RegExp; label: string; icon: typeof Brain }[] = [
    { pattern: /classif/i, label: "Query understood", icon: Brain },
    { pattern: /retrieved/i, label: "SOPs retrieved", icon: Database },
    { pattern: /used chunk/i, label: "Evidence gathered", icon: FlaskConical },
    { pattern: /verification/i, label: "Safety verified", icon: ShieldCheck },
    { pattern: /confidence/i, label: "Confidence computed", icon: Gauge },
  ]
  const stages: { label: string; icon: typeof Brain; raw: string }[] = []
  const matched = new Set<number>()
  for (const line of lines) {
    for (let si = 0; si < stageMap.length; si++) {
      if (!matched.has(si) && stageMap[si].pattern.test(line)) {
        stages.push({ label: stageMap[si].label, icon: stageMap[si].icon, raw: line })
        matched.add(si)
        break
      }
    }
  }
  if (stages.length === 0) {
    for (const line of lines.slice(0, 5)) {
      stages.push({ label: line.substring(0, 60), icon: Crosshair, raw: line })
    }
  }
  return stages
}

function news2RiskConfig(score: number) {
  if (score >= 7) return { label: "HIGH RISK: Consider ICU", className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30" }
  if (score >= 5) return { label: "Medium Risk: Urgent Review", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30" }
  if (score >= 3) return { label: "Low-Medium Risk", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30" }
  return { label: "Low Risk", className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30" }
}

function FaithfulnessBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  if (score >= 0.9) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30">
      <ShieldCheck className="w-4 h-4" />
      High Faithfulness ({pct}%)
    </span>
  )
  if (score >= 0.7) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30">
      <ShieldAlert className="w-4 h-4" />
      Moderate Faithfulness ({pct}%)
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30">
      <ShieldX className="w-4 h-4" />
      Low Faithfulness - Verify Manually ({pct}%)
    </span>
  )
}

// ─── Copy link button ────────────────────────────────────────────────────────

function CopyLinkButton({ data }: { data: AssistantData }) {
  const [copied, setCopied] = useState<"link" | "answer" | null>(null)
  const handleCopy = async () => {
    try {
      if (data.answerId) {
        await navigator.clipboard.writeText(`${window.location.origin}/answers/${data.answerId}`)
        setCopied("link")
      } else {
        await navigator.clipboard.writeText(data.answer)
        setCopied("answer")
      }
      setTimeout(() => setCopied(null), 2000)
    } catch { /* ignore */ }
  }
  return (
    <button onClick={handleCopy}
      className={cn("inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
        copied ? "bg-[#DCFCE7] dark:bg-green-500/10 border-[#BBF7D0] dark:border-green-500/30 text-[#15803D] dark:text-green-400" : "border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332] hover:border-[#CBD5E1]")}>
      {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
      {copied === "link" ? "Link copied" : copied === "answer" ? "Answer copied" : "Copy link"}
    </button>
  )
}

// ─── Collapsed older assistant message ───────────────────────────────────────

function CollapsedAssistant({ data }: { data: AssistantData }) {
  const [expanded, setExpanded] = useState(false)
  const sourceCount = data.inlineCitations.length > 0 ? data.inlineCitations.length : data.sources.length
  const plainText = data.answer.replace(/[#*>]/g, "").replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim()
  if (data.error) {
    return (
      <div className="p-4 rounded-2xl bg-card border border-[#FECACA] dark:border-red-500/30 text-sm text-[#B91C1C] dark:text-red-400">
        Backend unavailable for this question.
      </div>
    )
  }
  return (
    <div className="p-5 rounded-2xl bg-card border border-[#E2E8F0]">
      {expanded ? (
        <AnswerRenderer text={data.answer} citations={data.inlineCitations} />
      ) : (
        <p className="text-[15px] leading-relaxed text-[#1A2332]">
          {plainText.length > 260 ? plainText.slice(0, 257) + "..." : plainText}
        </p>
      )}
      <button onClick={() => setExpanded(!expanded)}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-[#64748B] hover:text-[#0B6BCB] transition-colors">
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <FileText className="w-3.5 h-3.5" />
        {sourceCount} {sourceCount === 1 ? "source" : "sources"}
      </button>
      {expanded && sourceCount > 0 && (
        <div className="mt-2 space-y-1">
          {(data.inlineCitations.length > 0
            ? data.inlineCitations.map((c) => `${c.sop_title}${c.section_title ? " - " + c.section_title : ""}`)
            : data.sources.map((s) => `${s.sop_title} - ${s.section}`)
          ).map((t, i) => (
            <p key={i} className="text-[12px] text-[#64748B] pl-5">{t}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Full assistant answer (latest message) ──────────────────────────────────

function AssistantAnswer({
  data,
  compareModels,
  onFollowup,
  readingLevel,
  onReadingLevelChange,
}: {
  data: AssistantData
  compareModels: boolean
  onFollowup: (q: string) => void
  readingLevel: ReadingLevel
  onReadingLevelChange: (v: ReadingLevel) => void
}) {
  const router = useRouter()
  const { hasPermission } = useRole()
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const [showConflictDetails, setShowConflictDetails] = useState(false)
  const [showSentenceCheck, setShowSentenceCheck] = useState(false)
  const [selectedSource, setSelectedSource] = useState<SourceData | null>(null)
  const [highlightedSource, setHighlightedSource] = useState<number | null>(null)
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null)

  const hasConflict = data.sopConflicts.length > 0
  const firstCitation = data.sources[0]?.sop_title ?? ""
  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

  const citedCitations = data.inlineCitations.filter(c => c.cited_in_answer)
  const groundingCitations = citedCitations.length > 0 ? citedCitations : data.inlineCitations
  const distinctSopTitles = Array.from(new Set(groundingCitations.map(c => c.sop_title)))
  const isAbstained = data.abstained

  const plain = readingLevel === "plain" ? simplifyAnswer(data.answer) : null
  const displayAnswer = plain ? plain.text : data.answer

  const handleCitationClick = (n: number) => {
    setActivePanel("sources")
    setHighlightedSource(n)
    setTimeout(() => {
      document.getElementById(`source-entry-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 250)
    setTimeout(() => setHighlightedSource(null), 2500)
  }

  const handleFeedback = async (key: string) => {
    setFeedbackGiven(key)
    try {
      const typeMap: Record<string, "positive" | "negative" | "correction"> = { helpful: "positive", incorrect: "negative", unsafe: "negative", missing: "correction" }
      await submitFeedback(0, typeMap[key] || "positive")
    } catch { /* ignore */ }
  }

  if (data.error) {
    return (
      <div className="p-6 rounded-2xl bg-card border border-[#FECACA] dark:border-red-500/30">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#B91C1C] dark:text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-[#1A2332] mb-1">Backend unavailable</p>
            <p className="text-[15px] text-[#64748B]">Could not reach the SOP-Guard backend. Make sure the Python server is running on port 8000, then try again.</p>
            <p className="text-xs text-[#64748B] mt-3 font-mono bg-muted px-3 py-2 rounded-lg inline-block">
              cd backend &amp;&amp; uvicorn app.main:app --reload
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">

      {/* Conflict Alert Banner */}
      {hasConflict && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className="w-5 h-5 text-[#B91C1C] dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#B91C1C] dark:text-red-400 text-sm">CONFLICT DETECTED</p>
              <p className="text-[13px] text-[#64748B] mt-0.5">The retrieved SOP content contains potentially conflicting guidance.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowConflictDetails(!showConflictDetails)}
              className="px-3 py-1.5 rounded-lg text-sm border border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 hover:bg-[#FEE2E2] dark:bg-red-500/10 transition-colors">
              {showConflictDetails ? "Hide Details" : "View Details"}
            </button>
            <button onClick={() => router.push("/proposals?from_conflict=true")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30 hover:bg-[#FEE2E2] dark:bg-red-500/10 transition-colors">
              <PlusCircle className="w-4 h-4" />
              Create Update Proposal
            </button>
          </div>
        </motion.div>
      )}

      {/* Conflict details */}
      <AnimatePresence>
        {showConflictDetails && hasConflict && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="p-4 rounded-2xl bg-card border border-[#FECACA] dark:border-red-500/30 space-y-2">
              {data.sopConflicts.map((c, i) => (
                <div key={i} className="p-3 rounded-lg bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-sm">
                  <p className="font-semibold text-[#B91C1C] dark:text-red-400">{c.message}</p>
                  <p className="text-[#64748B] text-xs mt-1">Values in {c.sop_a}: {c.values_a?.join(", ")} vs {c.sop_b}: {c.values_b?.join(", ")}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dual-Column Answer Layout */}
      <div className="flex flex-col lg:flex-row gap-6 lg:divide-x lg:divide-[#E2E8F0]">

        {/* Left column - Internal SOP Answer */}
        <div className="flex-[3] min-w-0 space-y-4 lg:pr-6">
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0B6BCB]" />
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Internal SOP Answer</h2>
            </div>
            <ReadingLevelToggle value={readingLevel} onChange={onReadingLevelChange} />
          </div>
          {isAbstained ? (
            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-[#0B6BCB]/30">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <SearchX className="w-5 h-5 text-[#64748B]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-[#1A2332]">Not covered by current SOPs</h2>
                  <p className="text-[15px] leading-relaxed text-[#64748B] mt-2">{data.answer.replace(/\[\d+\]/g, "")}</p>
                </div>
              </div>
              <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">What you can do next:</p>
                <div className="space-y-2">
                  {[
                    { href: "/library", icon: BookOpen, label: "Browse the SOP Library" },
                    { href: "/evidence-watch", icon: Search, label: "Check Evidence Watch for external guidance" },
                    { href: "/proposals?new=1", icon: PlusCircle, label: "Request a new SOP via Proposals" },
                  ].map((opt) => (
                    <a key={opt.href} href={opt.href}
                      className="flex items-center gap-2.5 border border-[#E2E8F0] rounded-lg px-4 py-2.5 hover:border-[#0B6BCB]/40 hover:bg-[#0B6BCB]/[0.04] transition-colors duration-150">
                      <opt.icon className="w-4 h-4 text-[#0B6BCB] shrink-0" />
                      <span className="text-sm text-[#1A2332]">{opt.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Grounding bar */}
              {distinctSopTitles.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-card border border-[#E2E8F0]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1A2332]">
                      <Layers className="w-4 h-4 text-[#0B6BCB]" />
                      Grounded in {groundingCitations.length} SOP {groundingCitations.length === 1 ? "section" : "sections"}
                    </span>
                    {distinctSopTitles.map((t) => (
                      <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30">
                        {t}
                      </span>
                    ))}
                    {data.generationMode && (
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border",
                        data.generationMode === "llm" ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30" : "bg-card text-[#475569] border-[#CBD5E1]")}>
                        {data.generationMode}
                      </span>
                    )}
                    {data.responseTimeMs !== null && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#64748B] font-mono">
                        <Clock className="w-3 h-3" />
                        {(data.responseTimeMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                  {distinctSopTitles.length === 1 && (
                    <p className="mt-2 text-[12px] text-[#B45309] dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Single-source answer - verify against the full SOP
                    </p>
                  )}
                </div>
              )}

              <div className="p-6 sm:p-8 rounded-2xl bg-card border border-[#E2E8F0] shadow-sm relative">
                <div className="flex justify-end mb-4 sm:mb-0 sm:absolute sm:top-6 sm:right-6">
                  <VerificationBadge status={data.verification.status} />
                </div>
                <div className="sm:pr-36">
                  {plain?.summary && (
                    <div className="mb-4 p-3.5 rounded-xl bg-[#0B6BCB]/[0.06] border border-[#0B6BCB]/20">
                      <p className="text-[15px] leading-relaxed text-[#1A2332]">
                        <span className="font-semibold text-[#0B6BCB]">In short: </span>
                        {plain.summary}
                      </p>
                    </div>
                  )}
                  {data.faithfulness?.sentences && data.faithfulness.sentences.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px] text-[#64748B]">
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-0.5 rounded bg-[#15803D]/50" />Grounded</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-0.5 rounded bg-[#B45309]/60" />Partially grounded</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-0.5 rounded bg-[#B91C1C]/60" />Not grounded</span>
                    </div>
                  )}
                  <AnswerRenderer text={displayAnswer} citations={data.inlineCitations} onCitationClick={handleCitationClick} groundingSentences={data.faithfulness?.sentences} />
                </div>
                <div className="mt-7 pt-5 border-t border-[#E2E8F0]">
                  <ConfidenceGauge confidence={data.verification.confidence} />
                </div>
              </div>

              <FeedbackRow queryText={data.query} />
            </>
          )}

          {/* Follow-up questions */}
          {data.followupQuestions.length > 0 && (
            <FollowupChips questions={data.followupQuestions} onSelect={onFollowup} />
          )}

          {/* Faithfulness badge */}
          {data.faithfulness && (
            <div className="p-4 rounded-2xl bg-card border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <FaithfulnessBadge score={data.faithfulness.overall_faithfulness} />
                <button onClick={() => setShowSentenceCheck(!showSentenceCheck)}
                  className="text-xs text-[#64748B] hover:text-[#1A2332] transition-colors inline-flex items-center gap-1">
                  {showSentenceCheck ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  Sentence-level check ({data.faithfulness.total_checked} sentences)
                </button>
              </div>
              <AnimatePresence>
                {showSentenceCheck && data.faithfulness.sentences && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden">
                    <div className="space-y-2 pt-1">
                      {data.faithfulness.sentences.map((s: any, i: number) => (
                        <div key={i} className={cn("p-2.5 rounded-lg text-[13px] leading-relaxed", s.grounded ? "bg-muted" : "bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30")}>
                          <span className="text-[#1A2332]">{s.text}</span>
                          {!s.grounded && (
                            <span className="ml-2 text-[#B45309] dark:text-amber-400 text-xs font-semibold">Not found in SOP</span>
                          )}
                          {s.source_chunk && s.source_chunk !== "Unknown" && s.source_chunk !== "General context" && (
                            <span className="ml-2 text-[11px] text-[#64748B]">- {s.source_chunk}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Create Update Proposal button */}
          {hasPermission("create_proposal") && (
            <div className="flex">
              <button
                onClick={() => router.push(`/proposals?new=1&sop=${encodeURIComponent(firstCitation)}&query=${encodeURIComponent(data.query)}`)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332] hover:border-[#CBD5E1] transition-all">
                <PlusCircle className="w-4 h-4" />
                Create Update Proposal
              </button>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: "sources", icon: FileText, label: `View Sources (${data.inlineCitations.length > 0 ? data.inlineCitations.length : data.sources.length})` },
              { key: "safety", icon: ShieldCheck, label: "Safety Check" },
              { key: "trace", icon: Brain, label: "Pipeline Trace" },
              { key: "feedback", icon: ThumbsUp, label: "Give Feedback" },
              { key: "export", icon: Download, label: "Export" },
            ].map((action) => (
              <button key={action.key}
                onClick={() => setActivePanel(activePanel === action.key ? null : action.key)}
                className={cn("inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                  activePanel === action.key ? "bg-[#0B6BCB]/10 border-[#0B6BCB]/30 text-[#0B6BCB]" : "border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332] hover:border-[#CBD5E1]")}>
                <action.icon className="w-4 h-4" />
                {action.label}
              </button>
            ))}
            <CopyLinkButton data={data} />
          </div>

          {/* Expandable Panels */}
          <AnimatePresence mode="wait">
            {activePanel && (
              <motion.div key={activePanel} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">

                {/* Sources Panel */}
                {activePanel === "sources" && data.inlineCitations.length > 0 && (
                  <SourcePanel citations={data.inlineCitations} highlightedNumber={highlightedSource} />
                )}
                {activePanel === "sources" && data.inlineCitations.length === 0 && (
                  <div className="p-5 rounded-2xl bg-card border border-[#E2E8F0]">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#0B6BCB]" />
                      Source Evidence
                    </h3>
                    <div className="space-y-3">
                      {data.sources.map((s) => (
                        <button key={s.id} onClick={() => setSelectedSource(s)}
                          className="w-full text-left p-4 rounded-xl bg-card border border-[#E2E8F0] hover:border-[#0B6BCB]/30 transition-all group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold group-hover:text-[#0B6BCB] transition-colors">{s.sop_title}</span>
                            <span className="text-xs font-mono text-[#0B6BCB]">{Math.round(s.score * 100)}% match</span>
                          </div>
                          <p className="text-xs text-[#64748B] mb-2">{s.section}</p>
                          <p className="text-[15px] leading-relaxed text-[#1A2332]">{s.content.substring(0, 150)}...</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Safety Check Panel */}
                {activePanel === "safety" && (
                  <div className="p-5 rounded-2xl bg-card border border-[#E2E8F0]">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#0B6BCB]" />
                      Safety Verification Results
                    </h3>
                    <p className="text-[15px] leading-relaxed text-[#1A2332] mb-4">
                      {(() => {
                        const allChecks = [
                          ...data.verification.thresholdChecks,
                          ...data.verification.sequenceChecks.map((c) => ({ status: c.correct ? "pass" : "fail" })),
                          ...data.verification.contraindicationChecks.map((c) => ({ status: c.safe ? "pass" : "fail" })),
                        ]
                        const passed = allChecks.filter((c) => c.status === "pass").length
                        return `${passed} of ${allChecks.length} checks passed.`
                      })()}
                    </p>
                    {data.verification.thresholdChecks.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold uppercase text-[#64748B] mb-2">Threshold Checks</p>
                        <div className="space-y-2">
                          {data.verification.thresholdChecks.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-card">
                              {c.status === "pass" ? <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-green-400 shrink-0" /> : <XCircle className="w-4 h-4 text-[#B91C1C] dark:text-red-400 shrink-0" />}
                              <span className="flex-1 text-[15px] leading-relaxed text-[#1A2332]">{c.parameter}: <span className="font-mono text-[#0B6BCB]">{c.value}</span></span>
                              <span className={cn("text-xs font-semibold", c.status === "pass" ? "text-[#15803D] dark:text-green-400" : "text-[#B91C1C] dark:text-red-400")}>{c.status.toUpperCase()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.verification.sequenceChecks.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold uppercase text-[#64748B] mb-2">Sequence Checks</p>
                        <div className="space-y-2">
                          {data.verification.sequenceChecks.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-card">
                              {c.correct ? <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-green-400" /> : <XCircle className="w-4 h-4 text-[#B91C1C] dark:text-red-400" />}
                              <span className="text-[15px] leading-relaxed text-[#1A2332]">{c.procedure}</span>
                              <span className="text-[#64748B] text-xs ml-auto">{c.correct ? "Correct order" : "Order issue"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.verification.contraindicationChecks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#64748B] mb-2">Contraindication Checks</p>
                        <div className="space-y-2">
                          {data.verification.contraindicationChecks.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-card">
                              {c.safe ? <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-green-400" /> : <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400" />}
                              <span className="flex-1 text-[15px] leading-relaxed text-[#1A2332]">{c.item}</span>
                              <span className="text-xs text-[#64748B]">{c.note}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Pipeline Trace Panel */}
                {activePanel === "trace" && (
                  <div className="p-5 rounded-2xl bg-card border border-[#E2E8F0]">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-[#0B6BCB]" />
                      How This Answer Was Built
                    </h3>
                    {(() => {
                      const lines = data.reasoning.split("\n").filter((l) => l.includes("Timing -"))
                      const totalLine = lines.find((l) => l.includes("Total"))
                      const total = totalLine ? totalLine.match(/(\d+)ms/)?.[1] : null
                      if (!lines.length) return null
                      return (
                        <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-[#64748B]">
                          <Clock className="w-3.5 h-3.5" />
                          {lines.filter((l) => !l.includes("Total")).map((l, i) => {
                            const m = l.match(/Timing - (.+?): (\d+)ms/)
                            return m ? <span key={i}>{m[1]}: {m[2]}ms</span> : null
                          })}
                          {total && <span className="font-semibold text-[#0B6BCB]">Total: {total}ms</span>}
                        </div>
                      )
                    })()}
                    <div className="relative pl-6 border-l-2 border-[#E2E8F0] space-y-4">
                      {mapReasoningToTimeline(data.reasoning).map((stage, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-[#0B6BCB]/15 border-2 border-[#0B6BCB] flex items-center justify-center">
                            <stage.icon className="w-2.5 h-2.5 text-[#0B6BCB]" />
                          </div>
                          <p className="text-sm font-medium">{stage.label}</p>
                          <p className="text-xs text-[#64748B] mt-0.5">{stage.raw}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback Panel */}
                {activePanel === "feedback" && (
                  <div className="p-5 rounded-2xl bg-card border border-[#E2E8F0]">
                    <h3 className="text-sm font-semibold mb-4">Was this answer helpful?</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {[
                        { key: "helpful", icon: ThumbsUp, label: "Helpful" },
                        { key: "incorrect", icon: XCircle, label: "Incorrect" },
                        { key: "unsafe", icon: AlertTriangle, label: "Unsafe" },
                        { key: "missing", icon: FileText, label: "Missing Info" },
                      ].map((fb) => (
                        <button key={fb.key} onClick={() => handleFeedback(fb.key)}
                          className={cn("inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border transition-colors",
                            feedbackGiven === fb.key ? "bg-[#0B6BCB]/10 border-[#0B6BCB]/30 text-[#0B6BCB]" : "border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332]")}>
                          <fb.icon className="w-4 h-4" />
                          {fb.label}
                        </button>
                      ))}
                    </div>
                    {feedbackGiven && (
                      <p className="text-xs text-[#15803D] dark:text-green-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Feedback submitted. Thank you!
                      </p>
                    )}
                  </div>
                )}

                {/* Export Panel */}
                {activePanel === "export" && (
                  <div className="p-5 rounded-2xl bg-card border border-[#E2E8F0]">
                    <h3 className="text-sm font-semibold mb-4">Export This Result</h3>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={async () => {
                        try {
                          const res = await fetch("/api/query/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: data.query }) })
                          const blob = await res.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement("a")
                          a.href = url; a.download = `sop-guard-report-${Date.now()}.json`; a.click()
                          URL.revokeObjectURL(url)
                        } catch { /* silently fail */ }
                      }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332] transition-colors">
                        <Download className="w-4 h-4" />
                        Download JSON
                      </button>
                      <button onClick={async () => {
                        try {
                          const res = await fetch("/api/query/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: data.query }) })
                          const report = await res.json()
                          const printWindow = window.open("", "_blank")
                          if (printWindow) {
                            printWindow.document.write(`<!DOCTYPE html><html><head><title>SOP-Guard Report</title></head><body><h1>SOP-Guard Clinical Query Report</h1><p>${report.header?.disclaimer || ''}</p><h2>Query</h2><p>${report.header?.query || data.query}</p><h2>Answer</h2><pre>${(report.result?.answer || '').replace(/</g, '&lt;')}</pre><h2>Sources</h2>${(report.sources || []).map((s: any) => '<p>' + s.sop_title + ' - ' + s.section + '</p>').join('')}</body></html>`)
                            printWindow.document.close()
                            setTimeout(() => printWindow.print(), 500)
                          }
                        } catch { /* silently fail */ }
                      }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332] transition-colors">
                        <Printer className="w-4 h-4" />
                        Print Report
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Model Comparison pane */}
          {compareModels && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-card border border-[#E2E8F0]">
              <div className="flex items-center gap-2 mb-4">
                <BeakerIcon className="w-4 h-4 text-[#0B6BCB]" />
                <h3 className="text-sm font-semibold">Model B - Llama 3.1 8B (Simulated)</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30">MOCK</span>
              </div>
              <p className="text-[15px] leading-relaxed text-[#1A2332] mb-4">{mockComparisonAnswer.answer}</p>
              <div className="border-t border-[#E2E8F0] pt-4 mt-4">
                <p className="text-xs font-semibold uppercase text-[#64748B] mb-3">Model Comparison</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[#64748B]">
                        <th className="pb-2 pr-4 font-semibold">Metric</th>
                        <th className="pb-2 pr-4 font-semibold">Model A (Llama 3.3 70B)</th>
                        <th className="pb-2 font-semibold">Model B (Llama 3.1 8B)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDF1F5]">
                      <tr>
                        <td className="py-2 pr-4 text-[#64748B]">Faithfulness</td>
                        <td className="py-2 pr-4 text-[#15803D] dark:text-green-400 font-mono">{data.faithfulness ? `${Math.round(data.faithfulness.overall_faithfulness * 100)}%` : "n/a"}</td>
                        <td className="py-2 text-[#B45309] dark:text-amber-400 font-mono">{Math.round(mockComparisonAnswer.faithfulness.overall_faithfulness * 100)}%</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-[#64748B]">Confidence</td>
                        <td className="py-2 pr-4 text-[#15803D] dark:text-green-400 font-mono">{Math.round(data.verification.confidence * 100)}%</td>
                        <td className="py-2 text-[#B45309] dark:text-amber-400 font-mono">{Math.round(mockComparisonAnswer.confidence * 100)}%</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-[#64748B]">Response Length</td>
                        <td className="py-2 pr-4 font-mono">{wordCount(data.answer)} words</td>
                        <td className="py-2 font-mono">{wordCount(mockComparisonAnswer.answer)} words</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 text-[#64748B]">Citations</td>
                        <td className="py-2 pr-4 font-mono">{data.sources.length}</td>
                        <td className="py-2 font-mono">{mockComparisonAnswer.citations.length}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right column - External Evidence */}
        <div className="flex-[2] min-w-0 space-y-4 lg:pl-6">
          <div className="flex items-center gap-2 pb-1">
            <BookOpen className="w-4 h-4 text-[#0B6BCB]" />
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">External Evidence</h2>
          </div>
          <PubMedEvidencePanel entities={data.entities} queryText={data.query} />
        </div>
      </div>

      {/* Source Detail Drawer */}
      <AnimatePresence>
        {selectedSource && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedSource(null)}>
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg h-full bg-card border-l border-[#E2E8F0] shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Source Detail</h3>
                  <button onClick={() => setSelectedSource(null)} className="p-2 rounded-lg hover:bg-muted text-[#64748B] transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-[#64748B] uppercase tracking-wider">SOP Title</label>
                    <p className="text-sm font-semibold mt-1">{selectedSource.sop_title}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Section</label>
                    <p className="text-sm mt-1">{selectedSource.section}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Relevance Score</label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-[#0B6BCB]" style={{ width: `${selectedSource.score * 100}%` }} />
                      </div>
                      <span className="text-sm font-mono text-[#0B6BCB]">{(selectedSource.score * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Content</label>
                    <p className="text-sm text-[#64748B] mt-2 leading-relaxed p-3 rounded-xl bg-muted border border-[#E2E8F0]">
                      {selectedSource.content}
                    </p>
                  </div>
                  <a href="/library" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-medium transition-colors mt-4">
                    <ExternalLink className="w-4 h-4" />
                    Open Full SOP in Library
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; confidence: number; type: string; timestamp: number }>>([])
  const [showHistory, setShowHistory] = useState(false)
  const [userRole, setUserRole] = useState("viewer")
  const [serverHistory, setServerHistory] = useState<Array<{ id: number; query: string; confidence: number; query_type: string; timestamp: string }>>([])
  const [news2Score, setNews2Score] = useState<number | null>(null)
  const [showPatientContext, setShowPatientContext] = useState(false)
  const [compareModels, setCompareModels] = useState(false)
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>("clinical")

  const chatDisabledRef = useRef(false)
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)

  const submitted = messages.length > 0

  useEffect(() => {
    fetch("/api/query/history?limit=10")
      .then(r => r.json())
      .then(data => { if (data.queries) setServerHistory(data.queries) })
      .catch(() => {})
  }, [messages.length])

  useEffect(() => {
    setUserRole(localStorage.getItem("sop-guard-role") || "viewer")
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

  useEffect(() => {
    if (loading || messages.length > 0) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [loading, messages.length])

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
    chatDisabledRef.current = false
    try { sessionStorage.removeItem(CHAT_SESSION_KEY) } catch { /* ignore */ }
  }

  const handleSubmit = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim()
    if (!q || loading) return
    setQuery("")
    setMessages(prev => [...prev, { id: nextId(), role: "user", content: q }])
    setLoading(true)

    const startedAt = Date.now()
    let data: AssistantData | null = null

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
            const r = await fetch(`/api/chat/sessions/${sid}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: q, news2_score: news2Score ?? null }),
            })
            if (!r.ok) throw new Error("chat message failed")
            response = await r.json()
          } catch {
            chatDisabledRef.current = true
            response = null
          }
        }
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
        generationMode: null,
        responseTimeMs: null,
        answerId: null,
        entities: {},
        error: true,
      }
      setQueryHistory(prev => [{ query: q, confidence: 0, type: "error", timestamp: Date.now() }, ...prev].slice(0, 10))
    }

    const elapsed = Date.now() - startedAt
    const totalDuration = pipelineStages.reduce((sum, s) => sum + s.duration, 0)
    const remaining = Math.max(0, totalDuration - elapsed)
    setTimeout(() => {
      setLoading(false)
      if (data) setMessages(prev => [...prev, { id: nextId(), role: "assistant", data }])
    }, remaining)
  }

  const lastAssistantId = [...messages].reverse().find(m => m.role === "assistant")?.id ?? null

  return (
    <AppShell>
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <Breadcrumb items={[{ label: "Query SOPs" }]} />

        {/* Toolbar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowHistory(!showHistory)}
                className={cn("p-2 rounded-lg transition-colors", showHistory ? "bg-[#0B6BCB]/10 text-[#0B6BCB]" : "text-[#64748B] hover:text-[#1A2332]")}
                title="Query history">
                <History className="w-5 h-5" />
              </button>
              <button onClick={() => setCompareModels(!compareModels)}
                className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
                  compareModels ? "bg-[#0B6BCB]/10 border-[#0B6BCB]/30 text-[#0B6BCB]" : "border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332] hover:border-[#CBD5E1]")}
                title="Compare models">
                <BeakerIcon className="w-4 h-4" />
                Compare Models
              </button>
              {submitted && (
                <button onClick={resetConversation}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332] hover:border-[#CBD5E1] transition-all"
                  title="Start a new conversation">
                  <RotateCcw className="w-4 h-4" />
                  New conversation
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <User className="w-3.5 h-3.5" />
              <span className="capitalize">{userRole}</span>
              {userRole === "admin" && <span className="px-1.5 py-0.5 rounded bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 text-[10px] font-semibold">ADMIN</span>}
              {userRole === "editor" && <span className="px-1.5 py-0.5 rounded bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 text-[10px] font-semibold">EDITOR</span>}
            </div>
          </div>

          {/* Patient Context (NEWS2) collapsible */}
          <div className="mb-3">
            <button onClick={() => setShowPatientContext(!showPatientContext)}
              className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#1A2332] transition-colors">
              {showPatientContext ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Activity className="w-4 h-4" />
              Add Patient Context (NEWS2)
            </button>
            <AnimatePresence>
              {showPatientContext && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-2">
                  <div className="p-4 rounded-xl bg-card border border-[#E2E8F0] space-y-3">
                    <div className="flex items-center gap-4">
                      <label className="text-sm font-medium shrink-0">NEWS2 Score</label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={news2Score ?? ""}
                        onChange={e => setNews2Score(e.target.value === "" ? null : Number(e.target.value))}
                        placeholder="0-20"
                        className="w-24 px-3 py-1.5 rounded-lg bg-muted border border-[#E2E8F0] text-sm text-[#1A2332] focus:outline-none focus:ring-2 focus:ring-[#0B6BCB]/40"
                      />
                      {news2Score !== null && (
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border", news2RiskConfig(news2Score).className)}>
                          {news2RiskConfig(news2Score).label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B]">
                      Applies to your next question. Higher scores indicate greater deterioration risk.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
              placeholder={submitted ? "Ask a follow-up..." : "Ask a clinical SOP question..."}
              rows={3}
              className="w-full p-4 sm:pr-28 rounded-2xl bg-muted border border-[#E2E8F0] text-[#1A2332] placeholder:text-[#94A3B8] caret-[#0B6BCB] resize-none focus:outline-none focus:ring-2 focus:ring-[#0B6BCB]/40 text-base"
            />
            <div className="max-sm:relative max-sm:mt-2 max-sm:justify-end absolute bottom-3 right-3 flex items-center gap-2">
              <VoiceRecorder onTranscript={(t) => { setQuery(t) }} />
              <button onClick={() => handleSubmit()} disabled={!query.trim() || loading}
                className="p-3 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Suggested queries */}
          {!submitted && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-thin sm:flex-wrap">
              {suggestedQueries.map((q) => (
                <button key={q} onClick={() => setQuery(q)}
                  className="px-3 py-1.5 rounded-lg bg-muted text-sm text-[#64748B] hover:text-[#1A2332] border border-[#E2E8F0] transition-colors whitespace-nowrap shrink-0 sm:whitespace-normal sm:shrink">
                  {q}
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Query History Panel */}
        <AnimatePresence>
          {showHistory && allHistory.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 rounded-2xl bg-card border border-[#E2E8F0]">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <History className="w-4 h-4 text-[#0B6BCB]" />
                Recent Queries
              </h3>
              <div className="space-y-2">
                {allHistory.map((h) => (
                  <button key={h.timestamp} onClick={() => { setQuery(h.query); setShowHistory(false) }}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-muted border border-transparent hover:border-[#E2E8F0] transition-all group">
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
            <p className="text-[#64748B] text-sm max-w-md">
              Type or speak your question. Answers stay in one conversation so you can ask follow-ups.
            </p>
          </motion.div>
        )}

        {/* Conversation Thread */}
        <div className="space-y-5">
          {messages.map((m) => {
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl rounded-br-md bg-[#0B6BCB]/[0.08] border border-[#0B6BCB]/15 text-[15px] leading-relaxed text-[#1A2332]">
                    {m.content}
                  </div>
                </div>
              )
            }
            const isLatest = m.id === lastAssistantId && !loading
            return isLatest ? (
              <AssistantAnswer
                key={m.id}
                data={m.data}
                compareModels={compareModels}
                onFollowup={(q) => handleSubmit(q)}
                readingLevel={readingLevel}
                onReadingLevelChange={changeReadingLevel}
              />
            ) : (
              <CollapsedAssistant key={m.id} data={m.data} />
            )
          })}

          {/* Inline processing pipeline where the next answer will appear */}
          <AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <PipelineStages currentStage={currentStage} />
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={threadEndRef} />
        </div>
      </div>
    </AppShell>
  )
}
