"use client"

// Centered modal for structured answer feedback ("Flag Issue"), replacing
// the old inline activePanel === "feedback" card. Copies the backdrop/
// scale-in/success-state pattern already established in override-modal.tsx
// rather than inventing a new modal shell for this one case.

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, CheckCircle2, XCircle, AlertTriangle, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDialogA11y } from "@/lib/use-dialog-a11y"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export type FeedbackType = "incorrect" | "unsafe" | "missing"

const FEEDBACK_TYPES: { key: FeedbackType; label: string; icon: typeof XCircle; description: string }[] = [
  { key: "incorrect", label: "Incorrect", icon: XCircle, description: "The answer contains wrong information" },
  { key: "unsafe", label: "Unsafe", icon: AlertTriangle, description: "Following this could cause harm" },
  { key: "missing", label: "Missing Info", icon: FileText, description: "Something important is left out" },
]

export function FeedbackModal({
  open,
  onClose,
  questionText,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  questionText: string
  onSubmit: (type: FeedbackType, note: string) => Promise<void> | void
}) {
  const [type, setType] = useState<FeedbackType | null>(null)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const reset = () => { setType(null); setNote(""); setSubmitting(false); setSubmitted(false) }
  const handleClose = () => { reset(); onClose() }
  useDialogA11y(open, handleClose, closeButtonRef)

  const handleSubmit = async () => {
    if (!type || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(type, note)
    } finally {
      setSubmitting(false)
      setSubmitted(true)
      setTimeout(handleClose, 1200)
    }
  }

  // Always mounted (never conditionally unmounted via AnimatePresence exit) -
  // see slide-over.tsx for why: an async setState mid-exit can prevent the
  // exit-complete callback from firing, leaving an invisible backdrop that
  // still intercepts every click on the page underneath it.
  if (!mounted) return null
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-150"
      style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      aria-hidden={!open}
      onClick={handleClose}>
      <Card padding="none" className="w-full max-w-md shadow-md overflow-hidden transition-all duration-150" style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1) translateY(0)" : "scale(0.96) translateY(12px)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Flag this answer">
        {open && (
          submitted ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-10">
                <div className="w-12 h-12 rounded-full bg-[#DCFCE7] dark:bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-[#15803D] dark:text-green-400" />
                </div>
                <p className="text-sm font-semibold text-[#15803D] dark:text-green-400">Feedback submitted - thank you</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">Flag this answer</h2>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{questionText}</p>
                  </div>
                  <button ref={closeButtonRef} onClick={handleClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-2">
                  {FEEDBACK_TYPES.map((f) => (
                    <button key={f.key} onClick={() => setType(f.key)}
                      className={cn("w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors",
                        type === f.key ? "bg-[#0B6BCB]/10 border-[#0B6BCB]/40" : "border-border hover:bg-muted")}>
                      <f.icon className={cn("w-4 h-4 shrink-0 mt-0.5", type === f.key ? "text-[#0B6BCB]" : "text-muted-foreground")} />
                      <span>
                        <span className={cn("block text-sm font-medium", type === f.key ? "text-[#0B6BCB]" : "text-foreground")}>{f.label}</span>
                        <span className="block text-xs text-muted-foreground">{f.description}</span>
                      </span>
                    </button>
                  ))}
                  <textarea
                    aria-label="Optional feedback details"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional details - what should be different?"
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-[#0B6BCB]/30 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 px-5 pb-5 pt-1">
                  <Button className="flex-1 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-colors" onClick={handleSubmit} disabled={!type || submitting}>
                    {submitting ? "Submitting..." : "Submit feedback"}
                  </Button>
                  <button onClick={handleClose} className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors">
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
