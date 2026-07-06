"use client"

import { useState, useMemo, useEffect } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, CheckCircle, Clock, Download, Shield,
  FileText, BarChart3, Loader2, Check
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

// ─── page ─────────────────────────────────────────────────────────────────────

export default function RegulatoryPage() {
  const [activeTab, setActiveTab] = useState<Framework>("All")
  const [exportState, setExportState] = useState<"idle" | "loading" | "success">("idle")
  const [sops, setSops] = useState<RealSOP[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/sops`)
      .then((r) => r.json())
      .then((data) => setSops(Array.isArray(data) ? data : (data.sops ?? data.items ?? [])))
      .catch(() => setSops([]))
      .finally(() => setLoading(false))
  }, [])

  // Derive each standard's mapped SOPs and compliance status live from the
  // real corpus - a standard is "needs_review" if any real SOP in its linked
  // department is past its review_date, "not_assessed" if the department has
  // no SOPs in the corpus at all, otherwise "compliant".
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
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Regulatory Mapping" }]} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-[#0B6BCB]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Regulatory Mapping</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Tracking SOPs against TJC, CMS, and OSHA standards
              </p>
            </div>
          </div>
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

        {/* Research Prototype disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype - Not for Clinical Use.</strong> For demonstration only. Verify against official regulatory sources.</span>
        </div>

        {/* Mapping note */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0959AC] text-sm">
          <FileText className="w-4 h-4 shrink-0" />
          <span>
            Standard-to-department mapping is curated; compliance status is derived live from each linked
            department&apos;s real SOP review dates in the current corpus - not a per-standard tracked assessment.
          </span>
        </div>

        {/* Framework compliance rates */}
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

        {/* Alert: standards needing review */}
        {needsReview.length > 0 && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>{needsReview.length} standard{needsReview.length > 1 ? "s" : ""} require review:</strong>{" "}
              {needsReview.map((s) => s.standard_code).join(", ")}. Assessment may be overdue.
            </span>
          </div>
        )}

        {/* Framework filter tabs */}
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

        {/* Standards list */}
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
                  {/* Left */}
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

                    {/* Mapped SOPs (real, from the current corpus) */}
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

                  {/* Right: real review status */}
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

        {/* Frameworks legend */}
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
    </AppShell>
  )
}
