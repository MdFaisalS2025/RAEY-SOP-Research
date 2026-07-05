"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  GraduationCap, AlertTriangle, Award, TrendingUp, Trophy,
  BookOpen, ShieldCheck, Users, Loader2,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

interface CreditRecord {
  id: number
  user_id: string
  user_name: string
  activity_type: "scenario_completed" | "sop_reviewed" | "committee_participation"
  activity_title: string
  credits: number
  created_at: string | null
}

interface LeaderboardEntry {
  user_id: string
  user_name: string
  total_credits: number
}

const ACTIVITY_CONFIG: Record<CreditRecord["activity_type"], { label: string; icon: typeof BookOpen; className: string }> = {
  scenario_completed: { label: "Scenario Training", icon: BookOpen, className: "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30" },
  sop_reviewed: { label: "SOP Reviewed", icon: ShieldCheck, className: "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]" },
  committee_participation: { label: "Committee Participation", icon: Users, className: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]" },
}

const CURRENT_USER_ID = "demo-user"

export default function LearningPage() {
  const [records, setRecords] = useState<CreditRecord[]>([])
  const [totalCredits, setTotalCredits] = useState(0)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [creditsRes, leaderboardRes] = await Promise.all([
          fetch(`/api/credits?user_id=${CURRENT_USER_ID}`),
          fetch("/api/credits/leaderboard"),
        ])
        const creditsData = await creditsRes.json()
        const leaderboardData = await leaderboardRes.json()
        if (cancelled) return
        setRecords(creditsData.credits ?? [])
        setTotalCredits(creditsData.total_credits ?? 0)
        setLeaderboard(leaderboardData.leaderboard ?? [])
      } catch {
        // best effort - leave empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const countByType = (type: CreditRecord["activity_type"]) =>
    records.filter(r => r.activity_type === type).length

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Learning and Credits" }]} />

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Learning and Credits</h1>
            <p className="text-sm text-[#64748B]">CE / CPD credit for training and governance participation</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype. Not for Clinical Use.</strong> Credit totals are illustrative, not accredited CE/CPD hours.</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#64748B]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your credits...
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white border border-[#E2E8F0] p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#0B6BCB]/10">
                  <Award className="w-5 h-5 text-[#0B6BCB]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0B6BCB]">{totalCredits.toFixed(1)}</p>
                  <p className="text-xs text-[#64748B]">Total Credits Earned</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
                className="rounded-2xl bg-white border border-[#E2E8F0] p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#DCFCE7]">
                  <BookOpen className="w-5 h-5 text-[#15803D]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#15803D]">{countByType("scenario_completed")}</p>
                  <p className="text-xs text-[#64748B]">Scenarios Completed</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                className="rounded-2xl bg-white border border-[#E2E8F0] p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FEF3C7]">
                  <ShieldCheck className="w-5 h-5 text-[#B45309]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#B45309]">{countByType("sop_reviewed")}</p>
                  <p className="text-xs text-[#64748B]">SOPs Reviewed</p>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                className="rounded-2xl bg-white border border-[#E2E8F0] p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#F1F5F9]">
                  <Users className="w-5 h-5 text-[#64748B]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1A2332]">{countByType("committee_participation")}</p>
                  <p className="text-xs text-[#64748B]">Committee Sessions</p>
                </div>
              </motion.div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent activity */}
              <section className="space-y-3">
                <h2 className="text-lg font-semibold font-display">Recent Activity</h2>
                {records.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-[#E2E8F0] p-6 text-sm text-[#64748B] text-center">
                    No credit-earning activity yet. Complete a scenario, review a SOP, or participate in a committee vote to start earning credits.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {records.slice(0, 12).map((r) => {
                      const config = ACTIVITY_CONFIG[r.activity_type]
                      const Icon = config.icon
                      return (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 rounded-xl bg-white border border-[#E2E8F0] p-3"
                        >
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border shrink-0", config.className)}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A2332] truncate">{r.activity_title || config.label}</p>
                            <p className="text-xs text-[#64748B]">
                              {config.label}{r.created_at ? ` - ${new Date(r.created_at).toLocaleDateString("en-US")}` : ""}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-[#0B6BCB] shrink-0">+{r.credits.toFixed(1)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Leaderboard */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#B45309]" />
                  <h2 className="text-lg font-semibold font-display">Leaderboard</h2>
                </div>
                <div className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden">
                  {leaderboard.length === 0 ? (
                    <div className="p-6 text-sm text-[#64748B] text-center">No engagement data yet.</div>
                  ) : (
                    <ul>
                      {leaderboard.map((entry, i) => (
                        <li
                          key={entry.user_id || entry.user_name}
                          className={cn(
                            "flex items-center gap-3 p-4",
                            i < leaderboard.length - 1 && "border-b border-[#EDF1F5]",
                            entry.user_id === CURRENT_USER_ID && "bg-[#0B6BCB]/5"
                          )}
                        >
                          <span className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                            i === 0 ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#F1F5F9] text-[#64748B]"
                          )}>
                            {i + 1}
                          </span>
                          <span className="flex-1 text-sm font-medium text-[#1A2332] truncate">
                            {entry.user_name || "Anonymous"}
                            {entry.user_id === CURRENT_USER_ID && <span className="text-[#0B6BCB] font-normal"> (You)</span>}
                          </span>
                          <span className="flex items-center gap-1 text-sm font-bold text-[#0B6BCB] shrink-0">
                            <TrendingUp className="w-3.5 h-3.5" />
                            {entry.total_credits.toFixed(1)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          </>
        )}

        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] text-[#334155] text-sm">
          <GraduationCap className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Connect to a hospital CE/CPD accreditation system for production credit issuance.</span>
        </div>
      </div>
    </AppShell>
  )
}
