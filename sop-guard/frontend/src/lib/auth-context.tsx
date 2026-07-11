"use client"

import { createContext, useContext, useState, useEffect } from "react"
import type { DemoUser } from "./governance-types"
import { DEMO_USERS } from "./mock-data"

interface AuthContextValue {
  user: DemoUser | null
  isAuthenticated: boolean
  loading: boolean
  login: (userId: string, password: string) => { success: boolean; error?: string }
  loginAsDemo: (userId: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const AUTH_STORAGE_KEY = "meridian-auth-user"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Rehydrate from localStorage on mount
  useEffect(() => {
    try {
      const storedId = localStorage.getItem(AUTH_STORAGE_KEY)
      if (storedId) {
        const found = DEMO_USERS.find((u) => u.id === storedId)
        if (found) {
          setUser(found)
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const login = (userId: string, password: string): { success: boolean; error?: string } => {
    const found = DEMO_USERS.find((u) => u.id === userId)
    if (!found) {
      return { success: false, error: "Invalid credentials" }
    }
    const deptPassword = found.department.toLowerCase().replace(/\s+/g, "")
    if (password !== "demo1234" && password !== deptPassword) {
      return { success: false, error: "Invalid credentials" }
    }
    setUser(found)
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, found.id)
    } catch {
      // ignore
    }
    return { success: true }
  }

  const loginAsDemo = (userId: string) => {
    const found = DEMO_USERS.find((u) => u.id === userId)
    if (found) {
      setUser(found)
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, found.id)
      } catch {
        // ignore
      }
    }
  }

  const logout = () => {
    setUser(null)
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      // ignore
    }
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
