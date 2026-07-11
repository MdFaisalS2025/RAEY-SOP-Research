"use client"

import { motion } from "framer-motion"
import { ShieldCheck, GitBranch, Layers, ArrowRight } from "lucide-react"
import { GlassCard, SectionKicker, fadeUp, stagger, viewportOnce } from "./shared"

// Real mechanisms, not marketing bullets - each card names an actual
// component in the codebase and links to where it's substantiated
// (the /evaluation benchmark page, the architecture writeup). Modeled on
// how Abridge presents its hallucination/evaluation work as research
// rather than a features list - Meridian has the equivalent underlying
// work, so it's presented the same way.
const RESEARCH_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Procedural Faithfulness Verification",
    desc: "Every generated answer is checked sentence-by-sentence against the source SOP - thresholds, step sequence, and contraindications are verified independently before an answer is shown.",
    stat: "98% / 46%",
    statLabel: "Sensitivity / specificity, 120-case adversarial benchmark",
    href: "/evaluation",
    linkLabel: "View benchmark",
  },
  {
    icon: GitBranch,
    title: "Explicit Answer Routing",
    desc: "Internal SOP evidence, external literature, and “no evidence found” are three different, explicitly labeled outcomes - never blended into one unattributed answer, and never guessed when neither source applies.",
    stat: "4",
    statLabel: "Distinct, disclosed routing outcomes",
    href: "/architecture",
    linkLabel: "Read the architecture",
  },
  {
    icon: Layers,
    title: "Evidence Trust Scoring",
    desc: "External literature is tiered by source authority - flagship journals and regulatory sources (FDA, CDC) are ranked above general indexed results, not treated as interchangeable.",
    stat: "8",
    statLabel: "Independently monitored evidence sources",
    href: "/evidence-watch",
    linkLabel: "See Evidence Watch",
  },
]

export function ResearchSection() {
  return (
    <section className="relative py-24 md:py-32 px-6 bg-card border-y border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="mb-14 max-w-2xl">
          <SectionKicker>Research &amp; Methodology</SectionKicker>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-4xl font-bold text-foreground text-balance mb-3">
            How answers are kept honest
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-muted-foreground text-[15px] leading-relaxed">
            The verification and routing mechanisms below are the actual system, not illustrations of it -
            the same code paths run on every query.
          </motion.p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="grid md:grid-cols-3 gap-5">
          {RESEARCH_ITEMS.map((item, i) => (
            <motion.div key={item.title} variants={fadeUp} custom={i}>
              <GlassCard glow className="p-7 h-full flex flex-col">
                <div className="w-11 h-11 rounded-xl bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 border border-[#0B6BCB]/20 dark:border-[#00E5FF]/20 flex items-center justify-center mb-5">
                  <item.icon className="w-5 h-5 text-[#0B6BCB] dark:text-[#00E5FF]" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5 flex-1">{item.desc}</p>
                <div className="pt-4 border-t border-border">
                  <p className="text-xl font-bold font-display text-[#0B6BCB] dark:text-[#00E5FF]">{item.stat}</p>
                  <p className="text-xs text-subtle mb-3">{item.statLabel}</p>
                  <a href={item.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0B6BCB] dark:text-[#00E5FF] hover:underline">
                    {item.linkLabel} <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
