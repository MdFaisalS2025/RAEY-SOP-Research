"use client"

import { motion } from "framer-motion"
import { MessageCircle, Search, Brain, Shield, CheckCircle2 } from "lucide-react"
import { SectionKicker, fadeUp, stagger, viewportOnce, EASE_EXPO_OUT } from "./shared"

const STEPS = [
  { num: 1, icon: MessageCircle, label: "Ask a question", desc: "Type or speak your question about a procedure." },
  { num: 2, icon: Search, label: "Find the SOP", desc: "The system searches for matching protocol sections." },
  { num: 3, icon: Brain, label: "Build an answer", desc: "An answer is generated from the retrieved SOP content." },
  { num: 4, icon: Shield, label: "Verify accuracy", desc: "The answer is checked against the source for correctness." },
  { num: 5, icon: CheckCircle2, label: "Show the result", desc: "You get a verified answer with a confidence score." },
]

export function HowItWorksSection() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-card border-y border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="text-center mb-20">
          <div className="flex justify-center">
            <SectionKicker>How It Works</SectionKicker>
          </div>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-4xl font-bold text-foreground text-balance">
            From question to verified answer
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={stagger}
          className="relative flex flex-col md:flex-row items-start justify-between gap-10 md:gap-4"
        >
          {/* self-drawing connector line (desktop only) */}
          <svg className="hidden md:block absolute top-7 left-0 w-full h-px overflow-visible" preserveAspectRatio="none">
            <motion.line
              x1="10%" y1="0" x2="90%" y2="0"
              stroke="url(#stepGrad)"
              strokeWidth={1.5}
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={viewportOnce}
              transition={{ duration: 1.4, ease: EASE_EXPO_OUT, delay: 0.2 }}
            />
            <defs>
              <linearGradient id="stepGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0B6BCB" stopOpacity="0.08" />
                <stop offset="50%" stopColor="#0B6BCB" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0B6BCB" stopOpacity="0.08" />
              </linearGradient>
            </defs>
          </svg>

          {STEPS.map((step, i) => (
            <motion.div key={step.num} variants={fadeUp} custom={i} className="relative flex-1 flex flex-col items-center text-center">
              <div className="relative w-14 h-14 rounded-full bg-background border-2 border-[#0B6BCB]/25 dark:border-[#00E5FF]/30 flex items-center justify-center mb-4">
                <step.icon className="relative w-5 h-5 text-[#0B6BCB] dark:text-[#00E5FF]" />
              </div>
              <span className="text-[11px] text-[#0B6BCB] dark:text-[#00E5FF] font-bold uppercase tracking-wider mb-1.5">Step {step.num}</span>
              <h3 className="text-sm font-semibold mb-1.5 text-foreground">{step.label}</h3>
              <p className="text-xs text-muted-foreground max-w-[170px] leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
