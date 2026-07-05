"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, Stethoscope, Scale, GraduationCap, Calendar,
  Building2, FileText, Users, CheckCircle2, Clock, BookOpen,
  Check, X, Zap, ArrowUp, Vote, Gavel, ShieldAlert, ChevronRight
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_PROPOSALS, MOCK_EVIDENCE, DEMO_USERS } from "@/lib/mock-data"
import type { UpdateProposal, ApproverRecord } from "@/lib/governance-types"

// ── Quorum Indicator ────────────────────────────────────────────────────────
function QuorumIndicator({ approveCount, rejectCount, abstainCount, totalVoters = 5, required = 3 }: {
  approveCount: number
  rejectCount: number
  abstainCount: number
  totalVoters?: number
  required?: number
}) {
  const voted = approveCount + rejectCount + abstainCount
  const approved = approveCount >= required
  const rejected = rejectCount >= required
  const quorumMet = voted >= required

  return (
    <div className="space-y-3 p-4 rounded-xl bg-muted border border-[#E2E8F0]">
      {/* Tally */}
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1 text-[#15803D] dark:text-green-400 font-semibold">
          <Check className="w-3 h-3" /> Approved: {approveCount}
        </span>
        <span className="flex items-center gap-1 text-[#B91C1C] dark:text-red-400 font-semibold">
          <X className="w-3 h-3" /> Rejected: {rejectCount}
        </span>
        <span className="flex items-center gap-1 text-[#64748B] font-semibold">
          <Clock className="w-3 h-3" /> Abstaining: {abstainCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-[#64748B]">
          <span>Quorum: {voted}/{totalVoters} voted</span>
          <span>{required} votes required</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden flex">
          <div
            className="h-full bg-[#16A34A] transition-all"
            style={{ width: `${(approveCount / totalVoters) * 100}%` }}
          />
          <div
            className="h-full bg-[#DC2626] transition-all"
            style={{ width: `${(rejectCount / totalVoters) * 100}%` }}
          />
          <div
            className="h-full bg-[#94A3B8] transition-all"
            style={{ width: `${(abstainCount / totalVoters) * 100}%` }}
          />
        </div>
        {/* Quorum threshold marker */}
        <div className="relative h-3">
          <div
            className="absolute top-0 w-px h-3 bg-[#F59E0B]"
            style={{ left: `${(required / totalVoters) * 100}%` }}
          />
        </div>
      </div>

      {/* Status banner */}
      {approved && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30">
          <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-green-400 shrink-0" />
          <span className="text-xs font-bold text-[#15803D] dark:text-green-400 uppercase tracking-wide">QUORUM REACHED: Proposal Approved</span>
        </div>
      )}
      {rejected && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30">
          <X className="w-4 h-4 text-[#B91C1C] dark:text-red-400 shrink-0" />
          <span className="text-xs font-bold text-[#B91C1C] dark:text-red-400 uppercase tracking-wide">QUORUM REACHED: Proposal Rejected</span>
        </div>
      )}
      {!approved && !rejected && !quorumMet && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] dark:text-amber-400 shrink-0" />
          <span className="text-xs text-[#B45309] dark:text-amber-400">Quorum not yet met ({required} votes required)</span>
        </div>
      )}
      {!approved && !rejected && quorumMet && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-[#E2E8F0]">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
          <span className="text-xs text-[#334155]">Quorum met - voting in progress</span>
        </div>
      )}
    </div>
  )
}

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

function statusBadge(status: UpdateProposal["status"]) {
  const map: Record<string, { cls: string; label: string }> = {
    committee_review: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30", label: "Committee Review" },
    legal_review: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30", label: "Legal Review" },
    approved: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30", label: "Approved" },
    rejected: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30", label: "Rejected" },
  }
  return map[status] ?? { cls: "bg-muted text-[#64748B]", label: status }
}

