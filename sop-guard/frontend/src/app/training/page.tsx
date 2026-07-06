"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  BookOpen, Users, AlertTriangle, TrendingUp, ArrowRight, Zap,
  Loader2, ShieldCheck, Trophy,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
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

interface LeaderboardEntry {
  user_id: string
  user_name: string
  total_credits: number
}

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; className: string }> = {
  scenario_completed: { label: "Scenario Training", className: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30" },
  sop_reviewed: { label: "SOP Reviewed", className: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30" },
  committee_participation: { label: "Committee Participation", className: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30" },
}

export default function TrainingPage() {
  const { role } = useRole()
  const [records, setRecords] = useState<CreditRecord[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`${API_BASE}/api/credits?limit=500`).then((r) => r.json()),
      fetch(`${API_BASE}/api/credits/leaderboard`).then((r) => r.json()),
    ])
      .then(([creditsData, leaderboardData]) => {
        if (cancelled) return
        setRecords(Array.isArray(creditsData?.credits) ? creditsData.credits : [])
        setLeaderboard(Array.isArray(leaderboardData?.leaderboard) ? leaderboardData.leaderboard : [])
      })
      .catch(() => { if (!cancelled) { setRecords([]); setLeaderboard([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const roleBannerSubtitle =
    role === "nurse"
      ? "My Training: Complete scenarios and reviews to earn credit"
      : role === "nurse_educator"
        ? "Training Management: Organization-wide training activity"
        : "Training Overview: Platform-wide training activity and credit"

  const now = new Date()
  const completedThisMonth = records.filter((r) => {
    if (!r.created_at) return false
    const d = new Date(r.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length

  const distinctContributors = new Set(records.map((r) => r.user_id || r.user_name)).size
  const totalCreditsAwarded = records.reduce((sum, r) => sum + (r.credits || 0), 0)

  const countByType = useMemo(() => {
    const counts: Record<ActivityType, number> = { scenario_completed: 0, sop_reviewed: 0, committee_participation: 0 }
    for (const r of records) if (r.activity_type in counts) counts[r.activity_type]++
    return counts
  }, [records])

  const stats = [
    { label: "Activities This Month", value: completedThisMonth, icon: TrendingUp, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
    { label: "Total Activities Logged", value: records.length, icon: BookOpen, color: "text-[#0B6BCB]", bg: "bg-[#0B6BCB]/10" },
    { label: "Contributing Staff", value: distinctContributors, icon: Users, color: "text-[#64748B]", bg: "bg-muted" },
    { label: "Total Credits Awarded", value: totalCreditsAwarded.toFixed(1), icon: Trophy, color: "text-[#B45309] dark:text-amber-400", bg: "bg-[#FEF3C7] dark:bg-amber-500/10" },
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
            <p className="text-sm text-[#64748B]">Live activity and credit tracking across the organization</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype. Not for Clinical Use.</strong> Credit totals are illustrative, not accredited CE/CPD hours.</span>
        </div>

        <div className="px-4 py-3 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] text-sm">
          <span className="font-semibold">
            {role === "nurse" ? "My Training" : role === "nurse_educator" ? "Training Management" : "Training Overview"}
            {": "}
          </span>
          <span className="text-[#0B6BCB]/80">{roleBannerSubtitle.split(":").slice(1).join(":").trim()}</span>
        </div>

        <section className="rounded-2xl bg-card border border-[#E2E8F0] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#0B6BCB]" />
            <h2 className="text-base font-semibold">How Training Credit Works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { step: 1, title: "Complete an Activity", desc: "Finish a training scenario, review a SOP, or participate in a governance committee", color: "bg-[#0B6BCB]/10 border-[#0B6BCB]/30 text-[#0B6BCB]", dot: "bg-[#0B6BCB]" },
              { step: 2, title: "Credit Logged", desc: "The activity and credit value are recorded to your account in real time", color: "bg-[#FEF3C7] dark:bg-amber-500/10 border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400", dot: "bg-[#F59E0B]" },
              { step: 3, title: "Reflected Here", desc: "Totals, the leaderboard, and recent activity update immediately - no manual sync", color: "bg-[#DCFCE7] dark:bg-green-500/10 border-[#BBF7D0] dark:border-green-500/30 text-[#15803D] dark:text-green-400", dot: "bg-[#16A34A]" },
            ].map((item, i) => (
              <div key={item.step} className="relative flex gap-3">
                {i < 2 && (
                  <div className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-[#64748B]" />
                  </div>
                )}
                <div className={cn("flex-1 p-4 rounded-xl border", item.color.split(" ").slice(0, 2).join(" "))}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white", item.dot)}>
                      {item.step}
                    </div>
                    <p className={cn("text-sm font-semibold", item.color.split(" ")[2])}>{item.title}</p>
                  </div>
                  <p className="text-xs text-[#64748B] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#64748B] gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading training activity...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-2xl bg-card border border-[#E2E8F0] p-4 flex items-center gap-3"
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", s.bg)}>
                    <s.icon className={cn("w-5 h-5", s.color)} />
                  </div>
                  <div>
                    <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                    <p className="text-xs text-[#64748B]">{s.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              {(Object.keys(ACTIVITY_CONFIG) as ActivityType[]).map((type) => (
                <div key={type} className="rounded-2xl bg-card border border-[#E2E8F0] p-4">
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", ACTIVITY_CONFIG[type].className)}>
                    {ACTIVITY_CONFIG[type].label}
                  </span>
                  <p className="text-3xl font-bold text-[#1A2332] mt-2">{countByType[type]}</p>
                  <p className="text-xs text-[#64748B]">activities logged</p>
                </div>
              ))}
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold font-display">Recent Activity</h2>
              {recentActivity.length === 0 ? (
                <div className="rounded-2xl bg-card border border-[#E2E8F0] p-10 text-center text-sm text-[#64748B]">
                  No training activity logged yet.
                </div>
              ) : (
                <div className="rounded-2xl bg-card border border-[#E2E8F0] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] text-xs text-[#64748B] uppercase tracking-wider">
                          <th className="p-3 text-left">Staff</th>
                          <th className="p-3 text-left">Activity</th>
                          <th className="p-3 text-left">Type</th>
                          <th className="p-3 text-left">Credits</th>
                          <th className="p-3 text-left">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentActivity.map((r) => (
                          <tr key={r.id} className="border-b border-[#EDF1F5] hover:bg-[#F8FAFC] transition-colors">
                            <td className="p-3 font-medium">{r.user_name || r.user_id || "Unknown"}</td>
                            <td className="p-3 text-[#64748B]">{r.activity_title || "-"}</td>
                            <td className="p-3">
                              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", ACTIVITY_CONFIG[r.activity_type]?.className ?? "bg-muted text-[#64748B]")}>
                                {ACTIVITY_CONFIG[r.activity_type]?.label ?? r.activity_type}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-[#0B6BCB]">{r.credits}</td>
                            <td className="p-3 text-xs text-[#64748B]">{r.created_at ? new Date(r.created_at).toLocaleDateString("en-US") : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#B45309] dark:text-amber-400" /> Leaderboard
              </h2>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-[#64748B]">No credit activity recorded yet.</p>
              ) : (
                <div className="rounded-2xl bg-card border border-[#E2E8F0] divide-y divide-[#EDF1F5]">
                  {leaderboard.map((entry, i) => (
                    <div key={entry.user_id} className="flex items-center gap-3 p-4">
                      <span className="w-6 text-sm font-bold text-[#64748B]">#{i + 1}</span>
                      <span className="flex-1 text-sm font-medium text-[#1A2332]">{entry.user_name || entry.user_id}</span>
                      <span className="text-sm font-bold text-[#0B6BCB]">{entry.total_credits.toFixed(1)} credits</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-muted border border-[#E2E8F0] text-[#334155] text-sm">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Connect to a hospital LMS (HealthStream, Relias) for accredited CE/CPD tracking and formal module rosters in production.</span>
        </div>
      </div>
    </AppShell>
  )
}
