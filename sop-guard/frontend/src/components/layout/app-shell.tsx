"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { TopNav } from "./topnav"
import { FocusBar } from "./focus-bar"
import { CommandPalette } from "./command-palette"
import { Toaster } from "@/components/ui/toaster"
import { useAuth } from "@/lib/auth-context"
import { useRole } from "@/lib/role-context"

// Human-readable title per top-level route, shown as "<Title> | Meridian" in
// the browser tab - distinct tab titles are what let a user with several
// Meridian tabs open (Query, Evidence Watch, Proposals...) tell them apart
// at a glance instead of every tab reading the same generic app name.
const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  query: "Ask Meridian",
  library: "SOP Library",
  "evidence-watch": "Evidence Watch",
  proposals: "Proposals",
  incidents: "Incident Reports",
  compliance: "Compliance",
  committee: "Committee Review",
  "conflict-resolution": "Conflict Resolution",
  regulatory: "Regulatory & Survey Prep",
  "survey-prep": "Survey Prep",
  audit: "Audit Log",
  training: "Training",
  leadership: "Leadership",
  admin: "Admin",
  settings: "Settings",
  evaluation: "Evaluation",
  effectiveness: "Effectiveness",
  "human-eval": "Human Evaluation",
  scenarios: "Scenarios",
  adversarial: "Adversarial Testing",
  expiry: "Expiring SOPs",
  exceptions: "Exceptions",
  "impact-map": "Impact Map",
  "alert-stewardship": "Alert Stewardship",
  upload: "Upload SOP",
  updates: "Updates",
  feedback: "Feedback",
  legal: "Legal",
  architecture: "Architecture",
  "quick-ref": "Quick Reference",
  bedside: "Bedside View",
  "cds-demo": "CDS Demo",
  learning: "Learning",
  answers: "Answer",
}

function usePageTitle(pathname: string) {
  useEffect(() => {
    const segment = pathname.split("/")[1] || "dashboard"
    const label = PAGE_TITLES[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    document.title = `${label} | Meridian`
  }, [pathname])
}

export default function AppShell({
  children,
  chrome = "full",
  chromeActions,
}: {
  children: React.ReactNode
  // "minimal" swaps the full TopNav for the slim FocusBar (see /query's
  // focus mode). Auth redirect, page title, density, command palette and
  // toaster are unaffected either way - only the visual chrome changes.
  chrome?: "full" | "minimal"
  // Page-owned controls rendered on the right of FocusBar (e.g. /query's
  // New chat / Conversations / History). A slot, not props threaded
  // through AppShell, so chat state stays in the page that owns it and
  // AppShell learns nothing about chat.
  chromeActions?: React.ReactNode
}) {
  const auth = useAuth()
  const { setRole } = useRole()
  const router = useRouter()
  const pathname = usePathname()
  usePageTitle(pathname)

  // Redirect logic: wait for auth to finish loading before redirecting
  useEffect(() => {
    if (auth.loading) return
    if (!auth.isAuthenticated && pathname !== "/login") {
      router.push("/login")
    }
    if (auth.isAuthenticated && pathname === "/login") {
      router.push("/dashboard")
    }
  }, [auth.loading, auth.isAuthenticated, pathname, router])

  // Sync logged-in user's role to RoleProvider
  useEffect(() => {
    if (auth.user) {
      setRole(auth.user.role)
    }
  }, [auth.user, setRole])

  // Apply saved density preference app-wide
  useEffect(() => {
    try {
      const density = localStorage.getItem("meridian-density")
      document.body.classList.toggle("compact", density === "compact")
    } catch {
      // ignore
    }
  }, [])

  // Show loading spinner while auth is being resolved
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#0B6BCB]/20 border-t-[#0B6BCB] animate-spin" />
      </div>
    )
  }

  // Show spinner while redirecting unauthenticated users
  if (!auth.isAuthenticated && pathname !== "/login") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#0B6BCB]/20 border-t-[#0B6BCB] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {chrome === "minimal" ? <FocusBar actions={chromeActions} /> : <TopNav />}

      <motion.main
        id="main-content"
        tabIndex={-1}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1"
      >
        {children}
      </motion.main>
      {auth.isAuthenticated && <CommandPalette />}
      <Toaster />
    </div>
  )
}
