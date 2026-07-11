"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { GlassCard, SectionKicker, fadeUp, stagger, viewportOnce } from "./shared"

interface DemoResult {
  answer: string
  confidence: number
  retrieved_chunks?: unknown[]
  verification_result?: { status: string }
  query_type?: string
}

const SUGGESTED_QUERIES = [
  "What are the steps for sepsis management?",
  "What is the MAP threshold in septic shock?",
  "What contraindications exist for heparin?",
]

/**
 * Genuine POST /api/query call - not scripted. Same endpoint the rest of
 * the app uses (see app/query/page.tsx). If the backend isn't reachable,
 * this shows a real error rather than falling back to a canned answer.
 */
export function LiveDemoSection() {
  const [demoQuery, setDemoQuery] = useState<string | null>(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null)
  const [demoError, setDemoError] = useState<string | null>(null)

  const runDemoQuery = async (q: string) => {
    setDemoLoading(true)
    setDemoResult(null)
    setDemoError(null)
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok) throw new Error("Backend returned an error.")
      const data = await res.json()
      setDemoResult(data)
    } catch {
      setDemoError("Start the backend to try live queries.")
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <section id="live-demo" className="relative py-24 md:py-32 px-6 bg-[#0A0C10]">
      <div className="max-w-4xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={stagger} className="text-center mb-12">
          <div className="flex justify-center">
            <SectionKicker>Live Demo</SectionKicker>
          </div>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-3xl md:text-4xl font-bold text-white mb-3 text-balance">
            Try it for real
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-white/45 text-sm">
            Click a question below - this runs the actual pipeline, live.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={stagger}
          className="flex flex-wrap justify-center gap-3 mb-10"
        >
          {SUGGESTED_QUERIES.map((q, i) => (
            <motion.button
              key={q}
              variants={fadeUp}
              custom={i}
              onClick={() => {
                setDemoQuery(q)
                runDemoQuery(q)
              }}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-300",
                demoQuery === q
                  ? "bg-[#00E5FF]/10 border-[#00E5FF]/30 text-[#00E5FF]"
                  : "bg-white/[0.03] border-white/10 text-white/55 hover:text-white hover:border-white/20"
              )}
            >
              {q}
            </motion.button>
          ))}
        </motion.div>

        {/*
          Deliberately NOT AnimatePresence mode="wait" here: gating the
          result on an exit-transition completing means if animation
          frames stall for any reason (a backgrounded tab, a slow device),
          the already-arrived answer stays invisible behind a spinner that
          finished its job. Each state below unmounts/mounts immediately
          when React state changes; only the entrance is animated.
        */}
        <div>
          {demoLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-3 py-16 text-white/45"
            >
              <Loader2 className="w-5 h-5 animate-spin text-[#00E5FF]" />
              Running query through the pipeline...
            </motion.div>
          )}
          {demoError && !demoLoading && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-sm text-white/40 text-center">
              {demoError}
            </motion.div>
          )}
          {demoResult && !demoLoading && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <GlassCard className="p-6 md:p-7 text-left">
                <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold border",
                      demoResult.confidence >= 0.7
                        ? "bg-[#00C853]/10 text-[#00C853] border-[#00C853]/25"
                        : demoResult.confidence >= 0.5
                        ? "bg-[#FFD600]/10 text-[#FFD600] border-[#FFD600]/25"
                        : "bg-[#FF5252]/10 text-[#FF5252] border-[#FF5252]/25"
                    )}
                  >
                    {Math.round(demoResult.confidence * 100)}% confidence
                  </span>
                  <span className="text-xs text-white/35">{demoResult.retrieved_chunks?.length || 0} sources found</span>
                  {demoResult.verification_result && (
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold border",
                        demoResult.verification_result.status === "passed"
                          ? "bg-[#00C853]/10 text-[#00C853] border-[#00C853]/25"
                          : demoResult.verification_result.status === "warning"
                          ? "bg-[#FFD600]/10 text-[#FFD600] border-[#FFD600]/25"
                          : "bg-[#FF5252]/10 text-[#FF5252] border-[#FF5252]/25"
                      )}
                    >
                      {demoResult.verification_result.status === "passed"
                        ? "Verified"
                        : demoResult.verification_result.status === "warning"
                        ? "Caution"
                        : "Unverified"}
                    </span>
                  )}
                  <span className="text-xs text-white/35">Query type: {demoResult.query_type || "general"}</span>
                </div>
                <div className="text-[15px] leading-relaxed whitespace-pre-line mb-5 text-white/75">
                  {demoResult.answer.substring(0, 500)}
                  {demoResult.answer.length > 500 && "..."}
                </div>
                <a href="/query" className="inline-flex items-center gap-2 text-sm text-[#00E5FF] hover:underline">
                  Open full query workspace <ArrowRight className="w-4 h-4" />
                </a>
              </GlassCard>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
