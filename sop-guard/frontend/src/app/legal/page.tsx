"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Scale, AlertTriangle, ShieldAlert, Eye, ChevronDown, ChevronUp,
  CheckCircle, Clock, FileText, GitBranch
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SafetyNote } from "@/components/ui/safety-note"
import { cn } from "@/lib/utils"
import { MOCK_LEGAL, MOCK_PROPOSALS } from "@/lib/mock-data"
import { useRole } from "@/lib/role-context"
import type { LegalRiskItem } from "@/lib/governance-types"
import { toneChip } from "@/components/ui/tone"

const riskClassConfig: Record<LegalRiskItem["risk_classification"], { label: string; className: string }> = {
  critical: { label: "Critical", className: toneChip.danger },
  high: { label: "High", className: toneChip.danger },
  medium: { label: "Medium", className: toneChip.warning },
  low: { label: "Low", className: "bg-card text-muted-foreground border border-input" },
}

const issueTypeConfig: Record<LegalRiskItem["issue_type"], string> = {
  liability: toneChip.danger,
  compliance: "bg-muted text-muted-foreground border border-border",
  regulatory: "bg-muted text-muted-foreground border border-border",
  privacy: "bg-muted text-muted-foreground border border-border",
  documentation: "bg-muted text-muted-foreground border border-border",
  consent: toneChip.warning,
}

const legalStatusConfig: Record<LegalRiskItem["status"], { label: string; className: string }> = {
  open: { label: "Open", className: toneChip.danger },
  under_review: { label: "Under Review", className: toneChip.warning },
  resolved: { label: "Resolved", className: toneChip.success },
  on_hold: { label: "On Hold", className: "bg-card text-muted-foreground border border-input" },
  escalated: { label: "Escalated", className: toneChip.danger },
}

function isUrgent(dateStr?: string) {
  if (!dateStr) return false
  const daysLeft = (new Date(dateStr).getTime() - Date.now()) / 86400000
  return daysLeft <= 7
}

