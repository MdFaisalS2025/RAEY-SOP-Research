"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { GitBranch, Plus, Check, X, Clock, ChevronDown, ChevronRight, AlertTriangle, Loader2, Send } from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { SafetyNote } from "@/components/ui/safety-note"
import { cn } from "@/lib/utils"
import { getSOPs, proposeUpdate } from "@/lib/api"
import Link from "next/link"

const statusConfig = {
  pending: { label: "Pending Review", className: "bg-[#0B6BCB]/10 text-[#0B6BCB]", step: 2 },
  approved: { label: "Approved", className: "bg-green-500/15 text-green-400", step: 3 },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-400", step: 3 },
  draft: { label: "Draft", className: "bg-amber-500/15 text-amber-400", step: 1 },
}

const timelineSteps = ["Draft", "Pending Review", "Approved / Rejected"]

const mockUpdates = [
  { id: "1", sopId: "1", sop: "Sepsis Management Protocol", section: "Section 4.2 - Fluid Resuscitation", status: "pending" as const, proposedBy: "Dr. Smith", date: "2024-10-15", current: "Administer 30 mL/kg crystalloid within 3 hours", proposed: "Administer 30 mL/kg crystalloid within 1 hour of sepsis recognition", reason: "Updated per Surviving Sepsis Campaign 2024 guidelines" },
  { id: "2", sopId: "2", sop: "Blood Transfusion Guidelines", section: "Section 2.1 - Pre-transfusion", status: "approved" as const, proposedBy: "Dr. Johnson", date: "2024-10-10", current: "Verify ABO/Rh compatibility", proposed: "Verify ABO/Rh compatibility using electronic crossmatch when available", reason: "Add electronic crossmatch option" },
  { id: "3", sopId: "3", sop: "Insulin Administration Protocol", section: "Section 3.1 - Dose Adjustment", status: "rejected" as const, proposedBy: "Nurse Williams", date: "2024-10-08", current: "Hold insulin if BG < 70 mg/dL", proposed: "Hold insulin if BG < 80 mg/dL", reason: "Higher threshold for safety" },
]

