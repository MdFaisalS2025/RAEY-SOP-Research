// Honest external out-links, extracted out of chat-answer-message.tsx so
// they can be shared with the External Evidence drawer (Phase Q4.4 - these
// used to live in every answer's overflow menu; they belong here instead,
// next to the other external literature this drawer already shows, not on
// every single message).
//
// No data ingestion from any of these - OpenEvidence has no public API
// (closed, NPI-verified-clinician platform) and UpToDate/PolicyTech are
// licensed institutional subscriptions Meridian doesn't have access to.
// These are clearly-labeled referral links to separate tools a clinician
// already has their own access to, not an in-app data source.

/** UpToDate search deep-link (their public search UI takes a plain query
 * param - no API access, no license required to land on the search page). */
export function uptodateSearchUrl(term: string): string {
  return `https://www.uptodate.com/contents/search?search=${encodeURIComponent(term)}`
}

/** PubMed's search UI takes a plain, publicly documented `?term=` query
 * param and actually runs the search server-side - unlike OpenEvidence
 * below, this one genuinely auto-searches, no copy/paste hand-off needed.
 * No login wall, no API key. Confirmed live: openevidence.com's own
 * search box is client-rendered and gated behind auth with no URL/API
 * equivalent, so a real auto-search hand-off to OpenEvidence specifically
 * isn't achievable without their cooperation - this is offered as the
 * genuinely-working alternative. */
export function pubmedSearchUrl(term: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(term)}`
}

const OPENEVIDENCE_URL = "https://www.openevidence.com/"

/** OpenEvidence has no officially documented query URL - their user-guide
 * pages are bot-gated, and the only known prefill parameter (?oe_q=) is
 * implemented by a third-party browser extension's injected content
 * script, not by openevidence.com itself. Default best-effort: pass
 * ?oe_q= anyway - it auto-fills/auto-searches for a clinician who happens
 * to run that extension, and is harmlessly ignored (unused query param)
 * by a plain openevidence.com for everyone else. The clipboard copy below
 * is the actual guarantee this hand-off relies on, not the param.
 * NEXT_PUBLIC_OPENEVIDENCE_URL_TEMPLATE overrides this entirely (e.g. if
 * OpenEvidence ever ships an official query URL). Never presented as
 * "integrated" either way. */
const OPENEVIDENCE_URL_TEMPLATE = process.env.NEXT_PUBLIC_OPENEVIDENCE_URL_TEMPLATE || ""

export function openEvidenceUrlFor(query: string): string {
  if (OPENEVIDENCE_URL_TEMPLATE) return OPENEVIDENCE_URL_TEMPLATE.replace("{query}", encodeURIComponent(query))
  return `${OPENEVIDENCE_URL}?oe_q=${encodeURIComponent(query)}`
}

/** Copies the exact question to the clipboard and opens OpenEvidence
 * (best-effort auto-searching for extension users, see above) in a new
 * tab, since there's no way to hand the question off directly - the
 * honest "Option B" alternative to a fake integration. Falls back to just
 * opening the tab (with a degraded toast) if the clipboard write fails,
 * e.g. an insecure context. */
export async function openInOpenEvidence(query: string, showToast: (msg: string) => void) {
  const url = openEvidenceUrlFor(query)
  try {
    await navigator.clipboard.writeText(query)
    window.open(url, "_blank", "noopener,noreferrer")
    showToast("Question copied - paste it into OpenEvidence if it doesn't auto-fill.")
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
    showToast("Opened OpenEvidence in a new tab.")
  }
}

/** Only rendered if an institution has actually configured its PolicyTech
 * tenant URL - absent by default, so no link is shown (honest
 * not-configured) rather than a fabricated/guessed deep-link path, since
 * PolicyTech's per-document URL scheme isn't something we can know without
 * a real tenant to test against. */
export const POLICYTECH_BASE_URL = process.env.NEXT_PUBLIC_POLICYTECH_BASE_URL || ""
