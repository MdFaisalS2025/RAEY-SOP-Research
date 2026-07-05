"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, TrendingDown, Database, ChevronDown, ChevronUp,
  BarChart2, Activity, CheckCircle, Info
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

// ─── Inline mock data ─────────────────────────────────────────────────────────

const SOP_OUTCOMES = [
  {
    sop_id: "IC-PPE-001",
    sop_title: "High-Risk Respiratory Isolation + PPE",
    last_major_update: "2024-11-15",
    metric: "Healthcare worker infection rate",
    before_value: "3.2 per 1000 staff-days",
    after_value: "1.1 per 1000 staff-days",
    change_pct: -66,
    trend: "improving",
    data_source: "Infection Control Monthly Report",
    confidence: "moderate",
    months_tracked: 8,
  },
  {
    sop_id: "ICU-SEP-002",
    sop_title: "Sepsis Early Recognition - 1-Hour Bundle",
    last_major_update: "2024-08-20",
    metric: "Sepsis mortality rate (ICU)",
    before_value: "22.4%",
    after_value: "16.1%",
    change_pct: -28,
    trend: "improving",
    data_source: "ICU Quality Dashboard",
    confidence: "high",
    months_tracked: 10,
  },
  {
    sop_id: "IC-CL-005",
    sop_title: "Central Line Infection Prevention (CLABSI)",
    last_major_update: "2024-06-10",
    metric: "CLABSI rate per 1000 line-days",
    before_value: "1.8",
    after_value: "0.9",
    change_pct: -50,
    trend: "improving",
    data_source: "NHSN Monthly Report",
    confidence: "high",
    months_tracked: 12,
  },
  {
    sop_id: "HVAP-FALL-004",
    sop_title: "Patient Fall Risk Assessment (Morse Scale)",
    last_major_update: "2025-01-05",
    metric: "Patient fall rate per 1000 patient-days",
    before_value: "2.9",
    after_value: "2.1",
    change_pct: -28,
    trend: "improving",
    data_source: "Patient Safety Event Reports",
    confidence: "moderate",
    months_tracked: 6,
  },
  {
    sop_id: "PHARM-MED-007",
    sop_title: "High-Alert Medication Double-Check",
    last_major_update: "2024-09-30",
    metric: "Medication error rate (ICU)",
    before_value: "4.7 per 1000 doses",
    after_value: "2.1 per 1000 doses",
    change_pct: -55,
    trend: "improving",
    data_source: "Pharmacy Safety Report",
    confidence: "high",
    months_tracked: 9,
  },
  {
    sop_id: "ICU-RR-006",
    sop_title: "Rapid Response Team Activation",
    last_major_update: "2025-02-14",
    metric: "Unplanned ICU transfer rate",
    before_value: "12.3%",
    after_value: "8.7%",
    change_pct: -29,
    trend: "improving",
    data_source: "Hospital Admissions Data",
    confidence: "low",
    months_tracked: 4,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceBadge(confidence: string) {
  if (confidence === "high")
    return "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30"
  if (confidence === "moderate")
    return "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30"
  return "bg-card text-[#475569] border border-[#CBD5E1]"
}

function confidenceLabel(confidence: string) {
  if (confidence === "high") return "High"
  if (confidence === "moderate") return "Moderate"
  return "Low"
}

// Simple CSS-only sparkline dots
function TrendDots({ months, improving }: { months: number; improving: boolean }) {
  const dots = Math.min(months, 10)
  return (
    <div className="flex items-end gap-0.5 h-6">
      {Array.from({ length: dots }).map((_, i) => {
        const heightPct = improving
          ? 20 + Math.round(((i + 1) / dots) * 80)
          : 100 - Math.round(((i + 1) / dots) * 60)
        return (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-sm",
              improving ? "bg-[#15803D]" : "bg-[#B91C1C]"
            )}
            style={{ height: `${heightPct}%` }}
          />
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EffectivenessPage() {
  const [methodologyOpen, setMethodologyOpen] = useState(false)

  const stats = [
    { label: "SOPs with Outcome Data", value: "6", icon: BarChart2, color: "text-[#0B6BCB]", bg: "bg-[#0B6BCB]/10" },
    { label: "Avg Error Reduction Post-Update", value: "28%", icon: TrendingDown, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
    { label: "Infection Rate Change (CLABSI)", value: "-24%", icon: Activity, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
    { label: "Staff Compliance Improvement", value: "+31%", icon: CheckCircle, color: "text-[#15803D] dark:text-green-400", bg: "bg-[#DCFCE7] dark:bg-green-500/10" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "SOP Effectiveness Measurement" }]} />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
            <BarChart2 className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#1A2332] font-display">SOP Effectiveness Measurement</h1>
            <p className="text-sm text-[#64748B] mt-0.5">
              Linking SOP governance to measurable patient safety outcomes
            </p>
          </div>
        </div>

        {/* Responsible AI note */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Outcome data shown is simulated. In production, connect to hospital quality databases
            (Meditech, Epic, Quantros) for real adverse event and metric data.
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-card border border-[#E2E8F0] shadow-sm rounded-xl p-4 flex items-center gap-3"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("w-5 h-5", s.color)} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                <p className="text-xs text-[#64748B] leading-tight">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Outcome Tracking Table */}
        <section>
          <h2 className="text-lg font-medium text-[#1A2332] mb-3">SOP Outcome Tracking</h2>
          <div className="bg-card border border-[#E2E8F0] shadow-sm rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b border-[#E2E8F0] text-xs text-[#64748B] uppercase tracking-wider">
                  <th className="p-4 text-left">SOP</th>
                  <th className="p-4 text-left">Metric</th>
                  <th className="p-4 text-left">Before</th>
                  <th className="p-4 text-left">After</th>
                  <th className="p-4 text-left">Change</th>
                  <th className="p-4 text-left">Confidence</th>
                  <th className="p-4 text-left">Trend</th>
                  <th className="p-4 text-left">Source / Months</th>
                </tr>
              </thead>
              <tbody>
                {SOP_OUTCOMES.map((row, i) => {
                  const isImproving = row.change_pct < 0
                  return (
                    <motion.tr
                      key={row.sop_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-[#EDF1F5] hover:bg-[#F8FAFC] transition-colors"
                    >
                      <td className="p-4">
                        <p className="font-medium text-[#1A2332] text-xs leading-snug max-w-[160px]">
                          {row.sop_title}
                        </p>
                        <span className="inline-block mt-1 text-[10px] text-[#475569] border border-[#CBD5E1] bg-card rounded px-2 py-0.5">
                          {row.sop_id}
                        </span>
                        <p className="text-[10px] text-[#94A3B8] mt-1">Updated {row.last_major_update}</p>
                      </td>
                      <td className="p-4 text-[#334155] text-xs max-w-[160px]">{row.metric}</td>
                      <td className="p-4 text-[#64748B] text-xs font-mono">{row.before_value}</td>
                      <td className="p-4 text-[#0B6BCB] text-xs font-mono">
                        <span className="flex items-center gap-1">
                          <span>{row.after_value}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={cn(
                            "text-xl font-bold",
                            isImproving ? "text-[#15803D] dark:text-green-400" : "text-[#B91C1C] dark:text-red-400"
                          )}
                        >
                          {row.change_pct}%
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            confidenceBadge(row.confidence)
                          )}
                        >
                          {confidenceLabel(row.confidence)}
                        </span>
                      </td>
                      <td className="p-4">
                        <TrendDots months={row.months_tracked} improving={isImproving} />
                        <p className="text-[10px] text-[#94A3B8] mt-1">{row.months_tracked}mo</p>
                      </td>
                      <td className="p-4 text-[#64748B] text-xs max-w-[140px] leading-snug">
                        {row.data_source}
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Aggregate Impact */}
        <section>
          <h2 className="text-lg font-medium text-[#1A2332] mb-3">Aggregate Impact Summary</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-card border border-[#E2E8F0] shadow-sm rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#0B6BCB] mb-1">
                <Database className="w-4 h-4" />
                <span className="text-sm font-medium text-[#1A2332]">Tracked Outcomes</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center border-b border-[#EDF1F5] pb-2">
                  <span className="text-[#64748B]">Total SOPs with outcome data</span>
                  <span className="text-[#1A2332] font-medium">6</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#EDF1F5] pb-2">
                  <span className="text-[#64748B]">Total improvement events</span>
                  <span className="text-[#15803D] dark:text-green-400 font-medium">14 metrics</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#EDF1F5] pb-2">
                  <span className="text-[#64748B]">Est. CLABSI reduction</span>
                  <span className="text-[#15803D] dark:text-green-400 font-medium">-24% (aligned with AHA 2025)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#64748B]">Avg months tracked per SOP</span>
                  <span className="text-[#1A2332] font-medium">8.2 months</span>
                </div>
              </div>
            </div>
            <div className="bg-card border border-[#E2E8F0] shadow-sm rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-[#64748B]" />
                <span className="text-sm font-medium text-[#1A2332]">AHA 2025 Research Benchmarks</span>
              </div>
              <div className="space-y-2 text-xs text-[#64748B]">
                <p>Effective SOPs linked to 30% reduction in surgical errors</p>
                <p>Infection control protocols associated with 30% infection rate decrease</p>
                <p>Medication safety SOPs reduce medical errors by up to 70%</p>
                <p className="text-[#94A3B8] pt-2 border-t border-[#EDF1F5]">
                  Methodology: Outcome data collected 3-12 months post-SOP update.
                  Pre/post comparison with no control group. Results indicative only.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Add Outcome Metric button */}
        <div className="flex items-center gap-3">
          <button
            disabled
            title="Connect to hospital quality database to enable this feature"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-muted text-[#94A3B8] border border-[#E2E8F0] cursor-not-allowed opacity-60"
          >
            + Add Outcome Metric
          </button>
          <span className="text-xs text-[#94A3B8]">Connect to hospital quality database to enable</span>
        </div>

        {/* Methodology note (collapsible) */}
        <div className="bg-card border border-[#E2E8F0] shadow-sm rounded-xl overflow-hidden">
          <button
            onClick={() => setMethodologyOpen((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F8FAFC] transition-colors"
          >
            <span className="text-sm font-medium text-[#334155]">Outcome Measurement Methodology</span>
            {methodologyOpen ? (
              <ChevronUp className="w-4 h-4 text-[#64748B]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#64748B]" />
            )}
          </button>
          {methodologyOpen && (
            <div className="px-4 pb-4 text-xs text-[#64748B] leading-relaxed border-t border-[#EDF1F5] pt-3">
              SOP effectiveness measurement requires linking policy version changes to quality metric
              datasets. In production, this connects to: hospital NHSN reporting (infections), adverse
              event databases (Quantros / RL Solutions), pharmacy safety systems, and EMR quality
              dashboards. Metrics shown are simulated for research demonstration.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
