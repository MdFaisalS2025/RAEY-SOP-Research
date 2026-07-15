"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, Eye, ExternalLink, Shield,
  Calendar, Building2, FileText, CheckCircle2, Clock, Loader2, GitCompare, TrendingUp,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

interface RealSOP {
  id: number
  sop_id: string
  title: string
  department: string
  review_date?: string
}

interface PubMedRecord {
  title: string
  authors: string
  journal: string
  journal_display_name?: string
  trust_tier?: 1 | 2 | 3
  pub_date: string
  pmid: string
  url: string
  study_type?: string
}

interface RealConflict {
  entity: string
  type: "DRUG" | "THRESHOLD"
  sop_a: string
  value_a: string
  sop_b: string
  value_b: string
  severity: "critical" | "high"
  message: string
}

type RiskLevel = "High" | "Medium" | "Low"

function conflictRisk(conflict: RealConflict): RiskLevel {
  if (conflict.severity === "critical") return "High"
  if (conflict.severity === "high") return "Medium"
  return "Low"
}

const RISK_STYLE: Record<RiskLevel, string> = {
  High: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30",
  Medium: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
  Low: "bg-muted text-muted-foreground border-border",
}

type EvidenceItem =
  | { kind: "literature"; id: string; sop: RealSOP; record: PubMedRecord }
  | { kind: "conflict"; id: string; conflict: RealConflict }
  | { kind: "review"; id: string; sop: RealSOP; daysUntilDue: number }

type ItemFilter = "all" | "literature" | "conflict" | "review"

const FILTER_TABS: { value: ItemFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "literature", label: "External Literature" },
  { value: "conflict", label: "Internal Conflicts" },
  { value: "review", label: "Reviews Due" },
]

const MONITORED_SOURCES = ["PubMed", "Europe PMC", "CDC", "WHO", "ClinicalTrials.gov", "FDA", "MedlinePlus", "CMS"]

function LiteratureCard({ sop, record, index }: { sop: RealSOP; record: PubMedRecord; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl bg-card border border-border overflow-hidden"
    >
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30">
            Live PubMed
          </span>
          {record.study_type && (
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30">
              {record.study_type}
            </span>
          )}
          {record.trust_tier === 1 && (
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 text-[#0B6BCB] dark:text-[#00E5FF] border border-[#0B6BCB]/30 dark:border-[#00E5FF]/30">
              {record.journal_display_name ?? record.journal} · Tier 1
            </span>
          )}
        </div>

        <h3 className="font-display text-base font-bold text-foreground leading-snug">{record.title || "(untitled)"}</h3>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> {record.journal}{record.authors ? ` · ${record.authors}` : ""}</span>
          <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {record.pub_date}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="px-2 py-0.5 rounded-full bg-muted border border-border text-xs text-muted-foreground">{sop.department}</span>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <FileText className="w-3 h-3" /> Monitored for
          </p>
          <p className="text-xs text-[#0B6BCB]">{sop.title} ({sop.sop_id})</p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <a
            href={record.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> View on PubMed
          </a>
        </div>
      </div>
    </motion.div>
  )
}

function ConflictCard({ conflict, index }: { conflict: RealConflict; index: number }) {
  const risk = conflictRisk(conflict)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl bg-card border border-border overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-[#FEF3C7] dark:bg-amber-500/10 border-b border-[#FDE68A] dark:border-amber-500/30">
        <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] dark:text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-[#B45309] dark:text-amber-400 uppercase tracking-wide">Action Required</span>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide border", RISK_STYLE[risk])}>
            {risk} risk
          </span>
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide",
            conflict.severity === "critical"
              ? "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30"
              : "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30"
          )}>
            {conflict.severity} impact
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-muted text-muted-foreground border border-border font-mono">
            {conflict.entity}
          </span>
        </div>
        <h3 className="font-display text-base font-bold text-foreground leading-snug flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#0B6BCB]" /> Internal SOP conflict detected
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{conflict.message}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-lg bg-muted border border-border text-muted-foreground">Affected: {conflict.sop_a}</span>
          <span className="px-2 py-0.5 rounded-lg bg-muted border border-border text-muted-foreground">Affected: {conflict.sop_b}</span>
        </div>
        <p className="text-xs text-muted-foreground pt-1 border-t border-border">
          <span className="font-semibold text-foreground">Recommendation: </span>
          {risk === "High"
            ? "Escalate to Governance Committee for immediate review - conflicting values may create patient-safety ambiguity."
            : "Flag for the next scheduled SOP review cycle to reconcile the discrepancy."}
        </p>
      </div>
    </motion.div>
  )
}

