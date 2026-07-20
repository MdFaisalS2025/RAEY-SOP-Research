"use client"

import { motion } from "framer-motion"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { AmbientGlow, MagneticButton, fadeUp, stagger } from "./shared"

// ─── Hero section ──────────────────────────────────────────────────────────

export function HeroSection() {
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
            Clinical SOP intelligence
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="font-display text-[2.5rem] leading-[1.1] md:text-6xl md:leading-[1.08] font-bold tracking-tight text-foreground mb-6 text-balance"
          >
            Clinical intelligence
            <br />
            for hospital SOPs.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed text-balance"
          >
            Ask questions, verify guidance against the source, compare it with current
            evidence, and identify gaps to improve.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="flex items-center gap-4 flex-wrap mb-14">
            <MagneticButton href="/login" variant="primary">
              Try Live Demo
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </MagneticButton>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
