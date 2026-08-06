"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, ExternalLink, Loader2, GitCompare, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { IllustrativeNote } from "@/components/ui/illustrative-note"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

type RowStatus = "match" | "partial_match" | "missing_from_sop"
//  curated:           REFERENCE_PROTOCOLS - a hand-transcribed bundle.
//  dynamic_guideline: a real, retrieved guideline's extracted recommendation
//                      sentences (guideline_finder.py) - real sentences from
//                      the right document, not a paper title.
//  dynamic:           the topic-coverage fallback - reference "steps" are
//                      literally paper titles, only used when no guideline
//                      document could be found or extracted from.
type ComparisonMode = "curated" | "dynamic_guideline" | "dynamic"
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
  /** Only set for dynamic_guideline rows - whether reference_step is a
   * verbatim sentence from the guideline's abstract, and where. */
  fidelity?: "verbatim" | "paraphrase" | null
  source_locus?: string | null
}

type ReasonCode = "no_internal_steps" | "providers_unreachable" | "no_qualifying_evidence"

export interface ComparisonResponse {
  available: boolean
  reason?: string
  /** Distinguishes a genuine negative (no_qualifying_evidence), a
   * structural non-starter (no_internal_steps), and an outage
   * (providers_unreachable) - only the last of those should ever look
   * retryable. */
  reason_code?: ReasonCode
  sop_id?: string
  sop_title?: string
  sop_version?: string
  mode?: ComparisonMode
  reference_source?: { name: string; source_type: string; publisher: string; year: number; url: string } | null
  /** Which similarity method actually scored these rows - "cosine" when a
   * dense embedding model is loaded, "lexical" (word-overlap) otherwise.
   * Surfaced so a physician isn't left guessing why a match feels loose. */
  similarity_method?: "cosine" | "lexical"
  similarity_method_label?: string
  thresholds?: { match: number; partial: number; sop_only: number }
  rows?: ComparisonRow[]
  sop_only_steps?: string[]
  weakly_related_steps?: { text: string; similarity: number }[]
  /** Only set in curated (offline-fallback) mode - discloses that live
   * guideline retrieval was unavailable and this is a stored, hand-
   * transcribed comparison instead, with real verbatim/paraphrase counts. */
  fallback_note?: string
  summary?: {
    match_count: number
    partial_count: number
    missing_count: number
    sop_only_count: number
    total_reference_steps: number
    overall_alignment: "Aligned" | "Partially Aligned" | "Needs Review"
    /** Grade-weighted coverage ratio behind overall_alignment - null when
     * there were no reference items to weight against. */
    alignment_score: number | null
    recommended_action: string
    reference_side: { match: number; partial: number; missing: number; total: number }
    sop_side: { covered: number; weakly_related: number; sop_only: number; total: number }
  }
}

const GRADE_STYLE: Record<EvidenceGrade, string> = {
  "Strong": "bg-ok-soft text-ok-soft-fg border-ok-soft-border",
  "Moderate": "bg-primary/10 text-primary border-primary/30",
  "Limited": "bg-warn-soft text-warn-soft-fg border-warn-soft-border",
  "Research Only": "bg-card text-muted-foreground border-input",
  "Outdated": "bg-danger-soft text-danger-soft-fg border-danger-soft-border",
  "Unknown": "bg-muted text-subtle border-border",
}

const STATUS_META: Record<RowStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  match: { label: "Match", icon: CheckCircle2, className: "bg-ok-soft text-ok-soft-fg border-ok-soft-border" },
  partial_match: { label: "Partial Match", icon: AlertTriangle, className: "bg-warn-soft text-warn-soft-fg border-warn-soft-border" },
  missing_from_sop: { label: "Missing from SOP", icon: XCircle, className: "bg-danger-soft text-danger-soft-fg border-danger-soft-border" },
}

const ALIGNMENT_META: Record<string, { className: string }> = {
  "Aligned": { className: "bg-ok-soft text-ok-soft-fg border-ok-soft-border" },
  "Partially Aligned": { className: "bg-warn-soft text-warn-soft-fg border-warn-soft-border" },
  "Needs Review": { className: "bg-danger-soft text-danger-soft-fg border-danger-soft-border" },
}

