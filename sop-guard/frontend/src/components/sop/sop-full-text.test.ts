// Unit tests for resolveHighlight's honesty ladder (sop-full-text.tsx).
// Previously untested despite being the client-side mirror of the backend's
// citation-anchoring logic - see the Phase U research plan's coverage-gap
// note. Each test targets one rung of the ladder or one guard that keeps
// the ladder from fabricating a match.

import { describe, it, expect } from "vitest"
import { resolveHighlight } from "./sop-full-text"

const RAW_TEXT =
  "1. SCREENING\n" +
  "Screen with qSOFA. If qSOFA >= 2, perform full SOFA assessment.\n\n" +
  "2. PROCEDURE\n" +
  "Step 1: Obtain blood cultures before antibiotics.\n" +
  "Step 2: Administer broad-spectrum antibiotics within 1 hour.\n" +
  "Step 3: Begin fluid resuscitation with 30 mL/kg crystalloid.\n"

describe("resolveHighlight - offset rung", () => {
  it("returns basis 'offset' when the stored offsets and anchor still match the current text", () => {
    const start = RAW_TEXT.indexOf("Obtain blood cultures")
    const end = start + "Obtain blood cultures before antibiotics.".length
    const result = resolveHighlight(RAW_TEXT, {
      charStart: start,
      charEnd: end,
      offsetAnchor: RAW_TEXT.slice(start, start + 30),
      offsetSource: "verbatim",
    })
    expect(result).toEqual({ start, end, basis: "offset" })
  })

  it("returns basis 'step_anchor' when offsetSource is step_anchor, not 'offset'", () => {
    const start = RAW_TEXT.indexOf("Step 2:")
    const end = start + "Step 2: Administer broad-spectrum antibiotics within 1 hour.".length
    const result = resolveHighlight(RAW_TEXT, {
      charStart: start,
      charEnd: end,
      offsetAnchor: RAW_TEXT.slice(start, start + 30),
      offsetSource: "step_anchor",
    })
    expect(result?.basis).toBe("step_anchor")
    expect(result?.start).toBe(start)
    expect(result?.end).toBe(end)
  })

  it("falls through to a weaker rung when the anchor no longer matches (SOP edited since the citation was recorded)", () => {
    const start = RAW_TEXT.indexOf("Obtain blood cultures")
    const end = start + "Obtain blood cultures before antibiotics.".length
    const result = resolveHighlight(RAW_TEXT, {
      charStart: start,
      charEnd: end,
      offsetAnchor: "This text does not appear anywhere near that offset anymore",
      offsetSource: "verbatim",
      snippet: "Administer broad-spectrum antibiotics",
    })
    // Must NOT trust the stale offset - falls through to the snippet rung.
    expect(result?.basis).toBe("snippet")
  })

  it("rejects an offset span that is internally invalid (end <= start) and falls through", () => {
    const result = resolveHighlight(RAW_TEXT, {
      charStart: 50,
      charEnd: 50,
      offsetAnchor: "irrelevant",
      snippet: "Begin fluid resuscitation",
    })
    expect(result?.basis).toBe("snippet")
  })

  it("rejects an offset span that runs past the end of rawText and falls through", () => {
    const result = resolveHighlight(RAW_TEXT, {
      charStart: RAW_TEXT.length - 5,
      charEnd: RAW_TEXT.length + 500,
      offsetAnchor: "irrelevant",
      snippet: "Begin fluid resuscitation",
    })
    expect(result?.basis).toBe("snippet")
  })

  it("falls back to legacy token-containment against snippet when no offsetAnchor is present (pre-Q2.1 rows)", () => {
    const start = RAW_TEXT.indexOf("Begin fluid resuscitation")
    const end = start + "Begin fluid resuscitation with 30 mL/kg crystalloid.".length
    const result = resolveHighlight(RAW_TEXT, {
      charStart: start,
      charEnd: end,
      // No offsetAnchor - only the legacy snippet-containment path can validate this.
      snippet: "Sepsis Management - Begin fluid resuscitation with 30 mL/kg crystalloid",
      offsetSource: "verbatim",
    })
    expect(result?.basis).toBe("offset")
    expect(result?.start).toBe(start)
  })

  it("rejects via the legacy path when snippet shares too little with the claimed span", () => {
    const start = RAW_TEXT.indexOf("Begin fluid resuscitation")
    const end = start + "Begin fluid resuscitation with 30 mL/kg crystalloid.".length
    const result = resolveHighlight(RAW_TEXT, {
      charStart: start,
      charEnd: end,
      snippet: "Completely unrelated screening criteria text",
      sectionTitle: "1. SCREENING",
    })
    expect(result?.basis).toBe("section")
  })
})

