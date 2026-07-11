"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, Plus, Scale, Calendar, Building2, FileText, ChevronRight,
  Users, ClipboardList, Loader2, X,
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

// ── Real backend shapes (routes_governance.py) ──────────────────────────────

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

type ProposalFilter = "all" | "open" | "approved" | "rejected"

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    urgent: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    high: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    normal: "bg-card text-[#475569] border border-[#CBD5E1]",
    low: "bg-card text-[#475569] border border-[#CBD5E1]",
  }
  return map[priority] ?? map.normal
}

function statusBadgeInfo(status: Proposal["status"]) {
  const map: Record<string, { cls: string; label: string }> = {
    open: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30", label: "Open - Awaiting Votes" },
    approved: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30", label: "Approved" },
    rejected: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30", label: "Rejected" },
  }
  return map[status] ?? { cls: "bg-muted text-[#64748B]", label: status }
}

const FILTER_TABS: { value: ProposalFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
]

function ProposalCard({ proposal, index }: { proposal: Proposal; index: number }) {
  const approvalPct = proposal.quorum.committee_size > 0
    ? (proposal.tally.approve / proposal.quorum.committee_size) * 100
    : 0
  const statusInfo = statusBadgeInfo(proposal.status)

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
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide", priorityBadge(proposal.priority))}>
            {proposal.priority} priority
          </span>
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", statusInfo.cls)}>
            {statusInfo.label}
          </span>
        </div>

        <h3 className="font-display text-base font-bold text-[#1A2332] leading-snug">
          {proposal.title}
        </h3>

        {proposal.affected_sop_id && (
          <div className="flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-[#0B6BCB] shrink-0 mt-0.5" />
            <span className="text-xs">
              <span className="text-[#64748B]">Affected SOP: </span>
              <span className="text-[#0B6BCB] font-medium">{proposal.affected_sop_id}</span>
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-[#64748B]">
          {proposal.department && (
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3 h-3" />
              {proposal.department}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            Initiated by {proposal.initiated_by || "unknown"}
            {proposal.created_at && ` on ${new Date(proposal.created_at).toLocaleDateString("en-US")}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-[#E2E8F0] text-xs text-[#64748B]">
            <Users className="w-3 h-3" />
            {proposal.tally.approve} approve · {proposal.tally.reject} reject · {proposal.tally.abstain} abstain
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted border border-[#E2E8F0] text-xs text-[#64748B]">
            {proposal.quorum.votes_cast} / {proposal.quorum.threshold} votes for quorum
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="w-full h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0B6BCB] to-[#16A34A] transition-all"
              style={{ width: `${Math.min(approvalPct, 100)}%` }}
            />
          </div>
        </div>

        {proposal.ai_summary && (
          <p className="text-sm text-[#64748B] line-clamp-2 leading-relaxed">
            {proposal.ai_summary}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#EDF1F5]">
          <Link
            href={`/proposals/${proposal.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-xs text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors"
          >
            View <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

function NewProposalModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Proposal) => void }) {
  const { currentUser } = useRole()
  const [title, setTitle] = useState("")
  const [department, setDepartment] = useState("")
  const [affectedSopId, setAffectedSopId] = useState("")
  const [priority, setPriority] = useState("normal")
  const [aiSummary, setAiSummary] = useState("")
  const [legalReview, setLegalReview] = useState(false)
  const [showTextChange, setShowTextChange] = useState(false)
  const [oldText, setOldText] = useState("")
  const [newText, setNewText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    setError("")
    try {
      const payload: Record<string, string> = {}
      if (newText.trim()) payload.new_text = newText.trim()
      if (oldText.trim()) payload.old_text = oldText.trim()
      const res = await fetch(`${API_BASE}/api/governance/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          department,
          affected_sop_id: affectedSopId,
          priority,
          ai_summary: aiSummary,
          legal_review_required: legalReview,
          initiated_by: currentUser.name,
          payload,
        }),
      })
      if (!res.ok) throw new Error("Failed to create proposal")
      const created: Proposal = await res.json()
      onCreated(created)
      onClose()
    } catch {
      setError("Could not create the proposal. Is the backend running?")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-card border border-[#E2E8F0] rounded-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1A2332]">New Proposal</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[#64748B]">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-background text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#64748B]">Department</label>
              <input value={department} onChange={(e) => setDepartment(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#64748B]">Affected SOP ID</label>
              <input value={affectedSopId} onChange={(e) => setAffectedSopId(e.target.value)} placeholder="e.g. SOP-ICU-001"
                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-background text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B]">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-background text-sm">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#64748B]">Summary / Rationale</label>
            <textarea value={aiSummary} onChange={(e) => setAiSummary(e.target.value)} rows={3}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-background text-sm" />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#64748B]">
            <input type="checkbox" checked={legalReview} onChange={(e) => setLegalReview(e.target.checked)} />
            Requires legal review
          </label>
          <div className="pt-1 border-t border-[#EDF1F5]">
            <button type="button" onClick={() => setShowTextChange((v) => !v)}
              className="text-xs font-medium text-[#0B6BCB] hover:underline">
              {showTextChange ? "Hide" : "+ Add"} specific text change (for redline review)
            </button>
            {showTextChange && (
              <div className="mt-2 space-y-2">
                <div>
                  <label className="text-xs font-medium text-[#64748B]">Current text (optional - defaults to the affected SOP&apos;s current text)</label>
                  <textarea value={oldText} onChange={(e) => setOldText(e.target.value)} rows={3}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-background text-sm font-mono" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#64748B]">Proposed new text</label>
                  <textarea value={newText} onChange={(e) => setNewText(e.target.value)} rows={3}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-background text-sm font-mono" />
                </div>
              </div>
            )}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Proposal
          </button>
        </form>
      </motion.div>
    </div>
  )
}

export default function ProposalsPage() {
  const { hasPermission } = useRole()
  const [activeFilter, setActiveFilter] = useState<ProposalFilter>("all")
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/governance/proposals?limit=200`)
      .then((r) => r.json())
      .then((data) => setProposals(Array.isArray(data?.proposals) ? data.proposals : []))
      .catch(() => setProposals([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = proposals.filter((p) => activeFilter === "all" || p.status === activeFilter)

  const stats = [
    { label: "Total", value: proposals.length, color: "text-[#0B6BCB]" },
    { label: "Open", value: proposals.filter((p) => p.status === "open").length, color: "text-[#B45309] dark:text-amber-400" },
    { label: "Approved", value: proposals.filter((p) => p.status === "approved").length, color: "text-[#15803D] dark:text-green-400" },
    { label: "Rejected", value: proposals.filter((p) => p.status === "rejected").length, color: "text-[#B91C1C] dark:text-red-400" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Proposals" }]} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-[#0B6BCB]" />
              <h1 className="font-display text-3xl font-bold text-[#1A2332]">Update Proposals</h1>
            </div>
            <p className="text-[#64748B] text-sm pl-10">Live proposals and committee votes from the governance API.</p>
          </div>

          {hasPermission("create_proposal") && (
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> New Proposal
            </button>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30"
        >
          <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0" />
          <span className="text-xs text-[#B45309] dark:text-amber-400">
            Research Prototype - Not for Clinical Use. Quorum is {proposals[0]?.quorum.threshold ?? 3} votes out of a {proposals[0]?.quorum.committee_size ?? 5}-member committee.
          </span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-card border border-[#E2E8F0] p-4">
              <p className="text-xs text-[#64748B] mb-1">{label}</p>
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
                activeFilter === tab.value ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30" : "text-[#64748B] hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#64748B] gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading proposals...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl bg-card border border-[#E2E8F0] p-12 text-center">
              <ClipboardList className="w-8 h-8 text-[#64748B] mx-auto mb-3 opacity-40" />
              <p className="text-[#64748B] text-sm">No proposals match this filter.</p>
            </div>
          ) : (
            filtered.map((p, i) => <ProposalCard key={p.id} proposal={p} index={i} />)
          )}
        </div>
      </div>

      {showNewModal && (
        <NewProposalModal
          onClose={() => setShowNewModal(false)}
          onCreated={(p) => setProposals((prev) => [p, ...prev])}
        />
      )}
    </AppShell>
  )
}
