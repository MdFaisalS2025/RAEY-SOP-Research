// The 7-utility pattern `bg-[#FEE2E2] dark:bg-red-500/10 border
// border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400`
// (and its warning/success siblings) repeats ~40 times across the app as
// hand-rolled domain badge maps. The domains themselves (proposal
// priority, exception severity, legal risk classification...) are
// genuinely different and correctly typed against their own unions -
// merging THOSE into one map would produce a stringly-typed god-object
// and lose type safety. What actually repeats is the tone underneath.
// Domain maps should reference `toneChip` rather than duplicate its
// class string; see components/proposals/badges.tsx for the pattern.
export type Tone = "danger" | "warning" | "success" | "info" | "neutral"

export const toneChip: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger-soft-fg border border-danger-soft-border",
  warning: "bg-warn-soft text-warn-soft-fg border border-warn-soft-border",
  success: "bg-ok-soft text-ok-soft-fg border border-ok-soft-border",
  info: "bg-primary/10 text-primary border border-primary/30",
  neutral: "bg-muted text-muted-foreground border border-input",
}
