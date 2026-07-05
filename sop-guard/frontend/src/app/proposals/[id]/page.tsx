"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  AlertTriangle, Stethoscope, Scale, GraduationCap, Calendar,
  Building2, FileText, Users, CheckCircle2, XCircle, Clock,
  ChevronLeft, Sparkles, ShieldAlert, GitBranch, BookOpen,
  Vote, MessageSquare, History, Gavel, Check, X, Zap, ArrowUp
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"
import { MOCK_PROPOSALS, MOCK_EVIDENCE } from "@/lib/mock-data"
import type { UpdateProposal, ApproverRecord, ProposalComment, AuditEntry, AuditEventType } from "@/lib/governance-types"

// ── Word-Level Diff ─────────────────────────────────────────────────────────
function computeWordDiff(oldText: string, newText: string): Array<{ type: 'removed' | 'added' | 'unchanged'; word: string }> {
  const oldWords = oldText.split(/\s+/)
  const newWords = newText.split(/\s+/)

  const m = oldWords.length
  const n = newWords.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to get diff
  const ops: Array<{ type: 'removed' | 'added' | 'unchanged'; word: string }> = []
  let i = m, j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      ops.unshift({ type: 'unchanged', word: oldWords[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'added', word: newWords[j - 1] })
      j--
    } else {
      ops.unshift({ type: 'removed', word: oldWords[i - 1] })
      i--
    }
  }

  return ops
}

function WordDiffViewer({ oldText, newText, section, reason, evidenceRef }: {
  oldText: string
  newText: string
  section: string
  reason: string
  evidenceRef: string
}) {
  const diff = computeWordDiff(oldText, newText)

  return (
    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-[#E2E8F0]">
        <span className="text-sm font-medium text-[#334155]">Section: {section}</span>
        <div className="flex gap-2">
          <span className="text-xs bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 px-2 py-0.5 rounded">
            − Removed
          </span>
          <span className="text-xs bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 px-2 py-0.5 rounded">
            + Added
          </span>
        </div>
      </div>

      {/* Change reason + evidence */}
      <div className="px-4 py-2 bg-muted text-xs text-[#64748B] border-b border-[#E2E8F0]">
        <span className="text-[#B45309] dark:text-amber-400 font-medium">Reason:</span> {reason}
        {evidenceRef && <span className="ml-2 text-[#0B6BCB]">• Evidence: {evidenceRef}</span>}
      </div>

      {/* Unified diff view */}
      <div className="p-4 bg-background font-mono text-sm leading-relaxed">
        <p className="flex flex-wrap gap-1">
          {diff.map((item, idx) => (
            <span
              key={idx}
              className={cn(
                "px-0.5 rounded",
                item.type === 'removed' && "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 line-through",
                item.type === 'added' && "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400",
                item.type === 'unchanged' && "text-[#1A2332]"
              )}
            >
              {item.word}
            </span>
          ))}
        </p>
      </div>
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
    training_review: { cls: "bg-card text-[#475569] border border-[#CBD5E1]", label: "Training Review" },
    draft: { cls: "bg-card text-[#475569] border border-[#CBD5E1]", label: "Draft" },
    rejected: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30", label: "Rejected" },
    published: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30", label: "Published" },
  }
  return map[status] ?? { cls: "bg-muted text-[#64748B]", label: status }
}

function approverStatusBadge(status: ApproverRecord["status"]) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    approved: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400", label: "Approved", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    rejected: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400", label: "Rejected", icon: <XCircle className="w-3.5 h-3.5" /> },
    pending: { cls: "bg-muted text-[#64748B]", label: "Pending", icon: <Clock className="w-3.5 h-3.5" /> },
    requested_changes: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400", label: "Changes Requested", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    abstained: { cls: "bg-muted text-[#64748B]", label: "Abstained", icon: <Clock className="w-3.5 h-3.5" /> },
  }
  return map[status] ?? { cls: "bg-muted text-[#64748B]", label: status, icon: null }
}

function alignmentBadge(status: string) {
  const map: Record<string, string> = {
    aligned: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30",
    partially_aligned: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
    possible_update: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
    conflict_detected: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    insufficient_evidence: "bg-muted text-[#64748B]",
    not_reviewed: "bg-muted text-[#64748B]",
  }
  return map[status] ?? "bg-muted text-[#64748B]"
}

