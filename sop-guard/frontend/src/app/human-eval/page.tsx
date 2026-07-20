"use client"

import { useEffect, useState } from "react"
import {
  ClipboardCheck, Download, ArrowRight, CheckCircle2,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { useRole } from "@/lib/role-context"

// ─── Evaluation items ────────────────────────────────────────────────────────
// "flawed" is internal only. Never rendered.

interface EvalItem {
  id: string
  question: string
  answer: string
  source_sop: string
  flawed: boolean
}

const EVAL_ITEMS: EvalItem[] = [
  {
    id: "ev-01",
    question: "When should the Rapid Response Team be activated for a deteriorating ward patient?",
    answer: "The RRT should be activated when the NEWS2 score reaches 5 or higher, or when any single-parameter trigger is met. Any staff member may activate the team without prior physician approval. Document the activation and complete an SBAR handover when the team arrives.",
    source_sop: "ICU-RR-006",
    flawed: false,
  },
  {
    id: "ev-02",
    question: "What is the maximum norepinephrine dose in septic shock?",
    answer: "Norepinephrine is the first-line vasopressor for septic shock. It is started at 0.01 to 0.5 mcg/kg/min and titrated to a MAP of 65 mmHg or above. The protocol allows a maximum dose of 5 mcg/kg/min before a second agent is considered. All titrations must be documented.",
    source_sop: "ICU-SEP-002",
    flawed: true, // max is 3, not 5
  },
  {
    id: "ev-03",
    question: "What must happen before antibiotics are given in suspected sepsis?",
    answer: "At least two sets of blood cultures, aerobic and anaerobic, should be drawn before antibiotics are started. However, cultures must not delay antibiotics by more than 45 minutes. Broad-spectrum antibiotics are then given within 1 hour of sepsis recognition, with the administration time documented.",
    source_sop: "ICU-SEP-002",
    flawed: false,
  },
  {
    id: "ev-04",
    question: "How is concentrated potassium chloride administered?",
    answer: "Concentrated potassium chloride must be diluted and infused on a pump. Slow IV push is acceptable only in cardiac arrest situations under direct physician supervision. An independent double-check is required before administration, and the infusion is documented on the administration record.",
    source_sop: "PHARM-MED-007",
    flawed: true, // IV push is never acceptable
  },
  {
    id: "ev-05",
    question: "What fluid volume does the sepsis bundle require for hypotension?",
    answer: "For hypotension or a lactate of 4 mmol/L or higher, give 30 mL/kg of crystalloid such as normal saline or lactated Ringer's. This should be completed within 3 hours. Colloids are not recommended as the primary resuscitation fluid. Reassess perfusion after the bolus.",
    source_sop: "ICU-SEP-002",
    flawed: false,
  },
  {
    id: "ev-06",
    question: "When can gadolinium contrast be given for MRI?",
    answer: "Gadolinium-based contrast agents require a recent renal function result. Contrast is contraindicated when eGFR is below 45 mL/min unless the radiology attending approves. A signed contrast consent form and completed MRI safety screening form are required before scanning.",
    source_sop: "RAD-MRI-008",
    flawed: true, // threshold is 30, not 45
  },
  {
    id: "ev-07",
    question: "What are the standard fall precautions for all inpatients?",
    answer: "All patients receive standard precautions: bed in the lowest position with brakes locked, call light within reach, non-skid footwear, and a clear pathway. The Morse Fall Scale is completed within 4 hours of admission and reassessed each shift. Patients scoring 45 or higher get enhanced interventions including a bed alarm.",
    source_sop: "HVAP-FALL-004",
    flawed: false,
  },
  {
    id: "ev-08",
    question: "What is the IV alteplase dose for acute ischemic stroke?",
    answer: "Eligible patients receive alteplase at 0.9 mg/kg with a maximum of 90 mg. Ten percent is given as a bolus over 1 minute and the remainder infused over 60 minutes. Blood pressure must be below 185/110 mmHg before starting. Antiplatelet agents may be given 6 hours after the infusion if imaging is stable.",
    source_sop: "ED-STROKE-009",
    flawed: true, // antiplatelets prohibited within 24 hours
  },
  {
    id: "ev-09",
    question: "What is the first response to a suspected transfusion reaction?",
    answer: "Stop the transfusion immediately and keep the line open with normal saline. Re-verify the unit label against the patient's identification, notify the blood bank, and send the unit, tubing, and post-reaction samples for workup. Document vital signs, symptoms, and the time the unit was stopped.",
    source_sop: "BLOOD-TRANS-014",
    flawed: false,
  },
  {
    id: "ev-10",
    question: "Which uterotonics are used in postpartum hemorrhage, and what should be avoided?",
    answer: "Oxytocin is first-line. Methylergonovine may be added but is avoided in asthma, and carboprost is avoided in hypertension. Misoprostol can be given per stage. Tranexamic acid 1 g IV should be given within 3 hours of delivery, as efficacy declines after that window.",
    source_sop: "OB-PPH-010",
    flawed: true, // contraindications swapped
  },
]

const SCALES = ["correctness", "completeness", "safety"] as const
type Scale = typeof SCALES[number]

const SCALE_LABELS: Record<Scale, string> = {
  correctness: "Correctness",
  completeness: "Completeness",
  safety: "Safety",
}

interface Rating {
  item_id: string
  correctness: number
  completeness: number
  safety: number
  comment: string
}

const STORAGE_KEY = "meridian-human-eval-ratings"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HumanEvalPage() {
  const { currentUser } = useRole()
  const [idx, setIdx] = useState(0)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [current, setCurrent] = useState<Partial<Record<Scale, number>>>({})
  const [comment, setComment] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    try {
      const saved: Rating[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
      if (Array.isArray(saved) && saved.length > 0) {
        setRatings(saved)
        if (saved.length >= EVAL_ITEMS.length) setDone(true)
        else setIdx(saved.length)
      }
    } catch { /* ignore */ }
  }, [])

  const item = EVAL_ITEMS[idx]
  const canAdvance = SCALES.every(s => current[s] !== undefined)

  const next = () => {
    if (!canAdvance) return
    const rating: Rating = {
      item_id: item.id,
      correctness: current.correctness!,
      completeness: current.completeness!,
      safety: current.safety!,
      comment: comment.trim(),
    }
    const updated = [...ratings, rating]
    setRatings(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setCurrent({})
    setComment("")
    if (idx + 1 >= EVAL_ITEMS.length) setDone(true)
    else setIdx(idx + 1)
  }

  const restart = () => {
    localStorage.removeItem(STORAGE_KEY)
    setRatings([])
    setCurrent({})
    setComment("")
    setIdx(0)
    setDone(false)
  }

  const exportJSON = () => {
    const payload = {
      study: "Meridian Clinician Evaluation",
      evaluator_role: currentUser.role,
      exported_at: new Date().toISOString(),
      ratings,
    }
    const href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2))
    const a = document.createElement("a")
    a.href = href
    a.download = "meridian-eval-ratings.json"
    a.click()
  }

  const flawedTotal = EVAL_ITEMS.filter(i => i.flawed).length
  const flaggedCount = ratings.filter(r => {
    const src = EVAL_ITEMS.find(i => i.id === r.item_id)
    return src?.flawed && r.correctness <= 2
  }).length

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Clinician Evaluation" }]} />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0B6BCB]/10 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-[#0B6BCB]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display">Clinician Evaluation</h1>
            <p className="text-sm text-muted-foreground">Rate AI answers for the Meridian research study.</p>
          </div>
        </div>

        {!done && (
          <div className="space-y-4">
            {/* Progress */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Item {idx + 1} of {EVAL_ITEMS.length}</p>
              <div className="h-1.5 rounded-full bg-[#E2E8F0] w-40 overflow-hidden">
                <div className="h-full rounded-full bg-[#0B6BCB]" style={{ width: `${(idx / EVAL_ITEMS.length) * 100}%` }} />
              </div>
            </div>

            {/* Question + answer */}
            <div className="rounded-2xl bg-card border border-border shadow-sm p-5 space-y-3">
              <p className="text-sm font-bold text-foreground">{item.question}</p>
              <div className="rounded-xl bg-background border border-border p-4">
                <p className="text-sm text-foreground leading-relaxed">{item.answer}</p>
              </div>
              <p className="text-xs text-muted-foreground">Source: {item.source_sop}</p>
            </div>

            {/* Scales */}
            <div className="rounded-2xl bg-card border border-border shadow-sm p-5 space-y-4">
              {SCALES.map(scale => (
                <div key={scale} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{SCALE_LABELS[scale]}</p>
                    <p className="text-xs text-muted-foreground">1 Unacceptable, 5 Excellent</p>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        onClick={() => setCurrent(prev => ({ ...prev, [scale]: v }))}
                        className={cn(
                          "py-2 rounded-lg border text-sm font-semibold transition-colors",
                          current[scale] === v
                            ? "bg-[#0B6BCB] border-[#0B6BCB] text-white"
                            : "bg-card border-border text-muted-foreground hover:border-[#0B6BCB]"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="space-y-1.5">
                <label htmlFor="eval-comment" className="text-sm font-medium text-foreground">Comment (optional)</label>
                <textarea
                  id="eval-comment"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-[#0B6BCB]"
                  placeholder="Anything you noticed"
                />
              </div>

              <button
                onClick={next}
                disabled={!canAdvance}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#0B6BCB] text-white hover:bg-[#0959AC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {idx + 1 >= EVAL_ITEMS.length ? "Finish" : "Next"} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Completion */}
        {done && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-card border border-border shadow-sm p-6 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-[#15803D] dark:text-green-400 mx-auto" />
              <h2 className="text-lg font-bold">Thank you</h2>
              <p className="text-sm text-muted-foreground">All {EVAL_ITEMS.length} items rated.</p>
            </div>

            {/* Summary table */}
            <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="p-3 text-left">Item</th>
                    <th className="p-3 text-left">Correctness</th>
                    <th className="p-3 text-left">Completeness</th>
                    <th className="p-3 text-left">Safety</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings.map((r, i) => (
                    <tr key={r.item_id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">Item {i + 1}</td>
                      <td className={cn("p-3 font-bold", r.correctness <= 2 ? "text-[#B91C1C] dark:text-red-400" : "text-foreground")}>{r.correctness}</td>
                      <td className="p-3">{r.completeness}</td>
                      <td className="p-3">{r.safety}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Reveal */}
            <div className="rounded-2xl bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 p-5 space-y-1">
              <h3 className="text-sm font-bold text-[#15803D] dark:text-green-400">Sensitivity result</h3>
              <p className="text-sm text-foreground">
                Items with known planted errors: {flaggedCount} of {flawedTotal} flagged low by you.
              </p>
              <p className="text-xs text-muted-foreground">
                An item counts as flagged when you rated its Correctness 2 or lower.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportJSON}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#0B6BCB] text-white hover:bg-[#0959AC] transition-colors flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Export ratings (JSON)
              </button>
              <button
                onClick={restart}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border text-foreground hover:bg-muted transition-colors"
              >
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
