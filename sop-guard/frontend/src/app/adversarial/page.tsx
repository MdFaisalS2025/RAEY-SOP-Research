"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Adversarial was merged into the "Evaluation" page as a tab (both are AI-QA
// views) - this route is kept only so old links/bookmarks still work.
export default function AdversarialRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/evaluation?tab=adversarial")
  }, [router])
  return null
}
