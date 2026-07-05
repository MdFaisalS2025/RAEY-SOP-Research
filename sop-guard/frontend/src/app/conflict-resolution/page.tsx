"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  X, Plus, FileText, Shield, Users, Calendar,
  AlertCircle, ArrowRight
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_CONFLICTS, MOCK_SOPS } from "@/lib/mock-data"
import { useRole } from "@/lib/role-context"
import type { SOPConflict } from "@/lib/governance-types"

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const WORKFLOW_STEPS = [
  { id: 1, label: "Detect" },
  { id: 2, label: "Triage" },
  { id: 3, label: "Evidence Review" },
  { id: 4, label: "Committee Decision" },
  { id: 5, label: "SOP Update" },
  { id: 6, label: "Audit Close" },
]

function statusToStep(conflict: SOPConflict): number {
  if (conflict.status === "resolved" || conflict.status === "accepted_variance") return 6
  if (conflict.status === "under_review") return 3
  if (conflict.status === "open" && conflict.assigned_to) return 2
  return 1
}

const riskConfig: Record<string, { label: string; className: string; dot: string }> = {
  critical: {
    label: "Critical",
    className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    dot: "bg-[#DC2626]",
  },
  high: {
    label: "High",
    className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
    dot: "bg-[#F59E0B]",
  },
  medium: {
    label: "Medium",
    className: "bg-card text-[#475569] border border-[#CBD5E1]",
    dot: "bg-[#94A3B8]",
  },
  low: {
    label: "Low",
    className: "bg-muted text-[#94A3B8] border border-[#E2E8F0]",
    dot: "bg-[#94A3B8]",
  },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30" },
  under_review: { label: "Under Review", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30" },
  resolved: { label: "Resolved", className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30" },
  accepted_variance: { label: "Accepted Variance", className: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/25" },
}

const conflictTypeLabel: Record<string, string> = {
  contradictory_guidance: "Contradictory Guidance",
  overlapping_scope: "Overlapping Scope",
  terminology_mismatch: "Terminology Mismatch",
  procedure_conflict: "Procedure Conflict",
  dosage_discrepancy: "Dosage Discrepancy",
}

const resolutionTypeLabel: Record<string, string> = {
  sop_a_updated: "SOP A Updated",
  sop_b_updated: "SOP B Updated",
  both_updated: "Both SOPs Updated",
  accepted_variance: "Accepted Variance",
  escalated: "Escalated to CMO",
}

function canAct(role: string) {
  return ["compliance_officer", "committee_member", "system_admin"].includes(role)
}
function isAdmin(role: string) {
  return role === "system_admin"
}

// ─────────────────────────────────────────────
// Mini stepper for conflict cards
// ─────────────────────────────────────────────

function MiniStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {WORKFLOW_STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center gap-0.5">
          <div
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === 0 ? "w-4" : "w-3",
              step.id <= currentStep
                ? "bg-[#0B6BCB]"
                : "bg-[#E2E8F0]"
            )}
            title={step.label}
          />
        </div>
      ))}
      <span className="ml-1.5 text-[10px] text-[#64748B]">
        {WORKFLOW_STEPS[currentStep - 1]?.label}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Conflict Card
// ─────────────────────────────────────────────

