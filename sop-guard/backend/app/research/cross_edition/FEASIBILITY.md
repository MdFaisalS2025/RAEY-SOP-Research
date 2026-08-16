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

### 3.2 Per-guideline revision dates — hypothesis tested and DISCONFIRMED

66 `Revision Date` fields were found, but 63 share the single value
"September 8, 2017" (the v2 release date). Within one edition they carry almost
no information. The hope recorded here in the first draft was that their value
lay in the *comparison*: if consecutive editions carried differing per-guideline
dates, diffing them would yield change labels directly from the documents, at
zero annotation cost.

**Tested on the 2017 → 2019 pair by `edition_align.py`. It does not hold.**

| | |
|---|---|
| Guidelines whose `Revision Date` differs between editions | **0** |
| Guidelines whose content actually changed | **59** |
| Agreement between the two signals | **1.7%** |

The date field is essentially static across these editions while roughly
six guidelines in seven changed materially. **There are no free change labels.**
The annotation plan in the execution plan stands unchanged, and the labelling
budget must be planned for in full.

This is worth stating plainly because it was the single most attractive
shortcut available to the study, and it is gone. It is also exactly the kind of
assumption that would have been discovered late and expensively — the labelling
burden would have been "solved" on paper right up until someone checked.

*(Caveat: tested on one edition pair from one publisher. A different protocol
set may maintain its revision metadata properly. Do not generalise this beyond
NASEMSO without re-testing — `edition_align.py` reports the agreement figure for
any pair.)*

### 3.3 Cross-edition alignment by (title, section) — WORKS

The alignment unit proposed in §3.1 was an argument from structure. It has now
been tested on the 2017 → 2019 pair:

| | |
|---|---|
| Guidelines, 2017 edition | 69 |
| Guidelines, 2019 edition | 69 |
| **Matched by normalised title** | **60 (87.0%)** |
| Unmatched | 2 in each edition |
| Sections compared across matched guidelines | 899 |
| Sections unchanged | 724 (80.5%) |
| Sections changed | 175 (19.5%) |

**The 2 unmatched per edition are parser failures, not real additions or
removals** — they are the `<untitled@…>` entries where title extraction did not
recover a heading. Counted correctly they would match each other, putting true
alignment near 90%. That residual is a parsing problem with a known cause, not a
limitation of the alignment unit.

**A 19.5% section-level change rate is a good working corpus**: high enough that
there is real signal to study, low enough that unchanged sections provide a
large negative class. Both are computed, not annotated.

One parser bug was found and fixed during this run rather than worked around:
the backwards walk for a guideline title picked up the *preceding* guideline's
`Revision Date` value, splitting Neonatal Resuscitation into a spurious
removed/added pair (`september 8 2017 neonatal resuscitation` versus
`june 29 2018 neonatal resuscitation`). Date-like lines are now skipped during
the title walk. Two `<untitled@…>` failures remain and are the next parser fix.

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

### 3.4 Item parser — built and working

`item_parser.py` takes a protocol PDF to addressable items with stable
identifiers and character offsets. Both editions parse cleanly:

| | v2.0 (2017) | v2.2 (2019) |
|---|---|---|
| Guidelines | 69 | 69 |
| **Items extracted** | **4,745** | **4,567** |
| Depth 1 / 2 / 3 | 2,321 / 1,855 / 569 | 2,235 / 1,772 / 560 |
| Duplicate item_ids | **0** | **0** |
| Ambiguous `i`/`v`/`x` markers | 3 | 3 |
| Sections yielding no items | 172 | 173 |
| Offset mismatches (first 2,000) | 64 (3.2%) | 77 (3.9%) |

Item IDs take the form `guideline / section / marker-path`, e.g.
`universal care guideline/assessment/6.c.ii`, and offsets resolve exactly
against `canonical_text` — that ID at offset 26,200 returns
`"ii. Breath sounds"`. Output is serialised in a shape deliberately compatible
with `RealDocument` (`doc_id`, `raw_text`, `items[]` with
`item_id`/`text`/`char_start`/`char_end`), so the existing anchoring harness in
`real_corpus/` can consume these documents without a shim.

**Design decisions worth knowing:**

- **Offsets index a canonical text, not the raw extraction.** Running headers
  and page numbers are stripped, so raw offsets would be meaningless. The parser
  defines the cleaned line stream as canonical and serialises it alongside the
  items. Same convention as `real_corpus/corpus.py::_load_raw`.
- **Depth is inferred from marker-type sequence, not indentation,** because PDF
  extraction does not preserve indentation reliably.
- **`i.`, `v.` and `x.` are genuinely ambiguous** between roman and alpha.
  Resolved by continuity with an open level; where that fails, a bare `i.` is
  read as roman-one. Only 3 cases per edition need the fallback, and the count is
  reported rather than hidden.

