"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { X, Info } from "lucide-react"
import { TopNav } from "./topnav"
import { OnboardingTour } from "./onboarding"
import { CommandPalette } from "./command-palette"
import { Toaster } from "@/components/ui/toaster"
import { useAuth } from "@/lib/auth-context"
import { useRole } from "@/lib/role-context"

const DEMO_BANNER_KEY = "meridian-demo-banner-dismissed"

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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [bannerDismissed, setBannerDismissed] = useState(true) // start hidden to avoid flash
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

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DEMO_BANNER_KEY)
      setBannerDismissed(dismissed === "true")
    } catch {
      setBannerDismissed(false)
    }
  }, [])

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

  const dismissBanner = () => {
    setBannerDismissed(true)
    try {
      localStorage.setItem(DEMO_BANNER_KEY, "true")
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNav />

      {/* Demo mode banner */}
      {!bannerDismissed && (
        <div className="relative flex items-center justify-between gap-3 px-4 py-2.5 bg-[#FEF3C7] dark:bg-amber-500/10 border-b border-[#FDE68A] dark:border-amber-500/30">
          <div className="flex items-start gap-2 min-w-0">
            <Info className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#B45309] dark:text-amber-400 leading-relaxed">
              <span className="font-semibold">Demo mode active</span> - Switch roles in the top navigation.{" "}
              <span className="text-[#B45309] dark:text-amber-400/80">
                Demo scenario: query PPE, discover outdated SOP, create proposal, committee review, compliance tracking.
              </span>
            </p>
          </div>
          <button
            onClick={dismissBanner}
            aria-label="Dismiss demo banner"
            className="shrink-0 p-1 rounded-md text-[#B45309] dark:text-amber-400/70 hover:text-[#B45309] dark:text-amber-400 hover:bg-[#FDE68A]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B45309]/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
      <OnboardingTour />
      {auth.isAuthenticated && <CommandPalette />}
      <Toaster />
    </div>
  )
}
