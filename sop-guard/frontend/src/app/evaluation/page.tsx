"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  FlaskConical,
  BarChart3,
  Brain,
  ShieldAlert,
  Target,
  Activity,
  Info,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"
import { AdversarialContent } from "@/components/evaluation/adversarial-content"

// "" (not an absolute localhost URL) so requests go through the Next.js
// rewrite proxy same-origin, like every other page - an absolute
// http://localhost:8000 fallback would bypass the proxy, hit CORS in any
// non-default dev port, and silently fail in production where the backend
// isn't actually on localhost.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

// ── Response shapes (subset of fields actually rendered) ──────────────────────

interface RagEvalResult {
  total_cases: number
  retrieval_precision: number
  keyword_coverage: number
  refusal_accuracy: number
}

interface RagasPerQuery {
  query: string
  category: string
  faithfulness: number
  citation_coverage: number
  top_chunk_relevance_score: number
  abstained: boolean
}

interface RagasSummary {
  aggregate: {
    total_queries: number
    avg_faithfulness: number
    avg_citation_coverage: number
    avg_top_chunk_relevance_score: number
    abstention_accuracy: number
    out_of_scope_cases: number
    generation_mode: string
    faithfulness_note?: string
  }
  per_query: RagasPerQuery[]
  generated_at: string
  error?: string
}

interface AblationResult {
  queries: number
  queries_compared: number
  reranker_on: { avg_top1_relevance: number }
  reranker_off: { avg_top1_relevance: number }
  order_change_rate: number
  top3_order_changed: number
  error?: string
}

interface ChunkDistribution {
  total_chunks: number
  distribution: { type: string; count: number; pct: number }[]
}

interface AdversarialResult {
  total_tests: number
  sensitivity: number
  specificity: number
  pairwise_separation: number
}

interface LlmStatus {
  provider: string
  model: string
  available: boolean
  mode: string
}

interface RagasRealPerQuery {
  query: string
  category: string
  faithfulness: number
  response_relevancy: number
  context_precision: number
}

interface RagasRealResult {
  available: boolean
  reason?: string
  disclaimer?: string
  judge_model?: string
  sample_size?: number
  skipped?: string[]
  _cached?: boolean
  aggregate?: {
    avg_faithfulness: number
    avg_response_relevancy: number
    avg_context_precision: number
  }
  per_query?: RagasRealPerQuery[]
}

const CHUNK_COLORS: Record<string, string> = {
  step: "bg-[#0B6BCB]",
  section: "bg-[#94A3B8]",
  step_sequence: "bg-[#0D9488]",
  threshold: "bg-[#B45309]",
  contraindication: "bg-[#B91C1C]",
  summary: "bg-[#7C3AED]",
  full_text: "bg-[#334155]",
}

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
        <h2 className="text-base font-semibold font-display text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}

function StatTile({
  icon: Icon, value, label, description, i,
}: { icon: React.ElementType; value: string; label: string; description: string; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + i * 0.04 }}
      className="p-5 rounded-2xl bg-card border border-[#0B6BCB]/10 hover:border-[#0B6BCB]/30 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-[#0B6BCB]/10 flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-[#0B6BCB]" />
      </div>
      <p className="text-3xl font-bold mb-1 text-[#0B6BCB]">{value}</p>
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      <p className="text-xs text-subtle">{description}</p>
    </motion.div>
  )
}

