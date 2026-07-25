import { useEffect, useRef } from "react"

/**
 * Focus-on-open, focus-restore-on-close, and Escape-to-close for a modal.
 * Extracted from components/ui/slide-over.tsx, the one dialog in this app
 * that already got this right - every other modal (feedback, override,
 * the inline New Proposal modal) only tracked a `mounted` flag and had
 * none of this. No full Tab-cycling focus trap here either, matching
 * slide-over's tradeoff: a backdrop with `aria-modal` + blocked pointer
 * events covers the practical gap without the added complexity.
 *
 * Usage: pass a ref to the element that should receive focus when the
 * dialog opens (usually the close button, or the first field for a form
 * modal).
 */
export function useDialogA11y(open: boolean, onClose: () => void, focusRef: React.RefObject<HTMLElement>) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement
      focusRef.current?.focus()
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus()
      previouslyFocusedRef.current = null
    }
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose])
}
