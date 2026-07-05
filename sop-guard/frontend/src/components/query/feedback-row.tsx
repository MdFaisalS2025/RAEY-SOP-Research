"use client"

import { useEffect, useState } from "react"
import { MessageCircleQuestion, ThumbsDown, ThumbsUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { OverrideModal } from "@/components/ui/override-modal"

type FeedbackChoice = "helpful" | "clarification" | "disagree"

function hashQuery(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return `sop-guard-answer-feedback-${hash}`
}

export function FeedbackRow({ queryText, answerId }: { queryText: string; answerId?: string | null }) {
  const [choice, setChoice] = useState<FeedbackChoice | null>(null)
  const [showOverride, setShowOverride] = useState(false)
  const storageKey = hashQuery(queryText)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved === "helpful" || saved === "clarification" || saved === "disagree") setChoice(saved)
      else setChoice(null)
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const select = (c: FeedbackChoice) => {
    setChoice(c)
    try {
      localStorage.setItem(storageKey, c)
    } catch {
      /* ignore */
    }
    if (c === "disagree") {
      setShowOverride(true)
    }
  }

  const options: { key: FeedbackChoice; label: string; icon: typeof ThumbsUp; active: string }[] = [
    { key: "helpful", label: "Helpful", icon: ThumbsUp, active: "bg-[#DCFCE7] border-[#BBF7D0] text-[#15803D]" },
    { key: "clarification", label: "Needs clarification", icon: MessageCircleQuestion, active: "bg-[#FEF3C7] border-[#FDE68A] text-[#B45309]" },
    { key: "disagree", label: "Disagree", icon: ThumbsDown, active: "bg-[#FEE2E2] border-[#FECACA] text-[#B91C1C]" },
  ]

  return (
    <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-[#64748B]">Does this match your practice?</span>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => select(o.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors duration-150",
                choice === o.key
                  ? o.active
                  : "border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#1A2332] hover:border-[#CBD5E1]"
              )}
            >
              <o.icon className="w-4 h-4" />
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {choice && (
        <p className="text-xs text-[#64748B] mt-2.5">
          Feedback recorded. Repeated disagreement flags this answer for compliance review.
        </p>
      )}
      <OverrideModal
        open={showOverride}
        onClose={() => setShowOverride(false)}
        contextType="answer"
        contextId={answerId ?? storageKey}
        contextLabel={queryText}
      />
    </div>
  )
}
