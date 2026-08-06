"use client"

// Bare chips, no card and no "Related questions" heading (Phase Q4.7) -
// three question-shaped rows with a chevron already read as suggestions
// without a label restating that.

export function FollowupChips({
  questions,
  onSelect,
}: {
  questions: string[]
  onSelect: (question: string) => void
}) {
  if (!questions || questions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 px-1">
      {questions.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          className="text-left border border-border rounded-full px-3.5 py-1.5 text-chat text-foreground hover:border-foreground/20 hover:bg-muted transition-colors duration-150"
        >
          {q}
        </button>
      ))}
    </div>
  )
}
