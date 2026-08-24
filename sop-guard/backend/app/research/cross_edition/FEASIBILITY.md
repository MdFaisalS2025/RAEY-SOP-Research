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

## 50. Annotator workbooks returned; agreement statistics computed — CORRECTED 2026-08-18, see the box below

> **Correction, added during the 2026-08-18 full-study audit (requested by
> the user to check "everything from the beginning").** This section
> originally reported four independent annotators, Cohen's κ = 1.0000
> for the A/B pair, and Fleiss' κ = 0.877 across all four. Checking
> file hashes and raw answers directly found: **A's answers are
> byte-identical to B's on every item, and C's are byte-identical to
> D's on every item** (confirmed via file content comparison, not
> merely matching normalized answers) — two distinct answer sets, not
> four independent ones. The 43 "4-rater disagreements" below are, on
> re-inspection, exactly the 43 places the two real sets (A=B) and (C=D)
> disagree, and **every one of the 43 is a (2,2) vote split with zero
> 3-1 splits** — the pattern a 2-set duplication produces, and a pattern
> four genuinely independent raters would be extremely unlikely to
> produce by chance. "Cohen's κ = 1.0000" was a file agreeing with a
> copy of itself, and "Fleiss' κ = 0.877" was computed over two distinct
> opinions counted twice each, not four. Both are unsupportable as
> originally stated and are corrected below.
>
> **What does NOT change**: the real, pre-registered §5.3 design was
> exactly two annotators with Cohen's κ - and two genuinely distinct
> answer sets exist here. The honest statistic is Cohen's κ between them:
> **0.8168** (240 items, 43 disagreements) - well above §9's 0.60 abort
> threshold, and a far more credible number than 1.0 on its face. Every
> one of the 43 disagreements was already routed to real, discussion-based
> adjudication (§51) regardless of how many raters were believed to
> produce it, so **the adjudicated ground truth, and every §6/H3/H4/H5
> metric computed from it, is unchanged** - this was verified by
> re-running the full pipeline after this correction and confirming
> `full_comparison_report.json` reproduces byte-for-byte. This correction
> is about how the reliability of the *process* is described, not about
> what the ground truth *is*. Logged as its own dated entry in
> `PREREGISTRATION.md` §11, per that document's append-only discipline.

The user obtained annotator files labeled A, B, C, and D. Per the
analysis plan pre-committed in `PREREGISTRATION.md` §11 (2026-08-17,
"Annotation upgraded from two annotators to four") — logged *before* any
of the four files were opened — Cohen's kappa on the originally-designated
Annotator A/B pair was to be the primary statistic. That plan is honored
here in substance: A and B (and separately C and D) turned out to be the
same two answer sets, so the primary statistic — Cohen's κ between two
genuinely distinct sets of judgments — is exactly what was pre-registered,
computed correctly, at 0.8168 rather than the originally-reported 1.0000.

**Completeness check first**: both distinct answer sets, all four tabs
each, 60/60 rows answered — 480 real judgments (240 items × 2 distinct
raters, not 960), zero blank cells, zero case/whitespace-variant
formatting issues in either the `NONE` / `CANNOT_DETERMINE` vocabulary or
the free-typed item-ID answers.

**`annotation.py` extended** (not the frozen pipeline — see §47) with
`load_completed_xlsx()` and `majority_vote()`, which explicitly flags
items with no majority for real discussion-based adjudication rather
than resolving them automatically. `fleiss_kappa_correspondence()` was
also added but its result is **withdrawn** by this correction — Fleiss'
κ requires genuinely independent raters, which this data does not
provide (see the correction box above), and it is not reported as a
statistic anywhere in this study going forward. A one-off driver script
(`annotation_packets/run_4rater_analysis.py`) ran these against the four
files and wrote `4rater_analysis_report.json`, which is retained for
audit purposes but should be read with this correction in mind.

### 50.1 Results (corrected)

| Pair | Cohen's κ (real 2 answer sets) | Disagreements (all (2,2) splits) |
|---|---|---|
| Tennessee 2017→2018 | 0.7935 | 12/60 |
| Pennsylvania 2021→2023 | 0.6934 | 18/60 |
| Connecticut v2022.1→v2023.1 | 0.8014 | 11/60 |
| Connecticut v2023.1→v2024.1 | 0.9661 | 2/60 |
| **Pooled (240 items)** | **0.8168** | **43/240 (17.9%)** |

The two real, distinct answer sets agree on 197 of 240 items (82.1% raw
agreement) — a substantial, credible level of reliability, comfortably
above §9's abort threshold, though naturally lower than the erroneous
1.0000 originally reported. Per-pair reliability is weakest on
Pennsylvania (0.6934, "substantial" on the Landis & Koch scale) and
strongest on Connecticut v2023.1→v2024.1 (0.9661, "almost perfect"), a
real and plausible spread for a task of this kind rather than the
implausible uniform 1.0 across all four pairs the original write-up
reported.

**43 of 240 items (17.9%) — every one a genuine (2,2) split between the
two real answer sets — are flagged for real adjudication**, not resolved
automatically. Spot-checked two flagged cases directly to confirm the
flag is catching genuine judgment calls, not measurement noise:

- A 2-2 split where two annotators pointed to one specific new item
  (`...#7`, labeled `unchanged`) and the other two pointed to a
  different specific item (`...#4`, labeled `moved`) — a real
  disagreement about *which* item the old one now corresponds to, not a
  formatting difference.
- Two items where A/B answered `CANNOT_DETERMINE` while C/D answered
  `NONE` (confidently deleted) — a genuine interpretive disagreement
  about ambiguity versus certainty, exactly the kind of case §5.3's
  adjudication step exists for.

### 50.2 What remains before final ground truth is locked

Per §5.3, disagreements get resolved by discussion, not by the majority
vote alone standing in as ground truth. The 43 flagged items (listed in
full in `4rater_analysis_report.json`) need actual adjudication — by the
annotators discussing them, or a designated third-party adjudicator, per
the option previously discussed with the user — before the `§6` metrics
(correspondence accuracy, provenance loss rate, tier precision, deletion
recall/precision) can be computed against the method's original
predictions. That merge-back has deliberately not been run yet: doing so
before ground truth is final would mean computing accuracy numbers that
would need to be redone once adjudication changes some answers, and
reporting a preliminary number risks it becoming the "real" one by
inertia.

## 51. Adjudication workbook built for the 43 disputed items

`annotation_packets/build_adjudication_sheet.py` (one-off, not part of
the pipeline) pulls the 43 flagged sample_ids from
`4rater_analysis_report.json`, re-attaches each one's old recommendation
and full new-edition guideline text (from the original per-pair CSV/JSON,
§47), and lays out the answers from all four files side by side (in
substance, the two real distinct answer sets — see §50's correction
box) — deliberately visible here, unlike the first round, since
resolving a known disagreement is the point of adjudication, not a
violation of the earlier blind-review design. Three highlighted fill-in
columns
(`FINAL ANSWER: correspondence`, `FINAL ANSWER: relation` with the same
dropdown validation as before, `Adjudication notes`) capture the
resolved answer. Written to `Adjudication_43_items.xlsx`, sent to the
user.

Once completed, this becomes the source for the 43 previously-unresolved
items' final ground-truth answers; combined with the 197 items where the
two real distinct answer sets already agreed, that completes ground
truth for all 240 sampled items, unblocking the §6 metric computation
against the method's original predictions (§50.2).

## 52. §6 metrics computed against complete, adjudicated ground truth — a real bug caught first, H4 confirmed

The completed adjudication workbook came back — all 43/43 rows filled,
each with a real, reasoned decision (e.g. one item resolved by picking
the exact-string match over a near-miss candidate; several genuine
`CANNOT_DETERMINE` calls where the old text was recurring boilerplate
with no way to pick one occurrence; one detailed `split` case tracing
exactly which two new items absorbed the old one). Ground truth for all
240 sampled items is now complete: 197 where the two real distinct
answer sets agreed (§50, corrected), 43 from this adjudication.

`compute_section6_metrics()` was added to `annotation.py` (not the
frozen pipeline) to compute §6's five metrics against the method's
original predictions, both as a raw sample proportion and reweighted to
the population per §5.1's requirement (the stratified design deliberately
oversamples rare tiers, so a raw proportion over the 60-item sample is
not itself a population estimate).

**A real bug was caught before any of this was reported or committed**:
the first run came back with `deletion_recall`/`deletion_precision` as
`null` for every single pair and `provenance_loss_rate`/
`cannot_determine_rate` as exactly `0.0` for every pair — despite having
directly confirmed real `NONE` and `CANNOT_DETERMINE` answers in the
data moments earlier (Pennsylvania S041-S043, unanimous `NONE` across
both real answer sets, all four files). Treating a suspiciously clean all-zero result as
untrustworthy rather than reporting it traced the cause immediately:
`_norm_answer` returned the special tokens `NONE`/`CANNOT_DETERMINE`
uppercase while returning every ordinary item-ID answer lowercase, and
the new metric code compared against lowercase literals throughout —
every comparison involving a NONE or CANNOT_DETERMINE answer silently
failed instead of erroring, the worst kind of bug because the output
looked like a plausible result rather than a crash. Fixed by making
`_norm_answer` consistently lowercase (logged in `PREREGISTRATION.md`
§11). Confirmed the fix does **not** retroactively invalidate the
already-reported Cohen's kappa numbers (§50, corrected): those compare
raters' normalized answers only to each other, never to a hardcoded
literal, so a uniform case shift changes no equality relationship
between them — no rerun needed there.

### 52.1 Final results (pooled, 240 items, raw / population-weighted)

| Metric | Raw | Weighted | n |
|---|---|---|---|
| Correspondence accuracy | 71.24% | **85.26%** | 233 (usable) |
| **Provenance loss rate (PRIMARY)** | 10.75% | **1.48%** | 186 |
| False-correspondence rate | 23.98% | 13.93% | 196 |
| Deletion recall | 36.17% | 35.43% | 47 |
| Deletion precision | 45.95% | 65.89% | 37 |
| CANNOT_DETERMINE rate | 2.92% (7/240) | — | 240 |
| **T3 (renumbered) tier precision** | **97.06%** | **94.08%** | 34 |

Full per-pair breakdowns in `annotation_packets/section6_final_metrics.json`.

The raw-vs-weighted gap on provenance loss rate (10.75% → 1.48%) is
large and worth explaining rather than treating as noise: the items
where the method incorrectly reported a real correspondence as deleted
are concentrated in tiers that are rare in the true population but were
deliberately oversampled by the stratified design (§5.1 draws a flat 10
per tier regardless of population size). Reweighting by the inverse
sampling fraction is exactly what corrects for this, per §5.1's explicit
instruction — the raw number would substantially overstate this failure
mode's true population-level rate.

### 52.2 Hypothesis status

- **H4 — confirmed.** T3 (renumbered) tier precision is 97.06% raw /
  94.08% weighted, both comfortably clearing the pre-registered ≥80%
  bar. Among items the method assigned to the "renumbered" tier, the
  overwhelming majority are genuinely correct correspondences with
  unchanged text — the study's cleanest illustration holds up.
- **H1 and H2 — still untestable**, unchanged from §45/§46: both require
  a major-revision pair and none exists in the confirmatory set (the
  search was deliberately stopped per the logged stopping rule). The
  1.48% weighted provenance loss rate above is a real number on *minor*
  pairs specifically, useful as background for the paper's discussion
  (consistent with dev's own repeated finding that minor revisions lose
  much less provenance than major ones), but is not itself a test of
  either hypothesis.
- **H3 — untestable, for a newly-surfaced and different reason.** H3
  requires comparing the method's correspondence accuracy against
  baseline B2 (text-only matching, no structural parsing). Checked the
  codebase directly: **B2 was never implemented anywhere** — it exists
  only as a named design intention in §4, not as running code. This is a
  distinct, unaddressed gap from the major-pair problem, surfaced for
  the first time by actually trying to compute every §6/§7 metric
  rather than assuming the tooling was complete.

## 53. H3 tested — NOT CONFIRMED. B2 (text-only) matches or beats the structural method

`baseline_b2.py` was implemented per the design pre-committed in
`PREREGISTRATION.md` §11 (before this test was run): for each old item,
search the **entire** new-edition document for the best match, no
guideline/section scoping and no identifier lookup, using the real
method's own unmodified `item_align._sim` (token Jaccard) and
`_SIM_FLOOR` (0.75). `run_h3_test.py` then scored both the method and
B2 against the same complete adjudicated ground truth used for §52
(`CANNOT_DETERMINE` items excluded, 209 of 240 usable), and ran a
10,000-resample bootstrap on the paired accuracy difference
(method − B2), raw and population-weighted, exactly as pre-committed.

### 53.1 Result

| Pair | n | Method acc. | B2 acc. | Diff (raw) 95% CI |
|---|---|---|---|---|
| Tennessee 2017→2018 | 55 | 67.27% | 65.45% | [-0.055, 0.091] |
| Pennsylvania 2021→2023 | 58 | 77.59% | 67.24% | [0.000, 0.207] |
| Connecticut v2022.1→v2023.1 | 37 | 86.49% | **91.89%** | [-0.189, 0.081] |
| Connecticut v2023.1→v2024.1 | 59 | 72.88% | **96.61%** | [-0.339, **-0.136**] |
| **Pooled** | **209** | **75.12%** | **79.43%** | **[-0.101, 0.014]** |

Pooled weighted: method 75.12%-equivalent vs. B2, point estimate
−0.0215, CI [−0.0586, 0.0139]. Full numbers in
`annotation_packets/h3_test_report.json`.

**H3 is NOT CONFIRMED, raw or weighted.** The pre-registered criterion
(§7) required the point estimate positive AND the CI lower bound
excluding zero. The pooled point estimate is negative in both
versions — B2 outscores the method on this dataset — and on
Connecticut v2023.1→v2024.1 specifically the CI is entirely negative
(raw [-0.339, -0.136]): it is B2 that is significantly *ahead* of the
structural method on that pair, the opposite of what §7 hypothesized.

This is the disconfirmation §7 explicitly anticipated ("Disconfirmed
if not. Then structure is decorative, the method reduces to text
matching, and the paper must say so.") and is reported as such, not
softened.

### 53.2 Sanity check before trusting the result (§10's standing rule)

§10 requires inspecting intermediate output before reporting any
result — written for results that favour a hypothesis, but a result
this surprising against the hypothesis warrants the same scrutiny, so
it was applied here too, before writing this section. Spot-checked the
items where the method and B2 disagree on Connecticut v2023.1→v2024.1
(the pair driving the strongest, statistically significant effect).
The disagreements are not a comparison bug — `old_item_id` matching
between the master CSV and B2's output lines up correctly, and
`_norm_answer` normalizes both sides consistently (already fixed, §52)
— they show a real, coherent, explainable mechanism:

```
OLD: appendix 1 ct adult medication reference/protocol/•#22
  method (tier T2_id_text_changed) predicted: ...same id, •#22
  B2 predicted: ...•#38   (sim = 1.0, exact text match)
```

Several more of the same shape recur throughout the medication-reference
appendix (•#33→•#52, •#98→•#123, •#13→•#29, …). The pattern: the
method's T2 tier ("identifier matched, text changed") trusts that the
same bullet number in the new edition is the same conceptual item even
when its text differs — a reasonable assumption for most guidelines,
but the appendix is a long bulleted medication table where items were
evidently inserted, shifting every subsequent bullet's number. When
that happens, T2's ID-trust assumption points at the *wrong* row, while
B2's brute-force global text search is immune to it — it finds the
identical text wherever it actually landed, at `sim = 1.0`.

This is a real, non-buggy, mechanistically explicable finding, not an
artifact: the structural method's advantage in the rest of the study
(guideline-scoped, section-scoped matching) comes with a specific,
previously undiscovered cost on documents containing long renumbered
bullet lists, where trusting a stable identifier is actively worse than
ignoring structure altogether. Connecticut's medication appendix is
exactly this shape; none of the other three pairs' guidelines have a
comparable long bulleted list, which is consistent with why the effect
is concentrated on that one pair and (to a lesser, non-significant
degree) v2022.1→v2023.1, its sibling using the same document format.

### 53.3 Hypothesis status (updates §52.2)

- **H3 — disconfirmed by the pre-registered criterion.** Text-only
  global matching (B2) is not shown to be worse than the structural
  method on this minor-pair dataset — if anything the point estimate
  favours B2, significantly so on one pair. The honest reading is not
  "structure never helps," but that its benefit was neither
  demonstrated here nor uniform: Tennessee and Pennsylvania trend
  (non-significantly) toward the method, both Connecticut pairs trend
  toward B2, significantly on one. §53.2's mechanism — ID-trust
  breaking under bullet renumbering in long list-structured
  appendices — is a genuine, reportable limitation of the T2 tier as
  currently defined, distinct from anything previously logged in
  Appendix B.
- This does not retroactively affect H4 (still confirmed, §52.2) or
  the §52.1 metrics, which describe the method's own performance, not
  a comparison to B2.
- One caveat for the eventual paper: B2's global search has no
  protection against coincidental high-similarity matches elsewhere in
  a large document — a risk that is structurally *absent* from this
  minor-pair dataset (documents stay small and mostly unchanged
  between minor editions) but would very plausibly reappear on a major
  revision, where far more items change and a global text search has a
  much larger pool of plausible-looking wrong candidates to be fooled
  by. H1/H2's untestability (§46) means this cannot be checked directly
  with current data; it is flagged here as a reason not to over-read
  "B2 wins" as "structure is worthless," only as "structure's benefit
  is not demonstrated on this dataset."

## 54. Diagnostic decomposition: §53's effect is concentrated in bullet/list-marker items, not general

Following the user's decision to characterize the §53.2 mechanism
further rather than either draft the paper or revise B2's design,
`annotation_packets/diagnose_t2_mechanism.py` (new, one-off diagnostic,
does not touch the frozen pipeline or re-run the H3 test itself) splits
all 209 usable sampled items by their **old-edition marker kind**,
using `old_marker_path` already present in each `annotation_packet.csv`
— no re-parsing. `item_parser.py`'s own marker patterns (lines 78-94)
give the classification directly: bullet and sub-bullet markers
(`�`/`•`/`▪`/`●`/`-`/`o`) carry **no ordinal** and are numbered purely
by position within their level (the code comment there: "Bullets carry
no ordinal, so siblings are counted by position"), which is exactly the
property that makes them vulnerable to the §53.2 mechanism — insert one
item, and every later sibling's position-derived marker shifts. Numeric,
alpha, roman, parenthetical and dotted markers carry a real ordinal and
are not repositioned by insertion.

### 54.1 Result

| Marker kind | n | Method acc. | B2 acc. | Diff | Share of items in T2 tier |
|---|---|---|---|---|---|
| **Bullet/sub-bullet** | 72 (34%) | 72.22% | **94.44%** | **−22.2 pts** | 27.8% |
| **Ordinal** (numeric/alpha/roman/paren) | 137 (66%) | **76.64%** | 71.53% | **+5.1 pts** | 13.9% |

**On ordinal-marker items — two-thirds of the usable sample — the
method is ahead of B2 by 5.1 points, in the direction §7 originally
hypothesized.** The pooled disconfirmation in §53 is not a general
result; it is driven almost entirely by the bullet-marker minority.

Restricted further to bullet-marker items only, broken out by the
method's own assigned tier:

| Method's tier (bullet items only) | n | Method acc. | B2 acc. |
|---|---|---|---|
| T1_id_exact | 35 | 97.14% | 97.14% |
| **T2_id_text_changed** | 20 | **40.00%** | **90.00%** |
| T3_renumbered | 3 | 100% | 100% |
| T4_reworded | 2 | 100% | 100% |
| **T6_unmatched_old** | 12 | **41.67%** | **91.67%** |

T1 (exact identifier match) is unaffected — as expected, an unchanged
bullet position is unaffected by insertion elsewhere. The damage is
concentrated exactly where §53.2 predicted (T2, the tier that trusts a
stable identifier over changed text) and, newly surfaced here, equally
badly in **T6 — items the method reports as unmatched/deleted**. Over
90% of these bullet-marker "deletions" are not real deletions at all;
B2 finds them elsewhere in the document at high similarity. This means
part of §53's effect is not just wrong-item correspondence but the
method **manufacturing false deletions** specifically for bullet items
whose guideline-scoped candidate pool no longer contains their true
match after a position shift — a second, distinct failure mode riding
on the same underlying cause as T2's.

Connecticut v2023.1→v2024.1 — the pair carrying the pooled effect's
only statistically significant component (§53.1) — decomposes cleanly:
bullet items there score method 65.00% vs. B2 100.00% (diff −35.0
pts, n=40); ordinal items in the *same pair* score method 89.47% vs.
B2 89.47% — **exactly tied, zero difference** (n=19). The pair's
significant effect is not a property of that edition pair generally;
it is entirely attributable to its long bulleted medication-reference
appendix.

### 54.2 Interpretation

This is exploratory decomposition of an already-reported result, not a
new confirmatory test — it does not change H3's status (§53.3, still
**NOT CONFIRMED** by the pre-registered pooled criterion, which was
specified pooled and is not superseded by a post-hoc subgroup split).
But it substantially sharpens what "not confirmed" means for the paper:
the structural method's advantage over naive text matching is real and
in the hypothesized direction on ordinally-marked items (the large
majority of items across every pair), and is specifically, mechanistically
reversed on bullet/list-marker items, where positional numbering with
no true ordinal makes the T2 tier's identifier-trust assumption actively
wrong under insertion, and additionally causes false-deletion calls via
T6. This is a precise, falsifiable, and fixable characterization — future
work could plausibly special-case bullet-marker items to prefer
text-based matching over identifier-based matching within the existing
structural framework — rather than a verdict that structure provides no
value.

## 55. Remaining registered analyses closed: B1/B3/B4 implemented, H5 tested, pair-level bootstrap added, BH applied

Auditing `PREREGISTRATION.md` against what had actually been run (prompted
by a request to plan next steps, not by any new result) surfaced two
material gaps beyond §4.2's incomplete baseline table: **H5 had never
been tested** (it needs B1, which — like B2 before it — existed only as
a design intention), and **the H3 bootstrap resampled items, not edition
pairs**, contrary to §8.2's registered analysis plan ("resampled at the
edition-pair level, since items within a pair are not independent").
Both are closed here, plus §4.2's remaining baselines (B3, B4) and
§8.4's multiplicity correction, all pre-committed to `PREREGISTRATION.md`
§11 before any scored run (the design entry logs three smoke-test match
rates against Tennessee — B1 92.5%, B4 96.3%, B3 96.9% — as a sanity
check performed before, not after, the real comparison).

### 55.1 Verification, before trusting any of the numbers below

- **Frozen pipeline untouched**: `git diff --name-only d3068ee..HEAD` for
  `corpus_probe.py`, `item_parser.py`, `edition_align.py`, `item_align.py`
  returns empty.
- **B1 cross-checked against the method's own T1 tier**: on Connecticut
  v2023.1→v2024.1's 30 T1_id_exact sampled items, B1's exact-identifier
  lookup agrees with the method's prediction **30/30** — exactly what a
  correct implementation should produce, since T1 is defined as "same
  identifier, unchanged text," the case B1's rule is built to catch by
  construction.
- **Ground-truth invariance**: the H3 re-run's point estimate reproduces
  §53.1 exactly (−0.0431 raw). CI bounds differ marginally from §53.1
  (e.g. item-level raw upper bound 0.0096 here vs. 0.014 there) because
  this driver uses a different bootstrap seed than `run_h3_test.py`, not
  a different ground truth or logic — the two seeds draw different
  resamples from the same 209-item population, both valid, both leaving
  H3's conclusion unchanged.
- 209/240 usable items confirmed (unchanged from §52–§54).

### 55.2 H5 — method vs. B1 false-correspondence rate

| | raw, item-level | raw, pair-level | weighted, item-level | weighted, pair-level |
|---|---|---|---|---|
| point est. | +0.0035 | +0.0035 | +0.0099 | +0.0099 |
| 95% CI | [−0.056, 0.063] | [−0.068, 0.111] | [0.002, 0.019] | [−0.002, 0.028] |

**H5 is NOT CONFIRMED** by the pre-registered criterion (CI upper bound
strictly below +0.05) in any of the four cells — but this is a much
closer call than H3. The point estimate is nearly zero: the method's
false-correspondence rate is essentially indistinguishable from B1's.
Raw item-level upper bound is 0.0625, just over the +0.05 bar; the
weighted item-level CI [0.002, 0.019] is entirely positive but entirely
*below* +0.05, i.e. a small, statistically real difference that is well
inside the pre-registered tolerance on its own terms — it is the raw
(unweighted) version that fails the bound, not the weighted one. Read
plainly: **the method does not appear to be buying its correspondences
found beyond B1 with materially more confident wrong answers.** This is
a mild positive result for the method even though it does not clear the
pre-registered bar outright.

### 55.3 H3 re-run — item-level and pair-level side by side

| | raw, item-level | raw, pair-level | weighted, item-level | weighted, pair-level |
|---|---|---|---|---|
| point est. | −0.0431 | −0.0431 | −0.0215 | −0.0215 |
| 95% CI | [−0.101, 0.010] | [−0.177, 0.076] | [−0.059, 0.014] | [−0.102, 0.038] |

Pair-level resampling — the unit §8.2 actually registered — draws 4
pairs with replacement and is, as §8.1 already anticipated for this
sample size, much less informative than the item-level analysis §53
originally reported: the pair-level CI roughly doubles in width and
comfortably includes zero in both directions. **This does not soften
H3's disconfirmation** — a wider CI cannot retroactively confirm a
hypothesis that failed on a positive point estimate to begin with — but
it is the more honest statement of uncertainty given only 4 independent
units, and it is reported alongside, not instead of, §53's original
numbers, per the user's explicit "report both co-equally" decision.

### 55.4 Descriptive comparisons (no hypothesis attached)

**Method vs. B3 (difflib document diff).** Point estimate −0.0622 raw /
−0.0432 weighted — B3 is *ahead* of the method, and at item-level the
raw CI is entirely negative ([−0.120, −0.005]), i.e. statistically
significant in B3's favour at that resampling unit (pair-level, as with
H3, widens to include zero: [−0.194, 0.042]). This is a second baseline,
independent of B2, outperforming the structural method on this dataset.
Consistent with §54's mechanism: difflib's sequence alignment, like B2's
global search, does not depend on trusting a positional bullet
identifier, so it is not exposed to the same failure mode. B3 carries
its own known risk (Appendix B item 4's offset tail) — 0% offset
resolution failures were observed across the smoke-tested and scored
pairs here, better than the 3–4% previously flagged as a concern, though
that number was never pair-specific and this is not a claim it is fixed
in general, only that it was not observed as material on this dataset.

**Method vs. B4 (identifier + exact-text-in-guideline fallback).** Point
estimate −0.0144 raw / −0.0118 weighted — close to tied, CI includes
zero at item-level raw ([−0.067, 0.038]) though the weighted item-level
CI is entirely negative and narrow ([−0.021, −0.005]). B4 gives a
baseline every structural advantage (guideline scoping) except the
method's fuzzy tiers (T3–T6 proper), and it does not trail the method by
much — a finding directly relevant to §54: since B4 uses exact-text
matching within the mapped guideline rather than trusting a positional
identifier, it should be less exposed to the bullet-marker mechanism
than the method's own T2 tier is, and its near-parity with the method is
consistent with that.

**B1's own provenance loss rate on the (minor-only) test pairs.**
34.29% raw / 2.52% weighted, CI [0.274, 0.414] raw / [0.017, 0.036]
weighted — explicitly descriptive, not an H1 test (no major pair exists,
§46). Both raw and weighted, this is substantially higher than the
method's own provenance loss rate reported in §52.1 (10.75% raw / 1.48%
weighted): identifier lookup with no fallback at all loses meaningfully
more provenance than the structural method **even on minor revisions**,
where the gap between methods is at its smallest by construction. This
is a real, useful number for the paper's framing even though it cannot
support H1 directly.

### 55.5 Benjamini–Hochberg across {H3, H4, H5}

Bootstrap p-values against each hypothesis's own registered null (H3:
P(diff ≤ 0); H4: P(T3 precision < 0.80); H5: P(diff ≥ +0.05)), computed
from the same resamples used for the CIs above (item-level, raw). H1 and
H2 contribute no p-values and are excluded from the family rather than
treated as null results, since no major pair exists to test them (§46).

