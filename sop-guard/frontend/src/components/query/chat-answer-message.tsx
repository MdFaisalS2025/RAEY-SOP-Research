"use client"

// Unified assistant message component - replaces the old split between
// `AssistantAnswer` (latest message, full detail) and `CollapsedAssistant`
// (every earlier message, stripped to ~260 chars of plain text). That split
// made the conversation look like it "forgot" prior answers the moment a
// follow-up was asked, even though the underlying AssistantData was never
// truncated - only the component rendering it was. Every message now gets
// identical treatment (full prose, citations, sources, toolbar, drawers);
// the only per-message state is a manual collapse toggle the user controls
// themselves, defaulting to expanded, so history is visible by default and
// tidy-able on request rather than silently discarded.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShieldCheck, AlertTriangle, FileText, ExternalLink, GitCompare, History,
  BookOpen, Download, Printer, Flag, PlusCircle, HelpCircle, ChevronDown, ChevronUp,
  Link2, Check, Loader2, CheckCircle2, ClipboardEdit, Search, Building2,
} from "lucide-react"
import { type InlineCitation } from "@/components/query/citation-chip"
import { cn } from "@/lib/utils"
import { EvidenceDrawer } from "@/components/query/evidence-drawer"
import { FollowupChips } from "@/components/query/followup-chips"
import { FeedbackRow } from "@/components/query/feedback-row"
import { AnswerRenderer } from "@/components/query/answer-renderer"
import { ProtocolComparisonPanel, type ComparisonResponse } from "@/components/query/protocol-comparison-panel"
import { VersionHistoryPanel } from "@/components/query/version-history-panel"
import { GapReportPanel } from "@/components/query/gap-report-panel"
import { AnswerActionToolbar } from "@/components/query/answer-action-toolbar"
import { TrustAuditPanel } from "@/components/query/trust-audit-panel"
import { ReadingLevelToggle, simplifyAnswer, type ReadingLevel } from "@/components/query/plain-language"
import { SlideOver } from "@/components/ui/slide-over"
import { FeedbackModal } from "@/components/ui/feedback-modal"
import { submitFeedback } from "@/lib/api"
import { useRole } from "@/lib/role-context"
import { toast } from "@/components/ui/use-toast"
import type { AssistantData } from "@/app/query/page"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

type SourceData = { id: string; sop_id: string; sop_title: string; section: string; content: string; score: number }

/** Builds the deep-link target for "cite to exact line": the Library's
 * Full Text tab, with enough context (source snippet + section heading)
 * for a view-time text match to locate and highlight the exact passage.
 * Uses `sectionTitle` (not `section`) since the Library page already uses
 * `section` to mean which tab to open. */
function libraryDeepLink(sopId: string, snippet?: string, sectionTitle?: string): string {
  const params = new URLSearchParams({ sopId })
  if (snippet) params.set("highlight", snippet)
  if (sectionTitle) params.set("sectionTitle", sectionTitle)
  return `/library?${params.toString()}`
}

// ── Honest external out-links ──────────────────────────────────────────
// No data ingestion from any of these - OpenEvidence has no public API
// (closed, NPI-verified-clinician platform) and UpToDate/PolicyTech are
// licensed institutional subscriptions Meridian doesn't have access to.
// These are clearly-labeled referral links to separate tools a clinician
// already has their own access to, not an in-app data source.

/** UpToDate search deep-link (their public search UI takes a plain query
 * param - no API access, no license required to land on the search page). */
function uptodateSearchUrl(term: string): string {
  return `https://www.uptodate.com/contents/search?search=${encodeURIComponent(term)}`
}

const OPENEVIDENCE_URL = "https://www.openevidence.com/"

/** Only rendered if an institution has actually configured its PolicyTech
 * tenant URL - absent by default, so no link is shown (honest
 * not-configured) rather than a fabricated/guessed deep-link path, since
 * PolicyTech's per-document URL scheme isn't something we can know without
 * a real tenant to test against. */
const POLICYTECH_BASE_URL = process.env.NEXT_PUBLIC_POLICYTECH_BASE_URL || ""

