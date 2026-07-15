"use client"

// Shared word-level redline diff renderer - used by the governance proposal
// RedlineTab (proposals/[id]/page.tsx) and the SOP version-history diff
// viewer (version-history-panel.tsx), so there is exactly one place that
// renders a DiffSegment[] instead of two copies of the same markup.

export interface DiffSegment {
  type: "equal" | "insert" | "delete"
  text: string
}

export interface DiffStats {
  words_added: number
  words_removed: number
  words_unchanged: number
}

export function DiffStatsRow({ stats }: { stats: DiffStats }) {
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30">
        +{stats.words_added} words added
      </span>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30">
        -{stats.words_removed} words removed
      </span>
    </div>
  )
}

export function DiffView({ segments }: { segments: DiffSegment[] }) {
  return (
    <div className="rounded-2xl bg-muted border border-border p-5">
      <p className="text-[14px] leading-relaxed whitespace-pre-wrap font-mono">
        {segments.map((seg, i) => {
          if (seg.type === "equal") return <span key={i} className="text-foreground">{seg.text}</span>
          if (seg.type === "insert") return (
            <span key={i} className="underline decoration-2 decoration-[#15803D] bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400">
              {seg.text}
            </span>
          )
          return (
            <span key={i} className="line-through decoration-2 decoration-[#B91C1C] bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400">
              {seg.text}
            </span>
          )
        })}
      </p>
    </div>
  )
}
