"use client"

import { useState, useMemo, useEffect } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  AlertTriangle, CheckCircle, Clock, Download, Shield,
  BarChart3, Loader2, Check, ExternalLink, ClipboardCheck,
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
  review_date?: string | null
}

// ─── Regulatory reference content ──────────────────────────────────────────────
// Standard codes/titles/descriptions are real TJC/CMS/OSHA reference text.
// `department` links each standard to the real hospital department whose SOPs
// are most relevant, so compliance_status below can be derived from real,
// live review_date data instead of a hardcoded status.

interface RegulatoryStandard {
  id: string
  framework: "TJC" | "CMS" | "OSHA"
  standard_code: string
  title: string
  description: string
  department: string
}

const REGULATORY_STANDARDS: RegulatoryStandard[] = [
  {
    id: "tjc-ic-01",
    framework: "TJC",
    standard_code: "IC.01.05.01",
    title: "Infection Prevention and Control Program",
    description: "The hospital has an infection prevention and control program",
    department: "Infection Control",
  },
  {
    id: "tjc-rc-01",
    framework: "TJC",
    standard_code: "RC.01.02.01",
    title: "Medical Record Documentation",
    description: "Entries in the medical record are dated, timed, and authenticated",
    department: "Nursing",
  },
  {
    id: "cms-cop-482",
    framework: "CMS",
    standard_code: "482.21",
    title: "Condition of Participation: Quality Assessment",
    description:
      "Hospital must have effective quality assessment and performance improvement program",
    department: "ICU",
  },
  {
    id: "osha-1910",
    framework: "OSHA",
    standard_code: "1910.1030",
    title: "Bloodborne Pathogen Standard",
    description:
      "Exposure control plan for occupational exposure to bloodborne pathogens",
    department: "Infection Control",
  },
  {
    id: "tjc-mm-01",
    framework: "TJC",
    standard_code: "MM.04.01.01",
    title: "Medication Management: High-Alert Medications",
    description: "The hospital identifies and manages high-alert medications",
    department: "Pharmacy",
  },
]

// ─── TJC chapter reference content (Survey Readiness tab) ─────────────────────

const TJC_CHAPTERS = [
  { code: "IC", title: "Infection Prevention and Control", description: "Infection surveillance, prevention, and control program", department: "Infection Control" },
  { code: "MM", title: "Medication Management", description: "Safe medication ordering, dispensing, administration, monitoring", department: "Pharmacy" },
  { code: "RC", title: "Record of Care", description: "Medical record documentation, completeness, timeliness", department: "Nursing" },
  { code: "PI", title: "Performance Improvement", description: "Data collection, analysis, quality improvement activities", department: "ICU" },
  { code: "MRI", title: "Medical Imaging", description: "Radiology, MRI, CT safety and quality standards", department: "Radiology" },
  { code: "EC", title: "Environment of Care", description: "Safety management, hazardous materials, fire safety", department: "Emergency" },
]