**Four bugs found and fixed during the build**, all recorded because each was
silently producing wrong output:

1. **Bullets were ignored entirely.** A numbering-only parser left 207 sections
   with zero items — whole sections are bulleted rather than numbered, so this
   was a quarter of the corpus, not a tail. Adding bullet markers (including the
   U+FFFD glyphs from §3.3) recovered them.
2. **Wrapped titles were concatenated with their own fragments**, producing
   `universal care universal care guideline`. Parts contained within other parts
   are now dropped.
3. **Item IDs were not unique** — 831 collisions, because a section can contain
   several independent numbered lists (an adult list, then a paediatric one).
   Now disambiguated by occurrence. Fixing the counter's scope from per-section
   to per-edition removed the last 282.
4. **The offset self-check was itself wrong**, comparing a marker-stripped item
   against an unstripped slice and reporting 2,000/2,000 mismatches on offsets
   that were correct. The real rate is 3–4%.

**Still open:** ~172 sections yield no items (short prose without markers — needs
checking whether any contain real recommendations), and the 3–4% offset mismatch
tail is uninvestigated.

---

## 4. What this changes

1. **The corpus is viable.** The blocking risk is cleared. Proceed.
2. **An edition pair already exists locally.** NASEMSO v2.0 (Oct 2017) and
   v2.2 (Jan 2019), both retrieved, both STRONG. The study's core premise is
   testable today without waiting for anything.
3. **Retrieval is manual, with one exception.** `nasemso.org` returns 403,
   mirrors have rotted, and `mass.gov` serves its site shell — but the **Wayback
   CDX index** works and served v2.0 directly. Prefer CDX for superseded
   editions; use a browser for current ones. Do not build a scraper.
4. **Align on named sections, not numbering** (§3.1), now confirmed empirically
   at 87% direct match (§3.3).
5. **There are no free change labels** (§3.2). Budget the annotation in full.

---

## 5. Not yet done

- **NASEMSO v3.0 (2022)** — Wayback holds it (`Content-Length: 5,040,475`,
  `Content-Type: application/pdf`, snapshot `20220324231037`) but returned 503
  under load on three attempts. Retry, or download manually from `nasemso.org`
  in a browser. v2.0→v2.2 is a *minor* version bump; v2.2→v3.0 is the major one
  and will exercise the method harder.
- Massachusetts v2025.1 / v2026.1 — the state-level pair, for institutional
  adaptation rather than national guidance.
- **Fix the 2 remaining `<untitled@…>` title-extraction failures** (§3.3).
- A real item parser. Both probes work at section granularity; the study needs
  addressable *items within* sections, with stable identifiers and offsets.
- A pre-registration for this study. The anchoring study's registrations
  (`prereg-anchoring-v1`, `-v2`) do not cover it, and must not be stretched to.
  It should now be written against measured numbers rather than guesses — §3.3
  supplies the base rates a power analysis needs.

## 6. Reproducing

```
cd sop-guard/backend
python -m app.research.cross_edition.corpus_probe /path/to/candidate.pdf
```

Run this on any candidate **before** investing in parsing it. The verdict line is
the triage decision: REJECT (no text layer), WEAK (few markers), USABLE, STRONG.

---

## 7. Decision experiment: is the alignment task actually hard?

`edition_align.py` matched 87% of guidelines on exact normalised title — a
trivial method. If items behave the same way, cross-edition provenance is a
dictionary lookup and there is no method contribution. `item_align.py` tests
that, with tiers designed so the answer cannot flatter the paper: T1/T2 are free
(identifier survives), T3–T5 require real matching, T6 is unmatched.

**The answer depends on the magnitude of the revision, which is itself the
finding.**

| | minor bump<br>v2.0→v2.2 | major bump<br>v2.2→v3.0 |
|---|---|---|
| Old → new items | 4,745 → 4,567 | 4,567 → 5,047 |
| New-only items | 36 | **1,843** |
| T1 id exact | 89.9% | 35.2% |
| T2 id, text changed | 2.0% | 21.4% |
| T3 renumbered | 1.0% | 2.0% |
| T4 reworded | 0.0% | 0.9% |
| T5 moved | 2.7% | 10.6% |
| T6 unmatched | 4.5% | **29.8%** |
| **Trivially alignable** | **91.9%** | **56.7%** |
| **Needs more than an id** | **3.6%** | **13.5%** |

On a maintenance revision the trivial method is nearly sufficient. On a full
review it accounts for barely half the items, leaving ~43% either requiring real
matching or unaccounted for.

**Honest limits on this number.** Cross-edition guideline-title overlap is
currently 75.8%, so roughly a quarter of guidelines fail to match by title and
push their items into T6 regardless of whether they were genuinely restructured.
**The 13.5% (T3–T5) is therefore a floor on real difficulty; the 29.8% (T6) is a
mixture of genuine deletion and parser failure and must not be quoted as
evidence.** Separating those two is the next parser task and is prerequisite to
any publishable claim.

