"use client"

import { useState } from "react"

export interface InlineCitation {
  number: number
  sop_id: string
  sop_title: string
  section_title: string
  chunk_type: string
  snippet: string
  relevance_score: number
  cited_in_answer: boolean
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
  const [hovered, setHovered] = useState(false)

  // Graceful fallback: no citation data, render dimmed plain text
  if (!citation) {
    return <span className="text-[#94A3B8] text-[13px]">[{number}]</span>
  }

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={() => onClick?.(number)}
        className="inline-flex items-center justify-center text-[10px] font-medium text-[#0B6BCB] bg-[#0B6BCB]/[0.08] border border-[#0B6BCB]/25 rounded px-1 min-w-[16px] h-4 mx-0.5 align-super cursor-pointer hover:bg-[#0B6BCB]/15 transition-colors duration-150"
        aria-label={`Citation ${number}: ${citation.sop_title}`}
      >
        {number}
      </button>
      {hovered && (
        <span className="absolute z-40 left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-72 p-3 rounded-xl bg-white border border-[#E2E8F0] shadow-md text-left block">
          <span className="block text-[12px] font-semibold text-[#1A2332] leading-snug">{citation.sop_title}</span>
          <span className="block text-[11px] text-[#0B6BCB] mt-0.5">{citation.section_title}</span>
          {citation.chunk_type && (
            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white text-[#475569] border border-[#CBD5E1] capitalize">
              {citation.chunk_type.replace(/_/g, " ")}
            </span>
          )}
          <span className="block text-[11px] text-[#64748B] leading-relaxed mt-1.5 line-clamp-3">{citation.snippet}</span>
          <span className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-[#94A3B8]">Relevance</span>
            <span className="flex-1 h-1 rounded-full bg-[#EDF1F5] overflow-hidden block">
              <span
                className="block h-full rounded-full bg-[#0B6BCB]"
                style={{ width: `${Math.round(citation.relevance_score * 100)}%` }}
              />
            </span>
            <span className="text-[10px] font-mono text-[#0B6BCB]">{Math.round(citation.relevance_score * 100)}%</span>
          </span>
        </span>
      )}
    </span>
  )
}
