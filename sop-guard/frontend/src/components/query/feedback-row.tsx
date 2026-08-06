"use client"

import { useEffect, useState } from "react"
import { MessageCircleQuestion, ShieldOff, ThumbsDown, ThumbsUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { OverrideModal } from "@/components/ui/override-modal"
import { FeedbackModal, type FeedbackType } from "@/components/ui/feedback-modal"
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
  // "Disagree" used to open OverrideModal directly, but that modal's
  // reasons (will_monitor/not_applicable/disagree_with_sop) are a clinical-
  // override audit record ("I read this and am departing from it for this
  // patient"), not an answer-quality report ("Meridian got this wrong") -
  // which is what a thumbs-down actually means. It now opens FeedbackModal
  // (Incorrect/Unsafe/Missing Info) instead; the override capture moves to
  // its own explicit button below so that record-keeping path isn't lost.
  const [showFeedback, setShowFeedback] = useState(false)
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
      setShowFeedback(true)
    } else {
      // Backend's feedback_type vocabulary is positive/negative/correction/
      // clarification/incorrect/unsafe/missing - "helpful" maps to
      // "positive"; "clarification" already matches by name.
      submitFeedback({ answerId, feedbackType: c === "helpful" ? "positive" : c, feedbackText: "" }).catch(() => { /* best-effort */ })
      toast({ description: "Feedback recorded", variant: "success" })
    }
  }

  const options: { key: FeedbackChoice; label: string; icon: typeof ThumbsUp; active: string }[] = [
    { key: "helpful", label: "Helpful", icon: ThumbsUp, active: "text-ok-soft-fg bg-ok-soft" },
    { key: "clarification", label: "Needs clarification", icon: MessageCircleQuestion, active: "text-warn-soft-fg bg-warn-soft" },
    { key: "disagree", label: "Disagree", icon: ThumbsDown, active: "text-danger-soft-fg bg-danger-soft" },
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
      <button
        onClick={() => setShowOverride(true)}
        title="Override guidance"
        aria-label="Override guidance"
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <ShieldOff className="w-4 h-4" />
      </button>
      <FeedbackModal
        open={showFeedback}
        onClose={() => setShowFeedback(false)}
        questionText={queryText}
        onSubmit={(type: FeedbackType, note: string) =>
          submitFeedback({ answerId, feedbackType: type, feedbackText: note }).then(() => {
            toast({ description: "Feedback recorded", variant: "success" })
          })
        }
      />
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
