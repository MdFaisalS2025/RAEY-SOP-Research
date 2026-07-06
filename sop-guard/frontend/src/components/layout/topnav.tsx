"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  GitBranch,
  BarChart3,
  ShieldCheck,
  Settings,
  Shield,
  Search,
  Moon,
  Sun,
  Menu,
  X,
  AlertTriangle,
  Bell,
  FlaskConical,
  Users,
  BookMarked,
  Scale,
  ClipboardList,
  GraduationCap,
  Activity,
  Network,
  LogOut,
  ChevronDown,
  UserCircle,
  RefreshCw,
  Check,
  Clock,
  Landmark,
  ClipboardCheck,
  AlertOctagon,
  FileWarning,
  Gauge,
  Bug,
  Wrench,
  Info,
  ShieldOff,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RoleSwitcher } from "@/components/layout/role-switcher"
import { useAuth } from "@/lib/auth-context"
import { useRole, ROLE_HIERARCHY } from "@/lib/role-context"
import { useRouter } from "next/navigation"
import type { UserRole, NotificationItem } from "@/lib/governance-types"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type NavGroup = {
  label: string
  items: NavItem[]
}

// Direct links always visible on desktop
const DIRECT_LINKS: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/query", label: "Ask SOP-Guard", icon: MessageSquare },
]

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Clinical",
    items: [
      { href: "/", label: "Home", icon: LayoutDashboard },
      { href: "/query", label: "Ask SOP-Guard", icon: MessageSquare },
      { href: "/library", label: "SOP Library", icon: BookOpen },
      { href: "/quick-ref", label: "Quick Reference", icon: BookMarked },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/evidence-watch", label: "Evidence Watch", icon: FlaskConical },
      { href: "/proposals", label: "Proposals", icon: GitBranch },
      { href: "/committee", label: "Committee", icon: Users },
      { href: "/conflict-resolution", label: "Conflicts", icon: AlertTriangle },
      { href: "/impact-map", label: "Impact Map", icon: Network },
    ],
  },
  {
    label: "Compliance",
    items: [
      { href: "/compliance", label: "Compliance", icon: ShieldCheck },
      { href: "/training", label: "Training", icon: GraduationCap },
      { href: "/legal", label: "Legal & Risk", icon: Scale },
      { href: "/audit", label: "Audit", icon: ClipboardList },
      { href: "/expiry", label: "Expiry", icon: Clock },
      { href: "/regulatory", label: "Regulatory", icon: Landmark },
    ],
  },
  {
    label: "Quality",
    items: [
      { href: "/leadership", label: "Leadership", icon: BarChart3 },
      { href: "/effectiveness", label: "Effectiveness", icon: Activity },
      { href: "/survey-prep", label: "Survey Prep", icon: ClipboardCheck },
      { href: "/incidents", label: "Incidents", icon: AlertOctagon },
      { href: "/exceptions", label: "Exceptions", icon: FileWarning },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/evaluation", label: "Evaluation", icon: Gauge },
      { href: "/adversarial", label: "Adversarial", icon: Bug },
      { href: "/alert-stewardship", label: "Alert Stewardship", icon: ShieldOff },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/admin", label: "Admin", icon: Wrench },
    ],
  },
]

const DIRECT_HREFS = DIRECT_LINKS.map((l) => l.href)

// ─── Alert tiering (alert-fatigue reduction) ─────────────────────────────────
type AlertTier = "passive" | "banner" | "interruptive"

type TieredNotification = NotificationItem & {
  tier: AlertTier
  effectiveTier: AlertTier
}

type LiveNotificationItem = NotificationItem & { tier?: AlertTier }

const INTERRUPTIVE_BUDGET = 3
const SESSION_INTERRUPTIVE_COUNT_KEY = "sop-guard-session-interruptive-count"
const SESSION_SEEN_INTERRUPTIVE_KEY = "sop-guard-session-seen-interruptive-ids"

function inferTier(n: { priority: string; type?: string }): AlertTier {
  if (n.priority === "urgent") return "interruptive"
  if (n.priority === "high") return "banner"
  return "passive"
}

