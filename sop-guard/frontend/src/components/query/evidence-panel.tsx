"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, Loader2, SearchX, FileText, ShieldCheck, FlaskConical, type LucideIcon } from "lucide-react"
import { SafetyNote } from "@/components/ui/safety-note"

const COLLAPSED_COUNT = 3

interface EvidenceRecord {
  title: string
  authors: string
  journal: string
  journal_display_name?: string
  trust_tier?: 1 | 2 | 3
  pub_date: string
  pub_date_parsed?: string | null
  pmid: string
  url: string
  source_type: string
  study_type?: string
  stance?: "yes" | "no" | "unclear"
  evidence_grade?: "Strong" | "Moderate" | "Limited" | "Research Only" | "Outdated" | "Unknown"
  // The sentence from the source's abstract that actually supports the
  // answer (see pick_supporting_excerpt in the backend) - empty when no
  // abstract was available, in which case the card falls back to
  // title-only, exactly the pre-P1.3 behavior.
  supporting_excerpt?: string
}

const TRUST_TIER_LABEL: Record<number, string> = {
  1: "Tier 1 · Flagship Journal",
  2: "Tier 2 · Indexed",
  3: "Tier 3 · Unranked",
}

const SOURCE_LABEL: Record<string, string> = {
  pubmed: "PubMed",
  europepmc: "Europe PMC",
  cdc: "CDC",
  who: "WHO",
  clinicaltrials: "ClinicalTrials.gov",
  fda: "FDA",
  medlineplus: "MedlinePlus",
  cms: "CMS",
}

type EvidenceGrade = "Strong" | "Moderate" | "Limited" | "Research Only" | "Outdated" | "Unknown"

const GRADE_STYLE: Record<EvidenceGrade, string> = {
  "Strong": "bg-ok-soft text-ok-soft-fg border-ok-soft-border",
  "Moderate": "bg-primary/10 text-primary border-primary/30",
  "Limited": "bg-warn-soft text-warn-soft-fg border-warn-soft-border",
  "Research Only": "bg-card text-muted-foreground border-input",
  "Outdated": "bg-danger-soft text-danger-soft-fg border-danger-soft-border",
  "Unknown": "bg-muted text-subtle border-border",
}

const _STRONG_STUDY_TYPES = new Set(["Meta-Analysis", "Systematic Review", "Practice Guideline", "Guideline"])
const _MODERATE_STUDY_TYPES = new Set(["Randomized Controlled Trial", "Clinical Trial"])

/**
 * Coarse evidence grade, in the spirit of GRADE-style clinical evidence
 * tools - derived entirely from data already on the record (trust_tier,
 * study_type, publication recency), not a second network call. "Outdated"
 * only fires for non-guideline evidence older than 5 years - a decade-old
 * practice guideline can still be current; a decade-old case report can't
 * speak to it.
 */
function gradeEvidence(r: EvidenceRecord): EvidenceGrade {
  // Prefer the server-computed grade (evidence_registry.py now attaches
  // this to every record and sorts by it) so the badge always matches the
  // ranking that determined the list order - only recompute client-side
  // as a fallback for records that somehow lack it.
  if (r.evidence_grade) return r.evidence_grade
  const year = r.pub_date_parsed ? Number(r.pub_date_parsed.slice(0, 4)) : NaN
  const currentYear = new Date().getFullYear()
  const isOld = !Number.isNaN(year) && currentYear - year > 5

  if (r.study_type && _STRONG_STUDY_TYPES.has(r.study_type)) return isOld ? "Moderate" : "Strong"
  if (r.trust_tier === 1) return isOld ? "Moderate" : "Strong"
  if (r.study_type && _MODERATE_STUDY_TYPES.has(r.study_type)) return "Moderate"
  if (r.trust_tier === 2) return "Moderate"
  if (r.study_type === "Case Reports") return "Limited"
  if (isOld) return "Outdated"
  if (r.source_type === "clinicaltrials") return "Research Only"
  if (!r.study_type && !r.trust_tier) return "Unknown"
  return "Limited"
}

