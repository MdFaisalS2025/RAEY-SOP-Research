"use client"

import { motion } from "framer-motion"
import { Clock, FileWarning, RefreshCw } from "lucide-react"
import { GlassCard, SectionKicker, fadeUp, stagger, viewportOnce } from "./shared"

const PROBLEMS = [
  { icon: Clock, title: "Slow to Find Answers", desc: "Finding the right procedure takes too long when SOPs are buried in PDFs." },
  { icon: FileWarning, title: "Procedure Errors", desc: "Mistakes happen when staff rely on memory instead of checking the source." },
  { icon: RefreshCw, title: "Outdated Protocols", desc: "Protocols change, but old versions stay in circulation." },
]

export function ProblemSection() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-[#0A0C10]">
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="text-center mb-16">
          <div className="flex justify-center">
            <SectionKicker>The Problem</SectionKicker>
          </div>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-4xl font-bold text-white text-balance">
            Hospital knowledge shouldn&apos;t be this hard to reach
          </motion.h2>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="grid md:grid-cols-3 gap-5">
          {PROBLEMS.map((item, i) => (
            <motion.div key={item.title} variants={fadeUp} custom={i}>
              <GlassCard glow className="p-7 h-full">
                <div className="w-11 h-11 rounded-xl bg-[#FF5252]/10 border border-[#FF5252]/20 flex items-center justify-center mb-5">
                  <item.icon className="w-5 h-5 text-[#FF5252]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white">{item.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
