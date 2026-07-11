"use client"

import { motion } from "framer-motion"
import {
  Search, FileText, Share2, Brain, ShieldCheck, GraduationCap, Quote, Radio,
} from "lucide-react"
import { GlassCard, SectionKicker, fadeUp, stagger, viewportOnce } from "./shared"

const FEATURES = [
  { icon: Search, title: "Multi-stage retrieval", desc: "A query-understanding pass expands intent before search runs, so it retrieves the exact protocol section - not a keyword match." },
  { icon: FileText, title: "Hybrid SOP search", desc: "Dense and sparse retrieval are combined to rank every indexed SOP chunk by clinical relevance, not just word overlap." },
  { icon: Share2, title: "Cross-SOP conflict detection", desc: "An entity graph links drugs, thresholds, and conditions across SOPs, surfacing conflicts between documents automatically." },
  { icon: Brain, title: "Multi-hop reasoning", desc: "Cross-references between protocols are followed automatically, so answers that span multiple SOPs stay complete." },
  { icon: ShieldCheck, title: "Compliance workflows", desc: "Attestations, CAPA workflows, and proposal scheduling keep governance evidence in one auditable trail." },
  { icon: GraduationCap, title: "Consistent training answers", desc: "New staff get the same verified answers as veterans, grounded in the current version of every protocol." },
  { icon: Quote, title: "Sentence-level citations", desc: "Every claim links back to the exact SOP section it came from - down to the sentence, not just the document." },
  { icon: Radio, title: "External evidence, ranked", desc: "Literature from PubMed, FDA, CDC, and 5 other sources is tiered by authority and shown alongside internal SOPs." },
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
