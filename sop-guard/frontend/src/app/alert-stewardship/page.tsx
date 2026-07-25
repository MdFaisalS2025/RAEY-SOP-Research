"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, ShieldOff, TrendingDown, Info } from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { cn } from "@/lib/utils"
import { ErrorState } from "@/components/ui/error-state"
import { EmptyState } from "@/components/ui/empty-state"

interface StewardshipCandidate {
  context_type: string
  context_id: string
  context_label: string
  count: number
  reasons: Record<string, number>
  last_overridden_at: string | null
}

interface StewardshipResponse {
  total_distinct_contexts: number
  candidates: StewardshipCandidate[]
  disclaimer: string
}

const CONTEXT_TYPE_LABEL: Record<string, string> = {
  conflict: "Conflict warning",
  answer: "AI answer",
  cds_card: "CDS card",
}

const REASON_LABEL: Record<string, string> = {
  will_monitor: "Will monitor",
  not_applicable: "Not applicable",
  disagree_with_sop: "Disagree with SOP",
  other: "Other",
}

export default function AlertStewardshipPage() {
  const [data, setData] = useState<StewardshipResponse | null>(null)
  const [minOverrides, setMinOverrides] = useState(2)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = () => {
    setLoading(true)
    setLoadError(false)
    fetch(`/api/overrides/stewardship?min_overrides=${minOverrides}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then(setData)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [minOverrides])

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldOff className="w-5 h-5 text-[#B45309] dark:text-amber-400" />
            <h1 className="text-lg font-semibold">Alert Stewardship</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Alerts and AI answers that clinicians repeatedly override. A warning nobody heeds
            isn&apos;t doing its job - this ranks candidates for retuning or demotion.
          </p>
        </motion.div>

        <div className="flex items-center gap-3">
          <label htmlFor="min-overrides" className="text-xs text-muted-foreground">
            Minimum override count
          </label>
          <select
            id="min-overrides"
            value={minOverrides}
            onChange={(e) => setMinOverrides(Number(e.target.value))}
            className="px-2 py-1 rounded-lg border border-border bg-card text-sm"
            aria-label="Minimum override count filter"
          >
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>{n}+</option>
            ))}
          </select>
          {data && (
            <span className="text-xs text-muted-foreground ml-auto">
              {data.total_distinct_contexts} distinct alert{data.total_distinct_contexts === 1 ? "" : "s"} overridden at least once
            </span>
          )}
        </div>

        {loading && (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading override history...</div>
        )}

        {!loading && loadError && (
          <ErrorState message="Couldn't load override history." onRetry={load} />
        )}

        {!loading && !loadError && data && data.candidates.length === 0 && (
          <EmptyState icon={Info} title={`No alerts have been overridden ${minOverrides} or more times yet.`} />
        )}

        {!loading && data && data.candidates.length > 0 && (
          <div className="space-y-3">
            {data.candidates.map((c, i) => (
              <motion.div
                key={`${c.context_type}-${c.context_id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-4 rounded-2xl bg-card border border-border shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {CONTEXT_TYPE_LABEL[c.context_type] ?? c.context_type}
                      </span>
                      <span className="text-xs text-subtle font-mono">{c.context_id.slice(0, 24)}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {c.context_label || "(no label recorded)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-sm font-semibold">{c.count}x</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {Object.entries(c.reasons).map(([reason, count]) => (
                    <span
                      key={reason}
                      className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                    >
                      {REASON_LABEL[reason] ?? reason}: {count}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {data && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground">
            <TrendingDown className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{data.disclaimer}</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
