"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Settings, Lock, AlertTriangle, Database, Activity,
  Users, Globe, ToggleLeft, ToggleRight, Plus,
  Server, Brain, HardDrive, Eye, ShieldCheck, Bell, Mail, Smartphone
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { DEMO_USERS } from "@/lib/mock-data"
import { useRole } from "@/lib/role-context"

const ROLE_LABELS: Record<string, string> = {
  clinical_staff: "Clinical Staff",
  educator: "Educator / Trainer",
  governance_compliance: "Governance & Compliance",
  system_admin: "System Admin",
}

interface EvidenceSource {
  name: string
  type: string
  trustScore: number
  status: "active" | "paused"
  lastCheck: string
}

// Mirrors the backend's actual EvidenceSource registry
// (backend/app/integrations/evidence_registry.py) - these are the only
// sources the app really queries live from /api/evidence/search. Trust
// score/last-check here are still illustrative (the backend doesn't expose
// per-source trust scoring), but the source names/types are real, not
// placeholder journal names that were never wired up.
const INITIAL_SOURCES: EvidenceSource[] = [
  { name: "PubMed", type: "pubmed", trustScore: 95, status: "active", lastCheck: "Today" },
  { name: "Europe PMC", type: "europepmc", trustScore: 93, status: "active", lastCheck: "Today" },
  { name: "CDC", type: "cdc", trustScore: 97, status: "active", lastCheck: "Today" },
  { name: "WHO Guidelines", type: "who", trustScore: 96, status: "active", lastCheck: "Today" },
  { name: "ClinicalTrials.gov", type: "clinicaltrials", trustScore: 92, status: "active", lastCheck: "Today" },
]

// Non-auth integrations (Authentication card is replaced with SSO section below)
const otherIntegrations = [
  { name: "EHR/EMR", subtitle: "Epic / Cerner", description: "Connect to hospital electronic health record system for patient context and SOP linking.", icon: Database },
  { name: "LMS", subtitle: "HealthStream / Relias", description: "Connect to learning management system for automated training enrollment and tracking.", icon: Users },
  { name: "SharePoint", subtitle: "Policy Repository", description: "Connect to SharePoint for existing policy document import and version synchronization.", icon: Globe },
]

const systemStatus = [
  { name: "Backend API", detail: "FastAPI (Python)", status: "online" as const, icon: Server },
  { name: "LLM Provider", detail: "Ollama (self-hosted) / llama3.2 — no third-party API calls", status: "online" as const, icon: Brain },
  { name: "Embedding Model", detail: "BAAI/bge-small-en-v1.5", status: "online" as const, icon: Activity },
  { name: "Database", detail: "SQLite (Demo) - PostgreSQL (Production)", status: "demo" as const, icon: HardDrive },
  { name: "Evidence Watch", detail: "Active: 5 sources monitored", status: "online" as const, icon: Eye },
  { name: "Vector Index", detail: "In-memory cosine similarity (sentence-transformers, TF-IDF fallback)", status: "online" as const, icon: Database },
]

type SSOProtocol = "saml" | "oauth" | "ldap"