function ConflictCard({ conflict, role }: { conflict: SOPConflict; role: string }) {
  const [expanded, setExpanded] = useState(false)
  const step = statusToStep(conflict)
  const risk = riskConfig[conflict.clinical_risk] ?? riskConfig.low
  const status = statusConfig[conflict.status] ?? statusConfig.open
  const isResolved = conflict.status === "resolved" || conflict.status === "accepted_variance"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border p-5 space-y-4 transition-colors",
        isResolved
          ? "bg-[#F0FDF4] border-[#BBF7D0] dark:border-green-500/30"
          : "bg-card border-[#E2E8F0]"
      )}
    >
      {/* Top row: risk badge, conflict type, status */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border", risk.className)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", risk.dot)} />
            {risk.label} Risk
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs border border-[#E2E8F0] text-[#64748B] bg-muted">
            {conflictTypeLabel[conflict.conflict_type] ?? conflict.conflict_type}
          </span>
          <MiniStepper currentStep={step} />
        </div>
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", status.className)}>
          {status.label}
        </span>
      </div>

      {/* Title */}
      <div>
        <h3 className="font-semibold text-[#1A2332] leading-snug">{conflict.title}</h3>
        <p className="text-xs text-[#64748B] mt-1">
          Detected by {conflict.detected_by} &middot; {conflict.detected_date}
        </p>
      </div>

      {/* SOP A vs SOP B */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[140px] rounded-xl bg-muted border border-[#E2E8F0] px-3 py-2">
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest mb-0.5">SOP A</p>
          <p className="text-xs font-medium text-[#1A2332] leading-snug">{conflict.sop_a_title}</p>
          <p className="text-[10px] text-[#0B6BCB] font-mono mt-0.5">{conflict.sop_a_id}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5 px-1">
          <span className="text-xs font-bold text-[#0B6BCB]">vs</span>
          <ArrowRight className="w-3 h-3 text-[#0B6BCB]/50 rotate-0" />
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl bg-muted border border-[#E2E8F0] px-3 py-2">
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest mb-0.5">SOP B</p>
          <p className="text-xs font-medium text-[#1A2332] leading-snug">{conflict.sop_b_title}</p>
          <p className="text-[10px] text-[#0B6BCB] font-mono mt-0.5">{conflict.sop_b_id}</p>
        </div>
      </div>

      {/* Description - expandable */}
      <div>
        <p className={cn("text-sm text-[#64748B] leading-relaxed", !expanded && "line-clamp-2")}>
          {conflict.description}
        </p>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-[#0B6BCB] hover:text-[#0B6BCB] transition-colors mt-1 flex items-center gap-1"
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3" /> Show less</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> Read more</>
          )}
        </button>
      </div>

      {/* Affected departments */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Users className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
        {conflict.affected_departments.map((d) => (
          <span key={d} className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-[#64748B] border border-[#E2E8F0]">
            {d}
          </span>
        ))}
      </div>

      {/* Assigned to */}
      {conflict.assigned_to && (
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <Shield className="w-3.5 h-3.5 text-[#94A3B8]" />
          Assigned to: <span className="text-[#334155] font-medium">{conflict.assigned_to}</span>
        </div>
      )}

      {/* Evidence refs */}
      {conflict.evidence_refs.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <FileText className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
          {conflict.evidence_refs.map((ref) => (
            <span key={ref} className="px-2 py-0.5 rounded-full text-[10px] bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30">
              {ref}
            </span>
          ))}
        </div>
      )}

      {/* Resolution info if resolved */}
      {isResolved && conflict.resolution_notes && (
        <div className="rounded-xl bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 p-3 space-y-1.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[#15803D] dark:text-green-400" />
              <span className="text-xs font-semibold text-[#15803D] dark:text-green-400">Resolved</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {conflict.resolution_type && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30 font-medium">
                  {resolutionTypeLabel[conflict.resolution_type] ?? conflict.resolution_type}
                </span>
              )}
              {conflict.resolved_date && (
                <span className="flex items-center gap-1 text-[10px] text-[#64748B]">
                  <Calendar className="w-3 h-3" /> {conflict.resolved_date}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-[#64748B] leading-relaxed">{conflict.resolution_notes}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        {canAct(role) && !isResolved && (
          <>
            <button className="text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors border border-[#0B6BCB]/30 font-medium">
              Begin Review
            </button>
            <button className="text-xs px-3 py-1.5 rounded-lg bg-muted text-[#334155] hover:bg-[#E2E8F0] transition-colors border border-[#E2E8F0]">
              Assign to Team
            </button>
            <button className="text-xs px-3 py-1.5 rounded-lg bg-muted text-[#334155] hover:bg-[#E2E8F0] transition-colors border border-[#E2E8F0]">
              Create Proposal
            </button>
          </>
        )}
        {isAdmin(role) && !isResolved && (
          <button className="text-xs px-3 py-1.5 rounded-lg bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 hover:bg-[#FECACA] transition-colors border border-[#FECACA] dark:border-red-500/30">
            Close Conflict
          </button>
        )}
        {!canAct(role) && (
          <button className="text-xs px-3 py-1.5 rounded-lg bg-muted text-[#64748B] hover:bg-[#E2E8F0] transition-colors border border-[#E2E8F0]">
            View
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Report New Conflict Modal
// ─────────────────────────────────────────────

function ReportConflictModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (conflict: SOPConflict) => void
}) {
  const [title, setTitle] = useState("")
  const [sopAId, setSopAId] = useState("")
  const [sopBId, setSopBId] = useState("")
  const [conflictType, setConflictType] = useState<SOPConflict["conflict_type"]>("contradictory_guidance")
  const [description, setDescription] = useState("")
  const [clinicalRisk, setClinicalRisk] = useState<SOPConflict["clinical_risk"]>("medium")
  const [submitted, setSubmitted] = useState(false)

  const sopATitle = MOCK_SOPS.find((s) => s.sop_id === sopAId)?.title ?? sopAId
  const sopBTitle = MOCK_SOPS.find((s) => s.sop_id === sopBId)?.title ?? sopBId

  const handleSubmit = () => {
    if (!title || !sopAId || !sopBId || !description) return
    const newConflict: SOPConflict = {
      id: `conflict-${Date.now()}`,
      title,
      sop_a_id: sopAId,
      sop_a_title: sopATitle,
      sop_b_id: sopBId,
      sop_b_title: sopBTitle,
      conflict_type: conflictType,
      description,
      affected_departments: [],
      clinical_risk: clinicalRisk,
      detected_date: new Date().toISOString().slice(0, 10),
      detected_by: "Current User",
      status: "open",
      assigned_to: null,
      resolution_notes: null,
      resolved_date: null,
      resolution_type: null,
      proposal_ids: [],
      evidence_refs: [],
    }
    onSubmit(newConflict)
    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-lg rounded-2xl bg-muted border border-[#E2E8F0] shadow-md overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-card border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#B45309] dark:text-amber-400" />
            <span className="font-semibold text-sm">Report New Conflict</span>
          </div>
          <button onClick={onClose} aria-label="Close report new conflict form" className="text-[#64748B] hover:text-[#0B6BCB] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8">
            <div className="w-14 h-14 rounded-full bg-[#0B6BCB]/10 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-[#0B6BCB]" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-[#1A2332]">Conflict Reported</p>
              <p className="text-sm text-[#64748B] mt-1">
                The conflict has been logged and is now open for triage.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#0B6BCB]/10 text-[#0B6BCB] text-sm font-medium hover:bg-[#0B6BCB]/20 transition-colors border border-[#0B6BCB]/30"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs text-[#64748B] mb-1.5 font-medium">Conflict Title <span className="text-[#B91C1C] dark:text-red-400">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief description of the conflict..."
                className="w-full px-3 py-2 rounded-xl bg-card border border-[#E2E8F0] text-sm text-[#1A2332] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0B6BCB]/30 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#64748B] mb-1.5 font-medium">SOP A <span className="text-[#B91C1C] dark:text-red-400">*</span></label>
                <select
                  value={sopAId}
                  onChange={(e) => setSopAId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-[#E2E8F0] text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/30 transition-colors"
                >
                  <option value="">Select SOP A...</option>
                  {MOCK_SOPS.map((s) => (
                    <option key={s.sop_id} value={s.sop_id}>{s.sop_id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1.5 font-medium">SOP B <span className="text-[#B91C1C] dark:text-red-400">*</span></label>
                <select
                  value={sopBId}
                  onChange={(e) => setSopBId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-[#E2E8F0] text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/30 transition-colors"
                >
                  <option value="">Select SOP B...</option>
                  {MOCK_SOPS.map((s) => (
                    <option key={s.sop_id} value={s.sop_id}>{s.sop_id}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#64748B] mb-1.5 font-medium">Conflict Type</label>
                <select
                  value={conflictType}
                  onChange={(e) => setConflictType(e.target.value as SOPConflict["conflict_type"])}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-[#E2E8F0] text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/30 transition-colors"
                >
                  {Object.entries(conflictTypeLabel).map(([val, lbl]) => (
                    <option key={val} value={val}>{lbl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1.5 font-medium">Clinical Risk</label>
                <select
                  value={clinicalRisk}
                  onChange={(e) => setClinicalRisk(e.target.value as SOPConflict["clinical_risk"])}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-[#E2E8F0] text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/30 transition-colors"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#64748B] mb-1.5 font-medium">Description <span className="text-[#B91C1C] dark:text-red-400">*</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe the specific conflict and its clinical impact..."
                className="w-full px-3 py-2 rounded-xl bg-card border border-[#E2E8F0] text-sm text-[#1A2332] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0B6BCB]/30 transition-colors resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-1 pb-1">
              <button
                onClick={handleSubmit}
                disabled={!title || !sopAId || !sopBId || !description}
                className="flex-1 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
              >
                Submit Conflict
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-muted text-[#334155] hover:bg-[#E2E8F0] text-sm font-medium transition-colors border border-[#E2E8F0]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function ConflictResolutionPage() {
  const { role } = useRole()
  const [conflicts, setConflicts] = useState<SOPConflict[]>(MOCK_CONFLICTS)
  const [showReportModal, setShowReportModal] = useState(false)

  const openConflicts = conflicts.filter((c) => c.status === "open")
  const reviewConflicts = conflicts.filter((c) => c.status === "under_review")
  const resolvedConflicts = conflicts.filter(
    (c) => c.status === "resolved" || c.status === "accepted_variance"
  )
  const criticalCount = conflicts.filter((c) => c.clinical_risk === "critical").length

  const handleNewConflict = (conflict: SOPConflict) => {
    setConflicts((prev) => [conflict, ...prev])
    setTimeout(() => setShowReportModal(false), 1800)
  }

  const overallStats = [
    { label: "Open Conflicts", value: openConflicts.length, color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10" },
    { label: "Under Review", value: reviewConflicts.length, color: "text-[#B45309] dark:text-amber-400", bg: "bg-[#FEF3C7] dark:bg-amber-500/10" },
    { label: "Resolved", value: resolvedConflicts.length, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
    { label: "Clinical Risk: Critical", value: criticalCount, color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Modals */}
        <AnimatePresence>
          {showReportModal && (
            <ReportConflictModal
              onClose={() => setShowReportModal(false)}
              onSubmit={handleNewConflict}
            />
          )}
        </AnimatePresence>

        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: "Conflict Resolution" }]} />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FEF3C7] dark:bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#B45309] dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">SOP Conflict Resolution</h1>
              <p className="text-sm text-[#64748B]">
                Resolve contradictory guidance between SOPs.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Report Conflict
          </button>
        </div>

        {/* Alert banner */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#B45309] dark:text-amber-400" />
          <span>
            Unresolved conflicts create patient safety risk. Each must be resolved by committee before the next accreditation survey.
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {overallStats.map((s) => (
            <div
              key={s.label}
              className={cn("rounded-2xl border border-[#E2E8F0] p-4", s.bg)}
            >
              <p className={cn("text-3xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-[#64748B] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Workflow stepper */}
        <section>
          <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-3">
            Resolution Workflow
          </h2>
          <div className="rounded-2xl bg-card border border-[#E2E8F0] p-5">
            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={step.id} className="flex items-center gap-1 min-w-max">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-7 h-7 rounded-full bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-[#0B6BCB]">{step.id}</span>
                    </div>
                    <span className="text-[10px] text-[#64748B] whitespace-nowrap">{step.label}</span>
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <div className="h-px w-8 bg-[#E2E8F0] mb-4" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Open conflicts */}
        {openConflicts.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#DC2626]" />
              <h2 className="text-base font-semibold font-display">Open Conflicts ({openConflicts.length})</h2>
            </div>
            {openConflicts.map((c) => (
              <ConflictCard key={c.id} conflict={c} role={role} />
            ))}
          </section>
        )}

        {/* Under review conflicts */}
        {reviewConflicts.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <h2 className="text-base font-semibold font-display">Under Review ({reviewConflicts.length})</h2>
            </div>
            {reviewConflicts.map((c) => (
              <ConflictCard key={c.id} conflict={c} role={role} />
            ))}
          </section>
        )}

        {/* Resolved conflicts */}
        {resolvedConflicts.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
              <h2 className="text-base font-semibold font-display">Resolved ({resolvedConflicts.length})</h2>
            </div>
            {resolvedConflicts.map((c) => (
              <ConflictCard key={c.id} conflict={c} role={role} />
            ))}
          </section>
        )}

        {/* Resolution Guide */}
        <section>
          <h2 className="text-base font-semibold font-display mb-3">Resolution Guide</h2>
          <div className="rounded-2xl bg-card border border-[#E2E8F0] divide-y divide-[#EDF1F5] overflow-hidden">
            {[
              {
                approach: "Update SOP A to align with SOP B",
                desc: "Use when SOP B is more recent, evidence-based, or is the governing primary protocol.",
                color: "text-[#0B6BCB]",
              },
              {
                approach: "Update SOP B to align with SOP A",
                desc: "Use when SOP A is the primary or master protocol and SOP B is a derivative or department supplement.",
                color: "text-[#0B6BCB]",
              },
              {
                approach: "Update both SOPs with cross-references",
                desc: "Use when each SOP covers distinct scenarios that coexist with explicit cross-referencing.",
                color: "text-[#0B6BCB]",
              },
              {
                approach: "Accept as legitimate clinical variance",
                desc: "Use when guidance applies to different patient populations. Document the variance and scope boundaries in both SOPs.",
                color: "text-[#B45309] dark:text-amber-400",
              },
              {
                approach: "Escalate to CMO / Chief Medical Officer",
                desc: "Use for significant clinical risk, legal implications, or committee deadlock.",
                color: "text-[#B91C1C] dark:text-red-400",
              },
            ].map((item) => (
              <div key={item.approach} className="px-5 py-4 flex gap-3">
                <ArrowRight className={cn("w-4 h-4 mt-0.5 shrink-0", item.color)} />
                <div>
                  <p className={cn("text-sm font-semibold", item.color)}>{item.approach}</p>
                  <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