const SOURCE_ORDER = ["pubmed", "europepmc", "cdc", "who", "clinicaltrials", "fda", "medlineplus", "cms"]

// Coarse per-source icon so the results list scans quickly without reading
// every badge: journals, public-health/regulatory bodies, trials, consumer
// reference - four visual buckets rather than one undifferentiated list.
const SOURCE_ICON: Record<string, LucideIcon> = {
  pubmed: FileText,
  europepmc: FileText,
  cdc: ShieldCheck,
  who: ShieldCheck,
  fda: ShieldCheck,
  cms: ShieldCheck,
  clinicaltrials: FlaskConical,
  medlineplus: BookOpen,
}

interface QueryEntities {
  drugs?: string[]
  conditions?: string[]
}

// Question/connector words carry no topical signal for a literature search -
// sending "what is the maximum dose of X" to PubMed as-is is worse than
// sending "maximum dose X", since automatic term expansion on common words
// like "what"/"is" can pull in tangential matches. Only used as a fallback
// when no drug/condition entity was extracted from the question.
const SEARCH_STOPWORDS = new Set([
  "what", "which", "who", "why", "when", "how", "does", "do", "did", "is",
  "are", "was", "were", "be", "been", "the", "a", "an", "of", "in", "on",
  "for", "and", "or", "to", "should", "must", "before", "after", "apply",
  "exist", "can", "could", "would", "will", "shall", "this", "that",
])

function buildSearchTerm(entities: QueryEntities | undefined, queryText: string): string {
  const named = [...(entities?.drugs ?? []), ...(entities?.conditions ?? [])]
  if (named.length > 0) return named.slice(0, 3).join(" ")
  const stripped = queryText
    .replace(/[?!.]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !SEARCH_STOPWORDS.has(w.toLowerCase()))
    .join(" ")
  return (stripped || queryText).slice(0, 120)
}

/**
 * Consensus.app-style Yes/Possibly/No agreement bar. This is a coarse,
 * title-only keyword heuristic (see classify_stance in the backend's
 * evidence_source.py) - not a claim-vs-evidence entailment judgment. Most
 * titles are purely descriptive and land in "Unclear", which is the
 * honest default, not a fallback being hidden.
 */
function AgreementMeter({ results }: { results: EvidenceRecord[] }) {
  const yes = results.filter((r) => r.stance === "yes").length
  const no = results.filter((r) => r.stance === "no").length
  const unclear = results.length - yes - no
  const total = results.length
  if (total === 0) return null

  const pct = (n: number) => (n / total) * 100

  return (
    <div className="mb-3 p-2.5 rounded-xl bg-muted/50 border border-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Evidence Agreement</span>
        <span className="text-[10px] text-subtle">title-wording heuristic</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-border">
        {yes > 0 && <div className="bg-success" style={{ width: `${pct(yes)}%` }} title={`${yes} supportive`} />}
        {unclear > 0 && <div className="bg-[#94A3B8]" style={{ width: `${pct(unclear)}%` }} title={`${unclear} unclear`} />}
        {no > 0 && <div className="bg-destructive" style={{ width: `${pct(no)}%` }} title={`${no} refuting`} />}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" />Yes ({yes})</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#94A3B8]" />Unclear ({unclear})</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" />No ({no})</span>
      </div>
    </div>
  )
}

/**
 * Live external evidence for the current answer, pulled from every source
 * registered in the backend's EvidenceSource registry (PubMed, Europe PMC,
 * CDC, WHO, ClinicalTrials.gov), sorted most-recent-first. Source filter
 * chips let the user narrow to one or more sources without re-querying
 * everything by hand.
 */
