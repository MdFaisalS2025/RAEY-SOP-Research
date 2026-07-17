"use client"

// Trust & Audit drawer content - extracted from the old inline TrustPanel
// (which had its own expand/collapse chrome sitting in the answer column).
// Same computed values, restyled as clear labeled cards since the drawer
// itself is now the "expand" - no need for a second collapse layer inside
// it. Adds the fields the redesign specifically asked for that weren't
// already surfaced: SOP version used, audit event id, user role, generated
// timestamp, and folds in what the old standalone "Sources" panel showed.

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ShieldCheck, ShieldAlert, ShieldX, Gauge, Layers, Cpu, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronRight, Clock, User, Hash, FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { SourcePanel } from "@/components/query/source-panel"
import { reviewStaleness, daysUntilReview, type InlineCitation } from "@/components/query/citation-chip"
import { useRole } from "@/lib/role-context"

// Structural subset of query/page.tsx's AssistantData - kept local rather
// than imported from the page (which itself imports this component) to
// avoid a page <-> component circular import for what would otherwise be
// a type-only reference.
export interface TrustAuditData {
  reasoning: string
  verification: {
    status: "passed" | "warning" | "failed"
    confidence: number
    thresholdChecks: { parameter: string; value: string; status: string; source: string }[]
    sequenceChecks: { procedure: string; steps: string[]; correct: boolean; source: string }[]
    contraindicationChecks: { item: string; safe: boolean; note: string; source: string }[]
  }
  faithfulness: any
  inlineCitations: InlineCitation[]
  route: string
  generationMode: string | null
  answerId: string | null
  answeredAt: number
  confidenceTier: string
}

function extractEvidenceScore(reasoning: string): number | null {
  const m = reasoning.match(/Evidence:\s*\w+\s*\(score:\s*([\d.]+)\)/)
  return m ? parseFloat(m[1]) : null
}

