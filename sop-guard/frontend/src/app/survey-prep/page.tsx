"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Survey Readiness was merged into the "Regulatory & Accreditation" page as a
// tab (both are "are we ready for/compliant with TJC/CMS/OSHA" - Survey
// Readiness was the TJC-flavored subset of Regulatory Mapping) - this route
// is kept only so old links/bookmarks still work.
export default function SurveyPrepRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/regulatory?tab=readiness")
  }, [router])
  return null
}
