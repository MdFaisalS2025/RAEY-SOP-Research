"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, Search, Brain, Shield, Gauge, Send, ChevronDown } from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { cn } from "@/lib/utils"

interface AgentDetail {
  id: string
  label: string
  desc: string
  icon: typeof MessageSquare
  color: string
  detail: {
    explanation: string
    inputExample: string
    outputExample: string
    failure: string
  }
}

const agents: AgentDetail[] = [
  {
    id: "intake",
    label: "Intake Agent",
    desc: "Reads the question and figures out what type of query it is.",
    icon: MessageSquare,
    color: "blue",
    detail: {
      explanation: "Parses the raw question, classifies it (e.g. threshold query, sequence query, general lookup), and extracts key entities like drug names or procedure types.",
      inputExample: "\"What are the steps for sepsis management?\"",
      outputExample: "{ type: \"sequence\", entities: [\"sepsis\", \"management\"], intent: \"procedure_steps\" }",
      failure: "Misclassifies the query type, which sends retrieval down the wrong path.",
    },
  },
  {
    id: "retrieval",
    label: "Retrieval Agent",
    desc: "Searches the SOP database for relevant protocol sections.",
    icon: Search,
    color: "purple",
    detail: {
      explanation: "Takes the parsed query and runs a similarity search over SOP document chunks stored as vector embeddings. Returns the top matching sections.",
      inputExample: "{ type: \"sequence\", entities: [\"sepsis\", \"management\"] }",
      outputExample: "3 chunks from \"Sepsis Management Protocol v2.1\", sections 4.1, 4.2, 4.3",
      failure: "Retrieves wrong or outdated SOP sections, leading to an incorrect answer downstream.",
    },
  },
  {
    id: "reasoning",
    label: "Reasoning Agent",
    desc: "Builds a structured answer from the retrieved SOP content.",
    icon: Brain,
    color: "amber",
    detail: {
      explanation: "An LLM reads the retrieved SOP chunks and generates a step-by-step answer. It includes thresholds, sequences, and contraindications from the source.",
      inputExample: "3 SOP chunks about sepsis management protocol",
      outputExample: "10-step procedure with dosages, time windows, and escalation criteria",
      failure: "Hallucinated steps or wrong threshold values that are not in the source SOP.",
    },
  },
  {
    id: "verifier",
    label: "Verifier Agent",
    desc: "Checks the generated answer against the source SOP for correctness.",
    icon: Shield,
    color: "red",
    detail: {
      explanation: "Compares the generated answer to the original SOP text. Flags wrong thresholds, missing steps, incorrect sequences, and omitted contraindications.",
      inputExample: "Generated 10-step answer + original SOP chunks",
      outputExample: "All thresholds correct. Step order verified. No missing contraindications.",
      failure: "Misses a subtle threshold error (e.g. \"30 mg\" vs \"30 mg/kg\") or overlooks a skipped step.",
    },
  },
  {
    id: "confidence",
    label: "Confidence Gate",
    desc: "Scores how confident the system is and decides whether to show the answer.",
    icon: Gauge,
    color: "teal",
    detail: {
      explanation: "Calculates a confidence score based on retrieval quality, verification results, and answer completeness. Low scores trigger a warning or abstention.",
      inputExample: "Verification result + retrieval scores + answer completeness metrics",
      outputExample: "Score: 0.85, High confidence. Safe to present.",
      failure: "Overconfident score on a poorly verified answer, or unnecessary abstention on a good one.",
    },
  },
  {
    id: "output",
    label: "Output Formatter",
    desc: "Assembles the final response with citations and a verification badge.",
    icon: Send,
    color: "green",
    detail: {
      explanation: "Packages the verified answer with source citations, confidence score, verification status badge, and a link back to the original SOP sections.",
      inputExample: "Verified answer + confidence score + source citations",
      outputExample: "Formatted response card with green verification badge and 3 SOP citations",
      failure: "Broken citation links or missing verification badge when it should be shown.",
    },
  },
]

const colorMap: Record<string, { bg: string; border: string; text: string; highlight: string }> = {
  blue: { bg: "bg-[#0B6BCB]/10", border: "border-blue-500/30", text: "text-[#0B6BCB]", highlight: "bg-[#0B6BCB]/10" },
  purple: { bg: "bg-[#0D9488]/10", border: "border-purple-500/30", text: "text-[#0D9488]", highlight: "bg-[#0D9488]/10" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", highlight: "bg-amber-500/20" },
  red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", highlight: "bg-red-500/20" },
  teal: { bg: "bg-[#0B6BCB]/10", border: "border-[#0B6BCB]/30", text: "text-[#0B6BCB]", highlight: "bg-[#0B6BCB]/10" },
  green: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", highlight: "bg-green-500/20" },
}

const techStack = [
  { category: "Frontend", items: ["Next.js 14", "TypeScript", "Tailwind CSS", "Framer Motion", "Recharts"] },
  { category: "Backend", items: ["FastAPI", "Python 3.11", "SQLAlchemy (async)", "Pydantic"] },
  { category: "AI/ML", items: ["Ollama (llama3.2, self-hosted)", "sentence-transformers (BAAI/bge-small-en-v1.5)", "Web Speech API (voice, browser-native)"] },
  { category: "Infrastructure", items: ["In-memory vector search (no external vector DB)", "SQLite / PostgreSQL", "Docker"] },
]

const demoTrace = [
  { stage: "Query", agent: "intake", text: "\"What are the steps for sepsis management?\"" },
  { stage: "Intake", agent: "intake", text: "Classified as: sequence query" },
  { stage: "Retrieval", agent: "retrieval", text: "Found 3 chunks from Sepsis Management Protocol" },
  { stage: "Reasoning", agent: "reasoning", text: "Generated 10-step answer from retrieved evidence" },
  { stage: "Verification", agent: "verifier", text: "All thresholds correct, step order verified" },
  { stage: "Confidence", agent: "confidence", text: "0.85, High confidence" },
]

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-xl bg-muted/30 dark:bg-white/[0.03] border border-border dark:border-white/[0.06] text-center">
      <p className="text-2xl font-bold text-[#0B6BCB] dark:text-[0B6BCB]">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  )
}