function getSessionInterruptiveCount(): number {
  if (typeof window === "undefined") return 0
  const raw = sessionStorage.getItem(SESSION_INTERRUPTIVE_COUNT_KEY)
  const n = raw ? parseInt(raw, 10) : 0
  return Number.isFinite(n) ? n : 0
}

function getSeenInterruptiveIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = sessionStorage.getItem(SESSION_SEEN_INTERRUPTIVE_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

// Desktop dropdown groups exclude the always-visible direct links
const DESKTOP_GROUPS: NavGroup[] = NAV_GROUPS.map((g) => ({
  label: g.label,
  items: g.items.filter((i) => !DIRECT_HREFS.includes(i.href)),
})).filter((g) => g.items.length > 0)

const ROLE_AVATAR_COLORS: Record<UserRole, { bg: string; text: string }> = {
  physician: { bg: "bg-blue-500/20", text: "text-blue-300" },
  nurse: { bg: "bg-teal-500/20", text: "text-teal-300" },
  department_admin: { bg: "bg-violet-500/20", text: "text-violet-300" },
  compliance_officer: { bg: "bg-amber-500/20", text: "text-amber-300" },
  committee_member: { bg: "bg-emerald-500/20", text: "text-emerald-300" },
  legal_risk: { bg: "bg-red-500/20", text: "text-red-300" },
  nurse_educator: { bg: "bg-pink-500/20", text: "text-pink-300" },
  system_admin: { bg: "bg-gray-500/20", text: "text-gray-300" },
}

const ROLE_LABELS: Record<UserRole, string> = {
  physician: "Physician",
  nurse: "Nurse",
  department_admin: "Dept. Admin",
  compliance_officer: "Compliance Officer",
  committee_member: "Committee Member",
  legal_risk: "Legal / Risk",
  nurse_educator: "Nurse Educator",
  system_admin: "System Admin",
}

export function TopNav() {
  const pathname = usePathname()
  const auth = useAuth()
  const { roleConfig, hierarchyLevel } = useRole()
  const router = useRouter()
  const [isDark, setIsDark] = useState(true)
  const [backendUp, setBackendUp] = useState<boolean | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<LiveNotificationItem[]>([])
  const [notifLive, setNotifLive] = useState(false)
  const [interruptiveCountToday, setInterruptiveCountToday] = useState<number | null>(null)
  const [sessionInterruptiveCount, setSessionInterruptiveCount] = useState(0)
  const [showLegend, setShowLegend] = useState(false)
  const groupNavRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Effective interruptive count for this session: prefer backend field, fall back to client counter
  const effectiveInterruptiveCount = interruptiveCountToday ?? sessionInterruptiveCount
  const budgetExceeded = effectiveInterruptiveCount >= INTERRUPTIVE_BUDGET

  const tieredNotifications: TieredNotification[] = notifications.map((n) => {
    const tier = n.tier ?? inferTier(n)
    const effectiveTier: AlertTier = tier === "interruptive" && budgetExceeded ? "banner" : tier
    return { ...n, tier, effectiveTier }
  })

  useEffect(() => {
    fetch("/api/health")
      .then((r) => setBackendUp(r.ok))
      .catch(() => setBackendUp(false))
  }, [])

  // Initialize the client-side session interruptive counter from sessionStorage
  useEffect(() => {
    setSessionInterruptiveCount(getSessionInterruptiveCount())
  }, [])

  // Live notifications: poll the API, fall back to mock data on failure
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/notifications?limit=20")
        if (!res.ok) return
        const data = await res.json()
        const records = Array.isArray(data) ? data : data?.notifications
        if (!Array.isArray(records) || cancelled) return

        const mapped: LiveNotificationItem[] = records.map((r: any) => ({
          id: String(r.id),
          type: r.type ?? "sop_update",
          title: r.title ?? "",
          description: r.description ?? "",
          timestamp: r.created_at ?? r.timestamp ?? "",
          read: Boolean(r.read),
          priority: r.priority ?? "normal",
          link: r.link ?? undefined,
          tier: r.tier === "passive" || r.tier === "banner" || r.tier === "interruptive" ? r.tier : undefined,
        }))
        setNotifications(mapped)
        setNotifLive(true)

        // Top-level interruptive_count_today, when present, is authoritative
        if (typeof data?.interruptive_count_today === "number") {
          setInterruptiveCountToday(data.interruptive_count_today)
        }

        // Client-side fallback counter: bump once per newly-seen interruptive-tier notification
        const seen = getSeenInterruptiveIds()
        let bumped = false
        for (const n of mapped) {
          const tier = n.tier ?? inferTier(n)
          if (tier === "interruptive" && !seen.has(n.id)) {
            seen.add(n.id)
            bumped = true
          }
        }
        if (bumped) {
          const newCount = getSessionInterruptiveCount() + 1
          sessionStorage.setItem(SESSION_INTERRUPTIVE_COUNT_KEY, String(newCount))
          sessionStorage.setItem(SESSION_SEEN_INTERRUPTIVE_KEY, JSON.stringify(Array.from(seen)))
          setSessionInterruptiveCount(newCount)
        }
      } catch {
        // keep whatever notifications are already loaded (real data only - no mock fallback)
      }
    }
    load()
    const interval = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const markRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    if (notifLive) {
      fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {})
    }
  }

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (notifLive) {
      fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {})
    }
  }

  const openCommandPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
    )
  }

  useEffect(() => {
    const html = document.documentElement
    setIsDark(html.classList.contains("dark"))
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setNotifOpen(false)
    setProfileOpen(false)
    setOpenGroup(null)
  }, [pathname])

  useEffect(() => {
    if (!openGroup) return
    const handleClickOutside = (e: MouseEvent) => {
      if (groupNavRef.current && !groupNavRef.current.contains(e.target as Node)) {
        setOpenGroup(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenGroup(null)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [openGroup])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!notifOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [notifOpen])

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

  const toggleTheme = () => {
    const html = document.documentElement
    if (html.classList.contains("dark")) {
      html.classList.remove("dark")
      setIsDark(false)
      localStorage.setItem("sop-guard-theme", "light")
    } else {
      html.classList.add("dark")
      setIsDark(true)
      localStorage.setItem("sop-guard-theme", "dark")
    }
  }

  const handleSignOut = () => {
    auth.logout()
    setProfileOpen(false)
    router.push("/login?signedOut=1")
  }

  const isActiveLink = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href))

  const statusLabel =
    backendUp === true
      ? "System online"
      : backendUp === false
      ? "Start backend (port 8000)"
      : "Connecting..."

  const priorityColors: Record<string, string> = {
    urgent: "text-[#B91C1C] dark:text-red-400 dark:text-red-400",
    high: "text-[#B45309] dark:text-amber-400 dark:text-amber-400",
    normal: "text-[#334155] dark:text-slate-300",
    low: "text-[#64748B] dark:text-slate-400",
  }

  return (
    <header className="sticky top-0 z-40 flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#0B6BCB] focus:text-white focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Disclaimer banner */}
      <div className="flex items-center justify-center gap-1.5 px-4 py-1 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-[#FFD600] text-[11px] font-medium">
        <AlertTriangle className="w-3 h-3" />
        <span>Research Only - Not for Clinical Use</span>
      </div>

      {/* Main nav bar */}
      <div className="glass-clinical border-b border-gray-200 dark:border-white/[0.08] shadow-sm dark:shadow-black/20">
        <div className="flex items-center gap-2 px-4 lg:px-6 h-14 lg:h-16">
          {/* Logo + brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/15 dark:glow-cyan transition-all duration-200 group-hover:scale-105">
              <Shield className="w-5 h-5 text-[#0B6BCB] dark:text-[#00E5FF]" />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-base font-bold text-[#1A2332] dark:text-white tracking-tight">SOP-Guard</span>
              <span className="text-[9px] text-[#0B6BCB]/70 dark:text-[#00E5FF]/70 font-medium tracking-widest uppercase">
                Clinical Command
              </span>
            </div>
          </Link>

          {/* Desktop nav: direct links + group dropdowns */}
          <nav aria-label="Main navigation" className="hidden lg:block ml-4">
            <div ref={groupNavRef} className="flex items-center gap-0.5">
              {DIRECT_LINKS.map((item) => {
                const active = isActiveLink(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6BCB]/50 dark:focus-visible:ring-[#00E5FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active
                        ? "bg-[#0B6BCB]/10 text-[#0B6BCB] dark:text-[#00E5FF] dark:glow-cyan"
                        : "text-[#64748B] dark:text-slate-400 hover:text-[#1A2332] dark:hover:text-white hover:bg-muted dark:hover:bg-white/5"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="hidden xl:inline">{item.label}</span>
                    {active && (
                      <div className="absolute left-2 right-2 -bottom-[1px] h-[2px] rounded-full bg-[#0B6BCB] dark:bg-[#00E5FF]" />
                    )}
                  </Link>
                )
              })}

              <div className="w-px h-5 bg-[#E2E8F0] dark:bg-white/10 mx-1.5 shrink-0" />

              {DESKTOP_GROUPS.map((group) => {
                const groupActive = group.items.some((item) => isActiveLink(item.href))
                const isOpen = openGroup === group.label
                return (
                  <div key={group.label} className="relative">
                    <button
                      onClick={() => setOpenGroup(isOpen ? null : group.label)}
                      aria-expanded={isOpen}
                      aria-haspopup="menu"
                      className={cn(
                        "relative flex items-center gap-1 px-2.5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6BCB]/50 dark:focus-visible:ring-[#00E5FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        groupActive || isOpen
                          ? "text-[#0B6BCB] dark:text-[#00E5FF]"
                          : "text-[#64748B] dark:text-slate-400 hover:text-[#1A2332] dark:hover:text-white hover:bg-muted dark:hover:bg-white/5"
                      )}
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 transition-transform duration-200",
                          isOpen && "rotate-180"
                        )}
                      />
                      {groupActive && (
                        <div className="absolute left-2 right-2 -bottom-[1px] h-[2px] rounded-full bg-[#0B6BCB] dark:bg-[#00E5FF]" />
                      )}
                    </button>

                    {isOpen && (
                      <div
                        role="menu"
                        className="absolute left-0 top-full mt-1.5 z-50 w-[220px] bg-card dark:bg-[#0d1516] border border-[#E2E8F0] dark:border-white/[0.08] rounded-xl shadow-md dark:shadow-2xl dark:shadow-black/50 overflow-hidden py-1"
                      >
                        {group.items.map((item) => {
                          const active = isActiveLink(item.href)
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              role="menuitem"
                              onClick={() => setOpenGroup(null)}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium transition-colors",
                                active
                                  ? "text-[#0B6BCB] dark:text-teal-400 bg-[#0B6BCB]/5 dark:bg-transparent"
                                  : "text-[#334155] dark:text-slate-300 hover:bg-muted dark:hover:bg-white/[0.05] hover:text-[#1A2332] dark:hover:text-white"
                              )}
                            >
                              <item.icon
                                className={cn(
                                  "w-4 h-4 shrink-0",
                                  active ? "text-[#0B6BCB] dark:text-teal-400" : "text-[#94A3B8] dark:text-slate-500"
                                )}
                              />
                              <span>{item.label}</span>
                              {active && <Check className="w-3.5 h-3.5 text-[#0B6BCB] dark:text-teal-400 ml-auto" />}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </nav>

          {/* Right cluster */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Backend status dot */}
            <div
              className="hidden xl:flex items-center justify-center w-8 h-8 shrink-0"
              title={statusLabel}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  backendUp === true
                    ? "bg-green-500"
                    : backendUp === false
                    ? "bg-red-500"
                    : "bg-amber-500 animate-pulse"
                )}
              />
            </div>

            {/* Search / command palette trigger */}
            <button
              onClick={openCommandPalette}
              aria-label="Open search (Ctrl+K)"
              title="Search (Ctrl+K)"
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/10 bg-card dark:bg-[#11191b] text-[#64748B] dark:text-slate-400 hover:text-[#1A2332] dark:hover:text-white hover:border-[#CBD5E1] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6BCB]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Search className="w-4 h-4" />
              <span className="text-[12px] font-medium">Search</span>
              <kbd className="text-[10px] font-medium text-[#94A3B8] border border-[#E2E8F0] dark:border-white/10 rounded px-1 py-0.5 leading-none">
                Ctrl K
              </kbd>
            </button>

            {/* Notification bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                aria-label={`Notifications - ${unreadCount} unread`}
                className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/[0.05] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 dark:focus-visible:ring-[#00E5FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {/* Notification dropdown */}
              {notifOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-[340px] bg-card dark:bg-[#0d1516] border border-[#E2E8F0] dark:border-white/[0.08] rounded-xl shadow-md dark:shadow-2xl dark:shadow-black/50 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-[#EDF1F5] dark:border-white/[0.06] flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#1A2332] dark:text-white/80">Notifications</span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <span className="text-[10px] text-[#0B6BCB] dark:text-teal-400">{unreadCount} unread</span>
                      )}
                      <div className="relative">
                        <button
                          type="button"
                          onMouseEnter={() => setShowLegend(true)}
                          onMouseLeave={() => setShowLegend(false)}
                          onFocus={() => setShowLegend(true)}
                          onBlur={() => setShowLegend(false)}
                          aria-label="Alert color legend"
                          className="text-[#94A3B8] hover:text-[#64748B] dark:hover:text-white/70 transition-colors"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        {showLegend && (
                          <div className="absolute right-0 top-full mt-1.5 z-50 w-[220px] p-2.5 rounded-lg bg-[#1A2332] text-white text-[10px] leading-relaxed shadow-md space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] shrink-0" />
                              <span>Gray = informational</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
                              <span>Amber = review when convenient</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0" />
                              <span>Red = needs action</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto">
                    {tieredNotifications.length === 0 && (
                      <p className="px-3 py-6 text-center text-xs text-[#64748B]">No notifications yet.</p>
                    )}
                    {tieredNotifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.link ?? "#"}
                        onClick={() => setNotifOpen(false)}
                        className={cn(
                          "flex flex-col gap-0.5 px-3 py-2.5 border-b border-l-2 border-[#EDF1F5] dark:border-white/[0.04] hover:bg-muted dark:hover:bg-white/[0.04] transition-colors",
                          !n.read && "bg-[#0B6BCB]/[0.03] dark:bg-white/[0.02]",
                          n.effectiveTier === "interruptive" && "border-l-[#DC2626]",
                          n.effectiveTier === "banner" && "border-l-[#F59E0B]",
                          n.effectiveTier === "passive" && "border-l-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {n.effectiveTier === "passive" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] shrink-0" />
                          )}
                          {n.effectiveTier === "banner" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
                          )}
                          {n.effectiveTier === "interruptive" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0" />
                          )}
                          <span
                            className={cn(
                              "text-[12px]",
                              n.effectiveTier === "interruptive" || n.effectiveTier === "banner" ? "font-bold" : "font-semibold",
                              !n.read ? "text-[#1A2332] dark:text-white" : "text-[#64748B] dark:text-white/60",
                              priorityColors[n.priority]
                            )}
                          >
                            {n.title}
                          </span>
                          {n.effectiveTier === "interruptive" && (
                            <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30">
                              Action needed
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B] dark:text-slate-500 line-clamp-2 ml-3.5">{n.description}</p>
                      </Link>
                    ))}
                  </div>
                  {budgetExceeded && (
                    <div className="px-3 py-2 border-t border-[#EDF1F5] dark:border-white/[0.06] bg-muted dark:bg-white/[0.03]">
                      <p className="text-[10px] text-[#64748B] leading-snug">
                        Alert volume reduced for this session to reduce interruption fatigue.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Role Switcher */}
            <RoleSwitcher />

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/[0.05] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 dark:focus-visible:ring-[#00E5FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* User avatar + profile dropdown */}
            {auth.user && (() => {
              const colors = ROLE_AVATAR_COLORS[auth.user.role]
              const level = ROLE_HIERARCHY[auth.user.role]
              return (
                <div ref={profileRef} className="relative">
                  <button
                    onClick={() => setProfileOpen((v) => !v)}
                    aria-label="Open profile menu"
                    aria-expanded={profileOpen}
                    className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-muted dark:hover:bg-white/[0.05] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6BCB]/50"
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg text-[11px] font-bold shrink-0 select-none",
                        colors.bg,
                        colors.text
                      )}
                    >
                      {auth.user.initials}
                    </div>
                    <span className="hidden xl:block text-[12px] text-[#64748B] dark:text-slate-400 font-medium max-w-[80px] truncate">
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
                              "flex items-center justify-center w-9 h-9 rounded-lg text-[12px] font-bold shrink-0",
                              colors.bg,
                              colors.text
                            )}
                          >
                            {auth.user.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-[#1A2332] dark:text-white truncate">{auth.user.name}</p>
                            <span
                              className={cn(
                                "inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-0.5",
                                colors.bg,
                                colors.text
                              )}
                            >
                              {ROLE_LABELS[auth.user.role]}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-[#64748B] dark:text-slate-500">
                          Access Level {level} of 8
                          {level === 8 ? " - Full platform control" : level === 1 ? " - Basic access" : ""}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="py-1">
                        <button
                          onClick={() => setProfileOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-[#334155] dark:text-slate-300 hover:bg-muted dark:hover:bg-white/[0.05] hover:text-[#1A2332] dark:hover:text-white transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-[#94A3B8] dark:text-slate-500" />
                          Switch Profile
                        </button>
                        <div className="h-px bg-[#EDF1F5] dark:bg-white/[0.06] my-1" />
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-[#B91C1C] dark:text-red-400 dark:text-red-400 hover:bg-[#FEE2E2] dark:bg-red-500/10 dark:hover:bg-red-500/10 hover:text-[#991B1B] dark:hover:text-red-300 transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
              className="lg:hidden p-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/[0.05] transition-all duration-200 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 dark:focus-visible:ring-[#00E5FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              title="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-30 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              id="mobile-nav-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="relative z-40 lg:hidden overflow-hidden glass-clinical border-b border-gray-200 dark:border-white/[0.08] shadow-md"
            >
              <nav aria-label="Mobile navigation" className="flex flex-col gap-0 p-3">
                {NAV_GROUPS.map((group, gi) => (
                  <div key={group.label} className={cn("flex flex-col gap-0.5", gi > 0 && "mt-3")}>
                    <p className="text-[10px] text-[#94A3B8] dark:text-slate-500 uppercase tracking-widest font-semibold px-3 py-1">
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const active = isActiveLink(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6BCB]/50 dark:focus-visible:ring-[#00E5FF]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            active
                              ? "bg-[#0B6BCB]/10 text-[#0B6BCB] dark:text-[#00E5FF] dark:glow-cyan"
                              : "text-[#64748B] dark:text-slate-400 hover:text-[#1A2332] dark:hover:text-white hover:bg-muted dark:hover:bg-white/5"
                          )}
                        >
                          <item.icon className="w-5 h-5 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                ))}
                {/* Mobile sign out */}
                {auth.user && (
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#B91C1C] dark:text-red-400 dark:text-red-400 hover:bg-[#FEE2E2] dark:bg-red-500/10 dark:hover:bg-red-500/10 transition-colors mt-2"
                  >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                )}
                <div className="flex items-center gap-2 px-3 py-2 mt-3 rounded-lg bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30">
                  <div className="w-2 h-2 rounded-full bg-[#B45309] animate-pulse" />
                  <span className="text-xs text-[#B45309] dark:text-amber-400 font-medium">Research Prototype</span>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
