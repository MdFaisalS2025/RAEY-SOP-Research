"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  AlertTriangle, Scale, Calendar, Building2, FileText, Users, CheckCircle2,
  XCircle, Clock, ChevronLeft, Gavel, History, Check, X, MinusCircle, Loader2,
  GitCompare,
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SafetyNote } from "@/components/ui/safety-note"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"
import { DiffView, DiffStatsRow, type DiffSegment, type DiffStats } from "@/components/governance/diff-view"

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
  scheduled_effective_date: string
  effective_status: "pending" | "effective" | null
  created_at: string | null
  tally: { approve: number; reject: number; abstain: number; request_changes: number; total: number }
  quorum: { threshold: number; committee_size: number; votes_cast: number; reached: boolean; decision: string }
  votes: { id: number; user_id: string; user_name: string; vote: string; notes: string; created_at: string }[]
}

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    urgent: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    high: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    normal: "bg-card text-muted-foreground border border-input",
    low: "bg-card text-muted-foreground border border-input",
  }
  return map[priority] ?? map.normal
}

function statusBadge(status: Proposal["status"]) {
  const map: Record<string, { cls: string; label: string }> = {
    open: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30", label: "Open - Awaiting Votes" },
    approved: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30", label: "Approved" },
    rejected: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30", label: "Rejected" },
  }
  return map[status] ?? { cls: "bg-muted text-muted-foreground", label: status }
}

function voteBadge(vote: string) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    approve: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400", label: "Approved", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    reject: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400", label: "Rejected", icon: <XCircle className="w-3.5 h-3.5" /> },
    abstain: { cls: "bg-muted text-muted-foreground", label: "Abstained", icon: <MinusCircle className="w-3.5 h-3.5" /> },
    request_changes: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400", label: "Requested Changes", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  }
  return map[vote] ?? { cls: "bg-muted text-muted-foreground", label: vote, icon: null }
}

/** `new Date("2099-06-01")` parses as UTC midnight, so toLocaleDateString()
 * in any timezone behind UTC renders the day before - force local-midnight
 * parsing instead so a scheduled date never appears to shift. */
function formatIsoDateLocal(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US")
}

