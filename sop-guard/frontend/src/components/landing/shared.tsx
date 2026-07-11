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

// ─── Glass card ───────────────────────────────────────────────────────────
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
        "relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]",
        glow && "hover:border-[#00E5FF]/30 hover:shadow-[0_0_40px_-12px_#00E5FF40] transition-all duration-500",
        className
      )}
    >
      {children}
    </div>
  )
}

// ─── Magnetic button ──────────────────────────────────────────────────────
// Cursor-follow translate + glow, capped to a small radius so it reads as a
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
    "group relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-semibold transition-colors duration-300 overflow-hidden"
  const styles =
    variant === "primary"
      ? "bg-[#00E5FF] text-[#04121a] hover:bg-[#33ebff]"
      : "border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:border-white/25"

  const glowOverlay = variant === "primary" && (
    <span className="pointer-events-none absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.35),transparent_70%)]" />
  )
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
        {glowOverlay}
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
      {glowOverlay}
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
      className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#00E5FF]/80 mb-4"
    >
      <span className="w-6 h-px bg-[#00E5FF]/50" />
      {children}
    </motion.span>
  )
}

// ─── Ambient background: soft glow + faint grid ──────────────────────────
export function AmbientGlow({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-[#00E5FF]/[0.07] blur-[120px]" />
      <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] rounded-full bg-[#00C853]/[0.05] blur-[100px]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
    </div>
  )
}
