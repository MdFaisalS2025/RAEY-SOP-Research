import { Skeleton } from "@/components/ui/skeleton"

/**
 * Generic "content is loading" placeholder with the accessibility pattern
 * query/page.tsx's AnswerSkeleton already got right (the best loader in
 * the app) - a visually-hidden aria-live status announcement as a sibling
 * to the decorative, aria-hidden shimmer, not nested inside it. Most pages
 * either show bare "Loading..." text with no skeleton, or nothing at all.
 */
export function LoadingBlock({ label = "Loading...", lines = 3 }: { label?: string; lines?: number }) {
  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">{label}</span>
      <div className="p-6 rounded-2xl bg-card border border-border space-y-3" aria-hidden="true">
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
          ))}
        </div>
      </div>
    </>
  )
}
