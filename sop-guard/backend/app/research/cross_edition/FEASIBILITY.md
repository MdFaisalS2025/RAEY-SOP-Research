# Cross-edition study: corpus feasibility

Status: **the gating question is answered — the corpus is viable.**
Last updated: 2026-08-16.

This is the durable record of the corpus triage for the cross-edition provenance
study ("Where did this recommendation go?"). It exists so the finding survives
independently of any chat log, and so a future session can resume without
re-deriving it.

---

## 1. The question this answers

Three planning rounds flagged the same unresolved risk: published clinical
protocol PDFs might be scans, or might lose their structural numbering on
extraction. Either would multiply the corpus cost and force a rethink. The risk
was named as blocking and never tested, because several hosts refused automated
fetching.

**It has now been tested. The answer is favourable, and better than expected.**

---

## 2. What was obtained, and what was blocked

| Source | Result |
|---|---|
| NASEMSO National Model EMS Clinical Guidelines **v2.2 (2019)**, via the Baylor College of Medicine mirror | **Retrieved, 3.3 MB** |
| NASEMSO **v3.0 (2022)**, `nasemso.org` | HTTP 403 — WAF blocks non-browser clients |
| NASEMSO v3.0, University of Florida mirror | HTTP 404 — link rotted |
| Massachusetts statewide protocols v2025.1 and v2026.1, `mass.gov/doc/.../download` | Returns the Mass.gov site shell (14 KB HTML), not the asset. Not a CAPTCHA — the real file sits behind a different URL |
| Wayback Machine | HTTP 429, rate-limited |

**Consequence, and it is minor:** these documents are freely available but resist
scripted download. Retrieval will be **manual, in a browser** — perfectly
acceptable for a corpus of 15–25 documents, and it takes a few minutes per
document. Do not build a scraper; it will fight WAFs for no benefit.

---

## 3. What the retrieved document actually contains

Measured by `corpus_probe.py` on NASEMSO v2.2:

| Property | Value |
|---|---|
| Pages | 372 |
| Characters | 798,680 (2,147 per page) |
| Text layer | **Present — not a scan** |
| Numbered lines | **5,329 (32.6% of non-blank lines)** |
| Numeric + unit values | 633 (`5 mg`, `0.1 mg`, `40 kg`, …) |
| Template sections | 20 recurring names |
| Per-guideline revision fields | 67 (4 distinct values) |
| **Verdict** | **STRONG** |

### 3.1 The structure is templated, which matters more than the numbering

Every guideline is built from the same named-section template. Occurrence counts
across the document:

```
69  Aliases                     68  References
68  Patient Care Goals          67  Quality Improvement
68  Patient Presentation        66  Revision Date
68  Patient Management          64  Patient Safety Considerations
68  Notes/Educational Pearls    …  Inclusion/Exclusion Criteria,
68  Key Documentation Elements     Assessment, Treatment and Interventions,
                                   Key Considerations, Performance Measures
```

So: **~68 guidelines × ~10 named sections each.**

This is the single most useful finding for the study. Cross-edition alignment was
expected to lean on numbering — but **numbering is exactly what gets renumbered
between editions**, which is what makes the alignment problem hard in the first
place. Named template sections are *semantic* anchors that survive renumbering.
The alignment unit should therefore be **(guideline title, section name)**, with
numbering used only for within-section item alignment.

That materially de-risks the study and should be reflected in the method before
the corpus is built.

### 3.2 Per-guideline revision dates exist — value is across editions, not within

66 `Revision Date` fields were found, but 63 share the single value
"September 8, 2017" (the v2 release date). **Within one edition they carry almost
no information.** Their value is in the comparison: if v3.0 (2022) carries
per-guideline revision dates that differ, then diffing the two editions' date
fields yields change labels *directly from the documents*, at zero annotation
cost.

**This is unverified and must not be assumed.** It depends entirely on v3.0's
content and is the first thing to check once v3.0 is retrieved. If it holds, a
large part of the study's labelling burden disappears. If it does not, the
labelling plan from the execution plan stands unchanged.

### 3.3 Extraction artefacts — recorded, not smoothed over

- **Bullet glyphs do not map to Unicode** and arrive as U+FFFD. Harmless for
  item extraction, but any parser must not treat them as content.
- **Guideline titles wrap across lines.** Anchoring title extraction on the
  following `Aliases` label recovers most titles but produces fragments on
  wrapped ones (`(STEMI)`, `Guideline Model Process)`). A real parser needs to
  join wrapped title lines before anchoring.
- **Running headers** (`Updated January 5, 2019`) appear as the first line of
  every page and must be stripped before item offsets are computed — the same
  class of problem as the provenance-header exclusion already handled in
  `real_corpus/corpus.py::_load_raw`.

---

## 4. What this changes

1. **The corpus is viable.** The blocking risk is cleared. Proceed.
2. **Retrieval is manual.** Budget a few minutes per document, in a browser.
   No scraper.
3. **Align on template sections, not numbering.** See §3.1. This is a method
   change and should be settled before the study is pre-registered.
4. **Check v3.0's revision dates first.** See §3.2. It is the cheapest possible
   test of whether the labelling burden collapses.

---

## 5. Not yet done

- NASEMSO v3.0 (2022) — needed to form the first edition pair. Download manually
  from `nasemso.org`; the browser works where scripted clients do not.
- Massachusetts v2025.1 / v2026.1 — the state-level edition pair. Same approach.
- A real item parser. `corpus_probe.py` is triage only: it counts markers, it
  does not extract addressable items with stable identifiers.
- A pre-registration for this study. The anchoring study's registrations
  (`prereg-anchoring-v1`, `-v2`) do not cover it, and must not be stretched to.

## 6. Reproducing

```
cd sop-guard/backend
python -m app.research.cross_edition.corpus_probe /path/to/candidate.pdf
```

Run this on any candidate **before** investing in parsing it. The verdict line is
the triage decision: REJECT (no text layer), WEAK (few markers), USABLE, STRONG.
