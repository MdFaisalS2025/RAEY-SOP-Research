"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle, GitBranch, ArrowRight, Loader2, Tag,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

interface RealSOP {
  id: number
  sop_id: string
  title: string
  department: string
}

interface RealConflict {
  entity: string
  type: "DRUG" | "THRESHOLD"
  sop_a: string
  value_a: string
  sop_b: string
  value_b: string
  severity: "critical" | "high"
  message: string
}

export default function ImpactMapPage() {
  const [sops, setSops] = useState<RealSOP[]>([])
  const [conflicts, setConflicts] = useState<RealConflict[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSopId, setSelectedSopId] = useState<string>("")

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/sops`).then((r) => r.json()),
      fetch(`${API_BASE}/api/conflicts/graph`).then((r) => r.json()),
    ])
      .then(([sopData, conflictData]) => {
        const list: RealSOP[] = Array.isArray(sopData) ? sopData : (sopData.sops ?? sopData.items ?? [])
        setSops(list)
        setConflicts(Array.isArray(conflictData?.conflicts) ? conflictData.conflicts : [])
        if (list.length > 0) setSelectedSopId(list[0].sop_id)
      })
      .catch(() => { setSops([]); setConflicts([]) })
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Cross-SOP Impact Mapping" }]} />

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
            <GitBranch className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#1A2332] font-display">Cross-SOP Impact Mapping</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              Live view of which SOPs share conflicting drug doses or thresholds with the selected SOP.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            This uses the same live entity-graph conflict detector as the Conflict Resolution page - it flags SOPs
            that state a different value for the same drug dose or clinical threshold. There is no persisted
            SOP-to-SOP citation graph in the backend, so this reflects detected conflicts only, not a full
            reference/citation network.
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#64748B] gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading SOPs and conflict data...
          </div>
        ) : sops.length === 0 ? (
          <div className="rounded-2xl bg-card border border-[#E2E8F0] p-12 text-center text-[#64748B] text-sm">
            No SOPs in the corpus yet.
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs text-[#64748B] mb-2 block">Select SOP to analyze</label>
              <div className="flex flex-wrap gap-2">
                {sops.map((sop) => (
                  <button
                    key={sop.sop_id}
                    onClick={() => setSelectedSopId(sop.sop_id)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium",
                      selectedSopId === sop.sop_id
                        ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30"
                        : "bg-muted text-[#64748B] border-[#E2E8F0] hover:bg-muted"
                    )}
                  >
                    {sop.sop_id}
                  </button>
                ))}
              </div>
            </div>

            {selectedSop && (
              <div>
                <h2 className="text-lg font-medium text-[#1A2332] mb-3">
                  Impact Network - <span className="text-[#0B6BCB]">{selectedSop.title}</span>
                </h2>

                <div className="grid md:grid-cols-2 gap-4 items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <GitBranch className="w-4 h-4 text-[#0B6BCB]" />
                      <span className="text-sm font-medium text-[#0B6BCB]">Selected SOP</span>
                    </div>
                    <div className="bg-card border-2 border-[#0B6BCB]/50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-[#0B6BCB] mb-1">{selectedSop.sop_id}</p>
                      <p className="text-xs text-[#1A2332] font-medium leading-snug">{selectedSop.title}</p>
                      <p className="text-[10px] text-[#94A3B8] mt-1">{selectedSop.department}</p>
                      {affectedSopTitles.length > 0 && (
                        <div className="mt-3 p-2 rounded-lg bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30">
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
                      <div className="bg-card border border-[#E2E8F0] rounded-xl p-4 text-xs text-[#94A3B8]">
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
                      <Tag className="w-4 h-4 text-[#64748B]" />
                      <span className="text-sm font-medium text-[#334155]">Conflicting Entities</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sharedEntities.map((entity) => (
                        <span key={entity} className="text-xs text-[#64748B] border border-[#CBD5E1] rounded px-2 py-0.5 font-mono">
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
                <h2 className="text-lg font-medium text-[#1A2332] mb-3">Conflict Detail</h2>
                <div className="space-y-3">
                  {relatedConflicts.map((c, i) => (
                    <div key={i} className="bg-card border border-[#E2E8F0] rounded-xl p-4">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-xs text-[#64748B] border border-[#CBD5E1] rounded px-2 py-0.5 font-mono">{c.entity}</span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            c.severity === "critical"
                              ? "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30"
                              : "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30"
                          )}
                        >
                          {c.severity === "critical" ? "Critical" : "High"}
                        </span>
                      </div>
                      <p className="text-sm text-[#1A2332]">{c.message}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
