"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, PlayCircle, Shield, FileText, Sparkles } from "lucide-react"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { AmbientGlow, MagneticButton, fadeUp, stagger, EASE_EXPO_OUT } from "./shared"

// ─── Knowledge-node visualization ─────────────────────────────────────────
// Small "document" nodes orbit a central AI core and periodically send a
// traveling pulse of light into it - a lightweight, GPU-cheap stand-in for
// the "documents flowing into insight" idea, with no video/canvas needed.

const DOC_NODES = [
  { angle: -100, radius: 190, delay: 0, size: 44 },
  { angle: -35, radius: 170, delay: 0.6, size: 38 },
  { angle: 25, radius: 200, delay: 1.2, size: 46 },
  { angle: 95, radius: 175, delay: 1.8, size: 36 },
  { angle: 150, radius: 195, delay: 2.4, size: 42 },
  { angle: -150, radius: 165, delay: 3.0, size: 34 },
]

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius * 0.62 }
}

function KnowledgeVisualization() {
  return (
    <div className="relative w-full h-[420px] md:h-[480px] flex items-center justify-center select-none" aria-hidden="true">
      {/* connecting lines */}
      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="-260 -220 520 440">
        {DOC_NODES.map((n, i) => {
          const p = polar(n.angle, n.radius)
          return (
            <motion.line
              key={i}
              x1={p.x}
              y1={p.y}
              x2={0}
              y2={0}
              stroke="url(#lineGrad)"
              strokeWidth={1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.35 }}
              transition={{ duration: 1.2, delay: 0.5 + i * 0.12, ease: EASE_EXPO_OUT }}
            />
          )
        })}
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.6" />
          </linearGradient>
        </defs>
      </svg>

      {/* traveling pulses */}
      {DOC_NODES.map((n, i) => {
        const p = polar(n.angle, n.radius)
        return (
          <motion.span
            key={`pulse-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_2px_#00E5FF]"
            style={{ left: "50%", top: "50%" }}
            initial={{ x: p.x, y: p.y, opacity: 0 }}
            animate={{ x: [p.x, 0], y: [p.y, 0], opacity: [0, 1, 0] }}
            transition={{
              duration: 1.6,
              delay: 1.5 + n.delay,
              repeat: Infinity,
              repeatDelay: DOC_NODES.length * 0.7,
              ease: "easeIn",
            }}
          />
        )
      })}

      {/* document nodes */}
      {DOC_NODES.map((n, i) => {
        const p = polar(n.angle, n.radius)
        return (
          <motion.div
            key={i}
            className="absolute flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md"
            style={{ width: n.size, height: n.size, left: "50%", top: "50%" }}
            initial={{ x: p.x, y: p.y, opacity: 0, scale: 0.6 }}
            animate={{
              x: [p.x, p.x + 6, p.x],
              y: [p.y, p.y - 8, p.y],
              opacity: 1,
              scale: 1,
            }}
            transition={{
              opacity: { duration: 0.6, delay: 0.3 + i * 0.1 },
              scale: { duration: 0.6, delay: 0.3 + i * 0.1 },
              x: { duration: 5 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
              y: { duration: 4 + i * 0.3, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <FileText className="text-white/40" style={{ width: n.size * 0.42, height: n.size * 0.42 }} />
          </motion.div>
        )
      })}

      {/* central AI core */}
      <motion.div
        className="relative z-10 w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE_EXPO_OUT }}
      >
        <motion.span
          className="absolute inset-0 rounded-full bg-[#00E5FF]/20 blur-xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="absolute inset-0 rounded-full border border-[#00E5FF]/40" />
        <span className="absolute inset-2 rounded-full border border-[#00E5FF]/20" />
        <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#00E5FF]/25 to-transparent border border-[#00E5FF]/50 flex items-center justify-center backdrop-blur-sm">
          <Sparkles className="w-6 h-6 text-[#00E5FF]" />
        </div>
      </motion.div>
    </div>
  )
}

// ─── Hero section ──────────────────────────────────────────────────────────

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

export function HeroSection() {
  const [sopCount, setSopCount] = useState<number | null>(null)

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
            <Shield className="w-3.5 h-3.5 text-[#00E5FF]" />
            Research Prototype
            <span className="w-1 h-1 rounded-full bg-white/20" />
            Self-hosted AI, no third-party model
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            className="font-display text-[2.75rem] leading-[1.05] md:text-7xl md:leading-[1.03] font-bold tracking-tight text-white mb-7 text-balance"
          >
            The Intelligence Layer
            <br />
            <span className="bg-gradient-to-r from-[#00E5FF] via-[#7ef4ff] to-white bg-clip-text text-transparent">
              For Every Hospital.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-lg md:text-xl text-white/55 max-w-2xl mx-auto mb-11 leading-relaxed text-balance"
          >
            Transform thousands of SOPs, policies and operational documents into a
            conversational AI experience trusted by healthcare professionals.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="flex items-center justify-center gap-4 flex-wrap mb-16">
            <MagneticButton onClick={() => scrollToId("live-demo")} variant="primary">
              Try Live Demo
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </MagneticButton>
            <MagneticButton onClick={() => scrollToId("product-showcase")} variant="secondary">
              <PlayCircle className="w-4 h-4" />
              Watch 2-Minute Demo
            </MagneticButton>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: EASE_EXPO_OUT }}
        >
          <KnowledgeVisualization />
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="flex items-center justify-center gap-8 md:gap-14 flex-wrap mt-4 md:mt-8"
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
    </section>
  )
}
