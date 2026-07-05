"use client"

import { useState, useEffect, FormEvent, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Shield, CheckCircle2, LogIn, ChevronRight } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { DEMO_USERS } from "@/lib/mock-data"
import { ROLE_HIERARCHY } from "@/lib/role-context"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/governance-types"

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  system_admin:       { bg: "bg-[#F1F5F9]",   text: "text-[#475569]", border: "border-[#CBD5E1]" },
  compliance_officer: { bg: "bg-[#FEF3C7]",   text: "text-[#B45309]", border: "border-[#FDE68A]" },
  legal_risk:         { bg: "bg-[#FEE2E2]",   text: "text-[#B91C1C]", border: "border-[#FECACA]" },
  committee_member:   { bg: "bg-[#DCFCE7]",   text: "text-[#15803D]", border: "border-[#BBF7D0]" },
  department_admin:   { bg: "bg-[#F1F5F9]",   text: "text-[#475569]", border: "border-[#CBD5E1]" },
  nurse_educator:     { bg: "bg-[#F1F5F9]",   text: "text-[#475569]", border: "border-[#CBD5E1]" },
  physician:          { bg: "bg-[#0B6BCB]/10", text: "text-[#0B6BCB]", border: "border-[#0B6BCB]/30" },
  nurse:              { bg: "bg-[#0D9488]/10", text: "text-[#0D9488]", border: "border-[#0D9488]/30" },
}

const ROLE_LABELS: Record<UserRole, string> = {
  system_admin:       "System Admin",
  compliance_officer: "Compliance Officer",
  legal_risk:         "Legal / Risk",
  committee_member:   "Committee Member",
  department_admin:   "Dept. Admin",
  nurse_educator:     "Nurse Educator",
  physician:          "Physician",
  nurse:              "Nurse",
}

// Sorted highest to lowest for the hierarchy ladder
const HIERARCHY_LADDER: { role: UserRole; label: string; title: string }[] = [
  { role: "system_admin",       label: "System Admin",        title: "CMIO / IT Director" },
  { role: "compliance_officer", label: "Compliance Officer",  title: "Quality / Patient Safety" },
  { role: "legal_risk",         label: "Legal / Risk",        title: "Risk Manager / Counsel" },
  { role: "committee_member",   label: "Committee Member",    title: "P&T / Quality Committee" },
  { role: "department_admin",   label: "Dept. Admin",         title: "Dept. Director / Nurse Mgr" },
  { role: "nurse_educator",     label: "Nurse Educator",      title: "Clinical Education" },
  { role: "physician",          label: "Physician",           title: "Attending / Specialist" },
  { role: "nurse",              label: "Nurse / RN",          title: "Staff Nurse" },
]

