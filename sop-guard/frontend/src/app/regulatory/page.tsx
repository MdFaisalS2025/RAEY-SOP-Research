"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, CheckCircle, Clock, Download, Shield,
  FileText, BarChart3, Loader2, Check
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_SOPS } from "@/lib/mock-data"
import type { RegulatoryStandard } from "@/lib/governance-types"

// ─── mock data (local) ────────────────────────────────────────────────────────

const REGULATORY_STANDARDS: RegulatoryStandard[] = [
  {
    id: "tjc-ic-01",
    framework: "TJC",
    standard_code: "IC.01.05.01",
    title: "Infection Prevention and Control Program",
    description: "The hospital has an infection prevention and control program",
    mapped_sop_ids: ["IC-PPE-001", "IC-CL-005"],
    compliance_status: "compliant",
    last_assessed: "2026-03-15",
    next_survey_due: "2027-Q1",
  },
  {
    id: "tjc-rc-01",
    framework: "TJC",
    standard_code: "RC.01.02.01",
    title: "Medical Record Documentation",
    description: "Entries in the medical record are dated, timed, and authenticated",
    mapped_sop_ids: ["HVAP-FALL-004"],
    compliance_status: "compliant",
    last_assessed: "2026-03-15",
    next_survey_due: "2027-Q1",
  },
  {
    id: "cms-cop-482",
    framework: "CMS",
    standard_code: "482.21",
    title: "Condition of Participation: Quality Assessment",
    description:
      "Hospital must have effective quality assessment and performance improvement program",
    mapped_sop_ids: ["ICU-SEP-002", "ICU-RR-006"],
    compliance_status: "compliant",
    last_assessed: "2026-01-10",
    next_survey_due: "2027-Q2",
  },
  {
    id: "osha-1910",
    framework: "OSHA",
    standard_code: "1910.1030",
    title: "Bloodborne Pathogen Standard",
    description:
      "Exposure control plan for occupational exposure to bloodborne pathogens",
    mapped_sop_ids: ["IC-PPE-001", "IC-CL-005"],
    compliance_status: "needs_review",
    last_assessed: "2025-09-01",
    next_survey_due: "2026-Q3",
  },
  {
    id: "tjc-mm-01",
    framework: "TJC",
    standard_code: "MM.04.01.01",
    title: "Medication Management: High-Alert Medications",
    description: "The hospital identifies and manages high-alert medications",
    mapped_sop_ids: ["PHARM-MED-007", "ONCO-CHEMO-003"],
    compliance_status: "compliant",
    last_assessed: "2026-02-20",
    next_survey_due: "2027-Q1",
  },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

type Framework = "All" | "TJC" | "CMS" | "OSHA" | "State"

const FRAMEWORK_TABS: Framework[] = ["All", "TJC", "CMS", "OSHA", "State"]

const FRAMEWORK_COLORS: Record<string, string> = {
  TJC: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30",
  CMS: "bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/30",
  OSHA: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]",
  State: "bg-white text-[#475569] border border-[#CBD5E1]",
  Other: "bg-white text-[#64748B] border border-[#CBD5E1]",
}

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
  compliant: { label: "Compliant", cls: "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]", icon: CheckCircle },
  needs_review: { label: "Needs Review", cls: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]", icon: Clock },
  non_compliant: { label: "Non-Compliant", cls: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]", icon: AlertTriangle },
  not_assessed: { label: "Not Assessed", cls: "bg-white text-[#64748B] border border-[#CBD5E1]", icon: Clock },
}

// Compute compliance rates per framework from mock data
function complianceRate(fw: string, standards: RegulatoryStandard[]): number {
  const fwStds = standards.filter((s) => s.framework === fw)
  if (fwStds.length === 0) return 0
  const compliant = fwStds.filter((s) => s.compliance_status === "compliant").length
  return Math.round((compliant / fwStds.length) * 100)
}