function StatusTimeline({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1 mt-3">
      {timelineSteps.map((step, i) => {
        const active = i + 1 <= currentStep
        return (
          <div key={step} className="flex items-center gap-1">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full border-2 transition-colors",
              active ? "bg-[#0B6BCB] border-[#0B6BCB]" : "border-slate-600 bg-transparent"
            )} />
            <span className={cn("text-[10px]", active ? "text-[#0B6BCB]" : "text-muted-foreground")}>{step}</span>
            {i < timelineSteps.length - 1 && (
              <div className={cn("w-6 h-px", active ? "bg-[#0B6BCB]" : "bg-slate-700")} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function UpdatesPage() {
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sops, setSops] = useState<any[]>([])
  const [selectedSopId, setSelectedSopId] = useState("")
  const [section, setSection] = useState("")
  const [currentText, setCurrentText] = useState("")
  const [proposedText, setProposedText] = useState("")
  const [reason, setReason] = useState("")
  const [proposerName, setProposerName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [proposals, setProposals] = useState<Array<{ id: string; sopId: string; sop: string; section: string; status: "pending" | "approved" | "rejected" | "draft"; proposedBy: string; date: string; current: string; proposed: string; reason: string }>>(mockUpdates)

  useEffect(() => {
    getSOPs()
      .then((data) => setSops(data))
      .catch(() => setSops([]))
  }, [])

  const handleSopChange = (sopId: string) => {
    setSelectedSopId(sopId)
    const sop = sops.find((s: any) => String(s.id) === sopId)
    if (sop) {
      setCurrentText("Select a section to view current text")
    } else {
      setCurrentText("")
    }
  }

  const resetForm = () => {
    setSelectedSopId("")
    setSection("")
    setCurrentText("")
    setProposedText("")
    setReason("")
    setProposerName("")
    setSubmitResult(null)
  }

  const handleSubmit = async () => {
    if (!selectedSopId || !section || !proposedText || !reason || !proposerName) {
      setSubmitResult({ type: "error", message: "Please fill in all required fields." })
      return
    }
    setSubmitting(true)
    setSubmitResult(null)
    try {
      await proposeUpdate(selectedSopId, section, currentText, proposedText, reason, proposerName)
      setSubmitResult({ type: "success", message: "Proposal submitted successfully! It will be reviewed by an administrator." })
      const sopName = sops.find((s: any) => String(s.id) === selectedSopId)?.title || "SOP"
      setProposals((prev) => [
        { id: String(Date.now()), sopId: selectedSopId, sop: sopName, section, status: "draft" as const, proposedBy: proposerName, date: new Date().toISOString().split("T")[0], current: currentText, proposed: proposedText, reason },
        ...prev,
      ])
      setTimeout(() => { resetForm(); setShowForm(false) }, 2000)
    } catch {
      setSubmitResult({ type: "error", message: "Failed to submit proposal. The backend may be unavailable." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <SafetyNote />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center">
              <GitBranch className="w-6 h-6 text-[#0B6BCB]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Protocol Updates</h2>
              <p className="text-sm text-muted-foreground">Propose and review changes to Standard Operating Procedures.</p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setSubmitResult(null) }}
            className="press inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Propose Update
          </button>
        </div>

        {/* Proposal Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-6 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06] space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#0B6BCB]" />
                  New Update Proposal
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Select SOP *</label>
                    <select
                      value={selectedSopId}
                      onChange={(e) => handleSopChange(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-muted dark:bg-[#11191b] border border-border dark:border-white/10 text-sm text-foreground dark:text-subtle caret-[#0B6BCB] dark:caret-[0B6BCB]"
                    >
                      <option value="">Select SOP...</option>
                      {sops.map((s: any) => (
                        <option key={s.id} value={String(s.id)}>{s.title || s.name}</option>
                      ))}
                      {sops.length === 0 && (
                        <>
                          <option value="demo-1">Sepsis Management Protocol</option>
                          <option value="demo-2">Blood Transfusion Guidelines</option>
                          <option value="demo-3">Insulin Administration Protocol</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Section *</label>
                    <input
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g., Section 4.2 - Fluid Resuscitation"
                      className="w-full p-2.5 rounded-xl bg-muted dark:bg-[#11191b] border border-border dark:border-white/10 text-sm text-foreground dark:text-subtle placeholder:text-muted-foreground dark:placeholder:text-muted-foreground caret-[#0B6BCB] dark:caret-[0B6BCB]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Current Text</label>
                  <textarea
                    value={currentText}
                    readOnly
                    rows={2}
                    className="w-full p-2.5 rounded-xl bg-muted/50 dark:bg-[#11191b]/50 border border-border dark:border-white/10 text-sm text-foreground dark:text-subtle placeholder:text-muted-foreground dark:placeholder:text-muted-foreground resize-none cursor-not-allowed"
                    placeholder="Select an SOP above to populate current text"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Proposed Change *</label>
                  <textarea
                    value={proposedText}
                    onChange={(e) => setProposedText(e.target.value)}
                    placeholder="Enter the proposed new text for this section..."
                    rows={3}
                    className="w-full p-2.5 rounded-xl bg-muted dark:bg-[#11191b] border border-border dark:border-white/10 text-sm text-foreground dark:text-subtle placeholder:text-muted-foreground dark:placeholder:text-muted-foreground caret-[#0B6BCB] dark:caret-[0B6BCB] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Reason for Update *</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why this change is needed (e.g., updated guidelines, safety improvement)..."
                    rows={2}
                    className="w-full p-2.5 rounded-xl bg-muted dark:bg-[#11191b] border border-border dark:border-white/10 text-sm text-foreground dark:text-subtle placeholder:text-muted-foreground dark:placeholder:text-muted-foreground caret-[#0B6BCB] dark:caret-[0B6BCB] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Your Name *</label>
                  <input
                    value={proposerName}
                    onChange={(e) => setProposerName(e.target.value)}
                    placeholder="e.g., Dr. Smith"
                    className="w-full p-2.5 rounded-xl bg-muted dark:bg-[#11191b] border border-border dark:border-white/10 text-sm text-foreground dark:text-subtle placeholder:text-muted-foreground dark:placeholder:text-muted-foreground caret-[#0B6BCB] dark:caret-[0B6BCB]"
                  />
                </div>

                {submitResult && (
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm",
                    submitResult.type === "success"
                      ? "bg-green-500/10 border border-green-500/20 text-green-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-400"
                  )}>
                    {submitResult.type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {submitResult.message}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="press inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-50 text-white text-sm font-medium transition-colors"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {submitting ? "Submitting..." : "Submit Proposal"}
                  </button>
                  <button onClick={() => { setShowForm(false); resetForm() }} className="press px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Proposals List */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Existing Proposals</h3>
          <div className="space-y-3">
            {proposals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl bg-card dark:bg-white/[0.03] border border-border dark:border-white/[0.06]">
                <div className="w-16 h-16 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center mb-4">
                  <GitBranch className="w-8 h-8 text-[#0B6BCB] dark:text-[0B6BCB]" />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground mb-1">No update proposals yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-5">
                  Propose a change to an SOP&apos;s wording, thresholds, or procedure steps for clinical governance review.
                </p>
                <Link
                  href="/library"
                  className="press inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#0B6BCB] hover:bg-[#0959AC] text-white transition-colors"
                >
                  Browse SOP Library
                </Link>
              </div>
            )}
            {proposals.map((update, i) => (
              <motion.div
                key={update.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="interactive-card rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === update.id ? null : update.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{update.sop}</p>
                    <p className="text-xs text-muted-foreground">{update.section} -- by {update.proposedBy} on {update.date}</p>
                  </div>
                  <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium shrink-0", statusConfig[update.status].className)}>
                    {statusConfig[update.status].label}
                  </span>
                  {expandedId === update.id ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                </button>

                <AnimatePresence>
                  {expandedId === update.id && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3 border-t border-border dark:border-white/[0.06] pt-3">
                        <StatusTimeline currentStep={statusConfig[update.status].step} />

                        <div className="grid md:grid-cols-2 gap-3 mt-3">
                          <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                            <p className="text-xs text-red-400 font-medium mb-1">Current Text</p>
                            <p className="text-sm text-muted-foreground">{update.current}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                            <p className="text-xs text-green-400 font-medium mb-1">Proposed Text</p>
                            <p className="text-sm text-muted-foreground">{update.proposed}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground"><span className="font-medium">Reason:</span> {update.reason}</p>
                        <p className="text-xs text-muted-foreground"><span className="font-medium">Proposed by:</span> {update.proposedBy}</p>
                        {update.status === "pending" && (
                          <div className="flex gap-2">
                            <button className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-sm font-medium hover:bg-green-500/25 transition-colors">
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button className="press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors">
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