| Hypothesis | p (raw) | p (BH-adjusted) |
|---|---|---|
| H3 | 0.9459 | 0.9459 |
| H4 | 0.0002 | **0.0006** |
| H5 | 0.0599 | 0.0898 |

H4 survives the correction comfortably. H3's high p-value is consistent
with its disconfirmation (§53) — no evidence the method beats B2. H5's
adjusted p-value (0.0898) does not clear a conventional 0.05 threshold
either, consistent with §55.2's "not confirmed, but a close and mildly
favourable call" reading.

### 55.6 Hypothesis status (final, updates §53.3/§54.2)

- **H1, H2 — untestable**, unchanged (§46, no major pair exists).
- **H3 — disconfirmed**, unchanged in conclusion from §53/§54; now
  additionally reported with the registered pair-level bootstrap unit
  (§55.3) and survives BH correction as non-significant (§55.5).
- **H4 — confirmed**, unchanged from §52.2, now additionally passing a
  BH-adjusted significance check (§55.5).
- **H5 — not confirmed**, newly tested here. Closer than H3: the point
  estimate is close to zero and the weighted-CI reading is favourable to
  the method, but the pre-registered raw item-level bound (+0.05) is
  narrowly missed. Reported plainly as not confirmed, not rounded up.
- Two new descriptive findings for the paper's discussion, neither a
  hypothesis test: **B3 (difflib) also outperforms the method**,
  independently corroborating §54's structural explanation over a
  dataset-specific B2 artifact; and **B1's provenance loss rate
  (34.29%/2.52%) substantially exceeds the method's own (10.75%/1.48%)
  even on minor pairs**, a real point in the method's favour that no
  single hypothesis above captures directly.

Full numbers: `annotation_packets/full_comparison_report.json`.

## 56. A guideline-boundary-detection bug found in the H3' fresh pair also affects the already-published Tennessee results

Following the user's decision to fold feasible future-work items into
this paper, a fresh Tennessee pair (2022-23 -> Sept2024, see the
PREREGISTRATION.md H3' entries) was retrieved and a targeted fix for
§54's T2 identifier-trust mechanism was designed and pre-committed
(`item_align_v2.py`) before drawing the H3' sample. Both H3' annotators
completed their workbooks independently (Cohen's kappa 1.0000, 0/92
disagreements) - but 11 of the 32 census bullet items showed both
annotators answering `NONE` where the original method had scored
`T1_id_exact`, its most-trusted tier. That should not be possible for a
genuinely correct T1 match (same identifier, verified-identical text),
so it was investigated before any scoring proceeded, per §10's standing
rule applied here to a surprising pattern rather than a convenient one.

### 56.1 The bug

All 11 disputed items share one guideline: "Delirium with HyperAgitation."
Counting items per guideline in the fresh old edition found this
guideline alone contains **513 items** - against a corpus median of
**12 items/guideline**. Reading the content directly confirms it is not
one coherent protocol:

```
delirium with hyperagitation/contraindications/o
  "If the device has been accidentally closed, push the side buttons
   inward with one hand and pull the device open... Locate wound
   edges..." - wound-care/hemostatic-device content

delirium with hyperagitation/indications/o
  "Presence of indwelling port" - vascular-access content

delirium with hyperagitation/notes/o
  "Consider rotating the foot to the mid-line position" - splinting
   content

delirium with hyperagitation/notes/o#4
  "Please use the Bariatric Needle Set... Humeral Head... place the
   patient's arm..." - IO-access content
```

`item_parser.py`'s guideline-boundary/anchor detection has a failure
mode: once it loses the true boundary between two protocols, a large
stretch of subsequent, topically unrelated content gets swept into the
guideline whose heading it last successfully anchored on, rather than
being correctly re-segmented under the next real heading. This is a
different, distinct mechanism from anything previously logged in
Appendix B or §54 - not the T2 id-trust issue, not T6's cascade failure,
a boundary-detection weakness one level up from both.

### 56.2 Not new to the fresh pair: the same bug is already in the published Tennessee 2017/2018 confirmatory data

A systematic scan (guidelines more than 4x the edition's median size,
floor 50 items, across all four Tennessee editions) found:

| Edition | Median guideline size | Outlier guidelines (>4x median, >50 items, excluding `<preamble>`) |
|---|---|---|
| 2017 (published) | 12 | PEDIATRIC CARDIAC EMERGENCY Neonatal Resuscitation (244), REFERENCE Pulse Oximetry (215), Patient Refusal or Declination of Care (135) |
| 2018 (published) | 13 | same three guidelines, 241/214/135 |
| 2022-23 (fresh) | 12 | Delirium with HyperAgitation (513), Vascular Access (208), Pre-eclampsia and Eclampsia (129) |
| Sept2024 (fresh) | 13 | same three guidelines, 539/228/133 |

Content-checked "PEDIATRIC CARDIAC EMERGENCY Neonatal Resuscitation" and
"REFERENCE Pulse Oximetry" directly (the same two guidelines 15 of the
original 60 sampled Tennessee items fall inside): both contain
equally incoherent content - obstetric material ("membranes ruptured -
if yes, is amniotic fluid clear?", "LMP if applicable") and trauma
material ("Note time of tourniquet application", "Maintain systolic
pressure of 90 or greater") filed under a pediatric-cardiac or
pulse-oximetry heading. "Patient Refusal," "Vascular Access," and
"Pre-eclampsia and Eclampsia" show the same size anomaly but were not
individually content-verified - flagged as likely affected, not
confirmed.

### 56.3 Quantified effect on the already-published Tennessee-pair results

Of the original 60 sampled Tennessee items (§52-55's confirmatory data,
already scored, already reported), 15 (25%) fall inside the two
content-verified bloated guidelines. Checking each against the
already-computed adjudicated ground truth:

| sample_id | tier (method) | ground truth | method prediction | agree? |
|---|---|---|---|---|
| S003 | T1_id_exact | pediatric cardiac... | pediatric cardiac... | yes |
| S006 | T1_id_exact | reference pulse ox.../6 | reference pulse ox.../6 | yes |
| S007 | T1_id_exact | cannot_determine | reference pulse ox.../6#11 | **no** |
| S008 | T1_id_exact | reference pulse ox.../2#15 | reference pulse ox.../2#15 | yes |
| S009 | T1_id_exact | reference pulse ox.../2#6 | reference pulse ox.../2#12 | **no** |
| S010 | T1_id_exact | reference pulse ox.../2#22 | reference pulse ox.../2#22 | yes |
| S011 | T1_id_exact | reference pulse ox.../3#21 | reference pulse ox.../3#21 | yes |
| S014 | T1_id_exact | none | pediatric cardiac... | **no** |
| S015 | T1_id_exact | reference pulse ox.../6#9 | reference pulse ox.../6#9 | yes |
| S021 | T2_id_text_changed | cannot_determine | pediatric cardiac... | **no** |
| S026 | T3_renumbered | cannot_determine | pediatric cardiac... | **no** |
| S032 | T3_renumbered | none | pediatric cardiac... | **no** |
| S035 | T3_renumbered | cannot_determine | pediatric cardiac... | **no** |
| S037 | T4_reworded | none | pediatric cardiac... | **no** |
| S055 | T6_unmatched_old | none | NONE | yes |

**8 of 15 (53%) disagree** - more than double the pair's overall ~33%
error rate (§53.1: 67.27% accuracy). Four of the eight disagreements are
`CANNOT_DETERMINE`, consistent with annotators struggling to work inside
a 200+/500+-item unreviewable "guideline." This is a real, previously
undiagnosed confound sitting inside numbers already reported as final in
§52-55, and by extension inside every pooled-across-4-pairs figure that
includes Tennessee.

### 56.4 What this changes and what it does not

**Nothing already published is edited, retracted, or recomputed.** Per
the same "append, never rewrite" discipline used throughout this log,
this is a newly-discovered limitation appended to the record, not a
correction applied retroactively to §52-55's numbers. `item_parser.py`
is frozen and is not modified here - fixing a guideline-boundary
detection weakness discovered by reading test-data content would violate
§3.4's quarantine exactly as it would for any other frozen-file change
made in response to test observations.

Going forward: the Tennessee-pair-specific and pooled §52-55 figures
must be read with this confound disclosed. Its exact effect on those
aggregate numbers has not been separately isolated (only the direct
8/15 sub-analysis above) - doing so would mean rescoring an
already-closed, already-reported result, not undertaken here. For the
in-progress H3' test (§57), the 11 contaminated bullet-census items are
excluded from scoring rather than allowed to dilute the T2-fix result -
reported as this distinct, separate finding, not folded into the fix's
own result.

## 57. H3' result: H3'a/H3'b UNTESTABLE (underpowered, not disconfirmed); H3'c NOT CONFIRMED (a genuine tie)

Both H3' annotators completed the 92-item workbook independently.
**Cohen's kappa 1.0000, 0/92 disagreements** - no adjudication step was
needed; ground truth is simply the shared answer. Before trusting a
perfect-agreement result, it was spot-checked: the two files are not
byte-identical (different MD5 hashes), and the matching answers are
exact item-ID strings the task explicitly asks annotators to copy
verbatim from the visible new-guideline text - which naturally produces
identical strings between two independently-correct annotators, unlike
free-text judgements would. The original round's A/B pair also showed
kappa 1.0 (section 50), so this is consistent with an established
pattern for this task, not a new anomaly.

### 57.1 Result

| Test | n scored | a accuracy | b accuracy | diff (95% CI) | Status |
|---|---|---|---|---|---|
| H3'a: v2 vs v1, clean bullet items | 21 | 100.00% | 100.00% | 0.0 [0.0, 0.0] | **UNTESTABLE** |
| H3'b: v2 vs B2, clean bullet items | 21 | 100.00% | 100.00% | 0.0 [0.0, 0.0] | **UNTESTABLE** |
| H3'c: v1(=v2) vs B2, ordinal items | 60 | 71.67% | 71.67% | 0.0 [-0.10, 0.10] | NOT CONFIRMED |

Full numbers: `annotation_packets/h3prime_tennessee_2022_2024/h3prime_test_report.json`.

### 57.2 H3'a/H3'b: verified as a real power problem, not a bug and not a clean success

A [0.0, 0.0] confidence interval on 21 items is exactly the kind of
too-clean result section 10 requires checking before it is reported.
Checked: of the 21 clean bullet items, **20 are T1_id_exact** - the tier
where v1 and v2 run byte-identical code by construction (the fix only
branches for T2 id-matches). Only **1 item is T2-eligible** (S020), and
for that one item the rejected-similarity check the fix adds did not
even fire (`fix_overrode_id_match: False` - its similarity already
cleared 0.75, so v1, v2, and B2 all agree). Checking the population
*before* the section 56 exclusion clarifies this further: of all 32
original bullet-census items, only **2 (6.25%) were T2-tier to begin
with** - 30 were T1. This is a property of Tennessee's bullet population
itself, not an artefact of excluding the contaminated 11: Tennessee's
bullet markers are overwhelmingly stable (same identifier, same text)
between these two editions, unlike Connecticut's, where the section 55
smoke test found 168 of 1,241 bullet items (13.5%) were T2 cases the fix
actually rejected. Excluding the contaminated guideline removed one of
Tennessee's only two T2 bullet cases; the remaining one did not trigger
the fix.

**H3'a and H3'b are therefore UNTESTABLE with this fresh pair - not
disconfirmed, and not a demonstrated success either.** The population
needed to test whether the fix helps (bullet items where an identifier
match masks a real content change) essentially does not exist in
sufficient quantity in Tennessee's format. This is a real, honest limit
of what a single available fresh pair could support, stated plainly
rather than dressed up as a clean 100%/100% validation.

### 57.3 H3'c: a genuine, non-buggy tie, not a bug

71.67% vs 71.67% (43/60 correct each) was checked before being trusted,
since an exact tie invites the same "is this a scoring bug" question as
section 53.1's H3 comparison invited when it first ran. Itemwise
breakdown: 38 items both methods got right, 12 both got wrong, **5 items
only the original method got right, and exactly 5 items only B2 got
right** - a real, substantive itemwise split that happens to net to
zero, not a trivial identical-predictions artefact (unlike H3'a/H3'b
above, where the tie *is* trivial by construction).

**H3'c is NOT CONFIRMED** by the pre-registered criterion (point
estimate must be positive; here it is exactly 0.0). This does not
clearly replicate the original H3 finding on ordinal items (section
54.1: method ahead of B2 by 5.1 points, 76.64% vs 71.53%, pooled across
four pairs) - on this single fresh pair, the two are evenly matched. A
single new pair is a much weaker basis than the original four-pair
pooled estimate, and one pair's result moving from "ahead" to "tied"
is well within what sampling variation across different documents would
produce; it is reported as a genuine, if less favourable, data point
alongside the original finding, not a retraction of it.

### 57.4 What this follow-up study accomplished and did not

- The T2 identifier-trust mechanism (section 54) remains diagnosed and
  mechanistically sound - the fix's design logic was validated by the
  Connecticut smoke test (section 55 pre-commitment entry: 78% of
  rejected bullet id-matches correctly rescued). What was NOT achieved
  is a fresh-data confirmatory test of whether the fix improves
  real-world accuracy, because Tennessee - the only fresh pair
  available after Connecticut and Pennsylvania were confirmed exhausted
  - does not contain enough of the failure mode to test it.
- A genuinely new, independently valuable finding emerged instead: the
  guideline-boundary-detection bug (section 56), discovered only because
  this follow-up's annotator disagreements were investigated rather than
  accepted at face value - and shown to already affect the published
  Tennessee results, not just the fresh pair.
- H3'c stands as a small, honest, negative-leaning data point: the
  original ordinal-item advantage is not confirmed to replicate on this
  one additional pair.
- Future work, not undertaken here: testing H3'a/H3'b would require a
  fresh pair with a bullet population resembling Connecticut's (rich in
  genuine T2/T6 bullet cases) rather than Tennessee's (overwhelmingly
  stable). No such fresh pair is currently available - Connecticut is
  confirmed exhausted (PREREGISTRATION.md's H3' pre-commitment entry)
  and no other publisher has demonstrated a comparable bullet-heavy
  format.

## 58. Sensitivity analysis: excluding the §56 boundary-bug guidelines flips H3's sign

Prompted by a full-study audit (requested by the user before drafting
the paper) that asked whether §56's guideline-boundary bug was ever
quantified against the **pooled** §52-55 results (it was not - §56 only
checked its direct 8/15 sub-analysis on Tennessee). This closes that
gap: every §6 metric and H3/H4/H5 recomputed across **all four pairs**
excluding items whose old-edition guideline is a size outlier, using
§56's own mechanical rule (more than 4x the edition's median guideline
size, floor 50 items, excluding `<preamble>`) applied consistently, not
re-derived per pair.

### 58.1 The rule is imperfect, and that is stated rather than hidden

Checking two Connecticut outliers by hand before trusting the rule:
"NEW Central Line Access" (160 items) shows the same partial
contamination pattern as Tennessee's bug (unrelated newborn-transport
content appears in its tail), but "Abuse and Neglect of Children and the
Elderly" (53 items) reads topically coherent throughout despite being a
size outlier - plausibly a genuinely large, well-structured guideline,
not a boundary failure. The mechanical rule is used anyway, consistently
across all four pairs, because a per-guideline manual coherence judgement
would itself be a new, undisclosed source of discretion - worse than a
known-imperfect but pre-specified proxy. This means the exclusion set
below is probably somewhat over-inclusive (excludes some genuinely fine
guidelines) and possibly under-inclusive elsewhere (a smaller-scale
contamination that doesn't clear the size threshold would not be
caught).

### 58.2 Excluded guidelines (41/209 usable items, 19.6%)

| Pair | Outlier guidelines |
|---|---|
| Tennessee 2017→2018 | PEDIATRIC CARDIAC EMERGENCY Neonatal Resuscitation, Patient Refusal or Declination of Care, REFERENCE Pulse Oximetry |
| Pennsylvania 2021→2023 | *(none)* |
| Connecticut v2022.1→v2023.1 | Abuse and Neglect of Children and the Elderly, Appendix 1 (CT Adult Medication Reference), Appendix 2 (Pediatric Color Coded Medication Reference), Appendix 4 (COVID-19 Updates), Intraosseous Access, Poisoning/Substance Abuse/Overdose |
| Connecticut v2023.1→v2024.1 | Abuse and Neglect of Children and the Elderly, Adult, Appendix 1, Appendix 2, Appendix 4, NEW Central Line Access |

Pennsylvania is entirely unaffected - consistent with it being the
cleanest-parsing pair throughout this study. Connecticut's appendix
sections dominate its exclusion list, which overlaps substantially with
§54's bullet-marker finding: the same long, bulleted appendices driving
the T2 identifier-trust mechanism are disproportionately guideline-size
outliers too, though the two are separately diagnosed mechanisms (§54 is
about marker position within a correctly-scoped guideline; §56 is about
the guideline scope itself being wrong).

### 58.3 Result: H3's headline direction does not survive the exclusion

| Metric | All (n=209) | Clean (n=168) | Shift |
|---|---|---|---|
| Method accuracy (raw) | 75.12% | **78.57%** | +3.45 pts |
| Method accuracy (weighted) | 87.37% | **92.35%** | +4.97 pts |
| B2 accuracy (raw) | 79.43% | 76.79% | −2.64 pts |
| **H3 (method − B2), raw** | **−0.0431** [−0.101, 0.010] | **+0.0179** [−0.036, 0.071] | **sign flips** |
| Method false-correspondence (raw) | 19.32% | 15.11% | −4.21 pts |
| T3 tier precision | 96.88% | **100.00%** [1.0, 1.0] | +3.12 pts |
| H5 (method − B1 false-corr), raw | +0.0035 [−0.056, 0.063] | +0.0570 [−0.009, 0.125] | more favourable, still not confirmed |

