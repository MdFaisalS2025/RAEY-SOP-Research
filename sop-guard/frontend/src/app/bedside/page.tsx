"use client"

// Bedside Lookup - a large-type, voice-first single-question interface for
// use at the point of care. Runs the exact same MeridianPipeline as Ask
// Meridian (POST /api/query) - every defect here was client-side: answers
// were truncated to 4 sentences, a regex fabricated a "confirmed value"
// chip that was never a real verification, citations were scraped with a
// brittle "Source:" regex instead of using the real inline_citations the
// backend already returns, there was no PHI gate, no auth guard, and no
// way to cancel an in-flight request or the voice it was about to speak.

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Volume2, VolumeX, AlertTriangle, Loader2, Square, ShieldAlert } from "lucide-react"
import AppShell from "@/components/layout/app-shell"
import { SafetyNote } from "@/components/ui/safety-note"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { VoiceRecorder } from "@/components/voice/voice-recorder"
import { AnswerRenderer } from "@/components/query/answer-renderer"
import { SopSourcePanel } from "@/components/sop/sop-source-panel"
import { usePhiGuard, useVoiceEnabled } from "@/lib/use-phi-guard"
import { mapCitations } from "@/lib/citations"
import type { InlineCitation } from "@/components/query/citation-chip"

const QUICK_QUERIES = [
  "Sepsis 1 hour bundle",
  "Maximum norepinephrine dose",
  "Rapid response criteria",
  "When to hold insulin",
  "Transfusion reaction steps",
]

interface NumericVerification {
  claims_total: number
  supported: number
  unsupported: string[]
  all_grounded: boolean
}

interface BedsideAnswer {
  text: string
  citations: InlineCitation[]
  numericVerification: NumericVerification | null
  hasConflict: boolean
}

