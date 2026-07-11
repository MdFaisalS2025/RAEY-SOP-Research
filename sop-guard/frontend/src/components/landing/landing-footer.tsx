"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"

export function LandingFooter() {
  return (
    <footer className="relative py-14 px-6 bg-[#0A0C10] border-t border-white/5">
      <div className="max-w-6xl mx-auto text-center">
        <div className="flex items-center justify-center gap-2 text-[#FFD600]/90 text-sm mb-6">
          <AlertTriangle className="w-4 h-4" />
          Research prototype. Not for clinical use.
        </div>
        <div className="flex items-center justify-center gap-8 text-sm text-white/40">
          <Link href="/architecture" className="hover:text-white transition-colors">
            Architecture
          </Link>
          <Link href="/evaluation" className="hover:text-white transition-colors">
            Evaluation
          </Link>
          <Link href="/query" className="hover:text-white transition-colors">
            Try Demo
          </Link>
        </div>
      </div>
    </footer>
  )
}
