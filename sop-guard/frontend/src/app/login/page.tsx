"use client"

import { useState, useEffect, FormEvent, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle2, LogIn, ChevronRight, ShieldCheck, Lock, FileCheck } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { DEMO_USERS } from "@/lib/mock-data"
import { ROLE_HIERARCHY } from "@/lib/role-context"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/governance-types"

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  system_admin:           { bg: "bg-muted",   text: "text-muted-foreground", border: "border-input" },
  governance_compliance:  { bg: "bg-[#DCFCE7] dark:bg-green-500/10",   text: "text-[#15803D] dark:text-green-400", border: "border-[#BBF7D0] dark:border-green-500/30" },
  educator:               { bg: "bg-muted",   text: "text-muted-foreground", border: "border-input" },
  clinical_staff:         { bg: "bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10", text: "text-[#0B6BCB] dark:text-[#00E5FF]", border: "border-[#0B6BCB]/30 dark:border-[#00E5FF]/30" },
}

const ROLE_LABELS: Record<UserRole, string> = {
  system_admin:          "System Admin",
  governance_compliance: "Governance & Compliance",
  educator:              "Educator / Trainer",
  clinical_staff:        "Clinical Staff",
}

// Sorted highest to lowest for the hierarchy ladder. Level numbers are
// derived from this array's length, not hardcoded, so the ladder and the
// demo-user cards below can never drift out of sync again.
const HIERARCHY_LADDER: { role: UserRole; label: string; title: string }[] = [
  { role: "system_admin",          label: "System Admin",              title: "CMIO / IT Director" },
  { role: "governance_compliance", label: "Governance & Compliance",   title: "Compliance, Legal, Committee & Dept. Admin" },
  { role: "educator",              label: "Educator / Trainer",        title: "Clinical Education" },
  { role: "clinical_staff",        label: "Clinical Staff",            title: "Physician / Nurse" },
]
const MAX_LEVEL = HIERARCHY_LADDER.length

const FEATURES = [
  "Retrieval-grounded SOP answers with source citations",
  "Evidence-based governance workflow",
  "Real-time compliance monitoring",
]

