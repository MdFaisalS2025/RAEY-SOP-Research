"use client"

import { createContext, useContext, useState, useEffect } from "react"
import type { DemoUser, UserRole } from "./governance-types"
import { DEMO_USERS } from "./mock-data"

interface AuthContextValue {
  user: DemoUser | null
  isAuthenticated: boolean
  loading: boolean
  login: (staffId: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginAsDemo: (staffId: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Documented demo password (see backend/app/demo_data/demo_staff_users.py) -
// used only by the login page's quick-access cards, which submit it through
// the real /api/auth/login endpoint rather than bypassing auth.
const DEMO_PASSWORD = "demo1234"

interface MeResponse {
  staff_id: string
  name: string
  role: string
  department: string
  title: string
}

function toDemoUser(me: MeResponse): DemoUser {
  // The 4 seeded staff_ids (u1-u4) match DEMO_USERS 1:1 - reuse its
  // initials there so the avatar keeps rendering "SM"/"MC"/etc. rather
  // than a computed fallback. A staff_id outside that set (a future
  // real account) still works, just with computed initials.
  const known = DEMO_USERS.find((u) => u.id === me.staff_id)
  const initials =
    known?.initials ??
    me.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")

  return {
    id: me.staff_id,
    name: me.name,
    role: me.role as UserRole,
    department: me.department,
    title: me.title,
    initials,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate identity from the httpOnly session cookie on mount - there is
  // no client-readable session state to check first, so this always makes
  // one request.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/auth/me")
        if (res.ok) {
          const me: MeResponse = await res.json()
          if (!cancelled) setUser(toDemoUser(me))
        }
      } catch {
        // Backend unreachable - treat as signed out rather than blocking the app.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (staffId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId, password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        return { success: false, error: body?.detail ?? "Invalid credentials" }
      }
      const me: MeResponse = await res.json()
      setUser(toDemoUser(me))
      return { success: true }
    } catch {
      return { success: false, error: "Could not reach the server. Please try again." }
    }
  }

  const loginAsDemo = (staffId: string) => login(staffId, DEMO_PASSWORD)

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // Best-effort - clear local state regardless so the UI reflects signed-out.
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        loading,
        login,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
