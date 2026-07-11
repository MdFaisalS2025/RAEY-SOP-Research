"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Expiry was merged into the "Compliance" page as a tab ("Upcoming & Overdue
// Reviews" - same underlying question as Acknowledgments, different lens)
// - this route is kept only so old links/bookmarks still work.
export default function ExpiryRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/compliance?tab=reviews")
  }, [router])
  return null
}
