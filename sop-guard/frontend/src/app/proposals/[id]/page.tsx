"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  AlertTriangle, Scale, Calendar, Building2, FileText, Users, CheckCircle2,
  XCircle, Clock, ChevronLeft, Gavel, History, Check, X, MinusCircle, Loader2,
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

interface Proposal {
  id: number
  title: string
  affected_sop_id: string
  department: string
  status: "open" | "approved" | "rejected"
  priority: string
  initiated_by: string
  ai_summary: string
  legal_review_required: boolean
  payload: Record<string, unknown>
  created_at: string | null
  tally: { approve: number; reject: number; abstain: number; request_changes: number; total: number }
  quorum: { threshold: number; committee_size: number; votes_cast: number; reached: boolean; decision: string }
  votes: { id: number; user_id: string; user_name: string; vote: string; notes: string; created_at: string }[]
}

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    urgent: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    high: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    normal: "bg-card text-[#475569] border border-[#CBD5E1]",
    low: "bg-card text-[#475569] border border-[#CBD5E1]",
  }
  return map[priority] ?? map.normal
}

function statusBadge(status: Proposal["status"]) {
  const map: Record<string, { cls: string; label: string }> = {
    open: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30", label: "Open - Awaiting Votes" },
    approved: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30", label: "Approved" },
    rejected: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30", label: "Rejected" },
  }
  return map[status] ?? { cls: "bg-muted text-[#64748B]", label: status }
}

function voteBadge(vote: string) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    approve: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400", label: "Approved", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    reject: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400", label: "Rejected", icon: <XCircle className="w-3.5 h-3.5" /> },
    abstain: { cls: "bg-muted text-[#64748B]", label: "Abstained", icon: <MinusCircle className="w-3.5 h-3.5" /> },
    request_changes: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400", label: "Requested Changes", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  }
  return map[vote] ?? { cls: "bg-muted text-[#64748B]", label: vote, icon: null }
}

