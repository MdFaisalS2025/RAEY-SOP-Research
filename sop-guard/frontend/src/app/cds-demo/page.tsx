"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Plug, AlertTriangle, Info, ShieldAlert, ChevronDown, ChevronRight,
  ExternalLink, Loader2,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type Indicator = "info" | "warning" | "critical"

interface CDSCard {
  indicator: Indicator
  summary: string
  detail: string
  source: string
}

const MEDICATIONS = ["norepinephrine", "insulin", "heparin", "vasopressin", "cefepime"] as const

// ─── Fallback mock logic ─────────────────────────────────────────────────────

function mockCards(medication: string, dose: string): CDSCard[] {
  const doseNote = dose ? ` Ordered dose: ${dose}.` : ""
  if (medication === "norepinephrine") {
    return [{
      indicator: "warning",
      summary: "Norepinephrine dose limit per ICU-SEP-002",
      detail: `Maximum norepinephrine dose is 3 mcg/kg/min. Titrate to MAP 65 mmHg or above. Add vasopressin at 0.5 mcg/kg/min norepinephrine if target not met.${doseNote}`,
      source: "Meridian",
    }]
  }
  if (medication === "insulin") {
    return [{
      indicator: "warning",
      summary: "High-alert medication: independent double-check required",
      detail: `PHARM-MED-007 requires an independent double-check by a second qualified clinician before insulin infusion. Telephonic verification permitted when no second clinician is on site.${doseNote}`,
      source: "Meridian",
    }]
  }
  return [{
    indicator: "info",
    summary: `Protocol guidance available for ${medication}`,
    detail: `Review the applicable hospital SOP before administration.${doseNote} PHARM-MED-007 applies to all ISMP high-alert medications including heparin and concentrated electrolytes.`,
    source: "Meridian",
  }]
}

