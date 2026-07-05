"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, Eye, Plus, X, ExternalLink, Shield,
  Calendar, Building2, FileText, Tag, CheckCircle2, Clock
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_EVIDENCE_WATCH } from "@/lib/mock-data"
import type { EvidenceWatchItem } from "@/lib/governance-types"

// ── Types ──────────────────────────────────────────────────────────────────
type ReviewFilter = "all" | "new" | "reviewing" | "actioned" | "dismissed" | "proposal_created"

// ── Helpers ────────────────────────────────────────────────────────────────
function sourceTypeBadge(type: EvidenceWatchItem["source_type"]) {
  const map: Record<string, string> = {
    cdc: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    fda: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
    who: "bg-card text-[#475569] border border-[#CBD5E1]",
    nejm: "bg-card text-[#475569] border border-[#CBD5E1]",
    jama: "bg-card text-[#475569] border border-[#CBD5E1]",
    cochrane: "bg-card text-[#475569] border border-[#CBD5E1]",
    professional_society: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30",
    pubmed: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30",
    pmc: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30",
    nccn: "bg-card text-[#475569] border border-[#CBD5E1]",
    guideline: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30",
    internal_memo: "bg-card text-[#475569] border border-[#CBD5E1]",
  }
  return map[type] ?? "bg-card text-[#475569] border border-[#CBD5E1]"
}

