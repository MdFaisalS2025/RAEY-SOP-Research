import { CheckCircle2, XCircle, MinusCircle, AlertTriangle } from "lucide-react"
import type { ReactNode } from "react"

export function priorityBadge(priority: string): string {
  const map: Record<string, string> = {
    urgent: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    high: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    normal: "bg-card text-muted-foreground border border-input",
    low: "bg-card text-muted-foreground border border-input",
  }
  return map[priority] ?? map.normal
}

export function statusBadge(status: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    open: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30", label: "Open - Awaiting Votes" },
    approved: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30", label: "Approved" },
    rejected: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30", label: "Rejected" },
  }
  return map[status] ?? { cls: "bg-muted text-muted-foreground", label: status }
}

export function voteBadge(vote: string): { cls: string; label: string; icon: ReactNode } {
  const map: Record<string, { cls: string; label: string; icon: ReactNode }> = {
    approve: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400", label: "Approved", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    reject: { cls: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400", label: "Rejected", icon: <XCircle className="w-3.5 h-3.5" /> },
    abstain: { cls: "bg-muted text-muted-foreground", label: "Abstained", icon: <MinusCircle className="w-3.5 h-3.5" /> },
    request_changes: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400", label: "Requested Changes", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  }
  return map[vote] ?? { cls: "bg-muted text-muted-foreground", label: vote, icon: null }
}
