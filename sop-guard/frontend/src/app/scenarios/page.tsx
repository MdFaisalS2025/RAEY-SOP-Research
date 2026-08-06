"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Target, CheckCircle2, AlertTriangle, XCircle, Clock,
  ArrowRight, RotateCcw, ArrowLeft, BookOpen, Eye, PenLine, Sparkles,
} from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"
import { toneChip } from "@/components/ui/tone"
import { useRole } from "@/lib/role-context"
import { Card } from "@/components/ui/card"

// ─── Types ────────────────────────────────────────────────────────────────────

type Grade = "correct" | "partial" | "wrong"

interface ScenarioOption {
  label: string
  grade: Grade
  explanation: string
}

interface ScenarioStep {
  question: string
  situation?: string
  citation: string
  options: ScenarioOption[]
}

interface Vital {
  label: string
  value: string
  abnormal?: boolean
}

interface Scenario {
  id: string
  title: string
  difficulty: "Moderate" | "High"
  sops: string[]
  minutes: number
  intro: string
  vitals: Vital[]
  steps: ScenarioStep[]
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  {
    id: "deteriorating-patient",
    title: "Deteriorating Patient",
    difficulty: "High",
    sops: ["ICU-SEP-002", "ICU-RR-006"],
    minutes: 5,
    intro: "Ward patient, NEWS2 was 3 this morning. Now: RR 26, SpO2 89%, BP 92/60, confused. NEWS2 = 8.",
    vitals: [
      { label: "RR", value: "26 /min", abnormal: true },
      { label: "SpO2", value: "89%", abnormal: true },
      { label: "BP", value: "92/60", abnormal: true },
      { label: "Mental state", value: "Confused", abnormal: true },
      { label: "NEWS2", value: "8", abnormal: true },
      { label: "NEWS2 (AM)", value: "3" },
    ],
    steps: [
      {
        question: "What is your first action?",
        citation: "ICU-RR-006: RRT activation criteria",
        options: [
          {
            label: "Recheck vitals in 30 minutes",
            grade: "wrong",
            explanation: "This delays care. ICU-RR-006 requires immediate action when NEWS2 reaches 7 or higher.",
          },
          {
            label: "Activate the Rapid Response Team",
            grade: "correct",
            explanation: "Correct per ICU-RR-006. NEWS2 of 8 meets the activation threshold. Any staff member may activate the RRT.",
          },
          {
            label: "Call the attending and wait",
            grade: "partial",
            explanation: "Escalation is the right instinct, but RRT criteria are already met. ICU-RR-006 does not require physician approval to activate.",
          },
          {
            label: "Give oxygen and observe",
            grade: "partial",
            explanation: "Oxygen is appropriate, but observation alone is not. ICU-RR-006 still requires RRT activation at NEWS2 of 7 or higher.",
          },
        ],
      },
      {
        question: "RRT arrives. Lactate is 4.2 mmol/L. What does the sepsis SOP require within the first hour?",
        situation: "The team suspects sepsis from a urinary source. Lactate result: 4.2 mmol/L.",
        citation: "ICU-SEP-002: 1-Hour Bundle, Steps 2-5",
        options: [
          {
            label: "Cultures, antibiotics, 30 mL/kg fluids, repeat lactate",
            grade: "correct",
            explanation: "Correct per ICU-SEP-002. Blood cultures before antibiotics, broad-spectrum antibiotics within 1 hour, 30 mL/kg crystalloid for hypotension or lactate of 4 or higher, then repeat lactate.",
          },
          {
            label: "CT scan first to find the source",
            grade: "wrong",
            explanation: "Not per protocol. ICU-SEP-002 requires bundle completion within 1 hour. Imaging must not delay cultures, antibiotics, or fluids.",
          },
          {
            label: "Wait for an ICU bed before treating",
            grade: "wrong",
            explanation: "Not per protocol. The 1-hour bundle starts at recognition, wherever the patient is. Delay is associated with increased mortality.",
          },
          {
            label: "Start vasopressors before fluids",
            grade: "wrong",
            explanation: "Not per protocol. ICU-SEP-002 Step 5 requires 30 mL/kg crystalloid first. Vasopressors follow if MAP stays below 65 mmHg.",
          },
        ],
      },
      {
        question: "After 30 mL/kg fluids, MAP is 58 mmHg. Next?",
        situation: "Fluid bolus complete. MAP 58 mmHg, lactate pending repeat.",
        citation: "ICU-SEP-002: Step 6, vasopressor initiation",
        options: [
          {
            label: "Start norepinephrine, titrate to MAP 65 or above",
            grade: "correct",
            explanation: "Correct per ICU-SEP-002 Step 6. Norepinephrine is first-line, started when MAP remains below 65 mmHg after fluids, titrated to MAP of 65 or higher.",
          },
          {
            label: "Give another 30 mL/kg fluid bolus",
            grade: "partial",
            explanation: "Further fluids may be considered, but the SOP requires vasopressors now that MAP remains below 65 mmHg after the initial 30 mL/kg.",
          },
          {
            label: "Start dopamine infusion",
            grade: "wrong",
            explanation: "Not per protocol. ICU-SEP-002 lists dopamine as not recommended first-line due to arrhythmia risk. Norepinephrine is first-line.",
          },
          {
            label: "Observe for 1 hour before escalating",
            grade: "wrong",
            explanation: "Not per protocol. Persistent MAP below 65 mmHg after fluids requires immediate vasopressor initiation per Step 6.",
          },
        ],
      },
    ],
  },
  {
    id: "high-alert-medication",
    title: "High-Alert Medication",
    difficulty: "Moderate",
    sops: ["PHARM-MED-007"],
    minutes: 5,
    intro: "Night shift, 02:30. You must start an insulin infusion for a patient with glucose 480 mg/dL. You are the only RN on the unit.",
    vitals: [
      { label: "Glucose", value: "480 mg/dL", abnormal: true },
      { label: "Order", value: "Insulin drip" },
      { label: "Time", value: "02:30" },
      { label: "Staffing", value: "Single RN" },
    ],
    steps: [
      {
        question: "Insulin is a high-alert medication. What does PHARM-MED-007 require before you start the drip?",
        citation: "PHARM-MED-007: Independent double-check requirement",
        options: [
          {
            label: "An independent double-check by a second qualified clinician",
            grade: "correct",
            explanation: "Correct per PHARM-MED-007. Insulin infusions require an independent double-check of drug, concentration, dose, rate, and patient before administration.",
          },
          {
            label: "Start now, document the check later",
            grade: "wrong",
            explanation: "Not per protocol. The double-check must happen before administration, not after.",
          },
          {
            label: "A verbal order confirmation is sufficient",
            grade: "wrong",
            explanation: "Not per protocol. PHARM-MED-007 prohibits administering high-alert medications on a verbal order alone.",
          },
          {
            label: "Self-check twice, carefully",
            grade: "partial",
            explanation: "Careful self-checking is good practice, but the SOP requires an independent check by a second person. One nurse checking twice does not qualify.",
          },
        ],
      },
      {
        question: "No second nurse is physically available on the unit. What does the protocol allow?",
        situation: "You are the only RN on the ward. The house supervisor and pharmacy are reachable by phone.",
        citation: "PHARM-MED-007: Single-clinician contingency",
        options: [
          {
            label: "Telephonic verification with the on-call pharmacist",
            grade: "correct",
            explanation: "Correct per PHARM-MED-007. When no second clinician is on site, the protocol permits a documented telephonic verification with pharmacy or the supervisor.",
          },
          {
            label: "Skip the double-check, it is an emergency",
            grade: "wrong",
            explanation: "Not per protocol. The double-check is mandatory for insulin infusions. The telephonic pathway exists for exactly this situation.",
          },
          {
            label: "Ask the ward clerk to verify the pump settings",
            grade: "wrong",
            explanation: "Not per protocol. The second checker must be a qualified clinician, not non-clinical staff.",
          },
          {
            label: "Delay the infusion until day shift arrives",
            grade: "partial",
            explanation: "Never bypass the check, but a multi-hour delay at glucose 480 mg/dL is unsafe. Use the telephonic verification pathway instead.",
          },
        ],
      },
      {
        question: "The drip is running. What must be documented?",
        citation: "PHARM-MED-007: Documentation requirements",
        options: [
          {
            label: "Both checkers, verification method, and administration record",
            grade: "correct",
            explanation: "Correct per PHARM-MED-007. Document the independent double-check form with both names, note the telephonic method, and complete the administration record.",
          },
          {
            label: "Only the administration time",
            grade: "wrong",
            explanation: "Not per protocol. The double-check itself must be documented, including who verified and how.",
          },
          {
            label: "Your own signature is enough",
            grade: "wrong",
            explanation: "Not per protocol. A single signature cannot evidence an independent double-check.",
          },
          {
            label: "The double-check form, signed by you for both",
            grade: "wrong",
            explanation: "Not per protocol. Signing for the remote verifier invalidates the record. Record their name and the telephonic method.",
          },
        ],
      },
    ],
  },
  {
    id: "transfusion-reaction",
    title: "Transfusion Reaction",
    difficulty: "Moderate",
    sops: ["BLOOD-TRANS-014"],
    minutes: 5,
    intro: "15 minutes into a packed red cell transfusion, the patient develops fever 38.9 C and rigors. Baseline temp was 37.0 C.",
    vitals: [
      { label: "Temp", value: "38.9 C", abnormal: true },
      { label: "Baseline temp", value: "37.0 C" },
      { label: "Symptoms", value: "Rigors", abnormal: true },
      { label: "Elapsed", value: "15 min" },
    ],
    steps: [
      {
        question: "What is the first action?",
        citation: "BLOOD-TRANS-014: Suspected reaction, first response",
        options: [
          {
            label: "Stop the transfusion immediately",
            grade: "correct",
            explanation: "Correct per BLOOD-TRANS-014. Stop the transfusion first, keep IV access open with normal saline, and assess the patient.",
          },
          {
            label: "Slow the infusion rate and monitor",
            grade: "wrong",
            explanation: "Not per protocol. Fever with rigors during transfusion requires stopping the unit, not slowing it. Continued exposure worsens hemolytic reactions.",
          },
          {
            label: "Give acetaminophen and continue",
            grade: "wrong",
            explanation: "Not per protocol. Premedicating through a possible reaction masks symptoms. The unit must be stopped first.",
          },
          {
            label: "Call the physician before touching the infusion",
            grade: "partial",
            explanation: "Notifying the physician is required, but stopping the transfusion comes first. Do not keep the unit running while you call.",
          },
        ],
      },
      {
        question: "Transfusion stopped, line kept open with saline. What comes next?",
        citation: "BLOOD-TRANS-014: Verification and notification steps",
        options: [
          {
            label: "Re-verify unit and patient ID, notify blood bank, send reaction workup",
            grade: "correct",
            explanation: "Correct per BLOOD-TRANS-014. Recheck the unit label against the patient wristband, notify the blood bank, and send the unit, tubing, and post-reaction samples for workup.",
          },
          {
            label: "Discard the unit in biohazard waste",
            grade: "wrong",
            explanation: "Not per protocol. The unit and tubing must be returned to the blood bank for investigation, never discarded.",
          },
          {
            label: "Restart the unit slowly once fever settles",
            grade: "wrong",
            explanation: "Not per protocol. A unit stopped for a suspected reaction is never restarted.",
          },
          {
            label: "Send samples but skip the ID recheck",
            grade: "partial",
            explanation: "The workup is right, but the clerical ID re-verification is mandatory. Mistransfusion from ID error is the most dangerous cause to exclude.",
          },
        ],
      },
      {
        question: "What must be documented for this event?",
        citation: "BLOOD-TRANS-014: Documentation requirements",
        options: [
          {
            label: "Vitals, stop time, symptoms, reaction report, blood bank notification",
            grade: "correct",
            explanation: "Correct per BLOOD-TRANS-014. Document pre- and post-reaction vitals, the time the unit was stopped, symptoms, the transfusion reaction report, and blood bank notification.",
          },
          {
            label: "A brief nursing note is sufficient",
            grade: "wrong",
            explanation: "Not per protocol. A formal transfusion reaction report is required in addition to nursing notes.",
          },
          {
            label: "Documentation can wait until the next shift",
            grade: "wrong",
            explanation: "Not per protocol. Reaction documentation and reporting are completed as part of the immediate response.",
          },
          {
            label: "Vitals and stop time only",
            grade: "partial",
            explanation: "Vitals and stop time are required, but incomplete. The reaction report and blood bank notification must also be documented.",
          },
        ],
      },
    ],
  },
]

