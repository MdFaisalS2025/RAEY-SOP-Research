"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Impact Map was merged into the "SOP Conflicts & Impact" page (same
// underlying entity-graph conflict data, filtered per-SOP) - this route is
// kept only so old links/bookmarks still land somewhere useful.
export default function ImpactMapRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/conflict-resolution?tab=impact")
  }, [router])
  return null
}
