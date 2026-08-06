import Link from "next/link"
import type { LucideIcon } from "lucide-react"

/**
 * "Nothing here yet" state, distinct from ErrorState's "couldn't load."
 * Mirrors its visual shape and API so the two read as siblings rather
 * than two different design languages. ~20 pages previously hand-rolled
 * this as a one-off centered div, and none of them offered a next step -
 * `action` exists so genuinely actionable empty states (no proposals yet,
 * no SOPs uploaded) can point somewhere instead of just describing the
 * void.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; href: string } | { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
      {action && (
        "href" in action ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  )
}
