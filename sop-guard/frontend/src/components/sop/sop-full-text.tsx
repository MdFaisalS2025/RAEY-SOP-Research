"use client"

// Renders an SOP's raw text, line-numbered, with the cited passage
// highlighted at the exact character range when one can be located -
// replacing the old paragraph-level "cite to exact line" (library/page.tsx's
// fullTextParagraphs/highlightedParaIndex), which highlighted the entire
// paragraph a snippet fell in. Since the corpus separates *steps* with a
// single "\n" and only *sections* with "\n\n" (see demo_sops.py), a whole
// PROCEDURE section was one "paragraph" - highlighting it highlighted
// everything, not the cited line.
//
// Shared by the query-page citation panel (P3.8) and the Library page's
// Full Text tab - one renderer, one honesty ladder, both surfaces fixed.

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type HighlightBasis = "offset" | "step_anchor" | "snippet" | "section" | "whole_doc" | "none"

export interface ResolvedHighlight {
  start: number
  end: number
  basis: HighlightBasis
  /** Optional inner sub-range (Q2.6) - the specific sentence within the
   * outer [start,end) span that the answer actually used, when the
   * backend narrowed it via sentence-level semantic similarity
   * (citation_tracker.narrow_citation_spans). The outer range stays the
   * soft-shaded chunk span; this narrower range gets the stronger mark. */
  narrowStart?: number
  narrowEnd?: number
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}

/**
 * Fraction of `needle`'s significant (3+ char) word tokens present in
 * `haystack`. Used only as the legacy fallback for citation rows recorded
 * before offset_anchor existed - it tolerates the display snippet's title
 * prefix (which a plain substring/prefix check does not), at the cost of
 * being a weaker staleness check than the anchor comparison.
 */
function tokenContainment(needle: string, haystack: string): number {
  const tokens = needle.match(/[a-z0-9]{3,}/g)
  if (!tokens || tokens.length === 0) return 0
  const haystackSet = new Set(haystack.match(/[a-z0-9]{3,}/g) ?? [])
  const present = tokens.filter((t) => haystackSet.has(t)).length
  return present / tokens.length
}

/**
 * Whitespace-normalized, case-insensitive substring search that maps a
 * match position in the normalized text back to the original string's
 * character offsets - the frontend mirror of the backend's
 * chunker._locate_span normalized path, needed here because the citation
 * snippet/section-title strings the backend hands back are themselves
 * already whitespace-collapsed.
 *
 * Case-insensitive to match `normNeedle`, which always goes through
 * normalize()'s .toLowerCase() - a caught-by-testing bug (see
 * sop-full-text.test.ts) had this haystack loop preserve rawText's
 * original casing while the needle was lowercased, so `indexOf` could
 * never match any needle against text containing a capital letter. Since
 * nearly every section heading and sentence-initial word in real SOP text
 * has one, this silently broke the snippet/section fallback rungs for
 * almost all real citations - they'd fall all the way through to "none"
 * whenever the offset rung failed, rather than to the weaker-but-real
 * match this function exists to provide.
 */
function findNormalized(rawText: string, needle: string): { start: number; end: number } | null {
  const normNeedle = normalize(needle)
  if (normNeedle.length < 8) return null // too short to trust a match

  const normChars: string[] = []
  const indexMap: number[] = []
  let prevWasSpace = false
  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText[i]
    if (/\s/.test(ch)) {
      if (!prevWasSpace) {
        normChars.push(" ")
        indexMap.push(i)
      }
      prevWasSpace = true
    } else {
      normChars.push(ch.toLowerCase())
      indexMap.push(i)
      prevWasSpace = false
    }
  }
  const normalized = normChars.join("")
  const idx = normalized.indexOf(normNeedle)
  if (idx === -1) return null

  const start = indexMap[idx]
  const normEnd = Math.min(idx + normNeedle.length - 1, indexMap.length - 1)
  const end = indexMap[normEnd] + 1
  return { start, end }
}

