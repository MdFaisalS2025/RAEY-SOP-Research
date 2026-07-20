"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, Check, XCircle } from "lucide-react"
import { CitationChip, type InlineCitation } from "@/components/query/citation-chip"
import { cn } from "@/lib/utils"

// "Generative UI" answer components: real retrieved SOP content (steps,
// thresholds, contraindications) rendered as small interactive/typed
// components instead of flat prose - the same idea behind the Vercel AI
// SDK's generative UI, applied to this app's own streaming/renderer stack
// rather than adopting that SDK. Every one of these is a presentation
// upgrade over data parseAnswer already extracted from the real answer
// text; none of them introduce content that wasn't in the grounded answer,
// and citation markers ([n]) are preserved through renderInline exactly as
// in the plain-prose path.

// A bullet list where most items read as a prohibition ("Do NOT...",
// "Avoid...", "Contraindicated...") is almost always a contraindications
// section - rendered as a dedicated warning card instead of generic bullets.
const CONTRA_ITEM_RE = /^(do not|don't|avoid|never|contraindicated|must not)\b/i

function isContraindicationList(items: string[]): boolean {
  if (items.length === 0) return false
  const matches = items.filter((it) => CONTRA_ITEM_RE.test(it.trim())).length
  return matches >= 2 && matches >= items.length / 2
}

// Flags a threshold-table row as a danger value worth calling out in red -
// deliberately narrow (keyword-gated on the row's own label/value text, not
// a numeric judgment this component has no clinical basis to make).
const DANGER_ROW_RE = /\b(max(imum)?|do not exceed|critical|toxic|overdose|lethal|danger(ous)?)\b/i

function isDangerRow(label: string, value: string): boolean {
  return DANGER_ROW_RE.test(label) || DANGER_ROW_RE.test(value)
}

/** Numbered procedure steps rendered as a checklist a clinician can tick
 * through while working the protocol. Local component (not inlined in
 * renderBlock) so its checked-state hook attaches correctly - renderBlock
 * itself is a plain function called during render, not a component. */
function StepChecklist({ items, ctx }: { items: { num: string; text: string }[]; ctx: CitationCtx }) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const toggle = (num: string) => {
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }
  return (
    <ol className="space-y-2.5">
      {items.map((s) => {
        const isDone = done.has(s.num)
        return (
          <li key={s.num} className="flex gap-3 items-start">
            <button
              type="button"
              onClick={() => toggle(s.num)}
              aria-pressed={isDone}
              aria-label={isDone ? `Mark step ${s.num} as not done` : `Mark step ${s.num} as done`}
              className={cn(
                "shrink-0 mt-0.5 w-7 h-7 rounded-full text-[13px] font-bold flex items-center justify-center border transition-colors",
                isDone
                  ? "bg-[#15803D] dark:bg-green-600 border-[#15803D] dark:border-green-600 text-white"
                  : "bg-[#0B6BCB]/10 border-transparent text-[#0B6BCB] hover:bg-[#0B6BCB]/20"
              )}
            >
              {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
            </button>
            <span className={cn("text-[16px] leading-[1.6] pt-0.5 transition-colors", isDone ? "text-muted-foreground line-through" : "text-foreground")}>
              {renderInline(s.text, ctx)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// Threshold answers come through as a bullet list of mostly "Parameter:
// value" lines (see generator.py's _build_threshold_answer) - though the
// generator sometimes tacks a plain scope/context sentence onto the same
// list. When at least half the items (and at least 2) match the "label:
// value" shape, render those as a real two-column table instead of a
// generic bullet list - closer to how a clinician scans a values table
// on paper - and keep any non-matching lines as bullets below it rather
// than silently dropping them.
const KV_BULLET_RE = /^([A-Za-z][\w\s/()%<>=.-]{1,40}?):\s+(.+)$/

function tryParseThresholdTable(items: string[]): { rows: { label: string; value: string; sourceItem: string }[]; leftover: string[] } | null {
  if (items.length < 2) return null
  const rows: { label: string; value: string; sourceItem: string }[] = []
  const leftover: string[] = []
  for (const item of items) {
    const m = item.match(KV_BULLET_RE)
    if (m) rows.push({ label: m[1].trim(), value: m[2].trim(), sourceItem: item })
    else leftover.push(item)
  }
  if (rows.length < 2 || rows.length < items.length / 2) return null
  return { rows, leftover }
}

export type AnswerBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "callout"; text: string }
  | { type: "kv"; pairs: { label: string; value: string }[] }
  | { type: "steps"; items: { num: string; text: string }[] }
  | { type: "bullets"; items: string[] }
  | { type: "para"; text: string }
  | { type: "source"; text: string }
  | { type: "note"; text: string }

type CitationCtx = {
  byNumber: Map<number, InlineCitation>
  onCite?: (n: number) => void
}

function renderCitationTokens(text: string, keyPrefix: string, ctx?: CitationCtx): React.ReactNode {
  const parts = text.split(/(\[\d+\])/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/)
        if (m) {
          const num = Number(m[1])
          if (ctx && ctx.byNumber.size > 0) {
            return <CitationChip key={`${keyPrefix}-${i}`} number={num} citation={ctx.byNumber.get(num)} onClick={ctx.onCite} />
          }
          return <span key={`${keyPrefix}-${i}`} className="text-subtle text-[13px]">{part}</span>
        }
        return <span key={`${keyPrefix}-${i}`}>{part}</span>
      })}
    </>
  )
}

export function renderInline(text: string, ctx?: CitationCtx): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  if (parts.length === 1) return renderCitationTokens(text, "c", ctx)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="font-semibold text-foreground">{renderCitationTokens(part.slice(2, -2), `s${i}`, ctx)}</strong>
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={i}>{renderCitationTokens(part.slice(1, -1), `e${i}`, ctx)}</em>
        return <span key={i}>{renderCitationTokens(part, `p${i}`, ctx)}</span>
      })}
    </>
  )
}

