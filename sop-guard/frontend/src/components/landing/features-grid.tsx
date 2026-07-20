"use client"

import { motion } from "framer-motion"
import {
  MessageSquare, ShieldCheck, GitCompare, TrendingUp,
} from "lucide-react"
import { GlassCard, SectionKicker, fadeUp, stagger, viewportOnce } from "./shared"

// Reduced from 8 capability cards to the 4 that map to the actual
// workflow (Ask -> Verify -> Compare -> Improve) - the other capabilities
// (multi-hop reasoning, CAPA workflows, sentence-level citations, ranked
// external evidence) are real and still live in the product, just not
// front-loaded on the landing page as a feature-dump.
const FEATURES = [
  { icon: MessageSquare, title: "Ask", desc: "Ask a clinical procedure question in plain language and get an answer grounded in your hospital's own approved SOPs." },
  { icon: ShieldCheck, title: "Verify", desc: "Every claim is checked against its source before it's shown, with citations down to the exact SOP section." },
  { icon: GitCompare, title: "Compare", desc: "Guidance can be compared against current external clinical evidence to check whether it's still aligned." },
  { icon: TrendingUp, title: "Improve", desc: "Gaps and outdated guidance are flagged and routed to committee review, closing the loop back into governance." },
]

export function FeaturesGrid() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="mb-16 max-w-2xl">
          <SectionKicker>Platform</SectionKicker>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-4xl font-bold text-foreground text-balance">
            Everything a hospital knowledge layer needs
          </motion.h2>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} variants={fadeUp} custom={i}>
              <GlassCard glow className="p-6 h-full group">
                <div className="w-10 h-10 rounded-lg bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 border border-[#0B6BCB]/20 dark:border-[#00E5FF]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <f.icon className="w-4.5 h-4.5 text-[#0B6BCB] dark:text-[#00E5FF]" />
                </div>
                <h3 className="text-[15px] font-semibold mb-2 text-foreground">{f.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{f.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
