import { cn } from "@/lib/utils"

/**
 * Small rounded icon tile used at the head of a card-style message (error,
 * clarification, empty/no-source states) - replaces three near-identical
 * hand-rolled divs (w-10 vs w-11, danger-soft vs primary/10 vs muted) that
 * had drifted to inconsistent sizes for the same visual role.
 */
export function IconTile({
  icon: Icon,
  tone = "muted",
  size = "md",
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone?: "muted" | "primary" | "danger"
  size?: "md" | "lg"
  className?: string
}) {
  const toneClasses: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    danger: "bg-danger-soft text-danger-soft-fg",
  }
  const sizeClasses: Record<string, string> = {
    md: "w-10 h-10",
    lg: "w-11 h-11",
  }
  return (
    <div className={cn("rounded-xl flex items-center justify-center shrink-0", sizeClasses[size], toneClasses[tone], className)}>
      <Icon className="w-5 h-5" />
    </div>
  )
}
