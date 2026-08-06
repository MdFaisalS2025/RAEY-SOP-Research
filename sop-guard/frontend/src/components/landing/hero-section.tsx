"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, MessageSquare, ShieldCheck, TrendingUp } from "lucide-react"
import { MagneticButton, fadeUp, stagger, EASE_EXPO_OUT } from "./shared"
import { ProductShowcase } from "./product-showcase"
import { SafetyNote } from "@/components/ui/safety-note"

// One-screen cinematic hero, replacing the old 8-section scroll (Problem/
// HowItWorks/Features/ProductShowcase-as-its-own-section/LiveDemo/
// Research/Footer): every one of those sections used ~256px of vertical
// padding (py-24 md:py-32) and hid its content behind whileInView
// animations, which together produced the enormous blank voids a full-page
// capture showed - a real, measured cause, not a guess (see landing
// exploration notes). This page is the entire homepage now: wordmark,
// headline, one CTA, and the scripted product preview, all in one
// viewport on desktop; the real backend demo is one click away behind
// the CTA rather than embedded here.

const WORKFLOW_STEPS = [
  { icon: MessageSquare, label: "Ask", detail: "Question against the approved SOP library" },
  { icon: ShieldCheck, label: "Verify", detail: "Every claim cited back to its source" },
  { icon: TrendingUp, label: "Improve", detail: "Gaps route to committee review" },
]

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 3c2.8 2.4 4.4 5.6 4.4 9s-1.6 6.6-4.4 9c-2.8-2.4-4.4-5.6-4.4-9s1.6-6.6 4.4-9Z" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      <span className="font-display text-lg font-bold text-foreground tracking-tight">Meridian</span>
    </div>
  )
}

// Two faint, slow-drifting brand-color orbs behind the preview card -
// restrained (8-10% opacity) so it reads as ambient depth, not a "this
// looks AI-generated" glowing-orb hero.
function AmbientOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute w-[420px] h-[420px] rounded-full blur-[100px] bg-primary opacity-[0.08] dark:opacity-[0.06]"
        style={{ top: "-8%", right: "8%" }}
        animate={{ x: [0, 30, -10, 0], y: [0, -20, 15, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full blur-[90px] bg-primary opacity-[0.06] dark:opacity-[0.05]"
        style={{ bottom: "0%", right: "22%" }}
        animate={{ x: [0, -25, 15, 0], y: [0, 20, -10, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </div>
  )
}

export function HeroSection() {
  const [showWorkflow, setShowWorkflow] = useState(false)

  return (
    <div className="relative flex flex-col bg-background md:h-[100dvh] md:overflow-hidden">
      <AmbientOrbs />

      {/* Top bar */}
      <header className="relative shrink-0 px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <Wordmark />
        <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          Sign in
        </Link>
      </header>

      {/* Main: headline left, product preview right - one screen on desktop */}
      <main className="relative flex-1 flex items-center px-6 py-8 md:py-0">
        <div className="max-w-6xl mx-auto w-full grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left column */}
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.h1
              variants={fadeUp}
              custom={0}
              className="font-display text-[2.25rem] leading-[1.1] md:text-5xl lg:text-6xl md:leading-[1.08] font-bold tracking-tight text-foreground mb-5 text-balance"
            >
              Clinical intelligence for hospital SOPs.
            </motion.h1>

            {/* Plain conditional, no AnimatePresence/exit: this session hit
                the same exit-animation-doesn't-unmount issue three times
                in new code (the streaming skeleton, the toolbar's More
                menu, and here - confirmed live, the old branch stayed in
                the DOM at opacity:0 and the new branch never mounted).
                A ternary swaps content the instant `showWorkflow` flips;
                each branch still gets its own quiet entrance animation. */}
            <div className="min-h-[72px] mb-8">
              {!showWorkflow ? (
                <motion.p
                  key="subline"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg text-muted-foreground max-w-md leading-relaxed text-balance"
                >
                  Ask questions. Verify guidance. Identify gaps.
                </motion.p>
              ) : (
                <motion.div
                  key="workflow"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE_EXPO_OUT }}
                  className="flex flex-col gap-2"
                >
                  {WORKFLOW_STEPS.map((s) => (
                    <div key={s.label} className="flex items-center gap-2.5 text-sm">
                      <s.icon className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-semibold text-foreground">{s.label}</span>
                      <span className="text-muted-foreground">— {s.detail}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            <motion.div variants={fadeUp} custom={2} className="flex items-center gap-3 flex-wrap">
              <MagneticButton href="/login" variant="primary">
                Try Meridian
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </MagneticButton>
              <MagneticButton onClick={() => setShowWorkflow((v) => !v)} variant="secondary">
                {showWorkflow ? "Show summary" : "View workflow"}
              </MagneticButton>
            </motion.div>
          </motion.div>

          {/* Right column - scripted, no-network product preview */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: EASE_EXPO_OUT }}
            className="relative"
          >
            <ProductShowcase embedded />
          </motion.div>
        </div>
      </main>

      {/* Bottom strip - absorbs the old standalone footer */}
      <footer className="relative shrink-0 px-6 py-4 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <SafetyNote />
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link href="/architecture" className="hover:text-foreground transition-colors">Architecture</Link>
            <Link href="/evaluation" className="hover:text-foreground transition-colors">Evaluation</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
