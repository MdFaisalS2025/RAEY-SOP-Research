"use client"

import { AlertTriangle, FileText } from "lucide-react"
import { CitationChip, type InlineCitation } from "@/components/query/citation-chip"
import { cn } from "@/lib/utils"

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
          return <span key={`${keyPrefix}-${i}`} className="text-[#94A3B8] text-[13px]">{part}</span>
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
          return <strong key={i} className="font-semibold text-[#1A2332]">{renderCitationTokens(part.slice(2, -2), `s${i}`, ctx)}</strong>
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
    if (/research prototype/i.test(line)) {
      blocks.push({ type: "note", text: line.replace(/^[⚠️\s]+/, "") })
      i++; continue
    }
    if (/^(\*\*)?source:?(\*\*)?/i.test(line)) {
      blocks.push({ type: "source", text: line.replace(/^\*\*|\*\*$/g, "").replace(/^source:?\s*/i, "") })
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
      while (i < lines.length && /^[A-Z][A-Za-z /]{1,28}:\s+\S/.test(lines[i])) {
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

export function AnswerRenderer({ text, citations, onCitationClick }: { text: string; citations?: InlineCitation[]; onCitationClick?: (n: number) => void }) {
  const blocks = parseAnswer(text)
  const ctx: CitationCtx = {
    byNumber: new Map((citations ?? []).map((c) => [c.number, c])),
    onCite: onCitationClick,
  }
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const sizeClass = block.level === 1 ? "text-xl font-bold" : block.level === 2 ? "text-lg font-semibold" : "text-base font-semibold"
          const marginClass = block.level === 1 ? "" : block.level === 2 ? "pt-2 border-t border-[#EDF1F5]" : ""
          return (
            <div key={i} className={cn("first:mt-0", i > 0 && marginClass)}>
              {block.level === 1 && <h1 className={cn("font-display text-[#0B6BCB]", sizeClass)}>{block.text}</h1>}
              {block.level === 2 && <h2 className={cn("font-display text-[#0B6BCB]", sizeClass)}>{block.text}</h2>}
              {block.level === 3 && <h3 className={cn("font-display text-[#1A2332]", sizeClass)}>{block.text}</h3>}
            </div>
          )
        }
        if (block.type === "callout") {
          return (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30">
              <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[15px] leading-relaxed text-[#1A2332]">{renderInline(block.text, ctx)}</p>
            </div>
          )
        }
        if (block.type === "para") {
          return <p key={i} className="text-[16px] leading-[1.7] text-[#1A2332]">{renderInline(block.text, ctx)}</p>
        }
        if (block.type === "kv") {
          return (
            <dl key={i} className="rounded-xl border border-[#E2E8F0] divide-y divide-[#EDF1F5] overflow-hidden">
              {block.pairs.map((p, j) => (
                <div key={j} className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-4 px-4 py-3 odd:bg-muted even:bg-transparent">
                  <dt className="text-[13px] font-semibold uppercase tracking-wide text-[#64748B] sm:w-36 shrink-0">{p.label}</dt>
                  <dd className="text-[16px] leading-snug text-[#1A2332] font-medium">{renderInline(p.value, ctx)}</dd>
                </div>
              ))}
            </dl>
          )
        }
        if (block.type === "steps") {
          return (
            <ol key={i} className="space-y-2.5">
              {block.items.map((s, j) => (
                <li key={j} className="flex gap-3 items-start">
                  <span className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB] text-[13px] font-bold flex items-center justify-center">{s.num}</span>
                  <span className="text-[16px] leading-[1.6] text-[#1A2332] pt-0.5">{renderInline(s.text, ctx)}</span>
                </li>
              ))}
            </ol>
          )
        }
        if (block.type === "bullets") {
          return (
            <ul key={i} className="space-y-2">
              {block.items.map((b, j) => (
                <li key={j} className="flex gap-2.5 items-start">
                  <span className="shrink-0 mt-2.5 w-1.5 h-1.5 rounded-full bg-[#0B6BCB]" />
                  <span className="text-[16px] leading-[1.6] text-[#1A2332]">{renderInline(b, ctx)}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (block.type === "source") {
          return (
            <div key={i} className="flex items-start gap-2 text-[13px] text-[#64748B] pt-2 border-t border-[#E2E8F0]">
              <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span><span className="font-semibold">Source:</span> {block.text}</span>
            </div>
          )
        }
        if (block.type === "note") {
          return (
            <div key={i} className="flex items-start gap-2 text-[12px] text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{block.text}</span>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
