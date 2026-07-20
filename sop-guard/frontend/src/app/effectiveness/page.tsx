"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Activity, Database, ChevronDown, ChevronUp } from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"

// Reframed from "SOP Effectiveness Measurement" (a dense fake-precision
// analytics dashboard - invented before/after metric tables presented
// with the same visual weight as real data) to a short, honest
// methodology page. Linking SOP governance to measurable outcomes is a
// real and valuable idea, but showing simulated numbers as if they were
// live hospital data overclaims what this system currently does. This
// page now explains the concept and what it would take to make it real,
// rather than performing it with placeholder figures.
export default function EffectivenessPage() {
  const [methodologyOpen, setMethodologyOpen] = useState(false)

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "SOP Impact" }]} />

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground font-display">SOP Impact</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              How SOP changes could be linked to patient safety outcomes
            </p>
          </div>
        </div>

        <div className="bg-card border border-border shadow-sm rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-[#0B6BCB]">
            <Database className="w-4 h-4" />
            <span className="text-sm font-medium text-foreground">Connecting governance to outcomes</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            When a protocol changes - a new threshold, an updated PPE requirement, a revised escalation
            step - the real question is whether it made a difference. Meridian tracks every SOP version
            and every acknowledgment already. Connected to a hospital&apos;s own quality systems (infection
            surveillance, adverse event reporting, pharmacy safety data), that version history could be
            lined up against the metrics those systems already collect, showing whether an update to a
            protocol coincided with a change in the outcome it was meant to affect.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            That connection doesn&apos;t exist yet - this page describes the approach, not a live feed.
          </p>
        </div>

        {/* Methodology note (collapsible) */}
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden">
          <button
            onClick={() => setMethodologyOpen((v) => !v)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted transition-colors"
          >
            <span className="text-sm font-medium text-foreground">How this would work</span>
            {methodologyOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {methodologyOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="px-4 pb-4 text-xs text-muted-foreground leading-relaxed border-t border-border pt-3 space-y-2"
            >
              <p>
                SOP effectiveness measurement requires linking policy version changes to quality metric
                datasets. In practice this would connect to systems a hospital already runs: NHSN
                reporting for infections, an adverse-event database (e.g. Quantros or RL Solutions),
                pharmacy safety systems, and EMR quality dashboards.
              </p>
              <p>
                The comparison itself would be a pre/post read against each metric around the SOP&apos;s
                effective date, with enough tracked history to distinguish a real shift from normal
                month-to-month variation - not a single before/after snapshot.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
