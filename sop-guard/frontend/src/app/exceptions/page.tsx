"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle, CheckCircle, XCircle, ClipboardList,
  Clock, Shield, User, Calendar, FileText, ChevronDown, ChevronUp, Plus, X
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"
import type { ExceptionReport } from "@/lib/governance-types"

// ─── mock data (local, not in mock-data.ts) ───────────────────────────────────

const MOCK_EXCEPTIONS: ExceptionReport[] = [
  {
    id: "exc-001",
    sop_id: "IC-PPE-001",
    sop_title: "High-Risk Respiratory Isolation + PPE Protocol",
    reported_by: "James O'Brien RN",
    reporter_role: "nurse",
    department: "ICU",
    date_reported: "2026-06-28T09:15:00",
    date_of_deviation: "2026-06-28T08:30:00",
    deviation_type: "equipment_unavailable",
    description:
      "N95 respirators were out of stock in the ICU supply room. Surgical mask used instead for isolation patient pending restock.",
    immediate_action_taken:
      "Notified charge nurse, patient placed in negative pressure room, surgical mask + face shield used as interim measure",
    patient_harm: false,
    severity: "high",
    status: "under_review",
    reviewed_by: null,
    resolution: null,
    sop_update_required: true,
    follow_up_required:
      "Review PPE stockpiling protocol. Consider minimum reorder triggers.",
  },
  {
    id: "exc-002",
    sop_id: "ICU-SEP-002",
    sop_title: "Sepsis Early Recognition and 1-Hour Bundle",
    reported_by: "Dr. Sarah Mitchell",
    reporter_role: "physician",
    department: "Emergency",
    date_reported: "2026-06-25T14:30:00",
    date_of_deviation: "2026-06-25T13:45:00",
    deviation_type: "patient_specific_contraindication",
    description:
      "Blood cultures could not be drawn within 1 hour due to patient having active bleeding and coagulopathy. Antibiotics given per protocol but culture timing deviated.",
    immediate_action_taken:
      "Documented in chart. Hematology consulted. Cultures obtained after bleeding controlled at 2h 15min.",
    patient_harm: false,
    severity: "medium",
    status: "resolved",
    reviewed_by: "Dr. Ahmed Al-Rashid",
    resolution:
      "Accepted clinical deviation. No SOP update required - existing exceptions clause covers coagulopathy patients.",
    sop_update_required: false,
    follow_up_required: null,
  },
  {
    id: "exc-003",
    sop_id: "PHARM-MED-007",
    sop_title: "High-Alert Medication Double-Check Protocol",
    reported_by: "Emily Chen RN",
    reporter_role: "nurse",
    department: "Oncology",
    date_reported: "2026-06-20T10:00:00",
    date_of_deviation: "2026-06-20T09:30:00",
    deviation_type: "staffing_constraint",
    description:
      "Double-check for insulin drip not performed due to single-nurse coverage during night shift. Second nurse called but in emergency with another patient.",
    immediate_action_taken:
      "Dose verified by charge nurse telephonically. Patient monitored q30min. No adverse event.",
    patient_harm: false,
    severity: "critical",
    status: "open",
    reviewed_by: null,
    resolution: null,
    sop_update_required: true,
    follow_up_required:
      "Staffing review required. Consider minimum 2-RN coverage for high-alert medication units.",
  },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_META: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]" },
  high: { label: "High", cls: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]" },
  medium: { label: "Medium", cls: "bg-white text-[#475569] border border-[#CBD5E1]" },
  low: { label: "Low", cls: "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]" },
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]" },
  under_review: { label: "Under Review", cls: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]" },
  resolved: { label: "Resolved", cls: "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]" },
  escalated: { label: "Escalated", cls: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]" },
}

