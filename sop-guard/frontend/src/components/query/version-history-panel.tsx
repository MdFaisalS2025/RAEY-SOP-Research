"use client"

import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, History, GraduationCap, ClipboardCheck, Gavel, FlaskConical } from "lucide-react"
import { cn } from "@/lib/utils"
import { DiffView, DiffStatsRow, type DiffSegment, type DiffStats } from "@/components/governance/diff-view"
import { Card } from "@/components/ui/card"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

export interface SOPVersion {
  id: number
  version_number: string
  status: "current" | "archived"
  effective_date: string
  archived_date: string
  changed_by: string
  changed_by_role: string
  approved_by: string
  committee_name: string
  committee_comment: string
  reason_for_change: string
  evidence_used: string
  change_category: string
  summary_of_changes: string
  affected_sections: string[]
  training_required: boolean
  acknowledgment_required: boolean
  created_at: string
}

const CHANGE_CATEGORY_LABEL: Record<string, string> = {
  new_evidence: "New Evidence",
  outdated_information: "Outdated Information",
  safety_improvement: "Safety Improvement",
  better_clinical_outcomes: "Better Clinical Outcomes",
  compliance_requirement: "Compliance Requirement",
  legal_risk_update: "Legal / Risk Update",
  workflow_improvement: "Workflow Improvement",
  department_request: "Department Request",
  annual_review: "Annual Review",
}

