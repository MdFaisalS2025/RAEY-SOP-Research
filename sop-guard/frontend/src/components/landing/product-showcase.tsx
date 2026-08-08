"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { Sparkles, ShieldCheck, FileText, Mic } from "lucide-react"
import { GlassCard, SectionKicker, fadeUp, stagger, viewportOnce, EASE_EXPO_OUT } from "./shared"

const QUESTION = "What's the max norepinephrine dose in septic shock?"
const ANSWER =
  "If MAP stays below 65 mmHg after fluids, start norepinephrine at 0.05 mcg/kg/min and titrate up to a maximum of 3 mcg/kg/min. [1]"
const SOURCE = { title: "Sepsis Management Protocol", section: "Procedure Steps · Vasopressor Therapy" }

type Phase = "idle" | "typing-question" | "thinking" | "streaming-answer" | "cited" | "hold" | "resetting"

/**
 * A scripted, looping animation - not a live backend call. This mirrors
 * the shape of the real streaming query experience (see
 * frontend/src/app/query/page.tsx's SSE consumption) so it previews the
 * product honestly, but it never hits the network - it's a fixed script
 * that loops for the "Watch Product Tour" CTA.
 */
export function ProductShowcase({ embedded = false }: { embedded?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: false, margin: "-100px" })
  const [phase, setPhase] = useState<Phase>("idle")
  const [questionChars, setQuestionChars] = useState(0)
  const [answerChars, setAnswerChars] = useState(0)

  useEffect(() => {
    if (!inView) return
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const t = (fn: () => void, ms: number) => timers.push(setTimeout(() => !cancelled && fn(), ms))

    function runScript() {
      setPhase("typing-question")
      setQuestionChars(0)
      setAnswerChars(0)

      let qi = 0
      const qInterval = setInterval(() => {
        qi++
        setQuestionChars(qi)
        if (qi >= QUESTION.length) clearInterval(qInterval)
      }, 28)
      timers.push(qInterval as unknown as ReturnType<typeof setTimeout>)

      t(() => setPhase("thinking"), QUESTION.length * 28 + 300)
      t(() => {
        setPhase("streaming-answer")
        let ai = 0
        const aInterval = setInterval(() => {
          ai++
          setAnswerChars(ai)
          if (ai >= ANSWER.length) clearInterval(aInterval)
        }, 16)
        timers.push(aInterval as unknown as ReturnType<typeof setTimeout>)
      }, QUESTION.length * 28 + 1100)
      t(() => setPhase("cited"), QUESTION.length * 28 + 1100 + ANSWER.length * 16 + 300)
      t(() => setPhase("hold"), QUESTION.length * 28 + 1100 + ANSWER.length * 16 + 900)
      t(() => setPhase("resetting"), QUESTION.length * 28 + 1100 + ANSWER.length * 16 + 3400)
      t(() => runScript(), QUESTION.length * 28 + 1100 + ANSWER.length * 16 + 4000)
    }

    runScript()
    return () => {
      cancelled = true
      timers.forEach((id) => clearTimeout(id))
    }
  }, [inView])

  const showAnswer = phase === "streaming-answer" || phase === "cited" || phase === "hold"

  const card = (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewportOnce}
      transition={{ duration: 0.9, ease: EASE_EXPO_OUT }}
    >
      <GlassCard className="p-0 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/40">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5252]/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFD600]/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#00C853]/60" />
              <span className="ml-3 text-xs text-subtle font-medium">Meridian · Preview Session</span>
            </div>

            <div className="p-6 md:p-8 min-h-[280px] flex flex-col justify-between">
              <div className="space-y-5">
                {/* user question bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-primary/[0.08] border border-primary/15 text-sm text-foreground">
                    {QUESTION.slice(0, questionChars)}
                    {phase === "typing-question" && <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-primary animate-pulse align-middle" />}
                  </div>
                </div>

                {/* thinking indicator */}
                <AnimatePresence>
                  {phase === "thinking" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                      Searching indexed SOPs...
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* answer */}
                {showAnswer && (
                  <div className="p-4 rounded-2xl bg-muted border border-border text-sm leading-relaxed text-foreground">
                    {ANSWER.slice(0, answerChars)}
                    {phase === "streaming-answer" && <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-foreground/60 animate-pulse align-middle" />}
                  </div>
                )}
              </div>

              {/* citation + confidence */}
              <AnimatePresence>
                {(phase === "cited" || phase === "hold") && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.5, ease: EASE_EXPO_OUT }}
                    className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-border"
                  >
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-11 font-semibold bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/25">
                      <ShieldCheck className="w-3 h-3" /> 94% confidence · Verified
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-11 text-muted-foreground border border-border">
                      <FileText className="w-3 h-3" /> {SOURCE.title} — {SOURCE.section}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-11 text-subtle border border-border ml-auto">
                      <Mic className="w-3 h-3" /> Voice input available
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
    </motion.div>
  )

  if (embedded) return card

  return (
    <section id="product-showcase" className="relative py-24 md:py-32 px-6 bg-background">
      <div className="max-w-4xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="text-center mb-14">
          <div className="flex justify-center">
            <SectionKicker>Product Preview</SectionKicker>
          </div>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-4xl font-bold text-foreground text-balance mb-3">
            Watch a question become a verified answer
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-muted-foreground text-sm max-w-lg mx-auto">
            A scripted preview of the interaction - try it for real in the live demo below.
          </motion.p>
        </motion.div>
        {card}
      </div>
    </section>
  )
}
