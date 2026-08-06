"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Settings, Database, Activity,
  Users, Globe, ToggleLeft, ToggleRight, Plus,
  Server, Brain, HardDrive, Eye, ShieldCheck, Bell, Mail, Smartphone, Loader2
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SafetyNote } from "@/components/ui/safety-note"
import { AccessRestricted } from "@/components/ui/access-restricted"
import { cn } from "@/lib/utils"
import { toneChip } from "@/components/ui/tone"
import { DEMO_USERS } from "@/lib/mock-data"
import { useRole } from "@/lib/role-context"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { Card } from "@/components/ui/card"

const ROLE_LABELS: Record<string, string> = {
  clinical_staff: "Clinical Staff",
  educator: "Educator / Trainer",
  governance_compliance: "Governance & Compliance",
  system_admin: "System Admin",
}

interface EvidenceSource {
  key: string
  name: string
  status: "active" | "not_configured" | "requires_api_key" | "mock"
  enabled: boolean
}

const SOURCE_LABELS: Record<string, string> = {
  pubmed: "PubMed", europepmc: "Europe PMC", cdc: "CDC", who: "WHO Guidelines",
  clinicaltrials: "ClinicalTrials.gov", fda: "FDA", medlineplus: "MedlinePlus", cms: "CMS",
}

// Non-auth integrations (Authentication card is replaced with SSO section below)
const otherIntegrations = [
  { name: "EHR/EMR", subtitle: "Epic / Cerner", description: "Connect to hospital electronic health record system for patient context and SOP linking.", icon: Database },
  { name: "LMS", subtitle: "HealthStream / Relias", description: "Connect to learning management system for automated training enrollment and tracking.", icon: Users },
  { name: "SharePoint", subtitle: "Policy Repository", description: "Connect to SharePoint for existing policy document import and version synchronization.", icon: Globe },
]

interface StatusItem { name: string; detail: string; status: "online" | "offline" | "demo" | "checking"; icon: typeof Server }

type SSOProtocol = "saml" | "oauth" | "ldap"

