"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Save, CheckCircle2, XCircle, Loader2,
  Mic, MicOff, Palette,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { healthCheck } from "@/lib/api"
import { cn } from "@/lib/utils"

function StatusItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.04]">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium">{String(value)}</p>
    </div>
  )
}

export default function SettingsPage() {
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [demoMode, setDemoMode] = useState(true)
  const [saved, setSaved] = useState(false)
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking")
  const [healthData, setHealthData] = useState<any>(null)
  const [density, setDensityState] = useState<"comfortable" | "compact">("comfortable")
  const [llmStatus, setLlmStatus] = useState<any>(null)
  const [embeddingStatus, setEmbeddingStatus] = useState<any>(null)

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
        if (typeof s.voiceEnabled === "boolean") setVoiceEnabled(s.voiceEnabled)
        if (typeof s.demoMode === "boolean") setDemoMode(s.demoMode)
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

  // In-house model status - kept visible to every user (not just admins) so
  // the "no third-party LLM calls" privacy guarantee is checkable by anyone,
  // not buried in the admin-only Admin page.
  useEffect(() => {
    fetch("/api/llm/status").then(r => r.json()).then(setLlmStatus).catch(() => {})
    fetch("/api/embedding/status").then(r => r.json()).then(setEmbeddingStatus).catch(() => {})
  }, [])

  const handleSave = () => {
    const settings = { voiceEnabled, demoMode }
    localStorage.setItem("sop-guard-settings", JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

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

          {/* ─── In-house Model Status ─── */}
          <div className="p-5 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">In-House Model</h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-green-500/10 border-green-500/25 text-green-400">
                No third-party LLM calls
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Answers are generated by a self-hosted model running on infrastructure the
              hospital controls. Patient and query data is never sent to an external API.
              This is fixed by server configuration, not user-editable here.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatusItem label="Provider" value={llmStatus?.provider || "ollama"} />
              <StatusItem label="Model" value={llmStatus?.model || "llama3.2"} />
              <StatusItem
                label="Model reachable"
                value={llmStatus?.available ? "Yes" : "No — using template fallback"}
              />
              <StatusItem label="Embedding backend" value={embeddingStatus?.backend || "BAAI/bge-small-en-v1.5"} />
            </div>
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
