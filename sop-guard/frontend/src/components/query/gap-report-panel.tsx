"use client"

import { useState } from "react"
import { AlertTriangle, FileWarning, Gavel, PlusCircle, Eye, Users, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import type { InlineCitation } from "@/components/query/citation-chip"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

interface GapReport {
  id: number
  status: "open" | "sent_to_committee" | "closed"
  recommended_committee: string
  affected_department: string
  risk_level: string
}

export function ExternalOnlyWarning() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30">
      <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
      <p className="text-xs text-[#B45309] dark:text-amber-400">
        No approved SOP exists for this yet, so the material below is external reference literature only -
        not hospital policy. Do not enter patient-identifiable information.
      </p>
    </div>
  )
}

export function GapReportPanel({
  queryText,
  externalCitations,
  department = "",
}: {
  queryText: string
  externalCitations: InlineCitation[]
  department?: string
}) {
  const [report, setReport] = useState<GapReport | null>(null)
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState(false)

  const outline = externalCitations.slice(0, 5).map((c) => c.sop_title)

  const createGapReport = async () => {
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/api/sop-gap-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: queryText,
          no_match_reason: "No approved SOP covers this question yet.",
          external_sources: externalCitations.map((c) => ({ title: c.sop_title, source: c.section_title, url: c.url })),
          suggested_outline: outline,
          risk_level: "moderate",
          affected_department: department,
          recommended_committee: department ? `${department} Committee` : "SOP Governance Committee",
          recommended_action: "Committee review recommended before drafting a new SOP.",
        }),
      })
      if (!res.ok) throw new Error("failed")
      const created = await res.json()
      setReport(created)
      toast({ description: "SOP Gap Report created", variant: "success" })
    } catch {
      toast({ description: "Couldn't create the gap report - try again", variant: "error" })
    } finally {
      setCreating(false)
    }
  }

  const sendToCommittee = async () => {
    if (!report) return
    setSending(true)
    try {
      const res = await fetch(`${API_BASE}/api/sop-gap-reports/${report.id}/send-to-committee`, { method: "POST" })
      if (!res.ok) throw new Error("failed")
      const updated = await res.json()
      setReport(updated)
      toast({ description: "Sent to committee for review", variant: "success" })
    } catch {
      toast({ description: "Couldn't send to committee - try again", variant: "error" })
    } finally {
      setSending(false)
    }
  }

  const logClientAction = async (action: string, description: string) => {
    try {
      await fetch(`${API_BASE}/api/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, details: queryText, department, query: queryText }),
      })
      toast({ description, variant: "success" })
    } catch {
      toast({ description: "Couldn't record this action", variant: "error" })
    }
  }

  return (
    <div className="space-y-4">
      <ExternalOnlyWarning />

      {outline.length > 0 && (
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <FileWarning className="w-3.5 h-3.5" /> Suggested Procedure Outline (illustrative only)
          </p>
          <ul className="space-y-1.5">
            {outline.map((title, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-subtle mt-1.5 shrink-0" /> {title}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-subtle mt-2">
            Derived from external literature titles only - not a vetted clinical procedure. A committee must
            author any real SOP content.
          </p>
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">What you can do next:</p>
        <div className="flex flex-wrap gap-2">
          {!report ? (
            <button onClick={createGapReport} disabled={creating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30 hover:bg-[#0B6BCB]/15 transition-colors disabled:opacity-60">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileWarning className="w-4 h-4" />}
              Create SOP Gap Report
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30">
              <CheckCircle2 className="w-4 h-4" /> Gap Report #{report.id} created
            </span>
          )}
          {report && report.status === "open" && (
            <button onClick={sendToCommittee} disabled={sending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-60">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
              Send to Committee
            </button>
          )}
          {report && report.status === "sent_to_committee" && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30">
              <Gavel className="w-4 h-4" /> Sent to {report.recommended_committee}
            </span>
          )}
          <a href={`/proposals?new=1&title=${encodeURIComponent(`New SOP: ${queryText}`)}&summary=${encodeURIComponent(`SOP gap identified - no approved procedure currently covers: "${queryText}". ${outline.length > 0 ? "Draft outline available from retrieved external evidence." : ""}`)}&query=${encodeURIComponent(queryText)}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors">
            <PlusCircle className="w-4 h-4" /> Create Draft SOP Proposal
          </a>
          <button onClick={() => logClientAction("evidence_watchlist_added", "Added to Evidence Watch")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors">
            <Eye className="w-4 h-4" /> Add to Evidence Watch
          </button>
          <button onClick={() => logClientAction("department_review_requested", "Department review requested")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors">
            <Users className="w-4 h-4" /> Request Department Review
          </button>
        </div>
      </div>
    </div>
  )
}
