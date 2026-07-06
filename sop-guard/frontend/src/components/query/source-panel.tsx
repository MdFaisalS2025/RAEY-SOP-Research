"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ExternalLink, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { reviewStaleness, type InlineCitation } from "./citation-chip"

function SourceRow({
  citation,
  highlighted,
  dimmed,
}: {
  citation: InlineCitation
  highlighted: boolean
  dimmed?: boolean
}) {
  return (
    <div
      id={`source-entry-${citation.number}`}
      className={cn(
        "p-4 rounded-xl border transition-colors duration-200",
        highlighted
          ? "bg-[#0B6BCB]/[0.06] border-[#0B6BCB]/40"
          : "bg-card border-[#E2E8F0]",
        dimmed && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded text-[11px] font-bold text-white bg-[#0B6BCB]">
          {citation.number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#1A2332]">{citation.sop_title}</span>
            {citation.chunk_type && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-card text-[#475569] border border-[#CBD5E1] capitalize">
                {citation.chunk_type.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">{citation.section_title}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {citation.version && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-card text-[#475569] border border-[#CBD5E1]">
                v{citation.version}
              </span>
            )}
            {citation.effective_date && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-card text-[#475569] border border-[#CBD5E1]">
                Effective {citation.effective_date}
              </span>
            )}
            {reviewStaleness(citation.review_date) && (
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium border", reviewStaleness(citation.review_date)!.className)}>
                {reviewStaleness(citation.review_date)!.label}
              </span>
            )}
            {citation.status && citation.status !== "active" && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30 capitalize">
                {citation.status}
              </span>
            )}
          </div>
          <p className="text-[13px] leading-relaxed text-[#334155] mt-1.5 line-clamp-3">{citation.snippet}</p>
          <div className="flex items-center justify-between gap-3 mt-2.5">
            <div className="flex items-center gap-2 flex-1 max-w-[220px]">
              <span className="text-[11px] text-[#94A3B8] shrink-0">Relevance</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#EDF1F5] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0B6BCB] transition-all duration-200"
                  style={{ width: `${Math.round(citation.relevance_score * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-[#0B6BCB] shrink-0">
                {Math.round(citation.relevance_score * 100)}%
              </span>
            </div>
            <a
              href="/library"
              className="inline-flex items-center gap-1 text-[11px] text-[#0B6BCB] hover:underline shrink-0"
            >
              View in Library
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
}: {
  citations: InlineCitation[]
  highlightedNumber: number | null
}) {
  const [showUncited, setShowUncited] = useState(false)
  const cited = citations.filter((c) => c.cited_in_answer)
  const uncited = citations.filter((c) => !c.cited_in_answer)

  return (
    <div className="p-5 rounded-2xl bg-card border border-[#E2E8F0] shadow-sm">
      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-[#1A2332]">
        <FileText className="w-4 h-4 text-[#0B6BCB]" />
        Sources
      </h3>
      <div className="space-y-3">
        {cited.map((c) => (
          <SourceRow key={c.number} citation={c} highlighted={highlightedNumber === c.number} />
        ))}
      </div>
      {uncited.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowUncited(!showUncited)}
            className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#1A2332] transition-colors duration-150"
          >
            {showUncited ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Also retrieved (not cited) ({uncited.length})
          </button>
          {showUncited && (
            <div className="space-y-3 mt-3">
              {uncited.map((c) => (
                <SourceRow key={c.number} citation={c} highlighted={highlightedNumber === c.number} dimmed />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
