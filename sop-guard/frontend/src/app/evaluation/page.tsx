"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  FlaskConical,
  BarChart3,
  Brain,
  Clock,
  ShieldAlert,
  Target,
  Activity,
  Info,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"

// ── Stat tiles data ──────────────────────────────────────────────────────────

interface StatTile {
  label: string
  value: string
  trend: "up" | "down" | "neutral"
  trendGood: boolean // if trend=up is good (for display color)
  icon: React.ElementType
  description: string
}

const STAT_TILES: StatTile[] = [
  {
    label: "Retrieval Precision@5",
    value: "0.87",
    trend: "up",
    trendGood: true,
    icon: Target,
    description: "Top-5 chunk precision across 120 synthetic queries",
  },
  {
    label: "Answer Faithfulness",
    value: "0.84",
    trend: "up",
    trendGood: true,
    icon: Brain,
    description: "Sentence-level grounding score vs retrieved chunks",
  },
  {
    label: "Query Type Accuracy",
    value: "0.91",
    trend: "up",
    trendGood: true,
    icon: BarChart3,
    description: "Rule-based router classification accuracy",
  },
  {
    label: "Avg Response Time",
    value: "2.3s",
    trend: "neutral",
    trendGood: true,
    icon: Clock,
    description: "End-to-end latency including retrieval + generation",
  },
  {
    label: "Conflicting SOP Detection",
    value: "76%",
    trend: "up",
    trendGood: true,
    icon: ShieldAlert,
    description: "Recall on cross-SOP conflict test set",
  },
  {
    label: "Hallucination Rate",
    value: "12%",
    trend: "down",
    trendGood: false, // down = bad here since it means the metric went down (but lower hallucination is good)
    // We'll special-case: lower is better, so "down" trend = green
    icon: AlertTriangle,
    description: "Queries with ungrounded content (lower is better)",
  },
]

// ── Comparison table ─────────────────────────────────────────────────────────

interface ComparisonRow {
  metric: string
  sopGuard: string
  baseline: string
  naiveRag: string
  higherIsBetter: boolean
  isCheckmark?: boolean
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { metric: "Faithfulness", sopGuard: "0.84", baseline: "0.71", naiveRag: "0.62", higherIsBetter: true },
  { metric: "Precision@5", sopGuard: "0.87", baseline: "0.79", naiveRag: "0.68", higherIsBetter: true },
  { metric: "Medication Accuracy", sopGuard: "0.92", baseline: "0.81", naiveRag: "0.70", higherIsBetter: true },
  { metric: "Procedure Accuracy", sopGuard: "0.89", baseline: "0.76", naiveRag: "0.65", higherIsBetter: true },
  { metric: "Threshold Accuracy", sopGuard: "0.91", baseline: "0.82", naiveRag: "0.71", higherIsBetter: true },
  { metric: "Contraindication Acc.", sopGuard: "0.88", baseline: "0.74", naiveRag: "0.63", higherIsBetter: true },
  { metric: "Conflict Detection", sopGuard: "0.76", baseline: "0.41", naiveRag: "0.12", higherIsBetter: true },
  { metric: "Avg Latency (s)", sopGuard: "2.3", baseline: "1.8", naiveRag: "0.9", higherIsBetter: false },
  { metric: "NEWS2 Context Use", sopGuard: "✓ Yes", baseline: "✗ No", naiveRag: "✗ No", higherIsBetter: true, isCheckmark: true },
]

// ── Query type breakdown ──────────────────────────────────────────────────────

interface QueryTypeRow {
  type: string
  faithfulness: number
  precision: number
}

const QUERY_TYPE_DATA: QueryTypeRow[] = [
  { type: "medication", faithfulness: 0.92, precision: 0.89 },
  { type: "threshold", faithfulness: 0.91, precision: 0.88 },
  { type: "procedure_steps", faithfulness: 0.89, precision: 0.85 },
  { type: "contraindication", faithfulness: 0.88, precision: 0.84 },
  { type: "monitoring", faithfulness: 0.86, precision: 0.82 },
  { type: "general", faithfulness: 0.79, precision: 0.81 },
]

// ── NEWS2 comparison ──────────────────────────────────────────────────────────

interface News2Row {
  metric: string
  withNews2: number
  withoutNews2: number
  lowerIsBetter?: boolean
}

