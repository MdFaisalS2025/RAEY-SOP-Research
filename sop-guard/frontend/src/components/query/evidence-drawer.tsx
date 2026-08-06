"use client"

import { BookOpen, ExternalLink, Search } from "lucide-react"
import { SlideOver } from "@/components/ui/slide-over"
import { EvidencePanel } from "@/components/query/evidence-panel"
import { toast } from "@/components/ui/use-toast"
import {
  uptodateSearchUrl, pubmedSearchUrl, openInOpenEvidence, POLICYTECH_BASE_URL,
} from "@/lib/external-evidence-links"

interface QueryEntities {
  drugs?: string[]
  conditions?: string[]
}

/** The four external-tool hand-offs (Phase Q4.4) - moved here from every
 * answer's overflow menu, since they belong next to the other external
 * literature this drawer already shows rather than on every message. */
function ExternalHandoffs({ queryText }: { queryText: string }) {
  const links: { key: string; label: string; icon: typeof Search; onClick: () => void }[] = [
    { key: "uptodate", label: "Look up in UpToDate", icon: Search, onClick: () => window.open(uptodateSearchUrl(queryText), "_blank", "noopener,noreferrer") },
    { key: "pubmed", label: "Search PubMed", icon: Search, onClick: () => window.open(pubmedSearchUrl(queryText), "_blank", "noopener,noreferrer") },
    { key: "openevidence", label: "Open in OpenEvidence", icon: ExternalLink, onClick: () => openInOpenEvidence(queryText, (msg) => toast({ description: msg, variant: "info" })) },
    ...(POLICYTECH_BASE_URL ? [{ key: "policytech", label: "Open PolicyTech Portal", icon: ExternalLink, onClick: () => window.open(POLICYTECH_BASE_URL, "_blank", "noopener,noreferrer") }] : []),
  ]
  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Look up this question elsewhere</p>
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <button
            key={l.key}
            onClick={l.onClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <l.icon className="w-3.5 h-3.5" />
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
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
      <ExternalHandoffs queryText={queryText} />
    </SlideOver>
  )
}
