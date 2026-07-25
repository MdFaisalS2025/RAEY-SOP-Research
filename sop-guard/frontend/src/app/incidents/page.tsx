"use client"

import { useEffect, useState, type FormEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle, CheckCircle, XCircle, Clock, Shield, User, Calendar, ClipboardList,
  ChevronDown, ChevronUp, X, ExternalLink, Plus, AlertOctagon, Loader2, ClipboardCheck,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SafetyNote } from "@/components/ui/safety-note"
import { cn } from "@/lib/utils"
import { MOCK_SOPS } from "@/lib/mock-data"
import { useRole } from "@/lib/role-context"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

// ─── Incidents: real backend shapes (app/api/routes_capa.py) ─────────────────

interface CAPA {
  id: number
  incident_id: number
  title: string
  root_cause: string
  corrective_action: string
  preventive_action: string
  status: "open" | "investigating" | "action_planned" | "closed"
  owner: string
  due_date: string
  linked_proposal_id: number | null
  created_at: string | null
  updated_at: string | null
  closed_at: string | null
}

interface Incident {
  id: number
  incident_type: string
  title: string
  description: string
  department: string
  severity: string
  reporter: string
  linked_sop_ids: string[]
  occurred_at: string | null
  created_at: string | null
  capa_count: number
  open_capa_count: number
}

// Computed live from the real incident list below (see computePatternAlerts) -
// previously a static array with canned counts/SOP IDs that didn't track
// what incidents actually existed, so the message could (and did) cite a
// count higher than the number of matching incidents actually on screen.
function computePatternAlerts(incidents: Incident[]): { id: string; text: string }[] {
  const alerts: { id: string; text: string }[] = []

  const bySopId = new Map<string, number>()
  for (const inc of incidents) {
    for (const sopId of inc.linked_sop_ids) {
      bySopId.set(sopId, (bySopId.get(sopId) ?? 0) + 1)
    }
  }
  for (const [sopId, count] of Array.from(bySopId)) {
    if (count >= 2) {
      alerts.push({
        id: `pa-sop-${sopId}`,
        text: `${count} incidents linked to ${sopId} - consider urgent SOP review`,
      })
    }
  }

  const criticalCount = incidents.filter((i) => i.severity === "critical").length
  if (criticalCount >= 2) {
    alerts.push({
      id: "pa-critical",
      text: `${criticalCount} critical-severity incidents recorded - review for common contributing factors`,
    })
  }

  return alerts
}

const INCIDENT_TYPE_META: Record<string, { label: string; className: string }> = {
  near_miss: {
    label: "Near Miss",
    className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
  },
  adverse_event: {
    label: "Adverse Event",
    className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
  },
  sentinel_event: {
    label: "Sentinel Event",
    className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
  },
}

const SEVERITY_META: Record<string, { label: string; className: string }> = {
  high: {
    label: "High",
    className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
  },
  critical: {
    label: "Critical",
    className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
  },
  medium: {
    label: "Medium",
    className: "bg-card text-muted-foreground border border-input",
  },
  low: {
    label: "Low",
    className: "bg-card text-subtle border border-border",
  },
}

const REVIEW_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-card text-muted-foreground border border-input",
  },
  in_review: {
    label: "In Review",
    className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
  },
  completed: {
    label: "Completed",
    className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30",
  },
}

interface ReportModalProps {
  onClose: () => void
  onCreated: (i: Incident) => void
}

