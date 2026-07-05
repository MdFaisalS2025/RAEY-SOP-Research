"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Check } from "lucide-react"
import { useRole, ROLE_HIERARCHY } from "@/lib/role-context"
import { useAuth } from "@/lib/auth-context"
import { DEMO_USERS, ROLE_CONFIG } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/governance-types"

const ROLE_TEXT_COLORS: Record<UserRole, string> = {
  physician: "text-[#0B6BCB]",
  nurse: "text-[#0D9488]",
  department_admin: "text-[#475569]",
  compliance_officer: "text-[#B45309] dark:text-amber-400",
  committee_member: "text-[#15803D] dark:text-green-400",
  legal_risk: "text-[#B91C1C] dark:text-red-400",
  nurse_educator: "text-[#475569]",
  system_admin: "text-[#475569]",
}

const ROLE_DOT_COLORS: Record<UserRole, string> = {
  physician: "#0B6BCB",
  nurse: "#0D9488",
  department_admin: "#64748B",
  compliance_officer: "#B45309",
  committee_member: "#15803D",
  legal_risk: "#B91C1C",
  nurse_educator: "#64748B",
  system_admin: "#64748B",
}

// Sorted demo users by hierarchy level, highest first
const SORTED_DEMO_USERS = [...DEMO_USERS].sort(
  (a, b) => ROLE_HIERARCHY[b.role] - ROLE_HIERARCHY[a.role]
)

export function RoleSwitcher() {
  const { role, currentUser, setRole } = useRole()
  const { loginAsDemo } = useAuth()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const handleSwitch = (user: typeof DEMO_USERS[0]) => {
    loginAsDemo(user.id)
    setRole(user.role)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch demo role"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200",
          "bg-card border shadow-sm hover:bg-muted",
          open
            ? "border-[#0B6BCB]/40"
            : "border-[#E2E8F0] hover:border-[#0B6BCB]/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6BCB]/50"
        )}
      >
        {/* Initials avatar */}
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0",
            "bg-[#0B6BCB] border border-[#0959AC]"
          )}
        >
          {currentUser.initials}
        </div>
        {/* Name + role */}
        <div className="hidden sm:flex flex-col items-start leading-none gap-0.5">
          <span className="text-[12px] font-medium text-[#1A2332] whitespace-nowrap max-w-[100px] truncate">
            {currentUser.name.split(" ").slice(-1)[0]}
          </span>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", ROLE_TEXT_COLORS[role])}>
            {ROLE_CONFIG[role].label}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-[#94A3B8] transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1.5 z-50 min-w-[240px]",
            "bg-card border border-[#E2E8F0] rounded-xl shadow-md",
            "overflow-hidden py-1"
          )}
        >
          <div className="px-3 py-2 border-b border-[#EDF1F5]">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-semibold">
              Switch Profile - Sorted by Access Level
            </p>
          </div>
          {SORTED_DEMO_USERS.map((user) => {
            const isActive = user.role === role
            const level = ROLE_HIERARCHY[user.role]
            return (
              <button
                key={user.role}
                onClick={() => handleSwitch(user)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-150",
                  "hover:bg-muted focus-visible:outline-none focus-visible:bg-muted",
                  isActive && "bg-[#0B6BCB]/10 border-l-2 border-[#0B6BCB]"
                )}
              >
                {/* Level badge */}
                <span className="text-[9px] font-mono text-[#94A3B8] w-4 shrink-0 text-right">
                  {level}
                </span>
                {/* Colored dot */}
                <div
                  className="w-2 h-2 rounded-full shrink-0 border"
                  style={{
                    backgroundColor: isActive ? ROLE_DOT_COLORS[user.role] : "transparent",
                    borderColor: ROLE_DOT_COLORS[user.role],
                  }}
                />
                {/* Role label + user name */}
                <div className="flex flex-col leading-none gap-0.5 min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-[12px] font-semibold",
                      isActive ? "text-[#0B6BCB]" : "text-[#334155]"
                    )}
                  >
                    {ROLE_CONFIG[user.role].label}
                  </span>
                  <span className="text-[10px] text-[#64748B] truncate">{user.name}</span>
                </div>
                {isActive && (
                  <Check className="w-3.5 h-3.5 text-[#0B6BCB] shrink-0 ml-auto" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
