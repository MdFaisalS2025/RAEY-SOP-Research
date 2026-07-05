"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, MessageSquare, ShieldCheck, FileText, ArrowRight } from "lucide-react"

const steps = [
  {
    icon: MessageSquare,
    title: "Ask a question",
    description: "Type or speak a question about hospital procedures. For example: 'What are the steps for sepsis management?'",
  },
  {
    icon: ShieldCheck,
    title: "Get a verified answer",
    description: "SOP-Guard retrieves relevant SOPs, generates an answer, and checks it for procedural correctness.",
  },
  {
    icon: FileText,
    title: "Trace every source",
    description: "Click any source to see the exact SOP section used. Every claim links back to a real document.",
  },
]

export function OnboardingTour() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const seen = localStorage.getItem("sop-guard-onboarding-seen")
    if (!seen) setShow(true)
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem("sop-guard-onboarding-seen", "true")
  }

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1)
    else dismiss()
  }

  if (!show) return null

  const current = steps[step]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="relative w-full max-w-md p-8 rounded-2xl bg-card border border-border shadow-2xl text-center"
        >
          <button onClick={dismiss} aria-label="Dismiss onboarding tour" className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 dark:bg-[#00E5FF]/10 flex items-center justify-center mx-auto mb-6">
            <current.icon className="w-8 h-8 text-teal-600 dark:text-[#00E5FF]" />
          </div>

          <h3 className="text-lg font-bold mb-2">{current.title}</h3>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{current.description}</p>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? "bg-teal-500 dark:bg-[#00E5FF]" : "bg-gray-300 dark:bg-white/10"}`} />
            ))}
          </div>

          <div className="flex justify-center gap-3">
            <button onClick={dismiss} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              Skip
            </button>
            <button onClick={next} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-teal-500 dark:bg-[#00E5FF] text-white dark:text-black hover:bg-teal-400 dark:hover:bg-[#00E5FF]/80 transition-colors">
              {step < steps.length - 1 ? "Next" : "Get Started"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
