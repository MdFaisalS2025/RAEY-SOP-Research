"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { X, MessageSquare, BookOpen, Clock, ArrowRight } from "lucide-react"
import { useRole } from "@/lib/role-context"

const SEEN_KEY = "sop-guard-first-run-demo-seen"

const NURSE_ROLES = new Set(["nurse", "nurse_educator"])

const EXAMPLE_QUERY = "What is the maximum norepinephrine dose?"

export function FirstRunDemo() {
  const [show, setShow] = useState(false)
  const { role } = useRole()
  const router = useRouter()

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY)
    if (!seen) setShow(true)
  }, [])

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(SEEN_KEY, "true")
  }

  const isNurseRole = NURSE_ROLES.has(role)

  const showMe = () => {
    dismiss()
    router.push(isNurseRole ? "/library" : "/query")
  }

  if (!show) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          className="relative w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] shadow-md p-6"
        >
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 text-[#94A3B8] hover:text-[#1A2332] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-12 h-12 rounded-xl bg-[#0B6BCB]/10 flex items-center justify-center mb-4">
            {isNurseRole ? (
              <BookOpen className="w-6 h-6 text-[#0B6BCB]" />
            ) : (
              <MessageSquare className="w-6 h-6 text-[#0B6BCB]" />
            )}
          </div>

          {isNurseRole ? (
            <>
              <h3 className="text-lg font-bold text-[#1A2332] mb-2">See your protocols in one tap</h3>
              <p className="text-sm text-[#64748B] leading-relaxed mb-4">
                Open the SOP Library to find the exact protocol you need at the bedside, with the current
                approved version highlighted.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-[#1A2332] mb-2">Try one real question</h3>
              <p className="text-sm text-[#64748B] leading-relaxed mb-3">
                See how SOP-Guard answers a real clinical question with sources you can trace.
              </p>
              <div className="bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg px-3 py-2.5 mb-4">
                <p className="text-[13px] text-[#1A2332] italic">&quot;{EXAMPLE_QUERY}&quot;</p>
              </div>
            </>
          )}

          <div className="flex items-start gap-2 px-3 py-2.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg mb-5">
            <Clock className="w-4 h-4 text-[#64748B] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#64748B] leading-relaxed">
              This usually takes 8 to 12 minutes to look up manually. SOP-Guard answers in seconds.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={dismiss}
              className="px-4 py-2 rounded-lg text-sm text-[#64748B] hover:text-[#1A2332] transition-colors"
            >
              Skip
            </button>
            <button
              onClick={showMe}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-[#0B6BCB] text-white hover:bg-[#0959AC] transition-colors"
            >
              Show me
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