const TRUST_BADGES = [
  { icon: ShieldCheck, label: "HIPAA-Aware Architecture" },
  { icon: FileCheck, label: "Audit Trail Ready" },
  { icon: Lock, label: "SOC 2 Track" },
]

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
    await new Promise((r) => setTimeout(r, 300))
    const result = auth.login(staffId.trim(), password)
    if (result.success) {
      router.push("/dashboard")
    } else {
      setError(result.error ?? "Invalid credentials")
      setFormLoading(false)
    }
  }

  const handleDemoLogin = (userId: string) => {
    auth.loginAsDemo(userId)
    router.push("/dashboard")
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
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#0B6BCB]/5 dark:bg-[#00E5FF]/5 blur-3xl" />
        </div>

        <div className="relative flex flex-col h-full px-10 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 border border-[#0B6BCB]/20 dark:border-[#00E5FF]/25">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#0B6BCB] dark:text-[#00E5FF]" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 3c2.8 2.4 4.4 5.6 4.4 9s-1.6 6.6-4.4 9c-2.8-2.4-4.4-5.6-4.4-9s1.6-6.6 4.4-9Z" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </div>
            <span className="font-display text-3xl font-bold text-foreground tracking-tight">Meridian</span>
          </div>

          {/* Tagline */}
          <div className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-foreground leading-tight mb-2">
              Clinical SOP Governance Platform
            </h1>
            <p className="text-sm text-[#0B6BCB] dark:text-[#00E5FF] font-medium tracking-wide">
              Retrieval-grounded · Verified before every answer
            </p>
          </div>

          {/* Feature bullets */}
          <ul className="flex flex-col gap-3 mb-8">
            {FEATURES.map((feat) => (
              <li key={feat} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0B6BCB] dark:text-[#00E5FF] shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground leading-relaxed">{feat}</span>
              </li>
            ))}
          </ul>

          {/* Role hierarchy ladder */}
          <div className="flex-1">
            <p className="text-[10px] text-subtle uppercase tracking-widest font-semibold mb-3">
              Role Hierarchy - Highest to Lowest Access
            </p>
            <div className="flex flex-col gap-1">
              {HIERARCHY_LADDER.map((item, i) => {
                const colors = ROLE_COLORS[item.role]
                const isTop = i === 0
                const isBottom = i === HIERARCHY_LADDER.length - 1
                return (
                  <div key={item.role} className="flex items-center gap-2.5">
                    {/* Level number */}
                    <span className="text-[10px] font-mono text-subtle w-3 shrink-0 text-right">
                      {MAX_LEVEL - i}
                    </span>
                    {/* Connector line */}
                    <div className="flex flex-col items-center w-3 shrink-0">
                      {!isTop && <div className="w-px flex-1 bg-border min-h-[6px]" />}
                      <div className={cn("w-2 h-2 rounded-full shrink-0", colors.bg, "border", colors.border)} />
                      {!isBottom && <div className="w-px flex-1 bg-border min-h-[6px]" />}
                    </div>
                    {/* Role info */}
                    <div className="flex items-center gap-2 py-0.5">
                      <span className={cn("text-[11px] font-semibold", colors.text)}>
                        {item.label}
                      </span>
                      <ChevronRight className="w-3 h-3 text-subtle" />
                      <span className="text-[10px] text-muted-foreground">{item.title}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Trust / compliance-posture badges */}
          <div className="flex flex-wrap gap-2 mt-8">
            {TRUST_BADGES.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card border border-border text-[10px] font-semibold text-muted-foreground"
              >
                <Icon className="w-3 h-3 text-[#0B6BCB] dark:text-[#00E5FF]" />
                {label}
              </span>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="mt-4 rounded-lg border border-[#FDE68A] dark:border-amber-500/30 bg-[#FEF3C7] dark:bg-amber-500/10 px-4 py-3">
            <p className="text-[11px] text-[#B45309] dark:text-amber-400 leading-relaxed font-medium">
              Research Prototype - Not for Clinical Use. All data shown is simulated for demonstration
              purposes only.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-[540px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 border border-[#0B6BCB]/20 dark:border-[#00E5FF]/25">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#0B6BCB] dark:text-[#00E5FF]" fill="none">
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
              className="flex items-center gap-2.5 mb-5 px-4 py-3 rounded-xl bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 text-[#15803D] dark:text-green-400 text-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              You have been signed out.
            </motion.div>
          )}

          {/* Heading + session status */}
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold text-foreground mb-1.5">Welcome back</h2>
              <p className="text-muted-foreground text-sm">Sign in to Meridian</p>
            </div>
            <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 text-[#15803D] dark:text-green-400 text-[10px] font-semibold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Systems Operational
            </span>
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
              className="flex items-center justify-center gap-2 bg-[#0B6BCB] dark:bg-[#00E5FF] hover:bg-[#0959AC] dark:hover:bg-[#00c4d9] disabled:opacity-60 disabled:cursor-not-allowed text-white dark:text-[#0A0C10] font-semibold rounded-lg px-4 py-3 w-full transition-colors mt-1"
            >
              <LogIn className="w-4 h-4" />
              {formLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">or continue as demo user</span>
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
                  className="flex flex-col gap-2 p-3 rounded-xl bg-card border border-border shadow-sm hover:border-[#0B6BCB]/30 dark:hover:border-[#00E5FF]/30 hover:shadow-md transition-all duration-200 group"
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
                      <p className={cn("text-[10px] font-medium truncate", colors.text)}>
                        {ROLE_LABELS[demoUser.role]}
                      </p>
                      {/* Access level badge */}
                      <p className="text-[9px] text-subtle mt-0.5">
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
                    className="w-full text-[11px] font-semibold py-1.5 rounded-lg bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 text-[#0B6BCB] dark:text-[#00E5FF] hover:bg-[#0B6BCB]/20 dark:hover:bg-[#00E5FF]/20 hover:text-[#0959AC] dark:hover:text-[#00E5FF] transition-colors"
                  >
                    Enter
                  </button>
                </motion.div>
              )
            })}
          </div>

          {/* Demo password hint */}
          <p className="text-center text-[11px] text-subtle">
            Demo password:{" "}
            <span className="font-mono text-muted-foreground">demo1234</span>
          </p>
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
          <div className="w-8 h-8 rounded-full border-2 border-[#0B6BCB]/20 border-t-[#0B6BCB] animate-spin" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