const DEVIATION_LABELS: Record<string, string> = {
  equipment_unavailable: "Equipment Unavailable",
  patient_specific_contraindication: "Patient-Specific Contraindication",
  staffing_constraint: "Staffing Constraint",
  emergency_circumstance: "Emergency Circumstance",
  system_failure: "System Failure",
  other: "Other",
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ExceptionCard({ exc }: { exc: ExceptionReport }) {
  const [expanded, setExpanded] = useState(false)
  const { role } = useRole()
  const canReview = role === "compliance_officer" || role === "system_admin"

  const sev = SEVERITY_META[exc.severity] ?? SEVERITY_META.medium
  const st = STATUS_META[exc.status] ?? STATUS_META.open

  return (
    <motion.div
      layout
      className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden"
    >
      {/* Card header */}
      <div className="p-5">
        {/* Top row: badges + title */}
        <div className="flex flex-wrap items-start gap-2 mb-2">
          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide", sev.cls)}>
            {sev.label}
          </span>
          <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide", st.cls)}>
            {st.label}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30">
            {DEVIATION_LABELS[exc.deviation_type] ?? exc.deviation_type}
          </span>
        </div>

        <h3 className="font-medium text-sm mb-1">{exc.sop_title}</h3>
        <p className="text-xs text-muted-foreground">{exc.sop_id}</p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {exc.reported_by}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {fmt(exc.date_reported)}
          </span>
          <span className="flex items-center gap-1">
            <ClipboardList className="w-3 h-3" />
            {exc.department}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-foreground/80 mt-3 leading-relaxed">{exc.description}</p>

        {/* Indicators */}
        <div className="flex flex-wrap gap-3 mt-3">
          <div className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border",
            exc.patient_harm
              ? "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]"
              : "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]"
          )}>
            {exc.patient_harm ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
            {exc.patient_harm ? "Patient Harm Reported" : "No Patient Harm"}
          </div>
          {exc.sop_update_required && (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]">
              <AlertTriangle className="w-3.5 h-3.5" />
              SOP Update Required
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs text-[#0B6BCB] hover:text-[#0959AC] transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Show less" : "Show details"}
        </button>
      </div>

      {/* Expanded section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-[#E2E8F0] pt-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Immediate Action Taken</p>
                <p className="text-sm text-foreground/80">{exc.immediate_action_taken}</p>
              </div>
              {exc.follow_up_required && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Follow-up Required</p>
                  <p className="text-sm text-[#B45309]">{exc.follow_up_required}</p>
                </div>
              )}
              {exc.reviewed_by && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Reviewed By</p>
                  <p className="text-sm text-foreground">{exc.reviewed_by}</p>
                </div>
              )}
              {exc.resolution && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Resolution</p>
                  <p className="text-sm text-[#15803D]">{exc.resolution}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {canReview && exc.status !== "resolved" && (
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors font-medium border border-[#0B6BCB]/30">
                    Review
                  </button>
                )}
                {exc.status !== "resolved" && (
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-[#DCFCE7] text-[#15803D] hover:bg-[#DCFCE7] transition-colors font-medium border border-[#BBF7D0]">
                    Mark Resolved
                  </button>
                )}
                {!exc.sop_update_required && exc.status !== "resolved" && (
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A] transition-colors font-medium border border-[#FDE68A]">
                    Flag for SOP Update
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── submission form ───────────────────────────────────────────────────────────

function SubmitForm({ onClose }: { onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <CheckCircle className="w-10 h-10 text-[#15803D]" />
        <p className="text-sm font-medium">Exception report submitted successfully.</p>
        <p className="text-xs text-muted-foreground">It will be reviewed by the Compliance Officer within 24 hours.</p>
        <button onClick={onClose} className="mt-2 text-xs px-4 py-2 rounded-lg bg-[#0B6BCB] text-white hover:bg-[#0B6BCB] transition-colors">
          Close
        </button>
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">SOP Affected</label>
          <input
            required
            placeholder="e.g. IC-PPE-001"
            className="w-full rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Date and Time of Deviation</label>
          <input
            required
            type="datetime-local"
            className="w-full rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Deviation Type</label>
          <select
            required
            className="w-full rounded-lg bg-white border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60"
          >
            <option value="">Select type...</option>
            <option value="equipment_unavailable">Equipment Unavailable</option>
            <option value="patient_specific_contraindication">Patient-Specific Contraindication</option>
            <option value="staffing_constraint">Staffing Constraint</option>
            <option value="emergency_circumstance">Emergency Circumstance</option>
            <option value="system_failure">System Failure</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Patient Harm?</label>
          <select
            required
            className="w-full rounded-lg bg-white border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60"
          >
            <option value="">Select...</option>
            <option value="no">No patient harm</option>
            <option value="yes">Yes - patient harm occurred</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Description of Deviation</label>
        <textarea
          required
          rows={3}
          placeholder="Describe what happened and why the SOP could not be followed..."
          className="w-full rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60 resize-none"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Immediate Actions Taken</label>
        <textarea
          required
          rows={2}
          placeholder="Describe what was done to mitigate risk..."
          className="w-full rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60 resize-none"
        />
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          className="flex-1 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-semibold transition-colors"
        >
          Submit Exception Report
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl bg-[#F1F5F9] hover:bg-[#F1F5F9] text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ExceptionsPage() {
  const [showForm, setShowForm] = useState(false)

  const open = MOCK_EXCEPTIONS.filter((e) => e.status === "open").length
  const resolved = MOCK_EXCEPTIONS.filter((e) => e.status === "resolved").length
  const critical = MOCK_EXCEPTIONS.filter((e) => e.severity === "critical").length
  const underReview = MOCK_EXCEPTIONS.filter((e) => e.status === "under_review").length

  const stats = [
    { label: "Open Reports", value: open, icon: XCircle, color: "text-[#B91C1C]", bg: "bg-[#FEE2E2]" },
    { label: "Resolved", value: resolved, icon: CheckCircle, color: "text-[#15803D]", bg: "bg-[#DCFCE7]" },
    { label: "Critical", value: critical, icon: AlertTriangle, color: "text-[#B91C1C]", bg: "bg-[#FEE2E2]" },
    { label: "Pending Review", value: underReview, icon: Clock, color: "text-[#B45309]", bg: "bg-[#FEF3C7]" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "SOP Exceptions and Deviations" }]} />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FEE2E2] flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-[#B91C1C]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">SOP Exceptions and Deviations</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Formal deviation reporting per TJC RC.01.02.01
            </p>
          </div>
        </div>

        {/* Research Prototype disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype - Not for Clinical Use.</strong> For demonstration only.</span>
        </div>

        {/* 24-hour notice */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-sm">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            <strong>Policy Notice:</strong> All deviations from approved SOPs must be documented and reviewed within 24 hours per institutional policy.
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

        {/* Exception cards */}
        <section>
          <h2 className="text-lg font-medium mb-3">Exception Reports</h2>
          <div className="space-y-3">
            {MOCK_EXCEPTIONS.map((exc, i) => (
              <motion.div
                key={exc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <ExceptionCard exc={exc} />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Submit new exception */}
        <div className="rounded-2xl bg-white border border-[#E2E8F0] p-5">
          {!showForm ? (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Submit New Exception Report</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Report a deviation from an approved SOP for compliance review
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Report
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">New Exception Report</h3>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <SubmitForm onClose={() => setShowForm(false)} />
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0959AC] text-xs">
          <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Exception reporting requirements per TJC RC.01.02.01. All documented deviations are reviewed by the Compliance Officer and may trigger SOP revision workflows.
          </span>
        </div>
      </div>
    </AppShell>
  )
}
