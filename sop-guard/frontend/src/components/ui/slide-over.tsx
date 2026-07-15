"use client"

// Generic right-side slide-over drawer, extracted from the "Source Detail"
// drawer pattern that used to be duplicated inline in query/page.tsx.
// One shell now drives every secondary answer panel (External Evidence,
// Compare SOP vs Internet, Version History, Trust & Audit) instead of each
// feature inventing its own drawer/modal/inline-card - same backdrop,
// same close affordance, same slide-in spring, every time.

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  width = "lg",
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  /** "lg" for compact content (Evidence, Trust), "2xl" for tables/timelines (Comparison, Version History). */
  width?: "lg" | "2xl"
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // The backdrop/panel stay permanently mounted (never conditionally
  // rendered via AnimatePresence's exit) and are driven purely by `open`.
  // An earlier version unmounted on close via `{open && <motion.div exit=.../>}`;
  // when the evidence panel's own async fetch re-rendered a descendant mid-exit,
  // AnimatePresence's exit-complete callback never fired, leaving an invisible
  // (opacity: 0) but still `pointer-events: auto` backdrop covering the whole
  // page and silently blocking every click behind it. Always-mounted + a style
  // that's synchronously tied to the live `open` prop can't get stuck that way.
  if (!mounted) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm transition-opacity duration-200"
      style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      aria-hidden={!open}
      onClick={onClose}>
      <motion.div
        initial={false}
        animate={{ x: open ? 0 : "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn(
          "w-full h-full bg-card border-l border-border shadow-2xl overflow-y-auto flex flex-col",
          width === "2xl" ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-border bg-card">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5 text-[#0B6BCB] shrink-0" />}
              {title}
            </h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" title="Close"
            className="shrink-0 p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 p-5 sm:p-6">
          {open && children}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