const ROUTE_CONFIG: Record<string, { label: string; className: string }> = {
  sop_library: { label: "Sourced from: SOP Library", className: "bg-muted text-muted-foreground border-border" },
  external_evidence: { label: "Sourced from: External Literature", className: "bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 text-[#0B6BCB] dark:text-[#00E5FF] border-[#0B6BCB]/30 dark:border-[#00E5FF]/30" },
  hybrid: { label: "Sourced from: SOP Library + External Literature", className: "bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 text-[#0B6BCB] dark:text-[#00E5FF] border-[#0B6BCB]/30 dark:border-[#00E5FF]/30" },
  no_evidence: { label: "No source available", className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30" },
}

function InfoCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone?: "warning" }) {
  return (
    <div className={cn("flex items-start gap-2.5 p-3 rounded-xl border",
      tone === "warning" ? "bg-[#FEF3C7] dark:bg-amber-500/10 border-[#FDE68A] dark:border-amber-500/30" : "bg-muted border-border")}>
      <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", tone === "warning" ? "text-[#B45309] dark:text-amber-400" : "text-muted-foreground")} />
      <div className="min-w-0">
        <p className={cn("text-[11px] font-medium uppercase tracking-wide", tone === "warning" ? "text-[#B45309] dark:text-amber-400" : "text-muted-foreground")}>{label}</p>
        <p className="text-sm text-foreground font-medium break-words">{value}</p>
      </div>
    </div>
  )
}

export function TrustAuditPanel({
  data,
  primaryVersion,
  primarySopId,
  primaryReviewDate,
  onSelectSource,
}: {
  data: TrustAuditData
  primaryVersion: string
  primarySopId: string
  primaryReviewDate?: string
  onSelectSource?: (citation: any) => void
}) {
  const { role } = useRole()
  const [showSentenceCheck, setShowSentenceCheck] = useState(false)
  const [showTrace, setShowTrace] = useState(false)

  const status = data.verification.status
  const statusConfig = {
    passed: { icon: ShieldCheck, label: "Verified", className: "text-[#15803D] dark:text-green-400" },
    warning: { icon: ShieldAlert, label: "Caution", className: "text-[#B45309] dark:text-amber-400" },
    failed: { icon: ShieldX, label: "Unverified", className: "text-[#B91C1C] dark:text-red-400" },
  }
  const sc = statusConfig[status]

  const confidencePct = Math.round(data.verification.confidence * 100)
  const confidenceLevel = data.verification.confidence >= 0.7 ? "high" : data.verification.confidence >= 0.5 ? "medium" : "low"
  const confidenceColor = confidenceLevel === "high" ? "text-[#15803D] dark:text-green-400" : confidenceLevel === "medium" ? "text-[#B45309] dark:text-amber-400" : "text-[#B91C1C] dark:text-red-400"
  // Backend-calibrated label (see evidence_sufficiency.py's
  // confidence_tier()) - calibrated against real separation between
  // sufficient/insufficient evidence, not just a bare score cutoff. Shown
  // in place of the raw percentage since a calibrated word ("Moderate
  // Confidence") is more honest than false precision like "73%
  // confidence" for a number that was never a true probability. Falls
  // back to the percentage for older/restored answers computed before
  // this field existed.
  const tierLabel = data.confidenceTier || null

  const faithfulness = data.faithfulness
  const faithfulnessPct = faithfulness ? Math.round(faithfulness.overall_faithfulness * 100) : null

  const evScore = extractEvidenceScore(data.reasoning)
  const distinctSopTitles = Array.from(new Set(data.inlineCitations.map((c) => c.sop_title)))
  const routeInfo = ROUTE_CONFIG[data.route] ?? ROUTE_CONFIG.sop_library

  // Governance info (review overdue/due-soon) lives here instead of
  // interrupting the main answer flow with a colored banner.
  const reviewDays = daysUntilReview(primaryReviewDate)
  const staleness = reviewDays !== null && reviewDays <= 30 ? reviewStaleness(primaryReviewDate) : null

  const allChecks = [
    ...data.verification.thresholdChecks,
    ...data.verification.sequenceChecks.map((c) => ({ status: c.correct ? "pass" : "fail" })),
    ...data.verification.contraindicationChecks.map((c) => ({ status: c.safe ? "pass" : "fail" })),
  ]
  const checksPassed = allChecks.filter((c) => c.status === "pass").length

  return (
    <div className="space-y-5">
      {/* At-a-glance summary */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 rounded-xl bg-muted border border-border">
        <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", sc.className)}>
          <sc.icon className="w-4 h-4" /> {sc.label}
        </span>
        <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", confidenceColor)} title={`${confidencePct}% raw score`}>
          <Gauge className="w-3.5 h-3.5" /> {tierLabel ?? `${confidencePct}% confidence`}
        </span>
        {faithfulnessPct !== null && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Layers className="w-3.5 h-3.5" /> {faithfulnessPct}% grounded in source
          </span>
        )}
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border", routeInfo.className)}>
          {routeInfo.label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">
        {confidenceLevel === "high" && "Well supported by SOP evidence. All key details verified."}
        {confidenceLevel === "medium" && "Partially supported. Some details may need manual verification."}
        {confidenceLevel === "low" && "Limited evidence found. Check the source SOP before acting."}
        {allChecks.length > 0 && ` ${checksPassed} of ${allChecks.length} safety checks passed.`}
        {evScore !== null && ` Evidence score ${evScore.toFixed(2)}.`}
      </p>

      {/* Audit metadata */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Audit Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {primaryVersion && <InfoCard label="SOP Version Used" icon={FileText} value={`v${primaryVersion}${primarySopId ? ` (${primarySopId})` : ""}`} />}
          {staleness && <InfoCard label="Review Status" icon={AlertTriangle} value={staleness.label} tone="warning" />}
          <InfoCard label="Generated" icon={Clock} value={new Date(data.answeredAt).toLocaleString()} />
          <InfoCard label="User Role" icon={User} value={role.replace(/_/g, " ")} />
          <InfoCard label="Audit Event ID" icon={Hash} value={data.answerId ?? "not persisted"} />
          <InfoCard label="Generation Mode" icon={Cpu} value={data.generationMode === "llm" ? "In-house model" : data.generationMode === "mock_fallback" ? "Extractive (model fallback)" : "Extractive (no model configured)"} />
          <InfoCard label="Sources Consulted" icon={Layers} value={`${distinctSopTitles.length} SOP${distinctSopTitles.length === 1 ? "" : "s"}`} />
        </div>
      </div>

      {/* Safety checks */}
      {allChecks.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Safety Checks</p>
          {data.verification.thresholdChecks.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Threshold Checks</p>
              <div className="space-y-2">
                {data.verification.thresholdChecks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted">
                    {c.status === "pass" ? <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-green-400 shrink-0" /> : <XCircle className="w-4 h-4 text-[#B91C1C] dark:text-red-400 shrink-0" />}
                    <span className="flex-1 text-sm text-foreground">{c.parameter}: <span className="font-mono text-[#0B6BCB]">{c.value}</span></span>
                    <span className={cn("text-xs font-semibold", c.status === "pass" ? "text-[#15803D] dark:text-green-400" : "text-[#B91C1C] dark:text-red-400")}>{c.status.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.verification.sequenceChecks.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Sequence Checks</p>
              <div className="space-y-2">
                {data.verification.sequenceChecks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted">
                    {c.correct ? <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-green-400" /> : <XCircle className="w-4 h-4 text-[#B91C1C] dark:text-red-400" />}
                    <span className="text-sm text-foreground">{c.procedure}</span>
                    <span className="text-muted-foreground text-xs ml-auto">{c.correct ? "Correct order" : "Order issue"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.verification.contraindicationChecks.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Contraindication Checks</p>
              <div className="space-y-2">
                {data.verification.contraindicationChecks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted">
                    {c.safe ? <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-green-400" /> : <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400" />}
                    <span className="flex-1 text-sm text-foreground">{c.item}</span>
                    <span className="text-xs text-muted-foreground">{c.note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sentence-level faithfulness */}
      {faithfulness?.sentences && faithfulness.sentences.length > 0 && (
        <div>
          <button onClick={() => setShowSentenceCheck(!showSentenceCheck)}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
            {showSentenceCheck ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Sentence-Level Grounding ({faithfulness.total_checked} sentences)
          </button>
          <AnimatePresence>
            {showSentenceCheck && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="space-y-2 pt-2">
                  {faithfulness.sentences.map((s: any, i: number) => (
                    <div key={i} className={cn("p-2.5 rounded-lg text-[13px] leading-relaxed", s.grounded ? "bg-muted" : "bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30")}>
                      <span className="text-foreground">{s.text}</span>
                      {!s.grounded && <span className="ml-2 text-[#B45309] dark:text-amber-400 text-xs font-semibold">Not found in SOP</span>}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Pipeline trace */}
      {data.reasoning && (
        <div>
          <button onClick={() => setShowTrace(!showTrace)}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
            {showTrace ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Pipeline Trace
          </button>
          <AnimatePresence>
            {showTrace && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <pre className="mt-2 p-3 rounded-lg bg-muted text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono overflow-x-auto">
                  {data.reasoning}
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Sources */}
      {data.inlineCitations.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sources</p>
          <SourcePanel citations={data.inlineCitations} highlightedNumber={null} onSelect={onSelectSource} />
        </div>
      )}

      <p className="text-[11px] text-subtle pt-2 border-t border-border">
        This response supports SOP review and clinical workflow. It does not replace approved hospital policy or clinical judgment.
      </p>
    </div>
  )
}