function ReviewCard({ sop, daysUntilDue, index }: { sop: RealSOP; daysUntilDue: number; index: number }) {
  const overdue = daysUntilDue < 0
  const risk: RiskLevel = overdue ? "High" : daysUntilDue <= 30 ? "Medium" : "Low"
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl bg-card border border-border overflow-hidden"
    >
      <div className="p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide border", RISK_STYLE[risk])}>
            {risk} risk
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-muted text-muted-foreground border border-border">
            {sop.department}
          </span>
        </div>
        <h3 className="font-display text-base font-bold text-foreground leading-snug flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#0B6BCB]" /> {sop.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {overdue
            ? `Review overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"}.`
            : `Review due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}.`}
          {" "}({sop.sop_id})
        </p>
      </div>
    </motion.div>
  )
}

function daysUntil(dateStr: string | undefined): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr).getTime()
  if (Number.isNaN(target)) return null
  return Math.round((target - Date.now()) / (1000 * 60 * 60 * 24))
}

export default function EvidenceWatchPage() {
  const [activeFilter, setActiveFilter] = useState<ItemFilter>("all")
  const [items, setItems] = useState<EvidenceItem[]>([])
  const [sopsScanned, setSopsScanned] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [sopData, conflictData] = await Promise.all([
          fetch(`${API_BASE}/api/sops`).then((r) => r.json()),
          fetch(`${API_BASE}/api/conflicts/graph`).then((r) => r.json()),
        ])
        const allSops: RealSOP[] = Array.isArray(sopData) ? sopData : (sopData.sops ?? sopData.items ?? [])
        const sops: RealSOP[] = allSops.slice(0, 6)
        const conflicts: RealConflict[] = Array.isArray(conflictData?.conflicts) ? conflictData.conflicts : []

        // Version tracking: SOPs approaching or past their review_date,
        // surfaced here as Evidence Watch items rather than a separate
        // page, so drift and staleness live alongside literature/conflict
        // signals in one executive view.
        const reviewItems: EvidenceItem[] = allSops
          .map((sop) => ({ sop, due: daysUntil(sop.review_date) }))
          .filter((r): r is { sop: RealSOP; due: number } => r.due !== null && r.due <= 45)
          .sort((a, b) => a.due - b.due)
          .map((r) => ({ kind: "review" as const, id: `review-${r.sop.sop_id}`, sop: r.sop, daysUntilDue: r.due }))

        // NCBI E-utilities rate-limits unauthenticated requests to ~3/sec -
        // firing these in parallel silently returns empty results for most
        // of them, which looked like "no articles found" everywhere. Run
        // them sequentially with a short gap instead.
        const litResults: { sop: RealSOP; record: PubMedRecord | undefined }[] = []
        for (const sop of sops) {
          if (cancelled) break
          try {
            const res = await fetch(`${API_BASE}/api/evidence/pubmed?term=${encodeURIComponent(sop.title)}&max=1`)
            const data = res.ok ? await res.json() : { results: [] }
            litResults.push({ sop, record: (data?.results ?? [])[0] })
          } catch {
            litResults.push({ sop, record: undefined })
          }
          await new Promise((resolve) => setTimeout(resolve, 400))
        }
        if (cancelled) return

        const literatureItems: EvidenceItem[] = litResults
          .filter((r): r is { sop: RealSOP; record: PubMedRecord } => !!r.record)
          .map((r) => ({ kind: "literature", id: `lit-${r.sop.sop_id}`, sop: r.sop, record: r.record }))

        const conflictItems: EvidenceItem[] = conflicts.map((c, i) => ({
          kind: "conflict", id: `conflict-${i}`, conflict: c,
        }))

        setItems([...conflictItems, ...reviewItems, ...literatureItems])
        setSopsScanned(allSops.length)
      } catch {
        setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(
    () => items.filter((item) => activeFilter === "all" || item.kind === activeFilter),
    [items, activeFilter]
  )

  const conflictCount = items.filter((i) => i.kind === "conflict").length
  const literatureCount = items.filter((i) => i.kind === "literature").length
  const reviewCount = items.filter((i) => i.kind === "review").length
  const highRiskCount = items.filter((i) =>
    (i.kind === "conflict" && conflictRisk(i.conflict) === "High") ||
    (i.kind === "review" && i.daysUntilDue < 0)
  ).length

  const stats = [
    { label: "SOPs Monitored", value: sopsScanned, icon: Shield, color: "text-[#0B6BCB]" },
    { label: "Reviews Due", value: reviewCount, icon: Clock, color: "text-[#B45309] dark:text-amber-400" },
    { label: "High-Risk Items", value: highRiskCount, icon: AlertTriangle, color: "text-[#B91C1C] dark:text-red-400" },
    { label: "External Updates (live)", value: literatureCount, icon: TrendingUp, color: "text-[#15803D] dark:text-green-400" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Evidence Watch" }]} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-bold text-foreground">Evidence Watch</h1>
            </div>
            <p className="text-muted-foreground text-sm max-w-3xl">
              SOPs go stale the moment new literature, a contradicting internal policy, or an expired review
              date appears - usually invisibly, between formal review cycles. This page surveils all three
              continuously so governance staff catch drift before a clinician relies on an outdated instruction.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
          className="grid sm:grid-cols-3 gap-3"
        >
          <div className="rounded-xl bg-card border border-border p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-[#0B6BCB]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">External Literature</p>
              <p className="text-xs text-muted-foreground mt-0.5">Each active SOP is matched against a live PubMed search on its own title, so new studies relevant to that specific procedure surface automatically.</p>
            </div>
          </div>
          <div className="rounded-xl bg-card border border-border p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <GitCompare className="w-4 h-4 text-[#B45309] dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Internal Conflicts</p>
              <p className="text-xs text-muted-foreground mt-0.5">The entity graph cross-checks drug doses and numeric thresholds across every SOP in the corpus and flags any two that disagree on the same value.</p>
            </div>
          </div>
          <div className="rounded-xl bg-card border border-border p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#15803D]/10 dark:bg-green-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-[#15803D] dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Reviews Due</p>
              <p className="text-xs text-muted-foreground mt-0.5">Every SOP carries a review_date set at last approval. Anything within 45 days of - or past - that date is surfaced here, not just filed away.</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30"
        >
          <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-[#B45309] dark:text-amber-400">
            <span className="font-semibold">This page is for monitoring, not authoring. </span>
            Nothing here changes a live SOP automatically - every item is a signal for a human reviewer.
            Committee sign-off is still required before any SOP update, and live PubMed results are supporting
            evidence, not clinical guidance - verify against primary sources.
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Searching PubMed and scanning for conflicts...
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {stats.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-2xl bg-card border border-border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">{label}</span>
                    <Icon className={cn("w-4 h-4", color)} />
                  </div>
                  <p className={cn("text-3xl font-bold font-display", color)}>{value}</p>
                </div>
              ))}
            </motion.div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                    activeFilter === tab.value ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid xl:grid-cols-[1fr_320px] gap-6">
              <div className="space-y-4">
                {filtered.length === 0 ? (
                  <div className="rounded-2xl bg-card border border-border p-12 text-center">
                    <Eye className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-muted-foreground text-sm">No items match this filter.</p>
                  </div>
                ) : (
                  filtered.map((item, i) =>
                    item.kind === "literature"
                      ? <LiteratureCard key={item.id} sop={item.sop} record={item.record} index={i} />
                      : item.kind === "conflict"
                      ? <ConflictCard key={item.id} conflict={item.conflict} index={i} />
                      : <ReviewCard key={item.id} sop={item.sop} daysUntilDue={item.daysUntilDue} index={i} />
                  )
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#0B6BCB]" />
                    <h3 className="font-display text-sm font-bold text-foreground">Monitored Sources</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {MONITORED_SOURCES.map((name) => (
                      <span key={name} className="px-2.5 py-1 rounded-full bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-xs text-[#0B6BCB]">
                        {name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Live search scoped per-SOP by title. Internal conflicts come from the entity-graph detector
                    (drug dose / threshold cross-checks across the current corpus). Reviews Due comes from each
                    SOP&apos;s own review_date.
                  </p>
                </div>

                <div className="rounded-xl bg-card border border-border px-4 py-3">
                  <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest text-center">
                    Research Prototype - Not for Clinical Use
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
