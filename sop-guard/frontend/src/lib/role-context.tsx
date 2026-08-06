"use client"

import { createContext, useContext } from "react"
import type { UserRole, DemoUser } from "./governance-types"
import { DEMO_USERS, ROLE_CONFIG } from "./mock-data"
import { useAuth } from "./auth-context"

interface RoleContextValue {
  currentUser: DemoUser
  role: UserRole
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
  | "manage_quality"

// Hierarchy levels: system_admin=4 (highest) down to clinical_staff=1 (lowest)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  system_admin: 4,
  governance_compliance: 3,
  educator: 2,
  clinical_staff: 1,
}

// governance_compliance's permissions are the union of the four roles it
// absorbed (department_admin, compliance_officer, committee_member,
// legal_risk) - a merged role should not lose capabilities any of its
// constituents had.
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  system_admin: [
    "view_sops", "query_ai", "create_proposal", "review_proposal",
    "vote_committee", "publish_sop", "archive_sop", "view_audit",
    "manage_users", "manage_sources", "legal_review", "view_compliance",
    "manage_training", "view_legal", "export_reports", "emergency_override",
    "manage_committee", "view_all_departments", "configure_system",
    "acknowledge_sop", "complete_training", "manage_acknowledgments",
    "manage_quality",
  ],
  governance_compliance: [
    "view_sops", "query_ai", "create_proposal", "review_proposal",
    "vote_committee", "publish_sop", "view_audit", "manage_committee",
    "view_compliance", "view_legal", "legal_review", "export_reports",
    "view_all_departments", "manage_acknowledgments", "manage_quality",
  ],
  educator: [
    "view_sops", "query_ai", "manage_training", "view_compliance",
    "create_proposal",
  ],
  // review_proposal deliberately excluded: clinical_staff is blocked from
  // /proposals and /committee entirely, but holding this permission let a
  // clinical user who followed their own dashboard's "My Open Proposals"
  // link vote on it anyway at /proposals/[id] - an inconsistency, not an
  // intended capability. create_proposal (raising a concern) stays.
  clinical_staff: [
    "view_sops", "query_ai", "create_proposal",
    "acknowledge_sop", "complete_training",
  ],
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  // role is a pure projection of the authenticated identity - not
  // independent state. There used to be a parallel useState seeded from
  // localStorage["meridian-demo-role"], settable via an exported `setRole`
  // that any component could call with no re-authentication. The protected
  // backend endpoints never trusted that state (they check the JWT), so it
  // granted no real privilege - but it was the same class of gap Phase S
  // existed to eliminate, and removing it outright is cheaper than relying
  // on AppShell's sync effect to coincidentally correct it every render.
  // "Switching role" is now only possible by actually logging in as a
  // different demo user (RoleSwitcher -> loginAsDemo), which updates
  // auth.user and therefore this derived value automatically.
  const auth = useAuth()
  const role: UserRole = auth.user?.role ?? "clinical_staff"

  const currentUser: DemoUser = auth.user ?? DEMO_USERS[0]
  const roleConfig = ROLE_CONFIG[role]
  const hierarchyLevel = ROLE_HIERARCHY[role]

  const hasPermission = (permission: Permission) =>
    ROLE_PERMISSIONS[role].includes(permission)

  return (
    <RoleContext.Provider value={{ currentUser, role, roleConfig, hasPermission, hierarchyLevel }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used within RoleProvider")
  return ctx
}
