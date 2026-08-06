"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { ChevronDown, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { ROLE_HIERARCHY } from "@/lib/role-context"
import type { UserRole } from "@/lib/governance-types"

// Extracted out of topnav.tsx (O2.3) alongside ThemeToggle, so FocusBar
// (the slim /query chrome) can reuse the exact same avatar/sign-out logic
// instead of duplicating it - see focus-bar.tsx.

export const ROLE_AVATAR_COLORS: Record<UserRole, { bg: string; text: string }> = {
  clinical_staff: { bg: "bg-blue-500/20", text: "text-blue-300" },
  governance_compliance: { bg: "bg-emerald-500/20", text: "text-emerald-300" },
  educator: { bg: "bg-pink-500/20", text: "text-pink-300" },
  system_admin: { bg: "bg-gray-500/20", text: "text-gray-300" },
}

export const ROLE_LABELS: Record<UserRole, string> = {
  clinical_staff: "Clinical Staff",
  governance_compliance: "Governance & Compliance",
  educator: "Educator / Trainer",
  system_admin: "System Admin",
}

export function ProfileMenu() {
  const auth = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Close on route change - carried over from topnav.tsx's shared
  // mobileOpen/notifOpen/profileOpen/openGroup reset effect; this menu now
  // owns its own slice of that behavior.
  useEffect(() => {
    setProfileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!profileOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [profileOpen])

  const handleSignOut = async () => {
    await auth.logout()
    setProfileOpen(false)
    router.push("/login?signedOut=1")
  }

  if (!auth.user) return null

  const colors = ROLE_AVATAR_COLORS[auth.user.role]
  const level = ROLE_HIERARCHY[auth.user.role]

  return (
    <div ref={profileRef} className="relative">
      <button
        onClick={() => setProfileOpen((v) => !v)}
        aria-label="Open profile menu"
        aria-expanded={profileOpen}
        className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-muted dark:hover:bg-white/[0.05] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg text-11 font-bold shrink-0 select-none",
            colors.bg,
            colors.text
          )}
        >
          {auth.user.initials}
        </div>
        <span className="hidden xl:block text-12 text-[#64748B] dark:text-slate-400 font-medium max-w-[80px] truncate">
          {auth.user.name.split(" ").slice(-1)[0]}
        </span>
        <ChevronDown
          className={cn(
            "hidden xl:block w-3.5 h-3.5 text-[#94A3B8] dark:text-slate-500 transition-transform duration-200",
            profileOpen && "rotate-180"
          )}
        />
      </button>

      {/* Profile dropdown */}
      {profileOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-[220px] bg-card dark:bg-[#0d1516] border border-[#E2E8F0] dark:border-white/[0.08] rounded-xl shadow-md dark:shadow-2xl dark:shadow-black/50 overflow-hidden py-1">
          {/* User info */}
          <div className="px-3 py-2.5 border-b border-[#EDF1F5] dark:border-white/[0.06]">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg text-12 font-bold shrink-0",
                  colors.bg,
                  colors.text
                )}
              >
                {auth.user.initials}
              </div>
              <div className="min-w-0">
                <p className="text-12 font-semibold text-[#1A2332] dark:text-white truncate">{auth.user.name}</p>
                <span
                  className={cn(
                    "inline-block text-10 font-semibold px-1.5 py-0.5 rounded-md mt-0.5",
                    colors.bg,
                    colors.text
                  )}
                >
                  {ROLE_LABELS[auth.user.role]}
                </span>
              </div>
            </div>
            <p className="text-10 text-[#64748B] dark:text-slate-500">
              Access Level {level} of 4
              {level === 4 ? " - Full platform control" : level === 1 ? " - Basic access" : ""}
            </p>
          </div>

          <div className="py-1">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-12 text-danger-soft-fg hover:bg-danger-soft transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
