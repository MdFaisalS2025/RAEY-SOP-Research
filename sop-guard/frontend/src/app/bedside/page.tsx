"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, MicOff, Volume2, VolumeX, X, AlertTriangle, Loader2 } from "lucide-react"
import { SafetyNote } from "@/components/ui/safety-note"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const QUICK_QUERIES = [
  "Sepsis 1 hour bundle",
  "Maximum norepinephrine dose",
  "Rapid response criteria",
  "When to hold insulin",
  "Transfusion reaction steps",
]

interface BedsideAnswer {
  answerText: string
  keyValue: string | null
  sourceSop: string
  hasConflict: boolean
}

function extractKeyValue(text: string): string | null {
  const match = text.match(/\b(maximum|minimum|target|threshold)[^.\n]{0,80}?\d[^.\n]{0,40}/i)
  return match ? match[0].trim() : null
}

function firstSentences(text: string, count: number): string {
  const clean = text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "")
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 3)
  return sentences.slice(0, count).join(" ")
}

export default function BedsidePage() {
  const [transcript, setTranscript] = useState("")
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<BedsideAnswer | null>(null)
  // Separate from `answer` on purpose: a fetch failure used to render
  // through the exact same card as a real cited answer (and could be
  // read aloud by speech synthesis in the same voice as real guidance) -
  // indistinguishable from a genuine result at the bedside. Errors now
  // get their own visually distinct treatment and are never spoken.
  const [error, setError] = useState<string | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("meridian-bedside-audio")
      if (saved === "off") setAudioEnabled(false)
    } catch { /* ignore */ }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SpeechRecognition) {
      setVoiceSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = "en-US"
      recognition.onresult = (event: any) => {
        let text = ""
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript
        }
        setTranscript(text)
      }
      recognition.onend = () => setListening(false)
      recognition.onerror = () => setListening(false)
      recognitionRef.current = recognition
    }
  }, [])

  const toggleAudio = () => {
    setAudioEnabled(prev => {
      const next = !prev
      try { localStorage.setItem("meridian-bedside-audio", next ? "on" : "off") } catch { /* ignore */ }
      if (!next) window.speechSynthesis?.cancel()
      return next
    })
  }

  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      setTranscript("")
      setAnswer(null)
      recognitionRef.current.start()
      setListening(true)
    }
  }

  const stopAudio = () => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }

  const runQuery = async (q: string) => {
    const question = q.trim()
    if (!question || loading) return
    setLoading(true)
    setAnswer(null)
    setError(null)
    stopAudio()
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
      })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const data = await res.json()
      const text: string = data.answer ?? "This information is not covered in the available SOPs."
      const sourceMatch = text.match(/Source:\s*(.+)$/im)
      const bedsideAnswer: BedsideAnswer = {
        answerText: firstSentences(text, 4),
        keyValue: extractKeyValue(text),
        sourceSop: sourceMatch ? sourceMatch[1].trim() : (data.citations?.[0] ?? ""),
        hasConflict: Boolean(data.sop_conflicts?.length),
      }
      setAnswer(bedsideAnswer)

      if (audioEnabled && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(bedsideAnswer.answerText.slice(0, 400))
        utterance.rate = 0.95
        utterance.onend = () => setSpeaking(false)
        setSpeaking(true)
        window.speechSynthesis.speak(utterance)
      }
    } catch {
      setError("Could not reach the SOP database. Check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">Bedside Lookup</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleAudio}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[#0B6BCB] transition-colors"
          >
            {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            {audioEnabled ? "Audio on" : "Audio off"}
          </button>
          <Link href="/query" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#0B6BCB] transition-colors">
            <X className="w-5 h-5" /> Exit
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-10 max-w-2xl mx-auto w-full">
        {voiceSupported ? (
          <button
            onClick={toggleListening}
            className={cn(
              "w-28 h-28 rounded-full flex items-center justify-center shadow-md transition-colors mb-6",
              listening ? "bg-[#B91C1C] animate-pulse" : "bg-[#0B6BCB] hover:bg-[#0959AC]"
            )}
            aria-label={listening ? "Stop listening" : "Start listening"}
          >
            {listening ? <MicOff className="w-12 h-12 text-white" /> : <Mic className="w-12 h-12 text-white" />}
          </button>
        ) : null}

        <p className="text-sm text-muted-foreground mb-4">
          {voiceSupported ? (listening ? "Listening..." : "Tap to speak, or type below") : "Voice input is not available on this device"}
        </p>

        <form
          onSubmit={e => { e.preventDefault(); runQuery(transcript) }}
          className="w-full flex gap-2 mb-8"
        >
          <input
            aria-label="Ask a clinical question"
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder="Ask a clinical question"
            className="flex-1 text-2xl px-4 py-4 rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-[#0B6BCB]/40 focus:border-[#0B6BCB]"
          />
          <Button className="px-6 rounded-xl disabled:opacity-50 font-medium transition-colors" type="submit"
            disabled={loading || !transcript.trim()}>
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Ask"}
          </Button>
        </form>

        <div className="w-full flex flex-wrap gap-2 justify-center mb-8">
          {QUICK_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => { setTranscript(q); runQuery(q) }}
              className="text-base px-4 py-3 rounded-xl bg-card border border-border text-foreground hover:border-[#0B6BCB]/40 hover:bg-[#0B6BCB]/5 transition-colors shadow-sm"
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
              className="w-full bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 rounded-2xl shadow-sm p-6 flex items-start gap-3"
            >
              <AlertTriangle className="w-6 h-6 text-[#B91C1C] dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-lg font-semibold text-[#B91C1C] dark:text-red-400 mb-1">Couldn't get an answer</p>
                <p className="text-base text-foreground/90">{error}</p>
                <button
                  onClick={() => runQuery(transcript)}
                  className="mt-3 px-4 py-2 rounded-lg bg-[#B91C1C] dark:bg-red-500/20 text-white dark:text-red-300 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Try again
                </button>
              </div>
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
                <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-[#FEE2E2] dark:bg-red-500/10 border border-[#FECACA] dark:border-red-500/30 rounded-lg text-[#B91C1C] dark:text-red-400 font-medium text-lg">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  Conflicting guidance detected. Verify with your charge nurse.
                </div>
              )}

              {answer.keyValue && (
                <div className="mb-4 px-4 py-3 bg-[#DCFCE7] dark:bg-green-500/10 border border-[#BBF7D0] dark:border-green-500/30 rounded-lg text-[#15803D] dark:text-green-400 text-xl font-semibold">
                  {answer.keyValue}
                </div>
              )}

              <p className="text-xl leading-relaxed text-foreground mb-4">
                {answer.answerText}
              </p>

              {answer.sourceSop && (
                <p className="text-sm text-muted-foreground">Source: {answer.sourceSop}</p>
              )}

              {speaking && (
                <button
                  onClick={stopAudio}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#B45309] dark:text-amber-400 bg-[#FEF3C7] dark:bg-amber-500/10 border border-[#FDE68A] dark:border-amber-500/30 rounded-lg px-4 py-2"
                >
                  <VolumeX className="w-4 h-4" /> Stop audio
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="text-center py-4">
        <SafetyNote />
      </footer>
    </div>
  )
}
