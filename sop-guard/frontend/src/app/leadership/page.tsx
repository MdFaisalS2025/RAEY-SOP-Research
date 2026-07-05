"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ChevronRight,
  Download,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FlaskConical,
  Activity,
  Loader2,
} from "lucide-react"
import { useRole } from "@/lib/role-context"
import AppShell from "@/components/layout/app-shell"
import { cn } from "@/lib/utils"

const LEADERSHIP_ROLES = [
  "system_admin",
  "compliance_officer",
  "department_admin",
  "committee_member",
]

type KpiStatus = "green" | "amber" | "red"
type KpiTrend = "up" | "down" | "flat"

const BOARD_KPIS: {
  metric: string
  current: string
  target: string
  status: KpiStatus
  trend: KpiTrend
  trend_label: string
  owner: string
  drill: string
}[] = [
  { metric: "SOP Compliance Rate", current: "84%", target: "95%", status: "amber", trend: "up", trend_label: "+2% this quarter", owner: "Compliance Officer", drill: "/compliance" },
  { metric: "Sepsis Bundle Adherence", current: "91%", target: "95%", status: "amber", trend: "up", trend_label: "+3% this quarter", owner: "ICU Medical Director", drill: "/effectiveness" },
  { metric: "SOPs Current (within review cycle)", current: "75%", target: "100%", status: "red", trend: "flat", trend_label: "No change", owner: "Department Admins", drill: "/expiry" },
  { metric: "CLABSI Rate (per 1000 line-days)", current: "0.9", target: "< 1.2", status: "green", trend: "down", trend_label: "-50% post SOP update", owner: "Infection Control", drill: "/effectiveness" },
  { metric: "Training Completion (active modules)", current: "87%", target: "90%", status: "amber", trend: "up", trend_label: "+4% this month", owner: "Nurse Educator", drill: "/training" },
  { metric: "Open Legal / Risk Flags", current: "4", target: "0", status: "red", trend: "down", trend_label: "-2 this quarter", owner: "Risk Manager", drill: "/legal" },
  { metric: "Evidence Conflicts Unresolved", current: "2", target: "0", status: "amber", trend: "flat", trend_label: "1 in committee", owner: "SOP Committee", drill: "/conflict-resolution" },
]

const STATUS_DOT: Record<KpiStatus, string> = {
  green: "bg-[#15803D]",
  amber: "bg-[#B45309]",
  red: "bg-[#B91C1C]",
}

const STATUS_LABEL: Record<KpiStatus, string> = {
  green: "On target",
  amber: "Watch",
  red: "Off target",
}

const STATUS_TEXT: Record<KpiStatus, string> = {
  green: "text-[#15803D] dark:text-green-400",
  amber: "text-[#B45309] dark:text-amber-400",
  red: "text-[#B91C1C] dark:text-red-400",
}

function TrendIcon({ trend }: { trend: KpiTrend }) {
  if (trend === "up") return <TrendingUp className="w-3.5 h-3.5 text-[#334155] shrink-0" />
  if (trend === "down") return <TrendingDown className="w-3.5 h-3.5 text-[#334155] shrink-0" />
  return <Minus className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
}

const ATTENTION_ITEMS = [
  {
    title: "3 SOPs past mandatory review date",
    detail: "Overdue documents remain in circulation until re-reviewed or retired.",
    href: "/expiry",
    severity: "red" as const,
    linkLabel: "View expiry queue",
  },
  {
    title: "1 critical conflict: vasopressor dosing between Sepsis and RRT protocols",
    detail: "Conflicting dosing guidance flagged across two active protocols.",
    href: "/conflict-resolution",
    severity: "red" as const,
    linkLabel: "Open conflict resolution",
  },
  {
    title: "Radiology dept compliance at 68%, lowest in hospital",
    detail: "Below the 75% intervention threshold for the second consecutive month.",
    href: "/compliance",
    severity: "amber" as const,
    linkLabel: "View compliance detail",
  },
]

const FRESHNESS_BARS = [
  { label: "2024 or newer", count: 5, color: "bg-[#15803D]", text: "text-[#15803D] dark:text-green-400" },
  { label: "2022 - 2023", count: 2, color: "bg-[#B45309]", text: "text-[#B45309] dark:text-amber-400" },
  { label: "Older", count: 1, color: "bg-[#B91C1C]", text: "text-[#B91C1C] dark:text-red-400" },
]

const EXCEPTION_ROWS = [
  { department: "ICU", exceptions: 2, pattern: true, action: "SOP review" },
  { department: "Oncology", exceptions: 1, pattern: true, action: "Staffing review" },
  { department: "Emergency", exceptions: 2, pattern: false, action: "Monitoring" },
]

