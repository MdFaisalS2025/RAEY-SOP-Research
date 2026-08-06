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
  BookOpen, Printer, PlusCircle, HelpCircle,
  Check, Loader2, CheckCircle2, ClipboardEdit, Languages, RotateCcw, Square, Copy, Info,
} from "lucide-react"
import { type InlineCitation } from "@/components/query/citation-chip"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { IconTile } from "@/components/ui/icon-tile"
import { EvidenceDrawer } from "@/components/query/evidence-drawer"
import { FollowupChips } from "@/components/query/followup-chips"
import { SourceList } from "@/components/query/source-list"
import { FeedbackRow } from "@/components/query/feedback-row"
import { AnswerRenderer } from "@/components/query/answer-renderer"
import { ProtocolComparisonPanel, type ComparisonResponse } from "@/components/query/protocol-comparison-panel"
import { VersionHistoryPanel } from "@/components/query/version-history-panel"
import { SopSourcePanel } from "@/components/sop/sop-source-panel"
import { GapReportPanel } from "@/components/query/gap-report-panel"
import { AnswerActionToolbar } from "@/components/query/answer-action-toolbar"
import { TrustAuditPanel } from "@/components/query/trust-audit-panel"
import { simplifyAnswer, type ReadingLevel } from "@/components/query/plain-language"
import { SlideOver } from "@/components/ui/slide-over"
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

// ─── Alignment status line (Workflow 1: physician clinical question) ────────
// Auto-checks whether the SOP just used to answer is still aligned with
// current external evidence - the physician sees this resolve in place
// right under the answer, without clicking "Compare SOP vs Internet" first.
// This is the single most important connective piece of the redesign: it
// turns "here's your answer" into "here's your answer, and here's whether
// it's still current" without an extra step.
// "Partially Aligned" deliberately does NOT get the amber alert triangle -
// it's a routine, common outcome (guidance drifted slightly from current
// literature, not wrong), and an alarming glyph on a routine answer is
// exactly the alert fatigue this app is otherwise careful about elsewhere.
// The triangle is reserved for "Needs Review", the state that actually
// warrants a clinician's attention.
const ALIGNMENT_META: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  "Aligned": { icon: CheckCircle2, className: "text-ok-soft-fg" },
  "Partially Aligned": { icon: Info, className: "text-muted-foreground" },
  "Needs Review": { icon: AlertTriangle, className: "text-warn-soft-fg" },
}

// A single quiet chip above the source strip, not a fragment crowding the
// provenance caption line - "here's your answer, and here's whether it's
// still current" gets its own row instead of competing with SOP/version
// metadata for space.
function AlignmentStatusLine({
  comparison,
  onOpenComparison,
}: {
  comparison: ComparisonResponse | "loading" | null
  onOpenComparison: () => void
}) {
  if (comparison === null) return null
  if (comparison === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground px-1">
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
        Checking alignment with external evidence…
      </span>
    )
  }
  if (!comparison.available || !comparison.summary) return null
  const meta = ALIGNMENT_META[comparison.summary.overall_alignment] ?? ALIGNMENT_META["Needs Review"]
  const { overall_alignment } = comparison.summary
  // Kept deliberately short - match counts and the full recommended-action
  // sentence are one click away in the Compare with Clinical Evidence drawer.
  return (
    <button onClick={onOpenComparison} className={cn("inline-flex items-center gap-1 text-meta font-medium hover:underline px-1", meta.className)}>
      <meta.icon className="w-3.5 h-3.5 shrink-0" />
      {overall_alignment} with external evidence
    </button>
  )
}

