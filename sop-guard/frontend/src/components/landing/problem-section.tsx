"use client"

import { motion } from "framer-motion"
import { Clock, FileWarning, RefreshCw } from "lucide-react"
import { GlassCard, SectionKicker, fadeUp, stagger, viewportOnce } from "./shared"

const PROBLEMS = [
  { icon: Clock, title: "Slow to find answers", desc: "Finding the right procedure takes too long when SOPs are buried in PDFs." },
  { icon: FileWarning, title: "Procedure errors", desc: "Mistakes happen when staff rely on memory instead of checking the source." },
  { icon: RefreshCw, title: "Outdated protocols", desc: "Protocols change, but old versions stay in circulation." },
]

export function ProblemSection() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="mb-16 max-w-2xl">
          <SectionKicker>The Problem</SectionKicker>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-4xl font-bold text-foreground text-balance">
            Hospital knowledge shouldn&apos;t be this hard to reach
          </motion.h2>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="grid md:grid-cols-3 gap-5">
          {PROBLEMS.map((item, i) => (
            <motion.div key={item.title} variants={fadeUp} custom={i}>
              <GlassCard glow className="p-7 h-full">
                <div className="w-11 h-11 rounded-xl bg-[#B91C1C]/10 dark:bg-red-500/10 border border-[#B91C1C]/20 dark:border-red-500/20 flex items-center justify-center mb-5">
                  <item.icon className="w-5 h-5 text-[#B91C1C] dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