// ─── Compact source strip ─────────────────────────────────────────────────
// Perplexity/modern-AI-chat pattern: sources shown as a scrollable row of
// small pills directly under the answer - the deep-dive SourcePanel (full
// snippets, relevance scores, version/review metadata) stays available via
// the toolbar's Trust Details drawer for anyone who wants more.
function SourceStrip({ citations, onSelect }: { citations: InlineCitation[]; onSelect: (n: number) => void }) {
  if (citations.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
      {citations.map((c) => (
        <button
          key={c.number}
          onClick={() => onSelect(c.number)}
          className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full border border-border bg-muted/60 hover:border-[#0B6BCB]/40 hover:bg-[#0B6BCB]/[0.06] transition-colors text-left"
        >
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 text-[#0B6BCB] dark:text-[#00E5FF] text-[9px] font-bold shrink-0">
            {c.number}
          </span>
          <span className="text-[11px] font-medium text-foreground truncate max-w-[160px]">{c.sop_title}</span>
        </button>
      ))}
    </div>
  )
}

function plainTextPreview(answer: string, maxLen = 200): string {
  const plain = answer.replace(/[#*>]/g, "").replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim()
  return plain.length > maxLen ? plain.slice(0, maxLen - 1).trimEnd() + "…" : plain
}

// ─── Alignment status line (Workflow 1: physician clinical question) ────────
// Auto-checks whether the SOP just used to answer is still aligned with
// current external evidence - the physician sees this resolve in place
// right under the answer, without clicking "Compare SOP vs Internet" first.
// This is the single most important connective piece of the redesign: it
// turns "here's your answer" into "here's your answer, and here's whether
// it's still current" without an extra step.
const ALIGNMENT_META: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  "Aligned": { icon: CheckCircle2, className: "text-[#15803D] dark:text-green-400" },
  "Partially Aligned": { icon: AlertTriangle, className: "text-[#B45309] dark:text-amber-400" },
  "Needs Review": { icon: AlertTriangle, className: "text-[#B91C1C] dark:text-red-400" },
}

function AlignmentStatusLine({
  comparison,
  onOpenComparison,
  onCreateRecommendation,
}: {
  comparison: ComparisonResponse | "loading" | null
  onOpenComparison: () => void
  onCreateRecommendation: () => void
}) {
  if (comparison === null) return null
  if (comparison === "loading") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        Checking alignment with external evidence…
      </p>
    )
  }
  if (!comparison.available || !comparison.summary) return null
  const meta = ALIGNMENT_META[comparison.summary.overall_alignment] ?? ALIGNMENT_META["Needs Review"]
  const { overall_alignment } = comparison.summary
  // Kept deliberately short - match counts and the full recommended-action
  // sentence are one click away in the Compare with Clinical Evidence
  // drawer (onOpenComparison) rather than crowding this quiet inline cue.
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs">
      <button onClick={onOpenComparison} className={cn("inline-flex items-center gap-1.5 font-medium hover:underline", meta.className)}>
        <meta.icon className="w-3.5 h-3.5 shrink-0" />
        {overall_alignment} with external evidence
      </button>
      {overall_alignment !== "Aligned" && (
        <button onClick={onCreateRecommendation}
          className="inline-flex items-center gap-1 text-[#0B6BCB] font-medium hover:underline">
          <ClipboardEdit className="w-3.5 h-3.5 shrink-0" />
          Create Update Recommendation
        </button>
      )}
    </div>
  )
}

