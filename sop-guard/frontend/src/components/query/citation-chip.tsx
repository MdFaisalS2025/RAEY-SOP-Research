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
  /** Exact character offsets into the SOP's raw_text, for opening the
   * source at the precise passage instead of a view-time text match.
   * Undefined/null when the backend couldn't locate a contiguous span
   * (see chunker.py's _locate_span) - never fabricated as 0. */
  char_start?: number | null
  char_end?: number | null
  offset_source?: string
  /** Verbatim head of raw_text at [char_start, char_end) - lets the
   * viewer verify these offsets still point at the same text before
   * trusting them (Phase Q2.1). Never the display snippet, which is
   * title-prefixed for section chunks. */
  offset_anchor?: string
  /** Narrowed sentence-level span within [char_start, char_end) - the
   * specific sentence the answer actually used, when the backend could
   * locate one (citation_tracker.narrow_citation_spans, Q2.6). Undefined
   * whenever nothing cleared the similarity bar; never fabricated. */
  passage_start?: number | null
  passage_end?: number | null
  passage_basis?: string
  passage_similarity?: number | null
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
  if (days < 0) return { label: `Review overdue (${Math.abs(days)}d)`, className: "bg-danger-soft text-danger-soft-fg border-danger-soft-border" }
  if (days <= 30) return { label: `Review due in ${days}d`, className: "bg-warn-soft text-warn-soft-fg border-warn-soft-border" }
  return { label: "Review current", className: "bg-ok-soft text-ok-soft-fg border-ok-soft-border" }
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
    return <span className="text-subtle text-label">[{number}]</span>
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
        className="relative inline-flex items-center justify-center text-marker font-medium text-primary bg-primary/[0.08] border border-primary/25 rounded px-1 min-w-[16px] h-4 mx-0.5 align-super cursor-pointer touch-manipulation hover:bg-primary/15 active:bg-primary/20 transition-colors duration-150 before:content-[''] before:absolute before:-inset-2"
        aria-label={`Citation ${number}: ${citation.sop_title}${isExternal ? " (external source, opens in new tab)" : ""}`}
      >
        {number}
      </button>
      {open && (
        <span id={popoverId} role="tooltip" className="absolute z-40 left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-72 max-w-[calc(100vw-1.5rem)] p-3 rounded-xl bg-card border border-border shadow-md text-left block">
          {isExternal ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="inline-block px-1.5 py-0.5 rounded text-marker font-semibold bg-primary/10 text-primary border border-primary/30 uppercase tracking-wide">
                  External literature
                </span>
                {citation.pub_date && <span className="text-marker text-subtle">{citation.pub_date}</span>}
              </span>
              <span className="block text-meta font-semibold text-foreground leading-snug mt-1.5">{citation.sop_title}</span>
              <span className="block text-meta-xs text-primary mt-0.5">{citation.section_title}</span>
              {citation.chunk_type && (
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-marker font-medium bg-card text-muted-foreground border border-input">
                  {citation.chunk_type}
                </span>
              )}
              {/* The excerpt from the source's own abstract (see
                  pick_supporting_excerpt) that actually supports this claim -
                  falls back to the title itself when no abstract was
                  available (routing.py's snippet = excerpt or title), so
                  this is never empty for an external citation. */}
              {citation.snippet && citation.snippet !== citation.sop_title && (
                <span className="block text-meta-xs text-foreground/80 italic leading-relaxed mt-1.5 line-clamp-3">
                  &ldquo;{citation.snippet}&rdquo;
                </span>
              )}
              {citation.url && (
                <span className="flex items-center gap-1 mt-2 text-meta-xs font-medium text-primary">
                  <ExternalLink className="w-3 h-3" /> Opens source in a new tab
                </span>
              )}
            </>
          ) : (
            <>
              <span className="block text-meta font-semibold text-foreground leading-snug">{citation.sop_title}</span>
              <span className="block text-meta-xs text-primary mt-0.5">{citation.section_title}</span>
              <span className="flex flex-wrap gap-1 mt-1">
                {citation.chunk_type && (
                  <span className="inline-block px-1.5 py-0.5 rounded text-marker font-medium bg-card text-muted-foreground border border-input capitalize">
                    {citation.chunk_type.replace(/_/g, " ")}
                  </span>
                )}
                {citation.version && (
                  <span className="inline-block px-1.5 py-0.5 rounded text-marker font-medium bg-card text-muted-foreground border border-input">
                    v{citation.version}
                  </span>
                )}
                {reviewStaleness(citation.review_date) && (
                  <span className={`inline-block px-1.5 py-0.5 rounded text-marker font-medium border ${reviewStaleness(citation.review_date)!.className}`}>
                    {reviewStaleness(citation.review_date)!.label}
                  </span>
                )}
              </span>
              <span className="block text-meta-xs text-muted-foreground leading-relaxed mt-1.5 line-clamp-3">{citation.snippet}</span>
              <span className="flex items-center gap-2 mt-2">
                <span className="text-marker text-subtle">Relevance</span>
                <span className="flex-1 h-1 rounded-full bg-muted overflow-hidden block">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(citation.relevance_score * 100)}%` }}
                  />
                </span>
                <span className="text-marker font-mono text-primary">{Math.round(citation.relevance_score * 100)}%</span>
              </span>
            </>
          )}
        </span>
      )}
    </span>
  )
}
