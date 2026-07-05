"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, CheckCircle, Clock, Download,
  Loader2, Check, FileText, ExternalLink, Plus
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_SOPS } from "@/lib/mock-data"

// ─── Inline data ──────────────────────────────────────────────────────────────

const TJC_CHAPTERS = [
  {
    code: "LD",
    title: "Leadership",
    description: "Governance, leadership structure, culture of safety",
    readiness_pct: 92,
    mapped_sops: ["ICU-SEP-002", "ICU-RR-006"],
    gaps: ["Leadership safety briefing not documented"],
    last_reviewed: "2026-05-10",
    status: "ready",
  },
  {
    code: "IC",
    title: "Infection Prevention and Control",
    description: "Infection surveillance, prevention, and control program",
    readiness_pct: 78,
    mapped_sops: ["IC-PPE-001", "IC-CL-005"],
    gaps: ["N95 fit-test records incomplete for 12 staff", "Hand hygiene observation rate below 90%"],
    last_reviewed: "2026-06-01",
    status: "needs_attention",
  },
  {
    code: "MM",
    title: "Medication Management",
    description: "Safe medication ordering, dispensing, administration, monitoring",
    readiness_pct: 95,
    mapped_sops: ["PHARM-MED-007", "ONCO-CHEMO-003"],
    gaps: [],
    last_reviewed: "2026-06-15",
    status: "ready",
  },
  {
    code: "RC",
    title: "Record of Care",
    description: "Medical record documentation, completeness, timeliness",
    readiness_pct: 81,
    mapped_sops: ["HVAP-FALL-004"],
    gaps: ["Fall risk re-assessment not documented in 18% of cases"],
    last_reviewed: "2026-04-20",
    status: "needs_attention",
  },
  {
    code: "NPSG",
    title: "National Patient Safety Goals",
    description: "Patient identification, communication, medication safety, falls",
    readiness_pct: 89,
    mapped_sops: ["HVAP-FALL-004", "PHARM-MED-007"],
    gaps: ["Bedside alarm management log missing"],
    last_reviewed: "2026-05-28",
    status: "ready",
  },
  {
    code: "EC",
    title: "Environment of Care",
    description: "Safety management, hazardous materials, fire safety",
    readiness_pct: 74,
    mapped_sops: [],
    gaps: ["No SOP mapped to this chapter", "Last safety inspection not documented"],
    last_reviewed: "2026-03-01",
    status: "at_risk",
  },
  {
    code: "HR",
    title: "Human Resources",
    description: "Staff qualifications, competency, orientation, training",
    readiness_pct: 91,
    mapped_sops: [],
    gaps: ["Annual competency sign-off pending for 3 staff"],
    last_reviewed: "2026-06-10",
    status: "ready",
  },
  {
    code: "RI",
    title: "Rights and Responsibilities",
    description: "Patient rights, grievance process, informed consent",
    readiness_pct: 96,
    mapped_sops: ["ONCO-CHEMO-003"],
    gaps: [],
    last_reviewed: "2026-06-20",
    status: "ready",
  },
  {
    code: "PI",
    title: "Performance Improvement",
    description: "Data collection, analysis, quality improvement activities",
    readiness_pct: 83,
    mapped_sops: ["ICU-SEP-002"],
    gaps: ["Quality dashboard not updated since April"],
    last_reviewed: "2026-04-15",
    status: "needs_attention",
  },
  {
    code: "MRI",
    title: "Medical Imaging",
    description: "Radiology, MRI, CT safety and quality standards",
    readiness_pct: 69,
    mapped_sops: ["RAD-MRI-008"],
    gaps: ["MRI safety screening SOP still under review", "MRI safety officer not designated"],
    last_reviewed: "2026-02-10",
    status: "at_risk",
  },
]

