import * as React from "react"

import { cn } from "@/lib/utils"

// House-style card: rounded-2xl bg-card border border-border, matching
// the ~107 hand-rolled sites across the app - NOT shadcn's stock
// rounded-lg/shadow-sm, which would visually mismatch everything else.
// Single export, no Header/Title/Content/Footer subcomponents - the real
// repeated shape here is "a div with padding and space-y", not a
// header/content/footer sandwich, and modeling one invites drift toward
// a second layout language.
//
// `padding` must emit LITERAL p-4/p-5/p-6/p-8 classes (not a computed
// or @apply'd value) - globals.css's compact-density mode targets those
// exact class names directly (`body.compact .p-5 { padding: ... }`), so
// anything that swallows padding into a different mechanism silently
// breaks density mode.
const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
  xl: "p-8",
} as const

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article"
  padding?: keyof typeof PADDING
  elevated?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ as: Tag = "div", padding = "md", elevated = false, className, ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn(
        "rounded-2xl bg-card border border-border",
        PADDING[padding],
        elevated && "shadow-sm",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

export { Card }
