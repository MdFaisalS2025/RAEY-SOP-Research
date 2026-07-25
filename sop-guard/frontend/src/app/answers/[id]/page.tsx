"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, ShieldCheck, ShieldAlert, ShieldX, MessageCircle, FileQuestion } from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { LoadingBlock } from "@/components/ui/loading-block"
import { cn } from "@/lib/utils"

interface AnswerRecord {
  query: string
  answer: string
  citations: string[]
  faithfulness: { overall_faithfulness?: number } | null
  created_at: string
}

function FaithfulnessBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return null
  const pct = Math.round(score * 100)
  if (score >= 0.85) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#15803D] dark:text-green-400 bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 rounded-full px-2.5 py-1">
        <ShieldCheck className="w-3.5 h-3.5" /> High faithfulness ({pct}%)
      </span>
    )
  }
  if (score >= 0.65) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B45309] dark:text-amber-400 bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 rounded-full px-2.5 py-1">
        <ShieldAlert className="w-3.5 h-3.5" /> Moderate faithfulness ({pct}%)
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B91C1C] dark:text-red-400 bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 rounded-full px-2.5 py-1">
      <ShieldX className="w-3.5 h-3.5" /> Low faithfulness ({pct}%)
    </span>
  )
}

function renderAnswerText(text: string) {
  const lines = text.split("\n").filter(Boolean)
  return lines.map((line, i) => {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      return (
        <p key={i} className={cn("font-semibold text-foreground mt-4 mb-1", level === 1 ? "text-lg" : "text-base")}>
          {headingMatch[2]}
        </p>
      )
    }
    if (/^>\s+/.test(line)) {
      return (
        <div key={i} className="my-2 px-4 py-2 bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 rounded-lg text-[#B45309] dark:text-amber-400 text-sm">
          {line.replace(/^>\s+/, "")}
        </div>
      )
    }
    return (
      <p key={i} className="text-[15px] leading-relaxed text-foreground mb-2">
        {line.replace(/\*\*(.+?)\*\*/g, "$1")}
      </p>
    )
  })
}

export default function AnswerPermalinkPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [record, setRecord] = useState<AnswerRecord | null>(null)
  const [status, setStatus] = useState<"loading" | "ok" | "notfound" | "error">("loading")

  useEffect(() => {
    if (!id) return
    fetch(`/api/answers/${id}`)
      .then(r => {
        if (r.status === 404) { setStatus("notfound"); return null }
        if (!r.ok) { setStatus("error"); return null }
        return r.json()
      })
      .then(data => {
        if (data) {
          setRecord({
            query: data.query_text ?? data.query ?? "",
            answer: data.answer_text ?? data.answer ?? "",
            citations: data.citations ?? [],
            faithfulness: data.faithfulness_score != null ? { overall_faithfulness: data.faithfulness_score } : null,
            created_at: data.created_at ?? "",
          })
          setStatus("ok")
        }
      })
      .catch(() => setStatus("error"))
  }, [id])

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Breadcrumb items={[{ label: "Shared answer" }]} />

        {status === "loading" && (
          <div className="mt-8">
            <LoadingBlock label="Loading answer..." />
          </div>
        )}

        {status === "notfound" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 bg-card border border-[#0B6BCB]/20 rounded-xl p-8 text-center shadow-sm">
            <FileQuestion className="w-10 h-10 text-subtle mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">This answer link is not available</p>
            <p className="text-sm text-muted-foreground mb-5">It may have expired or the link is incorrect.</p>
            <button
              onClick={() => router.push("/query")}
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#0B6BCB] hover:bg-[#0959AC] rounded-lg px-4 py-2 transition-colors"
            >
              Ask a new question
            </button>
          </motion.div>
        )}

        {status === "error" && (
          <div className="mt-8 bg-card border border-[#FECACA] dark:border-red-500/30 rounded-xl p-6 text-sm text-[#B91C1C] dark:text-red-400">
            Could not load this answer. Try again shortly.
          </div>
        )}

        {status === "ok" && record && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => router.push("/query")}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#0B6BCB] mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to query
            </button>

            <h1 className="text-2xl font-semibold text-foreground mb-1 font-display">{record.query}</h1>
            <p className="text-xs text-subtle mb-5">
              {record.created_at ? new Date(record.created_at).toLocaleString("en-US") : ""}
            </p>

            <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-4">
              {renderAnswerText(record.answer)}

              {record.citations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                  {record.citations.map((c, i) => (
                    <span key={i} className="text-xs text-muted-foreground border border-input bg-card rounded px-2 py-0.5">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {record.faithfulness && (
                <div className="mt-4">
                  <FaithfulnessBadge score={record.faithfulness.overall_faithfulness} />
                </div>
              )}
            </div>

            <div className="bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 rounded-xl px-4 py-3 text-sm text-[#B45309] dark:text-amber-400 mb-6">
              Shared answer snapshot. Verify against the current SOP before clinical use.
            </div>

            <button
              onClick={() => router.push("/query")}
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#0B6BCB] hover:bg-[#0959AC] rounded-lg px-4 py-2.5 transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> Ask a follow-up
            </button>
          </motion.div>
        )}
      </div>
    </AppShell>
  )
}
