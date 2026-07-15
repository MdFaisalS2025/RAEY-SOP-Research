"use client"

// Labeled "Answer tools" toolbar replacing the old icon-only action-bar
// row. Every button has a visible text label (icons are decorative/
// leading, never the only signal) - this is what the redesign asked for
// specifically ("no important action should be icon-only").

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

function ToolbarButton({ action, size }: { action: ToolbarAction; size: "primary" | "secondary" }) {
  const Icon = action.icon
  return (
    <button
      onClick={action.onClick}
      disabled={action.disabled}
      title={action.label}
      aria-label={action.label}
      aria-pressed={action.active}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6BCB]/40",
        size === "primary" ? "px-4 py-2.5 text-sm" : "px-3.5 py-2 text-[13px]",
        action.active
          ? "bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 text-[#0B6BCB] dark:text-[#00E5FF] border border-[#0B6BCB]/30"
          : size === "primary"
          ? "bg-card border border-border text-foreground hover:border-[#0B6BCB]/40 hover:bg-[#0B6BCB]/[0.04]"
          : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {action.label}
      {action.count !== undefined && action.count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
          {action.count}
        </span>
      )}
    </button>
  )
}

export function AnswerActionToolbar({ primary, secondary }: { primary: ToolbarAction[]; secondary: ToolbarAction[] }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Answer tools</p>
      <div className="flex flex-wrap gap-2">
        {primary.map((a) => <ToolbarButton key={a.key} action={a} size="primary" />)}
      </div>
      <div className="flex flex-wrap gap-1">
        {secondary.map((a) => <ToolbarButton key={a.key} action={a} size="secondary" />)}
      </div>
    </div>
  )
}