const TRACER_ITEMS = [
  {
    type: "System Tracer",
    area: "Medication Management",
    description:
      "Verify double-check protocol is being followed in ICU. Observe nurse administering high-alert medication and validate independent verification step.",
    sop: "PHARM-MED-007",
  },
  {
    type: "Patient Tracer",
    area: "Sepsis Care Path",
    description:
      "Follow a sepsis patient's care path against ICU-SEP-002 requirements. Verify 1-hour bundle completion times and blood culture documentation.",
    sop: "ICU-SEP-002",
  },
  {
    type: "Document Tracer",
    area: "Fall Risk Documentation",
    description:
      "Verify fall risk documentation completeness against HVAP-FALL-004. Confirm Morse scale scores documented each shift and prevention measures implemented within required timeframe.",
    sop: "HVAP-FALL-004",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FilterTab = "all" | "ready" | "needs_attention" | "at_risk"

function readinessPctColor(pct: number) {
  if (pct >= 90) return "text-[#15803D]"
  if (pct >= 70) return "text-[#B45309]"
  return "text-[#B91C1C]"
}

function progressBarColor(pct: number) {
  if (pct >= 90) return "bg-[#15803D]"
  if (pct >= 70) return "bg-[#B45309]"
  return "bg-[#B91C1C]"
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]" },
  needs_attention: { label: "Needs Attention", className: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]" },
  at_risk: { label: "At Risk", className: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]" },
}

function getSopTitle(sopId: string): string {
  const sop = MOCK_SOPS.find((s) => s.sop_id === sopId)
  return sop ? sop.title : sopId
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SurveyPrepPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all")
  const [exportState, setExportState] = useState<"idle" | "loading" | "success">("idle")
  const [tracerToast, setTracerToast] = useState<string | null>(null)

  const filtered = TJC_CHAPTERS.filter((c) => {
    if (activeTab === "all") return true
    if (activeTab === "ready") return c.status === "ready"
    if (activeTab === "needs_attention") return c.status === "needs_attention"
    if (activeTab === "at_risk") return c.status === "at_risk"
    return true
  })

  const handleExport = () => {
    setExportState("loading")
    setTimeout(() => setExportState("success"), 1400)
    setTimeout(() => setExportState("idle"), 3500)
  }

  const handleSimulate = (tracer: string) => {
    setTracerToast(tracer)
    setTimeout(() => setTracerToast(null), 3000)
  }

  const stats = [
    { label: "Overall Readiness", value: "87%", color: "text-[#15803D]", bg: "bg-[#DCFCE7]" },
    { label: "Chapters Reviewed", value: "8/12", color: "text-[#0B6BCB]", bg: "bg-[#0B6BCB]/10" },
    { label: "Open Gaps", value: "6", color: "text-[#B45309]", bg: "bg-[#FEF3C7]" },
    { label: "Est. Survey Date", value: "Q1 2027", color: "text-[#334155]", bg: "bg-[#F1F5F9]" },
  ]

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: TJC_CHAPTERS.length },
    { key: "ready", label: "Ready", count: TJC_CHAPTERS.filter((c) => c.status === "ready").length },
    { key: "needs_attention", label: "Needs Attention", count: TJC_CHAPTERS.filter((c) => c.status === "needs_attention").length },
    { key: "at_risk", label: "At Risk", count: TJC_CHAPTERS.filter((c) => c.status === "at_risk").length },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Survey Readiness" }]} />

        {/* Toast */}
        {tracerToast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed top-4 right-4 z-50 bg-[#0B6BCB] text-white text-sm px-4 py-2.5 rounded-xl shadow-lg"
          >
            Tracer simulation coming in v2
          </motion.div>
        )}

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#1A2332] font-display">Survey Readiness</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              Joint Commission accreditation preparation by standard chapter
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Mock survey tool for internal preparation only. Not affiliated with or endorsed by The Joint Commission.
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={cn("bg-white border border-[#E2E8F0] rounded-xl p-4", s.bg)}
            >
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-[#64748B] mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === t.key
                  ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30"
                  : "bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F1F5F9]"
              )}
            >
              {t.label}
              <span className="ml-1.5 text-xs opacity-60">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Chapter cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((chapter, i) => (
            <motion.div
              key={chapter.code}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3"
            >
              {/* Header row */}
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
                        STATUS_META[chapter.status]?.className
                      )}
                    >
                      {STATUS_META[chapter.status]?.label}
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-1">{chapter.description}</p>
                </div>
                <span className={cn("text-3xl font-bold shrink-0", readinessPctColor(chapter.readiness_pct))}>
                  {chapter.readiness_pct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", progressBarColor(chapter.readiness_pct))}
                  style={{ width: `${chapter.readiness_pct}%` }}
                />
              </div>

              {/* Mapped SOPs */}
              {chapter.mapped_sops.length > 0 && (
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1.5">Mapped SOPs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {chapter.mapped_sops.map((sopId) => (
                      <span
                        key={sopId}
                        title={getSopTitle(sopId)}
                        className="text-xs text-[#0B6BCB] border border-[#0B6BCB]/30 bg-[#0B6BCB]/10 rounded px-2 py-0.5 cursor-default"
                      >
                        {sopId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Gaps */}
              {chapter.gaps.length > 0 && (
                <div>
                  <p className="text-xs text-[#94A3B8] mb-1.5">Open Gaps</p>
                  <ul className="space-y-1">
                    {chapter.gaps.map((gap, gi) => (
                      <li key={gi} className="flex items-start gap-1.5 text-xs text-[#B91C1C]">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#B91C1C] shrink-0" />
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1 text-xs text-[#94A3B8]">
                  <Clock className="w-3 h-3" />
                  Last reviewed {chapter.last_reviewed}
                </div>
                <div className="flex items-center gap-2">
                  {chapter.mapped_sops.length > 0 && (
                    <button className="text-xs text-[#0B6BCB] hover:text-[#0959AC] flex items-center gap-1 transition-colors">
                      <ExternalLink className="w-3 h-3" /> View SOP
                    </button>
                  )}
                  <button className="text-xs text-[#64748B] hover:text-[#334155] flex items-center gap-1 transition-colors border border-[#E2E8F0] rounded px-2 py-0.5">
                    <Plus className="w-3 h-3" /> Add Gap Note
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tracer Simulation */}
        <section>
          <h2 className="text-lg font-medium text-[#1A2332] mb-3">Tracer Simulation</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {TRACER_ITEMS.map((tracer, i) => (
              <motion.div
                key={tracer.type}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3"
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
                    {tracer.sop}
                  </span>
                  <button
                    onClick={() => handleSimulate(tracer.type)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 border border-[#0B6BCB]/30 transition-colors font-medium"
                  >
                    Simulate
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={exportState === "loading"}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all",
            exportState === "success"
              ? "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]"
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
    </AppShell>
  )
}
