"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Search, FileText, ArrowRight, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { MOCK_SOPS } from "@/lib/mock-data"
import { useAuth } from "@/lib/auth-context"

type Group = "Pages" | "SOPs" | "Actions"

type Command = {
  id: string
  name: string
  keywords: string
  group: Group
  run: () => void
}

const PAGES: { name: string; href: string; keywords: string }[] = [
  { name: "Home", href: "/", keywords: "dashboard start overview" },
  { name: "Ask SOP-Guard", href: "/query", keywords: "query chat question ask" },
  { name: "Bedside Lookup", href: "/bedside", keywords: "bedside quick lookup nurse" },
  { name: "SOP Library", href: "/library", keywords: "library documents sops browse" },
  { name: "Quick Reference", href: "/quick-ref", keywords: "quick ref cards checklist" },
  { name: "Scenario Training", href: "/scenarios", keywords: "scenario training practice simulation" },
  { name: "Evidence Watch", href: "/evidence-watch", keywords: "evidence research alerts guidelines" },
  { name: "Proposals", href: "/proposals", keywords: "proposal update change request" },
  { name: "Committee", href: "/committee", keywords: "committee vote review approval" },
  { name: "Conflicts", href: "/conflict-resolution", keywords: "conflict resolution disputes" },
  { name: "Impact Map", href: "/impact-map", keywords: "impact map dependencies graph" },
  { name: "Compliance", href: "/compliance", keywords: "compliance acknowledgment tracking" },
  { name: "Training", href: "/training", keywords: "training education competency" },
  { name: "Legal & Risk", href: "/legal", keywords: "legal risk liability" },
  { name: "Audit", href: "/audit", keywords: "audit trail log history" },
  { name: "Expiry", href: "/expiry", keywords: "expiry review due dates" },
  { name: "Regulatory", href: "/regulatory", keywords: "regulatory joint commission cms" },
  { name: "Leadership", href: "/leadership", keywords: "leadership executive metrics" },
  { name: "Effectiveness", href: "/effectiveness", keywords: "effectiveness outcomes measures" },
  { name: "Survey Prep", href: "/survey-prep", keywords: "survey prep readiness inspection" },
  { name: "Incidents", href: "/incidents", keywords: "incident safety event report" },
  { name: "Exceptions", href: "/exceptions", keywords: "exception deviation report" },
  { name: "EMR Demo", href: "/cds-demo", keywords: "emr cds clinical decision support demo" },
  { name: "Clinician Eval", href: "/human-eval", keywords: "clinician human evaluation feedback" },
  { name: "Evaluation", href: "/evaluation", keywords: "evaluation metrics benchmark rag" },
  { name: "Adversarial", href: "/adversarial", keywords: "adversarial red team safety verifier" },
  { name: "Settings", href: "/settings", keywords: "settings preferences config" },
  { name: "Admin", href: "/admin", keywords: "admin system management" },
]

const GROUP_ICON: Record<Group, typeof Search> = {
  Pages: ArrowRight,
  SOPs: FileText,
  Actions: Zap,
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const router = useRouter()
  const pathname = usePathname()
  const auth = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = PAGES.map((p) => ({
      id: `page-${p.href}`,
      name: p.name,
      keywords: p.keywords,
      group: "Pages",
      run: () => router.push(p.href),
    }))
    const sops: Command[] = MOCK_SOPS.map((s) => ({
      id: `sop-${s.id}`,
      name: `${s.sop_id}: ${s.title}`,
      keywords: `${s.department} ${s.category} ${(s.tags || []).join(" ")}`,
      group: "SOPs",
      run: () => router.push("/library"),
    }))
    const actions: Command[] = [
      {
        id: "act-new-conversation",
        name: "New conversation",
        keywords: "ask query chat start",
        group: "Actions",
        run: () => router.push("/query"),
      },
      {
        id: "act-report-exception",
        name: "Report exception",
        keywords: "deviation incident new",
        group: "Actions",
        run: () => router.push("/exceptions"),
      },
      {
        id: "act-create-proposal",
        name: "Create proposal",
        keywords: "update sop change new",
        group: "Actions",
        run: () => router.push("/proposals"),
      },
      {
        id: "act-sign-out",
        name: "Sign out",
        keywords: "logout exit leave",
        group: "Actions",
        run: () => {
          auth.logout()
          router.push("/login")
        },
      },
    ]
    return [...pages, ...sops, ...actions]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, auth.logout])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands.filter((c) => c.group !== "SOPs")
    return commands.filter(
      (c) => c.name.toLowerCase().includes(q) || c.keywords.toLowerCase().includes(q)
    )
  }, [query, commands])

  const groups = useMemo(() => {
    const order: Group[] = ["Pages", "SOPs", "Actions"]
    return order
      .map((g) => ({ label: g, items: filtered.filter((c) => c.group === g) }))
      .filter((g) => g.items.length > 0)
  }, [filtered])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  // Global Cmd/Ctrl+K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Reset and focus on open
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelected(0)
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    setSelected(0)
  }, [query])

  // Keep selected row visible
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [selected])

  const runCommand = useCallback(
    (cmd: Command) => {
      setOpen(false)
      cmd.run()
    },
    []
  )

  if (!open) return null

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      close()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelected((s) => (flat.length === 0 ? 0 : Math.min(s + 1, flat.length - 1)))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const cmd = flat[selected]
      if (cmd) runCommand(cmd)
    }
  }

  let index = -1

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#1A2332]/30 backdrop-blur-[2px]"
        onClick={close}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-[#0d1516] rounded-xl shadow-md border border-[#E2E8F0] dark:border-white/[0.08] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#EDF1F5] dark:border-white/[0.06]">
          <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages, SOPs, actions..."
            aria-label="Search commands"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent outline-none text-sm text-[#1A2332] dark:text-[#dce4e5] placeholder:text-[#94A3B8]"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-[#E2E8F0] dark:border-white/10 text-[10px] font-medium text-[#94A3B8]">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {flat.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[#64748B]">No results</p>
          )}
          {groups.map((group) => {
            const Icon = GROUP_ICON[group.label]
            return (
              <div key={group.label}>
                <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
                  {group.label}
                </p>
                {group.items.map((cmd) => {
                  index += 1
                  const i = index
                  const isSelected = i === selected
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      data-index={i}
                      onClick={() => runCommand(cmd)}
                      onMouseMove={() => setSelected(i)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] font-medium transition-colors",
                        isSelected
                          ? "bg-[#0B6BCB]/[0.08] text-[#0B6BCB]"
                          : "text-[#334155] dark:text-slate-300"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          isSelected ? "text-[#0B6BCB]" : "text-[#94A3B8]"
                        )}
                      />
                      <span className="truncate">{cmd.name}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[#EDF1F5] dark:border-white/[0.06] text-[11px] text-[#94A3B8]">
          Enter to open - Esc to close
        </div>
      </div>
    </div>
  )
}
