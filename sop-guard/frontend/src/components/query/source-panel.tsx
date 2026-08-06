"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ExternalLink, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { reviewStaleness, type InlineCitation } from "./citation-chip"
import { Card } from "@/components/ui/card"

/** Builds the deep-link target for "cite to exact line": the Library's
 * Full Text tab, with enough context (source snippet + section heading)
 * for a view-time text match to locate and highlight the exact passage.
 * Uses `sectionTitle` (not `section`) since the Library page already uses
 * `section` to mean which tab to open. */
function libraryDeepLink(citation: InlineCitation): string {
  const params = new URLSearchParams({ sopId: citation.sop_id })
  if (citation.snippet) params.set("highlight", citation.snippet)
  if (citation.section_title) params.set("sectionTitle", citation.section_title)
  return `/library?${params.toString()}`
}

function SourceRow({
  citation,
  highlighted,
  dimmed,
  onSelect,
}: {
  citation: InlineCitation
  highlighted: boolean
  dimmed?: boolean
  onSelect?: (citation: InlineCitation) => void
}) {
  return (
    <div
      id={`source-entry-${citation.number}`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(citation)}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(citation) }
      }}
      className={cn(
        "p-4 rounded-xl border transition-colors duration-200",
        onSelect && "cursor-pointer hover:border-primary/40",
        highlighted
          ? "bg-primary/[0.06] border-primary/40"
          : "bg-card border-border",
        dimmed && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded text-[11px] font-bold text-white bg-primary">
          {citation.number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{citation.sop_title}</span>
            {citation.chunk_type && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-card text-muted-foreground border border-input capitalize">
                {citation.chunk_type.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{citation.section_title}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {citation.version && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-card text-muted-foreground border border-input">
                v{citation.version}
              </span>
            )}
            {citation.effective_date && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-card text-muted-foreground border border-input">
                Effective {citation.effective_date}
              </span>
            )}
            {reviewStaleness(citation.review_date) && (
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border", reviewStaleness(citation.review_date)!.className)}>
                {reviewStaleness(citation.review_date)!.label}
              </span>
            )}
            {citation.status && citation.status !== "active" && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-soft text-danger-soft-fg border border-danger-soft-border capitalize">
                {citation.status}
              </span>
            )}
          </div>
          <p className="text-[13px] leading-relaxed text-foreground mt-1.5 line-clamp-3">{citation.snippet}</p>
          <div className="flex items-center justify-between gap-3 mt-2.5">
            {citation.is_external ? (
              <span className="text-[11px] text-subtle shrink-0">{citation.pub_date || ""}</span>
            ) : (
              <div className="flex items-center gap-2 flex-1 max-w-[220px]">
                <span className="text-[11px] text-subtle shrink-0">Relevance</span>
                <div className="flex-1 h-1.5 rounded-full bg-[#EDF1F5] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200"
                    style={{ width: `${Math.round(citation.relevance_score * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-primary shrink-0">
                  {Math.round(citation.relevance_score * 100)}%
                </span>
              </div>
            )}
            <a
              href={citation.is_external ? (citation.url || "#") : libraryDeepLink(citation)}
              target={citation.is_external ? "_blank" : undefined}
              rel={citation.is_external ? "noopener noreferrer" : undefined}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
            >
              {citation.is_external ? "View source" : "View in Library"}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SourcePanel({
  citations,
  highlightedNumber,
  onSelect,
}: {
  citations: InlineCitation[]
  highlightedNumber: number | null
  onSelect?: (citation: InlineCitation) => void
}) {
  const [showUncited, setShowUncited] = useState(false)
  const cited = citations.filter((c) => c.cited_in_answer)
  const uncited = citations.filter((c) => !c.cited_in_answer)

  return (
    <Card className="shadow-sm">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-foreground">
        <FileText className="w-4 h-4 text-primary" />
        Sources
      </h3>
      <div className="space-y-3">
        {cited.map((c) => (
          <SourceRow key={c.number} citation={c} highlighted={highlightedNumber === c.number} onSelect={onSelect} />
        ))}
      </div>
      {uncited.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowUncited(!showUncited)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            {showUncited ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Also retrieved (not cited) ({uncited.length})
          </button>
          {showUncited && (
            <div className="space-y-3 mt-3">
              {uncited.map((c) => (
                <SourceRow key={c.number} citation={c} highlighted={highlightedNumber === c.number} dimmed onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
