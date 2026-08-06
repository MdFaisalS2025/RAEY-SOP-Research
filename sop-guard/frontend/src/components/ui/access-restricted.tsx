import { Lock } from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { Card } from "@/components/ui/card"

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
        <Card padding="none" className="mt-16 flex flex-col items-center justify-center text-center space-y-4 p-12">
          <div className="w-16 h-16 rounded-2xl bg-danger-soft flex items-center justify-center">
            <Lock className="w-8 h-8 text-danger-soft-fg" />
          </div>
          <h2 className="text-xl font-bold">Access Restricted</h2>
          <p className="text-muted-foreground">{requirement}</p>
          <p className="text-sm text-muted-foreground/70">Contact your system administrator for access.</p>
        </Card>
      </div>
    </AppShell>
  )
}
