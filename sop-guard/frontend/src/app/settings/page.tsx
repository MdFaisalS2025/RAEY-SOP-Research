"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Save, Eye, EyeOff, CheckCircle2, XCircle, Loader2,
  Shield, UserCheck, Mic, MicOff, Palette,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { healthCheck } from "@/lib/api"
import { cn } from "@/lib/utils"

/* ─── Role definitions ─── */

const roles = [
  {
    id: "admin",
    label: "Admin",
    description: "Full access. Can create, edit, delete SOPs and approve updates.",
    color: "text-red-400",
    bgColor: "bg-red-500/15 border-red-500/25",
  },
  {
    id: "editor",
    label: "Editor",
    description: "Can upload SOPs, propose updates, and edit draft documents.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/15 border-amber-500/25",
  },
  {
    id: "viewer",
    label: "Viewer",
    description: "Can view SOPs, run queries, and submit feedback.",
    color: "text-[#0B6BCB]",
    bgColor: "bg-[#0B6BCB]/10 border-[#0B6BCB]/30",
  },
]

function StatusItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.04]">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium">{String(value)}</p>
    </div>
  )
}

export default function SettingsPage() {
  const [provider, setProvider] = useState("mock")
  const [model, setModel] = useState("gpt-4")
  const [embedding, setEmbedding] = useState("text-embedding-3-small")
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [demoMode, setDemoMode] = useState(true)
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking")
  const [healthData, setHealthData] = useState<any>(null)
  const [role, setRole] = useState("viewer")
  const [systemStats, setSystemStats] = useState<any>(null)
  const [density, setDensityState] = useState<"comfortable" | "compact">("comfortable")

  const setDensity = (value: "comfortable" | "compact") => {
    setDensityState(value)
    try { localStorage.setItem("sop-guard-density", value) } catch { /* ignore */ }
    document.body.classList.toggle("compact", value === "compact")
  }

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sop-guard-settings")
      if (stored) {
        const s = JSON.parse(stored)
        if (s.provider) setProvider(s.provider)
        if (s.model) setModel(s.model)
        if (s.embedding) setEmbedding(s.embedding)
        if (typeof s.voiceEnabled === "boolean") setVoiceEnabled(s.voiceEnabled)
        if (typeof s.demoMode === "boolean") setDemoMode(s.demoMode)
      }
    } catch {}

    // Load role from localStorage
    try {
      const storedRole = localStorage.getItem("sop-guard-role")
      if (storedRole && ["admin", "editor", "viewer"].includes(storedRole)) {
        setRole(storedRole)
      }
    } catch {}

    // Check Web Speech API availability
    if (typeof window !== "undefined") {
      const speechAvailable = "webkitSpeechRecognition" in window || "SpeechRecognition" in window
      setVoiceAvailable(speechAvailable)
    }

    try {
      const savedDensity = localStorage.getItem("sop-guard-density")
      if (savedDensity === "compact") setDensityState("compact")
    } catch { /* ignore */ }

    // Theme is controlled from the top navigation bar; read the live DOM
    // state here so this page never drifts out of sync with it.
    setIsDark(document.documentElement.classList.contains("dark"))
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  // Health check on mount
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

  // Fetch system stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const [health, sops, llm, embedding] = await Promise.all([
          fetch("/api/health").then(r => r.json()).catch(() => null),
          fetch("/api/sops").then(r => r.json()).catch(() => null),
          fetch("/api/llm/status").then(r => r.json()).catch(() => null),
          fetch("/api/embedding/status").then(r => r.json()).catch(() => null),
        ])
        setSystemStats({ health, sops, llm, embedding })
      } catch {}
    }
    fetchStats()
  }, [])

  const handleSave = () => {
    const settings = { provider, model, embedding, voiceEnabled, demoMode }
    localStorage.setItem("sop-guard-settings", JSON.stringify(settings))
    localStorage.setItem("sop-guard-role", role)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleRoleChange = (newRole: string) => {
    setRole(newRole)
    localStorage.setItem("sop-guard-role", newRole)
  }

  const currentRole = roles.find(r => r.id === role) || roles[2]

  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

          {/* ─── Role Selector ─── */}
          <div className="p-5 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06] space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0B6BCB]" />
              <h3 className="text-sm font-semibold text-foreground">Role</h3>
              <span className={`ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${currentRole.bgColor} ${currentRole.color}`}>
                <UserCheck className="w-3 h-3" />
                {currentRole.label}
              </span>
            </div>

            <div className="space-y-2">
              {roles.map(r => (
                <label
                  key={r.id}
                  className={cn(
                    "press flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                    role === r.id
                      ? "bg-[#0B6BCB]/5 dark:bg-white/[0.05] border-[#0B6BCB]/30"
                      : "bg-muted/30 dark:bg-white/[0.02] border-border dark:border-white/[0.06] hover:bg-muted/50 dark:hover:bg-white/[0.04]"
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.id}
                    checked={role === r.id}
                    onChange={() => handleRoleChange(r.id)}
                    className="mt-0.5 accent-[#0B6BCB]"
                  />
                  <div>
                    <p className={`text-sm font-medium ${r.color}`}>{r.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ─── Backend Status ─── */}
          <div className="p-5 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06] space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Backend Status</h3>
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
                className="ml-auto text-xs text-[#0B6BCB] hover:text-[#0959AC] transition-colors"
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
          </div>

          {/* ─── LLM Configuration ─── */}
          <div className="p-5 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06] space-y-4">
            <h3 className="text-sm font-semibold text-foreground">LLM Configuration</h3>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-muted dark:bg-[#11191b] border border-border dark:border-white/10 text-sm text-foreground caret-[#0B6BCB]"
              >
                <option value="mock">Mock (Demo Mode)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-muted dark:bg-[#11191b] border border-border dark:border-white/10 text-sm text-foreground caret-[#0B6BCB]"
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="claude-3-opus">Claude 3 Opus</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                <option value="llama-3">Llama 3 (Ollama)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Embedding Model</label>
              <select
                value={embedding}
                onChange={(e) => setEmbedding(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-muted dark:bg-[#11191b] border border-border dark:border-white/10 text-sm text-foreground caret-[#0B6BCB]"
              >
                <option value="text-embedding-3-small">text-embedding-3-small</option>
                <option value="text-embedding-3-large">text-embedding-3-large</option>
                <option value="text-embedding-ada-002">text-embedding-ada-002</option>
              </select>
            </div>

            {provider !== "mock" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">API Key</label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full p-2.5 pr-10 rounded-xl bg-muted dark:bg-[#11191b] border border-border dark:border-white/10 text-sm text-foreground placeholder:text-muted-foreground caret-[#0B6BCB]"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ─── Preferences ─── */}
          <div className="p-5 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06] space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Preferences</h3>

            {/* Demo Mode */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Demo Mode</p>
                <p className="text-xs text-muted-foreground">Use mock data when backend is unavailable</p>
              </div>
              <button
                onClick={() => setDemoMode(!demoMode)}
                className={cn(
                  "w-11 h-6 rounded-full transition-colors relative",
                  demoMode ? "bg-[#0B6BCB]" : "bg-gray-300 dark:bg-[#11191b] border border-gray-400 dark:border-white/10"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-card absolute top-0.5 transition-all",
                  demoMode ? "left-[22px]" : "left-0.5"
                )} />
              </button>
            </div>
            {demoMode && (
              <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                Demo mode is active. The app will use simulated data when the backend is unreachable.
              </div>
            )}

            {/* Voice Input Status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Voice Input</p>
                <p className="text-xs text-muted-foreground">Enable microphone for voice queries</p>
              </div>
              <div className="flex items-center gap-2">
                {voiceAvailable ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-400">
                    <Mic className="w-3 h-3" />
                    Available
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-red-400">
                    <MicOff className="w-3 h-3" />
                    Not Available
                  </span>
                )}
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors relative",
                    voiceEnabled ? "bg-[#0B6BCB]" : "bg-gray-300 dark:bg-[#11191b] border border-gray-400 dark:border-white/10"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full bg-card absolute top-0.5 transition-all",
                    voiceEnabled ? "left-[22px]" : "left-0.5"
                  )} />
                </button>
              </div>
            </div>

            {/* Theme (controlled from top nav, shown here as read-only status) */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Theme</p>
                <p className="text-xs text-muted-foreground">Switch from the icon in the top navigation bar</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted/50 dark:bg-white/[0.04] border border-border dark:border-white/[0.06] text-foreground">
                <Palette className="w-3 h-3 text-[#0B6BCB] dark:text-[0B6BCB]" />
                {isDark ? "Dark" : "Light"}
              </span>
            </div>
          </div>

          {/* ─── Display ─── */}
          <div className="p-5 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06] space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Display</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Table density</p>
                <p className="text-xs text-muted-foreground">Adjust spacing on tables and cards</p>
              </div>
              <div className="flex rounded-lg border border-border dark:border-white/[0.06] overflow-hidden">
                <button
                  onClick={() => setDensity("comfortable")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    density === "comfortable" ? "bg-[#0B6BCB] text-white" : "bg-transparent text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  Comfortable
                </button>
                <button
                  onClick={() => setDensity("compact")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    density === "compact" ? "bg-[#0B6BCB] text-white" : "bg-transparent text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  Compact
                </button>
              </div>
            </div>
          </div>

          {/* ─── System Status ─── */}
          <div className="p-6 rounded-2xl bg-card dark:bg-white/[0.03] border border-border dark:border-white/[0.06]">
            <h3 className="text-sm font-semibold mb-4">System Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatusItem label="SOPs Indexed" value={(() => { const s = systemStats?.sops; if (!s) return 0; if (typeof s.total === "number") return s.total; if (Array.isArray(s)) return s.length; if (Array.isArray(s.sops)) return s.sops.length; return 0; })()} />
              <StatusItem label="LLM Mode" value={systemStats?.llm?.mode || systemStats?.health?.mode || "unknown"} />
              <StatusItem label="LLM Provider" value={systemStats?.llm?.provider || systemStats?.health?.llm_provider || "mock"} />
              <StatusItem label="Embedding" value={
                systemStats?.embedding?.dense_active
                  ? "Semantic (sentence-transformers)"
                  : "TF-IDF (local)"
              } />
              <StatusItem label="Reranker" value="Heuristic (local)" />
              <StatusItem label="Voice" value={voiceAvailable ? "Available" : "Browser only"} />
            </div>
          </div>

          {/* ─── Save Button ─── */}
          <button
            onClick={handleSave}
            className="press w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            {saved ? "Saved!" : "Save Settings"}
          </button>
        </motion.div>
      </div>
    </AppShell>
  )
}