describe("resolveHighlight - narrowed passage (Q2.6)", () => {
  it("includes narrowStart/narrowEnd when the passage falls within the outer offset span", () => {
    const start = RAW_TEXT.indexOf("Step 2:")
    const end = start + "Step 2: Administer broad-spectrum antibiotics within 1 hour.".length
    const passageStart = RAW_TEXT.indexOf("broad-spectrum antibiotics")
    const passageEnd = passageStart + "broad-spectrum antibiotics".length

    const result = resolveHighlight(RAW_TEXT, {
      charStart: start,
      charEnd: end,
      offsetAnchor: RAW_TEXT.slice(start, start + 30),
      offsetSource: "verbatim",
      passageStart,
      passageEnd,
    })
    expect(result?.narrowStart).toBe(passageStart)
    expect(result?.narrowEnd).toBe(passageEnd)
  })

  it("drops the passage when it falls outside the outer span (can't relocate the highlight elsewhere)", () => {
    const start = RAW_TEXT.indexOf("Step 2:")
    const end = start + "Step 2: Administer broad-spectrum antibiotics within 1 hour.".length
    // A passage from a totally different line - must not leak in.
    const outsidePassageStart = RAW_TEXT.indexOf("Screen with qSOFA")
    const outsidePassageEnd = outsidePassageStart + 10

    const result = resolveHighlight(RAW_TEXT, {
      charStart: start,
      charEnd: end,
      offsetAnchor: RAW_TEXT.slice(start, start + 30),
      offsetSource: "verbatim",
      passageStart: outsidePassageStart,
      passageEnd: outsidePassageEnd,
    })
    expect(result?.narrowStart).toBeUndefined()
    expect(result?.narrowEnd).toBeUndefined()
  })
})

describe("resolveHighlight - snippet rung", () => {
  it("locates via a normalized snippet match when there are no offsets at all", () => {
    const result = resolveHighlight(RAW_TEXT, {
      snippet: "Administer   broad-spectrum\nantibiotics within 1 hour",
    })
    expect(result?.basis).toBe("snippet")
    const expectedStart = RAW_TEXT.indexOf("Administer broad-spectrum")
    expect(result?.start).toBe(expectedStart)
  })

  it("does not match a snippet shorter than 8 normalized characters (too short to trust)", () => {
    const result = resolveHighlight(RAW_TEXT, {
      snippet: "Step 2",
      sectionTitle: "2. PROCEDURE",
    })
    // Falls through past the untrustworthy short snippet to the section rung.
    expect(result?.basis).toBe("section")
  })
})

describe("resolveHighlight - section rung", () => {
  it("locates via section title when no offsets or snippet match", () => {
    const result = resolveHighlight(RAW_TEXT, {
      sectionTitle: "2. PROCEDURE",
    })
    expect(result?.basis).toBe("section")
    expect(result?.start).toBe(RAW_TEXT.indexOf("2. PROCEDURE"))
  })
})

describe("resolveHighlight - whole_doc rung", () => {
  it("is skipped in favor of a locatable snippet, even when whole_doc offsets are present", () => {
    const result = resolveHighlight(RAW_TEXT, {
      charStart: 0,
      charEnd: RAW_TEXT.length,
      offsetSource: "whole_doc",
      snippet: "Begin fluid resuscitation with 30 mL/kg crystalloid",
    })
    expect(result?.basis).toBe("snippet")
  })

  it("falls back to whole_doc, not a fabricated highlight, when nothing more specific resolves", () => {
    const result = resolveHighlight(RAW_TEXT, {
      charStart: 0,
      charEnd: RAW_TEXT.length,
      offsetSource: "whole_doc",
    })
    expect(result).toEqual({ start: 0, end: 0, basis: "whole_doc" })
  })
})

describe("resolveHighlight - none", () => {
  it("returns null rather than fabricating a match when nothing resolves", () => {
    const result = resolveHighlight(RAW_TEXT, {
      snippet: "This text appears nowhere in the document at all",
      sectionTitle: "9. NONEXISTENT SECTION",
    })
    expect(result).toBeNull()
  })

  it("returns null when no locating fields are provided at all", () => {
    const result = resolveHighlight(RAW_TEXT, {})
    expect(result).toBeNull()
  })
})
