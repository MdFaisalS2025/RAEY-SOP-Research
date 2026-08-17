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

### 3.4 Extraction artefacts — recorded, not smoothed over

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

### 3.5 Item parser — built and working

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


---

## 9. CORRECTION: an identifier-remapping bug inflated §8's headline

Found during a verification pass before corpus retrieval. **§8.1's numbers were
wrong and are superseded by the table below.**

### 9.1 The bug

`item_align.align_items` rewrites old-edition item identifiers into the new
edition's guideline vocabulary before comparing them, so that a guideline which
was renamed does not make all of its items look deleted. It did this with

```python
it.item_id.replace(_norm(it.guideline), _norm(mapped), 1)
```

`item_id` is built with `_norm_title`, which **keeps** `/` and `-`
(`ob/gyn childbirth`). `_norm` **strips** them (`obgyn childbirth`). The
substring was therefore never found, `replace` silently did nothing, and every
guideline whose title contains punctuation — `OB/GYN Childbirth`,
`End-of-Life Care/Hospice Care`, `Crush Injury/Crush Syndrome`,
`Toxins and Environmental Poisoning/Overdose` — kept its old identifier and
could not match by id, even though guideline matching had correctly paired it.
Those items fell through to the harder tiers.

Fixed by rebuilding the identifier from components (`_norm_title(mapped)` /
section / marker path, preserving any `#N` disambiguation suffix) rather than
by string surgery.

### 9.2 Corrected numbers

| | minor v2.0→v2.2 | major v2.2→v3.0 (was) | major v2.2→v3.0 (**corrected**) |
|---|---|---|---|
| T1 id exact | 89.9% | 35.0% | **42.8%** |
| T2 id, text changed | 2.0% | 21.3% | **30.0%** |
| T3 renumbered | 1.0% | 12.3% | **4.0%** |
| T4 reworded | 0.0% | 4.6% | **1.3%** |
| T5 moved | 2.7% | 5.7% | **5.6%** |
| T6 unmatched | 4.5% | 21.1% | **16.2%** |
| **Trivially alignable** | **91.9%** | 56.3% | **72.9%** |
| **Needs more than an id** | **3.6%** | 22.6% | **10.9%** |

**The headline halved: 22.6% → 10.9%.** T3, which §8.1 called "the headline",
fell from 12.3% to 4.0%.

The minor-bump numbers are **unchanged at 3.6%**, which is the correct control:
that pair contains few punctuated guideline titles to remap, so a remapping bug
should not have affected it — and did not.

### 9.3 What this does to the study

The claim is weaker but not dead. **10.9% of items in a major revision still
cannot be tracked by identifier, against 3.6% in a maintenance revision** — a
threefold contrast rather than the sixfold one previously reported. A further
16.2% are unmatched and remain undecomposed between genuine deletion and
residual failure.

**This was the fourth paper-flattering result in this line of work to turn out
to be a bug** (after the two in §7.1/§8.2 and the anchoring study's H6 probe).
Three of the four were caught by the same move: disbelieving a number that
favoured the study and inspecting intermediate output.

It is worth recording that `PREREGISTRATION.md` §10 was written to mandate
exactly that check — and was then not applied to the dev numbers it was written
alongside. The rule was right; applying it only to future test results was not.
**§10 should be read as applying to dev results too.**


---

## 10. The unmatched tail, decomposed

§9 left 16.2% of items unmatched on the major pair, undecomposed between genuine
deletion and matching failure. Reporting that as deletion would have overstated
it badly. `unmatched_probe.py` decomposes it.

| Cause | n | % of tail | Reading |
|---|---|---|---|
| U1 guideline unmatched | 156 | 21.0% | parser debt — items under the 2–3 guidelines that never matched |
| U2 section absent for that guideline | 155 | 20.9% | ambiguous |
| U3 near miss in section | 54 | 7.3% | **recoverable** |
| U4 blocked by consumed rival | 89 | 12.0% | **recoverable** |
| U6 weak distant match | 184 | 24.8% | uncertain — plausible counterpart, below the T4 floor |
| U5 no candidate at all | 104 | 14.0% | **defensible deletion** |

**The 16.2% unmatched contains only 2.3% defensible deletion** (104 of 4,567 old
items). Roughly 42% of the tail is method or parsing debt, and a further 19% is
straightforwardly recoverable.

### 10.1 The headline is a floor, not a ceiling

This is the consequential part. U3, U4 and U6 — 327 items, 7.2% of old items —
would, if recovered, land in **T4 (reworded) or T5 (moved)**, never in T1/T2.
They are by construction items that an identifier lookup cannot find.

So better matching **raises** "requires more than an identifier" above the
current 10.9%; it cannot lower it. **10.9% is a lower bound.** That is the
opposite of the situation in §9, where the headline was inflated by a bug and
fell when corrected.

### 10.2 Two errors in the decomposition itself, found and fixed

Consistent with §9's standing rule, the first decomposition was checked rather
than trusted, and was wrong twice:

1. **U3 scored against all section candidates**, while `align_items` only ever
   considered *unconsumed* ones. U3 was therefore absorbing collision cases that
   belong in U4. After the fix U4 rose from 21 to 89 and U3 fell from 138 to 54.
2. **U5 counted items with a plausible distant counterpart as deletions.** One
   example scored 0.688 corpus-wide — outside its own section, so U3 missed it;
   below the 0.75 floor, so U4 missed it — and was reported as deleted. These
   are now U6, and the deletion estimate fell from 6.0% to **2.3%** of old items.

An unchecked decomposition would have claimed nearly three times the true
deletion rate.

### 10.3 What this changes for the study

- **Deletion recall/precision** (`PREREGISTRATION.md` §6) is measured against a
  much smaller true-deletion class than the raw tail suggested. Annotation
  sampling must not assume T6 ≈ deleted.
- **U1's 156 items depend on 2–3 unparsed guideline titles.** Fixing those is
  the single highest-yield remaining parser task.
- **No section disappeared globally** between editions (`performance measures`
  runs 73 → 63), so U2 is genuinely per-guideline rather than a structural
  change, and stays classified as ambiguous.


---

## 11. U1 fixed — and §10.1's "floor" claim was too strong

### 11.1 The fix

The two `<untitled@…>` guidelines were not a hard parsing problem. Their titles
sit on the line directly above `Aliases`, exactly where the parser looks — but
both exceed 70 characters:

```
Do Not Resuscitate Status/Advance Directives/Healthcare Power of Attorney
Acetylcholinesterase Inhibitors (Carbamates, Nerve Agents, Organophosphates)
```

`_title_before` broke on `len(s) > 70`, classifying them as body text. The guard
is now **position-aware**: 140 characters for the line immediately above
`Aliases` (which is the title with very high reliability across 69 guidelines ×
3 editions), 70 for lines further back, where a long line really is body text.

**All three editions now parse zero untitled guidelines**, and guideline matching
rose to **98.4% (61/62)**. The one remaining unmatched guideline is
`Pulmonary Edema`, which may be a genuine removal — v3.0 appears to have folded
it elsewhere. That is a content question, not a parser question.

### 11.2 Updated numbers

| | before title fix | **after** |
|---|---|---|
| Guideline match | 95.2% | **98.4%** |
| T1 + T2 trivially alignable | 72.9% | **74.0%** |
| **Requires more than an identifier** | 10.9% | **10.2%** |
| Unmatched tail | 16.2% | **15.8%** |
| U1 guideline unmatched | 156 | **68** |
| U5 defensible deletion | 2.3% | **2.5%** |

### 11.3 The correction: recovery does not only push one way

§10.1 claimed the headline was a **floor**, on the reasoning that recovered items
land in T4/T5 and never in T1/T2. **That was too strong, and this fix
demonstrates why.**

Recovering U1 items moved them into **T1/T2**, because once a guideline title
matches, its items match by identifier. The headline therefore went *down*
(10.9% → 10.2%), not up.

The corrected statement:

- Recovering **U3, U4, U6** (378 items) raises the figure — those are by
  construction items an identifier cannot find.
- Recovering **U1, U2** (227 items) lowers it — those are items an identifier
  *could* have found, had the guideline or section matched.
- The net direction is **not predictable in advance**, and the headline is
  neither a floor nor a ceiling. It is an estimate whose stability depends on
  which class of debt gets paid down next.

This matters for `PREREGISTRATION.md` H1, whose threshold is 10%: the dev figure
has now moved 22.6% → 10.9% → 10.2% across three corrections and sits almost
exactly on the threshold. **H1 should be expected to be marginal on test data,
and its disconfirmation would not be surprising.** The threshold remains
unrevised, per the §11 deviation entry.

### 11.4 What is left in the tail

| Cause | n | Status |
|---|---|---|
| U6 weak distant match | 220 | largest single category; needs a matching improvement, not a parser fix |
| U2 section absent for that guideline | 159 | largest remaining debt; no section vanished globally, so this is per-guideline |
| U5 no candidate | 115 | **2.5% of old items — the defensible deletion estimate** |
| U4 consumed rival | 104 | greedy-collision; fixable with global assignment |
| U1 guideline unmatched | 68 | traces to `Pulmonary Edema` and residual mismatches |
| U3 near miss | 54 | fixable by lowering the T4 floor, at a precision cost |


---

## 12. Second publisher retrieved — the method is only half general

Retrieval before further method work, per the plan. **New York State statewide
protocols**, four documents forming **two independent edition pairs**:

| | v25.1 | v26.0 |
|---|---|---|
| Collaborative Protocols | 186 pp | 184 pp |
| BLS Protocols | 118 pp | 129 pp |

All four have real text layers. Retrieved directly from `health.ny.gov`, which —
unlike `nasemso.org` and `mass.gov` — does not block scripted clients.

### 12.1 `corpus_probe` was giving dangerously wrong triage

The probe scored all four New York documents at **0.2–0.3% numbered lines**,
verdict **WEAK**, "low value for this study".

**That was wrong.** The actual parser finds a marker on **42.0%** of New York's
lines. The probe's marker regex omitted bullets, and New York's protocols are
heavily bulleted.

Triage that wrongly rejects usable documents is worse than no triage, because a
rejection is never revisited — those four documents would simply have been
dropped. The probe's pattern is now kept in step with `item_parser`'s, and any
future divergence between the two should be treated as a defect.

### 12.2 The real problem: guideline segmentation is publisher-specific

New York is not less structured than NASEMSO. It is structured **on a different
axis**. NASEMSO organises each guideline by clinical section; New York organises
by **provider certification level**:

```
90  CFR AND ALL PROVIDER LEVELS      45  CFR STOP
67  MEDICAL CONTROL CONSIDERATIONS   39  PARAMEDIC STOP
62  CRITERIA                         33  ADVANCED STOP
```

Only **2** of NASEMSO's ~20 hardcoded section names appear anywhere in a
184-page New York document.

**Fixed:** `detect_section_names()` now discovers a document's template
empirically — short lines, carrying no item marker, in caps or title case,
recurring above a floor — unioned with the hardcoded set so NASEMSO cannot
regress. New York's extracted items rose **862 → 2,156**; NASEMSO held at 69
guidelines and gained items (4,567 → 4,741; 5,047 → 5,534) as previously missed
sections were picked up.

**Not fixed, and this is now the study's central open problem:** New York still
segments to **0 guidelines**. Guideline boundaries are detected via the `Aliases`
anchor, which is a NASEMSO convention. Every New York item therefore lands under
`<preamble>`, and `item_id` — `guideline/section/marker_path` — has no guideline
component to carry.

### 12.3 What this means for the study

1. **The item layer generalises; the document layer does not.** Marker parsing,
   depth inference, offsets and section discovery all transfer to a second
   publisher. Guideline segmentation does not.
2. **`PREREGISTRATION.md` §3.2 requires ≥ 4 publishers.** On this evidence each
   will need its own guideline-boundary signal, or a general one must be found.
   That is real work and it is the highest-value remaining task.
3. **The dev numbers move again.** NASEMSO item counts changed, so every tier
   and tail figure in §8–§11 must be recomputed before use. They are stale as of
   this section.
4. **A finding worth keeping regardless of the method's fate:** protocol
   publishers structure the same content on incompatible axes — clinical section
   versus certification level. Any cross-publisher provenance tool must discover
   structure rather than assume it. That is a characterisation result the corpus
   supports on its own.


---

## 13. Guideline segmentation now works across both publishers

§12 left New York segmenting to zero guidelines. Fixed, and the pipeline now
runs end to end on **7 documents / 3 edition pairs / 2 publishers**.

| Document | Anchor | Guidelines | Titled | Items |
|---|---|---|---|---|
| NASEMSO v2.0 (2017) | `aliases` | 69 | 68 | 4,857 |
| NASEMSO v2.2 (2019) | `aliases` | 69 | 68 | 4,741 |
| NASEMSO v3.0 (2022) | `aliases` | 69 | 68 | 5,534 |
| NY Collaborative v25.1 | `criteria` | 62 | 55 | 2,194 |
| NY Collaborative v26.0 | `criteria` | 63 | 56 | 2,156 |
| NY BLS v25.1 | `criteria` | 52 | 48 | 1,224 |
| NY BLS v26.0 | `criteria` | 58 | 54 | 1,281 |

Cross-edition guideline matching: **NASEMSO major 93.5%**, **NY Collaborative
87.1%**, **NY BLS 92.3%**.

Three new empirical detectors were added, each replacing something hardcoded:
`detect_section_names` (the template), `detect_boilerplate` (recurring non-
furniture lines such as New York's "Applies to adult and pediatric patients",
which sits between every title and its anchor), and `_looks_like_title`.

### 13.1 Anchor detection is a curated prior, not a general solution

**Stated plainly because the code could be mistaken for more than it is.**
`detect_guideline_anchor` tries a short list of known anchors first —
`aliases`, `criteria` — and only falls back to scoring.

Pure auto-detection was attempted and **failed three times**, and the failures
share a mechanism worth remembering: the scorer rewards "a title-like line sits
above this section", which cannot distinguish a title from short content. It
chose:

- `60–100` on NASEMSO v3.0 (6 occurrences, lucky perfect score) → 69 guidelines
  collapsed to 6;
- `key documentation elements` on NASEMSO, whose preceding lines are NEMSIS
  reporting codes (`9914165 – Other …`) → 68 guidelines, all titles garbage;
- `patient care goals` on NASEMSO v3.0, whose preceding lines are the alias
  list (`Loss of consciousness`) → 71 guidelines, all titles garbage.

**In every case the guideline COUNT looked plausible.** Only inspecting the
extracted titles revealed the boundaries were wrong. Counts are not a sufficient
check on segmentation, and any future publisher must have its titles inspected
by hand before its documents enter the corpus.

`PREREGISTRATION.md` §3.2 requires ≥ 4 publishers. Two are covered by the prior;
the remaining two will each need either a new entry in it or a genuinely general
detector. **This is the largest known limitation of the method as it stands.**

### 13.2 Dev numbers are stale again

Item counts moved on every document (NASEMSO v2.2 4,567 → 4,741; v3.0 5,047 →
5,534). Every tier and tail figure in §8–§11 predates this and must be recomputed
before use. NASEMSO major-pair guideline matching moved 98.4% → 93.5% for the
same reason.


---

## 14. Dev numbers recomputed — and a serious bug caught in the process

§13.2 flagged that item counts had moved and every tier/tail figure predated
the fix. Recomputing surfaced a second, more serious bug than the one being
fixed, caught only because the standing rule (§10) was applied to the very
first recompute.

### 14.1 The bug: unfiltered `detect_section_names` admitted noise

The first recompute of the NASEMSO major pair moved "requires more than an
identifier" from 10.2% to **19.2%** — a jump large enough to distrust on sight.
`T5_moved` alone was 17.6% of all old items, implausibly high. Inspecting
examples showed why:

```
universal care guideline/assessment/5#2  ->  universal care guideline/guideline/5
```

`section = "guideline"`. `detect_section_names` (added in §12 to generalise
across publishers) accepted any short, non-marker, title-cased line recurring
≥ 5 times, with no check that it behaved like a real template slot. On
NASEMSO v3.0 this admitted **~55 spurious "sections"** — guideline titles
apparently pulled from a table of contents (`general medical` 67×, `trauma`
47×, `bradycardia`, `cyanide exposure`, …), indistinguishable by count alone
from genuine slots (`quality improvement` 70×). One of them, `guideline` (7×,
the tail of wrapped "Universal Care Guideline" titles), became a phantom
section that every item under it was compared against, corrupting T4/T5.

**Frequency could not separate real slots from noise** — noise counts (67, 81)
overlapped the real range (59–72) directly. The working discriminator was
**spacing relative to the document's own known anchor**: a real template slot
fires once per guideline, so its occurrences are spaced at least as far apart
as the anchor's; noise clusters more densely. Measured on NASEMSO v3.0, real
slots have a minimum gap of 70–87 lines; noise candidates had minimum gaps of
2–39 lines — under half the anchor's. This is a *ratio*, not an absolute line
count, which is what lets it generalise: NASEMSO's guidelines run far longer
than New York's (anchor min-gap ~85 vs ~16), so an absolute floor tuned to one
publisher would misclassify the other's genuine sections.

**Spacing alone still let one item through.** `guideline` (n=7) happened to
have all seven occurrences thousands of lines apart by chance, clearing the
spacing filter while remaining exactly the noise it was meant to catch. A
second, independent condition closed it: occurrence **count** close to the
anchor's own count, since the anchor's count *is* the guideline count and a
real slot fires once per guideline. `n=7` against an anchor count of 69 fails
this cleanly. A third leak (`september 8, 2017`, a Revision Date *value* that
legitimately recurs once per guideline and therefore passed both structural
filters) needed a `_DATE_LINE` check, since no spacing or count property
distinguishes a value from a header.

Three filters were needed, not one, and each was found only because the
previous fix's result was inspected rather than trusted:

1. count ≥ `min_reuse` (unchanged from §12);
2. count ≥ 50% of the anchor's own count;
3. minimum gap ≥ 40% of the anchor's minimum gap;
4. not a date line.

Verified clean on all seven documents: NASEMSO now discovers **zero**
non-hardcoded section names on every edition. New York's non-hardcoded
discoveries (`criteria`, `cfr stop`, `medical control considerations`, …) are
retained, and are genuine per-provider-level structure, not noise — confirming
the filter separates the two correctly rather than simply rejecting everything
unfamiliar.

### 14.2 Corrected dev numbers, all four edition pairs

| | NASEMSO minor<br>v2.0→v2.2 | NASEMSO major<br>v2.2→v3.0 | NY Collaborative<br>v25.1→v26.0 | NY BLS<br>v25.1→v26.0 |
|---|---|---|---|---|
| Old → new items | 4,745 → 4,567 | 4,567 → 5,047 | 2,194 → 2,156 | 1,224 → 1,281 |
| T1 id exact | 92.6% | 40.6% | 26.6% | 75.7% |
| T2 id, text changed | 2.1% | 26.4% | 14.9% | 10.7% |
| T3 renumbered | 1.0% | 3.9% | 9.1% | 2.6% |
| T4 reworded | 0.0% | 1.2% | 0.7% | 0.1% |
| T5 moved | 0.5% | 6.5% | 29.5% | 5.7% |
| T6 unmatched | 3.8% | 21.3% | 19.1% | 5.1% |
| **Trivially alignable** | **94.7%** | **67.0%** | **41.5%** | **86.4%** |
| **Needs more than an ID** | **1.5%** | **11.7%** | **39.3%** | **8.4%** |

### 14.3 A caveat on NY Collaborative that must not be reported without it

**39.3% is not a clean number.** Guideline title extraction resolves only
55/62 (old) and 56/63 (new) NY Collaborative guidelines — roughly 11%
`<untitled@N>`. Items under an unresolved guideline carry a placeholder in
their `item_id` (`untitled 152`, `untitled 153`, …) that differs by
coincidence of position across editions, so they can never match on
identifier and fall through to text-similarity matching. Inspecting T5
examples confirmed this directly:

```
untitled 152/criteria/•  ->  untitled 153/criteria/•
```

Same content, same section, genuinely the same recommendation — reported as
"moved" only because neither side has a real guideline name. **A meaningful
share of NY Collaborative's 39.3% is title-extraction debt, not evidence about
revision difficulty**, exactly the same class of problem §11 diagnosed and
fixed for NASEMSO's two long titles. It has not yet been fixed for New York.
NASEMSO major (67.0% trivially alignable, titled 68/69) is comparatively
trustworthy; NY Collaborative is not, until this is addressed.

### 14.4 Major-pair tail decomposition, recomputed

| Cause | n | % of tail |
|---|---|---|
| U1 guideline unmatched | 322 | 33.1% |
| U2 section absent | 159 | 16.4% |
| U3 near miss | 53 | 5.5% |
| U4 consumed rival | 104 | 10.7% |
| U6 weak distant match | 219 | 22.5% |
| U5 no candidate | 115 | 11.8% |

**U5 (defensible deletion) held at 2.5% of old items (115/4,567)** — identical
to §10's figure before this entire round of section-detection changes. That
stability across a substantial rewrite of the matching pipeline is a genuine,
useful consistency check: the deletion estimate is not an artefact of the
matching machinery around it.

**U1 rose to 33.1% of the tail** and needs the same treatment as §14.3: it is
dominated by unresolved guideline titles, not genuine unmatched content, and
should not be read as evidence until title extraction is more complete.

### 14.5 What this changes going forward

1. **Every dev number now stated in this document is current as of commit
   pinned at the top of §15's changelog entry** (see `PREREGISTRATION.md`
   "Current code state").
