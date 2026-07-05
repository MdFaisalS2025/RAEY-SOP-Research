"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, BookOpen, Clock, Hash, FileText, AlertTriangle, Loader2, X, ExternalLink, ListOrdered, ShieldAlert, Gauge, LayoutGrid, List, FileCheck, CheckCircle2, Printer, Filter, CheckCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { getSOPs } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { SOP } from "@/lib/types"
import { MOCK_SOPS } from "@/lib/mock-data"
import type { EnhancedSOP } from "@/lib/governance-types"
import { useRole } from "@/lib/role-context"

type TabId = "overview" | "procedure" | "thresholds" | "contraindications" | "fulltext"

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "procedure", label: "Procedure", icon: ListOrdered },
  { id: "thresholds", label: "Thresholds", icon: Gauge },
  { id: "contraindications", label: "Safety", icon: ShieldAlert },
  { id: "fulltext", label: "Full Text", icon: FileText },
]

// ── AI Summaries defined inline (not in mock-data.ts) ─────────────────────────
const SOP_AI_SUMMARIES: Record<string, string[]> = {
"IC-PPE-001": [
"N95 respirators required for all aerosol-generating procedures and airborne isolation patients",
"Strict hand hygiene with WHO 5 moments protocol before and after PPE donning/doffing",
"Full gown, gloves, and eye protection required for direct contact with high-risk patients",
"Fit testing required annually - untested staff must not enter isolation rooms",
"Doffing sequence is critical: gloves first, then gown, then eye protection, then mask",
  ],
"ICU-SEP-002": [
"All 4 bundle elements must be completed within 1 hour of sepsis recognition",
"Blood cultures (2 sets) must be drawn BEFORE antibiotics are administered",
"IV fluid resuscitation: 30 ml/kg crystalloid if hypotensive or lactate above 4 mmol/L",
"Vasopressors (norepinephrine) start if MAP remains below 65 mmHg after fluid challenge",
"Lactate above 4 mmol/L requires immediate ICU consultation regardless of vital signs",
  ],
"ONCO-CHEMO-003": [
"Double pharmacist verification required before any chemotherapy preparation or administration",
"Full PPE mandatory: chemo-rated gloves, gown, eye protection, and closed-toe shoes",
"Patient must provide written informed consent before first cycle and any dose change",
"Extravasation kit must be at bedside before infusion begins",
"Document actual dose, route, rate, lot number, and expiry in real time during administration",
  ],
"HVAP-FALL-004": [
"Morse Fall Scale must be completed within 4 hours of admission and after any fall",
"Score above 45 requires immediate implementation of fall prevention bundle",
"Bed alarm must be activated and documented for all high-risk patients",
"Call light, non-slip footwear, and clear pathways mandatory for scores 25-44",
"Reassess every shift change and after any medication change affecting cognition or balance",
  ],
"IC-CL-005": [
"Maximal sterile barrier precautions required for all central line insertions",
"Chlorhexidine gluconate 2% with 70% alcohol preferred for skin antisepsis",
"Daily assessment for line necessity - remove line as soon as clinically appropriate",
"Dressing change every 7 days or sooner if damp, loose, or soiled",
"Needleless connectors must be scrubbed for minimum 15 seconds before each access",
  ],
"ICU-RR-006": [
"Call RRT immediately for: RR above 25 or below 8, SpO2 below 90%, acute consciousness change",
"Also activate for: SBP below 90 mmHg, HR below 40 or above 130, or staff concern",
"Do not delay RRT call waiting for physician - any staff member can activate",
"Prepare: airway trolley, crash cart location, and current medications list before team arrival",
"Document activation time, response time, and outcome in patient record within 1 hour",
  ],
"PHARM-MED-007": [
"High-alert medications list includes: insulin, anticoagulants, concentrated electrolytes, opioids",
"Independent double-check by two RNs required before administration - not witnessed, independent",
"Both nurses verify: right patient, drug, dose, route, rate, and time independently",
"Override of Pyxis for high-alert medications requires charge nurse co-signature",
"Any discrepancy between double-checkers must be resolved before administration proceeds",
  ],
"RAD-MRI-008": [
"ALL patients must complete MRI safety screening form before entering Zone 3 or 4",
"Active cardiac devices, cochlear implants, and cerebral aneurysm clips are absolute contraindications",
"Implant registry must be checked electronically - verbal confirmation alone is insufficient",
"Ferromagnetic detection screening with handheld wand before Zone 4 entry",
"Contrast (gadolinium) requires eGFR above 30 and allergy history - hold metformin 48 hours post-contrast",
  ],
"ED-STROKE-009": [
"Activate Code Stroke on positive BE-FAST screen and record last-known-well time immediately",
"Non-contrast CT within 25 minutes of arrival to exclude hemorrhage before thrombolysis",
"Target door-to-needle of 60 minutes or less for eligible IV alteplase patients",
"Alteplase dose 0.9 mg/kg (max 90 mg): 10% bolus over 1 minute, remainder over 60 minutes",
"Lower blood pressure below 185/110 mmHg before tPA and maintain below 180/105 mmHg after",
  ],
"OB-PPH-010": [
"Quantitative blood loss measurement is mandatory - visual estimation underestimates hemorrhage",
"PPH is 1000 mL or more cumulative blood loss regardless of delivery route",
"Give uterotonics in sequence and tranexamic acid 1 g IV within 3 hours of delivery",
"Methylergonovine is contraindicated in hypertension; carboprost is contraindicated in asthma",
"Escalate through the 4 Ts and activate massive transfusion protocol for ongoing bleeding",
  ],
"PEDS-DKA-011": [
"Cerebral edema is the leading cause of DKA death in children - hourly neuro checks required",
"Replace fluid deficit evenly over 24 to 48 hours; bolus only for shock",
"Confirm potassium and urine output before insulin - do not start if potassium below 3.3 mmol/L",
"Never give an IV insulin bolus in pediatric DKA; start infusion 1 hour after fluids",
"Do not give routine bicarbonate - it increases cerebral edema risk",
  ],
"SURG-WRONG-012": [
"Surgeon marks the site with their initials while the patient is awake, where feasible",
"Time-out immediately before incision requires active verbal confirmation from all team members",
"Any team member concern during time-out halts the procedure until resolved",
"Pre-procedure verification uses two patient identifiers, consent, site, and imaging",
"Sign-out confirms procedure, correct instrument/sponge counts, and specimen labeling before exit",
  ],
"PSYCH-SUICIDE-013": [
"Screen at-risk patients with the validated C-SSRS and document results",
"Positive screens require a full clinician risk assessment before setting observation level",
"High-risk patients require continuous 1:1 observation - never leave the patient unattended",
"Complete a ligature-risk assessment and remove hazardous items before room occupancy",
"Reassess risk and complete a safety plan before any transfer, discharge, or level change",
  ],
"BLOOD-TRANS-014": [
"Two qualified staff perform independent bedside verification with two patient identifiers",
"Remain with the patient for the first 15 minutes when severe reactions are most likely",
"Only 0.9% saline may be co-infused - never add medications to blood components",
"For a suspected reaction: STOP, keep line open with saline, recheck identity, notify blood bank",
"Distinguish TACO from TRALI - management differs and both are reportable events",
  ],
}