export function CommitteeCommentCard({ version }: { version: SOPVersion }) {
  return (
    <div className="rounded-xl bg-muted border border-border p-4 space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Gavel className="w-3.5 h-3.5 text-primary" /> {version.committee_name || "Committee"}
        </span>
        <span className="text-xs text-muted-foreground">{version.effective_date}</span>
        {version.change_category && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/30">
            {CHANGE_CATEGORY_LABEL[version.change_category] ?? version.change_category}
          </span>
        )}
      </div>
      {version.committee_comment && (
        <p className="text-sm text-foreground leading-relaxed">&ldquo;{version.committee_comment}&rdquo;</p>
      )}
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border">
        <p><span className="font-medium text-foreground">Reason: </span>{version.reason_for_change || "—"}</p>
        <p><span className="font-medium text-foreground">Evidence used: </span>{version.evidence_used || "—"}</p>
        <p><span className="font-medium text-foreground">Changed by: </span>{version.changed_by} ({version.changed_by_role})</p>
        <p><span className="font-medium text-foreground">Approved by: </span>{version.approved_by || "—"}</p>
      </div>
      {(version.training_required || version.acknowledgment_required) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {version.training_required && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warn-soft text-warn-soft-fg border border-warn-soft-border">
              <GraduationCap className="w-3 h-3" /> Training required
            </span>
          )}
          {version.acknowledgment_required && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-card text-muted-foreground border border-input">
              <ClipboardCheck className="w-3 h-3" /> Acknowledgment required
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function VersionDiff({ sopId, versionNumber, fromVersion }: { sopId: string; versionNumber: string; fromVersion?: string }) {
  const [diff, setDiff] = useState<{ available: boolean; reason?: string; segments: DiffSegment[]; stats?: DiffStats; from_version?: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    setDiff(null)
    const query = fromVersion ? `?from_version=${encodeURIComponent(fromVersion)}` : ""
    fetch(`${API_BASE}/api/sops/${encodeURIComponent(sopId)}/version-history/${encodeURIComponent(versionNumber)}/diff${query}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setDiff(d) })
      .catch(() => { if (!cancelled) setDiff({ available: false, reason: "Could not load diff.", segments: [] }) })
    return () => { cancelled = true }
  }, [sopId, versionNumber, fromVersion])

  if (!diff) return <div className="flex items-center gap-2 text-xs text-muted-foreground py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading diff...</div>
  if (!diff.available) return <p className="text-xs text-muted-foreground py-2">{diff.reason ?? "No prior version to compare against."}</p>

  return (
    <div className="space-y-2">
      {diff.stats && <DiffStatsRow stats={diff.stats} />}
      <DiffView segments={diff.segments} />
    </div>
  )
}

// ─── Compare-any-two-versions picker ─────────────────────────────────────────

function VersionComparePicker({ sopId, versions }: { sopId: string; versions: SOPVersion[] }) {
  const sorted = [...versions].sort((a, b) => a.version_number.localeCompare(b.version_number, undefined, { numeric: true }))
  const [fromVersion, setFromVersion] = useState(sorted[0]?.version_number ?? "")
  const [toVersion, setToVersion] = useState(sorted[sorted.length - 1]?.version_number ?? "")
  const [compared, setCompared] = useState<{ from: string; to: string } | null>(null)

  if (sorted.length < 2) return null

  return (
    <Card padding="sm" className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compare versions</p>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Compare from version" value={fromVersion} onChange={(e) => setFromVersion(e.target.value)}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
          {sorted.map((v) => <option key={v.id} value={v.version_number}>v{v.version_number}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">vs.</span>
        <select aria-label="Compare to version" value={toVersion} onChange={(e) => setToVersion(e.target.value)}
          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
          {sorted.map((v) => <option key={v.id} value={v.version_number}>v{v.version_number}</option>)}
        </select>
        <button
          onClick={() => setCompared({ from: fromVersion, to: toVersion })}
          disabled={fromVersion === toVersion}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors">
          Compare
        </button>
      </div>
      {compared && compared.from !== compared.to && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">v{compared.from} &rarr; v{compared.to}</p>
          <VersionDiff sopId={sopId} versionNumber={compared.to} fromVersion={compared.from} />
        </div>
      )}
    </Card>
  )
}

export function VersionTimeline({ sopId }: { sopId: string }) {
  const [versions, setVersions] = useState<SOPVersion[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${API_BASE}/api/sops/${encodeURIComponent(sopId)}/version-history`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setVersions(d.versions ?? []) })
      .catch(() => { if (!cancelled) setVersions([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sopId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-12">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading version history...
      </div>
    )
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="rounded-2xl bg-muted border border-border p-8 text-center">
        <History className="w-8 h-8 text-subtle mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No version history recorded for this SOP yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {versions.map((v, i) => {
        const isOpen = expanded === v.version_number
        const isLast = i === versions.length - 1
        return (
          <div key={v.id} className="relative pl-8">
            {!isLast && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
            <div className={cn(
              "absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center",
              v.status === "current" ? "bg-primary border-primary" : "bg-card border-border"
            )}>
              <FlaskConical className={cn("w-3 h-3", v.status === "current" ? "text-white" : "text-subtle")} />
            </div>
            <button
              onClick={() => setExpanded(isOpen ? null : v.version_number)}
              className="w-full text-left pb-6 group"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">v{v.version_number}</span>
                {v.status === "current" && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/30 uppercase tracking-wide">
                    Current Approved Version
                  </span>
                )}
                <span className="text-xs text-muted-foreground">Effective {v.effective_date}{v.archived_date ? ` – ${v.archived_date}` : ""}</span>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
              </div>
              <p className="text-sm text-muted-foreground mt-1 group-hover:text-foreground transition-colors">{v.summary_of_changes}</p>
            </button>
            {isOpen && (
              <div className="pb-6 space-y-3">
                <CommitteeCommentCard version={v} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Old vs. New</p>
                  <VersionDiff sopId={sopId} versionNumber={v.version_number} />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function LatestVersionBadge({
  sopId, sopTitle, version, effectiveDate, onViewHistory,
}: {
  sopId: string
  sopTitle: string
  version: string
  effectiveDate: string
  onViewHistory: () => void
}) {
  if (!version) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground px-1">
      <History className="w-3.5 h-3.5 text-primary" />
      <span>
        Answer generated from latest approved SOP version:{" "}
        <span className="font-semibold text-foreground">v{version}</span>
        {effectiveDate && <> approved on {effectiveDate}</>}
      </span>
      <button onClick={onViewHistory} className="text-primary hover:underline font-medium">
        View SOP Version History
      </button>
    </div>
  )
}

export function VersionHistoryPanel({ sopId }: { sopId: string }) {
  const [versions, setVersions] = useState<SOPVersion[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/sops/${encodeURIComponent(sopId)}/version-history`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setVersions(d.versions ?? []) })
      .catch(() => { if (!cancelled) setVersions([]) })
    return () => { cancelled = true }
  }, [sopId])

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-warn-soft border border-warn-soft-border">
        <History className="w-4 h-4 text-warn-soft-fg shrink-0 mt-0.5" />
        <p className="text-xs text-warn-soft-fg">
          This response supports SOP review and clinical workflow. It does not replace approved hospital policy or clinical judgment.
        </p>
      </div>
      {versions.length >= 2 && <VersionComparePicker sopId={sopId} versions={versions} />}
      <VersionTimeline sopId={sopId} />
    </div>
  )
}
