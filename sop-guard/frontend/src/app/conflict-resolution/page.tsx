"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, ShieldAlert, FileText, RefreshCw, Loader2, Info,
  ChevronDown, ChevronUp, GitCompare, GitBranch, ArrowRight, Tag,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SafetyNote } from "@/components/ui/safety-note"
import { AccessRestricted } from "@/components/ui/access-restricted"
import { useRole } from "@/lib/role-context"
import { cn } from "@/lib/utils"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"
import { toneChip } from "@/components/ui/tone"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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

interface RealSOP {
  id: number
  sop_id: string
  title: string
  department: string
}

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    critical: toneChip.danger,
    high: toneChip.warning,
  }
  return map[severity] ?? toneChip.neutral
}

function typeBadge(type: string) {
  return type === "DRUG"
    ? toneChip.info
    : "bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/30"
}

function ConflictCard({ conflict, index }: { conflict: RealConflict; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl bg-card border border-border overflow-hidden"
    >
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide", severityBadge(conflict.severity))}>
            {conflict.severity}
          </span>
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold uppercase", typeBadge(conflict.type))}>
            {conflict.type}
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-mono text-muted-foreground bg-muted border border-border">
            {conflict.entity}
          </span>
        </div>

        <p className="text-sm text-foreground leading-relaxed">{conflict.message}</p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted border border-border p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground truncate">{conflict.sop_a}</span>
            </div>
            <p className="text-xs text-muted-foreground">States: <span className="font-mono text-primary">{conflict.value_a}</span></p>
          </div>
          <div className="rounded-xl bg-muted border border-border p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground truncate">{conflict.sop_b}</span>
            </div>
            <p className="text-xs text-muted-foreground">States: <span className="font-mono text-primary">{conflict.value_b}</span></p>
          </div>
        </div>

        {conflict.snippets.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? "Hide" : "Show"} source context
            </button>
            {expanded && (
              <div className="mt-2 space-y-2">
                {conflict.snippets.map((s, i) => (
                  <blockquote key={i} className="border-l-2 border-primary/30 pl-3 text-xs text-muted-foreground italic leading-relaxed">
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

function AllConflictsTab({ data, loading, error, refreshing, onRefresh }: {
  data: ConflictGraphResponse | null
  loading: boolean
  error: string
  refreshing: boolean
  onRefresh: () => void
}) {
  const conflicts = data?.conflicts ?? []
  const criticalCount = conflicts.filter((c) => c.severity === "critical").length
  const highCount = conflicts.filter((c) => c.severity === "high").length

  const stats = [
    { label: "Conflicts Detected", value: data?.conflict_count ?? 0, color: "text-primary" },
    { label: "Critical", value: criticalCount, color: "text-[#B91C1C] dark:text-red-400" },
    { label: "High", value: highCount, color: "text-[#B45309] dark:text-amber-400" },
    { label: "Entities Scanned", value: data?.entity_count ?? 0, color: "text-muted-foreground" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-muted-foreground text-sm">
          Live entity-graph scan across the current SOP corpus for conflicting drug doses and clinical thresholds.
        </p>
        <Button className="press flex items-center gap-1.5 px-3.5 py-2 rounded-xl disabled:opacity-50 text-xs font-medium transition-colors shrink-0" onClick={onRefresh}
          disabled={refreshing || loading}>
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Rescan Corpus
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Scanning SOP corpus for conflicts...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-card border border-border p-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={cn("text-3xl font-bold font-display", color)}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15 text-foreground text-xs">
            <Info className="w-4 h-4 shrink-0 text-primary mt-0.5" />
            <span>
              Detection scans drug dosages and clinical thresholds (e.g. MAP, norepinephrine rate) mentioned across
              every currently indexed SOP chunk and flags any entity with two or more differing values across
              different SOPs. This recomputes on every load/rescan - it is not a cached or persisted case list.
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Detected Conflicts</h2>
            </div>

            {conflicts.length === 0 ? (
              <Card padding="none" className="p-12 text-center">
                <ShieldAlert className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground text-sm">No conflicting drug doses or thresholds detected across the current SOP corpus.</p>
              </Card>
            ) : (
              conflicts.map((c, i) => (
                <ConflictCard key={`${c.entity}-${c.sop_a}-${c.sop_b}-${i}`} conflict={c} index={i} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ImpactBySopTab({ conflicts, loading }: { conflicts: RealConflict[]; loading: boolean }) {
  const [sops, setSops] = useState<RealSOP[]>([])
  const [sopsLoading, setSopsLoading] = useState(true)
  const [sopsError, setSopsError] = useState(false)
  const [selectedSopId, setSelectedSopId] = useState<string>("")

  const loadSops = () => {
    setSopsLoading(true)
    setSopsError(false)
    fetch(`${API_BASE}/api/sops`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((sopData) => {
        const list: RealSOP[] = Array.isArray(sopData) ? sopData : (sopData.sops ?? sopData.items ?? [])
        setSops(list)
        if (list.length > 0) setSelectedSopId(list[0].sop_id)
      })
      .catch(() => setSopsError(true))
      .finally(() => setSopsLoading(false))
  }
  useEffect(loadSops, [])

  const selectedSop = sops.find((s) => s.sop_id === selectedSopId)

  // Real cross-SOP impact: conflicts where this SOP's title appears as sop_a or sop_b.
  // There is no persisted "SOP references SOP" citation graph backend-side (only
  // per-query multi-hop retrieval, which isn't a static graph) - conflicts are the
  // one real, structural cross-SOP relationship this app currently detects.
  const relatedConflicts = useMemo(() => {
    if (!selectedSop) return []
    return conflicts.filter((c) => c.sop_a === selectedSop.title || c.sop_b === selectedSop.title)
  }, [conflicts, selectedSop])

  const affectedSopTitles = useMemo(() => {
    if (!selectedSop) return []
    const titles = new Set<string>()
    for (const c of relatedConflicts) {
      if (c.sop_a !== selectedSop.title) titles.add(c.sop_a)
      if (c.sop_b !== selectedSop.title) titles.add(c.sop_b)
    }
    return Array.from(titles)
  }, [relatedConflicts, selectedSop])

  const sharedEntities = useMemo(
    () => Array.from(new Set(relatedConflicts.map((c) => c.entity))),
    [relatedConflicts]
  )

  const busy = loading || sopsLoading

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Live view of which SOPs share conflicting drug doses or thresholds with the selected SOP - the same
        entity-graph detector as the &ldquo;All Conflicts&rdquo; tab, filtered to one SOP. There is no persisted SOP-to-SOP
        citation graph in the backend, so this reflects detected conflicts only, not a full reference network.
      </p>

      {busy ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading SOPs and conflict data...
        </div>
      ) : sopsError ? (
        <ErrorState message="Couldn't load SOPs." onRetry={loadSops} />
      ) : sops.length === 0 ? (
        <EmptyState title="No SOPs in the corpus yet." />
      ) : (
        <>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Select SOP to analyze</p>
            <div className="flex flex-wrap gap-2">
              {sops.map((sop) => (
                <button
                  key={sop.sop_id}
                  onClick={() => setSelectedSopId(sop.sop_id)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium",
                    selectedSopId === sop.sop_id
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {sop.sop_id}
                </button>
              ))}
            </div>
          </div>

          {selectedSop && (
            <div>
              <h2 className="text-lg font-medium text-foreground mb-3">
                Impact Network - <span className="text-primary">{selectedSop.title}</span>
              </h2>

              <div className="grid md:grid-cols-2 gap-4 items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <GitBranch className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Selected SOP</span>
                  </div>
                  <div className="bg-card border-2 border-primary/50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-primary mb-1">{selectedSop.sop_id}</p>
                    <p className="text-xs text-foreground font-medium leading-snug">{selectedSop.title}</p>
                    <p className="text-10 text-subtle mt-1">{selectedSop.department}</p>
                    {affectedSopTitles.length > 0 && (
                      <div className={cn(toneChip.danger, "mt-3 p-2 rounded-lg")}>
                        <p className="text-xs text-[#B91C1C] dark:text-red-400 font-medium">
                          Conflicts with {affectedSopTitles.length} other SOP{affectedSopTitles.length > 1 ? "s" : ""} on {sharedEntities.length} shared entit{sharedEntities.length > 1 ? "ies" : "y"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowRight className="w-4 h-4 text-[#B91C1C] dark:text-red-400" />
                    <span className="text-sm font-medium text-[#B91C1C] dark:text-red-400">
                      Conflicting SOPs ({affectedSopTitles.length})
                    </span>
                  </div>
                  {affectedSopTitles.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-4 text-xs text-subtle">
                      No detected conflicts with other SOPs
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {affectedSopTitles.map((title) => (
                        <div key={title} className="bg-card border border-[#FECACA] dark:border-red-500/30 rounded-xl p-3">
                          <p className="text-xs font-medium text-[#B91C1C] dark:text-red-400">{title}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {sharedEntities.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Conflicting Entities</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sharedEntities.map((entity) => (
                      <span key={entity} className="text-xs text-muted-foreground border border-input rounded px-2 py-0.5 font-mono">
                        {entity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {relatedConflicts.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-foreground mb-3">Conflict Detail</h2>
              <div className="space-y-3">
                {relatedConflicts.map((c, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-xs text-muted-foreground border border-input rounded px-2 py-0.5 font-mono">{c.entity}</span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          c.severity === "critical"
                            ? toneChip.danger
                            : toneChip.warning
                        )}
                      >
                        {c.severity === "critical" ? "Critical" : "High"}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{c.message}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default function ConflictResolutionPage() {
  const { role } = useRole()
  const [data, setData] = useState<ConflictGraphResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"all" | "impact">(() => {
    if (typeof window === "undefined") return "all"
    return new URLSearchParams(window.location.search).get("tab") === "impact" ? "impact" : "all"
  })

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

  const TABS = [
    { key: "all" as const, label: "All Conflicts", icon: ShieldAlert },
    { key: "impact" as const, label: "Impact by SOP", icon: GitBranch },
  ]

  if (role !== "governance_compliance" && role !== "system_admin") {
    return <AccessRestricted label="SOP Conflicts & Impact" requirement="This area requires Governance & Compliance access." />
  }

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "SOP Conflicts & Impact" }]} />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <div className="flex items-center gap-3">
            <GitCompare className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">SOP Conflicts &amp; Impact</h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="flex items-start justify-between gap-2 flex-wrap"
        >
          <span className="text-xs text-muted-foreground max-w-2xl">
            Conflicts are detected automatically from SOP text (regex-based drug-dose and threshold extraction) -
            there is no manual reporting, assignment, or resolution workflow wired to persistence yet. This is a
            detection tool, not a case tracker.
          </span>
          <SafetyNote />
        </motion.div>

        <div className="flex gap-1 p-1 rounded-xl bg-muted border border-border w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tab === t.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "all" ? (
          <AllConflictsTab data={data} loading={loading} error={error} refreshing={refreshing} onRefresh={handleRefresh} />
        ) : (
          <ImpactBySopTab conflicts={data?.conflicts ?? []} loading={loading} />
        )}
      </div>
    </AppShell>
  )
}
