"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { X, MessageSquare, BookOpen, Clock, ArrowRight } from "lucide-react"
import { useRole } from "@/lib/role-context"

const SEEN_KEY = "meridian-first-run-demo-seen"

const LIBRARY_FIRST_ROLES = new Set(["educator"])

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

  const isLibraryFirstRole = LIBRARY_FIRST_ROLES.has(role)

  const showMe = () => {
    dismiss()
    router.push(isLibraryFirstRole ? "/library" : "/query")
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
          className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-md p-6"
        >
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 text-subtle hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-12 h-12 rounded-xl bg-[#0B6BCB]/10 flex items-center justify-center mb-4">
            {isLibraryFirstRole ? (
              <BookOpen className="w-6 h-6 text-[#0B6BCB]" />
            ) : (
              <MessageSquare className="w-6 h-6 text-[#0B6BCB]" />
            )}
          </div>

          {isLibraryFirstRole ? (
            <>
              <h3 className="text-lg font-bold text-foreground mb-2">See your protocols in one tap</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Open the SOP Library to find the exact protocol you need at the bedside, with the current
                approved version highlighted.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-foreground mb-2">Try one real question</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                See how Meridian answers a real clinical question with sources you can trace.
              </p>
              <div className="bg-muted border border-border rounded-lg px-3 py-2.5 mb-4">
                <p className="text-[13px] text-foreground italic">&quot;{EXAMPLE_QUERY}&quot;</p>
              </div>
            </>
          )}

          <div className="flex items-start gap-2 px-3 py-2.5 bg-muted border border-border rounded-lg mb-5">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This usually takes 8 to 12 minutes to look up manually. Meridian answers in seconds.
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={dismiss}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
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
