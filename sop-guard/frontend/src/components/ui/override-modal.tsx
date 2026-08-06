"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, CheckCircle2, Eye, UserX, ShieldOff, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"
import { useDialogA11y } from "@/lib/use-dialog-a11y"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  useDialogA11y(open, handleClose, closeButtonRef)

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

  // Always mounted + portaled to document.body, driven by inline style
  // (not AnimatePresence unmount, not Tailwind opacity classes) - see
  // slide-over.tsx / feedback-modal.tsx for why: a non-portaled fixed
  // backdrop breaks under a transformed ancestor (e.g. a framer-motion `y`
  // animation on a wrapping element makes that ancestor the containing
  // block for `position: fixed`), and AnimatePresence exit-unmount can get
  // stuck if a descendant re-renders mid-exit, leaving an invisible but
  // still-clickable backdrop blocking the whole page.
  if (!mounted) return null
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-150"
      style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      aria-hidden={!open}
      onClick={handleClose}
    >
      <Card padding="none" className="w-full max-w-md shadow-md overflow-hidden transition-all duration-150" style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1) translateY(0)" : "scale(0.96) translateY(12px)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Why are you overriding this?"
      >
        {open && (
            status !== "idle" ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-10">
                <div className="w-12 h-12 rounded-full bg-ok-soft flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-ok-soft-fg" />
                </div>
                <p className="text-sm font-semibold text-ok-soft-fg">
                  {status === "success" ? "Override recorded" : "Recorded locally"}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Why are you overriding this?</h2>
                    <p className="text-xs text-muted-foreground mt-1">{contextLabel}</p>
                  </div>
                  <button ref={closeButtonRef} onClick={handleClose} aria-label="Close override dialog" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
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
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "border-border text-foreground hover:bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                          reason === r.key ? "border-primary" : "border-input"
                        )}
                      >
                        {reason === r.key && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </span>
                      <r.icon className="w-4 h-4 shrink-0" />
                      {r.label}
                    </button>
                  ))}

                  {reason === "other" && (
                    <textarea
                      aria-label="Reason for override"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Briefly describe your reason..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  )}
                </div>

                <div className="flex items-center gap-3 px-5 pb-5 pt-1">
                  <Button className="flex-1 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-colors" onClick={handleSubmit}
                    disabled={!reason || submitting}>
                    {submitting ? "Submitting..." : "Submit"}
                  </Button>
                  <button
                    onClick={handleClose}
                    className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )
        )}
      </Card>
    </div>,
    document.body
  )
}