function impactBadge(level: EvidenceWatchItem["impact_level"]) {
  const map = {
    critical: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border border-[#FECACA] dark:border-red-500/30",
    high: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
    medium: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30",
    low: "bg-card text-[#475569] border border-[#CBD5E1]",
  }
  return map[level]
}

function reviewStatusBadge(status: EvidenceWatchItem["review_status"]) {
  const map: Record<string, { cls: string; label: string }> = {
    new: { cls: "bg-card text-[#475569] border border-[#CBD5E1]", label: "New" },
    reviewing: { cls: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border border-[#FDE68A] dark:border-amber-500/30", label: "Reviewing" },
    actioned: { cls: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border border-[#BBF7D0] dark:border-green-500/30", label: "Actioned" },
    dismissed: { cls: "bg-card text-[#475569] border border-[#CBD5E1]", label: "Dismissed" },
    proposal_created: { cls: "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30", label: "Proposal Created" },
  }
  return map[status] ?? { cls: "bg-muted text-[#64748B]", label: status }
}

const TRUSTED_SOURCES = [
  { name: "CDC", score: 98 },
  { name: "FDA", score: 99 },
  { name: "WHO", score: 96 },
  { name: "NEJM", score: 96 },
  { name: "PubMed/PMC", score: 93 },
  { name: "Cochrane", score: 97 },
  { name: "SCCM/SSC", score: 97 },
  { name: "NCCN", score: 94 },
]

const FILTER_TABS: { value: ReviewFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
  { value: "proposal_created", label: "Proposal Created" },
]

// ── Sub-components ─────────────────────────────────────────────────────────
function EvidenceCard({ item, index }: { item: EvidenceWatchItem; index: number }) {
  const statusInfo = reviewStatusBadge(item.review_status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl bg-card border border-[#E2E8F0] overflow-hidden"
    >
      {item.action_required && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#FEF3C7] dark:bg-amber-500/10 border-b border-[#FDE68A] dark:border-amber-500/30">
          <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] dark:text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-[#B45309] dark:text-amber-400 uppercase tracking-wide">Action Required</span>
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Top badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide", sourceTypeBadge(item.source_type))}>
            {item.source_type.replace("_", " ")}
          </span>
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide", impactBadge(item.impact_level))}>
            {item.impact_level} impact
          </span>
          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", statusInfo.cls)}>
            {statusInfo.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-display text-base font-bold text-[#1A2332] leading-snug">
          {item.title}
        </h3>

        {/* Source & dates */}
        <div className="flex flex-wrap gap-4 text-xs text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            {item.source_name}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            Published {item.published_date}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="w-3 h-3" />
            Detected {item.detected_date}
          </span>
        </div>

        {/* Departments */}
        {item.departments_affected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
            {item.departments_affected.map(d => (
              <span key={d} className="px-2 py-0.5 rounded-full bg-muted border border-[#E2E8F0] text-xs text-[#64748B]">
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Related SOPs */}
        {item.related_sop_titles.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#64748B] flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> Related SOPs
            </p>
            <ul className="space-y-0.5">
              {item.related_sop_titles.map(t => (
                <li key={t} className="text-xs text-[#0B6BCB] flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#0B6BCB]/60 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary */}
        <p className="text-sm text-[#64748B] leading-relaxed">{item.summary}</p>

        {/* Categories */}
        {item.categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="w-3 h-3 text-[#64748B]/60" />
            {item.categories.map(c => (
              <span key={c} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-[#64748B]">
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-xs text-[#64748B] hover:bg-muted transition-colors">
            <ExternalLink className="w-3 h-3" /> View Evidence
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-xs text-[#0B6BCB] hover:bg-[#0B6BCB]/20 transition-colors">
            <Plus className="w-3 h-3" /> Create Proposal
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#64748B] hover:bg-muted transition-colors">
            <X className="w-3 h-3" /> Dismiss
          </button>
        </div>

      </div>
    </motion.div>
  )
}

function TrustedSourcesPanel() {
  return (
    <div className="rounded-2xl bg-card border border-[#E2E8F0] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-[#0B6BCB]" />
        <h3 className="font-display text-sm font-bold text-[#1A2332]">Trusted Sources</h3>
      </div>
      <div className="space-y-3">
        {TRUSTED_SOURCES.map(({ name, score }) => (
          <div key={name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#334155]">{name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[#0B6BCB] font-semibold">{score}%</span>
                <span className="px-1.5 py-0.5 rounded-full bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 text-[10px] font-medium border border-[#BBF7D0] dark:border-green-500/30">Active</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0B6BCB] to-[#0B6BCB]"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function EvidenceWatchPage() {
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>("all")

  const actionRequiredCount = MOCK_EVIDENCE_WATCH.filter(i => i.action_required).length

  const filtered = MOCK_EVIDENCE_WATCH.filter(item => {
    if (activeFilter === "all") return true
    if (activeFilter === "new") return item.review_status === "new"
    if (activeFilter === "reviewing") return item.review_status === "reviewing"
    if (activeFilter === "actioned") return item.review_status === "actioned"
    if (activeFilter === "dismissed") return item.review_status === "dismissed"
    if (activeFilter === "proposal_created") return item.review_status === "proposal_created"
    return true
  })

  const stats = [
    { label: "Sources Monitored", value: 8, icon: Shield, color: "text-[#0B6BCB]" },
    { label: "New This Month", value: 2, icon: Clock, color: "text-[#64748B]" },
    { label: "Requires Action", value: actionRequiredCount, icon: AlertTriangle, color: "text-[#B45309] dark:text-amber-400" },
    { label: "Proposals Created", value: 3, icon: CheckCircle2, color: "text-[#15803D] dark:text-green-400" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: "Evidence Watch" }]} />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-bold text-[#1A2332]">Evidence Watch</h1>
            </div>
            <p className="text-[#64748B] text-sm">
              Track external guidance that may affect your SOPs.
            </p>
          </div>
        </motion.div>

        {/* Responsible AI note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30"
        >
          <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-[#B45309] dark:text-amber-400">
            <span className="font-semibold">Responsible AI: </span>
            Committee review is required before any SOP update. This dashboard is for monitoring only.
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl bg-card border border-[#E2E8F0] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#64748B] font-medium">{label}</span>
                <Icon className={cn("w-4 h-4", color)} />
              </div>
              <p className={cn("text-3xl font-bold font-display", color)}>{value}</p>
            </div>
          ))}
        </motion.div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors",
                activeFilter === tab.value
                  ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30"
                  : "text-[#64748B] hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main content + sidebar */}
        <div className="grid xl:grid-cols-[1fr_320px] gap-6">
          {/* Evidence cards */}
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-2xl bg-card border border-[#E2E8F0] p-12 text-center">
                <Eye className="w-8 h-8 text-[#64748B] mx-auto mb-3 opacity-40" />
                <p className="text-[#64748B] text-sm">No items match this filter.</p>
              </div>
            ) : (
              filtered.map((item, i) => (
                <EvidenceCard key={item.id} item={item} index={i} />
              ))
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <TrustedSourcesPanel />

            {/* Disclaimer */}
            <div className="rounded-xl bg-card border border-[#E2E8F0] px-4 py-3">
              <p className="text-[10px] text-[#64748B]/50 uppercase tracking-widest text-center">
                Research Prototype - Not for Clinical Use
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