2. **Guideline title extraction is the dominant remaining source of noise**
   across both publishers, not the alignment method itself. `_title_before`
   and `_looks_like_title` (§13) were tuned against NASEMSO and need the same
   inspect-and-fix treatment for New York before its numbers can be trusted.
3. **§10's standing rule earned its keep again.** A recompute that was
   expected to be routine surfaced a bug larger than the one motivating it.
   The rule — inspect intermediate output before reporting any number that
   moves — should be applied to every remaining recompute, not treated as
   satisfied by having been written down once.


---

## 15. New York title extraction fixed — most, not all, of the debt clears

§14.3 flagged that NY Collaborative's 39.3% figure was substantially inflated
by unresolved guideline titles (7 of 62/63, ~11%), the same class of defect
§11 fixed for two NASEMSO titles but not yet for New York. Diagnosed and
mostly fixed.

### 15.1 Three distinct causes, two fixed

Inspecting all 7 untitled cases directly (not inferred) found:

**Cause 1 (4 of 7): boilerplate detection only catches exact, frequent
strings.** New York's "Applies to ... patients ..." scope line has a dozen
audience-specific wordings — `Applies to adolescent patients only`,
`Applies to pediatric patients under 2 years of age`, `Applies to adult
patients only` — and only the single most common exact string (`Applies to
adult and pediatric patients`, 36×) cleared `detect_boilerplate`'s 20-
occurrence floor. The rarer variants survived as ordinary lines and broke the
title walk before it reached the real title above them. **Fixed** with a
pattern (`_SCOPE_LINE = r"(?i)^applies\s+to\s+.{0,60}patients?"`) matched
by structure rather than frequency, so a wording seen once is still caught.

**Cause 2 (1 of 7): a cross-reference line with no recognisable title shape**
(`"Dif Breathing – Pediatric: Stridor"`, in curly quotes) sat between the real
title and the anchor. A leading curly quote fails `_looks_like_title`'s
alphabetic-start check, and the original code stopped at the *first*
non-title line regardless of whether any title text had yet been found —
producing an empty result instead of looking one line further back. **Fixed**
with a bounded skip: up to 3 leading junk lines may now be passed over while
nothing has been collected yet; once real title text *is* collected, the
original strict stop-at-first-non-title behaviour applies unchanged. The
bound exists specifically so this cannot degrade into an unconditional walk
into unrelated prose.

**Cause 3 (2 of 7, and 2 remain): not title-extraction bugs.** One is the
document's own front-matter/introduction, correctly not a guideline. The
other is a nested, lowercase `criteria` appearing mid-protocol — genuinely
ambiguous document structure (§12's tail decomposition already flagged this
kind of case), not something a title-extraction fix should paper over.

### 15.2 Verified clean, no regression

| | before | after |
|---|---|---|
| NASEMSO (all 3 editions) | 68/69 titled | **68/69 titled — unchanged** |
| NY Collaborative v25.1 / v26.0 | 55/62, 56/63 | **60/62, 61/63** |
| NY BLS v25.1 / v26.0 | 48/52, 54/58 | **51/52, 57/58** |

### 15.3 Recomputed tiers

| | NY Collaborative<br>v25.1→v26.0 | NY BLS<br>v25.1→v26.0 |
|---|---|---|
| | before → after | before → after |
| Trivially alignable | 41.5% → 44.0% | 86.4% → **90.9%** |
| **Needs more than an ID** | 39.3% → **36.8%** | 8.4% → **4.2%** |
| Unmatched | 19.1% → 19.1% | 5.1% → 4.9% |

**NY BLS improved sharply and cleanly** — consistent with the fix addressing
genuine title debt rather than moving noise around.

**NY Collaborative improved only modestly.** T5 (moved) barely changed
(29.5% → 26.8%), which is the honest result to report rather than the one
that would look best: most of NY Collaborative's difficulty is not an
extraction artefact. Two plausible reasons, not yet distinguished: real
matching difficulty in a more heavily revised document (this is, after all,
the *content*-facing collaborative protocol set, plausibly revised more than
the *procedural* BLS set), or residual noise from the two still-untitled
cases. **NY Collaborative's 36.8% should be read as more trustworthy than
39.3% was, but not yet as clean as NASEMSO or NY BLS's figures.**

### 15.4 Updated read on the corpus overall

Across four edition pairs, two publishers, three of which are now reasonably
clean:

| | NASEMSO minor | NASEMSO major | NY Collaborative | NY BLS |
|---|---|---|---|---|
| Needs more than an ID | 1.5% | 11.7% | 36.8%⚠ | **4.2%** |
| Title debt remaining | minimal | minimal | 2/62 untitled | 1/52 untitled |

The spread across pairs (1.5% to 36.8%) is now more likely to reflect genuine
variation in revision practice than parser noise — which is itself a finding
worth keeping: **different protocol sets, and different documents within the
same set, appear to be revised with very different intensity**, and a single
"cross-edition alignment is X% hard" number would have hidden that.


---

## 16. Two more publishers retrieved — the prereg's publisher count is met, item-level generality is not

`PREREGISTRATION.md` §3.2 requires >= 4 publishers. Two more retrieved this
round, both with real consecutive editions, direct from the state site (no
Wayback needed for either):

| Publisher | Editions | Pages | Retrieval |
|---|---|---|---|
| **Connecticut** DPH statewide EMS protocols | v2025.1, v2025.2 | 284, 284 | `portal.ct.gov`, full version history back to 2016 listed directly on the protocols page |
| **Maine** EMS prehospital protocols | 2023, 2025 | 212, 223 | `maine.gov`, editions explicitly labelled "Archived" back to 2011 |

`corpus_probe` triage: Maine **STRONG** on both editions (1,625–1,739
numbered lines, 16–17% of non-blank lines); Connecticut **USABLE** on both
(573 numbered lines, 3.6%) — its own output correctly recommended inspecting
a sample before committing, which is what the rest of this section does.

**Publisher count: 4/4, satisfying §3.2 numerically.** Item-level parsing
does **not** yet generalise to either. Per §13.1's own standing instruction —
titles must be inspected by hand before a publisher's documents enter the
corpus — they were, and both failed the inspection.

### 16.1 Maine: wrong anchor chosen, and a different (real) structure found

Auto-detection selected `normal` as the guideline anchor. Titles extracted
under it (`Abnormal`, `Pulse`, `Elevated (>120) Elevated (>140) Blood
Pressure`) are vital-signs reference-table column headings, not protocol
titles, and only 19 "guidelines" were found — implausibly few for a 200+ page
protocol manual. Exactly the failure mode §13.1 already named: a scored
auto-detected anchor that looks structurally plausible and is not.

**A real, different structural signal was found and confirmed, not yet
implemented.** Maine prints the protocol name as a **running footer**,
formatted `<Protocol Name> #<page-within-protocol>` — confirmed directly:
`Respiratory Distress with Bronchospasm #3`, `Adult Cardiac Arrest #3`,
`Pediatric Tachycardia #2`, 37 distinct names recurring 2–3× each in a targeted
sample (an undercount — the check used one strict regex and Maine's protocol
count is almost certainly well over 60). This is closer to `_detect_running_
lines` than to `detect_guideline_anchor`: the footer *value* changes once per
protocol rather than being a constant, so it needs a new detection strategy —
find short lines that recur 2–4× consecutively before changing — not a
parameter tweak to the existing one. The "marker sits on its own line,
separate from its content" pattern spotted in one sample region was checked
and is **not** the general case (148 of 9,293 lines) and can be set aside.

### 16.2 Connecticut: fundamentally tabular, not marker-prose

Auto-detection selected `indications`, yielding 571 items across 284 pages —
implausibly sparse. Inspecting raw extraction shows why: Connecticut's content
is **dosing and triage tables** (drug/dose/monitoring-interval columns, tag-
colour triage grids), which linear text extraction fragments into many short
per-cell lines (`Tag Color`, `Yes`, `GREEN`, `Age < 1 year`) with no
recoverable row structure. Protocols are identified by a **numeric code**
(`2.15P Nerve Agents / Organophosphate Poisoning – Pediatric`), a third
distinct convention alongside NASEMSO's `Aliases` and New York's `CRITERIA`.

