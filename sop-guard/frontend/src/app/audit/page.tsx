"use client"

import { Fragment, useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Shield, AlertTriangle, ChevronDown, ChevronRight,
  Download, Search, Calendar, Loader2, Check
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_AUDIT } from "@/lib/mock-data"
import type { AuditEventType } from "@/lib/governance-types"
import { useRole } from "@/lib/role-context"

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

function eventBadgeClass(eventType: AuditEventType) {
  if (eventType.startsWith("sop_")) return "bg-[#0B6BCB]/10 text-[#0B6BCB] border border-[#0B6BCB]/30"
  if (eventType.startsWith("proposal_") || eventType.startsWith("committee_")) return "bg-white text-[#475569] border border-[#CBD5E1]"
  if (eventType.startsWith("training_") || eventType.startsWith("acknowledgment_")) return "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]"
  if (eventType.startsWith("legal_")) return "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]"
  if (eventType.startsWith("ai_")) return "bg-white text-[#475569] border border-[#CBD5E1]"
  // admin, user_login, export_generated, cross_reference
  return "bg-white text-[#475569] border border-[#CBD5E1]"
}

function eventLabel(eventType: AuditEventType) {
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const roleLabel: Record<string, string> = {
  physician: "Physician",
  nurse: "Nurse",
  department_admin: "Dept Admin",
  compliance_officer: "Compliance",
  committee_member: "Committee",
  legal_risk: "Legal/Risk",
  nurse_educator: "Nurse Educator",
  system_admin: "Sys Admin",
}

export default function AuditPage() {
  const { role } = useRole()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "all">("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [exportState, setExportState] = useState<"idle" | "loading" | "success">("idle")
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | "json">("csv")
  const [showExportMenu, setShowExportMenu] = useState(false)

  const uniqueEventTypes = useMemo(() => {
    const types = Array.from(new Set(MOCK_AUDIT.map((e) => e.event_type)))
    return types.sort()
  }, [])

  const uniqueRoles = useMemo(() => {
    const roles = Array.from(new Set(MOCK_AUDIT.map((e) => e.user_role)))
    return roles.sort()
  }, [])

  const filteredAudit = useMemo(() => {
    return MOCK_AUDIT
      .filter((e) => {
        const searchLower = search.toLowerCase()
        const matchesSearch = !search ||
          e.action_summary.toLowerCase().includes(searchLower) ||
          e.user.toLowerCase().includes(searchLower) ||
          e.affected_resource.toLowerCase().includes(searchLower)
        const matchesType = eventTypeFilter === "all" || e.event_type === eventTypeFilter
        const matchesRole = roleFilter === "all" || e.user_role === roleFilter
        return matchesSearch && matchesType && matchesRole
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [search, eventTypeFilter, roleFilter])

  const handleExport = (format: "csv" | "pdf" | "json") => {
    setExportFormat(format)
    setShowExportMenu(false)
    setExportState("loading")
    setTimeout(() => setExportState("success"), 1200)
    setTimeout(() => setExportState("idle"), 3500)
  }

  const stats = [
    { label: "Events Today", value: "12", color: "text-[#0B6BCB]" },
    { label: "Total Events", value: String(MOCK_AUDIT.length), color: "text-[#1A2332]" },
    { label: "Event Types", value: String(uniqueEventTypes.length), color: "text-[#64748B]" },
    { label: "Last Export", value: "Jun 28", color: "text-[#15803D]" },
  ]

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[{ label: "Audit Trail" }]} />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Audit Trail</h1>
            <p className="text-sm text-[#64748B]">Immutable governance and compliance event record</p>
          </div>
        </div>

        {/* Research disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>Research Prototype. Not for Clinical Use.</strong> For demonstration only.</span>
        </div>

        {/* JCI note */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 text-[#0B6BCB] text-sm">
          <Shield className="w-4 h-4 shrink-0" />
          <span>Audit records are timestamp-verified. Suitable for regulatory inspection and JCI accreditation review.</span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl bg-white border border-[#E2E8F0] p-4 text-center"
            >
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-[#64748B] mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, users, resources..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#1A2332] placeholder:text-[#64748B] focus:outline-none focus:border-[#0B6BCB]/30"
            />
          </div>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/30"
          >
            <option value="all">All Event Types</option>
            {uniqueEventTypes.map((t) => (
              <option key={t} value={t}>{eventLabel(t as AuditEventType)}</option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-sm text-[#1A2332] focus:outline-none focus:border-[#0B6BCB]/30"
          >
            <option value="all">All Roles</option>
            {uniqueRoles.map((r) => (
              <option key={r} value={r}>{roleLabel[r] ?? r}</option>
            ))}
          </select>
          <div className="flex items-center rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            {(["7d", "30d", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  "px-3 py-2 text-xs font-medium transition-colors",
                  dateRange === range
                    ? "bg-[#0B6BCB]/10 text-[#0B6BCB]"
                    : "text-[#64748B] hover:text-[#1A2332]"
                )}
              >
                <Calendar className="w-3 h-3 inline mr-1" />
                {range === "7d" ? "Last 7 Days" : range === "30d" ? "Last 30 Days" : "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Audit table */}
        <div className="rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] text-xs text-[#64748B] uppercase tracking-wider">
                <th className="p-3 text-left">Event</th>
                <th className="p-3 text-left">Timestamp</th>
                <th className="p-3 text-left">User</th>
                <th className="p-3 text-left">Resource</th>
                <th className="p-3 text-left">Summary</th>
                <th className="p-3 text-left">Impact</th>
                <th className="p-3 text-left w-8"></th>
              </tr>
            </thead>
            <tbody>
              {filteredAudit.map((event) => (
                <Fragment key={event.id}>
                  <tr
                    key={event.id}
                    className="border-b border-[#EDF1F5] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  >
                    <td className="p-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", eventBadgeClass(event.event_type))}>
                        {eventLabel(event.event_type)}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-[#64748B] whitespace-nowrap">
                      {formatTimestamp(event.timestamp)}
                    </td>
                    <td className="p-3">
                      <p className="text-xs font-medium text-[#1A2332]">{event.user}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B]">
                        {roleLabel[event.user_role] ?? event.user_role}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-[#64748B] max-w-[120px] truncate">
                      {event.affected_resource}
                    </td>
                    <td className="p-3 text-xs text-[#1A2332]/80 max-w-[200px]">
                      {event.action_summary.length > 60
                        ? event.action_summary.slice(0, 60) + "..."
                        : event.action_summary}
                    </td>
                    <td className="p-3 text-xs text-[#64748B] max-w-[140px]">
                      {event.compliance_impact ? (
                        <span className="text-[#B45309] truncate block">{event.compliance_impact}</span>
                      ) : (
                        <span className="opacity-30">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {expandedId === event.id
                        ? <ChevronDown className="w-4 h-4 text-[#64748B]" />
                        : <ChevronRight className="w-4 h-4 text-[#64748B]" />}
                    </td>
                  </tr>
                  <AnimatePresence>
                    {expandedId === event.id && (
                      <tr key={`${event.id}-expanded`}>
                        <td colSpan={7} className="p-0 bg-[#F8FAFC]">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 border-b border-[#E2E8F0] grid md:grid-cols-2 gap-3 text-xs">
                              <div className="space-y-2">
                                <p><span className="text-[#64748B]">Full Summary:</span> <span className="text-[#1A2332]">{event.action_summary}</span></p>
                                {event.before_value && <p><span className="text-[#64748B]">Before:</span> <span className="text-[#B91C1C]">{event.before_value}</span></p>}
                                {event.after_value && <p><span className="text-[#64748B]">After:</span> <span className="text-[#15803D]">{event.after_value}</span></p>}
                                {event.ip_address && <p><span className="text-[#64748B]">IP Address:</span> <span className="text-[#1A2332] font-mono">{event.ip_address}</span></p>}
                              </div>
                              <div className="space-y-2">
                                <p><span className="text-[#64748B]">Resource ID:</span> <span className="text-[#1A2332] font-mono">{event.affected_resource_id}</span></p>
                                {event.evidence_references && event.evidence_references.length > 0 && (
                                  <p><span className="text-[#64748B]">Evidence:</span> <span className="text-[#0B6BCB]">{event.evidence_references.join(", ")}</span></p>
                                )}
                                {event.compliance_impact && (
                                  <p><span className="text-[#64748B]">Compliance Impact:</span> <span className="text-[#B45309]">{event.compliance_impact}</span></p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              ))}
              {filteredAudit.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#64748B] text-sm">
                    No audit events match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Export */}
        <div className="flex justify-center">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exportState === "loading"}
              className={cn(
                "flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold transition-all",
                exportState === "success"
                  ? "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]"
                  : "bg-[#0B6BCB] hover:bg-[#0959AC] text-white"
              )}
            >
              {exportState === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
              {exportState === "success" && <Check className="w-4 h-4" />}
              {exportState === "idle" && <Download className="w-4 h-4" />}
              {exportState === "loading" ? `Generating ${exportFormat.toUpperCase()}...` :
                exportState === "success" ? "Export Generated" :
                  "Export Audit Log"}
              {exportState === "idle" && <ChevronDown className="w-4 h-4" />}
            </button>
            <AnimatePresence>
              {showExportMenu && exportState === "idle" && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 rounded-xl bg-white border border-[#E2E8F0] overflow-hidden shadow-md"
                >
                  {(["csv", "pdf", "json"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => handleExport(fmt)}
                      className="w-full px-6 py-2.5 text-sm text-[#1A2332] hover:bg-[#F1F5F9] transition-colors text-left uppercase font-medium"
                    >
                      {fmt}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