const GOVERNANCE_TILES = [
  { label: "Proposals Decided", value: 3, icon: CheckCircle2 },
  { label: "Committee Votes Cast", value: 11, icon: Activity },
  { label: "Attestations Collected", value: 247, icon: ShieldCheck },
  { label: "Audit Events Logged", value: 156, icon: Clock },
]

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-[13px] font-semibold text-[#334155] uppercase tracking-widest">{title}</h2>
      {subtitle && <p className="text-[11px] text-[#94A3B8] mt-0.5">{subtitle}</p>}
    </div>
  )
}

export default function LeadershipPage() {
  const { role, roleConfig } = useRole()
  const router = useRouter()
  const [exportState, setExportState] = useState<"idle" | "loading" | "done">("idle")

  const handleExport = () => {
    if (exportState !== "idle") return
    setExportState("loading")
    setTimeout(() => {
      setExportState("done")
      setTimeout(() => setExportState("idle"), 3000)
    }, 1500)
  }

  if (!LEADERSHIP_ROLES.includes(role)) {
    return (
      <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-6">
        <div className="max-w-2xl mx-auto mt-16">
          <div className="bg-card border border-[#E2E8F0] shadow-sm rounded-xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6 text-[#0B6BCB]" />
            </div>
            <h1 className="text-xl font-semibold font-display text-[#1A2332]">Leadership Overview</h1>
            <p className="text-[13px] text-[#64748B] leading-relaxed">
              This view is designed for hospital leadership. Switch to a leadership role to preview it.
            </p>
            <p className="text-[11px] text-[#94A3B8]">
              Available to System Admin, Compliance Officer, Department Admin, and Committee Member roles.
              You are currently viewing as {roleConfig.label}. Use the role switcher in the top bar.
            </p>
          </div>
        </div>
      </div>
      </AppShell>
    )
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <AppShell>
    <div className="bg-background px-4 md:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold font-display text-[#1A2332] mb-1">Leadership Overview</h1>
            <p className="text-[13px] text-[#94A3B8]">Governance and safety posture for executive review</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[#94A3B8]">{today}</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0B6BCB]" />
              Data refreshed 07:00 today
            </span>
          </div>
        </div>

        {/* Section 1: Board Scorecard */}
        <section className="space-y-3">
          <SectionHeading title="Board Scorecard" subtitle="Seven key indicators tracked against target for the current quarter" />
          <div className="bg-card border border-[#E2E8F0] shadow-sm rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] min-w-[760px]">
                <thead>
                  <tr className="bg-muted border-b border-[#E2E8F0]">
                    <th className="text-left px-4 py-2.5 text-[#64748B] font-semibold">Metric</th>
                    <th className="text-right px-4 py-2.5 text-[#64748B] font-semibold">Current</th>
                    <th className="text-right px-4 py-2.5 text-[#64748B] font-semibold">Target</th>
                    <th className="text-left px-4 py-2.5 text-[#64748B] font-semibold">Status</th>
                    <th className="text-left px-4 py-2.5 text-[#64748B] font-semibold">Trend</th>
                    <th className="text-left px-4 py-2.5 text-[#64748B] font-semibold">Owner</th>
                    <th className="w-8" aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {BOARD_KPIS.map((kpi) => (
                    <tr
                      key={kpi.metric}
                      onClick={() => router.push(kpi.drill)}
                      className="border-b border-[#EDF1F5] last:border-b-0 hover:bg-[#F8FAFC] cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3 text-[#1A2332] font-medium group-hover:text-[#0B6BCB] transition-colors">
                        {kpi.metric}
                      </td>
                      <td className={cn("px-4 py-3 text-right font-bold font-display", STATUS_TEXT[kpi.status])}>
                        {kpi.current}
                      </td>
                      <td className="px-4 py-3 text-right text-[#64748B]">{kpi.target}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[kpi.status])} />
                          <span className="text-[#64748B]">{STATUS_LABEL[kpi.status]}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <TrendIcon trend={kpi.trend} />
                          <span className="text-[#94A3B8]">{kpi.trend_label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{kpi.owner}</td>
                      <td className="px-2 py-3">
                        <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#0B6BCB] transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            Trend arrows show direction relative to target. Simulated data for research demonstration.
          </p>
        </section>

        {/* Section 2: Attention Required */}
        <section className="space-y-3">
          <SectionHeading title="Attention Required" subtitle="Items escalated for executive awareness this cycle" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {ATTENTION_ITEMS.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={cn(
                  "block bg-card border border-[#E2E8F0] shadow-sm rounded-xl p-4 border-l-4 hover:bg-[#F8FAFC] transition-colors group",
                  item.severity === "red" ? "border-l-[#B91C1C]" : "border-l-[#B45309]"
                )}
              >
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle
                    className={cn(
                      "w-4 h-4 shrink-0 mt-0.5",
                      item.severity === "red" ? "text-[#B91C1C] dark:text-red-400" : "text-[#B45309] dark:text-amber-400"
                    )}
                  />
                  <p className="text-[13px] font-semibold text-[#1A2332] leading-snug">{item.title}</p>
                </div>
                <p className="text-[11px] text-[#64748B] mb-3 leading-relaxed">{item.detail}</p>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B6BCB] group-hover:text-[#0959AC] transition-colors">
                  {item.linkLabel}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Section 3: Evidence Freshness */}
        <section className="space-y-3">
          <SectionHeading title="Evidence Freshness" subtitle="How current is the guidance underpinning active SOPs" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-card border border-[#E2E8F0] shadow-sm rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-5 h-5 text-[#0B6BCB]" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-display text-[#0B6BCB]">88%</p>
                  <p className="text-[11px] text-[#64748B]">of SOPs grounded in guidance from 2023 or newer</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {FRESHNESS_BARS.map((bar) => {
                  const total = FRESHNESS_BARS.reduce((s, b) => s + b.count, 0)
                  const pct = Math.round((bar.count / total) * 100)
                  return (
                    <div key={bar.label} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#64748B]">{bar.label}</span>
                        <span className={cn("font-semibold", bar.text)}>
                          {bar.count} SOP{bar.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", bar.color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <Link
              href="/evidence-watch"
              className="block bg-card border border-[#E2E8F0] shadow-sm border-l-4 border-l-[#B91C1C] rounded-xl p-5 hover:bg-[#F8FAFC] transition-colors group"
            >
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-[#B91C1C] dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-[13px] font-semibold text-[#1A2332]">1 SOP based on superseded guidance</p>
              </div>
              <p className="text-[12px] text-[#64748B] mb-1">
                <span className="font-mono text-[#1A2332]">IC-PPE-001</span> references guidance the CDC updated in 2024.
              </p>
              <p className="text-[11px] text-[#94A3B8] mb-3">
                The linked source has a newer revision; the SOP has not yet been re-grounded against it.
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B6BCB] group-hover:text-[#0959AC] transition-colors">
                Open Evidence Watch
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
        </section>

        {/* Section 4: Deviation and Exception Summary */}
        <section className="space-y-3">
          <SectionHeading title="Deviation and Exception Summary" subtitle="5 exception reports filed this quarter, 2 pattern alerts active" />
          <div className="bg-card border border-[#E2E8F0] shadow-sm rounded-xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-muted border-b border-[#E2E8F0]">
                  <th className="text-left px-4 py-2.5 text-[#64748B] font-semibold">Department</th>
                  <th className="text-right px-4 py-2.5 text-[#64748B] font-semibold">Exceptions</th>
                  <th className="text-left px-4 py-2.5 text-[#64748B] font-semibold">Pattern Detected</th>
                  <th className="text-left px-4 py-2.5 text-[#64748B] font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {EXCEPTION_ROWS.map((row) => (
                  <tr key={row.department} className="border-b border-[#EDF1F5] last:border-b-0 hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-2.5 text-[#1A2332] font-medium">{row.department}</td>
                    <td className="px-4 py-2.5 text-right text-[#334155] font-semibold">{row.exceptions}</td>
                    <td className="px-4 py-2.5">
                      {row.pattern ? (
                        <span className="inline-flex items-center gap-1.5 text-[#B45309] dark:text-amber-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#B45309]" />
                          Yes
                        </span>
                      ) : (
                        <span className="text-[#94A3B8]">No</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[#64748B]">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/exceptions" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B6BCB] hover:text-[#0959AC] transition-colors">
              View all exception reports
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <Link href="/incidents" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0B6BCB] hover:text-[#0959AC] transition-colors">
              View incident correlation
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>

        {/* Section 5: Quarterly Governance Activity */}
        <section className="space-y-3">
          <SectionHeading title="Quarterly Governance Activity" subtitle="Formal governance actions recorded this quarter" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {GOVERNANCE_TILES.map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-card border border-[#E2E8F0] shadow-sm rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-[#94A3B8] uppercase tracking-widest font-semibold mb-1">{label}</p>
                    <p className="text-2xl font-bold font-display text-[#0B6BCB]">{value}</p>
                  </div>
                  <Icon className="w-5 h-5 text-[#0B6BCB]/50 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-t border-[#E2E8F0] pt-5">
          <button
            onClick={handleExport}
            disabled={exportState === "loading"}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold border transition-colors",
              exportState === "done"
                ? "bg-[#DCFCE7] dark:bg-green-500/10 border-[#BBF7D0] dark:border-green-500/30 text-[#15803D] dark:text-green-400"
                : "bg-[#0B6BCB] border-[#0B6BCB] text-white hover:bg-[#0959AC]",
              exportState === "loading" && "opacity-70 cursor-wait"
            )}
          >
            {exportState === "loading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating report...
              </>
            ) : exportState === "done" ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Board report ready
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export Board Report
              </>
            )}
          </button>
          <p className="text-[11px] text-[#94A3B8]">Research Prototype - Not for Clinical Use</p>
        </div>
      </div>
    </div>
    </AppShell>
  )
}
