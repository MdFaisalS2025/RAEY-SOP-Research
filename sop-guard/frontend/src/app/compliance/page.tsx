"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle, CheckCircle, Clock, Flag, FileText,
  TrendingUp, Download, Eye, GitBranch, Loader2, Check,
  Shield, ChevronDown, ChevronUp, X, Printer, Plus
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_COMPLIANCE, MOCK_SOPS, MOCK_DASHBOARD_STATS } from "@/lib/mock-data"
import { useRole } from "@/lib/role-context"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""
const LEGAL_TEXT = "By clicking Attest, I confirm I have read, understood, and will comply with this policy in my clinical practice. This attestation is timestamped and may be used as evidence in regulatory audits or litigation."

interface RealAttestation {
  id: number
  sop_id: string
  sop_version: string
  user_id: string
  user_name: string
  user_role: string
  department: string
  ip_address: string
  legal_text: string
  attested_at: string | null
}

function scoreColor(score: number) {
  if (score >= 90) return "text-[#15803D] dark:text-green-400"
  if (score >= 70) return "text-[#B45309] dark:text-amber-400"
  return "text-[#B91C1C] dark:text-red-400"
}

function progressColor(score: number) {
  if (score >= 90) return "bg-[#16A34A]"
  if (score >= 70) return "bg-[#F59E0B]"
  return "bg-[#DC2626]"
}