export default function BedsidePage() {
  const [transcript, setTranscript] = useState("")
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<BedsideAnswer | null>(null)
  // Separate from `answer` on purpose: a fetch failure used to render
  // through the exact same card as a real cited answer (and could be read
  // aloud by speech synthesis in the same voice as real guidance) -
  // indistinguishable from a genuine result at the bedside.
  const [error, setError] = useState<string | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [sourceCitation, setSourceCitation] = useState<InlineCitation | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const voiceEnabled = useVoiceEnabled()
  const { phi, phiAcknowledged, setPhiAcknowledged, scanForPhiBeforeSend } = usePhiGuard(transcript)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("meridian-bedside-audio")
      if (saved === "off") setAudioEnabled(false)
    } catch { /* ignore */ }
  }, [])

  // Abort any in-flight request and stop the device talking when the page
  // is left mid-answer - previously neither happened, so exiting mid-query
  // left a stray request racing to update unmounted state, and exiting
  // mid-speech left the device narrating the previous answer on whatever
  // page came next.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      window.speechSynthesis?.cancel()
    }
  }, [])

  const toggleAudio = () => {
    setAudioEnabled((prev) => {
      const next = !prev
      try { localStorage.setItem("meridian-bedside-audio", next ? "on" : "off") } catch { /* ignore */ }
      if (!next) window.speechSynthesis?.cancel()
      return next
    })
  }

  const stopAudio = () => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  const runQuery = async (q: string, skipPhiGate = false) => {
    const question = q.trim()
    if (!question || loading) return

    if (!skipPhiGate) {
      const result = await scanForPhiBeforeSend(question)
      if (result?.has_phi) return // amber warning + Send-anyway stays visible
    }

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setAnswer(null)
    setError(null)
    stopAudio()
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const data = await res.json()
      const text: string = data.answer ?? "This information is not covered in the available SOPs."
      const bedsideAnswer: BedsideAnswer = {
        text,
        citations: mapCitations(data.inline_citations),
        numericVerification: data.numeric_verification ?? null,
        hasConflict: Boolean(data.sop_conflicts?.length),
      }
      setAnswer(bedsideAnswer)

      if (audioEnabled && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text.replace(/\[\d+\]/g, "").slice(0, 600))
        utterance.rate = 0.95
        utterance.onend = () => setSpeaking(false)
        setSpeaking(true)
        window.speechSynthesis.speak(utterance)
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return
      setError("Could not reach the SOP database. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCitationClick = (n: number) => {
    const citation = answer?.citations.find((c) => c.number === n)
    if (citation?.is_external && citation.url) {
      window.open(citation.url, "_blank", "noopener,noreferrer")
      return
    }
    if (citation?.sop_id) setSourceCitation(citation)
  }

  const chromeActions = (
    <button
      onClick={toggleAudio}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors px-2 py-1.5"
    >
      {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      <span className="hidden sm:inline">{audioEnabled ? "Audio on" : "Audio off"}</span>
    </button>
  )

  return (
    <AppShell chrome="minimal" chromeActions={chromeActions}>
      <div className="flex flex-col items-center px-6 py-10 max-w-2xl mx-auto w-full">
        <h1 className="sr-only">Bedside Lookup</h1>

        <form
          onSubmit={(e) => { e.preventDefault(); runQuery(transcript) }}
          className="w-full flex items-center gap-2 mb-6"
        >
          <input
            aria-label="Ask a clinical question"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Ask a clinical question"
            className="flex-1 text-2xl px-4 py-4 rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
          {voiceEnabled && (
            <VoiceRecorder
              onTranscript={(t) => {
                setTranscript(t)
                runQuery(t)
              }}
            />
          )}
          <Button className="px-6 rounded-xl disabled:opacity-50 font-medium transition-colors" type="submit"
            disabled={loading || !transcript.trim()}>
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Ask"}
          </Button>
        </form>

        {phi?.has_phi && !phiAcknowledged && (
          <div className="w-full mb-6 px-4 py-3 rounded-xl bg-warn-soft border border-warn-soft-border flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-warn-soft-fg shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warn-soft-fg">Possible patient identifier detected</p>
              <p className="text-xs text-muted-foreground mt-0.5">Remove any patient names or identifiers before sending, or send anyway.</p>
            </div>
            <button
              onClick={() => { setPhiAcknowledged(true); runQuery(transcript, true) }}
              className="shrink-0 text-xs font-medium text-warn-soft-fg hover:underline"
            >
              Send anyway
            </button>
          </div>
        )}

        <div className="w-full flex flex-wrap gap-2 justify-center mb-8">
          {QUICK_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => { setTranscript(q); runQuery(q) }}
              className="text-base px-4 py-3 rounded-xl bg-card border border-border text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors shadow-sm"
            >
              {q}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full bg-card border border-danger-soft-border rounded-2xl shadow-sm"
            >
              <ErrorState message={error} onRetry={() => runQuery(transcript)} />
            </motion.div>
          )}
          {answer && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full bg-card border border-border rounded-2xl shadow-sm p-6"
            >
              {answer.hasConflict && (
                <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-danger-soft border border-danger-soft-border rounded-lg text-danger-soft-fg font-medium text-lg">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  Conflicting guidance detected. Verify with your charge nurse.
                </div>
              )}

              {/* Large bedside type via a scoped wrapper (descendant
                  selectors bump AnswerRenderer's internal text sizes)
                  rather than truncating the answer to fit a smaller card -
                  the whole grounded answer is shown, never just the first
                  few sentences. */}
              <div className="[&_p]:text-xl [&_li]:text-xl [&_p]:leading-relaxed [&_li]:leading-relaxed">
                <AnswerRenderer text={answer.text} citations={answer.citations} onCitationClick={handleCitationClick} animate={false} />
              </div>

              {/* Real numeric verification (verifier/numeric_verifier.py) -
                  not a regex guessing at "confirmed" values. Quiet when
                  every numeric claim was grounded; only speaks up when one
                  wasn't. */}
              {answer.numericVerification && answer.numericVerification.claims_total > 0 && (
                <div className={`mt-4 px-4 py-2.5 rounded-lg text-sm font-medium ${answer.numericVerification.all_grounded ? "bg-ok-soft text-ok-soft-fg" : "bg-warn-soft text-warn-soft-fg"}`}>
                  {answer.numericVerification.all_grounded
                    ? "All dose/threshold values verified against the SOP."
                    : "A value in this answer could not be confirmed against the SOP - verify directly."}
                </div>
              )}

              {speaking && (
                <button
                  onClick={stopAudio}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-warn-soft-fg bg-warn-soft border border-warn-soft-border rounded-lg px-4 py-2"
                >
                  <Square className="w-4 h-4 fill-current" /> Stop audio
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="text-center py-4">
        <SafetyNote />
      </footer>

      <SopSourcePanel citation={sourceCitation} onClose={() => setSourceCitation(null)} />
    </AppShell>
  )
}