/**
 * Honesty ladder for locating the cited passage in `rawText`, most exact
 * to least: stored character offsets (with a sanity re-check that they
 * still point at the same text, so a stale offset from an edited SOP
 * can't confidently highlight the wrong place) -> the citation snippet's
 * normalized 80-char prefix -> the section title -> no highlight. Never
 * fabricates a match.
 *
 * The offset sanity check used to compare the stored span against the
 * citation's display `snippet` - but `snippet` is title-prefixed for
 * section chunks (see chunker.py's _extract_section_chunks, which builds
 * `"{sop_title} - {section_title}:\n{section_text}"`), so that check
 * rejected every correctly-located section offset in the corpus. It now
 * compares against `offsetAnchor`, a verbatim (un-prefixed) slice of
 * raw_text at the stored span, purpose-built for this comparison. Rows
 * recorded before offsetAnchor existed fall back to a token-containment
 * check against `snippet`, which tolerates the title prefix.
 */
export function resolveHighlight(
  rawText: string,
  opts: {
    charStart?: number | null
    charEnd?: number | null
    snippet?: string
    sectionTitle?: string
    offsetAnchor?: string
    /** "whole_doc" chunks carry factually correct offsets (0..length) but
     * are useless as a highlight - they're skipped here so the weaker
     * rungs get a chance at something specific first. "step_anchor"
     * offsets are located via the SOP's own step numbering rather than a
     * literal text match - the caption below says so. */
    offsetSource?: string
    /** Optional narrowed sentence span (Q2.6, citation_tracker.
     * narrow_citation_spans) - only used when it falls within the
     * resolved outer [charStart,charEnd) span, so a stale/mismatched
     * passage can't produce a highlight outside the chunk it claims to
     * be inside. */
    passageStart?: number | null
    passageEnd?: number | null
  }
): ResolvedHighlight | null {
  const { charStart, charEnd, snippet, sectionTitle, offsetAnchor, offsetSource, passageStart, passageEnd } = opts

  const hasOffsets =
    typeof charStart === "number" &&
    typeof charEnd === "number" &&
    charStart >= 0 &&
    charEnd > charStart &&
    charEnd <= rawText.length

  if (hasOffsets && offsetSource !== "whole_doc") {
    const claimed = normalize(rawText.slice(charStart as number, charEnd as number))
    const anchor = normalize(offsetAnchor || "")
    const anchorOk = anchor.length >= 20 ? claimed.startsWith(anchor.slice(0, 80)) : null
    const legacyOk = !snippet || tokenContainment(normalize(snippet), claimed) >= 0.6
    if (anchorOk ?? legacyOk) {
      const hasPassage =
        typeof passageStart === "number" &&
        typeof passageEnd === "number" &&
        passageStart >= (charStart as number) &&
        passageEnd <= (charEnd as number) &&
        passageEnd > passageStart
      return {
        start: charStart as number,
        end: charEnd as number,
        basis: offsetSource === "step_anchor" ? "step_anchor" : "offset",
        ...(hasPassage ? { narrowStart: passageStart as number, narrowEnd: passageEnd as number } : {}),
      }
    }
    // Offset didn't check out (SOP edited since the citation was recorded)
    // - fall through to the weaker rungs rather than trusting it blindly.
  }

  if (snippet) {
    const needle = snippet.slice(0, 80)
    const found = findNormalized(rawText, needle)
    if (found) return { ...found, basis: "snippet" }
  }

  if (sectionTitle) {
    const found = findNormalized(rawText, sectionTitle)
    if (found) return { ...found, basis: "section" }
  }

  if (hasOffsets && offsetSource === "whole_doc") {
    // Correct data (the chunk really does span the whole document) but
    // not a highlight - say so rather than silently marking every line.
    return { start: 0, end: 0, basis: "whole_doc" }
  }

  return null
}

const BASIS_CAPTION: Record<HighlightBasis, string> = {
  offset: "Exact passage located in the source document.",
  step_anchor: "Located via this SOP's own step numbering - the answer paraphrased this step.",
  snippet: "Approximate match - the SOP may have been edited since this citation was generated.",
  section: "Showing the cited section - the exact passage within it could not be located.",
  whole_doc: "This citation refers to the document as a whole; no specific passage was recorded.",
  none: "The exact passage could not be located in the current version of this SOP.",
}

/** Lines of context shown above/below the highlighted span in focused mode. */
const CONTEXT_LINES = 8
/** How many lines a single "load more" click reveals in expanded mode. */
const EXPANDED_PAGE_SIZE = 2000

interface LineIndex {
  lines: string[]
  lineStarts: number[]
}

/**
 * Splits rawText into lines once and memoizes on rawText alone - the old
 * version recomputed this (and the O(n) cumulative-offset scan) on every
 * render, including every highlight change, which is wasteful at real SOP
 * sizes (the demo corpus is 39-75 lines; a real SOP could be thousands).
 */