function EffectiveDateCard({ proposal, onUpdated }: { proposal: Proposal; onUpdated: (p: Proposal) => void }) {
  const { hasPermission } = useRole()
  const [date, setDate] = useState(proposal.scheduled_effective_date || "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function save(newDate: string) {
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE}/api/governance/proposals/${proposal.id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_effective_date: newDate }),
      })
      if (!res.ok) throw new Error("failed")
      const updated: Proposal = await res.json()
      onUpdated(updated)
      setDate(updated.scheduled_effective_date)
    } catch {
      setError("Could not update the effective date.")
    } finally {
      setSaving(false)
    }
  }

  const isPending = proposal.effective_status === "pending"
  const isEffective = proposal.effective_status === "effective"

  return (
    <div className={cn(
      "rounded-2xl border p-5 space-y-3",
      isPending ? "bg-[#FEF3C7]/40 dark:bg-amber-500/[0.06] border-[#FDE68A] dark:border-amber-500/30" : "bg-muted border-border"
    )}>
      <div className="flex items-center gap-2">
        <Calendar className={cn("w-4 h-4", isPending ? "text-[#B45309] dark:text-amber-400" : "text-[#0B6BCB]")} />
        <h3 className="text-sm font-semibold text-foreground">Effective Date</h3>
        {isEffective && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30">
            In effect
          </span>
        )}
        {isPending && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30">
            Approved - pending
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {isPending
          ? `Approved by committee, but scheduled to take effect on ${formatIsoDateLocal(proposal.scheduled_effective_date)} - not yet live. Committee vote and go-live date are tracked separately.`
          : isEffective && proposal.scheduled_effective_date
          ? `Took effect on ${formatIsoDateLocal(proposal.scheduled_effective_date)}.`
          : isEffective
          ? "Effective immediately on approval (no deferred date was set)."
          : "Once approved, this change can be scheduled to take effect on a future date rather than immediately."}
      </p>
      {hasPermission("review_proposal") && proposal.status !== "rejected" && (
        <div className="flex items-center gap-2 pt-1">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm" />
          <button onClick={() => save(date)} disabled={saving || date === proposal.scheduled_effective_date}
            className="px-3 py-1.5 rounded-lg bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-40 text-white text-xs font-semibold">
            {saving ? "Saving..." : "Schedule"}
          </button>
          {proposal.scheduled_effective_date && (
            <button onClick={() => save("")} disabled={saving}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-40">
              Clear (effective immediately)
            </button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

interface ImpactReport {
  available: boolean
  reason?: string
  risk_level?: "low" | "elevated" | "critical"
  new_conflicts?: { entity: string; type: string; sop_a: string; value_a: string; sop_b: string; value_b: string; severity: string; message: string }[]
  stale_acknowledgments?: number
  stale_attestations?: number
  historical_citation_count?: number
  citation_scan_window?: number
  summary?: string
}

const RISK_STYLE: Record<string, string> = {
  low: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
  elevated: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
  critical: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30",
}

function ImpactAssessmentCard({ proposalId }: { proposalId: number }) {
  const [impact, setImpact] = useState<ImpactReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/governance/proposals/${proposalId}/impact`)
      .then((r) => r.json())
      .then(setImpact)
      .catch(() => setImpact({ available: false, reason: "Could not load the impact assessment." }))
      .finally(() => setLoading(false))
  }, [proposalId])

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Assessing change impact...</div>
  }
  if (!impact?.available) return null

  const conflicts = impact.new_conflicts ?? []

  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-[#0B6BCB]" />
        <h3 className="text-sm font-semibold text-foreground">Change Impact Assessment</h3>
        <span className={cn("ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border", RISK_STYLE[impact.risk_level ?? "low"])}>
          {impact.risk_level} risk
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{impact.summary}</p>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-muted border border-border p-3 text-center">
          <p className="text-xl font-bold text-foreground">{conflicts.length}</p>
          <p className="text-[11px] text-muted-foreground">New conflicts</p>
        </div>
        <div className="rounded-xl bg-muted border border-border p-3 text-center">
          <p className="text-xl font-bold text-foreground">{(impact.stale_acknowledgments ?? 0) + (impact.stale_attestations ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground">Staff to re-acknowledge</p>
        </div>
        <div className="rounded-xl bg-muted border border-border p-3 text-center">
          <p className="text-xl font-bold text-foreground">{impact.historical_citation_count ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">Recent query citations</p>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="space-y-2 pt-1">
          {conflicts.map((c, i) => (
            <div key={i} className="p-3 rounded-lg bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-xs">
              <p className="font-semibold text-[#B91C1C] dark:text-red-400">{c.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OverviewTab({ proposal }: { proposal: Proposal }) {
  return (
    <div className="space-y-6">
      {proposal.ai_summary && (
        <div className="rounded-2xl bg-muted border border-border p-5 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Summary / Rationale</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{proposal.ai_summary}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-muted border border-border p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Affected SOP</p>
          <p className="text-sm font-medium text-[#0B6BCB]">{proposal.affected_sop_id || "Not specified"}</p>
        </div>
        <div className="rounded-xl bg-muted border border-border p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Department</p>
          <p className="text-sm font-medium text-foreground">{proposal.department || "Not specified"}</p>
        </div>
      </div>

      <ImpactAssessmentCard proposalId={proposal.id} />

      {Object.keys(proposal.payload || {}).length > 0 && (
        <div className="rounded-xl bg-muted border border-border p-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Additional Details</p>
          <pre className="text-xs text-foreground whitespace-pre-wrap font-mono">{JSON.stringify(proposal.payload, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

interface DiffResponse {
  available: boolean
  reason?: string
  sop_title?: string
  segments: DiffSegment[]
  stats?: DiffStats
}

function RedlineTab({ proposalId }: { proposalId: string }) {
  const [diff, setDiff] = useState<DiffResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API_BASE}/api/governance/proposals/${proposalId}/diff`)
      .then((r) => r.json())
      .then(setDiff)
      .catch(() => setDiff({ available: false, reason: "Could not load the redline diff.", segments: [] }))
      .finally(() => setLoading(false))
  }, [proposalId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-12">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading redline...
      </div>
    )
  }

  if (!diff?.available) {
    return (
      <div className="rounded-2xl bg-muted border border-border p-8 text-center">
        <GitCompare className="w-8 h-8 text-subtle mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{diff?.reason ?? "No text change to compare for this proposal."}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {diff.sop_title && (
        <p className="text-xs text-muted-foreground">Comparing against the current text of <span className="font-medium text-foreground">{diff.sop_title}</span></p>
      )}
      {diff.stats && <DiffStatsRow stats={diff.stats} />}
      <DiffView segments={diff.segments} />
      <p className="text-[11px] text-subtle">Word-level diff. Underlined = added, strikethrough = removed.</p>
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
      <div className="rounded-xl bg-muted border border-border p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Quorum Progress</span>
          <span className="font-bold text-foreground">{proposal.quorum.votes_cast} / {proposal.quorum.threshold} votes to reach quorum</span>
        </div>
        <div className="w-full h-3 rounded-full bg-[#E2E8F0] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#0B6BCB] to-[#16A34A] transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center pt-1">
          <div><p className="text-lg font-bold text-[#15803D] dark:text-green-400">{proposal.tally.approve}</p><p className="text-[10px] text-muted-foreground uppercase">Approve</p></div>
          <div><p className="text-lg font-bold text-[#B91C1C] dark:text-red-400">{proposal.tally.reject}</p><p className="text-[10px] text-muted-foreground uppercase">Reject</p></div>
          <div><p className="text-lg font-bold text-muted-foreground">{proposal.tally.abstain}</p><p className="text-[10px] text-muted-foreground uppercase">Abstain</p></div>
          <div><p className="text-lg font-bold text-[#B45309] dark:text-amber-400">{proposal.tally.request_changes}</p><p className="text-[10px] text-muted-foreground uppercase">Changes</p></div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0B6BCB]" /> Votes Cast ({proposal.votes.length})
        </h3>
        {proposal.votes.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No votes yet.</p>}
        {proposal.votes.map((v) => {
          const info = voteBadge(v.vote)
          return (
            <div key={v.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted border border-border">
              <div className="w-9 h-9 rounded-full bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center text-[#0B6BCB] text-xs font-bold shrink-0">
                {v.user_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{v.user_name}</span>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ml-auto", info.cls)}>
                    {info.icon} {info.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString("en-US")}</p>
                {v.notes && <p className="text-xs text-muted-foreground italic">{v.notes}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {canVote && (
        <div className="space-y-2 pt-4 border-t border-border">
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted border border-input text-sm text-foreground hover:bg-[#E2E8F0] transition-colors disabled:opacity-50">
              <MinusCircle className="w-4 h-4" /> Abstain
            </button>
            {submitting && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground self-center" />}
          </div>
        </div>
      )}
      {!canVote && proposal.status !== "open" && (
        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
          This proposal has already reached a final decision ({proposal.status}) and is no longer open for votes.
        </p>
      )}
      {!canVote && proposal.status === "open" && role !== "governance_compliance" && (
        <p className="text-xs text-muted-foreground pt-4 border-t border-border">
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
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
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
                <div className="rounded-xl bg-muted border border-border p-4 space-y-1">
                  <p className="text-xs text-foreground">{entry.label}</p>
                  {entry.ts && <p className="text-xs text-muted-foreground">{new Date(entry.ts).toLocaleString("en-US")}</p>}
                </div>
              </div>
            </div>
          )
        })}
        {events.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No events yet.</p>}
      </div>
    </div>
  )
}

const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "redline", label: "Redline", icon: GitCompare },
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
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading proposal...
        </div>
      </AppShell>
    )
  }

  if (notFound || !proposal) {
    return (
      <AppShell>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Link href="/proposals" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#0B6BCB] transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Proposals
          </Link>
          <div className="rounded-2xl bg-card border border-border p-12 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">Proposal {id} was not found.</p>
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

        <Link href="/proposals" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#0B6BCB] transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Proposals
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card border border-border p-6 space-y-4">
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

          <h1 className="font-display text-2xl font-bold text-foreground leading-snug">{proposal.title}</h1>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {proposal.department && (
              <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {proposal.department}</span>
            )}
            {proposal.created_at && (
              <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Created {new Date(proposal.created_at).toLocaleDateString("en-US")}</span>
            )}
            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Initiated by {proposal.initiated_by || "unknown"}</span>
          </div>
        </motion.div>

        {proposal.status === "approved" && <EffectiveDateCard proposal={proposal} onUpdated={setProposal} />}

        <SafetyNote />

        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg border-b-2 -mb-px",
                  activeTab === tab.id ? "text-[#0B6BCB] border-[#0B6BCB]" : "text-muted-foreground border-transparent hover:text-[#0B6BCB]"
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            )
          })}
        </div>

        <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {activeTab === "overview" && <OverviewTab proposal={proposal} />}
          {activeTab === "redline" && <RedlineTab proposalId={id} />}
          {activeTab === "votes" && <VotesTab proposal={proposal} onVoteCast={setProposal} />}
          {activeTab === "timeline" && <TimelineTab proposal={proposal} />}
        </motion.div>
      </div>
    </AppShell>
  )
}
