"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle, Search, Printer, BookOpen, ExternalLink, Filter
} from "lucide-react"
import Link from "next/link"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { MOCK_SOPS } from "@/lib/mock-data"
import type { EnhancedSOP } from "@/lib/governance-types"

// ─── quick ref content per SOP ───────────────────────────────────────────────

interface QuickRefContent {
  keyPoints: string[]
  emergencyThreshold?: string
  shortTitle: string
}

const QUICK_REF_MAP: Record<string, QuickRefContent> = {
"IC-PPE-001": {
    shortTitle: "PPE - Respiratory Isolation",
    keyPoints: [
"N95 required for ALL airborne precaution rooms - fit-tested only",
"Don order: Gown - N95 - Face shield - Gloves",
"Perform N95 seal check before entering room",
"Doff order: Gloves - Gown - Hand hygiene - Face shield - N95",
"Hand hygiene before donning AND after doffing",
    ],
    emergencyThreshold: "If N95 unavailable: surgical mask + face shield + negative pressure room",
  },
"ICU-SEP-002": {
    shortTitle: "Sepsis 1-Hour Bundle",
    keyPoints: [
"qSOFA: altered mental status + RR > 22 + SBP < 100 (2 of 3 = high suspicion)",
"Blood cultures x2 before antibiotics - do not delay antibiotics > 45 min",
"Serum lactate STAT - if > 4 mmol/L start fluids immediately",
"Broad-spectrum antibiotics within 1 hour of recognition",
"30 mL/kg crystalloid for hypotension or lactate > 4 mmol/L",
"Norepinephrine if MAP < 65 mmHg after fluids",
    ],
    emergencyThreshold: "Lactate > 4 mmol/L: immediate ICU escalation and fluid resuscitation",
  },
"ONCO-CHEMO-003": {
    shortTitle: "Chemotherapy Administration",
    keyPoints: [
"Independent double-check required: drug, dose, route, cycle, weight",
"Verify signed informed consent BEFORE any administration",
"Chemotherapy PPE: double gloves, chemo gown, face shield, shoe covers",
"Use closed-system transfer device (CSTD) for all administrations",
"Emergency drugs must be at bedside during infusion",
    ],
    emergencyThreshold: "Extravasation: STOP infusion, leave IV in place, call MD immediately",
  },
"HVAP-FALL-004": {
    shortTitle: "Fall Risk - Morse Scale",
    keyPoints: [
"Complete Morse Fall Scale within 4 hours of admission",
"Reassess every shift change and after any fall or medication change",
"Morse score > 45: activate bed alarm + yellow wristband + signage",
"All patients: bed lowest position, brakes locked, call light in reach",
"Do not leave high-risk patient unattended during transfers",
    ],
    emergencyThreshold: "Morse score > 45: enhanced precautions mandatory - 30-min rounding",
  },
"IC-CL-005": {
    shortTitle: "CLABSI Prevention Bundle",
    keyPoints: [
"Maximal sterile barrier precautions for ALL CVC insertions",
"Chlorhexidine skin prep and daily site assessment",
"Review central line necessity daily - remove as soon as clinically possible",
"Femoral site is highest infection risk - use as last resort only",
"Document dressing change and daily necessity review",
    ],
    emergencyThreshold: "Signs of CLABSI: fever + positive blood culture - notify ID team",
  },
"ICU-RR-006": {
    shortTitle: "Rapid Response Team",
    keyPoints: [
"ANY staff member can activate RRT - no physician required first",
"Call RRT if: RR > 25, O2 < 90%, HR < 40 or > 130, SBP < 90",
"Call RRT for acute change in consciousness or staff concern",
"Use SBAR format when calling: Situation, Background, Assessment, Request",
"Document RRT activation form within 30 minutes",
    ],
    emergencyThreshold: "NEWS2 score > 5 or any single trigger: activate RRT now",
  },
"PHARM-MED-007": {
    shortTitle: "High-Alert Medications",
    keyPoints: [
"Mandatory independent double-check before all ISMP high-alert meds",
"High-alert list includes: insulin, heparin, concentrated electrolytes, chemo",
"Concentrated KCl must NEVER be given IV push - pump infusion only",
"Written/EMR order required - no verbal orders for high-alert meds",
"Document independent double-check in administration record",
    ],
    emergencyThreshold: "Suspected overdose of high-alert med: code team and pharmacy STAT",
  },
"RAD-MRI-008": {
    shortTitle: "MRI Safety Screening",
    keyPoints: [
"MRI safety screening form mandatory BEFORE patient enters MRI suite",
"eGFR required before GBCA contrast - do not administer if eGFR < 30",
"Cardiac pacemakers require cardiology clearance + MRI-conditional confirmation",
"Prefer macrocyclic GBCA when adequate for indication",
"Known severe GBCA reaction: contrast is contraindicated",
    ],
    emergencyThreshold: "Anaphylaxis to contrast: call code team, give epinephrine 0.3mg IM",
  },
}

