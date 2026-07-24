import { AlertTriangle } from "lucide-react"

/**
 * Explicit disclosure for a specific block of fabricated/placeholder data
 * that would otherwise be visually indistinguishable from a real, live
 * figure elsewhere on the same page. Distinct from SafetyNote (a generic
 * "verify against policy" line) - this says "the number above isn't real,"
 * which SafetyNote's wording never claims. Established on /legal and
 * /compliance (Phase H6); reused here for every other section that still
 * renders a hardcoded fixture as if it were a live metric.
 */
export function IllustrativeNote({ detail }: { detail: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-xs">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
      <span>{detail}</span>
    </div>
  )
}