This is not a small fix. A table-heavy document needs block- or
table-aware extraction (e.g. PyMuPDF's structured/table APIs) rather than the
current line-stream model, which assumes content is fundamentally linear
prose with markers. Attempting a quick patch here would repeat the pattern
already seen twice this session — a plausible-looking fix that turns out
wrong on inspection — at higher stakes, since the underlying assumption is
architectural, not a threshold.

### 16.3 What this means for the study, stated plainly

Three distinct anchor/title conventions are now confirmed across four
publishers (`Aliases`, `CRITERIA`, and Maine's footer pattern), plus one
publisher (Connecticut) whose content isn't reliably line-based at all. This
is itself informative: **institutional EMS protocol documents do not share a
common machine-readable convention**, even among four public agencies in the
same domain. A general cross-publisher parser is a larger undertaking than
extending a curated anchor list, and `PREREGISTRATION.md` §13.1's framing —
"a curated prior, not a general solution" — is confirmed rather than merely
theoretical.

**Recommended path, not yet taken:** (a) implement footer-based anchor
detection for Maine, which is well-understood and scoped after this
diagnosis; (b) treat Connecticut as requiring a separate extraction strategy
and either defer it or invest in table-aware parsing as its own task; (c) do
not add either to `_KNOWN_ANCHORS` or claim §3.2 is satisfied in substance
until (a) is done and its titles are re-inspected.

**Do not use Connecticut or Maine item-level data for anything** — annotation
sampling, tier statistics, or the pre-registration's confirmatory test —
until this section is superseded by a dated update showing real titles.


---

## 17. Maine footer-based anchor detection implemented

§16.1 diagnosed but did not implement Maine's real structural signal: the
protocol name printed as a running page footer (`<name> #<page>`), rather
than a fixed label preceding a title as in NASEMSO (`Aliases`) or New York
(`CRITERIA`). Implemented now as `detect_footer_anchors` and
`_parse_footer_protocol`, gated to fire only when `_known_anchor_stats`
finds neither known anchor — so NASEMSO and New York cannot regress by
construction, not merely by testing.

### 17.1 Design

`#1` uniquely marks a protocol's first page, confirmed before relying on it:
45 occurrences on the 2025 edition, zero duplicate names, minimum spacing 38
lines. Because the title is printed on the anchor line itself, this needed no
backward title search — unlike `_title_before`, which exists specifically
because NASEMSO's and New York's titles sit on a *different* line from their
anchor.

Two furniture patterns needed explicit stripping before item extraction,
neither catchable by the existing `_detect_running_lines` (which requires
recurrence of the exact same string): continuation footers (`#2`, `#3`, …)
and a colour-coded chapter/page tag (`Blue 6`, `Red 3`) that changes every
page. Left unstripped, both would have been appended as junk continuation
text onto whichever item preceded them.

**Deliberately deferred:** sub-sectioning by certification level
(`EMT/ADVANCED EMT`, `PARAMEDIC`, …), which Maine's protocols do contain.
Reusing `detect_section_names` here would mean applying a filter that
explicitly documents itself as unreliable without a known-anchor calibration
— which, by construction, this document doesn't have. Rather than risk a
fourth plausible-looking-but-wrong result in this session, every item within
a protocol is extracted at one flat level (`section = "protocol"`), stated
as a named simplification rather than silently accepted as complete.

### 17.2 Verified

| | before | after |
|---|---|---|
| NASEMSO (all 3 editions) | 68/69 titled | **68/69 — byte-identical item counts, confirming zero regression** |
| NY Collaborative / BLS | 60-61/62-63, 51/52 | **unchanged** |
| Maine 2023 / 2025 | 19 guidelines, garbage titles | **39 / 42 guidelines, all titled, real protocol names** |
| Items contaminated with footer/colour-tag text | — | **0 / 1,720** |

All 42 titles in the 2025 edition were read by hand (`Adult Cardiac Arrest`,
`Stroke`, `Universal Pain Management`, `Do Not Resuscitate (DNR) Guidelines`,
…) — real, distinct protocol names, not table values or fragments.

### 17.3 Edition-pair alignment, Maine 2023 → 2025

| | |
|---|---|
| Trivially alignable | **89.1%** |
| Needs more than an ID | 6.2% |
| Unmatched | 4.7% |

In the same range as NASEMSO's minor bump (94.7%) and NY BLS (90.9%) — Maine
2023→2025 reads as a moderate, not a drastic, revision. This is now usable
alongside NASEMSO and NY for the study.

### 17.4 Publisher status, corrected

| Publisher | Item-level status |
|---|---|
| NASEMSO | usable |
| New York (Collaborative, BLS) | usable, NY Collaborative caveated per §15.3 |
| **Maine** | **usable as of this section** |
| Connecticut | **not usable** — tabular content, needs table-aware extraction (§16.2), unchanged |

Three of four publishers now have trustworthy item-level data — a real
improvement on §16's honest "2 of 4," though `PREREGISTRATION.md` §3.2's
requirement of ≥ 4 usable publishers is still not fully met until Connecticut
is addressed or a fourth is substituted.


---

## 18. Connecticut table extraction fixed via ToC row-alignment

§16.2 diagnosed but did not fix Connecticut: no repeating per-page anchor
exists (unlike NASEMSO's fixed label or Maine's per-page footer), and its
content is dosing/triage tables that linear extraction fragments into short
per-cell lines. Fixed by using the document's own embedded Table of Contents
instead of anything in the body text.

### 18.1 Design: three techniques, each verified before being relied on

**The ToC exists and is real**, spanning pages 2–7, listing every protocol
with a target page number. It was not the first signal tried — an embedded
PDF outline (851 bookmark entries, several literally titled
`Protocol2.27_NEW_Hospice_complete.pdf`, preserving the source files' names
from whatever process merged them into one document) looked promising but
was a dead end: every resolvable entry had `page: -1`, an unresolved
destination, useless for locating content.

**Row alignment could not use text order.** PyMuPDF's plain extraction
groups a ToC table's cells by *column* — all protocol codes first, then all
names, then all page numbers, each top-to-bottom — a layout artefact of the
source table. Positional `zip()` was tested and rejected: per-page counts of
codes/names/page-numbers do not match (25/28/27 measured on one page), so
naive zipping would silently misalign rows. Rows are instead recovered by
**Y-coordinate grouping** via `get_text('dict')`, matching each span's
vertical position to others on the same visual row regardless of text-stream
order.

**The printed-to-physical page offset was calibrated, not assumed.** A body
page's own footer prints its page number; physical (0-indexed) page 55 was
confirmed to end with the footer line `"56"` — `printed = physical + 1` —
before building anything on top of it.

### 18.2 Two bugs found by inspecting output, not by trusting the guideline count

Consistent with every prior fix this session, and directly consistent with
`PREREGISTRATION.md` §10: the first working version produced item counts
identical to the *broken* pre-fix version (571, both times) — distrusted on
sight, and correctly so.

1. **Dotted leaders use Unicode ellipsis (`…`), not ASCII periods.** The name
   regex matched only `\.{4,}`, so it anchored at the first run of 4+ literal
   periods rather than the true end of the leader, leaving straggler
   `……………` characters inside every captured title (`"Dedication and
   Acknowledgement……………………………...….....") until inspected. Fixed to match
   `[.…\s]{4,}`.
2. **Bullets sit on their own line, separated from their content** (`•` on
   one line, the clinical text on the next) — the same phenomenon checked
   and correctly ruled out as negligible for Maine (148/9,293 lines, 1.6%)
   is **dominant** for Connecticut: 1,689 of 14,159 lines, 11.9%, on the
   *correct* line set. A first measurement against the wrong canonicaliser's
   output showed a clean 85/12,674 and nearly went unquestioned — caught
   only by noticing `_clean_to_canonical` and `_ct_clean_with_pages` strip
   different furniture and therefore index lines differently, so a check
   against one function's line numbers is meaningless against the other's
   line list. Fixed with `_merge_bare_markers`, folding a bare-marker line
   onto the following non-empty line before classification. This one bug
   accounted for the bulk of the improvement below.

**A third apparent bug was investigated and found to be a mistake in the
diagnostic script, not the code.** A span inspected under a `'Stroke' in
title` filter showed Exertional Heat Stroke content — `'Stroke'` matches
both `Exertional Heat Stroke` and `Stroke – Adult & Pediatric` as a
substring, and `[0]` silently took the first (wrong) match. Re-checked
against the exact title, `Stroke – Adult & Pediatric`'s span contains real,
correctly located stroke content (`BE-FAST Stroke Scale`, `Stroke Alert`).
Recorded because a careless test is exactly the kind of thing that
manufactures a false "still broken" finding, which is as costly as a false
"it works."

### 18.3 Verified

| | before (broken) | after |
|---|---|---|
| Guidelines found | 73 (wrong anchor, `indications`) → 120 (ToC, dirty titles) | **125, clean titles** |
| Items | 571 | **2,240** |
| Zero-item guidelines | majority | **15/125** — mostly genuine front matter (`Preface`, `Appendix 3: Scope of Practice`) or protocols written as unmarked prose rather than numbered steps, not extraction failures |
| Boilerplate contamination | — | **0/2,240 items** |
| NASEMSO (3 editions), NY (2 sets), Maine (2 editions) | — | **byte-identical item counts — zero regression** |

Titles read clean: `Abdominal Pain`, `Allergic Reaction/Anaphylaxis – Adult`,
`Dedication and Acknowledgement`.

### 18.4 Edition-pair alignment, Connecticut v2025.1 → v2025.2

| | |
|---|---|
| Trivially alignable | **96.8%** |
| Needs more than an ID | 2.2% |
| Unmatched | 1.0% |

A same-year quarterly revision, and the number reads as a small update —
consistent with the minor-bump pattern already seen in NASEMSO (94.7%) and
Maine (89.1%). Usable alongside NASEMSO, New York, and Maine.

### 18.5 Publisher status, corrected again

| Publisher | Item-level status |
|---|---|
| NASEMSO | usable |
| New York (Collaborative, BLS) | usable, Collaborative caveated per §15.3 |
| Maine | usable |
| **Connecticut** | **usable as of this section** |

**All four retrieved publishers now have trustworthy item-level data.**
`PREREGISTRATION.md` §3.2's ≥4-usable-publisher requirement is met in
substance, not merely in document count, for the first time this session.

### 18.6 Honest residual limitations

- Connecticut's guideline segmentation depends on its embedded ToC existing
  and being well-formed. This is a **fourth distinct detection strategy**
  (fixed section label / per-page footer counter / ToC row-alignment),
  confirming §16.3's finding that no common convention exists even within
  one domain — now demonstrated four ways instead of three.
- Item density per protocol is genuinely lower and more variable than
  NASEMSO or Maine's, for two different real reasons conflated in raw
  counts: table-heavy protocols (few numbered lines exist in the source) and
  prose-written protocols (steps exist but are declarative sentences, not a
  numbered list). Any future analysis comparing item counts across
  publishers should account for this rather than reading a lower count as
  worse extraction.
- 15 zero-item guidelines were spot-checked in aggregate by category, not
  individually confirmed one by one; a small number could still be genuine
  gaps rather than front matter or prose-only content.


---

## 19. Contamination finding: no publisher currently qualifies as held-out test data

Before building the annotation instrument, checked whether the four retrieved
non-NASEMSO publishers actually satisfy `PREREGISTRATION.md` §3.4's
quarantine. **They do not.**

### 19.1 What happened

Generalising the item parser to New York, Maine and Connecticut required, in
each case, reading that publisher's actual document structure and writing
code in direct response to what was found:

| Publisher | What was inspected | What was built in response |
|---|---|---|
| New York | Untitled-guideline cases, read line by line | `_SCOPE_LINE`, the bounded junk-skip in `_title_before` |
| Maine | The `#1`/`#2`/`#3` footer text, `Blue N` tags, "Applies to…" variants | `detect_footer_anchors`, `_parse_footer_protocol`, `_COLOR_TAG_LINE` |
| Connecticut | The ToC table layout, the legal disclaimer's wrapping, bullet-on-own-line pattern | `_ct_toc_entries`, `_ct_clean_with_pages`, `_merge_bare_markers`, `_CT_BOILERPLATE` |

This is precisely what §3.4 prohibits: *"no threshold, regex, matcher
parameter or tier definition may be modified in response to anything observed
in a test document."* Every commit implementing cross-publisher support did
exactly that, and did so necessarily — a footer-based anchor cannot be written
without reading a footer.

### 19.2 Why this was not caught earlier

§3.1 designated NASEMSO alone as dev, on the reasoning that it generated the
study's hypotheses. That framing implicitly assumed the *method* would be
fixed and applied blind to new documents — the standard train/test posture.
It did not anticipate that **the extraction method itself would need
publisher-specific engineering**, discovered only once retrieval moved beyond
NASEMSO. Once that became true, every publisher touched during generalisation
work became dev-like by construction, regardless of intent.

### 19.3 What this means concretely

**None of the four retrieved publishers currently qualify for §5's
confirmatory sampling.** NASEMSO was always dev. New York, Maine and
Connecticut are now dev in substance too, however they were labelled at
retrieval time. Genuine test data requires editions that have not been
inspected during any of this session's parser-development work — either from
these same four publishers (a fresh pair not yet looked at) or from new
publishers entirely.

### 19.4 The path forward, not yet taken

The parser now implements three general strategies (fixed section anchor,
per-page footer counter, ToC row-alignment). A genuinely blind test is
possible going forward under a specific discipline: retrieve a new pair, run
`corpus_probe` and `parse()` **without modification**, and include it in the
test set only if an existing frozen strategy resolves it with clean titles.
If none do, that publisher is documented but excluded from confirmatory
testing rather than triggering a fourth hand-tuned strategy — which would
just reproduce this same contamination on the next document.

This is a real scope change, not a footnote, and is left for explicit
decision rather than resolved silently.


---

## 20. Annotation instrument built and dry-run verified — real sampling still blocked

Following §19's contamination finding, the annotation *mechanics*
(`annotation.py`: stratified sampling, packet generation, Cohen's kappa) were
built and dry-run end to end against dev data. **No output from this section
is confirmatory** — it verifies the tooling works, not any study result.

### 20.1 A second arithmetic bug in the pre-registration itself, caught by the dry run

`PREREGISTRATION.md` §5.1 originally read "60 old items... 12 per tier
T1–T5, T6 shortfall redistributed" — internally inconsistent: 12 × 5 already
equals 60 with T6 excluded from the flat allocation, yet §6 names deletion
recall/precision as a primary metric, which cannot be computed without T6
samples. A literal implementation (12 from *every* tier including T6) drew
**72 items, not 60** on the first dry run — caught by checking the total
against the stated target, not by trusting the number. Corrected to **10
items per tier across all six tiers**, T6 on equal footing with T1–T5, in
both the pre-registration text and the code (§11 carries the dated
correction).

### 20.2 Verified, on dev data, dry run only

| Check | Result |
|---|---|
| Total sample size | **60/60** after the fix (was 72/60 before) |
| Shortfall redistribution | Tested on NY BLS, whose T4 has only 1 item total: shortfall of 9 flowed entirely to T1 (the largest remaining pool), landing at 19 drawn there — total still exactly 60 |
| Packet content | Real item text, real guideline context, correct structure (spot-checked directly) |
| Context file | Full corresponding new-edition guideline attached per sample, not just the single predicted match — §5.2's requirement |
| Cohen's κ | Tested against two synthetic completed packets with a known 9/60 disagreement pattern: recovered `observed_agreement = 0.85` (51/60) exactly, `κ = 0.8443` |

### 20.3 What remains blocked

Per §19: **no output of an eventual real run of this instrument may be
treated as confirmatory** until a genuinely unread edition pair exists,
under the discipline in §19.4. Building the instrument now, ahead of that,
was possible because tooling construction is not itself a confirmatory use —
but the moment valid test data exists, annotation can begin immediately
rather than waiting on further engineering.


---

## 21. First genuine blind test: Delaware BLS, retrieved and run unmodified

Following §19's contamination finding, the discipline in §19.4 was applied
for the first time: retrieve a publisher untouched by any of this session's
development work, run the existing pipeline **with zero code changes**, and
report whatever comes out.

### 21.1 Retrieval

Delaware DPH BLS statewide protocols, 2022 and 2024 editions, both real PDFs
(103 pages each), retrieved directly from `dhss.delaware.gov`. Genuinely
untouched — no code in this repository was written with knowledge of this
document's content. (A companion ALS 2022→2024 pair was sought from the same
page but the 2024 link 404s under a generic WordPress page; not pursued
further, since the BLS pair alone is sufficient for a first blind test.)

### 21.2 Result: the frozen pipeline does not generalise, honestly

```
corpus_probe verdict:  USABLE (not STRONG) on both editions — 6.0% numbered
                        lines, only 1 template slot discovered
parse() anchor chosen: "follow general patient care protocol." — a body-text
                        sentence fragment, not a structural marker
guidelines found:      15 / 16
titled:                8 / 16 (2024) — roughly HALF are <untitled@N>
```

None of the three frozen strategies (fixed section anchor, per-page footer
counter, ToC row-alignment) fit Delaware's actual structure. The auto-detect
fallback did what §13.1 said it would: produced a plausible-looking anchor
that is wrong, exactly as it did for Maine's `normal` and Connecticut's
`indications` before those were fixed by hand.

### 21.3 The discipline: excluded, not fixed

**This result is not fixed.** Per §19.4, inspecting Delaware's content
further and writing a fourth detection strategy would reproduce the exact
contamination this test exists to avoid. Delaware BLS is therefore
**documented and excluded from the test set**, not repaired.

This is the correct and, importantly, the *useful* outcome of an honest
blind test — it demonstrates the test methodology can produce a negative
result, not only positive ones. A blind test that only ever confirms the
method would not be a test.

### 21.4 What this implies

The three strategies built during §12–§18 generalise across four publishers
sharing enough structural similarity (all four, on inspection, turned out to
have *some* per-protocol recurring marker — a label, a footer, or a ToC —
even though the specific marker differed each time). Delaware apparently
does not share that property, at least not one the existing strategies
recognise. **The honest characterisation of the current parser is "handles
several concrete conventions," not "generalises to institutional clinical
protocols broadly."** That is a real limitation of the corpus-building work
as it stands, not a defect to be quietly patched away.

**The test-set search continues.** One genuine negative result is a valid,
useful outcome, but is not yet a test set — `PREREGISTRATION.md` §3.2 needs
≥ 4 pairs (minimum viable) or ≥ 6 (target) that actually work, and Delaware
demonstrates that not every retrieval attempt will produce one.


---

## 22. Second blind-test round: three attempts, zero clean additions to the test set

Continuing §21's discipline exactly: retrieve a publisher untouched by any
code in this repository, run `corpus_probe` and `parse()` with **zero
modification**, report whatever comes out, do not fix failures.

### 22.1 Wisconsin — inaccessible, not a test result

Two dated editions exist on `dhs.wisconsin.gov` (2021, 2023, same document
number P-02875), but both URLs resolve to a Drupal HTML landing page rather
than the PDF itself, even with a referer header set. Not a blind-test
outcome either way — the document was never retrieved. Not pursued further
today; a different retrieval path (browser-rendered download, not curl)
would be needed.

### 22.2 South Carolina — failed, same mechanism as Delaware

Real edition pair retrieved (EMS Clinical Operating Guidelines, Aug 2025 and
Nov 2025, both real PDFs, 262 pages). `corpus_probe`: **WEAK** on both
(1.5% numbered lines). `parse()` chose `differential` as the anchor —
genuinely a recurring label, but a **differential-diagnosis flowchart
heading**, not a protocol title. Guideline "titles" extracted under it are
diagnosis-criteria fragments (`Weakness Dehydration Deep / rapid
breathing`, `Irritability`, `Sepsis`), not protocol names. 46 of 72 (64%)
guidelines came back with zero items. **Not fixed** — documented and
excluded, per §19.4.

### 22.3 Rhode Island — the interesting case: real titles, real coverage gap

Real edition pair retrieved (2022 via a third-party mirror hosting the
original state PDF, 2026 direct from `health.ri.gov`; both genuine
multi-page text-layer PDFs — an initial file-size/page-count mismatch on the
2022 file turned out to be a `file`(1) metadata quirk, not a scan, confirmed
directly against PyMuPDF's own page count).

**Where the anchor fires, it is genuinely correct.** `parse()` chose
`indication` and produced clean, real, correctly-scoped titles: `Procedure -
Cricothyrotomy`, `Vascular Access - Peripheral Intravenous Access`,
`Procedure - Continuous Positive Airway Pressure (CPAP)`. 47 of 49
guidelines titled (96%) — the best title ratio of any blind attempt so far,
better even than some of the hand-tuned dev publishers on first pass.

**But 44.3% of items (101 of 228) land under `<preamble>`** — everything
before the document's first `indication` anchor, which does not fire until
well into the document. Inspecting those items shows real content, not
noise: scope-of-practice material (`Training and Education Plan`,
`Continuous Quality Improvement Program`) and genuine EMR/EMT skill items
(`Basic patient assessment`, `Airway maintenance utilizing the head-tilt
chin lift`) that never get attached to any guideline. The downstream
edition-pair alignment confirms the damage: **65.0% unmatched** — far higher
than any other publisher's honest T6 rate — directly attributable to the
unattributed preamble content corrupting the comparison.

**Not fixed.** This is a genuinely different failure mode from Delaware and
South Carolina — the title mechanism itself works — but the practical
consequence (most of the document's content is unusable) is the same:
Rhode Island is **not currently usable as clean test data**.

### 22.4 Running total across all genuine blind attempts

| Publisher | Anchor found | Titles | Verdict |
|---|---|---|---|
| Delaware (§21) | body-text fragment | ~50% garbage | **Failed** |
| Wisconsin | — | — | **Inaccessible** (not tested) |
| South Carolina | real label, wrong content class | ~64% garbage | **Failed** |
| Rhode Island | genuinely correct | 96% real | **Partial — unusable due to preamble gap** |

**Zero of three genuine blind attempts this round produced clean, usable
test data.** Combined with §21, that is zero clean additions across four
attempts total. This is itself the honest finding: generalising the three
frozen strategies to arbitrary, previously unseen institutional protocol
documents is materially harder than the four already-fitted publishers
suggested, and the search for a valid test set is the current bottleneck —
not the annotation tooling, which has been ready since §20.

### 22.5 What Rhode Island suggests, without acting on it

Unlike Delaware and South Carolina, Rhode Island's failure has a specific,
nameable shape: **content preceding the first anchor occurrence is silently
orphaned.** That is a generic risk in the anchor-marks-a-boundary design
used by every strategy so far (NASEMSO, New York, Rhode Island all share
it — Maine and Connecticut do not, because their boundary detection works
differently). Naming this is not the same as fixing it; per §19.4's
discipline, it is recorded as a candidate explanation for future
investigation, not acted on now, because acting on it would mean writing
code in response to Rhode Island's specific content — exactly the
contamination this round exists to avoid.


---

## 23. Third blind-test round: Vermont, plus two dropped candidates

Continuing the identical discipline. Two candidates were retrieved but
dropped before testing because a genuine edition PAIR could not be
confirmed (no fix attempted on either — this is a retrieval gate, not a
parser judgement):

- **Wisconsin** — still inaccessible (§22.1's Drupal file-node problem
  persists; not retried).
- **Alabama** — the current (11th) edition is real, but the 10th edition
  (2022) URL found via search is dead (404, served as HTML), and the live
  rules-and-protocols page links only the current edition. No second
  edition found without further search; dropped rather than proceeding with
  a single-edition non-pair.

### 23.1 Vermont — real content, a third distinct failure mode

Real pair retrieved: `VTEMS Protocols 2023 - Hyperlinked.pdf` (the correct
URL, found on the actual policies page after a first guessed filename
404'd) and the 2025 edition, both genuine multi-page PDFs (270 and 283
pages). `corpus_probe`: USABLE on both. `parse()` chose `adult & pediatric`
as anchor and found **44/44 and 58/58 titled — 100%, zero
`<untitled@N>` entries in either edition**, the cleanest title-coverage
result of any blind attempt so far.

**But inspecting the full title list reveals two distinct structural
problems, not one:**

1. **Certification-level subsection headers captured as titles**, not real
   protocol names — `PARAMEDIC STANDING ORDER – ADULT & PEDIATRIC PARAMEDIC
   EXTEN…`, `EMT/ADVANCED EMT/PARAMEDIC EXTENDED CARE ORDERS Diabetic
   Eme…`. The anchor phrase legitimately appears in these subsection labels
   too, and nothing distinguishes "the anchor marking a new protocol" from
   "the anchor appearing inside a certification-level header within an
   existing one."
2. **Single real protocols fragmented into multiple guideline entries** —
   `Burns/Electrocution/Lightning` appears 3 times in the guideline list,
   `Restraints` 3 times, `Traumatic Brain Injury` and `Traumatic Cardiac
   Arrest (TCA)` twice each. The anchor recurs *within* one protocol's
   multi-page span (once per certification level, or once per adult/
   paediatric split within the same protocol) rather than marking only its
   start, so each recurrence wrongly opens a new guideline.

Sample item content is genuine and correctly extracted where it lands
(`Epinephrine (1 mg/mL): Patient < 25 kg: Administer 0.15 mg (0.15 mL) IM`)
— this is not a content-extraction failure, only a boundary one, similar in
spirit to Rhode Island but via fragmentation rather than omission.

**Downstream damage is comparable to Rhode Island's despite the different
mechanism:** old/new item counts are wildly asymmetric (1,525 vs 715 — the
2023 edition yields more than double the 2025 edition's items, tracking the
raw marker-density gap already visible in `corpus_probe`'s 7.4% vs 3.1%),
and edition-pair alignment shows **65.4% unmatched** — within 0.4 points of
Rhode Island's 65.0%, despite Vermont having zero preamble leakage and
100% title coverage where Rhode Island had 96% titles and a 44% preamble
gap. Two structurally different failures converge on almost the same
downstream damage.

**Not fixed.** Documented and excluded, per §19.4.

### 23.2 Running total, all rounds

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | not computed (anchor itself was garbage) | **Failed** |
| South Carolina | ~36% | — | not computed (anchor itself was garbage) | **Failed** |
| Rhode Island | 96% | 44.3% preamble | 65.0% | **Partial — unusable** |
| Vermont | **100%** | fragmentation, not preamble | 65.4% | **Partial — unusable** |

Six genuine blind attempts, zero clean additions to the test set. The two
"partial" cases are the most informative failures so far — both have title
mechanisms that mostly or entirely work, yet both land at essentially the
same ~65% unmatched rate through unrelated mechanisms. That convergence is
worth noting without reading too much into two data points: it may mean
~65% is roughly what "the anchor mechanism basically works but has one
uncorrected structural gap" costs in this document class, or it may be
coincidence.

### 23.3 What this round adds to the standing conclusion

§22.4's finding stands and sharpens: retrieval, not annotation tooling, is
the bottleneck, and near-misses (Rhode Island, now Vermont) are accumulating
faster than clean passes. Two different generic risk categories are now
named without being acted on:

- **Boundary omission** (Rhode Island) — content before the first anchor
  occurrence is orphaned.
- **Boundary over-firing** (Vermont) — the anchor recurs inside a single
  protocol's span and wrongly re-opens a new guideline each time.

Both are candidate targets for a **general** fix (not a per-publisher patch)
if and when that work is deliberately undertaken — see the user's standing
instruction to defer this. Recorded here so the two concrete cases exist to
test any future fix against, rather than needing to be re-discovered.


---

## 24. Fourth blind-test round: Tennessee — the first genuine clean pass

Continuing the identical discipline. Two candidates dropped before testing
(retrieval gate, no fix attempted): **Georgia** has no statewide protocol
document of any kind — the state explicitly defers to NASEMSO's model
guidelines rather than publishing its own, confirmed via its own EMS page;
**Ohio**'s only located "prior" file
(`ems_Guidelines-Procedures-Manual_STROKE.pdf`) is a 252 KB topic-specific
stroke addendum, not a full prior edition (the current manual is 3.4 MB) —
no genuine pair found.

### 24.1 Tennessee — clean

Real pair retrieved: EMS Protocol Guidelines, July 2017 (revised
11.7.2017) and March 2018 (Rev 7.7.18), both directly from `tn.gov`.
`corpus_probe`: **STRONG** on both (22.8% / 20.4% numbered lines — the
highest density of any blind attempt). `parse()` chose `assessment` as
anchor.

| | 2017 | 2018 |
|---|---|---|
| Guidelines | 70 | 70 |
| Titled | 69 (98.6%) | 69 (98.6%) |
| Items | 1,500 | 1,492 |

Titles read as genuinely real and distinct throughout —
`Acute Coronary Syndrome/STEMI`, `Ventricular Tachycardia with a Pulse`,
`Electrocution / Lightning Injuries` — inspected in full, not sampled.
**Zero duplicate guideline titles** (no fragmentation, unlike Vermont).
**5.0% preamble leakage** (75/1,492 items), well below Rhode Island's 44.3%.
**Only 2 of 70 guidelines (2.9%) have zero items**, far below every prior
blind attempt.

**Edition-pair alignment confirms it:**

| | |
|---|---|
| Trivially alignable | **92.7%** |
| Needs more than an ID | 4.6% |
| Unmatched | **2.7%** |

Comparable to NASEMSO's minor bump (94.7%) and NY BLS (90.9%) — a
well-behaved, honestly-measured minor revision. Furniture-contamination
spot check: effectively zero (1/1,492, and that one is an incidental
substring match, not real contamination).

**This is the first genuine clean addition to the test set** across five
rounds of blind testing (Delaware, South Carolina, Rhode Island, Vermont,
now Tennessee).

### 24.2 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | **98.6%** | **5.0% preamble, 0 fragmentation** | **2.7%** | **CLEAN — usable** |

Seven genuine blind attempts, **one clean pass.** Georgia and Ohio dropped
at retrieval (no valid pair exists to test). Wisconsin and Alabama remain
inaccessible/incomplete from prior rounds.

Test-set status against `PREREGISTRATION.md` §3.2: **1 pair, 1 new
publisher** (Tennessee) usable so far from blind testing, on top of the
pre-existing (contaminated, dev-only) NASEMSO/NY/Maine/CT corpus. Minimum
viable (4 pairs, 3 publishers) is not yet met from genuinely blind data
alone; the search continues.


---

## 25. Fifth blind-test round: Kentucky — a formulary masquerading as a protocol document

Real pair retrieved: Kentucky State EMS Protocols, September 2021 and
2025-04-30, both directly from `kbems.ky.gov`, both real multi-page PDFs
(412 and 426 pages). `corpus_probe`: WEAK on both (1.7% numbered lines).
`parse()` chose `class` as anchor, found 46/46 and 51/51 titled — 100% on
both, no `<untitled@N>` — which looked promising by the numbers alone.

**Inspection shows why the numbers lied.** The titles are drug names, not
protocol names: `ADENOSINE`, `ALBUTEROL`, `AMIODARONE`, `ATROPINE SULFATE`,
`CEFAZOLIN (ANCEF)`. `class` is a real, recurring label — but it belongs to
a **medication formulary appendix**, not the clinical protocol body. **290
of 293 items (99.0%) land under `<preamble>`** — the actual 412-page
protocol document is essentially entirely unattributed; only the small
drug-reference appendix was ever captured.

This is a variant of the omission failure named for Rhode Island (§22.5),
but total rather than partial: where Rhode Island lost 44% of its document
to the gap before the first anchor, Kentucky loses essentially all of it,
because the only structural marker the frozen strategies could find belongs
to a small appendix rather than the main body.

**Not fixed.** Documented and excluded.

### 25.1 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | 98.6% | 5.0% preamble, 0 fragmentation | 2.7% | **CLEAN** |
| Kentucky | 100% | 99.0% preamble (formulary, not protocols) | — | Failed |

Eight genuine blind attempts, one clean pass. Dropped at retrieval without
testing (no valid pair found): Wisconsin, Alabama, Georgia, Ohio. Searched
without a usable candidate surfacing: Louisiana, Oklahoma, Mississippi,
Nevada, Iowa, Illinois, Alaska, Hawaii — in each case either no statewide
protocol document exists, or only one dated edition could be confirmed.

## 26. Sixth blind-test round: West Virginia — a third, previously
uncatalogued failure mode

Real pair retrieved: West Virginia OEMS Statewide Protocols, July 2024 and
April 2026, both directly from `dhhr.wv.gov` (the 2026 URL 404'd once at a
stale `thirtydaycomment` path before a corrected `medicaldirection` path
was found — a retrieval hiccup, not a parsing one). Both real multi-page
PDFs (242 and 263 pages). `corpus_probe`: WEAK on both (1.8% / 2.3%
numbered lines).

`parse()` assigned a guideline label to 100% of items in both editions
(229/229, 322/322) — no `<untitled@N>` placeholders, which by the same
numbers-alone reading that misled Kentucky would look clean. **Inspection
shows a third distinct failure shape.** Two things are wrong at once:

1. **Majority preamble.** 136/229 (59.4%) of 2024 items and 168/322
   (52.2%) of 2026 items land under `<preamble>` — never attached to any
   detected anchor at all, the same omission shape as Rhode Island (§22.5)
   and Kentucky (§25), just at an intermediate severity between the two.
2. **The anchor strategy that fired never cleans its own text.** Where
   items *did* get a guideline, the label is a raw, uncleaned per-page
   footer line — edition date, publisher boilerplate, and page-of-page
   counter all still embedded — not a protocol name, e.g.
   `'OPTIONAL: VENTILATOR USAGE July 2024             WEST VIRGINIA OFFICE
   OF EMERGENCY MEDICAL SERVICES-STATEWIDE PROTOCOLS            PG 1 of
   1'`. Only 13 (2024) and 15 (2026) distinct non-preamble labels surface
   this way, versus the 60-100+ genuinely distinct protocols a 242-263
   page statewide manual of this kind actually contains — most real
   protocols were never separated from one another at all, either
   swallowed into `<preamble>` or merged under whichever repeating footer
   string happened to cross the detection threshold.

This is neither the garbage-single-anchor failure (Delaware/South
Carolina, §21-22), nor pure boundary omission (Rhode Island), nor
fragmentation (Vermont), nor wrong-section-of-document (Kentucky). It is
its own thing: an anchor that is structurally real (a recurring footer)
but whose captured text was never run through any title-cleaning step,
compounded by the same majority-preamble omission seen elsewhere. Named
here as the **footer-echo failure**.

Alignment (`item_align.py`, run for completeness despite the parse
quality): 63 T1, 38 T2, 1 T3, 0 T4, 36 T5, 91 T6 — trivially alignable
44.1%, requires-more-than-id 16.2%, unmatched 39.7%. These numbers are not
meaningful as alignment quality signal given how the underlying items were
grouped; recorded for completeness only.

**Not fixed.** Documented and excluded.

### 26.1 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | 98.6% | 5.0% preamble, 0 fragmentation | 2.7% | **CLEAN** |
| Kentucky | 100% | 99.0% preamble (formulary, not protocols) | — | Failed |
| West Virginia | 100%\* | 59.4% / 52.2% preamble + uncleaned footer labels | 39.7% | Failed |

\* "Titled" means no `<untitled@N>` placeholder appeared — not that the
label is a real protocol name; see footer-echo note above.

## 27. Seventh blind-test round: Nebraska — garbage anchor again

Real pair retrieved: Nebraska DHHS "EMS Model Protocols," 2024 and the
current (May 2026) edition, both direct PDFs from `dhhs.ne.gov` (270 pages
each). `corpus_probe`: WEAK on both (1.4% / 1.9% numbered lines).

`parse()` reports 0% preamble in both editions (296 and 421 items) — by
count alone the best-looking result since Tennessee. **Inspection shows
it is the same failure as Delaware and South Carolina (§21-22): the
fallback heuristic locked onto the wrong recurring text.** The dominant
"guideline" is `Vecuronium` (207 items in 2024, 254 in 2026) — a drug
name from a medications table, not a protocol title — followed by
`Nausea Fever (Infection) Dehydration` (a differential-diagnosis
fragment) and similar non-title phrases (`Protocol 15`, `Post
Resuscitation`, `Adult Tachycardia Narrow Complex (QRS < 120 ms)`). Only
14 (2024) and 20 (2026) distinct labels surface, most of them this kind
of noise rather than the ~90+ named protocols the template-slot counts in
`corpus_probe` (93-167 "Protocol" occurrences) imply the document
actually contains.

Zero preamble here is not a sign of health — it is the same anchor
choosing a very frequent, very wrong recurring string and attaching
almost everything to a couple of buckets, rather than at least isolating
the unmatched remainder honestly. Confirms Delaware/South Carolina's
garbage-anchor failure is not a one-off.

**Not fixed.** Documented and excluded.

### 27.1 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | 98.6% | 5.0% preamble, 0 fragmentation | 2.7% | **CLEAN** |
| Kentucky | 100% | 99.0% preamble (formulary, not protocols) | — | Failed |
| West Virginia | 100%\* | 59.4% / 52.2% preamble + uncleaned footer labels | 39.7% | Failed |
| Nebraska | 100%\* | 0% preamble, garbage anchor (drug/diagnosis noise) | — | Failed |

\* "Titled" means no `<untitled@N>` placeholder appeared — not that the
label is a real protocol name.

Ten genuine blind attempts, one clean pass. Dropped at retrieval without
testing (no valid pair found): Wisconsin, Alabama, Georgia, Ohio, Missouri,
Arizona, Idaho, New Mexico, Kansas, Montana, Wyoming, Utah, Arkansas,
North Dakota, Washington. Searched without a usable candidate surfacing:
Louisiana, Oklahoma, Mississippi, Nevada, Iowa, Illinois, Alaska, Hawaii,
South Dakota, Minnesota — in each case either no statewide protocol
document exists, only one dated edition could be confirmed, the document
is split across many per-topic files rather than one compiled PDF, or the
only two editions findable are separated by a document-series change too
large to treat as consecutive (e.g. Washington's 2005 EMT-Basic protocols
vs. its 2024 BLS/ILS guidance).

## 28. Eighth blind-test round: Pennsylvania — a second genuine clean pass

Real pair retrieved: Pennsylvania Statewide ALS Protocols, "2021 FINAL
9-1-21" and "2023v1-2," both direct PDFs from `pa.gov` (179 and 194
pages). `corpus_probe`: **STRONG** on both editions (15.7% / 15.4%
numbered lines) — the first STRONG verdict on any state since the
contaminated dev publishers, and the first time in this blind-test phase
that `corpus_probe`'s verdict and `parse()`'s actual output agree.

`parse()` reports 0% preamble in both editions (1699 and 1769 items,
2.8% / 2.7% `<untitled@N>`) with 51 distinct guidelines in each. **Hand
inspection confirms these are real protocol names**, not noise: `STROKE`,
`BURNS`, `GENERAL CARDIAC ARREST`, `NERVE AGENT/PESTICIDE EXPOSURE`,
`ALTERED LEVEL OF CONSCIOUSNESS - ADULT`/`- PEDIATRIC`,
`POISONING/TOXIN EXPOSURE`, `STROKE`, `SEIZURE`, `SHOCK / SEPSIS` — the
full 51-entry lists for both editions were read end to end, not sampled.

`item_align.py` on the pair: 1267 T1, 238 T2, 14 T3, 4 T4, 62 T5, 114 T6
— **88.6% trivially alignable, 4.7% requires-more-than-id, 6.7%
unmatched**. This is the strongest alignment result of any blind test so
far, edging out Tennessee's numbers on trivial-alignable share while
running at a much larger scale (1699 vs. Tennessee's few hundred items).

This is the second genuine clean pass, and the first on a `STRONG`-rated
document — evidence the known-anchor and footer strategies are not the
only route to a clean result; the fallback heuristic can also work
correctly when the underlying document has dense, regular structural
markers (PA's protocols are laid out with a strict recurring template the
fallback scorer picks up reliably). Not fixed, nothing to fix — passed
as retrieved.

## 29. Ninth blind-test round: New Jersey — garbage anchor, worst case yet

Real pair retrieved: New Jersey EMS Clinical Practice Guidelines, "2022
Interim" and "FINAL 8.21.2025v1," both direct PDFs from `nj.gov` (182 and
248 pages). `corpus_probe`: WEAK on 2022 (3.0%), STRONG on 2025 (31.6%) —
a split verdict between the two editions of the same series, itself a
new observation (prior states' two editions always fell on the same side
of the WEAK/STRONG line).

`parse()` shows the same garbage-anchor failure as Delaware, South
Carolina, and Nebraska, in its worst form yet. 2022's top labels are drug
doses and procedure fragments (`Droperidol 5-10 mg IM`, `Insert an
oral/nasal gastric tube; Refer to Nasal/Oral Gastric Tube Insertion
6.10`), most of it (81+71+44 of 334 items) landing under three different
`<untitled@N>` placeholders rather than any real anchor. 2025 is worse:
its top "guidelines" are mid-sentence fragments —
`'waveform ETCO2 and SPO2 ASAP'`, `'Available for download; "MyLVAD"
Hospital Locator App'`, dosing instructions for oxytocin and glucagon —
none of them protocol names.

`item_align.py` confirms: 0.3% trivially alignable, 41.9%
requires-more-than-id, **57.8% unmatched** — the worst alignment result
of any state tested this phase, worse even than Rhode Island and
Vermont's partial failures.

**Not fixed.** Documented and excluded.

### 29.1 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | 98.6% | 5.0% preamble, 0 fragmentation | 2.7% | **CLEAN** |
| Kentucky | 100% | 99.0% preamble (formulary, not protocols) | — | Failed |
| West Virginia | 100%\* | 59.4% / 52.2% preamble + uncleaned footer labels | 39.7% | Failed |
| Nebraska | 100%\* | 0% preamble, garbage anchor (drug/diagnosis noise) | — | Failed |
| **Pennsylvania** | 97.2% | 0% preamble, 51 real titles both editions | 6.7% | **CLEAN** |
| New Jersey | ~65%\* | 0% preamble, garbage anchor (dose/sentence fragments) | 57.8% | Failed |

\* "Titled" means no `<untitled@N>` placeholder appeared — not that the
label is a real protocol name.

Twelve genuine blind attempts, two clean passes (Tennessee, Pennsylvania).
Also searched this round without a usable statewide compiled-PDF
candidate surfacing: Michigan, Indiana, Oregon, Colorado, Virginia, North
Carolina, California, Illinois (all regional/county-based EMS systems,
no single statewide document); Georgia (its "protocols" page only hosts a
Scope-of-Practice document and an unmodified adoption of the national
NASEMSO model guidelines, not an original compiled protocol manual); Iowa
(the only statewide PDF found is an 18-page Scope of Practice document,
not a treatment-protocol manual); Massachusetts and New Hampshire (both
publish real, well-structured statewide protocol PDFs from official `.gov`
domains with clear edition history, but both are blocked at the network
level — Massachusetts returns an explicit WAF "Not allowed" page,
New Hampshire's Akamai edge returns "Access Denied" — rather than a
missing-document 404; worth another retrieval attempt in a future round
if the blocking is transient).

## 30. Tenth blind-test round: Alabama — near-total detection collapse

Real pair retrieved: Alabama EMS Patient Care Protocols, 10th Edition
(effective April 29, 2022, from a regional EMS council mirror at
`bremss.org` — the 10th edition is no longer linked from ADPH's own
current protocols page, which now lists only the 11th) and 11th Edition
(effective August 1, 2025, live official link on
`alabamapublichealth.gov`). 143 and 210 pages. `corpus_probe`: WEAK on
both (2.3% / 1.4% numbered lines).

`parse()` finds far fewer items than any other state tested this phase
relative to page count: **89 items from 143 pages, 109 items from 210
pages** — for comparison, West Virginia found roughly one item per page
and Pennsylvania nearly ten. Of those few items, the majority are
`<preamble>` (55/89 = 61.8% in the 10th edition, 80/109 = 73.4% in the
11th), and what little is left is dominated by sentence fragments rather
than protocol names: 10th edition's non-preamble labels include
`'hemorrhage with elevated INR'` and `'Contact OLMD Pain >5/10 with'`
alongside one genuine title (`Rapid Sequence Intubation`, 14 items);
11th edition's only substantial non-preamble bucket is a single garbled
multi-line fragment, `'Reversal of Warfarin (Coumadin) overdose Major
bleeding with elevated INR Intracranial hemorrhage with elevated INR'`
(23 items) — evidently several run-together protocol fragments merged
under one bad anchor match.

`item_align.py`: 2 T1, 3 T2, 22 T3, 2 T4, 8 T5, 52 T6 — 5.6% trivially
alignable, 36.0% requires-more-than-id, **58.4% unmatched**, on par with
New Jersey's result as the worst of the phase.

This combines two failure shapes already seen separately — majority
preamble (Rhode Island, Kentucky, West Virginia) and a garbage,
sentence-fragment anchor (Delaware, South Carolina, Nebraska, New
Jersey) — but adds a third element not seen before: the anchor barely
fires at all, leaving item *counts* themselves implausibly low for the
document's size, not just badly attributed. **Not fixed.** Documented
and excluded.

### 30.1 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | 98.6% | 5.0% preamble, 0 fragmentation | 2.7% | **CLEAN** |
| Kentucky | 100% | 99.0% preamble (formulary, not protocols) | — | Failed |
| West Virginia | 100%\* | 59.4% / 52.2% preamble + uncleaned footer labels | 39.7% | Failed |
| Nebraska | 100%\* | 0% preamble, garbage anchor (drug/diagnosis noise) | — | Failed |
| **Pennsylvania** | 97.2% | 0% preamble, 51 real titles both editions | 6.7% | **CLEAN** |
| New Jersey | ~65%\* | 0% preamble, garbage anchor (dose/sentence fragments) | 57.8% | Failed |
| Alabama | ~30%\* | 61.8% / 73.4% preamble + garbage anchor + item collapse | 58.4% | Failed |

\* "Titled" means no `<untitled@N>` placeholder appeared — not that the
label is a real protocol name.

Thirteen genuine blind attempts, two clean passes (Tennessee,
Pennsylvania), out of eleven distinct states with full pipeline data
(Delaware, South Carolina, Rhode Island, Vermont, Tennessee, Kentucky,
West Virginia, Nebraska, Pennsylvania, New Jersey, Alabama). Dropped this
round without testing: Florida, Texas (both regional/county EMS systems,
no single statewide compiled document).

## 31. Eleventh blind-test round: Maryland — majority preamble plus garbage anchor

Real pair retrieved: Maryland Medical Protocols for EMS, 2024 (effective
2024-06-12) and 2025 (effective 2025-04-28), both direct PDFs from
`miemss.org` (510 and 523 pages — the largest documents tested this
phase). `corpus_probe`: **STRONG** on both (20.3% / 19.7% numbered
lines), the second STRONG-on-both-editions result of the phase after
Pennsylvania.

Unlike Pennsylvania, a STRONG verdict did not predict success here.
`parse()` finds 3903 and 3889 items — the largest item counts of the
phase — but **55.7% / 56.1% land under `<preamble>`**, and a further
28.3% / 23.1% are `<untitled@N>`. The non-preamble, non-untitled
remainder is dominated by garbage anchors of the same family as
Delaware/South Carolina/Nebraska/New Jersey: drug-dosing fragments
(`'Adult – 4 mg IM every 1 hour as needed up to max dose of'`) and
mid-sentence clinical text (`'NP/RN team or telemedicine support) and
referrals'`), not protocol names.

`item_align.py`: 531 T1, 519 T2, 108 T3, 6 T4, 1703 T5, 1036 T6 — 26.9%
trivially alignable, 46.6% requires-more-than-id, 26.5% unmatched.
Confirms `corpus_probe`'s STRONG verdict is necessary but not
sufficient — Pennsylvania's dense, regular per-protocol template
produced a clean result under the fallback heuristic; Maryland's equally
dense numbering is apparently structured around something the fallback
mismatches (its numbered lines are page-reference and drug-dosing lists,
not protocol boundaries). **Not fixed.** Documented and excluded.

Also confirmed again this round: Massachusetts and New Hampshire's
statewide protocol PDFs remain inaccessible. Massachusetts blocks even a
browser-driven fetch (curl gets an explicit WAF "Not allowed" page from
multiple direct document URLs, with and without a Referer header
matching the real listing page); New Hampshire now blocks the entire
`advlifesup` section at the site level — even the plain HTML index page
returns "Forbidden" to a direct browser navigation, not just the PDF
links. Both remain logged as real-document-but-inaccessible rather than
dropped-for-no-document.

### 31.1 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | 98.6% | 5.0% preamble, 0 fragmentation | 2.7% | **CLEAN** |
| Kentucky | 100% | 99.0% preamble (formulary, not protocols) | — | Failed |
| West Virginia | 100%\* | 59.4% / 52.2% preamble + uncleaned footer labels | 39.7% | Failed |
| Nebraska | 100%\* | 0% preamble, garbage anchor (drug/diagnosis noise) | — | Failed |
| **Pennsylvania** | 97.2% | 0% preamble, 51 real titles both editions | 6.7% | **CLEAN** |
| New Jersey | ~65%\* | 0% preamble, garbage anchor (dose/sentence fragments) | 57.8% | Failed |
| Alabama | ~30%\* | 61.8% / 73.4% preamble + garbage anchor + item collapse | 58.4% | Failed |
| Maryland | ~44%\* | 55.7% / 56.1% preamble + garbage anchor (STRONG verdict, failed anyway) | 26.5% | Failed |

\* "Titled" means no `<untitled@N>` placeholder appeared — not that the
label is a real protocol name.

Fourteen genuine blind attempts, two clean passes, across twelve distinct
states with full pipeline data. Of the 50 states, current status: 12
tested, 3 contaminated dev publishers (New York, Maine, Connecticut — not
usable as test data per §19), 2 confirmed real-but-network-blocked
(Massachusetts, New Hampshire), and the remainder still to be worked
through systematically rather than assumed ineligible.

## 32. Full-coverage survey, round one: seven more states triaged, none reach a pipeline run

The user asked to eventually cover all 50 states, not just reach a
sample-size target. This section begins a systematic pass through the
remaining ~38 untested states — verifying eligibility against real
official sources (department websites, not just search-engine summaries)
rather than assuming a state is ineligible because an earlier round's
search snippets didn't surface a document. Seven states were checked this
round; none produced a two-edition compiled clinical-protocol pair, each
for a distinct, verified reason:

- **Wisconsin** — the DHS "Scope of Practice and Protocols" page
  publicly hosts only the Scope of Practice document; the actual "Wisconsin
  EMS Protocols" text says explicitly that service providers who want the
  state protocols must go through their regional coordinator, and the
  E-Licensing portal (login-gated). No public PDF exists at this time —
  confirmed by browsing the live page directly, not just a stale search
  snippet (the two direct PDF URLs surfaced by search, `p02875.pdf` and
  `p02875a.pdf`, both 404 on the current site).
- **Ohio** — the EMFTS Board's "Guidelines and Procedures Manual" lives
  at one unversioned URL that is overwritten in place on each revision
  (currently dated June 17, 2026); there is no separate URL for a prior
  edition, and a Wayback Machine snapshot check for an October 2023
  timestamp could not be completed (Internet Archive was returning
  "Temporarily Offline" at check time) — worth a retry in a future round.
- **Missouri** — no statewide compiled protocol PDF found on
  `health.mo.gov`; the department's own pages point to regional/local
  protocol documents (e.g., Kansas City) rather than a single statewide
  one.
- **Louisiana** — `ldh.la.gov` does publish a dated, edition-numbered
  "Bureau of EMS Policy and Procedure Manual" (2022 → 2025, confirmed
  downloadable), but its table of contents is entirely administrative
  (staff onboarding, licensing, disciplinary proceedings, the EMS
  Commission's charge) — no clinical treatment content at all. Out of
  scope for this study regardless of parser performance.
- **Oklahoma** — only a single dated edition (2018) is publicly linked;
  no second edition confirmed.
- **Mississippi** — the MSDH "Protocols" page hosts only a field-triage
  one-pager, a naloxone guideline, and an adopted, unmodified copy of the
  NASEMSO National Model EMS Clinical Guidelines — the same pattern
  already confirmed for Georgia (§29 round) and Iowa. No Mississippi-authored
  compiled document exists.
- **Nevada** — DPBH's own EMS Policies page states plainly that the
  state EMS Policy and Procedure Manual is "forthcoming"; it does not
  exist yet.

No parser code was touched (nothing reached `parse()` this round). Full
accounting after this round: 12 states tested with real pipeline data, 3
contaminated dev publishers (NY, ME, CT), 2 real-but-blocked (MA, NH), 7
now confirmed structurally ineligible with specific evidence (WI, OH, MO,
LA, OK, MS, NV), leaving 31 states still to be checked.

## 33. Full-coverage survey, round two: Arizona and Montana confirmed single-edition; North Carolina real but unreachable

- **Arizona** — the two distinct AZDHS URLs surfaced for the T3G
  (Triage, Treatment, and Transport Guidelines) document — a "current"
  one and an "earlier version" one — resolve to **byte-identical files**
  (same MD5 hash). Only one edition of this document is actually
  published; there is no second edition to pair it with.
- **Montana** — the Board of Medical Examiners' "Prehospital Treatment
  Protocols" (Version 11, major review 2015, current revision #12 dated
  November 2020) is real and downloadable from `boards.bsd.dli.mt.gov`,
  but it is the only working copy found; a third-party mirror that
  appeared to be an earlier dated cut of the same Version 11 (from
  `readygallatin.com`, filename dated 3/2019) is itself now a dead link
  (404). No second edition confirmed.
- **North Carolina** — real evidence of a compiled document exists
  (`ncems.org/protocols/allprotocols.pdf`, referred to directly by
  search results as the "NCCEP Treatment Protocols"), but `ncems.org` is
  currently unreachable by both direct fetch and browser navigation
  (connection failures, not a 404), and the Internet Archive Wayback
  Machine was also down for the entire duration of this round
  ("Temporarily Offline" / 502 on every attempt), so no snapshot check
  could be completed either. Logged as real-but-currently-unreachable,
  same category as Massachusetts and New Hampshire — worth a retry in a
  future round rather than a permanent drop.

Full accounting after this round: 12 states tested with real pipeline
data, 3 contaminated dev publishers, 3 real-but-currently-unreachable
(MA, NH, NC), 9 confirmed structurally ineligible with specific evidence
(WI, OH, MO, LA, OK, MS, NV, AZ, MT), leaving 23 states still to check:
Alaska, Arkansas, California, Colorado, Hawaii, Idaho, Illinois, Indiana,
Kansas, Michigan, Minnesota, New Mexico, North Dakota, Oregon, South
Dakota, Utah, Virginia, Washington, Wyoming, plus re-confirmation passes
on the earlier-round drops that were based on search snippets alone
rather than a direct department-page visit (Florida, Georgia, Iowa,
Texas already re-confirmed with direct evidence; the rest of the
original round-two/round-three drop list has not yet had the same
direct-page treatment).

## 34. Full-coverage survey, round three: Utah and New Mexico are real single-edition documents; Kansas, Wyoming, Minnesota confirmed no state document

- **Utah** — genuinely promising: the Bureau of EMS's "Utah EMS
  Protocol Guidelines" is Utah's own document (developed by a Utah panel,
  incorporating but not merely reproducing NASEMSO's model guidelines),
  and a current 2025 edition downloaded cleanly (106 pages, confirmed via
  page-count extraction after `file`'s magic-byte page estimate turned
  out unreliable on this particular PDF's structure). However, **every
  URL for a prior edition that appeared in search results — three
  different dated revisions of the "2023" edition, on two different
  subdomains — 404s on the live site**; Utah's WordPress-style CMS
  appears to reorganize asset paths faster than search engines can index
  them, and a Wayback Machine check could not be completed (Internet
  Archive remained unreachable for this entire session). Logged as
  real-document-but-no-confirmed-second-edition; worth another retrieval
  attempt in a future round once a stable prior-edition URL can be found
  (e.g. by asking the Bureau directly, or retrying Wayback).
- **New Mexico** — also real: `nmhealth.org`'s "EMS Treatment
  Guidelines" (internal filename `SOP-Guidelines-Treatment.pdf`, 91
  pages) downloads cleanly from a stable publication-ID URL. But like
  Ohio, this appears to be a living document at a single unversioned
  publication ID (last-modified header read March 2022 despite being
  presented as the current document); no distinct second-edition URL was
  found. Same category as Utah — real, single-edition-only for now.
- **Kansas** — confirmed no state-authored document: the Board of EMS's
  own "Sample Protocols" page is literally a curated list of *other*
  jurisdictions' protocol documents (El Dorado County CA, North Carolina,
  Boston, Sacramento, San Francisco, DCFD) offered as examples for local
  agencies to reference — Kansas does not publish its own compiled
  protocol document at all.
- **Wyoming** — confirmed adopted-NASEMSO-only, the same pattern already
  seen in Georgia, Mississippi, and Iowa: the Department of Health's own
  EMS page hosts the National Model EMS Clinical Guidelines verbatim, not
  a Wyoming-authored document.
- **Minnesota** — same pattern again: OEMS's "Model Clinical Guidelines"
  page links only to the adopted National Model EMS Clinical Guidelines
  and a county-level document (Hennepin EMS Protocols), not a
  Minnesota-authored statewide compiled protocol manual.

No parser code touched; nothing reached `parse()` this round (Utah and
New Mexico both lack a confirmed second edition, so there is no pair to
run). Full accounting after this round: 12 states tested with real
pipeline data, 3 contaminated dev publishers, 3 real-but-unreachable (MA,
NH, NC), 2 real-but-single-edition-only (UT, NM), 12 confirmed
structurally ineligible with specific evidence (WI, OH, MO, LA, OK, MS,
NV, AZ, MT, KS, WY, MN), leaving 14 states still to check with a direct
department-page visit: Alaska, Arkansas, California, Colorado, Hawaii,
Idaho, Illinois, Indiana, Michigan, North Dakota, Oregon, South Dakota,
Virginia, Washington. This full-coverage pass will continue in future
rounds.

## 35. Full-coverage survey, round four: Alaska/Idaho/Arkansas/North Dakota/South Dakota triaged; Hawaii becomes the twelfth blind-test round (failed)

- **Alaska** — no compiled statewide clinical-protocol PDF found; the
  department's public documents are a trauma-specific MICP document and
  scope-of-practice guides, not a full treatment-protocol manual.
- **Idaho** — confirmed again: the current EMSPC protocols are
  distributed only through a paid/free mobile app; the only public PDFs
  findable are stale 2015 and 2017 editions on a third-party fire
  district mirror, not an official current document.
- **Arkansas** — confirmed again: distribution is app-only (the
  "Arkansas EMS" app); no direct current PDF found on `healthy.arkansas.gov`.
- **North Dakota** — the 2024 EMS Treatment Guidelines exist and are
  North Dakota's own adaptation of the NASEMSO model (not a verbatim
  copy, unlike Georgia/Mississippi/Wyoming/Minnesota), but only "Version
  1" has ever been published, and it is explicitly distributed as an
  editable template "that must be modified by an EMS agency medical
  director prior to use" rather than a binding compiled document — no
  second edition exists yet.
- **South Dakota** — the only compiled document found is an "EMT
  Pre-Hospital Treatment Guidelines, 3rd Edition" from 2010; no more
  recent statewide compiled document is publicly linked.

**Hawaii**, by contrast, is real and has a confirmable pair — General
Standing Orders (Version 13, dated 12/6/2023, posted January 2024) and a
2018 edition (`SO2018.pdf`), both direct downloads from `health.hawaii.gov`
(145 and 286 pages). `corpus_probe`: WEAK on 2018 (1.0% numbered lines,
**zero** template slots detected at all), USABLE on 2023 (7.4%).

`parse()` produces the most degenerate result of the entire phase. The
**2018 edition collapses to just 23 items total** from 145 pages, with
only 2 distinct "guidelines," both garbage fragments (`'For systolic BP <
90 mmHg which is'`, `'Continuous Positive Airway Pressure]'`) — worse
than even Alabama's item-count collapse (89 items from 143 pages). The
**2023 edition adds a new failure shape**: 38.7% preamble, and its
dominant non-preamble label is `OFLOXACIN` (a drug name, 168 items) —
but three more of its eight distinct "guidelines" are **literal raw
page-counter text** (`'Page 2 of 3'`, `'Page 2 of 2'`, `'Page 3 of 3'`,
`'Page 1 of 3'`, `'Page 1 of 2'`) rather than any protocol-adjacent
content at all — a more degenerate version of West Virginia's
footer-echo failure (§26), where even the footer text carried a
protocol name; here it's bare pagination.

`item_align.py`: 0 T1, 0 T2, 0 T3, 0 T4, 11 T5, 12 T6 — **0.0% trivially
alignable**, 47.8% requires-more-than-id, 52.2% unmatched — ties New
Jersey for the worst alignment result of the phase, and is the first
time trivial alignment has hit exactly zero. **Not fixed.** Documented
and excluded.

### 35.1 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | 98.6% | 5.0% preamble, 0 fragmentation | 2.7% | **CLEAN** |
| Kentucky | 100% | 99.0% preamble (formulary, not protocols) | — | Failed |
| West Virginia | 100%\* | 59.4% / 52.2% preamble + uncleaned footer labels | 39.7% | Failed |
| Nebraska | 100%\* | 0% preamble, garbage anchor (drug/diagnosis noise) | — | Failed |
| **Pennsylvania** | 97.2% | 0% preamble, 51 real titles both editions | 6.7% | **CLEAN** |
| New Jersey | ~65%\* | 0% preamble, garbage anchor (dose/sentence fragments) | 57.8% | Failed |
| Alabama | ~30%\* | 61.8% / 73.4% preamble + garbage anchor + item collapse | 58.4% | Failed |
| Maryland | ~44%\* | 55.7% / 56.1% preamble + garbage anchor (STRONG verdict, failed anyway) | 26.5% | Failed |
| Hawaii | ~91%\* | 0% / 38.7% preamble + item collapse + raw page-counter anchor | 52.2% | Failed |

\* "Titled" means no `<untitled@N>` placeholder appeared — not that the
label is a real protocol name.

Fifteen genuine blind attempts, two clean passes, across thirteen
distinct states with full pipeline data. Full accounting after this
round: 13 states tested, 3 contaminated dev publishers, 3
real-but-unreachable (MA, NH, NC), 2 real-but-single-edition-only (UT,
NM), 17 confirmed structurally ineligible with specific evidence (adds
AK, ID, AR, ND, SD to the prior 12), leaving 9 states still to check with
a direct department-page visit: California, Colorado, Illinois, Indiana,
Michigan, Oregon, Virginia, Washington, and a final re-check of any state
whose earlier drop relied only on search snippets.

## 36. Full-coverage survey, round five (final): the last eight states, all regional/county systems — full 50-state accounting

The last eight untested states were each checked against their official
EMS-authority page directly. All eight confirm the same structural
pattern already seen repeatedly this phase — no single statewide
compiled clinical-protocol document, because the state delegates
protocol authorship to regional or county medical control authorities:

- **California** — EMSA's own former public guidelines page
  (`emsa.ca.gov/guidelines/`) now redirects to a login-only "Central
  Registry" portal; EMS system management is explicitly the
  responsibility of 34 local EMS agencies (LEMSAs), not EMSA itself.
- **Colorado** — CDPHE's "EMS medical direction" page covers medical
  director registration, scope-of-practice waivers, and an FAQ — no
  compiled protocol document at all; protocols are set by individual EMS
  medical directors per Colorado's own regulatory framework.
- **Illinois** — IDPH's EMS page describes a three-tiered
  regional/area-wide/local trauma-center system dating to 1971; protocols
  are Regional Standing Medical Orders set by each of Illinois's EMS
  regions (Region 1, Region IX/NWC, Region XI/Chicago, etc.), not IDPH.
- **Indiana** — no statewide compiled PDF found; every protocol document
  located is either a metro-area document (Indianapolis) or a specific
  hospital system's own protocols (Ascension St. Vincent), referencing
  Indiana DHS standards rather than being published by DHS itself.
- **Michigan** — MDHHS confirms directly: protocols are developed and
  maintained by each regional Medical Control Authority (MCA) and merely
  "approved by MDHHS," not authored or compiled by the state into one
  document.
- **Oregon** — OHA's EMS Program page has no compiled statewide document;
  every protocol document found is county-level (Multnomah, Lane, etc.).
- **Virginia** — no compiled statewide protocol document found on
  `vdh.virginia.gov`; Virginia's EMS system runs through regional councils
  (e.g., Lord Fairfax) that each publish their own regional protocols.
- **Washington** — DOH does publish a real, current, single-document
  statewide protocol guidance (DOH 530-281, "2024 BLS/ILS Protocol
  Guidance") but only one edition is currently linked; the only
  candidate "prior edition" (DOH 530-006, "EMT Field Protocols") is a
  different, much older document series (revision dated September 2005)
  at a different scope level — already logged as too large a gap to
  treat as consecutive editions (§29 round).

### 36.1 Full 50-state accounting

| Category | Count | States |
|---|---|---|
| **Tested — pipeline run, real result** | 13 | Delaware, South Carolina, Rhode Island, Vermont, **Tennessee (CLEAN)**, Kentucky, West Virginia, Nebraska, **Pennsylvania (CLEAN)**, New Jersey, Alabama, Maryland, Hawaii |
| **Contaminated dev publishers** (§19 — not usable as test data) | 3 | New York, Maine, Connecticut |
| **Real document, currently unreachable** (network/access blocked, not absent) | 3 | Massachusetts, New Hampshire, North Carolina |
| **Real document, only one edition confirmed** (not yet a pair) | 2 | Utah, New Mexico |
| **Confirmed structurally ineligible**, with specific direct evidence per state | 29 | Wisconsin (login-gated), Ohio (single living URL), Missouri (no doc), Louisiana (admin, not clinical), Oklahoma (single edition), Mississippi (adopted NASEMSO only), Nevada (forthcoming), Arizona (single edition — two URLs identical), Montana (single edition, mirror dead), Kansas (curates other states' docs), Wyoming (adopted NASEMSO only), Minnesota (adopted NASEMSO + county doc only), Alaska (no compiled doc), Idaho (app-only), Arkansas (app-only), North Dakota (single version, explicitly editable template), South Dakota (single 2010 edition), Georgia (adopted NASEMSO only, §29 round), Iowa (18-page Scope of Practice only, not treatment protocols), Florida (regional/county), Texas (regional/county), California (34 LEMSAs), Colorado (individual medical directors), Illinois (regional Standing Medical Orders), Indiana (metro/hospital-system only), Michigan (regional MCAs), Oregon (county-level only), Virginia (regional councils), Washington (single edition, prior series too old/different scope) |

**50 of 50 states now accounted for.** No parser code was touched during
this five-round survey — every non-tested state's status rests on direct
evidence (an official department page visited, a stable download
attempted, or a byte-for-byte URL comparison), not assumption. The
states in the "unreachable" and "single-edition-only" rows are not
closed — Massachusetts, New Hampshire, and North Carolina each have a
real, well-structured statewide document and are worth another retrieval
attempt if their current blocks (WAF, Akamai, and a general connection
failure respectively) prove transient; Utah and New Mexico are worth
revisiting if a stable prior-edition URL or a working Wayback Machine
snapshot becomes available.

Final running total: **fifteen genuine blind attempts across thirteen
distinct states with real pipeline data, two clean passes (Tennessee,
Pennsylvania)**. This is still short of the pre-registration's §3.2
minimum viable test set (≥4 pairs from ≥3 distinct publishers) — two
clean pairs from two distinct publishers is real progress from zero, but
not yet sufficient on its own. Closing that gap requires either (a) more
blind rounds against the states logged above as real-but-currently-
unreachable or real-but-single-edition-only, in case access improves or
a second edition surfaces, or (b) a deliberate, explicitly-scoped future
effort to fix one of the now well-catalogued failure mechanisms (garbage
anchor, majority preamble, fragmentation, footer-echo, item-count
collapse) and re-run the full blind-test battery from scratch afterward
— both of which remain the user's call, not something to act on now.

## 37. Wayback Machine recovery round: two more genuine blind tests unlocked, three more confirmed closed

Internet Archive was unreachable for the entire five-round survey above
(§32-§36); it came back partway through this round (after an initial
429 rate-limit that cleared), which reopened the "real document, only
one live edition" states logged in §34 and §36 as worth a future retry.
Each recovered snapshot was downloaded and, where it produced a genuine
second edition, run through the exact same frozen, unmodified pipeline
as every other blind-test state.

**Utah — thirteenth blind-test round, failed.** Recovered the October
2023 edition (`2023-Utah-EMS-Protocol-Guidelines-Final-10.19.2023.pdf`)
from a Wayback snapshot dated 2023-11-02, paired against the 2025
edition already in hand. `corpus_probe`: WEAK on both (0.3% / 0.1%
numbered lines — the lowest numbered-line density of any state tested
this phase). `parse()` produces the single worst item-detection result
of the entire phase: **11 items total from 94 pages, then 3 items total
from 106 pages** — worse than Hawaii's 2018 collapse (23 items) and
Alabama's (89 items). `item_align.py`: 0 matched in any tier, **0.0%
trivially alignable, 100.0% unmatched**. The underlying marker-detection
step, not just guideline attribution, essentially does not fire on this
document's formatting at all. **Not fixed.** Documented and excluded.

**Oklahoma — fourteenth blind-test round, failed.** Recovered the 2013
edition via `digitalprairie.ok.gov` — Oklahoma's own official state
digital archive (CONTENTdm), not a third-party mirror — as a genuine
first-party government source, distinct in kind from every other
Wayback-recovered file this round. Paired against the already-confirmed
2018 edition. `corpus_probe`: STRONG on 2013 (12.4%), USABLE on 2018
(7.3%) — both promising by the numbers. **Inspection shows a new
failure signature**: 47.8% of 2013's items and 57.8% of 2018's are
`<untitled@N>` (no guideline assigned at all, distinct from
`<preamble>`), and where a label *is* assigned it is algorithm-flowchart
box text rather than a protocol name — `'ADULT'`,
`'PEDIATRIC: IV NS 20 mL/kg BOLUS IF SYS BP < (70 + 2x age in years)
mmHg...'`, `'LIMIT INTUBATION COMPRESSION PAUSE TO MAXIMUM OF 10
SECONDS...'`. This is the garbage-anchor family (Delaware, South
Carolina, Nebraska, New Jersey, Maryland) but with a distinctive
signature of its own: very high `<untitled@N>` share rather than
`<preamble>` share, consistent with a flowchart-heavy document layout
where individual algorithm boxes get mistaken for section anchors.
`item_align.py`: 4.4% trivially alignable, **60.0% unmatched**.
**Not fixed.** Documented and excluded.

**New Mexico — confirmed closed, not reopened.** Checked Wayback for a
snapshot of the current publication-ID URL earlier than its own
last-modified date; the earliest capture found (2022-03-25) predates the
file's own last-modified header (2022-03-26) by one day — this *is* the
first version, not a recovered prior edition. No second edition exists
to find. Stays logged as real-but-single-edition-only.

**Georgia — reclassified with stronger evidence.** A direct search for
a pre-NASEMSO-adoption Georgia document returned an explicit statement
that "Georgia lacks state EMS guidelines" — confirming this is a
standing structural fact about Georgia's EMS system, not a recent
policy switch away from a former state-authored document. No amount of
looking at older years would find anything, because nothing was ever
there.

**Arizona and Montana — real snapshots located, retrieval currently
unreliable.** Wayback confirmed genuine captures exist for both (Arizona:
a 2020-06-29 snapshot of the T3G advisory-version URL; Montana: a
2021-04-30 snapshot of the Board of Medical Examiners protocol URL), but
both snapshots consistently returned "503 Service Unavailable" from
Wayback's own storage layer across six retry attempts each — a different
failure from "no snapshot exists" (confirmed present in the Wayback
calendar) and different from Utah's transient 503 (which cleared on
retry). Logged as found-but-not-yet-retrievable; worth another attempt
in a future round, since this looks like Archive.org node-level flakiness
rather than a permanent block.

**Idaho and Arkansas — re-searched, no PDF-era editions surfaced** beyond
what was already found (Idaho's stale 2015/2017 mirror copies; Arkansas's
app-only distribution). No new evidence either way on whether either
state ever published a compiled PDF the current app superseded.

### 37.1 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | 98.6% | 5.0% preamble, 0 fragmentation | 2.7% | **CLEAN** |
| Kentucky | 100% | 99.0% preamble (formulary, not protocols) | — | Failed |
| West Virginia | 100%\* | 59.4% / 52.2% preamble + uncleaned footer labels | 39.7% | Failed |
| Nebraska | 100%\* | 0% preamble, garbage anchor (drug/diagnosis noise) | — | Failed |
| **Pennsylvania** | 97.2% | 0% preamble, 51 real titles both editions | 6.7% | **CLEAN** |
| New Jersey | ~65%\* | 0% preamble, garbage anchor (dose/sentence fragments) | 57.8% | Failed |
| Alabama | ~30%\* | 61.8% / 73.4% preamble + garbage anchor + item collapse | 58.4% | Failed |
| Maryland | ~44%\* | 55.7% / 56.1% preamble + garbage anchor (STRONG verdict, failed anyway) | 26.5% | Failed |
| Hawaii | ~91%\* | 0% / 38.7% preamble + item collapse + raw page-counter anchor | 52.2% | Failed |
| Utah | 100%\* | total item-detection collapse (11 then 3 items) | 100.0% | Failed |
| Oklahoma | ~52%\* | 47.8% / 57.8% untitled + flowchart-box garbage anchor | 60.0% | Failed |

\* "Titled" means no `<untitled@N>` placeholder appeared — not that the
label is a real protocol name. For Oklahoma, "titled" is inverted from
`<untitled@N>` share, since that is the dominant failure signal there
rather than `<preamble>`.

Seventeen genuine blind attempts, two clean passes, across fifteen
distinct states with full pipeline data. Full 50-state accounting is
now: 15 tested (Utah and Oklahoma both moved from earlier buckets — Utah
from single-edition-only, Oklahoma from structurally-ineligible, since
both now have a real completed pipeline run), 3 contaminated dev
publishers, 3 real-but-unreachable (MA, NH, NC), 1 real-but-single-
edition-only (NM), 2 real-snapshot-found-but-currently-unretrievable
(AZ, MT), 26 confirmed structurally ineligible. Still short of the
pre-registration's minimum viable test set (≥4 pairs/≥3 publishers) at
two clean pairs from two publishers.

## 38. Wayback recovery attempt on the three unreachable states — one real edition each for MA and NH, North Carolina still fully blocked

At the user's request to extend the previous-years search to every
state rather than the six flagged as highest-value, this round targeted
Massachusetts, New Hampshire, and North Carolina specifically — the
three states already known to have real, well-structured documents
blocked only by network access. Wayback snapshots exist for all three,
but retrieval proved far harder than for Utah/Oklahoma, surfacing a new
failure mode of its own.

**A systematic truncation bug, not a block.** Multiple download attempts
across all three states repeatedly produced files of *exactly* 1,048,576
bytes (1 MiB) or 5,242,880 bytes (5 MiB) — suspiciously round sizes that
turned out to be corrupt: one such file identified as a `.docx` (a zip
container) and failed a zip-integrity check outright; PDF-typed ones
ended mid-object-stream with no `%%EOF` trailer. This reproduces
consistently for specific Wayback captures and appears tied to how that
particular capture streams (likely chunked transfer without a
declared `Content-Length`, hitting a fixed buffer in this environment's
network path) — genuinely-complete downloads in the same session (e.g.
Utah's 1.8MB recovery, this round's 10.9MB and 25MB successes below)
came through with non-round byte counts and no truncation, so this is
capture-specific behavior, not a hard cap on all downloads.

- **Massachusetts** — recovered one genuine, complete edition: Version
  2023.2 (effective 2023-05-04), 10,891,471 bytes, 175 pages, confirmed
  with real extractable text (338,525 characters). A second edition
  (Version 2025.1) was located in Wayback and loads fine in-browser, but
  every direct-download attempt (6 tries) truncated at exactly 5,242,880
  bytes and failed a zip-validity check. **One real edition in hand, no
  usable second edition yet.**
- **New Hampshire** — recovered one genuine, complete edition: Version
  8.0 draft (`version8.0patientcareprotocolsdraft.pdf`), 25,148,585
  bytes, 170 pages, confirmed with real extractable text (411,329
  characters). Also discovered NH's EMS office has migrated to new
  subdomains (`fstems.dos.nh.gov` for the public page, `mm.nh.gov` for
  the actual document host) — but both are behind the **same** Akamai
  WAF as the original `www.nh.gov` path (confirmed: identical
  `errors.edgesuite.net` "Access Denied" response), so the subdomain
  migration doesn't route around the block. Every Wayback snapshot
  attempted for a second edition (v8.2, v9.0, and the current
  `mm.nh.gov` URL) either 500/502/503'd outright or hit the same
  truncation pattern. **One real edition in hand, no usable second
  edition yet.**
- **North Carolina** — worse than the other two: **zero complete
  editions recovered** despite trying three distinct Wayback snapshot
  dates (2022-12-25, 2023-09-27, 2025-03-19) across more than 30 total
  download attempts. Every attempt either 503'd outright or truncated at
  exactly 1 MiB or 5 MiB. The underlying URL (`ncems.org/protocols/
  allprotocols.pdf`) is confirmed to load with HTTP 200 in-browser on
  every check: this is a genuinely reproducible retrieval problem for
  this document, not absence or a block. Logged as real-but-completely-
  unretrievable-so-far, the only state in this category.

All three remain **not yet tested** — none of this changes the running
total of 17 blind attempts / 2 clean passes. This is deliberately logged
as its own distinct access category (reproducible download truncation)
rather than folded into "unreachable," since the underlying documents
are now partially in hand (MA, NH) or confirmed loadable (NC) — a
qualitatively different, more solvable problem than an outright WAF
block. Worth a retry with a different retrieval method (e.g. a tool that
handles chunked transfer encoding without a fixed read buffer) rather
than more of the same approach.

## 39. Fifteenth blind-test round: Ohio, recovered via a third-party mirror of a superseded edition — failed

Continuing the systematic previous-years sweep across every remaining
state (not just the six originally flagged), most searches this round
confirmed prior findings without new evidence either way: Wyoming and
Minnesota show no trace of ever having had their own document before
adopting NASEMSO verbatim; Missouri shows no trace of ever having had a
statewide compiled document at all; South Dakota's newest confirmed
edition is still the 2010 3rd edition; North Dakota's 2024 guidelines
are still "Version 1," nothing newer; Florida's regional-only structure
is reconfirmed. Iowa's one promising third-party mirror lead
(`mgmc.org`) turned out to be a dead link.

**Ohio, however, produced a genuine recovered edition.** A third-party
hospital-system mirror (`amerimed.net`) hosts a copy of the "State of
Ohio Adult EMS Guidelines and Procedures Manual **2021**" — a real, dated
prior edition of the same living document whose only other known copy is
the perpetually-overwritten current URL logged in §32 as
un-pairable. Paired the recovered 2021 edition against the already-held
current (2026) edition. `corpus_probe`: USABLE on both (7.5% / 6.9%
numbered lines).

`parse()` shows the same garbage-anchor failure already catalogued five
times this phase (Delaware, South Carolina, Nebraska, New Jersey,
Maryland, Oklahoma), here at its own severity: the dominant label in
each edition is a fragment from a drug-administration flowchart box —
`'IM or AUTO-INJECTOR'` (543/881 = 61.6% of 2021's items) and
`'INSUFFICIENCY ADMINISTER STEROIDS'` (575/973 = 59.1% of 2026's items)
— alongside other flowchart fragments (`'BASE VITALS SAMPLE HISTORY'`,
`'ADMINISTER DEXTROSE IN WATER 25 GM IVP or GLUCAGON 1 MG IM'`). Neither
is a protocol name. `item_align.py`: 31.0% trivially alignable, 38.9%
unmatched. **Not fixed.** Documented and excluded.

### 39.1 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | 98.6% | 5.0% preamble, 0 fragmentation | 2.7% | **CLEAN** |
| Kentucky | 100% | 99.0% preamble (formulary, not protocols) | — | Failed |
| West Virginia | 100%\* | 59.4% / 52.2% preamble + uncleaned footer labels | 39.7% | Failed |
| Nebraska | 100%\* | 0% preamble, garbage anchor (drug/diagnosis noise) | — | Failed |
| **Pennsylvania** | 97.2% | 0% preamble, 51 real titles both editions | 6.7% | **CLEAN** |
| New Jersey | ~65%\* | 0% preamble, garbage anchor (dose/sentence fragments) | 57.8% | Failed |
| Alabama | ~30%\* | 61.8% / 73.4% preamble + garbage anchor + item collapse | 58.4% | Failed |
| Maryland | ~44%\* | 55.7% / 56.1% preamble + garbage anchor (STRONG verdict, failed anyway) | 26.5% | Failed |
| Hawaii | ~91%\* | 0% / 38.7% preamble + item collapse + raw page-counter anchor | 52.2% | Failed |
| Utah | 100%\* | total item-detection collapse (11 then 3 items) | 100.0% | Failed |
| Oklahoma | ~52%\* | 47.8% / 57.8% untitled + flowchart-box garbage anchor | 60.0% | Failed |
| Ohio | ~93%\* | 7.0% / 8.4% preamble + flowchart-box garbage anchor | 38.9% | Failed |

\* "Titled" means no `<untitled@N>` placeholder appeared — not that the
label is a real protocol name.

Eighteen genuine blind attempts, two clean passes, across sixteen
distinct states with full pipeline data. Full 50-state accounting: 16
tested, 3 contaminated dev publishers, 3 real-but-unreachable-or-
truncating (MA, NH, NC — one edition in hand for MA/NH), 1
real-but-single-edition-only (NM), 2 real-snapshot-found-but-currently-
unretrievable (AZ, MT), 25 confirmed structurally ineligible (Ohio moves
out of this bucket, having now been fully tested). Still short of the
pre-registration's minimum viable test set (≥4 pairs/≥3 publishers) at
two clean pairs from two publishers — the previous-years sweep has so
far only ever reproduced the same failure modes already catalogued, not
surfaced a third clean publisher.

## 40. Previous-years sweep, closing round: the remaining structurally-ineligible states checked, one more historical single-edition document found

Completes the systematic previous-years search across every one of the
50 states (not just the six originally identified as highest-value),
per the user's explicit instruction to apply it everywhere. The
remaining untried states were checked this round: Wisconsin, Texas,
Michigan, Virginia, Colorado, Illinois, Indiana, Oregon, Washington,
Kansas, Nevada, Louisiana, Idaho, Arkansas, and California.

**One notable historical finding, still not a pair.** California *did*
once have a real, government-authored, single statewide compiled
document — the EMSA "Uniform Treatment Protocols Final Report,"
November 1996 — confirming the state's current 34-LEMSA regional
structure is a design choice made at some point after 1996, not an
original condition. No second statewide edition was ever published
after it; California moved permanently to the regional model instead.
Logged as real-but-single-edition-only, joining Utah and New Mexico in
that category, though from an earlier and more clearly terminal point
in the state's history than either.

**Everything else reconfirmed prior findings, with no new evidence
either way:** Wisconsin's pre-login-gate document could not be located
(would require a working Wayback session, unavailable for parts of this
round); Texas, Michigan, Virginia, Colorado, Illinois, Indiana, Oregon,
and Washington show no trace of ever having published a single statewide
compiled document — each state's own materials describe protocol
authorship as a standing regional/local responsibility, not a historical
accident that changed at some particular year; Kansas and Nevada show no
trace of ever having their own document; Louisiana's only compiled
document remains the administrative Policy and Procedure Manual (§32),
with no clinical-protocol counterpart at any point; Idaho's and
Arkansas's only surfaced editions remain the same stale 2015/2017
mirrors already known — no evidence either state ever had a *more
recent* PDF-era edition the current app superseded.

### 40.1 Full 50-state accounting, previous-years sweep complete

| Category | Count | States |
|---|---|---|
| **Tested — pipeline run, real result** | 16 | Delaware, South Carolina, Rhode Island, Vermont, **Tennessee (CLEAN)**, Kentucky, West Virginia, Nebraska, **Pennsylvania (CLEAN)**, New Jersey, Alabama, Maryland, Hawaii, Utah, Oklahoma, Ohio |
| Contaminated dev publishers | 3 | New York, Maine, Connecticut |
| Real document, one edition recovered, second edition blocked by a reproducible download-truncation bug | 2 | Massachusetts, New Hampshire |
| Real document, confirmed loadable, zero complete editions recovered despite 30+ attempts | 1 | North Carolina |
| Real document, only one edition ever existed or currently exists | 3 | Utah, New Mexico, California (1996, terminal) |
| Real snapshot located, Wayback retrieval consistently fails | 2 | Arizona, Montana |
| Confirmed structurally ineligible, no historical document found at any point | 23 | Wisconsin, Missouri, Louisiana, Mississippi, Nevada, Kansas, Wyoming, Minnesota, Alaska, Idaho, Arkansas, North Dakota, South Dakota, Georgia, Iowa, Florida, Texas, Colorado, Illinois, Indiana, Michigan, Oregon, Virginia, Washington (24 listed; see note) |

Note: the ineligible list above totals 24, not 23, because Wisconsin's
status is evidence-light on the historical question specifically (its
*current* document is confirmed login-gated with certainty; whether an
older, ungated PDF edition ever existed is unresolved pending a working
Wayback session) — everything else in that bucket rests on positive
evidence that no compiled document existed at any point, not merely that
none was found this round.

**Bottom line on "does looking at previous years matter for every
state": it mattered decisively for three states (Utah, Oklahoma, Ohio —
all three converted from unusable to fully tested, all three failed) and
partially for two more (Massachusetts, New Hampshire — one real edition
each recovered, still short of a pair), out of 50 states swept. It
changed nothing for the other 45 — 23 states have no evidence a
historical document ever existed regardless of year, and California's
history confirms a document existed once but the state deliberately
never repeated it. Running total remains eighteen genuine blind
attempts, two clean passes, across sixteen distinct states.**

## 41. Dedicated retry round on the five remaining live leads: New Hampshire tested (failed), Arizona confirmed a permanent dead end, Montana's second edition confirmed to exist, Massachusetts and North Carolina still blocked

At the user's request to keep specifically pushing on Massachusetts, New
Hampshire, North Carolina, Arizona, and Montana, this round used the
Wayback CDX API directly (`web.archive.org/cdx/search/cdx?url=...`)
rather than guessing snapshot dates from the browser one at a time — a
much stronger technique, since it lists every distinct captured version
of a URL along with a content digest, making it possible to tell whether
two snapshots are genuinely different documents or duplicate crawls of
the same unchanged file.

**New Hampshire — sixteenth blind-test round, failed.** The CDX list for
the Version 8.2 document showed two captures; the second (2024-05-17,
21.2MB) downloaded completely and cleanly where the first had
consistently failed. This produced a genuine second NH edition — paired
against the already-held Version 8.0 draft — and surfaced that the
earlier `ma_2025.pdf`/`nh_v82` type failures in this session had
actually been downloading a **DOCX file mislabeled as PDF** in at least
one case (Massachusetts, see below), a confusion CDX's `mimetype` field
resolved cleanly. `corpus_probe`: USABLE on both editions. `parse()`
shows a novel failure shape not seen before: the earlier v8.0 draft
partially works — 317/803 items (39.5%) land under a real-sounding
label (`'EMT STANDING ORDERS'`) alongside genuine protocol-name
fragments (`'Medical Protocol 2.9A Hypoglycemia – Adult'`) mixed with
garbage — but the later, final v8.2 **collapses to 94.4% preamble**
(916/970 items), as if whatever page-layout signal the fallback
heuristic was weakly tracking in the draft disappeared almost entirely
in the revision to final. `item_align.py`: 3.5% trivially alignable,
29.6% unmatched. **Not fixed.** Documented and excluded.

**Arizona — confirmed a permanent dead end, not a retrieval problem.**
The CDX list shows only **one** distinct content digest was ever
archived for this document; the second URL logged in earlier rounds as
"an earlier version" is recorded by Wayback itself as a `warc/revisit`
— a re-crawl that found byte-identical content and was never stored
separately. There is no second edition to recover, at any snapshot date,
because none was ever captured. All further retry effort on Arizona is
retired.

**Montana — a genuine second edition confirmed to exist, blocked by an
Archive.org outage mid-round.** Montana's CDX history (47 entries
spanning 2021-2026) shows the document held one stable content digest
for years, then briefly switched to a **different** digest on exactly
one capture (2024-07-18, 973,294 bytes) before reverting back to the
original digest on every subsequent crawl — a real, if short-lived,
distinct edition. Both the long-standing digest and the 2024-07-18
outlier were pursued across multiple snapshot timestamps and 15+ retry
attempts each, but Internet Archive went fully offline
("Temporarily Offline") partway through this attempt, confirmed by
inspecting a returned error page's title directly. Montana is the
strongest remaining lead of the five — the second edition is confirmed
to exist, not just guessed at — and is worth an immediate retry once
Archive.org's availability stabilizes.

**Massachusetts — still blocked, but the failure is now understood.**
CDX revealed the two snapshots for the original "2025.1" URL were both
served as `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
(DOCX, not PDF) — explaining why every earlier download attempt in this
session identified as "Microsoft Word 2007+" and failed a PDF-parsing
check. The correctly-suffixed PDF URL (`...-0/download`) was located via
CDX and has four real `application/pdf` snapshots. Every one of them was
attempted (resume-based and fresh, across all four timestamps): each
consistently produced a file that is syntactically well-formed at the
tail (ends with a proper `%%EOF` trailer) but internally broken —
`pypdf`/`pdfplumber` extraction returns only 1 page and 387 characters
from an 8.5MB file that should contain roughly 150-200 pages. This
matches Wayback serving a truncated byte range that happens to end on an
object boundary rather than a clean file-level cutoff, and does not
respond to further retries (confirmed with a 40-attempt resume push that
made zero additional progress past the same fixed byte count). Not yet
solved; would need either a different retrieval path (e.g. Archive.org's
IA-item download API instead of the wayback playback route) or for the
underlying capture to be re-crawled with the corruption absent.

**North Carolina — still fully blocked**, no change from §38. The same
resume-based CDX-informed approach was not reapplied this round given
time constraints; §38's finding (confirmed loadable, zero complete
downloads across 30+ attempts and three snapshot dates) stands.

### 41.1 Running total

| Publisher | Titled | Preamble/fragmentation | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| Delaware | ~50% | — | — | Failed |
| South Carolina | ~36% | — | — | Failed |
| Rhode Island | 96% | 44.3% preamble | 65.0% | Partial — unusable |
| Vermont | 100% | fragmentation | 65.4% | Partial — unusable |
| **Tennessee** | 98.6% | 5.0% preamble, 0 fragmentation | 2.7% | **CLEAN** |
| Kentucky | 100% | 99.0% preamble (formulary, not protocols) | — | Failed |
| West Virginia | 100%\* | 59.4% / 52.2% preamble + uncleaned footer labels | 39.7% | Failed |
| Nebraska | 100%\* | 0% preamble, garbage anchor (drug/diagnosis noise) | — | Failed |
| **Pennsylvania** | 97.2% | 0% preamble, 51 real titles both editions | 6.7% | **CLEAN** |
| New Jersey | ~65%\* | 0% preamble, garbage anchor (dose/sentence fragments) | 57.8% | Failed |
| Alabama | ~30%\* | 61.8% / 73.4% preamble + garbage anchor + item collapse | 58.4% | Failed |
| Maryland | ~44%\* | 55.7% / 56.1% preamble + garbage anchor (STRONG verdict, failed anyway) | 26.5% | Failed |
| Hawaii | ~91%\* | 0% / 38.7% preamble + item collapse + raw page-counter anchor | 52.2% | Failed |
| Utah | 100%\* | total item-detection collapse (11 then 3 items) | 100.0% | Failed |
| Oklahoma | ~52%\* | 47.8% / 57.8% untitled + flowchart-box garbage anchor | 60.0% | Failed |
| Ohio | ~93%\* | 7.0% / 8.4% preamble + flowchart-box garbage anchor | 38.9% | Failed |
| New Hampshire | ~86%\* | 3.5% then 94.4% preamble — collapses between editions | 29.6% | Failed |

\* "Titled" means no `<untitled@N>` placeholder appeared — not that the
label is a real protocol name.

Nineteen genuine blind attempts, two clean passes, across seventeen
distinct states with full pipeline data. Of the five states pursued this
round: one now tested (NH, failed), one confirmed permanently
unrecoverable (AZ — no second edition was ever archived, full stop),
one confirmed recoverable in principle with a next step identified (MT —
retry once Archive.org stabilizes), and two still blocked with the
specific blocking mechanism now understood (MA — internal corruption in
every PDF snapshot; NC — unchanged, per §38).

**Immediate follow-up on Montana**: once Archive.org's availability
recovered mid-round, the long-standing main-digest edition (2021-04-30
capture) downloaded successfully and cleanly (1,328,248 bytes, confirmed
valid PDF) — the same content that had failed every earlier attempt in
this and the prior round, now retrievable simply because the underlying
service was healthier. The single-day outlier edition (2024-07-18),
however, still would not download across a further 27 attempts (39
total across both rounds), consistently returning either a 0-byte
response or an 11,832-byte "Internet Archive: Temporarily Offline" error
page — even during stretches when the main-digest file and other
Archive.org endpoints were confirmed reachable. This points to a
capture-specific problem (e.g. a corrupted or unusually-stored WARC
record for that one day) rather than general service health, and is a
narrower, more specific blocker than "Archive.org is down." **Montana
still has only one confirmed-retrievable edition; the genuine second
edition remains real but not yet retrievable.**

## 42. Dev-publisher quarantine reset: Connecticut is a third clean publisher; New York and Maine pass titling but expose a new "genuine revision, not parser failure" category

§19 excluded New York, Maine, and Connecticut from the confirmatory test
set because the parser strategies that support them (`_KNOWN_ANCHORS`
for NY, `detect_footer_anchors` for Maine, `detect_ct_toc_anchors` for
CT) were built by reading each publisher's actual content — a violation
of §3.4's quarantine rule in substance, even though these publishers
were nominally slated as test data. That exclusion stands for the
specific editions inspected during development. It does not
automatically extend to editions of the same publisher that were never
looked at, since §3.4 prohibits reacting to what is observed in a test
document, not reusing a publisher's name. This round identified and
tested exactly such editions — confirmed genuinely untouched by cross-
referencing the dev-phase sections (§12-18) against what was downloaded
then, and by direct evidence that these specific files were never
fetched before now.

| Publisher | Dev-phase editions (contaminated) | This round's editions (untouched) |
|---|---|---|
| New York (Collaborative) | v25.1, v26.0 | **v23.1** (eff. 2023-02-15), **v24.1** (eff. 2024-07-01) |
| Maine | 2023, 2025 | **2013** (archived), **2019** |
| Connecticut | v2025.1, v2025.2 | **v2022.1** (Apr 2022), **v2023.1** (Dec 2023) |

`corpus_probe`: STRONG on both NY editions; STRONG on both Maine
editions; WEAK/USABLE split on the Connecticut pair (matching the
split-verdict pattern already seen for New Jersey in §29 — not
predictive of outcome, consistent with the discipline established
throughout this phase). All three pairs were run through `parse()` and
`item_align.py` with zero code changes, exactly as every other blind
state this session.

### 42.1 Connecticut v2022.1 → v2023.1 — a third genuine clean pass

0% preamble, 0% untitled in both editions (1212 and 1532 items), 92 and
93 distinct guidelines. The full title lists were read end to end and
confirmed real: `Intraosseous Access`, `Poisoning/Substance
Abuse/Overdose – Adult`, `Cardiac Arrest – Pediatric`, `Abuse and
Neglect of Children and the Elderly`, `Routine Patient Care`, plus a
handful of reasonable appendix entries (`Appendix 1: CT Adult Medication
Reference`). `item_align.py`: 790 T1, 246 T2, 12 T3, 3 T4, 92 T5, 69 T6
— **85.5% trivially alignable, 8.8% requires-more-than-id, 5.7%
unmatched** — matching Pennsylvania's quality almost exactly (88.6% /
6.7%) and clearing Tennessee's (98.6% titled / 2.7% unmatched) bar for
"clean." This is the **third genuine clean pass** of the study, and the
**third distinct clean publisher** (Tennessee, Pennsylvania,
Connecticut).

### 42.2 New York v23.1 → v24.1 and Maine 2013 → 2019 — clean titling, poor automated alignment, for a documented and legitimate reason

Both pairs show the parsing quality of a clean pass — 0% preamble on
both NY editions (1.8%/1.6% untitled only), 0% preamble and 0% untitled
on both Maine editions — and both full title lists were read end to end
and are overwhelmingly real protocol names (New York: `Carbon Monoxide
Exposure – Suspected`, `Bleeding / Hemorrhage Control`, `Technology
Assisted Children`, `Transfer of Patient Care`; Maine: `Acute Stroke`,
`Trauma Triage Protocol`, `Chest Pain - Suspected Cardiac Origin`,
`Universal Pain Management`). Neither shows the garbage-anchor or
majority-preamble signatures that define every failure catalogued in
§21-§41.

**But `item_align.py`'s automated matching performs poorly on both: New
York 24.0% trivially alignable / 42.4% unmatched; Maine 27.6% trivially
alignable / 63.3% unmatched.** Hand inspection of the full title lists
identifies why, and it is **not** the parser mis-segmenting the
document — it is that these two publishers genuinely revised their
protocols substantially between the tested editions, in ways the
alignment tool's exact-ID-then-fuzzy-match heuristic cannot resolve
automatically:

- **New York** renamed several protocols (`Anaphylaxis – Adult` →
  `Anaphylaxis and Allergic Reaction – Adult`; `ALTE/BRUE – Pediatric` →
  the fully-spelled-out `Apparent Life-Threatening Event (ALTE) / Brief
  Resolved Unexplained Events (BRUE) – Pediatric`) and split at least one
  protocol in two (`Environmental: Cold Emergencies` →
  `Environmental: Hypothermia` + `Environmental: Localized Cold
  Emergencies`), alongside genuinely new protocols in v24.1
  (`Procedural Sedation – Adult/Pediatric`, `Hospice Care`,
  `Organophosphate – CHEMPACK Program`). A **smaller, separate** and
  genuinely minor parser artifact is also present: a handful of titles
  (on the order of 5-10 out of ~60) have stray bullet-point text bled
  into their front, e.g. `'o Cardiac monitor, continuous SpO2 and
  continuous pCO2 monitoring Hyperkalemia – Adult'` where the real title
  is just `Hyperkalemia – Adult`. This is real and worth a future fix,
  but it affects a small minority of items, not the majority pattern
  that defines every other failure this phase.
- **Maine** shows almost entirely genuine reorganization across the
  6-year gap: consolidations (`Adult Seizures` + `Pediatric Seizures` →
  a single `Seizure`; `Pain Management In Trauma` +
  `Pediatric Traumatic Pain Management` → `Universal Pain Management`),
  renames (`Hypovolemic Shock` → `Hemorrhagic Shock`; `Known or Suspected
  Cyanide Exposure` → `Cyanide/CO Exposure`; `Acute Stroke` → `Stroke`),
  removals (`Adult Coma`, `Pediatric Coma`), and genuinely new 2019
  content (`ASSESSMENT`, `Agitation/Excited Delirium`, `Cardiac Arrest`
  as its own protocol, `Spine Management`, `Tachycardia`). No title-
  contamination artifact was found in Maine's list at all — every title
  in both editions is clean.

**This is a legitimately new category, distinct from both "clean" and
every failure mode catalogued so far**: the parser correctly extracts
real, clean protocol titles, but the *simple automated aligner* cannot
resolve genuine large-scale semantic revision (renames, splits,
consolidations) into matched pairs — which is precisely the kind of case
the pre-registration's human annotation phase (§5, `annotation.py`,
already built) exists to classify (T3/T4/T5 tiers), not a sign the
parsing pipeline is broken. Logged as **"clean parse, high genuine
revision"** rather than folded into either the clean-pass or failed
buckets.

### 42.3 Updated running total and pre-registration status

| Publisher | Titled | Preamble | Unmatched (T6) | Verdict |
|---|---|---|---|---|
| **Tennessee** | 98.6% | 5.0% | 2.7% | **CLEAN** |
| **Pennsylvania** | 97.2% | 0% | 6.7% | **CLEAN** |
| **Connecticut** | 100% | 0% | 5.7% | **CLEAN** |
| New York (Collaborative) | ~98%\* | 0% | 42.4% | Clean parse, high genuine revision |
| Maine | 100% | 0% | 63.3% | Clean parse, high genuine revision |

\* "Titled" here means no `<untitled@N>` placeholder — real titles
confirmed by full-list hand read, not sampling.

**The confirmatory test set now stands at three genuine clean pairs from
three distinct, non-contaminated publishers (Tennessee, Pennsylvania,
Connecticut) — meeting the pre-registration's §3.2 minimum-viable
**publisher** requirement (≥3 distinct publishers) for the first time in
this study.** It is still one pair short of the minimum-viable **pair**
count (≥4), and short of the target (≥6 pairs / ≥4 publishers). The
straightforward way to close the remaining pair-count gap without any
further code changes or new publisher hunting: retrieve one additional
edition pair from any of these three now-validated clean publishers
(e.g., a second Connecticut pair, such as v2023.1→v2025.1, or a second
Pennsylvania or Tennessee pair from adjacent editions) — a materially
easier task than finding a fourth clean publisher from scratch, since
these three are now known to parse cleanly. New York and Maine remain
valuable as documented "clean parse, high genuine revision" cases for
the paper's discussion of what automated alignment can and cannot do on
its own, independent of whether they ever contribute a confirmatory
pair.

No parser code was touched in reaching any of these three results —
same frozen pipeline, same zero-reaction discipline, applied to
publishers whose *name* was previously dev but whose *specific tested
editions* were not.

## 43. Fourth clean pair: Connecticut v2023.1 → v2024.1 — minimum-viable test set now complete

Two more untouched Connecticut editions were pursued to close the
remaining pair-count gap. **v2017.1** (`portal.ct.gov`, an older edition
predating the modern ToC-based layout the parser's `detect_ct_toc_anchors`
strategy depends on) was tried first, paired against the already-held
v2022.1 — and **failed**: only 195 items detected (against v2022.1's
1212, in a document of comparable page count), 33.3% untitled, and the
dominant label is a garbage continuation-header fragment,
`'Procedure Continued EMT STANDING ORDERS'` (63.1% of items).
`item_align.py`: 0.0% trivially alignable, 74.9% unmatched — a real,
honest failure, kept as data rather than discarded: Connecticut's clean
parsing is specific to its modern (2022+) document format, not an
automatic property of the publisher across all history, consistent with
the format-era sensitivity seen throughout this study (e.g. West
Virginia's footer format changing between the tested editions, §26).

**v2024.1** (also untouched, sitting between the two already-confirmed
2022-1/2023.1 clean editions and the dev-touched v2025.1) was tried
next, paired against v2023.1 — and is the **cleanest result of the
entire study**: 0% preamble/untitled on both editions (1532 and 1552
items, 93 distinct guidelines each), and the full v2024.1 title list was
read end to end — every one of its 93 entries is a real protocol name
(`Acute Coronary Syndrome – Adult`, `Rapid Sequence Intubation (RSI) -
Adult`, `Traumatic Brain Injury – Adult & Pediatric`, `Prehospital Blood
Product Transfusion`, a small number of appendix entries, and two minor
cosmetic artifacts — a stray numbering prefix on one title and a "NEW"
tag on three others — neither affecting parseability). `item_align.py`:
1190 T1, 327 T2, 6 T3, 2 T4, 0 T5, 7 T6 — **99.0% trivially alignable,
0.5% requires-more-than-id, 0.5% unmatched** — better than every other
result in the study, consistent with this being only a one-year minor
revision (the same "minor bumps align far better than major ones"
pattern noted for NASEMSO and New York BLS during dev, §17.3).

This is the **fourth genuine clean pair** of the study.

### 43.1 Final confirmatory test set

| # | Publisher | Pair | Trivially alignable | Unmatched |
|---|---|---|---|---|
| 1 | Tennessee | 2017 → 2018 | 92.7% | 2.7% |
| 2 | Pennsylvania | 2021 → 2023v1-2 | 88.6% | 6.7% |
| 3 | Connecticut | v2022.1 → v2023.1 | 85.5% | 5.7% |
| 4 | Connecticut | v2023.1 → v2024.1 | **99.0%** | **0.5%** |

(Correction: an earlier draft of this table quoted Tennessee's 98.6%
*titled* rate in the trivially-alignable column. The actual
trivially-alignable figure, from §24.1, is 92.7%. Caught during the
audit in §44 below.)

**The pre-registration's §3.2 minimum-viable confirmatory test set (≥4
pairs from ≥3 distinct publishers) is now met in full**: 4 pairs, 3
distinct publishers (Tennessee, Pennsylvania, Connecticut — Connecticut
contributing 2 of the 4 pairs, which the pre-registration's wording
permits since the requirement is stated as a floor on both pairs and
publishers independently, not one pair per publisher). The target
(≥6 pairs / ≥4 publishers) is not yet met — reaching it would need
either 2 more pairs from these three publishers, or a fourth clean
publisher, neither undertaken here without further instruction.

No parser code was touched in reaching this result.

## 44. Correctness audit of the confirmatory test set

Requested directly by the user ("double check if everything we have done
till now is correct"), before treating §43's minimum-viable claim as
settled. This is a genuine audit, not a formality — it found one real
error (now fixed, §43.1) and one real open compliance question (not
resolved here, left for explicit decision below), alongside several
things that checked out cleanly.

### 44.1 Quarantine discipline — verified against git history, not self-report

Every round since the blind-test phase began has claimed "no parser code
touched." That claim was never previously checked against the actual
commit history — only asserted. Checked now:

```
git log --oneline --name-only d3068ee..HEAD -- 'app/research/cross_edition/*.py'
```

returns **zero results**. No `.py` file under `cross_edition/` has
changed since the code state was frozen at `d3068ee`, across all 20+
blind-test rounds, the five-round US-states coverage survey, the Wayback
recovery rounds, and this round's NY/ME/Connecticut work. The
quarantine-discipline claim is confirmed, not just asserted.

### 44.2 §3.2 eligibility criteria — computed explicitly for all four pairs, all pass

Criteria 2 (`corpus_probe` USABLE/STRONG) and part of criterion 1 were
checked informally as each pair was tested, but criterion 4 (≥200 items,
<5% duplicate identifiers per edition) had **never been explicitly
computed and reported** for any of the four confirmatory pairs. Computed
now, using the exact same duplicate-identifier definition already in
`item_parser.py`'s own `main()` (`len(items) - len({item_id})`):

| Pair | Edition | Items | Duplicate IDs | Duplicate % |
|---|---|---|---|---|
| Tennessee | 2017 | 1,500 | 0 | 0.0% |
| Tennessee | 2018 | 1,492 | 0 | 0.0% |
| Pennsylvania | 2021 | 1,699 | 0 | 0.0% |
| Pennsylvania | 2023v1-2 | 1,769 | 0 | 0.0% |
| Connecticut #1 | v2022.1 | 1,212 | 0 | 0.0% |
| Connecticut #1/#2 | v2023.1 | 1,532 | 0 | 0.0% |
| Connecticut #2 | v2024.1 | 1,552 | 0 | 0.0% |

All eight editions clear ≥200 items by a wide margin (well over 1,000 in
every case) and all have **zero** duplicate item identifiers, not merely
under the 5% ceiling. Criterion 4 is fully satisfied.

### 44.3 "Consecutive editions" — verified against each publisher's own official version list, not assumed

Checked directly rather than assumed, since Pennsylvania's pair spans
two calendar years (2021→2023) and Connecticut publishes sub-annual
revisions in some periods:

- **Pennsylvania** — its own EMS Regulations page lists only 2020, 2021,
  and 2023 ALS Protocol editions; **no 2022 edition was ever published**.
  2021→2023 is therefore genuinely the next available edition, not a
  skipped one.
- **Connecticut** — its own Statewide EMS Protocols page publishes the
  complete archived-version list: `...v2022.1, v2023.1, v2024.1,
  v2025.1, v2025.2 (current)...`. No `v2022.2` or `v2023.2` exists in
  the 2022-2024 window this study tested (Connecticut does publish
  sub-annual revisions in other periods, e.g. three releases in 2020
  alone — but not in the window used here). **Both tested Connecticut
  pairs are confirmed genuinely consecutive**, and so is the dev pair
  (v2025.1→v2025.2, the two most recent entries before the current
  release).
- **Tennessee** — no evidence of an intervening edition between the two
  tested dates; not independently re-verified against an official
  version-history page this round, since none was located with a
  complete list the way Pennsylvania's and Connecticut's were.

### 44.4 One real error found and fixed: §43.1's Tennessee row

The first draft of §43.1's summary table quoted Tennessee's **98.6%
titled** rate (from §24.1) in the trivially-alignable column. The actual
trivially-alignable figure for Tennessee, also from §24.1, is **92.7%**.
Corrected in place. This was a transcription mistake made while writing
§43, not a re-computation error — the correct number was already sitting
in §24.1 the whole time.

### 44.5 §3.3 revision-magnitude classification — never done prospectively; applying it now surfaces a genuine open question

§3.3 requires every pair to be labelled **major** or **minor** "from
publisher metadata only, never from measured change," and states the
rule must be applied "before retrieval" in spirit (the section header
reads "declared before retrieval") — meaning before alignment numbers
exist, so the label cannot be influenced by how well or badly a pair
turns out to align. **This was never done for Tennessee, Pennsylvania,
or either Connecticut pair before this audit.** All four pairs' alignment
percentages were already known before any magnitude label was assigned.
This is itself a deviation from §3.3's procedure, independent of what
the labels turn out to be.

Attempting the classification now, from metadata alone (not from the
already-known alignment numbers), surfaces a real ambiguity the
pre-registration's own worked example doesn't resolve cleanly:

- **Connecticut's version scheme is `YEAR.subversion`** (`2022.1`,
  `2023.1`, `2024.1`, `2025.1`, `2025.2`). Mapping §3.3's own example
  (`2.x → 3.0` = major, pre-decimal component increments) onto this
  scheme the natural way — treating the year as the pre-decimal
  "leading version component" and the trailing digit as the minor
  tracker — means **every year-to-year Connecticut transition is a
  major revision**, and only a same-year sub-version bump (like dev's
  v2025.1→v2025.2) is minor. Under this reading, **both tested
  Connecticut pairs (v2022.1→v2023.1, v2023.1→v2024.1) are MAJOR
  revisions**, not minor. This is a defensible reading — Connecticut's
  own page describes the annual cycle as where substantive review
  happens, with interim same-year updates reserved for narrow
  "emergency" or "desired change" requests — but it is an interpretation
  applied to a versioning convention §3.3's `2.x → 3.0` example was not
  written with in mind, not a mechanical, unambiguous application of the
  rule.
- **Tennessee has no version-number scheme at all** — the two tested
  editions are dated "July 2017 (revised 11.7.2017)" and "March 2018
  (Rev 7.7.18)," with no major/minor-style numbering and no "full
  review" language found anywhere in publicly available Tennessee EMS
  material. §3.3 states plainly: **"Pairs whose magnitude cannot be
  determined from publisher metadata are excluded, not guessed."** By
  that letter, Tennessee's magnitude may not be determinable from
  metadata at all — which would mean the Tennessee pair does not
  currently have a valid classification under the pre-registration's own
  rule, a real compliance gap.
- **Pennsylvania**: 2021 → 2023v1-2 spans two calendar years with a
  confirmed-absent 2022 edition (§44.3), and Pennsylvania's own EMS
  Information Bulletin (EMSIB 2023-17/18/25) explicitly announced it as
  a "2023 PA DOH Statewide Protocol Update" — publisher-described update
  language exists, though "Update" is weaker than §3.3's example phrase
  "full review/revision." Leans toward major given the multi-year gap
  and the explicit bulletin, but is not as clean-cut as Connecticut's
  year-line reading.

**This is deliberately not resolved unilaterally here.** It has real
consequences for how the confirmatory result should be described: if
two of the four clean pairs are genuinely major revisions that still
aligned at 85.5%/99.0%, that is a *stronger* finding than if all four
were routine minor bumps, given dev evidence repeatedly showed major
revisions align worse (§17.3, §18.4). Conversely, if Tennessee's
magnitude genuinely cannot be determined from metadata, §3.3's own
stated consequence is exclusion — which would drop the confirmatory set
to 3 pairs from 2 fully-classified publishers (Pennsylvania and
Connecticut), **below both the pair-count and, depending on how
Pennsylvania's classification lands, potentially the publisher-count
minimum-viable thresholds** — reopening the question §43 treated as
closed. Flagged here for the user's explicit decision rather than
silently classified in whichever direction keeps the minimum-viable
claim intact, which would be exactly the kind of motivated
post-hoc reasoning pre-registration exists to prevent.

### 44.6 Overall assessment

The blind-test discipline itself — the core methodological commitment of
this entire multi-week effort — checks out: verified against git
history, not just claimed. The newly-added Connecticut pairs and the
NY/Maine "clean parse, high genuine revision" findings are sound; their
underlying `parse()`/`item_align.py` numbers were independently
recomputed during this audit and match what was previously reported. One
real transcription error was found and fixed. §44.5 left the
revision-magnitude question open rather than resolved. §44.7 resolves it.

### 44.7 Revision-magnitude classification resolved — from each document's own front matter, not external inference

§44.5's attempt used secondhand search-result summaries and reasoning
about version-number *shape* in the abstract. That was the wrong source
to reason from — §3.3 asks for "publisher metadata," and the most direct
form that takes is what the publisher's own document says about itself
on its own cover or introductory page. Checked directly, extracting each
PDF's first ~1,500 characters:

- **Tennessee** — both editions are titled identically in structure:
  `TENNESSEE EMERGENCY MEDICAL SERVICES PROTOCOL GUIDELINES`, `Revised
  July 2017` / `Revised March 2018`. No version-number scheme, no "new
  edition" or "complete rewrite" language — consistently self-described
  as a **revision**, not a full re-edition.
- **Pennsylvania** — both cover letters use nearly identical phrasing:
  *"Pennsylvania has used Statewide ALS Protocols since July 1, 2007,
  and this edition is an update to the version that was effective on
  [prior date]."* Both editions explicitly self-describe as an
  **"update,"** never a full review or major revision, regardless of the
  2021→2023 pair spanning a 2022 gap year with no published edition.
- **Connecticut** — all three editions (v2022.1, v2023.1, v2024.1) open
  with **word-for-word identical boilerplate**: *"These protocols are a
  'living document'... At the option of the Office of EMS and the
  Medical Advisory Committee, they can be edited and updated at any
  time. However, they are formally reviewed, edited, and released every
  two years."* Nothing in this boilerplate differentiates a year-to-year
  transition from a same-year sub-version transition as more or less
  significant — the "formally... every two years" language describes
  Connecticut's *stated* cadence, not a claim that any specific tested
  transition was a full review versus a routine edit. §44.5's
  "year-line = major" reading was an inference from version-number shape
  alone, unsupported by — and in tension with — the document's own
  "living document... at any time" self-description. Withdrawn.

**None of the three publishers' own documents describe any of the four
tested transitions as a full review, complete revision, or major
version change, anywhere in the front matter.** Applying §3.3's rule as
written — major requires either a leading-version-component increment
in a genuine major.minor sense (none of these three publishers use one)
or explicit "full review/revision" language (none found) — all four
pairs classify as **minor**:

| Pair | Classification | Basis (publisher's own words) |
|---|---|---|
| Tennessee 2017→2018 | **Minor** | Both editions self-described as "Revised," not a new edition |
| Pennsylvania 2021→2023 | **Minor** | Both editions explicitly self-described as "an update to the version that was effective on..." |
| Connecticut v2022.1→v2023.1 | **Minor** | Identical "living document... edited... at any time" framing, no full-review language |
| Connecticut v2023.1→v2024.1 | **Minor** | Same |

Tennessee's classification rests on the thinnest evidence of the four
(the word "Revised" alone, no explicit continuity statement like
Pennsylvania's or Connecticut's) but is still real, document-sourced
metadata — not an absence of metadata. §3.3's exclusion clause ("cannot
be determined... excluded, not guessed") does not apply here: a
classification was determined, from the document itself, in all four
cases.

**Consequence for how the confirmatory result should be read:** this is
the less dramatic of the two possible outcomes flagged in §44.5 — all
four pairs are minor revisions, consistent with (not an exception to)
the dev-phase pattern that minor revisions align well (§17.3, §18.4). It
is still a valid confirmatory result — the pre-registration's minimum-
viable test set (≥4 pairs, ≥3 publishers) is met with all four pairs
now properly classified, not merely counted — but the framing "major
revisions that still aligned cleanly" floated as a possibility in §44.5
does not apply to any of the four pairs actually in the confirmatory
set.

**One procedural deviation remains and is logged as such, not hidden:**
this classification was performed after every pair's alignment
percentage was already known, not before, as §3.3 requires in spirit.
Re-reading the front matter after the fact could not have been biased by
the alignment numbers in either direction here — the classification
question (does the document call itself an "update" or a "full
review"?) is independent of how well `item_align.py` happened to score
it — but the *order of operations* itself is a deviation from the
pre-registration's stated procedure, and is recorded as one in
`PREREGISTRATION.md` §11.

§43's headline claim — minimum-viable test set met, 4 pairs from 3
publishers — is now confirmed **and** properly classified, not merely
provisional. No parser code was touched anywhere in this audit or its
resolution.

## 45. A real problem the classification resolution surfaces: zero major pairs, and H1/H2 are currently untestable

§7 defines H1 (the study's *primary* hypothesis — identifier lookup
loses provenance on major revisions) and H2 (the loss is
revision-magnitude dependent) as requiring **major** test pairs
specifically; H2 requires both major and minor pairs to compare. §44.7
classified all four confirmatory pairs as **minor**. The direct
consequence, not previously stated plainly: **the current confirmatory
test set cannot test H1 or H2 at all** — not "weakly," not "with wide
confidence intervals," but literally has zero pairs in the required
stratum. H3 and H4 remain testable, since neither requires a
major/minor split.

### 45.1 A genuine attempt to find an untouched major pair

Dev's NY Collaborative pair (v25.1→v26.0) was explicitly tracked during
dev as NY's *major* pair (§13-14, compared directly against "NASEMSO
major"), confirming NY's `vYY.Z` scheme (leading number increments,
trailing sub-version resets to `.0`) genuinely mirrors §3.3's own
`2.x → 3.0` example — but that specific pair is dev-contaminated and
cannot be reused. Checked for an untouched equivalent elsewhere in NY's
history and found one with strong independent evidence of being a real
major transition: a **2017** Collaborative edition (regional-council
mirror, `wremac.com`) whose own cover reads `2016 - 2` — an old
`YEAR-N` numbering scheme — paired against a **2019** edition
(`hvremsco.org` mirror) whose cover reads `Version 002` — a wholly
different numbering scheme. The publisher's own versioning *convention*
changed between these two editions, not just the number within a
convention — about as strong a "full revision / re-basing" signal as
metadata can give, and neither edition had been touched by any prior
work in this study (dev only ever used v25.1/v26.0).

`corpus_probe`: STRONG on both (41.5% / 39.8% numbered lines). But
`parse()` fails badly: **58.7% and 69.3% of items are `<untitled@N>`**
— not preamble, genuinely unattached to any guideline — and the small
minority of items that *do* get a label are the same garbage-anchor
family already catalogued five times this phase: `'o Equipment
failure'`, `'Delivery'`, `'Suspected'`, `'For the pediatric patient,
"Pediatric: Shock / Hypoperfusion"'` — sentence and cross-reference
fragments, not protocol names. `item_align.py`: 6.8% trivially
alignable, 44.5% unmatched. **This is a genuine parsing failure, not a
legitimate hard case for H1/H2** — the older (pre-2019) NY document
generation apparently doesn't carry the `criteria` anchor the parser's
`_KNOWN_ANCHORS` strategy depends on in a form the fallback can reliably
find, the same structural-generation sensitivity seen throughout this
study (West Virginia's footer format, Connecticut's pre-2022 layout in
§43). Applying the identical standard used to reject every other
garbage-anchor state this phase, **this pair is rejected** — not used,
regardless of how badly it would need to fail in order to "confirm" H1.
Using a pair the parser cannot reliably segment to test a hypothesis
about the *aligner's* failure mode would conflate two different kinds
of failure and invalidate any resulting claim.

### 45.2 Where this leaves the study

No parser code was touched in this attempt either. The honest state of
the confirmatory test set: **4 valid minor pairs (meeting minimum-viable
§3.2), 0 valid major pairs, H1 and H2 currently untestable, H3 and H4
testable now.** Closing this gap requires finding a publisher with (a) a
genuine, metadata-evidenced major revision, and (b) a document
generation the frozen pipeline actually parses cleanly on *both* sides
of that transition — which is a materially harder combination than
finding any clean pair at all, since major revisions are disproportionately
likely to also be accompanied by a format change (as this NY attempt
shows directly). This is now the single most consequential open gap in
the study, ahead of padding pair-count toward the §3.2 target — not
resolved here, and not silently worked around by weakening H1/H2's
definitions or accepting a badly-parsed pair.

## 46. Pre-committed stopping rule applied: the two free diagnostics, both closed without success; Option 1 exhausted

Per the stopping rule logged in `PREREGISTRATION.md` §11, the two
cost-free checks (re-analysis of existing data, not new acquisition —
exempt from the 5-candidate cap) were run before spending any cap slot.

**Rhode Island and Vermont (Option 5)**: both editions' own front matter
checked directly. Rhode Island: `Version 2022.01` / `Version 2026.02`,
described only as protocols that "supersede all protocols and standing
orders previously published" — a living-document framing, no full-review
or complete-rewrite language. Vermont: the 2025 edition explicitly says
it "replaces 2023 version," self-described as "a living document...
reviewed, edited, and approved" — same framing. **Both classify as
minor** under the identical document-text standard applied in §44.7 to
Tennessee, Pennsylvania, and Connecticut. Even setting aside that both
were already rejected on parsing quality (§22.5, §23), neither would
have helped H1/H2 even if their parsing quality were acceptable. This
lead is closed.

**New York's modern-era `.0` history (Option 1's one concrete lead)**:
no confirmed genuine `.0` edition exists outside the dev-touched v26.0.
The one candidate found, `v25.0`, downloads as a real, complete,
186-page document — but its own cover reads `Updated 03.05.2025 –
Effective 07.01.2025*`, the same effective date later carried by
`v25.1` (`Updated 06.13.2025`). v25.0 was superseded before its
effective date ever arrived; it was never the operative document any
EMS provider actually used in the field. Using it as one side of a
confirmatory pair would not represent a genuine second time-point in
practice, independent of any parsing-quality question. This lead is
closed without spending a cap slot, since it fails the eligibility gate
on evidence quality, not on a failed test.

**Status: Option 1 is now exhausted across all three currently-clean,
non-NASEMSO publishers** (Tennessee has only 2 editions total, already
used; Pennsylvania and Connecticut's full available histories show zero
major-labeled editions anywhere; New York's only confirmed major
transition is dev-contaminated). **Zero of the 5 candidate-cap slots
have been used.** The only remaining avenue within the stopping rule is
Option 2 (entirely new publishers) — assessed in §45.2/the accompanying
decision-framework analysis as low-probability, since it requires the
joint occurrence of clean parsing (already rare) and explicit
major-revision self-description (found in zero of the three publishers
checked so far). This is a genuine decision point for the user: spend
cap slots on Option 2, or invoke the terminal condition now and proceed
to annotation with H1/H2 documented as untestable. Not decided
unilaterally here.

## 47. Stopping rule invoked; real (not dry-run) annotation packets generated for all four confirmatory pairs

Asked directly "what should we do now," the terminal condition was
invoked deliberately rather than spending candidate-cap budget on
Option 2's already-assessed low expected value (logged in
`PREREGISTRATION.md` §11). The dataset is frozen at 4 minor pairs from 3
publishers. H1 and H2 are documented as untestable with the current
dataset — an absence of the required stratum, not a disconfirmation of
either hypothesis, and not silently omitted from the eventual paper.

**`annotation.py`'s docstring and CLI notice were updated** — not the
sampling/kappa logic, which is unchanged and was never part of the
frozen pipeline (`PREREGISTRATION.md`'s pinned file list is
`corpus_probe.py`, `item_parser.py`, `item_align.py` only). The module's
own comments explicitly anticipated this moment ("Real sampling waits on
a genuinely unread edition pair"); updating a stale status notice once
that condition is met is adherence to the plan, not a deviation from it.
The unconditional `[DRY RUN NOTICE]` — which would now falsely mislabel
a real confirmatory run — is replaced with a neutral status message
pointing at the docstring's explicit list of which four pairs are
confirmatory.

**Real stratified samples and annotation packets generated for all four
pairs** (`app/research/cross_edition/annotation_packets/`), 60 items
each via `stratified_sample()`/`write_annotation_packet()`, zero code
changes to the sampling logic itself:

| Pair | Population (T1/T2/T3/T4/T5/T6) | Drawn (T1/T2/T3/T4/T5/T6) |
|---|---|---|
| Tennessee 2017→2018 | 1194/196/36/5/28/41 | 15/10/10/5/10/10 |
| Pennsylvania 2021→2023 | 1267/238/14/4/62/114 | 16/10/10/4/10/10 |
| Connecticut v2022.1→v2023.1 | 790/246/12/3/92/69 | 16/11/10/3/10/10 |
| Connecticut v2023.1→v2024.1 | 1190/327/6/2/0/7 | 30/15/6/2/0/7 |

**Total: 240 annotated items across 4 pairs** — short of §5.1's target
(≥360 across ≥6 pairs), a direct, expected consequence of having 4
pairs rather than 6, not a new problem. The shortfall-redistribution
rule (§5.1, corrected 2026-08-17) fired correctly for Connecticut's
second pair, whose T5 population is genuinely zero and T6 population is
only 7 — the sampler correctly redistributed the resulting 47-item
shortfall toward T1/T2 (the only tiers with enough remaining
population) rather than failing or drawing fewer than 60.

**What remains, and cannot be done by this process**: §5.3 requires two
annotators who have "not seen any method output for the item they are
labelling" to label independently. Every item in these four packets has
already been read, in context, by whoever built and blind-tested this
pipeline across the entire retrieval and verification effort — that
disqualifies serving as one of the two required independent annotators.
This phase produced the sample and the packets (CSV + full-context JSON
+ a per-packet README with the exact task instructions from §5.2); it
did not and structurally cannot perform the labelling itself. Two
independent human annotators (the user, or others) completing
`annotator_correspondence` and `annotator_relation` in each packet's CSV
is the next required step before `compute_kappa()` can produce a real
§5.3 reliability statistic.

## 48. Blind, per-annotator packets generated once two real annotators were available

The original packets (§47) followed §5.2's instruction to hide the
method's prediction from the annotator, but implemented it as a
column-hiding *instruction* in the README ("cover it... hide that column
until after your first pass") — a discipline that depends on the
annotator's own care, not a structural guarantee. §5.3's actual
requirement is broader than just the predicted item: annotators must
"not have seen **any method output** for the item they are labelling."
`tier` (T1-T6) is itself a method output — it is `item_align.py`'s own
classification of how well the item aligned — and showing it (e.g.
"T6_unmatched_old") could prime an annotator toward concluding NONE
before they have looked, the same risk as showing the predicted item
directly.

Tightened this once real annotators were available: generated a
**BLIND** CSV per pair per annotator
(`annotator_A/annotation_packet_BLIND.csv`,
`annotator_B/annotation_packet_BLIND.csv`) containing only
`sample_id, old_item_id, old_guideline, old_section, old_marker_path,
old_text` plus the three blank columns the annotator fills in.
`tier`, `sample_weight`, `method_similarity`,
`method_predicted_item_id`, and `method_predicted_text` are absent from
these files entirely — not hidden, removed — retained only in the
original master CSV (§47) for later metric computation
(`item_align.py`'s tier assignment is compared against the adjudicated
answer to compute correspondence accuracy and tier precision, per §6 —
that comparison happens after annotation, on the master file, not
before). Each annotator gets their own physical copy so two people
working the same pair cannot collide or see each other's in-progress
answers. `annotation_context.json` (the full corresponding new-edition
guideline text) is unchanged and shared — it is source-document text,
not a method judgment, so showing it carries no bias risk.
`ANNOTATOR_INSTRUCTIONS.md` written to accompany the blind packets, in
plain non-technical language, replacing the original README's
column-hiding instruction with the structural fact that the columns are
simply not there.

## 49. Single self-contained Excel workbook per annotator, replacing the scattered CSV/JSON/README handoff

Consolidated §48's per-pair CSV + JSON + separate instructions file into
one workbook per annotator
(`Annotator_A/Annotator_A_ANNOTATION.xlsx`,
`Annotator_B/Annotator_B_ANNOTATION.xlsx`,
built by `annotation_packets/build_annotator_workbooks.py`, a one-off
formatting script, not part of the pipeline itself). Each workbook has a
plain-language "READ ME FIRST" sheet plus one tab per pair (240 rows
total across the two files combined, 60 per tab, identical between the
two annotators). The full corresponding new-edition guideline text is
embedded directly in a column on each row — no separate JSON lookup
required — and the three columns the annotator must fill in are
highlighted and validated: `annotator_relation` is a genuine Excel
dropdown restricted to the six §5.2 relation labels, and the two other
fill-in columns are visually marked with a distinct fill color.

One real defect caught and fixed while building this: PDF text
extraction had left stray XML-illegal control characters in a handful of
items (found via a hard `IllegalCharacterError` from openpyxl on one
Connecticut poisoning/overdose guideline specifically) — added a
sanitizer stripping characters outside XML 1.0's legal range before
writing any cell, rather than silently truncating the workbook build or
corrupting the affected rows. Re-ran clean afterward and confirmed via a
full-workbook scan that no cell was accidentally interpreted as a
formula (no value starts with `=`), so no `recalc.py` pass was needed —
this workbook is data and formatting only, no formulas.

The original per-pair CSV/JSON files (§47-48) are retained in the repo,
unchanged — they remain the working data for post-annotation merge-back
(`compute_kappa()`, and the §6 metric computation that needs the
method's original predictions, deliberately absent from anything the
annotators see). The two `.xlsx` files are the actual hand-off
deliverable.