export default function EvaluationPage() {
  useRole()
  const [showMethodology, setShowMethodology] = useState(false)
  const [tab, setTab] = useState<"metrics" | "adversarial">(() => {
    if (typeof window === "undefined") return "metrics"
    return new URLSearchParams(window.location.search).get("tab") === "adversarial" ? "adversarial" : "metrics"
  })

  const [ragResult, setRagResult] = useState<RagEvalResult | null>(null)
  const [ragasSummary, setRagasSummary] = useState<RagasSummary | null>(null)
  const [ablation, setAblation] = useState<AblationResult | null>(null)
  const [chunkDist, setChunkDist] = useState<ChunkDistribution | null>(null)
  const [adversarial, setAdversarial] = useState<AdversarialResult | null>(null)
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  // Real RAGAS is judge-LLM-call-heavy (minutes, not milliseconds) - fetched
  // on demand rather than blocking the rest of the dashboard on page load.
  const [ragasReal, setRagasReal] = useState<RagasRealResult | null>(null)
  const [ragasRealLoading, setRagasRealLoading] = useState(false)

  async function loadRagasReal(force: boolean) {
    setRagasRealLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/evaluation/ragas?force=${force}`)
      setRagasReal(await res.json())
    } catch {
      setRagasReal({ available: false, reason: "Could not reach the evaluation backend." })
    }
    setRagasRealLoading(false)
  }

  async function loadAll(force: boolean) {
    setError("")
    try {
      const [ragRes, summaryRes, ablationRes, chunkRes, advRes, llmRes] = await Promise.all([
        fetch(`${API_BASE}/api/evaluate/rag`, { method: "POST" }),
        fetch(`${API_BASE}/api/evaluation/summary?force=${force}`),
        fetch(`${API_BASE}/api/evaluation/ablation`),
        fetch(`${API_BASE}/api/evaluation/chunk-distribution`),
        fetch(`${API_BASE}/api/evaluate/adversarial`, { method: "POST" }),
        fetch(`${API_BASE}/api/llm/status`),
      ])
      const [rag, summary, ablationData, chunk, adv, llm] = await Promise.all([
        ragRes.json(), summaryRes.json(), ablationRes.json(), chunkRes.json(), advRes.json(), llmRes.json(),
      ])
      setRagResult(rag)
      setRagasSummary(summary)
      setAblation(ablationData)
      setChunkDist(chunk)
      setAdversarial(adv)
      setLlmStatus(llm)
    } catch {
      setError("Could not reach the evaluation backend. Is it running?")
    }
  }

  useEffect(() => {
    loadAll(false).finally(() => setLoading(false))
  }, [])

  async function handleRunFresh() {
    setRefreshing(true)
    await loadAll(true)
    setRefreshing(false)
  }

  // Aggregate per-query faithfulness/citation coverage by category - real
  // numbers computed from the actual last eval run, not invented per-type
  // constants.
  const byCategory = (() => {
    if (!ragasSummary?.per_query) return []
    const buckets: Record<string, { faithfulness: number[]; coverage: number[] }> = {}
    for (const q of ragasSummary.per_query) {
      if (!q.category) continue
      buckets[q.category] ??= { faithfulness: [], coverage: [] }
      buckets[q.category].faithfulness.push(q.faithfulness ?? 0)
      buckets[q.category].coverage.push(q.citation_coverage ?? 0)
    }
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
    return Object.entries(buckets)
      .map(([type, v]) => ({ type, faithfulness: avg(v.faithfulness), coverage: avg(v.coverage), n: v.faithfulness.length }))
      .sort((a, b) => b.faithfulness - a.faithfulness)
  })()

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
              <h1 className="text-2xl font-bold font-display text-foreground">Research Evaluation Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Live metrics from the running RAG pipeline and current SOP corpus</p>
            </div>
            <button
              onClick={handleRunFresh}
              disabled={refreshing || loading}
              className="press flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] disabled:opacity-50 text-white text-xs font-medium transition-colors"
            >
              {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Run Fresh Evaluation
            </button>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B45309]" />
              Research Prototype
            </span>
            {llmStatus && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] text-xs font-medium">
                <span className={cn("w-1.5 h-1.5 rounded-full", llmStatus.available ? "bg-green-500" : "bg-[#0B6BCB]")} />
                {llmStatus.mode === "mock" ? "Mock generation (no live LLM configured)" : `${llmStatus.provider} / ${llmStatus.model}`}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              Research Prototype - Not for Clinical Use
            </span>
          </div>

          <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#B45309] dark:text-amber-400" />
            <span>
              Every number on this page is computed live against the current SOP corpus and pipeline - there is no
              synthetic/fixed dataset behind it, so results will shift as SOPs are added, edited, or removed.
            </span>
          </div>
        </motion.div>

        {/* AI Evaluation merges Standard Evals + Adversarial Testing - both
            are AI-QA views for System Admin, not daily-use pages. */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted border border-border w-fit">
          {[
            { key: "metrics" as const, label: "Standard Evals", icon: Activity },
            { key: "adversarial" as const, label: "Adversarial Testing", icon: ShieldAlert },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tab === t.key ? "bg-card text-[#0B6BCB] shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "adversarial" && <AdversarialContent />}

        {tab === "metrics" && loading && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Running live evaluation...
          </div>
        )}

        {tab === "metrics" && error && !loading && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {tab === "metrics" && !loading && !error && (
          <>
            {/* ── Section 1: Overall Performance ── */}
            <motion.div {...fade(0.05)}>
              <SectionTitle
                icon={Activity}
                title="Overall System Performance"
                subtitle={`${ragasSummary?.aggregate.total_queries ?? 0}-query live RAGAS-lite run · ${ragResult?.total_cases ?? 0} retrieval test cases · generation mode: ${ragasSummary?.aggregate.generation_mode ?? "unknown"}`}
              />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatTile
                  i={0} icon={Target}
                  value={ragResult ? ragResult.retrieval_precision.toFixed(2) : "-"}
                  label="Retrieval Precision"
                  description="Fraction of retrieval test cases whose top result matched the expected SOP"
                />
                <StatTile
                  i={1} icon={Brain}
                  value={ragasSummary ? ragasSummary.aggregate.avg_faithfulness.toFixed(2) : "-"}
                  label="Answer Faithfulness"
                  description="Sentence-level grounding score vs retrieved chunks, last live run"
                />
                <StatTile
                  i={2} icon={BarChart3}
                  value={ragasSummary ? ragasSummary.aggregate.avg_citation_coverage.toFixed(2) : "-"}
                  label="Citation Coverage"
                  description="Share of answer claims backed by an inline [N] citation"
                />
                <StatTile
                  i={3} icon={CheckCircle2}
                  value={ragasSummary ? ragasSummary.aggregate.abstention_accuracy.toFixed(2) : "-"}
                  label="Abstention Accuracy"
                  description={`Correct refusal rate on ${ragasSummary?.aggregate.out_of_scope_cases ?? 0} out-of-scope queries`}
                />
                <StatTile
                  i={4} icon={Target}
                  value={ablation ? `${(ablation.order_change_rate * 100).toFixed(0)}%` : "-"}
                  label="Reranker Impact"
                  description={`Top-3 order changed on ${ablation?.top3_order_changed ?? 0}/${ablation?.queries_compared ?? ablation?.queries ?? 0} queries with reranking on vs off`}
                />
                <StatTile
                  i={5} icon={ShieldAlert}
                  value={adversarial ? adversarial.sensitivity.toFixed(2) : "-"}
                  label="Adversarial Sensitivity"
                  description={`Verifier catch rate across ${adversarial?.total_tests ?? 0} adversarial test cases`}
                />
              </div>
            </motion.div>

            {/* ── Section 1b: Real RAGAS ── */}
            <motion.div {...fade(0.08)}>
              <div className="flex items-center justify-between gap-3 mb-5">
                <SectionTitle
                  icon={FlaskConical}
                  title="Real RAGAS Metrics"
                  subtitle={
                    ragasReal?.available
                      ? `${ragasReal.sample_size ?? 0}-query sample · judged by self-hosted model '${ragasReal.judge_model}'${ragasReal._cached ? " · cached" : ""}`
                      : "Actual RAGAS library metrics (github.com/explodinggradients/ragas), not the zero-dependency proxy above"
                  }
                />
                <button
                  onClick={() => loadRagasReal(true)}
                  disabled={ragasRealLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#0B6BCB]/30 text-[#0B6BCB] hover:bg-[#0B6BCB]/5 transition-colors disabled:opacity-50 shrink-0"
                >
                  {ragasRealLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {ragasReal ? "Re-run" : "Run Real RAGAS"}
                </button>
              </div>

              {!ragasReal && !ragasRealLoading && (
                <p className="text-xs text-subtle">
                  Not run yet - judge-LLM calls take a while (several minutes for a sample), so this isn&apos;t fetched automatically on page load.
                </p>
              )}

              {ragasReal && !ragasReal.available && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-foreground">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <span>{ragasReal.reason ?? "Real RAGAS is unavailable."}</span>
                </div>
              )}

              {ragasReal?.available && ragasReal.aggregate && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <StatTile
                      i={0} icon={Brain}
                      value={ragasReal.aggregate.avg_faithfulness.toFixed(2)}
                      label="Faithfulness"
                      description="RAGAS's own claim-decomposition faithfulness metric (LLM-judged, not our keyword heuristic)"
                    />
                    <StatTile
                      i={1} icon={Target}
                      value={ragasReal.aggregate.avg_response_relevancy.toFixed(2)}
                      label="Response Relevancy"
                      description="Embedding similarity between the query and questions generated from the answer"
                    />
                    <StatTile
                      i={2} icon={BarChart3}
                      value={ragasReal.aggregate.avg_context_precision.toFixed(2)}
                      label="Context Precision"
                      description="LLM judgment of whether each retrieved chunk was actually useful for the answer"
                    />
                  </div>
                  {ragasReal.disclaimer && (
                    <p className="text-xs text-subtle mt-3">{ragasReal.disclaimer}</p>
                  )}
                </>
              )}
            </motion.div>

            {/* ── Section 2: Retrieval Ablation ── */}
            <motion.div {...fade(0.1)}>
              <SectionTitle icon={BarChart3} title="Retrieval Ablation: Reranker On vs Off" subtitle="Same retriever, same query set - only the heuristic reranker toggles" />
              <div className="rounded-2xl bg-card border border-[#0B6BCB]/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3.5 px-5 text-muted-foreground font-medium text-xs uppercase tracking-wide">Metric</th>
                        <th className="py-3.5 px-4 text-center text-[#0B6BCB] font-semibold text-xs uppercase tracking-wide border-l-2 border-[#0B6BCB]/30 bg-[#0B6BCB]/5">Reranker On</th>
                        <th className="py-3.5 px-4 text-center text-muted-foreground font-medium text-xs uppercase tracking-wide">Reranker Off</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border last:border-0">
                        <td className="py-3 px-5 text-foreground font-medium">Avg Top-1 Relevance</td>
                        <td className="py-3 px-4 text-center font-bold border-l-2 border-[#0B6BCB]/30 bg-[#0B6BCB]/5 text-[#0B6BCB]">
                          {ablation?.reranker_on.avg_top1_relevance.toFixed(3) ?? "-"}
                        </td>
                        <td className="py-3 px-4 text-center text-muted-foreground">{ablation?.reranker_off.avg_top1_relevance.toFixed(3) ?? "-"}</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-5 text-foreground font-medium">Top-3 Order Change Rate</td>
                        <td className="py-3 px-4 text-center font-bold border-l-2 border-[#0B6BCB]/30 bg-[#0B6BCB]/5 text-[#0B6BCB]" colSpan={2}>
                          {ablation ? `${(ablation.order_change_rate * 100).toFixed(0)}% of queries (${ablation.top3_order_changed}/${ablation.queries_compared})` : "-"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* ── Section 3: Query Type Breakdown ── */}
            <motion.div {...fade(0.12)}>
              <SectionTitle icon={BarChart3} title="Query Category Breakdown" subtitle="Faithfulness and citation coverage averaged per category, from the last live eval run" />
              <div className="rounded-2xl bg-card border border-[#0B6BCB]/10 p-5 space-y-4">
                <div className="flex gap-5 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#0B6BCB] inline-block" /> Faithfulness</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#0D9488] inline-block" /> Citation Coverage</span>
                </div>
                {byCategory.length === 0 && <p className="text-xs text-subtle">No per-query data available yet.</p>}
                {byCategory.map((row, i) => (
                  <motion.div key={row.type} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-foreground w-40 shrink-0">{row.type} <span className="text-subtle">(n={row.n})</span></span>
                      <div className="flex gap-4 text-muted-foreground">
                        <span className="text-[#0B6BCB] font-medium">{row.faithfulness.toFixed(2)}</span>
                        <span className="text-muted-foreground font-medium">{row.coverage.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-[#0B6BCB] transition-all duration-700" style={{ width: `${row.faithfulness * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-[#0D9488] transition-all duration-700" style={{ width: `${row.coverage * 100}%` }} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* ── Section 4: Adversarial Verifier Benchmark ── */}
            <motion.div {...fade(0.14)}>
              <SectionTitle icon={ShieldAlert} title="Adversarial Verifier Benchmark" subtitle="Can the verifier tell a correct answer from a deliberately wrong one, on the same question?" />
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-card border border-[#0B6BCB]/10 text-center">
                  <p className="text-2xl font-bold text-[#0B6BCB]">{adversarial ? adversarial.sensitivity.toFixed(2) : "-"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Sensitivity</p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-[#0B6BCB]/10 text-center">
                  <p className="text-2xl font-bold text-[#0B6BCB]">{adversarial ? adversarial.specificity.toFixed(2) : "-"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Specificity</p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-[#0B6BCB]/10 text-center">
                  <p className="text-2xl font-bold text-[#0B6BCB]">{adversarial ? adversarial.pairwise_separation.toFixed(2) : "-"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Pairwise Separation</p>
                </div>
              </div>
              <div className="flex items-start gap-3 px-4 py-3 mt-4 rounded-xl bg-[#0B6BCB]/5 border border-[#0B6BCB]/15 text-foreground text-xs">
                <Info className="w-4 h-4 shrink-0 text-[#0B6BCB] mt-0.5" />
                <span>
                  Sensitivity alone is a misleading headline metric - a verifier that flags every answer scores 100%
                  sensitivity while providing no signal. Specificity and pairwise separation show whether it can
                  actually tell correct and wrong answers apart. See <code>/adversarial</code> for the full per-case
                  benchmark, including the generated perturbation set and rule-based vs NLI-lite vs ensemble comparison.
                </span>
              </div>
            </motion.div>

            {/* ── Section 5: Chunk Type Distribution ── */}
            <motion.div {...fade(0.16)}>
              <SectionTitle icon={Target} title="Retrieval Architecture: Chunk Type Distribution" subtitle={`${chunkDist?.total_chunks ?? 0} chunks across the current live SOP corpus`} />
              <div className="rounded-2xl bg-card border border-[#0B6BCB]/10 p-5">
                <div className="space-y-3">
                  {(chunkDist?.distribution ?? []).map((chunk, i) => (
                    <motion.div key={chunk.type} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 + i * 0.04 }} className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground w-36 shrink-0">{chunk.type}</span>
                      <div className="flex-1 h-3 rounded-full bg-muted">
                        <div className={cn("h-full rounded-full transition-all duration-700", CHUNK_COLORS[chunk.type] ?? "bg-[#94A3B8]")} style={{ width: `${chunk.pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-14 text-right">{chunk.pct}% ({chunk.count})</span>
                    </motion.div>
                  ))}
                  {(!chunkDist || chunkDist.distribution.length === 0) && (
                    <p className="text-xs text-subtle">No chunks in the corpus yet - upload an SOP to populate this.</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ── Section 6: Evaluation Methodology ── */}
            <motion.div {...fade(0.18)}>
              <div className="rounded-2xl bg-card border border-[#0B6BCB]/10 p-5">
                <button
                  onClick={() => setShowMethodology((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1 hover:text-[#0B6BCB] transition-colors w-full text-left"
                >
                  <Info className="w-4 h-4 text-[#0B6BCB]" />
                  Evaluation Methodology Note
                  <span className="ml-auto text-xs text-subtle">{showMethodology ? "hide" : "show"}</span>
                </button>
                {showMethodology && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    Retrieval precision comes from POST /api/evaluate/rag (8 hand-written retrieval test cases run
                    against the live retriever). Faithfulness, citation coverage, and abstention accuracy come from
                    the RAGAS-lite reference-free suite (GET /api/evaluation/summary, 20 queries spanning medication,
                    threshold, sequence, contraindication, monitoring, cross-SOP, and out-of-scope categories),
                    cached after the first run and refreshed on demand via &quot;Run Fresh Evaluation&quot;. The
                    reranker ablation (GET /api/evaluation/ablation) re-runs the same 20 queries with the heuristic
                    reranker forced on and off and compares top-1/top-3 relevance - retrieval only, no generation
                    step involved. The adversarial benchmark (POST /api/evaluate/adversarial) pairs each correct
                    answer with a deliberately wrong one on the same question and checks whether the procedural
                    verifier scores the correct one higher. Chunk type distribution is a live count over
                    SOPChunk.chunk_type for every chunk currently indexed. None of these numbers are pre-computed
                    constants - every reload re-derives them from whatever SOPs and chunks currently exist in the
                    database.
                  </motion.p>
                )}
                {!showMethodology && (
                  <p className="text-xs text-subtle mt-1">
                    8 retrieval test cases · 20-query RAGAS-lite suite · reranker ablation · adversarial verifier benchmark · live corpus chunk counts
                  </p>
                )}
              </div>
            </motion.div>

            {ragasSummary?.aggregate.faithfulness_note && (
              <motion.div {...fade(0.19)} className="flex items-start gap-2 px-4 py-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{ragasSummary.aggregate.faithfulness_note}</span>
              </motion.div>
            )}

            <motion.div {...fade(0.2)} className="text-center text-xs text-subtle pb-4">
              Meridian · Research Prototype · All metrics computed live from the current pipeline and SOP corpus · Not from real clinical queries
            </motion.div>
          </>
        )}
      </div>
    </AppShell>
  )
}
