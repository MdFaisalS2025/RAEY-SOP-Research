"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, Scale, Calendar, Building2, FileText, Users, CheckCircle2,
  Check, X, MinusCircle, Vote, Gavel, ShieldAlert, Loader2, HelpCircle, PlusCircle,
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SafetyNote } from "@/components/ui/safety-note"
import { cn } from "@/lib/utils"
import { toneChip } from "@/components/ui/tone"
import { useRole } from "@/lib/role-context"
import { COMMITTEE_ROSTER } from "@/lib/mock-data"
import { AccessRestricted } from "@/components/ui/access-restricted"
import { priorityBadge, statusBadge } from "@/components/proposals/badges"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { Card } from "@/components/ui/card"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

interface GapCluster {
  representative_question: string
  count: number
  report_ids: number[]
  statuses: Record<string, number>
  most_common_department: string
  most_common_committee: string
  most_common_risk_level: string
  first_asked: string
  last_asked: string
}

const RISK_STYLE: Record<string, string> = {
  high: toneChip.danger,
  moderate: toneChip.warning,
  low: "bg-muted text-muted-foreground border-border",
}

// Surfaces what people keep asking that no SOP covers - each SOP Gap
// Report (created from the Ask page's no-SOP-found flow, see
// gap-report-panel.tsx) is one data point; clustered by question
// similarity here so a single recurring gap doesn't get lost among
// one-off questions, and a committee can see what's actually worth
// prioritizing a new SOP for.
function RecurringGapsWidget() {
  const [clusters, setClusters] = useState<GapCluster[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = () => {
    setLoading(true)
    setLoadError(false)
    fetch(`${API_BASE}/api/sop-gap-reports/summary`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setClusters(Array.isArray(data?.clusters) ? data.clusters : []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading recurring gaps...
      </div>
    )
  }

  if (loadError) {
    return <ErrorState message="Couldn't load recurring gaps." onRetry={load} />
  }

  const recurring = clusters.filter((c) => c.count >= 1).slice(0, 6)
  if (recurring.length === 0) {
    return (
      <EmptyState icon={HelpCircle} title="No unanswered questions have been flagged yet." />
    )
  }

  return (
    <div className="space-y-3">
      {recurring.map((c, i) => (
        <Card padding="sm" className="space-y-2.5" key={i}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-foreground leading-snug">{c.representative_question}</p>
            {c.count > 1 && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 text-11 font-semibold whitespace-nowrap">
                Asked {c.count}x
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {c.most_common_department && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                <Building2 className="w-3 h-3" /> {c.most_common_department}
              </span>
            )}
            <span className={cn("px-2 py-0.5 rounded-full border font-medium capitalize", RISK_STYLE[c.most_common_risk_level] ?? RISK_STYLE.moderate)}>
              {c.most_common_risk_level} risk
            </span>
            <span className="text-muted-foreground">Last asked {new Date(c.last_asked).toLocaleDateString()}</span>
          </div>
          <Link href={`/proposals?new=1&query=${encodeURIComponent(c.representative_question)}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline pt-1">
            <PlusCircle className="w-3.5 h-3.5" /> Draft a new SOP for this
          </Link>
        </Card>
      ))}
    </div>
  )
}

interface AutoGapCluster {
  representative_question: string
  count: number
  routes: Record<string, number>
  most_common_route: string
  first_asked: string
  last_asked: string
}

const ROUTE_LABEL: Record<string, string> = {
  no_evidence: "No evidence found",
  external_evidence: "External evidence only",
  clarification: "Needed clarification",
  unknown_prior_to_tracking: "Unanswered (older log)",
}

// Complements RecurringGapsWidget (manually flagged gap reports) with a
// signal that doesn't depend on a user noticing and clicking "flag to
// committee": every logged query the pipeline itself routed away from an
// SOP (no_evidence/external_evidence/clarification, or an outright
// abstention) is a real coverage-gap data point on its own. Manual
// flagging alone under-counts real gaps for exactly that reason.
function AutoDetectedGapsWidget() {
  const [clusters, setClusters] = useState<AutoGapCluster[]>([])
  const [totals, setTotals] = useState<{ unanswered: number; logged: number; days: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = () => {
    setLoading(true)
    setLoadError(false)
    fetch(`${API_BASE}/api/sop-gap-reports/auto-detected?days=30`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => {
        setClusters(Array.isArray(data?.clusters) ? data.clusters : [])
        setTotals({
          unanswered: data?.total_unanswered ?? 0,
          logged: data?.total_logged_queries ?? 0,
          days: data?.window_days ?? 30,
        })
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading auto-detected gaps...
      </div>
    )
  }

  if (loadError) {
    return <ErrorState message="Couldn't load auto-detected gaps." onRetry={load} />
  }

  return (
    <div className="space-y-3">
      {totals && (
        <p className="text-xs text-muted-foreground">
          {totals.unanswered} of {totals.logged} logged questions in the last {totals.days} days landed
          outside the SOP library, whether or not anyone flagged them.
        </p>
      )}
      {clusters.length === 0 ? (
        <EmptyState icon={HelpCircle} title="No auto-detected gaps in this window." />
      ) : (
        clusters.slice(0, 6).map((c, i) => (
          <Card padding="sm" className="space-y-2.5" key={i}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-foreground leading-snug">{c.representative_question}</p>
              {c.count > 1 && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 text-11 font-semibold whitespace-nowrap">
                  Asked {c.count}x
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                {ROUTE_LABEL[c.most_common_route] ?? c.most_common_route}
              </span>
              <span className="text-muted-foreground">Last asked {new Date(c.last_asked).toLocaleDateString()}</span>
            </div>
            <Link href={`/proposals?new=1&query=${encodeURIComponent(c.representative_question)}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline pt-1">
              <PlusCircle className="w-3.5 h-3.5" /> Draft a new SOP for this
            </Link>
          </Card>
        ))
      )}
    </div>
  )
}

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
  created_at: string | null
  tally: { approve: number; reject: number; abstain: number; request_changes: number; total: number }
  quorum: { threshold: number; committee_size: number; votes_cast: number; reached: boolean; decision: string }
  votes: { id: number; user_id: string; user_name: string; vote: string; notes: string; created_at: string }[]
}

function QuorumIndicator({ proposal }: { proposal: Proposal }) {
  const { threshold, committee_size, votes_cast, decision } = proposal.quorum
  const pct = committee_size > 0 ? (votes_cast / threshold) * 100 : 0

  return (
    <div className="space-y-3 p-4 rounded-xl bg-muted border border-border">
      <div className="flex gap-4 text-xs flex-wrap">
        <span className="flex items-center gap-1 text-[#15803D] dark:text-green-400 font-semibold">
          <Check className="w-3 h-3" /> Approve: {proposal.tally.approve}
        </span>
        <span className="flex items-center gap-1 text-[#B91C1C] dark:text-red-400 font-semibold">
          <X className="w-3 h-3" /> Reject: {proposal.tally.reject}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground font-semibold">
          <MinusCircle className="w-3 h-3" /> Abstain: {proposal.tally.abstain}
        </span>
        <span className="flex items-center gap-1 text-[#B45309] dark:text-amber-400 font-semibold">
          <AlertTriangle className="w-3 h-3" /> Changes: {proposal.tally.request_changes}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Quorum: {votes_cast}/{threshold} votes cast</span>
          <span>{committee_size}-member committee</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>

      {decision === "approved" && (
        <div className={cn(toneChip.success, "flex items-center gap-2 px-3 py-2 rounded-lg")}>
          <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-green-400 shrink-0" />
          <span className="text-xs font-bold text-[#15803D] dark:text-green-400 uppercase tracking-wide">Quorum reached: Approved</span>
        </div>
      )}
      {decision === "rejected" && (
        <div className={cn(toneChip.danger, "flex items-center gap-2 px-3 py-2 rounded-lg")}>
          <X className="w-4 h-4 text-[#B91C1C] dark:text-red-400 shrink-0" />
          <span className="text-xs font-bold text-[#B91C1C] dark:text-red-400 uppercase tracking-wide">Quorum reached: Rejected</span>
        </div>
      )}
      {decision === "pending" && (
        <div className={cn(toneChip.warning, "flex items-center gap-2 px-3 py-2 rounded-lg")}>
          <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] dark:text-amber-400 shrink-0" />
          <span className="text-xs text-[#B45309] dark:text-amber-400">Quorum not yet met ({threshold} votes required)</span>
        </div>
      )}
    </div>
  )
}

