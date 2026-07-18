import { Lock } from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"

/**
 * Same "Access Restricted" gate /admin already used, extracted so every
 * page whose nav entry is role-restricted (see topnav.tsx's NAV_GROUPS
 * `roles` field) actually enforces that restriction if reached directly by
 * URL - previously only /admin did this; /evidence-watch, /proposals,
 * /committee, and /conflict-resolution rendered full content for any role
 * despite being nav-gated to governance_compliance/system_admin.
 */
export function AccessRestricted({
  label,
  requirement,
}: {
  label: string
  requirement: string
}) {
  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto">
        <Breadcrumb items={[{ label }]} />
        <div className="mt-16 flex flex-col items-center justify-center text-center space-y-4 rounded-2xl bg-card border border-border p-12">
          <div className="w-16 h-16 rounded-2xl bg-[#FEE2E2] dark:bg-red-500/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-[#B91C1C] dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold font-display">Access Restricted</h2>
          <p className="text-muted-foreground">{requirement}</p>
          <p className="text-sm text-muted-foreground/70">Contact your system administrator for access.</p>
        </div>
      </div>
    </AppShell>
  )
}