function approverAvatar(approver: ApproverRecord) {
  const colors: Record<string, string> = {
    approved: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
    rejected: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30",
    pending: "bg-card text-[#475569] border-[#CBD5E1]",
    requested_changes: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
    abstained: "bg-card text-[#475569] border-[#CBD5E1]",
  }
  const initials = approver.user_name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
  return (
    <div
      title={`${approver.user_name}: ${approver.status}`}
      className={cn("w-7 h-7 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0", colors[approver.status] ?? colors.pending)}
    >
      {initials}
    </div>
  )
}

// Active proposals = committee_review or legal_review
const activeProposals = MOCK_PROPOSALS.filter(
  p => p.status === "committee_review" || p.status === "legal_review"
)

// Decided proposals = approved or rejected
const decidedProposals = MOCK_PROPOSALS.filter(
  p => p.status === "approved" || p.status === "rejected"
)

// Committee member users
const committeeUsers = DEMO_USERS.filter(
  u => u.role === "committee_member" || u.role === "compliance_officer" || u.role === "legal_risk" || u.role === "physician"
).slice(0, 5)

// ── Committee Proposal Card ────────────────────────────────────────────────
const DEMO_VOTER_ID = "demo-user"

function CommitteeProposalCard({
  proposal,
  index,
  votes,
  onVote,
}: {
  proposal: UpdateProposal
  index: number
  votes: Record<string, 'approve' | 'reject' | 'abstain'>
  onVote: (proposalId: string, vote: 'approve' | 'reject' | 'abstain') => void
}) {
  const statusInfo = statusBadge(proposal.status)
  const approvedCount = proposal.approvers.filter(a => a.status === "approved").length

  // Compute quorum tallies from the demo votes state (separate from approvers)
  const approveCount = Object.values(votes).filter(v => v === 'approve').length
  const rejectCount = Object.values(votes).filter(v => v === 'reject').length
  const abstainCount = Object.values(votes).filter(v => v === 'abstain').length
  const myVote = votes[DEMO_VOTER_ID]

  const approvedByQuorum = approveCount >= 3
  const rejectedByQuorum = rejectCount >= 3

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-2xl bg-card border border-[#E2E8F0] overflow-hidden"
    >
      {proposal.legal_review_required && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#FEE2E2] dark:bg-red-500/10 border-b border-[#FECACA] dark:border-red-500/30">
          <Scale className="w-3.5 h-3.5 text-[#B91C1C] dark:text-red-400 shrink-0" />
          <span className="text-xs font-semibold text-[#B91C1C] dark:text-red-400 uppercase tracking-wide">Legal Review Required</span>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide", priorityBadge(proposal.priority))}>
            {proposal.priority}
          </span>
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", statusInfo.cls)}>
            {statusInfo.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-display text-sm font-bold text-[#1A2332] leading-snug">{proposal.title}</h3>

        {/* Affected SOP */}
        <div className="flex items-start gap-2">
          <FileText className="w-3.5 h-3.5 text-[#0B6BCB] shrink-0 mt-0.5" />
          <span className="text-xs text-[#0B6BCB]">{proposal.affected_sop_title}</span>
        </div>

        {/* Dept + dates */}
        <div className="flex flex-wrap gap-3 text-xs text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3" /> {proposal.department}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" /> Due {proposal.due_date}
          </span>
        </div>

        {/* Evidence count */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-[#E2E8F0] text-xs text-[#64748B]">
          <BookOpen className="w-3 h-3" />
          {proposal.evidence_source_ids.length} evidence source{proposal.evidence_source_ids.length !== 1 ? "s" : ""}
        </span>

        {/* Approver avatars */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {proposal.approvers.map(a => (
              <div key={a.user_id}>{approverAvatar(a)}</div>
            ))}
            <span className="text-xs text-[#64748B] ml-1">
              {approvedCount}/{proposal.approvers.length} approved
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0B6BCB] to-[#16A34A]"
              style={{ width: `${proposal.approvers.length ? (approvedCount / proposal.approvers.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Quorum Indicator */}
        <QuorumIndicator
          approveCount={approveCount}
          rejectCount={rejectCount}
          abstainCount={abstainCount}
          totalVoters={5}
          required={3}
        />

        {/* Quorum outcome actions */}
        {approvedByQuorum && (
          <div className="flex flex-wrap gap-2">
            {proposal.legal_review_required ? (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-[#CBD5E1] text-xs text-[#334155] font-semibold hover:bg-[#E2E8F0] transition-colors">
                <Scale className="w-3.5 h-3.5" /> Send to Legal
              </button>
            ) : (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-[#CBD5E1] text-xs text-[#334155] font-semibold hover:bg-[#E2E8F0] transition-colors">
                <GraduationCap className="w-3.5 h-3.5" /> Proceed to Training
              </button>
            )}
          </div>
        )}
        {rejectedByQuorum && (
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DC2626]/20 border border-[#FECACA] dark:border-red-500/30 text-xs text-[#B91C1C] dark:text-red-400 font-semibold hover:bg-[#FECACA] transition-colors">
              <X className="w-3.5 h-3.5" /> Close Proposal
            </button>
          </div>
        )}

        {/* Impact flags */}
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted border border-[#E2E8F0] text-[11px] text-[#334155]">
            <Stethoscope className="w-3 h-3" /> Clinical
          </span>
          {proposal.legal_review_required && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-[11px] text-[#B91C1C] dark:text-red-400">
              <Scale className="w-3 h-3" /> Legal
            </span>
          )}
          {proposal.training_triggered && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted border border-[#E2E8F0] text-[11px] text-[#334155]">
              <GraduationCap className="w-3 h-3" /> Training
            </span>
          )}
        </div>

        {/* Primary action buttons */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/proposals/${proposal.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] hover:bg-muted transition-colors"
          >
            <BookOpen className="w-3 h-3" /> View Evidence
          </Link>
          <Link
            href={`/proposals/${proposal.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B6BCB] text-xs text-white font-semibold hover:bg-[#0959AC] transition-colors"
          >
            <Vote className="w-3 h-3" /> Vote Now
          </Link>
        </div>

        {/* Inline vote buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E2E8F0]">
          <button
            onClick={() => onVote(proposal.id, 'approve')}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-colors",
              myVote === 'approve'
                ? "bg-[#16A34A] border-[#16A34A] text-white font-bold"
                : "bg-[#DCFCE7] dark:bg-green-500/10 border-[#BBF7D0] dark:border-green-500/30 text-[#15803D] dark:text-green-400 hover:bg-[#16A34A]/25"
            )}
          >
            <Check className="w-3 h-3" /> Approve{myVote === 'approve' ? ' ✓' : ''}
          </button>
          <button
            onClick={() => onVote(proposal.id, 'reject')}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-colors",
              myVote === 'reject'
                ? "bg-[#B91C1C] border-[#B91C1C] text-white font-bold"
                : "bg-[#FEE2E2] dark:bg-red-500/10 border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 hover:bg-[#FECACA]"
            )}
          >
            <X className="w-3 h-3" /> Reject{myVote === 'reject' ? ' ✓' : ''}
          </button>
          <button
            onClick={() => onVote(proposal.id, 'abstain')}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-colors",
              myVote === 'abstain'
                ? "bg-[#F59E0B] border-[#F59E0B] text-white font-bold"
                : "bg-[#FEF3C7] dark:bg-amber-500/10 border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 hover:bg-[#F59E0B]/25"
            )}
          >
            <Zap className="w-3 h-3" /> Abstain{myVote === 'abstain' ? ' ✓' : ''}
          </button>
          <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted border border-[#E2E8F0] text-[11px] text-[#64748B] hover:bg-[#E2E8F0] transition-colors">
            <ArrowUp className="w-3 h-3" /> Escalate
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function CommitteePage() {
  // votes[proposalId][userId] = 'approve' | 'reject' | 'abstain'
  const [votes, setVotes] = useState<Record<string, Record<string, 'approve' | 'reject' | 'abstain'>>>({})

  const handleVote = (proposalId: string, vote: 'approve' | 'reject' | 'abstain') => {
    setVotes(prev => {
      const existing = prev[proposalId] ?? {}
      // If clicking the same vote, toggle off (remove vote)
      if (existing[DEMO_VOTER_ID] === vote) {
        const next = { ...existing }
        delete next[DEMO_VOTER_ID]
        return { ...prev, [proposalId]: next }
      }
      return {
        ...prev,
        [proposalId]: { ...existing, [DEMO_VOTER_ID]: vote },
      }
    })
  }

  const stats = [
    { label: "Awaiting Vote", value: activeProposals.length, color: "text-[#64748B]", icon: Vote },
    { label: "Voted This Month", value: 1, color: "text-[#15803D] dark:text-green-400", icon: CheckCircle2 },
    { label: "Next Meeting", value: "Jul 15, 2026", color: "text-[#0B6BCB]", isText: true, icon: Calendar },
    { label: "Quorum", value: "3/5 present", color: "text-[#B45309] dark:text-amber-400", isText: true, icon: Users },
  ]

  // Evidence packets - evidence linked to active proposals
  const activeEvidenceIdsSet = new Set(activeProposals.flatMap(p => p.evidence_source_ids))
  const activeEvidenceIds = Array.from(activeEvidenceIdsSet)
  const evidencePackets = activeEvidenceIds
    .map(id => MOCK_EVIDENCE.find(e => e.id === id))
    .filter(Boolean) as typeof MOCK_EVIDENCE

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <Breadcrumb items={[{ label: "Committee" }]} />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-3">
            <Gavel className="w-7 h-7 text-[#0B6BCB]" />
            <h1 className="font-display text-3xl font-bold text-[#1A2332]">Committee Workspace</h1>
          </div>
          <p className="text-[#64748B] text-sm pl-10">
            Infection Control &amp; Policy SOP Committee
          </p>
        </motion.div>

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30"
        >
          <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0" />
          <span className="text-xs text-[#B45309] dark:text-amber-400">
            Research Prototype - Not for Clinical Use. Votes here are for demonstration only.
          </span>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {stats.map(({ label, value, color, isText, icon: Icon }) => (
            <div key={label} className="rounded-2xl bg-card border border-[#E2E8F0] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] font-medium">{label}</span>
                <Icon className={cn("w-4 h-4", color)} />
              </div>
              <p className={cn("font-bold font-display", color, isText ? "text-lg" : "text-3xl")}>
                {value}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Main grid */}
        <div className="grid xl:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-8">
            {/* Proposals Awaiting Review */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-[#1A2332] flex items-center gap-2">
                  <Vote className="w-5 h-5 text-[#0B6BCB]" />
                  Proposals Awaiting Review
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-muted border border-[#CBD5E1] text-xs text-[#334155] font-semibold">
                  {activeProposals.length} active
                </span>
              </div>

              {activeProposals.length === 0 ? (
                <div className="rounded-2xl bg-card border border-[#E2E8F0] p-10 text-center">
                  <Vote className="w-8 h-8 mx-auto mb-3 text-[#64748B] opacity-40" />
                  <p className="text-sm text-[#64748B]">No proposals currently awaiting review.</p>
                </div>
              ) : (
                activeProposals.map((p, i) => (
                  <CommitteeProposalCard
                    key={p.id}
                    proposal={p}
                    index={i}
                    votes={votes[p.id] ?? {}}
                    onVote={handleVote}
                  />
                ))
              )}
            </section>

            {/* Recent Decisions */}
            <section className="space-y-4">
              <h2 className="font-display text-lg font-bold text-[#1A2332] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#15803D] dark:text-green-400" />
                Recent Decisions
              </h2>

              {decidedProposals.length === 0 ? (
                <p className="text-sm text-[#64748B]">No decided proposals yet.</p>
              ) : (
                <div className="space-y-3">
                  {decidedProposals.map((p, i) => {
                    const info = statusBadge(p.status)
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-start gap-4 p-4 rounded-xl bg-card border border-[#E2E8F0]"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          p.status === "approved" ? "bg-[#16A34A]/20" : "bg-[#DC2626]/20"
                        )}>
                          {p.status === "approved"
                            ? <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-green-400" />
                            : <X className="w-4 h-4 text-[#B91C1C] dark:text-red-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <Link href={`/proposals/${p.id}`} className="text-sm font-medium text-[#1A2332] hover:text-[#0B6BCB] transition-colors line-clamp-1">
                            {p.title}
                          </Link>
                          <div className="flex flex-wrap gap-3 text-xs text-[#64748B]">
                            <span>{p.department}</span>
                            <span>·</span>
                            <span>Initiated by {p.initiated_by.name}</span>
                          </div>
                        </div>
                        <span className={cn("px-2 py-0.5 rounded text-xs font-semibold shrink-0", info.cls)}>
                          {info.label}
                        </span>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Committee Members */}
            <section className="space-y-4">
              <h2 className="font-display text-lg font-bold text-[#1A2332] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0B6BCB]" />
                Committee Members
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {committeeUsers.map((user, i) => {
                  // Check if user has voted on any active proposal
                  const hasVoted = activeProposals.some(p =>
                    p.approvers.some(a => a.user_id === user.id && a.status !== "pending")
                  )
                  return (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="rounded-xl bg-card border border-[#E2E8F0] p-4 flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center text-[#0B6BCB] text-sm font-bold shrink-0">
                        {user.initials}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-[#1A2332] truncate">{user.name}</p>
                        <p className="text-xs text-[#64748B] truncate">{user.title}</p>
                        <p className="text-xs text-[#64748B]">{user.department}</p>
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold mt-1",
                          hasVoted
                            ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400"
                            : "bg-muted text-[#64748B]"
                        )}>
                          {hasVoted ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                          {hasVoted ? "Voted" : "Pending"}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </section>
          </div>

          {/* Sidebar: Evidence Packets */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-card border border-[#E2E8F0] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0B6BCB]" />
                <h3 className="font-display text-sm font-bold text-[#1A2332]">Evidence Packets</h3>
                <span className="ml-auto text-xs text-[#64748B]">{evidencePackets.length} items</span>
              </div>

              <div className="space-y-3">
                {evidencePackets.map((ev) => {
                  const alignMap: Record<string, string> = {
                    aligned: "text-[#15803D] dark:text-green-400",
                    partially_aligned: "text-[#B45309] dark:text-amber-400",
                    possible_update: "text-[#B45309] dark:text-amber-400",
                    conflict_detected: "text-[#B91C1C] dark:text-red-400",
                  }
                  return (
                    <div key={ev.id} className="rounded-xl bg-muted border border-[#E2E8F0] p-3 space-y-2">
                      <p className="text-xs font-medium text-[#1A2332] leading-snug line-clamp-2">{ev.title}</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-[#64748B]">{ev.source_name}</span>
                        <span className={cn("text-[10px] font-semibold", alignMap[ev.alignment_status] ?? "text-[#64748B]")}>
                          {Math.round(ev.source_trust_score * 100)}% trust
                        </span>
                      </div>
                      <button className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[11px] text-[#0B6BCB] hover:bg-[#0B6BCB]/10 transition-colors">
                        Open Packet
                      </button>
                    </div>
                  )
                })}

                {evidencePackets.length === 0 && (
                  <p className="text-xs text-[#64748B] text-center py-4">No evidence packets for active proposals.</p>
                )}
              </div>
            </div>

            {/* Quorum status */}
            <div className="rounded-2xl bg-card border border-[#E2E8F0] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#B45309] dark:text-amber-400" />
                <h3 className="font-display text-sm font-bold text-[#1A2332]">Quorum Status</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">Members Present</span>
                  <span className="font-semibold text-[#B45309] dark:text-amber-400">3 of 5</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div className="h-full w-[60%] rounded-full bg-[#F59E0B]" />
                </div>
                <p className="text-[10px] text-[#64748B]">Quorum threshold: 3 members (60%)</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
