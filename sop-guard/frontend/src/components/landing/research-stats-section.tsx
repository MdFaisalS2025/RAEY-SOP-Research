"use client"

import { motion } from "framer-motion"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { GlassCard, SectionKicker, fadeUp, stagger, viewportOnce } from "./shared"

export function ResearchStatsSection() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-[#07090c] border-y border-white/5">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger}>
          <div className="flex justify-center">
            <SectionKicker>Research Contribution</SectionKicker>
          </div>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-4xl font-bold text-white mb-5 text-balance">
            Procedural Faithfulness Verification
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-white/45 mb-14 max-w-2xl mx-auto text-[15px] leading-relaxed">
            An automated check that catches wrong thresholds, missing steps, and omitted
            contraindications in generated answers - before they reach a clinician.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="grid sm:grid-cols-2 gap-5">
            <GlassCard glow className="p-8">
              <div className="text-4xl md:text-5xl font-bold font-display text-[#00E5FF] mb-2">98% / 46%</div>
              <div className="text-sm text-white/70 font-medium">Sensitivity / Specificity</div>
              <div className="text-xs text-white/35 mt-1.5">120-case perturbation benchmark — see /evaluation</div>
            </GlassCard>
            <GlassCard glow className="p-8">
              <div className="text-4xl md:text-5xl font-bold font-display text-[#00E5FF] mb-2">
                <AnimatedCounter value={5} prefix="<" suffix="s" />
              </div>
              <div className="text-sm text-white/70 font-medium">End-to-End Response Time</div>
              <div className="text-xs text-white/35 mt-1.5">Including verification</div>
            </GlassCard>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
