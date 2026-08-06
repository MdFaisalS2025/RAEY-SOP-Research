"use client"

// Shared PHI soft-block guard - scans composer text against
// /api/privacy/scan (see backend/app/rag/phi_guard.py) and gates sending
// until the user redacts or explicitly confirms "Send anyway". Extracted
// from query/page.tsx so Bedside Lookup (which previously had no PHI gate
// at all) gets the same protection instead of a second hand-rolled copy.

import { useEffect, useRef, useState } from "react"

export interface PhiScanResult {
  has_phi: boolean
  types: string[]
  redacted_text: string
}

export function usePhiGuard(text: string) {
  const [phi, setPhi] = useState<PhiScanResult | null>(null)
  const [phiAcknowledged, setPhiAcknowledged] = useState(false)
  // Tracks which text `phi` was computed for, so a submit that races ahead
  // of the debounced scan can trigger a fresh synchronous check instead of
  // gating on a stale (or absent) result.
  const phiScannedTextRef = useRef<string>("")

  // Debounced scan of `text`. Skips very short input (no point scanning
  // "sepsis?") and clears the indicator when the box is emptied.
  useEffect(() => {
    // A new keystroke invalidates any prior acknowledgment - re-typing
    // after "Send anyway" re-gates on the new text.
    setPhiAcknowledged(false)
    const trimmed = text.trim()
    if (trimmed.length < 8) { setPhi(null); phiScannedTextRef.current = text; return }
    const t = setTimeout(() => {
      fetch("/api/privacy/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
        .then((r) => r.json())
        .then((d) => {
          setPhi({ has_phi: !!d.has_phi, types: d.types ?? [], redacted_text: d.redacted_text ?? text })
          phiScannedTextRef.current = text
        })
        .catch(() => setPhi(null))
    }, 400)
    return () => clearTimeout(t)
  }, [text])

  /** Ensures the returned result reflects the exact text about to be sent,
   * running a synchronous scan if the debounced background scan hasn't
   * caught up yet (e.g. a fast type-then-Enter). */
  async function scanForPhiBeforeSend(t: string): Promise<PhiScanResult | null> {
    if (phiScannedTextRef.current === t && phi) return phi
    try {
      const r = await fetch("/api/privacy/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      })
      const d = await r.json()
      const result = { has_phi: !!d.has_phi, types: d.types ?? [], redacted_text: d.redacted_text ?? t }
      setPhi(result)
      phiScannedTextRef.current = t
      return result
    } catch {
      // Scan failed - don't block sending on a network hiccup (advisory
      // guard, fail-open), but don't claim a clean result either.
      return null
    }
  }

  return { phi, phiAcknowledged, setPhiAcknowledged, scanForPhiBeforeSend }
}

/** Whether the Settings "Voice Input" toggle ("meridian-settings" in
 * localStorage) is on - that toggle previously had no consumer anywhere.
 * Defaults to on (matches the toggle's own default) if unset/unreadable. */
export function useVoiceEnabled(): boolean {
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("meridian-settings")
      if (stored) {
        const s = JSON.parse(stored)
        if (typeof s.voiceEnabled === "boolean") setVoiceEnabled(s.voiceEnabled)
      }
    } catch { /* ignore */ }
  }, [])
  return voiceEnabled
}