const fallbackSOPs: SOP[] = [
  { id: 1, sop_id: "SOP-001", title: "Sepsis Management Protocol", department: "ICU", version: "3.2", status: "active", effective_date: "2024-09-15", structured_json: {}, chunk_count: 0 },
  { id: 2, sop_id: "SOP-002", title: "Blood Transfusion Guidelines", department: "Infection Control", version: "2.1", status: "active", effective_date: "2024-08-20", structured_json: {}, chunk_count: 0 },
  { id: 3, sop_id: "SOP-003", title: "Central Line Insertion Procedure", department: "ICU", version: "4.0", status: "active", effective_date: "2024-10-01", structured_json: {}, chunk_count: 0 },
  { id: 4, sop_id: "SOP-004", title: "Insulin Administration Protocol", department: "Endocrine", version: "1.5", status: "draft", effective_date: "2024-07-10", structured_json: {}, chunk_count: 0 },
  { id: 5, sop_id: "SOP-005", title: "Emergency Vasopressor Guidelines", department: "Emergency", version: "2.0", status: "active", effective_date: "2024-06-22", structured_json: {}, chunk_count: 0 },
  { id: 6, sop_id: "SOP-006", title: "Post-Operative Pain Management", department: "Pharmacy", version: "3.1", status: "archived", effective_date: "2024-05-18", structured_json: {}, chunk_count: 0 },
  { id: 7, sop_id: "SOP-007", title: "Ventilator Weaning Protocol", department: "ICU", version: "2.3", status: "active", effective_date: "2024-09-30", structured_json: {}, chunk_count: 0 },
  { id: 8, sop_id: "SOP-008", title: "Anticoagulation Therapy Guidelines", department: "Nursing", version: "1.8", status: "active", effective_date: "2024-08-05", structured_json: {}, chunk_count: 0 },
]