// ─── Feedback config ─────────────────────────────────────────────────────────

const gradeConfig: Record<Grade, { label: string; box: string; text: string; icon: typeof CheckCircle2 }> = {
  correct: { label: "Correct", box: "bg-[#DCFCE7] dark:bg-green-500/10 border-[#BBF7D0] dark:border-green-500/30", text: "text-[#15803D] dark:text-green-400", icon: CheckCircle2 },
  partial: { label: "Partially correct", box: "bg-[#FEF3C7] dark:bg-amber-500/10 border-[#FDE68A] dark:border-amber-500/30", text: "text-[#B45309] dark:text-amber-400", icon: AlertTriangle },
  wrong: { label: "Not per protocol", box: "bg-[#FEE2E2] dark:bg-red-500/10 border-[#FECACA] dark:border-red-500/30", text: "text-[#B91C1C] dark:text-red-400", icon: XCircle },
}

const STORAGE_KEY = "meridian-scenario-scores"
const MODE_STORAGE_KEY = "meridian-practice-mode"

type BestScores = Record<string, number>
type PracticeMode = "guided" | "blind"

function loadScores(): BestScores {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
  } catch {
    return {}
  }
}

function loadPracticeMode(): PracticeMode {
  try {
    const saved = localStorage.getItem(MODE_STORAGE_KEY)
    return saved === "blind" ? "blind" : "guided"
  } catch {
    return "guided"
  }
}