export default function ArchitecturePage() {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const [traceAnimIndex, setTraceAnimIndex] = useState<number>(-1)
  const [metrics, setMetrics] = useState<any>(null)

  // Fetch system metrics
  useEffect(() => {
    fetch("/api/project/summary")
      .then(r => r.json())
      .then(setMetrics)
      .catch(() => {})
  }, [])

  // Sequential highlight animation on load
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    agents.forEach((_, i) => {
      timers.push(setTimeout(() => setHighlightedIndex(i), 600 + i * 400))
    })
    // Clear highlight after all done
    timers.push(setTimeout(() => setHighlightedIndex(-1), 600 + agents.length * 400 + 500))
    return () => timers.forEach(clearTimeout)
  }, [])

  // Demo trace animation
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    demoTrace.forEach((_, i) => {
      timers.push(setTimeout(() => setTraceAnimIndex(i), i * 600))
    })
    return () => timers.forEach(clearTimeout)
  }, [])

  const toggleAgent = (id: string) => {
    setExpandedAgent(expandedAgent === id ? null : id)
  }

  return (
    <AppShell>
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <MetricCard label="SOPs Indexed" value={metrics.dataset?.total_sops || 0} />
            <MetricCard label="Chunk Types" value={metrics.capabilities?.typed_chunks?.length || 7} />
            <MetricCard label="Synonym Groups" value="28" />
            <MetricCard label="Adversarial Tests" value={metrics.dataset?.adversarial_tests || 17} />
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-lg font-semibold mb-1">Query Pipeline</h2>
          <p className="text-sm text-muted-foreground">Each question flows through six stages. Click any stage to see details.</p>
        </motion.div>

        {/* Pipeline */}
        <div className="space-y-3">
          {agents.map((agent, i) => {
            const c = colorMap[agent.color]
            const isExpanded = expandedAgent === agent.id
            const isHighlighted = highlightedIndex === i

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                {i > 0 && (
                  <div className="flex items-center justify-center py-1">
                    <motion.div
                      className="w-px h-6"
                      animate={{
                        backgroundColor: isHighlighted || highlightedIndex === i - 1
                          ? "hsl(var(--teal-400, 175 84% 32%))"
                          : "hsl(var(--border))",
                      }}
                      style={{ backgroundColor: "hsl(var(--border))" }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
                <motion.div
                  className={cn(
                    "flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all",
                    c.bg,
                    c.border,
                    isHighlighted && "ring-2 ring-teal-400/50 shadow-lg shadow-teal-500/10",
                  )}
                  onClick={() => toggleAgent(agent.id)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  animate={isHighlighted ? { scale: 1.02 } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", c.bg)}>
                    <agent.icon className={cn("w-5 h-5", c.text)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs font-mono px-2 py-0.5 rounded", c.bg, c.text)}>Step {i + 1}</span>
                      <h3 className="text-sm font-semibold">{agent.label}</h3>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="ml-auto"
                      >
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </motion.div>
                    </div>
                    <p className="text-sm text-muted-foreground">{agent.desc}</p>
                  </div>
                </motion.div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className={cn("mt-2 ml-14 p-4 rounded-xl border space-y-3", c.bg, c.border)}>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">What it does</h4>
                          <p className="text-sm">{agent.detail.explanation}</p>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Input example</h4>
                            <p className="text-xs font-mono bg-background/50 p-2 rounded">{agent.detail.inputExample}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Output example</h4>
                            <p className="text-xs font-mono bg-background/50 p-2 rounded">{agent.detail.outputExample}</p>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-red-400 uppercase mb-1">What can go wrong</h4>
                          <p className="text-sm text-muted-foreground">{agent.detail.failure}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* Demo Trace */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-lg font-semibold mb-1">Demo Trace</h2>
          <p className="text-sm text-muted-foreground mb-4">A sample query flowing through all six stages.</p>

          <div className="space-y-2">
            {demoTrace.map((step, i) => (
              <motion.div
                key={step.stage}
                initial={{ opacity: 0, x: -10 }}
                animate={traceAnimIndex >= i ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border"
              >
                <span className="text-xs font-mono font-bold text-[#0B6BCB] w-24 shrink-0 pt-0.5">
                  {step.stage}
                </span>
                <span className="text-sm text-muted-foreground">{step.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tech Stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-lg font-semibold mb-4">Technology Stack</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {techStack.map((group) => (
              <div key={group.category} className="p-4 rounded-2xl bg-card border border-border">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3">{group.category}</h3>
                <ul className="space-y-1.5">
                  {group.items.map((item) => (
                    <li key={item} className="text-sm text-foreground">{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AppShell>
  )
}