export function EvidencePanel({ entities, queryText, variant = "card" }: { entities: QueryEntities; queryText: string; variant?: "card" | "bare" }) {
  const [results, setResults] = useState<EvidenceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [term, setTerm] = useState("")
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set(SOURCE_ORDER))
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const searchTerm = buildSearchTerm(entities, queryText)
    setTerm(searchTerm)
    setLoading(true)
    setFailed(false)
    setExpanded(false)
    fetch(`/api/evidence/search?term=${encodeURIComponent(searchTerm)}&max=${variant === "bare" ? 8 : 4}`)
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        setResults(Array.isArray(data?.results) ? data.results : [])
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryText, JSON.stringify(entities)])

  const sourcesPresent = useMemo(
    () => SOURCE_ORDER.filter((s) => results.some((r) => r.source_type === s)),
    [results]
  )
  const visibleResults = useMemo(
    () => results.filter((r) => activeSources.has(r.source_type)),
    [results, activeSources]
  )

  function toggleSource(source: string) {
    setActiveSources((prev) => {
      const next = new Set(prev)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      return next
    })
  }

  return (
    <div className={variant === "card" ? "p-5 rounded-2xl bg-card border border-border shadow-sm h-fit" : ""}>
      {variant === "card" && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            External Evidence
          </h3>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-ok-soft text-ok-soft-fg border border-ok-soft-border">
            LIVE · SORTED BY EVIDENCE GRADE
          </span>
        </div>
      )}

      {term && (
        <p className="text-[11px] text-subtle mb-3">
          Search term: <span className="font-mono">{term}</span>
        </p>
      )}

      {!loading && !failed && visibleResults.length > 0 && <AgreementMeter results={visibleResults} />}

      {sourcesPresent.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {sourcesPresent.map((s) => (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                activeSources.has(s)
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted text-subtle border-border"
              }`}
            >
              {SOURCE_LABEL[s] ?? s}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching external evidence sources...
        </div>
      )}

      {!loading && failed && (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground py-6 text-center">
          <SearchX className="w-5 h-5" />
          External evidence unavailable right now. Try again later.
        </div>
      )}

      {!loading && !failed && visibleResults.length === 0 && (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground py-6 text-center">
          <SearchX className="w-5 h-5" />
          No external evidence found for this question.
        </div>
      )}

      {!loading && !failed && visibleResults.length > 0 && (
        <div className="space-y-3">
          {(expanded ? visibleResults : visibleResults.slice(0, COLLAPSED_COUNT)).map((r) => {
            const Icon = SOURCE_ICON[r.source_type] ?? FileText
            const hasUrl = Boolean(r.url && r.url.trim())
            return (
              <div key={`${r.source_type}-${r.pmid}`} className="flex gap-3 p-3 rounded-xl bg-muted border border-border">
                <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F1F5F9] dark:bg-white/5 text-muted-foreground border border-border">
                      {SOURCE_LABEL[r.source_type] ?? r.source_type}
                    </span>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${GRADE_STYLE[gradeEvidence(r)]}`}
                      title={[r.study_type, r.trust_tier ? TRUST_TIER_LABEL[r.trust_tier] : null].filter(Boolean).join(" · ") || "Evidence grade: strength/currency, not a claim-accuracy judgment"}
                    >
                      {gradeEvidence(r)}
                    </span>
                    {r.stance === "yes" && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-ok-soft text-ok-soft-fg border border-ok-soft-border">
                        Supports
                      </span>
                    )}
                    {r.stance === "no" && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger-soft text-danger-soft-fg border border-danger-soft-border">
                        Refutes
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">{r.title || "(untitled)"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.journal}{r.authors ? ` · ${r.authors}` : ""}{r.study_type ? ` · ${r.study_type}` : ""}
                  </p>
                  {r.supporting_excerpt && (
                    <p className="text-[11px] text-foreground/80 italic leading-snug line-clamp-2 border-l-2 border-border pl-2">
                      &ldquo;{r.supporting_excerpt}&rdquo;
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">{r.pub_date}</span>
                    {hasUrl ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        View source
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-subtle" title="This source did not return a direct link">
                        No direct link available
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {visibleResults.length > COLLAPSED_COUNT && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              {expanded ? (
                <>Show fewer <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>Show {visibleResults.length - COLLAPSED_COUNT} more <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>
          )}
        </div>
      )}

      <SafetyNote variant="external" className="mt-3" />
    </div>
  )
}
