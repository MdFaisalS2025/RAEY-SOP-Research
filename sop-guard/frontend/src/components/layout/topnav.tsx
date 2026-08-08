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
  ShieldCheck,
  Settings,
  Shield,
  Search,
  Menu,
  X,
  AlertTriangle,
  Bell,
  FlaskConical,
  Users,
  BookMarked,
  ClipboardList,
  GraduationCap,
  Activity,
  LogOut,
  ChevronDown,
  Check,
  Landmark,
  AlertOctagon,
  Wrench,
  Info,
  UploadCloud,
  Stethoscope,
  PlayCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { RoleSwitcher } from "@/components/layout/role-switcher"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { ProfileMenu } from "@/components/layout/profile-menu"
import { useAuth } from "@/lib/auth-context"
import { useRole } from "@/lib/role-context"
import { useRouter } from "next/navigation"
import type { UserRole, NotificationItem } from "@/lib/governance-types"

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  // Roles that should see this item. Omitted = visible to every role (used
  // for baseline items like Training/Settings that every role needs).
  roles?: UserRole[]
}

type NavGroup = {
  label: string
  items: NavItem[]
}

// Direct links always visible on desktop. Ask Meridian leads (it's the
// primary clinical workflow this whole product exists for) and gets a
// persistent filled treatment below, not just an active-state highlight -
// Dashboard stays a normal nav item.
const DIRECT_LINKS: NavItem[] = [
  { href: "/query", label: "Ask Meridian", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
]

// Reorganized from 5 heavy enterprise-sounding groups down to 3 - every
// route below already existed and stays role-gated exactly as before;
// this only changes how they're grouped/labeled, nothing is removed or
// made unreachable. Quality folded into Governance (both were
// compliance-adjacent oversight tooling for the same governance_compliance
// audience, and Quality alone only ever held 3 items - not enough to earn
// its own dropdown). Bedside Lookup and Scenario Training, previously
// reachable only via Ctrl+K, are promoted into Protocols since they're
// real clinical/educator workflows, not demos - a first-time user
// shouldn't need to know the command palette exists to find them.
// Nav/IA reduction pass: 6 items demoted out of the persistent dropdowns
// down to command-palette-only (Ctrl+K already lists every route in this
// app regardless of nav placement - see command-palette.tsx's PAGES array -
// so nothing here becomes unreachable, only less persistently visible).
// This is the same treatment Bedside Lookup and Scenario Training had
// *before* being promoted into Protocols (see that comment above) - low
// risk and reversible, unlike restructuring the pages themselves. Criteria
// used: infrequent oversight/analytics tools (checked occasionally, not
// used daily), explicitly-labeled demo pages, and pages already carrying a
// known-partial-fabrication disclosure (H6) that don't need equal top-level
// billing with fully-real pages until that's resolved. Demoted:
// EMR Integration Demo (literally a demo, the clearest case - the same
// "real workflow, not a demo" bar that got Bedside/Scenarios promoted cuts
// the other way here), AI Evaluation, Clinician Evaluation, Usage &
// Feedback (all system_admin/governance oversight tools, not daily-use),
// Legal & Risk (H6-flagged partial mock content), Alert Stewardship (a
// narrow, low-frequency governance_compliance tool). Regulatory &
// Effectiveness were considered and kept - both are genuine recurring
// compliance/monitoring workflows, not oversight-occasionally tools.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Protocols",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/query", label: "Ask Meridian", icon: MessageSquare },
      { href: "/library", label: "SOP Library", icon: BookOpen },
      { href: "/quick-ref", label: "Quick Reference", icon: BookMarked },
      { href: "/bedside", label: "Bedside Lookup", icon: Stethoscope, roles: ["clinical_staff", "system_admin"] },
      { href: "/evidence-watch", label: "Evidence Watch", icon: FlaskConical, roles: ["governance_compliance", "system_admin"] },
      { href: "/training", label: "Training", icon: GraduationCap },
      { href: "/scenarios", label: "Scenario Training", icon: PlayCircle, roles: ["educator", "clinical_staff", "system_admin"] },
    ],
  },
  {
    label: "Governance & Quality",
    items: [
      { href: "/proposals", label: "Proposals", icon: GitBranch, roles: ["governance_compliance", "system_admin"] },
      { href: "/committee", label: "Committee", icon: Users, roles: ["governance_compliance", "system_admin"] },
      { href: "/conflict-resolution", label: "Conflicts & Impact", icon: AlertTriangle, roles: ["governance_compliance", "system_admin"] },
      { href: "/compliance", label: "Compliance", icon: ShieldCheck, roles: ["educator", "governance_compliance", "system_admin"] },
      { href: "/audit", label: "Audit", icon: ClipboardList, roles: ["governance_compliance", "system_admin"] },
      { href: "/regulatory", label: "Regulatory & Accreditation", icon: Landmark, roles: ["governance_compliance", "system_admin"] },
      // Leadership is reachable via the "Leadership Overview" shortcut on the
      // Dashboard for governance/admin roles rather than a separate nav item
      // - it duplicated the Dashboard's own metrics.
      { href: "/effectiveness", label: "Effectiveness", icon: Activity, roles: ["clinical_staff", "governance_compliance", "system_admin"] },
      { href: "/incidents", label: "Deviations & Incidents", icon: AlertOctagon, roles: ["clinical_staff", "governance_compliance", "system_admin"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/upload", label: "Upload SOP", icon: UploadCloud, roles: ["system_admin"] },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/admin", label: "Admin", icon: Wrench, roles: ["system_admin"] },
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
const SESSION_INTERRUPTIVE_COUNT_KEY = "meridian-session-interruptive-count"
const SESSION_SEEN_INTERRUPTIVE_KEY = "meridian-session-seen-interruptive-ids"

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

// Nav items are trimmed per role so each role sees only what's relevant to
// its job (an item with no `roles` is visible to everyone). Desktop dropdown
// groups additionally exclude the always-visible direct links.
function groupsForRole(role: UserRole): NavGroup[] {
  return NAV_GROUPS
    .map((g) => ({
      label: g.label,
      items: g.items.filter((i) => !i.roles || i.roles.includes(role)),
    }))
    .filter((g) => g.items.length > 0)
}

function desktopGroupsForRole(role: UserRole): NavGroup[] {
  return groupsForRole(role)
    .map((g) => ({
      label: g.label,
      items: g.items.filter((i) => !DIRECT_HREFS.includes(i.href)),
    }))
    .filter((g) => g.items.length > 0)
}

export function TopNav() {
  const pathname = usePathname()
  const auth = useAuth()
  const { role, roleConfig, hierarchyLevel } = useRole()
  const desktopGroups = desktopGroupsForRole(role)
  const mobileGroups = groupsForRole(role)
  const router = useRouter()
  const [backendUp, setBackendUp] = useState<boolean | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<LiveNotificationItem[]>([])
  const [notifLive, setNotifLive] = useState(false)
  const [interruptiveCountToday, setInterruptiveCountToday] = useState<number | null>(null)
  const [sessionInterruptiveCount, setSessionInterruptiveCount] = useState(0)
  const [showLegend, setShowLegend] = useState(false)
  const groupNavRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

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
    setMobileOpen(false)
    setNotifOpen(false)
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

  // Sign-out for the mobile nav menu, which renders its own row outside
  // ProfileMenu's dropdown. Desktop sign-out lives inside ProfileMenu now.
  const handleSignOut = async () => {
    await auth.logout()
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
    urgent: "text-danger-soft-fg",
    high: "text-warn-soft-fg",
    normal: "text-[#334155] dark:text-slate-300",
    low: "text-[#64748B] dark:text-slate-400",
  }

  return (
    // z-[55]: must outrank transient overlay backdrops (e.g. the source-detail
    // drawer's fixed inset-0 z-50 on /query) so the header stays clickable -
    // a click on Home while a drawer is open should navigate immediately,
    // not get swallowed by the backdrop dismissing the drawer first.
    <header className="sticky top-0 z-[55] flex flex-col bg-background isolate">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Main nav bar */}
      <div className="glass-clinical border-b border-gray-200 dark:border-white/[0.08] shadow-sm dark:shadow-black/20">
        <div className="flex items-center gap-2 px-4 lg:px-6 h-14 lg:h-16">
          {/* Logo + brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 dark:glow-accent transition-all duration-200 group-hover:scale-105">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-base font-bold text-[#1A2332] dark:text-white tracking-tight">Meridian</span>
              <span className="text-9 text-primary/70 font-medium tracking-widest uppercase">
                Clinical Command
              </span>
            </div>
          </Link>

          {/* Desktop nav: direct links + group dropdowns */}
          <nav aria-label="Main navigation" className="hidden lg:block ml-4">
            <div ref={groupNavRef} className="flex items-center gap-0.5">
              {DIRECT_LINKS.map((item) => {
                const active = isActiveLink(item.href)
                const isPrimary = item.href === "/query"
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-13 font-medium whitespace-nowrap transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isPrimary
                        ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                        : active
                        ? "bg-primary/10 text-primary dark:glow-accent"
                        : "text-[#64748B] dark:text-slate-400 hover:text-foreground dark:hover:text-white hover:bg-muted dark:hover:bg-white/5"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="hidden xl:inline">{item.label}</span>
                    {active && !isPrimary && (
                      <div className="absolute left-2 right-2 -bottom-[1px] h-[2px] rounded-full bg-primary" />
                    )}
                  </Link>
                )
              })}

              <div className="w-px h-5 bg-[#E2E8F0] dark:bg-white/10 mx-1.5 shrink-0" />

              {desktopGroups.map((group) => {
                const groupActive = group.items.some((item) => isActiveLink(item.href))
                const isOpen = openGroup === group.label

                // A group can drop to a single visible item once its
                // siblings are filtered out by role (e.g. educator sees
                // only "Compliance" under Governance & Quality, only
                // "Settings" under Admin) - a dropdown holding one entry
                // is a wasted click, so render it as a direct link instead.
                if (group.items.length === 1) {
                  const item = group.items[0]
                  const active = isActiveLink(item.href)
                  return (
                    <Link
                      key={group.label}
                      href={item.href}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-13 font-medium whitespace-nowrap transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        active
                          ? "bg-primary/10 text-primary dark:glow-accent"
                          : "text-[#64748B] dark:text-slate-400 hover:text-foreground dark:hover:text-white hover:bg-muted dark:hover:bg-white/5"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="hidden xl:inline">{item.label}</span>
                      {active && (
                        <div className="absolute left-2 right-2 -bottom-[1px] h-[2px] rounded-full bg-primary" />
                      )}
                    </Link>
                  )
                }

                return (
                  <div key={group.label} className="relative">
                    <button
                      onClick={() => setOpenGroup(isOpen ? null : group.label)}
                      aria-expanded={isOpen}
                      aria-haspopup="menu"
                      className={cn(
                        "relative flex items-center gap-1 px-2.5 py-2 rounded-lg text-13 font-medium whitespace-nowrap transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        groupActive || isOpen
                          ? "text-primary"
                          : "text-[#64748B] dark:text-slate-400 hover:text-foreground dark:hover:text-white hover:bg-muted dark:hover:bg-white/5"
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
                        <div className="absolute left-2 right-2 -bottom-[1px] h-[2px] rounded-full bg-primary" />
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
                                "flex items-center gap-2.5 px-3 py-2 text-12 font-medium transition-colors",
                                active
                                  ? "text-primary dark:text-teal-400 bg-primary/5 dark:bg-transparent"
                                  : "text-[#334155] dark:text-slate-300 hover:bg-muted dark:hover:bg-white/[0.05] hover:text-foreground dark:hover:text-white"
                              )}
                            >
                              <item.icon
                                className={cn(
                                  "w-4 h-4 shrink-0",
                                  active ? "text-primary dark:text-teal-400" : "text-[#94A3B8] dark:text-slate-500"
                                )}
                              />
                              <span>{item.label}</span>
                              {active && <Check className="w-3.5 h-3.5 text-primary dark:text-teal-400 ml-auto" />}
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
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-white/10 bg-card dark:bg-[#11191b] text-[#64748B] dark:text-slate-400 hover:text-foreground dark:hover:text-white hover:border-input transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Search className="w-4 h-4" />
              <span className="text-12 font-medium">Search</span>
              <kbd className="text-10 font-medium text-subtle border border-[#E2E8F0] dark:border-white/10 rounded px-1 py-0.5 leading-none">
                Ctrl K
              </kbd>
            </button>

            {/* Notification bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                aria-label={`Notifications - ${unreadCount} unread`}
                className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/[0.05] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 dark:focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-9 font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {/* Notification dropdown */}
              {notifOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-[340px] bg-card dark:bg-[#0d1516] border border-[#E2E8F0] dark:border-white/[0.08] rounded-xl shadow-md dark:shadow-2xl dark:shadow-black/50 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-[#EDF1F5] dark:border-white/[0.06] flex items-center justify-between">
                    <span className="text-12 font-semibold text-[#1A2332] dark:text-white/80">Notifications</span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <span className="text-10 text-primary dark:text-teal-400">{unreadCount} unread</span>
                      )}
                      <div className="relative">
                        <button
                          type="button"
                          onMouseEnter={() => setShowLegend(true)}
                          onMouseLeave={() => setShowLegend(false)}
                          onFocus={() => setShowLegend(true)}
                          onBlur={() => setShowLegend(false)}
                          aria-label="Alert color legend"
                          className="text-subtle hover:text-muted-foreground dark:hover:text-white/70 transition-colors"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        {showLegend && (
                          <div className="absolute right-0 top-full mt-1.5 z-50 w-[220px] p-2.5 rounded-lg bg-[#1A2332] text-white text-10 leading-relaxed shadow-md space-y-1.5">
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
                      <p className="px-3 py-6 text-center text-xs text-muted-foreground">No notifications yet.</p>
                    )}
                    {tieredNotifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.link ?? "#"}
                        onClick={() => setNotifOpen(false)}
                        className={cn(
                          "flex flex-col gap-0.5 px-3 py-2.5 border-b border-l-2 border-[#EDF1F5] dark:border-white/[0.04] hover:bg-muted dark:hover:bg-white/[0.04] transition-colors",
                          !n.read && "bg-primary/[0.03] dark:bg-white/[0.02]",
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
                              "text-12",
                              n.effectiveTier === "interruptive" || n.effectiveTier === "banner" ? "font-bold" : "font-semibold",
                              !n.read ? "text-[#1A2332] dark:text-white" : "text-[#64748B] dark:text-white/60",
                              priorityColors[n.priority]
                            )}
                          >
                            {n.title}
                          </span>
                          {n.effectiveTier === "interruptive" && (
                            <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-9 font-semibold bg-danger-soft text-danger-soft-fg border border-danger-soft-border">
                              Action needed
                            </span>
                          )}
                        </div>
                        <p className="text-11 text-[#64748B] dark:text-slate-500 line-clamp-2 ml-3.5">{n.description}</p>
                      </Link>
                    ))}
                  </div>
                  {budgetExceeded && (
                    <div className="px-3 py-2 border-t border-[#EDF1F5] dark:border-white/[0.06] bg-muted dark:bg-white/[0.03]">
                      <p className="text-10 text-muted-foreground leading-snug">
                        Alert volume reduced for this session to reduce interruption fatigue.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Role Switcher */}
            <RoleSwitcher />

            {/* Theme toggle + profile menu - extracted (O2.3) so FocusBar
                (the slim /query chrome) can reuse the exact same
                theme-persistence and avatar/sign-out logic. */}
            <ThemeToggle />
            <ProfileMenu />

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
              className="lg:hidden p-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/[0.05] transition-all duration-200 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 dark:focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
                {mobileGroups.map((group, gi) => (
                  <div key={group.label} className={cn("flex flex-col gap-0.5", gi > 0 && "mt-3")}>
                    <p className="text-10 text-[#94A3B8] dark:text-slate-500 uppercase tracking-widest font-semibold px-3 py-1">
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
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            active
                              ? "bg-primary/10 text-primary dark:glow-accent"
                              : "text-[#64748B] dark:text-slate-400 hover:text-foreground dark:hover:text-white hover:bg-muted dark:hover:bg-white/5"
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
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-danger-soft-fg hover:bg-danger-soft transition-colors mt-2"
                  >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