function OverviewTab({ proposal }: { proposal: Proposal }) {
  return (
    <div className="space-y-6">
      {proposal.ai_summary && (
        <div className="rounded-2xl bg-muted border border-[#E2E8F0] p-5 space-y-2">
          <h3 className="text-sm font-semibold text-[#334155]">Summary / Rationale</h3>
          <p className="text-sm text-[#64748B] leading-relaxed">{proposal.ai_summary}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-2">
          <p className="text-xs text-[#64748B]">Affected SOP</p>
          <p className="text-sm font-medium text-[#0B6BCB]">{proposal.affected_sop_id || "Not specified"}</p>
        </div>
        <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-2">
          <p className="text-xs text-[#64748B]">Department</p>
          <p className="text-sm font-medium text-[#1A2332]">{proposal.department || "Not specified"}</p>
        </div>
      </div>

      {Object.keys(proposal.payload || {}).length > 0 && (
        <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-2">
          <p className="text-xs text-[#64748B] uppercase tracking-wide font-semibold">Additional Details</p>
          <pre className="text-xs text-[#334155] whitespace-pre-wrap font-mono">{JSON.stringify(proposal.payload, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

function VotesTab({ proposal, onVoteCast }: { proposal: Proposal; onVoteCast: (p: Proposal) => void }) {
  const { role, currentUser, hasPermission } = useRole()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const pct = proposal.quorum.committee_size > 0
    ? (proposal.quorum.votes_cast / proposal.quorum.threshold) * 100
    : 0

  const canVote = hasPermission("review_proposal") && proposal.status === "open"

  async function castVote(vote: string) {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE}/api/governance/proposals/${proposal.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.name, user_name: currentUser.name, vote }),
      })
      if (!res.ok) throw new Error("Vote failed")
      const updated: Proposal = await res.json()
      onVoteCast(updated)
    } catch {
      setError("Could not submit the vote. Is the backend running?")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#64748B]">Quorum Progress</span>
          <span className="font-bold text-[#1A2332]">{proposal.quorum.votes_cast} / {proposal.quorum.threshold} votes to reach quorum</span>
        </div>
        <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0B6BCB] to-[#16A34A] transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center pt-1">
          <div><p className="text-lg font-bold text-[#15803D] dark:text-green-400">{proposal.tally.approve}</p><p className="text-[10px] text-[#64748B] uppercase">Approve</p></div>
          <div><p className="text-lg font-bold text-[#B91C1C] dark:text-red-400">{proposal.tally.reject}</p><p className="text-[10px] text-[#64748B] uppercase">Reject</p></div>
          <div><p className="text-lg font-bold text-[#64748B]">{proposal.tally.abstain}</p><p className="text-[10px] text-[#64748B] uppercase">Abstain</p></div>
          <div><p className="text-lg font-bold text-[#B45309] dark:text-amber-400">{proposal.tally.request_changes}</p><p className="text-[10px] text-[#64748B] uppercase">Changes</p></div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[#1A2332] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0B6BCB]" /> Votes Cast ({proposal.votes.length})
        </h3>
        {proposal.votes.length === 0 && <p className="text-sm text-[#64748B] text-center py-6">No votes yet.</p>}
        {proposal.votes.map((v) => {
          const info = voteBadge(v.vote)
          return (
            <div key={v.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted border border-[#E2E8F0]">
              <div className="w-9 h-9 rounded-full bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center text-[#0B6BCB] text-xs font-bold shrink-0">
                {v.user_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#1A2332]">{v.user_name}</span>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ml-auto", info.cls)}>
                    {info.icon} {info.label}
                  </span>
                </div>
                <p className="text-xs text-[#64748B]">{new Date(v.created_at).toLocaleString("en-US")}</p>
                {v.notes && <p className="text-xs text-[#64748B] italic">{v.notes}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {canVote && (
        <div className="space-y-2 pt-4 border-t border-[#E2E8F0]">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button disabled={submitting} onClick={() => castVote("approve")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#16A34A]/20 border border-[#BBF7D0] dark:border-green-500/30 text-sm text-[#15803D] dark:text-green-400 hover:bg-[#BBF7D0] transition-colors disabled:opacity-50">
              <Check className="w-4 h-4" /> Approve
            </button>
            <button disabled={submitting} onClick={() => castVote("reject")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#DC2626]/20 border border-[#FECACA] dark:border-red-500/30 text-sm text-[#B91C1C] dark:text-red-400 hover:bg-[#FECACA] transition-colors disabled:opacity-50">
              <X className="w-4 h-4" /> Reject
            </button>
            <button disabled={submitting} onClick={() => castVote("request_changes")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B]/20 border border-[#FDE68A] dark:border-amber-500/30 text-sm text-[#B45309] dark:text-amber-400 hover:bg-[#FDE68A] transition-colors disabled:opacity-50">
              <AlertTriangle className="w-4 h-4" /> Request Changes
            </button>
            <button disabled={submitting} onClick={() => castVote("abstain")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted border border-[#CBD5E1] text-sm text-[#334155] hover:bg-[#E2E8F0] transition-colors disabled:opacity-50">
              <MinusCircle className="w-4 h-4" /> Abstain
            </button>
            {submitting && <Loader2 className="w-4 h-4 animate-spin text-[#64748B] self-center" />}
          </div>
        </div>
      )}
      {!canVote && proposal.status !== "open" && (
        <p className="text-xs text-[#64748B] pt-4 border-t border-[#E2E8F0]">
          This proposal has already reached a final decision ({proposal.status}) and is no longer open for votes.
        </p>
      )}
      {!canVote && proposal.status === "open" && role !== "committee_member" && role !== "legal_risk" && (
        <p className="text-xs text-[#64748B] pt-4 border-t border-[#E2E8F0]">
          Only committee members and legal/risk reviewers can vote on proposals.
        </p>
      )}
    </div>
  )
}

function TimelineTab({ proposal }: { proposal: Proposal }) {
  const events = [
    { label: `Proposal created by ${proposal.initiated_by || "unknown"}`, ts: proposal.created_at, icon: <FileText className="w-3 h-3" /> },
    ...proposal.votes.map((v) => ({
      label: `${v.user_name} voted "${v.vote.replace("_", " ")}"`,
      ts: v.created_at,
      icon: <Gavel className="w-3 h-3" />,
    })),
  ].filter((e) => e.ts).sort((a, b) => new Date(a.ts as string).getTime() - new Date(b.ts as string).getTime())

  if (proposal.status !== "open") {
    events.push({
      label: `Quorum reached - proposal ${proposal.status}`,
      ts: proposal.votes[proposal.votes.length - 1]?.created_at ?? proposal.created_at,
      icon: proposal.status === "approved" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />,
    })
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[#1A2332] flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-[#0B6BCB]" /> Timeline
      </h3>
      <div className="relative space-y-0">
        {events.map((entry, i) => {
          const isLast = i === events.length - 1
          return (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-white shrink-0 bg-[#0B6BCB] border-[#0B6BCB]">
                  {entry.icon}
                </div>
                {!isLast && <div className="w-px flex-1 bg-[#E2E8F0] mt-1" />}
              </div>
              <div className={cn("pb-6 flex-1 min-w-0", isLast && "pb-0")}>
                <div className="rounded-xl bg-muted border border-[#E2E8F0] p-4 space-y-1">
                  <p className="text-xs text-[#334155]">{entry.label}</p>
                  {entry.ts && <p className="text-xs text-[#64748B]">{new Date(entry.ts).toLocaleString("en-US")}</p>}
                </div>
              </div>
            </div>
          )
        })}
        {events.length === 0 && <p className="text-sm text-[#64748B] text-center py-8">No events yet.</p>}
      </div>
    </div>
  )
}

const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "votes", label: "Votes & Quorum", icon: Gavel },
  { id: "timeline", label: "Timeline", icon: History },
]

export default function ProposalDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    fetch(`${API_BASE}/api/governance/proposals/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then((data) => { if (data) setProposal(data) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24 text-[#64748B] gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading proposal...
        </div>
      </AppShell>
    )
  }

  if (notFound || !proposal) {
    return (
      <AppShell>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Link href="/proposals" className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0B6BCB] transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Proposals
          </Link>
          <div className="rounded-2xl bg-card border border-[#E2E8F0] p-12 text-center">
            <FileText className="w-8 h-8 text-[#64748B] mx-auto mb-3 opacity-40" />
            <p className="text-[#64748B] text-sm">Proposal {id} was not found.</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const statusInfo = statusBadge(proposal.status)

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb items={[
          { label: "Proposals", href: "/proposals" },
          { label: proposal.title.length > 60 ? proposal.title.slice(0, 60) + "…" : proposal.title },
        ]} />

        <Link href="/proposals" className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0B6BCB] transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Proposals
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card border border-[#E2E8F0] p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide", priorityBadge(proposal.priority))}>
              {proposal.priority} priority
            </span>
            <span className={cn("px-2.5 py-1 rounded text-xs font-semibold", statusInfo.cls)}>{statusInfo.label}</span>
            {proposal.legal_review_required && (
              <span className="px-2.5 py-1 rounded text-xs font-semibold bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30 flex items-center gap-1">
                <Scale className="w-3 h-3" /> Legal Review Required
              </span>
            )}
          </div>

          <h1 className="font-display text-2xl font-bold text-[#1A2332] leading-snug">{proposal.title}</h1>

          <div className="flex flex-wrap gap-4 text-xs text-[#64748B]">
            {proposal.department && (
              <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {proposal.department}</span>
            )}
            {proposal.created_at && (
              <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Created {new Date(proposal.created_at).toLocaleDateString("en-US")}</span>
            )}
            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Initiated by {proposal.initiated_by || "unknown"}</span>
          </div>
        </motion.div>

        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30">
          <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0" />
          <span className="text-xs text-[#B45309] dark:text-amber-400">Research Prototype - Not for Clinical Use.</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#E2E8F0]">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg border-b-2 -mb-px",
                  activeTab === tab.id ? "text-[#0B6BCB] border-[#0B6BCB]" : "text-[#64748B] border-transparent hover:text-[#0B6BCB]"
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            )
          })}
        </div>

        <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "overview" && <OverviewTab proposal={proposal} />}
          {activeTab === "votes" && <VotesTab proposal={proposal} onVoteCast={setProposal} />}
          {activeTab === "timeline" && <TimelineTab proposal={proposal} />}
        </motion.div>
      </div>
    </AppShell>
  )
}