function commentTypeBadge(type: ProposalComment["type"]) {
  const map: Record<string, string> = {
    comment: "bg-muted text-[#334155]",
    request_change: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400",
    approval: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400",
    rejection: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400",
    escalation: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400",
  }
  return map[type] ?? "bg-muted text-[#334155]"
}

function auditEventColor(type: AuditEventType) {
  const map: Partial<Record<AuditEventType, string>> = {
    proposal_created: "bg-[#0B6BCB] border-[#0B6BCB]",
    proposal_submitted: "bg-[#0B6BCB] border-[#0B6BCB]",
    committee_vote: "bg-[#0B6BCB] border-[#0B6BCB]",
    legal_review_completed: "bg-[#F59E0B] border-[#F59E0B]",
    proposal_approved: "bg-[#16A34A] border-[#16A34A]",
    proposal_rejected: "bg-[#DC2626] border-[#DC2626]",
    ai_recommendation_generated: "bg-[#94A3B8] border-[#94A3B8]",
  }
  return map[type] ?? "bg-[#94A3B8] border-[#94A3B8]"
}

function auditEventIcon(type: AuditEventType) {
  const map: Partial<Record<AuditEventType, React.ReactNode>> = {
    proposal_created: <FileText className="w-3 h-3" />,
    committee_vote: <Vote className="w-3 h-3" />,
    legal_review_completed: <Scale className="w-3 h-3" />,
    proposal_approved: <CheckCircle2 className="w-3 h-3" />,
    proposal_rejected: <XCircle className="w-3 h-3" />,
    ai_recommendation_generated: <Sparkles className="w-3 h-3" />,
    proposal_submitted: <GitBranch className="w-3 h-3" />,
  }
  return map[type] ?? <Clock className="w-3 h-3" />
}

