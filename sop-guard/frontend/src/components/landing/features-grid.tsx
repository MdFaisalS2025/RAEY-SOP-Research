"use client"

import { motion } from "framer-motion"
import {
  Search, FileText, Share2, Brain, ShieldCheck, GraduationCap, Quote, Radio,
} from "lucide-react"
import { GlassCard, SectionKicker, fadeUp, stagger, viewportOnce } from "./shared"

const FEATURES = [
  { icon: Search, title: "Agentic AI Search", desc: "A multi-stage pipeline understands intent, expands the query, and retrieves the exact protocol section - not a keyword match." },
  { icon: FileText, title: "SOP Retrieval", desc: "Hybrid dense + sparse retrieval ranks every indexed SOP chunk by clinical relevance, not just word overlap." },
  { icon: Share2, title: "Knowledge Graph Navigation", desc: "An entity graph links drugs, thresholds, and conditions across SOPs, surfacing conflicts between documents automatically." },
  { icon: Brain, title: "Multi-step Reasoning", desc: "Cross-references between protocols are followed automatically, so answers that span multiple SOPs stay complete." },
  { icon: ShieldCheck, title: "Compliance Support", desc: "Attestations, CAPA workflows, and proposal scheduling keep governance evidence in one auditable trail." },
  { icon: GraduationCap, title: "Training Assistance", desc: "New staff get the same verified answers as veterans, grounded in the current version of every protocol." },
  { icon: Quote, title: "Source-Cited Responses", desc: "Every claim links back to the exact SOP section it came from - down to the sentence, not just the document." },
  { icon: Radio, title: "Real-Time Healthcare Knowledge", desc: "Live evidence search across PubMed, WHO, CDC, and ClinicalTrials.gov surfaces literature alongside internal SOPs." },
]

export function FeaturesGrid() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-[#0A0C10]">
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="text-center mb-16">
          <div className="flex justify-center">
            <SectionKicker>Platform</SectionKicker>
          </div>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-4xl font-bold text-white text-balance">
            Everything a hospital knowledge layer needs
          </motion.h2>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} variants={fadeUp} custom={i}>
              <GlassCard glow className="p-6 h-full group">
                <div className="w-10 h-10 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <f.icon className="w-4.5 h-4.5 text-[#00E5FF]" />
                </div>
                <h3 className="text-[15px] font-semibold mb-2 text-white">{f.title}</h3>
                <p className="text-[13px] text-white/45 leading-relaxed">{f.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
