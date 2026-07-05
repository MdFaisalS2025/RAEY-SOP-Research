"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle, CheckCircle, Clock, FileText,
  ChevronDown, ChevronUp, X, ExternalLink, Plus, AlertOctagon
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_SOPS } from "@/lib/mock-data"

// ─── Inline data ──────────────────────────────────────────────────────────────

const MOCK_INCIDENTS = [
  {
    id: "inc-001",
    date: "2026-06-28",
    type: "near_miss",
    title: "PPE shortage during isolation patient admission",
    description:
      "N95 supply depleted during night shift. Staff used surgical masks for aerosol-generating procedure.",
    department: "ICU",
    severity: "high",
    reporter: "Night Shift Charge Nurse",
    linked_sop_ids: ["IC-PPE-001"],
    linked_sop_titles: ["High-Risk Respiratory Isolation + PPE Protocol"],
    sop_review_status: "in_review",
    recommendation:
      "Review PPE stockpile thresholds and reorder triggers in IC-PPE-001",
    outcome: "No patient harm. SOP review initiated.",
    proposal_created: true,
    proposal_id: "prop-001",
  },
  {
    id: "inc-002",
    date: "2026-06-25",
    type: "adverse_event",
    title: "Delayed sepsis bundle initiation",
    description:
      "1-hour bundle initiated at 82 minutes due to blood culture delay. Lactate not drawn concurrently.",
    department: "Emergency",
    severity: "critical",
    reporter: "Dr. Sarah Mitchell",
    linked_sop_ids: ["ICU-SEP-002"],
    linked_sop_titles: ["Sepsis Early Recognition and 1-Hour Bundle"],
    sop_review_status: "completed",
    recommendation:
      "Add concurrent lactate + culture step to SOP. Clarify lab ordering sequence.",
    outcome: "Patient recovered. SOP updated in next review cycle.",
    proposal_created: false,
    proposal_id: null,
  },
  {
    id: "inc-003",
    date: "2026-06-20",
    type: "near_miss",
    title: "High-alert medication administered without double-check",
    description:
      "Insulin drip rate changed without second-nurse verification due to staffing shortage.",
    department: "Oncology",
    severity: "critical",
    reporter: "Emily Chen RN",
    linked_sop_ids: ["PHARM-MED-007"],
    linked_sop_titles: ["High-Alert Medication Double-Check Protocol"],
    sop_review_status: "in_review",
    recommendation:
      "Address single-nurse coverage scenarios in SOP. Add telephonic verification protocol.",
    outcome:
      "No adverse outcome. Escalated to pharmacy and nursing leadership.",
    proposal_created: false,
    proposal_id: null,
  },
  {
    id: "inc-004",
    date: "2026-06-15",
    type: "sentinel_event",
    title: "Patient fall with injury during Morse scale assessment",
    description:
      "Patient scored 65 (high risk) but fall prevention measures not implemented per SOP timing requirements.",
    department: "Medical Ward",
    severity: "critical",
    reporter: "Ward Nurse Manager",
    linked_sop_ids: ["HVAP-FALL-004"],
    linked_sop_titles: ["Patient Fall Risk Assessment - Morse Scale Protocol"],
    sop_review_status: "completed",
    recommendation:
      "Tighten SOP timing: prevention measures within 1 hour of assessment, not 4 hours.",
    outcome: "Minor injury. Root cause analysis completed. SOP revision underway.",
    proposal_created: true,
    proposal_id: "prop-002",
  },
  {
    id: "inc-005",
    date: "2026-06-10",
    type: "near_miss",
    title: "MRI patient with undisclosed implant",
    description:
      "Patient with cardiac device not identified during pre-MRI screening. Caught by radiographer before scan.",
    department: "Radiology",
    severity: "high",
    reporter: "Senior Radiographer",
    linked_sop_ids: ["RAD-MRI-008"],
    linked_sop_titles: ["MRI Safety Screening and Patient Preparation"],
    sop_review_status: "pending",
    recommendation:
      "Add mandatory electronic implant registry check to pre-MRI screening SOP.",
    outcome: "No harm. Screening SOP flagged for urgent review.",
    proposal_created: false,
    proposal_id: null,
  },
]

const PATTERN_ALERTS = [
  {
    id: "pa-001",
    text: "3 incidents in 30 days linked to IC-PPE-001 - consider urgent SOP review",
  },
  {
    id: "pa-002",
    text: "2 critical incidents linked to medication double-check protocol - staffing gap pattern detected",
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INCIDENT_TYPE_META: Record<string, { label: string; className: string }> = {
  near_miss: {
    label: "Near Miss",
    className: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]",
  },
  adverse_event: {
    label: "Adverse Event",
    className: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]",
  },
  sentinel_event: {
    label: "Sentinel Event",
    className: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]",
  },
}

