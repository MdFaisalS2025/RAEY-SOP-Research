"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileWarning, Gavel, PlusCircle, Eye, Users, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { AnswerActionToolbar } from "@/components/query/answer-action-toolbar"
import type { InlineCitation } from "@/components/query/citation-chip"
import { Card } from "@/components/ui/card"

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
    <p className="text-xs text-muted-foreground px-1">
      External evidence should be reviewed before any SOP change.
    </p>
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
  const router = useRouter()
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
        <Card padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <FileWarning className="w-3.5 h-3.5" /> Suggested Procedure Outline
          </p>
          <ul className="space-y-1.5">
            {outline.map((title, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-subtle mt-1.5 shrink-0" /> {title}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-subtle mt-2">
            Derived from external literature titles. A committee must author any real SOP content.
          </p>
        </Card>
      )}

      {/* Two primary actions - review the evidence gap, or start drafting a
          proposal to close it. The rest (Evidence Watch, Department Review)
          are administrative follow-ups, not what most people need first -
          moved to the toolbar's secondary row instead of competing equally
          with the two actions that actually matter here. */}
      <AnswerActionToolbar
        primary={[
          report
            ? report.status === "open"
              ? { key: "send", label: sending ? "Sending..." : "Send to Committee", icon: sending ? Loader2 : Gavel, onClick: sendToCommittee, disabled: sending }
              : { key: "sent", label: `Sent to ${report.recommended_committee}`, icon: CheckCircle2, onClick: () => {}, disabled: true }
            : { key: "create", label: creating ? "Creating..." : "Create SOP Gap Report", icon: creating ? Loader2 : FileWarning, onClick: createGapReport, disabled: creating },
          { key: "proposal", label: "Create SOP Proposal", icon: PlusCircle, onClick: () => router.push(`/proposals?new=1&title=${encodeURIComponent(`New SOP: ${queryText}`)}&summary=${encodeURIComponent(`SOP gap identified - no approved procedure currently covers: "${queryText}". ${outline.length > 0 ? "Draft outline available from retrieved external evidence." : ""}`)}&query=${encodeURIComponent(queryText)}`) },
        ]}
        secondary={[
          { key: "evidence-watch", label: "Add to Evidence Watch", icon: Eye, onClick: () => logClientAction("evidence_watchlist_added", "Added to Evidence Watch") },
          { key: "dept-review", label: "Request Department Review", icon: Users, onClick: () => logClientAction("department_review_requested", "Department review requested") },
        ]}
      />
    </div>
  )
}