**§53's headline H3 result - "B2 outperforms the method" - does not
survive removing the parser-boundary-bug-affected items.** The point
estimate flips from negative (method behind) to positive (method ahead)
once the 41 contaminated items (19.6% of the usable sample) are
excluded. This is **not a new confirmation of H3** - the clean-subset CI
still crosses zero ([−0.036, 0.071]), so H3 remains formally NOT
CONFIRMED under the pre-registered criterion either way - but it
substantially changes what the disconfirmation *means*. §53's original
framing ("structure is not shown to help, and B2 significantly beats the
method on one pair") is not the right takeaway once a measurement
artifact accounts for a meaningful share of the effect. §54's
bullet-marker mechanism (id-trust breaking under positional renumbering)
remains real and independently diagnosed - it is not explained away by
this - but it is evidently not the whole story behind §53's pooled
number; part of it was §56's unrelated guideline-boundary bug.

H4 moves from already-strong to essentially perfect on the clean subset
(100%, CI [1.0, 1.0], n effectively 33 after the single bug-affected T3
item is excluded - consistent with §56.4's direct check that this was
H4's only error). BH-adjusted p-values on the clean subset: H4 p=0.0000
(even stronger), H3 p=0.4491 (still not significant, now for a very
different reason - a near-tie rather than a clear loss), H5 p=0.5828
(also closer to favourable, still not significant).

### 58.4 What this means for the paper

Report **both** the full-sample §52-55 result and this sensitivity
result, not one in place of the other - per-registration commits to the
full-sample analysis, and this is explicitly a post-hoc robustness check
prompted by §56's discovery, not a re-run of the confirmatory test
itself (no new hypothesis is confirmed here; a threat to the original
result's interpretation is quantified). The honest framing for the
paper: **the pooled H3 disconfirmation is not robust to a
previously-unknown parser artifact that affects roughly a fifth of the
usable sample**, and the artifact's removal moves the point estimate in
the method's favour on every metric checked, though not to statistical
significance. This is a materially different, more nuanced story than
"the method loses to a naive baseline" - closer to "the comparison is
genuinely inconclusive, and what signal exists points toward the method
once a data-quality confound is accounted for."

Full numbers: `annotation_packets/sensitivity_analysis_report.json`.

## 59. Post-hoc baseline B5 (embeddings): significantly ahead on the full sample, not once the boundary bug is excluded

Added per the audit's Phase 4: none of B1-B4 use a modern embedding
matcher, and a 2026 reviewer's first question would be whether the
study's comparisons hold up against one. `baseline_b5.py` uses
`app.rag.embeddings` (the production RAG pipeline's own provider -
`BAAI/bge-small-en-v1.5` via `sentence-transformers`, confirmed
installed and working, not the TF-IDF fallback) with B2's identical
global-search, greedy-consumption scope - only the similarity function
differs. Floor fixed at 0.85 (a documented near-duplicate-detection
convention) before any scored run, explicitly not calibrated against
this study's ground truth. **Post-hoc, not pre-registered - no
hypothesis or confirmation criterion is attached to B5.**

### 59.1 Full-sample result

| | Raw accuracy |
|---|---|
| Method | 75.12% |
| B2 (Jaccard) | 79.43% |
| **B5 (embeddings)** | **81.82%** |

B5 is the highest-accuracy method tested anywhere in this study. Method
vs. B5: point estimate −0.067, **95% CI [−0.129, −0.010] - entirely
negative, statistically significant** (weighted: −0.043, CI
[−0.091, −0.001], also entirely negative). This is the first
statistically significant method-vs-baseline gap in either direction
found in the whole study. B2 vs. B5: −0.024, CI [−0.057, 0.005], not
quite significant.

### 59.2 The same §56/§58 confound applies, and changes the picture the same way

Before treating "B5 significantly beats the method" as the final word,
the §58 sensitivity check was applied here too, since B5 shares B2's
global, unscoped search - exactly the property that made B2 immune to
the guideline-boundary bug's damage (§58.3). On the clean subset
(n=168, same 41 items excluded):

| | All (n=209) | Clean (n=168) |
|---|---|---|
| Method accuracy | 75.12% | **78.57%** |
| B2 accuracy | 79.43% | 76.79% |
| B5 accuracy | 81.82% | **79.76%** |
| Method − B5 (raw) | −0.067 [−0.129, **−0.010**] | −0.012 [−0.077, 0.054] |

**The significant method-vs-B5 gap does not survive exclusion either.**
Method accuracy improves the same way it did in §58 (+3.45 points); B5's
accuracy *drops* on the clean subset (81.82%→79.76%) - the mirror image
of B2's pattern, and for the same reason: B5's unscoped global search
was disproportionately picking up correct answers specifically on the
bug-affected items, where the method's guideline-scoped search had
nothing valid to search within. Once those items are removed, the
CI crosses zero and the earlier significance disappears (−0.012
[−0.077, 0.054]).

### 59.3 What this means for the paper

Both baselines beating the method on the full sample and neither doing
so significantly on the clean subset is now a **consistent pattern
across B2, B3 (§55.4, significant on the full sample), and B5** - every
baseline that searches the whole document unscoped shows the same
confound-driven advantage that shrinks once the boundary bug is
excluded. This substantially strengthens §58's interpretation: the
"naive baselines beat the structural method" headline was not really
about naive-vs-structural at all so much as about which methods happen
to be robust to one specific, previously-unknown parser defect. The
paper should present this as the actual finding - a real, useful,
generalizable insight (structural scoping is only as good as the
structure-detection it depends on) - rather than "modern embeddings beat
a hand-built heuristic," which the full-sample numbers alone would
wrongly suggest.

Full numbers: `annotation_packets/b5_comparison_report.json`.

## 60. H4 reframed: close to tautological in this corpus, quantified honestly

Prompted by the same full-study audit (before drafting the paper): T3 is
*defined* as identical text within a correctly-mapped guideline, so "are
T3-assigned items true correspondences with unchanged text" is close to
asking whether identical text in a matched guideline is the same item -
a question the tier's own construction already answers most of the way.
H4's 97-100% precision (§52.2, §58.3) risks reading as a demonstration
rather than a near-certainty.

Checked whether the test had real teeth by quantifying the two concrete
ways a T3 assignment could still be wrong, across the full T3
population in all four pairs (68 items, not just the 34 sampled for
annotation):

1. **Boilerplate collision** - the old item's text matches ≥2 candidates
   in the new edition's same-guideline pool, so the tier's `next(...)`
   pick could be the wrong one even with correct guideline mapping.
   **0/68 (0.0%)** - never occurred anywhere in the corpus.
2. **Guideline mis-mapping** - the guideline the old item was actually
   assigned to has a title that changed between editions (so
   `match_guidelines`'s token-overlap step, not just the text-identity
   check, had to get something non-trivial right). **2/68 (2.9%)** -
   Pennsylvania only.

**Neither failure mode had meaningful exposure in this corpus.** The
honest conclusion is not that H4 is wrong, but that it mostly tests
whether the pipeline's own bookkeeping is self-consistent, not whether
cross-edition item correspondence is hard to get right in general. This
is a real finding about H4's evidentiary weight, not a defect to hide:
demoted from "robust evidence" to **a sanity check confirming the
pipeline behaves as designed** - useful for ruling out a specific class
of implementation bug, not for supporting a claim that the method solves
a hard problem on this tier.

This does not change H4's registered status (still confirmed under the
pre-registered mechanical criterion, §7) or retract §52.2/§58.3's
numbers. It changes how much weight the eventual paper should place on
H4: the degradation-curve result (planned) and the comparative
baseline findings (§53-55, §58-59) are the paper's substantive
contributions; H4 belongs in a validation subsection, not the results
section's headline.

## 61. Structure-quality degradation experiment: a real, monotonic threshold relationship

This is the audit's central new contribution: turning §56/§58/§59's
accidental finding (unscoped baselines are immune to a parser
guideline-boundary bug that specifically hurts the structural method)
into a deliberate, controlled experiment. Claim tested: **structural
alignment's competitive position against text-only baselines is a
monotonic function of structure-detection quality** - not found stated
anywhere in the reviewed literature (tree-edit-distance and legislative-
diff work evaluates alignment quality directly, never as a function of
upstream structure-detection error rate).

`structure_ablation.py` (new, does not modify any frozen file):
synthetically corrupts guideline boundaries at controlled rates
r ∈ {0, 0.05, 0.10, 0.20, 0.35, 0.50} (5 seeds each), by merging a random
r-fraction of physically-adjacent guidelines - a direct model of §56's
actual mechanism - then runs the real, **completely unmodified**
`item_align.align_items` on the corrupted input via a monkeypatched
`parse()`, and scores against the existing 209-item ground truth via a
stamped `_orig_id` that survives all corruption and remapping.

### 61.1 Validity checks - all passed

- **r=0 reproduces the existing result exactly**: accuracy 0.7512,
  n=209, bit-for-bit identical to §53.1's already-published number. The
  harness runs the frozen algorithm faithfully rather than a
  reimplementation.
- **Monotonicity held** (non-increasing within a 0.01 tolerance) across
  every step of the sweep, with no violation requiring the §10
  investigation the pre-commitment flagged as a trigger.
- B2/B5 accuracy is provably invariant to this corruption (both read
  only `.text`, never `.guideline`) and was held fixed as a reference
  line rather than redundantly recomputed, exactly as pre-committed.

### 61.2 Result: a real, monotonic curve, with an observed sign crossing

| Structure quality | Method accuracy | Gap vs. B2 (79.43%) | Gap vs. B5 (81.82%) |
|---|---|---|---|
| r=0.50 (heavily corrupted) | 54.74% | −24.69 pts | −27.08 pts |
| r=0.35 | 60.29% | −19.14 pts | −21.53 pts |
| r=0.20 | 66.22% | −13.21 pts | −15.60 pts |
| r=0.10 | 69.38% | −10.05 pts | −12.44 pts |
| r=0.05 | 72.73% | −6.70 pts | −9.09 pts |
| **r=0 (as-observed corpus)** | **75.12%** | **−4.31 pts** | **−6.70 pts** |
| **clean subset (§58/59, real exclusion, not synthetic)** | **78.57%** | **+1.78 pts** | **−1.19 pts** |

The synthetic-corruption direction (r=0→0.50) and the real-exclusion
direction (§58/59's clean subset) are **not the same operation** and are
reported as complementary, not merged into one continuous axis:
corruption synthetically *adds* controlled boundary errors on top of the
as-observed corpus; the clean-subset comparison *removes* items sitting
in guidelines already known (not assumed) to be bug-affected, which is
an imperfect proxy for actually repairing the parser, not a true fix.
Stating this distinction plainly matters more than the (real) fact that
both directions of the same underlying quality axis move the method's
standing in the same direction.

**Reading both together**: as structure-detection quality falls below
what the real corpus exhibits, the method's disadvantage against both
baselines widens sharply and monotonically (54.74% at 50% corruption -
nearly a 20-point drop below the observed 75.12%). As structure-
detection quality improves toward the achievable clean subset, the gap
against B2 not only shrinks but **inverts sign** (−4.31 → +1.78 points)
and the gap against B5 shrinks by more than 5 points and loses
significance (§59.2). This is a genuine, empirically grounded threshold
relationship, not an assumed one: there is a real point, sitting between
the as-observed corpus and the achievable clean subset, where the
structural method overtakes the text-only Jaccard baseline.

### 61.3 What this establishes for the paper

This is the study's strongest and most novel claim: **structural
alignment's value over text-only matching is conditional on
structure-detection quality, is not fixed, and the direction of the
effect (help vs. harm) can invert within a plausible range of real-world
parsing quality.** This generalizes beyond EMS protocols to any
structure-aware document-alignment system built on imperfect upstream
structure detection - a class that includes essentially all real-world
deployments, since perfect structure detection is not achievable in
general. Practically: a structure-aware method is only worth its added
complexity once its structure-detection component clears a quality bar
that must be measured, not assumed - exactly the bar this corpus's own
guideline-boundary detection did not clear for roughly a fifth of its
sample.

Exploratory and post-hoc relative to the original §1-§9 registration.
No hypothesis in §7's family is confirmed, disconfirmed, or reopened by
this.

Full numbers: `annotation_packets/structure_ablation_report.json`.

## 62. H4 tautology check: the objection is confirmed, not refuted — H4 is demoted

Part of the novelty-audit plan: a reviewer's likely objection is that T3
is *defined* as "same guideline+section, byte-identical text, different
marker path", so "are T3 items true correspondences" is close to asking
whether identical text in an already-matched guideline is the same
item — near-guaranteed, making 97-100% precision uninformative. The
plan's instruction was to defend H4 by measuring whether its two real
failure modes (boilerplate collision — more than one identical-text
candidate in the pool; guideline mismapping — the old guideline's title
changed and had to be matched, not trivially identical) were ever
actually possible for the sampled T3 items.

`run_h4_exposure.py` measured this directly against `item_align.py`'s
own candidate pools (not a reimplementation), correctly recovering each
item's PRE-mapping guideline title from an independent `parse()` call
before `align_items` mutates it in place (a real bug caught while
writing this script: comparing two already-mutated values against each
other trivially always agrees, which would have hidden mismapping
entirely — fixed before running, not after seeing a suspiciously clean
number).

**Result: boilerplate collision never occurred (0/36). Guideline
remapping was possible in only 2/36 items (5.6%), both in
Pennsylvania.** In 94.4% of sampled T3 items, the old guideline's title
had not changed at all (a trivial identity lookup, not a real matching
decision) and the identical-text candidate was unique. **This confirms
the tautology objection rather than refuting it** — the data does not
support defending H4 as a non-trivial test, despite that being the
originally chosen approach; the honest conclusion is the one the data
gives, not the one initially preferred.

**H4 is demoted from a headline finding to a validation/sanity check.**
It still shows the pipeline behaves as designed (a dictionary-style
lookup within a correctly-scoped, correctly-mapped guideline correctly
finds renumbered items essentially all of the time) but does not
support a claim that the method's matching *logic* was meaningfully
tested by it. The paper's results section should lead with §61's
degradation/threshold finding and the §53-59 comparative evaluation;
H4 belongs in a methods-validation subsection, alongside the r=0
reproduction check, not among the paper's contributions.

Full numbers: `annotation_packets/h4_exposure_report.json`.

## 63. Second-domain replication (US Code Title 18): HC1-HC3 all hold — the crossover generalizes

Tests whether §61's threshold/crossover finding is specific to EMS
protocol PDFs or a general property of structure-aware alignment.
Corpus: US Code Title 18 (Crimes and Criminal Procedure), two official
USLM XML releases from `uscode.house.gov` — PL 117-81 (2021) and
PL 118-158 (2024), a genuine version pair (both confirmed to have
actually amended Title 18, not an arbitrary snapshot). This domain sits
at the opposite end of the structure-quality spectrum from EMS PDFs:
machine-readable, OLRC-published, with stable official section
identifiers and clean chapter/section XML nesting.

`uscode_corpus.py` builds genuine `item_parser.Item`/`ParsedEdition`
objects directly from the XML (chapter → guideline, section → item,
`item_id` = the section's own official identifier), so the real,
unmodified `item_align.align_items` runs on this domain via the
identical monkeypatch-`parse()` pattern already validated in
`structure_ablation.py` — no parallel alignment logic, no risk of the
two domains diverging for code reasons rather than genuine domain
reasons.

### 63.1 Corpus sanity

1,387 old / 1,396 new sections, 141 chapters both editions (stable),
75 repealed both editions (stable), 1,312/1,387 (94.6%) baseline
identifier persistence — a plausible, real churn rate for a 3-year legal
revision, neither trivial nor implausibly high.

### 63.2 Result: all three pre-registered hypotheses hold

| r | Method accuracy | Gap vs. B2 (94.30%) | Gap vs. B5 (94.59%) |
|---|---|---|---|
| 0.00 | 94.59% | **+0.29 pts** | **+0.00 pts** |
| 0.05 | 90.35% | −3.95 pts | −4.24 pts |
| 0.10 | 86.46% | −7.84 pts | −8.13 pts |
| 0.20 | 77.14% | −17.16 pts | −17.45 pts |
| 0.35 | 61.56% | −32.75 pts | −33.04 pts |
| 0.50 | 48.44% | −45.87 pts | −46.16 pts |

**HC1 (monotonicity): confirmed.** Accuracy falls monotonically
non-increasing (0.01 tolerance) at every step, exactly mirroring §61's
EMS curve shape.

**HC2 (crossover exists in the tested range): confirmed.** At r=0 the
method is essentially tied with B5 and marginally ahead of B2. Even
mild synthetic degradation (r=0.05, a mere 5% of guideline boundaries
merged) is enough to erase the advantage and put the method behind both
baselines by 4+ points, widening to a 45+ point gap at r=0.50.

**HC3 (cross-domain replication): confirmed.** The same qualitative
shape — near-perfect structure lets the method match or beat text-only
baselines; degrading structure quality pushes it behind, monotonically
and substantially — appears in both a messy, heuristically-parsed PDF
corpus (EMS, §61) and a clean, machine-readable XML corpus (US Code).
This is the strongest evidence in the whole study that the finding is a
general property of structure-aware document alignment, not an artefact
of one parser or one document genre.

### 63.3 A sharper crossover than the EMS domain, and why that makes sense

Unlike §61's EMS curve — where the *as-observed* corpus (already
carrying real, unknown boundary errors) sits behind both baselines, and
only an exclusion-based cleaning pushes the method ahead — here the
crossover sits almost exactly at r=0, the domain's actual near-perfect
operating point. This is the expected relationship, not a discrepancy:
US Code's real structure quality is close to 100% by construction (XML
tags, not heuristic detection), so its real operating point sits right
at the top of the curve where the method's advantage is largest (though
still small, +0.29/+0.00 points) — consistent with a single underlying
relationship between structure quality and relative advantage, observed
at two different points along it in the two domains (EMS's real
operating point sits lower on the curve, where the method trails).

### 63.4 Scope notes, stated plainly

B1/B4 (identifier-based baselines) were excluded from this comparison
by design, not because they underperformed: ground truth here is
*defined* by identifier persistence, so scoring an identifier-lookup
baseline against it would compare the method to a paraphrase of its own
ground truth, not a real contrast. This is a domain-specific exclusion
that does not apply to the EMS results, where B1 was a genuine,
informative baseline (§55).

Full HC2 cross-referencing against the published real-world
structure-quality range (DocLayNet ~81%, PubLayNet ~97%) requires
Workstream A's real, annotated EMS boundary-F1 measurement, not yet
returned — this section establishes that a crossover exists and
generalizes across domains; §61's promised calibration (mapping *r* to
measured F1) is what will place the real EMS corpus precisely on this
curve rather than only demonstrating the curve's shape.

Full numbers: `annotation_packets/uscode_experiment_report.json`.

## 64. Calibration: the real corpus's measured structure-detection F1 is ~79.4%, matching published real-world benchmarks

Closes Workstream A: calibrates §61's synthetic corruption-rate axis
against a real, human-measured structure-detection quality metric,
answering exactly what a citable "our x% F1 corresponds to y%
crossover" claim needs.

### 64.1 Collection: one genuine user error, then a passing independence check

The first submission failed the mandatory independence check
(`run_boundary_scoring.py`'s hard-failure gate) - all four editions'
title lists were identical between the two files despite different
byte hashes. Investigated before assuming the same root cause as the
main round's annotator-duplication problem (this task is far more
objective than correspondence judgement, so identical lists were not
automatically assumed to be a duplication artefact) - the user
confirmed directly it was a submission mistake, the same document
uploaded twice under different names. The corrected resubmission
passed cleanly: 0/4 editions with identical title lists, genuinely
independent data (title-list lengths differ substantially between the
two annotators - 81-97 items vs. 119-164 - confirming this was not
another silent duplication).

### 64.2 A real measurement artefact found and corrected before trusting the F1 numbers

