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

Nine genuine blind attempts, one clean pass. Dropped at retrieval without
testing (no valid pair found): Wisconsin, Alabama, Georgia, Ohio. Searched
without a usable candidate surfacing: Louisiana, Oklahoma, Mississippi,
Nevada, Iowa, Illinois, Alaska, Hawaii — in each case either no statewide
protocol document exists, or only one dated edition could be confirmed.
