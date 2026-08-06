"use client"

import { useState, useEffect, FormEvent, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle2, LogIn, AlertTriangle } from "lucide-react"
import { SafetyNote } from "@/components/ui/safety-note"
import { useAuth } from "@/lib/auth-context"
import { DEMO_USERS } from "@/lib/mock-data"
import { ROLE_HIERARCHY } from "@/lib/role-context"
import { cn } from "@/lib/utils"
import { toneChip } from "@/components/ui/tone"
import type { UserRole } from "@/lib/governance-types"

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  system_admin:           { bg: "bg-muted",   text: "text-muted-foreground", border: "border-input" },
  governance_compliance:  { bg: "bg-[#DCFCE7] dark:bg-green-500/10",   text: "text-[#15803D] dark:text-green-400", border: "border-[#BBF7D0] dark:border-green-500/30" },
  educator:               { bg: "bg-muted",   text: "text-muted-foreground", border: "border-input" },
  clinical_staff:         { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30" },
}

const ROLE_LABELS: Record<UserRole, string> = {
  system_admin:          "System Admin",
  governance_compliance: "Governance & Compliance",
  educator:              "Educator / Trainer",
  clinical_staff:        "Clinical Staff",
}

const FEATURES = [
  "Ask about any approved protocol and get a cited answer",
  "Compare guidance against current clinical evidence",
  "Flag gaps and route them to committee review",
]

// Still needed for each demo-user card's "Level X of Y" access label below
// (the ladder visualization that used to also read this was removed).
const MAX_LEVEL = Math.max(...Object.values(ROLE_HIERARCHY))

// Sort demo users by hierarchy level (highest first) for display
const SORTED_DEMO_USERS = [...DEMO_USERS].sort(
  (a, b) => ROLE_HIERARCHY[b.role] - ROLE_HIERARCHY[a.role]
)

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useAuth()

  const [staffId, setStaffId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [formLoading, setFormLoading] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [demoLoadingId, setDemoLoadingId] = useState<string | null>(null)
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking")

  useEffect(() => {
    document.title = "Sign In | Meridian"
  }, [])

  // The status pill used to be a hardcoded "Systems Operational" string,
  // rendered regardless of whether the backend was actually reachable -
  // the same fake-status pattern flagged elsewhere in the app (e.g. the
  // old /admin systemStatus). GET /api/health is unauthenticated, so it
  // can be probed before login.
  useEffect(() => {
    let cancelled = false
    fetch("/api/health")
      .then((res) => {
        if (!cancelled) setBackendStatus(res.ok ? "online" : "offline")
      })
      .catch(() => {
        if (!cancelled) setBackendStatus("offline")
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Show signed-out banner when redirected with ?signedOut=1
  useEffect(() => {
    if (searchParams.get("signedOut") === "1") {
      setSignedOut(true)
      const t = setTimeout(() => setSignedOut(false), 4000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setFormLoading(true)
    const result = await auth.login(staffId.trim(), password)
    if (result.success) {
      router.push("/dashboard")
    } else {
      setError(result.error ?? "Invalid credentials")
      setFormLoading(false)
    }
  }

  const handleDemoLogin = async (userId: string) => {
    setError("")
    setDemoLoadingId(userId)
    const result = await auth.loginAsDemo(userId)
    if (result.success) {
      router.push("/dashboard")
    } else {
      setError(result.error ?? "Invalid credentials")
      setDemoLoadingId(null)
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col w-[42%] min-h-screen bg-muted border-r border-border relative overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(11,107,203,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(11,107,203,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative flex flex-col h-full px-10 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 border border-primary/20">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-primary" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 3c2.8 2.4 4.4 5.6 4.4 9s-1.6 6.6-4.4 9c-2.8-2.4-4.4-5.6-4.4-9s1.6-6.6 4.4-9Z" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </div>
            <span className="font-display text-3xl font-bold text-foreground tracking-tight">Meridian</span>
          </div>

          {/* Tagline */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground leading-tight mb-2">
              Clinical SOP Intelligence Platform
            </h1>
            <p className="text-sm text-primary font-medium tracking-wide">
              Ask. Verify. Improve.
            </p>
          </div>

          {/* Feature bullets */}
          <ul className="flex flex-col gap-3 mb-8">
            {FEATURES.map((feat) => (
              <li key={feat} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground leading-relaxed">{feat}</span>
              </li>
            ))}
          </ul>

          <div className="flex-1" />

          <SafetyNote className="mt-4" />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-[540px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 3c2.8 2.4 4.4 5.6 4.4 9s-1.6 6.6-4.4 9c-2.8-2.4-4.4-5.6-4.4-9s1.6-6.6 4.4-9Z" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </div>
            <span className="font-display text-2xl font-bold text-foreground">Meridian</span>
          </div>

          {/* Signed-out banner */}
          {signedOut && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(toneChip.success, "flex items-center gap-2.5 mb-5 px-4 py-3 rounded-xl text-sm font-medium")}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              You have been signed out.
            </motion.div>
          )}

          {/* Heading + session status */}
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-1.5">Welcome back</h2>
              <p className="text-muted-foreground text-sm">Sign in to Meridian</p>
            </div>
            {backendStatus === "offline" ? (
              <span className={cn(toneChip.danger, "inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-10 font-semibold shrink-0")}>
                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                Backend Unreachable
              </span>
            ) : (
              <span className={cn(toneChip.success, "inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-10 font-semibold shrink-0")}>
                <span className={cn("w-1.5 h-1.5 rounded-full bg-current", backendStatus === "checking" ? "animate-pulse" : undefined)} />
                {backendStatus === "checking" ? "Checking status..." : "Systems Operational"}
              </span>
            )}
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-7">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="staff-id" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Staff ID
              </label>
              <input
                id="staff-id"
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="staff_id"
                autoComplete="username"
                required
                className="clinical-input px-4 py-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="clinical-input px-4 py-3 text-sm"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[#B91C1C] dark:text-red-400 text-sm px-1"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={formLoading}
              className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground font-semibold rounded-lg px-4 py-3 w-full transition-colors mt-1"
            >
              <LogIn className="w-4 h-4" />
              {formLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Quick access</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Demo user grid - sorted by hierarchy level */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {SORTED_DEMO_USERS.map((demoUser, i) => {
              const colors = ROLE_COLORS[demoUser.role]
              const level = ROLE_HIERARCHY[demoUser.role]
              const isHighest = level === MAX_LEVEL
              const isLowest = level === 1
              return (
                <motion.div
                  key={demoUser.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="flex flex-col gap-2 p-3 rounded-xl bg-card border border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex items-start gap-2.5">
                    {/* Initials avatar */}
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold shrink-0",
                        colors.bg,
                        colors.text
                      )}
                    >
                      {demoUser.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">{demoUser.name}</p>
                      <p className={cn("text-10 font-medium truncate", colors.text)}>
                        {ROLE_LABELS[demoUser.role]}
                      </p>
                      {/* Access level badge */}
                      <p className="text-9 text-subtle mt-0.5">
                        {isHighest
                          ? `Level ${MAX_LEVEL} - Highest access`
                          : isLowest
                          ? "Level 1 - Basic access"
                          : `Level ${level} of ${MAX_LEVEL}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDemoLogin(demoUser.id)}
                    disabled={demoLoadingId !== null}
                    className="w-full text-11 font-semibold py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {demoLoadingId === demoUser.id ? "Signing in..." : "Enter"}
                  </button>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-[#0B6BCB] animate-spin" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
