"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Save, CheckCircle2, XCircle, Loader2,
  Mic, MicOff, Palette, Database, ShieldCheck, Lock, Sliders,
  BookOpen, Users, BarChart3, Info, FlaskConical, KeyRound, CircleSlash, type LucideIcon,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { healthCheck } from "@/lib/api"
import { cn } from "@/lib/utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

function StatusItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.04]">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium">{String(value)}</p>
    </div>
  )
}

function Toggle({ on, onClick, disabled = false }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-11 h-6 rounded-full transition-colors relative shrink-0",
        disabled && "opacity-50 cursor-not-allowed",
        on ? "bg-[#0B6BCB] dark:bg-[#00E5FF]" : "bg-gray-300 dark:bg-[#11191b] border border-gray-400 dark:border-white/10"
      )}
    >
      <div className={cn("w-5 h-5 rounded-full bg-card absolute top-0.5 transition-all", on ? "left-[22px]" : "left-0.5")} />
    </button>
  )
}

function SettingsCard({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06] space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  )
}

function ComingSoonRow({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-subtle border border-border shrink-0">
        Coming soon
      </span>
    </div>
  )
}

type ProviderStatus = "active" | "mock" | "not_configured" | "requires_api_key"
interface ProviderInfo { key: string; name: string; status: ProviderStatus; notes: string }
const PROVIDER_STATUS_META: Record<ProviderStatus, { label: string; className: string; icon: LucideIcon }> = {
  active: { label: "Active", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/25", icon: ShieldCheck },
  mock: { label: "Mock", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25", icon: FlaskConical },
  not_configured: { label: "Not Configured", className: "bg-muted text-subtle border-border", icon: CircleSlash },
  requires_api_key: { label: "Requires API Key", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25", icon: KeyRound },
}

// Provider infrastructure status - moved here from the Ask Meridian evidence
// drawer, which should show search results, not backend configuration state.
function ProviderStatusList() {
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null)
  useEffect(() => {
    fetch("/api/evidence/providers")
      .then((r) => r.json())
      .then((data) => setProviders(Array.isArray(data?.providers) ? data.providers : []))
      .catch(() => setProviders([]))
  }, [])
  if (!providers) return <p className="text-xs text-muted-foreground">Loading provider status...</p>
  if (providers.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {providers.map((p) => {
        const meta = PROVIDER_STATUS_META[p.status] ?? PROVIDER_STATUS_META.not_configured
        return (
          <span key={p.key}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${meta.className}`}
            title={p.notes || `${p.name}: ${meta.label}`}>
            <meta.icon className="w-2.5 h-2.5" />
            {p.name} · {meta.label}
          </span>
        )
      })}
    </div>
  )
}

const SOURCE_LABELS: Record<string, string> = {
  pubmed: "PubMed",
  europepmc: "Europe PMC",
  cdc: "CDC",
  who: "WHO",
  clinicaltrials: "ClinicalTrials.gov",
  fda: "FDA",
  medlineplus: "MedlinePlus",
  cms: "CMS",
}

const TABS = [
  { id: "system", label: "System", icon: Info },
  { id: "knowledge", label: "Knowledge Management", icon: Database },
  { id: "governance", label: "Governance", icon: ShieldCheck },
  { id: "security", label: "Security", icon: Lock },
  { id: "ai", label: "AI Controls", icon: Sliders },
  { id: "evidence", label: "Evidence Management", icon: BookOpen },
  { id: "users", label: "User Management", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const
type TabId = typeof TABS[number]["id"]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("system")

  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [saved, setSaved] = useState(false)
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking")
  const [healthData, setHealthData] = useState<any>(null)
  const [density, setDensityState] = useState<"comfortable" | "compact">("comfortable")
  const [llmStatus, setLlmStatus] = useState<any>(null)
  const [embeddingStatus, setEmbeddingStatus] = useState<any>(null)

  // Real, backend-persisted settings (see routes_settings.py) - these
  // actually change pipeline behavior, unlike the display-only prefs above.
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6)
  const [allSources, setAllSources] = useState<string[]>([])
  const [enabledSources, setEnabledSources] = useState<Set<string>>(new Set())
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [privacy, setPrivacy] = useState<{ phi_guard?: string; active?: boolean; openmed_integrated?: boolean; note?: string } | null>(null)

  const setDensity = (value: "comfortable" | "compact") => {
    setDensityState(value)
    try { localStorage.setItem("meridian-density", value) } catch { /* ignore */ }
    document.body.classList.toggle("compact", value === "compact")
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem("meridian-settings")
      if (stored) {
        const s = JSON.parse(stored)
        if (typeof s.voiceEnabled === "boolean") setVoiceEnabled(s.voiceEnabled)
      }
    } catch {}

    if (typeof window !== "undefined") {
      const speechAvailable = "webkitSpeechRecognition" in window || "SpeechRecognition" in window
      setVoiceAvailable(speechAvailable)
    }

    try {
      const savedDensity = localStorage.getItem("meridian-density")
      if (savedDensity === "compact") setDensityState("compact")
    } catch { /* ignore */ }

    setIsDark(document.documentElement.classList.contains("dark"))
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    async function checkHealth() {
      setBackendStatus("checking")
      try {
        const data = await healthCheck()
        setHealthData(data)
        setBackendStatus("online")
      } catch {
        setBackendStatus("offline")
      }
    }
    checkHealth()
  }, [])

  useEffect(() => {
    fetch("/api/llm/status").then(r => r.json()).then(setLlmStatus).catch(() => {})
    fetch("/api/embedding/status").then(r => r.json()).then(setEmbeddingStatus).catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((data) => {
        setConfidenceThreshold(data.confidence_threshold ?? 0.6)
        setAllSources(Array.isArray(data.all_evidence_sources) ? data.all_evidence_sources : [])
        setEnabledSources(new Set(Array.isArray(data.enabled_evidence_sources) ? data.enabled_evidence_sources : []))
        setPrivacy(data.privacy ?? null)
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false))
  }, [])

  const handleSave = () => {
    const settings = { voiceEnabled }
    localStorage.setItem("meridian-settings", JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleSource(name: string) {
    setEnabledSources((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function savePipelineSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confidence_threshold: confidenceThreshold,
          enabled_evidence_sources: Array.from(enabledSources),
        }),
      })
      if (res.ok) {
        setSettingsSaved(true)
        setTimeout(() => setSettingsSaved(false), 2000)
      }
    } catch { /* ignore - offline demo mode */ }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Settings" }]} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Knowledge sources, governance, security posture, AI behavior, and user administration.
          </p>
        </motion.div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                activeTab === tab.id
                  ? "bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 text-[#0B6BCB] dark:text-[#00E5FF] border border-[#0B6BCB]/30 dark:border-[#00E5FF]/30"
                  : "text-muted-foreground hover:bg-muted border border-transparent"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl space-y-6">

          {activeTab === "system" && (
            <>
              <SettingsCard title="Backend Status">
                <div className="flex items-center gap-3">
                  {backendStatus === "checking" && (
                    <>
                      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                      <span className="text-sm text-amber-400">Checking backend...</span>
                    </>
                  )}
                  {backendStatus === "online" && (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-green-400 font-medium">Backend Online</span>
                    </>
                  )}
                  {backendStatus === "offline" && (
                    <>
                      <XCircle className="w-5 h-5 text-red-400" />
                      <span className="text-sm text-red-400 font-medium">Backend Offline</span>
                      <span className="text-xs text-muted-foreground">-- demo mode active</span>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setBackendStatus("checking")
                      healthCheck()
                        .then((data) => { setHealthData(data); setBackendStatus("online") })
                        .catch(() => setBackendStatus("offline"))
                    }}
                    className="ml-auto text-xs text-[#0B6BCB] dark:text-[#00E5FF] hover:underline"
                  >
                    Refresh
                  </button>
                </div>
                {healthData && backendStatus === "online" && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border dark:border-white/[0.06]">
                    <div>
                      <p className="text-xs text-muted-foreground">LLM Provider</p>
                      <p className="text-sm text-foreground font-medium">{healthData.llm_provider || healthData.provider || "Unknown"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Mode</p>
                      <p className="text-sm text-foreground font-medium">{healthData.mode || "Standard"}</p>
                    </div>
                  </div>
                )}
              </SettingsCard>

              <SettingsCard
                title="In-House Model"
                badge={
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-green-500/10 border-green-500/25 text-green-400">
                    No third-party LLM calls
                  </span>
                }
              >
                <p className="text-xs text-muted-foreground">
                  Answers are generated by a self-hosted model running on infrastructure the
                  hospital controls. Patient and query data is never sent to an external API.
                  This is fixed by server configuration, not user-editable here.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <StatusItem label="Provider" value={llmStatus?.provider || "ollama"} />
                  <StatusItem label="Model" value={llmStatus?.model || "llama3.2"} />
                  <StatusItem label="Answer method" value={llmStatus?.available ? "Model-generated" : "Extractive - assembled from cited SOP text"} />
                  <StatusItem label="Embedding backend" value={embeddingStatus?.backend || "BAAI/bge-small-en-v1.5"} />
                </div>
              </SettingsCard>

              <SettingsCard title="Preferences">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Voice Input</p>
                    <p className="text-xs text-muted-foreground">Show the microphone button on Ask Meridian&apos;s composer</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {voiceAvailable ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400"><Mic className="w-3 h-3" />Available</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-400"><MicOff className="w-3 h-3" />Not Available</span>
                    )}
                    <Toggle on={voiceEnabled} onClick={() => setVoiceEnabled(!voiceEnabled)} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Theme</p>
                    <p className="text-xs text-muted-foreground">Switch from the icon in the top navigation bar</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.06] text-foreground">
                    <Palette className="w-3 h-3 text-[#0B6BCB] dark:text-[#00E5FF]" />
                    {isDark ? "Dark" : "Light"}
                  </span>
                </div>
              </SettingsCard>

              <SettingsCard title="Display">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Table density</p>
                    <p className="text-xs text-muted-foreground">Adjust spacing on tables and cards</p>
                  </div>
                  <div className="flex rounded-lg border border-border dark:border-white/[0.06] overflow-hidden">
                    <button onClick={() => setDensity("comfortable")} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", density === "comfortable" ? "bg-[#0B6BCB] dark:bg-[#00E5FF] text-white dark:text-[#0A0C10]" : "bg-transparent text-muted-foreground hover:bg-muted/50")}>
                      Comfortable
                    </button>
                    <button onClick={() => setDensity("compact")} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", density === "compact" ? "bg-[#0B6BCB] dark:bg-[#00E5FF] text-white dark:text-[#0A0C10]" : "bg-transparent text-muted-foreground hover:bg-muted/50")}>
                      Compact
                    </button>
                  </div>
                </div>
              </SettingsCard>

              <button
                onClick={handleSave}
                className="press w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B6BCB] dark:bg-[#00E5FF] hover:bg-[#0959AC] dark:hover:bg-[#00c4d9] text-white dark:text-[#0A0C10] font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {saved ? "Saved!" : "Save Preferences"}
              </button>
            </>
          )}

          {activeTab === "knowledge" && (
            <>
              <SettingsCard title="Source Priority">
                <p className="text-xs text-muted-foreground">
                  Internal SOP library is always the primary source (Route A). External evidence sources
                  below are consulted when SOP evidence is insufficient or a query explicitly requests
                  literature comparison - see the routing architecture on the query page&apos;s trust panel.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-[#0B6BCB]/10 dark:bg-[#00E5FF]/10 text-[#0B6BCB] dark:text-[#00E5FF] border border-[#0B6BCB]/30 dark:border-[#00E5FF]/30 text-xs font-semibold">1. SOP Library</span>
                  <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border text-xs font-semibold">2. External Evidence (below)</span>
                </div>
              </SettingsCard>
              <SettingsCard title="Knowledge Refresh Frequency">
                <ComingSoonRow label="Scheduled re-index" description="Automatic nightly re-embedding of SOP content on change" />
                <ComingSoonRow label="External source polling" description="Background refresh of literature results independent of query time" />
              </SettingsCard>
              <SettingsCard title="Version Controls">
                <p className="text-xs text-muted-foreground">
                  Every SOP edit is versioned with a redline diff and requires governance approval before
                  taking effect - see Governance → Proposals. Review-cycle tracking is visible on
                  Evidence Watch.
                </p>
              </SettingsCard>
            </>
          )}

          {activeTab === "governance" && (
            <>
              <SettingsCard title="Approval Workflows">
                <p className="text-xs text-muted-foreground">
                  SOP proposals require review by the Governance & Compliance role before taking effect,
                  with a scheduled effective date separate from approval - see Governance → Proposals.
                </p>
              </SettingsCard>
              <SettingsCard title="Change Management">
                <p className="text-xs text-muted-foreground">
                  Every SOP change is captured as a word-level redline diff with a proactive
                  change-impact assessment before it can be proposed.
                </p>
              </SettingsCard>
              <SettingsCard title="Audit Configuration">
                <p className="text-xs text-muted-foreground">
                  Attestations use a Part-11-style signature chain (signature meaning, second-factor
                  confirmation, content hash, previous-hash linkage) - see Governance → Committee.
                </p>
              </SettingsCard>
            </>
          )}

          {activeTab === "security" && (
            <>
            <SettingsCard
              title="Privacy & PHI Protection"
              badge={
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-green-500/10 border-green-500/25 text-green-400">
                  Active
                </span>
              }
            >
              <p className="text-xs text-muted-foreground">
                Questions are scanned for likely patient identifiers (name, MRN, dates,
                phone, email, SSN, address) in the Ask Meridian composer before they reach
                the model, with one-click redaction. Detection runs locally on this
                deployment — no query text is sent to a third party to perform the scan.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <StatusItem label="PHI guard" value={privacy?.phi_guard ?? "rule-based"} />
                <StatusItem label="Status" value={privacy?.active === false ? "Inactive" : "Active"} />
              </div>
              <p className="text-xs text-subtle pt-2 border-t border-border">
                {privacy?.note ??
                  "Rule-based, OpenMed-inspired heuristic. Flags common direct identifiers; not exhaustive or clinical-grade de-identification."}
              </p>
            </SettingsCard>
            <SettingsCard title="Identity & Access">
              <ComingSoonRow label="Single Sign-On (SSO)" description="SAML / OIDC integration with hospital identity provider" />
              <ComingSoonRow label="LDAP / Active Directory" description="Directory-synced roles and department assignment" />
              <ComingSoonRow label="Azure AD" description="Microsoft Entra ID integration" />
              <ComingSoonRow label="Multi-Factor Authentication" description="Required second factor for privileged roles" />
              <p className="text-xs text-subtle pt-2 border-t border-border">
                Current authentication is role-based demo login only (see the login page&apos;s role
                hierarchy). These are the identity integrations required before a production hospital
                deployment - flagged honestly as not yet built, not toggled on.
              </p>
            </SettingsCard>
            </>
          )}

          {activeTab === "ai" && (
            <>
              <SettingsCard
                title="Confidence Threshold"
                badge={settingsSaved && <span className="text-xs text-green-400 font-medium">Saved</span>}
              >
                <p className="text-xs text-muted-foreground">
                  Minimum evidence-sufficiency score (0-1) required before the pipeline will generate an
                  answer from internal SOPs, rather than falling through to external evidence or an
                  explicit &quot;no evidence found&quot; response. This is a live pipeline parameter.
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0.3}
                    max={0.9}
                    step={0.05}
                    value={confidenceThreshold}
                    disabled={settingsLoading}
                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                    className="flex-1 accent-[#0B6BCB] dark:accent-[#00E5FF]"
                  />
                  <span className="text-sm font-mono font-semibold text-foreground w-12 text-right">{confidenceThreshold.toFixed(2)}</span>
                </div>
              </SettingsCard>
              <SettingsCard title="Model Routing">
                <p className="text-xs text-muted-foreground">
                  Answer routing (Route A/B/C/D - internal SOP, external evidence, hybrid, or no
                  evidence) is decided per-query by intent classification. See the &quot;Sourced from&quot;
                  badge on any answer&apos;s trust panel for the route actually taken.
                </p>
              </SettingsCard>
              <SettingsCard title="Evidence Escalation Rules">
                <p className="text-xs text-muted-foreground">
                  When internal SOP evidence is insufficient, external evidence sources (enabled in the
                  Evidence Management tab) are automatically queried before the system abstains.
                </p>
              </SettingsCard>
              <button
                onClick={savePipelineSettings}
                disabled={settingsLoading}
                className="press w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B6BCB] dark:bg-[#00E5FF] hover:bg-[#0959AC] dark:hover:bg-[#00c4d9] disabled:opacity-60 text-white dark:text-[#0A0C10] font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {settingsSaved ? "Saved!" : "Save AI Controls"}
              </button>
            </>
          )}

          {activeTab === "evidence" && (
            <>
              <SettingsCard
                title="Evidence Sources"
                badge={settingsSaved && <span className="text-xs text-green-400 font-medium">Saved</span>}
              >
                <p className="text-xs text-muted-foreground">
                  Toggle which external sources are queried for Route B/C answers and on Evidence Watch.
                  PubMed results are additionally tagged with a journal trust tier (Tier 1 = flagship
                  journals like NEJM/JAMA/BMJ/Lancet).
                </p>
                <div className="space-y-2">
                  {(allSources.length ? allSources : Object.keys(SOURCE_LABELS)).map((name) => (
                    <div key={name} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-foreground">{SOURCE_LABELS[name] ?? name}</span>
                      <Toggle on={enabledSources.has(name)} onClick={() => toggleSource(name)} disabled={settingsLoading} />
                    </div>
                  ))}
                </div>
              </SettingsCard>
              <SettingsCard title="Provider Status">
                <p className="text-xs text-muted-foreground">
                  Live connection status for each evidence source's backend integration.
                </p>
                <ProviderStatusList />
              </SettingsCard>
              <SettingsCard title="Trust Scoring">
                <p className="text-xs text-muted-foreground">
                  Tier 1: flagship journals (NEJM, JAMA, BMJ, Lancet, Nature Medicine, Annals of Internal
                  Medicine) and major specialty-society journals, plus regulatory sources (FDA, CMS).
                  Tier 2: other MEDLINE-indexed peer-reviewed journals. Tier 3: unranked.
                </p>
              </SettingsCard>
              <button
                onClick={savePipelineSettings}
                disabled={settingsLoading}
                className="press w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B6BCB] dark:bg-[#00E5FF] hover:bg-[#0959AC] dark:hover:bg-[#00c4d9] disabled:opacity-60 text-white dark:text-[#0A0C10] font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {settingsSaved ? "Saved!" : "Save Evidence Sources"}
              </button>
            </>
          )}

          {activeTab === "users" && (
            <SettingsCard title="Roles & Departments">
              <p className="text-xs text-muted-foreground">
                Four role tiers govern access: System Admin, Governance &amp; Compliance, Educator/Trainer,
                and Clinical Staff - see the role hierarchy on the login page. Department assignment
                currently comes from each demo user&apos;s profile.
              </p>
              <ComingSoonRow label="Custom role editor" description="Define roles/permissions beyond the four built-in tiers" />
              <ComingSoonRow label="Department management" description="Add/edit hospital departments independent of SOP data" />
            </SettingsCard>
          )}

          {activeTab === "analytics" && (
            <SettingsCard title="Adoption & Usage">
              <p className="text-xs text-muted-foreground">
                Query volume and activity are tracked per-session - see the Impact Map and Training pages
                for real activity-log-backed metrics.
              </p>
              <ComingSoonRow label="Query insight dashboards" description="Aggregate trends across departments and query types" />
              <ComingSoonRow label="Adoption tracking" description="Per-department usage rate against active staff count" />
            </SettingsCard>
          )}
        </motion.div>
      </div>
    </AppShell>
  )
}
