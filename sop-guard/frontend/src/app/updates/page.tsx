"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// SOP Update Requests was an early prototype of the same
// draft/review/approved workflow the "Proposals" governance page now
// covers in full (multi-stage review, evidence, committee vote, legal
// review) - this route is kept only so old links/bookmarks still work.
export default function UpdatesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/proposals")
  }, [router])
  return null
}
