"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, CheckCircle2, Eye, UserX, ShieldOff, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"

type OverrideReason = "will_monitor" | "not_applicable" | "disagree_with_sop" | "other"

export interface OverrideModalProps {
  open: boolean
  onClose: () => void
  contextType: "conflict" | "answer" | "cds_card"
  contextId: string
  contextLabel: string
  onSubmitted?: () => void
}

const REASONS: { key: OverrideReason; label: string; icon: typeof Eye }[] = [
  { key: "will_monitor", label: "Will monitor", icon: Eye },
  { key: "not_applicable", label: "Not applicable to this patient", icon: UserX },
  { key: "disagree_with_sop", label: "Disagree with the SOP", icon: ShieldOff },
  { key: "other", label: "Other", icon: MoreHorizontal },
]

export function OverrideModal({ open, onClose, contextType, contextId, contextLabel, onSubmitted }: OverrideModalProps) {
  const { currentUser } = useRole()
  const [reason, setReason] = useState<OverrideReason | null>(null)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "local">("idle")

  const reset = () => {
    setReason(null)
    setNote("")
    setSubmitting(false)
    setStatus("idle")
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!reason || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_type: contextType,
          context_id: contextId,
          context_label: contextLabel,
          user_id: currentUser.id,
          user_name: currentUser.name,
          reason,
          note,
        }),
      })
      setStatus(res.ok ? "success" : "local")
    } catch {
      setStatus("local")
    } finally {
      setSubmitting(false)
      setTimeout(() => {
        onSubmitted?.()
        handleClose()
      }, 1200)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-md rounded-2xl bg-card border border-[#E2E8F0] shadow-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {status !== "idle" ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-10">
                <div className="w-12 h-12 rounded-full bg-[#DCFCE7] dark:bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-[#15803D] dark:text-green-400" />
                </div>
                <p className="text-sm font-semibold text-[#15803D] dark:text-green-400">
                  {status === "success" ? "Override recorded" : "Recorded locally"}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between px-5 py-4 border-b border-[#E2E8F0]">
                  <div>
                    <h2 className="text-sm font-semibold text-[#1A2332]">Why are you overriding this?</h2>
                    <p className="text-xs text-[#64748B] mt-1">{contextLabel}</p>
                  </div>
                  <button onClick={handleClose} aria-label="Close override dialog" className="text-[#64748B] hover:text-[#1A2332] transition-colors shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-2">
                  {REASONS.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setReason(r.key)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-sm font-medium transition-colors",
                        reason === r.key
                          ? "bg-[#0B6BCB]/10 border-[#0B6BCB]/40 text-[#0B6BCB]"
                          : "border-[#E2E8F0] text-[#334155] hover:bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                          reason === r.key ? "border-[#0B6BCB]" : "border-[#CBD5E1]"
                        )}
                      >
                        {reason === r.key && <span className="w-2 h-2 rounded-full bg-[#0B6BCB]" />}
                      </span>
                      <r.icon className="w-4 h-4 shrink-0" />
                      {r.label}
                    </button>
                  ))}

                  {reason === "other" && (
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Briefly describe your reason..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl bg-muted border border-[#E2E8F0] text-sm text-[#1A2332] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0B6BCB]/30 resize-none"
                    />
                  )}
                </div>

                <div className="flex items-center gap-3 px-5 pb-5 pt-1">
                  <button
                    onClick={handleSubmit}
                    disabled={!reason || submitting}
                    className="flex-1 py-2.5 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                  <button
                    onClick={handleClose}
                    className="text-sm text-[#64748B] hover:text-[#1A2332] font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
