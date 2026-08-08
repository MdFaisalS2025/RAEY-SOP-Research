"use client"

import { useRef, type ReactNode } from "react"
import { motion, useMotionValue, useSpring, type Variants } from "framer-motion"
import { cn } from "@/lib/utils"

// ─── Motion language ──────────────────────────────────────────────────────
// A slightly longer, softer expo-out easing than the app's default - reads
// as "expensive" rather than snappy, on purpose, for a marketing page.
export const EASE_EXPO_OUT = [0.16, 1, 0.3, 1] as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 36 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.09, duration: 0.8, ease: EASE_EXPO_OUT },
  }),
}

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
}

export const viewportOnce = { once: true, margin: "-80px" }

// ─── Card ─────────────────────────────────────────────────────────────────
// Light-primary by design (see homepage research notes): a crisp bordered
// surface with a real shadow, not a heavy translucent "glass" treatment -
// glass/blur panels read as decorative in a light, editorial layout the
// way they don't in a dark developer-tool UI. Dark mode (if the visitor's
// app-wide preference is dark) gets a subtler equivalent.
export function GlassCard({
  children,
  className,
  glow = false,
}: {
  children: ReactNode
  className?: string
  glow?: boolean
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-card shadow-sm",
        glow && "hover:border-primary/30 hover:shadow-md transition-all duration-300",
        className
      )}
    >
      {children}
    </div>
  )
}

// ─── Magnetic button ──────────────────────────────────────────────────────
// Cursor-follow translate, capped to a small radius so it reads as a
// premium micro-interaction rather than the button "chasing" the pointer.
export function MagneticButton({
  children,
  onClick,
  href,
  variant = "primary",
  className,
}: {
  children: ReactNode
  onClick?: () => void
  href?: string
  variant?: "primary" | "secondary"
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 200, damping: 18, mass: 0.4 })
  const springY = useSpring(y, { stiffness: 200, damping: 18, mass: 0.4 })

  function handleMouseMove(e: React.MouseEvent) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const relX = e.clientX - rect.left - rect.width / 2
    const relY = e.clientY - rect.top - rect.height / 2
    x.set(relX * 0.25)
    y.set(relY * 0.4)
  }

  function handleMouseLeave() {
    x.set(0)
    y.set(0)
  }

  const base =
    "group relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold transition-colors duration-300 overflow-hidden"
  const styles =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary-hover"
      : "border border-border bg-card text-foreground hover:bg-muted"

  const inner = <span className="relative z-10 inline-flex items-center gap-2">{children}</span>

  if (href) {
    return (
      <motion.a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ x: springX, y: springY }}
        className={cn(base, styles, className)}
      >
        {inner}
      </motion.a>
    )
  }

  return (
    <motion.button
      ref={ref as React.Ref<HTMLButtonElement>}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
      className={cn(base, styles, className)}
    >
      {inner}
    </motion.button>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────
export function SectionKicker({ children }: { children: ReactNode }) {
  return (
    <motion.span
      variants={fadeUp}
      custom={0}
      className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-4"
    >
      <span className="w-6 h-px bg-primary/50" />
      {children}
    </motion.span>
  )
}

// ─── Ambient background ───────────────────────────────────────────────────
// Deliberately restrained: a faint dot grid only, no glow blobs. Glowing
// gradient orbs are one of the most-cited "this looks AI-generated" tells
// (see homepage research notes) - real enterprise health-tech sites
// (OpenEvidence, Abridge) use none at all. This exists only to keep large
// flat sections from feeling completely inert, not as a visual centerpiece.
export function AmbientGlow({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute inset-0 opacity-[0.4] dark:opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          color: "rgb(11 107 203 / 0.06)",
        }}
      />
    </div>
  )
}