export function ChatAnswerMessage({
  data,
  onFollowup,
  readingLevel,
  onReadingLevelChange,
  isLatest,
}: {
  data: AssistantData
  onFollowup: (q: string) => void
  readingLevel: ReadingLevel
  onReadingLevelChange: (v: ReadingLevel) => void
  isLatest: boolean
}) {
  const router = useRouter()
  const { hasPermission } = useRole()
  const [activeDrawer, setActiveDrawer] = useState<"evidence" | "comparison" | "versions" | "trust" | null>(null)
  const [showConflictDetails, setShowConflictDetails] = useState(false)
  const [selectedSource, setSelectedSource] = useState<SourceData | null>(null)
  const [highlightedSource, setHighlightedSource] = useState<number | null>(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  // User-controlled only - never auto-collapsed, so earlier turns stay
  // fully visible by default like a real chat thread. Defaulting to the
  // latest message always expanded avoids collapsing the answer someone
  // just asked for.
  const [collapsed, setCollapsed] = useState(false)
  const [comparison, setComparison] = useState<ComparisonResponse | "loading" | null>(null)
  const [copiedLink, setCopiedLink] = useState<"link" | "answer" | null>(null)

  const hasConflict = data.sopConflicts.length > 0
  const firstCitation = data.sources[0]?.sop_title ?? ""

  const citedCitations = data.inlineCitations.filter((c) => c.cited_in_answer)
  const groundingCitations = citedCitations.length > 0 ? citedCitations : data.inlineCitations
  const distinctSopTitles = Array.from(new Set(groundingCitations.map((c) => c.sop_title)))
  const isAbstained = data.abstained

  const primaryInternalCitation = groundingCitations.find((c) => !c.is_external)
  const primarySopId = primaryInternalCitation?.sop_id ?? ""
  const primaryVersion = primaryInternalCitation?.version ?? ""
  const primaryReviewDate = primaryInternalCitation?.review_date ?? ""

  // Auto-checks the SOP just used against external evidence as soon as we
  // know which SOP that is - never blocks the answer above from rendering,
  // and fails silently (no alignment line at all) rather than showing a
  // broken state if the check comes back unavailable.
  useEffect(() => {
    if (!primarySopId || isAbstained) {
      setComparison(null)
      return
    }
    let cancelled = false
    setComparison("loading")
    fetch(`${API_BASE}/api/sops/${encodeURIComponent(primarySopId)}/protocol-comparison`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setComparison(d) })
      .catch(() => { if (!cancelled) setComparison(null) })
    return () => { cancelled = true }
  }, [primarySopId, isAbstained])

  const plain = readingLevel === "plain" ? simplifyAnswer(data.answer) : null
  const displayAnswer = plain ? plain.text : data.answer

  const handleCitationClick = (n: number) => {
    const citation = data.inlineCitations.find((c) => c.number === n)

    // External literature - open the source directly (mirrors CitationChip's
    // own handling, needed here too since SourceStrip doesn't special-case
    // external citations before calling this handler).
    if (citation?.is_external && citation.url) {
      window.open(citation.url, "_blank", "noopener,noreferrer")
      return
    }

    // Internal SOP citation - jump straight to the exact cited passage in
    // the source document instead of just scrolling to its row in the
    // Trust drawer.
    if (citation?.sop_id) {
      router.push(libraryDeepLink(citation.sop_id, citation.snippet, citation.section_title))
      return
    }

    // Fallback (no sop_id on the citation record, e.g. legacy data) - keep
    // the old behavior of surfacing it in the Trust drawer.
    setActiveDrawer("trust")
    setHighlightedSource(n)
    setTimeout(() => {
      document.getElementById(`source-entry-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 250)
    setTimeout(() => setHighlightedSource(null), 2500)
  }

  const handleCreateRecommendation = () => {
    if (comparison === "loading" || comparison === null) return
    const sopTitle = distinctSopTitles[0] || comparison.sop_title || ""
    const refName = comparison.reference_source?.name || "current external evidence"
    const title = sopTitle ? `Align ${sopTitle} with ${refName}` : `SOP update recommendation`
    const summary = comparison.summary?.recommended_action || ""
    router.push(`/proposals?new=1&sop=${encodeURIComponent(primarySopId)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(summary)}`)
  }

  const handleCopyLink = async () => {
    try {
      if (data.answerId) {
        await navigator.clipboard.writeText(`${window.location.origin}/answers/${data.answerId}`)
        setCopiedLink("link")
        toast({ description: "Link copied to clipboard", variant: "success" })
      } else {
        await navigator.clipboard.writeText(data.answer)
        setCopiedLink("answer")
        toast({ description: "Answer copied to clipboard", variant: "success" })
      }
      setTimeout(() => setCopiedLink(null), 2000)
    } catch {
      toast({ description: "Couldn't copy to clipboard", variant: "error" })
    }
  }

  const handleFlagFeedback = async (key: string, note: string) => {
    try {
      const typeMap: Record<string, "positive" | "negative" | "correction"> = { incorrect: "negative", unsafe: "negative", missing: "correction" }
      await submitFeedback(0, typeMap[key] || "negative")
      toast({ description: "Feedback submitted - thank you", variant: "success" })
    } catch {
      toast({ description: "Couldn't submit feedback - it wasn't saved", variant: "error" })
    }
  }

  const handleExportJson = async () => {
    try {
      const res = await fetch("/api/query/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: data.query }) })
      if (!res.ok) throw new Error("export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `meridian-report-${Date.now()}.json`; a.click()
      URL.revokeObjectURL(url)
      toast({ description: "Report downloaded", variant: "success" })
    } catch {
      toast({ description: "Couldn't export the report - try again", variant: "error" })
    }
  }

  const handlePrintReport = async () => {
    try {
      const res = await fetch("/api/query/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: data.query }) })
      if (!res.ok) throw new Error("report failed")
      const report = await res.json()
      const printWindow = window.open("", "_blank")
      if (!printWindow) throw new Error("popup blocked")
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Meridian Report</title></head><body><h1>Meridian Clinical Query Report</h1><p>${report.header?.disclaimer || ""}</p><h2>Query</h2><p>${report.header?.query || data.query}</p><h2>Answer</h2><pre>${(report.result?.answer || "").replace(/</g, "&lt;")}</pre><h2>Sources</h2>${(report.sources || []).map((s: any) => "<p>" + s.sop_title + " - " + s.section + "</p>").join("")}</body></html>`)
      printWindow.document.close()
      setTimeout(() => printWindow.print(), 500)
    } catch (err) {
      toast({ description: err instanceof Error && err.message === "popup blocked" ? "Print report blocked - allow pop-ups for this site" : "Couldn't generate the report - try again", variant: "error" })
    }
  }

  if (data.error) {
    return (
      <div className="p-6 rounded-2xl bg-card border border-[#FECACA] dark:border-red-500/30">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#B91C1C] dark:text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Backend unavailable</p>
            <p className="text-[15px] text-muted-foreground">Could not reach the Meridian backend. Make sure the Python server is running on port 8000, then try again.</p>
            <p className="text-xs text-muted-foreground mt-3 font-mono bg-muted px-3 py-2 rounded-lg inline-block">
              cd backend &amp;&amp; uvicorn app.main:app --reload
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (data.needsClarification) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="p-6 sm:p-8 rounded-2xl bg-card border border-[#0B6BCB]/30">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5 text-[#0B6BCB]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{data.clarificationQuestion || "Could you clarify your question?"}</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground mt-2">
              This question could match more than one protocol - answering without knowing which one risks giving you the wrong guidance.
            </p>
            {data.clarificationOptions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {data.clarificationOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onFollowup(`${data.query} (regarding ${opt})`)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-[#0B6BCB]/30 bg-[#0B6BCB]/[0.04] text-[#0B6BCB] hover:bg-[#0B6BCB]/10 transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // Small "Based on {SOP} v{X}" metadata line replacing the old grounding
  // bar (SOP pills + generation-mode badge + response time) and the
  // separate colored staleness banner - review status now lives in Trust
  // Details instead of blocking the main answer flow.
  const metadataLine = isAbstained ? null : data.route === "external_evidence"
    ? `Based on ${groundingCitations.length} external literature ${groundingCitations.length === 1 ? "source" : "sources"}`
    : distinctSopTitles[0]
      ? `Based on ${distinctSopTitles[0]}${primaryVersion ? ` v${primaryVersion}` : ""}`
      : null

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-3">

      {/* Conflict Alert Banner */}
      {hasConflict && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className="w-5 h-5 text-[#B91C1C] dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#B91C1C] dark:text-red-400 text-sm">CONFLICT DETECTED</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">The retrieved SOP content contains potentially conflicting guidance.</p>
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

      {/* Numeric redaction caution - a dose/threshold value the model stated
          wasn't found in the cited SOP, so it was removed from the answer
          text rather than shown as fact. The redaction marker is already
          inline in the answer; this banner just makes sure it isn't missed. */}
      {data.numericRedactionApplied && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[#B45309] dark:text-amber-400 text-sm">Value removed for accuracy</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              A specific dose or threshold in this answer could not be confirmed against the cited SOP
              and was removed rather than shown as fact. Verify the exact value directly with the source SOP.
            </p>
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
                  <p className="text-muted-foreground text-xs mt-1">Values in {c.sop_a}: {c.values_a?.join(", ")} vs {c.sop_b}: {c.values_b?.join(", ")}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message header - metadata line + collapse toggle, no dashboard
          chrome (grounding-bar pills / staleness banner / quick facts all
          removed from the main flow; review status lives in Trust Details). */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {metadataLine && (
            <p className="text-xs text-muted-foreground truncate">
              {metadataLine}
              {(data.route === "sop_library" || data.route === "hybrid") && primarySopId && (
                <>
                  {" · "}
                  <button onClick={() => setActiveDrawer("versions")} className="text-[#0B6BCB] hover:underline font-medium">
                    View Version History
                  </button>
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isAbstained && <ReadingLevelToggle value={readingLevel} onChange={onReadingLevelChange} />}
          <button onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand answer" : "Collapse answer"}
            aria-label={collapsed ? "Expand answer" : "Collapse answer"}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && !isAbstained && (
        <AlignmentStatusLine
          comparison={comparison}
          onOpenComparison={() => setActiveDrawer("comparison")}
          onCreateRecommendation={handleCreateRecommendation}
        />
      )}

      {collapsed ? (
        <button onClick={() => setCollapsed(false)}
          className="w-full text-left p-4 rounded-2xl bg-card border border-border hover:border-[#0B6BCB]/30 transition-colors">
          <p className="text-sm text-muted-foreground leading-relaxed">{plainTextPreview(data.answer)}</p>
          {groundingCitations.length > 0 && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <SourceStrip citations={groundingCitations} onSelect={handleCitationClick} />
            </div>
          )}
        </button>
      ) : isAbstained ? (
        <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">No approved SOP found</h2>
              <p className="text-[15px] leading-relaxed text-muted-foreground mt-2">
                Meridian did not find an approved internal SOP or external clinical evidence that directly
                answers this question.
              </p>
            </div>
          </div>
          <div className="mt-6 pt-5 border-t border-border">
            <GapReportPanel queryText={data.query} externalCitations={data.inlineCitations.filter((c) => c.is_external)} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {data.route === "external_evidence" && (
            <div className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <h3 className="text-sm font-semibold text-foreground">No approved SOP found</h3>
              </div>
              <p className="text-[13px] text-muted-foreground mb-3">
                Relevant external clinical evidence is shown below for review.
              </p>
              <GapReportPanel queryText={data.query} externalCitations={data.inlineCitations.filter((c) => c.is_external)} />
            </div>
          )}

          <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm relative">
            <div>
              {plain?.summary && (
                <div className="mb-4 p-3.5 rounded-xl bg-[#0B6BCB]/[0.06] border border-[#0B6BCB]/20">
                  <p className="text-[15px] leading-relaxed text-foreground">
                    <span className="font-semibold text-[#0B6BCB]">In short: </span>
                    {plain.summary}
                  </p>
                </div>
              )}
              <AnswerRenderer text={displayAnswer} citations={data.inlineCitations} onCitationClick={handleCitationClick} animate={isLatest} />
            </div>
            {groundingCitations.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border">
                <SourceStrip citations={groundingCitations} onSelect={handleCitationClick} />
              </div>
            )}
          </div>
          <FeedbackRow queryText={data.query} />
        </div>
      )}

      {!collapsed && (
        <>
          {data.followupQuestions.length > 0 && (
            <FollowupChips questions={data.followupQuestions} onSelect={onFollowup} />
          )}

          {!isAbstained && (
            <AnswerActionToolbar
              primary={[
                ...(primarySopId ? [{ key: "comparison", label: "Compare with Clinical Evidence", icon: GitCompare, onClick: () => setActiveDrawer("comparison"), active: activeDrawer === "comparison" }] : []),
                ...(primarySopId ? [{ key: "versions", label: "Version History", icon: History, onClick: () => setActiveDrawer("versions"), active: activeDrawer === "versions" }] : []),
                ...(hasPermission("create_proposal") ? [{ key: "proposal", label: "Create Update Proposal", icon: PlusCircle, onClick: () => router.push(`/proposals?new=1&sop=${encodeURIComponent(firstCitation)}&query=${encodeURIComponent(data.query)}`) }] : []),
              ]}
              secondary={[
                { key: "evidence", label: "External Evidence", icon: BookOpen, onClick: () => setActiveDrawer("evidence"), active: activeDrawer === "evidence", count: data.sources.length + data.inlineCitations.filter((c) => c.is_external).length || undefined },
                { key: "trust", label: "Trust Details", icon: ShieldCheck, onClick: () => setActiveDrawer("trust"), active: activeDrawer === "trust" },
                { key: "export", label: "Export Answer", icon: Download, onClick: handleExportJson },
                { key: "print", label: "Print Report", icon: Printer, onClick: handlePrintReport },
                { key: "flag", label: "Flag Issue", icon: Flag, onClick: () => setShowFeedbackModal(true) },
                { key: "copy", label: copiedLink === "link" ? "Link copied" : copiedLink === "answer" ? "Copied" : "Copy Link", icon: copiedLink ? Check : Link2, onClick: handleCopyLink },
                {
                  key: "uptodate",
                  label: "Look up in UpToDate (external)",
                  icon: Search,
                  onClick: () => window.open(uptodateSearchUrl(data.query), "_blank", "noopener,noreferrer"),
                },
                {
                  key: "openevidence",
                  label: "Ask on OpenEvidence (external)",
                  icon: ExternalLink,
                  onClick: () => window.open(OPENEVIDENCE_URL, "_blank", "noopener,noreferrer"),
                },
                ...(POLICYTECH_BASE_URL ? [{
                  key: "policytech",
                  label: "Open PolicyTech Portal (external)",
                  icon: Building2,
                  onClick: () => window.open(POLICYTECH_BASE_URL, "_blank", "noopener,noreferrer"),
                }] : []),
              ]}
            />
          )}
        </>
      )}

      {/* External Evidence drawer */}
      <EvidenceDrawer open={activeDrawer === "evidence"} onClose={() => setActiveDrawer(null)} entities={data.entities} queryText={data.query} />

      {/* SOP vs External Protocol Comparison drawer */}
      <SlideOver open={activeDrawer === "comparison"} onClose={() => setActiveDrawer(null)} title="Compare with Clinical Evidence" icon={GitCompare} width="2xl"
        subtitle="Meridian compared the SOP with current clinical evidence.">
        {primarySopId && <ProtocolComparisonPanel sopId={primarySopId} preloaded={comparison !== "loading" ? comparison : undefined} />}
      </SlideOver>

      {/* SOP Version History drawer */}
      <SlideOver open={activeDrawer === "versions"} onClose={() => setActiveDrawer(null)} title="SOP Version History" icon={History} width="2xl"
        subtitle="What changed, why, and who approved it.">
        {primarySopId && <VersionHistoryPanel sopId={primarySopId} />}
      </SlideOver>

      {/* Trust & Audit drawer - folds in Sources, Pipeline Trace, and now
          SOP Review Status (moved out of the main answer flow). */}
      <SlideOver open={activeDrawer === "trust"} onClose={() => setActiveDrawer(null)} title="Trust & Audit" icon={ShieldCheck}
        subtitle="How this answer was produced and what backs it.">
        <TrustAuditPanel
          data={data}
          primaryVersion={primaryVersion}
          primarySopId={primarySopId}
          primaryReviewDate={primaryReviewDate}
          onSelectSource={(c) => setSelectedSource({ id: String(c.number), sop_id: c.sop_id, sop_title: c.sop_title, section: c.section_title, content: c.snippet, score: c.relevance_score })}
        />
      </SlideOver>

      {/* Flag Issue modal */}
      <FeedbackModal open={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} questionText={data.query} onSubmit={handleFlagFeedback} />

      {/* Source Detail drawer */}
      <SlideOver open={!!selectedSource} onClose={() => setSelectedSource(null)} title="Source Detail" icon={FileText}>
        {selectedSource && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SOP Title</label>
              <p className="text-sm font-semibold mt-1">{selectedSource.sop_title}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Section</label>
              <p className="text-sm mt-1">{selectedSource.section}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relevance Score</label>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-[#0B6BCB]" style={{ width: `${selectedSource.score * 100}%` }} />
                </div>
                <span className="text-sm font-mono text-[#0B6BCB]">{(selectedSource.score * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Content</label>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed p-3 rounded-xl bg-muted border border-border">
                {selectedSource.content}
              </p>
            </div>
            <a
              href={selectedSource.sop_id ? libraryDeepLink(selectedSource.sop_id, selectedSource.content, selectedSource.section) : "/library"}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-medium transition-colors mt-4"
            >
              <ExternalLink className="w-4 h-4" />
              Open Full SOP in Library
            </a>
          </div>
        )}
      </SlideOver>
    </motion.div>
  )
}
