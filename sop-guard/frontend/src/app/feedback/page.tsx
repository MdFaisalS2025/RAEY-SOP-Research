"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, Loader2, MessageSquare, TrendingUp,
  Eye, Search, Link, Upload, CheckCircle2, Clock,
  FileText, Activity,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { SafetyNote } from "@/components/ui/safety-note"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessRestricted } from "@/components/ui/access-restricted"
import { useRole } from "@/lib/role-context"
import { Card } from "@/components/ui/card"

/* ─── Demo / fallback data ─── */

const demoReviewQueue = [
  { id: 1, status: "new", type: "unsafe", sop: "Sepsis Management Protocol", query: "What vasopressor to use first?", role: "Nurse", time: "2 hours ago" },
  { id: 2, status: "new", type: "incorrect", sop: "Blood Transfusion Protocol", query: "What temperature rise requires stopping?", role: "Physician", time: "5 hours ago" },
  { id: 3, status: "reviewed", type: "missing", sop: "Insulin Protocol", query: "When to hold insulin?", role: "Pharmacist", time: "1 day ago" },
]

const demoActivity = [
  { id: 1, time: "10 min ago", user: "Dr. Sharma", role: "Physician", action: "query_submitted", sop: "Sepsis Management Protocol", department: "ICU" },
  { id: 2, time: "25 min ago", user: "Nurse Patel", role: "Nurse", action: "sop_viewed", sop: "Blood Transfusion Protocol", department: "Emergency" },
  { id: 3, time: "40 min ago", user: "Dr. Khan", role: "Physician", action: "source_clicked", sop: "Ventilator Weaning Protocol", department: "ICU" },
  { id: 4, time: "1 hr ago", user: "Admin Lee", role: "Admin", action: "sop_uploaded", sop: "Post-Op Monitoring Protocol", department: "Surgery" },
  { id: 5, time: "2 hr ago", user: "Pharm. Davis", role: "Pharmacist", action: "feedback_submitted", sop: "Insulin Protocol", department: "Pharmacy" },
]

const demoSOPUsage = [
  { title: "Sepsis Management Protocol", views: 145, queries: 62, last_accessed: "10 min ago" },
  { title: "Blood Transfusion Protocol", views: 98, queries: 41, last_accessed: "25 min ago" },
  { title: "Ventilator Weaning Protocol", views: 87, queries: 35, last_accessed: "40 min ago" },
  { title: "Insulin Protocol", views: 76, queries: 28, last_accessed: "2 hr ago" },
  { title: "Post-Op Monitoring Protocol", views: 54, queries: 19, last_accessed: "1 hr ago" },
]

/* ─── Helpers ─── */

const actionIcon: Record<string, React.ReactNode> = {
  sop_viewed: <Eye className="w-4 h-4 text-[#0B6BCB]" />,
  query_submitted: <Search className="w-4 h-4 text-[#0B6BCB]" />,
  source_clicked: <Link className="w-4 h-4 text-[#0D9488]" />,
  sop_uploaded: <Upload className="w-4 h-4 text-[#15803D] dark:text-green-400" />,
  feedback_submitted: <MessageSquare className="w-4 h-4 text-[#B45309] dark:text-amber-400" />,
}

const actionLabel: Record<string, string> = {
  sop_viewed: "Viewed SOP",
  query_submitted: "Submitted Query",
  source_clicked: "Clicked Source",
  sop_uploaded: "Uploaded SOP",
  feedback_submitted: "Submitted Feedback",
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
    reviewed: "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30",
    resolved: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.new}`}>
      {status}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    unsafe: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30",
    incorrect: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
    missing: "bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/30",
    "low confidence": "bg-card text-muted-foreground border-input",
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[type] || styles.missing}`}>
      {type}
    </span>
  )
}

/* ─── Main Page ─── */

