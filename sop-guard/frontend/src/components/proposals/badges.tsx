import { CheckCircle2, XCircle, MinusCircle, AlertTriangle } from "lucide-react"
import type { ReactNode } from "react"
import { toneChip } from "@/components/ui/tone"

export function priorityBadge(priority: string): string {
  const map: Record<string, string> = {
    urgent: toneChip.danger,
    high: toneChip.danger,
    normal: "bg-card text-muted-foreground border border-input",
    low: "bg-card text-muted-foreground border border-input",
  }
  return map[priority] ?? map.normal
}

export function statusBadge(status: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    open: { cls: toneChip.warning, label: "Open - Awaiting Votes" },
    approved: { cls: toneChip.success, label: "Approved" },
    rejected: { cls: toneChip.danger, label: "Rejected" },
  }
  return map[status] ?? { cls: toneChip.neutral, label: status }
}

export function voteBadge(vote: string): { cls: string; label: string; icon: ReactNode } {
  const map: Record<string, { cls: string; label: string; icon: ReactNode }> = {
    approve: { cls: toneChip.success, label: "Approved", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    reject: { cls: toneChip.danger, label: "Rejected", icon: <XCircle className="w-3.5 h-3.5" /> },
    abstain: { cls: toneChip.neutral, label: "Abstained", icon: <MinusCircle className="w-3.5 h-3.5" /> },
    request_changes: { cls: toneChip.warning, label: "Requested Changes", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  }
  return map[vote] ?? { cls: toneChip.neutral, label: vote, icon: null }
}
