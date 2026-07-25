"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle, CheckCircle, Clock, Flag, FileText,
  TrendingUp, Download, Eye, GitBranch, Loader2, Check,
  Shield, ChevronDown, ChevronUp, X, Printer, Plus,
  CalendarClock, ArrowRight, Calendar, Bell,
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SafetyNote } from "@/components/ui/safety-note"
import { cn } from "@/lib/utils"
import { MOCK_COMPLIANCE, MOCK_SOPS, MOCK_DASHBOARD_STATS } from "@/lib/mock-data"
import { useRole } from "@/lib/role-context"
import { downloadCSV } from "@/lib/csv-export"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { Card } from "@/components/ui/card"

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
  signature_meaning: string
  second_factor_confirmation: string
  content_hash: string
  prev_hash: string
  attested_at: string | null
}

const SIGNATURE_MEANING = "I have read, understood, and will comply with this SOP in my clinical practice."

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
  draft: { label: "Draft", className: "bg-card text-muted-foreground border border-input" },
}

const roleLabel: Record<string, string> = {
  // Current roles
  clinical_staff: "Clinical Staff",
  educator: "Educator / Trainer",
  governance_compliance: "Governance & Compliance",
  system_admin: "Admin",
  // Pre-consolidation roles, still referenced by historical records
  physician: "Physician",
  nurse: "Nurse",
  department_admin: "Dept Admin",
  compliance_officer: "Compliance",
  committee_member: "Committee",
  legal_risk: "Legal/Risk",
  nurse_educator: "Educator",
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
        className="relative w-full max-w-lg rounded-2xl bg-muted border border-border shadow-md overflow-hidden"
      >
        {/* Certificate header */}
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0B6BCB]" />
            <span className="font-mono text-xs text-[#0B6BCB] uppercase tracking-widest">Meridian Attestation Certificate</span>
          </div>
          <button onClick={onClose} aria-label="Close certificate" className="text-muted-foreground hover:text-[#0B6BCB] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Certificate body */}
        <div className="px-6 py-5 space-y-4 font-mono text-sm">
          <div>
            <p className="text-xs text-subtle uppercase tracking-widest mb-0.5">Certificate ID</p>
            <p className="text-foreground">{record.id}</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-subtle uppercase tracking-widest mb-1">This certifies that:</p>
            <p className="text-foreground font-semibold text-base">{record.user_name}</p>
            <p className="text-muted-foreground text-xs">{record.department} - {roleLabel[record.user_role] ?? record.user_role}</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-subtle uppercase tracking-widest mb-1">Has read, acknowledged, and agreed to comply with:</p>
            <p className="text-foreground font-medium">{sopTitle}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#0B6BCB]/10 text-[#0B6BCB] text-xs border border-[#0B6BCB]/30">
              Version {record.sop_version || "?"}
            </span>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-subtle uppercase tracking-widest mb-1">Legal Statement:</p>
            <p className="text-foreground italic leading-relaxed">&ldquo;{record.legal_text}&rdquo;</p>
          </div>

          <div className="border-t border-border pt-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-subtle">Timestamp</span>
              <span className="text-foreground">{record.attested_at ? formatAttestedAtLong(record.attested_at) : "unknown"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-subtle">IP Address</span>
              <span className="text-foreground font-mono">{record.ip_address || "unknown"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-subtle">Status</span>
              <span className="text-[#15803D] dark:text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> Legally Valid
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-card">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-[#E2E8F0] transition-colors border border-border"
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
  const [nameConfirmation, setNameConfirmation] = useState("")

  const nameMatches = nameConfirmation.trim().toLowerCase() === currentUser.name.trim().toLowerCase()

  const handleAttest = async () => {
    if (!sop) return
    if (!nameMatches) {
      setError("Type your full name exactly as shown to confirm your identity.")
      return
    }
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
          signature_meaning: SIGNATURE_MEANING,
          second_factor_confirmation: nameConfirmation.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail || "Failed to record attestation")
      }
      const record: RealAttestation = await res.json()
      setResult(record)
      setAttested(true)
      onAttest(record)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the attestation. Is the backend running?")
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
        className="relative w-full max-w-md rounded-2xl bg-muted border border-border shadow-md overflow-hidden"
      >
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0B6BCB]" />
            <span className="font-semibold text-sm">Attest to a SOP</span>
          </div>
          <button onClick={onClose} aria-label="Close attestation flow" className="text-muted-foreground hover:text-[#0B6BCB] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!sop ? (
            <p className="text-sm text-muted-foreground">No SOPs available to attest to yet - upload one first.</p>
          ) : !attested ? (
            <>
              <p className="text-sm text-foreground">
                You are about to attest to{" "}
                <span className="font-semibold text-foreground">{sop.title}</span>{" "}
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

              <div className="rounded-xl bg-[#0B6BCB]/[0.06] border border-[#0B6BCB]/20 p-4 text-xs text-[#0B6BCB] leading-relaxed">
                <p className="font-semibold mb-1">Meaning of this signature</p>
                <p>{SIGNATURE_MEANING}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Type your full name to confirm your identity: <span className="font-semibold text-foreground">{currentUser.name}</span>
                </label>
                <input
                  value={nameConfirmation}
                  onChange={(e) => setNameConfirmation(e.target.value)}
                  placeholder="Type your full name exactly"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-[#0B6BCB]/50"
                />
                <p className="text-[11px] text-subtle mt-1">
                  A second identification step at the moment of signing, separate from being logged in.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleAttest}
                  disabled={submitting || !nameMatches}
                  className="flex-1 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  I Attest
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-muted text-foreground hover:bg-[#E2E8F0] text-sm font-medium transition-colors border border-border"
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
                <p className="font-semibold text-foreground text-base">Attestation Recorded</p>
                <p className="text-xs text-muted-foreground mt-1">Your acknowledgment has been logged with a legal timestamp.</p>
              </div>
              <div className="rounded-xl bg-card border border-border p-3 text-xs text-left space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-subtle">Timestamp</span>
                  <span className="text-foreground font-mono">{result?.attested_at ? formatAttestedAtLong(result.attested_at) : "unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-subtle">SOP</span>
                  <span className="text-foreground">{sop.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-subtle">Version</span>
                  <span className="text-[#0B6BCB] font-mono">{sop.version || "1"}</span>
                </div>
                {result?.content_hash && (
                  <div className="pt-1.5 mt-1.5 border-t border-border">
                    <span className="text-subtle block mb-0.5">Tamper-evidence hash (chained to prior signature)</span>
                    <span className="text-foreground font-mono text-[10px] break-all">{result.content_hash}</span>
                  </div>
                )}
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

function ChainIntegrityBadge() {
  const [state, setState] = useState<"idle" | "checking" | "intact" | "broken" | "error">("idle")
  const [detail, setDetail] = useState("")

  async function check() {
    setState("checking")
    try {
      const res = await fetch(`${API_BASE}/api/governance/attestations/verify-chain`)
      const data = await res.json()
      setState(data.intact ? "intact" : "broken")
      setDetail(data.intact
        ? `${data.checked} signature(s) verified, chain intact.`
        : `Tampering detected in record(s): ${(data.broken_at ?? []).join(", ")}`)
    } catch {
      setState("error")
      setDetail("Could not reach the backend to verify.")
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={check}
        title={detail}
        className={cn(
          "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors",
          state === "intact" && "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
          state === "broken" && "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30",
          (state === "idle" || state === "checking" || state === "error") && "bg-muted text-muted-foreground border-border",
        )}
      >
        {state === "checking" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {state === "idle" && "Verify Chain Integrity"}
        {state === "checking" && "Verifying..."}
        {state === "intact" && "Chain Intact"}
        {state === "broken" && "Tampering Detected"}
        {state === "error" && "Verify Chain Integrity"}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// Acknowledgments tab (formerly the whole Compliance page)
// ─────────────────────────────────────────────

function AcknowledgmentsTab() {
  const [exportState, setExportState] = useState<"idle" | "loading" | "success">("idle")
  const [infoExpanded, setInfoExpanded] = useState(false)
  const [certRecord, setCertRecord] = useState<RealAttestation | null>(null)
  const [showTestModal, setShowTestModal] = useState(false)
  const [attestations, setAttestations] = useState<RealAttestation[]>([])
  const [sopTitleById, setSopTitleById] = useState<Record<string, string>>({})
  const [firstRealSop, setFirstRealSop] = useState<{ sop_id: string; title: string; version: string } | null>(null)
  const [attestationsError, setAttestationsError] = useState(false)

  const loadAttestations = () => {
    setAttestationsError(false)
    fetch(`${API_BASE}/api/governance/attestations?limit=200`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setAttestations(Array.isArray(data?.attestations) ? data.attestations : []))
      .catch(() => setAttestationsError(true))
  }

  useEffect(() => {
    loadAttestations()

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
    downloadCSV(`compliance-attestations-${new Date().toISOString().slice(0, 10)}.csv`, attestations.map((a) => ({
      sop_id: a.sop_id,
      sop_title: sopTitleById[a.sop_id] ?? a.sop_id,
      sop_version: a.sop_version,
      user_name: a.user_name,
      user_role: a.user_role,
      department: a.department,
      ip_address: a.ip_address,
      attested_at: a.attested_at ?? "",
      content_hash: a.content_hash,
    })))
    setExportState("success")
    setTimeout(() => setExportState("idle"), 3500)
  }

  const handleNewAttestation = (record: RealAttestation) => {
    setAttestations((prev) => [record, ...prev])
  }

  const totalStaffOverdue = MOCK_COMPLIANCE.reduce((sum, c) => sum + c.overdue_acknowledgments, 0)

  const stats = [
    { label: "Overall Rate", value: `${MOCK_DASHBOARD_STATS.compliance_rate}%`, icon: TrendingUp, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
    { label: "Staff Overdue", value: String(totalStaffOverdue), icon: Clock, color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10" },
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
    <div className="space-y-6">
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

      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Showing illustrative department-compliance data, not wired to a live tracking system. The Staff Attestation Records below are real.</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
              <s.icon className={cn("w-5 h-5", s.color)} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Department Compliance Heatmap */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Department Compliance Heatmap</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MOCK_COMPLIANCE.map((dept, i) => (
            <motion.div
              key={dept.department}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl bg-card border border-border p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{dept.department}</h3>
                <span className={cn("text-3xl font-bold", scoreColor(dept.compliance_score))}>
                  {dept.compliance_score}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", progressColor(dept.compliance_score))}
                  style={{ width: `${dept.compliance_score}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <div className="rounded-lg bg-muted p-1.5 text-center">
                  <p className="font-semibold text-foreground">{dept.total_sops}</p>
                  <p className="text-muted-foreground">Total SOPs</p>
                </div>
                <div className="rounded-lg bg-muted p-1.5 text-center">
                  <p className="font-semibold text-[#15803D] dark:text-green-400">{dept.acknowledged}</p>
                  <p className="text-muted-foreground">Ack&apos;d</p>
                </div>
                <div className="rounded-lg bg-muted p-1.5 text-center">
                  <p className="font-semibold text-[#B91C1C] dark:text-red-400">{dept.overdue_acknowledgments}</p>
                  <p className="text-muted-foreground">Acks Overdue</p>
                </div>
                <div className="rounded-lg bg-muted p-1.5 text-center">
                  <p className="font-semibold text-[#0B6BCB]">{dept.training_completion_rate}%</p>
                  <p className="text-muted-foreground">Training</p>
                </div>
                <div className="rounded-lg bg-muted p-1.5 text-center">
                  <p className="font-semibold text-[#B45309] dark:text-amber-400">{dept.risk_flags}</p>
                  <p className="text-muted-foreground">Risk Flags</p>
                </div>
                <div className="rounded-lg bg-muted p-1.5 text-center">
                  <p className="font-semibold text-muted-foreground">{dept.open_proposals}</p>
                  <p className="text-muted-foreground">Proposals</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">Last audit: {dept.last_audit_date}</p>
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
        <h2 className="text-lg font-semibold mb-3">SOPs Requiring Review</h2>
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
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
                <tr key={sop.id} className="border-b border-border hover:bg-[#F8FAFC] transition-colors">
                  <td className="p-4">
                    <p className="font-medium text-foreground truncate max-w-[240px]">{sop.title}</p>
                    <p className="text-xs text-muted-foreground">{sop.sop_id}</p>
                  </td>
                  <td className="p-4 text-muted-foreground">{sop.department}</td>
                  <td className="p-4">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusLabel[sop.status]?.className)}>
                      {statusLabel[sop.status]?.label ?? sop.status}
                    </span>
                  </td>
                  <td className="p-4 text-[#B45309] dark:text-amber-400 text-xs">{sop.review_due_date}</td>
                  <td className="p-4 text-muted-foreground text-xs">{sop.owner}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors">
                        <Eye className="w-3 h-3" /> View SOP
                      </button>
                      <button className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground hover:bg-[#E2E8F0] transition-colors">
                        <GitBranch className="w-3 h-3" /> Create Proposal
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      </section>

      {/* ─── LEGAL ATTESTATION SECTION ─── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0B6BCB]" />
            <h2 className="text-lg font-semibold">Staff Attestation Records</h2>
          </div>
          <div className="flex items-center gap-2">
            <ChainIntegrityBadge />
            <button
              onClick={() => setShowTestModal(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors border border-[#0B6BCB]/30 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Attest to a SOP
            </button>
            <button
              onClick={handleExport}
              disabled={exportState === "loading"}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors border font-medium",
                exportState === "success"
                  ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30"
                  : "bg-[#0B6BCB] hover:bg-[#0959AC] text-white border-transparent"
              )}
            >
              {exportState === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {exportState === "success" && <Check className="w-3.5 h-3.5" />}
              {exportState === "idle" && <Download className="w-3.5 h-3.5" />}
              {exportState === "loading" ? "Generating..." : exportState === "success" ? "Report Generated" : "Export Compliance Report"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {attestationStats.map((s) => (
            <div key={s.label} className="rounded-xl bg-card border border-border p-3">
              <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <button
            onClick={() => setInfoExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-[#F8FAFC] transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">What is Legal Attestation?</span>
            </div>
            {infoExpanded ? <ChevronUp className="w-4 h-4 text-subtle" /> : <ChevronDown className="w-4 h-4 text-subtle" />}
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
                <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border">
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

        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
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
                {attestationsError && (
                  <tr><td colSpan={8} className="p-6"><ErrorState message="Couldn't load attestations." onRetry={loadAttestations} /></td></tr>
                )}
                {!attestationsError && attestations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-xs text-muted-foreground">No attestations recorded yet.</td>
                  </tr>
                )}
                {attestations.map((rec) => {
                  const title = sopTitleById[rec.sop_id] ?? rec.sop_id
                  return (
                  <tr key={rec.id} className="border-b border-border hover:bg-[#F8FAFC] transition-colors">
                    <td className="p-4">
                      <p className="font-medium text-foreground">{rec.user_name}</p>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] border border-border">
                        {roleLabel[rec.user_role] ?? rec.user_role}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{rec.department}</td>
                    <td className="p-4">
                      <p className="text-foreground text-xs truncate max-w-[200px]" title={title}>
                        {title.length > 30 ? title.slice(0, 30) + "..." : title}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-[#0B6BCB]/10 text-[#0B6BCB] text-xs border border-[#0B6BCB]/30 font-mono">
                        v{rec.sop_version || "?"}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                      {rec.attested_at ? formatAttestedAt(rec.attested_at) : "unknown"}
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-xs text-muted-foreground">{rec.ip_address || "unknown"}</span>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1 text-[#15803D] dark:text-green-400 text-xs">
                        <Check className="w-3.5 h-3.5" /> Valid
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setCertRecord(rec)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-muted text-foreground hover:bg-[#E2E8F0] transition-colors border border-border"
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
        </Card>
      </section>

    </div>
  )
}

// ─────────────────────────────────────────────
// Reviews tab (formerly the whole Expiry page)
// ─────────────────────────────────────────────

interface RealSOPWithReview {
  id: number
  sop_id: string
  title: string
  department: string
  version: string
  effective_date: string
  review_date: string
  status: string
}

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

const EXPIRY_STATUS_META: Record<ExpiryStatus, { label: string; badgeClass: string; rowClass: string }> = {
  expired: {
    label: "EXPIRED",
    badgeClass: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    rowClass: "border-l-2 border-[#B91C1C]",
  },
  due_soon: {
    label: "DUE SOON",
    badgeClass: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
    rowClass: "border-l-2 border-[#B45309]",
  },
  upcoming: {
    label: "UPCOMING",
    badgeClass: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
    rowClass: "border-l-2 border-[#B45309]",
  },
  current: {
    label: "CURRENT",
    badgeClass: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30",
    rowClass: "border-l-2 border-[#15803D]",
  },
}

function daysLabel(days: number) {
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return "Due today"
  return `${days} days remaining`
}

function daysColor(days: number) {
  if (days < 0) return "text-[#B91C1C] dark:text-red-400"
  if (days <= 30) return "text-[#B45309] dark:text-amber-400"
  if (days <= 90) return "text-[#B45309] dark:text-amber-400"
  return "text-[#15803D] dark:text-green-400"
}

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
  current: { label: "Current", badgeClass: "bg-card text-muted-foreground border border-input" },
  owner_notified: { label: "Owner Notified", badgeClass: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30" },
  dept_notified: { label: "Dept Head Notified", badgeClass: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30" },
  compliance_notified: { label: "Compliance Notified", badgeClass: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30" },
  cmo_escalation: { label: "CMO Escalation", badgeClass: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30" },
  expired_frozen: { label: "EXPIRED - SOP Frozen", badgeClass: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30" },
}

const ESCALATION_STEPS = [
  { label: "90 days out", action: "Notify Owner", tier: "owner_notified" as AlertTier, color: "bg-[#64748B]", textColor: "text-muted-foreground", borderColor: "border-[#64748B]" },
  { label: "60 days out", action: "Notify Dept Head", tier: "dept_notified" as AlertTier, color: "bg-[#B45309]", textColor: "text-[#B45309] dark:text-amber-400", borderColor: "border-[#B45309]" },
  { label: "30 days out", action: "Notify Compliance", tier: "compliance_notified" as AlertTier, color: "bg-[#B45309]", textColor: "text-[#B45309] dark:text-amber-400", borderColor: "border-[#B45309]" },
  { label: "7 days out", action: "CMO Escalation", tier: "cmo_escalation" as AlertTier, color: "bg-[#B91C1C]", textColor: "text-[#B91C1C] dark:text-red-400", borderColor: "border-[#B91C1C]" },
  { label: "EXPIRED", action: "Freeze SOP", tier: "expired_frozen" as AlertTier, color: "bg-[#7F1D1D]", textColor: "text-[#B91C1C] dark:text-red-400", borderColor: "border-[#7F1D1D]" },
]

function ReviewsTab() {
  const [sops, setSops] = useState<RealSOPWithReview[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const loadSops = () => {
    setLoading(true)
    setLoadError(false)
    fetch("/api/sops")
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => setSops(Array.isArray(data?.sops) ? data.sops : []))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }
  useEffect(loadSops, [])

  const unscheduledCount = useMemo(() => sops.filter((s) => !s.review_date).length, [sops])

  const items = useMemo(() => {
    return sops
      .filter((sop) => !!sop.review_date)
      .map((sop) => ({
        sop,
        days: daysUntil(sop.review_date),
        status: expiryStatus(daysUntil(sop.review_date)),
        alertTier: getAlertTier(daysUntil(sop.review_date)),
      }))
      .sort((a, b) => a.days - b.days)
  }, [sops])

  const counts = useMemo(() => ({
    expired: items.filter((i) => i.status === "expired").length,
    due_soon: items.filter((i) => i.status === "due_soon").length,
    upcoming: items.filter((i) => i.status === "upcoming").length,
    current: items.filter((i) => i.status === "current").length,
  }), [items])

  const stats = [
    { label: "Expired", value: counts.expired, icon: AlertTriangle, color: "text-[#B91C1C] dark:text-red-400", bg: "bg-[#FEE2E2] dark:bg-red-500/10" },
    { label: "Expiring in 30 days", value: counts.due_soon, icon: Clock, color: "text-[#B45309] dark:text-amber-400", bg: "bg-[#FEF3C7] dark:bg-amber-500/10" },
    { label: "Expiring in 90 days", value: counts.upcoming, icon: CalendarClock, color: "text-[#B45309] dark:text-amber-400", bg: "bg-[#FEF3C7] dark:bg-amber-500/10" },
    { label: "Current", value: counts.current, icon: CheckCircle, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
  ]

  const mostCriticalTier: AlertTier = items.length > 0 ? items[0].alertTier : "current"

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0959AC] text-sm">
        <FileText className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Regulatory Basis:</strong> TJC Standard LD.04.03.07 requires that all policies are reviewed at least every 3 years.
          CMS Conditions of Participation require policies to be current and accessible to relevant staff at all times.
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

      <Card as="section">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Staged Escalation Protocol</h2>
          <p className="text-xs text-muted-foreground mt-0.5">TJC LD.04.03.07 - Automated notification escalation based on days until review due date</p>
        </div>

        <div className="relative flex items-start justify-between gap-2 overflow-x-auto pb-2">
          <div className="absolute top-4 left-0 right-0 h-px bg-[#E2E8F0] z-0 mx-8" />

          {ESCALATION_STEPS.map((step, i) => {
            const isActive = step.tier === mostCriticalTier
            return (
              <div key={step.tier} className="flex flex-col items-center gap-2 min-w-[100px] flex-1 z-10">
                <p className={cn(
                  "text-[10px] font-semibold text-center whitespace-nowrap",
                  isActive ? step.textColor : "text-muted-foreground"
                )}>
                  {step.label}
                </p>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                  isActive
                    ? `${step.color} ${step.borderColor} shadow-lg`
                    : "bg-muted border-input"
                )}>
                  <span className={cn("text-xs font-bold", isActive ? "text-white" : "text-subtle")}>{i + 1}</span>
                </div>
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
          <div className="mt-3 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-border">
            <p className="text-xs text-muted-foreground">
              Most critical SOP is at tier:{" "}
              <span className={cn("font-semibold", ALERT_TIER_META[mostCriticalTier].badgeClass.includes("red") ? "text-[#B91C1C] dark:text-red-400" : "text-[#B45309] dark:text-amber-400")}>
                {ALERT_TIER_META[mostCriticalTier].label}
              </span>
            </p>
          </div>
        )}
      </Card>

      <section>
        <h2 className="text-lg font-medium mb-3">Review Timeline - sorted by urgency</h2>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading SOPs...
          </div>
        )}

        {!loading && loadError && (
          <ErrorState message="Couldn't load SOPs." onRetry={loadSops} />
        )}

        {!loading && !loadError && items.length === 0 && (
          <EmptyState title="No SOPs with a scheduled review date yet." />
        )}

        {!loading && unscheduledCount > 0 && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-border text-xs text-muted-foreground">
            {unscheduledCount} SOP{unscheduledCount === 1 ? "" : "s"} without a scheduled review date {unscheduledCount === 1 ? "is" : "are"} not shown below.
          </div>
        )}

        <div className="space-y-3">
          {items.map(({ sop, days, status, alertTier }, i) => {
            const meta = EXPIRY_STATUS_META[status]
            const tierMeta = ALERT_TIER_META[alertTier]
            return (
              <motion.div
                key={sop.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "rounded-2xl bg-card border border-border p-5",
                  meta.rowClass
                )}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide shrink-0", meta.badgeClass)}>
                        {meta.label}
                      </span>
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
                        <Calendar className="w-3 h-3" />
                        {sop.department}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-2">
                      <span className="text-muted-foreground">
                        Effective since: <span className="text-foreground">{sop.effective_date || "—"}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Review due: <span className="text-foreground">{sop.review_date}</span>
                      </span>
                    </div>
                  </div>

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
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground cursor-not-allowed opacity-50 font-medium"
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

      <Card padding="sm">
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Alert Tier Reference</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {(["expired", "due_soon", "upcoming", "current"] as ExpiryStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", EXPIRY_STATUS_META[s].badgeClass)}>
                {EXPIRY_STATUS_META[s].label}
              </span>
              <span className="text-muted-foreground">
                {s === "expired" ? "Past due date" : s === "due_soon" ? "Within 30 days" : s === "upcoming" ? "30-90 days" : "Over 90 days"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Notification Settings</h3>
        </div>

        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 py-2 border-b border-border">
            <span className="w-40 shrink-0 text-foreground font-medium">Alert recipients:</span>
            <span>Configured in</span>
            <Link href="/admin" className="text-[#0B6BCB] hover:text-[#0959AC] underline">/admin</Link>
          </div>
          <div className="flex items-center gap-2 py-2 border-b border-border">
            <span className="w-40 shrink-0 text-foreground font-medium">Email notifications:</span>
            <span>Not configured (connect to hospital email system)</span>
          </div>
          <div className="flex items-center gap-2 py-2 border-b border-border">
            <span className="w-40 shrink-0 text-foreground font-medium">Push notifications:</span>
            <span>Not configured</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/70 italic">
          These settings require IT integration in production.
        </p>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
// Merged page
// ─────────────────────────────────────────────

export default function CompliancePage() {
  const [tab, setTab] = useState<"acknowledgments" | "reviews">(() => {
    if (typeof window === "undefined") return "acknowledgments"
    return new URLSearchParams(window.location.search).get("tab") === "reviews" ? "reviews" : "acknowledgments"
  })

  const TABS = [
    { key: "acknowledgments" as const, label: "Acknowledgments", icon: CheckCircle },
    { key: "reviews" as const, label: "Upcoming & Overdue Reviews", icon: CalendarClock },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Compliance" }]} />

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-[#0B6BCB]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Compliance</h1>
              <p className="text-sm text-muted-foreground">Policy acknowledgment status and SOP review currency</p>
            </div>
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

        {tab === "acknowledgments" ? <AcknowledgmentsTab /> : <ReviewsTab />}
      </div>
    </AppShell>
  )
}
