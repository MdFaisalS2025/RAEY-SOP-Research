"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  BookOpen, Users, Clock, CheckCircle2, AlertTriangle,
  Bell, TrendingUp, PlayCircle, ArrowRight, Zap, ToggleRight, ToggleLeft
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_TRAINING, MOCK_COMPLIANCE } from "@/lib/mock-data"
import { useRole } from "@/lib/role-context"
import type { TrainingModule } from "@/lib/governance-types"

const formatConfig: Record<TrainingModule["format"], { label: string; className: string }> = {
  module: { label: "Module", className: "bg-white text-[#475569] border border-[#CBD5E1]" },
  quiz: { label: "Quiz", className: "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]" },
  checklist: { label: "Checklist", className: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30" },
  video: { label: "Video", className: "bg-white text-[#475569] border border-[#CBD5E1]" },
  attestation: { label: "Attestation", className: "bg-white text-[#475569] border border-[#CBD5E1]" },
}

const trainingStatusConfig: Record<TrainingModule["status"], { label: string; className: string }> = {
  active: { label: "Active", className: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30" },
  completed: { label: "Completed", className: "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]" },
  overdue: { label: "Overdue", className: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]" },
  upcoming: { label: "Upcoming", className: "bg-white text-[#475569] border border-[#CBD5E1]" },
}

function completionRateBar(rate: number) {
  if (rate >= 90) return "bg-[#16A34A]"
  if (rate >= 70) return "bg-[#0B6BCB]"
  if (rate >= 50) return "bg-[#F59E0B]"
  return "bg-[#DC2626]"
}

function completionTextColor(rate: number) {
  if (rate >= 90) return "text-[#15803D]"
  if (rate >= 70) return "text-[#0B6BCB]"
  if (rate >= 50) return "text-[#B45309]"
  return "text-[#B91C1C]"
}

function isPastDue(dateStr: string) {
  return new Date(dateStr) < new Date()
}

// ─── Trigger Events (defined inline) ──────────────────────────────────────────

interface TriggerEvent {
  id: string
  date: string
  sop_id: string
  sop_title: string
  sop_version: string
  trigger_reason: string
  staff_groups_affected: string[]
  modules_created: number
  total_staff_assigned: number
  completion_rate: number
  deadline: string
  status: "active" | "completed"
}

const TRIGGER_EVENTS: TriggerEvent[] = [
  {
    id: "trigger-001",
    date: "2026-06-01",
    sop_id: "IC-PPE-001",
    sop_title: "High-Risk Respiratory Isolation + PPE Protocol",
    sop_version: "3.2",
    trigger_reason: "PPE donning/doffing sequence updated based on CDC HICPAC 2024 guidance",
    staff_groups_affected: ["ICU Nursing", "Emergency Nursing", "Respiratory Therapy"],
    modules_created: 1,
    total_staff_assigned: 127,
    completion_rate: 82,
    deadline: "2026-07-01",
    status: "active",
  },
  {
    id: "trigger-002",
    date: "2026-05-15",
    sop_id: "PHARM-MED-007",
    sop_title: "High-Alert Medication Double-Check Protocol",
    sop_version: "2.1",
    trigger_reason: "Independent double-check definition clarified after incident report",
    staff_groups_affected: ["All Nursing Staff", "Pharmacy"],
    modules_created: 1,
    total_staff_assigned: 203,
    completion_rate: 94,
    deadline: "2026-06-15",
    status: "completed",
  },
  {
    id: "trigger-003",
    date: "2026-04-20",
    sop_id: "ICU-SEP-002",
    sop_title: "Sepsis Early Recognition - 1-Hour Bundle",
    sop_version: "4.3",
    trigger_reason: "Vasopressor titration guidelines updated per SSC 2024 revision",
    staff_groups_affected: ["ICU Physicians", "ICU Nursing", "Emergency Physicians"],
    modules_created: 2,
    total_staff_assigned: 89,
    completion_rate: 100,
    deadline: "2026-05-20",
    status: "completed",
  },
]

// ─── Auto-Assignment Rules ─────────────────────────────────────────────────────

interface AssignmentRule {
  id: string
  department: string
  staff_groups: string[]
  enabled: boolean
}

const INITIAL_RULES: AssignmentRule[] = [
  { id: "rule-001", department: "Infection Control", staff_groups: ["ICU Nursing", "Emergency Nursing"], enabled: true },
  { id: "rule-002", department: "ICU", staff_groups: ["ICU Physicians", "ICU Nursing", "Respiratory Therapy"], enabled: true },
  { id: "rule-003", department: "Pharmacy", staff_groups: ["All Nursing Staff", "Pharmacy"], enabled: true },
  { id: "rule-004", department: "Radiology", staff_groups: ["Radiology Technicians", "Radiologists"], enabled: true },
  { id: "rule-005", department: "Nursing", staff_groups: ["All Nursing Staff"], enabled: true },
]

export default function TrainingPage() {
  const { role } = useRole()
  const [rules, setRules] = useState<AssignmentRule[]>(INITIAL_RULES)

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const roleBannerSubtitle =
    role === "nurse"
      ? "My Training: Complete your assigned modules and track progress"
      : role === "nurse_educator"
        ? "Training Management: Manage modules, assign staff, and track completion"
        : "Training Overview: Platform-wide training status and compliance"

  const stats = [
    { label: "Active Modules", value: "5", icon: BookOpen, color: "text-[#0B6BCB]", bg: "bg-[#0B6BCB]/10" },
    { label: "Avg Completion Rate", value: "87%", icon: TrendingUp, color: "text-[#15803D]", bg: "bg-[#DCFCE7]" },
    { label: "Overdue Learners", value: "102", icon: AlertTriangle, color: "text-[#B91C1C]", bg: "bg-[#FEE2E2]" },
    { label: "Completed This Month", value: "186", icon: CheckCircle2, color: "text-[#64748B]", bg: "bg-[#F1F5F9]" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: "Training" }]} />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Training Center</h1>
            <p className="text-sm text-[#64748B]">SOP-triggered staff training and compliance</p>
          </div>
        </div>

        {/* Research disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype. Not for Clinical Use.</strong> For demonstration only.</span>
        </div>

        {/* Role banner */}
        <div className="px-4 py-3 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] text-sm">
          <span className="font-semibold">
            {role === "nurse" ? "My Training" : role === "nurse_educator" ? "Training Management" : "Training Overview"}
            {": "}
          </span>
          <span className="text-[#0B6BCB]/80">{roleBannerSubtitle.split(":").slice(1).join(":").trim()}</span>
        </div>

        {/* How Training is Triggered - 3-step flow */}
        <section className="rounded-2xl bg-white border border-[#E2E8F0] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#0B6BCB]" />
            <h2 className="text-base font-semibold">How Training is Triggered</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                step: 1,
                title: "SOP Updated / Approved",
                desc: "Governance committee approves a SOP change and publishes a new version",
                color: "bg-[#0B6BCB]/10 border-[#0B6BCB]/30 text-[#0B6BCB]",
                dot: "bg-[#0B6BCB]",
              },
              {
                step: 2,
                title: "Impact Assessment",
                desc: "System identifies affected staff groups based on SOP department scope and auto-assignment rules",
                color: "bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]",
                dot: "bg-[#F59E0B]",
              },
              {
                step: 3,
                title: "Training Auto-Assigned",
                desc: "Relevant training modules are assigned to staff groups with a completion deadline",
                color: "bg-[#DCFCE7] border-[#BBF7D0] text-[#15803D]",
                dot: "bg-[#16A34A]",
              },
            ].map((item, i) => (
              <div key={item.step} className="relative flex gap-3">
                {/* Step connector arrow */}
                {i < 2 && (
                  <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-[#64748B]" />
                  </div>
                )}
                <div className={cn("flex-1 p-4 rounded-xl border", item.color.split(" ").slice(0, 2).join(" "))}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white", item.dot)}>
                      {item.step}
                    </div>
                    <p className={cn("text-sm font-semibold", item.color.split(" ")[2])}>{item.title}</p>
                  </div>
                  <p className="text-xs text-[#64748B] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Trigger Events */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold font-display">Recent Trigger Events</h2>
          {TRIGGER_EVENTS.map((event, i) => {
            const isActive = event.status === "active"
            const deadlinePast = isPastDue(event.deadline) && event.completion_rate < 100
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="rounded-2xl bg-white border border-[#E2E8F0] p-5 space-y-3"
              >
                {/* Title row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-bold">{event.sop_title}</h3>
                      <span className="text-xs text-[#64748B] border border-[#CBD5E1] rounded px-2 py-0.5">
                        v{event.sop_version}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B]">{event.sop_id} - Triggered {event.date}</p>
                  </div>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0",
                    isActive
                      ? "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]"
                      : "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]"
                  )}>
                    {isActive ? "Active" : "Completed"}
                  </span>
                </div>

                {/* Trigger reason */}
                <p className="text-xs text-[#64748B] italic">{event.trigger_reason}</p>

                {/* Staff groups */}
                <div className="flex flex-wrap gap-1.5">
                  {event.staff_groups_affected.map((g) => (
                    <span key={g} className="px-2 py-0.5 rounded-md bg-[#F1F5F9] text-xs text-[#64748B] border border-[#E2E8F0]">
                      <Users className="w-3 h-3 inline mr-1" />{g}
                    </span>
                  ))}
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B]">
                  <span><span className="font-semibold text-[#1A2332]">{event.modules_created}</span> module{event.modules_created !== 1 ? "s" : ""} created</span>
                  <span><span className="font-semibold text-[#1A2332]">{event.total_staff_assigned}</span> staff assigned</span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748B]">Completion rate</span>
                    <span className={cn("font-bold", completionTextColor(event.completion_rate))}>
                      {event.completion_rate}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", completionRateBar(event.completion_rate))}
                      style={{ width: `${event.completion_rate}%` }}
                    />
                  </div>
                </div>

                {/* Deadline */}
                <p className={cn("text-xs flex items-center gap-1", deadlinePast ? "text-[#B91C1C]" : "text-[#64748B]")}>
                  <Clock className="w-3 h-3" />
                  Deadline: {event.deadline}
                  {deadlinePast && " - OVERDUE"}
                </p>
              </motion.div>
            )
          })}
        </section>

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
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
                <s.icon className={cn("w-5 h-5", s.color)} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-[#64748B]">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Training Modules */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold font-display">Training Modules</h2>
          {MOCK_TRAINING.map((module, i) => (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl bg-white border border-[#E2E8F0] p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[#1A2332]">{module.title}</h3>
                  <p className="text-sm text-[#B45309] mt-0.5">Triggered by: {module.triggered_by}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", formatConfig[module.format].className)}>
                    {formatConfig[module.format].label}
                  </span>
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", trainingStatusConfig[module.status].className)}>
                    {trainingStatusConfig[module.status].label}
                  </span>
                </div>
              </div>

              {/* Assigned groups chips */}
              <div className="flex flex-wrap gap-1.5">
                {module.assigned_groups.map((g) => (
                  <span key={g} className="px-2 py-0.5 rounded-md bg-[#F1F5F9] text-xs text-[#64748B] border border-[#E2E8F0]">
                    <Users className="w-3 h-3 inline mr-1" />{g}
                  </span>
                ))}
              </div>

              {/* Due date */}
              <p className={cn("text-xs flex items-center gap-1", isPastDue(module.due_date) ? "text-[#B91C1C]" : "text-[#64748B]")}>
                <Clock className="w-3 h-3" />
                Due: {module.due_date}
                {isPastDue(module.due_date) && " - OVERDUE"}
              </p>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B]">{module.completed} / {module.total_assigned} staff completed</span>
                  <span className={cn("text-lg font-bold", completionTextColor(module.completion_rate))}>
                    {module.completion_rate}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", completionRateBar(module.completion_rate))}
                    style={{ width: `${module.completion_rate}%` }}
                  />
                </div>
              </div>

              {/* Mini stats */}
              <div className="flex items-center gap-4 text-xs">
                <span className="text-[#15803D]">&#10003; {module.completed} completed</span>
                <span className="text-[#64748B]">{module.in_progress} in progress</span>
                <span className="text-[#64748B]">&#9675; {module.not_started} not started</span>
                <span className="text-[#B91C1C]">&#9888; {module.overdue} overdue</span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 border border-[#0B6BCB]/30 transition-colors font-medium">
                  <PlayCircle className="w-3.5 h-3.5" /> View Details
                </button>
                {role === "nurse_educator" && (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A] border border-[#FDE68A] transition-colors font-medium">
                    <Bell className="w-3.5 h-3.5" /> Send Reminder
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </section>

        {/* Department Completion Summary */}
        <section>
          <h2 className="text-lg font-semibold font-display mb-3">Department Completion Summary</h2>
          <div className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-xs text-[#64748B] uppercase tracking-wider">
                  <th className="p-4 text-left">Department</th>
                  <th className="p-4 text-left">Training %</th>
                  <th className="p-4 text-left w-48">Rate</th>
                  <th className="p-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_COMPLIANCE.map((dept) => {
                  const rate = dept.training_completion_rate
                  const status = rate >= 90 ? { label: "On Track", cls: "bg-[#DCFCE7] text-[#15803D]" } :
                    rate >= 70 ? { label: "At Risk", cls: "bg-[#FEF3C7] text-[#B45309]" } :
                      { label: "Critical", cls: "bg-[#FEE2E2] text-[#B91C1C]" }
                  return (
                    <tr key={dept.department} className="border-b border-[#EDF1F5] hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4 font-medium">{dept.department}</td>
                      <td className={cn("p-4 font-bold", completionTextColor(rate))}>{rate}%</td>
                      <td className="p-4">
                        <div className="h-1.5 rounded-full bg-[#E2E8F0] w-full">
                          <div
                            className={cn("h-full rounded-full", completionRateBar(rate))}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", status.cls)}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Configure Auto-Assignment Rules */}
        <section className="rounded-2xl bg-white border border-[#E2E8F0] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Configure Auto-Assignment Rules</h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                When a SOP in a department is updated, auto-assign training to the configured staff groups.
              </p>
            </div>
            <div className="relative group">
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] cursor-not-allowed opacity-60"
              >
                Add Rule
              </button>
              <div className="absolute right-0 top-full mt-1.5 px-2.5 py-1.5 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] text-xs text-[#64748B] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Coming in v2
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-xs text-[#64748B] uppercase tracking-wider">
                  <th className="p-3 text-left">SOP Department</th>
                  <th className="p-3 text-left">Auto-Assign To</th>
                  <th className="p-3 text-left">Enabled</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-[#EDF1F5] hover:bg-[#F8FAFC] transition-colors">
                    <td className="p-3 font-medium text-sm">{rule.department}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {rule.staff_groups.map((g) => (
                          <span key={g} className="text-xs text-[#64748B] border border-[#CBD5E1] rounded px-2 py-0.5">
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className="flex items-center gap-1.5 text-xs transition-colors"
                      >
                        {rule.enabled
                          ? <ToggleRight className="w-6 h-6 text-[#0B6BCB]" />
                          : <ToggleLeft className="w-6 h-6 text-[#94A3B8]" />}
                        <span className={rule.enabled ? "text-[#0B6BCB]" : "text-[#64748B]"}>
                          {rule.enabled ? "On" : "Off"}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-[#64748B]/70 italic">
            Connect to hospital HR system to maintain staff group rosters automatically.
          </p>
        </section>

        {/* LMS Integration note */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] text-[#334155] text-sm">
          <BookOpen className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Connect to hospital LMS (HealthStream, Relias) for production training enrollment and tracking.</span>
        </div>
      </div>
    </AppShell>
  )
}
