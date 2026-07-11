"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  ChevronRight,
  BarChart3,
  Download,
  ExternalLink,
  Activity,
  ShieldCheck,
  Users,
  BookOpen,
  GraduationCap,
  Scale,
  ClipboardList,
  Zap,
  CheckCheck,
  Vote,
  FileCheck,
} from "lucide-react"
import { useRole } from "@/lib/role-context"
import AppShell from "@/components/layout/app-shell"
import { FirstRunDemo } from "@/components/layout/first-run-demo"
import {
  MOCK_SOPS,
  MOCK_COMPLIANCE,
  MOCK_TRAINING,
  MOCK_LEGAL,
  MOCK_PROPOSALS,
  MOCK_EVIDENCE_WATCH,
  DEMO_USERS,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { RiskLevel, SOPStatus, ProposalStatus } from "@/lib/governance-types"
import Link from "next/link"

// ─── Helper Components ───────────────────────────────────────────────────────

interface StatTileProps {
  label: string
  value: string | number
  trend?: "up" | "down" | "neutral"
  color?: "teal" | "amber" | "red" | "violet" | "emerald" | "blue" | "pink" | "gray" | "green"
  icon?: React.ComponentType<{ className?: string }>
}

const TILE_BORDER: Record<string, string> = {
  teal: "border-l-[#0B6BCB]",
  amber: "border-l-[#B45309]",
  red: "border-l-[#B91C1C]",
  violet: "border-l-[#94A3B8]",
  emerald: "border-l-[#15803D]",
  blue: "border-l-[#0B6BCB]",
  pink: "border-l-[#94A3B8]",
  gray: "border-l-[#94A3B8]",
  green: "border-l-[#15803D]",
}

const TILE_VALUE: Record<string, string> = {
  teal: "text-[#0B6BCB]",
  amber: "text-[#B45309] dark:text-amber-400",
  red: "text-[#B91C1C] dark:text-red-400",
  violet: "text-muted-foreground",
  emerald: "text-[#15803D] dark:text-green-400",
  blue: "text-[#0B6BCB]",
  pink: "text-muted-foreground",
  gray: "text-muted-foreground",
  green: "text-[#15803D] dark:text-green-400",
}

function StatTile({ label, value, trend, color = "teal", icon: Icon }: StatTileProps) {
  return (
    <div
      className={cn(
"bg-card border border-border shadow-sm rounded-xl p-4 border-l-4",
        TILE_BORDER[color]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">{label}</p>
          <p className={cn("text-2xl font-bold font-display", TILE_VALUE[color])}>{value}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {Icon && <Icon className={cn("w-5 h-5 opacity-50", TILE_VALUE[color])} />}
          {trend === "up" && <TrendingUp className="w-4 h-4 text-[#0B6BCB]" />}
          {trend === "down" && <TrendingDown className="w-4 h-4 text-[#B91C1C] dark:text-red-400" />}
        </div>
      </div>
    </div>
  )
}

const STATUS_BADGE: Record<SOPStatus, string> = {
  approved: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
  needs_update: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
  draft: "bg-card text-muted-foreground border-input",
  under_review: "bg-card text-muted-foreground border-input",
  archived: "bg-card text-muted-foreground border-input",
  on_hold: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
}

const PROPOSAL_STATUS_BADGE: Record<ProposalStatus, string> = {
  draft: "bg-card text-muted-foreground border-input",
  submitted: "bg-card text-muted-foreground border-input",
  evidence_review: "bg-card text-muted-foreground border-input",
  department_review: "bg-card text-muted-foreground border-input",
  committee_review: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
  legal_review: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
  training_review: "bg-card text-muted-foreground border-input",
  approved: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
  rejected: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30",
  published: "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30",
  archived: "bg-card text-muted-foreground border-input",
}

const RISK_BADGE: Record<RiskLevel, string> = {
  critical: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30",
  high: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
  medium: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
  low: "bg-card text-muted-foreground border-input",
}

function SopCard({ sop }: { sop: typeof MOCK_SOPS[0] }) {
  return (
    <Link
      href={`/library/${sop.id}`}
      className="block bg-muted border border-border rounded-lg p-4 hover:border-[#0B6BCB]/30 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground font-mono mb-1">{sop.sop_id}</p>
          <p className="text-[13px] font-semibold text-foreground group-hover:text-[#0B6BCB] transition-colors line-clamp-2">
            {sop.title}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-subtle group-hover:text-[#0B6BCB] shrink-0 mt-1 transition-colors" />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
"text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
            STATUS_BADGE[sop.status]
          )}
        >
          {sop.status.replace("_", " ")}
        </span>
        <span className="text-[10px] text-muted-foreground">{sop.department}</span>
        <span className="text-[10px] text-subtle">v{sop.version}</span>
      </div>
    </Link>
  )
}

function QuickLookup() {
  const [query, setQuery] = useState("")
  const router = useRouter()
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) router.push(`/query?q=${encodeURIComponent(query.trim())}`)
  }
  return (
    <div className="bg-card border border-border shadow-sm rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-[#0B6BCB]" />
        <h3 className="text-[13px] font-semibold text-foreground">Quick Lookup</h3>
      </div>
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about a protocol or procedure..."
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-subtle focus:outline-none focus:border-[#0B6BCB]/50 focus:ring-1 focus:ring-[#0B6BCB]/20"
        />
        <button
          type="submit"
          className="px-3 py-2 bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] rounded-lg text-[13px] font-semibold hover:bg-[#0B6BCB]/25 transition-colors"
        >
          Ask
        </button>
      </form>
    </div>
  )
}

function AiBanner() {
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 rounded-lg">
      <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
      <p className="text-[11px] text-[#B45309] dark:text-amber-400/90 leading-relaxed">
        Verify against the current approved hospital policy before acting.
      </p>
    </div>
  )
}

