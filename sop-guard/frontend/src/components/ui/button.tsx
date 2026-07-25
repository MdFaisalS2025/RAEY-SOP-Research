import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// House-style button. Canonical sizes below are the plurality of the
// ~45 hand-rolled primary-button sites (padding drifted between
// px-3.5 py-1.5 and px-6 py-2.5, radius flipped rounded-lg/rounded-xl
// for visually identical buttons) - picking the most common values
// minimizes visual delta when call sites adopt this.
//
// `primary` resolves to bg-primary/text-primary-foreground/hover:bg-
// primary-hover, which is correct in BOTH themes with no dark: variant
// needed - this only works because of the dark-mode remap + token
// fixes landed earlier in this phase (see globals.css's hex-literal
// remap block and the --primary-hover token).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors press disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6BCB]/50 dark:focus-visible:ring-[#00E5FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-card hover:bg-accent",
        ghost: "hover:bg-accent",
        danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "px-3.5 py-2 rounded-lg text-xs",
        md: "px-4 py-2.5 rounded-xl text-sm",
        lg: "px-5 py-3 rounded-xl text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
