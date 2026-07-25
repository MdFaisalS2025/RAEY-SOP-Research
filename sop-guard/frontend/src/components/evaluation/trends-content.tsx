"use client"

// Release-over-release view of the eval metrics (roadmap D9: "no trend
// dashboard, no correctness/gold-answer scoring [wired anywhere], no
// adversarial threshold wired in" - the adversarial threshold is now
// wired via tests/test_adversarial_eval.py; this closes the trend-tracking
// half of that gap). Every other tab on this page shows the LAST run only,
// discarded the moment a fresh one replaces it - this persists a
// point-in-time snapshot so a metric moving can actually be seen moving.

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { TrendingUp, Loader2, Camera, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

interface EvalSnapshot {
  id: number
  metrics: Record<string, number | null>
  corpus_sop_count: number
  generation_mode: string
  label: string
  created_at: string
}

const TRACKED_METRICS: { key: string; label: string; color: string }[] = [
  { key: "faithfulness", label: "Faithfulness", color: "#0B6BCB" },
  { key: "route_accuracy", label: "Route Accuracy", color: "#0D9488" },
  { key: "retrieval_precision", label: "Retrieval Precision", color: "#7C3AED" },
  { key: "correctness_pass_rate", label: "Correctness Pass Rate", color: "#B45309" },
  { key: "adversarial_sensitivity", label: "Adversarial Sensitivity", color: "#B91C1C" },
  { key: "adversarial_specificity", label: "Adversarial Specificity", color: "#334155" },
]

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function fmtMetric(v: number | null | undefined): string {
  return typeof v === "number" ? v.toFixed(2) : "–"
}

// Minimal dependency-free line chart - one polyline per tracked metric,
// scaled to a fixed 0-1 range since every tracked metric is a rate/score.
function TrendChart({ snapshots }: { snapshots: EvalSnapshot[] }) {
  const width = 640
  const height = 200
  const padding = 28
  const n = snapshots.length

  if (n < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground gap-2">
        <Info className="w-5 h-5 opacity-50" />
        <p>Need at least 2 recorded snapshots to draw a trend line - {n} recorded so far.</p>
      </div>
    )
  }

  const x = (i: number) => padding + (i / (n - 1)) * (width - padding * 2)
  const y = (v: number) => height - padding - v * (height - padding * 2)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Evaluation metric trends">
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line x1={padding} y1={y(g)} x2={width - padding} y2={y(g)} stroke="currentColor" strokeOpacity={0.08} />
          <text x={2} y={y(g) + 3} fontSize={9} fill="currentColor" opacity={0.5}>{g.toFixed(2)}</text>
        </g>
      ))}
      {TRACKED_METRICS.map((m) => {
        const points = snapshots
          .map((s, i) => {
            const v = s.metrics[m.key]
            return typeof v === "number" ? `${x(i)},${y(Math.max(0, Math.min(1, v)))}` : null
          })
          .filter((p): p is string => p !== null)
        if (points.length < 2) return null
        return <polyline key={m.key} points={points.join(" ")} fill="none" stroke={m.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      })}
    </svg>
  )
}

export function TrendsContent() {
  const [snapshots, setSnapshots] = useState<EvalSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/api/evaluation/snapshots?limit=20`)
      const data = await res.json()
      setSnapshots(Array.isArray(data?.snapshots) ? data.snapshots : [])
    } catch {
      setError("Could not reach the evaluation backend.")
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function recordSnapshot() {
    setRecording(true)
    setError("")
    try {
      const res = await fetch(`${API_BASE}/api/evaluation/snapshot`, { method: "POST" })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setError("Failed to record a snapshot - is the backend reachable?")
    }
    setRecording(false)
  }

  const latest = snapshots[snapshots.length - 1] ?? null

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4.5 h-4.5 text-[#0B6BCB]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Metric Trends</h2>
            <p className="text-xs text-muted-foreground max-w-xl">
              Each recorded snapshot runs the full evaluation suite once (faithfulness, route accuracy, retrieval
              precision, gold-answer correctness, adversarial verifier check) and persists the result, so a metric
              regressing or improving is actually visible release over release - not just the last run anyone happened to trigger.
            </p>
          </div>
        </div>
        <button
          onClick={recordSnapshot}
          disabled={recording}
          className="press flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-50 text-white text-xs font-medium transition-colors shrink-0"
        >
          {recording ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          {recording ? "Recording (runs the full suite)..." : "Record Snapshot"}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading snapshot history...
        </div>
      ) : snapshots.length === 0 ? (
        <Card padding="none" className="p-10 text-center space-y-2">
          <Camera className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No snapshots recorded yet.</p>
          <p className="text-xs text-muted-foreground">Click "Record Snapshot" to establish the first baseline - each one takes a minute or two, since it runs every eval harness once.</p>
        </Card>
      ) : (
        <>
          <Card>
            <TrendChart snapshots={snapshots} />
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-border">
              {TRACKED_METRICS.map((m) => (
                <span key={m.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                  {m.label}
                </span>
              ))}
            </div>
          </Card>

          {latest && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TRACKED_METRICS.map((m) => (
                <div key={m.key} className="p-4 rounded-xl bg-card border border-border">
                  <p className="text-2xl font-bold" style={{ color: m.color }}>{fmtMetric(latest.metrics[m.key])}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          )}

          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Recorded</th>
                  <th className="px-4 py-2.5 font-medium">Label</th>
                  <th className="px-4 py-2.5 font-medium">SOPs</th>
                  <th className="px-4 py-2.5 font-medium">Mode</th>
                  {TRACKED_METRICS.map((m) => (
                    <th key={m.key} className="px-4 py-2.5 font-medium whitespace-nowrap">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...snapshots].reverse().map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(s.created_at)}</td>
                    <td className="px-4 py-2.5 text-foreground">{s.label || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.corpus_sop_count}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[11px] font-medium border",
                        s.generation_mode === "mock" || s.generation_mode === "mock_fallback" || s.generation_mode === "no_generation"
                          ? "bg-muted text-muted-foreground border-border"
                          : "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30"
                      )}>
                        {s.generation_mode}
                      </span>
                    </td>
                    {TRACKED_METRICS.map((m) => (
                      <td key={m.key} className="px-4 py-2.5 font-medium text-foreground">{fmtMetric(s.metrics[m.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </motion.div>
  )
}
