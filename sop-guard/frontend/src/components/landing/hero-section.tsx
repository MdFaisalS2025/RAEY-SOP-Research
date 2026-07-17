"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, PlayCircle, ShieldCheck, X } from "lucide-react"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { AmbientGlow, MagneticButton, GlassCard, fadeUp, stagger, EASE_EXPO_OUT } from "./shared"
import { ProductShowcase } from "./product-showcase"

// ─── Real-stat strip ────────────────────────────────────────────────────────
// Replaces the earlier orbiting-particle hero graphic. Research on what
// actually reads as credible on enterprise health-tech marketing pages
// (OpenEvidence, Abridge) points the same direction: no ambient AI
// illustration at all - just the real, checkable numbers, presented
// plainly. Every value here is a genuine figure already surfaced
// elsewhere in the app (the /evaluation benchmark, the live SOP count),
// not a marketing placeholder.
function StatStrip({ sopCount }: { sopCount: number | null }) {
  const stats = [
    { value: sopCount ?? 10, label: "SOPs indexed", suffix: "" },
    { value: 98, label: "Sensitivity, 120-case benchmark", suffix: "%" },
    { value: 46, label: "Specificity, same benchmark", suffix: "%" },
    { value: 200, label: "Median response time", prefix: "<", suffix: "ms" },
  ]
  return (
    <GlassCard className="px-6 py-5 md:px-10 md:py-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 divide-y-0">
        {stats.map((s) => (
          <div key={s.label} className="text-center md:text-left">
            <p className="text-2xl md:text-3xl font-bold font-display text-[#0B6BCB] dark:text-[#00E5FF]">
              <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} />
            </p>
            <p className="text-[11px] md:text-xs text-muted-foreground mt-1 leading-snug">{s.label}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

// ─── Product tour modal ─────────────────────────────────────────────────────
function ProductTourModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.35, ease: EASE_EXPO_OUT }}
            className="relative w-full max-w-2xl"
          >
            <button
              onClick={onClose}
              aria-label="Close product tour"
              className="absolute -top-11 right-0 text-white/80 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
            >
              Close <X className="w-4 h-4" />
            </button>
            <ProductShowcase embedded />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Hero section ──────────────────────────────────────────────────────────

export function HeroSection() {
  const [sopCount, setSopCount] = useState<number | null>(null)
  const [tourOpen, setTourOpen] = useState(false)

  useEffect(() => {
    fetch("/api/sops")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const sops = Array.isArray(data) ? data : data?.sops
        if (Array.isArray(sops)) setSopCount(sops.length)
      })
      .catch(() => {})
  }, [])

  return (
    <section className="relative overflow-hidden bg-background pt-10 pb-20 md:pb-28">
      <AmbientGlow className="text-[#0B6BCB] dark:text-[#00E5FF]" />

      {/* Minimal wordmark bar - this route has no app nav (it's the public
          marketing page), so a small brand mark up top is the only wayfinding
          a first-time visitor gets before the headline. */}
      <div className="relative max-w-6xl mx-auto px-6 mb-16 md:mb-24">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#0B6BCB] dark:text-[#00E5FF]" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" />
            <path d="M12 3c2.8 2.4 4.4 5.6 4.4 9s-1.6 6.6-4.4 9c-2.8-2.4-4.4-5.6-4.4-9s1.6-6.6 4.4-9Z" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <span className="font-display text-lg font-bold text-foreground tracking-tight">Meridian</span>
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <motion.div initial="hidden" animate="visible" variants={stagger} className="text-left max-w-3xl">
          <motion.div
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-card border border-border text-muted-foreground text-xs font-medium mb-8"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#0B6BCB] dark:text-[#00E5FF]" />
            Self-hosted, retrieval-grounded, never fabricated
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="font-display text-[2.5rem] leading-[1.1] md:text-6xl md:leading-[1.08] font-bold tracking-tight text-foreground mb-6 text-balance"
          >
            Ask your hospital&apos;s SOPs.
            <br />
            Get a verified answer.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed text-balance"
          >
            Meridian answers clinical procedure questions from your hospital&apos;s own SOPs, checks
            every claim against the source before it&apos;s shown, and says so plainly when it can&apos;t
            find a grounded answer.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="flex items-center gap-4 flex-wrap mb-14">
            <MagneticButton href="/login" variant="primary">
              Try Live Demo
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </MagneticButton>
            <MagneticButton onClick={() => setTourOpen(true)} variant="secondary">
              <PlayCircle className="w-4 h-4" />
              Watch Product Tour
            </MagneticButton>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease: EASE_EXPO_OUT }}
        >
          <StatStrip sopCount={sopCount} />
        </motion.div>
      </div>

      <ProductTourModal open={tourOpen} onClose={() => setTourOpen(false)} />
    </section>
  )
}