function AlignmentSummaryCard({ summary }: { summary: NonNullable<ComparisonResponse["summary"]> }) {
  const meta = ALIGNMENT_META[summary.overall_alignment] ?? ALIGNMENT_META["Needs Review"]
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-primary" /> Comparison Summary
        </h3>
        <div className="flex items-center gap-2">
          {summary.alignment_score !== null && (
            <span className="text-[11px] text-subtle" title="Grade-weighted coverage of reference points by the SOP.">
              {(summary.alignment_score * 100).toFixed(0)}% weighted coverage
            </span>
          )}
          <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border", meta.className)}>
            {summary.overall_alignment}
          </span>
        </div>
      </div>

      {/* Reconcilable tiles: each row sums exactly to its own labeled
          total, rather than mixing a reference-side denominator with an
          internal-side one under one implied total. */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle mb-1.5">
          Reference points ({summary.reference_side.total})
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-muted p-3">
            <p className="text-2xl font-bold font-display text-ok-soft-fg">{summary.reference_side.match}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Match</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-2xl font-bold font-display text-warn-soft-fg">{summary.reference_side.partial}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Partial Match</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-2xl font-bold font-display text-danger-soft-fg">{summary.reference_side.missing}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Missing from SOP</p>
          </div>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle mb-1.5">
          Internal SOP steps ({summary.sop_side.total})
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-muted p-3">
            <p className="text-2xl font-bold font-display text-ok-soft-fg">{summary.sop_side.covered}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Covered</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-2xl font-bold font-display text-muted-foreground">{summary.sop_side.weakly_related}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Weakly Related</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <p className="text-2xl font-bold font-display text-muted-foreground">{summary.sop_side.sop_only}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">SOP Only</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-foreground pt-2 border-t border-border">
        <span className="font-semibold">Recommended action: </span>{summary.recommended_action}
      </p>
    </Card>
  )
}