function CommitteeProposalCard({ proposal, index, onVoteCast }: {
  proposal: Proposal
  index: number
  onVoteCast: (p: Proposal) => void
}) {
  const { currentUser, hasPermission } = useRole()
  const [submitting, setSubmitting] = useState(false)
  const statusInfo = statusBadge(proposal.status)
  const canVote = hasPermission("review_proposal") && proposal.status === "open"
  const myVote = proposal.votes.find((v) => v.user_name === currentUser.name)?.vote

  async function castVote(vote: string) {
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/governance/proposals/${proposal.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.name, user_name: currentUser.name, vote }),
      })
      if (res.ok) onVoteCast(await res.json())
    } catch {
      // best-effort - vote button stays available for retry
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="rounded-2xl bg-card border border-border overflow-hidden"
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
            {proposal.priority}
          </span>
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", statusInfo.cls)}>{statusInfo.label}</span>
        </div>

        <h3 className="text-sm font-bold text-foreground leading-snug">{proposal.title}</h3>

        {proposal.affected_sop_id && (
          <div className="flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span className="text-xs text-primary">{proposal.affected_sop_id}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {proposal.department && (
            <span className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {proposal.department}</span>
          )}
          {proposal.created_at && (
            <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Created {new Date(proposal.created_at).toLocaleDateString("en-US")}</span>
          )}
        </div>

        <QuorumIndicator proposal={proposal} />

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/proposals/${proposal.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <FileText className="w-3 h-3" /> View Detail
          </Link>
        </div>

        {canVote && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <button disabled={submitting} onClick={() => castVote("approve")}
              className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-11 transition-colors disabled:opacity-50",
                myVote === "approve" ? "bg-[#16A34A] border-[#16A34A] text-white font-bold" : cn(toneChip.success, "hover:bg-[#16A34A]/25"))}>
              <Check className="w-3 h-3" /> Approve{myVote === "approve" ? " ✓" : ""}
            </button>
            <button disabled={submitting} onClick={() => castVote("reject")}
              className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-11 transition-colors disabled:opacity-50",
                myVote === "reject" ? "bg-[#B91C1C] border-[#B91C1C] text-white font-bold" : cn(toneChip.danger, "hover:bg-[#FECACA]"))}>
              <X className="w-3 h-3" /> Reject{myVote === "reject" ? " ✓" : ""}
            </button>
            <button disabled={submitting} onClick={() => castVote("abstain")}
              className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-11 transition-colors disabled:opacity-50",
                myVote === "abstain" ? "bg-[#F59E0B] border-[#F59E0B] text-white font-bold" : cn(toneChip.warning, "hover:bg-[#F59E0B]/25"))}>
              <MinusCircle className="w-3 h-3" /> Abstain{myVote === "abstain" ? " ✓" : ""}
            </button>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground self-center" />}
          </div>
        )}
      </div>
    </motion.div>
  )
}