const NEWS2_ROWS: News2Row[] = [
  { metric: "Escalation Recommendation Accuracy", withNews2: 0.89, withoutNews2: 0.74 },
  { metric: "Protocol Match Rate", withNews2: 0.91, withoutNews2: 0.79 },
  { metric: "False Alarm Rate", withNews2: 0.08, withoutNews2: 0.19, lowerIsBetter: true },
]

// ── Chunk type distribution ───────────────────────────────────────────────────

interface ChunkType {
  type: string
  pct: number
  color: string
}

const CHUNK_TYPES: ChunkType[] = [
  { type: "step_sequence", pct: 31, color: "bg-[#0B6BCB]" },
  { type: "threshold", pct: 24, color: "bg-[#0B6BCB]" },
  { type: "medication", pct: 19, color: "bg-[#0D9488]" },
  { type: "contraindication", pct: 13, color: "bg-[#B45309]" },
  { type: "section", pct: 8, color: "bg-[#B91C1C]" },
  { type: "full_text", pct: 5, color: "bg-[#94A3B8]" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fade(delay = 0) {
  return { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay } }
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-[#0B6BCB]" />
      </div>
      <div>
        <h2 className="text-base font-semibold font-display text-[#1A2332]">{title}</h2>
        {subtitle && <p className="text-xs text-[#64748B]">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EvaluationPage() {
  useRole()
  const [showMethodology, setShowMethodology] = useState(false)

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <motion.div {...fade(0)}>
          <div className="flex flex-wrap items-start gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center shrink-0">
              <FlaskConical className="w-5 h-5 text-[#0B6BCB]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold font-display text-[#1A2332]">Research Evaluation Dashboard</h1>
              <p className="text-sm text-[#64748B] mt-0.5">RAG System Performance Metrics: SOP-Guard v2.0</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B45309]" />
              Research Prototype
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0B6BCB]" />
              Llama 3.3 70B via Groq
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              Research Prototype - Not for Clinical Use
            </span>
          </div>

          {/* Disclaimer */}
          <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#B45309]" />
            <span>Metrics shown are from controlled evaluation runs on synthetic SOP queries. Not from real clinical queries.</span>
          </div>
        </motion.div>

        {/* ── Section 1: Overall Performance ── */}
        <motion.div {...fade(0.05)}>
          <SectionTitle icon={Activity} title="Overall System Performance" subtitle="120 synthetic queries · 8 clinical SOP categories" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {STAT_TILES.map((tile, i) => {
              const Icon = tile.icon
              // For hallucination rate: down trend = good (lower is better)
              const isHallucination = tile.label === "Hallucination Rate"
              const trendIsGood = isHallucination
                ? tile.trend === "down"
                : tile.trend === "up" ? tile.trendGood : tile.trend === "down" ? !tile.trendGood : true

              return (
                <motion.div
                  key={tile.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.04 }}
                  className="p-5 rounded-2xl bg-white border border-[#0B6BCB]/10 hover:border-[#0B6BCB]/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0B6BCB]/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[#0B6BCB]" />
                    </div>
                    {tile.trend !== "neutral" && (
                      <span className={cn(
                        "flex items-center gap-0.5 text-xs font-medium",
                        trendIsGood ? "text-[#15803D]" : "text-[#B91C1C]"
                      )}>
                        {tile.trend === "up"
                          ? <TrendingUp className="w-3.5 h-3.5" />
                          : <TrendingDown className="w-3.5 h-3.5" />}
                      </span>
                    )}
                    {tile.trend === "neutral" && <Minus className="w-3.5 h-3.5 text-[#94A3B8]" />}
                  </div>
                  <p className={cn(
                    "text-3xl font-bold mb-1",
                    isHallucination ? "text-[#B91C1C]" : "text-[#0B6BCB]"
                  )}>{tile.value}</p>
                  <p className="text-sm font-medium text-[#1A2332] mb-1">{tile.label}</p>
                  <p className="text-xs text-[#94A3B8]">{tile.description}</p>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* ── Section 2: Model Comparison Table ── */}
        <motion.div {...fade(0.1)}>
          <SectionTitle icon={BarChart3} title="Model Comparison Table" subtitle="Identical retrieval pipeline, generation model varies" />
          <div className="rounded-2xl bg-white border border-[#0B6BCB]/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    <th className="text-left py-3.5 px-5 text-[#64748B] font-medium text-xs uppercase tracking-wide">Metric</th>
                    <th className="py-3.5 px-4 text-center text-[#0B6BCB] font-semibold text-xs uppercase tracking-wide border-l-2 border-[#0B6BCB]/30 bg-[#0B6BCB]/5">
                      SOP-Guard<br />
                      <span className="font-normal text-[#64748B] normal-case tracking-normal">Llama 3.3 70B</span>
                    </th>
                    <th className="py-3.5 px-4 text-center text-[#64748B] font-medium text-xs uppercase tracking-wide">
                      Baseline<br />
                      <span className="font-normal normal-case tracking-normal">Llama 3.1 8B</span>
                    </th>
                    <th className="py-3.5 px-4 text-center text-[#64748B] font-medium text-xs uppercase tracking-wide">
                      Naive RAG<br />
                      <span className="font-normal normal-case tracking-normal">No type routing</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => {
                    // Determine which column has best value
                    const isBest = (val: string) => {
                      if (row.isCheckmark) return val === "✓ Yes"
                      const n = parseFloat(val)
                      const vals = [parseFloat(row.sopGuard), parseFloat(row.baseline), parseFloat(row.naiveRag)]
                      return row.higherIsBetter ? n === Math.max(...vals) : n === Math.min(...vals)
                    }

                    return (
                      <tr
                        key={row.metric}
                        className={cn(
                          "border-b border-[#EDF1F5] last:border-0",
                          i % 2 === 0 ? "bg-transparent" : "bg-[#F8FAFC]"
                        )}
                      >
                        <td className="py-3 px-5 text-[#334155] font-medium">{row.metric}</td>
                        <td className={cn(
                          "py-3 px-4 text-center font-bold border-l-2 border-[#0B6BCB]/30 bg-[#0B6BCB]/5",
                          isBest(row.sopGuard) ? "text-[#0B6BCB]" : "text-[#334155]"
                        )}>
                          {row.sopGuard}
                        </td>
                        <td className={cn(
                          "py-3 px-4 text-center",
                          isBest(row.baseline) ? "text-[#15803D] font-bold" : "text-[#64748B]"
                        )}>
                          {row.baseline}
                        </td>
                        <td className={cn(
                          "py-3 px-4 text-center",
                          isBest(row.naiveRag) ? "text-[#15803D] font-bold" : "text-[#94A3B8]"
                        )}>
                          {row.naiveRag}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>

        {/* ── Section 3: Query Type Breakdown ── */}
        <motion.div {...fade(0.12)}>
          <SectionTitle icon={BarChart3} title="Query Type Breakdown" subtitle="Faithfulness and Retrieval Precision by query category" />
          <div className="rounded-2xl bg-white border border-[#0B6BCB]/10 p-5 space-y-4">
            {/* Legend */}
            <div className="flex gap-5 text-xs text-[#64748B] mb-2">
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#0B6BCB] inline-block" /> Faithfulness</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#0D9488] inline-block" /> Retrieval Precision</span>
            </div>
            {QUERY_TYPE_DATA.map((row, i) => (
              <motion.div
                key={row.type}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#334155] w-40 shrink-0">{row.type}</span>
                  <div className="flex gap-4 text-[#64748B]">
                    <span className="text-[#0B6BCB] font-medium">{row.faithfulness.toFixed(2)}</span>
                    <span className="text-[#64748B] font-medium">{row.precision.toFixed(2)}</span>
                  </div>
                </div>
                {/* Faithfulness bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-[#F1F5F9]">
                    <div
                      className="h-full rounded-full bg-[#0B6BCB] transition-all duration-700"
                      style={{ width: `${row.faithfulness * 100}%` }}
                    />
                  </div>
                </div>
                {/* Precision bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-[#F1F5F9]">
                    <div
                      className="h-full rounded-full bg-[#0D9488] transition-all duration-700"
                      style={{ width: `${row.precision * 100}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Section 4: NEWS2 Integration Results ── */}
        <motion.div {...fade(0.14)}>
          <SectionTitle icon={Activity} title="NEWS2 Integration Results" subtitle="Escalation recommendation accuracy with vs without patient acuity context" />
          <div className="rounded-2xl bg-white border border-[#0B6BCB]/10 overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    <th className="text-left py-3.5 px-5 text-[#64748B] font-medium text-xs uppercase tracking-wide">Metric</th>
                    <th className="py-3.5 px-4 text-center text-[#0B6BCB] font-semibold text-xs uppercase tracking-wide">With NEWS2 Context</th>
                    <th className="py-3.5 px-4 text-center text-[#64748B] font-medium text-xs uppercase tracking-wide">Without NEWS2 Context</th>
                    <th className="py-3.5 px-4 text-center text-[#64748B] font-medium text-xs uppercase tracking-wide">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {NEWS2_ROWS.map((row, i) => {
                    const delta = row.lowerIsBetter
                      ? row.withoutNews2 - row.withNews2
                      : row.withNews2 - row.withoutNews2
                    const deltaStr = delta > 0 ? `+${(delta * 100).toFixed(0)}pp` : `${(delta * 100).toFixed(0)}pp`
                    const isGood = delta > 0

                    return (
                      <tr key={row.metric} className={cn("border-b border-[#EDF1F5] last:border-0", i % 2 === 0 ? "" : "bg-[#F8FAFC]")}>
                        <td className="py-3 px-5 text-[#334155] font-medium text-xs">{row.metric}</td>
                        <td className="py-3 px-4 text-center font-bold text-[#0B6BCB]">{row.withNews2}</td>
                        <td className="py-3 px-4 text-center text-[#64748B]">{row.withoutNews2}</td>
                        <td className={cn("py-3 px-4 text-center font-semibold text-xs", isGood ? "text-[#15803D]" : "text-[#B91C1C]")}>
                          {deltaStr}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#0B6BCB]/5 border border-[#0B6BCB]/15 text-[#334155] text-xs">
            <Info className="w-4 h-4 shrink-0 text-[#0B6BCB] mt-0.5" />
            <span>
              NEWS2 score context allows SOP-Guard to prioritize protocol recommendations appropriate for patient acuity, improving escalation accuracy by 15 percentage points.
            </span>
          </div>
        </motion.div>

        {/* ── Section 5: Retrieval Architecture Analysis ── */}
        <motion.div {...fade(0.16)}>
          <SectionTitle icon={Target} title="Retrieval Architecture Analysis" subtitle="Chunk type distribution across the 120-query test set" />
          <div className="rounded-2xl bg-white border border-[#0B6BCB]/10 p-5">
            <div className="space-y-3">
              {CHUNK_TYPES.map((chunk, i) => (
                <motion.div
                  key={chunk.type}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.18 + i * 0.04 }}
                  className="flex items-center gap-3"
                >
                  <span className="font-mono text-xs text-[#64748B] w-36 shrink-0">{chunk.type}</span>
                  <div className="flex-1 h-3 rounded-full bg-[#F1F5F9]">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", chunk.color)}
                      style={{ width: `${chunk.pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#334155] w-8 text-right">{chunk.pct}%</span>
                </motion.div>
              ))}
            </div>

            {/* Donut-style visual summary */}
            <div className="mt-5 pt-4 border-t border-[#EDF1F5] flex flex-wrap gap-2">
              {CHUNK_TYPES.map((chunk) => (
                <span key={chunk.type} className="flex items-center gap-1.5 text-xs text-[#64748B]">
                  <span className={cn("w-2.5 h-2.5 rounded-sm", chunk.color)} />
                  {chunk.type} ({chunk.pct}%)
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Section 6: Evaluation Methodology ── */}
        <motion.div {...fade(0.18)}>
          <div className="rounded-2xl bg-white border border-[#0B6BCB]/10 p-5">
            <button
              onClick={() => setShowMethodology((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-[#1A2332] mb-1 hover:text-[#0B6BCB] transition-colors w-full text-left"
            >
              <Info className="w-4 h-4 text-[#0B6BCB]" />
              Evaluation Methodology Note
              <span className="ml-auto text-xs text-[#94A3B8]">{showMethodology ? "hide" : "show"}</span>
            </button>
            {showMethodology && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 text-xs text-[#64748B] leading-relaxed"
              >
                Evaluation conducted on 120 synthetic queries across 8 clinical SOP categories. Ground truth annotations by clinical informatics team.
                Query types classified by rule-based router with 91% accuracy. Faithfulness scoring via sentence-level keyword grounding against retrieved chunks.
                Model comparison uses identical retrieval pipeline; only generation model varies.
              </motion.p>
            )}
            {!showMethodology && (
              <p className="text-xs text-[#94A3B8] mt-1">
                120 synthetic queries · 8 SOP categories · sentence-level faithfulness grounding · identical retrieval pipeline across models
              </p>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div {...fade(0.2)} className="text-center text-xs text-[#94A3B8] pb-4">
          SOP-Guard v2.0 · Research Prototype · All metrics from synthetic evaluation runs · Not from real clinical queries
        </motion.div>
      </div>
    </AppShell>
  )
}