const deptColors: Record<string, string> = {
  ICU: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30",
"Infection Control": "bg-muted text-[#64748B] border-[#CBD5E1]",
  Endocrine: "bg-muted text-[#64748B] border-[#CBD5E1]",
  Emergency: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30",
  Pharmacy: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400 border-[#BBF7D0] dark:border-green-500/30",
  Radiology: "bg-muted text-[#64748B] border-[#CBD5E1]",
  Nursing: "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30",
  General: "bg-muted text-[#64748B] border-[#CBD5E1]",
}

const statusColors: Record<string, string> = {
  active: "bg-[#DCFCE7] dark:bg-green-500/10 text-[#15803D] dark:text-green-400",
  draft: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400",
  archived: "bg-muted text-[#64748B] border-[#CBD5E1]",
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<AppShell><div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-[#0B6BCB] animate-spin" /></div></AppShell>}>
      <LibraryPageInner />
    </Suspense>
  )
}

function LibraryPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser } = useRole()
  const [search, setSearch] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [myDeptOnly, setMyDeptOnly] = useState(false)
  const [sops, setSOPs] = useState<SOP[]>(fallbackSOPs)
  const [isDemo, setIsDemo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [fullText, setFullText] = useState<string | null>(null)
  const [loadingFullText, setLoadingFullText] = useState(false)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards")

  // ── Acknowledgment state ──────────────────────────────────────────────────
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    const saved = localStorage.getItem("sop-guard-acknowledged")
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })

  const acknowledge = (sopId: string) => {
    const newSet = new Set(acknowledged)
    newSet.add(sopId)
    setAcknowledged(newSet)
    localStorage.setItem("sop-guard-acknowledged", JSON.stringify(Array.from(newSet)))
  }

  // Helper: find enhanced SOP data by sop_id or title match
  const findEnhancedSOP = (sop: SOP): EnhancedSOP | undefined => {
    return MOCK_SOPS.find(
      ms => ms.sop_id === sop.sop_id || ms.title === sop.title
    )
  }

  // Reset tab state when a new SOP is selected
  const openSOP = useCallback((sop: SOP, tab?: TabId) => {
    setSelectedSOP(sop)
    setActiveTab(tab || "overview")
    setFullText(null)
  }, [])

  useEffect(() => {
    async function fetchSOPs() {
      try {
        const data = await getSOPs()
        const list = Array.isArray(data) ? data : (data as unknown as { sops: SOP[] }).sops || []
        if (list.length > 0) {
          setSOPs(list)
          setIsDemo(false)
          // Auto-open SOP from URL params
          const sopId = searchParams.get("sopId")
          const section = searchParams.get("section") as TabId | null
          if (sopId) {
            const match = list.find((s: SOP) => String(s.id) === sopId)
            if (match) openSOP(match, section || "overview")
          }
        } else {
          setIsDemo(true)
        }
      } catch {
        setIsDemo(true)
      } finally {
        setLoading(false)
      }
    }
    fetchSOPs()
  }, [searchParams, openSOP])

  // Fetch full text when Full Text tab is opened
  useEffect(() => {
    if (activeTab === "fulltext" && selectedSOP && !fullText) {
      setLoadingFullText(true)
      fetch(`/api/sops/${selectedSOP.sop_id}`)
        .then(r => r.json())
        .then(data => setFullText(data.raw_text || "Full text not available."))
        .catch(() => setFullText("Full text not available. Start the backend to view complete SOP content."))
        .finally(() => setLoadingFullText(false))
    }
  }, [activeTab, selectedSOP, fullText])

  const filtered = sops.filter((s) => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.department.toLowerCase().includes(search.toLowerCase())
    const matchDept = deptFilter === "all" || s.department === deptFilter
    const matchMyDept = !myDeptOnly || s.department === currentUser.department
    return matchSearch && matchDept && matchMyDept
  })

  const departments = ["all", ...Array.from(new Set(sops.map((s) => s.department)))]

  // Normalize structured_json to handle different field name formats
  const rawSj = selectedSOP?.structured_json as Record<string, any> | undefined
  const structuredJson = rawSj ? {
    title: rawSj.title,
    steps: (rawSj.steps || []).map((s: any, i: number) => ({
      step_number: s.step_number ?? s.step ?? (i + 1),
      text: s.text ?? s.action ?? String(s),
    })),
    thresholds: (rawSj.thresholds || []).map((t: any) =>
      typeof t === "string" ? { type: "threshold", value: t, context: "" } : t
    ),
    contraindications: (rawSj.contraindications || []).map((c: any) =>
      typeof c === "string" ? { text: c, detail: "" } : { text: c.text ?? c.condition ?? "", detail: c.detail ?? c.action_to_avoid ?? "" }
    ),
  } : undefined

  return (
    <AppShell>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #sop-print-content, #sop-print-content * { visibility: visible; }
          #sop-print-content { position: fixed; left: 0; top: 0; width: 100%; background: white; color: black; padding: 40px; }
          .sop-print-header::before {
            content: "PRINTED COPY - Verify currency before clinical use";
            display: block;
            font-weight: bold;
            font-size: 14px;
            color: #c00;
            border: 2px solid #c00;
            padding: 8px 16px;
            margin-bottom: 16px;
            text-align: center;
          }
          .sop-no-print { display: none !important; }
          .sop-print-watermark {
            position: fixed;
            bottom: 40px;
            right: 40px;
            font-size: 11px;
            color: #999;
            border: 1px solid #ccc;
            padding: 4px 8px;
          }
        }
      `}</style>

      <div className="p-6 max-w-6xl mx-auto">
        <Breadcrumb items={[{ label: "SOP Library" }]} />

        {/* Demo banner */}
        {isDemo && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Showing demo data. Start the backend for real SOPs.</span>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-[#E2E8F0]">
            <Search className="w-4 h-4 text-[#64748B]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SOPs by title or department..."
              className="bg-transparent outline-none w-full text-sm text-[#1A2332] placeholder:text-[#94A3B8] caret-[#0B6BCB]"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {departments.map((d) => (
              <button
                key={d}
                onClick={() => setDeptFilter(d)}
                className={cn(
"px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors",
                  deptFilter === d
                    ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30"
                    : "border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332]"
                )}
              >
                {d === "all" ? "All Departments" : d}
              </button>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setViewMode("cards")} className={cn(
"p-2 rounded-lg transition-colors",
                viewMode === "cards" ? "bg-[#0B6BCB]/10 text-[#0B6BCB]" : "text-[#64748B] hover:text-[#1A2332]"
              )}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("table")} className={cn(
"p-2 rounded-lg transition-colors",
                viewMode === "table" ? "bg-[#0B6BCB]/10 text-[#0B6BCB]" : "text-[#64748B] hover:text-[#1A2332]"
              )}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* My Department filter toggle */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setMyDeptOnly(!myDeptOnly)}
            className={cn(
"flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              myDeptOnly
                ? "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30"
                : "border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332]"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            My Department Only
          </button>
          {myDeptOnly && (
            <span className="text-xs text-[#0B6BCB] bg-[#0B6BCB]/10 border border-[#0B6BCB]/30 px-2.5 py-1 rounded-lg">
              Showing {filtered.length} SOP{filtered.length !== 1 ? "s" : ""} for {currentUser.department}
            </span>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-[#0B6BCB] animate-spin" />
          </div>
        )}

        {/* Grid / Table */}
        {!loading && viewMode === "table" ? (
          <div className="rounded-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-card">
                  <th className="text-left p-3 font-medium text-[#64748B]">Title</th>
                  <th className="text-left p-3 font-medium text-[#64748B]">Department</th>
                  <th className="text-left p-3 font-medium text-[#64748B]">Version</th>
                  <th className="text-left p-3 font-medium text-[#64748B]">Status</th>
                  <th className="text-left p-3 font-medium text-[#64748B]">Date</th>
                  <th className="text-left p-3 font-medium text-[#64748B]">Chunks</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sop) => (
                  <tr key={sop.id} onClick={() => openSOP(sop)}
                    className="border-b border-[#EDF1F5] hover:bg-muted cursor-pointer transition-colors">
                    <td className="p-3 font-medium">{sop.title}</td>
                    <td className="p-3">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", deptColors[sop.department] || "bg-muted")}>
                        {sop.department}
                      </span>
                    </td>
                    <td className="p-3 text-[#64748B]">v{sop.version}</td>
                    <td className="p-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs", statusColors[sop.status] || "bg-muted")}>
                        {sop.status}
                      </span>
                    </td>
                    <td className="p-3 text-[#64748B]">{sop.effective_date}</td>
                    <td className="p-3 text-[#64748B]">{sop.chunk_count || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ) : !loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((sop, i) => {
              const enhanced = findEnhancedSOP(sop)
              const needsAck = enhanced?.compliance_acknowledgment_required ?? false
              const isAcknowledged = acknowledged.has(sop.sop_id)
              const completionRate = enhanced?.acknowledgment_stats?.completion_rate

              return (
                <motion.div
                  key={sop.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-2xl bg-card border border-[#E2E8F0] hover:border-[#0B6BCB]/30 hover:shadow-md transition-all duration-300 group"
                >
                  <div
                    className="cursor-pointer"
                    onClick={() => openSOP(sop)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", deptColors[sop.department] || "bg-muted text-[#64748B]")}>
                        {sop.department}
                      </span>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColors[sop.status] || "bg-muted text-[#64748B]")}>
                        {sop.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold mb-3 group-hover:text-[#0B6BCB] transition-colors">
                      {sop.title}
                    </h3>

                    <div className="flex items-center gap-4 text-xs text-[#64748B] mb-3">
                      <span className="flex items-center gap-1"><Hash className="w-3 h-3" />v{sop.version}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{sop.effective_date}</span>
                      {sop.chunk_count > 0 && (
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{sop.chunk_count} chunks</span>
                      )}
                    </div>

                    {/* Acknowledgment completion rate */}
                    {completionRate !== undefined && (
                      <div className="mb-3 space-y-1">
                        <div className="flex justify-between text-[10px] text-[#64748B]">
                          <span>Staff acknowledgment</span>
                          <span className="font-semibold">{completionRate}%</span>
                        </div>
                        <div className="h-1 bg-[#EDF1F5] rounded-full overflow-hidden">
                          <div
                            className={cn(
"h-full rounded-full",
                              completionRate >= 90 ? "bg-[#15803D]" : completionRate >= 70 ? "bg-[#0B6BCB]" : "bg-[#B45309]"
                            )}
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acknowledgment button */}
                  {needsAck && (
                    <div className="mt-2">
                      {isAcknowledged ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 text-xs text-[#15803D] dark:text-green-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            acknowledge(sop.sop_id)
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0B6BCB]/40 text-xs text-[#0B6BCB] hover:bg-[#0B6BCB]/10 transition-colors"
                        >
                          <FileCheck className="w-3.5 h-3.5" /> Acknowledge
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-[#64748B]">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No SOPs found matching your search.</p>
          </div>
        )}
      </div>

      {/* SOP Detail Modal */}
      <AnimatePresence mode="wait">
        {selectedSOP && (
          <motion.div
            key="sop-modal-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setSelectedSOP(null)}
          >
            <motion.div
              key="sop-modal-content"
              id="sop-print-content"
              className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-card border border-[#E2E8F0] shadow-2xl"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Print watermark (only visible when printing) */}
              <div className="sop-print-watermark hidden">
                CONTROLLED DOCUMENT - Version {selectedSOP.version}
              </div>

              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-0 sop-print-header">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold mb-2">{selectedSOP.title}</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("px-2.5 py-1 rounded text-xs font-medium border", deptColors[selectedSOP.department] || "bg-muted text-[#64748B]")}>
                      {selectedSOP.department}
                    </span>
                    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", statusColors[selectedSOP.status] || "bg-muted text-[#64748B]")}>
                      {selectedSOP.status}
                    </span>
                    <span className="text-xs text-[#64748B]">v{selectedSOP.version}</span>
                    <span className="text-xs text-[#64748B]">{selectedSOP.effective_date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 sop-no-print">
                  {/* Print SOP button */}
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332] hover:border-[#CBD5E1] text-xs font-medium transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                  <button
                    onClick={() => setSelectedSOP(null)}
                    className="p-2 rounded-lg hover:bg-muted text-[#64748B] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* AI Summary Section */}
              {SOP_AI_SUMMARIES[selectedSOP.sop_id] && (
                <div className="mx-6 mt-4 p-4 rounded-xl bg-[#0B6BCB]/[0.04] border border-[#0B6BCB]/30">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-[#0B6BCB] uppercase tracking-wide">AI-Generated Summary</p>
                  </div>
                  <p className="text-[11px] text-[#64748B] italic mb-3">
                    Read the full SOP before clinical application.
                  </p>
                  <ul className="space-y-1.5">
                    {SOP_AI_SUMMARIES[selectedSOP.sop_id].map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-[#0B6BCB] shrink-0 mt-0.5" />
                        <span className="text-xs text-[#64748B] leading-snug">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tab Bar */}
              <div className="flex gap-1 px-6 mt-4 border-b border-[#E2E8F0] overflow-x-auto sop-no-print">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
"flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative",
                        activeTab === tab.id
                          ? "text-[#0B6BCB]"
                          : "text-[#64748B] hover:text-[#1A2332]"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="tab-underline"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0B6BCB] rounded-full"
                        />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Overview Tab */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-muted border border-[#EDF1F5]">
                        <p className="text-xs text-[#64748B] mb-1">Version</p>
                        <p className="text-sm font-semibold">v{selectedSOP.version}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-muted border border-[#EDF1F5]">
                        <p className="text-xs text-[#64748B] mb-1">Effective Date</p>
                        <p className="text-sm font-semibold">{selectedSOP.effective_date}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-muted border border-[#EDF1F5]">
                        <p className="text-xs text-[#64748B] mb-1">Department</p>
                        <p className="text-sm font-semibold">{selectedSOP.department}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-muted border border-[#EDF1F5]">
                        <p className="text-xs text-[#64748B] mb-1">Status</p>
                        <p className="text-sm font-semibold capitalize">{selectedSOP.status}</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-muted border border-[#EDF1F5]">
                      <p className="text-xs text-[#64748B] mb-1">Purpose</p>
                      <p className="text-sm leading-relaxed">
                        {(structuredJson as Record<string, unknown> | undefined)?.purpose
                          ? String((structuredJson as Record<string, unknown>).purpose)
                          : (structuredJson as Record<string, unknown> | undefined)?.description
                            ? String((structuredJson as Record<string, unknown>).description)
                            : `Standard operating procedure for ${selectedSOP.title.toLowerCase()}.`}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted border border-[#EDF1F5]">
                      <p className="text-xs text-[#64748B] mb-1">Scope</p>
                      <p className="text-sm leading-relaxed">
                        {(structuredJson as Record<string, unknown> | undefined)?.scope
                          ? String((structuredJson as Record<string, unknown>).scope)
                          : "See Full Text tab for complete scope details."}
                      </p>
                    </div>
                    {selectedSOP.chunk_count > 0 && (
                      <div className="p-4 rounded-xl bg-[#0B6BCB]/[0.04] border border-[#0B6BCB]/30">
                        <p className="text-xs text-[#64748B] mb-1">Indexed Content</p>
                        <p className="text-sm font-semibold text-[#0B6BCB]">{selectedSOP.chunk_count} chunks available for AI queries</p>
                      </div>
                    )}

                    {/* Document Structure */}
                    <div className="mt-6">
                      <h4 className="text-xs font-semibold uppercase text-[#64748B] mb-3">Document Structure</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(() => {
                          const sj = structuredJson || {} as any
                          const stats = [
                            { label: "Steps", count: (sj.steps || []).length, icon: ListOrdered, color: "text-[#0B6BCB]" },
                            { label: "Thresholds", count: (sj.thresholds || []).length, icon: Gauge, color: "text-[#B45309] dark:text-amber-400" },
                            { label: "Warnings", count: (sj.contraindications || []).length, icon: ShieldAlert, color: "text-[#B91C1C] dark:text-red-400" },
                            { label: "Chunks", count: selectedSOP?.chunk_count || 0, icon: FileText, color: "text-[#15803D] dark:text-green-400" },
                          ]
                          return stats.map(s => (
                            <div key={s.label} className="p-3 rounded-xl bg-muted border border-[#E2E8F0] text-center">
                              <s.icon className={cn("w-5 h-5 mx-auto mb-1", s.color)} />
                              <p className="text-xl font-bold">{s.count}</p>
                              <p className="text-xs text-[#64748B]">{s.label}</p>
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Procedure Tab */}
                {activeTab === "procedure" && (
                  <div>
                    {structuredJson?.steps && structuredJson.steps.length > 0 ? (
                      <ol className="space-y-2">
                        {structuredJson.steps.map((step: any) => (
                          <li key={step.step_number} className="flex gap-3 p-3 rounded-xl bg-muted border border-[#EDF1F5]">
                            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB] text-xs font-bold flex items-center justify-center">
                              {step.step_number}
                            </span>
                            <span className="text-sm leading-relaxed pt-1">{step.text}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="p-8 rounded-xl bg-muted border border-[#EDF1F5] text-center">
                        <ListOrdered className="w-10 h-10 mx-auto mb-3 text-[#64748B] opacity-40" />
                        <p className="text-sm text-[#64748B]">Structured steps not available for this SOP. See Full Text tab.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Thresholds Tab */}
                {activeTab === "thresholds" && (
                  <div>
                    {structuredJson?.thresholds && structuredJson.thresholds.length > 0 ? (
                      <div className="space-y-2">
                        {structuredJson.thresholds.map((t: any, i: number) => (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-4 rounded-xl bg-muted border border-[#CBD5E1]">
                            <span className="text-xs font-medium text-[#64748B] uppercase tracking-wide min-w-[100px]">{t.type || "Threshold"}</span>
                            <span className="text-sm font-mono font-semibold">{t.value}</span>
                            {t.context && <span className="text-xs text-[#64748B] sm:ml-auto">{t.context}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 rounded-xl bg-muted border border-[#EDF1F5] text-center">
                        <Gauge className="w-10 h-10 mx-auto mb-3 text-[#64748B] opacity-40" />
                        <p className="text-sm text-[#64748B]">No specific thresholds defined in this SOP.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Contraindications Tab */}
                {activeTab === "contraindications" && (
                  <div>
                    {structuredJson?.contraindications && structuredJson.contraindications.length > 0 ? (
                      <div className="space-y-2">
                        {structuredJson.contraindications.map((c: any, i: number) => (
                          <div key={i} className="flex gap-3 p-4 rounded-xl bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30">
                            <AlertTriangle className="w-4 h-4 text-[#B91C1C] dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">{c.text}</p>
                              {c.detail && <p className="text-xs text-[#64748B] mt-1">{c.detail}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 rounded-xl bg-muted border border-[#EDF1F5] text-center">
                        <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-[#64748B] opacity-40" />
                        <p className="text-sm text-[#64748B]">No specific contraindications defined in this SOP.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Full Text Tab */}
                {activeTab === "fulltext" && (
                  <div>
                    {loadingFullText ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 text-[#0B6BCB] animate-spin mr-2" />
                        <span className="text-sm text-[#64748B]">Loading full text...</span>
                      </div>
                    ) : fullText ? (
                      <div className="p-4 rounded-xl bg-muted border border-[#EDF1F5] max-h-[55vh] overflow-y-auto">
                        {fullText.split(/\n\s*\n/).filter((p) => p.trim()).map((para, i) => (
                          <p key={i} className="text-[15px] leading-[1.7] text-[#1A2332] whitespace-pre-wrap mb-3 last:mb-0">
                            {para.trim()}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 text-[#0B6BCB] animate-spin mr-2" />
                        <span className="text-sm text-[#64748B]">Loading...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Acknowledgment section */}
              {(() => {
                const enhanced = findEnhancedSOP(selectedSOP)
                const needsAck = enhanced?.compliance_acknowledgment_required ?? false
                const isAcknowledged = acknowledged.has(selectedSOP.sop_id)
                if (!needsAck) return null
                return (
                  <div className="mx-6 mb-2 p-4 rounded-xl border border-[#0B6BCB]/30 bg-[#0B6BCB]/[0.04] space-y-3 sop-no-print">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-[#0B6BCB] shrink-0" />
                      <p className="text-xs font-semibold text-[#0B6BCB] uppercase tracking-wide">Policy Acknowledgment Required</p>
                    </div>
                    {isAcknowledged ? (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30">
                        <CheckCircle2 className="w-5 h-5 text-[#15803D] dark:text-green-400 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-[#15803D] dark:text-green-400">Acknowledged</p>
                          <p className="text-xs text-[#15803D] dark:text-green-400/70">Acknowledged on {new Date().toLocaleDateString("en-US")}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-[#64748B] leading-relaxed">
                          By clicking acknowledge, you confirm you have read and understood this policy.
                        </p>
                        <button
                          onClick={() => acknowledge(selectedSOP.sop_id)}
                          className="w-full py-3 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <FileCheck className="w-4 h-4" />
                          I Acknowledge This Policy
                        </button>
                      </>
                    )}
                  </div>
                )
              })()}

              {/* Action Buttons */}
              <div className="flex gap-3 p-6 pt-4 border-t border-[#E2E8F0] sop-no-print">
                <button
                  onClick={() => router.push(`/query?q=${encodeURIComponent(`Tell me about ${selectedSOP.title}`)}`)}
                  className="flex-1 py-3 rounded-xl bg-[#0B6BCB] hover:bg-[#0959AC] text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ask about this SOP
                </button>
                <button
                  onClick={() => setSelectedSOP(null)}
                  className="px-6 py-3 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:text-[#1A2332] hover:border-[#CBD5E1] font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  )
}
