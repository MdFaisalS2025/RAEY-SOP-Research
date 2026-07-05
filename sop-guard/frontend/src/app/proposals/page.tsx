"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, Plus, Stethoscope, Scale, GraduationCap,
  Calendar, Building2, FileText, ChevronRight, Users, ClipboardList
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"
import { MOCK_PROPOSALS } from "@/lib/mock-data"
import type { UpdateProposal } from "@/lib/governance-types"

// ── Types ──────────────────────────────────────────────────────────────────
type ProposalFilter = "all" | "in_review" | "awaiting_vote" | "legal_review" | "approved"

// ── Helpers ────────────────────────────────────────────────────────────────
function priorityBadge(priority: UpdateProposal["priority"]) {
  const map = {
    critical: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    high: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    medium: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
    low: "bg-card text-[#475569] border border-[#CBD5E1]",
  }
  return map[priority]
}

function statusBadgeInfo(status: UpdateProposal["status"]) {
  const map: Record<string, { cls: string; label: string }> = {
    committee_review: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30", label: "Committee Review" },
    legal_review: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30", label: "Legal Review" },
    approved: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30", label: "Approved" },
    training_review: { cls: "bg-card text-[#475569] border border-[#CBD5E1]", label: "Training Review" },
    draft: { cls: "bg-card text-[#475569] border border-[#CBD5E1]", label: "Draft" },
    submitted: { cls: "bg-card text-[#475569] border border-[#CBD5E1]", label: "Submitted" },
    evidence_review: { cls: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30", label: "Evidence Review" },
    department_review: { cls: "bg-card text-[#475569] border border-[#CBD5E1]", label: "Dept Review" },
    rejected: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30", label: "Rejected" },
    published: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30", label: "Published" },
    archived: { cls: "bg-card text-[#475569] border border-[#CBD5E1]", label: "Archived" },
  }
  return map[status] ?? { cls: "bg-muted text-[#64748B]", label: status }
}

const FILTER_TABS: { value: ProposalFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_review", label: "In Review" },
  { value: "awaiting_vote", label: "Awaiting Vote" },
  { value: "legal_review", label: "Legal Review" },
  { value: "approved", label: "Approved" },
]

// ── Proposal Card ──────────────────────────────────────────────────────────
function ProposalCard({ proposal, index }: { proposal: UpdateProposal; index: number }) {
  const { role } = useRole()
  const statusInfo = statusBadgeInfo(proposal.status)
  const approvedCount = proposal.approvers.filter(a => a.status === "approved").length
  const totalApprovers = proposal.approvers.length
  const approvalPct = totalApprovers > 0 ? (approvedCount / totalApprovers) * 100 : 0
  const isPastDue = new Date(proposal.due_date) < new Date()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl bg-card border border-[#E2E8F0] overflow-hidden"
    >
      {proposal.legal_review_required && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#FEE2E2] dark:bg-red-500/10 border-b border-[#FECACA] dark:border-red-500/30">
          <Scale className="w-3.5 h-3.5 text-[#B91C1C] dark:text-red-400 shrink-0" />
          <span className="text-xs font-semibold text-[#B91C1C] dark:text-red-400 uppercase tracking-wide">Legal Review Required</span>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Priority + status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide", priorityBadge(proposal.priority))}>
            {proposal.priority} priority
          </span>
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", statusInfo.cls)}>
            {statusInfo.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-display text-base font-bold text-[#1A2332] leading-snug">
          {proposal.title}
        </h3>

        {/* Affected SOP */}
        <div className="flex items-start gap-2">
          <FileText className="w-3.5 h-3.5 text-[#0B6BCB] shrink-0 mt-0.5" />
          <span className="text-xs">
            <span className="text-[#64748B]">Affected SOP: </span>
            <span className="text-[#0B6BCB] font-medium">{proposal.affected_sop_title}</span>
          </span>
        </div>

        {/* Dept + initiated */}
        <div className="flex flex-wrap gap-4 text-xs text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3" />
            {proposal.department}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            Initiated by {proposal.initiated_by.name} on {proposal.created_date}
          </span>
        </div>

        {/* Evidence chip + approvers */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-[#E2E8F0] text-xs text-[#64748B]">
            <FileText className="w-3 h-3" />
            {proposal.evidence_source_ids.length} evidence source{proposal.evidence_source_ids.length !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-[#E2E8F0] text-xs text-[#64748B]">
            <Users className="w-3 h-3" />
            {approvedCount} / {totalApprovers} approvers
          </span>
        </div>

        {/* Approvers progress bar */}
        <div className="space-y-1.5">
          <div className="w-full h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0B6BCB] to-[#16A34A] transition-all"
              style={{ width: `${approvalPct}%` }}
            />
          </div>
        </div>

        {/* Impact flags */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted border border-[#E2E8F0] text-xs text-[#334155]">
            <Stethoscope className="w-3 h-3" />
            Clinical Impact
          </div>
          {proposal.legal_review_required && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-xs text-[#B91C1C] dark:text-red-400">
              <Scale className="w-3 h-3" />
              Legal Review
            </div>
          )}
          {proposal.training_triggered && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted border border-[#E2E8F0] text-xs text-[#334155]">
              <GraduationCap className="w-3 h-3" />
              Training Required
            </div>
          )}
        </div>

        {/* AI summary (2-line truncate) */}
        <p className="text-sm text-[#64748B] line-clamp-2 leading-relaxed">
          {proposal.ai_summary}
        </p>

        {/* Due date */}
        <div className={cn("flex items-center gap-1.5 text-xs", isPastDue ? "text-[#B91C1C] dark:text-red-400" : "text-[#64748B]")}>
          <Calendar className="w-3 h-3" />
          Due {proposal.due_date}
          {isPastDue && <span className="font-semibold ml-1">(Overdue)</span>}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#EDF1F5]">
          <Link
            href={`/proposals/${proposal.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-xs text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors"
          >
            View <ChevronRight className="w-3 h-3" />
          </Link>

          {role === "committee_member" && proposal.status === "committee_review" && (
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 text-xs text-[#15803D] dark:text-green-400 hover:bg-[#BBF7D0] transition-colors">
              Vote
            </button>
          )}

          {role === "legal_risk" && proposal.legal_review_required && (
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-[#E2E8F0] text-xs text-[#334155] hover:bg-[#E2E8F0] transition-colors">
              Legal Review
            </button>
          )}
        </div>

      </div>
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function ProposalsPage() {
  const { hasPermission } = useRole()
  const [activeFilter, setActiveFilter] = useState<ProposalFilter>("all")

  const filtered = MOCK_PROPOSALS.filter(p => {
    if (activeFilter === "all") return true
    if (activeFilter === "in_review") return ["committee_review", "department_review", "evidence_review"].includes(p.status)
    if (activeFilter === "awaiting_vote") return p.status === "committee_review"
    if (activeFilter === "legal_review") return p.status === "legal_review"
    if (activeFilter === "approved") return p.status === "approved"
    return true
  })

  const committeeReviewCount = MOCK_PROPOSALS.filter(p => p.status === "committee_review").length
  const legalReviewCount = MOCK_PROPOSALS.filter(p => p.status === "legal_review").length
  const approvedCount = MOCK_PROPOSALS.filter(p => p.status === "approved").length

  const stats = [
    { label: "Total", value: MOCK_PROPOSALS.length, color: "text-[#0B6BCB]" },
    { label: "Committee Review", value: committeeReviewCount, color: "text-[#64748B]" },
    { label: "Legal Review", value: legalReviewCount, color: "text-[#B45309] dark:text-amber-400" },
    { label: "Approved", value: approvedCount, color: "text-[#15803D] dark:text-green-400" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Proposals" }]} />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-[#0B6BCB]" />
              <h1 className="font-display text-3xl font-bold text-[#1A2332]">Update Proposals</h1>
            </div>
            <p className="text-[#64748B] text-sm pl-10">Track and review SOP update proposals.</p>
          </div>

          {hasPermission("create_proposal") && (
            <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" /> New Proposal
            </button>
          )}
        </motion.div>

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30"
        >
          <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0" />
          <span className="text-xs text-[#B45309] dark:text-amber-400">Research Prototype - Not for Clinical Use. Proposals require committee review before implementation.</span>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {stats.map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-card border border-[#E2E8F0] p-4">
              <p className="text-xs text-[#64748B] mb-1">{label}</p>
              <p className={cn("text-3xl font-bold font-display", color)}>{value}</p>
            </div>
          ))}
        </motion.div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                activeFilter === tab.value
                  ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30"
                  : "text-[#64748B] hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Proposal cards */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-2xl bg-card border border-[#E2E8F0] p-12 text-center">
              <ClipboardList className="w-8 h-8 text-[#64748B] mx-auto mb-3 opacity-40" />
              <p className="text-[#64748B] text-sm">No proposals match this filter.</p>
            </div>
          ) : (
            filtered.map((p, i) => <ProposalCard key={p.id} proposal={p} index={i} />)
          )}
        </div>
      </div>
    </AppShell>
  )
}