// ── Tab components ─────────────────────────────────────────────────────────
function OverviewTab({ proposal }: { proposal: UpdateProposal }) {
  const approvedCount = proposal.approvers.filter(a => a.status === "approved").length

  return (
    <div className="space-y-6">
      {/* AI Recommendation */}
      <div className="rounded-2xl bg-muted border border-[#E2E8F0] p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#64748B]" />
          <h3 className="text-sm font-semibold text-[#334155]">AI Recommendation</h3>
        </div>
        <p className="text-sm text-[#64748B] leading-relaxed">{proposal.ai_summary}</p>
      </div>

      {/* Impact summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#64748B]" />
            <span className="text-xs font-semibold text-[#334155]">Clinical Impact</span>
          </div>
          <p className="text-xs text-[#64748B]">{proposal.clinical_impact}</p>
        </div>
        <div className="rounded-xl bg-muted border border-[#FDE68A] dark:border-amber-500/30 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#B45309] dark:text-amber-400" />
            <span className="text-xs font-semibold text-[#B45309] dark:text-amber-400">Legal Impact</span>
          </div>
          <p className="text-xs text-[#64748B]">{proposal.legal_impact}</p>
        </div>
        <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[#64748B]" />
            <span className="text-xs font-semibold text-[#334155]">Training Impact</span>
          </div>
          <p className="text-xs text-[#64748B]">{proposal.training_impact}</p>
        </div>
      </div>

      {/* Risk level */}
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-4 h-4 text-[#64748B]" />
        <span className="text-xs text-[#64748B]">Risk Level:</span>
        <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase", priorityBadge(proposal.risk_level))}>
          {proposal.risk_level}
        </span>
        <span className="text-xs text-[#64748B] ml-4">Approvers: {approvedCount}/{proposal.approvers.length} approved</span>
      </div>

      {/* Proposed changes */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[#1A2332] flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#0B6BCB]" />
          Proposed Changes
        </h3>
        {proposal.proposed_changes.map((change, i) => (
          <div key={i} className="space-y-3">
            <WordDiffViewer
              oldText={change.current_text}
              newText={change.proposed_text}
              section={change.section}
              reason={change.change_reason}
              evidenceRef={change.evidence_reference}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function EvidenceTab({ proposal }: { proposal: UpdateProposal }) {
  const linkedEvidence = proposal.evidence_source_ids
    .map(id => MOCK_EVIDENCE.find(e => e.id === id))
    .filter(Boolean) as typeof MOCK_EVIDENCE

  const strengthBadge = (s: string) => {
    const map: Record<string, string> = {
      high: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400",
      moderate: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400",
      low: "bg-muted text-[#64748B]",
      insufficient: "bg-muted text-[#64748B]",
      expert_opinion: "bg-muted text-[#334155]",
    }
    return map[s] ?? "bg-muted text-[#64748B]"
  }

  return (
    <div className="space-y-5">
      {linkedEvidence.length === 0 && (
        <div className="text-center py-12 text-[#64748B] text-sm">
          No evidence sources linked to this proposal.
        </div>
      )}
      {linkedEvidence.map((ev, i) => (
        <motion.div
          key={ev.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="rounded-2xl bg-muted border border-[#E2E8F0] p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("px-2 py-0.5 rounded text-xs font-semibold uppercase", strengthBadge(ev.evidence_strength))}>
              {ev.evidence_strength} evidence
            </span>
            <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", alignmentBadge(ev.alignment_status))}>
              {ev.alignment_status.replace("_", " ")}
            </span>
          </div>

          <h4 className="font-display text-sm font-bold text-[#1A2332] leading-snug">{ev.title}</h4>

          <div className="flex flex-wrap gap-4 text-xs text-[#64748B]">
            <span>{ev.source_name}</span>
            <span>{ev.publication_date}</span>
          </div>

          <p className="text-sm text-[#64748B] leading-relaxed">{ev.summary}</p>

          {ev.relevant_excerpt && (
            <blockquote className="border-l-2 border-[#0B6BCB]/30 pl-4 text-xs text-[#0B6BCB]/80 italic leading-relaxed">
              {ev.relevant_excerpt}
            </blockquote>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <span>Source Trust Score</span>
              <span className="text-[#0B6BCB] font-semibold">{Math.round(ev.source_trust_score * 100)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0B6BCB] to-[#0B6BCB]"
                style={{ width: `${ev.source_trust_score * 100}%` }}
              />
            </div>
          </div>

          {ev.clinical_relevance && (
            <div className="rounded-lg bg-muted border border-[#E2E8F0] px-3 py-2">
              <p className="text-xs text-[#334155]">
                <span className="font-semibold">Clinical Relevance: </span>
                {ev.clinical_relevance}
              </p>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

function CommitteeTab({ proposal }: { proposal: UpdateProposal }) {
  const { role } = useRole()
  const approvedCount = proposal.approvers.filter(a => a.status === "approved").length
  const totalApprovers = proposal.approvers.length
  const pct = totalApprovers > 0 ? (approvedCount / totalApprovers) * 100 : 0

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()

  return (
    <div className="space-y-6">
      {/* Approvers list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[#1A2332] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0B6BCB]" />
          Approvers
        </h3>
        {proposal.approvers.map((approver) => {
          const info = approverStatusBadge(approver.status)
          return (
            <div key={approver.user_id} className="flex items-start gap-4 p-4 rounded-xl bg-muted border border-[#E2E8F0]">
              <div className="w-10 h-10 rounded-full bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center text-[#0B6BCB] text-sm font-bold shrink-0">
                {getInitials(approver.user_name)}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#1A2332]">{approver.user_name}</span>
                  <span className="text-xs text-[#64748B]">{approver.role}</span>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ml-auto", info.cls)}>
                    {info.icon}
                    {info.label}
                  </span>
                </div>
                {approver.date && (
                  <p className="text-xs text-[#64748B]">Voted {approver.date}</p>
                )}
                {approver.notes && (
                  <p className="text-xs text-[#64748B] italic">{approver.notes}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Vote progress */}
      <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#64748B]">Vote Progress</span>
          <span className="font-bold text-[#1A2332]">{approvedCount} of {totalApprovers} approved</span>
        </div>
        <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0B6BCB] to-[#16A34A] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[#1A2332] flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#0B6BCB]" />
          Committee Discussion
        </h3>
        {proposal.comments.map((comment) => (
          <CommentThread key={comment.id} comment={comment} />
        ))}
        {proposal.comments.length === 0 && (
          <p className="text-sm text-[#64748B] text-center py-6">No comments yet.</p>
        )}
      </div>

      {/* Role-based actions */}
      {role === "committee_member" && (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-[#E2E8F0]">
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A]/20 border border-[#BBF7D0] dark:border-green-500/30 text-sm text-[#15803D] dark:text-green-400 hover:bg-[#BBF7D0] transition-colors">
            <Check className="w-4 h-4" /> Vote Approve
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#DC2626]/20 border border-[#FECACA] dark:border-red-500/30 text-sm text-[#B91C1C] dark:text-red-400 hover:bg-[#FECACA] transition-colors">
            <X className="w-4 h-4" /> Vote Reject
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B]/20 border border-[#FDE68A] dark:border-amber-500/30 text-sm text-[#B45309] dark:text-amber-400 hover:bg-[#FDE68A] transition-colors">
            <Zap className="w-4 h-4" /> Request Changes
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted border border-[#CBD5E1] text-sm text-[#334155] hover:bg-[#E2E8F0] transition-colors">
            <ArrowUp className="w-4 h-4" /> Escalate to Legal
          </button>
        </div>
      )}
      {role === "legal_risk" && (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-[#E2E8F0]">
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted border border-[#CBD5E1] text-sm text-[#334155] hover:bg-[#E2E8F0] transition-colors">
            <Scale className="w-4 h-4" /> Complete Legal Review
          </button>
          <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B]/20 border border-[#FDE68A] dark:border-amber-500/30 text-sm text-[#B45309] dark:text-amber-400 hover:bg-[#FDE68A] transition-colors">
            <Clock className="w-4 h-4" /> Place on Hold
          </button>
        </div>
      )}
    </div>
  )
}

function CommentThread({ comment, isReply = false }: { comment: ProposalComment; isReply?: boolean }) {
  return (
    <div className={cn("space-y-2", isReply && "ml-8 border-l border-[#E2E8F0] pl-4")}>
      <div className="p-4 rounded-xl bg-muted border border-[#E2E8F0] space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#1A2332]">{comment.author}</span>
          <span className="text-xs text-[#64748B]">{comment.author_role}</span>
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase", commentTypeBadge(comment.type))}>
            {comment.type.replace("_", " ")}
          </span>
          <span className="text-xs text-[#64748B] ml-auto">{comment.date}</span>
        </div>
        <p className="text-sm text-[#64748B] leading-relaxed">{comment.content}</p>
      </div>
      {comment.replies?.map(reply => (
        <CommentThread key={reply.id} comment={reply} isReply />
      ))}
    </div>
  )
}

function TimelineTab({ proposal }: { proposal: UpdateProposal }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[#1A2332] flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-[#0B6BCB]" />
        Audit Trail
      </h3>
      <div className="relative space-y-0">
        {proposal.audit_trail.map((entry, i) => {
          const isLast = i === proposal.audit_trail.length - 1
          const dotColor = auditEventColor(entry.event_type)
          return (
            <div key={entry.id} className="flex gap-4">
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center">
                <div className={cn("w-7 h-7 rounded-full border-2 flex items-center justify-center text-white shrink-0", dotColor)}>
                  {auditEventIcon(entry.event_type)}
                </div>
                {!isLast && <div className="w-px flex-1 bg-[#E2E8F0] mt-1" />}
              </div>

              {/* Content */}
              <div className={cn("pb-6 flex-1 min-w-0", isLast && "pb-0")}>
                <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-[#1A2332]">{entry.user}</span>
                    <span className="text-[10px] text-[#64748B] uppercase tracking-wide">{entry.user_role}</span>
                    <span className="text-xs text-[#64748B] ml-auto">
                      {new Date(entry.timestamp).toLocaleString("en-US")}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] leading-relaxed">{entry.action_summary}</p>
                </div>
              </div>
            </div>
          )
        })}
        {proposal.audit_trail.length === 0 && (
          <p className="text-sm text-[#64748B] text-center py-8">No audit entries yet.</p>
        )}
      </div>
    </div>
  )
}

function LegalRiskTab({ proposal }: { proposal: UpdateProposal }) {
  const legalComments = proposal.comments.filter(c =>
    c.type === "escalation" || c.author_role.toLowerCase().includes("legal")
  )

  const riskColors: Record<string, string> = {
    critical: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    high: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    medium: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
    low: "bg-muted text-[#64748B]",
  }

  return (
    <div className="space-y-6">
      {/* Legal review status */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-2">
          <p className="text-xs text-[#64748B]">Legal Review Required</p>
          <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-semibold",
            proposal.legal_review_required
              ? "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30"
              : "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30"
          )}>
            {proposal.legal_review_required ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {proposal.legal_review_required ? "Yes - Required" : "Not Required"}
          </div>
        </div>
        <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-2">
          <p className="text-xs text-[#64748B]">Risk Classification</p>
          <span className={cn("inline-flex px-3 py-1 rounded-lg text-sm font-bold uppercase", riskColors[proposal.risk_level])}>
            {proposal.risk_level}
          </span>
        </div>
      </div>

      {/* Legal impact */}
      <div className="rounded-xl bg-muted border border-[#FDE68A] dark:border-amber-500/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#B45309] dark:text-amber-400" />
          <p className="text-xs font-semibold text-[#B45309] dark:text-amber-400 uppercase tracking-wide">Legal Impact</p>
        </div>
        <p className="text-sm text-[#64748B] leading-relaxed">{proposal.legal_impact}</p>
      </div>

      {/* Legal reviewer notes */}
      {legalComments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A2332] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#B45309] dark:text-amber-400" />
            Legal Reviewer Notes
          </h3>
          {legalComments.map(c => (
            <div key={c.id} className="p-4 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#B45309] dark:text-amber-400">{c.author}</span>
                <span className="text-xs text-[#64748B]">{c.date}</span>
              </div>
              <p className="text-sm text-[#64748B]">{c.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-xl bg-muted border border-[#E2E8F0] px-4 py-3">
        <p className="text-xs text-[#64748B]/70 text-center italic">
          This platform does not provide legal advice. Legal determinations require qualified counsel.
        </p>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "evidence", label: "Evidence", icon: BookOpen },
  { id: "committee", label: "Committee", icon: Gavel },
  { id: "timeline", label: "Timeline", icon: History },
  { id: "legal", label: "Legal / Risk", icon: Scale },
]

export default function ProposalDetailPage() {
  const params = useParams()
  const id = params.id as string
  const proposal = MOCK_PROPOSALS.find(p => p.id === id) ?? MOCK_PROPOSALS[0]
  const [activeTab, setActiveTab] = useState("overview")

  const statusInfo = statusBadge(proposal.status)

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb items={[
          { label: "Proposals", href: "/proposals" },
          { label: proposal.title.length > 60 ? proposal.title.slice(0, 60) + "…" : proposal.title }
        ]} />

        {/* Back button */}
        <Link href="/proposals" className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0B6BCB] transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Proposals
        </Link>

        {/* Proposal header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-[#E2E8F0] p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide", priorityBadge(proposal.priority))}>
              {proposal.priority} priority
            </span>
            <span className={cn("px-2.5 py-1 rounded text-xs font-semibold", statusInfo.cls)}>
              {statusInfo.label}
            </span>
          </div>

          <h1 className="font-display text-2xl font-bold text-[#1A2332] leading-snug">{proposal.title}</h1>

          <div className="flex flex-wrap gap-4 text-xs text-[#64748B]">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3" /> {proposal.department}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" /> Created {proposal.created_date}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              Due {proposal.due_date}
              {new Date(proposal.due_date) < new Date() && (
                <span className="text-[#B91C1C] dark:text-red-400 font-semibold">(Overdue)</span>
              )}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-[#0B6BCB] shrink-0 mt-0.5" />
            <span className="text-xs">
              <span className="text-[#64748B]">Affected SOP: </span>
              <span className="text-[#0B6BCB] font-medium">{proposal.affected_sop_title}</span>
            </span>
          </div>
        </motion.div>

        {/* Disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30">
          <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0" />
          <span className="text-xs text-[#B45309] dark:text-amber-400">Research Prototype - Not for Clinical Use.</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#E2E8F0]">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg border-b-2 -mb-px",
                  activeTab === tab.id
                    ? "text-[#0B6BCB] border-[#0B6BCB]"
                    : "text-[#64748B] border-transparent hover:text-[#0B6BCB]"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview" && <OverviewTab proposal={proposal} />}
          {activeTab === "evidence" && <EvidenceTab proposal={proposal} />}
          {activeTab === "committee" && <CommitteeTab proposal={proposal} />}
          {activeTab === "timeline" && <TimelineTab proposal={proposal} />}
          {activeTab === "legal" && <LegalRiskTab proposal={proposal} />}
        </motion.div>
      </div>
    </AppShell>
  )
}