export function parseAnswer(raw: string): AnswerBlock[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean)
  const blocks: AnswerBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length as 1 | 2 | 3, text: headingMatch[2] })
      i++; continue
    }
    if (/^>\s+/.test(line)) {
      blocks.push({ type: "callout", text: line.replace(/^>\s+/, "") })
      i++; continue
    }
    if (/^-{2,}$/.test(line)) { i++; continue }
    if (/research prototype/i.test(line) || /^(\*\*)?note:?(\*\*)?\s/i.test(line)) {
      // Covers both the "research prototype" aside and generic backend
      // "Note: ..." asides (e.g. "This SOP does not state an explicit
      // maximum/minimum..."). Both are backend-internal caveats, not part
      // of the clinical answer body - suppressed at render time (see
      // renderBlock's "note" case) rather than shown as a stray paragraph.
      blocks.push({ type: "note", text: line.replace(/^[⚠️\s]+/, "").replace(/^(\*\*)?note:?(\*\*)?\s*/i, "") })
      i++; continue
    }
    if (/^(\*\*)?source:?(\*\*)?/i.test(line)) {
      // Strips the whole "**Source:**"/"Source:" prefix in one shot - a
      // two-step strip (leading ** then "source:") missed the closing **
      // that sits mid-string right after "Source:", leaking "** " into
      // the displayed source text.
      blocks.push({ type: "source", text: line.replace(/^(\*\*)?source:?(\*\*)?\s*/i, "") })
      i++; continue
    }
    if (/^\d+[.)]\s+/.test(line)) {
      const items: { num: string; text: string }[] = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\d+)[.)]\s+(.*)$/)
        if (m) items.push({ num: m[1], text: m[2] })
        i++
      }
      blocks.push({ type: "steps", items }); continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""))
        i++
      }
      blocks.push({ type: "bullets", items }); continue
    }
    if (/^[A-Z][A-Za-z /]{1,28}:\s+\S/.test(line)) {
      const pairs: { label: string; value: string }[] = []
      // Real bug this fixes: a trailing "Source: ..."/"Note: ..." line
      // right after a run of genuine "Label: value" pairs (e.g. a
      // threshold answer's "Norepinephrine starting dose: ..." row) also
      // matches this same generic KV shape, so it got silently swallowed
      // into the pairs table as just another row instead of ever reaching
      // the dedicated source/note handling above - which is why answers
      // still showed a "NOTE"/"SOURCE" table row even after that handling
      // was told to render nothing. Stop consuming as soon as a line looks
      // like a source/note line so the outer loop re-processes it through
      // the dedicated (and now render-suppressed) path instead.
      while (
        i < lines.length &&
        /^[A-Z][A-Za-z /]{1,28}:\s+\S/.test(lines[i]) &&
        !/^(\*\*)?source:?(\*\*)?/i.test(lines[i]) &&
        !/^(\*\*)?note:?(\*\*)?\s/i.test(lines[i])
      ) {
        const m = lines[i].match(/^([A-Z][A-Za-z /]{1,28}):\s+(.*)$/)
        if (m) pairs.push({ label: m[1], value: m[2] })
        i++
      }
      if (pairs.length >= 2) { blocks.push({ type: "kv", pairs }) }
      else { blocks.push({ type: "para", text: line }); i++ }
      continue
    }
    blocks.push({ type: "para", text: line })
    i++
  }
  return blocks
}

// Reveals each block (heading/paragraph/step/table/...) in sequence rather
// than dumping the whole answer at once - makes structured content read as
// "arriving" like a live AI response instead of a static page render. Only
// the newest answer should animate (see `animate` prop) - older, already-read
// messages render with no motion.
function BlockWrap({ index, animate, children }: { index: number; animate: boolean; children: React.ReactNode }) {
  if (!animate) return <>{children}</>
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.09, 1.2), duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}

export function AnswerRenderer({ text, citations, onCitationClick, animate = false }: { text: string; citations?: InlineCitation[]; onCitationClick?: (n: number) => void; animate?: boolean }) {
  const blocks = parseAnswer(text)
  const ctx: CitationCtx = {
    byNumber: new Map((citations ?? []).map((c) => [c.number, c])),
    onCite: onCitationClick,
  }
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <BlockWrap key={i} index={i} animate={animate}>
          {renderBlock(block, i, ctx)}
        </BlockWrap>
      ))}
    </div>
  )
}

