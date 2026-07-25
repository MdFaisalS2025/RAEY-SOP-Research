import { cn } from "@/lib/utils"

// Codifies the widths pages already use rather than flattening them -
// the max-w spread across the app is largely intentional IA (narrow
// forms vs wide dashboards), not drift. `narrow`/`medium`/`wide` map to
// the plurality value at each archetype; adopt to replace genuinely
// ad-hoc cases (e.g. max-w-2xl vs max-w-3xl for the same kind of page),
// not to change any page's effective width.
const WIDTH = {
  narrow: "max-w-3xl",
  medium: "max-w-5xl",
  wide: "max-w-7xl",
} as const

export function PageContainer({
  width = "wide",
  className,
  children,
}: {
  width?: keyof typeof WIDTH
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("p-6 mx-auto space-y-6", WIDTH[width], className)}>
      {children}
    </div>
  )
}
