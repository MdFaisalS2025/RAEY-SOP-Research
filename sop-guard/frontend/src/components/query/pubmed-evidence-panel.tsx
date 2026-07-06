"use client"

import { useEffect, useState } from "react"
import { BookOpen, ExternalLink, Loader2, SearchX } from "lucide-react"

interface PubMedRecord {
  title: string
  authors: string
  journal: string
  pub_date: string
  pmid: string
  url: string
  source_type: string
  study_type?: string
}

// Rough evidence-hierarchy tinting, same spirit as the GRADE-style tags
// UpToDate uses - a scannable hint, not a substitute for full appraisal.
const STUDY_TYPE_STYLE: Record<string, string> = {
  "Meta-Analysis": "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
  "Systematic Review": "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
  "Practice Guideline": "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
  "Guideline": "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
  "Randomized Controlled Trial": "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30",
  "Clinical Trial": "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30",
  "Review": "bg-card text-[#475569] border-[#CBD5E1]",
  "Case Reports": "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
}

interface QueryEntities {
  drugs?: string[]
  conditions?: string[]
}

function buildSearchTerm(entities: QueryEntities | undefined, queryText: string): string {
  const named = [...(entities?.drugs ?? []), ...(entities?.conditions ?? [])]
  if (named.length > 0) return named.slice(0, 3).join(" ")
  return queryText.slice(0, 120)
}

/**
 * Live PubMed evidence for the current answer - replaces the previous
 * hardcoded MOCK_EVIDENCE array, which rendered the same fixed set of
 * CDC/sepsis articles regardless of the question asked. Uses the query's
 * extracted clinical entities (drugs/conditions) when available, falling
 * back to the raw query text.
 */
export function PubMedEvidencePanel({ entities, queryText }: { entities: QueryEntities; queryText: string }) {
  const [results, setResults] = useState<PubMedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [term, setTerm] = useState("")

  useEffect(() => {
    let cancelled = false
    const searchTerm = buildSearchTerm(entities, queryText)
    setTerm(searchTerm)
    setLoading(true)
    setFailed(false)
    fetch(`/api/evidence/pubmed?term=${encodeURIComponent(searchTerm)}&max=5`)
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

  return (
    <div className="p-5 rounded-2xl bg-card border border-[#E2E8F0] shadow-sm h-fit">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#0B6BCB]" />
          External Evidence
        </h3>
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30">
          LIVE PUBMED
        </span>
      </div>

      {term && (
        <p className="text-[11px] text-[#94A3B8] mb-3">
          Search term: <span className="font-mono">{term}</span>
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-[#64748B] py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching PubMed...
        </div>
      )}

      {!loading && failed && (
        <div className="flex flex-col items-center gap-2 text-sm text-[#64748B] py-6 text-center">
          <SearchX className="w-5 h-5" />
          External evidence unavailable right now. Try again later.
        </div>
      )}

      {!loading && !failed && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 text-sm text-[#64748B] py-6 text-center">
          <SearchX className="w-5 h-5" />
          No PubMed articles found for this question.
        </div>
      )}

      {!loading && !failed && results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => (
            <div key={r.pmid} className="p-3 rounded-xl bg-muted border border-[#E2E8F0] space-y-1.5">
              {r.study_type && (
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${STUDY_TYPE_STYLE[r.study_type] ?? "bg-card text-[#475569] border-[#CBD5E1]"}`}>
                  {r.study_type}
                </span>
              )}
              <p className="text-[13px] font-medium text-[#1A2332] leading-snug line-clamp-2">{r.title || "(untitled)"}</p>
              <p className="text-[11px] text-[#64748B]">{r.journal}{r.authors ? ` · ${r.authors}` : ""}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#64748B]">{r.pub_date}</span>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-[#0B6BCB] hover:underline"
                >
                  View on PubMed
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-[#94A3B8] mt-3">
        Research prototype. Live PubMed results are not clinical guidance - verify against primary sources.
      </p>
    </div>
  )
}
