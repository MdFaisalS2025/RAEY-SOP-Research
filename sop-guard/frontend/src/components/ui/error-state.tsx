import { AlertTriangle, RotateCcw } from "lucide-react"

/**
 * "Couldn't load" state, distinct from an empty-but-successful fetch.
 * Several pages previously had `.catch(() => setX([]))` - a failed
 * request rendered identically to "there's genuinely nothing here,"
 * which reads as reassuring when the actual problem is the backend
 * being unreachable. Use this instead of silently falling through to
 * an empty-state render whenever a fetch's catch branch fires.
 */
export function ErrorState({ message = "Couldn't load this data.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="w-10 h-10 rounded-xl bg-danger-soft flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-danger-soft-fg" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">The backend didn&apos;t respond - this isn&apos;t an empty result.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  )
}
