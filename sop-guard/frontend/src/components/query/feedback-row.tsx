"use client"

import { useEffect, useState } from "react"
import { MessageCircleQuestion, ThumbsDown, ThumbsUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { OverrideModal } from "@/components/ui/override-modal"
import { toast } from "@/components/ui/use-toast"
import { submitFeedback } from "@/lib/api"

type FeedbackChoice = "helpful" | "clarification" | "disagree"

function hashQuery(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return `meridian-answer-feedback-${hash}`
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
    } else {
      // "disagree" already gets a real backend call via OverrideModal
      // below (POST /api/overrides); helpful/clarification need their own.
      // Backend's feedback_type vocabulary is positive/negative/correction/
      // clarification/incorrect/unsafe/missing - "helpful" maps to
      // "positive"; "clarification" already matches by name.
      submitFeedback({ answerId, feedbackType: c === "helpful" ? "positive" : c, feedbackText: "" }).catch(() => { /* best-effort */ })
      toast({ description: "Feedback recorded", variant: "success" })
    }
  }

  const options: { key: FeedbackChoice; label: string; icon: typeof ThumbsUp; active: string }[] = [
    { key: "helpful", label: "Helpful", icon: ThumbsUp, active: "text-[#15803D] dark:text-green-400 bg-[#DCFCE7] dark:bg-green-500/10" },
    { key: "clarification", label: "Needs clarification", icon: MessageCircleQuestion, active: "text-[#B45309] dark:text-amber-400 bg-[#FEF3C7] dark:bg-amber-500/10" },
    { key: "disagree", label: "Disagree", icon: ThumbsDown, active: "text-[#B91C1C] dark:text-red-400 bg-[#FEE2E2] dark:bg-red-500/10" },
  ]

  return (
    <div className="flex items-center gap-1 px-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => select(o.key)}
          title={o.label}
          aria-label={o.label}
          aria-pressed={choice === o.key}
          className={cn(
            "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150",
            choice === o.key ? o.active : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <o.icon className="w-4 h-4" />
        </button>
      ))}
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