export default function AdminPage() {
  const { role } = useRole()
  const [sources, setSources] = useState<EvidenceSource[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sourcesError, setSourcesError] = useState(false)
  const [ssoProtocol, setSSOProtocol] = useState<SSOProtocol>("saml")
  const [systemStatus, setSystemStatus] = useState<StatusItem[]>([
    { name: "Backend API", detail: "Checking…", status: "checking", icon: Server },
    { name: "LLM Provider", detail: "Checking…", status: "checking", icon: Brain },
    { name: "Embedding Model", detail: "Checking…", status: "checking", icon: Activity },
    { name: "Database", detail: "SQLite (dev) — implied healthy if the above respond", status: "demo", icon: HardDrive },
    { name: "Evidence Sources", detail: "Checking…", status: "checking", icon: Eye },
  ])

  // Real probes replacing the previous hardcoded "online" for every row -
  // this card used to claim every service was healthy without ever
  // checking. Each of these endpoints already exists and is used elsewhere
  // (Settings page) to report genuine status.
  useEffect(() => {
    fetch("/api/health").then((r) => r.ok ? r.json() : Promise.reject())
      .then(() => setSystemStatus((prev) => prev.map((s) => s.name === "Backend API" ? { ...s, detail: "FastAPI (Python) — responding", status: "online" } : s)))
      .catch(() => setSystemStatus((prev) => prev.map((s) => s.name === "Backend API" ? { ...s, detail: "Not responding", status: "offline" } : s)))

    fetch("/api/llm/status").then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setSystemStatus((prev) => prev.map((s) => s.name === "LLM Provider" ? {
        ...s,
        detail: d.mode === "llm" ? `${d.provider} / ${d.model} — reachable` : `${d.provider} — not reachable, answers use extractive template mode`,
        status: d.mode === "llm" ? "online" : "demo",
      } : s)))
      .catch(() => setSystemStatus((prev) => prev.map((s) => s.name === "LLM Provider" ? { ...s, detail: "Status check failed", status: "offline" } : s)))

    fetch("/api/embedding/status").then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setSystemStatus((prev) => prev.map((s) => s.name === "Embedding Model" ? {
        ...s,
        detail: d.mode === "semantic" ? `${d.backend} — semantic search active` : `${d.backend} — TF-IDF fallback (no semantic embeddings)`,
        status: d.mode === "semantic" ? "online" : "demo",
      } : s)))
      .catch(() => setSystemStatus((prev) => prev.map((s) => s.name === "Embedding Model" ? { ...s, detail: "Status check failed", status: "offline" } : s)))

    fetch("/api/evidence/providers").then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => {
        const providers = Array.isArray(d?.providers) ? d.providers : []
        const active = providers.filter((p: { status: string }) => p.status === "active").length
        setSystemStatus((prev) => prev.map((s) => s.name === "Evidence Sources" ? { ...s, detail: `${active} of ${providers.length} sources active`, status: active > 0 ? "online" : "offline" } : s))
      })
      .catch(() => setSystemStatus((prev) => prev.map((s) => s.name === "Evidence Sources" ? { ...s, detail: "Status check failed", status: "offline" } : s)))
  }, [])

  // Real evidence-source list + enabled state from /api/settings and
  // /api/evidence/providers (same endpoints the Settings page uses) - was
  // previously a hardcoded array with invented "trust scores" and a toggle
  // that only flipped local state.
  const loadSources = () => {
    setSourcesLoading(true)
    setSourcesError(false)
    Promise.all([
      fetch("/api/settings").then((r) => { if (!r.ok) throw new Error(); return r.json() }),
      fetch("/api/evidence/providers").then((r) => { if (!r.ok) throw new Error(); return r.json() }),
    ]).then(([settingsData, providersData]) => {
      const enabled = new Set<string>(settingsData?.enabled_evidence_sources ?? [])
      const statusByKey = new Map<string, string>((providersData?.providers ?? []).map((p: { key: string; status: string }) => [p.key, p.status]))
      const allSources: string[] = settingsData?.all_evidence_sources ?? []
      setSources(allSources.map((key) => ({
        key,
        name: SOURCE_LABELS[key] ?? key,
        status: (statusByKey.get(key) as EvidenceSource["status"]) ?? "not_configured",
        enabled: enabled.has(key),
      })))
    }).catch(() => setSourcesError(true)).finally(() => setSourcesLoading(false))
  }
  useEffect(loadSources, [])

  if (role !== "system_admin") {
    return <AccessRestricted label="Admin" requirement="This area requires System Administrator access." />
  }

  const toggleSource = async (key: string) => {
    const next = sources.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    setSources(next)
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled_evidence_sources: next.filter((s) => s.enabled).map((s) => s.key) }),
      })
    } catch {
      setSources(sources) // revert on failure
    }
  }

  const statusMeta: Record<EvidenceSource["status"], { label: string; className: string }> = {
    active: { label: "Live source", className: toneChip.success },
    mock: { label: "Mock", className: toneChip.warning },
    requires_api_key: { label: "Requires API key", className: toneChip.warning },
    not_configured: { label: "Not configured", className: "bg-card text-muted-foreground border-input" },
  }

  const inputCls = "w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-border text-sm text-muted-foreground placeholder:text-muted-foreground/50 opacity-50 cursor-not-allowed"

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: "Admin" }]} />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">System Administration</h1>
            <p className="text-sm text-muted-foreground">Platform configuration and integration management</p>
          </div>
        </div>

        <SafetyNote />

        {/* External Evidence Sources */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">External Evidence Sources</h2>
            <div className="relative group">
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
              >
                <Plus className="w-3.5 h-3.5" /> Add Source
              </button>
              <div className="absolute right-0 top-full mt-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Coming in v2
              </div>
            </div>
          </div>
          {sourcesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading evidence sources...
            </div>
          ) : sourcesError ? (
            <ErrorState message="Couldn't load evidence source status." onRetry={loadSources} />
          ) : sources.length === 0 ? (
            <EmptyState title="No evidence sources configured." />
          ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Backend Status</th>
                  <th className="p-4 text-left">Queried by Ask Meridian</th>
                  <th className="p-4 text-left">Toggle</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source, i) => {
                  const meta = statusMeta[source.status]
                  return (
                  <motion.tr
                    key={source.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border hover:bg-[#F8FAFC] transition-colors"
                  >
                    <td className="p-4 font-medium">{source.name}</td>
                    <td className="p-4">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", meta.className)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        source.enabled
                          ? toneChip.success
                          : "bg-card text-muted-foreground border border-input"
                      )}>
                        {source.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleSource(source.key)}
                        title="Also changes the Evidence Sources toggle on the Settings page - both read the same backend state"
                        className="flex items-center gap-1.5 text-xs transition-colors"
                      >
                        {source.enabled
                          ? <ToggleRight className="w-6 h-6 text-primary" />
                          : <ToggleLeft className="w-6 h-6 text-subtle" />}
                      </button>
                    </td>
                  </motion.tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </Card>
          )}
        </section>

        {/* SSO / Active Directory Configuration */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">SSO / Active Directory Configuration</h2>
          </div>

          <Card className="space-y-5">
            {/* Protocol selector */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 font-medium">Protocol</p>
              <div className="flex gap-2">
                {(["saml", "oauth", "ldap"] as SSOProtocol[]).map((p) => (
                  <button
                    key={p}
                    disabled
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-not-allowed opacity-50",
                      ssoProtocol === p
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "border-border text-muted-foreground bg-[#F8FAFC]"
                    )}
                    onClick={() => setSSOProtocol(p)}
                  >
                    {p === "saml" ? "SAML 2.0" : p === "oauth" ? "OAuth 2.0" : "LDAP"}
                  </button>
                ))}
              </div>
            </div>

            {/* SAML Configuration fields */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">SAML Configuration</p>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <label htmlFor="sso-saml-idp-url" className="text-xs text-muted-foreground">Identity Provider URL</label>
                  <input
                    id="sso-saml-idp-url"
                    disabled
                    placeholder="https://your-hospital-idp.example.com/saml2"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sso-saml-entity-id" className="text-xs text-muted-foreground">Entity ID</label>
                  <input
                    id="sso-saml-entity-id"
                    disabled
                    placeholder="meridian-production"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sso-saml-cert" className="text-xs text-muted-foreground">X.509 Certificate</label>
                  <textarea
                    id="sso-saml-cert"
                    disabled
                    rows={3}
                    placeholder="Paste certificate here..."
                    className={cn(inputCls, "resize-none")}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sso-saml-attr-mapping" className="text-xs text-muted-foreground">Attribute Mapping</label>
                  <input
                    id="sso-saml-attr-mapping"
                    disabled
                    placeholder="email=[email], name=[displayName], role=[department]"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* LDAP Configuration fields */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">LDAP Configuration</p>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <label htmlFor="sso-ldap-server-url" className="text-xs text-muted-foreground">Server URL</label>
                  <input
                    id="sso-ldap-server-url"
                    disabled
                    placeholder="ldap://ad.hospital.internal:389"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sso-ldap-base-dn" className="text-xs text-muted-foreground">Base DN</label>
                  <input
                    id="sso-ldap-base-dn"
                    disabled
                    placeholder="dc=hospital,dc=internal"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sso-ldap-bind-dn" className="text-xs text-muted-foreground">Bind DN</label>
                  <input
                    id="sso-ldap-bind-dn"
                    disabled
                    placeholder="cn=sopguard-service,ou=services,dc=hospital,dc=internal"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sso-ldap-bind-password" className="text-xs text-muted-foreground">Bind Password</label>
                  <input
                    id="sso-ldap-bind-password"
                    disabled
                    type="password"
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="sso-ldap-search-filter" className="text-xs text-muted-foreground">User Search Filter</label>
                  <input
                    id="sso-ldap-search-filter"
                    disabled
                    placeholder="(sAMAccountName={'{username}'})"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Status + buttons */}
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#94A3B8]" />
                <span className="text-xs text-muted-foreground font-medium">Status: Not Configured</span>
              </div>
              <div className="flex gap-2">
                <button
                  disabled
                  className="px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
                >
                  Test Connection
                </button>
                <button
                  disabled
                  className="px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
                >
                  Save Configuration
                </button>
              </div>
            </div>

            {/* Note */}
            <p className="text-xs text-muted-foreground/70 italic border-t border-border pt-3">
              SSO configuration requires IT department coordination. Contact your CMIO or IT Director to provision service account credentials. Supports: Microsoft Azure AD, Okta, Ping Identity, and on-premise Active Directory.
            </p>
          </Card>
        </section>

        {/* Other Integration Placeholders */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Integration Placeholders</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherIntegrations.map((integration, i) => (
              <motion.div
                key={integration.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl bg-card border border-border p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                      <integration.icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">{integration.subtitle}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs bg-card text-muted-foreground border border-input shrink-0">
                    Not Configured
                  </span>
                </div>
                <p className="text-xs text-muted-foreground/80">{integration.description}</p>
                <button
                  disabled
                  className="px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
                >
                  Connect
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Notification & Alert Configuration */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Notification &amp; Alert Configuration</h2>
          </div>

          <Card className="space-y-4">
            <p className="text-sm font-medium text-muted-foreground">Alert Recipients Configuration</p>

            {/* Escalation recipient table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="p-3 text-left">Trigger</th>
                    <th className="p-3 text-left">Recipients</th>
                    <th className="p-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { trigger: "90-day SOP expiry", recipients: "SOP Owner", note: "Auto (cannot change)" },
                    { trigger: "60-day SOP expiry", recipients: "SOP Owner + Department Head", note: null },
                    { trigger: "30-day SOP expiry", recipients: "Compliance Officer", note: null },
                    { trigger: "7-day SOP expiry", recipients: "CMO / System Admin", note: null },
                  ].map((row) => (
                    <tr key={row.trigger} className="border-b border-border">
                      <td className="p-3 text-xs font-medium">{row.trigger}</td>
                      <td className="p-3 text-xs text-muted-foreground">{row.recipients}</td>
                      <td className="p-3">
                        {row.note ? (
                          <span className="text-xs text-muted-foreground/60 italic">{row.note}</span>
                        ) : (
                          <button
                            disabled
                            className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50"
                          >
                            Add recipient
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Channel status */}
            <div className="space-y-2 pt-1">
              {[
                { icon: Mail, label: "Email Integration", status: "Not connected (connect via SMTP or SendGrid)" },
                { icon: Bell, label: "Push Notifications", status: "Not connected (connect via FCM or hospital notification system)" },
                { icon: Smartphone, label: "SMS Alerts", status: "Not connected" },
              ].map((ch) => (
                <div key={ch.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <ch.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-foreground w-40 shrink-0">{ch.label}:</span>
                  <span className="text-xs text-muted-foreground">{ch.status}</span>
                </div>
              ))}
            </div>

            {/* Button + note */}
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <div className="relative group">
                <button
                  disabled
                  className="px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
                >
                  Configure Notifications
                </button>
                <div className="absolute left-0 top-full mt-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Coming in v2
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground/70 italic">
              In production, connect to hospital email relay and notification service.
            </p>
          </Card>
        </section>

        {/* User Management */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">User Management</h2>
            <div className="relative group">
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-60"
              >
                <Plus className="w-3.5 h-3.5" /> Add User
              </button>
              <div className="absolute right-0 top-full mt-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Connect to hospital AD
              </div>
            </div>
          </div>
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Role</th>
                  <th className="p-4 text-left">Department</th>
                  <th className="p-4 text-left">Title</th>
                  <th className="p-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_USERS.map((user, i) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border hover:bg-[#F8FAFC] transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {user.initials}
                        </div>
                        <span className="font-medium text-sm">{user.name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{user.department}</td>
                    <td className="p-4 text-muted-foreground text-xs">{user.title}</td>
                    <td className="p-4">
                      <span className={cn(toneChip.success, "px-2 py-0.5 rounded-full text-xs")}>
                        Active
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground px-1">
            Production: Connect to hospital LDAP/Active Directory for user management.
          </p>
        </section>

        {/* System Status */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">System Status</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {systemStatus.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3"
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center",
                  item.status === "online" ? "bg-[#DCFCE7] dark:bg-green-500/10" :
                    item.status === "demo" ? "bg-[#FEF3C7] dark:bg-amber-500/10" :
                    item.status === "checking" ? "bg-primary/10" : "bg-[#FEE2E2] dark:bg-red-500/10"
                )}>
                  {item.status === "checking"
                    ? <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    : <item.icon className={cn(
                        "w-5 h-5",
                        item.status === "online" ? "text-[#15803D] dark:text-green-400" :
                          item.status === "demo" ? "text-[#B45309] dark:text-amber-400" : "text-[#B91C1C] dark:text-red-400"
                      )} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      item.status === "online" ? "bg-[#15803D]" :
                        item.status === "demo" ? "bg-[#B45309]" :
                        item.status === "checking" ? "bg-primary" : "bg-[#B91C1C]"
                    )} />
                    <p className="text-sm font-medium">{item.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{item.detail}</p>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                  item.status === "online" ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400" :
                    item.status === "demo" ? "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400" :
                    item.status === "checking" ? "bg-primary/10 text-primary" : "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400"
                )}>
                  {item.status === "online" ? "Online" : item.status === "demo" ? "Demo Mode" : item.status === "checking" ? "Checking…" : "Offline"}
                </span>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
