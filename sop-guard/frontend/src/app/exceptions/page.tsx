"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Exceptions was merged into the "Deviations & Incidents" page as a tab
// (both cover practice diverging from SOP - after the fact vs. in the
// moment for a documented reason) - this route is kept only so old
// links/bookmarks still work.
export default function ExceptionsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/incidents?tab=exceptions")
  }, [router])
  return null
}