export function ChatAnswerMessage({
  data,
  onFollowup,
  onRetry,
  onRegenerate,
  readingLevel,
  onReadingLevelChange,
  isLatest,
}: {
  data: AssistantData
  onFollowup: (q: string) => void
  /** Resubmits data.query. Only meaningful when data.error is set. */
  onRetry?: () => void
  /** Discards this answer and asks the same question again. Only offered
   * on the latest answer - Claude/ChatGPT scope regenerate the same way,
   * since regenerating an earlier turn would orphan everything after it. */
  onRegenerate?: () => void
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
  const [comparison, setComparison] = useState<ComparisonResponse | "loading" | null>(null)
  const [copiedAnswer, setCopiedAnswer] = useState(false)
  const [sourceCitation, setSourceCitation] = useState<InlineCitation | null>(null)

  const hasConflict = data.sopConflicts.length > 0

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
    // own handling, needed here too since SourceList doesn't special-case
    // external citations before calling this handler).
    if (citation?.is_external && citation.url) {
      window.open(citation.url, "_blank", "noopener,noreferrer")
      return
    }

    // Internal SOP citation - open the source in place, highlighted at the
    // exact cited passage, instead of navigating away to /library.
    if (citation?.sop_id) {
      setSourceCitation(citation)
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

  // Replaces the old pair of "Create Update Proposal" (which fed a SOP
  // *title* into the modal's SOP *ID* field - a real prefill bug) and
  // "Create Update Recommendation" (correct prefill, but only offered when
  // a comparison happened to be available and non-Aligned). This is
  // available whenever the user has permission and a primary SOP is known,
  // using the comparison's own recommendation when there is one and a
  // sensible generic prefill otherwise. `override` lets the conflict
  // banner supply its own title/summary instead.
  const handleProposeUpdate = (override?: { title?: string; summary?: string }) => {
    const cmp = comparison && comparison !== "loading" && comparison.available ? comparison : null
    const sopTitle = distinctSopTitles[0] || cmp?.sop_title || ""
    const refName = cmp?.reference_source?.name || "current external evidence"
    const title = override?.title
      ?? (cmp?.summary ? (sopTitle ? `Align ${sopTitle} with ${refName}` : "SOP update recommendation")
                        : (sopTitle ? `Update ${sopTitle}` : "SOP update proposal"))
    const summary = override?.summary
      ?? cmp?.summary?.recommended_action
      ?? `Raised from an Ask Meridian answer to: "${data.query}"`
    router.push(`/proposals?new=1&sop=${encodeURIComponent(primarySopId)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(summary)}`)
  }

  // Unconditional - always copies the answer text itself, promoted to a
  // primary toolbar button. This used to only exist as a side effect of
  // "Copy Link" silently falling back to copying text when no answerId
  // was set, buried as the 4th item of an 11-item overflow menu.
  const handleCopyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(data.answer)
      setCopiedAnswer(true)
      toast({ description: "Answer copied to clipboard", variant: "success" })
      setTimeout(() => setCopiedAnswer(false), 2000)
    } catch {
      toast({ description: "Couldn't copy to clipboard", variant: "error" })
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
      <div className="p-6 rounded-2xl bg-card border border-danger-soft-border">
        <div className="flex items-start gap-4">
          <IconTile icon={AlertTriangle} tone="danger" size="md" />
          <div className="flex-1">
            <p className="font-semibold text-foreground mb-1">Couldn't get an answer</p>
            <p className="text-chat text-muted-foreground">Meridian couldn't reach the server for this question. Your question wasn't lost - try again.</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="press mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-label font-medium bg-danger-soft text-danger-soft-fg hover:bg-danger-soft-border transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Try again
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (data.stopped) {
    return (
      <div className="px-1">
        <AnswerRenderer text={data.answer || "(stopped before any text was generated)"} citations={data.inlineCitations} onCitationClick={handleCitationClick} animate={false} />
        <p className="mt-2 text-meta text-muted-foreground italic flex items-center gap-1.5">
          <Square className="w-3 h-3 fill-current" /> Generation stopped
        </p>
      </div>
    )
  }

  if (data.needsClarification) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="p-6 sm:p-8 rounded-2xl bg-card border border-primary/30">
        <div className="flex items-start gap-4">
          <IconTile icon={HelpCircle} tone="primary" size="lg" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{data.clarificationQuestion || "Could you clarify your question?"}</h2>
            <p className="text-label leading-relaxed text-muted-foreground mt-2">
              This question could match more than one protocol - answering without knowing which one risks giving you the wrong guidance.
            </p>
            {data.clarificationOptions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {data.clarificationOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onFollowup(`${data.query} (regarding ${opt})`)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-chat font-medium border border-primary/30 bg-primary/[0.04] text-primary hover:bg-primary/10 transition-colors"
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

  // Generation-mode tag, surfaced right on the answer instead of two clicks
  // deep in the Trust & Audit drawer. Framed as what it IS (grounded,
  // extractive) rather than what it isn't ("fallback") - extractive
  // answering can't hallucinate since every sentence is lifted from the
  // cited SOP text, so this is a safety property worth showing, not a
  // degradation worth hiding. Suppressed on abstained/gap answers, which
  // have their own dedicated framing already.
  const generationTag = isAbstained ? null : data.generationMode === "llm"
    ? "Model-generated"
    : data.generationMode
      ? "Extractive"
      : null

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="group space-y-3">

      {/* Conflict Alert Banner */}
      {hasConflict && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-danger-soft border border-danger-soft-border flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className="w-5 h-5 text-danger-soft-fg shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-danger-soft-fg text-chat">CONFLICT DETECTED</p>
              <p className="text-label text-muted-foreground mt-0.5">The retrieved SOP content contains potentially conflicting guidance.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowConflictDetails(!showConflictDetails)}
              className="px-3 py-1.5 rounded-lg text-chat border border-danger-soft-border text-danger-soft-fg hover:bg-danger-soft-border transition-colors">
              {showConflictDetails ? "Hide Details" : "View Details"}
            </button>
            {hasPermission("create_proposal") && primarySopId && (
              <button
                onClick={() => handleProposeUpdate({
                  title: distinctSopTitles[0] ? `Resolve conflicting guidance in ${distinctSopTitles[0]}` : "Resolve conflicting SOP guidance",
                  summary: data.sopConflicts.map((c) => c.message).join(" "),
                })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-chat font-medium bg-danger-soft text-danger-soft-fg border border-danger-soft-border hover:bg-danger-soft-border transition-colors">
                <PlusCircle className="w-4 h-4" />
                Propose an SOP update
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Numeric redaction caution - a dose/threshold value the model stated
          wasn't found in the cited SOP, so it was removed from the answer
          text rather than shown as fact. The redaction marker is already
          inline in the answer; this one line just makes sure it isn't
          missed, without the icon-card weight of a standalone banner. */}
      {data.numericRedactionApplied && (
        <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-1.5 text-label text-warn-soft-fg px-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          A value couldn&apos;t be confirmed against the cited SOP and was removed - verify directly.
        </motion.p>
      )}

      {/* Conflict details */}
      <AnimatePresence>
        {showConflictDetails && hasConflict && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="p-4 rounded-2xl bg-card border border-danger-soft-border space-y-2">
              {data.sopConflicts.map((c, i) => (
                <div key={i} className="p-3 rounded-lg bg-danger-soft border border-danger-soft-border text-chat">
                  <p className="font-semibold text-danger-soft-fg">{c.message}</p>
                  <p className="text-muted-foreground text-meta mt-1">Values in {c.sop_a}: {c.values_a?.join(", ")} vs {c.sop_b}: {c.values_b?.join(", ")}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message header - one caption line only (SOP + version, generation
          mode, context-degraded notice). No dashboard chrome (grounding-bar
          pills / staleness banner / quick facts all removed from the main
          flow; review status lives in Trust & Audit). Collapse and the
          reading-level toggle used to live here as always-visible chrome
          above every answer before the reader had read a word - collapse is
          gone (the thread scrolls; collapsing is a panel idiom this isn't),
          and reading level moved into the action toolbar's overflow menu
          below. */}
      {(metadataLine || generationTag || data.contextDegraded) && (
        <div className="min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-meta px-1">
          {metadataLine && <span className="text-muted-foreground">{metadataLine}</span>}
          {generationTag && (
            <>
              {metadataLine && <span className="text-subtle">·</span>}
              <span
                title={generationTag === "Extractive" ? "Assembled directly from the cited SOP text - not model-synthesized, so it can't introduce facts the SOP doesn't contain." : "Drafted by the in-house model, then checked against the cited SOP text."}
                className="text-muted-foreground cursor-help"
              >
                {generationTag}
              </span>
            </>
          )}
          {data.contextDegraded && (
            <>
              <span className="text-subtle">·</span>
              <span
                title="The conversational path failed for this turn, so it was answered without your earlier questions as context - a follow-up referencing them may not land."
                className="text-warn-soft-fg cursor-help"
              >
                Answered without conversation memory
              </span>
            </>
          )}
        </div>
      )}

      {isAbstained ? (
        <Card padding="lg" className="sm:p-8">
          <div className="flex items-start gap-4">
            <IconTile icon={FileText} tone="muted" size="lg" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">No approved SOP found</h2>
              <p className="text-chat leading-relaxed text-muted-foreground mt-2">
                Meridian did not find an approved internal SOP or external clinical evidence that directly
                answers this question.
              </p>
            </div>
          </div>
          <div className="mt-6 pt-5 border-t border-border">
            <GapReportPanel queryText={data.query} externalCitations={data.inlineCitations.filter((c) => c.is_external)} />
          </div>
        </Card>
      ) : (
        // Bare prose, no bordered card - matches ChatGPT/Claude's answer
        // treatment. This also fixes a real defect: the streaming shell just
        // above (in query/page.tsx) is bare (`px-1`, no card), so the old
        // Card wrapper here made the prose jump ~25px right/down the instant
        // an answer finalized (border + p-6 appearing where there was none).
        <div className="space-y-3">
          {data.route === "external_evidence" && (
            <Card padding="sm">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <h3 className="text-sm font-semibold text-foreground">No approved SOP found</h3>
              </div>
              <p className="text-label text-muted-foreground mb-3">
                Relevant external clinical evidence is shown below for review.
              </p>
              <GapReportPanel queryText={data.query} externalCitations={data.inlineCitations.filter((c) => c.is_external)} />
            </Card>
          )}

          <div className="px-1 relative">
            <div>
              {plain?.summary && (
                <div className="mb-4 p-3.5 rounded-xl bg-muted border border-border">
                  <p className="text-chat leading-relaxed text-foreground">
                    <span className="font-semibold text-foreground">In short: </span>
                    {plain.summary}
                  </p>
                </div>
              )}
              <AnswerRenderer text={displayAnswer} citations={data.inlineCitations} onCitationClick={handleCitationClick} animate={isLatest} />
            </div>
            {!isAbstained && (
              <div className="mt-3">
                <AlignmentStatusLine comparison={comparison} onOpenComparison={() => setActiveDrawer("comparison")} />
              </div>
            )}
            {groundingCitations.length > 0 && (
              <div className="mt-6 pt-5 border-t border-border">
                <SourceList citations={groundingCitations} onSelect={handleCitationClick} />
              </div>
            )}
          </div>

          {/* Hover-revealed on desktop (matches Claude/ChatGPT's per-message
              action treatment), always visible below sm and whenever
              anything inside has focus - a keyboard user tabbing to Copy
              must not lose it the instant the mouse moves away. The `group`
              trigger is the outer motion.div wrapping this whole message. */}
          <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 sm:transition-opacity sm:duration-150 max-sm:opacity-100">
            <FeedbackRow queryText={data.query} answerId={data.answerId} />
          </div>
        </div>
      )}

      {data.followupQuestions.length > 0 && (
        <FollowupChips questions={data.followupQuestions} onSelect={onFollowup} />
      )}

      {!isAbstained && (
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 sm:transition-opacity sm:duration-150 max-sm:opacity-100">
          <AnswerActionToolbar
            // Visible row is Copy + Regenerate - everything else a
            // clinician might do next is one click into More. Cut from 13
            // overflow items to 6: the removed ones each duplicated a
            // control already sitting closer to the answer (View SOP
            // Source and Compare with Clinical Evidence are reachable from
            // citation chips / the AlignmentStatusLine chip respectively;
            // Flag Issue's taxonomy moved onto FeedbackRow's thumbs-down;
            // Create Update Proposal was a buggy duplicate of the kept
            // Propose-an-SOP-update action; Copy Link and Export Answer are
            // dropped outright, not relocated - Print Report covers the
            // record-keeping case). External hand-offs (UpToDate, PubMed,
            // OpenEvidence, PolicyTech) live in the External Evidence
            // drawer, not on every message.
            primary={[
              { key: "copy-answer", label: copiedAnswer ? "Copied" : "Copy", icon: copiedAnswer ? Check : Copy, onClick: handleCopyAnswer },
              ...(onRegenerate ? [{ key: "regenerate", label: "Regenerate", icon: RotateCcw, onClick: onRegenerate }] : []),
            ]}
            secondary={[
              {
                key: "reading-level",
                label: readingLevel === "plain" ? "Switch to clinical language" : "Switch to plain language",
                icon: Languages,
                onClick: () => onReadingLevelChange(readingLevel === "plain" ? "clinical" : "plain"),
                active: readingLevel === "plain",
              },
              { key: "evidence", label: "External Evidence", icon: BookOpen, onClick: () => setActiveDrawer("evidence"), active: activeDrawer === "evidence", count: data.sources.length + data.inlineCitations.filter((c) => c.is_external).length || undefined },
              { key: "trust", label: "Trust & Audit", icon: ShieldCheck, onClick: () => setActiveDrawer("trust"), active: activeDrawer === "trust" },
              ...(primarySopId ? [{ key: "versions", label: "Version History", icon: History, onClick: () => setActiveDrawer("versions"), active: activeDrawer === "versions" }] : []),
              ...(hasPermission("create_proposal") && primarySopId
                ? [{ key: "propose-update", label: "Propose an SOP update", icon: ClipboardEdit, onClick: () => handleProposeUpdate() }]
                : []),
              { key: "print", label: "Print Report", icon: Printer, onClick: handlePrintReport },
            ]}
          />
        </div>
      )}

      {/* In-place SOP source viewer - opened from a citation click (in the
          prose or the source list), instead of navigating away. */}
      <SopSourcePanel citation={sourceCitation} onClose={() => setSourceCitation(null)} />

      {/* External Evidence drawer */}
      <EvidenceDrawer open={activeDrawer === "evidence"} onClose={() => setActiveDrawer(null)} entities={data.entities} queryText={data.query} />

      {/* SOP vs External Protocol Comparison drawer */}
      <SlideOver open={activeDrawer === "comparison"} onClose={() => setActiveDrawer(null)} title="Compare with Clinical Evidence" icon={GitCompare} width="2xl">
        {primarySopId && <ProtocolComparisonPanel sopId={primarySopId} preloaded={comparison !== "loading" ? comparison : undefined} />}
      </SlideOver>

      {/* SOP Version History drawer */}
      <SlideOver open={activeDrawer === "versions"} onClose={() => setActiveDrawer(null)} title="SOP Version History" icon={History} width="2xl">
        {primarySopId && <VersionHistoryPanel sopId={primarySopId} />}
      </SlideOver>

      {/* Trust & Audit drawer - folds in Sources, Pipeline Trace, and now
          SOP Review Status (moved out of the main answer flow). */}
      <SlideOver open={activeDrawer === "trust"} onClose={() => setActiveDrawer(null)} title="Trust & Audit" icon={ShieldCheck}>
        <TrustAuditPanel
          data={data}
          primaryVersion={primaryVersion}
          primarySopId={primarySopId}
          primaryReviewDate={primaryReviewDate}
          onSelectSource={(c) => setSelectedSource({ id: String(c.number), sop_id: c.sop_id, sop_title: c.sop_title, section: c.section_title, content: c.snippet, score: c.relevance_score })}
        />
      </SlideOver>

      {/* Source Detail drawer */}
      <SlideOver open={!!selectedSource} onClose={() => setSelectedSource(null)} title="Source Detail" icon={FileText}>
        {selectedSource && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SOP Title</p>
              <p className="text-sm font-semibold mt-1">{selectedSource.sop_title}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Section</p>
              <p className="text-sm mt-1">{selectedSource.section}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relevance Score</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${selectedSource.score * 100}%` }} />
                </div>
                <span className="text-sm font-mono text-primary">{(selectedSource.score * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Content</p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed p-3 rounded-xl bg-muted border border-border">
                {selectedSource.content}
              </p>
            </div>
            <a
              href={selectedSource.sop_id ? libraryDeepLink(selectedSource.sop_id, selectedSource.content, selectedSource.section) : "/library"}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-sm font-medium transition-colors mt-4"
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
