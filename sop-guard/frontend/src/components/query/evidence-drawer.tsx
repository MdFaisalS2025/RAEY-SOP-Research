"use client"

import { BookOpen } from "lucide-react"
import { SlideOver } from "@/components/ui/slide-over"
import { EvidencePanel } from "@/components/query/evidence-panel"

interface QueryEntities {
  drugs?: string[]
  conditions?: string[]
}

export function EvidenceDrawer({
  open,
  onClose,
  entities,
  queryText,
}: {
  open: boolean
  onClose: () => void
  entities: QueryEntities
  queryText: string
}) {
  return (
    <SlideOver open={open} onClose={onClose} title="External Evidence" icon={BookOpen}
      subtitle="Clinical literature and guidelines for reference, not clinical guidance.">
      <EvidencePanel entities={entities} queryText={queryText} variant="bare" />
    </SlideOver>
  )
}