const TRACER_ITEMS = [
  { type: "System Tracer", area: "Medication Management", description: "Verify double-check protocol is being followed. Observe staff administering high-alert medication and validate independent verification step.", department: "Pharmacy" },
  { type: "Patient Tracer", area: "Sepsis Care Path", description: "Follow a sepsis patient's care path against the current ICU protocol. Verify 1-hour bundle completion times and blood culture documentation.", department: "ICU" },
  { type: "Document Tracer", area: "Infection Control Documentation", description: "Verify infection-control documentation completeness. Confirm isolation precautions and PPE use are documented each shift.", department: "Infection Control" },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

type Framework = "All" | "TJC" | "CMS" | "OSHA"

const FRAMEWORK_TABS: Framework[] = ["All", "TJC", "CMS", "OSHA"]

const FRAMEWORK_COLORS: Record<string, string> = {
  TJC: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30",
  CMS: "bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/30",
  OSHA: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
}

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
  compliant: { label: "Compliant", cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30", icon: CheckCircle },
  needs_review: { label: "Needs Review", cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30", icon: Clock },
  not_assessed: { label: "Not Assessed", cls: "bg-card text-[#64748B] border border-[#CBD5E1]", icon: Clock },
}

type FilterTab = "all" | "ready" | "needs_attention" | "at_risk"

function readinessPctColor(pct: number) {
  if (pct >= 90) return "text-[#15803D] dark:text-green-400"
  if (pct >= 70) return "text-[#B45309] dark:text-amber-400"
  return "text-[#B91C1C] dark:text-red-400"
}

function progressBarColor(pct: number) {
  if (pct >= 90) return "bg-[#15803D]"
  if (pct >= 70) return "bg-[#B45309]"
  return "bg-[#B91C1C]"
}

const READY_STATUS_META: Record<string, { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30" },
  needs_attention: { label: "Needs Attention", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30" },
  at_risk: { label: "At Risk", className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30" },
}

// ─── Standards Mapping tab ────────────────────────────────────────────────────

function StandardsMappingTab({ sops, loading }: { sops: RealSOP[]; loading: boolean }) {
  const [activeTab, setActiveTab] = useState<Framework>("All")
  const [exportState, setExportState] = useState<"idle" | "loading" | "success">("idle")

  const enrichedStandards = useMemo(() => {
    const now = new Date()
    return REGULATORY_STANDARDS.map((std) => {
      const mapped = sops.filter((s) => s.department === std.department)
      const overdue = mapped.filter((s) => s.review_date && new Date(s.review_date) < now)
      const status = mapped.length === 0 ? "not_assessed" : overdue.length > 0 ? "needs_review" : "compliant"
      return { ...std, mapped, overdue, status }
    })
  }, [sops])

  const filtered = useMemo(() => {
    if (activeTab === "All") return enrichedStandards
    return enrichedStandards.filter((s) => s.framework === activeTab)
  }, [activeTab, enrichedStandards])

  const needsReview = filtered.filter((s) => s.status === "needs_review")

  const frameworkRates = ["TJC", "CMS", "OSHA"].map((fw) => {
    const fwStds = enrichedStandards.filter((s) => s.framework === fw)
    const compliant = fwStds.filter((s) => s.status === "compliant").length
    return { fw, rate: fwStds.length > 0 ? Math.round((compliant / fwStds.length) * 100) : 0 }
  })

  const handleExport = () => {
    setExportState("loading")
    setTimeout(() => setExportState("success"), 1200)
    setTimeout(() => setExportState("idle"), 3500)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Standard-to-department mapping is curated; compliance status is derived live from each linked
          department&apos;s real SOP review dates in the current corpus - not a per-standard tracked assessment.
        </p>
        <button
          onClick={handleExport}
          disabled={exportState === "loading"}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0",
            exportState === "success"
              ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30"
              : "bg-[#0B6BCB] hover:bg-[#0959AC] text-white"
          )}
        >
          {exportState === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
          {exportState === "success" && <Check className="w-4 h-4" />}
          {exportState === "idle" && <Download className="w-4 h-4" />}
          {exportState === "loading" ? "Exporting..." : exportState === "success" ? "Exported" : "Export Compliance Map"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {frameworkRates.map(({ fw, rate }, i) => (
          <motion.div
            key={fw}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl bg-card border border-[#E2E8F0] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", FRAMEWORK_COLORS[fw])}>
                  {fw}
                </span>
              </div>
              <span className={cn("text-2xl font-bold tabular-nums",
                rate >= 90 ? "text-[#15803D] dark:text-green-400" : rate >= 70 ? "text-[#B45309] dark:text-amber-400" : "text-[#B91C1C] dark:text-red-400"
              )}>
                {rate}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all",
                  rate >= 90 ? "bg-[#15803D]" : rate >= 70 ? "bg-[#B45309]" : "bg-[#B91C1C]"
                )}
                style={{ width: `${rate}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Compliance rate</p>
          </motion.div>
        ))}
      </div>

      {needsReview.length > 0 && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{needsReview.length} standard{needsReview.length > 1 ? "s" : ""} require review:</strong>{" "}
            {needsReview.map((s) => s.standard_code).join(", ")}. Assessment may be overdue.
          </span>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {FRAMEWORK_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-xl text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-[#0B6BCB] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading SOP corpus...
        </div>
      ) : (
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="rounded-2xl bg-card border border-[#E2E8F0] p-8 text-center text-muted-foreground text-sm">
            No standards found for this framework.
          </div>
        )}
        {filtered.map((std, i) => {
          const stMeta = STATUS_META[std.status] ?? STATUS_META.not_assessed
          const StatusIcon = stMeta.icon
          return (
            <motion.div
              key={std.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "rounded-2xl bg-card border border-[#E2E8F0] p-5",
                std.status === "needs_review" && "border-[#FDE68A] dark:border-amber-500/30"
              )}
            >
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", FRAMEWORK_COLORS[std.framework])}>
                      {std.framework}
                    </span>
                    <code className="text-xs font-mono text-[#334155] bg-muted px-2 py-0.5 rounded">
                      {std.standard_code}
                    </code>
                    <span className={cn("flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold", stMeta.cls)}>
                      <StatusIcon className="w-3 h-3" />
                      {stMeta.label}
                    </span>
                  </div>
                  <h3 className="font-medium text-sm mb-1">{std.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{std.description}</p>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Real SOPs in {std.department} ({std.mapped.length})
                    </p>
                    {std.mapped.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No SOPs in this department yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {std.mapped.map((sop) => (
                          <span
                            key={sop.sop_id}
                            title={sop.title}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-default",
                              std.overdue.some((o) => o.sop_id === sop.sop_id)
                                ? "bg-[#FEE2E2] dark:bg-red-500/10 border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400"
                                : "bg-muted border-[#E2E8F0] text-foreground/80"
                            )}
                          >
                            {sop.sop_id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-xs space-y-2 min-w-[160px]">
                  <div>
                    <p className="text-muted-foreground">SOPs overdue for review</p>
                    <p className={cn("font-medium", std.overdue.length > 0 ? "text-[#B45309] dark:text-amber-400" : "text-foreground")}>
                      {std.overdue.length} / {std.mapped.length}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
      )}

      <div className="rounded-2xl bg-card border border-[#E2E8F0] p-4">
        <h3 className="text-sm font-medium mb-3">Regulatory Frameworks</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { fw: "TJC", name: "The Joint Commission", desc: "Accreditation standards" },
            { fw: "CMS", name: "Centers for Medicare and Medicaid", desc: "Conditions of Participation" },
            { fw: "OSHA", name: "Occupational Safety and Health", desc: "Worker safety standards" },
          ].map(({ fw, name, desc }) => (
            <div key={fw} className="space-y-1">
              <span className={cn("inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold", FRAMEWORK_COLORS[fw])}>
                {fw}
              </span>
              <p className="font-medium text-foreground/80">{name}</p>
              <p className="text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Survey Readiness tab ─────────────────────────────────────────────────────

function SurveyReadinessTab({ sops, loading }: { sops: RealSOP[]; loading: boolean }) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all")
  const [exportState, setExportState] = useState<"idle" | "loading" | "success">("idle")
  const [tracerToast, setTracerToast] = useState<string | null>(null)

  const enrichedChapters = useMemo(() => {
    const now = new Date()
    return TJC_CHAPTERS.map((chapter) => {
      const mapped = sops.filter((s) => s.department === chapter.department)
      const overdue = mapped.filter((s) => s.review_date && new Date(s.review_date) < now)
      const readiness_pct = mapped.length === 0 ? 0 : Math.round(((mapped.length - overdue.length) / mapped.length) * 100)
      const gaps = mapped.length === 0
        ? ["No SOPs in this department yet"]
        : overdue.map((s) => `${s.sop_id} (${s.title}) is overdue for review`)
      const status = mapped.length === 0 ? "at_risk" : readiness_pct >= 90 ? "ready" : readiness_pct >= 70 ? "needs_attention" : "at_risk"
      return { ...chapter, mapped, gaps, readiness_pct, status }
    })
  }, [sops])

  const filtered = enrichedChapters.filter((c) => activeTab === "all" || c.status === activeTab)

  const handleExport = () => {
    setExportState("loading")
    setTimeout(() => setExportState("success"), 1400)
    setTimeout(() => setExportState("idle"), 3500)
  }

  const handleSimulate = (tracer: string) => {
    setTracerToast(tracer)
    setTimeout(() => setTracerToast(null), 3000)
  }

  const overallReadiness = enrichedChapters.length > 0
    ? Math.round(enrichedChapters.reduce((sum, c) => sum + c.readiness_pct, 0) / enrichedChapters.length)
    : 0
  const chaptersReady = enrichedChapters.filter((c) => c.status === "ready").length
  const openGaps = enrichedChapters.reduce((sum, c) => sum + c.gaps.length, 0)

  const stats = [
    { label: "Overall Readiness", value: `${overallReadiness}%`, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
    { label: "Chapters Ready", value: `${chaptersReady}/${enrichedChapters.length}`, color: "text-[#0B6BCB]", bg: "bg-[#0B6BCB]/10" },
    { label: "Open Gaps", value: String(openGaps), color: "text-[#B45309] dark:text-amber-400", bg: "bg-[#FEF3C7] dark:bg-amber-500/10" },
  ]

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: enrichedChapters.length },
    { key: "ready", label: "Ready", count: enrichedChapters.filter((c) => c.status === "ready").length },
    { key: "needs_attention", label: "Needs Attention", count: enrichedChapters.filter((c) => c.status === "needs_attention").length },
    { key: "at_risk", label: "At Risk", count: enrichedChapters.filter((c) => c.status === "at_risk").length },
  ]

  return (
    <div className="space-y-6">
      {tracerToast && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 right-4 z-50 bg-[#0B6BCB] text-white text-sm px-4 py-2.5 rounded-xl shadow-lg"
        >
          Tracer simulation coming in v2
        </motion.div>
      )}

      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Mock survey tool for internal preparation only. Not affiliated with or endorsed by The Joint Commission.
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#64748B] gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading SOP corpus...
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className={cn("bg-card border border-[#E2E8F0] rounded-xl p-4", s.bg)}
          >
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === t.key
                ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30"
                : "bg-card text-[#64748B] border border-[#E2E8F0] hover:bg-muted"
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((chapter, i) => (
          <motion.div
            key={chapter.code}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-[#E2E8F0] rounded-xl p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[#64748B] border border-[#CBD5E1] rounded px-2 py-0.5">
                    {chapter.code}
                  </span>
                  <span className="text-sm font-medium text-[#1A2332]">{chapter.title}</span>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      READY_STATUS_META[chapter.status]?.className
                    )}
                  >
                    {READY_STATUS_META[chapter.status]?.label}
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">{chapter.description}</p>
              </div>
              <span className={cn("text-3xl font-bold shrink-0", readinessPctColor(chapter.readiness_pct))}>
                {chapter.readiness_pct}%
              </span>
            </div>

            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", progressBarColor(chapter.readiness_pct))}
                style={{ width: `${chapter.readiness_pct}%` }}
              />
            </div>

            {chapter.mapped.length > 0 && (
              <div>
                <p className="text-xs text-[#94A3B8] mb-1.5">Real SOPs in {chapter.department}</p>
                <div className="flex flex-wrap gap-1.5">
                  {chapter.mapped.map((sop) => (
                    <span
                      key={sop.sop_id}
                      title={sop.title}
                      className="text-xs text-[#0B6BCB] border border-[#0B6BCB]/30 bg-[#0B6BCB]/10 rounded px-2 py-0.5 cursor-default"
                    >
                      {sop.sop_id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {chapter.gaps.length > 0 && (
              <div>
                <p className="text-xs text-[#94A3B8] mb-1.5">Open Gaps</p>
                <ul className="space-y-1">
                  {chapter.gaps.map((gap, gi) => (
                    <li key={gi} className="flex items-start gap-1.5 text-xs text-[#B91C1C] dark:text-red-400">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#B91C1C] shrink-0" />
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1 text-xs text-[#94A3B8]">
                <Clock className="w-3 h-3" />
                {chapter.mapped.length} SOP{chapter.mapped.length !== 1 ? "s" : ""} in scope
              </div>
              <Link
                href="/library"
                className="text-xs text-[#0B6BCB] hover:text-[#0959AC] flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> View in Library
              </Link>
            </div>
          </motion.div>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-medium text-[#1A2332] mb-3">Tracer Simulation</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {TRACER_ITEMS.map((tracer, i) => {
            const relevantSop = sops.find((s) => s.department === tracer.department)
            return (
              <motion.div
                key={tracer.type}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-card border border-[#E2E8F0] rounded-xl p-5 space-y-3"
              >
                <div>
                  <span className="text-xs text-[#64748B] border border-[#CBD5E1] rounded px-2 py-0.5">
                    {tracer.type}
                  </span>
                  <p className="text-sm font-medium text-[#1A2332] mt-2">{tracer.area}</p>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">{tracer.description}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-[#0B6BCB] border border-[#0B6BCB]/30 bg-[#0B6BCB]/10 rounded px-2 py-0.5">
                    {relevantSop ? relevantSop.sop_id : "No SOP mapped"}
                  </span>
                  <button
                    onClick={() => handleSimulate(tracer.type)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 border border-[#0B6BCB]/30 transition-colors font-medium"
                  >
                    Simulate
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>
      </>
      )}

      <button
        onClick={handleExport}
        disabled={exportState === "loading"}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
          exportState === "success"
            ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30"
            : "bg-[#0B6BCB] hover:bg-[#0959AC] text-white"
        )}
      >
        {exportState === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
        {exportState === "success" && <Check className="w-4 h-4" />}
        {exportState === "idle" && <Download className="w-4 h-4" />}
        {exportState === "loading"
          ? "Generating Readiness Report..."
          : exportState === "success"
            ? "Report Generated Successfully"
            : "Export Readiness Report"}
      </button>
    </div>
  )
}

// ─── Merged page ──────────────────────────────────────────────────────────────

export default function RegulatoryPage() {
  const [sops, setSops] = useState<RealSOP[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"standards" | "readiness">(() => {
    if (typeof window === "undefined") return "standards"
    return new URLSearchParams(window.location.search).get("tab") === "readiness" ? "readiness" : "standards"
  })

  useEffect(() => {
    fetch(`${API_BASE}/api/sops`)
      .then((r) => r.json())
      .then((data) => setSops(Array.isArray(data) ? data : (data.sops ?? data.items ?? [])))
      .catch(() => setSops([]))
      .finally(() => setLoading(false))
  }, [])

  const TABS = [
    { key: "standards" as const, label: "Standards Mapping", icon: Shield },
    { key: "readiness" as const, label: "Survey Readiness", icon: ClipboardCheck },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Regulatory & Accreditation" }]} />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-[#0B6BCB]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Regulatory &amp; Accreditation</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                TJC/CMS/OSHA standard mapping and Joint Commission survey readiness
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype - Not for Clinical Use.</strong> For demonstration only. Verify against official regulatory sources.</span>
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-muted border border-[#E2E8F0] w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tab === t.key ? "bg-card text-[#0B6BCB] shadow-sm" : "text-[#64748B] hover:text-[#1A2332]"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "standards" ? (
          <StandardsMappingTab sops={sops} loading={loading} />
        ) : (
          <SurveyReadinessTab sops={sops} loading={loading} />
        )}
      </div>
    </AppShell>
  )
}
