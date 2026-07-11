"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Learning & Credits was cut: it duplicated Training's exact same three
// activity types (scenario_completed, sop_reviewed, committee_participation)
// as a gamified leaderboard layer, wasn't linked from primary nav, and its
// own disclaimer noted credits are "illustrative, not accredited." This
// route is kept only so old links/bookmarks still work.
export default function LearningRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/training")
  }, [router])
  return null
}