const indicatorConfig: Record<Indicator, { strip: string; chip: string; icon: typeof Info; label: string }> = {
  info: { strip: "bg-[#0B6BCB]", chip: "bg-[#0B6BCB]/10 text-[#0B6BCB] border-[#0B6BCB]/30", icon: Info, label: "Info" },
  warning: { strip: "bg-[#F59E0B]", chip: "bg-[#FEF3C7] dark:bg-amber-500/10 text-[#B45309] dark:text-amber-400 border-[#FDE68A] dark:border-amber-500/30", icon: AlertTriangle, label: "Warning" },
  critical: { strip: "bg-[#DC2626]", chip: "bg-[#FEE2E2] dark:bg-red-500/10 text-[#B91C1C] dark:text-red-400 border-[#FECACA] dark:border-red-500/30", icon: ShieldAlert, label: "Critical" },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CDSDemoPage() {
  const [medication, setMedication] = useState<string>(MEDICATIONS[0])
  const [dose, setDose] = useState("")
  const [cards, setCards] = useState<CDSCard[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [usedFallback, setUsedFallback] = useState(false)
  const [howOpen, setHowOpen] = useState(false)
  const [lastResponse, setLastResponse] = useState<string | null>(null)

  const requestBody = { context: { medication, dose } }

  const signOrder = async () => {
    setLoading(true)
    setCards(null)
    try {
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || "") + "/cds-services/meridian-protocol-check",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      )
      if (!res.ok) throw new Error("bad status")
      const data = await res.json()
      const returned: CDSCard[] = (data.cards || []).map((c: { indicator?: string; summary?: string; detail?: string; source?: { label?: string } }) => ({
        indicator: (c.indicator === "critical" || c.indicator === "warning" ? c.indicator : "info") as Indicator,
        summary: c.summary || "Protocol guidance",
        detail: c.detail || "",
        source: c.source?.label || "Meridian",
      }))
      if (returned.length === 0) throw new Error("empty")
      setCards(returned)
      setUsedFallback(false)
      setLastResponse(JSON.stringify(data, null, 2))
    } catch {
      const fallback = mockCards(medication, dose)
      setCards(fallback)
      setUsedFallback(true)
      setLastResponse(JSON.stringify({ cards: fallback.map(c => ({ indicator: c.indicator, summary: c.summary, detail: c.detail, source: { label: c.source } })) }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "EMR Integration" }]} />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center">
            <Plug className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">EMR Integration (CDS Hooks)</h1>
            <p className="text-sm text-muted-foreground">
              When a clinician places an order in the EMR, Meridian returns protocol guidance cards using the HL7 CDS Hooks standard.
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 text-[#B45309] dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Demonstration against a simulated EMR. Production use requires hospital EHR integration.</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: simulated EMR */}
          <div className="rounded-xl border border-input bg-card shadow-sm overflow-hidden">
            <div className="bg-[#475569] px-4 py-2.5">
              <p className="text-sm font-semibold text-white">Simulated EMR - Order Entry</p>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground border border-border bg-background rounded px-3 py-2">
                Patient: Bed 12, sepsis, NEWS2 7
              </p>
              <div className="space-y-1.5">
                <label htmlFor="cds-med" className="text-xs font-medium text-foreground">Medication</label>
                <select
                  id="cds-med"
                  value={medication}
                  onChange={e => setMedication(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#0B6BCB]"
                >
                  {MEDICATIONS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="cds-dose" className="text-xs font-medium text-foreground">Dose</label>
                <input
                  id="cds-dose"
                  type="text"
                  value={dose}
                  onChange={e => setDose(e.target.value)}
                  placeholder="e.g. 0.1 mcg/kg/min"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-[#0B6BCB]"
                />
              </div>
              <button
                onClick={signOrder}
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0B6BCB] text-white hover:bg-[#0959AC] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign Order
              </button>
            </div>
          </div>

          {/* Right: CDS cards */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">EMR Sidebar - Guidance Cards</h2>
            {!cards && !loading && (
              <div className="rounded-xl border border-dashed border-input bg-muted p-8 text-center text-sm text-muted-foreground">
                Sign an order to see protocol guidance.
              </div>
            )}
            {loading && (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking protocols
              </div>
            )}
            {cards?.map((card, i) => {
              const cfg = indicatorConfig[card.indicator]
              const Icon = cfg.icon
              return (
                <div key={i} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex">
                  <div className={cn("w-1.5 shrink-0", cfg.strip)} />
                  <div className="p-4 space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1", cfg.chip)}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                      <span className="text-xs text-muted-foreground">Source: {card.source}</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{card.summary}</p>
                    <p className="text-sm text-muted-foreground">{card.detail}</p>
                    <Link href="/library" className="text-xs text-[#0B6BCB] hover:text-[#0959AC] font-medium inline-flex items-center gap-1">
                      View full SOP <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
            {cards && usedFallback && (
              <p className="text-xs text-muted-foreground italic">
                Backend unreachable. Card generated from local demo logic.
              </p>
            )}
          </div>
        </div>

        {/* How this works */}
        <section className="rounded-2xl bg-card border border-border shadow-sm">
          <button
            onClick={() => setHowOpen(!howOpen)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-foreground"
          >
            How this works
            {howOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>
          {howOpen && (
            <div className="px-5 pb-5 space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0B6BCB] mt-1.5 shrink-0" />
                  The EMR discovers Meridian services at the CDS Hooks discovery endpoint.
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0B6BCB] mt-1.5 shrink-0" />
                  The order-select hook fires when a clinician selects an order.
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0B6BCB] mt-1.5 shrink-0" />
                  Guidance cards are returned in under 500 ms.
                </li>
              </ul>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Request</p>
                  <pre className="rounded-lg bg-muted border border-border p-3 text-xs text-foreground font-mono overflow-x-auto">
{`POST /cds-services/meridian-protocol-check
${JSON.stringify(requestBody, null, 2)}`}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Response</p>
                  <pre className="rounded-lg bg-muted border border-border p-3 text-xs text-foreground font-mono overflow-x-auto">
{lastResponse ?? "Sign an order to populate the response."}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
