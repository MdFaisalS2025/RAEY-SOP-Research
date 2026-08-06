"use client"

// Primary actions render inline; everything else lives behind a "More"
// overflow menu instead of a second always-visible row - a real answer
// used to render ~10-11 buttons across two rows at once (heavier than the
// answer itself), which is the opposite of the quiet-icon-row pattern
// Claude/ChatGPT/Perplexity all use for secondary actions.

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToolbarAction {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  active?: boolean
  count?: number
  disabled?: boolean
}

function PrimaryButton({ action }: { action: ToolbarAction }) {
  const Icon = action.icon
  return (
    <button
      onClick={action.onClick}
      disabled={action.disabled}
      aria-label={action.label}
      aria-pressed={action.active}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        action.active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {action.label}
      {action.count !== undefined && action.count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-muted text-marker font-semibold text-muted-foreground">
          {action.count}
        </span>
      )}
    </button>
  )
}

function MoreMenuItem({ action, onAfterClick }: { action: ToolbarAction; onAfterClick: () => void }) {
  const Icon = action.icon
  return (
    <button
      role="menuitem"
      onClick={() => { action.onClick(); onAfterClick() }}
      disabled={action.disabled}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-chat text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        action.active ? "text-primary bg-primary/[0.06]" : "text-foreground hover:bg-muted"
      )}
    >
      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate">{action.label}</span>
      {action.count !== undefined && action.count > 0 && (
        <span className="text-meta text-muted-foreground">{action.count}</span>
      )}
    </button>
  )
}

export function AnswerActionToolbar({ primary, secondary }: { primary: ToolbarAction[]; secondary: ToolbarAction[] }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
      const items = panelRef.current ? Array.from(panelRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')) : []
      if (items.length === 0) return
      e.preventDefault()
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
      const nextIndex = e.key === "ArrowDown"
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length
      items[nextIndex]?.focus()
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    // Move focus to the first menu item on open, matching standard menu
    // button behavior (WAI-ARIA menu button pattern).
    panelRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div className="flex flex-wrap items-center gap-0.5 -mx-1">
      {primary.map((a) => <PrimaryButton key={a.key} action={a} />)}

      {secondary.length > 0 && (
        <div className="relative" ref={containerRef}>
          <button
            ref={triggerRef}
            onClick={() => setOpen((v) => !v)}
            title="More actions"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={open}
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
              open ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {/* Plain conditional, no AnimatePresence/exit: an exit-animated
              panel that doesn't unmount cleanly leaves an invisible node
              with pointer-events: auto sitting over whatever's underneath
              it (verified live - after closing, the panel was opacity:0
              but still pointer-events:auto and silently ate a real click
              on the composer beneath it). A plain conditional removes the
              node the instant `open` goes false. */}
          {open && (
            <motion.div
              ref={panelRef}
              role="menu"
              aria-label="More actions"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute z-20 right-0 sm:right-auto sm:left-0 top-full mt-1.5 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl bg-card border border-border shadow-lg overflow-hidden py-1"
            >
              {secondary.map((a) => (
                <MoreMenuItem key={a.key} action={a} onAfterClick={close} />
              ))}
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}
