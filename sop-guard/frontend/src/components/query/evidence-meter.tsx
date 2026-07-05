"use client"

interface EvidenceLike {
  alignment_status: string
}

export function EvidenceMeter({ items }: { items: EvidenceLike[] }) {
  const total = items.length
  if (total === 0) return null

  const aligned = items.filter((e) => e.alignment_status === "aligned").length
  const partial = items.filter((e) => e.alignment_status === "partially_aligned").length
  const conflict = items.filter(
    (e) => e.alignment_status === "conflict_detected" || e.alignment_status === "possible_update"
  ).length
  const neutral = total - aligned - partial - conflict

  const segments = [
    { count: aligned, className: "bg-[#15803D]", label: "Aligned" },
    { count: partial, className: "bg-[#B45309]", label: "Partially aligned" },
    { count: conflict, className: "bg-[#B91C1C]", label: "Conflict / update needed" },
    { count: neutral, className: "bg-[#94A3B8]", label: "Not reviewed" },
  ]

  return (
    <div className="p-3 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] mb-3">
      <p className="text-[12px] font-medium text-[#1A2332] mb-2">
        Evidence Alignment: {aligned} of {total} external sources align with internal SOPs
      </p>
      <div className="flex h-2 rounded-full overflow-hidden bg-[#EDF1F5]">
        {segments.map(
          (s, i) =>
            s.count > 0 && (
              <div
                key={i}
                className={`${s.className} transition-all duration-200`}
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            )
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {segments.map(
          (s, i) =>
            s.count > 0 && (
              <span key={i} className="inline-flex items-center gap-1.5 text-[10px] text-[#64748B]">
                <span className={`w-2 h-2 rounded-full ${s.className}`} />
                {s.label} ({s.count})
              </span>
            )
        )}
      </div>
    </div>
  )
}

export function EvidenceQualityTags({
  strength,
  publicationDate,
}: {
  strength: string
  publicationDate: string
}) {
  let tag: { label: string; className: string }
  if (strength === "high") {
    tag = { label: "High-Quality Evidence", className: "text-[#15803D] border-[#BBF7D0] bg-[#DCFCE7]" }
  } else if (strength === "moderate") {
    tag = { label: "Guideline / Consensus", className: "text-[#475569] border-[#CBD5E1] bg-white" }
  } else {
    tag = { label: "Expert Opinion", className: "text-[#475569] border-[#CBD5E1] bg-white" }
  }

  // New research: published within 12 months of 2026-07
  const pub = new Date(publicationDate)
  const cutoff = new Date("2025-07-01")
  const isNew = !isNaN(pub.getTime()) && pub >= cutoff

  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${tag.className}`}>
        {tag.label}
      </span>
      {isNew && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border text-[#0B6BCB] border-[#0B6BCB]/30 bg-[#0B6BCB]/10">
          New Research
        </span>
      )}
    </span>
  )
}