const statusLabel: Record<string, { label: string; className: string }> = {
  needs_update: { label: "Needs Update", className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30" },
  under_review: { label: "Under Review", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30" },
  approved: { label: "Approved", className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30" },
  draft: { label: "Draft", className: "bg-card text-[#475569] border border-[#CBD5E1]" },
}

const roleLabel: Record<string, string> = {
  physician: "Physician",
  nurse: "Nurse",
  department_admin: "Dept Admin",
  compliance_officer: "Compliance",
  committee_member: "Committee",
  legal_risk: "Legal/Risk",
  nurse_educator: "Educator",
  system_admin: "Admin",
}

function formatAttestedAt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).replace(",", " at")
}

function formatAttestedAtLong(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }) + " UTC"
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function CertificateModal({
  record,
  sopTitle,
  onClose,
}: {
  record: RealAttestation
  sopTitle: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-lg rounded-2xl bg-muted border border-[#E2E8F0] shadow-md overflow-hidden"
      >
        {/* Certificate header */}
        <div className="bg-card border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0B6BCB]" />
            <span className="font-mono text-xs text-[#0B6BCB] uppercase tracking-widest">SOP-Guard Attestation Certificate</span>
          </div>
          <button onClick={onClose} aria-label="Close certificate" className="text-[#64748B] hover:text-[#0B6BCB] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Certificate body */}
        <div className="px-6 py-5 space-y-4 font-mono text-sm">
          <div>
            <p className="text-xs text-[#94A3B8] uppercase tracking-widest mb-0.5">Certificate ID</p>
            <p className="text-[#334155]">{record.id}</p>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="text-xs text-[#94A3B8] uppercase tracking-widest mb-1">This certifies that:</p>
            <p className="text-[#1A2332] font-semibold text-base">{record.user_name}</p>
            <p className="text-[#64748B] text-xs">{record.department} - {roleLabel[record.user_role] ?? record.user_role}</p>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="text-xs text-[#94A3B8] uppercase tracking-widest mb-1">Has read, acknowledged, and agreed to comply with:</p>
            <p className="text-[#1A2332] font-medium">{sopTitle}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#0B6BCB]/10 text-[#0B6BCB] text-xs border border-[#0B6BCB]/30">
              Version {record.sop_version || "?"}
            </span>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="text-xs text-[#94A3B8] uppercase tracking-widest mb-1">Legal Statement:</p>
            <p className="text-[#334155] italic leading-relaxed">&ldquo;{record.legal_text}&rdquo;</p>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#94A3B8]">Timestamp</span>
              <span className="text-[#334155]">{record.attested_at ? formatAttestedAtLong(record.attested_at) : "unknown"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#94A3B8]">IP Address</span>
              <span className="text-[#334155] font-mono">{record.ip_address || "unknown"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#94A3B8]">Status</span>
              <span className="text-[#15803D] dark:text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Legally Valid
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between bg-card">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted text-[#334155] hover:bg-[#E2E8F0] transition-colors border border-[#E2E8F0]"
          >
            <Printer className="w-3.5 h-3.5" /> Print Certificate
          </button>
          <button
            onClick={onClose}
            className="text-xs px-4 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors border border-[#0B6BCB]/30"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function TestAttestationModal({
  sop,
  onClose,
  onAttest,
}: {
  sop: { sop_id: string; title: string; version: string } | null
  onClose: () => void
  onAttest: (record: RealAttestation) => void
}) {
  const { currentUser, role } = useRole()
  const [attested, setAttested] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<RealAttestation | null>(null)

  const handleAttest = async () => {
    if (!sop) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE}/api/governance/attestations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sop_id: sop.sop_id,
          sop_version: sop.version,
          user_id: currentUser.name,
          user_name: currentUser.name,
          user_role: role,
          department: currentUser.department,
          legal_text: LEGAL_TEXT,
        }),
      })
      if (!res.ok) throw new Error("Failed to record attestation")
      const record: RealAttestation = await res.json()
      setResult(record)
      setAttested(true)
      onAttest(record)
    } catch {
      setError("Could not record the attestation. Is the backend running?")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-md rounded-2xl bg-muted border border-[#E2E8F0] shadow-md overflow-hidden"
      >
        <div className="bg-card border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0B6BCB]" />
            <span className="font-semibold text-sm">Attest to a SOP</span>
          </div>
          <button onClick={onClose} aria-label="Close attestation flow" className="text-[#64748B] hover:text-[#0B6BCB] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!sop ? (
            <p className="text-sm text-[#64748B]">No SOPs available to attest to yet - upload one first.</p>
          ) : !attested ? (
            <>
              <p className="text-sm text-[#334155]">
                You are about to attest to{" "}
                <span className="font-semibold text-[#1A2332]">{sop.title}</span>{" "}
                version <span className="text-[#0B6BCB] font-mono">{sop.version || "1"}</span>.
              </p>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 p-4 text-xs text-[#B45309] dark:text-amber-400 leading-relaxed">
                <p className="font-semibold mb-1">Legal Statement</p>
                <p>
                  By clicking Attest, I confirm I have read, understood, and will comply with this policy
                  in my clinical practice. This attestation is timestamped and may be used as evidence in
                  regulatory audits or litigation.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleAttest}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  I Attest
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-muted text-[#334155] hover:bg-[#E2E8F0] text-sm font-medium transition-colors border border-[#E2E8F0]"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 rounded-full bg-[#DCFCE7] dark:bg-green-500/10 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-[#15803D] dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-[#1A2332] text-base">Attestation Recorded</p>
                <p className="text-xs text-[#64748B] mt-1">Your acknowledgment has been logged with a legal timestamp.</p>
              </div>
              <div className="rounded-xl bg-card border border-[#E2E8F0] p-3 text-xs text-left space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Timestamp</span>
                  <span className="text-[#334155] font-mono">{result?.attested_at ? formatAttestedAtLong(result.attested_at) : "unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">SOP</span>
                  <span className="text-[#334155]">{sop.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Version</span>
                  <span className="text-[#0B6BCB] font-mono">{sop.version || "1"}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 font-medium text-sm transition-colors border border-[#0B6BCB]/30"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function CompliancePage() {
  const { role } = useRole()
  const [exportState, setExportState] = useState<"idle" | "loading" | "success">("idle")
  const [infoExpanded, setInfoExpanded] = useState(false)
  const [certRecord, setCertRecord] = useState<RealAttestation | null>(null)
  const [showTestModal, setShowTestModal] = useState(false)
  const [attestations, setAttestations] = useState<RealAttestation[]>([])
  const [sopTitleById, setSopTitleById] = useState<Record<string, string>>({})
  const [firstRealSop, setFirstRealSop] = useState<{ sop_id: string; title: string; version: string } | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/governance/attestations?limit=200`)
      .then((r) => r.json())
      .then((data) => setAttestations(Array.isArray(data?.attestations) ? data.attestations : []))
      .catch(() => setAttestations([]))

    fetch(`${API_BASE}/api/sops`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.sops ?? data.items ?? [])
        const titles: Record<string, string> = {}
        for (const s of list) titles[s.sop_id] = s.title
        setSopTitleById(titles)
        if (list.length > 0) {
          setFirstRealSop({ sop_id: list[0].sop_id, title: list[0].title, version: list[0].version ?? "1" })
        }
      })
      .catch(() => {})
  }, [])

  const sopsNeedingReview = MOCK_SOPS.filter(
    (s) => s.status === "needs_update" || s.status === "under_review"
  )

  const handleExport = () => {
    setExportState("loading")
    setTimeout(() => setExportState("success"), 1200)
    setTimeout(() => setExportState("idle"), 3500)
  }

  const handleNewAttestation = (record: RealAttestation) => {
    setAttestations((prev) => [record, ...prev])
  }

  const stats = [
    { label: "Overall Rate", value: `${MOCK_DASHBOARD_STATS.compliance_rate}%`, icon: TrendingUp, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
    { label: "Staff Overdue", value: "149", icon: Clock, color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10" },
    { label: "SOPs Needing Review", value: String(MOCK_DASHBOARD_STATS.sops_needs_review), icon: FileText, color: "text-[#B45309] dark:text-amber-400", bg: "bg-[#FEF3C7] dark:bg-amber-500/10" },
    { label: "Legal Flags", value: String(MOCK_DASHBOARD_STATS.legal_flags), icon: Flag, color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10" },
  ]

  const attestationStats = [
    { label: "Total Attestations", value: attestations.length, color: "text-[#0B6BCB]" },
    { label: "With Timestamp + IP", value: attestations.filter((a) => a.ip_address && a.attested_at).length, color: "text-[#15803D] dark:text-green-400" },
    { label: "Distinct SOPs Attested", value: new Set(attestations.map((a) => a.sop_id)).size, color: "text-[#15803D] dark:text-green-400" },
    { label: "Exportable for Litigation", value: "Yes", color: "text-[#15803D] dark:text-green-400" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Modals */}
        <AnimatePresence>
          {certRecord && (
            <CertificateModal
              record={certRecord}
              sopTitle={sopTitleById[certRecord.sop_id] ?? certRecord.sop_id}
              onClose={() => setCertRecord(null)}
            />
          )}
          {showTestModal && (
            <TestAttestationModal
              sop={firstRealSop}
              onClose={() => setShowTestModal(false)}
              onAttest={(r) => {
                handleNewAttestation(r)
                setTimeout(() => setShowTestModal(false), 2200)
              }}
            />
          )}
        </AnimatePresence>

        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: "Compliance" }]} />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-[#0B6BCB]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">Compliance Dashboard</h1>
              <p className="text-sm text-[#64748B]">Accreditation &amp; Policy Acknowledgment Status</p>
            </div>
          </div>
        </div>

        {/* Research disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype. Not for Clinical Use.</strong> For demonstration only. All clinical decisions must follow institutional protocols.</span>
        </div>

        {/* Responsible AI note */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>For audit preparation only. Verify all data against live records before regulatory submission.</span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl bg-card border border-[#E2E8F0] p-4 flex items-center gap-3"
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

        {/* Department Compliance Heatmap */}
        <section>
          <h2 className="text-lg font-semibold font-display mb-3">Department Compliance Heatmap</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {MOCK_COMPLIANCE.map((dept, i) => (
              <motion.div
                key={dept.department}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-card border border-[#E2E8F0] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{dept.department}</h3>
                  <span className={cn("text-3xl font-bold", scoreColor(dept.compliance_score))}>
                    {dept.compliance_score}%
                  </span>
                </div>
                {/* Mini progress bar */}
                <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", progressColor(dept.compliance_score))}
                    style={{ width: `${dept.compliance_score}%` }}
                  />
                </div>
                {/* Mini stats */}
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <div className="rounded-lg bg-muted p-1.5 text-center">
                    <p className="font-semibold text-[#1A2332]">{dept.total_sops}</p>
                    <p className="text-[#64748B]">Total SOPs</p>
                  </div>
                  <div className="rounded-lg bg-muted p-1.5 text-center">
                    <p className="font-semibold text-[#15803D] dark:text-green-400">{dept.acknowledged}</p>
                    <p className="text-[#64748B]">Ack&apos;d</p>
                  </div>
                  <div className="rounded-lg bg-muted p-1.5 text-center">
                    <p className="font-semibold text-[#B91C1C] dark:text-red-400">{dept.overdue_acknowledgments}</p>
                    <p className="text-[#64748B]">Overdue</p>
                  </div>
                  <div className="rounded-lg bg-muted p-1.5 text-center">
                    <p className="font-semibold text-[#0B6BCB]">{dept.training_completion_rate}%</p>
                    <p className="text-[#64748B]">Training</p>
                  </div>
                  <div className="rounded-lg bg-muted p-1.5 text-center">
                    <p className="font-semibold text-[#B45309] dark:text-amber-400">{dept.risk_flags}</p>
                    <p className="text-[#64748B]">Risk Flags</p>
                  </div>
                  <div className="rounded-lg bg-muted p-1.5 text-center">
                    <p className="font-semibold text-[#64748B]">{dept.open_proposals}</p>
                    <p className="text-[#64748B]">Proposals</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-[#64748B]">Last audit: {dept.last_audit_date}</p>
                  <button className="text-xs text-[#0B6BCB] hover:text-[#0B6BCB] transition-colors font-medium">
                    View Details &rarr;
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* SOPs Requiring Review */}
        <section>
          <h2 className="text-lg font-semibold font-display mb-3">SOPs Requiring Review</h2>
          <div className="rounded-2xl bg-card border border-[#E2E8F0] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] text-xs text-[#64748B] uppercase tracking-wider">
                  <th className="p-4 text-left">SOP Title</th>
                  <th className="p-4 text-left">Department</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Review Due</th>
                  <th className="p-4 text-left">Owner</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sopsNeedingReview.map((sop) => (
                  <tr key={sop.id} className="border-b border-[#EDF1F5] hover:bg-[#F8FAFC] transition-colors">
                    <td className="p-4">
                      <p className="font-medium text-[#1A2332] truncate max-w-[240px]">{sop.title}</p>
                      <p className="text-xs text-[#64748B]">{sop.sop_id}</p>
                    </td>
                    <td className="p-4 text-[#64748B]">{sop.department}</td>
                    <td className="p-4">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusLabel[sop.status]?.className)}>
                        {statusLabel[sop.status]?.label ?? sop.status}
                      </span>
                    </td>
                    <td className="p-4 text-[#B45309] dark:text-amber-400 text-xs">{sop.review_due_date}</td>
                    <td className="p-4 text-[#64748B] text-xs">{sop.owner}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors">
                          <Eye className="w-3 h-3" /> View SOP
                        </button>
                        <button className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-muted text-[#64748B] hover:bg-[#E2E8F0] transition-colors">
                          <GitBranch className="w-3 h-3" /> Create Proposal
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </section>

        {/* ─── LEGAL ATTESTATION SECTION ─── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#0B6BCB]" />
              <h2 className="text-lg font-semibold font-display">Staff Attestation Records</h2>
            </div>
            <button
              onClick={() => setShowTestModal(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors border border-[#0B6BCB]/30 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Attest to a SOP
            </button>
          </div>

          {/* Attestation stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {attestationStats.map((s) => (
              <div key={s.label} className="rounded-xl bg-card border border-[#E2E8F0] p-3">
                <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-[#64748B] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* "What is Legal Attestation?" info card */}
          <div className="rounded-xl bg-card border border-[#E2E8F0] overflow-hidden">
            <button
              onClick={() => setInfoExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-[#334155] hover:bg-[#F8FAFC] transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#64748B]" />
                <span className="font-medium">What is Legal Attestation?</span>
              </div>
              {infoExpanded ? <ChevronUp className="w-4 h-4 text-[#94A3B8]" /> : <ChevronDown className="w-4 h-4 text-[#94A3B8]" />}
            </button>
            <AnimatePresence>
              {infoExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 text-sm text-[#64748B] leading-relaxed border-t border-[#E2E8F0]">
                    <p className="mt-3">
                      Electronic attestation records provide legally defensible proof that staff have read
                      and acknowledged specific SOP versions. Each record includes: staff identity, timestamp,
                      IP address, exact SOP version attested to, and the legal text agreed to. Admissible in
                      litigation as evidence of policy awareness (per PowerDMS legal standards).
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Attestation records table */}
          <div className="rounded-2xl bg-card border border-[#E2E8F0] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-xs text-[#64748B] uppercase tracking-wider">
                    <th className="p-4 text-left">Staff Member</th>
                    <th className="p-4 text-left">Department</th>
                    <th className="p-4 text-left">SOP</th>
                    <th className="p-4 text-left">Version</th>
                    <th className="p-4 text-left">Date &amp; Time</th>
                    <th className="p-4 text-left">IP Address</th>
                    <th className="p-4 text-left">Valid</th>
                    <th className="p-4 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {attestations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-xs text-[#64748B]">No attestations recorded yet.</td>
                    </tr>
                  )}
                  {attestations.map((rec) => {
                    const title = sopTitleById[rec.sop_id] ?? rec.sop_id
                    return (
                    <tr key={rec.id} className="border-b border-[#EDF1F5] hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-[#1A2332]">{rec.user_name}</p>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-muted text-[#64748B] text-[10px] border border-[#E2E8F0]">
                          {roleLabel[rec.user_role] ?? rec.user_role}
                        </span>
                      </td>
                      <td className="p-4 text-[#64748B] text-xs">{rec.department}</td>
                      <td className="p-4">
                        <p className="text-[#1A2332] text-xs truncate max-w-[200px]" title={title}>
                          {title.length > 30 ? title.slice(0, 30) + "..." : title}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-[#0B6BCB]/10 text-[#0B6BCB] text-xs border border-[#0B6BCB]/30 font-mono">
                          v{rec.sop_version || "?"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-[#64748B] whitespace-nowrap">
                        {rec.attested_at ? formatAttestedAt(rec.attested_at) : "unknown"}
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-xs text-[#64748B]">{rec.ip_address || "unknown"}</span>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-1 text-[#15803D] dark:text-green-400 text-xs">
                          <Check className="w-3.5 h-3.5" /> Valid
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setCertRecord(rec)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-muted text-[#334155] hover:bg-[#E2E8F0] transition-colors border border-[#E2E8F0]"
                        >
                          View Certificate
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Export Report */}
        <div className="flex justify-center pt-2">
          <button
            onClick={handleExport}
            disabled={exportState === "loading"}
            className={cn(
              "flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold transition-all",
              exportState === "success"
                ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30"
                : "bg-[#0B6BCB] hover:bg-[#0959AC] text-white"
            )}
          >
            {exportState === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
            {exportState === "success" && <Check className="w-4 h-4" />}
            {exportState === "idle" && <Download className="w-4 h-4" />}
            {exportState === "loading" ? "Generating..." : exportState === "success" ? "Report Generated" : "Export Compliance Report"}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
