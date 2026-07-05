"use client"

import { ChevronRight } from "lucide-react"

export function FollowupChips({
  questions,
  onSelect,
}: {
  questions: string[]
  onSelect: (question: string) => void
}) {
  if (!questions || questions.length === 0) return null
  return (
    <div className="p-5 rounded-2xl bg-card border border-[#E2E8F0] shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">Related questions</p>
      <div className="space-y-2">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="w-full flex items-center gap-2.5 text-left border border-[#E2E8F0] rounded-lg px-4 py-2.5 hover:border-[#0B6BCB]/40 hover:bg-[#0B6BCB]/[0.04] transition-colors duration-150"
          >
            <ChevronRight className="w-4 h-4 text-[#0B6BCB] shrink-0" />
            <span className="text-sm text-[#1A2332]">{q}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
