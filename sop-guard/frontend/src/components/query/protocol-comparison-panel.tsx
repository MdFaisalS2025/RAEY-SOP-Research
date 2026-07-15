"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, ExternalLink, Loader2, GitCompare, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

type RowStatus = "match" | "partial_match" | "missing_from_sop"
type ComparisonMode = "curated" | "dynamic"
type EvidenceGrade = "Strong" | "Moderate" | "Limited" | "Research Only" | "Outdated" | "Unknown"

interface ComparisonRow {
  reference_step: string
  matched_internal_step: string | null
  status: RowStatus
  similarity: number
  source_name?: string
  source_type?: string
  url?: string
  pub_date?: string
  grade?: EvidenceGrade
}

interface ComparisonResponse {
  available: boolean
  reason?: string
  sop_id?: string
  sop_title?: string
  sop_version?: string
  mode?: ComparisonMode
  reference_source?: { name: string; source_type: string; publisher: string; year: number; url: string } | null
  rows?: ComparisonRow[]
  sop_only_steps?: string[]
  summary?: {
    match_count: number
    partial_count: number
    missing_count: number
    sop_only_count: number
    total_reference_steps: number
    overall_alignment: "Aligned" | "Partially Aligned" | "Needs Review"
    recommended_action: string
  }
}

const GRADE_STYLE: Record<EvidenceGrade, string> = {
  "Strong": "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
  "Moderate": "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30",
  "Limited": "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
  "Research Only": "bg-card text-muted-foreground border-input",
  "Outdated": "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30",
  "Unknown": "bg-muted text-subtle border-border",
}

const STATUS_META: Record<RowStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  match: { label: "Match", icon: CheckCircle2, className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30" },
  partial_match: { label: "Partial Match", icon: AlertTriangle, className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30" },
  missing_from_sop: { label: "Missing from SOP", icon: XCircle, className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30" },
}

const ALIGNMENT_META: Record<string, { className: string }> = {
  "Aligned": { className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30" },
  "Partially Aligned": { className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30" },
  "Needs Review": { className: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30" },
}

function AlignmentSummaryCard({ summary }: { summary: NonNullable<ComparisonResponse["summary"]> }) {
  const meta = ALIGNMENT_META[summary.overall_alignment] ?? ALIGNMENT_META["Needs Review"]
  return (
    <div className="rounded-2xl bg-card border border-border p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#0B6BCB]" /> Comparison Summary
        </h3>
        <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border", meta.className)}>
          {summary.overall_alignment}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="rounded-xl bg-muted p-3">
          <p className="text-2xl font-bold font-display text-[#15803D] dark:text-green-400">{summary.match_count}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Match</p>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <p className="text-2xl font-bold font-display text-[#B45309] dark:text-amber-400">{summary.partial_count}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Partial Match</p>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <p className="text-2xl font-bold font-display text-[#B91C1C] dark:text-red-400">{summary.missing_count}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Missing from SOP</p>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <p className="text-2xl font-bold font-display text-muted-foreground">{summary.sop_only_count}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">SOP Only</p>
        </div>
      </div>
      <p className="text-sm text-foreground pt-2 border-t border-border">
        <span className="font-semibold">Recommended action: </span>{summary.recommended_action}
      </p>
    </div>
  )
}

function ComparisonMatrix({ rows, mode }: { rows: ComparisonRow[]; mode?: ComparisonMode }) {
  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                {mode === "dynamic" ? "External Evidence" : "External Protocol Step"}
              </th>
              <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Matched Internal SOP Step</th>
              <th className="px-4 py-2.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const meta = STATUS_META[row.status]
              return (
                <tr key={i} className="border-b border-border last:border-b-0 align-top">
                  <td className="px-4 py-3 text-foreground">
                    <p>{row.reference_step}</p>
                    {(row.source_name || row.grade) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {row.grade && (
                          <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border", GRADE_STYLE[row.grade])}>
                            {row.grade}
                          </span>
                        )}
                        {row.source_name && (
                          <span className="text-[11px] text-muted-foreground">{row.source_name}{row.pub_date ? ` · ${row.pub_date}` : ""}</span>
                        )}
                        {row.url && (
                          <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-[#0B6BCB] hover:underline">
                            <ExternalLink className="w-2.5 h-2.5" /> Source
                          </a>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.matched_internal_step ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap", meta.className)}>
                      <meta.icon className="w-3 h-3" /> {meta.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ProtocolComparisonPanel({ sopId }: { sopId: string }) {
  const [data, setData] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${API_BASE}/api/sops/${encodeURIComponent(sopId)}/protocol-comparison`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData({ available: false, reason: "Could not load the protocol comparison." }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sopId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-12">
        <Loader2 className="w-4 h-4 animate-spin" /> Comparing internal SOP against external protocol...
      </div>
    )
  }

  if (!data?.available || !data.summary || !data.rows) {
    return (
      <div className="rounded-2xl bg-muted border border-border p-8 text-center">
        <GitCompare className="w-8 h-8 text-subtle mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">{data?.reason ?? "No protocol comparison available for this SOP."}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30">
        <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-[#B45309] dark:text-amber-400">
          External evidence is for reference and must be reviewed by the appropriate hospital committee before any SOP change.
          This comparison does not replace clinical judgment.
        </p>
      </div>

      {data.reference_source ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0B6BCB]" />
          Compared against
          <span className="font-medium text-foreground">{data.reference_source.name}</span>
          <span className="px-1.5 py-0.5 rounded bg-muted border border-border">{data.reference_source.source_type}</span>
          <span>{data.reference_source.publisher} · {data.reference_source.year}</span>
          {data.reference_source.url && (
            <a href={data.reference_source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#0B6BCB] hover:underline">
              View source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ) : data.mode === "dynamic" && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0B6BCB] shrink-0 mt-0.5" />
          <span>
            Compared against <span className="font-medium text-foreground">{data.rows?.length ?? 0} auto-selected, high-grade external sources</span>{" "}
            (Strong/Moderate evidence only — see each row&apos;s source below). No single structured guideline bundle exists for this SOP yet, so this
            reflects topical coverage across the best available literature titles, not a step-by-step comparison against one vetted protocol.
          </span>
        </div>
      )}

      {data.summary.overall_alignment !== "Aligned" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30">
          <AlertTriangle className="w-4 h-4 text-[#B91C1C] dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-[#B91C1C] dark:text-red-400">
            Potential SOP-evidence difference detected. Committee review recommended.
          </p>
        </div>
      )}

      <AlignmentSummaryCard summary={data.summary} />
      <ComparisonMatrix rows={data.rows} mode={data.mode} />

      {data.sop_only_steps && data.sop_only_steps.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <MinusCircle className="w-3.5 h-3.5" /> SOP-Only Steps (not in {data.mode === "dynamic" ? "the compared evidence" : "reference bundle"})
          </p>
          <ul className="space-y-1.5">
            {data.sop_only_steps.map((s, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-subtle mt-1.5 shrink-0" /> {s}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-subtle mt-2">Extra steps in your SOP not reflected in the compared external material - not necessarily a problem, just outside its scope.</p>
        </div>
      )}
    </div>
  )
}
