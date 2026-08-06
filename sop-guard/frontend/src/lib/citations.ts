// Shared citation-record mapper - extracted out of app/query/page.tsx so
// Bedside Lookup can reuse it too (a Next.js App Router page.tsx can only
// export `default`/`metadata`/etc, not arbitrary helpers).

import type { InlineCitation } from "@/components/query/citation-chip"

export function mapCitations(raw: unknown): InlineCitation[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c: any) => c && typeof c.number === "number")
    .map((c: any) => ({
      number: c.number,
      sop_id: c.sop_id ?? "",
      sop_title: c.sop_title ?? "Unknown SOP",
      section_title: c.section_title ?? "",
      chunk_type: c.chunk_type ?? "",
      snippet: c.snippet ?? "",
      relevance_score: typeof c.relevance_score === "number" ? c.relevance_score : 0,
      cited_in_answer: c.cited_in_answer ?? false,
      version: c.version ?? "",
      effective_date: c.effective_date ?? "",
      review_date: c.review_date ?? "",
      status: c.status ?? "active",
      url: c.url ?? "",
      is_external: c.is_external ?? false,
      pub_date: c.pub_date ?? "",
      // Preserve null/undefined as-is - `?? 0` would fabricate a
      // valid-looking offset at the very start of the document.
      char_start: typeof c.char_start === "number" ? c.char_start : null,
      char_end: typeof c.char_end === "number" ? c.char_end : null,
      offset_source: c.offset_source ?? "",
      offset_anchor: c.offset_anchor ?? "",
      passage_start: typeof c.passage_start === "number" ? c.passage_start : null,
      passage_end: typeof c.passage_end === "number" ? c.passage_end : null,
      passage_basis: c.passage_basis ?? "",
      passage_similarity: typeof c.passage_similarity === "number" ? c.passage_similarity : null,
    }))
}
