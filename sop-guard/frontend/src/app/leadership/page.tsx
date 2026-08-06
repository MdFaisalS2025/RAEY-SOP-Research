"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ChevronRight,
  Download,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FlaskConical,
  Activity,
  Loader2,
  RotateCcw,
} from "lucide-react"
import { useRole } from "@/lib/role-context"
import AppShell from "@/components/layout/app-shell"
import { SafetyNote } from "@/components/ui/safety-note"
import { cn } from "@/lib/utils"
import { toneChip } from "@/components/ui/tone"

const LEADERSHIP_ROLES = [
  "system_admin",
  "governance_compliance",
]

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-13 font-semibold text-foreground uppercase tracking-widest">{title}</h2>
      {subtitle && <p className="text-11 text-subtle mt-0.5">{subtitle}</p>}
    </div>
  )
}

interface Sop { sop_id: string; title: string; department: string; review_date: string; effective_date: string }
interface ExceptionRow { id: number; sop_title: string; department: string; status: string; severity: string; date_reported: string | null }
interface ConflictEntry { sop_a?: string; sop_b?: string; entity?: string; description?: string; [k: string]: unknown }
interface Proposal { id: number; title: string; status: string; department: string }

// This page previously rendered fixed sample figures (a 84% compliance
// rate, a 0.9 CLABSI rate, etc.) styled identically to a live board report -
// the highest-risk kind of "looks real" surface in the app, since it's the
// one screen built for people making decisions from it. Everything below is
// now derived from real backend data (SOPs, conflicts, exceptions,
// attestations, activity, proposals). Metrics Meridian has no way to
// measure - clinical outcomes like CLABSI rate or sepsis bundle adherence -
// are not shown at all rather than invented; a placeholder board KPI is
// worse than an absent one.
export default function LeadershipPage() {
  const { role, roleConfig } = useRole()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sops, setSops] = useState<Sop[]>([])
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([])
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([])
  const [attestationCount, setAttestationCount] = useState(0)
  const [activityCount, setActivityCount] = useState(0)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [exportState, setExportState] = useState<"idle" | "done">("idle")

  const load = () => {
    setLoading(true)
    setError(false)
    Promise.all([
      fetch("/api/sops").then((r) => { if (!r.ok) throw new Error(); return r.json() }),
      fetch("/api/conflicts/graph").then((r) => { if (!r.ok) throw new Error(); return r.json() }),
      fetch("/api/exceptions?limit=500").then((r) => { if (!r.ok) throw new Error(); return r.json() }),
      fetch("/api/governance/attestations").then((r) => { if (!r.ok) throw new Error(); return r.json() }),
      fetch("/api/activity?limit=500").then((r) => { if (!r.ok) throw new Error(); return r.json() }),
      fetch("/api/governance/proposals").then((r) => { if (!r.ok) throw new Error(); return r.json() }),
    ])
      .then(([sopsRes, conflictsRes, excRes, attRes, actRes, propRes]) => {
        setSops(Array.isArray(sopsRes) ? sopsRes : sopsRes.sops ?? [])
        setConflicts(Array.isArray(conflictsRes?.conflicts) ? conflictsRes.conflicts : [])
        setExceptions(Array.isArray(excRes?.exceptions) ? excRes.exceptions : [])
        setAttestationCount(Array.isArray(attRes?.attestations) ? attRes.attestations.length : 0)
        setActivityCount(Array.isArray(actRes?.entries) ? actRes.entries.length : 0)
        setProposals(Array.isArray(propRes) ? propRes : propRes.proposals ?? [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (!LEADERSHIP_ROLES.includes(role)) {
    return (
      <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-6">
        <div className="max-w-2xl mx-auto mt-16">
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Leadership Overview</h1>
            <p className="text-13 text-muted-foreground leading-relaxed">
              This view is designed for hospital leadership. Switch to a leadership role to preview it.
            </p>
            <p className="text-11 text-subtle">
              Available to System Admin and Governance & Compliance roles.
              You are currently viewing as {roleConfig.label}.
            </p>
          </div>
        </div>
      </div>
      </AppShell>
    )
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  const now = Date.now()

  const overdueSops = sops.filter((s) => s.review_date && new Date(s.review_date).getTime() < now)
  const openExceptions = exceptions.filter((e) => e.status !== "resolved" && e.status !== "closed")
  const decidedProposals = proposals.filter((p) => p.status !== "open" && p.status !== "pending")

  // Freshness buckets by effective_date year - real, derived from live SOPs.
  const yearOf = (d: string) => { const y = d ? new Date(d).getFullYear() : NaN; return Number.isNaN(y) ? null : y }
  const thisYear = new Date().getFullYear()
  const freshnessBuckets = [
    { label: `${thisYear - 1} or newer`, count: sops.filter((s) => { const y = yearOf(s.effective_date); return y !== null && y >= thisYear - 1 }).length, color: "bg-[#15803D]", text: "text-[#15803D] dark:text-green-400" },
    { label: `${thisYear - 3}-${thisYear - 2}`, count: sops.filter((s) => { const y = yearOf(s.effective_date); return y !== null && y >= thisYear - 3 && y < thisYear - 1 }).length, color: "bg-[#B45309]", text: "text-[#B45309] dark:text-amber-400" },
    { label: "Older / unknown", count: sops.filter((s) => { const y = yearOf(s.effective_date); return y === null || y < thisYear - 3 }).length, color: "bg-[#B91C1C]", text: "text-[#B91C1C] dark:text-red-400" },
  ]
  const freshTotal = freshnessBuckets.reduce((s, b) => s + b.count, 0) || 1
  const freshPct = sops.length ? Math.round(((freshnessBuckets[0].count) / sops.length) * 100) : 0

  // Group exceptions by department for the deviation summary table.
  const byDept = new Map<string, { count: number; open: number }>()
  for (const e of exceptions) {
    const d = e.department || "Unspecified"
    const row = byDept.get(d) ?? { count: 0, open: 0 }
    row.count += 1
    if (e.status !== "resolved" && e.status !== "closed") row.open += 1
    byDept.set(d, row)
  }
  const deptRows = Array.from(byDept.entries()).map(([department, v]) => ({ department, ...v })).sort((a, b) => b.count - a.count)

  const snapshotTiles = [
    { label: "SOPs Past Review Date", value: overdueSops.length, icon: Clock, href: "/library", tone: overdueSops.length > 0 ? "red" : "green" as const },
    { label: "Unresolved Evidence Conflicts", value: conflicts.length, icon: AlertTriangle, href: "/conflict-resolution", tone: conflicts.length > 0 ? "amber" : "green" as const },
    { label: "Open Exception Reports", value: openExceptions.length, icon: AlertTriangle, href: "/incidents", tone: openExceptions.length > 0 ? "amber" : "green" as const },
    { label: "Attestations Collected", value: attestationCount, icon: ShieldCheck, href: "/committee", tone: "neutral" as const },
    { label: "Activity Events Logged", value: activityCount, icon: Activity, href: "/audit", tone: "neutral" as const },
    { label: "Proposals Decided", value: decidedProposals.length, icon: CheckCircle2, href: "/proposals", tone: "neutral" as const },
  ]

  const toneText: Record<string, string> = {
    red: "text-[#B91C1C] dark:text-red-400",
    amber: "text-[#B45309] dark:text-amber-400",
    green: "text-[#15803D] dark:text-green-400",
    neutral: "text-primary",
  }

  const handleExport = () => {
    // Genuine client-side CSV of the real data already fetched onto this
    // page - not a simulated "generating report" delay over nothing.
    const rows = [
      ["Metric", "Value"],
      ...snapshotTiles.map((t) => [t.label, String(t.value)]),
      [],
      ["Department", "Total Exceptions", "Open"],
      ...deptRows.map((r) => [r.department, String(r.count), String(r.open)]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `meridian-leadership-snapshot-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExportState("done")
    setTimeout(() => setExportState("idle"), 2000)
  }

  return (
    <AppShell>
    <div className="bg-background px-4 md:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Leadership Overview</h1>
              <p className="text-13 text-subtle">Governance and safety posture for executive review</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-11 text-subtle">{today}</span>
            {!loading && !error && (
              <span className="inline-flex items-center gap-1.5 text-11 font-medium px-2.5 py-1 rounded-full border bg-primary/10 text-primary border-primary/30">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Live data
              </span>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading governance data...</span>
          </div>
        )}

        {!loading && error && (
          <div className="bg-card border border-[#B91C1C]/30 rounded-2xl p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-[#B91C1C] dark:text-red-400 mx-auto" />
            <p className="text-sm font-medium text-foreground">Couldn't load leadership data</p>
            <p className="text-xs text-muted-foreground">One or more backend services didn't respond. This is a connection failure, not an empty report.</p>
            <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors mx-auto">
              <RotateCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Section 1: Governance & Safety Snapshot (real counts, no fabricated targets/trends) */}
            <section className="space-y-3">
              <SectionHeading title="Governance & Safety Snapshot" subtitle="Live counts from the SOP library, conflict graph, exceptions, attestations, and activity log" />
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {snapshotTiles.map((t) => (
                  <Link key={t.label} href={t.href} className="block bg-card border border-border rounded-2xl p-4 hover:bg-[#F8FAFC] transition-colors group">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-11 text-subtle uppercase tracking-widest font-semibold mb-1">{t.label}</p>
                        <p className={cn("text-2xl font-bold font-display", toneText[t.tone])}>{t.value}</p>
                      </div>
                      <t.icon className={cn("w-5 h-5 shrink-0 opacity-50", toneText[t.tone])} />
                    </div>
                    <span className="inline-flex items-center gap-1 text-11 font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                      View <ChevronRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))}
              </div>
              <p className="text-11 text-subtle">
                No target/trend columns are shown here - Meridian doesn't track historical snapshots or department-set
                targets, so a trend arrow would itself be fabricated. Clinical outcome measures (infection rates,
                bundle adherence) aren't tracked by this system at all and are intentionally absent rather than guessed.
              </p>
            </section>

            {/* Section 2: Attention Required - built from the same real data, not separate hardcoded cards */}
            {(overdueSops.length > 0 || conflicts.length > 0 || openExceptions.length > 0) && (
              <section className="space-y-3">
                <SectionHeading title="Attention Required" subtitle="Real items pulled from the snapshot above that need executive awareness" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {overdueSops.length > 0 && (
                    <Link href="/library" className="block bg-card border border-border rounded-2xl p-4 border-l-4 border-l-[#B91C1C] hover:bg-[#F8FAFC] transition-colors group">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-[#B91C1C] dark:text-red-400 shrink-0 mt-0.5" />
                        <p className="text-13 font-semibold text-foreground leading-snug">{overdueSops.length} SOP{overdueSops.length !== 1 ? "s" : ""} past review date</p>
                      </div>
                      <p className="text-11 text-muted-foreground mb-3 leading-relaxed">{overdueSops.slice(0, 3).map((s) => s.title).join(", ")}{overdueSops.length > 3 ? "…" : ""}</p>
                      <span className="inline-flex items-center gap-1 text-11 font-semibold text-primary group-hover:text-primary-hover transition-colors">View SOP Library <ChevronRight className="w-3.5 h-3.5" /></span>
                    </Link>
                  )}
                  {conflicts.length > 0 && (
                    <Link href="/conflict-resolution" className="block bg-card border border-border rounded-2xl p-4 border-l-4 border-l-[#B45309] hover:bg-[#F8FAFC] transition-colors group">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-13 font-semibold text-foreground leading-snug">{conflicts.length} unresolved evidence conflict{conflicts.length !== 1 ? "s" : ""}</p>
                      </div>
                      <p className="text-11 text-muted-foreground mb-3 leading-relaxed">Cross-SOP conflicts flagged by the entity graph.</p>
                      <span className="inline-flex items-center gap-1 text-11 font-semibold text-primary group-hover:text-primary-hover transition-colors">Open conflict resolution <ChevronRight className="w-3.5 h-3.5" /></span>
                    </Link>
                  )}
                  {openExceptions.length > 0 && (
                    <Link href="/incidents" className="block bg-card border border-border rounded-2xl p-4 border-l-4 border-l-[#B45309] hover:bg-[#F8FAFC] transition-colors group">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-13 font-semibold text-foreground leading-snug">{openExceptions.length} open exception report{openExceptions.length !== 1 ? "s" : ""}</p>
                      </div>
                      <p className="text-11 text-muted-foreground mb-3 leading-relaxed">{deptRows.slice(0, 3).map((d) => d.department).join(", ")}</p>
                      <span className="inline-flex items-center gap-1 text-11 font-semibold text-primary group-hover:text-primary-hover transition-colors">View incidents & exceptions <ChevronRight className="w-3.5 h-3.5" /></span>
                    </Link>
                  )}
                </div>
              </section>
            )}

            {/* Section 3: Evidence Freshness - real, bucketed from SOP effective_date */}
            <section className="space-y-3">
              <SectionHeading title="Evidence Freshness" subtitle="How current is the guidance underpinning active SOPs" />
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                    <FlaskConical className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-display text-primary">{sops.length ? `${freshPct}%` : "—"}</p>
                    <p className="text-11 text-muted-foreground">of {sops.length} SOPs effective in {thisYear - 1} or newer</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {freshnessBuckets.map((bar) => {
                    const pct = Math.round((bar.count / freshTotal) * 100)
                    return (
                      <div key={bar.label} className="space-y-1">
                        <div className="flex justify-between text-11">
                          <span className="text-muted-foreground">{bar.label}</span>
                          <span className={cn("font-semibold", bar.text)}>{bar.count} SOP{bar.count !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", bar.color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Section 4: Deviation and Exception Summary - real, grouped by department */}
            <section className="space-y-3">
              <SectionHeading title="Deviation and Exception Summary" subtitle={`${exceptions.length} exception report${exceptions.length !== 1 ? "s" : ""} on record, ${openExceptions.length} open`} />
              {deptRows.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-8 text-center">
                  <p className="text-sm text-muted-foreground">No exception reports on file.</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-12">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Department</th>
                        <th className="text-right px-4 py-2.5 text-muted-foreground font-semibold">Total Reports</th>
                        <th className="text-right px-4 py-2.5 text-muted-foreground font-semibold">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptRows.map((row) => (
                        <tr key={row.department} className="border-b border-border last:border-b-0 hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-4 py-2.5 text-foreground font-medium">{row.department}</td>
                          <td className="px-4 py-2.5 text-right text-foreground font-semibold">{row.count}</td>
                          <td className="px-4 py-2.5 text-right">
                            {row.open > 0 ? (
                              <span className="text-[#B45309] dark:text-amber-400 font-semibold">{row.open}</span>
                            ) : (
                              <span className="text-subtle">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4">
                <Link href="/incidents" className="inline-flex items-center gap-1 text-11 font-semibold text-primary hover:text-primary-hover transition-colors">
                  View all exception reports <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </section>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 flex-wrap border-t border-border pt-5">
              <button
                onClick={handleExport}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-13 font-semibold border transition-colors",
                  exportState === "done"
                    ? toneChip.success
                    : "bg-primary border-primary text-primary-foreground hover:bg-primary-hover"
                )}
              >
                {exportState === "done" ? (
                  <><CheckCircle2 className="w-4 h-4" /> Downloaded</>
                ) : (
                  <><Download className="w-4 h-4" /> Export Snapshot (CSV)</>
                )}
              </button>
              <SafetyNote className="text-11" />
            </div>
          </>
        )}
      </div>
    </div>
    </AppShell>
  )
}
