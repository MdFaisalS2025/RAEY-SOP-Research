"use client"

import { createContext, useContext, useState, useEffect } from "react"
import type { UserRole, DemoUser } from "./governance-types"
import { DEMO_USERS, ROLE_CONFIG } from "./mock-data"

interface RoleContextValue {
  currentUser: DemoUser
  role: UserRole
  setRole: (role: UserRole) => void
  roleConfig: typeof ROLE_CONFIG[UserRole]
  hasPermission: (permission: Permission) => boolean
  hierarchyLevel: number
}

export type Permission =
  | "view_sops"
  | "query_ai"
  | "create_proposal"
  | "review_proposal"
  | "vote_committee"
  | "publish_sop"
  | "archive_sop"
  | "view_audit"
  | "manage_users"
  | "manage_sources"
  | "legal_review"
  | "view_compliance"
  | "manage_training"
  | "view_legal"
  | "export_reports"
  | "emergency_override"
  | "manage_committee"
  | "view_all_departments"
  | "configure_system"
  | "acknowledge_sop"
  | "complete_training"
  | "manage_acknowledgments"

// Hierarchy levels: system_admin=8 (highest) down to nurse=1 (lowest)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  system_admin: 8,
  compliance_officer: 7,
  legal_risk: 6,
  committee_member: 5,
  department_admin: 4,
  nurse_educator: 3,
  physician: 2,
  nurse: 1,
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  system_admin: [
    "view_sops", "query_ai", "create_proposal", "review_proposal",
    "vote_committee", "publish_sop", "archive_sop", "view_audit",
    "manage_users", "manage_sources", "legal_review", "view_compliance",
    "manage_training", "view_legal", "export_reports", "emergency_override",
    "manage_committee", "view_all_departments", "configure_system",
    "acknowledge_sop", "complete_training", "manage_acknowledgments",
  ],
  compliance_officer: [
    "view_sops", "query_ai", "create_proposal", "review_proposal",
    "view_audit", "view_compliance", "view_legal", "export_reports",
    "view_all_departments", "manage_acknowledgments",
  ],
  legal_risk: [
    "view_sops", "query_ai", "legal_review", "view_audit",
    "view_legal", "view_compliance", "review_proposal", "export_reports",
  ],
  committee_member: [
    "view_sops", "query_ai", "create_proposal", "review_proposal",
    "vote_committee", "publish_sop", "view_audit", "manage_committee",
    "view_compliance",
  ],
  department_admin: [
    "view_sops", "query_ai", "create_proposal", "review_proposal",
    "view_compliance", "view_audit", "manage_acknowledgments",
    "view_all_departments",
  ],
  nurse_educator: [
    "view_sops", "query_ai", "manage_training", "view_compliance",
    "create_proposal",
  ],
  physician: [
    "view_sops", "query_ai", "create_proposal", "review_proposal",
  ],
  nurse: [
    "view_sops", "query_ai", "acknowledge_sop", "complete_training",
  ],
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("physician")

  useEffect(() => {
    const saved = localStorage.getItem("sop-guard-demo-role") as UserRole | null
    if (saved && DEMO_USERS.find(u => u.role === saved)) {
      setRoleState(saved)
    }
  }, [])

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole)
    localStorage.setItem("sop-guard-demo-role", newRole)
  }

  const currentUser = DEMO_USERS.find(u => u.role === role) ?? DEMO_USERS[0]
  const roleConfig = ROLE_CONFIG[role]
  const hierarchyLevel = ROLE_HIERARCHY[role]

  const hasPermission = (permission: Permission) =>
    ROLE_PERMISSIONS[role].includes(permission)

  return (
    <RoleContext.Provider value={{ currentUser, role, setRole, roleConfig, hasPermission, hierarchyLevel }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used within RoleProvider")
  return ctx
}
