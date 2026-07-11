"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, PlayCircle, ShieldCheck, X, FileText, SearchCheck, MessageSquareText } from "lucide-react"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { AmbientGlow, MagneticButton, GlassCard, fadeUp, stagger, EASE_EXPO_OUT } from "./shared"
import { ProductShowcase } from "./product-showcase"

// ─── Grounding pipeline visual ─────────────────────────────────────────────
// A straight-line, left-to-right pipeline diagram (SOP Library -> Retrieval
// & Verification -> Grounded Answer) rather than an orbiting-particle "AI
// orb" - this is meant to read as a real system diagram (the kind Linear or
// Vercel would ship), not a generic AI-startup illustration.

const STAGES = [
  { icon: FileText, label: "SOP Library", sublabel: "10 departments indexed" },
  { icon: SearchCheck, label: "Retrieval + Verification", sublabel: "Faithfulness-checked" },
  { icon: MessageSquareText, label: "Grounded Answer", sublabel: "Cited, confidence-scored" },
]

function GroundingPipeline() {
  return (
    <div className="w-full select-none" aria-hidden="true">
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5252]/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFD600]/50" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#00C853]/50" />
          <span className="ml-3 text-xs text-white/35 font-mono">meridian · answer trace</span>
        </div>

        <div className="flex items-stretch gap-0 md:gap-2">
          {STAGES.map((stage, i) => (
            <div key={stage.label} className="flex items-stretch flex-1 min-w-0">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.15, ease: EASE_EXPO_OUT }}
                className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:p-5"
              >
                <stage.icon className="w-5 h-5 text-[#00E5FF] mb-3" />
                <p className="text-sm font-semibold text-white truncate">{stage.label}</p>
                <p className="text-xs text-white/40 mt-1 truncate">{stage.sublabel}</p>
              </motion.div>
              {i < STAGES.length - 1 && (
                <div className="hidden md:flex items-center px-2 shrink-0">
                  <div className="relative w-8 h-px bg-white/15 overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 w-2 bg-[#00E5FF]"
                      animate={{ x: ["-8px", "32px"] }}
                      transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: "linear" }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2.5 text-xs text-white/45">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00C853]" />
          Every answer is checked against source SOP text before it reaches a user - or the system says so.
        </div>
      </GlassCard>
    </div>
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
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
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
              className="absolute -top-11 right-0 text-white/60 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
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
    <section className="relative overflow-hidden bg-[#0A0C10] pt-28 pb-20 md:pt-36 md:pb-28">
      <AmbientGlow />

      <div className="relative max-w-6xl mx-auto px-6">
        <motion.div initial="hidden" animate="visible" variants={stagger} className="text-center">
          <motion.div
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-white/70 text-xs font-medium mb-8 backdrop-blur-md"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#00E5FF]" />
            Research Prototype
            <span className="w-1 h-1 rounded-full bg-white/20" />
            Self-hosted, retrieval-grounded, never fabricated
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="font-display text-[2.75rem] leading-[1.05] md:text-7xl md:leading-[1.03] font-bold tracking-tight text-white mb-7 text-balance"
          >
            Meridian
            <br />
            <span className="text-white/55 text-[1.6rem] md:text-4xl font-medium">
              Every decision, grounded in evidence.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-lg md:text-xl text-white/55 max-w-2xl mx-auto mb-11 leading-relaxed text-balance"
          >
            Hospital SOPs, policies and clinical literature - unified into one
            governed knowledge system that cites its sources and knows when to say
            it doesn&apos;t know.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="flex items-center justify-center gap-4 flex-wrap mb-16">
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
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: EASE_EXPO_OUT }}
        >
          <GroundingPipeline />
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="flex items-center justify-center gap-8 md:gap-14 flex-wrap mt-12 md:mt-16"
        >
          {[
            { value: sopCount ?? 10, label: "SOPs Indexed", suffix: "" },
            { value: 98, label: "Sensitivity (n=120)", suffix: "%" },
            { value: 200, label: "Response Time", prefix: "<", suffix: "ms" },
            { value: 6, label: "Query Types", suffix: "" },
          ].map((s, i) => (
            <motion.div key={s.label} variants={fadeUp} custom={i} className="text-center">
              <p className="text-2xl md:text-3xl font-bold font-display text-white">
                <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} />
              </p>
              <p className="text-xs text-white/40 mt-1">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <ProductTourModal open={tourOpen} onClose={() => setTourOpen(false)} />
    </section>
  )
}