// ─── Wins Stat ─────────────────────────────────────────────────────────────

interface AdoptionStats {
  queries_this_week: number
  estimated_minutes_saved: number
  illustrative: boolean
}

const FALLBACK_ADOPTION_STATS: AdoptionStats = {
  queries_this_week: 42,
  estimated_minutes_saved: 480,
  illustrative: true,
}

function WinsStat() {
  const [stats, setStats] = useState<AdoptionStats>(FALLBACK_ADOPTION_STATS)

  useEffect(() => {
    let cancelled = false
    const base = process.env.NEXT_PUBLIC_API_URL || ""
    fetch(`${base}/api/analytics/adoption`)
      .then((res) => {
        if (!res.ok) throw new Error("adoption analytics unavailable")
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        if (typeof data?.queries_total === "number" || typeof data?.queries_this_week === "number") {
          setStats({
            queries_this_week: data.queries_this_week ?? data.queries_total ?? FALLBACK_ADOPTION_STATS.queries_this_week,
            estimated_minutes_saved: data.estimated_minutes_saved ?? FALLBACK_ADOPTION_STATS.estimated_minutes_saved,
            illustrative: false,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setStats(FALLBACK_ADOPTION_STATS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hours = Math.round((stats.estimated_minutes_saved / 60) * 10) / 10

  return (
    <div className="bg-card border border-[#0B6BCB]/20 shadow-sm rounded-xl p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
        <TrendingUp className="w-4 h-4 text-[#0B6BCB]" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-foreground">
          <span className="font-semibold">This week: </span>
          Meridian answered <span className="font-semibold text-[#0B6BCB]">{stats.queries_this_week}</span> questions,
          saving an estimated <span className="font-semibold text-[#0B6BCB]">{hours}</span> hours
        </p>
        {stats.illustrative && (
          <p className="text-[11px] text-subtle mt-0.5">Illustrative example</p>
        )}
      </div>
    </div>
  )
}

// ─── Role Views ───────────────────────────────────────────────────────────────

function PhysicianDashboard() {
  const proposal = MOCK_PROPOSALS.find((p) => p.id === "prop-001")
  const evidenceAlert = MOCK_EVIDENCE_WATCH[0]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="SOPs in Specialty" value={12} color="teal" icon={BookOpen} trend="neutral" />
        <StatTile label="Evidence Alerts" value={2} color="amber" icon={AlertTriangle} />
        <StatTile label="Open Proposals" value={3} color="gray" icon={FileText} />
        <StatTile label="Training Due" value={1} color="red" icon={GraduationCap} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recently Updated SOPs */}
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Recently Updated SOPs
          </h3>
          {MOCK_SOPS.slice(0, 2).map((sop) => (
            <SopCard key={sop.id} sop={sop} />
          ))}
        </div>

        <div className="space-y-4">
          {/* Evidence Watch Alert */}
          <div className="space-y-3">
            <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
              Evidence Watch
            </h3>
            {evidenceAlert && (
              <Link
                href="/evidence-watch"
                className="block bg-muted border border-[#FDE68A] dark:border-amber-500/30 rounded-lg p-4 hover:border-[#FDE68A] dark:border-amber-500/30 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-foreground mb-1">{evidenceAlert.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{evidenceAlert.summary}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30 uppercase">
                        {evidenceAlert.impact_level}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{evidenceAlert.source_name}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* Quick Lookup */}
          <QuickLookup />
        </div>
      </div>

      {/* My Open Proposals */}
      {proposal && (
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            My Open Proposals
          </h3>
          <Link
            href={`/proposals/${proposal.id}`}
            className="block bg-card border border-border rounded-xl p-4 hover:border-[#0B6BCB]/30 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground group-hover:text-[#0B6BCB] transition-colors mb-1">
                  {proposal.title}
                </p>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{proposal.ai_summary}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
"text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
                      PROPOSAL_STATUS_BADGE[proposal.status]
                    )}
                  >
                    {proposal.status.replace("_", " ")}
                  </span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize", RISK_BADGE[proposal.priority])}>
                    {proposal.priority}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-subtle group-hover:text-[#0B6BCB] shrink-0 mt-1 transition-colors" />
            </div>
          </Link>
        </div>
      )}
    </div>
  )
}

function NurseDashboard() {
  const { currentUser } = useRole()
  // ── Acknowledgment state - persisted via /api/governance/acknowledgments,
  // shared with the library page since both read the same backend records ──
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set())
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || ""
    fetch(`${base}/api/governance/acknowledgments?user_id=${encodeURIComponent(currentUser.name)}&limit=500`)
      .then((r) => r.json())
      .then((data) => {
        const rows: { sop_id: string }[] = Array.isArray(data?.acknowledgments) ? data.acknowledgments : []
        setAcknowledged(new Set(rows.map((r) => r.sop_id)))
      })
      .catch(() => setAcknowledged(new Set()))
  }, [currentUser.name])

  const acknowledgeFromDashboard = async (sopId: string, sopTitle: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || ""
    setAcknowledged((prev) => new Set(prev).add(sopId))
    try {
      const res = await fetch(`${base}/api/governance/acknowledgments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sop_id: sopId, user_id: currentUser.name, user_name: currentUser.name }),
      })
      if (!res.ok) throw new Error("Failed to record acknowledgment")
      setToastMessage(`Acknowledged: ${sopTitle}`)
      setTimeout(() => setToastMessage(null), 3000)
    } catch {
      setAcknowledged((prev) => {
        const next = new Set(prev)
        next.delete(sopId)
        return next
      })
      setToastMessage("Could not record acknowledgment - backend unreachable")
      setTimeout(() => setToastMessage(null), 3000)
    }
  }

  const requiresAckSOPs = MOCK_SOPS.filter((s) => s.compliance_acknowledgment_required)
  const pendingCount = requiresAckSOPs.filter(s => !acknowledged.has(s.sop_id)).length

  return (
    <div className="space-y-6 relative">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 text-[#15803D] dark:text-green-400 text-sm font-semibold shadow-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {toastMessage}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Acknowledgments Pending" value={pendingCount} color="amber" icon={CheckCheck} />
        <StatTile label="Training Overdue" value={2} color="red" icon={GraduationCap} />
        <StatTile label="Protocol Updates" value={5} color="teal" icon={FileText} trend="up" />
        <StatTile label="Alerts" value={1} color="amber" icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Protocols Requiring Acknowledgment
            {pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 text-[10px] font-bold">
                {pendingCount} pending
              </span>
            )}
          </h3>
          {requiresAckSOPs.slice(0, 3).map((sop) => {
            const isAcknowledged = acknowledged.has(sop.sop_id)
            return (
              <div
                key={sop.id}
                className="bg-muted border border-border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground font-mono mb-1">{sop.sop_id}</p>
                    <p className="text-[13px] font-semibold text-foreground line-clamp-2">{sop.title}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-subtle shrink-0 mt-1" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
"text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
                      STATUS_BADGE[sop.status]
                    )}
                  >
                    {sop.status.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{sop.department}</span>
                  <span className="text-[10px] text-subtle">v{sop.version}</span>
                </div>

                {/* Acknowledgment button / badge */}
                {isAcknowledged ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 text-xs text-[#15803D] dark:text-green-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                  </div>
                ) : (
                  <button
                    onClick={() => acknowledgeFromDashboard(sop.sop_id, sop.title)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0B6BCB]/40 text-xs text-[#0B6BCB] hover:bg-[#0B6BCB]/10 transition-colors"
                  >
                    <FileCheck className="w-3.5 h-3.5" /> Acknowledge
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            My Training
          </h3>
          {MOCK_TRAINING.slice(0, 2).map((tm) => (
            <div
              key={tm.id}
              className="bg-muted border border-border rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-foreground line-clamp-2">{tm.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{tm.department} · {tm.estimated_duration_minutes} min</p>
                </div>
                <span
                  className={cn(
"text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 capitalize",
                    tm.status === "completed"
                      ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30"
                      : tm.status === "overdue"
                      ? "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30"
                      : "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30"
                  )}
                >
                  {tm.status}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Completion</span>
                  <span>{tm.completion_rate}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
"h-full rounded-full",
                      tm.completion_rate >= 90 ? "bg-[#15803D]" : tm.completion_rate >= 60 ? "bg-[#0B6BCB]" : "bg-[#B45309]"
                    )}
                    style={{ width: `${tm.completion_rate}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <QuickLookup />
    </div>
  )
}

function DeptAdminDashboard() {
  const overdueSops = MOCK_SOPS.filter((s) => s.status === "needs_update")

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Dept SOPs" value={15} color="gray" icon={BookOpen} />
        <StatTile label="Overdue Reviews" value={3} color="red" icon={Clock} trend="down" />
        <StatTile label="Compliance Rate" value="84%" color="amber" icon={ShieldCheck} />
        <StatTile label="Open Proposals" value={2} color="teal" icon={FileText} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Department Compliance */}
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Department Compliance
          </h3>
          <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-muted-foreground font-semibold">Department</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-semibold">Score</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-semibold">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_COMPLIANCE.slice(0, 5).map((c) => (
                  <tr key={c.department} className="border-b border-border hover:bg-muted">
                    <td className="px-3 py-2 text-foreground">{c.department}</td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={cn(
"font-bold",
                          c.compliance_score >= 90
                            ? "text-[#15803D] dark:text-green-400"
                            : c.compliance_score >= 75
                            ? "text-[#B45309] dark:text-amber-400"
                            : "text-[#B91C1C] dark:text-red-400"
                        )}
                      >
                        {c.compliance_score}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-[#B91C1C] dark:text-red-400 font-semibold">
                      {c.overdue_reviews}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Overdue Reviews */}
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Overdue Reviews
          </h3>
          {overdueSops.map((sop) => (
            <SopCard key={sop.id} sop={sop} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ComplianceOfficerDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Overall Rate" value="84%" color="amber" icon={ShieldCheck} />
        <StatTile label="Staff Overdue" value={149} color="red" icon={Users} trend="down" />
        <StatTile label="Legal Flags" value={4} color="red" icon={Scale} />
        <StatTile label="Audit Events Today" value={12} color="teal" icon={Activity} trend="up" />
      </div>

      {/* Compliance Heatmap */}
      <div className="space-y-3">
        <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
          Compliance Heatmap
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {MOCK_COMPLIANCE.map((c) => (
            <div
              key={c.department}
              className={cn(
"bg-card border rounded-xl p-4",
                c.compliance_score >= 90
                  ? "border-[#BBF7D0] dark:border-green-500/30"
                  : c.compliance_score >= 75
                  ? "border-[#FDE68A] dark:border-amber-500/30"
                  : "border-[#FECACA] dark:border-red-500/30"
              )}
            >
              <p className="text-[11px] text-muted-foreground font-semibold mb-1">{c.department}</p>
              <p
                className={cn(
"text-xl font-bold font-display",
                  c.compliance_score >= 90
                    ? "text-[#15803D] dark:text-green-400"
                    : c.compliance_score >= 75
                    ? "text-[#B45309] dark:text-amber-400"
                    : "text-[#B91C1C] dark:text-red-400"
                )}
              >
                {c.compliance_score}%
              </p>
              <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
                <p>{c.overdue_acknowledgments} overdue acks</p>
                <p>{c.risk_flags} risk flag{c.risk_flags !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex">
        <button className="flex items-center gap-2 px-4 py-2 bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] rounded-lg text-[13px] font-semibold hover:bg-[#0B6BCB]/25 transition-colors">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>
    </div>
  )
}

function CommitteeDashboard() {
  const awaitingVote = MOCK_PROPOSALS.filter(
    (p) => p.status === "committee_review" || p.status === "legal_review"
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Awaiting Vote" value={2} color="amber" icon={Vote} />
        <StatTile label="Approved This Month" value={1} color="teal" icon={CheckCircle2} trend="up" />
        <StatTile label="Evidence Alerts" value={2} color="gray" icon={AlertTriangle} />
        <StatTile label="Proposals Total" value={MOCK_PROPOSALS.length} color="teal" icon={FileText} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Awaiting Your Review
          </h3>
          {MOCK_PROPOSALS.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/proposals/${proposal.id}`}
              className="block bg-muted border border-border rounded-lg p-4 hover:border-[#0B6BCB]/30 transition-colors group"
            >
              <div className="flex items-start gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-foreground group-hover:text-[#0B6BCB] transition-colors line-clamp-2 mb-1">
                    {proposal.title}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
"text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
                        PROPOSAL_STATUS_BADGE[proposal.status]
                      )}
                    >
                      {proposal.status.replace("_", " ")}
                    </span>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize", RISK_BADGE[proposal.priority])}>
                      {proposal.priority}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={(e) => e.preventDefault()}
                  className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 text-[#15803D] dark:text-green-400 hover:bg-[#BBF7D0] transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={(e) => e.preventDefault()}
                  className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 hover:bg-[#FECACA] transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={(e) => e.preventDefault()}
                  className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 hover:bg-[#FDE68A] transition-colors"
                >
                  Request Changes
                </button>
              </div>
            </Link>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Evidence Packets
          </h3>
          {MOCK_EVIDENCE_WATCH.slice(0, 3).map((ew) => (
            <div
              key={ew.id}
              className="bg-muted border border-border rounded-lg p-4"
            >
              <p className="text-[12px] font-semibold text-foreground mb-1 line-clamp-2">{ew.title}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
"text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase",
                    RISK_BADGE[ew.impact_level]
                  )}
                >
                  {ew.impact_level}
                </span>
                <span className="text-[10px] text-muted-foreground">{ew.source_name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LegalRiskDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Open Flags" value={MOCK_LEGAL.length} color="red" icon={Scale} />
        <StatTile label="Critical" value={MOCK_LEGAL.filter((l) => l.risk_classification === "critical").length} color="red" icon={AlertTriangle} />
        <StatTile label="Awaiting Review" value={MOCK_LEGAL.filter((l) => l.status === "under_review").length} color="amber" icon={Clock} />
        <StatTile label="Resolved" value={MOCK_LEGAL.filter((l) => l.status === "resolved").length} color="emerald" icon={CheckCircle2} trend="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Legal Issues Requiring Action
          </h3>
          {MOCK_LEGAL.map((item) => (
            <div
              key={item.id}
              className={cn(
"bg-muted border rounded-lg p-4",
                item.risk_classification === "critical"
                  ? "border-[#FECACA] dark:border-red-500/30"
                  : item.risk_classification === "high"
                  ? "border-[#FDE68A] dark:border-amber-500/30"
                  : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[12px] font-semibold text-foreground line-clamp-2">{item.sop_title}</p>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0", RISK_BADGE[item.risk_classification])}>
                  {item.risk_classification}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{item.description}</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-subtle capitalize">{item.issue_type.replace("_", " ")}</span>
                <span className="text-[10px] text-subtle">·</span>
                <span
                  className={cn(
"text-[10px] font-semibold capitalize",
                    item.status === "open" ? "text-[#B91C1C] dark:text-red-400" : item.status === "under_review" ? "text-[#B45309] dark:text-amber-400" : "text-[#15803D] dark:text-green-400"
                  )}
                >
                  {item.status.replace("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Proposals for Legal Review
          </h3>
          {MOCK_PROPOSALS.filter((p) => p.legal_review_required).map((proposal) => (
            <Link
              key={proposal.id}
              href={`/proposals/${proposal.id}`}
              className="block bg-muted border border-border rounded-lg p-4 hover:border-[#0B6BCB]/30 transition-colors group"
            >
              <p className="text-[12px] font-semibold text-foreground group-hover:text-[#0B6BCB] transition-colors line-clamp-2 mb-2">
                {proposal.title}
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{proposal.legal_impact}</p>
              <span
                className={cn(
"text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize",
                  PROPOSAL_STATUS_BADGE[proposal.status]
                )}
              >
                {proposal.status.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function NurseEducatorDashboard() {
  const totalAssigned = MOCK_TRAINING.reduce((s, t) => s + t.total_assigned, 0)
  const avgCompletion = Math.round(
    MOCK_TRAINING.reduce((s, t) => s + t.completion_rate, 0) / MOCK_TRAINING.length
  )
  const totalOverdue = MOCK_TRAINING.reduce((s, t) => s + t.overdue, 0)
  const totalCompleted = MOCK_TRAINING.reduce((s, t) => s + t.completed, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Active Modules" value={MOCK_TRAINING.filter((t) => t.status === "active").length} color="gray" icon={GraduationCap} />
        <StatTile label="Avg Completion" value={`${avgCompletion}%`} color="teal" icon={TrendingUp} trend="up" />
        <StatTile label="Overdue" value={totalOverdue} color="red" icon={Clock} trend="down" />
        <StatTile label="Completed" value={totalCompleted} color="emerald" icon={CheckCircle2} trend="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Training Modules
          </h3>
          {MOCK_TRAINING.map((tm) => (
            <div
              key={tm.id}
              className="bg-card border border-border shadow-sm rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground line-clamp-1 mb-1">{tm.title}</p>
                  <p className="text-[11px] text-muted-foreground">{tm.department} · {tm.format} · {tm.estimated_duration_minutes} min</p>
                </div>
                <span
                  className={cn(
"text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0",
                    tm.status === "completed"
                      ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30"
                      : tm.status === "overdue"
                      ? "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30"
                      : "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30"
                  )}
                >
                  {tm.status}
                </span>
              </div>
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Completion</span>
                  <span
                    className={cn(
"font-semibold",
                      tm.completion_rate >= 90
                        ? "text-[#15803D] dark:text-green-400"
                        : tm.completion_rate >= 70
                        ? "text-[#0B6BCB]"
                        : "text-[#B45309] dark:text-amber-400"
                    )}
                  >
                    {tm.completion_rate}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
"h-full rounded-full transition-all",
                      tm.completion_rate >= 90
                        ? "bg-[#15803D]"
                        : tm.completion_rate >= 70
                        ? "bg-[#0B6BCB]"
                        : "bg-[#B45309]"
                    )}
                    style={{ width: `${tm.completion_rate}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Total", value: tm.total_assigned, color: "text-subtle" },
                  { label: "Done", value: tm.completed, color: "text-[#15803D] dark:text-green-400" },
                  { label: "Active", value: tm.in_progress, color: "text-[#0B6BCB]" },
                  { label: "Overdue", value: tm.overdue, color: "text-[#B91C1C] dark:text-red-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-muted rounded-lg py-1.5">
                    <p className={cn("text-[14px] font-bold font-display", color)}>{value}</p>
                    <p className="text-[9px] text-subtle uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Department Summary
          </h3>
          <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-muted-foreground font-semibold">Dept</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_COMPLIANCE.map((c) => (
                  <tr key={c.department} className="border-b border-border hover:bg-muted">
                    <td className="px-3 py-2 text-foreground">{c.department}</td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={cn(
"font-bold",
                          c.training_completion_rate >= 90
                            ? "text-[#15803D] dark:text-green-400"
                            : c.training_completion_rate >= 75
                            ? "text-[#B45309] dark:text-amber-400"
                            : "text-[#B91C1C] dark:text-red-400"
                        )}
                      >
                        {c.training_completion_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface RawActivityEntry {
  id: number
  timestamp: string
  action: string
  sop_id: string
  sop_title: string
  user_name: string
  user_role: string
  department: string
  details: string
  query: string
  confidence: number
}

function summarizeActivity(entry: RawActivityEntry): string {
  switch (entry.action) {
    case "sop_created":
      return `Created SOP: ${entry.sop_title || entry.sop_id}`
    case "sop_updated":
      return `Updated SOP: ${entry.sop_title || entry.sop_id}`
    case "sop_archived":
      return `Archived SOP: ${entry.sop_title || entry.sop_id}`
    case "sop_deleted":
      return `Deleted SOP: ${entry.sop_title || entry.sop_id}${entry.details ? ` (${entry.details})` : ""}`
    case "sop_viewed":
      return `Viewed SOP: ${entry.sop_title || entry.sop_id}`
    case "query_submitted":
      return `Query: "${entry.query}"${entry.confidence ? ` (confidence ${Math.round(entry.confidence * 100)}%)` : ""}`
    case "source_clicked":
      return `Clicked source in ${entry.sop_title || entry.sop_id}`
    default:
      return entry.details || entry.action.replace(/_/g, " ")
  }
}

const ACTIVITY_ICON: Partial<Record<string, React.ComponentType<{ className?: string }>>> = {
  sop_created: FileText,
  sop_updated: BookOpen,
  sop_archived: ClipboardList,
  sop_deleted: ClipboardList,
  sop_viewed: BookOpen,
  query_submitted: Zap,
  source_clicked: ExternalLink,
  feedback_submitted: CheckCheck,
}

interface LlmStatus {
  provider: string
  model: string
  available: boolean
  mode: string
}

function SystemAdminDashboard() {
  const [sopCount, setSopCount] = useState<number | null>(null)
  const [chunkCount, setChunkCount] = useState<number | null>(null)
  const [activity, setActivity] = useState<RawActivityEntry[]>([])
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || ""
    let cancelled = false

    fetch(`${base}/api/sops`)
      .then((r) => {
        if (cancelled) return
        setBackendOnline(r.ok)
        return r.ok ? r.json() : null
      })
      .then((data) => {
        if (cancelled || !data) return
        const list = Array.isArray(data) ? data : (data.sops ?? data.items ?? [])
        setSopCount(list.length)
      })
      .catch(() => { if (!cancelled) setBackendOnline(false) })

    fetch(`${base}/api/evaluation/chunk-distribution`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setChunkCount(data?.total_chunks ?? null) })
      .catch(() => { if (!cancelled) setChunkCount(null) })

    fetch(`${base}/api/activity?limit=200`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setActivity(Array.isArray(data?.entries) ? data.entries : []) })
      .catch(() => { if (!cancelled) setActivity([]) })

    fetch(`${base}/api/llm/status`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setLlmStatus(data) })
      .catch(() => { if (!cancelled) setLlmStatus(null) })

    return () => { cancelled = true }
  }, [])

  const recentActivity = activity.slice(0, 5)

  const llmLabel = llmStatus
    ? llmStatus.mode === "mock"
      ? "Mock (no live LLM configured)"
      : `${llmStatus.provider} / ${llmStatus.model}`
    : "Checking..."
  const llmColor = llmStatus?.available ? "green" : "amber"

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Total SOPs" value={sopCount ?? "-"} color="teal" icon={BookOpen} />
        <StatTile label="Total Users" value={DEMO_USERS.length} color="teal" icon={Users} />
        <StatTile label="Corpus Chunks Indexed" value={chunkCount ?? "-"} color="gray" icon={Activity} />
        <StatTile label="Audit Events" value={activity.length} color="gray" icon={ClipboardList} trend="up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* System Health */}
        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            System Health
          </h3>
          <div className="space-y-2">
            {[
              { label: "Backend API", status: backendOnline === null ? "Checking..." : backendOnline ? "Online" : "Offline", color: backendOnline ? "green" as const : backendOnline === false ? "red" as const : "amber" as const },
              { label: "LLM Engine", status: llmLabel, color: llmColor as "green" | "amber" },
              { label: "Database", status: "SQLite (dev)", color: "teal" as const },
              { label: "Activity Logging", status: activity.length > 0 ? "Active" : "No events yet", color: activity.length > 0 ? "green" as const : "amber" as const },
            ].map(({ label, status, color }) => (
              <div
                key={label}
                className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2.5"
              >
                <span className="text-[12px] text-muted-foreground">{label}</span>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", `bg-${color}-400`)} />
                  <span className={cn("text-[11px] font-semibold", `text-${color}-400`)}>{status}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest mt-4">
            Quick Actions
          </h3>
          <div className="space-y-2">
            {[
              { href: "/admin", label: "Admin Panel", icon: Users },
              { href: "/audit", label: "Audit Log", icon: ClipboardList },
              { href: "/compliance", label: "Compliance Dashboard", icon: ShieldCheck },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border rounded-lg hover:border-[#0B6BCB]/30 transition-colors group"
              >
                <Icon className="w-4 h-4 text-[#0B6BCB]" />
                <span className="text-[12px] text-foreground group-hover:text-foreground transition-colors">{label}</span>
                <ChevronRight className="w-3.5 h-3.5 text-subtle group-hover:text-[#0B6BCB] ml-auto transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">
            Recent Activity
          </h3>
          <div className="space-y-2">
            {recentActivity.length === 0 && (
              <p className="text-[12px] text-subtle px-1">No activity logged yet this session.</p>
            )}
            {recentActivity.map((entry) => {
              const Icon = ACTIVITY_ICON[entry.action] ?? Activity
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 bg-card border border-border rounded-lg px-3 py-3"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#0B6BCB]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] text-foreground line-clamp-2">{summarizeActivity(entry)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-subtle">{entry.user_name}</span>
                      <span className="text-[10px] text-subtle">·</span>
                      <span className="text-[10px] text-subtle">
                        {new Date(entry.timestamp).toLocaleDateString("en-US")}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { role, currentUser, roleConfig } = useRole()

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  })()

  const ROLE_BADGE_COLORS: Record<typeof role, string> = {
    clinical_staff: "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30",
    governance_compliance: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
    educator: "bg-card text-muted-foreground border-input",
    system_admin: "bg-card text-muted-foreground border-input",
  }

  return (
    <AppShell>
    <div className="bg-background px-4 md:px-6 lg:px-8 py-6">
      <FirstRunDemo />
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground mb-1">
                {greeting}, {currentUser.name.split(" ")[0]}
                {currentUser.name.includes("Dr.") || currentUser.name.includes("Nurse") ? "" : ""}
              </h1>
              <p className="text-[13px] text-muted-foreground">{currentUser.title}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full border", ROLE_BADGE_COLORS[role])}>
                {roleConfig.label}
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-muted text-muted-foreground border-border">
                {currentUser.department}
              </span>
              <span className="text-[11px] text-subtle">
                {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
          </div>
          <AiBanner />
          <WinsStat />
        </div>

        {/* Leadership Overview shortcut */}
        {["system_admin", "governance_compliance"].includes(role) && (
          <Link
            href="/leadership"
            className="flex items-center gap-3 bg-card border border-[#0B6BCB]/30 rounded-xl px-4 py-3 hover:border-[#0B6BCB]/40 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-[#0B6BCB]" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground group-hover:text-[#0B6BCB] transition-colors">
                Leadership Overview
              </p>
              <p className="text-[11px] text-muted-foreground">
                Board scorecard, evidence freshness, quarterly activity
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-subtle group-hover:text-[#0B6BCB] ml-auto shrink-0 transition-colors" />
          </Link>
        )}

        {/* Role-specific content. clinical_staff merges the old
            physician+nurse views; governance_compliance merges the old
            department_admin+compliance_officer+committee_member+legal_risk
            views (stacked, not picked-one, so no workflow is lost). */}
        {role === "clinical_staff" && (
          <>
            <PhysicianDashboard />
            <NurseDashboard />
          </>
        )}
        {role === "educator" && <NurseEducatorDashboard />}
        {role === "governance_compliance" && (
          <>
            <DeptAdminDashboard />
            <CommitteeDashboard />
            <ComplianceOfficerDashboard />
            <LegalRiskDashboard />
          </>
        )}
        {role === "system_admin" && <SystemAdminDashboard />}
      </div>
    </div>
    </AppShell>
  )
}
