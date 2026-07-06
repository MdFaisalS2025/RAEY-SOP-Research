"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, ShieldAlert, FileText, RefreshCw, Loader2, Info,
  ChevronDown, ChevronUp, GitCompare,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

interface RealConflict {
  entity: string
  type: "DRUG" | "THRESHOLD"
  sop_a: string
  value_a: string
  sop_b: string
  value_b: string
  severity: "critical" | "high"
  message: string
  snippets: string[]
}

interface ConflictGraphResponse {
  conflicts: RealConflict[]
  conflict_count: number
  entity_count: number
  edge_count: number
}

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    critical: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    high: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
  }
  return map[severity] ?? "bg-muted text-[#64748B]"
}

function typeBadge(type: string) {
  return type === "DRUG"
    ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30"
    : "bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/30"
}

function ConflictCard({ conflict, index }: { conflict: RealConflict; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl bg-card border border-[#E2E8F0] overflow-hidden"
    >
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide", severityBadge(conflict.severity))}>
            {conflict.severity}
          </span>
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold uppercase", typeBadge(conflict.type))}>
            {conflict.type}
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-mono text-[#64748B] bg-muted border border-[#E2E8F0]">
            {conflict.entity}
          </span>
        </div>

        <p className="text-sm text-[#334155] leading-relaxed">{conflict.message}</p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted border border-[#E2E8F0] p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#0B6BCB]" />
              <span className="text-xs font-semibold text-[#1A2332] truncate">{conflict.sop_a}</span>
            </div>
            <p className="text-xs text-[#64748B]">States: <span className="font-mono text-[#0B6BCB]">{conflict.value_a}</span></p>
          </div>
          <div className="rounded-xl bg-muted border border-[#E2E8F0] p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#0B6BCB]" />
              <span className="text-xs font-semibold text-[#1A2332] truncate">{conflict.sop_b}</span>
            </div>
            <p className="text-xs text-[#64748B]">States: <span className="font-mono text-[#0B6BCB]">{conflict.value_b}</span></p>
          </div>
        </div>

        {conflict.snippets.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0B6BCB] transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? "Hide" : "Show"} source context
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                {conflict.snippets.map((s, i) => (
                  <blockquote key={i} className="border-l-2 border-[#0B6BCB]/30 pl-3 text-xs text-[#64748B] italic leading-relaxed">
                    &ldquo;{s}&rdquo;
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function ConflictResolutionPage() {
  const [data, setData] = useState<ConflictGraphResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  async function loadConflicts() {
    setError("")
    try {
      const res = await fetch(`${API_BASE}/api/conflicts/graph`)
      if (!res.ok) throw new Error("Failed")
      setData(await res.json())
    } catch {
      setError("Could not reach the conflict detection backend. Is it running?")
    }
  }

  useEffect(() => {
    loadConflicts().finally(() => setLoading(false))
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await loadConflicts()
    setRefreshing(false)
  }

  const conflicts = data?.conflicts ?? []
  const criticalCount = conflicts.filter((c) => c.severity === "critical").length
  const highCount = conflicts.filter((c) => c.severity === "high").length

  const stats = [
    { label: "Conflicts Detected", value: data?.conflict_count ?? 0, color: "text-[#0B6BCB]" },
    { label: "Critical", value: criticalCount, color: "text-[#B91C1C] dark:text-red-400" },
    { label: "High", value: highCount, color: "text-[#B45309] dark:text-amber-400" },
    { label: "Entities Scanned", value: data?.entity_count ?? 0, color: "text-[#64748B]" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Conflict Resolution" }]} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <GitCompare className="w-7 h-7 text-[#0B6BCB]" />
              <h1 className="font-display text-3xl font-bold text-[#1A2332]">Cross-SOP Conflict Detection</h1>
            </div>
            <p className="text-[#64748B] text-sm pl-10">
              Live entity-graph scan across the current SOP corpus for conflicting drug doses and clinical thresholds.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="press flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-50 text-white text-xs font-medium transition-colors"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Rescan Corpus
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="flex items-start gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30"
        >
          <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
          <span className="text-xs text-[#B45309] dark:text-amber-400">
            Research Prototype - Not for Clinical Use. Conflicts are detected automatically from SOP text (regex-based
            drug-dose and threshold extraction) - there is no manual reporting, assignment, or resolution workflow
            wired to persistence yet. This is a detection tool, not a case tracker.
          </span>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#64748B] gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Scanning SOP corpus for conflicts...
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stats.map(({ label, value, color }) => (
                <div key={label} className="rounded-xl bg-card border border-[#E2E8F0] p-4">
                  <p className="text-xs text-[#64748B] mb-1">{label}</p>
                  <p className={cn("text-3xl font-bold font-display", color)}>{value}</p>
                </div>
              ))}
            </motion.div>

            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#0B6BCB]/5 border border-[#0B6BCB]/15 text-[#334155] text-xs">
              <Info className="w-4 h-4 shrink-0 text-[#0B6BCB] mt-0.5" />
              <span>
                Detection scans drug dosages and clinical thresholds (e.g. MAP, norepinephrine rate) mentioned across
                every currently indexed SOP chunk and flags any entity with two or more differing values across
                different SOPs. This recomputes on every load/rescan - it is not a cached or persisted case list.
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#0B6BCB]" />
                <h2 className="font-display text-lg font-bold text-[#1A2332]">Detected Conflicts</h2>
              </div>

              {conflicts.length === 0 ? (
                <div className="rounded-2xl bg-card border border-[#E2E8F0] p-12 text-center">
                  <ShieldAlert className="w-8 h-8 text-[#64748B] mx-auto mb-3 opacity-40" />
                  <p className="text-[#64748B] text-sm">No conflicting drug doses or thresholds detected across the current SOP corpus.</p>
                </div>
              ) : (
                conflicts.map((c, i) => (
                  <ConflictCard key={`${c.entity}-${c.sop_a}-${c.sop_b}-${i}`} conflict={c} index={i} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
