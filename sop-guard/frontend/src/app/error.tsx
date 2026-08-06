"use client"

import { useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { AlertOctagon, Home, RotateCcw } from "lucide-react"

// Root error boundary - previously there was NONE anywhere in this 38-page
// app, so any render exception (a bad API response shape, a null-deref in
// a chart, anything) dropped straight to Next.js's bare, unstyled default
// error screen with no recovery path and no way back into the app short
// of typing a URL. This catches it, matches not-found.tsx's visual style,
// and gives the user a retry (Next's reset()) and a way home.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled render error:", error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#FEE2E2] dark:bg-red-500/10 flex items-center justify-center">
          <AlertOctagon className="w-10 h-10 text-[#B91C1C] dark:text-red-400" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
          This page hit an unexpected error. Your data is safe - this is a display problem, not a lost record.
        </p>
        {error?.message && (
          <p className="text-xs text-subtle font-mono mb-8 break-words">{error.message}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="press inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <button
            onClick={() => reset()}
            className="press inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary hover:bg-primary-hover text-primary-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </motion.div>
    </div>
  )
}
