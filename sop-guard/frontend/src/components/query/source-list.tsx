"use client"

// Vertical reference list (Phase R4), replacing the old horizontally-
// scrolling SourceStrip pill row. The pills showed only a truncated SOP
// title (max-w-[160px]) and hid version/section/date entirely; this shows
// each citation as a numbered row with the title as an accent link and a
// muted metadata line beneath it, closer to how OpenEvidence and most
// citation-heavy answer surfaces present references. New component (not
// folded into chat-answer-message.tsx, already 600+ lines) because this
// has its own state (expand/collapse) and its own internal/external
// metadata-assembly logic.

import { useState } from "react"
import { ExternalLink } from "lucide-react"
import { daysUntilReview, type InlineCitation } from "@/components/query/citation-chip"

const INITIAL_SHOWN = 3

/** Metadata line for one citation, built only from fields the backend
 * actually populated - never fabricated. Internal citations show version/
 * section/effective-date; external ones show the venue (carried in
 * section_title, same field citation-chip's popover already reads it
 * from) and publication date. Returns "" when nothing is available. */
function metaLine(c: InlineCitation): string {
  const parts = c.is_external
    ? [c.section_title, c.pub_date]
    : [c.version ? `v${c.version}` : "", c.section_title, c.effective_date ? `effective ${c.effective_date}` : ""]
  const joined = parts.filter(Boolean).join(" · ")

  // Overdue-only freshness signal - "Review current" on every row is
  // reassurance noise (the same reasoning behind the PHI all-clear line
  // staying silent, query/page.tsx), and "due in 22 days" isn't
  // actionable while reading an answer. Overdue is. Full staleness
  // detail (including the "current"/"due soon" states) stays available
  // in the citation popover and the Trust & Audit panel.
  const days = daysUntilReview(c.review_date)
  if (days !== null && days < 0) {
    const overdue = `review overdue ${Math.abs(days)}d`
    return joined ? `${joined} · ${overdue}` : overdue
  }
  return joined
}

function SourceRow({ citation, onSelect }: { citation: InlineCitation; onSelect: (n: number) => void }) {
  const meta = metaLine(citation)
  const overdue = meta.includes("review overdue")
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-4 pt-[0.3rem] text-marker font-semibold text-muted-foreground tabular-nums text-right">
        {citation.number}
      </span>
      <div className="min-w-0">
        <button
          onClick={() => onSelect(citation.number)}
          className="text-left text-chat font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          {citation.sop_title}
          {citation.is_external && <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />}
        </button>
        {meta && (
          <p className={overdue ? "text-meta-xs text-danger-soft-fg mt-0.5" : "text-meta-xs text-muted-foreground mt-0.5"}>
            {meta}
          </p>
        )}
      </div>
    </li>
  )
}

export function SourceList({ citations, onSelect }: { citations: InlineCitation[]; onSelect: (n: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  if (citations.length === 0) return null

  const shown = expanded ? citations : citations.slice(0, INITIAL_SHOWN)

  return (
    <div>
      <p className="text-label font-semibold uppercase tracking-wide text-muted-foreground mb-3">Sources</p>
      <ul className="space-y-4">
        {shown.map((c) => (
          <SourceRow key={c.number} citation={c} onSelect={onSelect} />
        ))}
      </ul>
      {citations.length > INITIAL_SHOWN && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-label font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Show fewer" : `Show all ${citations.length} sources`}
        </button>
      )}
    </div>
  )
}
