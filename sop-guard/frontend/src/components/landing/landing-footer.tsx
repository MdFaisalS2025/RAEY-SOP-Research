"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"

export function LandingFooter() {
  return (
    <footer className="relative py-14 px-6 bg-background border-t border-border">
      <div className="max-w-6xl mx-auto text-center">
        <div className="flex items-center justify-center gap-2 text-[#B45309] dark:text-[#FFD600] text-sm mb-6">
          <AlertTriangle className="w-4 h-4" />
          Research prototype. Not for clinical use.
        </div>
        <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
          <Link href="/architecture" className="hover:text-foreground transition-colors">
            Architecture
          </Link>
          <Link href="/evaluation" className="hover:text-foreground transition-colors">
            Evaluation
          </Link>
          <Link href="/login" className="hover:text-foreground transition-colors">
            Try Demo
          </Link>
        </div>
      </div>
    </footer>
  )
}