export default function LegalPage() {
  const { role } = useRole()
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const canEdit = role === "governance_compliance" || role === "system_admin"

  const proposalsNeedingLegal = MOCK_PROPOSALS.filter((p) => p.legal_review_required)

  const riskCounts = {
    critical: MOCK_LEGAL.filter((l) => l.risk_classification === "critical").length,
    high: MOCK_LEGAL.filter((l) => l.risk_classification === "high").length,
    medium: MOCK_LEGAL.filter((l) => l.risk_classification === "medium").length,
    low: MOCK_LEGAL.filter((l) => l.risk_classification === "low").length,
  }

  const stats = [
    { label: "Open Issues", value: String(MOCK_LEGAL.filter((l) => l.status === "open").length), color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10", icon: AlertTriangle },
    { label: "Critical Items", value: String(riskCounts.critical), color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10", icon: ShieldAlert },
    { label: "Under Review", value: String(MOCK_LEGAL.filter((l) => l.status === "under_review").length), color: "text-[#B45309] dark:text-amber-400", bg: "bg-[#FEF3C7] dark:bg-amber-500/10", icon: Clock },
    { label: "Resolved This Quarter", value: "3", color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10", icon: CheckCircle },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: "Legal & Risk" }]} />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FEE2E2] dark:bg-red-500/10 flex items-center justify-center">
            <Scale className="w-6 h-6 text-[#B91C1C] dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Legal &amp; Risk Center</h1>
            <p className="text-sm text-muted-foreground">Policy liability review and risk governance</p>
          </div>
        </div>

        <SafetyNote />

        {/* Important disclaimer */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            <strong>Important:</strong> This module is for internal governance tracking only. All legal determinations require review by qualified legal counsel.
          </span>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Showing illustrative legal-review data; not wired to a live case-tracking system.</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
                <s.icon className={cn("w-5 h-5", s.color)} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Permission check banner */}
        {!canEdit && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
            <Eye className="w-4 h-4 shrink-0" />
            <span><strong>Limited Access:</strong> You are viewing in read-only mode. Legal risk management requires Legal/Risk or Compliance Officer role.</span>
          </div>
        )}

        {/* Legal Risk Items */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold font-display">Legal Risk Items</h2>
          {MOCK_LEGAL.map((item, i) => {
            const notesExpanded = expandedNotes[item.id]
            const truncatedNotes = item.legal_notes.slice(0, 100)
            const hasMore = item.legal_notes.length > 100

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl bg-card border border-border p-5 space-y-3"
              >
                {/* Top row: badges + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", riskClassConfig[item.risk_classification].className)}>
                      {riskClassConfig[item.risk_classification].label}
                    </span>
                    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium capitalize", issueTypeConfig[item.issue_type])}>
                      {item.issue_type}
                    </span>
                  </div>
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0", legalStatusConfig[item.status].className)}>
                    {legalStatusConfig[item.status].label}
                  </span>
                </div>

                {/* SOP title + department */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] text-xs">
                    <FileText className="w-3 h-3" /> {item.sop_title}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-muted border border-border text-muted-foreground text-xs">
                    {item.department}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-foreground/90">{item.description}</p>

                {/* Identified by */}
                <p className="text-xs text-muted-foreground">
                  Identified {item.identified_date} by {item.identified_by}
                </p>

                {/* Resolution deadline */}
                {item.resolution_required_by && (
                  <p className={cn("text-xs flex items-center gap-1", isUrgent(item.resolution_required_by) ? "text-[#B91C1C] dark:text-red-400 font-medium" : "text-muted-foreground")}>
                    <Clock className="w-3 h-3" />
                    Resolution deadline: {item.resolution_required_by}
                    {isUrgent(item.resolution_required_by) && " - URGENT"}
                  </p>
                )}

                {/* Legal notes with expand */}
                <div className="rounded-xl bg-[#F8FAFC] border border-border p-3">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Legal Notes:</p>
                  <p className="text-xs text-foreground/80">
                    {notesExpanded ? item.legal_notes : truncatedNotes + (hasMore && !notesExpanded ? "..." : "")}
                  </p>
                  {hasMore && (
                    <button
                      onClick={() => setExpandedNotes((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                      className="text-xs text-[#0B6BCB] hover:text-[#0B6BCB] transition-colors mt-1 flex items-center gap-1"
                    >
                      {notesExpanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
                    </button>
                  )}
                </div>

                {/* Related proposal */}
                {item.proposal_id && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    Related proposal: <span className="underline cursor-pointer">{item.proposal_id}</span>
                  </p>
                )}

                {/* Action buttons for legal_risk role */}
                {canEdit && (
                  <div className="flex items-center gap-2 pt-1">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 hover:bg-[#BBF7D0] border border-[#BBF7D0] dark:border-green-500/30 transition-colors font-medium">
                      <CheckCircle className="w-3.5 h-3.5" /> Mark Resolved
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 hover:bg-[#FECACA] border border-[#FECACA] dark:border-red-500/30 transition-colors font-medium">
                      <ShieldAlert className="w-3.5 h-3.5" /> Escalate
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground hover:bg-[#E2E8F0] border border-border transition-colors font-medium">
                      <FileText className="w-3.5 h-3.5" /> Add Note
                    </button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </section>

        {/* Proposals Requiring Legal Review */}
        <section>
          <h2 className="text-lg font-semibold font-display mb-3">Proposals Requiring Legal Review</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {proposalsNeedingLegal.map((proposal, i) => (
              <motion.div
                key={proposal.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="rounded-2xl bg-card border border-border p-4 space-y-2"
              >
                <p className="text-sm font-semibold text-foreground">{proposal.title}</p>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30 capitalize">
                    {proposal.status.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">{proposal.department}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{proposal.reason}</p>
                {canEdit && (
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 hover:bg-[#FECACA] border border-[#FECACA] dark:border-red-500/30 transition-colors font-medium">
                    Begin Review
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </section>

        {/* Risk Classification Summary */}
        <section>
          <h2 className="text-lg font-semibold font-display mb-3">Risk Classification Summary</h2>
          <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
            {(["critical", "high", "medium", "low"] as const).map((level) => {
              const count = riskCounts[level]
              const total = MOCK_LEGAL.length
              const pct = total > 0 ? (count / total) * 100 : 0
              const barColors: Record<string, string> = {
                critical: "bg-[#B91C1C]",
                high: "bg-[#DC2626]",
                medium: "bg-[#F59E0B]",
                low: "bg-[#94A3B8]",
              }
              const textColors: Record<string, string> = {
                critical: "text-[#B91C1C] dark:text-red-400",
                high: "text-[#B91C1C] dark:text-red-400",
                medium: "text-[#B45309] dark:text-amber-400",
                low: "text-muted-foreground",
              }
              return (
                <div key={level} className="flex items-center gap-3">
                  <span className={cn("text-xs font-semibold w-14 capitalize", textColors[level])}>{level}</span>
                  <div className="flex-1 h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", barColors[level])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={cn("text-sm font-bold w-6 text-right", textColors[level])}>{count}</span>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