// Look up SOP title by sop_id
function sopTitle(sopId: string): string {
  const sop = MOCK_SOPS.find((s) => s.sop_id === sopId)
  return sop ? sop.title : sopId
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function RegulatoryPage() {
  const [activeTab, setActiveTab] = useState<Framework>("All")
  const [exportState, setExportState] = useState<"idle" | "loading" | "success">("idle")

  const filtered = useMemo(() => {
    if (activeTab === "All") return REGULATORY_STANDARDS
    return REGULATORY_STANDARDS.filter((s) => s.framework === activeTab)
  }, [activeTab])

  const needsReview = filtered.filter((s) => s.compliance_status === "needs_review")

  const frameworkRates = ["TJC", "CMS", "OSHA"].map((fw) => ({
    fw,
    rate: complianceRate(fw, REGULATORY_STANDARDS),
  }))

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
                ? "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]"
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
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype - Not for Clinical Use.</strong> For demonstration only. Verify against official regulatory sources.</span>
        </div>

        {/* Mapping note */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0959AC] text-sm">
          <FileText className="w-4 h-4 shrink-0" />
          <span>Mapping maintained by Compliance Officer. Last verified June 2026.</span>
        </div>

        {/* Framework compliance rates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {frameworkRates.map(({ fw, rate }, i) => (
            <motion.div
              key={fw}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl bg-white border border-[#E2E8F0] p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", FRAMEWORK_COLORS[fw])}>
                    {fw}
                  </span>
                </div>
                <span className={cn("text-2xl font-bold tabular-nums",
                  rate >= 90 ? "text-[#15803D]" : rate >= 70 ? "text-[#B45309]" : "text-[#B91C1C]"
                )}>
                  {rate}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
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
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-sm">
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
                  : "bg-[#F1F5F9] text-muted-foreground hover:bg-[#F1F5F9] hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Standards list */}
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="rounded-2xl bg-white border border-[#E2E8F0] p-8 text-center text-muted-foreground text-sm">
              No standards found for this framework.
            </div>
          )}
          {filtered.map((std, i) => {
            const stMeta = STATUS_META[std.compliance_status] ?? STATUS_META.not_assessed
            const StatusIcon = stMeta.icon
            return (
              <motion.div
                key={std.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "rounded-2xl bg-white border border-[#E2E8F0] p-5",
                  std.compliance_status === "needs_review" && "border-[#FDE68A]"
                )}
              >
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-semibold", FRAMEWORK_COLORS[std.framework])}>
                        {std.framework}
                      </span>
                      <code className="text-xs font-mono text-[#334155] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        {std.standard_code}
                      </code>
                      <span className={cn("flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold", stMeta.cls)}>
                        <StatusIcon className="w-3 h-3" />
                        {stMeta.label}
                      </span>
                    </div>
                    <h3 className="font-medium text-sm mb-1">{std.title}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{std.description}</p>

                    {/* Mapped SOPs */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Mapped SOPs</p>
                      <div className="flex flex-wrap gap-2">
                        {std.mapped_sop_ids.map((sopId) => (
                          <span
                            key={sopId}
                            title={sopTitle(sopId)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] text-foreground/80 hover:bg-[#F1F5F9] transition-colors cursor-default"
                          >
                            {sopId}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: dates */}
                  <div className="shrink-0 text-xs space-y-2 min-w-[160px]">
                    <div>
                      <p className="text-muted-foreground">Last assessed</p>
                      <p className="font-medium text-foreground">{std.last_assessed}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Next survey due</p>
                      <p className={cn("font-medium",
                        std.compliance_status === "needs_review" ? "text-[#B45309]" : "text-foreground"
                      )}>
                        {std.next_survey_due}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Frameworks legend */}
        <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4">
          <h3 className="text-sm font-medium mb-3">Regulatory Frameworks</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { fw: "TJC", name: "The Joint Commission", desc: "Accreditation standards" },
              { fw: "CMS", name: "Centers for Medicare and Medicaid", desc: "Conditions of Participation" },
              { fw: "OSHA", name: "Occupational Safety and Health", desc: "Worker safety standards" },
              { fw: "State", name: "State Health Department", desc: "Facility-specific requirements" },
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