const SEVERITY_META: Record<string, { label: string; className: string }> = {
  high: {
    label: "High",
    className: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]",
  },
  critical: {
    label: "Critical",
    className: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]",
  },
  medium: {
    label: "Medium",
    className: "bg-white text-[#64748B] border border-[#CBD5E1]",
  },
  low: {
    label: "Low",
    className: "bg-white text-[#94A3B8] border border-[#EDF1F5]",
  },
}

const REVIEW_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-white text-[#64748B] border border-[#CBD5E1]",
  },
  in_review: {
    label: "In Review",
    className: "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]",
  },
  completed: {
    label: "Completed",
    className: "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]",
  },
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ReportModalProps {
  onClose: () => void
}

function ReportModal({ onClose }: ReportModalProps) {
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white border border-[#E2E8F0] rounded-2xl p-8 w-full max-w-sm text-center"
        >
          <CheckCircle className="w-12 h-12 text-[#15803D] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[#1A2332] mb-2">Report Submitted</h3>
          <p className="text-sm text-[#64748B] mb-4">
            Your incident report has been submitted. Relevant SOPs will be flagged for review.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-[#0B6BCB] text-white text-sm font-medium hover:bg-[#0959AC] transition-colors"
          >
            Close
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border border-[#E2E8F0] rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#1A2332]">Report New Incident</h3>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#334155] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#64748B] mb-1 block">Incident Type</label>
            <select className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/50">
              <option value="near_miss">Near Miss</option>
              <option value="adverse_event">Adverse Event</option>
              <option value="sentinel_event">Sentinel Event</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">Date / Time</label>
              <input
                type="datetime-local"
                className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/50"
              />
            </div>
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">Severity</label>
              <select className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/50">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#64748B] mb-1 block">Department</label>
            <select className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/50">
              <option>ICU</option>
              <option>Emergency</option>
              <option>Oncology</option>
              <option>Nursing</option>
              <option>Radiology</option>
              <option>Pharmacy</option>
              <option>Medical Ward</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748B] mb-1 block">Brief Description</label>
            <textarea
              rows={3}
              placeholder="Describe what happened..."
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/50 resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-[#64748B] mb-1 block">Related SOP</label>
            <select className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/50">
              <option value="">-- Select SOP (optional) --</option>
              {MOCK_SOPS.map((sop) => (
                <option key={sop.sop_id} value={sop.sop_id}>
                  {sop.sop_id} - {sop.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#64748B] mb-1 block">Immediate Actions Taken</label>
            <textarea
              rows={2}
              placeholder="What was done immediately after the incident..."
              className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/50 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => setSubmitted(true)}
            className="flex-1 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-semibold transition-colors"
          >
            Submit Report
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#F1F5F9] text-[#64748B] text-sm font-medium hover:bg-[#F1F5F9] transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [proposalCreated, setProposalCreated] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreateProposal = (id: string) => {
    setProposalCreated((prev) => new Set(prev).add(id))
  }

  const stats = [
    { label: "Incidents This Month", value: "12", color: "text-[#B91C1C]", bg: "bg-[#FEE2E2]" },
    { label: "Linked to SOPs", value: "9", color: "text-[#B45309]", bg: "bg-[#FEF3C7]" },
    { label: "SOPs Under Review", value: "3", color: "text-[#0B6BCB]", bg: "bg-[#0B6BCB]/10" },
    { label: "Closed Loop", value: "6", color: "text-[#15803D]", bg: "bg-[#DCFCE7]" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Incident to SOP Feedback" }]} />

        {showModal && <ReportModal onClose={() => setShowModal(false)} />}

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FEE2E2] flex items-center justify-center shrink-0">
              <AlertOctagon className="w-6 h-6 text-[#B91C1C]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-[#1A2332] font-display">
                Incident to SOP Feedback
              </h1>
              <p className="text-sm text-[#64748B] mt-0.5">
                Linking patient safety incidents to SOP review and improvement
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-semibold transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Report New Incident
          </button>
        </div>

        {/* Note */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0959AC] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Incident reports trigger automatic SOP review suggestions. This closes the patient safety
            learning loop.
          </span>
        </div>

        {/* How it works */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              step: "1",
              label: "Incident Reported",
              desc: "Staff submits safety event or near-miss",
              color: "text-[#B91C1C]",
              bg: "bg-[#FEE2E2]",
              border: "border-[#FECACA]",
            },
            {
              step: "2",
              label: "SOP Auto-Suggested",
              desc: "System identifies relevant SOPs by keyword match",
              color: "text-[#B45309]",
              bg: "bg-[#FEF3C7]",
              border: "border-[#FDE68A]",
            },
            {
              step: "3",
              label: "Review Initiated",
              desc: "Committee reviews SOP for necessary updates",
              color: "text-[#15803D]",
              bg: "bg-[#DCFCE7]",
              border: "border-[#BBF7D0]",
            },
          ].map((item) => (
            <div
              key={item.step}
              className={cn(
                "bg-white border rounded-xl p-4 flex items-start gap-3",
                item.border
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  item.bg,
                  item.color
                )}
              >
                {item.step}
              </div>
              <div>
                <p className={cn("text-sm font-semibold", item.color)}>{item.label}</p>
                <p className="text-xs text-[#64748B] mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={cn("bg-white border border-[#E2E8F0] rounded-xl p-4", s.bg)}
            >
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-[#64748B] mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Incidents list */}
        <section>
          <h2 className="text-lg font-medium text-[#1A2332] mb-3">
            Recent Incidents with SOP Links
          </h2>
          <div className="space-y-4">
            {MOCK_INCIDENTS.map((inc, i) => {
              const isExpanded = expandedIds.has(inc.id)
              const proposalDone =
                inc.proposal_created || proposalCreated.has(inc.id)

              return (
                <motion.div
                  key={inc.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            INCIDENT_TYPE_META[inc.type]?.className
                          )}
                        >
                          {INCIDENT_TYPE_META[inc.type]?.label}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            SEVERITY_META[inc.severity]?.className
                          )}
                        >
                          {SEVERITY_META[inc.severity]?.label} Severity
                        </span>
                        <span className="text-xs text-[#94A3B8]">{inc.department}</span>
                        <span className="text-xs text-[#94A3B8]">{inc.date}</span>
                        <span className="text-xs text-[#94A3B8]">- {inc.reporter}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[#1A2332]">{inc.title}</h3>
                    </div>
                    <button
                      onClick={() => toggleExpand(inc.id)}
                      className="text-[#64748B] hover:text-[#334155] transition-colors shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Description (truncated unless expanded) */}
                  <p
                    className={cn(
                      "text-xs text-[#64748B] leading-relaxed",
                      !isExpanded && "line-clamp-2"
                    )}
                  >
                    {inc.description}
                  </p>

                  {/* Linked SOPs */}
                  <div>
                    <p className="text-xs text-[#94A3B8] mb-1.5">Linked SOPs</p>
                    <div className="flex flex-wrap gap-1.5">
                      {inc.linked_sop_ids.map((sopId) => (
                        <span
                          key={sopId}
                          title={inc.linked_sop_titles[inc.linked_sop_ids.indexOf(sopId)]}
                          className="text-xs text-[#0B6BCB] border border-[#0B6BCB]/30 bg-[#0B6BCB]/10 rounded px-2 py-0.5"
                        >
                          {sopId}
                        </span>
                      ))}
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          REVIEW_STATUS_META[inc.sop_review_status]?.className
                        )}
                      >
                        {REVIEW_STATUS_META[inc.sop_review_status]?.label}
                      </span>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="border-l-2 border-[#0B6BCB]/30 pl-3">
                    <p className="text-xs italic text-[#0959AC] leading-relaxed">
                      Recommendation: {inc.recommendation}
                    </p>
                  </div>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2 space-y-2 border-t border-[#EDF1F5]">
                          <div>
                            <p className="text-xs text-[#94A3B8]">Outcome</p>
                            <p className="text-xs text-[#334155] mt-0.5">{inc.outcome}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Footer actions */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {proposalDone ? (
                      <span className="flex items-center gap-1 text-xs text-[#15803D] bg-[#DCFCE7] border border-[#BBF7D0] rounded-full px-2.5 py-0.5">
                        <CheckCircle className="w-3 h-3" /> Proposal Created
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCreateProposal(inc.id)}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 border border-[#0B6BCB]/30 transition-colors font-medium"
                      >
                        <Plus className="w-3 h-3" /> Create Proposal
                      </button>
                    )}
                    <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] text-[#64748B] hover:bg-[#F1F5F9] border border-[#E2E8F0] transition-colors">
                      <ExternalLink className="w-3 h-3" /> View Linked SOP
                    </button>
                    <button
                      onClick={() => toggleExpand(inc.id)}
                      className="text-xs text-[#94A3B8] hover:text-[#334155] transition-colors"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* Pattern Detection */}
        <section>
          <h2 className="text-lg font-medium text-[#1A2332] mb-3">Pattern Detection</h2>
          <div className="space-y-3">
            {PATTERN_ALERTS.map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FEF3C7] border border-[#FDE68A]"
              >
                <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                <p className="text-sm text-[#B45309]">{alert.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Report button (bottom) */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-semibold transition-colors"
          >
            <FileText className="w-4 h-4" /> Report New Incident
          </button>
        </div>
      </div>
    </AppShell>
  )
}
