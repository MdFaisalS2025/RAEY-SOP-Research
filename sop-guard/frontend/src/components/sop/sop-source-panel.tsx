"use client"

// In-place SOP source viewer: opens as a slide-over from wherever a
// citation is clicked, fetches the SOP's full text, and highlights the
// exact cited passage via SopFullText's offset ladder - replacing the old
// "click a citation number -> navigate away to /library showing every SOP"
// flow.

import { useEffect, useMemo, useState } from "react"
import { FileText } from "lucide-react"
import { SlideOver } from "@/components/ui/slide-over"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingBlock } from "@/components/ui/loading-block"
import { SopFullText, resolveHighlight } from "@/components/sop/sop-full-text"
import type { InlineCitation } from "@/components/query/citation-chip"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

interface SopDetail {
  sop_id: string
  title: string
  version?: string
  raw_text: string
}

function libraryDeepLink(citation: InlineCitation): string {
  const params = new URLSearchParams({ sopId: citation.sop_id })
  if (citation.snippet) params.set("highlight", citation.snippet)
  if (citation.section_title) params.set("sectionTitle", citation.section_title)
  // Carry the exact offsets through too, so "Open in Library" starts at
  // the same rung of the honesty ladder as this panel, not one rung
  // lower (the panel used to drop these, making Library's highlight
  // strictly worse than the one the user just saw).
  if (typeof citation.char_start === "number") params.set("charStart", String(citation.char_start))
  if (typeof citation.char_end === "number") params.set("charEnd", String(citation.char_end))
  if (citation.offset_source) params.set("offsetSource", citation.offset_source)
  if (citation.offset_anchor) params.set("offsetAnchor", citation.offset_anchor)
  return `/library?${params.toString()}`
}

export function SopSourcePanel({
  citation,
  onClose,
}: {
  citation: InlineCitation | null
  onClose: () => void
}) {
  const [sop, setSop] = useState<SopDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!citation?.sop_id) return
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    setSop(null)

    fetch(`${API_BASE}/api/sops/${encodeURIComponent(citation.sop_id)}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => setSop(data))
      .catch((err) => {
        if (err?.name === "AbortError") return
        setError(true)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [citation?.sop_id, reloadToken])

  // findNormalized (inside resolveHighlight) builds two O(n) arrays over
  // the whole document - memoize so a real SOP's worth of text isn't
  // re-scanned on every unrelated re-render (loading/error state changes,
  // parent updates), only when the SOP or citation actually changes.
  const highlight = useMemo(
    () =>
      sop
        ? resolveHighlight(sop.raw_text, {
            charStart: citation?.char_start,
            charEnd: citation?.char_end,
            snippet: citation?.snippet,
            sectionTitle: citation?.section_title,
            offsetAnchor: citation?.offset_anchor,
            offsetSource: citation?.offset_source,
            passageStart: citation?.passage_start,
            passageEnd: citation?.passage_end,
          })
        : null,
    [
      sop, citation?.char_start, citation?.char_end, citation?.snippet, citation?.section_title,
      citation?.offset_anchor, citation?.offset_source, citation?.passage_start, citation?.passage_end,
    ]
  )

  return (
    <SlideOver
      open={!!citation}
      onClose={onClose}
      title={citation?.sop_title || "SOP Source"}
      subtitle={citation?.section_title}
      icon={FileText}
      width="2xl"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && <LoadingBlock label="Loading SOP source..." lines={8} />}
          {!loading && error && (
            <ErrorState message="Couldn't load this SOP." onRetry={() => setReloadToken((t) => t + 1)} />
          )}
          {!loading && !error && sop && (
            <SopFullText rawText={sop.raw_text} highlight={highlight} />
          )}
        </div>
        {citation && (
          <div className="pt-4 mt-4 border-t border-border shrink-0">
            <a
              href={libraryDeepLink(citation)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Open in Library
            </a>
          </div>
        )}
      </div>
    </SlideOver>
  )
}
