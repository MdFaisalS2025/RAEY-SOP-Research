"use client"

import { useId, useState } from "react"
import { ExternalLink } from "lucide-react"

export interface InlineCitation {
  number: number
  sop_id: string
  sop_title: string
  section_title: string
  chunk_type: string
  snippet: string
  relevance_score: number
  cited_in_answer: boolean
  version?: string
  effective_date?: string
  review_date?: string
  status?: string
  /** Set for external-literature citations (Route B/C) - opens the source
   * directly instead of scrolling to the internal Sources panel. */
  url?: string
  is_external?: boolean
  pub_date?: string
}

/** Days until (positive) or since (negative) review_date; null if unset/invalid. */
export function daysUntilReview(reviewDate: string | undefined): number | null {
  if (!reviewDate) return null
  const due = new Date(reviewDate)
  if (isNaN(due.getTime())) return null
  return Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export function reviewStaleness(reviewDate: string | undefined): { label: string; className: string } | null {
  const days = daysUntilReview(reviewDate)
  if (days === null) return null
  if (days < 0) return { label: `Review overdue (${Math.abs(days)}d)`, className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30" }
  if (days <= 30) return { label: `Review due in ${days}d`, className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30" }
  return { label: "Review current", className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30" }
}

export function CitationChip({
  citation,
  number,
  onClick,
}: {
  citation: InlineCitation | undefined
  number: number
  onClick?: (n: number) => void
}) {
  const [open, setOpen] = useState(false)
  const popoverId = useId()

  // Graceful fallback: no citation data, render dimmed plain text
  if (!citation) {
    return <span className="text-subtle text-[13px]">[{number}]</span>
  }

  const isExternal = !!citation.is_external

  const handleActivate = () => {
    if (isExternal && citation.url) {
      window.open(citation.url, "_blank", "noopener,noreferrer")
    } else {
      onClick?.(number)
    }
  }

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={handleActivate}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false) }}
        aria-describedby={open ? popoverId : undefined}
        className="relative inline-flex items-center justify-center text-[10px] font-medium text-[#0B6BCB] bg-[#0B6BCB]/[0.08] border border-[#0B6BCB]/25 rounded px-1 min-w-[16px] h-4 mx-0.5 align-super cursor-pointer touch-manipulation hover:bg-[#0B6BCB]/15 active:bg-[#0B6BCB]/20 transition-colors duration-150 before:content-[''] before:absolute before:-inset-2"
        aria-label={`Citation ${number}: ${citation.sop_title}${isExternal ? " (external source, opens in new tab)" : ""}`}
      >
        {number}
      </button>
      {open && (
        <span id={popoverId} role="tooltip" className="absolute z-40 left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-72 p-3 rounded-xl bg-card border border-border shadow-md text-left block">
          {isExternal ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30 uppercase tracking-wide">
                  External literature
                </span>
                {citation.pub_date && <span className="text-[10px] text-subtle">{citation.pub_date}</span>}
              </span>
              <span className="block text-[12px] font-semibold text-foreground leading-snug mt-1.5">{citation.sop_title}</span>
              <span className="block text-[11px] text-[#0B6BCB] mt-0.5">{citation.section_title}</span>
              {citation.chunk_type && (
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-card text-muted-foreground border border-input">
                  {citation.chunk_type}
                </span>
              )}
              {/* The excerpt from the source's own abstract (see
                  pick_supporting_excerpt) that actually supports this claim -
                  falls back to the title itself when no abstract was
                  available (routing.py's snippet = excerpt or title), so
                  this is never empty for an external citation. */}
              {citation.snippet && citation.snippet !== citation.sop_title && (
                <span className="block text-[11px] text-foreground/80 italic leading-relaxed mt-1.5 line-clamp-3">
                  &ldquo;{citation.snippet}&rdquo;
                </span>
              )}
              {citation.url && (
                <span className="flex items-center gap-1 mt-2 text-[11px] font-medium text-[#0B6BCB]">
                  <ExternalLink className="w-3 h-3" /> Opens source in a new tab
                </span>
              )}
            </>
          ) : (
            <>
              <span className="block text-[12px] font-semibold text-foreground leading-snug">{citation.sop_title}</span>
              <span className="block text-[11px] text-[#0B6BCB] mt-0.5">{citation.section_title}</span>
              <span className="flex flex-wrap gap-1 mt-1">
                {citation.chunk_type && (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-card text-muted-foreground border border-input capitalize">
                    {citation.chunk_type.replace(/_/g, " ")}
                  </span>
                )}
                {citation.version && (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-card text-muted-foreground border border-input">
                    v{citation.version}
                  </span>
                )}
                {reviewStaleness(citation.review_date) && (
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${reviewStaleness(citation.review_date)!.className}`}>
                    {reviewStaleness(citation.review_date)!.label}
                  </span>
                )}
              </span>
              <span className="block text-[11px] text-muted-foreground leading-relaxed mt-1.5 line-clamp-3">{citation.snippet}</span>
              <span className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-subtle">Relevance</span>
                <span className="flex-1 h-1 rounded-full bg-[#EDF1F5] overflow-hidden block">
                  <span
                    className="block h-full rounded-full bg-[#0B6BCB]"
                    style={{ width: `${Math.round(citation.relevance_score * 100)}%` }}
                  />
                </span>
                <span className="text-[10px] font-mono text-[#0B6BCB]">{Math.round(citation.relevance_score * 100)}%</span>
              </span>
            </>
          )}
        </span>
      )}
    </span>
  )
}
