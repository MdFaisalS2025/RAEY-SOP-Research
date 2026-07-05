"use client"

import { cn } from "@/lib/utils"

export type ReadingLevel = "clinical" | "plain"

export const READING_LEVEL_KEY = "sop-guard-reading-level"

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bMAP\b/g, "mean arterial pressure (MAP)"],
  [/\bIV\b/g, "intravenous (IV)"],
  [/\bIM\b/g, "intramuscular (IM)"],
  [/\bPRN\b/g, "as needed (PRN)"],
  [/\bNPO\b/g, "nothing by mouth (NPO)"],
  [/\bSBP\b/g, "systolic blood pressure (SBP)"],
  [/\bDBP\b/g, "diastolic blood pressure (DBP)"],
  [/\bBP\b/g, "blood pressure (BP)"],
  [/\bRR\b/g, "respiratory rate (RR)"],
  [/\bHR\b/g, "heart rate (HR)"],
  [/\bSpO2\b/gi, "oxygen saturation (SpO2)"],
  [/\bGCS\b/g, "Glasgow Coma Scale (GCS)"],
  [/\bICU\b/g, "intensive care unit (ICU)"],
  [/\bRRT\b/g, "rapid response team (RRT)"],
  [/\bCVC\b/g, "central venous catheter (CVC)"],
  [/\bABG\b/g, "arterial blood gas (ABG)"],
  [/\bCBC\b/g, "complete blood count (CBC)"],
  [/\bETT\b/g, "endotracheal tube (ETT)"],
  [/\bNG\b/g, "nasogastric (NG)"],
  [/\bSC\b/g, "subcutaneous (SC)"],
  [/\bq(\d+)h\b/gi, "every $1 hours"],
  [/\bq(\d+)min\b/gi, "every $1 minutes"],
  [/\bBID\b/gi, "twice daily (BID)"],
  [/\bTID\b/gi, "three times daily (TID)"],
  [/\bQID\b/gi, "four times daily (QID)"],
  [/\bstat\b/gi, "immediately (stat)"],
  [/\bmcg\/kg\/min\b/g, "micrograms per kilogram per minute"],
  [/\bmL\/kg\b/g, "milliliters per kilogram"],
]

function expandAbbreviations(text: string): string {
  let out = text
  for (const [re, replacement] of ABBREVIATIONS) {
    out = out.replace(re, replacement)
  }
  return out
}

/** Build a one-line "In short" summary from the first sentence containing a number or threshold. */
function buildSummary(text: string): string | null {
  const plain = text
    .replace(/^#{1,3}\s+.*$/gm, "")
    .replace(/[*_>#]/g, "")
    .replace(/\[\d+\]/g, "")
  const sentences = plain
    .split(/(?<=[.!?])\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
  const key = sentences.find((s) => /\d/.test(s) && /(>=|<=|>|<|mmHg|mmol|mL|mg|mcg|score|within|target|threshold)/i.test(s)) || sentences[0]
  if (!key) return null
  return key.length > 220 ? key.slice(0, 217) + "..." : key
}

/** Client-side simplification pass: expand abbreviations, prepend an "In short" line. */
export function simplifyAnswer(text: string): { summary: string | null; text: string } {
  return { summary: buildSummary(text), text: expandAbbreviations(text) }
}

export function ReadingLevelToggle({ value, onChange }: { value: ReadingLevel; onChange: (v: ReadingLevel) => void }) {
  const options: { key: ReadingLevel; label: string }[] = [
    { key: "clinical", label: "Clinical" },
    { key: "plain", label: "Plain language" },
  ]
  return (
    <div className="inline-flex items-center rounded-lg border border-[#E2E8F0] bg-[#F1F5F9] p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors",
            value === o.key ? "bg-white text-[#0B6BCB] shadow-sm border border-[#E2E8F0]" : "text-[#64748B] hover:text-[#1A2332]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