### 7.1 A parsing artefact that nearly became a finding

The first v2.2→v3.0 run reported 38.9% needing more than an id and 57.6%
unmatched, and the tool printed "that is a real method contribution."

It was not. The 2022 edition uses different page furniture — `NASEMSO`,
`National Model EMS Clinical Guidelines`, `Go To TOC` — which the hardcoded
running-header regex did not match, so it survived into guideline titles
(`version 3 0 universal care guideline`). Identical items were scored as *moved*
or *unmatched* purely because their titles no longer matched.

Two fixes: running headers are now detected **empirically**, as short lines
recurring on more than half the pages, which generalises to any publisher rather
than to one document's layout; and title extraction handles the 2022 layout,
where the title is printed twice before `Aliases` (`category / title / title`) —
the containment-based dedupe had been dropping *both* copies, since each
contains the other, and falling back to joining the category in.

This is the second time in this study that a paper-flattering result turned out
to be a parser bug. Both were caught by disbelieving a convenient number and
checking the intermediate output. Any future result that suddenly favours the
paper should be treated the same way.


---

## 8. Title matching fixed; the decision experiment settles

§7 flagged that guideline-title overlap of 75.8% made the unmatched tier
uninterpretable. Fixed. Guideline matching is now **95.2% (59/62)**, and the
decision experiment can be read.

**What the fix was, and what it was not.** Three parser iterations tried to
extract titles exactly, and the third made things *worse* (overlap 75.8% ->
72.6%) because tightening the category filter truncated genuinely wrapped
titles into fragments like `(STEMI)` and `Model Process)`. The mistake was
treating this as a parsing problem. It is two problems:

1. **Titles genuinely change between editions.** `Crush Injury` becomes
   `Crush Injury/Crush Syndrome`; `End-of-Life Care/Palliative Care` becomes
   `End-of-Life Care/Hospice Care`; `Syncope and Presyncope` becomes
   `Syncope and Near Syncope`. No parser can make these equal, because they
   are not equal.
2. **Category headings leak asymmetrically** between editions, giving
   `General Medical Abdominal Pain` against `Abdominal Pain`.

Both are handled by token-overlap matching with a floor
(`item_align.match_guidelines`), which is also the honest model of the
underlying reality: a guideline persists across editions under a title that may
be edited. Three guidelines remain unmatched - two `<untitled@…>` parse
failures and `Pulmonary Edema`, which may be a genuine removal.

### 8.1 Final decision-experiment numbers

| | minor v2.0→v2.2 | major v2.2→v3.0 |
|---|---|---|
| T1 id exact | 89.9% | 35.0% |
| T2 id, text changed | 2.0% | 21.3% |
| **T3 renumbered** | 1.0% | **12.3%** |
| **T4 reworded** | 0.0% | **4.6%** |
| **T5 moved** | 2.7% | **5.7%** |
| T6 unmatched | 4.5% | 21.1% |
| **Trivially alignable** | **91.9%** | **56.3%** |
| **Needs more than an id** | **3.6%** | **22.6%** |

**The headline is T3 at 12.3%.** Those are items whose text is *identical*
across editions but whose marker path changed. An identifier lookup reports
each one as a deletion plus an unrelated insertion, destroying the provenance
link, when in fact nothing about the recommendation changed at all. Together
with T4 and T5, **22.6% of items in a major revision cannot be tracked by
identifier**, against 3.6% in a maintenance revision.

That magnitude-dependence is the finding, and it is now measured on alignment
that has been checked rather than assumed.

### 8.2 Why these numbers are more trustworthy than §7's

Three independent reasons, worth recording because §7's numbers were wrong
twice:

- Guideline matching is 95.2% and the pairs were inspected by hand
  (`OB/GYN Childbirth` → `Childbirth`, `Conducted Electrical Weapon Injury
  (e.g. TASER)` → `(i.e., TASER)`).
- The correction moved items in the **expected direction** — out of unmatched
  and into renumbered/reworded. A fix that shuffled items arbitrarily, or that
  inflated the interesting tiers while leaving unmatched untouched, would have
  been a red flag.
- The minor-bump numbers are **unchanged**, which is correct: that pair never
  had a title problem, so a title fix should not have moved it.

### 8.3 Remaining known weaknesses

- 21.1% unmatched on the major bump still mixes genuine deletions with
  residual parse failures. It is reported, not claimed as deletion.
- Two `<untitled@…>` guidelines never parse a title in any edition.
- `Cyanide Exposure` → `Exposure` matched on a truncated v3.0 title; the
  containment-biased overlap is permissive by design and will occasionally
  pair loosely. Worth a manual audit before publication.
