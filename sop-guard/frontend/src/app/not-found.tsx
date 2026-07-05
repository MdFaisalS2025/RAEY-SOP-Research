"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ShieldAlert, Home, MessageSquare } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-teal-500/10 flex items-center justify-center">
          <ShieldAlert className="w-10 h-10 text-teal-600 dark:text-[#00E5FF]" />
        </div>
        <p className="font-display text-7xl font-bold text-foreground mb-2 tracking-tight">404</p>
        <h1 className="font-display text-xl font-semibold text-foreground mb-2">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
          Try the SOP Library or run a query instead.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="press inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <Link
            href="/query"
            className="press inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-teal-500 hover:bg-teal-400 text-white transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Query SOPs
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