function ComparisonMatrix({ rows, mode }: { rows: ComparisonRow[]; mode?: ComparisonMode }) {
  return (
    <Card padding="none" className="overflow-hidden">
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
                        {row.fidelity === "verbatim" && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border bg-ok-soft text-ok-soft-fg border-ok-soft-border" title="This is the guideline's own wording, not a paraphrase.">
                            Verbatim
                          </span>
                        )}
                        {row.fidelity === "paraphrase" && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border bg-muted text-muted-foreground border-border" title="A paraphrase of the guideline's wording, not a direct quotation.">
                            Paraphrase
                          </span>
                        )}
                        {row.source_name && (
                          <span className="text-[11px] text-muted-foreground">{row.source_name}{row.pub_date ? ` · ${row.pub_date}` : ""}</span>
                        )}
                        {row.source_locus && (
                          <span className="text-[11px] text-subtle">{row.source_locus}</span>
                        )}
                        {row.url && (
                          <a href={row.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline">
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
                    {/* Computed but previously discarded - the strongest
                        available auditability signal for a status label
                        that otherwise reads as a black box. */}
                    <p className="text-[10px] text-subtle mt-1" title={`Similarity score (${row.similarity.toFixed(3)}) that produced this status.`}>
                      {(row.similarity * 100).toFixed(0)}% match
                    </p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export function ProtocolComparisonPanel({ sopId, preloaded }: { sopId: string; preloaded?: ComparisonResponse | null }) {
  const [data, setData] = useState<ComparisonResponse | null>(preloaded ?? null)
  const [loading, setLoading] = useState(!preloaded)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    // If the physician already saw this via the inline alignment status
    // (chat-answer-message.tsx auto-fetches the same endpoint as soon as
    // the answer's SOP is known), reuse that instead of re-fetching and
    // making them wait again just to open this drawer.
    if (preloaded && retryToken === 0) {
      setData(preloaded)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setFetchFailed(false)
    fetch(`${API_BASE}/api/sops/${encodeURIComponent(sopId)}/protocol-comparison`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) { setData(null); setFetchFailed(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sopId, preloaded, retryToken])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-12">
        <Loader2 className="w-4 h-4 animate-spin" /> Comparing with clinical evidence...
      </div>
    )
  }

  const retry = () => setRetryToken((t) => t + 1)

  // The connectivity/request failure itself (network error, non-2xx, this
  // component's own fetch never completing) - distinct from the backend
  // successfully responding "no comparison available" for a stated reason.
  if (fetchFailed) {
    return <ErrorState message="Could not load the protocol comparison." onRetry={retry} />
  }

  if (!data?.available || !data.summary || !data.rows) {
    if (data?.reason_code === "providers_unreachable") {
      return <ErrorState message={data.reason ?? "External evidence providers could not be reached."} onRetry={retry} />
    }
    if (data?.reason_code === "no_internal_steps") {
      return (
        <EmptyState
          icon={GitCompare}
          title="This SOP has no parsed procedure steps"
          description={data.reason ?? "No comparison can be built until this SOP's steps are structured."}
        />
      )
    }
    return (
      <EmptyState
        icon={GitCompare}
        title="No protocol comparison available"
        description={data?.reason ?? "No sufficiently strong or moderate-grade external evidence was found for this SOP's topic."}
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground px-1">
        Meridian compared the SOP with current clinical evidence. Review with the appropriate committee before any SOP change.
      </p>

      {data.similarity_method_label && data.thresholds && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <span>
            Matching: {data.similarity_method_label}. Match &ge; {data.thresholds.match}, partial &ge; {data.thresholds.partial}.
          </span>
        </div>
      )}
      {data.similarity_method === "lexical" && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-warn-soft border border-warn-soft-border text-warn-soft-fg text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>No embedding model is loaded, so matching falls back to word overlap. It will miss steps that say the same thing in different words.</span>
        </div>
      )}

      {data.reference_source ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          Compared against
          <span className="font-medium text-foreground">{data.reference_source.name}</span>
          <span className="px-1.5 py-0.5 rounded bg-muted border border-border">{data.reference_source.source_type}</span>
          <span>{data.reference_source.publisher} · {data.reference_source.year}</span>
          {data.reference_source.url && (
            <a href={data.reference_source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              {/* Not "View source" in curated mode - the rows below are a
                  stored transcription, not the source itself. */}
              {data.mode === "curated" ? "Published guideline" : "View source"} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      ) : data.mode === "dynamic" && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            Compared against <span className="font-medium text-foreground">{data.rows?.length ?? 0} auto-selected, high-grade external sources</span>{" "}
            (Strong/Moderate evidence only — see each row&apos;s source below). No guideline document could be retrieved for this topic, so this
            reflects topical coverage across the best available literature titles, not a step-by-step comparison against one vetted protocol.
          </span>
        </div>
      )}

      {data.mode === "dynamic_guideline" && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <span>
            Retrieved automatically and compared against sentences extracted from this guideline&apos;s abstract only - not its full text,
            which isn&apos;t available through any connected source. &ldquo;Verbatim&rdquo; rows are the guideline&apos;s own wording; review against
            the published guideline before acting on this comparison.
          </span>
        </div>
      )}

      {data.mode === "curated" && data.fallback_note && (
        <IllustrativeNote detail={data.fallback_note} />
      )}

      {data.summary.overall_alignment === "Partially Aligned" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-warn-soft border border-warn-soft-border">
          <AlertTriangle className="w-4 h-4 text-warn-soft-fg shrink-0 mt-0.5" />
          <p className="text-xs text-warn-soft-fg">
            Some recommendations differ from the current SOP. Review may be useful.
          </p>
        </div>
      )}
      {data.summary.overall_alignment === "Needs Review" && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-danger-soft border border-danger-soft-border">
          <AlertTriangle className="w-4 h-4 text-danger-soft-fg shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-danger-soft-fg">
            Meaningful differences from current evidence. Committee review recommended.
          </p>
        </div>
      )}

      <AlignmentSummaryCard summary={data.summary} />
      <ComparisonMatrix rows={data.rows} mode={data.mode} />

      {data.sop_only_steps && data.sop_only_steps.length > 0 && (
        <Card padding="sm">
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
        </Card>
      )}

      {data.weakly_related_steps && data.weakly_related_steps.length > 0 && (
        <details className="group rounded-xl bg-muted/50 border border-border px-3 py-2">
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
            {data.weakly_related_steps.length} internal step{data.weakly_related_steps.length === 1 ? "" : "s"} are loosely related to the reference material
          </summary>
          <ul className="space-y-1.5 mt-2">
            {data.weakly_related_steps.map((s, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-subtle mt-1.5 shrink-0" />
                <span>{s.text} <span className="text-[10px] text-subtle">({(s.similarity * 100).toFixed(0)}% similar)</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