function useLineIndex(rawText: string): LineIndex {
  return useMemo(() => {
    const lines = rawText.split("\n")
    let cursor = 0
    const lineStarts = lines.map((line) => {
      const start = cursor
      cursor += line.length + 1
      return start
    })
    return { lines, lineStarts }
  }, [rawText])
}

interface SopLineProps {
  lineNumber: number
  text: string
  hlStart: number | null
  hlEnd: number | null
  narrowStart: number | null
  narrowEnd: number | null
  isFirstHighlighted: boolean
  scrollRef: React.RefObject<HTMLDivElement>
}

/**
 * A single rendered line, split out and memoized over primitives only so a
 * highlight change re-renders the 1-3 lines whose highlight actually
 * changed instead of every line in the visible window.
 */
const SopLine = memo(function SopLine({ lineNumber, text, hlStart, hlEnd, narrowStart, narrowEnd, isFirstHighlighted, scrollRef }: SopLineProps) {
  const intersects = hlStart !== null && hlEnd !== null
  const hasNarrow = narrowStart !== null && narrowEnd !== null

  let content: React.ReactNode = text || " "
  if (intersects && hasNarrow) {
    // Two-tier highlight (Q2.6): the whole cited chunk stays softly
    // marked, the specific sentence the answer used gets a stronger mark.
    content = (
      <>
        {text.slice(0, hlStart as number)}
        <mark className="bg-warn-soft/50 text-foreground rounded-sm px-0.5 -mx-0.5">
          {text.slice(hlStart as number, narrowStart as number)}
        </mark>
        <mark className="bg-warn-soft text-foreground font-medium rounded-sm px-0.5 -mx-0.5 ring-1 ring-warn-soft-border">
          {text.slice(narrowStart as number, narrowEnd as number)}
        </mark>
        <mark className="bg-warn-soft/50 text-foreground rounded-sm px-0.5 -mx-0.5">
          {text.slice(narrowEnd as number, hlEnd as number)}
        </mark>
        {text.slice(hlEnd as number)}
      </>
    )
  } else if (intersects) {
    content = (
      <>
        {text.slice(0, hlStart as number)}
        <mark className="bg-warn-soft text-foreground rounded-sm px-0.5 -mx-0.5">
          {text.slice(hlStart as number, hlEnd as number)}
        </mark>
        {text.slice(hlEnd as number)}
      </>
    )
  }

  return (
    <div
      ref={isFirstHighlighted ? scrollRef : undefined}
      className={cn("flex gap-3 px-2 py-0.5 rounded", intersects && "bg-warn-soft/40")}
    >
      <span className="shrink-0 w-8 text-right text-subtle select-none tabular-nums">{lineNumber}</span>
      <span className="whitespace-pre-wrap text-foreground min-w-0">{content}</span>
    </div>
  )
})