function renderBlock(block: AnswerBlock, i: number, ctx: CitationCtx): React.ReactNode {
  if (block.type === "heading") {
    const sizeClass = block.level === 1 ? "text-xl font-bold" : block.level === 2 ? "text-lg font-semibold" : "text-base font-semibold"
    const marginClass = block.level === 1 ? "" : block.level === 2 ? "pt-2 border-t border-border" : ""
    return (
      <div key={i} className={cn("first:mt-0", i > 0 && marginClass)}>
        {block.level === 1 && <h1 className={cn("font-display text-[#0B6BCB]", sizeClass)}>{block.text}</h1>}
        {block.level === 2 && <h2 className={cn("font-display text-[#0B6BCB]", sizeClass)}>{block.text}</h2>}
        {block.level === 3 && <h3 className={cn("font-display text-foreground", sizeClass)}>{block.text}</h3>}
      </div>
    )
  }
  if (block.type === "callout") {
    return (
      <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30">
        <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[15px] leading-relaxed text-foreground">{renderInline(block.text, ctx)}</p>
      </div>
    )
  }
  if (block.type === "para") {
    return (
      <p key={i} className="text-[16px] leading-[1.7] text-foreground">
        {renderInline(block.text, ctx)}
      </p>
    )
  }
  if (block.type === "kv") {
    return (
      <dl key={i} className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {block.pairs.map((p, j) => {
          const danger = isDangerRow(p.label, p.value)
          return (
            <div key={j} className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 px-4 py-3 odd:bg-muted even:bg-transparent">
              <dt className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-36 shrink-0">{p.label}</dt>
              <dd className={cn("text-[16px] leading-snug font-medium", danger ? "text-[#B91C1C] dark:text-red-400" : "text-foreground")}>
                {renderInline(p.value, ctx)}
              </dd>
            </div>
          )
        })}
      </dl>
    )
  }
  if (block.type === "steps") {
    return <StepChecklist key={i} items={block.items} ctx={ctx} />
  }
  if (block.type === "bullets") {
    if (isContraindicationList(block.items)) {
      return (
        <div key={i} className="rounded-xl border border-[#FECACA] dark:border-red-500/30 bg-[#FEE2E2] dark:bg-red-500/10 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <XCircle className="w-4 h-4 text-[#B91C1C] dark:text-red-400" />
            <span className="text-[13px] font-bold uppercase tracking-wide text-[#B91C1C] dark:text-red-400">Contraindications</span>
          </div>
          <ul className="space-y-2">
            {block.items.map((b, j) => (
              <li key={j} className="flex gap-2.5 items-start">
                <XCircle className="shrink-0 mt-0.5 w-4 h-4 text-[#B91C1C] dark:text-red-400" />
                <span className="text-[16px] leading-[1.6] font-medium text-[#B91C1C] dark:text-red-400">{renderInline(b, ctx)}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    }
    const thresholdTable = tryParseThresholdTable(block.items)
    if (thresholdTable) {
      return (
        <div key={i} className="space-y-2">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[360px] text-[15px] border-collapse">
              <tbody>
                {thresholdTable.rows.map((row, j) => {
                  const danger = isDangerRow(row.label, row.value)
                  return (
                    <tr key={j} className="border-b border-border last:border-b-0">
                      <td className="py-2 px-3 font-semibold text-foreground w-2/5 align-top">
                        {row.label}
                      </td>
                      <td className={cn("py-2 px-3 align-top", danger ? "text-[#B91C1C] dark:text-red-400 font-semibold" : "text-foreground")}>
                        {renderInline(row.value, ctx)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {thresholdTable.leftover.length > 0 && (
            <ul className="space-y-2">
              {thresholdTable.leftover.map((b, j) => (
                <li key={j} className="flex gap-2.5 items-start">
                  <span className="shrink-0 mt-2.5 w-1.5 h-1.5 rounded-full bg-[#0B6BCB]" />
                  <span className="text-[16px] leading-[1.6] text-foreground">{renderInline(b, ctx)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    return (
      <ul key={i} className="space-y-2">
        {block.items.map((b, j) => (
          <li key={j} className="flex gap-2.5 items-start">
            <span className="shrink-0 mt-2.5 w-1.5 h-1.5 rounded-full bg-[#0B6BCB]" />
            <span className="text-[16px] leading-[1.6] text-foreground">{renderInline(b, ctx)}</span>
          </li>
        ))}
      </ul>
    )
  }
  // "source" and "note" blocks are intentionally not rendered here. The
  // backend generator still appends a trailing "Source: ..." line (and
  // occasionally a "research prototype" aside) to raw answer text - real
  // backend behavior we're not changing - but the caller (ChatAnswerMessage)
  // already renders every cited source once via SourceStrip, and a
  // research-prototype note has no place in a clinical answer body. Parsing
  // still recognizes these blocks (parseAnswer) so they're cleanly excluded
  // rather than falling through to a generic paragraph.
  if (block.type === "source" || block.type === "note") {
    return null
  }
  return null
}