export default function AdminPage() {
  const { role } = useRole()
  const [sources, setSources] = useState<EvidenceSource[]>(INITIAL_SOURCES)
  const [ssoProtocol, setSSOProtocol] = useState<SSOProtocol>("saml")

  if (role !== "system_admin") {
    return (
      <AppShell>
        <div className="p-6 max-w-2xl mx-auto">
          <Breadcrumb items={[{ label: "Admin" }]} />
          <div className="mt-16 flex flex-col items-center justify-center text-center space-y-4 rounded-2xl bg-card border border-border p-12">
            <div className="w-16 h-16 rounded-2xl bg-[#FEE2E2] dark:bg-red-500/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-[#B91C1C] dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold font-display">Access Restricted</h2>
            <p className="text-muted-foreground">This area requires System Administrator access.</p>
            <p className="text-sm text-muted-foreground/70">Contact your system administrator for access.</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const toggleSource = (index: number) => {
    setSources((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, status: s.status === "active" ? "paused" : "active" } : s
      )
    )
  }

  const inputCls = "w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-border text-sm text-muted-foreground placeholder:text-muted-foreground/50 opacity-50 cursor-not-allowed"

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: "Admin" }]} />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-card flex items-center justify-center">
            <Settings className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">System Administration</h1>
            <p className="text-sm text-muted-foreground">Platform configuration and integration management</p>
          </div>
        </div>

        {/* Research disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype. Not for Clinical Use.</strong> For demonstration only.</span>
        </div>

        {/* External Evidence Sources */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-display">External Evidence Sources</h2>
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
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Type</th>
                  <th className="p-4 text-left">Trust Score</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Last Check</th>
                  <th className="p-4 text-left">Toggle</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source, i) => (
                  <motion.tr
                    key={source.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border hover:bg-[#F8FAFC] transition-colors"
                  >
                    <td className="p-4 font-medium">{source.name}</td>
                    <td className="p-4 text-muted-foreground text-xs">{source.type}</td>
                    <td className="p-4">
                      <span className="text-[#15803D] dark:text-green-400 font-semibold">{source.trustScore}%</span>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        source.status === "active"
                          ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30"
                          : "bg-card text-muted-foreground border border-input"
                      )}>
                        {source.status === "active" ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{source.lastCheck}</td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleSource(i)}
                        className="flex items-center gap-1.5 text-xs transition-colors"
                      >
                        {source.status === "active"
                          ? <ToggleRight className="w-6 h-6 text-[#0B6BCB]" />
                          : <ToggleLeft className="w-6 h-6 text-subtle" />}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </section>

        {/* SSO / Active Directory Configuration */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold font-display">SSO / Active Directory Configuration</h2>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-5">
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
                        ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30"
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
                  <label className="text-xs text-muted-foreground">Identity Provider URL</label>
                  <input
                    disabled
                    placeholder="https://your-hospital-idp.example.com/saml2"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Entity ID</label>
                  <input
                    disabled
                    placeholder="meridian-production"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">X.509 Certificate</label>
                  <textarea
                    disabled
                    rows={3}
                    placeholder="Paste certificate here..."
                    className={cn(inputCls, "resize-none")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Attribute Mapping</label>
                  <input
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
                  <label className="text-xs text-muted-foreground">Server URL</label>
                  <input
                    disabled
                    placeholder="ldap://ad.hospital.internal:389"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Base DN</label>
                  <input
                    disabled
                    placeholder="dc=hospital,dc=internal"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Bind DN</label>
                  <input
                    disabled
                    placeholder="cn=sopguard-service,ou=services,dc=hospital,dc=internal"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Bind Password</label>
                  <input
                    disabled
                    type="password"
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">User Search Filter</label>
                  <input
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
          </div>
        </section>

        {/* Other Integration Placeholders */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold font-display">Integration Placeholders</h2>
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
            <h2 className="text-lg font-semibold font-display">Notification &amp; Alert Configuration</h2>
          </div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
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
          </div>
        </section>

        {/* User Management */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-display">User Management</h2>
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
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
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
                        <div className="w-7 h-7 rounded-full bg-[#0B6BCB]/10 flex items-center justify-center text-xs font-bold text-[#0B6BCB]">
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
                      <span className="px-2 py-0.5 rounded-full text-xs bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30">
                        Active
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <p className="text-xs text-muted-foreground px-1">
            Production: Connect to hospital LDAP/Active Directory for user management.
          </p>
        </section>

        {/* System Status */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold font-display">System Status</h2>
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
                    item.status === "demo" ? "bg-[#FEF3C7] dark:bg-amber-500/10" : "bg-[#FEE2E2] dark:bg-red-500/10"
                )}>
                  <item.icon className={cn(
                    "w-5 h-5",
                    item.status === "online" ? "text-[#15803D] dark:text-green-400" :
                      item.status === "demo" ? "text-[#B45309] dark:text-amber-400" : "text-[#B91C1C] dark:text-red-400"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      item.status === "online" ? "bg-[#15803D]" :
                        item.status === "demo" ? "bg-[#B45309]" : "bg-[#B91C1C]"
                    )} />
                    <p className="text-sm font-medium">{item.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{item.detail}</p>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                  item.status === "online" ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400" :
                    item.status === "demo" ? "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400" : "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400"
                )}>
                  {item.status === "online" ? "Online" : item.status === "demo" ? "Demo Mode" : "Offline"}
                </span>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
