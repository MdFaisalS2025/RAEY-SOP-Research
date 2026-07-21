"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, Square, X, Check, AlertTriangle, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceRecorderProps {
  onTranscript: (text: string) => void
}

// Check once if Speech Recognition is available
function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
}

export function VoiceRecorder({ onTranscript }: VoiceRecorderProps) {
  const [state, setState] = useState<"idle" | "starting" | "listening" | "confirming">("idle")
  const [seconds, setSeconds] = useState(0)
  const [transcript, setTranscript] = useState("")
  const [liveText, setLiveText] = useState("")
  const [isBrowserSpeech, setIsBrowserSpeech] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recRef = useRef<any>(null)
  const accumulatedRef = useRef("")
  const userStoppedRef = useRef(false)

  // Check support on mount
  useEffect(() => {
    setSupported(!!getSpeechRecognition())
  }, [])

  // Timer
  useEffect(() => {
    if (state === "listening") {
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state])

  // Cleanup
  useEffect(() => () => { destroyRecognition() }, [])

  function destroyRecognition() {
    if (recRef.current) {
      try { recRef.current.onend = null; recRef.current.onresult = null; recRef.current.onerror = null; recRef.current.abort() } catch {}
      recRef.current = null
    }
  }

  function createAndStartRecognition() {
    const SR = getSpeechRecognition()
    if (!SR) return false

    destroyRecognition()

    const rec = new SR()
    rec.lang = "en-US"
    rec.interimResults = true
    rec.continuous = true
    rec.maxAlternatives = 1
    recRef.current = rec

    rec.onresult = (e: any) => {
      let final = ""
      let interim = ""
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) {
          final += r[0].transcript + " "
        } else {
          interim += r[0].transcript
        }
      }
      if (final.trim()) accumulatedRef.current = final.trim()
      setLiveText((final + interim).trim())
    }

    rec.onerror = (e: any) => {
      // Ignore no-speech and aborted - these are normal
      if (e.error === "no-speech" || e.error === "aborted") return

      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        destroyRecognition()
        setError("Microphone blocked. Click the camera/mic icon in the address bar to allow access, then try again.")
        setState("idle")
        return
      }

      if (e.error === "network") {
        destroyRecognition()
        setError("Speech recognition requires internet in Chrome. Check your connection.")
        setState("idle")
        return
      }

      // Other errors: just log, don't crash
      console.warn("Speech error:", e.error)
    }

    rec.onend = () => {
      // If user pressed stop, go to confirmation
      if (userStoppedRef.current) {
        const text = accumulatedRef.current || liveText
        recRef.current = null
        goToConfirmation(text)
        return
      }

      // Otherwise Chrome killed it (timeout, no-speech, etc.)
      // Just restart silently - this is the key fix
      if (recRef.current && state === "listening") {
        try {
          rec.start()
        } catch {
          // Can't restart - go to confirmation with whatever we have
          const text = accumulatedRef.current
          recRef.current = null
          goToConfirmation(text)
        }
      }
    }

    try {
      rec.start()
      return true
    } catch {
      return false
    }
  }

  function goToConfirmation(text: string) {
    const cleaned = text.trim()
    if (cleaned) {
      setTranscript(cleaned)
      setIsBrowserSpeech(true)
    } else {
      setTranscript("What are the steps for sepsis management?")
      setIsBrowserSpeech(false)
    }
    setState("confirming")
  }

  const handleMicClick = useCallback(async () => {
    if (state === "listening") {
      // STOP recording
      userStoppedRef.current = true
      if (recRef.current) {
        try { recRef.current.stop() } catch {}
      } else {
        goToConfirmation(accumulatedRef.current)
      }
      return
    }

    // START recording
    setError(null)
    setLiveText("")
    accumulatedRef.current = ""
    userStoppedRef.current = false
    setState("starting")

    if (!supported) {
      setError("Voice input requires Chrome or Edge browser.")
      setState("idle")
      return
    }

    // Request microphone permission first (this triggers the browser prompt)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Got permission - stop the stream immediately (we just needed permission)
      stream.getTracks().forEach(t => t.stop())
    } catch {
      setError("Microphone access denied. Allow microphone in your browser settings.")
      setState("idle")
      return
    }

    // Now start speech recognition (permission already granted)
    const started = createAndStartRecognition()
    if (started) {
      setState("listening")
    } else {
      setError("Could not start speech recognition. Try refreshing the page.")
      setState("idle")
    }
  }, [state, supported])

  const confirm = () => {
    if (transcript.trim()) onTranscript(transcript.trim())
    setState("idle")
    setLiveText("")
    setTranscript("")
  }

  const cancel = () => {
    userStoppedRef.current = true
    destroyRecognition()
    setState("idle")
    setTranscript("")
    setLiveText("")
    setError(null)
  }

  const retryRecording = () => {
    cancel()
    setTimeout(() => handleMicClick(), 300)
  }

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`

  return (
    <div className="relative">
      {/* Mic button */}
      <button
        type="button"
        onClick={handleMicClick}
        disabled={state === "starting"}
        className={cn(
          "relative inline-flex items-center justify-center w-9 h-9 rounded-full transition-all shrink-0",
          state === "listening" ? "bg-red-500/20 text-red-400"
          : state === "starting" ? "bg-amber-500/20 text-amber-400 animate-pulse"
          : "text-muted-foreground hover:bg-card hover:text-foreground"
        )}
        title={state === "idle" ? "Start voice input" : state === "listening" ? "Stop and use transcript" : "Starting..."}
        aria-label={state === "idle" ? "Start voice input" : state === "listening" ? "Stop and use transcript" : "Starting voice input"}
      >
        {state === "listening" && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-500"
            animate={{ scale: [1, 1.15, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        {state === "listening" ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      {/* Listening indicator */}
      <AnimatePresence>
        {state === "listening" && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full mb-3 right-0 flex flex-col items-end gap-1.5 z-50"
          >
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card border border-red-500/30 shadow-lg whitespace-nowrap">
              <div className="flex items-end gap-[3px] h-4">
                {[0, 1, 2, 3, 4].map(i => (
                  <motion.div
                    key={i}
                    className="w-[3px] bg-red-400 rounded-full"
                    animate={{ height: [3, 14, 3] }}
                    transition={{ duration: 0.5 + i * 0.12, repeat: Infinity, repeatType: "reverse" }}
                  />
                ))}
              </div>
              <span className="font-mono text-red-400 text-sm tabular-nums">{fmt(seconds)}</span>
              <span className="text-xs text-muted-foreground">{liveText ? "Hearing you..." : "Speak now..."}</span>
              <button onClick={(e) => { e.stopPropagation(); cancel() }} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Cancel">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {liveText && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="px-3 py-2 rounded-xl bg-card border border-border shadow-lg text-sm max-w-[320px]">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Live transcript</p>
                <p className="text-foreground">{liveText}</p>
              </motion.div>
            )}

            <span className="text-[10px] text-amber-500/60">No patient identifiers.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && state === "idle" && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-full mb-3 right-0 z-50 max-w-[320px]">
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-card border border-red-500/30 shadow-lg text-xs text-red-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} aria-label="Dismiss error" className="p-0.5 hover:bg-muted rounded shrink-0"><X className="w-3 h-3" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation modal */}
      <AnimatePresence>
        {state === "confirming" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={cancel}>
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-2xl"
              onClick={e => e.stopPropagation()}>

              <h3 className="text-lg font-semibold mb-1">Review Transcript</h3>
              {isBrowserSpeech ? (
                <p className="text-xs text-teal-600 dark:text-teal-400 mb-3">Transcribed from your microphone. Edit if needed.</p>
              ) : (
                <p className="text-xs text-amber-500 mb-3">No speech was detected. Edit this sample question or try again.</p>
              )}

              <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={3} autoFocus
                className="w-full p-3 rounded-xl bg-muted dark:bg-[#11191b] border border-border text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/50 mb-4" />

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs mb-4">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Do not include patient names or identifiers.</span>
              </div>

              <div className="flex justify-between">
                <button onClick={retryRecording}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> Try Again
                </button>
                <div className="flex gap-2">
                  <button onClick={cancel}
                    className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button onClick={confirm} disabled={!transcript.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-white transition-colors">
                    <Check className="w-4 h-4" /> Use This
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