export default function FeedbackPage() {
  const { role } = useRole()
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [analytics, setAnalytics] = useState<any>(null)
  const [activityEntries, setActivityEntries] = useState<any[]>(demoActivity)
  const [sopUsage, setSopUsage] = useState<any[]>(demoSOPUsage)
  const [reviewQueue, setReviewQueue] = useState(demoReviewQueue)

  useEffect(() => {
    async function fetchData() {
      let demo = false

      // Fetch analytics
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/analytics")
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        setAnalytics(data)
      } catch {
        setAnalytics({ total_queries: 42, avg_confidence: 0.82, feedback_counts: { positive: 28, negative: 6 } })
        demo = true
      }

      // Fetch activity. Normalized here because the API's field names
      // (timestamp/user_name/sop_title) differ from the demo data's
      // shorthand shape (time/user/sop) that the table below renders -
      // leaving them unmapped meant every real-data row rendered blank.
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/activity")
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        if (data.entries && data.entries.length > 0) {
          setActivityEntries(data.entries.map((e: any) => ({
            id: e.id,
            time: e.timestamp ? new Date(e.timestamp).toLocaleString("en-US") : e.time,
            user: e.user_name || e.user,
            role: e.user_role || e.role,
            action: e.action,
            sop: e.sop_title || e.sop,
            department: e.department,
          })))
        }
      } catch {
        // keep demo data
      }

      // Fetch SOP usage. Same field-name normalization as activity above:
      // the API returns sop_title, the table renders sop.title. Without
      // mapping, the title column - and hence each row's key - was
      // undefined for every real (non-demo) row.
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/sop-usage")
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        if (data.usage && data.usage.length > 0) {
          setSopUsage(data.usage.map((s: any) => ({
            sop_id: s.sop_id,
            title: s.sop_title || s.title,
            views: s.views,
            queries: s.queries,
            last_accessed: s.last_accessed ? new Date(s.last_accessed).toLocaleString("en-US") : s.last_accessed,
          })))
        }
      } catch {
        // keep demo data
      }

      // Fetch real feedback needing review, replacing demoReviewQueue.
      // `time` arrives as an ISO string (matches activity/sop-usage above),
      // formatted the same way for display consistency.
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "") + "/api/feedback?needs_review=true&limit=20")
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        if (data.items) {
          setReviewQueue(data.items.map((it: any) => ({
            id: it.id,
            status: it.status,
            type: it.type,
            sop: it.sop,
            query: it.query,
            role: it.role || "",
            time: it.time ? new Date(it.time).toLocaleString("en-US") : it.time,
          })))
        }
      } catch {
        // keep demo data
      }

      setIsDemo(demo)
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleMarkReviewed = async (id: number) => {
    setReviewQueue(prev => prev.map(item =>
      item.id === id ? { ...item, status: "reviewed" } : item
    ))
    try {
      await fetch((process.env.NEXT_PUBLIC_API_URL || "") + `/api/feedback/${id}?status=reviewed`, { method: "PATCH" })
    } catch {
      // local state already updated optimistically; a failed persist just
      // means it reverts to "new" on next real fetch, not a broken UI
    }
  }

  if (role !== "governance_compliance" && role !== "system_admin") {
    return <AccessRestricted label="Usage & Feedback" requirement="This area requires Governance & Compliance access." />
  }

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          {/* Summary cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card padding="sm" className="space-y-2" key={i}>
                <div className="flex items-center gap-2 mb-1">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-7 w-12" />
              </Card>
            ))}
          </div>

          {/* Needs review table skeleton */}
          <Card className="space-y-3">
            <Skeleton className="h-4 w-32 mb-2" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 flex-1 max-w-[200px]" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              ))}
            </div>
          </Card>

          {/* Recent activity skeleton */}
          <Card className="space-y-3">
            <Skeleton className="h-4 w-32 mb-2" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 flex-1 max-w-[200px]" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </AppShell>
    )
  }

  const totalQueries = analytics?.total_queries || 0
  const avgConfidence = analytics?.avg_confidence || analytics?.average_confidence || 0
  const feedbackCounts = analytics?.feedback_counts || { positive: 0, negative: 0 }
  const sopsViewed = sopUsage.reduce((sum: number, s: any) => sum + (s.views || 0), 0)
  const feedbackTotal = (feedbackCounts.positive || 0) + (feedbackCounts.negative || 0)

  const summaryCards = [
    { label: "Total Queries", value: String(totalQueries), icon: Search, color: "text-[#0B6BCB]" },
    { label: "Avg Confidence", value: `${(avgConfidence * 100).toFixed(0)}%`, icon: TrendingUp, color: "text-[#15803D] dark:text-green-400" },
    { label: "SOPs Viewed", value: String(sopsViewed), icon: Eye, color: "text-[#0B6BCB]" },
    { label: "Feedback Items", value: String(feedbackTotal), icon: MessageSquare, color: "text-[#0D9488]" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Demo notice */}
        {isDemo && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Backend unavailable -- showing demo data for demonstration purposes.</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Activity data is collected for system evaluation.</span>
          <SafetyNote />
        </div>

        {/* Page header */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">SOP Activity and Feedback</h2>
          <p className="text-sm text-muted-foreground mt-1">Track SOP usage, review feedback, and monitor system activity.</p>
        </div>

        {/* ─── Section 1: Summary Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06]"
            >
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`w-4 h-4 ${card.color}`} />
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </motion.div>
          ))}
        </div>

        {/* ─── Section 2: Needs Review Queue ─── */}
        <div className="p-5 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-foreground">Needs Review</h3>
            <span className="ml-auto text-xs text-muted-foreground">{reviewQueue.filter(r => r.status === "new").length} pending</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border dark:border-white/[0.06]">
                  <th className="text-left py-2 px-2 font-medium">Status</th>
                  <th className="text-left py-2 px-2 font-medium">Issue</th>
                  <th className="text-left py-2 px-2 font-medium">SOP</th>
                  <th className="text-left py-2 px-2 font-medium hidden md:table-cell">Query</th>
                  <th className="text-left py-2 px-2 font-medium">Role</th>
                  <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Time</th>
                  <th className="text-left py-2 px-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviewQueue.map(item => (
                  <tr key={item.id} className="border-b border-border/50 dark:border-white/[0.04] hover:bg-muted/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-2"><StatusBadge status={item.status} /></td>
                    <td className="py-2.5 px-2"><TypeBadge type={item.type} /></td>
                    <td className="py-2.5 px-2 text-foreground font-medium max-w-[200px] truncate">{item.sop}</td>
                    <td className="py-2.5 px-2 text-muted-foreground max-w-[180px] truncate hidden md:table-cell">{item.query}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">{item.role}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden sm:table-cell">{item.time}</td>
                    <td className="py-2.5 px-2">
                      {item.status === "new" ? (
                        <button
                          onClick={() => handleMarkReviewed(item.id)}
                          className="press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B6BCB]/10 text-[#0B6BCB] text-xs font-medium hover:bg-[#0B6BCB]/20 transition-colors border border-[#0B6BCB]/30"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Mark Reviewed
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Section 3: Recent Activity ─── */}
        <div className="p-5 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[#0B6BCB]" />
            <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border dark:border-white/[0.06]">
                  <th className="text-left py-2 px-2 font-medium">Time</th>
                  <th className="text-left py-2 px-2 font-medium">User</th>
                  <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Role</th>
                  <th className="text-left py-2 px-2 font-medium">Action</th>
                  <th className="text-left py-2 px-2 font-medium">SOP</th>
                  <th className="text-left py-2 px-2 font-medium hidden md:table-cell">Department</th>
                </tr>
              </thead>
              <tbody>
                {activityEntries.map((entry: any, idx: number) => (
                  <tr key={entry.id || idx} className="border-b border-border/50 dark:border-white/[0.04] hover:bg-muted/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-2 text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {entry.time}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-foreground font-medium">{entry.user}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden sm:table-cell">{entry.role}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        {actionIcon[entry.action] || <Activity className="w-4 h-4 text-muted-foreground" />}
                        <span className="text-foreground text-xs">{actionLabel[entry.action] || entry.action}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-foreground max-w-[200px] truncate">{entry.sop}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden md:table-cell">{entry.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Section 4: Most Viewed SOPs ─── */}
        <div className="p-5 rounded-2xl bg-card dark:bg-white/[0.03] backdrop-blur-sm border border-border dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-[#0B6BCB]" />
            <h3 className="text-sm font-semibold text-foreground">Most Viewed SOPs</h3>
          </div>

          <div className="space-y-2">
            {sopUsage.map((sop: any, idx: number) => (
              <div
                key={sop.sop_id || sop.title || idx}
                className="interactive-card flex items-center gap-4 p-3 rounded-xl bg-muted/30 dark:bg-white/[0.02] border border-border dark:border-white/[0.04] hover:bg-muted/50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 flex items-center justify-center text-xs font-bold text-[#0B6BCB] shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{sop.title}</p>
                  <p className="text-xs text-muted-foreground">Last accessed: {sop.last_accessed}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs">
                  <div className="text-center">
                    <p className="text-foreground font-semibold">{sop.views}</p>
                    <p className="text-muted-foreground">views</p>
                  </div>
                  <div className="text-center">
                    <p className="text-foreground font-semibold">{sop.queries}</p>
                    <p className="text-muted-foreground">queries</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
