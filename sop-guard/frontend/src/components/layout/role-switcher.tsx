"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Check } from "lucide-react"
import { useRole, ROLE_HIERARCHY } from "@/lib/role-context"
import { useAuth } from "@/lib/auth-context"
import { DEMO_USERS, ROLE_CONFIG } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/governance-types"

const ROLE_TEXT_COLORS: Record<UserRole, string> = {
  clinical_staff: "text-primary",
  governance_compliance: "text-ok-soft-fg",
  educator: "text-muted-foreground",
  system_admin: "text-muted-foreground",
}

const ROLE_DOT_COLORS: Record<UserRole, string> = {
  clinical_staff: "#0B6BCB",
  governance_compliance: "#15803D",
  educator: "#64748B",
  system_admin: "#64748B",
}

// Sorted demo users by hierarchy level, highest first
const SORTED_DEMO_USERS = [...DEMO_USERS].sort(
  (a, b) => ROLE_HIERARCHY[b.role] - ROLE_HIERARCHY[a.role]
)

export function RoleSwitcher() {
  const { role, currentUser } = useRole()
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

  const handleSwitch = async (user: typeof DEMO_USERS[0]) => {
    // role derives from auth.user (see role-context.tsx) - a real login is
    // the only way to change it now, so this is the whole switch.
    await loginAsDemo(user.id)
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
            ? "border-primary/40"
            : "border-border hover:border-primary/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        )}
      >
        {/* Initials avatar */}
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-11 font-bold text-primary-foreground shrink-0",
            "bg-primary border border-primary-hover"
          )}
        >
          {currentUser.initials}
        </div>
        {/* Name + role */}
        <div className="hidden sm:flex flex-col items-start leading-none gap-0.5">
          <span className="text-12 font-medium text-foreground whitespace-nowrap max-w-[100px] truncate">
            {currentUser.name.split(" ").slice(-1)[0]}
          </span>
          <span className={cn("text-10 font-semibold uppercase tracking-wide", ROLE_TEXT_COLORS[role])}>
            {ROLE_CONFIG[role].label}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-subtle transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1.5 z-50 min-w-[240px]",
            "bg-card border border-border rounded-xl shadow-md",
            "overflow-hidden py-1"
          )}
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-10 text-subtle uppercase tracking-widest font-semibold">
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
                  isActive && "bg-primary/10 border-l-2 border-primary"
                )}
              >
                {/* Level badge */}
                <span className="text-9 font-mono text-subtle w-4 shrink-0 text-right">
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
                      "text-12 font-semibold",
                      isActive ? "text-primary" : "text-foreground"
                    )}
                  >
                    {ROLE_CONFIG[user.role].label}
                  </span>
                  <span className="text-10 text-muted-foreground truncate">{user.name}</span>
                </div>
                {isActive && (
                  <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-auto" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
