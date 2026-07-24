"use client"

import { useEffect, useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, Search, Printer, BookOpen, ExternalLink, Filter, Loader2
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SafetyNote } from "@/components/ui/safety-note"
import { ErrorState } from "@/components/ui/error-state"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

interface StructuredThreshold {
  parameter: string
  value: string
  action?: string
}

interface StructuredJson {
  steps?: { step: number; action: string }[]
  thresholds?: StructuredThreshold[]
  contraindications?: string[]
}

interface RealSOP {
  id: number
  sop_id: string
  title: string
  department: string
  version: string
  effective_date: string
  structured_json?: StructuredJson
}

// ─── Quick ref card ───────────────────────────────────────────────────────────

function QuickRefCard({ sop, index }: { sop: RealSOP; index: number }) {
  const steps = sop.structured_json?.steps ?? []
  const thresholds = sop.structured_json?.thresholds ?? []
  const contraindications = sop.structured_json?.contraindications ?? []

  const keyPoints = steps.slice(0, 5).map((s) => s.action)
  const emergencyThreshold = contraindications[0]
    ?? (thresholds[0] ? `${thresholds[0].parameter}: ${thresholds[0].value}${thresholds[0].action ? ` (${thresholds[0].action})` : ""}` : undefined)

  if (keyPoints.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl bg-card border border-border shadow-sm p-5 flex flex-col gap-3 print:break-inside-avoid print:shadow-none"
    >
      <div>
        <p className="text-[10px] font-mono text-muted-foreground">{sop.sop_id} - v{sop.version}</p>
        <h3 className="text-sm font-semibold leading-tight mt-0.5">{sop.title}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sop.department} - Effective {sop.effective_date}</p>
      </div>

      <ul className="space-y-1.5">
        {keyPoints.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0B6BCB] shrink-0 mt-1.5" />
            {point}
          </li>
        ))}
      </ul>

      {emergencyThreshold && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30">
          <AlertTriangle className="w-3.5 h-3.5 text-[#B91C1C] dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-[#B91C1C] dark:text-red-400 font-medium">{emergencyThreshold}</p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <Link
          href={`/library`}
          className="flex items-center gap-1 text-[11px] text-[#0B6BCB] hover:text-[#0B6BCB] transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View Full SOP
        </Link>
        <span className="text-subtle">|</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Printer className="w-3 h-3" />
          Print
        </button>
      </div>
    </motion.div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function QuickRefPage() {
  const [sops, setSops] = useState<RealSOP[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState("")
  const [dept, setDept] = useState("All")

  const loadSops = () => {
    setLoading(true)
    setLoadError(false)
    fetch(`${API_BASE}/api/sops`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.sops ?? data.items ?? [])
        setSops(list)
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }

  useEffect(loadSops, [])

  const cardableSops = useMemo(
    () => sops.filter((s) => (s.structured_json?.steps?.length ?? 0) > 0),
    [sops]
  )

  const departments = useMemo(
    () => ["All", ...Array.from(new Set(cardableSops.map((s) => s.department)))],
    [cardableSops]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return cardableSops.filter((sop) => {
      const matchesDept = dept === "All" || sop.department === dept
      const matchesSearch =
        !q ||
        sop.title.toLowerCase().includes(q) ||
        sop.sop_id.toLowerCase().includes(q) ||
        sop.department.toLowerCase().includes(q) ||
        (sop.structured_json?.steps ?? []).some((s) => s.action.toLowerCase().includes(q))
      return matchesDept && matchesSearch
    })
  }, [cardableSops, search, dept])

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6 print:p-0">
        <div className="print:hidden">
          <Breadcrumb items={[{ label: "Quick Reference Cards" }]} />
        </div>

        <div className="flex items-start justify-between gap-4 print:hidden">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-[#0B6BCB]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Quick Reference Cards</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Generated live from each SOP&apos;s structured steps and thresholds - verify against the full SOP first
              </p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted hover:bg-[#E2E8F0] text-sm font-medium transition-colors shrink-0"
          >
            <Printer className="w-4 h-4" />
            Print All
          </button>
        </div>

        <SafetyNote className="print:hidden" />

        <div className="flex flex-col sm:flex-row gap-3 print:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards by keyword, SOP ID, department..."
              className="w-full rounded-xl bg-muted border border-border pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/40 placeholder:text-muted-foreground"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="rounded-xl bg-muted border border-border pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/40 appearance-none"
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-muted-foreground print:hidden">
          Showing {filtered.length} of {cardableSops.length} quick reference cards
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 print:hidden">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading SOPs...
          </div>
        ) : loadError ? (
          <ErrorState message="Couldn't load SOPs for quick reference." onRetry={loadSops} />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-12 text-center text-muted-foreground text-sm">
            No cards match your search.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((sop, i) => (
              <QuickRefCard key={sop.id} sop={sop} index={i} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted border border-border text-xs text-muted-foreground print:hidden">
          <Printer className="w-3.5 h-3.5 shrink-0" />
          <span>Print All exports index-card format.</span>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </AppShell>
  )
}
