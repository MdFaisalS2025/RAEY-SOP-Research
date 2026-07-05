"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Shield,
  Mic,
  RefreshCw,
  Gauge,
  Eye,
  MessageCircle,
  Clock,
  AlertTriangle,
  FileWarning,
  Search,
  Brain,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatedCounter } from "@/components/ui/animated-counter"

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
}

export default function LandingPage() {
  const [demoQuery, setDemoQuery] = useState<string | null>(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoResult, setDemoResult] = useState<{
    answer: string
    confidence: number
    retrieved_chunks?: unknown[]
    verification_result?: { status: string }
    query_type?: string
  } | null>(null)
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
    <div className="min-h-screen bg-[#F7F9FB] text-[#1A2332]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-white border-b border-[#E2E8F0]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,#0B6BCB0d,transparent_55%)]" />

        <div className="max-w-6xl mx-auto px-6 py-24 md:py-36 text-center relative">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] text-sm font-medium mb-8">
              <Shield className="w-4 h-4" />
              Research Prototype
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30">v1.0</span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-5xl md:text-7xl font-bold tracking-tight mb-6 text-[#1A2332]"
            >
              SOP-Guard
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-xl md:text-2xl text-[#0B6BCB] font-medium mb-4"
            >
              Clinical protocol intelligence for hospital teams.
            </motion.p>

            <motion.p
              variants={fadeUp}
              custom={3}
              className="text-base md:text-lg text-[#64748B] max-w-2xl mx-auto mb-10"
            >
              Ask about any hospital procedure. SOP-Guard finds the protocol,
              answers clearly, and verifies against the source document.
            </motion.p>

            <motion.div variants={fadeUp} custom={4} className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/query"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white font-semibold transition-colors shadow-sm"
              >
                Try Demo <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/architecture"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#1A2332] font-semibold transition-colors"
              >
                View Architecture
              </Link>
              <Link
                href="/library"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#1A2332] font-semibold transition-colors"
              >
                SOP Library
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} custom={5} className="flex items-center justify-center gap-8 mt-12 text-sm text-[#64748B]">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#0B6BCB]"><AnimatedCounter value={10} /></p>
                <p className="text-xs">SOPs Indexed</p>
              </div>
              <div className="w-px h-8 bg-[#E2E8F0]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-[#0B6BCB]"><AnimatedCounter value={100} suffix="%" /></p>
                <p className="text-xs">Violation Detection</p>
              </div>
              <div className="w-px h-8 bg-[#E2E8F0]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-[#0B6BCB]"><AnimatedCounter value={200} prefix="<" suffix="ms" /></p>
                <p className="text-xs">Response Time</p>
              </div>
              <div className="w-px h-8 bg-[#E2E8F0]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-[#0B6BCB]"><AnimatedCounter value={6} /></p>
                <p className="text-xs">Query Types</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-xl md:text-2xl font-semibold mb-4">
              The problem
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-6"
          >
            {[
              { icon: Clock, title: "Slow to Find Answers", desc: "Finding the right procedure takes too long when SOPs are buried in PDFs." },
              { icon: FileWarning, title: "Procedure Errors", desc: "Mistakes happen when staff rely on memory instead of checking the source." },
              { icon: RefreshCw, title: "Outdated Protocols", desc: "Protocols change, but old versions stay in circulation." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                variants={fadeUp}
                custom={i}
                className="p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:border-[#0B6BCB]/30 hover:scale-[1.01] hover:shadow-md transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-[#FEE2E2] flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-[#B91C1C]" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[#1A2332]">{item.title}</h3>
                <p className="text-sm text-[#64748B]">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 px-6 bg-[#F1F5F9]">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-xl md:text-2xl font-semibold mb-4">
              How it works
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="flex flex-col md:flex-row items-start justify-between gap-4"
          >
            {[
              { num: 1, icon: MessageCircle, label: "Ask a Question", desc: "Type or speak your question about a procedure." },
              { num: 2, icon: Search, label: "Find the SOP", desc: "The system searches for matching protocol sections." },
              { num: 3, icon: Brain, label: "Build an Answer", desc: "An answer is generated from the retrieved SOP content." },
              { num: 4, icon: Shield, label: "Verify Accuracy", desc: "The answer is checked against the source for correctness." },
              { num: 5, icon: CheckCircle2, label: "Show the Result", desc: "You get a verified answer with a confidence score." },
            ].map((step, i) => (
              <motion.div key={step.num} variants={fadeUp} custom={i} className="flex-1 flex flex-col items-center text-center relative">
                <div className="w-14 h-14 rounded-full bg-[#0B6BCB]/10 border-2 border-[#0B6BCB]/30 flex items-center justify-center mb-3">
                  <step.icon className="w-6 h-6 text-[#0B6BCB]" />
                </div>
                <div className="absolute top-7 left-[calc(50%+28px)] w-[calc(100%-56px)] h-px bg-[#0B6BCB]/20 hidden md:block last:hidden" />
                <span className="text-xs text-[#0B6BCB] font-bold mb-1">Step {step.num}</span>
                <h3 className="text-sm font-semibold mb-1 text-[#1A2332]">{step.label}</h3>
                <p className="text-xs text-[#64748B] max-w-[160px]">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xl md:text-2xl font-semibold text-center mb-12"
          >
            Key features
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[
              { icon: Shield, title: "Answer Verification", desc: "Every answer is checked against the original SOP for accuracy.", color: "teal" },
              { icon: Mic, title: "Voice Input", desc: "Ask questions by voice when your hands are busy.", color: "teal" },
              { icon: RefreshCw, title: "Living Knowledge Base", desc: "Clinicians can propose SOP updates directly.", color: "green" },
              { icon: Gauge, title: "Confidence Scoring", desc: "The system tells you how confident it is, and when to check the source yourself.", color: "gray" },
              { icon: Eye, title: "Transparent Reasoning", desc: "See exactly which SOP sections were used to build the answer.", color: "amber" },
              { icon: MessageCircle, title: "Clinician Feedback", desc: "Staff can flag wrong answers so the system improves.", color: "gray" },
            ].map((f, i) => {
              const colorMap: Record<string, string> = {
                teal: "bg-[#0B6BCB]/10 text-[#0B6BCB]",
                blue: "bg-[#0B6BCB]/10 text-[#0B6BCB]",
                green: "bg-[#DCFCE7] text-[#15803D]",
                purple: "bg-[#F1F5F9] text-[#64748B]",
                gray: "bg-[#F1F5F9] text-[#64748B]",
                amber: "bg-[#FEF3C7] text-[#B45309]",
                pink: "bg-[#F1F5F9] text-[#64748B]",
              }
              return (
                <motion.div
                  key={f.title}
                  variants={fadeUp}
                  custom={i}
                  className="p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:border-[#0B6BCB]/30 hover:scale-[1.01] hover:shadow-md transition-all duration-300 group"
                >
                  <div className={`w-12 h-12 rounded-xl ${colorMap[f.color]} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-[#1A2332]">{f.title}</h3>
                  <p className="text-sm text-[#64748B]">{f.desc}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Research Contribution */}
      <section className="py-24 px-6 bg-[#F1F5F9]">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-xl md:text-2xl font-semibold mb-6">
              Research contribution
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-[#64748B] mb-12 max-w-2xl mx-auto">
              The Procedural Faithfulness Verifier: an automated check that catches wrong
              thresholds, missing steps, and omitted contraindications in generated answers.
            </motion.p>

            <motion.div variants={fadeUp} custom={2} className="grid sm:grid-cols-2 gap-6">
              <div className="p-8 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
                <div className="text-4xl font-bold text-[#0B6BCB] mb-2">85-95%</div>
                <div className="text-sm text-[#334155]">Violation Detection Rate</div>
                <div className="text-xs text-[#94A3B8] mt-1">(Target on synthetic evaluation set)</div>
              </div>
              <div className="p-8 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
                <div className="text-4xl font-bold text-[#0B6BCB] mb-2"><AnimatedCounter value={5} prefix="<" suffix="s" /></div>
                <div className="text-sm text-[#334155]">End-to-End Response Time</div>
                <div className="text-xs text-[#94A3B8] mt-1">(Including verification)</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2 text-[#1A2332]">Try it now</h2>
          <p className="text-[#64748B] mb-8">Click a question to see a live answer.</p>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              "What are the steps for sepsis management?",
              "What is the MAP threshold in septic shock?",
              "What contraindications exist for heparin?",
            ].map((q) => (
              <button
                key={q}
                onClick={() => {
                  setDemoQuery(q)
                  runDemoQuery(q)
                }}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                  demoQuery === q
                    ? "bg-[#0B6BCB]/10 border-[#0B6BCB]/30 text-[#0B6BCB]"
                    : "bg-white border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332] hover:border-[#CBD5E1]"
                )}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Demo Result */}
          <AnimatePresence mode="wait">
            {demoLoading && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                className="flex items-center justify-center gap-3 py-12 text-[#64748B]">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Running query through pipeline...</span>
              </motion.div>
            )}
            {demoError && !demoLoading && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                className="py-8 text-sm text-[#64748B]">
                {demoError}
              </motion.div>
            )}
            {demoResult && !demoLoading && (
              <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0}}
                className="text-left max-w-3xl mx-auto p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border",
                    demoResult.confidence >= 0.7 ? "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]"
                      : demoResult.confidence >= 0.5 ? "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]"
                      : "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]"
                  )}>
                    {Math.round(demoResult.confidence * 100)}% confidence
                  </span>
                  <span className="text-xs text-[#64748B]">
                    {demoResult.retrieved_chunks?.length || 0} sources found
                  </span>
                  {demoResult.verification_result && (
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-semibold border",
                      demoResult.verification_result.status === "passed"
                        ? "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]"
                        : demoResult.verification_result.status === "warning"
                        ? "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]"
                        : "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]"
                    )}>
                      {demoResult.verification_result.status === "passed" ? "Verified" : demoResult.verification_result.status === "warning" ? "Caution" : "Unverified"}
                    </span>
                  )}
                  <span className="text-xs text-[#64748B]">
                    Query type: {demoResult.query_type || "general"}
                  </span>
                </div>
                <div className="text-[15px] leading-relaxed whitespace-pre-line mb-4 text-[#1A2332]">
                  {demoResult.answer.substring(0, 500)}
                  {demoResult.answer.length > 500 && "..."}
                </div>
                <a href="/query" className="inline-flex items-center gap-2 text-sm text-[#0B6BCB] hover:underline">
                  Open full query workspace <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#E2E8F0] bg-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 text-[#B45309] text-sm mb-4">
            <AlertTriangle className="w-4 h-4" />
            Research prototype. Not for clinical use.
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-[#64748B]">
            <Link href="/architecture" className="hover:text-[#1A2332] transition-colors">
              Architecture
            </Link>
            <Link href="/evaluation" className="hover:text-[#1A2332] transition-colors">
              Evaluation
            </Link>
            <Link href="/query" className="hover:text-[#1A2332] transition-colors">
              Try Demo
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
