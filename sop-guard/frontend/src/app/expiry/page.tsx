"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, Clock, CheckCircle, CalendarClock,
  ArrowRight, FileText, User, Calendar, Bell
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_SOPS } from "@/lib/mock-data"

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date()
  const due = new Date(dateStr)
  const diff = due.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

type ExpiryStatus = "expired" | "due_soon" | "upcoming" | "current"

function expiryStatus(days: number): ExpiryStatus {
  if (days < 0) return "expired"
  if (days <= 30) return "due_soon"
  if (days <= 90) return "upcoming"
  return "current"
}

const STATUS_META: Record<ExpiryStatus, { label: string; badgeClass: string; rowClass: string }> = {
  expired: {
    label: "EXPIRED",
    badgeClass: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]",
    rowClass: "border-l-2 border-[#B91C1C]",
  },
  due_soon: {
    label: "DUE SOON",
    badgeClass: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]",
    rowClass: "border-l-2 border-[#B45309]",
  },
  upcoming: {
    label: "UPCOMING",
    badgeClass: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]",
    rowClass: "border-l-2 border-[#B45309]",
  },
  current: {
    label: "CURRENT",
    badgeClass: "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]",
    rowClass: "border-l-2 border-[#15803D]",
  },
}

function daysLabel(days: number) {
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return "Due today"
  return `${days} days remaining`
}

function daysColor(days: number) {
  if (days < 0) return "text-[#B91C1C]"
  if (days <= 30) return "text-[#B45309]"
  if (days <= 90) return "text-[#B45309]"
  return "text-[#15803D]"
}

// ─── Alert tier for staged escalation ────────────────────────────────────────

type AlertTier = "current" | "owner_notified" | "dept_notified" | "compliance_notified" | "cmo_escalation" | "expired_frozen"

function getAlertTier(days: number): AlertTier {
  if (days < 0) return "expired_frozen"
  if (days <= 7) return "cmo_escalation"
  if (days <= 30) return "compliance_notified"
  if (days <= 60) return "dept_notified"
  if (days <= 90) return "owner_notified"
  return "current"
}

const ALERT_TIER_META: Record<AlertTier, { label: string; badgeClass: string }> = {
  current: { label: "Current", badgeClass: "bg-white text-[#64748B] border border-[#CBD5E1]" },
  owner_notified: { label: "Owner Notified", badgeClass: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]" },
  dept_notified: { label: "Dept Head Notified", badgeClass: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]" },
  compliance_notified: { label: "Compliance Notified", badgeClass: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]" },
  cmo_escalation: { label: "CMO Escalation", badgeClass: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]" },
  expired_frozen: { label: "EXPIRED - SOP Frozen", badgeClass: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]" },
}