const FEATURES = [
  "AI-powered SOP query with source citations",
  "Evidence-based governance workflow",
  "Real-time compliance monitoring",
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
    <div className="min-h-screen flex bg-[#F7F9FB]">
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col w-[42%] min-h-screen bg-[#F1F5F9] border-r border-[#E2E8F0] relative overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(11,107,203,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(11,107,203,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#0B6BCB]/5 blur-3xl" />
        </div>

        <div className="relative flex flex-col h-full px-10 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/20">
              <Shield className="w-6 h-6 text-[#0B6BCB]" />
            </div>
            <span className="font-display text-3xl font-bold text-[#1A2332] tracking-tight">SOP-Guard</span>
          </div>

          {/* Tagline */}
          <div className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-[#1A2332] leading-tight mb-2">
              Clinical SOP Governance Platform
            </h1>
            <p className="text-sm text-[#0B6BCB] font-medium tracking-wide">
              Powered by RAG + Llama 3.3 70B
            </p>
          </div>

          {/* Feature bullets */}
          <ul className="flex flex-col gap-3 mb-8">
            {FEATURES.map((feat) => (
              <li key={feat} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0B6BCB] shrink-0 mt-0.5" />
                <span className="text-sm text-[#334155] leading-relaxed">{feat}</span>
              </li>
            ))}
          </ul>

          {/* Role hierarchy ladder */}
          <div className="flex-1">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-semibold mb-3">
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
                    <span className="text-[10px] font-mono text-[#94A3B8] w-3 shrink-0 text-right">
                      {8 - i}
                    </span>
                    {/* Connector line */}
                    <div className="flex flex-col items-center w-3 shrink-0">
                      {!isTop && <div className="w-px flex-1 bg-[#CBD5E1] min-h-[6px]" />}
                      <div className={cn("w-2 h-2 rounded-full shrink-0", colors.bg, "border", colors.border)} />
                      {!isBottom && <div className="w-px flex-1 bg-[#CBD5E1] min-h-[6px]" />}
                    </div>
                    {/* Role info */}
                    <div className="flex items-center gap-2 py-0.5">
                      <span className={cn("text-[11px] font-semibold", colors.text)}>
                        {item.label}
                      </span>
                      <ChevronRight className="w-3 h-3 text-[#94A3B8]" />
                      <span className="text-[10px] text-[#64748B]">{item.title}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 rounded-lg border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3">
            <p className="text-[11px] text-[#B45309] leading-relaxed font-medium">
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
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#0B6BCB]/10 border border-[#0B6BCB]/20">
              <Shield className="w-5 h-5 text-[#0B6BCB]" />
            </div>
            <span className="font-display text-2xl font-bold text-[#1A2332]">SOP-Guard</span>
          </div>

          {/* Signed-out banner */}
          {signedOut && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5 mb-5 px-4 py-3 rounded-xl bg-[#DCFCE7] border border-[#BBF7D0] text-[#15803D] text-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              You have been signed out.
            </motion.div>
          )}

          {/* Heading */}
          <div className="mb-7">
            <h2 className="font-display text-3xl font-bold text-[#1A2332] mb-1.5">Welcome back</h2>
            <p className="text-[#64748B] text-sm">Sign in to SOP-Guard</p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-7">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="staff-id" className="text-xs font-medium text-[#64748B] uppercase tracking-wider">
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
                className="bg-white border border-[#CBD5E1] rounded-lg px-4 py-3 text-[#1A2332] placeholder:text-[#94A3B8] caret-[#0B6BCB] focus:border-[#0B6BCB] focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/50 text-sm transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-medium text-[#64748B] uppercase tracking-wider">
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
                className="bg-white border border-[#CBD5E1] rounded-lg px-4 py-3 text-[#1A2332] placeholder:text-[#94A3B8] caret-[#0B6BCB] focus:border-[#0B6BCB] focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/50 text-sm transition-colors"
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[#B91C1C] text-sm px-1"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={formLoading}
              className="flex items-center justify-center gap-2 bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-3 w-full transition-colors mt-1"
            >
              <LogIn className="w-4 h-4" />
              {formLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-xs text-[#64748B] whitespace-nowrap">or continue as demo user</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          {/* Demo user grid - sorted by hierarchy level */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {SORTED_DEMO_USERS.map((demoUser, i) => {
              const colors = ROLE_COLORS[demoUser.role]
              const level = ROLE_HIERARCHY[demoUser.role]
              const isHighest = level === 8
              const isLowest = level === 1
              return (
                <motion.div
                  key={demoUser.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="flex flex-col gap-2 p-3 rounded-xl bg-white border border-[#E2E8F0] shadow-sm hover:border-[#0B6BCB]/30 hover:shadow-md transition-all duration-200 group"
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
                      <p className="text-xs font-semibold text-[#1A2332] truncate">{demoUser.name}</p>
                      <p className={cn("text-[10px] font-medium truncate", colors.text)}>
                        {ROLE_LABELS[demoUser.role]}
                      </p>
                      {/* Access level badge */}
                      <p className="text-[9px] text-[#94A3B8] mt-0.5">
                        {isHighest
                          ? "Level 8 - Highest access"
                          : isLowest
                          ? "Level 1 - Basic access"
                          : `Level ${level} of 8`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDemoLogin(demoUser.id)}
                    className="w-full text-[11px] font-semibold py-1.5 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 hover:text-[#0959AC] transition-colors"
                  >
                    Enter
                  </button>
                </motion.div>
              )
            })}
          </div>

          {/* Demo password hint */}
          <p className="text-center text-[11px] text-[#94A3B8]">
            Demo password:{" "}
            <span className="font-mono text-[#475569]">demo1234</span>
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
        <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#0B6BCB]/20 border-t-[#0B6BCB] animate-spin" />
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
