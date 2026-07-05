"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, GitBranch, ArrowRight, ArrowLeft,
  Loader2, CheckCircle, Plus, Tag
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_SOPS } from "@/lib/mock-data"

// ─── Inline data ──────────────────────────────────────────────────────────────

const IMPACT_MAP: Record<
  string,
  { references: string[]; referenced_by: string[]; shared_topics: string[] }
> = {
  "IC-PPE-001": {
    references: ["IC-CL-005"],
    referenced_by: ["ICU-SEP-002", "ICU-RR-006", "ONCO-CHEMO-003"],
    shared_topics: ["Hand hygiene", "Isolation precautions", "PPE donning/doffing"],
  },
  "ICU-SEP-002": {
    references: ["IC-PPE-001", "ICU-RR-006"],
    referenced_by: [],
    shared_topics: ["Vasopressor dosing", "Fluid resuscitation", "Blood cultures"],
  },
  "IC-CL-005": {
    references: ["IC-PPE-001"],
    referenced_by: ["ICU-SEP-002"],
    shared_topics: ["Sterile technique", "Hand hygiene", "PPE requirements"],
  },
  "ICU-RR-006": {
    references: ["ICU-SEP-002"],
    referenced_by: ["IC-PPE-001"],
    shared_topics: ["Escalation criteria", "NEWS2 thresholds"],
  },
  "PHARM-MED-007": {
    references: [],
    referenced_by: ["ONCO-CHEMO-003", "ICU-SEP-002"],
    shared_topics: ["Double-check requirements", "High-alert medications"],
  },
  "ONCO-CHEMO-003": {
    references: ["IC-PPE-001", "PHARM-MED-007"],
    referenced_by: [],
    shared_topics: ["PPE requirements", "Medication double-check", "Waste disposal"],
  },
  "HVAP-FALL-004": {
    references: [],
    referenced_by: [],
    shared_topics: ["Patient assessment", "Documentation"],
  },
  "RAD-MRI-008": {
    references: [],
    referenced_by: [],
    shared_topics: ["Patient screening", "Safety protocols"],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSopTitle(sopId: string): string {
  const sop = MOCK_SOPS.find((s) => s.sop_id === sopId)
  return sop ? sop.title : sopId
}

function getSopDept(sopId: string): string {
  const sop = MOCK_SOPS.find((s) => s.sop_id === sopId)
  return sop ? sop.department : ""
}

function isICU(sopId: string): boolean {
  const dept = getSopDept(sopId).toLowerCase()
  return dept.includes("icu") || dept.includes("critical")
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImpactMapPage() {
  const [selectedSopId, setSelectedSopId] = useState("IC-PPE-001")
  const [scanState, setScanState] = useState<"idle" | "running" | "done">("idle")
  const [scanProgress, setScanProgress] = useState(0)
  const [taskCreated, setTaskCreated] = useState<Record<string, boolean>>({})

  const impact = IMPACT_MAP[selectedSopId] ?? {
    references: [],
    referenced_by: [],
    shared_topics: [],
  }

  const handleScan = () => {
    setScanState("running")
    setScanProgress(0)
    const interval = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) {
          clearInterval(interval)
          setScanState("done")
          return 100
        }
        return p + 5
      })
    }, 100)
  }

  const handleCreateTask = (sopId: string) => {
    setTaskCreated((prev) => ({ ...prev, [sopId]: true }))
  }

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Cross-SOP Impact Mapping" }]} />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
            <GitBranch className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#1A2332] font-display">Cross-SOP Impact Mapping</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              See which SOPs are affected when one changes.
            </p>
          </div>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            When a SOP changes, SOPs that reference it or share procedures must be reviewed for consistency.
          </span>
        </div>

        {/* SOP Selector */}
        <div>
          <label className="text-xs text-[#64748B] mb-2 block">Select SOP to analyze</label>
          <div className="flex flex-wrap gap-2">
            {MOCK_SOPS.map((sop) => (
              <button
                key={sop.sop_id}
                onClick={() => {
                  setSelectedSopId(sop.sop_id)
                  setScanState("idle")
                  setScanProgress(0)
                  setTaskCreated({})
                }}
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

        {/* Impact Network */}
        <div>
          <h2 className="text-lg font-medium text-[#1A2332] mb-3">
            Impact Network -{" "}
            <span className="text-[#0B6BCB]">{selectedSopId}</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-4 items-start">
            {/* References (this SOP depends on) */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowLeft className="w-4 h-4 text-[#B45309] dark:text-amber-400" />
                <span className="text-sm font-medium text-[#B45309] dark:text-amber-400">
                  References ({impact.references.length})
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mb-3">SOPs this SOP mentions or depends on</p>
              {impact.references.length === 0 ? (
                <div className="bg-card border border-[#E2E8F0] rounded-xl p-4 text-xs text-[#94A3B8]">
                  No references - this SOP is self-contained
                </div>
              ) : (
                <div className="space-y-2">
                  {impact.references.map((sopId) => (
                    <div
                      key={sopId}
                      className="bg-card border border-[#FDE68A] dark:border-amber-500/30 rounded-xl p-3"
                    >
                      <p className="text-xs font-medium text-[#B45309] dark:text-amber-400">{sopId}</p>
                      <p className="text-xs text-[#64748B] mt-1 leading-snug">{getSopTitle(sopId)}</p>
                      <p className="text-[10px] text-[#94A3B8] mt-1">{getSopDept(sopId)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Center - Selected SOP */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-4 h-4 text-[#0B6BCB]" />
                <span className="text-sm font-medium text-[#0B6BCB]">Selected SOP</span>
              </div>
              <p className="text-xs text-[#94A3B8] mb-3">The SOP being analyzed</p>
              <div className="bg-card border-2 border-[#0B6BCB]/50 rounded-xl p-4">
                <p className="text-xs font-semibold text-[#0B6BCB] mb-1">{selectedSopId}</p>
                <p className="text-xs text-[#1A2332] font-medium leading-snug">
                  {getSopTitle(selectedSopId)}
                </p>
                <p className="text-[10px] text-[#94A3B8] mt-1">{getSopDept(selectedSopId)}</p>
                {impact.referenced_by.length > 0 && (
                  <div className="mt-3 p-2 rounded-lg bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30">
                    <p className="text-xs text-[#B45309] dark:text-amber-400 font-medium">
                      If this SOP changes, {impact.referenced_by.length} other SOP
                      {impact.referenced_by.length > 1 ? "s" : ""} may need review
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Referenced By (SOPs that depend on this) */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="w-4 h-4 text-[#B91C1C] dark:text-red-400" />
                <span className="text-sm font-medium text-[#B91C1C] dark:text-red-400">
                  Referenced By ({impact.referenced_by.length})
                </span>
              </div>
              <p className="text-xs text-[#94A3B8] mb-3">SOPs that depend on this SOP</p>
              {impact.referenced_by.length === 0 ? (
                <div className="bg-card border border-[#E2E8F0] rounded-xl p-4 text-xs text-[#94A3B8]">
                  No other SOPs reference this one
                </div>
              ) : (
                <div className="space-y-2">
                  {impact.referenced_by.map((sopId) => (
                    <div
                      key={sopId}
                      className="bg-card border border-[#FECACA] dark:border-red-500/30 rounded-xl p-3"
                    >
                      <p className="text-xs font-medium text-[#B91C1C] dark:text-red-400">{sopId}</p>
                      <p className="text-xs text-[#64748B] mt-1 leading-snug">{getSopTitle(sopId)}</p>
                      <p className="text-[10px] text-[#94A3B8] mt-1">{getSopDept(sopId)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Shared Topics */}
          {impact.shared_topics.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-[#64748B]" />
                <span className="text-sm font-medium text-[#334155]">Shared Clinical Topics</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {impact.shared_topics.map((topic) => (
                  <span
                    key={topic}
                    className="text-xs text-[#64748B] border border-[#CBD5E1] rounded px-2 py-0.5"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Impact Analysis */}
        {impact.referenced_by.length > 0 && (
          <section>
            <h2 className="text-lg font-medium text-[#1A2332] mb-3">Impact Analysis</h2>
            <div className="space-y-3">
              {impact.referenced_by.map((sopId) => {
                const priority = isICU(sopId) ? "high" : "medium"
                return (
                  <div
                    key={sopId}
                    className="bg-card border border-[#E2E8F0] rounded-xl p-4 flex items-start justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[#64748B] border border-[#CBD5E1] rounded px-2 py-0.5">
                          {sopId}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            priority === "high"
                              ? "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30"
                              : "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30"
                          )}
                        >
                          {priority === "high" ? "High Priority" : "Medium Priority"}
                        </span>
                      </div>
                      <p className="text-sm text-[#1A2332] mt-1.5 font-medium">{getSopTitle(sopId)}</p>
                      <p className="text-xs text-[#64748B] mt-1">
                        Review required - references {selectedSopId}&apos;s shared topics:{" "}
                        {impact.shared_topics.slice(0, 2).join(", ")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCreateTask(sopId)}
                      disabled={taskCreated[sopId]}
                      className={cn(
                        "shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
                        taskCreated[sopId]
                          ? "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30"
                          : "bg-[#0B6BCB]/10 text-[#0B6BCB] hover:bg-[#0B6BCB]/20 border border-[#0B6BCB]/30"
                      )}
                    >
                      {taskCreated[sopId] ? (
                        <>
                          <CheckCircle className="w-3 h-3" /> Task Created
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" /> Create Review Task
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Full Impact Scan */}
        <section>
          <h2 className="text-lg font-medium text-[#1A2332] mb-3">Full Impact Scan</h2>
          <div className="bg-card border border-[#E2E8F0] rounded-xl p-5 space-y-4">
            {scanState === "idle" && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#64748B]">
                  Run a full analysis across all SOPs to detect cross-reference dependencies.
                </p>
                <button
                  onClick={handleScan}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#0B6BCB] hover:bg-[#0959AC] text-white transition-colors"
                >
                  <GitBranch className="w-4 h-4" /> Run Scan
                </button>
              </div>
            )}

            {scanState === "running" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-[#0B6BCB]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning cross-SOP references...
                </div>
                <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[#0B6BCB]"
                    animate={{ width: `${scanProgress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <p className="text-xs text-[#94A3B8]">{scanProgress}% complete</p>
              </div>
            )}

            {scanState === "done" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 text-sm text-[#15803D] dark:text-green-400">
                  <CheckCircle className="w-4 h-4" /> Scan complete
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 p-3">
                    <p className="text-[#B45309] dark:text-amber-400 text-sm font-medium">
                      3 SOPs require cross-reference review
                    </p>
                    <p className="text-xs text-[#64748B] mt-1">
                      IC-PPE-001, IC-CL-005, ICU-SEP-002 have mutual dependencies
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted border border-[#E2E8F0] p-3">
                    <p className="text-[#334155] text-sm font-medium">
                      2 shared clinical topics may be affected
                    </p>
                    <p className="text-xs text-[#64748B] mt-1">
                      Hand hygiene, PPE requirements appear in multiple SOPs
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setScanState("idle")}
                  className="text-xs text-[#64748B] hover:text-[#334155] transition-colors"
                >
                  Run again
                </button>
              </motion.div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