const committeeUsers = COMMITTEE_ROSTER

export default function CommitteePage() {
  const { role } = useRole()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const loadProposals = () => {
    setLoading(true)
    setLoadError(false)
    fetch(`${API_BASE}/api/governance/proposals?limit=200`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setProposals(Array.isArray(data?.proposals) ? data.proposals : []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }
  useEffect(loadProposals, [])

  function handleVoteCast(updated: Proposal) {
    setProposals((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  const activeProposals = proposals.filter((p) => p.status === "open")
  const decidedProposals = proposals.filter((p) => p.status === "approved" || p.status === "rejected")
  const votedThisSession = new Set(activeProposals.flatMap((p) => p.votes.map((v) => v.user_name))).size

  const quorumThreshold = proposals[0]?.quorum.threshold ?? 3
  const committeeSize = proposals[0]?.quorum.committee_size ?? 5

  const stats = [
    { label: "Awaiting Vote", value: activeProposals.length, color: "text-muted-foreground", icon: Vote },
    { label: "Distinct Voters Active", value: votedThisSession, color: "text-[#15803D] dark:text-green-400", icon: CheckCircle2 },
    { label: "Decided Proposals", value: decidedProposals.length, color: "text-primary", icon: Calendar },
    { label: "Quorum Threshold", value: `${quorumThreshold}/${committeeSize}`, color: "text-[#B45309] dark:text-amber-400", isText: true, icon: Users },
  ]

  if (role !== "governance_compliance" && role !== "system_admin") {
    return <AccessRestricted label="Committee" requirement="This area requires Governance & Compliance access." />
  }

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <Breadcrumb items={[{ label: "Committee" }]} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <div className="flex items-center gap-3">
            <Gavel className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Committee Workspace</h1>
          </div>
          <p className="text-muted-foreground text-sm pl-10">Live proposals and quorum status from the governance API.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="flex items-center justify-between gap-2 flex-wrap"
        >
          <span className="text-xs text-muted-foreground">Votes are persisted to the backend and affect real quorum outcomes.</span>
          <SafetyNote />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, color, isText, icon: Icon }) => (
            <Card padding="sm" className="space-y-2" key={label}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
                <Icon className={cn("w-4 h-4", color)} />
              </div>
              <p className={cn("font-bold font-display", color, isText ? "text-lg" : "text-3xl")}>{value}</p>
            </Card>
          ))}
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading committee data...
          </div>
        ) : loadError ? (
          <ErrorState message="Couldn't load committee data." onRetry={loadProposals} />
        ) : (
          <div className="grid xl:grid-cols-[1fr_320px] gap-8">
            <div className="space-y-8">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Vote className="w-5 h-5 text-primary" /> Proposals Awaiting Review
                  </h2>
                  <span className="px-2.5 py-1 rounded-full bg-muted border border-input text-xs text-foreground font-semibold">
                    {activeProposals.length} active
                  </span>
                </div>

                {activeProposals.length === 0 ? (
                  <EmptyState icon={Vote} title="No proposals currently awaiting review." />
                ) : (
                  activeProposals.map((p, i) => (
                    <CommitteeProposalCard key={p.id} proposal={p} index={i} onVoteCast={handleVoteCast} />
                  ))
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" /> Recurring Unanswered Questions
                </h2>
                <p className="text-xs text-muted-foreground -mt-2">
                  Sourced from SOP Gap Reports (created when Ask Meridian finds no matching internal SOP) - clustered by question similarity.
                </p>
                <RecurringGapsWidget />
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-primary" /> Auto-Detected Coverage Gaps
                </h2>
                <p className="text-xs text-muted-foreground -mt-2">
                  Sourced automatically from every logged question the pipeline routed away from the SOP
                  library - independent of whether anyone manually flagged it.
                </p>
                <AutoDetectedGapsWidget />
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#15803D] dark:text-green-400" /> Recent Decisions
                </h2>

                {decidedProposals.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="No decided proposals yet." />
                ) : (
                  <div className="space-y-3">
                    {decidedProposals.map((p, i) => {
                      const info = statusBadge(p.status)
                      return (
                        <motion.div
                          key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                          className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border"
                        >
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", p.status === "approved" ? "bg-[#16A34A]/20" : "bg-[#DC2626]/20")}>
                            {p.status === "approved" ? <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-green-400" /> : <X className="w-4 h-4 text-[#B91C1C] dark:text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <Link href={`/proposals/${p.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-1">
                              {p.title}
                            </Link>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{p.department || "No department"}</span>
                              <span>·</span>
                              <span>Initiated by {p.initiated_by || "unknown"}</span>
                            </div>
                          </div>
                          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold shrink-0", info.cls)}>{info.label}</span>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" /> Committee Members
                </h2>
                <p className="text-xs text-muted-foreground -mt-2">
                  Illustrative roster - Meridian has no committee-membership model yet. Each member&apos;s vote status
                  below is real, matched against the live proposal votes above by name.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {committeeUsers.map((user, i) => {
                    const hasVoted = proposals.some((p) => p.votes.some((v) => v.user_name === user.name))
                    return (
                      <motion.div
                        key={user.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                        className="rounded-xl bg-card border border-border p-4 flex items-start gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                          {user.initials}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.title}</p>
                          <p className="text-xs text-muted-foreground">{user.department}</p>
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-10 font-semibold mt-1",
                            hasVoted ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400" : "bg-muted text-muted-foreground")}>
                            {hasVoted ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Vote className="w-2.5 h-2.5" />}
                            {hasVoted ? "Has voted" : "No votes yet"}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <Card className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#B45309] dark:text-amber-400" />
                  <h3 className="text-sm font-bold text-foreground">Quorum Rules</h3>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>Threshold: <span className="font-semibold text-foreground">{quorumThreshold} votes</span> out of a <span className="font-semibold text-foreground">{committeeSize}-member</span> committee.</p>
                  <p>A proposal auto-resolves to Approved or Rejected once quorum is reached, based on whether approve votes outnumber reject + request-changes votes.</p>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