export function SopFullText({ rawText, highlight }: { rawText: string; highlight: ResolvedHighlight | null }) {
  const { lines, lineStarts } = useLineIndex(rawText)
  const [expanded, setExpanded] = useState(false)
  const [visibleCount, setVisibleCount] = useState(EXPANDED_PAGE_SIZE)
  const firstHighlightedLineRef = useRef<HTMLDivElement>(null!)

  const basis: HighlightBasis = highlight?.basis ?? "none"
  const totalLines = lines.length

  // Absolute [first, last] line indices the highlight spans, or null - the
  // basis for both scrolling and the focused-mode window below.
  const highlightRange = useMemo(() => {
    if (!highlight) return null
    let first: number | null = null
    let last: number | null = null
    for (let i = 0; i < lines.length; i++) {
      const lineStart = lineStarts[i]
      const lineEnd = lineStart + lines[i].length
      if (highlight.end > lineStart && highlight.start < lineEnd) {
        if (first === null) first = i
        last = i
      }
    }
    return first === null ? null : { first, last: last as number }
  }, [highlight, lines, lineStarts])

  // A new citation (different rawText/highlight) should start focused
  // again, not carry over a previous "show full document" choice.
  useEffect(() => {
    setExpanded(false)
    setVisibleCount(EXPANDED_PAGE_SIZE)
  }, [rawText, highlight])

  useEffect(() => {
    if (highlightRange) {
      firstHighlightedLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [highlightRange, expanded])

  const focusedMode = !expanded && highlightRange !== null

  // The window of absolute line indices actually rendered. Focused mode:
  // the highlighted span +/- CONTEXT_LINES. Expanded mode: from the start,
  // capped at visibleCount (paginated so a 10k-line SOP doesn't mount tens
  // of thousands of DOM nodes at once). No highlight and not expanded:
  // the whole (typically short) document, matching prior behavior.
  let windowStart = 0
  let windowEnd = totalLines
  if (focusedMode && highlightRange) {
    windowStart = Math.max(0, highlightRange.first - CONTEXT_LINES)
    windowEnd = Math.min(totalLines, highlightRange.last + 1 + CONTEXT_LINES)
  } else if (expanded) {
    windowEnd = Math.min(totalLines, visibleCount)
  }

  const linesAbove = windowStart
  const linesBelow = totalLines - windowEnd

  // Absolute indices to render - never a mapped slice, so the gutter
  // number (rendered from this same absolute index) can't drift from the
  // line's real 1-based position in rawText.split("\n").
  const renderIndices = useMemo(
    () => Array.from({ length: Math.max(0, windowEnd - windowStart) }, (_, k) => windowStart + k),
    [windowStart, windowEnd]
  )

  const revealAll = () => {
    setExpanded(true)
    setVisibleCount(EXPANDED_PAGE_SIZE)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-card border border-border text-xs text-muted-foreground">
        <span>
          {BASIS_CAPTION[basis]}
          {highlight?.narrowStart !== undefined && (
            <>
              {" "}Narrowed to the sentence that best matches this part of the answer - the surrounding cited section is shaded.
            </>
          )}
        </span>
        {focusedMode && (
          <Button variant="ghost" size="sm" className="h-auto py-1 px-2 shrink-0" onClick={revealAll}>
            Show full document
          </Button>
        )}
        {expanded && highlightRange && (
          <Button variant="ghost" size="sm" className="h-auto py-1 px-2 shrink-0" onClick={() => setExpanded(false)}>
            Show only the cited passage
          </Button>
        )}
      </div>

      {focusedMode && linesAbove > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mb-1 w-full justify-center text-xs text-muted-foreground"
          onClick={revealAll}
        >
          Show {linesAbove.toLocaleString()} earlier line{linesAbove === 1 ? "" : "s"}
        </Button>
      )}

      <div className="font-mono text-13 leading-[1.7]">
        {renderIndices.map((i) => {
          const line = lines[i]
          const lineStart = lineStarts[i]
          const lineEnd = lineStart + line.length
          const intersects = highlight ? highlight.end > lineStart && highlight.start < lineEnd : false
          const hlStart = intersects ? Math.max(0, (highlight as ResolvedHighlight).start - lineStart) : null
          const hlEnd = intersects ? Math.min(line.length, (highlight as ResolvedHighlight).end - lineStart) : null

          const narrowIntersects =
            highlight?.narrowStart !== undefined && highlight?.narrowEnd !== undefined &&
            (highlight.narrowEnd as number) > lineStart && (highlight.narrowStart as number) < lineEnd
          const narrowStart = narrowIntersects ? Math.max(0, (highlight!.narrowStart as number) - lineStart) : null
          const narrowEnd = narrowIntersects ? Math.min(line.length, (highlight!.narrowEnd as number) - lineStart) : null

          return (
            <SopLine
              key={i}
              lineNumber={i + 1}
              text={line}
              hlStart={hlStart}
              hlEnd={hlEnd}
              narrowStart={narrowStart}
              narrowEnd={narrowEnd}
              isFirstHighlighted={highlightRange !== null && i === highlightRange.first}
              scrollRef={firstHighlightedLineRef}
            />
          )
        })}
      </div>

      {focusedMode && linesBelow > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-center text-xs text-muted-foreground"
          onClick={revealAll}
        >
          Show {linesBelow.toLocaleString()} later line{linesBelow === 1 ? "" : "s"}
        </Button>
      )}

      {expanded && linesBelow > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-center text-xs text-muted-foreground"
          onClick={() => setVisibleCount((c) => c + EXPANDED_PAGE_SIZE)}
        >
          Showing first {windowEnd.toLocaleString()} of {totalLines.toLocaleString()} lines - load{" "}
          {Math.min(EXPANDED_PAGE_SIZE, linesBelow).toLocaleString()} more
        </Button>
      )}
    </div>
  )
}
