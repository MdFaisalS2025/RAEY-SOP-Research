"use client"

import Link from "next/link"
import { Shield } from "lucide-react"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { ProfileMenu } from "@/components/layout/profile-menu"

// The slim chrome AppShell swaps in for `chrome="minimal"` pages (today,
// only /query - see the "focus mode" plan). Replaces the full TopNav (nav
// groups, search, notifications, status dot, role switcher) with just an
// escape hatch back to the app and the two controls every page needs
// regardless of chrome: theme and account. Page-owned controls (New chat,
// Conversations, History on /query) are passed in via `actions` rather
// than living here, so this component stays chat-agnostic.
export function FocusBar({ actions }: { actions?: React.ReactNode }) {
  return (
    // Same z-[55] + isolate as TopNav, for the same reason (topnav.tsx):
    // must outrank the /query source-detail drawer's fixed inset-0 z-50
    // backdrop, and isolate keeps this bar's own z-30 popovers (rendered
    // via `actions`) inside its own stacking context.
    <header className="sticky top-0 z-[55] bg-background isolate">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      <div className="glass-clinical border-b border-gray-200 dark:border-white/[0.08] shadow-sm dark:shadow-black/20">
        <div className="flex items-center gap-2 px-4 lg:px-6 h-[52px]">
          {/* Brand mark - the escape hatch back to the full app. */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 dark:glow-accent transition-all duration-200 group-hover:scale-105">
              <Shield className="w-[18px] h-[18px] text-primary" />
            </div>
            <span className="hidden sm:inline text-sm font-bold text-[#1A2332] dark:text-white tracking-tight">Meridian</span>
          </Link>

          <div className="flex items-center gap-1 ml-auto">
            {actions}
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