// ─── QR placeholder ──────────────────────────────────────────────────────────

function QRPlaceholder({ sopId }: { sopId: string }) {
  return (
    <div className="w-14 h-14 rounded-lg bg-muted border border-[#E2E8F0] flex flex-col items-center justify-center shrink-0">
      <div className="grid grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className={cn("w-2.5 h-2.5 rounded-[1px]", Math.random() > 0.4 ? "bg-[#94A3B8]" : "bg-transparent")} />
        ))}
      </div>
      <p className="text-[8px] text-[#64748B] mt-1">QR</p>
    </div>
  )
}

// ─── Quick ref card ───────────────────────────────────────────────────────────

function QuickRefCard({ sop, index }: { sop: EnhancedSOP; index: number }) {
  const content = QUICK_REF_MAP[sop.sop_id]
  if (!content) return null

  const riskColor =
    sop.risk_classification === "critical"
      ? "border-[#FECACA] dark:border-red-500/30"
      : sop.risk_classification === "high"
      ? "border-[#FDE68A] dark:border-amber-500/30"
      : "border-[#E2E8F0]"

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
"rounded-2xl bg-card border shadow-sm p-5 flex flex-col gap-3 print:break-inside-avoid print:shadow-none",
        riskColor
      )}
    >
      {/* Card top: QR + title */}
      <div className="flex items-start gap-3">
        <QRPlaceholder sopId={sop.sop_id} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-[#64748B]">{sop.sop_id} - v{sop.version}</p>
          <h3 className="text-sm font-semibold leading-tight mt-0.5">{content.shortTitle}</h3>
          <p className="text-[10px] text-[#64748B] mt-0.5">{sop.department} - Effective {sop.effective_date}</p>
        </div>
      </div>

      {/* Key points */}
      <ul className="space-y-1.5">
        {content.keyPoints.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-[#1A2332]/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0B6BCB] shrink-0 mt-1.5" />
            {point}
          </li>
        ))}
      </ul>

      {/* Emergency threshold */}
      {content.emergencyThreshold && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30">
          <AlertTriangle className="w-3.5 h-3.5 text-[#B91C1C] dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-[#B91C1C] dark:text-red-400 font-medium">{content.emergencyThreshold}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#EDF1F5]">
        <Link
          href={`/library`}
          className="flex items-center gap-1 text-[11px] text-[#0B6BCB] hover:text-[#0B6BCB] transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View Full SOP
        </Link>
        <span className="text-[#CBD5E1]">|</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#1A2332] transition-colors"
        >
          <Printer className="w-3 h-3" />
          Print
        </button>
      </div>
    </motion.div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

const DEPARTMENTS = ["All", ...Array.from(new Set(MOCK_SOPS.map((s) => s.department)))]

export default function QuickRefPage() {
  const [search, setSearch] = useState("")
  const [dept, setDept] = useState("All")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return MOCK_SOPS.filter((sop) => {
      const content = QUICK_REF_MAP[sop.sop_id]
      if (!content) return false
      const matchesDept = dept === "All" || sop.department === dept
      const matchesSearch =
        !q ||
        sop.title.toLowerCase().includes(q) ||
        sop.sop_id.toLowerCase().includes(q) ||
        sop.department.toLowerCase().includes(q) ||
        content.keyPoints.some((p) => p.toLowerCase().includes(q))
      return matchesDept && matchesSearch
    })
  }, [search, dept])

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6 print:p-0">
        <div className="print:hidden">
          <Breadcrumb items={[{ label: "Quick Reference Cards" }]} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 print:hidden">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-[#0B6BCB]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Quick Reference Cards</h1>
              <p className="text-sm text-[#64748B] mt-0.5">
Print bedside cards - verify against the full SOP first
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

        {/* Research Prototype disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 text-[#B91C1C] dark:text-red-400 text-sm print:hidden">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>Research Prototype - Not for Clinical Use.</strong> Follow your institution&apos;s approved SOPs.
          </span>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 print:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards by keyword, SOP ID, department..."
              className="w-full rounded-xl bg-muted border border-[#E2E8F0] pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/40 placeholder:text-[#64748B]"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="rounded-xl bg-muted border border-[#E2E8F0] pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0B6BCB]/40 appearance-none"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Result count */}
        <p className="text-xs text-[#64748B] print:hidden">
          Showing {filtered.length} of {Object.keys(QUICK_REF_MAP).length} quick reference cards
        </p>

        {/* Cards grid */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-card border border-[#E2E8F0] p-12 text-center text-[#64748B] text-sm">
            No cards match your search.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((sop, i) => (
              <QuickRefCard key={sop.id} sop={sop} index={i} />
            ))}
          </div>
        )}

        {/* Print style note */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-muted border border-[#E2E8F0] text-xs text-[#64748B] print:hidden">
          <Printer className="w-3.5 h-3.5 shrink-0" />
          <span>
            Print All exports index-card format. Production: QR codes link to the full SOP.
          </span>
        </div>
      </div>

      {/* Print-only CSS */}
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