// Escalation steps for the timeline
const ESCALATION_STEPS = [
  {
    label: "90 days out",
    action: "Notify Owner",
    tier: "owner_notified" as AlertTier,
    color: "bg-[#64748B]",
    textColor: "text-[#64748B]",
    borderColor: "border-[#64748B]",
  },
  {
    label: "60 days out",
    action: "Notify Dept Head",
    tier: "dept_notified" as AlertTier,
    color: "bg-[#B45309]",
    textColor: "text-[#B45309]",
    borderColor: "border-[#B45309]",
  },
  {
    label: "30 days out",
    action: "Notify Compliance",
    tier: "compliance_notified" as AlertTier,
    color: "bg-[#B45309]",
    textColor: "text-[#B45309]",
    borderColor: "border-[#B45309]",
  },
  {
    label: "7 days out",
    action: "CMO Escalation",
    tier: "cmo_escalation" as AlertTier,
    color: "bg-[#B91C1C]",
    textColor: "text-[#B91C1C]",
    borderColor: "border-[#B91C1C]",
  },
  {
    label: "EXPIRED",
    action: "Freeze SOP",
    tier: "expired_frozen" as AlertTier,
    color: "bg-[#7F1D1D]",
    textColor: "text-[#B91C1C]",
    borderColor: "border-[#7F1D1D]",
  },
]

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ExpiryPage() {
  const items = useMemo(() => {
    return MOCK_SOPS
      .map((sop) => ({
        sop,
        days: daysUntil(sop.review_due_date),
        status: expiryStatus(daysUntil(sop.review_due_date)),
        alertTier: getAlertTier(daysUntil(sop.review_due_date)),
      }))
      .sort((a, b) => a.days - b.days)
  }, [])

  const counts = useMemo(() => ({
    expired: items.filter((i) => i.status === "expired").length,
    due_soon: items.filter((i) => i.status === "due_soon").length,
    upcoming: items.filter((i) => i.status === "upcoming").length,
    current: items.filter((i) => i.status === "current").length,
  }), [items])

  const stats = [
    { label: "Expired", value: counts.expired, icon: AlertTriangle, color: "text-[#B91C1C]", bg: "bg-[#FEE2E2]" },
    { label: "Expiring in 30 days", value: counts.due_soon, icon: Clock, color: "text-[#B45309]", bg: "bg-[#FEF3C7]" },
    { label: "Expiring in 90 days", value: counts.upcoming, icon: CalendarClock, color: "text-[#B45309]", bg: "bg-[#FEF3C7]" },
    { label: "Current", value: counts.current, icon: CheckCircle, color: "text-[#15803D]", bg: "bg-[#DCFCE7]" },
  ]

  // Determine the most critical active tier for highlighting
  const mostCriticalTier: AlertTier = items.length > 0 ? items[0].alertTier : "current"

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "SOP Expiry Management" }]} />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
            <CalendarClock className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">SOP Expiry Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Joint Commission requires review within 2-3 years of last approval date
            </p>
          </div>
        </div>

        {/* Research Prototype disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype - Not for Clinical Use.</strong> For demonstration only. Always verify review dates against your live document management system.</span>
        </div>

        {/* Regulatory basis note */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0959AC] text-sm">
          <FileText className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Regulatory Basis:</strong> TJC Standard LD.04.03.07 requires that all policies are reviewed at least every 3 years.
            CMS Conditions of Participation require policies to be current and accessible to relevant staff at all times.
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl bg-white border border-[#E2E8F0] p-4 flex items-center gap-3"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("w-5 h-5", s.color)} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Staged Alert Escalation Timeline */}
        <section className="rounded-2xl bg-white border border-[#E2E8F0] p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Staged Escalation Protocol</h2>
            <p className="text-xs text-muted-foreground mt-0.5">TJC LD.04.03.07 - Automated notification escalation based on days until review due date</p>
          </div>

          {/* Stepper */}
          <div className="relative flex items-start justify-between gap-2 overflow-x-auto pb-2">
            {/* Connector line */}
            <div className="absolute top-4 left-0 right-0 h-px bg-[#E2E8F0] z-0 mx-8" />

            {ESCALATION_STEPS.map((step, i) => {
              const isActive = step.tier === mostCriticalTier
              return (
                <div key={step.tier} className="flex flex-col items-center gap-2 min-w-[100px] flex-1 z-10">
                  {/* Label above */}
                  <p className={cn(
                    "text-[10px] font-semibold text-center whitespace-nowrap",
                    isActive ? step.textColor : "text-muted-foreground"
                  )}>
                    {step.label}
                  </p>
                  {/* Circle */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                    isActive
                      ? `${step.color} ${step.borderColor} shadow-lg`
                      : "bg-[#F1F5F9] border-[#CBD5E1]"
                  )}>
                    <span className={cn("text-xs font-bold", isActive ? "text-white" : "text-[#94A3B8]")}>{i + 1}</span>
                  </div>
                  {/* Action below */}
                  <p className={cn(
                    "text-[10px] text-center leading-tight",
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                  )}>
                    {step.action}
                  </p>
                </div>
              )
            })}
          </div>

          {mostCriticalTier !== "current" && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#EDF1F5]">
              <p className="text-xs text-muted-foreground">
                Most critical SOP is at tier:{" "}
                <span className={cn("font-semibold", ALERT_TIER_META[mostCriticalTier].badgeClass.includes("red") ? "text-[#B91C1C]" : "text-[#B45309]")}>
                  {ALERT_TIER_META[mostCriticalTier].label}
                </span>
              </p>
            </div>
          )}
        </section>

        {/* Timeline */}
        <section>
          <h2 className="text-lg font-medium mb-3">Review Timeline - sorted by urgency</h2>
          <div className="space-y-3">
            {items.map(({ sop, days, status, alertTier }, i) => {
              const meta = STATUS_META[status]
              const tierMeta = ALERT_TIER_META[alertTier]
              return (
                <motion.div
                  key={sop.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    "rounded-2xl bg-white border border-[#E2E8F0] p-5",
                    meta.rowClass
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Left: title + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1 flex-wrap">
                        <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide shrink-0", meta.badgeClass)}>
                          {meta.label}
                        </span>
                        {/* Alert tier badge */}
                        <span className={cn("px-2 py-0.5 rounded text-[11px] font-medium shrink-0", tierMeta.badgeClass)}>
                          {tierMeta.label}
                        </span>
                        <p className="font-medium text-sm leading-snug truncate">{sop.title}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {sop.sop_id} - v{sop.version}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {sop.owner}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {sop.department}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-2">
                        <span className="text-muted-foreground">
                          Last reviewed: <span className="text-foreground">{sop.effective_date}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Review due: <span className="text-foreground">{sop.review_due_date}</span>
                        </span>
                      </div>
                    </div>

                    {/* Right: days + actions */}
                    <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end gap-3 shrink-0">
                      <p className={cn("text-sm font-semibold tabular-nums", daysColor(days))}>
                        {daysLabel(days)}
                      </p>
                      <div className="flex items-center gap-2">
                        <Link
                          href="/proposals"
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors font-medium"
                        >
                          Initiate Review <ArrowRight className="w-3 h-3" />
                        </Link>
                        <button
                          disabled
                          title="Coming in v2"
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#F1F5F9] text-muted-foreground cursor-not-allowed opacity-50 font-medium"
                        >
                          Assign Reviewer
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Tier legend */}
        <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4">
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">Alert Tier Reference</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {(["expired", "due_soon", "upcoming", "current"] as ExpiryStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", STATUS_META[s].badgeClass)}>
                  {STATUS_META[s].label}
                </span>
                <span className="text-muted-foreground">
                  {s === "expired" ? "Past due date" : s === "due_soon" ? "Within 30 days" : s === "upcoming" ? "30-90 days" : "Over 90 days"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Notification Settings card */}
        <div className="rounded-2xl bg-white border border-[#E2E8F0] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Notification Settings</h3>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 py-2 border-b border-[#EDF1F5]">
              <span className="w-40 shrink-0 text-foreground font-medium">Alert recipients:</span>
              <span>Configured in</span>
              <Link href="/admin" className="text-[#0B6BCB] hover:text-[#0959AC] underline">/admin</Link>
            </div>
            <div className="flex items-center gap-2 py-2 border-b border-[#EDF1F5]">
              <span className="w-40 shrink-0 text-foreground font-medium">Email notifications:</span>
              <span>Not configured (connect to hospital email system)</span>
            </div>
            <div className="flex items-center gap-2 py-2 border-b border-[#EDF1F5]">
              <span className="w-40 shrink-0 text-foreground font-medium">Push notifications:</span>
              <span>Not configured</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/70 italic">
            These settings require IT integration in production.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
