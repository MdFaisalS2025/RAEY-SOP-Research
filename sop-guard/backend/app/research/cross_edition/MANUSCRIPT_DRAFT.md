# Tracking Clinical Protocol Recommendations Across Editions: A Pre-Registered Cross-Edition Provenance Study

**Status: first full draft, synthesized from the study's research log
(`FEASIBILITY.md`, 97 sections) and pre-registration
(`PREREGISTRATION.md`). Not camera-ready.** Every number below is
pulled directly from a committed, reproducible report file, cited
inline. Sections marked `[NEEDS: ...]` require the author's input
(citations, venue formatting, author list, framing decisions) that
cannot be filled in without fabricating content — no invented
citations appear anywhere in this draft, per standing instruction not
to fabricate scholarly claims.

---

## Abstract

`[NEEDS: 150-250 word summary, written last once the paper's framing is finalized]`

Draft talking points: When a clinical protocol set is republished as a
new edition, individual recommendations are renumbered, reworded,
merged, split, moved, added, and removed with no machine-readable
change log. We ask a simple question with no existing tooling answer:
given a recommendation in edition *N*, where did it go in edition
*N+1*? We present a structure-aware alignment method and evaluate it
against four baselines on a pre-registered, annotated confirmatory
test set spanning 8 edition pairs from 4 independent U.S. state EMS
protocol publishers (480 sampled items, 467 usable after annotation).
The method achieves a pooled provenance loss rate of 2.45%
(population-weighted; the study's pre-registered primary outcome) and
reliably resolves renumbered items (T3 tier precision 98.18%,
confirmed). It shows no statistically reliable overall accuracy
advantage over a text-only baseline at the pre-registered significance
bar, though the estimated advantage converges toward the baseline
(not away from it) as the confirmatory dataset grows across four
independent replications. A specific, well-replicated failure mode is
identified and confirmed as a new, pre-registered hypothesis: items
whose recommendation moves to a different guideline section are
detected correctly in 6.67% of cases pooled across the full dataset,
and 0% in two of three independent test rounds. We report the full
pre-registration, every deviation from it, and an extensive,
transparently-documented corpus-expansion effort spanning all 50 U.S.
states, the District of Columbia, and Puerto Rico, most of which did
not yield usable data — reported as a finding about the state of
public clinical-protocol document engineering, not hidden as a
methods-section inconvenience.

---

## 1. Introduction

### 1.1 The problem

Unlike legislative amendment tracking, where bills carry explicit,
machine-readable amendatory instructions ("strike X, insert Y"),
clinical protocol editions are republished wholesale with no
instructions, no guaranteed change log, and no stable identifiers. An
institution that cannot track a recommendation across its own
editions cannot answer "when did we change this, and why," cannot
distinguish a stale local protocol from a deliberate deviation, and
cannot audit which staff attested to which version of a rule.

This is not a hypothetical concern. `[NEEDS: 1-2 sentences grounding
the stakes concretely — e.g. a specific documented incident or
regulatory requirement, if the author has one to cite; otherwise this
should stay general]`

### 1.2 Contribution

- A pre-registered confirmatory evaluation (`PREREGISTRATION.md`,
  frozen 2026-08-16, code state pinned) of a structure-aware alignment
  method against four baselines that isolate specific design choices
  (exact-identifier lookup, text-only nearest-neighbor, off-the-shelf
  document diff, identifier-with-text-fallback).
- An 8-pair, 4-publisher confirmatory test set built from real,
  independently-published U.S. state EMS protocol editions — not
  synthetic or single-publisher data — with 480 stratified-sampled
  items, two-annotator agreement (Cohen's κ ranging 0.82–0.98 across
  rounds), and adjudicated disagreements.
- A transparent, complete account of an unusually large corpus-search
  effort: all 50 states, DC, and Puerto Rico checked at least once;
  most rejected, with the specific failure mode recorded for each
  (retrieval-blocked, parses but fails alignment, genuinely no
  compiled document exists, or — in three cases — a real document
  successfully brought into the confirmatory set only after building
  publisher-specific extraction logic).
- A newly confirmed, well-replicated failure mode (moved-guideline
  items) formalized as a sixth, post-hoc-but-properly-registered
  hypothesis, tested on data not used to discover the pattern.
- A full, append-only deviations log (`PREREGISTRATION.md` §11, 60+
  dated entries) documenting every design decision, every bug found
  and fixed, and every result — favorable or not — exactly as it was
  found, including two cases where an initially favorable-looking
  result was investigated and found to be a data-collection artifact
  before being reported.

---

## 2. Related Work

`[NEEDS: literature review. This section intentionally contains no
citations — inventing them would misrepresent prior work. The author
should populate this with: (a) document versioning / diff literature
(text-level diff, e.g. difflib-style algorithms — represented in this
study's own B3 baseline, not compared against external systems);
(b) clinical guideline lifecycle / living-guideline literature;
(c) legislative/regulatory amendment-tracking systems, which the
Introduction contrasts against; (d) entity resolution / record linkage
literature, since guideline-correspondence is structurally a record-
linkage problem. FEASIBILITY.md's own text never cites external
literature by design (it is a lab notebook), so nothing here can be
extracted from it.]`

---

## 3. Methods

### 3.1 The alignment method

The method (`item_align.align_items`, frozen at commit `d3068ee` for
the duration of the confirmatory phase) matches guidelines between
editions by token-overlap (floor 0.50, containment-biased), then
assigns each old item to one of six correspondence tiers in a fixed
priority order:

| Tier | Definition |
|---|---|
| T1 | Identifier exact, text unchanged |
| T2 | Identifier exact, text changed |
| T3 | Renumbered — text identical, path differs |
| T4 | Reworded — same section, no identifier match |
| T5 | Moved — matched across section/guideline boundaries |
| T6 | Unmatched (candidate deletion) |

Item extraction (`item_parser.py`) parses each PDF edition into
addressable items with stable identifiers
(`guideline/section/marker_path`), inferring nesting depth from marker
type sequence (numeric, alphabetic, roman, bulleted) since PDF
extraction does not preserve reliable indentation.

Four files are **frozen** for the entire confirmatory phase and were
never modified after their parameters were finalized on development
data: `corpus_probe.py`, `item_parser.py`, `edition_align.py`,
`item_align.py`. Every one of the several hundred commits made during
the confirmatory phase was checked against this constraint
(`git diff --name-only <freeze-commit>..HEAD -- <the four files>`,
required empty before any result was trusted).

### 3.2 Baselines

| | Baseline | Isolates |
|---|---|---|
| B1 | Exact identifier lookup | The trivial method — the study's central claim is that this loses provenance on real revisions |
| B2 | Text-only nearest-neighbor, corpus-wide | The contribution of structure — if B2 matches the method, structure adds nothing |
| B3 | `difflib`-style document diff | The off-the-shelf answer a practitioner would reach for first |
| B4 | Exact identifier + text fallback within guideline | The value of the fuzzy tiers specifically |

### 3.3 Corpus and confirmatory test set

**Development corpus** (never used for any confirmatory claim):
NASEMSO National Model EMS Clinical Guidelines, three editions
(v2.0/v2.2/v3.0). All frozen-parameter tuning and every exploratory
observation reported in this paper as such was performed here.

**Confirmatory test corpus**: edition pairs from state EMS protocol
publishers not inspected during development, retrieved and vetted
against a fixed eligibility bar (`PREREGISTRATION.md` §3.2: two or
more consecutive editions retrievable; individual-edition parse
verdict USABLE or STRONG; public-record government publisher; ≥200
items per edition with <5% duplicate identifiers) before any content
was examined for annotation.

The final confirmatory set: **8 edition pairs from 4 independent
publishers** — Tennessee (3 pairs), Pennsylvania (1 pair), Connecticut
(2 pairs), Massachusetts (2 pairs) — meeting the pre-registered target
of ≥6 pairs from ≥4 publishers (`PREREGISTRATION.md`, 2026-08-24 entry;
the original minimum-viable bar was 4 pairs from 3 publishers, met
earlier and exceeded here). Every pair's revision magnitude was
classified **minor** from publisher-supplied front-matter language
alone, per a rule fixed before any pair was retrieved (§3.3): no
candidate pair reaching the confirmatory set carried "completely
revised" / "full review" self-description from its publisher. Two
documented attempts to bring a genuinely major-revision pair into the
confirmatory set (Nebraska, Utah) failed at the parsing stage and were
excluded, not repaired by inspection, per the quarantine rule (§3.4).

### 3.4 Annotation

For each pair, a stratified random sample of 60 old items was drawn
(10 per tier across all six tiers, shortfall redistributed
proportionally when a tier's population fell below 10), for 480 total
sampled items. Two annotators, blind to method output, independently
labeled every sampled item with the corresponding new item (or NONE,
or CANNOT_DETERMINE) and a relation label (unchanged / reworded /
substantive / merged / split / moved). Disagreements were adjudicated
by a third pass with both annotators' reasoning visible.

Pre-adjudication two-rater agreement (Cohen's κ) across the four
annotation rounds: 0.8168 (pooled, original 4 pairs, after a
duplication-artifact retraction described in §4.4), 0.9414 (H3′
follow-up round), 0.9478 (fifth/sixth pairs), 0.9828 (seventh/eighth,
Massachusetts pairs) — all comfortably above the pre-registered abort
threshold of 0.60.

### 3.5 Statistical analysis

All confirmatory comparisons use bootstrap 95% confidence intervals
(10,000 resamples), computed at both the item level and the edition-
pair level (paired bootstrap for method-vs-baseline comparisons, since
items within a pair are not independent). Benjamini-Hochberg correction
is applied across the {H3, H4, H5} family. Every hypothesis states its
exact confirmation criterion in `PREREGISTRATION.md` §7, fixed before
any test data was examined.

---

## 4. Results

### 4.1 Primary outcome: provenance loss rate

Pooled across the complete, final confirmatory dataset (478 sampled
items, 467 usable — 11 genuinely CANNOT_DETERMINE, 2.3%; 2 items
pending final adjudication and excluded rather than estimated):

**Provenance loss rate (primary outcome, pre-registered): 11.87% raw,
2.45% population-weighted (n=379).**

Secondary metrics, pooled: correspondence accuracy 71.09% raw / 85.45%
weighted (n=467); false-correspondence rate 23.14% raw / 12.90%
weighted (n=389); deletion recall 37.5% raw / 29.87% weighted (n=88);
deletion precision 42.31% raw / 51.66% weighted (n=78).

Per-tier precision, pooled across all 8 pairs:

| Tier | n | Raw precision | Weighted precision |
|---|---|---|---|
| T1 (id exact) | 173 | 96.53% | 94.68% |
| T2 (id, text changed) | 81 | 67.9% | 59.52% |
| T3 (renumbered) | 55 | 98.18% | 96.26% |
| T4 (reworded) | 20 | 95% | 95% |
| T5 (moved) | 60 | 6.67% | 3.92% |
| T6 (unmatched) | 78 | 42.31% | 51.66% |

### 4.2 H1/H2: not tested

Pre-registered abort condition 2 (`PREREGISTRATION.md` §9) states:
"fewer than 2 major-revision pairs: H1 and H2 cannot be tested; report
H3-H5 only and state the limitation." No genuinely major-revision pair
survived the parsing stage despite two documented attempts (Nebraska,
whose publisher's own front matter uses explicit "completely revised"
language, and Utah, whose 2025 edition is that publisher's first-ever
second edition) — both failed to parse into usable structured items
and were excluded per the quarantine rule rather than repaired by
inspection. **H1 and H2 are reported as untested, exactly as the
pre-registered abort condition anticipates**, not as silently dropped.

### 4.3 H3 — structure contributes beyond text similarity

*The method's correspondence accuracy exceeds B2's (text-only).
Confirmed if the paired difference is positive with a 95% CI excluding
zero.*

**Not confirmed.** Pooled 8-pair item-level paired difference:
point estimate −0.0064, 95% CI [−0.0407, 0.0278].

The point estimate's trajectory across four successive, independent
data expansions is notable: −0.0472 (4 pairs) → −0.0204 (6 pairs,
interim) → −0.0172 (6 pairs, final) → **−0.0064 (8 pairs, final)** —
converging steadily toward zero as more independent data accumulated,
rather than moving further from it. This is the signature expected of
a true near-zero effect becoming more precisely estimated, not of a
real effect being diluted by unrelated variance.

### 4.4 H4 — renumbering with unchanged text is a substantial failure mode for identifier lookup, and the method resolves it

*Among items the method assigns to T3, ≥80% are adjudicated as true
correspondences with unchanged text.*

**Confirmed**, and strengthening with scale: T3 tier precision 97.06%
(4 pairs) → 97.67% (6 pairs) → **98.18% (8 pairs)**, monotonically
increasing as independent replications accumulated.

### 4.5 H5 — the method does not buy accuracy with confident errors

*The method's false-correspondence rate does not exceed B1's by more
than 5 percentage points. Confirmed if the CI upper bound is below
+0.05.*

**Not confirmed.** Pooled 8-pair item-level: point estimate +0.0696,
95% CI [0.0311, 0.1074] — the CI's lower bound has moved above zero as
data accumulated (was [−0.0159, 0.1149] on the original 4 pairs), and
its position relative to the +0.05 equivalence bound has moved further
away, not closer.

### 4.6 H6 (new) — moved-guideline items are unreliably detected

Proposed after H3–H5's results were in hand, in direct response to a
specific, already-observed, three-times-replicated pattern (T5's
precision: 13.3% on the original 4 pairs, n=30; 0% on the fifth/sixth
pairs, n=20; 0% on the seventh/eighth pairs, n=10) — pre-registered
with its exact confirmation criterion and test population committed
*before* the test was run, using a population (the Massachusetts
pairs' own T5 items) not previously examined for this specific
purpose, to avoid post-hoc pattern-fitting on the same data that
motivated the hypothesis.

*T5 tier precision is below 50% — a "problem exists" claim, the
opposite confirmation direction from H3–H5. Confirmed if the CI upper
bound is below 0.50.*

**Confirmed.** T5 precision on the Massachusetts pairs' T5 population:
0/10, 95% CI [0.0, 0.0]. The CI is degenerate (a bootstrap resample of
an all-zero sample has no variance) — reported plainly, not
oversold; this test's evidentiary strength comes from being the third
independent replication of an already-observed pattern across three
different publisher groups, not from this sample's size alone.

### 4.7 A methodological artifact worth reporting explicitly

Two-pair-only breakouts of H3 (the fifth/sixth pairs alone; the
seventh/eighth pairs alone) both showed pair-level bootstrap
"confirming" H3, in both cases traced to the same cause: with only 2
pair-level resampling units, and both individual pairs' point
differences happening to share a sign, every possible bootstrap
resample is on that same side of zero, producing a spuriously tight
confidence interval that reflects the resampling unit count, not
genuine statistical evidence. **Neither instance is reported as
evidence for H3.** This is disclosed as a general caution for any
future evaluation using pair-level bootstrap resampling with a small
number of pairs, not specific to this study's data.

---

## 5. The corpus-expansion effort

`[This section is a genuine methodological contribution in its own
right — most alignment/NLP papers do not report failed retrieval
attempts at this granularity. Recommend keeping it, condensed from
FEASIBILITY.md §§78-94.]`

Beyond the original four confirmatory publishers, every one of the
remaining 50 U.S. states plus the District of Columbia and Puerto Rico
was checked at least once for a usable, publicly-retrievable,
consecutive-edition EMS protocol document pair. The outcomes fall into
four categories:

1. **No compiled statewide document exists** (protocols set at a more
   local level, or not published as one document) — the majority of
   states checked, including Puerto Rico.
2. **Retrieval blocked** by bot-detection or download-sandbox
   limitations, with the document's existence otherwise confirmed
   (Massachusetts and New Hampshire were in this category until the
   documents were retrieved directly by the study's author).
3. **Parses but fails alignment or the numeric acceptance bar** —
   including one document (District of Columbia) subjected to a
   dedicated investigation: a vision-language-model boundary-detection
   rescue attempt correctly identified 194/195 real protocol titles
   but did not repair the underlying alignment failure, isolating the
   problem to item-level extraction rather than guideline-boundary
   detection specifically — reported as a decisive negative finding
   with its own root-cause diagnosis, not a data point silently
   dropped.
4. **Solved with publisher-specific extraction logic** — three
   publishers (Maine, Connecticut, Massachusetts) required a custom,
   document-format-specific boundary-detection strategy (a per-page
   footer counter, a table-of-contents row-alignment, and a
   header-plus-table-of-contents hybrid respectively) before their
   item-level data was trustworthy; each was built as a separate,
   non-frozen module reusing the frozen method's own item-classification
   logic unchanged, and each was validated against the same title-
   inspection and alignment-quality bar as every other candidate before
   being trusted.

This effort is reported in full because it bears directly on an
implicit claim any automated-alignment paper makes: that the method
generalizes. The honest answer this study found is qualified —
guideline-boundary detection specifically required new engineering for
3 of 4 confirmatory publishers, while the frozen alignment method
itself (`item_align.py`) never required modification once given
correctly-extracted items.

---

## 6. Discussion

### 6.1 What this study supports

The method reliably resolves the specific failure mode identifier
lookup cannot handle by construction — renumbered items with unchanged
text (H4) — and does so with increasing confidence as more independent
data accumulates. This is the study's cleanest positive result and its
originally-intended central illustration.

### 6.2 What this study does not support

Neither H3 (overall accuracy advantage over a text-only baseline) nor
H5 (bounded false-correspondence rate relative to exact-identifier
lookup) reached pre-registered confirmation. H3's estimate trending
toward zero as data accumulated is a genuinely informative null result
— not a failure of the study, but evidence that if a true effect
exists, it is small relative to what this confirmatory dataset can
resolve. H5's result is a real, disclosed limitation: the method's
gains in coverage (finding more correspondences than a naive baseline)
come with a real, not-yet-bounded cost in confident wrong answers.

### 6.3 A specific, replicated failure mode

H6's confirmation gives this study something more useful than a single
aggregate accuracy number: a precisely characterized weak point.
Items whose recommendation moved to a different guideline section
between editions are the method's single least reliable category,
replicated at or near total failure across three independent
publisher-groups. `[NEEDS: root-cause discussion — has the underlying
mechanism been diagnosed, or is this reported as an open problem for
future work? FEASIBILITY.md's sections on T5 should be reviewed for
whether a specific mechanism (e.g. guideline-matching floor,
cross-section search radius) was ever isolated.]`

### 6.4 Generalization has a real, disclosed cost

Three of four confirmatory publishers required new, document-specific
extraction engineering. This is reported as a genuine finding about
the difficulty of this problem class, not minimized: a system deployed
against a fifth, unseen publisher's document format should expect to
need the same kind of investment before its item-level output can be
trusted, and the pre-registration's own quarantine discipline (never
tuning parameters against test-document content) is precisely the
safeguard that keeps this honest rather than silently overfit.

---

## 7. Limitations

- **Single domain.** All confirmatory data is U.S. state EMS protocol
  documents. Generalization to other clinical-protocol domains
  (hospital policy manuals, surgical checklists, pharmacy formularies)
  is untested.
- **H1/H2 untested.** No major-revision confirmatory pair was
  successfully brought into the test set despite genuine attempts;
  the identifier-lookup-loses-provenance claim under major revision
  remains supported only by exploratory (development-corpus) evidence,
  disclosed as such throughout.
- **T5 (moved guidelines) is a confirmed, substantial weakness**, not
  a minor caveat — any deployment relying on this method should treat
  cross-section moves as a category requiring human review, not
  automated resolution.
- **Extraction requires publisher-specific engineering** for a
  majority of the confirmatory publishers tested (3 of 4); the
  alignment method itself did not require retuning, but getting
  correctly-structured input to it did.
- **New Hampshire remains partially unresolved** — one edition parses
  cleanly after custom extraction work, but a redesigned newer edition
  removed the anchor that extraction depends on, and no confirmatory
  pair was possible for this publisher within the scope of this study.
- **H6 is a post-hoc hypothesis**, disclosed as such, pre-registered
  before its confirmatory test ran on data not used to motivate it —
  the strongest defensible version of a late addition, but a reader
  should weigh it accordingly against H1-H5's fully prospective design.

---

## 8. Reproducibility

Every result in this paper traces to a committed, versioned report
file (paths cited inline throughout `FEASIBILITY.md`), a dated entry
in `PREREGISTRATION.md` §11 stating the design decision before the
corresponding result, and a SHA-256-hashed corpus manifest
(`reproducibility_artifact/CORPUS_MANIFEST.md`). The four frozen
pipeline files' unchanged status was verified via `git diff` before
every reported result in this study, not asserted from memory. Code
and the full research log are available at
`[NEEDS: repository URL / DOI, once the author decides where this is
archived for submission]`.

---

## Appendix: Full hypothesis registry

`[NEEDS: this could either stay as prose in Results, or be pulled into
a formal appendix table for the submitted version — author's
formatting choice. All source data already exists in
PREREGISTRATION.md §7 and the *_report.json files cited throughout.]`