// Key phrases worth checking for per scenario/step, used only as a fallback if a
// step's correct option text is too generic on its own. Kept short and specific.
const KEY_TERM_HINTS = ["rapid response", "blood cultures", "stop the transfusion"]

// Very lightweight keyword-overlap heuristic (not real NLP): pulls short, meaningful
// words/phrases out of the correct option's label and checks whether the user's own
// free-text answer mentioned them.
function extractKeywords(label: string): string[] {
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "with", "for", "of", "to", "in", "on",
    "before", "your", "first", "then", "at", "is", "are", "be", "by",
  ])
  const words = label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopwords.has(w))
  const hintMatches = KEY_TERM_HINTS.filter(h => label.toLowerCase().includes(h))
  return Array.from(new Set([...hintMatches, ...words]))
}

function compareFreeText(freeText: string, correctLabel: string): { matched: string[]; hasMatch: boolean } {
  const text = freeText.toLowerCase()
  const keywords = extractKeywords(correctLabel)
  const matched = keywords.filter(k => text.includes(k))
  return { matched, hasMatch: matched.length > 0 }
}

// Best-effort, fire-and-forget credit award. Never blocks the UI and ignores failures.
function awardScenarioCredits(userId: string, userName: string, activityTitle: string) {
  try {
    fetch("/api/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        user_name: userName,
        activity_type: "scenario_completed",
        activity_title: activityTitle,
        credits: 0.5,
      }),
    }).catch(() => {})
  } catch {
    // ignore - best effort only
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScenariosPage() {
  const { currentUser } = useRole()
  const [active, setActive] = useState<Scenario | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [picks, setPicks] = useState<number[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [bestScores, setBestScores] = useState<BestScores>({})
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("guided")

  // Blind recall mode: free-text answer captured before options are revealed.
  const [freeText, setFreeText] = useState("")
  const [revealed, setRevealed] = useState(false)
  const [freeTextByStep, setFreeTextByStep] = useState<Record<number, string>>({})

  useEffect(() => {
    setBestScores(loadScores())
    setPracticeMode(loadPracticeMode())
  }, [])

  const setMode = (mode: PracticeMode) => {
    setPracticeMode(mode)
    localStorage.setItem(MODE_STORAGE_KEY, mode)
  }

  const startScenario = (s: Scenario) => {
    setActive(s)
    setStepIdx(0)
    setPicks([])
    setSelected(null)
    setFinished(false)
    setFreeText("")
    setRevealed(practiceMode !== "blind" ? true : false)
    setFreeTextByStep({})
  }

  const exitScenario = () => {
    setActive(null)
    setFinished(false)
  }

  const revealOptions = () => {
    if (!active) return
    setFreeTextByStep(prev => ({ ...prev, [stepIdx]: freeText }))
    setRevealed(true)
  }

  const advance = () => {
    if (!active || selected === null) return
    const newPicks = [...picks, selected]
    setPicks(newPicks)
    setSelected(null)
    setFreeText("")
    if (stepIdx + 1 >= active.steps.length) {
      const score = newPicks.filter((p, i) => active.steps[i].options[p].grade === "correct").length
      const prev = loadScores()
      const best = Math.max(prev[active.id] ?? 0, score)
      const updated = { ...prev, [active.id]: best }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      setBestScores(updated)
      setFinished(true)
      awardScenarioCredits(currentUser.id, currentUser.name, active.title)
    } else {
      setStepIdx(stepIdx + 1)
      setRevealed(practiceMode !== "blind" ? true : false)
    }
  }

  const nextScenario = () => {
    if (!active) return
    const idx = SCENARIOS.findIndex(s => s.id === active.id)
    startScenario(SCENARIOS[(idx + 1) % SCENARIOS.length])
  }

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Breadcrumb items={[{ label: "Scenario Training" }]} />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Scenario Training</h1>
            <p className="text-sm text-muted-foreground">Practice decisions against this hospital&apos;s own protocols.</p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className={cn(toneChip.warning, "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm")}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Training simulation. Not a substitute for clinical judgment.</span>
        </div>

        {/* Practice mode toggle */}
        {!active && (
          <Card padding="sm" className="shadow-sm space-y-2">
            <p className="text-sm font-bold text-foreground">Practice mode</p>
            <p className="text-xs text-muted-foreground">
              Blind recall asks you to commit to your own judgment before seeing any options. Clinicians who state their answer first are less prone to automation bias.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setMode("guided")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors",
                  practiceMode === "guided"
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-card border-border text-muted-foreground hover:border-primary"
                )}
              >
                <Eye className="w-4 h-4" /> Guided
              </button>
              <button
                onClick={() => setMode("blind")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors",
                  practiceMode === "blind"
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-card border-border text-muted-foreground hover:border-primary"
                )}
              >
                <PenLine className="w-4 h-4" /> Blind recall
              </button>
            </div>
          </Card>
        )}

        {/* Scenario picker */}
        {!active && (
          <div className="grid md:grid-cols-3 gap-4">
            {SCENARIOS.map((s) => {
              const best = bestScores[s.id]
              const completed = best !== undefined && best > 0
              return (
                <button
                  key={s.id}
                  onClick={() => startScenario(s)}
                  className="text-left rounded-2xl bg-card border border-border shadow-sm p-5 space-y-3 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-foreground">{s.title}</h3>
                    {completed && (
                      <span className="flex items-center gap-1 text-xs text-[#15803D] dark:text-green-400 font-medium shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium border",
                      s.difficulty === "High"
                        ? toneChip.danger
                        : toneChip.warning
                    )}>
                      {s.difficulty}
                    </span>
                    {s.sops.map(id => (
                      <span key={id} className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border">
                        {id}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{s.intro}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~{s.minutes} min</span>
                    {completed && <span>Best: {best}/{s.steps.length}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* In-scenario */}
        {active && !finished && (
          <div className="space-y-4">
            {/* Progress + exit */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {active.steps.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      i < stepIdx ? "bg-[#16A34A]" : i === stepIdx ? "bg-primary" : "bg-[#E2E8F0]"
                    )}
                  />
                ))}
                <span className="text-xs text-muted-foreground ml-2">Step {stepIdx + 1} of {active.steps.length}</span>
              </div>
              <button onClick={exitScenario} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Exit
              </button>
            </div>

            {/* Situation panel */}
            <Card className="shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold">{active.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {active.steps[stepIdx].situation ?? active.intro}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {active.vitals.map(v => (
                  <div key={v.label} className="rounded-lg border border-border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">{v.label}</p>
                    <p className={cn("text-sm font-bold", v.abnormal ? "text-[#B91C1C] dark:text-red-400" : "text-foreground")}>
                      {v.value}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Question */}
            <Card className="shadow-sm space-y-3">
              <h3 className="text-sm font-bold">{active.steps[stepIdx].question}</h3>
              <div className="space-y-2">
                {active.steps[stepIdx].options.map((opt, i) => {
                  const isPicked = selected === i
                  const cfg = gradeConfig[opt.grade]
                  return (
                    <button
                      key={i}
                      disabled={selected !== null}
                      onClick={() => setSelected(i)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors",
                        selected === null
                          ? "bg-card border-border hover:border-primary hover:bg-primary/5"
                          : isPicked
                            ? cn(cfg.box, cfg.text, "font-medium")
                            : "bg-card border-border text-muted-foreground opacity-60"
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              {/* Feedback */}
              {selected !== null && (() => {
                const opt = active.steps[stepIdx].options[selected]
                const cfg = gradeConfig[opt.grade]
                const Icon = cfg.icon
                return (
                  <div className={cn("rounded-xl border p-4 space-y-2", cfg.box)}>
                    <p className={cn("text-sm font-bold flex items-center gap-1.5", cfg.text)}>
                      <Icon className="w-4 h-4" /> {cfg.label}
                    </p>
                    <p className="text-sm text-foreground">{opt.explanation}</p>
                    <div className="flex items-center justify-between">
                      <Link href="/library" className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> View SOP
                      </Link>
                      <button
                        onClick={advance}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors flex items-center gap-1.5"
                      >
                        {stepIdx + 1 >= active.steps.length ? "Finish" : "Next step"}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })()}
            </Card>
          </div>
        )}

        {/* End screen */}
        {active && finished && (() => {
          const score = picks.filter((p, i) => active.steps[i].options[p].grade === "correct").length
          const deviations = picks
            .map((p, i) => ({ step: active.steps[i], opt: active.steps[i].options[p], idx: i }))
            .filter(d => d.opt.grade === "wrong")
          return (
            <div className="space-y-4">
              <Card padding="lg" className="shadow-sm text-center space-y-2">
                <p className="text-sm text-muted-foreground">{active.title}</p>
                <p className={cn(
                  "text-4xl font-bold",
                  score === active.steps.length ? "text-[#15803D] dark:text-green-400" : score > 0 ? "text-[#B45309] dark:text-amber-400" : "text-[#B91C1C] dark:text-red-400"
                )}>
                  {score} / {active.steps.length}
                </p>
                <p className="text-sm text-muted-foreground">correct decisions</p>
              </Card>

              {/* Per-step recap */}
              <Card className="shadow-sm space-y-3">
                <h3 className="text-sm font-bold">Step recap</h3>
                {active.steps.map((step, i) => {
                  const opt = step.options[picks[i]]
                  const cfg = gradeConfig[opt.grade]
                  const Icon = cfg.icon
                  return (
                    <div key={i} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                      <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", cfg.text)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{step.question}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Your pick: {opt.label}</p>
                        <p className="text-xs text-primary mt-0.5">{step.citation}</p>
                      </div>
                    </div>
                  )
                })}
              </Card>

              {/* Deviations */}
              {deviations.length > 0 && (
                <div className={cn(toneChip.danger, "rounded-2xl p-5 space-y-2")}>
                  <h3 className="text-sm font-bold text-[#B91C1C] dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> Deviations from protocol
                  </h3>
                  {deviations.map(d => (
                    <p key={d.idx} className="text-sm text-foreground">
                      Step {d.idx + 1}: {d.opt.explanation}
                    </p>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => startScenario(active)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" /> Retry
                </button>
                <button
                  onClick={nextScenario}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  Next scenario <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={exitScenario}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              </div>
            </div>
          )
        })()}
      </div>
    </AppShell>
  )
}
