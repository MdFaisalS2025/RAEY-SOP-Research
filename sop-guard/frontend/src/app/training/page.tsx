"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  BookOpen, Users, TrendingUp,
  Loader2,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SafetyNote } from "@/components/ui/safety-note"
import { ErrorState } from "@/components/ui/error-state"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

type ActivityType = "scenario_completed" | "sop_reviewed" | "committee_participation"

interface CreditRecord {
  id: number
  user_id: string
  user_name: string
  activity_type: ActivityType
  activity_title: string
  credits: number
  created_at: string | null
}

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; className: string }> = {
  scenario_completed: { label: "Scenario Training", className: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30" },
  sop_reviewed: { label: "SOP Reviewed", className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30" },
  committee_participation: { label: "Committee Participation", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30" },
}

export default function TrainingPage() {
  const { role } = useRole()
  const [records, setRecords] = useState<CreditRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/credits?limit=500`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((creditsData) => {
        if (cancelled) return
        setRecords(Array.isArray(creditsData?.credits) ? creditsData.credits : [])
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const roleBannerSubtitle =
    role === "clinical_staff"
      ? "My Training: Complete scenarios and reviews to earn credit"
      : role === "educator"
        ? "Training Management: Organization-wide training activity"
        : "Training Overview: Platform-wide training activity and credit"

  const now = new Date()
  const completedThisMonth = records.filter((r) => {
    if (!r.created_at) return false
    const d = new Date(r.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length

  const distinctContributors = new Set(records.map((r) => r.user_id || r.user_name)).size

  const countByType = useMemo(() => {
    const counts: Record<ActivityType, number> = { scenario_completed: 0, sop_reviewed: 0, committee_participation: 0 }
    for (const r of records) if (r.activity_type in counts) counts[r.activity_type]++
    return counts
  }, [records])

  const stats = [
    { label: "Activities This Month", value: completedThisMonth, icon: TrendingUp, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
    { label: "Total Activities Logged", value: records.length, icon: BookOpen, color: "text-[#0B6BCB]", bg: "bg-[#0B6BCB]/10" },
    { label: "Contributing Staff", value: distinctContributors, icon: Users, color: "text-muted-foreground", bg: "bg-muted" },
  ]

  const recentActivity = [...records]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 15)

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Training" }]} />

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Training Center</h1>
            <p className="text-sm text-muted-foreground">Live activity and credit tracking across the organization</p>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <SafetyNote />
        </div>

        <div className="px-4 py-3 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] text-sm">
          <span className="font-semibold">
            {role === "clinical_staff" ? "My Training" : role === "educator" ? "Training Management" : "Training Overview"}
            {": "}
          </span>
          <span className="text-[#0B6BCB]/80">{roleBannerSubtitle.split(":").slice(1).join(":").trim()}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading training activity...
          </div>
        ) : loadError ? (
          <ErrorState message="Couldn't load training activity." />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3"
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
                    <s.icon className={cn("w-5 h-5", s.color)} />
                  </div>
                  <div>
                    <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              {(Object.keys(ACTIVITY_CONFIG) as ActivityType[]).map((type) => (
                <div key={type} className="rounded-2xl bg-card border border-border p-4">
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", ACTIVITY_CONFIG[type].className)}>
                    {ACTIVITY_CONFIG[type].label}
                  </span>
                  <p className="text-3xl font-bold text-foreground mt-2">{countByType[type]}</p>
                  <p className="text-xs text-muted-foreground">activities logged</p>
                </div>
              ))}
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold font-display">Recent Activity</h2>
              {recentActivity.length === 0 ? (
                <div className="rounded-2xl bg-card border border-border p-10 text-center text-sm text-muted-foreground">
                  No training activity logged yet.
                </div>
              ) : (
                <div className="rounded-2xl bg-card border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                          <th className="p-3 text-left">Staff</th>
                          <th className="p-3 text-left">Activity</th>
                          <th className="p-3 text-left">Type</th>
                          <th className="p-3 text-left">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentActivity.map((r) => (
                          <tr key={r.id} className="border-b border-border hover:bg-[#F8FAFC] transition-colors">
                            <td className="p-3 font-medium">{r.user_name || r.user_id || "Unknown"}</td>
                            <td className="p-3 text-muted-foreground">{r.activity_title || "-"}</td>
                            <td className="p-3">
                              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", ACTIVITY_CONFIG[r.activity_type]?.className ?? "bg-muted text-muted-foreground")}>
                                {ACTIVITY_CONFIG[r.activity_type]?.label ?? r.activity_type}
                              </span>
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString("en-US") : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}