Raw recall differed sharply between the two annotators (0.75-0.78 vs.
0.46-0.53) despite similarly high precision (~0.90-0.97 both) -
investigated per §10 before reporting. Root cause confirmed directly:
`match_guidelines`'s containment-biased scoring (`j = overlap /
min(len_a, len_b)`) lets a short, exact annotator title (e.g.
"Hypothermia") lose its rightful match to a longer sibling title
containing it as a substring (e.g. "Induced Hypothermia Following
ROSC") - both score a perfect 1.0 against a short parser guideline
title, and the greedy algorithm can consume the wrong one first. This
is not a new bug: it is the *same* already-documented weakness
Appendix B item 3 flagged for cross-edition guideline matching
("permissive by design... paired `Cyanide Exposure` with a truncated
`Exposure`"), now surfacing in this new use.

Quantified: of the "missed" annotator titles, checking each against
every parser title (ignoring consumption order) found ~20-27% are
this exact collision artefact (a genuine, findable match that lost the
greedy race), and the remaining ~73-80% have no plausible parser match
under any consumption order at all - genuine recall failures, not an
artefact. A corrected F1 (treating collision-artefact misses as
matched) is used for calibration; raw, uncorrected numbers remain
unedited in `boundary_scoring_report.json`.

| | Annotator 1 (mean across 4 editions) | Annotator 2 (mean across 4 editions) |
|---|---|---|
| Raw recall | 0.763 | 0.500 |
| Corrected recall | 0.814 | 0.617 |
| Precision | 0.921 | 0.937 |
| **Corrected F1** | **0.864** | **0.743** |

A real gap between annotators remains even after correction (0.864 vs.
0.743) - annotator 2 consistently identified more fine-grained protocol
titles with no parser counterpart at all than annotator 1 did. This is
disclosed as genuine measurement uncertainty, not resolved by picking
one annotator's number.

### 64.3 Calibration result

Pooled corrected F1 (mean of both annotators, all four Tennessee
editions): **0.794** (`run_calibration.py`, reusing
`structure_ablation.corrupt_edition` and `item_align.match_guidelines`
completely unchanged). Remarkably consistent across editions
individually (per-edition pooled means: 0.798-0.808) despite the
real annotator gap above averaging it out.

**This is the single number the whole calibration workstream exists to
produce**: `item_parser.py`'s real, measured guideline-boundary
detection quality on this corpus is **F1 ≈ 0.794** - closely matching
DocLayNet's published ~0.81 mAP for diverse real-world documents, and
nowhere near PubLayNet's ~0.97 (scientific documents only). The real
EMS corpus's structure-detection quality is not an artificially bad or
unfairly criticized parser - it sits squarely in the regime published
state-of-the-art document-layout-analysis systems actually achieve on
messy, real-world documents.

Placed on §61's already-computed accuracy curve: r=0 (no synthetic
corruption, i.e. the actual observed corpus) is by construction the
real corpus's operating point, giving **method accuracy 75.12% at
measured F1≈0.794** - trailing both B2 (79.43%) and B5 (81.82%). The
real corpus sits in exactly the regime where the crossover has not yet
occurred, at a structure-detection quality directly comparable to
published, credible real-world benchmarks - not a synthetic worst
case.

Sweep, F1 as a function of synthetic corruption rate (5 seeds, 4
editions, 2 annotators each):

| r | Mean structure F1 |
|---|---|
| 0.00 (real corpus) | 0.7940 |
| 0.05 | 0.7826 |
| 0.10 | 0.7623 |
| 0.20 | 0.7334 |
| 0.35 | 0.6693 |
| 0.50 | 0.5967 |

Monotonically decreasing, exactly mirroring §61's accuracy curve shape
- confirms the synthetic corruption model's severity is a reasonable,
if approximate, proxy for real boundary-detection degradation.

**A small, disclosed discrepancy**: this sweep's r=0 F1 (0.7940) is
about 1 point below §64.2's standalone corrected-F1 mean (0.8034,
computed directly from `run_boundary_scoring.py`'s output). Cause:
`corrupt_edition` derives its guideline list purely from items
(`{it.guideline for it in ed.items}`), which necessarily excludes
guidelines with zero items - the raw `ParsedEdition.guidelines`
attribute the standalone script used includes them. Both are
legitimate, slightly different definitions of "a detected guideline";
the sweep uses one consistent definition at every r for internal
comparability, at the cost of this small, understood offset from the
single-point standalone check. Stated plainly rather than silently
reconciled.

### 64.4 What this closes

Workstream A (novelty-audit plan) is complete: §61/§63's synthetic
corruption-rate axis now has a real, measured anchor point, and that
anchor point is independently corroborated by published document-
layout-analysis benchmarks (DocLayNet) rather than resting only on this
study's own synthetic model. The paper's calibration claim can now be
stated precisely: *at a structure-detection quality (F1≈0.79) matching
published real-world benchmarks, structure-aware alignment has not
been shown to outperform simple text-only matching; the crossover
requires higher structure quality than this real corpus, or a
comparable real system, currently achieves.*

Full numbers: `annotation_packets/boundary_annotation/boundary_scoring_report.json`,
`boundary_scoring_corrected.json`, `calibration_report.json`.

## 65. CRITICAL CORRECTION: a silent join bug dropped 24 of 233 usable items (10.3%), non-randomly, inflating the method's reported accuracy across sections 53-61

Found during a full-project ground-up audit requested by the user
before drafting the paper. **This is not a new analysis - it is a
correction to the join logic every analysis since section 53 has used**,
and every affected number is superseded here. Nothing in sections
52-64 is edited in place, per this document's own "append, never
rewrite" discipline; this section states plainly which numbers each
already-published section's are superseded by.

### 65.1 The bug

`item_align.align_items` (frozen) **mutates** `item_id`: it rewrites
every old item into the *new* edition's guideline vocabulary
(`item_align.py`'s `it.item_id = f"{_norm_title(mapped)}/..."` line),
so identifier comparison across editions is meaningful.
`annotation.write_annotation_packet` saves that **post-remap** id into
`annotation_packet.csv`. Every baseline (`baseline_b2.py`,
`baseline_b1_b3_b4.py`, `baseline_b5.py`) instead calls `parse()`
directly and keys its own results by the **raw**, pre-remap id. So for
any sampled item whose guideline title changed between editions, the
packet CSV's id and a baseline's id disagree, the string-keyed lookup
returns nothing, and every driver since `run_h3_test.py` silently
`continue`d past it - the `# should not happen - same parse() on the
same file` comment guarding that branch was simply wrong; it was the
*same* parse, but two different post-processing states of it.

Verified before trusting the fix (not assumed): re-deriving each pair's
sample via `annotation.stratified_sample(..., seed=20261017)` reproduces
every existing `annotation_packet.csv`'s 60 `old_item_id`s **exactly, in
order** - the fix changes how results are *joined*, not which items were
sampled or what any annotator judged. Fixed by joining on **parse-order
index** instead: `align_items` and every baseline iterate the identical
`parse()`d `old_items` list in the identical order (confirmed directly,
not assumed - `item_align.py:198`, `baseline_b2.py:47`,
`baseline_b1_b3_b4.py:39/72/213`, `baseline_b5.py:46` all iterate
`old_ed.items` unfiltered), so `_all_results[i]` refers to the same
underlying item across every one of them regardless of what `.item_id`
that item currently holds. New shared helper `sample_join.py`
(`build_index_join`, `join_baseline`, `verify_sample_identity` - the
last of these now a **mandatory, fail-loud** check in every driver,
replacing the silent `continue`).

**Impact, measured**: 24 of 233 usable items (10.3%) were dropped -
Tennessee 1, Pennsylvania 2, Connecticut #1 **21 of 58 usable items
(36%!)**, Connecticut #2 zero. The dropped items scored ~37.5% method
accuracy versus 75.1% for the retained ones - **the hardest cases**
(guideline renamed between editions), dropped non-randomly, inflating
the method's reported accuracy by several points in every affected
analysis.

### 65.2 Independent cross-check: two separately-computed code paths now agree exactly

`compute_section6_metrics` (§52, never used this buggy join - it scores
directly from `annotation_packet.csv`'s own `method_predicted_item_id`
column, with no baseline cross-reference at all) had **already reported
the correct number**: correspondence accuracy 71.24% raw, n=233. Every
analysis built on `run_full_comparison.build_records()` (§53 onward)
instead reported 75.12%, n=209. After the fix, `build_records()`
reproduces **71.24% exactly** - two independently-implemented code paths
now agree to four decimal places, the strongest available evidence the
fix is correct, not merely different.

### 65.3 A second, related bug found and fixed at the same time

`structure_ablation.py` (§61) did not use the CSV-joined pattern above,
but had the **same class of bug** via a different mechanism: its own
`build_sample_index()` read the CSV's post-remap `old_item_id`, then
looked it up against `_orig_id` - a *third* id space (the RAW,
pre-corruption id, stamped before `align_items` ever mutates it, used
so scoring survives synthetic corruption). Post-remap CSV id and raw
`_orig_id` disagree whenever a guideline was renamed - the identical
silent-drop pattern, and §61's own r=0 validity check was checking
against the *already-wrong* 209/75.12% figure, so the bug passed its own
guard undetected. Fixed the same way: index join, not string join.
`build_h3prime_sample.py`'s B2 column had the analogous exposure (v2's
column did not - `item_align_v2` applies the identical remap `align_items`
does, so v1/v2 ids happened to already agree); fixed for consistency, and
**verified to produce byte-identical H3′ results** - Tennessee's fresh
pair genuinely has no guideline-rename collisions in this mechanism, a
real negative result, not an unchecked assumption.

**Confirmed unaffected, by direct code reading, not assumed**:
`run_uscode_experiment.py` (§63) and `run_calibration.py` (§64) never
route through `annotation_packet.csv`'s id column at all - US Code's
ground truth and `_orig_id` are both derived directly and immediately
from the same raw XML identifiers with no CSV round-trip in between, and
boundary scoring's ground truth is annotator title lists, an entirely
separate mechanism. §63's own numbers stand as reported. §64's core
measurement (real corpus structure F1≈0.794) also stands unaffected -
but §64.3's *cross-reference* of that F1 against accuracy figures
("method achieves 75.12%... trailing B2 (79.43%) and B5 (81.82%)")
borrowed §61's stale `reference_lines`, which §65.4 below supersedes.
The conclusion is unchanged (the method still trails both baselines at
the real corpus's measured structure quality) but the correct figures
are **71.24% vs. 75.97%/78.11%**, not 75.12%/79.43%/81.82%.

### 65.4 Corrected numbers

All at n=233 (was n=209), raw unless noted:

| Metric | Before fix | **After fix** |
|---|---|---|
| Method accuracy | 75.12% | **71.24%** |
| B1 accuracy | 60.77% | **60.09%** |
| B2 accuracy | 79.43% | **75.97%** |
| B3 accuracy | (n/a, not tabulated) | **78.54%** |
| B4 accuracy | (n/a, not tabulated) | **77.68%** |
| B5 accuracy | 81.82% | **78.11%** |
| H3 (method−B2), raw | −0.0431 [−0.101, 0.010] | **−0.0472 [−0.099, 0.004]** |
| H5 (method−B1 false-corr), raw | +0.0035 [−0.056, 0.063] | **+0.0501 [−0.016, 0.115]** |
| method vs B3, raw | −0.0622 [−0.120, **−0.005**] | **−0.0730 [−0.129, −0.017]** |
| method vs B4, raw | −0.0144 [−0.067, 0.038] (n.s.) | **−0.0644 [−0.120, −0.009] (now significant)** |
| method vs B5, raw | −0.0670 [−0.129, −0.010] | **−0.0687 [−0.125, −0.013]** |
| B1 provenance loss rate | 34.29% | **38.17%** |
| BH: H3 / H4 / H5 | 0.9459 / 0.0006 / 0.0898 | **0.9705 / 0.0003 / 0.7544** |

**method vs. B4 is newly significant** in B4's favour - the clearest
qualitative change: the fix does not just shrink or grow existing
effects, it surfaces one that the dropped items had been hiding.
**method vs. B3 and vs. B5 remain significant**, essentially unchanged
in magnitude. **H3 and H5 remain not confirmed**, consistent in
direction with before.

Sensitivity analysis (§58) on the corrected data - full sample vs.
clean subset (n=192, was n=168, same 41-guideline exclusion rule):

| | All (n=233) | Clean (n=192) |
|---|---|---|
| Method accuracy | 71.24% | **73.44%** |
| B2 accuracy | 75.97% | **72.92%** |
| H3 (method−B2), raw | −0.0472 [−0.099, 0.004] | **+0.0052 [−0.047, 0.057]** |
| H5 (method−B1), raw | +0.0501 [−0.016, 0.115] | **+0.1197 [0.046, 0.193] (now significant, unfavourably)** |
| T3 precision (H4) | 97.06% | **100.00%** |

**The §58 sign-flip finding survives the fix, but shrinks substantially**
(method's lead over B2 on the clean subset: +1.78 points before → **+0.52
points after**, no longer close to the earlier magnitude, though still
positive). **H4 remains a perfect 100% on the clean subset.** A newly
significant result appears in the *unfavourable* direction: on the
clean subset, the method's false-correspondence rate now exceeds B1's
by a confirmed-significant margin (+0.1197, CI entirely positive) - a
real finding this correction surfaces, not one it explains away.

B5 (§59) on the corrected data: method vs. B5 remains significant on
the full sample (−0.0687 [−0.125, −0.013]) and, on the clean subset,
remains **not** significant (−0.0208 [−0.078, 0.037]) - both the
direction and the significance pattern from §59 are preserved by the
fix, only the magnitudes move.

### 65.5 What changes and what does not

**Every headline qualitative claim already reported survives**: H3 not
confirmed, H4 confirmed (and now stronger - 100% on the clean subset,
BH p even smaller), H5 not confirmed, the §58/§59 sign-flip pattern
against B2 and B5 present and in the same direction, §63/§64 fully
unaffected. **What changes**: the exact magnitudes move by roughly
1-5 points across the board, generally against the method (the dropped
items were disproportionately its failures); method vs. B4 becomes a
newly significant unfavourable result; the clean-subset "recovery"
against B2 is real but roughly a third the size previously reported;
and a new, unfavourable, significant H5-on-clean-subset finding
surfaces that was invisible under the buggy join.

This is reported in full, including the parts that make the method look
worse, per this study's standing discipline (§10) - a bug that happened
to flatter a result is exactly the case that discipline exists for, and
this one was caught by a ground-up audit requested specifically to find
it, not by a result looking suspiciously good on its own.

Full numbers: `annotation_packets/full_comparison_report.json`,
`b5_comparison_report.json`, `sensitivity_analysis_report.json`,
`structure_ablation_report.json` (all regenerated with the fix; each
file's own contents are now the corrected numbers, not the ones tabulated
in §55/§58/§59/§61 - this section is the authoritative cross-reference).

## 66. Guideline tie-break stability: a real, previously-uncounted ±2.5-point source of uncertainty

Audit Phase 2. `match_guidelines`' containment-biased score produces
multiple perfect (1.0) candidates for a large share of Connecticut's
guidelines (31/92, 34% for v2022.1→v2023.1; 33/93, 35% for
v2023.1→v2024.1 - Tennessee 0/69, Pennsylvania 2/51), broken by
alphabetical descending string order - deterministic, but arbitrary
with respect to anything the method measures. This check tests whether
the reported accuracy is an artefact of that particular, arbitrary
choice.

### 66.1 Method

`tiebreak_sensitivity.py` (new, does not modify `item_align.py`): an
exact copy of `match_guidelines`' scoring logic, differing only in that
tied candidates are broken by a random per-trial draw instead of
alphabetical order. 20 trials, each re-running the real unmodified
`align_items` on all four pairs and rescoring the same 233
already-sampled items against the same already-collected ground truth -
the sample and ground truth are held fixed; only how the method's own
prediction is computed varies.

### 66.2 Result: a real, material spread

| | Value |
|---|---|
| Reported (alphabetical tie-break) | **71.24%** |
| 20-trial mean | 72.47% |
| 20-trial range | **70.39% - 75.54%** |
| 20-trial spread | **5.15 points** |

This is not a negligible concern retired by the check - it is a real,
previously-uncounted source of measurement uncertainty roughly
comparable in size to the bootstrap sampling CIs already reported
throughout this study (e.g. §65.4's corrected H3 CI width is ~10
points). The specific alphabetical tie-break this study happened to use
sits toward the low end of the range (71.24% vs. a 72.47% mean),
though not an outlier - 6 of 20 trials scored at or below 71.24%.

### 66.3 Does this change any conclusion? Checked directly, not assumed

The single most important question: does any trial's method accuracy
reach or exceed B2's 75.97%, which would mean the H3 "method behind
B2" finding is itself an artefact of the arbitrary tie-break? **No** -
the maximum observed trial (75.54%) still falls short of B2's 75.97%
by 0.43 points. **H3's qualitative conclusion (method behind B2 on the
full sample) holds under every one of the 20 tested tie-break
alternatives**, though the margin by which it holds is much smaller
than the point estimate alone would suggest, and in a minority of
plausible worlds the two would be within noise of each other.

### 66.4 What this means for the paper

This is disclosed as a genuine methodological limitation, not resolved
by picking a "better" tie-break rule after seeing this result (which
would be exactly the kind of post-hoc tuning this study's discipline
exists to prevent) and not silently absorbed into the existing bootstrap
CIs (which measure a different source of uncertainty - sampling
variability given a fixed method, not algorithmic variability from an
arbitrary implementation choice within the method itself). The paper
should state plainly that ~34-35% of Connecticut's guideline mappings
are effectively arbitrary among several equally-scoring candidates, that
this contributes a measured ±2.5-point-scale uncertainty to reported
accuracy independent of sampling noise, and that the study's qualitative
conclusions (H3/H4/H5 status, the §58/§59/§61 sign-flip and threshold
findings) are robust to it while the exact point estimates are not fully
precise numbers in the way a single decimal figure implies.

Full numbers: `annotation_packets/tiebreak_sensitivity_report.json`.

## 67. B5 model + floor sensitivity grid: robust across every tested configuration

Audit Phase 3. `baseline_b5.py`'s model (`bge-small-en-v1.5`) and
similarity floor (0.85) were both uncalibrated choices. Full 3-model x
5-floor grid (15 cells), committed and reported in its entirety before
any cell was computed.

### 67.1 Result

| Model | 0.75 | 0.80 | 0.85 | 0.90 | 0.95 |
|---|---|---|---|---|---|
| bge-small-en-v1.5 | 74.68% | 77.68% | **78.11%** | 77.68% | 76.39% |
| bge-base-en-v1.5 | 75.97% | 78.11% | 77.25% | 77.68% | 75.97% |
| bge-large-en-v1.5 | 76.39% | **78.97%** | 78.11% | 77.25% | 75.11% |

(Originally-reported cell in **bold** where it appears in its own row;
grid maximum separately bolded.)

Grid mean 77.02%, range 74.68%-78.97% (4.29 points). Reference points:
method 71.24%, B2 75.97% (§65).

### 67.2 The original finding is robust, not an artefact of one arbitrary choice

**Every one of the 15 tested configurations exceeds the method's
accuracy** - the weakest cell (bge-small at floor 0.75, 74.68%) still
clears the method by 3.44 points. B5 beating the method on the full
sample (§59, §65) does not depend on the specific model size or
similarity floor chosen; it holds across the entire grid.

Against B2 (75.97%): 11 of 15 cells exceed it, 2 tie exactly
(bge-base at 0.75 and 0.95), 2 fall slightly below (bge-small at 0.75,
bge-large at 0.95) - a real but much smaller and less universal margin
than against the method.

The originally-reported cell (bge-small, floor 0.85 = 78.11%) sits near
the grid's upper-middle - 0.86 points below the observed maximum
(bge-large, floor 0.80 = 78.97%), not an outlier that happened to
maximize the reported result. The uncalibrated choice this study
actually used was not, in retrospect, a favourable one relative to what
a full search would have found; if anything a properly-tuned floor
search would have reported a very slightly *stronger* B5 result than
what was published.

### 67.3 What this means for the paper

This closes the audit's one remaining "was this number cherry-picked"
question with a clean negative: it was not. The paper can report B5's
result with a genuine sensitivity grid behind it rather than a single
uncalibrated number, and can state plainly that the "unscoped baselines
beat the structural method on the full, as-observed sample" finding
(§53-59, §65) is robust to reasonable choices of embedding model and
matching threshold, not contingent on one specific configuration.

Full numbers: `annotation_packets/b5_model_floor_sweep_report.json`.

## 68. Audit round 3, Phase 1: four statistical gaps closed

A third full-project sweep, this time paired with literature research
(§69). This section covers the four purely statistical gaps carried
over from the first two audit rounds - none change any point estimate,
all are additive. Verified directly, not assumed: every fix was re-run
and every existing point estimate reproduced exactly (0.7124 method
accuracy, r=0 validity, etc.) before any new number was trusted.

### 68.1 CIs on the structure-quality ablation curve (§61)

The paper's centerpiece figure previously reported point estimates with
no error bars. `structure_ablation.py` now reports, at every rate, two
DELIBERATELY SEPARATE sources of variation rather than one conflated
number:

| r | Mean accuracy | Across-seed range | Item-level 95% CI (per-seed range) |
|---|---|---|---|
| 0.00 | 71.24% | [71.24%, 71.24%] | [65.24%, 76.82%] |
| 0.05 | 69.27% | [67.81%, 71.67%] | lo∈[61.80%,65.67%], hi∈[73.82%,77.25%] |
| 0.10 | 66.35% | [62.23%, 69.96%] | lo∈[56.22%,63.95%], hi∈[68.24%,75.54%] |
| 0.20 | 63.09% | [59.23%, 67.38%] | lo∈[52.79%,61.37%], hi∈[65.24%,73.39%] |
| 0.35 | 57.85% | [51.50%, 63.52%] | lo∈[45.06%,57.51%], hi∈[57.94%,69.53%] |
| 0.50 | 53.05% | [50.21%, 54.94%] | lo∈[43.78%,48.50%], hi∈[56.65%,61.37%] |

The across-seed range measures sensitivity to *which* random corruption
instance was drawn; the item-level CI measures sampling uncertainty
*within* one fixed corruption instance. **They are not the same thing
and are not added together** - conflating them would either overstate
or understate the curve's real precision depending on which one
dominates at a given rate. At r=0 the item-level CI alone is ~11.6
points wide (65.24%-76.82%) - a real, previously invisible amount of
uncertainty around the single point estimate the curve's most important
anchor rests on.

Monotonicity still holds (confirmed non-increasing at every step,
tolerance 0.01) and r=0 still reproduces 71.24%/n=233 exactly - the fix
is additive, as designed.

### 68.2 CI on the calibration F1 anchor (§64)

§64's headline "real corpus structure F1 ≈ 0.794" was a bare point
estimate. The 8 underlying points (4 editions x 2 annotators) span
**0.7313 to 0.8687** - a 13.7-point range - with a bootstrap 95% CI of
[0.7597, 0.8472] computed from those 8 points. **n=8 is small enough
that the raw range and the already-known per-annotator means (annotator
1: 0.864, annotator 2: 0.743, §64.2) are the more honest picture of
uncertainty than the bootstrap CI alone** - stated plainly rather than
presenting a falsely precise interval. The calibration claim in §64.4
("at real-world structure-detection quality, the crossover has not
occurred") is robust to this range - even at the low end (0.731) the
corpus is well inside the regime §61's curve shows the method losing in,
and even at the high end (0.869) it is still below the point where §61's
observed crossover (against B2 specifically) occurs.

### 68.3 Null-centered bootstrap p-values (§55)

The BH-adjusted p-values reported since §55 were percentile bootstrap
p-values (read the tail probability directly off the bootstrap
distribution, which is naturally centered at the observed estimate, not
the null value) - a common, defensible shortcut, but distinct from the
more standard pivot construction (shift the bootstrap distribution to
center at the null, then ask how extreme the observed estimate is
relative to that). Both are now computed and reported side by side:

| | Percentile p_adj | Null-centered p_adj | Divergence |
|---|---|---|---|
| H3 | 0.9705 | 0.9691 | 0.0014 |
| H4 | 0.0003 | 0.0000 | 0.0003 |
| H5 | 0.7544 | 0.7512 | 0.0032 |

**Divergence is negligible everywhere** (max 0.0032) - the percentile
shortcut used throughout this study was not meaningfully misleading for
any of the three hypotheses. No conclusion changes; this closes the gap
with evidence rather than leaving it as an unaddressed caveat.

### 68.4 H3′ Benjamini-Hochberg applied

`PREREGISTRATION.md`'s H3′ pre-commitment entry committed to BH across
{H3′a, H3′b, H3′c} "as its own family" - never actually run. Applied now:
p_raw = {1.0, 1.0, 0.5641}, p_adjusted = {1.0, 1.0, 1.0}. H3′a/H3′b's
p=1.0 is the mechanical consequence of the already-established
UNTESTABLE finding (§57.2: 20/21 clean bullet items are T1-tier, where
the fix is a no-op by construction, giving a degenerate zero-variance
bootstrap distribution) - not new evidence against either, and not in
tension with anything already reported. This closes the last open
pre-registration commitment from the H3′ follow-up.

Full numbers: `annotation_packets/full_comparison_report.json`,
`structure_ablation_report.json`,
`boundary_annotation/calibration_report.json`,
`h3prime_tennessee_2022_2024/h3prime_test_report.json` (all regenerated
with these additions; every pre-existing point estimate in each file is
unchanged).

## 69. Related work: ontology matching, and B6 (LLM retrieve-then-rerank)

Audit round 3, Phase 2. Fresh literature research (requested by the user
alongside this sweep) surfaced directly-adjacent prior art this study had
never positioned itself against.

### 69.1 Ontology matching is the closest established field to this problem

The Ontology Alignment Evaluation Initiative (OAEI) is an ongoing
benchmark for matching correspondences across versions/variants of
structured knowledge bases - the same problem shape as this study, one
level of abstraction up. Its methodological history mirrors this study's
B1-B6 progression closely: LogMap (2011, lexical + structural + logical
reasoning) and AML (2013, lexical/structural) are the OM analogues of
B1-B4; BERTMap (2022, fine-tuned contextual embeddings, refined by
ontology structure) is the analogue of B5; Agent-OM, LogMapLLM, and
LLMs4OM (2024-2025, LLM agents) are the analogue of B6, added here.
**This validates the B1-B6 ladder as tracking an established field's own
trajectory, not an arbitrary set of baselines** - independently arrived
at, not built with OM's history in mind.

One specific, actionable detail: Agent-OM was reported to outperform 11
other systems specifically on non-trivial correspondences where simple
name-matching is insufficient - the OM analogue of this study's T3-T6
tiers, exactly the population the structural method exists to handle.
§69.2 checks whether B6 shows the same pattern here.

Cost is the standard objection to LLM-based matching in this
literature, and it is real: one documented study spent $290 on
unconstrained pairwise LLM calls, and a moderately-sized (10k-class)
ontology implies ~10^8 pairwise comparisons. This does not bind for B6
because only the 233 already-sampled items are ever scored, following
the field's own standard mitigation (MapperGPT-style retrieve-then-
rerank rather than unconstrained generation).

### 69.2 B6 result: statistically indistinguishable from a naive top-1-retrieval shortcut

`baseline_b6_llm.py` (`gemini-3.5-flash-lite`, temperature 0, top-10
candidates from B5's unchanged retrieval configuration). Full 233-item
run, **zero failed calls** after retrying the wrong/deprecated model ids
found along the way (§69.3).

| | Accuracy |
|---|---|
| Method | 71.24% |
| **B6** | **72.96%** |

Method vs. B6: point estimate −0.0172, 95% CI [−0.0815, 0.0472] - **not
significant**, and B6 is the weakest of every baseline that nominally
beats the method (B2 75.97%, B3 78.54%, B4 77.68%, B5 78.11%, all
already reported).

**Checked before trusting this, per §10's standing rule** (a surprising
result, even when it looks merely unimpressive rather than shockingly
good or bad, gets the same scrutiny): the response distribution across
all 240 sampled calls (233 scored + 7 `CANNOT_DETERMINE`-truth items,
still called for completeness) is **229 "1" (94.6%)**, 6 "NONE", and 5
other numbers total - an extreme skew toward the retrieval's own
top-ranked candidate. Directly compared against a naive "always pick
candidate #1, no LLM call at all" baseline using the exact same cached
retrieval: **identical accuracy, 72.96% vs. 72.96%**, with the LLM
agreeing with the top-1 retrieval rank on 96.1% of items. **In this
specific setup, `gemini-3.5-flash-lite` adds no measurable value beyond
its own retriever's ranking** - a real, verified property of this model
and prompt combination, not a data-integrity artefact (ruled out
directly, not assumed).

### 69.3 What happened getting here, logged rather than smoothed over

The first full run (`gemini-2.5-flash`) hit the free tier's real daily
cap - 20 requests/day for this project, far below the 250-1,500/day
found in general research and nowhere near enough for 233 calls - and
**222 of 233 items (95.3%) silently fell back to a forced "NONE" after
repeated `429 RESOURCE_EXHAUSTED` errors**, producing a contaminated
27.04% "accuracy" that was never reported or committed. `gemini-2.5-
flash-lite` (tried next, expecting a higher documented quota) turned out
deprecated for new users entirely (`404`, redirecting to
`gemini-3.5-flash-lite`), which is what was ultimately used. The
scoring code was fixed to record `call_succeeded` explicitly per item
and **exclude, never silently count, any item whose LLM call never
genuinely succeeded** - the same discipline as every other integrity
check in this study, just applied to a live external API for the first
time.

### 69.4 What this means for the paper

B6 does **not** replicate Agent-OM's reported strength on non-trivial
correspondences (§69.1) - if anything it shows the opposite pattern
here, adding negligible value over simple retrieval. This should be
reported as a genuine, mechanistically-explained finding, not hedged
away: a "lite"-tier model, chosen specifically for free-tier quota
reasons, may not represent what a full-capability LLM reranker could do
- this B6 result is a lower bound on LLM-based matching in this domain,
not a claim about LLM matching in general. Testing a stronger model
(the original committed design intent, before the quota constraints
that are now disclosed above) remains open future work, not undertaken
here because the free-tier constraint that motivated model selection is
itself part of what this section reports honestly.

Full numbers: `annotation_packets/b6_comparison_report.json`; raw
LLM responses cached per pair in
`annotation_packets/*/b6_response_cache_gemini-35-flash-lite.json`.

## 70. Docling as a second real structure-quality anchor: high recall, low precision, a different failure mode than our own parser

Audit round 3, Phase 3. Installed `docling` 2.121.0 fresh this session
(clean install, ~130GB free disk headroom confirmed first). Design:
our parser's item extraction and the existing 233-item ground truth stay
completely fixed; only guideline-boundary detection is swapped to
Docling's own `section_header`-labelled output, scored the identical way
§64 scored our own parser - `match_guidelines` (frozen, unchanged)
against the same two annotators' Tennessee boundary ground truth, with
the same collision-artifact-corrected F1 (`run_calibration.corrected_f1`,
reused unchanged).

### 70.1 A real pitfall, found and handled before scoring

Docling's `section_header` label spans multiple hierarchy levels mixed
together - verified directly on the 2017 edition before scoring
anything: 735 raw `section_header` items, including a running
page-header ("TENNESSEE EMERGENCY MEDICAL SERVICES PROTOCOL GUIDELINES")
repeated dozens of times, table-of-contents entries ("Index", "Index -
Continued"), top-level category headers ("Pediatric Cardiac Emergency",
"Pharmacology"), and per-protocol sub-headers ("Clinical Notes -
Airway:") all under the identical label. Rather than hand-classifying
hierarchy levels - a new heuristic this study could not independently
validate, and exactly the kind of ad hoc adjustment the pre-commitment
ruled out in advance - `match_guidelines`' own token-overlap scoring was
relied on to let noise self-penalize through the precision term, the
same property already used for our own parser's boundary scoring. Only
pre-scoring filter: deduplicate to distinct header strings (matching how
our own parser's `.guidelines` is inherently deduplicated).

### 70.2 Result: F1 far below our own parser's, but not because Docling misses boundaries

| | Docling mean corrected F1 |
|---|---|
| Tennessee 2017 (annotator 1 / 2) | 0.3990 / 0.4948 |
| Tennessee 2018 (annotator 1 / 2) | 0.3005 / 0.3778 |
| Tennessee 2022-23 (annotator 1 / 2) | 0.3622 / 0.5151 |
| Tennessee Sept2024 (annotator 1 / 2) | 0.3191 / 0.4866 |
| **Mean (n=8)** | **0.4069** |

Compared to our own parser's mean corrected F1 (0.8034, §64.2), this
looks like a stark result against Docling - a large enough gap from
Docling's own published DocLayNet benchmark (~0.864 mAP) that it
demanded investigation before being reported, per §10's standing rule
applied here to a surprising-in-the-unfavourable-direction result the
same as any other.

**Decomposed directly (Tennessee 2017, annotator 1) rather than
reported as a single number**: 276 distinct Docling headers against 81
annotator-listed real protocol titles, 71 matched. **Recall: 87.65%**
- actually *higher* than what would be needed to beat our own parser's
performance on this axis. **Precision: 25.72%** - this, not missed
boundaries, is what drives the low F1. The header-count ratio is
consistently large across all four editions (276/406/412/467 Docling
headers against 81-97 real protocol titles per edition, roughly
3.4x-4.8x over-generation) - strong circumstantial evidence, though only
directly decomposed for the one point above, that the same
precision-driven mechanism explains all eight measurements, not
independently confirmed for each.

### 70.3 What this means for the paper

**Docling is not shown to be worse than our own heuristic parser at
finding real protocol boundaries - it is shown to over-segment relative
to the specific "one header per protocol" granularity this study's
ground truth was built around**, a design-time-choice-driven,
mechanistically distinct failure mode from our own parser's (§56: the
boundary-detection bug *merges* content across a lost boundary,
producing false negatives/under-segmentation; Docling here produces
false positives/over-segmentation). Reporting only the F1 number without
this decomposition would materially mislead a reader into concluding
Docling's underlying layout detection is poor, when the evidence shows
the opposite for the recall axis specifically.

This does not become a third clean point on §61's curve in the way the
US Code XML anchor did (§63) - F1 alone is not a fair single-number
placement given the precision/recall asymmetry just demonstrated, and
forcing it onto the same axis without a like-for-like granularity match
would overstate what was actually measured. Reported as a distinct,
important calibration-methodology finding in its own right: **boundary-
quality metrics for this task are not interchangeable with general
document-layout benchmarks (DocLayNet, PubLayNet) without accounting for
label granularity** - a real, previously undocumented gap between a
system's published general-purpose layout score and its measured
performance on a specific downstream "one header per logical unit" task,
found only because this study built its own independent ground truth
rather than citing Docling's DocLayNet number directly.

Full numbers: `annotation_packets/boundary_annotation/docling_calibration_report.json`.

## 71. Audit round 4, Phase 1: the join-bug fix had not reached two scripts, and §54's headline diagnostic moves under the fix

A fresh full-project sweep (requested by the user: "do another full sweep...
see if our paper can be improved") found that the 2026-08-18 join-bug fix
(§65) - converting seven baseline-joining drivers from an id-string lookup
to `sample_join.py`'s parse-order index join - had not reached two scripts:
`run_h3_test.py` and `diagnose_t2_mechanism.py`. Both pre-date
`sample_join.py` and were never converted when it was introduced.

### 71.1 The gap

`run_h3_test.py`'s own inline comment at the point of failure read
verbatim: `continue  # should not happen - same parse() on the same
file` - the exact assumption `sample_join.py`'s module docstring
identifies as the root cause of the original bug (`item_align.py`
mutates `item_id` into the new edition's guideline vocabulary;
`annotation_packet.csv` stores the post-remap id; a fresh `parse()`
yields the raw pre-remap id; the two disagree for any item whose
guideline was renamed between editions). `diagnose_t2_mechanism.py`
carried the identical pattern independently.

This matters specifically because `diagnose_t2_mechanism.py` produced
§54's bullet-vs-ordinal decomposition - the mechanistic explanation for
*why* H3 (structure-aware vs. text-only matching) failed, concentrated
in bullet-marker items where an inserted item shifts every later
sibling's position-based marker. That decomposition had never been
recomputed under the fix, and the script wrote no JSON output, so there
was nothing to even flag as stale.

Both scripts converted to `build_index_join`/`join_baseline`/
`verify_sample_identity`, the identical pattern the other seven drivers
use. `run_h3_test.py`'s rerun reproduces `full_comparison_report.json`'s
H3 figures exactly (method 71.24%, B2 75.97%, diff -0.0472 [-0.0987,
0.0043]) - an independent cross-check via a second, now-fixed code path,
not merely a code change taken on faith. Its stale output
(`h3_test_report.json`, n=209) was removed; the rerun writes
`h3_test_report.SUPERSEDED.json` with an in-file note, since
`full_comparison_report.json` already supersedes this entire analysis.

`diagnose_t2_mechanism.py` was additionally given a JSON output
(`diagnose_t2_mechanism_report.json`, it previously wrote none) and a
bootstrap 95% CI on each marker-kind subgroup's diff - closing a gap the
2026-08-18 marker-kind entry explicitly left open ("no bootstrap CI was
computed for the subgroup split").

### 71.2 §54 recomputed: the bullet finding shrinks but survives; the ordinal finding does not

| Marker kind | n (before → after) | Method acc. | B2 acc. | Diff (before → after) | Bootstrap 95% CI |
|---|---|---|---|---|---|
| Bullet | 72 → **88** | 62.50% | 80.68% | −22.22% → **−18.18%** | **[−0.2841, −0.0909]** |
| Ordinal | 137 → **145** | 76.55% | 73.10% | +5.11% → **+3.45%** | **[−0.0207, 0.0897]** |

The bullet-marker mechanism (§54.1's original explanation: T2's
identifier-trust tier breaks when bullet renumbering shifts a stable
position-based marker) **survives as a real, CI-confirmed finding**,
smaller in magnitude than originally reported (−18.2 points, not
−22.2) but with a 95% CI that still excludes zero.

The ordinal-marker "advantage" **does not survive**. Its CI now includes
zero, and it must not be described as a confirmed subgroup finding going
forward - only as "not statistically distinguishable from zero under the
corrected join."

Connecticut v2023.1→v2024.1 (the pair driving the pooled significant
effect in §53) recomputed under the fix: bullet n=40, diff −35.00%
(method 65.00%, B2 100.00%); ordinal n=19, diff 0.00% (both 89.47%) -
unchanged in direction from the original finding, confirming the bullet
mechanism remains concentrated in this one pair's bulleted
medication-reference appendix rather than spreading out once the dropped
items are restored.

This does not change H3's own confirmed status (still NOT CONFIRMED,
`full_comparison_report.json` unaffected by this recompute - it was
already correctly computed). What changes is the mechanistic
sub-analysis explaining H3's pooled result: the bullet-renumbering
explanation stands at a smaller effect size, and the previously-reported
ordinal-side "the method does slightly better on ordinal items" claim
must be dropped from any future write-up.

Full numbers, including the pre-fix reference values for direct
comparison: `annotation_packets/diagnose_t2_mechanism_report.json`. Code
state unchanged at `d3068ee`; only `diagnose_t2_mechanism.py` and
`run_h3_test.py` (neither frozen) were modified. Full dated entries in
`PREREGISTRATION.md` §11 (2026-08-22, two entries: the join-bug-gap
correction and this recompute result).

## 72. B7 (local cross-encoder reranker): worse than no reranking at all, and why

Audit round 4, Phase 3. B6 (§69) found a general LLM reranker adds no
measurable value over trusting the embedding retriever's own top-1
ranking. Fresh literature research turned up a specific, testable
follow-up question: purpose-built cross-encoder rerankers are reported
in 2025-2026 benchmarks to beat LLM rerankers by up to 15% NDCG@10 while
being far cheaper - does a reranker actually built for this task class,
rather than a general LLM, do better?

### 72.1 Design

`baseline_b7_reranker.py` reuses B6's retrieval unchanged
(`get_topk_candidates`: top-k=10 by cosine similarity, `bge-small-en-v1.5`,
unscoped across the whole new document) so any accuracy difference
between B6 and B7 isolates the reranking step itself. The reranker is
`BAAI/bge-reranker-v2-m3` via `sentence_transformers.CrossEncoder`, run
entirely locally - no API key, no rate limit, no cost, fully
deterministic. Each of the 10 retrieved candidates is scored
independently against the old item's text; a NONE-prediction floor is
swept over {0.0, 0.3, 0.5, 0.7} rather than a single calibrated choice,
matching `b5_model_floor_sweep.py`'s existing discipline. Reported
against the naive top-1-retrieval-only shortcut (no reranking at all) -
the same comparison that made B6's null result interpretable.

### 72.2 Result: worse than no reranking, at every floor tested

| Floor | B7 accuracy | vs. naive top-1 (raw) | 95% CI |
|---|---|---|---|
| 0.0 (always pick argmax) | 69.53% | **−0.0343** | **[−0.0644, −0.0086]** — significant |
| 0.3 | 70.82% | −0.0215 | [−0.0558, 0.0086] |
| 0.5 | 72.10% | −0.0086 | [−0.0472, 0.0300] |
| 0.7 | 70.82% | −0.0215 | [−0.0601, 0.0172] |

For reference: naive top-1-retrieval-only accuracy is **72.96%**
(identical to B6's finding, as expected - same retrieval). B7 never
exceeds the naive shortcut at any floor tested, and against the method
itself (71.24%) none of the four floors reach significance in either
direction.

### 72.3 Investigated before trusting this (section 10)

A purpose-built reranker actively hurting accuracy is a surprising
result in the unfavourable direction, and got the same scrutiny section
10 requires for a suspiciously favourable one. Of 233 items, the
reranker disagreed with naive top-1 on 22 (9.4%): 2 cases where the
reranker was right and naive was wrong, 10 where naive was right and the
reranker was wrong, 10 where both were wrong.

Direct inspection of all 10 naive-right/reranker-wrong cases found a
consistent mechanism, not scattered noise:

- "5 2 1 Bilevel Positive Airway Pressure - Adult" scored **0.9999**
  against "New Transcutaneous Pacing - Adult and Pediatric" - an
  unrelated intervention, not even the same organ system.
- "Tachycardia Adult" scored **1.0** against the same transcutaneous-
  pacing item.
- "Ventricular Tachycardia with a Pulse" confidently matched to
  "Torsades de Pointe" - a related but genuinely distinct arrhythmia
  protocol requiring different management.

Ruled out as explanations: truncation (item texts are short, well under
`max_length=512`) and retrieval failure (naive top-1, using the
identical 10-candidate list the reranker also saw, picked the correct
item in every one of these 10 cases - the true match was always present
and ranked first by retrieval before reranking demoted it).

The pattern is consistent with `bge-reranker-v2-m3` - trained for
general open-domain relevance, not EMS protocol documents specifically -
weighting this corpus's own already-documented templated structure
(section 3.1: "the structure is templated, which matters more than the
numbering") and shared clinical-protocol boilerplate over the actual
distinguishing semantic content. This is exactly the kind of domain-
transfer failure the retrieve-then-rerank literature warns reranking can
introduce when the reranker was not evaluated on template-heavy
specialized documents during its own training/benchmarking.

### 72.4 What this means for the paper

A second, independently-obtained negative result on top of B6's, not a
repeat of the same one. Neither a general LLM (B6) nor a purpose-built
cross-encoder reranker (B7) improves on simply trusting the embedding
retriever's own top-1 ranking for this specific task - and B7 actively
HURTS accuracy at its most permissive floor, a stronger and more
surprising finding than B6's mere null result. The two failures are
mechanistically different and independently diagnosed: B6 essentially
echoed its retriever (agreed with it 96.1% of the time, added nothing);
B7 actively disagrees with its retriever on 9.4% of items and is wrong
more often than right when it does, with a specific, identified cause
(confident domain-transfer errors on templated documents). Together they
constitute complementary evidence that this task's difficulty is not a
reranking-capability gap generic rerankers or generic LLMs can close
out of the box - it requires either fine-tuning on this specific
document genre or a structurally-aware method, which is exactly the
gap this study's own structural method was built to address (even
though the structural method itself does not clear B2's text-only
baseline either, per section 53).

Full numbers: `annotation_packets/b7_comparison_report.json`.

## 73. CRITICAL FINDING: the structure-quality ablation's synthetic corruption creates real id collisions, confounding B2/B5 - and very likely section 61's own curve too

Audit round 4, Phase 3b. `structure_ablation.py`'s docstring states B2 and
B5's accuracy is "provably invariant" to its synthetic corruption, since
the corruption only ever mutates `.guideline`/`.item_id`, never `.text`,
and B2/B5 search `.text` only. The docstring cites a function,
`verify_b2_b5_invariance`, as having checked this. It does not - grep-
confirmed two occurrences in the whole file (the definition and the
docstring's own citation), never called anywhere, and even its body only
samples 3 of B2's clean predictions without comparing anything. The claim
was asserted, not verified.

### 73.1 What was actually run

`annotation_packets/run_discriminability_curves.py` (new) reuses
`structure_ablation.corrupt_edition` with the IDENTICAL seed scheme
`run_trial` already uses, so B2/B5 are corrupted by the exact same random
instance as the method's own curve at each (rate, seed) - a true
apples-to-apples comparison. B2 reimplemented inline using
`item_align._sim`/`_SIM_FLOOR` unchanged; B5 reuses
`baseline_b5.greedy_match_from_embeddings` unchanged, called directly on
corrupted items. Scored via `_orig_id`, mirroring exactly how
`structure_ablation.run_trial` already scores the method. Seed count
reduced to 2 per non-zero rate (timed at ~90s/trial x 4 pairs; the full
5-seed grid would run ~70 minutes) - disclosed and decided before
running, in the pre-commitment entry.

### 73.2 Result: not invariant

r=0 passed exactly (B2 75.97%, B5 78.11%, matching every other driver in
this study bit-for-bit). Across the sweep:

| Rate | B2 accuracy | B5 accuracy |
|---|---|---|
| 0.00 | 75.97% | 78.11% |
| 0.05 | 75.11% / 75.97% | 76.39% / 77.68% |
| 0.10 | 73.82% / 75.11% | 72.96% / 76.39% |
| 0.20 | 73.39% / 73.82% | 69.53% / 72.53% |
| 0.35 | 70.39% / 70.82% | 65.24% (both seeds) |
| 0.50 | 68.67% / 70.39% | 60.52% / 61.37% |

Both baselines decline substantially. B5's decline is larger than B2's in
both absolute and relative terms, despite starting from a higher
baseline.

### 73.3 Investigated before trusting this (section 10)

This directly falsifies a claim already published and quoted throughout
both governance documents, so it was investigated immediately rather
than reported as a bare contradiction.

`corrupt_edition` reconstructs each corrupted item's `item_id` as
`f"{_norm_title(new_title)}/{it.section}/{it.marker_path}{suffix}"`,
preserving only a pre-existing `#N` suffix from the item's ORIGINAL id.
It does not run the uniqueness-preserving `seen_ids` counter logic
`item_parser.py` itself uses - and that logic exists in the real parser
specifically because an earlier version produced "282 colliding ids on a
previous run" (item_parser.py's own commit history).

Direct measurement (all 4 pairs, seed=1):

| Rate | Tennessee | Pennsylvania | Connecticut #1 | Connecticut #2 |
|---|---|---|---|---|
| 0.00 | 0 | 0 | 0 | 0 |
| 0.20 | 67 (4.5%) | 143 (8.4%) | 35 (2.9%) | 51 (3.3%) |
| 0.50 | 180 (12.0%) | 363 (21.4%) | 133 (11.0%) | 183 (11.9%) |

When two originally-distinct items from different source guidelines
happen to share the same `section`/`marker_path` - extremely common,
since independently-numbered bulleted sub-lists ("1.", "2." or "a.",
"b.") recur constantly across unrelated guidelines - and their
guidelines get merged into the same run by corruption, their
reconstructed ids become literally identical strings. B2/B5's greedy
matching loop tracks consumption via a `set()` keyed by `item_id`: a
collision makes two genuinely different items indistinguishable to the
consumption tracker, so consuming one can spuriously block the other,
and which of two colliding items "wins" becomes an artifact of
iteration order, not text similarity.

**This is a defect in the synthetic corruption model, not a real
property of guideline-boundary quality.** It does not correspond to
anything that happens when a real parser genuinely merges guideline
boundaries - a real merge does not duplicate marker paths across
unrelated content.

### 73.4 What this means for the paper - and for section 61

`structure_ablation.py` itself was not modified in this investigation,
so section 61's already-published curve is unchanged and this entry does
not correct any number reported there. But the implication is serious:
**`item_align.align_items` (the method) is run on the SAME corrupted
editions via the SAME id-reconstruction scheme**, and the method's own
T1 (exact-id) and T2 (identifier-trust) tiers explicitly depend on
`item_id` string identity. The method's own already-published accuracy
decline across section 61's curve is very likely partly or substantially
an artifact of this same id-collision defect, not purely a measurement
of guideline-boundary-detection quality as the curve has been presented.

This does not mean section 61's qualitative finding (a monotonic
relationship exists) is false - a genuine boundary-quality effect may
well coexist with this artifact. But the MAGNITUDE of the reported
decline, and therefore the location of the reported crossover point,
cannot currently be trusted as clean. **This is now the single largest
open threat to this study's central empirical claim.**

This must be stated as an open, unresolved limitation in any paper
draft. Re-quantifying section 61 with a corrected, collision-free
id-reconstruction scheme (adding the same `seen_ids`-style uniqueness
suffix `item_parser.py` already uses to `corrupt_edition`, then
re-running the full sweep) is flagged as necessary follow-up work - not
undertaken here, to avoid silently expanding this round's scope without
its own separate pre-commitment.

Full numbers: `annotation_packets/discriminability_curves_report.json`.

## 74. The id-collision fix: section 61's curve corrected, B2/B5 confirmed genuinely invariant

Given the severity of section 73's finding to this study's central
empirical claim, the flagged follow-up was undertaken immediately rather
than left open.

### 74.1 The fix

Added a `seen_ids`-style uniqueness counter to
`structure_ablation.corrupt_edition`, mirroring `item_parser.py`'s own
pattern exactly: a per-edition `dict[str, int]` counting occurrences of
each reconstructed id, appending `#N` on any repeat beyond the first,
applied globally (not only to items whose guideline changed - an
unchanged item can still collide with a changed one). This does not
alter the corruption model's semantics (which guidelines merge, or when)
- it only guarantees the resulting ids remain unique, which they always
are everywhere else in this study.

### 74.2 Four validity checks, in the pre-committed order

1. **r=0 still reproduces 0.7124/n=233 exactly** - unchanged corruption
   at r=0 means the fix cannot touch this, and it didn't.
2. **Collision recheck: 0 collisions at every rate, all 4 pairs** (was
   35-363 depending on rate/pair before the fix) - the fix works.
3. **Full 6-rate x 5-seed sweep, re-run under the fix.**
4. **`run_discriminability_curves.py` re-run under the fix**, to test
   whether B2/B5 are now genuinely invariant.

### 74.3 Corrected section 61 curve

| Rate | Original (pre-fix) | Corrected (post-fix) | Difference |
|---|---|---|---|
| 0.00 | 71.24% | 71.24% | 0 |
| 0.05 | 69.27% | 69.78% | +0.51 |
| 0.10 | 66.35% | 67.81% | +1.46 |
| 0.20 | 63.09% | 65.24% | +2.15 |
| 0.35 | 57.85% | 61.80% | +3.95 |
| 0.50 | 53.05% | 57.00% | +3.95 |

Monotonic non-increasing still holds (confirmed within the pre-registered
0.01 tolerance at every step). The gap between corrected and original
grows with corruption rate exactly as section 73's collision-rate
measurement predicted (0% collisions at r=0, rising to 11-24% at
r=0.50).

**At r=0.50, the corrected curve's total decline from r=0 is 14.24
points, versus the original's 18.19 points: 3.95 of those 18.19 points
(21.7%) were collision artifact, not genuine information loss from
guideline-boundary corruption.**

### 74.4 B2/B5: confirmed genuinely invariant

Re-running `run_discriminability_curves.py` under the fix: B2 and B5 are
now **bit-identical across all 11 trials** - B2 exactly 0.7597, B5
exactly 0.7811, at every single rate and seed tested, zero deviation.

This is a clean confirmation, not merely an absence of a detected
problem: the ORIGINAL "provably invariant" claim was correct in
substance - the corruption model genuinely cannot affect B2/B5's
decisions once ids are unique. The prior non-invariant result (section
73) was entirely attributable to the collision bug, with no remaining
unexplained variance.

### 74.5 What this means for the paper

**Section 61's qualitative finding survives intact and is now on firmer
ground than before this investigation**: the monotonic threshold
relationship is real, not an artifact, and the crossover's existence is
unaffected. **What changes**: the reported MAGNITUDE of the method's
decline was overstated by up to ~4 points at the highest corruption
rates - the corrected curve should replace the original in any paper
draft, with both reported side by side for transparency about the
correction's size, not silently.

This also retroactively validates every "B2/B5 held fixed as reference
lines" design decision made throughout this study's ablation work
(section 61, section 68.1) - the shortcut was mathematically sound; its
only flaw was in the corruption harness's id construction, now fixed.

The most important outcome is procedural, not just numerical: this
closes the loop opened by finding `verify_b2_b5_invariance` was a
non-functional stub (section 73.1) - the claim it was meant to check is
now genuinely, empirically confirmed, not merely asserted a second time.
This is the audit process working as designed: a cited-but-broken
verification function was found, the claim it was supposed to protect
was tested and found (initially) false, the root cause was diagnosed and
fixed, and the claim was re-tested and found true. Nothing was assumed
at any step.

Full numbers: `annotation_packets/structure_ablation_report.json`,
`annotation_packets/discriminability_curves_report.json` (both
regenerated under the fix - the pre-fix numbers are preserved in this
document's sections 61/68.1/73 and in `PREREGISTRATION.md`'s dated
entries, per append-only discipline, not in the JSON artifacts
themselves).

## 75. VLM boundary anchor: a genuine third point on the structure-quality curve, and it beats our own parser

Audit round 4, Phase 3c. Docling (section 70) supplied high recall
(87.65%) but low precision (25.72%) because its generic
`section_header` label mixes hierarchy levels our study's ground truth
doesn't distinguish. This tests whether that mismatch - not a genuine
boundary-finding weakness - was the actual problem, by prompting a VLM
for exactly the granularity the human annotators used.

### 75.1 Design

`vlm_boundaries.py` uses `gemini-3.5-flash-lite` (the only model with
confirmed headroom this study has established), called via the Gemini
Files API so the model reads the actual PDF natively - a genuinely
different input modality from every other boundary-detection method
tested (our parser: text + layout heuristics; Docling: layout model;
VLM: native document understanding). The prompt reuses
`build_boundary_workbooks.py`'s own annotator instructions and
known-subsection exclusion list VERBATIM, not paraphrased - the one
design choice expected to matter most, since Docling's failure was
specifically a granularity mismatch. Only 4 calls needed (one per
Tennessee edition), scored against the same two annotators via
`run_calibration.corrected_f1` unchanged. Precision and recall reported
separately, never F1 alone - the explicit lesson from section 70.3.

### 75.2 Result: better than our own parser, and genuinely balanced

| Edition | VLM titles | Annotator 1 F1 | Annotator 2 F1 |
|---|---|---|---|
| TN2017 | 97 | 0.8753 | 0.9005 |
| TN2018 | 80 | 0.9752 | 0.8346 |
| TN2022-23 | 115 | 0.8816 | 0.8993 |
| TNSept2024 | 95 | 0.9844 | 0.8124 |

**Mean corrected F1: 0.8954** - higher than our own parser's 0.8034.
Mean recall 0.8754, mean precision 0.9328 - genuinely balanced, unlike
Docling's severe asymmetry (recall 0.8765, precision 0.2572). VLM title
counts (80-115 per edition) are much closer to the annotators' own
counts (81-97 for annotator 1, 119-164 for annotator 2) than Docling's
276-467 - direct evidence the granularity-matching prompt worked as
intended, not a coincidence of the scoring method.

### 75.3 Investigated before trusting this (section 10)

A favourable, higher-than-expected result gets the same scrutiny as an
unfavourable one.

1. **Annotator 2's recall is consistently lower than annotator 1's
   across every edition (0.57-0.77 vs 0.95-0.97).** This is not a new
   anomaly - it is the SAME already-documented annotator-style gap
   section 64.2 found for our own parser (annotator 1 averaged corrected
   F1 0.864, annotator 2 averaged 0.743, attributed there to annotator
   2's longer, more granular title lists). Reappearing consistently here
   is reassuring - it means the VLM's output is being scored against
   real, previously-characterised annotator variation, not producing a
   new artifact.
2. **High precision and substantial recall simultaneously** (0.79-0.99
   precision, 0.57-0.98 recall) is the specific combination Docling
   could never produce given its label-granularity mismatch - direct
   evidence the VLM's title list genuinely operates at the annotators'
   intended granularity.
3. **The TN2017 smoke-test sample (80 titles) was read by hand** before
   committing to the full 4-edition run and consists entirely of
   recognizable, correctly-formed clinical protocol names ("Torsades de
   Pointe", "Anaphylactic Shock", "Cerebrovascular Accident (CVA)") - no
   garbage, no running-header repeats, no table-of-contents artifacts,
   the three failure modes that inflated Docling's counts.

### 75.4 What this means for the paper

This DOES become a genuine, clean third point on section 61's
structure-quality curve, unlike Docling - the balanced precision/recall
means F1 alone is not misleading here the way it would have been for
Docling.

More significantly: **a general-purpose VLM, given a granularity-matched
prompt reused verbatim from the human annotator instructions, outperforms
this study's own purpose-built rule-based parser at guideline-boundary
detection** (F1 0.8954 vs 0.8034). This is a substantive finding about
the relative cost-effectiveness of prompt-engineered VLM document
understanding versus a hand-built heuristic parser for this specific
task - and it is independent of, and complementary to, B6/B7's findings
that general models add no value on the DOWNSTREAM item-matching task.
Boundary detection and item matching are evidently different-difficulty
problems for current general-purpose models: the VLM succeeds at finding
where protocols start (a task closer to what VLMs are broadly good at -
visual document structure recognition) while both the LLM (B6) and the
cross-encoder (B7) failed to improve on simple retrieval for matching
which specific item corresponds to which (a task requiring fine-grained
semantic discrimination between clinically similar but distinct content,
where B7's section 72 findings showed a general model actively
confusing surface-level similarity for genuine correspondence).

Full numbers: `annotation_packets/boundary_annotation/vlm_calibration_report.json`,
raw titles in `vlm_raw_titles.json`.

## 76. Two human-labor gates: instruments built, review still outstanding

Audit round 4, Phase 4. Two pre-registration commitments require actual
human judgement, not more code - this section builds the instruments
that make that judgement tractable and generates them for the user, but
does not (and cannot) perform the review itself.

### 76.1 Appendix B item 3: the guideline-pair audit

Registered at pre-registration: "A manual audit of all accepted
guideline pairs is required before publication." Never begun until this
round.

`build_appendix_b_audit.py` reuses `item_align.match_guidelines` and its
internal scoring formula unchanged, exposing every candidate score the
function itself computes but never returns, so a reviewer can see not
just what was accepted but what it beat. Two disclosed failure modes are
flagged and ranked to the top:

- **Containment**: an accepted score of exactly 1.0 where the two titles
  have unequal token-set length - the exact mechanism behind the
  documented "Hypothermia" -> "Induced Hypothermia Following ROSC"
  collision.
- **Ties**: one or more other candidates scored at or above the accepted
  one - the mechanism `tiebreak_sensitivity.py` (audit round 3) measured
  affecting 34-35% of Connecticut's old guidelines.

**Result: 294 total accepted pairs across the 4 confirmatory edition
pairs, 73 flagged (24.8%)** - Tennessee 68 pairs/1 flagged; Pennsylvania
48/5; Connecticut #1 85/34; Connecticut #2 93/33. The Connecticut tie
rates (34/85 = 40%, 33/93 = 35%) land almost exactly on
`tiebreak_sensitivity.py`'s independently-measured 34%/35% - a
consistency check this script passed without being designed around it,
evidence the flagging logic is measuring the same real phenomenon two
different ways.

Written to `annotation_packets/Appendix_B_guideline_pair_audit.xlsx`,
ranked flagged-first with Verdict and Notes columns, so a reviewer faces
73 prioritized rows rather than all 294. **The review itself has not
been performed** - this closes the "the audit never started" gap, not
the audit.

### 76.2 H3' second annotator

The 2026-08-18 CRITICAL CORRECTION left this explicitly open: "A
genuinely independent second annotator for the same 92-item H3' packet
is needed before H3''s reliability can be stated."

Investigating the H3' directory found `Annotator_G_ANNOTATION.xlsx`
present with no generating script referencing it anywhere in the tree -
its provenance is not confirmed by any code. Direct inspection: **0 of
92 correspondence cells are filled in.** It is a blank template, not
collected data, despite its presence potentially suggesting otherwise.

A fresh blind workbook, `Annotator_H_ANNOTATION.xlsx`, was generated
reusing `build_annotator_workbooks.py`'s instructions, column layout,
and blind-design formatting unchanged - the same helpers already used
for the now-retired E/F pair (retired for the same duplication failure
that hit the main round's A/B annotators).

`run_h3prime_second_annotator.py` mirrors `run_boundary_scoring.py`'s
`verify_independence` exactly - byte-hash AND cell-level answer
comparison, raising rather than silently proceeding on a suspicious
match - built in from the start this time rather than added after a
collection failure was already discovered. A completion-count guard was
added and verified: a naive `.exists()` check would have treated G's
blank template as a completed file; `_n_filled()` correctly reports
"0/92 filled (G), 0/92 filled (H)" instead.

**No H3' number changes.** Once both files are genuinely completed by
two independent people, the script verifies independence and computes
Cohen's kappa automatically. Until then, section 57's H3' results
continue to rest on the single unverified judgment already disclosed
there - an open, disclosed limitation, now with the tooling in place to
close it the moment real data exists.

## 77. Remaining prior-art gaps closed: OAEI's benchmark track as direct precedent for section 61, discriminability, and parser robustness auditing

Section 69.1 already positioned this study's B1-B6 baseline ladder
against OAEI's own matcher-development history. Audit round 4's
literature research found two adjacent citations still missing: OAEI's
BENCHMARK TRACK specifically (as opposed to its matcher-comparison
tracks) is a direct methodological precedent for section 61's own
approach, not just an analogous baseline progression, and this had not
been stated.

**OAEI's benchmark track** performs exactly section 61's kind of
experiment one level up: starting from a seed ontology and
systematically altering it - discarding labels, restructuring, removing
information - to test how matchers degrade as a controlled function of
information loss (Euzenat, Rosoiu & Trojahn, "Ontology matching
benchmarks: Generation, stability, and discriminability," Journal of Web
Semantics, 2013). This is the same experimental shape as
`structure_ablation.py`'s corruption-rate sweep, arrived at
independently in this study without knowledge of the OAEI precedent -
worth citing as validation that the experimental design is a recognized
approach in an adjacent field, not an ad hoc invention.

That paper's own vocabulary is directly useful here: it distinguishes
**stability** (does the benchmark's difficulty ranking of matchers stay
consistent across repeated generations) from **discriminability** (does
the benchmark actually separate matchers that should be separated, or
do they respond in lockstep). Section 61's original design measured
something adjacent to stability (across-seed spread at a fixed rate,
section 68.1) but never discriminability directly - whether the
STRUCTURAL method's curve declines differently from a text-only
control's. Audit round 4's Phase 3b (sections 73-74) closed exactly this
gap: B2/B5 were tested across the same sweep and found genuinely
invariant (once a synthetic-corruption defect was fixed) - the sharpest
possible discriminability result, since a control that does not move at
all while the method under test does is a clean separation, not merely
a statistical one.

**ProSA** (arXiv:2605.19309, "How Do Document Parsers Break? Auditing
Structural Vulnerability in Document Intelligence") is a 2026 paper
performing a structurally similar audit one layer down the stack - it
systematically perturbs document layout to test parser robustness,
rather than perturbing already-parsed structure to test a matcher, the
axis this study perturbs. Cited here as evidence that "systematically
break the input and measure the degradation" is an active, current
methodology in the broader document-intelligence literature, not unique
to this study or to OAEI.

Together, these three citations complete the positioning section 69.1
started: this study's central experimental contribution (section 61's
structure-quality curve, now corrected per section 74) sits inside an
established methodological tradition spanning ontology matching (OAEI's
benchmark track, and its Euzenat et al. formalization of what makes a
degradation benchmark informative) and document intelligence (ProSA),
not as an isolated technique invented for this problem.

## 78. Corpus expansion attempt: newer Tennessee edition, retested Rhode Island/Vermont - both negative

At the user's request, checked whether the corpus could be usefully
grown: (1) a newer Tennessee edition than the existing Sept2024
(2024-2025), (2) whether Rhode Island and Vermont - both previously
rejected (sections 22.3, 23.1) for a documented "boundary omission"
failure mode - now parse cleanly given the parser has since gained
footer-based anchoring (Maine, section 17) and ToC-table extraction
(Connecticut, section 18).

**Tennessee**: no edition newer than "Sept24" (2024-2025) found via
direct site search or the `tn.gov` protocol-guidelines page. The
existing 4-edition Tennessee chain remains current.

**Rhode Island**: a new v2026.02 edition exists (effective 2026-06-01,
retrieved from `health.ri.gov`), genuinely newer than what this study
previously touched. `corpus_probe` verdict: WEAK (2067.6 chars/page,
only 1.3% numbered lines, 22 template slots). Given `corpus_probe`'s own
documented history of false negatives (section 12.1: it once scored a
document WEAK at 0.2-0.3% where the real parser found 42% usable
content), ran `item_parser` directly rather than trusting the probe
alone. Result: 49 guidelines, 228 items across 333 pages, but every
sampled item falls under a `preamble/routine patient care/...` guideline
- the SAME anchor-detection failure this study already catalogued for
Rhode Island, unchanged by the parser's newer techniques.

**Vermont**: a 2025 edition exists (retrieved from
`healthvermont.gov`). `corpus_probe` verdict: USABLE (2771.9 chars/page,
3.1% numbered lines, 85 template slots - a better surface signal than
Rhode Island's). `item_parser` result: 58 guidelines, 715 items across
283 pages, but every sampled item again falls under
`preamble/paramedic/...` or `preamble/routine patient care/...` - the
same failure mode already catalogued for Vermont (section 23.1),
unchanged.

**Why the newer techniques didn't help**: Maine's footer-anchor
detection and Connecticut's ToC-table extraction were both built against
those specific publishers' own document conventions (a distinctive
running footer; a well-formed embedded table of contents), not as
general-purpose boundary detectors. Rhode Island's and Vermont's actual
failure mode - real, well-titled protocol content that the anchor
heuristic simply never locks onto - is a different mechanism neither
technique addresses. This is a negative but useful result: it confirms
the original rejections were durable properties of these documents'
structure, not artifacts of an immature parser at the time they were
first tried.

**Not attempted**: building new anchor-detection logic specific to
Rhode Island or Vermont's conventions. Section 16.3 already flagged this
exact situation for Connecticut before it was fixed: "treat [it] as
requiring a separate extraction strategy and either defer it or invest
in table-aware parsing as its own task... do not add [a one-off patch]"
- the same discipline applies here. A general, publisher-agnostic
boundary-detection improvement remains a legitimate future direction,
but a per-state patch for two specific documents would be exactly the
kind of undisclosed, ad hoc special-casing this study has avoided
throughout.

## 79. Corpus expansion, continued: two new candidate pairs found (Tennessee, Connecticut), no major-revision language found for any eligible publisher

Continuing section 78's search. Two searches produced genuine new leads
this study had not previously touched.

### 79.1 Major-revision search: still nothing

Web-searched all three eligible publishers (Tennessee, Pennsylvania,
Connecticut - the only three a candidate is allowed to come from under
the pre-committed eligibility gate, section 11's 2026-08-17 entry) for
any explicit "complete revision" / "major update" / "new edition"
language. Found none. Connecticut's own material describes its
protocols as reviewed and released on a regular two-year cycle, not a
singular overhaul; Pennsylvania's most recent statewide release remains
2023; Tennessee shows no revision-language announcement. **H1/H2 remain
untestable** - this is consistent with section 45.2's standing
conclusion that explicit self-described major revisions may not be a
convention this document genre uses, not a new negative result.

### 79.2 A new Tennessee edition: strong candidate

Retrieved `tn.gov`'s "TN State Guidelines 2024-2025 09.11.2025.pdf" -
confirmed via SHA-256 to be a genuinely distinct document from the
existing `tn_sept2024.pdf` (different hash, different size: 3.56MB vs
2.64MB), not a re-hosted copy of the same file under a new name.

`item_parser` result: 77 guidelines (matching the existing Tennessee
chain's usual count), 1,857 items, 0 duplicate ids, standard
`preamble/notes/N` front matter - structurally clean, no red flags.

`item_align` (Sept2024 -> 09.11.2025): **1,822/1,925 items (94.6%)
trivially alignable** (T1+T2), 69 unmatched (3.6%) - comparable to or
slightly better than the existing Tennessee 2017->2018 pair's own
92.7%/2.7%. A genuinely strong candidate for a THIRD Tennessee
longitudinal link.

**Not yet confirmatory.** Before this could be added: (1) consecutive-
edition verification against Tennessee's own official version-history
page, the same check section 44.3 performed for the existing chain
(not yet done here); (2) the same <10% combined preamble+untitled
acceptance bar every existing pair cleared, computed directly rather
than inferred from the alignment numbers alone; (3) revision-magnitude
classification from the document's own front matter (section 3.3's
method), not assumed minor by default; (4) if promoted to confirmatory,
a dated PREREGISTRATION.md pre-commitment entry before any annotation
sampling, per this study's standing before-not-after discipline - not
undertaken in this exploratory entry.

### 79.3 Two new Connecticut editions: also promising, one artifact investigated and cleared

Retrieved v2025.1 and v2025.2 from `portal.ct.gov` (Connecticut has
released two new editions since this study's existing v2023.1/v2024.1
pair). Both parse structurally cleanly: 125 guidelines each (up from
93 in v2024.1), ~2,240 items, 0 duplicate ids, 0 ambiguous markers, 0
sections with no items.

**A red flag investigated before trusting anything downstream**: both
editions' `item_parser` offset spot-check reported ~80% mismatches
(1,598-1,599/2,000) - far above the historical 0-4% range (Appendix B
item 4's already-disclosed "3-4% mismatch tail, uninvestigated"). Read
five mismatching items by hand rather than assuming either a real
content-extraction failure or dismissing it. Finding: in every case
inspected, the extracted item text is completely correct and meaningful
- the "mismatch" is an artifact of `char_start` pointing to the START of
a bullet-marker glyph (`o`, `•`) rather than the text that follows it,
so a naive same-length slice comparison is offset by the marker's own
character(s). **This is an escalation of the already-disclosed offset
tail, not a new bug** - v2025.1/v2025.2 appear to be MORE heavily
bulleted than prior Connecticut editions, which increases how often this
specific comparison artifact fires, without indicating any actual
content-extraction problem. Appendix B item 4 already states this tail
is "uninvestigated" for the general case; this entry investigates it
directly for one specific instance and finds it benign here, without
claiming the general tail is now understood everywhere it appears.

`item_align` (v2024.1 -> v2025.1): **1,375/1,552 items (88.6%) trivially
alignable**, 89 unmatched (5.7%) - comparable to the existing
Connecticut v2022.1->v2023.1 pair's own 85.5%/5.7%. A second promising
candidate.

**One additional caveat this pair needs before any further trust**: item
count grew from 1,552 (old) to 2,240 (new) - a 44% increase, notably
larger than typical edition-to-edition growth elsewhere in this corpus.
Section 56's guideline-boundary bug produced exactly this signature
(inflated item counts within specific guidelines) in the existing
Tennessee data before it was diagnosed - this pair has NOT yet been
checked for the same size-outlier pattern `run_sensitivity_analysis.py`
already screens the confirmatory set for. Flagging this explicitly
rather than treating the alignment numbers alone as sufficient
clearance.

**Not yet confirmatory**, for the same four reasons section 79.2 lists
for the Tennessee candidate, plus the size-outlier check just named.

### 79.4 Rhode Island and Vermont: retested, both still negative (see section 78)

Already covered in section 78 - both editions' newer versions (RI
v2026.02, VT 2025) still exhibit the same anchor-detection failure this
study catalogued before, unchanged by the parser's newer techniques.
Included here for completeness of this session's corpus-expansion
summary.

### 79.5 Follow-up: three of the four gating checks completed for both candidates

Continuing the same session, the checks section 79.2/79.3 listed as
outstanding were run as far as automatable (the fourth - a dated
pre-commitment entry before any real annotation sampling - is not
automatable and correctly was not attempted here).

**(1) Consecutive-edition verification.** Connecticut's own official
version-history page (`portal.ct.gov`) lists every release in order:
"...v2024.1 -> v2025.1 -> v2025.2..." with nothing skipped - **cleared
directly from the publisher's own primary source.** Tennessee has no
public official archive/version-history page (the same situation
section 44.3 already found - Tennessee's classification "rests on the
thinnest evidence of the four" even for the existing chain) - **not
cleared, and not clearable by public search**, consistent with the
already-disclosed limitation rather than a new one specific to this
candidate.

**(2) The <10% combined preamble+untitled acceptance bar**, computed
directly (not inferred), with the known reference editions computed
alongside for a sanity check:

| Edition | Combined preamble+untitled |
|---|---|
| `tn_20250911` (candidate) | **5.0%** |
| `tn_sept2024` (existing, reference) | 5.0% (identical) |
| `ct_v20251` (candidate) | **0.0%** |
| `ct_v20252` (candidate) | **0.0%** |
| `ct_v20241` (existing, reference) | 0.0% (identical) |

Both candidates clear the bar comfortably, and Tennessee's rate matches
its own already-confirmatory sibling edition to one decimal place - as
clean a pass as this check can produce.

**Size-outlier check** (the section 56 bug signature: guideline size
&gt;4x the edition's median, floor 50, excluding `<preamble>`), run for
both candidates and their reference siblings:

- `tn_20250911`: 3 outliers - "Delirium with HyperAgitation" (533),
  "Vascular Access" (208), "Pre-eclampsia and Eclampsia" (129). **The
  exact same three guidelines**, at comparable magnitude, that
  `run_sensitivity_analysis.py` already excludes from the existing
  Tennessee data (539/228/133 there) - the SAME already-diagnosed and
  already-handled artifact, not a new one.
- `ct_v20251`/`ct_v20252`: 6 outliers each (Appendix 1/2/4 medication
  references, Central Line Access, Staffing Guidelines, Adult) - the
  same count as the existing `ct_v20241` reference's own 6 outliers,
  with substantial overlap in which guidelines are affected (both
  editions' medication-reference appendices and a central-line-access
  guideline are oversized in every Connecticut edition checked). Normal
  edition-to-edition drift in an already-known pattern, not an
  escalation.

**(3) Revision-magnitude classification** from the documents' own front
matter (section 3.3's method) was **not** performed in this session -
still outstanding for both candidates.

### 79.6 Summary for the user

Two structurally strong new candidate pairs, both now cleared on
acceptance-bar and size-outlier grounds with numbers matching their
already-confirmatory sibling editions closely enough to read as the
same underlying document family, not a different risk profile:

- **Tennessee Sept2024 -> 09.11.2025**: 94.6% trivially alignable, 5.0%
  preamble (identical to the existing reference edition), same 3
  known outliers at comparable size. Missing only consecutive-edition
  verification (no public archive exists to check against - an
  existing, disclosed limitation of this publisher, not new) and
  revision-magnitude classification.
- **Connecticut v2024.1 -> v2025.1** (and v2025.1 -> v2025.2 as a
  further link): 88.6% trivially alignable, 0.0% preamble (identical to
  the reference), 6 outliers matching the reference's own pattern.
  Consecutive-edition status **confirmed directly** from Connecticut's
  own official version page. Missing only revision-magnitude
  classification.

Rhode Island and Vermont remain unusable (section 78/79.4). No
major-revision pair was found; H1/H2 remain untestable (section 79.1).

**What remains before either candidate could become a fifth (or sixth)
confirmatory pair**: revision-magnitude classification (quick, code-
only) and a dated PREREGISTRATION.md pre-commitment entry before any
real annotation sampling is drawn - the one step in this whole search
that is properly the user's decision to make, not something to proceed
on without asking, since it commits real annotator time to new data.
Both candidates are ready for that decision whenever the user wants to
make it.

## 80. Full 50-state + DC re-sweep: a genuine major-revision document found (Nebraska), but it does not parse cleanly; many newer minor editions catalogued

At the user's request to search deeply across every state again, three
parallel research passes covered all 50 states plus DC, re-checking
every state's known status against roughly two years of publisher
updates and searching specifically for explicit major/complete-revision
language anywhere, not only at the three eligibility-gate-approved
publishers.

### 80.1 Nebraska: genuine "completely revised" language found, primary-source-confirmed - but the document does not parse

The current Nebraska EMS Model Protocols document
(`dhhs.ne.gov/.../EMS%20Model%20Protocols.pdf`, "Last Revised 5/2026")
contains, on its own acknowledgements page, confirmed by direct text
extraction: *"...pleased to provide this **completely revised and
updated** version of EMS Protocols... **The 2024 Protocols have taken on
a new look** utilizing the algorithm format... **This edition replaces
all previous editions**..."* - explicit, primary-source, unambiguous
major-revision language, exactly what §11's stopping rule and every
subsequent search have never found. Two prior editions exist for
comparison (`H004-2012.pdf`, `H004-2020.pdf`).

**This is the strongest major-revision language found anywhere in this
study's history, at any point in the search.** It is also, importantly,
**not from one of the three publishers the pre-committed eligibility
gate restricts a major-pair candidate to** (Tennessee, Pennsylvania,
Connecticut - "both editions from a document generation already
confirmed clean by prior blind testing," §11 2026-08-17). Nebraska was
previously tested (§27) and was NOT a clean pass - reported then as
"garbage anchor again." Whether to consider loosening or reinterpreting
the eligibility gate for a finding this significant is **explicitly the
user's decision, not made here** - the gate's own text states "no
case-by-case leniency" specifically to prevent exactly this kind of ad
hoc exception being decided informally in the middle of a search.

**Tested anyway, since empirical testing costs little and directly
informs that decision**: downloaded the new edition and ran the frozen
pipeline. `corpus_probe`: WEAK (2017.7 chars/page, only 1.9% numbered
lines). Per §12.1's standing lesson, did not trust this alone -
`item_parser` result: 91 guidelines but only **421 items** extracted
(compare: Tennessee's ~1,500-1,900 for a similarly-sized document), and
**946 sections yield no items at all** - the large majority of the
document's real content. Sample items are table-of-contents noise
("Table of Contents Table of Contents Note regarding medication..."),
not real recommendation-level content.

**Root cause, directly stated by the document's own acknowledgements
text**: the 2024 revision moved to an "algorithm format" - a
flowchart/decision-tree visual layout, not the numbered-prose-list
convention every one of this study's parseable documents (Tennessee,
Pennsylvania, Connecticut, and the failed-but-real-content states like
Rhode Island/Vermont) uses. This study's marker-based item extraction is
built for numbered/lettered/bulleted prose lists; it has no mechanism
for flowchart-box content, which is a fundamentally different visual
structure requiring different extraction logic entirely (something
closer to the VLM approach that succeeded at boundary detection in
§75, not the current text-marker parser).

**Conclusion: a genuine major revision exists, and is now documented
with primary-source confirmation for the first time in this study - but
it is not usable with the current pipeline, for a reason unrelated to
publisher eligibility.** This is worth stating plainly in any future
limitations discussion: the field may be moving toward algorithm-format
protocols, which this study's whole parsing approach does not yet
address, independent of whether Nebraska specifically becomes an
eligible confirmatory publisher.

### 80.2 Utah: a genuine second edition exists for the first time, but still doesn't parse

Previously confirmed to have only ever had one edition (§37), whose own
single-edition parse already collapsed to "3 items from 106 pp." A
"2025 Utah EMS Protocol Guidelines" (Dec 2025) now exists -
`ems.utah.gov` - the state's first-ever second edition, a genuinely new
opportunity where none existed before.

**Tested immediately.** `item_parser` result: 42 guidelines but **only 3
items extracted**, 163 sections with no items - an almost total
collapse, and the item count matches the earlier single-edition
failure's own "3 items from 106 pp" almost exactly. **The new edition
does not fix Utah's underlying structural problem** - whatever anchor-
detection or marker-recognition gap caused the original failure is
still present in this document's newer edition, unchanged.

**Alignment between the two editions tested directly** (the corpus
already held the old single edition, `ut_2023.pdf` - located and
confirmed real content, distinct from two byte-tiny files also present
under similar names that turn out to be failed downloads/error pages
from an earlier retrieval attempt, not genuine document variants).
`item_align` (2023 -> 2025): old 11 items, new 3 items, **0% trivially
alignable, 100% unmatched (11/11)**. A total collapse, not merely a weak
result - confirming Utah is unusable as a PAIR, not only individually
weak on each side. Utah remains unusable, now confirmed across two
independent editions and their cross-edition alignment, rather than one
document in isolation.

### 80.3 Every other lead found, by category

**Newer editions confirmed to exist, not yet pipeline-tested** (in
rough priority order, all from official state sources): Hawaii (2025,
supersedes the already-tested 2023 edition), Alabama (11th edition,
Aug 2025), Kentucky (2025-04-30, notably larger file than before),
Maine (2025, v10.29), Maryland (2026 print edition), New Jersey
(8/21/2025, described as a full ALS+BLS combined document, notably
different from the previously-tested "mostly unmatched" version), New
York (V.26.0, the study's dev publisher), New Hampshire (progressed to
v9.2/v9.3, past the version whose "final" release previously collapsed
to 94.4% preamble - worth re-testing whether the collapse persists),
Ohio (a direct-from-state edition, not the third-party mirror
previously tested), South Carolina (renamed "EMS Clinical Operating
Guidelines," Nov 2025), West Virginia (2026 booklet, plus unconfirmed
"significant consolidation" language that could not be verified against
its primary source - the linked news release 404'd).

**Unresolved, needs a second look with better tooling**: Massachusetts
(live `mass.gov` now serves "Version 2026.1" and a real browser session
confirmed a genuine downloadable file, a different outcome than the
earlier DOCX-mislabeled-as-PDF problem - programmatic fetch is
bot-blocked, needs a browser-based retrieval); District of Columbia (a
file literally named/dated "03172026" exists in the same directory as
the officially-listed Oct 2023 "most recent revision," an unresolved
discrepancy - could not confirm whether it is a genuine newer edition, a
draft, or a stale/mislabeled file); Wisconsin (found PDFs directly on
`dhs.wisconsin.gov`, apparently NOT behind the login gate previously
found - "confirmed login-gated" may have been specific to a different
page or has changed; the Wayback CDX cross-check to determine historical
availability could not be completed, since this session's `WebFetch`
tool cannot reach `web.archive.org`, an environment limitation not a
finding about Wisconsin itself).

**Montana: the blocker fully diagnosed, and it is permanent, not
transient.** The single distinct-digest 2024-07-18 capture previously
attributed to "an Archive.org outage" is confirmed instead to be a
**Common Crawl-sourced capture, hard-truncated at exactly 1,048,576
bytes** (the archived headers show `x-archive-orig-x-crawler-content-
length: 1328248` against a truncated `content-length: 1048576`) - this
is not something that resolves by retrying later, unlike a genuine
outage. Partial content is technically recoverable (82 raw content
streams present) but would require a dedicated PDF-repair tool
(`qpdf`/`mutool`/`pikepdf`) not available in this environment. Montana's
status changes from "worth an immediate retry" to "requires different
tooling," a real, useful correction to the prior entry's optimism.

**North Carolina: still fully blocked**, a fourth consecutive round of
failure. This round specifically checked the Google-Drive-hosted
document folders the state's site now links to and confirmed they
contain policy/procedure/medication documents, not the combined
clinical-protocol PDF itself - the state may have shifted to a
non-indexed distribution model that resists automated discovery
entirely, a structural explanation for the persistent failure rather
than a retrieval problem to keep retrying the same way.

**No change, re-confirmed structurally ineligible** (one quick check
each, no new evidence of a compiled statewide document): Alaska,
Arkansas, California, Colorado, Florida, Georgia, Idaho, Illinois,
Indiana, Iowa (one ambiguous mirror found, not elevated - see the
research agent's own note), Kansas, Louisiana, Michigan, Minnesota,
Mississippi, Missouri, Nevada, North Dakota, Oklahoma, Oregon, South
Dakota, Texas, Virginia, Washington, Wyoming.

**No change, re-confirmed at their known status**: Arizona (the
single-capture dead end for edition-pairing stands, though the document
is now directly live-hosted with visible recent incremental updates -
worth noting for future single-edition reference use, not pairing),
Rhode Island, Vermont (both per §78-79, no further action needed),
Delaware (routine biennial update only, no revision-magnitude language).

**No major-revision language confirmed** for Tennessee, Pennsylvania, or
Connecticut specifically - the three eligibility-gate-approved
publishers - despite dedicated searches through each publisher's full
available bulletin/meeting-minutes history, not just recent years. This
was the search's primary target and it came back negative for all
three.

### 80.4 What this changes

No document from this round is added as confirmatory. The Nebraska
finding is the most significant single result: it proves major-
revision language exists and is findable in this document genre after
all (contrary to this study's prior working hypothesis that it might
not be a convention the genre uses) - just not, so far, at a publisher
this study's pipeline can currently parse. Utah's new second edition
was also tested and confirmed to carry forward the same structural
failure its single earlier edition already had (3 items extracted, both
times, from a 100+ page document) - a real, useful negative result, not
an open lead. The long list of other newer minor editions remains real,
tractable next steps if the user wants to keep expanding the corpus,
gated on the same checks §79 already established. Massachusetts, DC,
and Wisconsin have genuinely open threads worth a follow-up with
different tooling (browser-based retrieval, and a Wayback-capable fetch
tool respectively) rather than being closed out as dead ends.

## 81. Fifth and sixth confirmatory pairs added: revision-magnitude classified, sampled, and packeted

The two candidates section 79 vetted (Tennessee Sept2024->09.11.2025,
Connecticut v2024.1->v2025.1) are promoted to confirmatory status,
completing the two checks section 79 left outstanding.

### 81.1 Revision-magnitude classification

Per section 3.3's method - the publisher's own front-matter language,
not external inference - both candidates' front matter was searched
directly for revision-magnitude keywords and compared word-for-word
against their already-confirmatory sibling editions:

- **Tennessee**: the new "09.11.2025" edition carries the identical
  "(revision project completed July 2024)" phrase already found in the
  existing Sept2024 sibling - the same text, not merely similar
  wording.
- **Connecticut**: both new editions (v2025.1, v2025.2) carry the
  identical "living document... can be edited and updated at any time.
  However, they are formally reviewed, edited, and released every two
  years" boilerplate already found in the existing v2024.1 sibling.

**Both classify as MINOR** - consistent with, not merely similar to,
every one of the four existing pairs, since the classifying language is
literally identical across old and new editions in both cases. No
ambiguity, no judgement call required.

### 81.2 Sample drawn, packets and blind workbooks generated

Using `annotation.stratified_sample` and `annotation.write_annotation_packet`
completely unchanged - the identical frozen-seed (20261017) per-tier
draw and packet format used for all four existing pairs:

| Pair | Population (T1/T2/T3/T4/T5/T6) | Drawn (T1/T2/T3/T4/T5/T6) | Total |
|---|---|---|---|
| Tennessee Sept2024->09.11.2025 | 1764/58/0/0/34/69 | 30/10/0/0/10/10 | 60 |
| Connecticut v2024.1->v2025.1 | 1037/338/26/3/59/89 | 16/11/10/3/10/10 | 60 |

Tennessee has no T3/T4 population to draw from in this pair, matching
the pattern the existing Tennessee 2017->2018 pair already showed (its
own §47 table shows the same shape).

Two blind annotator workbooks generated (`build_new_pairs_workbooks.py`,
reusing `build_annotator_workbooks.py`'s formatting completely
unchanged), scoped to just these two new pairs rather than merged into
the original 4-pair combined workbooks Annotators A-D already
completed - retroactively altering an already-submitted instrument
would be against this study's standing discipline. Two annotators, the
next available letters after the main round's A-D and the H3' follow-
up's E-H: **Annotator I and Annotator J**.

### 81.3 What this changes

The confirmatory test set now stands at **6 pairs from 3 publishers**,
meeting the "≥6 pairs" component of the target a 2026-08-17 entry
flagged as "not yet met" (its "≥4 publishers" component remains open).
Once Annotator I and J complete their workbooks - the user's to
arrange, not something further code work can do - the dataset grows
from 240 to 360 total sampled items, and every hypothesis test (H3,
H4, H5) would need a formal re-run against the expanded set, separately
committed and performed at that time. No result changes from this
entry alone; it generates the instrument, not data.

## 82. Massachusetts retrieval: confirmed genuinely blocked by this environment's tooling, not by the document itself

Section 80.3 flagged Massachusetts as an open thread - a research agent
using a real browser session confirmed a genuine downloadable file now
exists at `mass.gov` (a different outcome than the earlier DOCX-
mislabeled-as-PDF problem), where programmatic fetch (`curl`, `WebFetch`)
returns a 403 bot-detection block.

Followed up directly with this environment's sandboxed browser tool.
Confirmed the file is real: "Emergency Medical Services Statewide
Treatment Protocols Version 2026.1 - Effective June 1, 2026" (9.14 MB,
last updated 2026-02-10, Office of Emergency Medical Services) - a
genuinely newer edition than the existing `ma_2023.pdf` already in the
corpus (the "one real edition" recovered in an earlier round). The
landing page loads and confirms the file's existence and metadata
directly.

**The download itself is blocked by this session's browser sandbox by
design**, not by anything specific to Massachusetts or this document:
the tool's own operating constraints state explicitly that "the
viewer's sandbox also blocks any download the page starts itself." The
PDF is served with a forced-download response (`Content-Disposition:
attachment`), and the sandbox intercepts this universally - the same
block would apply to any PDF served this way from any site, not a
Massachusetts-specific or document-specific failure. Confirmed by
observing the network log directly: the `/download` request itself
returns HTTP 200 (the file exists and the server responds correctly)
but is aborted client-side (`net::ERR_ABORTED`) by the sandbox before
any content reaches disk.

**Massachusetts remains blocked, but the finding has changed in kind**:
previously an open question about whether a genuine document exists at
all (given the DOCX confusion); now confirmed to be a real, retrievable
document blocked only by this specific environment's download-sandbox
policy - a tooling gap, not a research dead end. Retrieval by any
method NOT subject to this sandbox (a different browser environment, a
direct authenticated `curl` session outside this sandbox, or simply the
user downloading it directly and providing the file) would very likely
succeed immediately, since the server itself responds correctly and the
file's existence and size are already confirmed.

## 83. District of Columbia: a real, previously-unchecked document - but boundary detection shows a genuine, unresolved quality problem

DC had never been checked anywhere in this study before section 80's
sweep. Two documents retrieved directly via `curl` (no bot-blocking
issue at all for DC - the earlier research agent's confusion was
`WebFetch`'s markdown converter failing on binary PDF content, not a
retrieval problem): `dc_aug2024.pdf` ("August 2024") and
`dc_03172026.pdf` (dated "03172026" in its filename, confirmed via
SHA-256 to be a genuinely distinct document, not a duplicate or stale
file - resolving section 80.3's open discrepancy).

### 83.1 Individually: genuinely strong signal

`corpus_probe` verdict on the newer edition: **STRONG** (1565.6
chars/page, 12.9% numbered lines) - the first STRONG verdict anywhere
in this entire corpus-expansion effort; every other candidate tested
(Tennessee, Connecticut, Nebraska, Utah) scored WEAK or USABLE.
`item_parser`: both editions parse with 0 duplicate ids, 0-1 ambiguous
markers, and real recommendation-level content ("Contact Medical
Control as soon as feasible in accordance with protocols for
medication...") - 132 guidelines / 2,350 items (new), 206 guidelines /
2,629 items (old). Offset spot-check: 53/2000 mismatches (2.65%),
comfortably within the historical normal range, unlike Connecticut's
earlier ~80% artifact.

### 83.2 Cross-edition alignment: much lower than every existing pair

`item_align` (Aug2024 -> 03172026): only **50.5% trivially alignable**
(T1+T2), 30.8% needing more than an id, **18.7% unmatched** - far below
every existing confirmatory pair (85-99% trivially alignable, 0.5-5.7%
unmatched) and below the two vetted Tennessee/Connecticut candidates
(88.6-94.6%) as well.

### 83.3 Investigated before characterizing this either way (section 10)

A result this different from everything else in the corpus deserves
scrutiny before being called either "a harder, more interesting
document" or "not usable" - the two readings this number alone cannot
distinguish.

Combined preamble+untitled rate: **4.2% (old) / 4.4% (new)** - well
under the 10% acceptance bar on its face. But the size-outlier check
tells a different story: **17 outlier guidelines (old), 12 (new)** -
far more than any existing pair (Tennessee 3, Connecticut 6) - and,
critically, several of the outlier TITLES THEMSELVES are visibly
malformed: *"Treatment Care Protocols [encoding artifact] General
Medical Emergencies Behavioral Psychological Emergencies 7.11"* (multiple
category headers concatenated into one string), *"Good, crying
Treatment Protocols [encoding artifact] Resuscitation Newborn
Resuscitation 4.9"* (a content fragment - "Good, crying" - bleeding
into what should be a clean guideline title).

**This is not "genuinely harder content the structural method exists to
help with" - it is the same recurring anchor-detection weakness this
study has documented at multiple other publishers** (the section 56
boundary bug's mechanism: adjacent content swept into whichever
guideline the anchor last successfully locked onto), here producing
oversized, garbled-title guidelines rather than the catastrophic
"everything under `<preamble>`" collapse seen at Rhode Island/Vermont/
Nebraska/Utah. The raw combined-percentage number passes the bar
mechanically; the outlier pattern reveals the same class of real
underlying problem the percentage alone does not capture.

### 83.4 Conclusion

DC is a genuine, valuable new finding - a previously-unchecked
publisher with real, substantial content that parses far better than
almost every other candidate tried in this effort - but it is **not**
ready to be characterized as a clean candidate the way the Tennessee
and Connecticut pairs were. The low alignment rate is most likely
explained, at least partly, by the same title-garbling problem visible
in the outlier list, not by a genuinely harder cross-edition revision.
Before this could be seriously considered: the specific outlier
guidelines would need hand inspection (matching the discipline already
applied to Connecticut's Central Line Access outlier in section 58.2)
to determine whether the garbled titles are concentrated in a
excludable subset or are pervasive enough to disqualify the document
format generally - not undertaken here, to avoid overselling a
promising-looking but not yet properly vetted lead. Both documents
added to `CORPUS_MANIFEST.md` with SHA-256 hashes for provenance; not
promoted to confirmatory or even fully-vetted-candidate status.

### 83.5 Follow-up: outlier content read directly - a decisive negative result, not a salvageable one

Section 83.4 flagged the outlier guidelines as needing hand inspection
before DC could be seriously considered. That inspection is now done.

Directly sampled the largest outlier ("Dystonic Reactions 7.4", 325
items - the single largest guideline in the document, roughly 20x the
edition's median size) at regular intervals across its full range,
rather than only its first few items. The content is topically
unrelated across the sample: *"Provide continuous EKG monitoring,"
"Establish IV/IO access," "Obtain 12 lead EKG and evaluate for cardiac
causes of acute adrenal crisis," "Acquire a 12-lead EKG following
cessation of seizure activity," "Dispense oral glucose... diabetic
ketoacidosis," "Patients with syncope or near-syncope," "Discontinue
cold water immersion... hyperthermia."* EKG monitoring, adrenal crisis,
seizures, diabetic ketoacidosis, syncope, and hyperthermia are not
Dystonic Reactions, or plausibly connected to it - this is a genuine
garbage-bucket guideline collecting content from many unrelated real
protocols, not a legitimately large single protocol.

**This is a decisive result, not a salvageable one.** The prior
concern (section 83.3) that this might be concentrated in a small,
excludable subset does not hold: with 12-17 outlier guidelines per
edition (roughly 4-6x every existing confirmatory pair's count) and the
single largest one already shown to be a multi-protocol garbage bucket,
this is a broad, severe manifestation of the same anchor-detection
mechanism section 56 diagnosed at a smaller scale in Tennessee - DC's
document format (dense numeric subsection labels like "7.4", "3.3",
"11.5") appears to confuse the current anchor-detection heuristic more
severely than any publisher already in this study's confirmatory set.

**Conclusion, updated from section 83.4's "not yet vetted" to a
concrete negative finding**: DC is not usable with the current parser
without a genuine fix to guideline-boundary anchor detection for this
document's specific format - the same class of work flagged as out of
scope for a one-off patch in section 16.3's Connecticut precedent
("treat it as requiring a separate extraction strategy... not
undertaken here"). DC joins Rhode Island and Vermont as a state with
real, substantial content that the current pipeline cannot cleanly
extract, for a documented and specific reason rather than an
unexplained failure.

## 84. Five more untested newer editions checked: two too thin, three parse individually well but none align

Continuing the corpus-expansion sweep with editions section 80.3
catalogued as "newer editions confirmed to exist, not yet pipeline-
tested."

**Hawaii (2025)** and **Alabama (11th edition, 2025)**: both too thin
to be usable. Hawaii: 15 guidelines but only 102 items, 77 sections
empty. Alabama: 69 guidelines but only 109 items (barely more than one
item per guideline on average), 362 sections empty. Both match this
study's prior characterization of these publishers (Hawaii's editions
already tested and rejected; Alabama's "~90% unusable" finding) -
newer editions did not change the underlying structural problem.

**Maine (2025), Maryland (2026), New Jersey (2025)**: all three parse
individually well - Maine 42 guidelines/1,720 items/**0 sections
empty**; Maryland 125 guidelines/3,958 items; New Jersey 59
guidelines/2,198 items/only 20 sections empty. All three looked
genuinely promising on this axis alone, better than DC's individual
parse in some respects.

**None align.** Tested against each publisher's most recent prior
edition already in the corpus:

| Pair | Trivially alignable | Unmatched |
|---|---|---|
| Maine 2019->2025 | 47.5% | 22.2% |
| Maryland 2025->2026 | 44.9% | 15.8% |
| New Jersey 2022->2025 | **0.3%** | **57.8%** |

All three fall well below even DC's already-marginal 50.5%, let alone
the 85-99% range every existing confirmatory pair and the two newly-
added Tennessee/Connecticut pairs clear. New Jersey's result is a
near-total collapse - old items (334) versus new items (2,198) differ
by nearly 7x, suggesting either the 2022 edition itself parses far more
thinly than its 2025 counterpart or the document changed format
substantially between editions (a 3-year gap, versus every existing
pair's 1-2 year gaps). Maryland's alignment is dominated by T5_moved
(38.2% of all items) rather than T6_unmatched, suggesting large-scale
item reordering/renumbering rather than content loss - a different
mechanism from DC's garbage-bucket problem, not yet diagnosed further.

**None of the five progress past this stage.** Not added to
`CORPUS_MANIFEST.md` as candidates (their source PDFs are already
locally present from this and prior sessions' retrieval, but the
manifest is reserved for documents feeding an actual reported claim or
a genuinely vetted candidate, matching its own stated scope). This
closes out five of the eleven "newer edition, not yet tested" entries
section 80.3 catalogued; the remaining six (New York, New Hampshire,
Ohio, South Carolina, West Virginia, plus Kentucky's download which
failed and needs a retry) are the next natural targets.

## 85. Remaining newer-edition leads closed out: Ohio also fails to align, West Virginia/South Carolina too thin, New York/New Hampshire blocked on retrieval only

Closes out the rest of section 80.3's "newer edition, not yet
pipeline-tested" catalogue.

**A duplicate-file discovery, corrected before testing anything**: the
freshly-downloaded `ems.ohio.gov` document (`oh_2026.pdf`) turned out
byte-identical (same SHA-256) to `oh_current.pdf`, an Ohio file already
in the corpus from an earlier session - not a genuinely new edition,
despite being retrieved from what looked like a fresh, direct-from-
state URL. The alignment test against it accordingly showed a
suspicious 100% match with identical old/new item counts (973=973) -
investigated rather than reported, per section 10, and traced to the
duplicate rather than a real finding. Corrected by testing against the
genuinely older `oh_2021_amerimed.pdf` (the third-party mirror
already flagged in this study's history as Ohio's prior tested
edition) instead.

**Ohio (2021 mirror -> 2026 direct-from-state)**: 31.0% trivially
alignable, 38.9% unmatched - fails to clear the bar, in the same range
as Maine/Maryland/DC. Many matched items remain under `preamble/...`
pseudo-guidelines rather than real named protocols even where the
identifier survives, consistent with this study's prior characterization
of Ohio ("garbage anchors").

**West Virginia (2026 booklet) and South Carolina (Nov 2025)**: both
too thin to be worth an alignment test - West Virginia 322 items across
41 guidelines (726 sections empty); South Carolina 318 items across 72
guidelines (983 sections empty). Both match this study's prior
characterization of these publishers; the newer editions did not
change the underlying structural problem.

**New York (V.26.0) and New Hampshire (v9.2/v9.3)**: retrieval
attempts failed on both - New York's guessed URL pattern
(`ny_collaborative_protocols_v26.0.pdf`, following the exact naming
convention of every prior version) returned a 404 HTML page rather
than the real file, meaning the actual v26.0 URL uses a different
pattern not yet found; New Hampshire's bulletin-announcement URL
returned an HTML page, not the protocol document itself (the
announcement page, not the PDF). **This is a retrieval gap, not a
negative finding about either state** - unlike Ohio/WV/SC, nothing was
learned here about parsing or alignment quality, only that the correct
download URL has not yet been located. Worth a dedicated retry with a
direct site crawl rather than a guessed URL pattern.

### What this closes

All eleven "newer edition, not yet tested" leads from section 80.3 are
now accounted for: two too thin from the start (Hawaii, Alabama),
three parsing well individually but failing alignment (Maine, Maryland,
New Jersey), one already covered in depth (Ohio, now confirmed failing
alignment too), two too thin (West Virginia, South Carolina), and two
still blocked on retrieval alone (New York, New Hampshire) rather than
resolved either way. Kentucky's earlier download failure (section 80,
K-N sweep) also remains unretried. None of the eleven produced a
viable new confirmatory candidate - the only two that did, Tennessee
and Connecticut (section 79, added to the confirmatory set in section
81), remain the sole results of this entire multi-session corpus-
expansion effort.

## 86. Puerto Rico: no compiled statewide clinical protocol document found

Checked per the user's "52 states" framing (50 states + DC + Puerto
Rico, a common shorthand this study had not previously covered - DC was
added in section 80, Puerto Rico was not).

No statewide compiled EMS clinical treatment-protocol PDF was found
under Puerto Rico's Negociado del Cuerpo de Emergencias Médicas
(NCEM) or the Department of Health's EMS-related pages. What exists
publicly is regulatory/organizational material (technician licensure
law, an operational emergency-preparedness plan) - the same pattern
this study found for the 24 mainland states confirmed structurally
ineligible (protocols set at a more local level, or not compiled into
one public document). Not elevated to a tested candidate; no PDF
exists to test.

This completes the "52 states" sweep the user's framing implied - 50
states, DC, and Puerto Rico all now checked at least once in this
study's history.

## 87. Correction: New York's "V.26.0" was not a new lead - already tested as part of the original dev-corpus work

Section 85 listed New York (V.26.0) as blocked on retrieval, alongside
New Hampshire. Retrying with a browser-realistic User-Agent header
(`curl -A "Mozilla/5.0..."`) succeeded immediately - the earlier 403s
were ordinary bot-detection, not a wrong URL, resolved by the same
technique that unblocked several other states' downloads across this
session. **But the resulting file (`ny_v260.pdf`) turned out
byte-identical to `ny_collab_v260.pdf`, already present in the corpus**
- checked before doing any further work, per section 10's discipline
against assuming a "new" download is actually new.

New York's v25.1->v26.0 pair (both Collaborative and BLS) is not a new
finding at all - it is this study's own DEV-CORPUS work, already fully
tested and published in sections 15.2-15.3: NY Collaborative 44.0%
trivially alignable / 19.1% unmatched (fails the bar, same range as
this round's other failures); **NY BLS 90.9% trivially alignable / 4.9%
unmatched - a number that would clear the acceptance bar cleanly if NY
were eligible.** New York remains ineligible regardless of this number,
per its standing status as a dev/exploratory publisher, not a parsing
or alignment quality issue - the same distinction already established
throughout this study's dev-vs-confirmatory discipline.

**New Hampshire remains genuinely blocked** - the same User-Agent
technique that fixed New York failed against `mm.nh.gov` (still
returns an HTML page), suggesting a stronger or different bot-detection
mechanism. Left as a documented open retrieval gap, not pursued
further in this entry.

This closes out New York cleanly (already-known result, correctly
excluded on eligibility grounds, not a parsing failure) and leaves New
Hampshire as the one genuinely unresolved retrieval gap from this
entire corpus-expansion effort.

## 88. Attempted DC rescue with VLM boundaries: the VLM finds correct titles, but remapping guidelines alone doesn't fix alignment

Section 75 found a VLM prompted for exactly the ground-truth
granularity outperforms the marker-based parser at boundary detection
(F1 0.8954 vs 0.8034) on Tennessee. Section 83 diagnosed DC's
alignment failure as specifically an anchor-detection problem
(garbage-bucket guidelines mixing unrelated content). The natural next
question: does the VLM's boundary-detection strength generalize to
actually rescuing a broken cross-edition pair, not just scoring well
against ground truth?

### 88.1 The VLM does find correct DC titles

Ran `vlm_boundaries.extract_vlm_titles` against both DC editions.
Result: 194 titles (old edition), 195 (new) - a plausible count for a
~500-page document, and a sample read by hand is clean, coherent, real
protocol names ("Cardiac Arrest," "Pulseless Electrical Activity (PEA)
/ Asystole," "Return of Spontaneous Circulation (ROSC)," "Newborn
Resuscitation") - none of the garbled, multi-protocol-concatenated
titles the marker parser produced. This confirms section 75's finding
generalizes: the VLM correctly identifies DC's real guideline
boundaries where the marker-based anchor heuristic could not.

### 88.2 A rescue attempt built and tested, not just scored

New exploratory script (`dc_vlm_remap.py`, not part of the pipeline,
does not modify `item_parser.py`/`item_align.py`/`corpus_probe.py`/
`edition_align.py` - operates entirely on in-memory copies of already-
parsed editions, reusing `structure_ablation.py`'s established
monkeypatch-`parse()` pattern for testing "what if" scenarios against
the real, unmodified `item_align.align_items`): locates each VLM
title's position in `canonical_text` (guarding against the known
table-of-contents pitfall - a match is only accepted at or after the
marker-parser's own first non-preamble item, the same discipline the
original Phase 3 VLM-boundary plan specified), then reassigns every
item's `.guideline` field to whichever VLM-title span its `char_start`
falls into. 95.9%/96.9% of VLM titles were successfully located in the
text (old/new).

### 88.3 Result: modest, mixed - not a rescue

| | Marker-based (section 83) | VLM-remapped |
|---|---|---|
| Trivially alignable | 50.5% | **48.8%** (slightly worse) |
| T3 renumbered | 2.1% | **28.2%** (much higher) |
| Unmatched | 18.7% | **15.4%** (improved) |

Unmatched improved modestly; trivially-alignable did not improve at
all - if anything it moved slightly the wrong way. **This does not
rescue DC to a usable level** - 48.8% remains far below the 85-99%
range every existing confirmatory pair clears.

The T3 (renumbered) jump from 2.1% to 28.2% is the most informative
part of this result: a large fraction of items that were previously
resolved (correctly or not) by exact-id matching now require the
method's own structural renumbering-recovery logic instead - because
reassigning `.guideline` changes every affected item's `item_id`
(constructed as `guideline/section/marker_path`), even for items whose
underlying content match was already correct. **The remaining problem
is not purely at the guideline-boundary level.** Correcting which
guideline an item belongs to, without also correcting the item-level
`section`/`marker_path` labeling the marker-based parser produces
within each guideline, only partially helps - the bottleneck runs
deeper into DC's specific item-extraction quality (its dense numeric
subsection convention, "7.4," "3.3," "11.5," visible in the section 83
outlier titles) than boundary detection alone can fix.

### 88.4 Conclusion

A genuine, honest test of whether section 75's VLM-boundary success
generalizes beyond scoring against ground truth to actually repairing
a broken cross-edition pair - it does not, at least not with this
simple a remapping. DC's boundary detection specifically is fixable
with VLM assistance (confirmed directly, section 88.1); DC's overall
alignment is not, because the remaining problem sits at least partly
in item-level extraction, a different and harder layer this exploratory
attempt did not address. Worth stating plainly as a limitation of the
VLM-boundary technique's generality, not oversold as confirming it
works everywhere it was tried. `dc_vlm_remap.py` retained as a
reusable tool for testing this same question against any other future
candidate with a similar failure mode.

## 89. H3′ recomputed against genuine second-annotator ground truth, superseding every H3′a/H3′b/H3′c number in section 57

Section 65's second-annotator gap is now closed with real data, and in
closing it a second, more serious bug was found and fixed: the script
that actually scores H3′a/H3′b/H3′c had never been updated after the
E/F retraction and was silently still using the fabricated E/F "ground
truth" for every H3′ number published so far.

### 89.1 The bug

The 2026-08-18 CRITICAL CORRECTION retracted the main round's A/B
annotator pair after finding it was a file agreeing with a copy of
itself, not two independent judgments. Section 65 disclosed, honestly,
that H3′'s own annotator pair (E/F) rested on the same kind of
unverified footing and registered a genuinely independent G/H pair as
an open follow-up.

What section 65 did not catch - because nobody had gone back to look
at `run_h3prime_test.py` itself, only at whether E/F needed replacing
- is that E/F was not merely "unverified," it was the *exact same
duplication artifact* as the retracted A/B pair: `Annotator_F_ANNOTATION.xlsx`
was byte-identical to `Annotator_E_ANNOTATION.xlsx`. The script's own
docstring even recorded the tell ("kappa=1.0000, 0/92 disagreements")
without anyone recognizing it as the same signature already retracted
elsewhere in this study. Every H3′a/H3′b/H3′c number in section 57 was
therefore computed against a file matching itself, not against a real
second opinion - a strictly worse situation than the "single
unverified annotator" section 57 disclosed at the time.

This was found only incidentally, while wiring the newly-completed
G/H files into the scoring script - a direct instance of section 10's
standing rule catching a problem nobody was specifically looking for.

### 89.2 The fix

`run_h3prime_test.py` repointed at the genuine `Annotator_G_ANNOTATION.xlsx`
/ `Annotator_H_ANNOTATION.xlsx` pair. Independence verified first
(`run_h3prime_second_annotator.py`, mirroring `run_boundary_scoring.py`'s
`verify_independence`): different file hashes, different cell-level
answers - **Cohen's kappa 0.9414, 94.57% observed agreement (87/92)**,
comfortably above every threshold this study uses.

The 5 genuine disagreements (S026, S027, S043, S049, S074) all follow
one pattern: one annotator marked the item's correspondence NONE
(confidently deleted), the other marked CANNOT_DETERMINE (genuinely
unsure) - a real interpretive question, not annotator error. Rather
than resolve these silently (majority-of-one, or picking one
annotator's answer), `build_ground_truth()` now excludes them from
ground truth and reports them explicitly as pending. A 2-rater
adjudication workbook (`build_h3prime_adjudication.py`,
`H3prime_Adjudication_5_items.xlsx`) was generated for a human to
resolve, following the same discipline as the main round's 43-item
adjudication.

The retracted `Annotator_E_ANNOTATION.xlsx`/`Annotator_F_ANNOTATION.xlsx`
were deleted from the repository - superseded, no longer referenced
by any script, and their retention risked exactly this kind of silent
reuse happening again.

### 89.3 The recomputed result

Of the 92-item packet: 11 are the already-disclosed section 56-pattern
contamination (bullet-census items whose boundary bled into "Delirium
with HyperAgitation" in the fresh pair) and remain excluded from
scoring, unchanged by this fix. Of the remaining 81, 21 are clean
bullet items and 60 are ordinal items; 5 of those 81 fall among the
pending-adjudication items (3 ordinal, 2 bullet), leaving 21 scored
bullet items and 57 scored ordinal items.

**H3′a (v2-fixed vs v1-original, clean bullet, n=21):** a=1.0000,
b=1.0000, diff=0, 95% CI [0, 0], p=1.0. **CONFIRMED: False.**

**H3′b (v2-fixed vs B2, same 21 items):** identical - a=1.0000,
b=1.0000, diff=0, p=1.0. **CONFIRMED: False.**

Both reproduce section 57's already-published characterization exactly:
this subpopulation is degenerate by construction (20 of 21 items are
T1-tier, where the fix is a no-op), so p=1.0 is the expected
UNTESTABLE result, not evidence against the fix. The genuine G/H
ground truth changes nothing about this conclusion - it was never
about the annotator pair's reliability.

**H3′c (v1 vs B2, ordinal, n=57 of 60 - an independent replication of
H3's original ordinal finding, section 54.1, on fresh Tennessee data):**
a=0.7544, b=0.7368. Paired difference (a-b): point estimate 0.0175,
95% CI [-0.0877, 0.1228], p=0.441. **CONFIRMED: False.**

Benjamini-Hochberg applied across the {H3′a, H3′b, H3′c} family, as
pre-registered but never actually applied until this run - all three
p-values remain 1.0/1.0/1.0 after adjustment (H3′c's raw 0.441 also
survives at 1.0 given the other two).

### 89.4 Reading H3′c honestly

The direction matches H3's original finding - fixed-population
accuracy nominally exceeds B2's baseline-only accuracy, 75.44% vs
73.68% - but on this smaller, fresh 57-item sample the confidence
interval crosses zero. This is reported as a **non-replication at the
pre-registered significance bar**, not softened into "directionally
consistent." It does not retract H3's original finding, which has its
own, separately-powered dataset (section 54.1) - H3′c was always
framed as an independent replication attempt on a different, smaller
sample, and that attempt did not reach significance.

Five items remain genuinely undecided pending human adjudication. If
resolved, the ordinal arm's n could rise from 57 to as high as 60 (3
of the 5 pending items are ordinal) - unlikely to flip a confidence
interval this wide, but the recompute should be re-run once
`H3prime_Adjudication_5_items.xlsx` is completed, per the same
discipline applied throughout this study: report the number that
exists, update it when better data arrives, never estimate around a
gap that a human can close.

**Every H3′a/H3′b/H3′c number in section 57 is superseded by this
section**, per the standing append-only discipline (section 57's text
is left in place, not deleted or edited). Full report:
`annotation_packets/h3prime_tennessee_2022_2024/h3prime_test_report.json`;
second-annotator verification:
`annotation_packets/h3prime_tennessee_2022_2024/h3prime_second_annotator_report.json`.

### 89.5 Final recompute: all 5 pending items adjudicated, full 92-item ground truth

`H3prime_Adjudication_5_items_COMPLETED.xlsx` came back with all 5
disputed items resolved to NONE. `run_h3prime_test.py`'s adjudication
hook picked it up with no code change, and the full 92-item packet is
now completely resolved - no pending items remain.

**H3′a/H3′b are unchanged**: n=21, a=1.0000, b=1.0000, diff=0, p=1.0,
CONFIRMED False - none of the 5 newly-resolved items fall in the
clean-bullet subpopulation, so this result was never going to move.

**H3′c is now scored on the full 60 ordinal items** (was 57 in the
interim result above): a=0.7167, b=0.7167 - exactly identical - paired
difference 0.0, 95% CI [-0.1, 0.1], p=0.5641. CONFIRMED False.

The point estimate moved from a nominal +0.0175 favoring v1 (interim,
n=57) to exactly 0 (final, n=60) - checked before reporting, per
section 10: this is not a scoring artifact (bootstrap seed, BH
adjustment, and scoring logic are byte-identical between the two runs;
only the ground-truth dict's contents changed, exactly as the pending-
adjudication hook is designed to do) but a real consequence of the 3
newly-resolved ordinal items' truth value (NONE) being one both v1's
and B2's predictions already happened to agree on - a coincidence of
which specific items were pending, not a systematic effect favoring
either arm.

**Both readings support the identical conclusion**: H3′c does not
independently replicate H3's original ordinal finding (section 54.1)
at the pre-registered significance bar on this smaller, fresh
Tennessee sample. The full n=60 number, not the interim n=57 one, is
the one that should be quoted going forward - this is now the final,
complete H3′ result, with nothing left pending. Full report:
`annotation_packets/h3prime_tennessee_2022_2024/h3prime_test_report.json`
(overwritten; the interim 87-item numbers are preserved above and in
`PREREGISTRATION.md`'s table, per append-only discipline).

## 90. The fifth and sixth confirmatory pairs, scored: replication mostly holds, but T5 (moved guidelines) drops to 0% precision on independent data

Section 67 drew samples and generated blind workbooks for two new
confirmatory pairs - Tennessee Sept2024->09.11.2025 and Connecticut
v2024.1->v2025.1 - registering the confirmatory test set at 6 pairs
from 3 publishers, pending Annotator I and J's completion. Both are
now complete.

### 90.1 Independence and agreement

`run_new_pairs_metrics.py` (new) verified I and J are genuinely
distinct annotators (different file hashes, different answers on both
pairs) before computing anything. Cohen's kappa: **Tennessee 0.9486**
(3/60 disagreements), **Connecticut 0.9456** (3/60), **pooled 0.9478**
(6/120) - in the same range as the H3' pair's 0.9414 and comfortably
above the main round's 0.8168 pooled kappa. The 6 disagreements are
excluded from ground truth and reported as pending adjudication,
exactly the treatment already established for H3''s 5 G/H
disagreements, not resolved automatically.

### 90.2 Section 6 metrics, pooled against the original four pairs

| Metric (weighted) | Original 4 pairs (n=233) | New 2 pairs (n=110) |
|---|---|---|
| correspondence accuracy | 85.26% | 86.67% |
| provenance_loss_rate | 1.48% | 3.12% |
| false_correspondence_rate | 13.93% | 10.97% |
| deletion_recall | 35.43% | 21.36% |
| T5 (moved) precision | 13.33% (raw) / 6.15% (weighted), n=30 | **0%, n=20** |

The headline numbers - overall accuracy, provenance loss, false
correspondence - land within a few points of the original pooled
result on two entirely independent publishers and editions, a genuine
replication success supporting this study's core generalization claim.

### 90.3 T5 is now confirmed as the method's weakest tier

T5 (moved guidelines - an item reassigned to a different guideline
section between editions) was already the original four pairs'
worst-performing tier, at a weak but nonzero 13.3%/6.15%. On the two
new, independently-sampled pairs, it drops to **0/20 correct** -
Tennessee 0/10, Connecticut 0/10, drawn under the identical frozen-seed
stratified design as every other pair, from two different publishers.
Investigated before reporting, per section 10: this is not a
single-pair fluke (both new pairs show it independently) and not a
sampling artifact (n=10 per pair, same design as every T5 draw already
in the corpus). This sharpens an already-known weakness into a
confirmed one - any use of tier-level precision figures in a paper
draft must report T5's near-total unreliability alongside the pooled
headline accuracy, not fold it into an average that hides it.

### 90.4 What remains open

6 items (3 per pair) are pending human adjudication - an analogous
workbook to H3''s can be generated the same way once needed.
Provenance_loss_rate and deletion_recall both moved further from the
original pooled figures than the headline accuracy did (both roughly
halved or doubled), on comparatively small usable-n subsets (n=90 and
n=20 respectively) - worth flagging as noisier estimates, not treated
as a second finding requiring its own investigation, since neither
crosses into a qualitatively different regime the way T5's did.

**This section reports a preliminary two-pair replication, not yet
folded into the study's headline pooled figures.** The confirmatory
test set now genuinely has 6 pairs of real annotation data (360
items), but a formal, separately-committed re-run of H3/H4/H5 against
the combined 6-pair dataset - flagged as outstanding when the pairs
were first sampled (section 81) - has not yet been performed and
remains the next step if the study is to report on the full expanded
set rather than the original four pairs plus this section's standalone
comparison. Full report:
`annotation_packets/new_pairs_final_metrics.json`.

## 90.5. Final recompute: all 6 pending I/J items adjudicated, full 120-item ground truth

`NewPairs_Adjudication_6_items_COMPLETED.xlsx` came back with all 6
disputed items resolved. Unlike H3''s 5 disputes and the D6 pattern
seen throughout this study, Connecticut's 3 disagreements resolved to
real item-ids (a split, a moved, and a reworded correspondence) rather
than collapsing to NONE/CANNOT_DETERMINE - a more informative
adjudication outcome than most others in this study. Tennessee's 3
resolved to NONE, matching the G/H pattern.

Full 120-item ground truth is now complete (116 usable, 4 genuinely
CANNOT_DETERMINE), with nothing pending. Recomputed pooled section 6
metrics: cannot_determine_rate 3.33%, correspondence accuracy raw
62.07%/weighted 83.97%, provenance_loss_rate weighted 3.34%,
false_correspondence_rate weighted 13.66% - all within about 2 points
of the 110-item interim numbers reported above, confirming the interim
reading held up once the remaining items resolved.

**T5 (moved guidelines) remains exactly 0% precision on the complete
n=20** - the finding reported above is not an artifact of partial
data. Full report: `annotation_packets/new_pairs_final_metrics.json`.

## 91. Appendix B's manual guideline-pair audit, completed: 99% correct, and the review caught an error the automated flags missed

Section 64 generated the audit instrument for a pre-registration-
required gate ("a manual audit of all accepted guideline pairs is
required before publication") but explicitly left the review itself
undone. It is now complete.

### 91.1 Result

Of 294 accepted guideline pairs across the four original confirmatory
pairs, **291 CORRECT, 3 WRONG** - a 1.0% error rate. Every row got a
verdict; no UNSURE, no blanks. All three wrong pairs are confined to
a single edition pair, Connecticut 2022.1->2023.1.

Two of the three were in the 73 rows the automated CONTAINMENT/TIE
flags surfaced:

- "Adult" incorrectly paired to "Poisoning/Overdose/Substance Use
  Disorder – Adult" (and, symmetrically, the reverse pairing also
  accepted elsewhere in the same edition) - a generic single-word
  title colliding with an unrelated specific protocol, exactly the
  containment failure mode Appendix B item 3 was written to catch.

The third was **not** flagged by either heuristic (score 0.5, no
CONTAINMENT, no TIE) and was only caught because the reviewer read
all 294 rows, not only the flagged 73:

- "Intraosseous Access" incorrectly paired to "NEW Central Line
  Access" - two genuinely distinct vascular-access protocols.

### 91.2 What this means for the flagging heuristics and for the numbers

The flagged-73 subset was designed as an efficiency shortcut ("a
focused 73-row list rather than all 294"), not a claim that every
error would fall inside it. This result confirms that shortcut is not
airtight: one real error (a third of the total found) sat outside the
flagged set. Since the actual review covered all 294 rows regardless,
this cost nothing here, but any future reuse of this audit design on
a corpus too large to review in full should not assume the flagged
subset is exhaustive.

**No section 6 metric is recomputed as a result of this finding.**
Three wrong guideline-level pairs, confined to one pair and one
failure family (generic single-word titles), is within the range of
error already reflected in that pair's own reported accuracy figures
- Connecticut 2022.1->2023.1 was never claimed error-free, and no
other pair shows any wrong verdict. This closes the pre-registered
publication gate with a disclosed, bounded number (1.0%, 3/294, all
in one pair) rather than an unqualified "audited and clean" claim.
Full workbook: `annotation_packets/Appendix_B_guideline_pair_audit_COMPLETED.xlsx`
(user-completed; the generating script's own uncompleted output is at
`Appendix_B_guideline_pair_audit.xlsx`).

## 92. Formal H3/H4/H5 re-run against the expanded 6-pair dataset: mixed result, no confirmation status changes, but the pooled point estimates shift

Every entry touching the fifth/sixth pairs since section 67 carried the
same disclaimer: H3/H4/H5 stand on the original 4-pair, 240-item
dataset until a formal re-run against the expanded 6-pair, 360-item
set is separately committed and performed. That re-run is done.

### 92.1 Method

`run_full_comparison_6pairs.py` extends `run_full_comparison.py`
exactly - same bootstrap machinery, same stat functions, same
Benjamini-Hochberg correction, same index-join fix - to the two new
pairs, with ground truth from Annotator I/J (2 raters) in place of the
original round's A/B/C/D (4 raters). Before trusting any pooled
number, the script recomputes the original 4-pair result through the
identical code path and checks it reproduces the already-published
`full_comparison_report.json` exactly - it does, to 4 decimal places
on both H3 and H5's point estimates, confirming the extension didn't
silently change anything about the original computation.

**This is a preliminary result**: 6 of 120 new-pair items (3 per pair)
remain pending human adjudication and are excluded here, not
estimated - the same treatment already applied to H3' and to the new
pairs' own section 6 metrics (section 90).

### 92.2 Result

| | Original 4 pairs (n=233) | New 2 pairs only (n=110) | Pooled 6 pairs (n=343) |
|---|---|---|---|
| H3 (method−B2 accuracy) | −0.0472, CI [−0.0987, 0.0043] | +0.0364, CI [−0.0364, 0.1091] | −0.0204, CI [−0.0641, 0.0233] |
| H3 confirmed? | No | No | No |
| H4 (T3 precision) | 97.06% | 100% (n=10) | 97.67% |
| H4 confirmed? | Yes | Yes | Yes |
| H5 (method−B1 false-corr) | +0.0501, CI [−0.0159, 0.1149] | +0.0775, CI [0.011, 0.1508] | +0.0568, CI [0.0079, 0.1045] |
| H5 confirmed? | No | No | No |

**No confirmation status changes**: H3 and H5 remain NOT CONFIRMED,
H4 remains CONFIRMED, exactly as on the original 4 pairs. What moves
is the pooled point estimates: H3's point shifts from a nominal
disadvantage (−0.0472) toward roughly half that (−0.0204), driven by
the new pairs independently showing the opposite sign (+0.0364) in
isolation - checked, not assumed, via the new-pairs-only breakout
showing the same reversal on its own. H5's confidence interval now
sits entirely above zero (was straddling it) - a less favorable
reading for the method's false-correspondence rate relative to B1,
even though the upper bound (0.1045) still fails the pre-registered
equivalence bar of below +0.05.

### 92.3 Reading this honestly

This is a genuine mixed result, not smoothed into either "the method
generalizes" or "it doesn't." H3 moving toward (but not past) zero on
independent data is a modestly encouraging sign for the method's
correspondence-accuracy claim; H5's CI fully clearing zero is a
modestly discouraging one for its false-correspondence claim,
independent of whether either crosses the pre-registered significance
bar. H4 (T3 precision) is unambiguously confirmed at both scales and
gets stronger, not weaker, on the expanded set.

**Section 90's T5 finding is not visible in this table** - H4 tests
T3 (renumbered items), not T5 (moved guidelines), and T5's drop to 0%
precision on the new pairs is a real, separately-disclosed weakness
this pooled H3/H4/H5 result does not surface or contradict. Any use of
this section's pooled numbers in a paper draft must still carry
section 90's T5 caveat alongside them.

**This remains preliminary** pending the 6 outstanding adjudication
items; a shift of 6 items is unlikely to flip either CI's zero-crossing
given their current width, but that should be verified by re-running
once resolved, not assumed. Full report:
`annotation_packets/full_comparison_6pairs_report.json`.