function ReportModal({ onClose, onCreated }: ReportModalProps) {
  const [submitted, setSubmitted] = useState(false)
  const [incidentType, setIncidentType] = useState("near_miss")
  const [severity, setSeverity] = useState("medium")
  const [department, setDepartment] = useState("ICU")
  const [description, setDescription] = useState("")
  const [relatedSop, setRelatedSop] = useState("")
  const [reporter, setReporter] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit() {
    if (!description.trim()) {
      setError("Please describe what happened.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE}/api/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_type: incidentType,
          title: description.trim().slice(0, 120),
          description: description.trim(),
          department,
          severity,
          reporter: reporter.trim() || "Anonymous",
          linked_sop_ids: relatedSop ? [relatedSop] : [],
        }),
      })
      if (!res.ok) throw new Error("Failed to submit")
      const created: Incident = await res.json()
      onCreated(created)
      setSubmitted(true)
    } catch {
      setError("Could not submit the report. Is the backend running?")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm text-center"
        >
          <CheckCircle className="w-12 h-12 text-[#15803D] dark:text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Report Submitted</h3>
          <p className="text-sm text-muted-foreground mb-4">
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
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Report New Incident</h3>
          <button onClick={onClose} aria-label="Close report new incident form" className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Incident Type</label>
            <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#0B6BCB]/50">
              <option value="near_miss">Near Miss</option>
              <option value="adverse_event">Adverse Event</option>
              <option value="sentinel_event">Sentinel Event</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Reported By</label>
              <input value={reporter} onChange={(e) => setReporter(e.target.value)} placeholder="Your name"
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#0B6BCB]/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#0B6BCB]/50">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#0B6BCB]/50">
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
            <label className="text-xs text-muted-foreground mb-1 block">Brief Description</label>
            <textarea
              rows={3}
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened..."
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#0B6BCB]/50 resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Related SOP</label>
            <select value={relatedSop} onChange={(e) => setRelatedSop(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#0B6BCB]/50">
              <option value="">-- Select SOP (optional) --</option>
              {MOCK_SOPS.map((sop) => (
                <option key={sop.sop_id} value={sop.sop_id}>
                  {sop.sop_id} - {sop.title}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Report
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const CAPA_STATUS_META: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-card text-muted-foreground border border-input" },
  investigating: { label: "Investigating", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30" },
  action_planned: { label: "Action Planned", className: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30" },
  closed: { label: "Closed", className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30" },
}

function CAPAEditor({ capa, onSaved }: { capa: CAPA; onSaved: () => void }) {
  const [rootCause, setRootCause] = useState(capa.root_cause)
  const [correctiveAction, setCorrectiveAction] = useState(capa.corrective_action)
  const [preventiveAction, setPreventiveAction] = useState(capa.preventive_action)
  const [owner, setOwner] = useState(capa.owner)
  const [dueDate, setDueDate] = useState(capa.due_date)
  const [status, setStatus] = useState(capa.status)
  const [saving, setSaving] = useState(false)
  const [creatingProposal, setCreatingProposal] = useState(false)

  async function save(overrides?: Partial<{ status: string }>) {
    setSaving(true)
    try {
      await fetch(`${API_BASE}/api/capa/${capa.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          root_cause: rootCause,
          corrective_action: correctiveAction,
          preventive_action: preventiveAction,
          owner,
          due_date: dueDate,
          status: overrides?.status ?? status,
        }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function createLinkedProposal() {
    setCreatingProposal(true)
    try {
      const res = await fetch(`${API_BASE}/api/governance/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: capa.title || "SOP change from CAPA",
          ai_summary: `Preventive action from CAPA #${capa.id}: ${preventiveAction}`,
          payload: { new_text: preventiveAction },
        }),
      })
      const proposal = await res.json()
      await fetch(`${API_BASE}/api/capa/${capa.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linked_proposal_id: proposal.id, status: "action_planned" }),
      })
      onSaved()
    } finally {
      setCreatingProposal(false)
    }
  }

  return (
    <div className="rounded-xl bg-muted border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CAPA_STATUS_META[status]?.className)}>
            {CAPA_STATUS_META[status]?.label}
          </span>
          {capa.linked_proposal_id && (
            <a href={`/proposals/${capa.linked_proposal_id}`} className="text-xs text-[#0B6BCB] hover:underline inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Linked Proposal #{capa.linked_proposal_id}
            </a>
          )}
        </div>
        <select value={status} onChange={(e) => { const v = e.target.value as CAPA["status"]; setStatus(v); save({ status: v }) }}
          className="text-xs bg-card border border-border rounded-lg px-2 py-1">
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="action_planned">Action Planned</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div>
        <label className="text-[11px] text-subtle mb-1 block">Root Cause</label>
        <textarea rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} onBlur={() => save()}
          placeholder="Why did this happen?"
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground resize-none" />
      </div>
      <div>
        <label className="text-[11px] text-subtle mb-1 block">Corrective Action</label>
        <textarea rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} onBlur={() => save()}
          placeholder="What was done to fix the immediate issue?"
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground resize-none" />
      </div>
      <div>
        <label className="text-[11px] text-subtle mb-1 block">Preventive Action</label>
        <textarea rows={2} value={preventiveAction} onChange={(e) => setPreventiveAction(e.target.value)} onBlur={() => save()}
          placeholder="What will stop this from happening again? (e.g. an SOP change)"
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-subtle mb-1 block">Owner</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} onBlur={() => save()}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground" />
        </div>
        <div>
          <label className="text-[11px] text-subtle mb-1 block">Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} onBlur={() => save()}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground" />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {saving && <span className="text-[11px] text-subtle flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>}
        {!capa.linked_proposal_id && preventiveAction.trim() && (
          <button onClick={createLinkedProposal} disabled={creatingProposal}
            className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 border border-[#0B6BCB]/30 transition-colors font-medium disabled:opacity-50">
            {creatingProposal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Create SOP Change Proposal
          </button>
        )}
      </div>
    </div>
  )
}

function CAPAPanel({ incidentId, incidentTitle, onChange }: { incidentId: number; incidentTitle: string; onChange: () => void }) {
  const [capas, setCapas] = useState<CAPA[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [creating, setCreating] = useState(false)

  function load() {
    setLoading(true)
    setLoadError(false)
    fetch(`${API_BASE}/api/incidents/${incidentId}/capa`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setCapas(Array.isArray(data?.capas) ? data.capas : []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [incidentId])

  async function openCapa() {
    setCreating(true)
    try {
      await fetch(`${API_BASE}/api/incidents/${incidentId}/capa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `CAPA for: ${incidentTitle}` }),
      })
      load()
      onChange()
    } finally {
      setCreating(false)
    }
  }

  function handleSaved() {
    load()
    onChange()
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading CAPA...</div>
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Corrective & Preventive Actions</p>
        <button onClick={openCapa} disabled={creating}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-50 text-white font-medium transition-colors">
          {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Open CAPA
        </button>
      </div>
      {loadError && <ErrorState message="Couldn't load CAPA records." onRetry={load} />}
      {!loadError && capas.length === 0 && (
        <p className="text-xs text-subtle">No CAPA opened yet for this incident.</p>
      )}
      {capas.map((c) => (
        <CAPAEditor key={c.id} capa={c} onSaved={handleSaved} />
      ))}
    </div>
  )
}

function IncidentsTab() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [showModal, setShowModal] = useState(false)

  function loadIncidents() {
    setLoading(true)
    setLoadError(false)
    fetch(`${API_BASE}/api/incidents`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setIncidents(Array.isArray(data?.incidents) ? data.incidents : []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadIncidents() }, [])

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const linkedCount = incidents.filter((i) => i.linked_sop_ids.length > 0).length
  const underReviewCount = incidents.filter((i) => i.open_capa_count > 0).length
  const closedLoopCount = incidents.filter((i) => i.capa_count > 0 && i.open_capa_count === 0).length
  const patternAlerts = computePatternAlerts(incidents)

  const stats = [
    { label: "Total Incidents", value: String(incidents.length), color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10" },
    { label: "Linked to SOPs", value: String(linkedCount), color: "text-[#B45309] dark:text-amber-400", bg: "bg-[#FEF3C7] dark:bg-amber-500/10" },
    { label: "CAPA In Progress", value: String(underReviewCount), color: "text-[#0B6BCB]", bg: "bg-[#0B6BCB]/10" },
    { label: "Closed Loop", value: String(closedLoopCount), color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
  ]

  return (
    <div className="space-y-6">
      {showModal && (
        <ReportModal
          onClose={() => setShowModal(false)}
          onCreated={() => { loadIncidents() }}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Linking patient safety incidents to SOP review and improvement. Incident reports trigger automatic SOP
          review suggestions, closing the patient safety learning loop.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-semibold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Report New Incident
        </button>
      </div>

      {/* How it works */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          {
            step: "1",
            label: "Incident Reported",
            desc: "Staff submits safety event or near-miss",
            color: "text-[#B91C1C] dark:text-red-400",
            bg: "bg-[#FEE2E2] dark:bg-red-500/10",
            border: "border-[#FECACA] dark:border-red-500/30",
          },
          {
            step: "2",
            label: "SOP Auto-Suggested",
            desc: "System identifies relevant SOPs by keyword match",
            color: "text-[#B45309] dark:text-amber-400",
            bg: "bg-[#FEF3C7] dark:bg-amber-500/10",
            border: "border-[#FDE68A] dark:border-amber-500/30",
          },
          {
            step: "3",
            label: "Review Initiated",
            desc: "Committee reviews SOP for necessary updates",
            color: "text-[#15803D] dark:text-green-400",
            bg: "bg-[#DCFCE7] dark:bg-green-500/10",
            border: "border-[#BBF7D0] dark:border-green-500/30",
          },
        ].map((item) => (
          <div
            key={item.step}
            className={cn(
              "bg-card border rounded-xl p-4 flex items-start gap-3",
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
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
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
            className={cn("bg-card border border-border rounded-xl p-4", s.bg)}
          >
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Incidents list */}
      <section>
        <h2 className="text-lg font-medium text-foreground mb-3">
          Recent Incidents with SOP Links
        </h2>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading incidents...
          </div>
        )}
        {!loading && loadError && (
          <ErrorState message="Couldn't load incidents." onRetry={loadIncidents} />
        )}
        {!loading && !loadError && incidents.length === 0 && (
          <EmptyState icon={AlertOctagon} title="No incidents reported yet." />
        )}
        <div className="space-y-4">
          {incidents.map((inc, i) => {
            const isExpanded = expandedIds.has(inc.id)
            const reviewStatus = inc.capa_count === 0 ? "pending" : inc.open_capa_count > 0 ? "in_review" : "completed"

            return (
              <motion.div
                key={inc.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-card border border-border rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          INCIDENT_TYPE_META[inc.incident_type]?.className
                        )}
                      >
                        {INCIDENT_TYPE_META[inc.incident_type]?.label}
                      </span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          SEVERITY_META[inc.severity]?.className
                        )}
                      >
                        {SEVERITY_META[inc.severity]?.label} Severity
                      </span>
                      <span className="text-xs text-subtle">{inc.department}</span>
                      <span className="text-xs text-subtle">{inc.occurred_at ? new Date(inc.occurred_at).toLocaleDateString("en-US") : ""}</span>
                      <span className="text-xs text-subtle">- {inc.reporter}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{inc.title}</h3>
                  </div>
                  <button
                    onClick={() => toggleExpand(inc.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <p
                  className={cn(
                    "text-xs text-muted-foreground leading-relaxed",
                    !isExpanded && "line-clamp-2"
                  )}
                >
                  {inc.description}
                </p>

                <div>
                  <p className="text-xs text-subtle mb-1.5">
                    {inc.linked_sop_ids.length > 0 ? "Linked SOPs" : "No SOP Match"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {inc.linked_sop_ids.map((sopId) => (
                      <span
                        key={sopId}
                        className="text-xs text-[#0B6BCB] border border-[#0B6BCB]/30 bg-[#0B6BCB]/10 rounded px-2 py-0.5"
                      >
                        {sopId}
                      </span>
                    ))}
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        REVIEW_STATUS_META[reviewStatus]?.className
                      )}
                    >
                      {REVIEW_STATUS_META[reviewStatus]?.label} {inc.capa_count > 0 ? `(${inc.capa_count} CAPA)` : ""}
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 border-t border-border">
                        <CAPAPanel incidentId={inc.id} incidentTitle={inc.title} onChange={loadIncidents} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    onClick={() => toggleExpand(inc.id)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 border border-[#0B6BCB]/30 transition-colors font-medium"
                  >
                    <ClipboardCheck className="w-3 h-3" /> {isExpanded ? "Hide CAPA" : "View / Manage CAPA"}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {patternAlerts.length > 0 && (
      <section>
        <h2 className="text-lg font-medium text-foreground mb-3">Pattern Detection</h2>
        <div className="space-y-3">
          {patternAlerts.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30"
            >
              <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-[#B45309] dark:text-amber-400">{alert.text}</p>
            </motion.div>
          ))}
        </div>
      </section>
      )}
    </div>
  )
}

// ─── Exceptions: real backend shape (app/api/routes_exceptions.py) ───────────

interface ExceptionReport {
  id: number
  sop_id: string
  sop_title: string
  reported_by: string
  reporter_role: string
  department: string
  date_reported: string | null
  date_of_deviation: string | null
  deviation_type:
    | "equipment_unavailable"
    | "patient_specific_contraindication"
    | "staffing_constraint"
    | "emergency_circumstance"
    | "system_failure"
    | "other"
  description: string
  immediate_action_taken: string
  patient_harm: boolean
  severity: string
  status: "open" | "under_review" | "resolved" | "escalated"
  reviewed_by: string | null
  resolution: string | null
  sop_update_required: boolean
  follow_up_required: string | null
}

const EXC_SEVERITY_META: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30" },
  high: { label: "High", cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30" },
  medium: { label: "Medium", cls: "bg-card text-muted-foreground border border-input" },
  low: { label: "Low", cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30" },
}

const EXC_STATUS_META: Record<string, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30" },
  under_review: { label: "Under Review", cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30" },
  resolved: { label: "Resolved", cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30" },
  escalated: { label: "Escalated", cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30" },
}

const DEVIATION_LABELS: Record<string, string> = {
  equipment_unavailable: "Equipment Unavailable",
  patient_specific_contraindication: "Patient-Specific Contraindication",
  staffing_constraint: "Staffing Constraint",
  emergency_circumstance: "Emergency Circumstance",
  system_failure: "System Failure",
  other: "Other",
}

function fmt(dateStr: string | null) {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ExceptionCard({
  exc,
  onUpdate,
}: {
  exc: ExceptionReport
  onUpdate: (id: number, patch: Partial<ExceptionReport>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState<"review" | "resolve" | "flag" | null>(null)
  const { role, currentUser } = useRole()
  const canReview = role === "governance_compliance" || role === "system_admin"

  async function putUpdate(action: "review" | "resolve" | "flag", body: Record<string, unknown>) {
    setSaving(action)
    try {
      const res = await fetch(`${API_BASE}/api/exceptions/${exc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate(exc.id, updated)
      }
    } catch {
      // network error - leave state unchanged, button re-enables
    } finally {
      setSaving(null)
    }
  }

  const sev = EXC_SEVERITY_META[exc.severity] ?? EXC_SEVERITY_META.medium
  const st = EXC_STATUS_META[exc.status] ?? EXC_STATUS_META.open

  return (
    <motion.div
      layout
      className="rounded-2xl bg-card border border-border overflow-hidden"
    >
      <div className="p-5">
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

        <p className="text-sm text-foreground/80 mt-3 leading-relaxed">{exc.description}</p>

        <div className="flex flex-wrap gap-3 mt-3">
          <div className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border",
            exc.patient_harm
              ? "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30"
              : "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30"
          )}>
            {exc.patient_harm ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
            {exc.patient_harm ? "Patient Harm Reported" : "No Patient Harm"}
          </div>
          {exc.sop_update_required && (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30">
              <AlertTriangle className="w-3.5 h-3.5" />
              SOP Update Required
            </div>
          )}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs text-[#0B6BCB] hover:text-[#0959AC] transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Show less" : "Show details"}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-border pt-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Immediate Action Taken</p>
                <p className="text-sm text-foreground/80">{exc.immediate_action_taken}</p>
              </div>
              {exc.follow_up_required && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Follow-up Required</p>
                  <p className="text-sm text-[#B45309] dark:text-amber-400">{exc.follow_up_required}</p>
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
                  <p className="text-sm text-[#15803D] dark:text-green-400">{exc.resolution}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {canReview && exc.status === "open" && (
                  <button
                    disabled={saving !== null}
                    onClick={() => putUpdate("review", { status: "under_review", reviewed_by: currentUser.name })}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors font-medium border border-[#0B6BCB]/30 disabled:opacity-50"
                  >
                    {saving === "review" ? "Saving..." : "Review"}
                  </button>
                )}
                {exc.status !== "resolved" && (
                  <button
                    disabled={saving !== null}
                    onClick={() => putUpdate("resolve", { status: "resolved", reviewed_by: currentUser.name })}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 hover:bg-[#DCFCE7] dark:bg-green-500/10 transition-colors font-medium border border-[#BBF7D0] dark:border-green-500/30 disabled:opacity-50"
                  >
                    {saving === "resolve" ? "Saving..." : "Mark Resolved"}
                  </button>
                )}
                {!exc.sop_update_required && exc.status !== "resolved" && (
                  <button
                    disabled={saving !== null}
                    onClick={() => putUpdate("flag", { sop_update_required: true })}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 hover:bg-[#FDE68A] transition-colors font-medium border border-[#FDE68A] dark:border-amber-500/30 disabled:opacity-50"
                  >
                    {saving === "flag" ? "Saving..." : "Flag for SOP Update"}
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

function SubmitForm({ onClose, onCreated }: { onClose: () => void; onCreated: (exc: ExceptionReport) => void }) {
  const { currentUser } = useRole()
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    sop_id: "",
    department: "",
    date_of_deviation: "",
    deviation_type: "",
    patient_harm: "",
    severity: "",
    description: "",
    immediate_action_taken: "",
  })

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <CheckCircle className="w-10 h-10 text-[#15803D] dark:text-green-400" />
        <p className="text-sm font-medium">Exception report submitted successfully.</p>
        <p className="text-xs text-muted-foreground">It will be reviewed by the Compliance Officer within 24 hours.</p>
        <button onClick={onClose} className="mt-2 text-xs px-4 py-2 rounded-lg bg-[#0B6BCB] text-white hover:bg-[#0B6BCB] transition-colors">
          Close
        </button>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/exceptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sop_id: form.sop_id,
          reported_by: currentUser.name,
          reporter_role: currentUser.role,
          department: form.department,
          date_of_deviation: form.date_of_deviation ? new Date(form.date_of_deviation).toISOString() : null,
          deviation_type: form.deviation_type || "other",
          description: form.description,
          immediate_action_taken: form.immediate_action_taken,
          patient_harm: form.patient_harm === "yes",
          severity: form.severity || "medium",
        }),
      })
      if (!res.ok) throw new Error("Submission failed")
      const created = await res.json()
      onCreated(created)
      setSubmitted(true)
    } catch {
      setError("Could not submit the report - check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">SOP Affected</label>
          <input
            required
            value={form.sop_id}
            onChange={(e) => set("sop_id", e.target.value)}
            placeholder="e.g. IC-PPE-001"
            className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Department</label>
          <input
            required
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
            placeholder="e.g. ICU"
            className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Date and Time of Deviation</label>
          <input
            required
            type="datetime-local"
            value={form.date_of_deviation}
            onChange={(e) => set("date_of_deviation", e.target.value)}
            className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Severity</label>
          <select
            required
            value={form.severity}
            onChange={(e) => set("severity", e.target.value)}
            className="w-full rounded-lg bg-card border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60"
          >
            <option value="">Select severity...</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Deviation Type</label>
          <select
            required
            value={form.deviation_type}
            onChange={(e) => set("deviation_type", e.target.value)}
            className="w-full rounded-lg bg-card border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60"
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
            value={form.patient_harm}
            onChange={(e) => set("patient_harm", e.target.value)}
            className="w-full rounded-lg bg-card border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60"
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
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Describe what happened and why the SOP could not be followed..."
          className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60 resize-none"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Immediate Actions Taken</label>
        <textarea
          required
          rows={2}
          value={form.immediate_action_taken}
          onChange={(e) => set("immediate_action_taken", e.target.value)}
          placeholder="Describe what was done to mitigate risk..."
          className="w-full rounded-lg bg-muted border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/60 resize-none"
        />
      </div>
      {error && <p className="text-xs text-[#B91C1C] dark:text-red-400">{error}</p>}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Exception Report"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl bg-muted hover:bg-muted text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function ExceptionsTab() {
  const [showForm, setShowForm] = useState(false)
  const [exceptions, setExceptions] = useState<ExceptionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  function loadExceptions() {
    setLoading(true)
    setLoadError(false)
    fetch(`${API_BASE}/api/exceptions`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setExceptions(Array.isArray(data?.exceptions) ? data.exceptions : []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadExceptions() }, [])

  function handleUpdate(id: number, patch: Partial<ExceptionReport>) {
    setExceptions((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  const open = exceptions.filter((e) => e.status === "open").length
  const resolved = exceptions.filter((e) => e.status === "resolved").length
  const critical = exceptions.filter((e) => e.severity === "critical").length
  const underReview = exceptions.filter((e) => e.status === "under_review").length

  const stats = [
    { label: "Open Reports", value: open, icon: XCircle, color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10" },
    { label: "Resolved", value: resolved, icon: CheckCircle, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
    { label: "Critical", value: critical, icon: AlertTriangle, color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10" },
    { label: "Pending Review", value: underReview, icon: Clock, color: "text-[#B45309] dark:text-amber-400", bg: "bg-[#FEF3C7] dark:bg-amber-500/10" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
        <Clock className="w-4 h-4 shrink-0" />
        <span>
          <strong>Policy Notice:</strong> All deviations from approved SOPs must be documented and reviewed within 24 hours per institutional policy (TJC RC.01.02.01).
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3"
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

      <section>
        <h2 className="text-lg font-medium mb-3">Exception Reports</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading exception reports...
          </div>
        ) : loadError ? (
          <ErrorState message="Couldn't load exception reports." onRetry={loadExceptions} />
        ) : exceptions.length === 0 ? (
          <EmptyState title="No exception reports filed yet." />
        ) : (
          <div className="space-y-3">
            {exceptions.map((exc, i) => (
              <motion.div
                key={exc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <ExceptionCard exc={exc} onUpdate={handleUpdate} />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-2xl bg-card border border-border p-5">
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
            <SubmitForm
              onClose={() => setShowForm(false)}
              onCreated={(exc) => setExceptions((prev) => [exc, ...prev])}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Merged page ──────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const [tab, setTab] = useState<"incidents" | "exceptions">(() => {
    if (typeof window === "undefined") return "incidents"
    return new URLSearchParams(window.location.search).get("tab") === "exceptions" ? "exceptions" : "incidents"
  })

  const TABS = [
    { key: "incidents" as const, label: "Incidents", icon: AlertOctagon },
    { key: "exceptions" as const, label: "Exceptions", icon: Shield },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Deviations & Incidents" }]} />

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FEE2E2] dark:bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-6 h-6 text-[#B91C1C] dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground font-display">Deviations &amp; Incidents</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Where practice diverged from SOP - after the fact (incidents) or in the moment, for a documented reason (exceptions)
            </p>
          </div>
        </div>

        <SafetyNote />

        <div className="flex gap-1 p-1 rounded-xl bg-muted border border-border w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tab === t.key ? "bg-card text-[#0B6BCB] shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "incidents" ? <IncidentsTab /> : <ExceptionsTab />}
      </div>
    </AppShell>
  )
}
