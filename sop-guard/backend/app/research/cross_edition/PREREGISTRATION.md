# Pre-registration: cross-edition provenance for revised clinical protocols

**Status:** frozen on registration. Nothing above §11 may be edited afterwards;
changes are appended to §11 as dated entries.

**Registered:** 2026-08-16
**Registration tag:** `prereg-crossedition-v1`
**Registered by:** Mohamed Faisal Sindhi (sindhi@usf.edu, GitHub `MdFaisalS2025`)
**Code state at registration:** `2ea8ba28b99464add9964481c762799f70389d7c`
*(historical fact — not updated. Code has since changed; every change is logged
in §11 and the current state is recorded on the line below, which IS updated.
Keeping the registration SHA fixed and tracking drift separately is deliberate:
silently re-pinning would erase the evidence that anything moved.)*

**Current code state:** `d3068ee` — update this line, and add a §11 entry, on
every change to `app/research/cross_edition/*.py` before the test run.
(commit "Fix cross-edition title matching: 72.6% -> 95.2%, decision experiment
settles" — pins `corpus_probe.py`, `item_parser.py`, `edition_align.py`,
`item_align.py` and `FEASIBILITY.md`, i.e. every frozen parameter in §4.3)

**Dev corpus at registration:** NASEMSO National Model EMS Clinical Guidelines
v2.0 (Oct 2017), v2.2 (Jan 2019), v3.0 (Mar 2022). Retrieved via the Baylor
College of Medicine mirror and the Wayback CDX index; provenance recorded in
`FEASIBILITY.md` §2. **No test document has been retrieved or inspected at the
time of registration.**

**Relationship to the anchoring study.** This is a **separate study**.
`prereg-anchoring-v1` and `-v2` cover the paraphrase-anchoring work and do not
cover anything here; they are neither superseded nor extended. The anchoring
study's H2 mechanism claim was disconfirmed on dev (see
`real_corpus/PREREGISTRATION.md` §12 and the H6 probe), and that outcome has no
bearing on this study, which shares only a corpus discipline and a codebase.

---

## 1. The question

When a clinical protocol set is republished as a new edition, individual
recommendations are renumbered, reworded, merged, split, moved between sections,
added and removed. Given a recommendation in edition *N*, **where did it go in
edition *N+1*?**

Unlike legislative amendment tracking — where bills carry explicit machine-
readable amendatory instructions ("strike X, insert Y") — protocol editions are
republished wholesale with no instructions, no guaranteed change log, and no
stable identifiers. The correspondence must be recovered from content and
structure alone.

**Why it matters beyond document engineering:** an institution that cannot track
a recommendation across its own editions cannot answer "when did we change this,
and why", cannot tell a stale local protocol from a deliberate deviation, and
cannot audit which staff attested to which version of a rule.

---

## 2. Background: what has already been observed

**Everything in this section is EXPLORATORY.** It was measured on the NASEMSO
corpus, it generated the hypotheses below, and it is reported as exploratory in
any resulting paper. Recorded here so a reader can see exactly which
observations produced the hypotheses and therefore which data cannot test them.

Corpus: NASEMSO National Model EMS Clinical Guidelines, three editions —
v2.0 (Oct 2017, 371 pp), v2.2 (Jan 2019, 372 pp), v3.0 (Mar 2022, 407 pp).
Parsed by `item_parser.py` into 4,745 / 4,567 / 5,047 addressable items across
69 guidelines each.

| | minor bump<br>v2.0→v2.2 | major bump<br>v2.2→v3.0 |
|---|---|---|
| T1 identifier exact, text unchanged | 89.9% | 35.0% |
| T2 identifier exact, text changed | 2.0% | 21.3% |
| T3 renumbered (text identical, path differs) | 1.0% | **12.3%** |
| T4 reworded (same section, no id match) | 0.0% | 4.6% |
| T5 moved (matched across section/guideline) | 2.7% | 5.7% |
| T6 unmatched | 4.5% | 21.1% |
| **Trivially alignable (T1+T2)** | **91.9%** | **56.3%** |
| **Requires more than an identifier (T3–T5)** | **3.6%** | **22.6%** |

Also observed, and load-bearing for the design below:

1. **Per-guideline `Revision Date` fields do not track content change.** Zero
   guidelines had differing dates while 59 changed content (agreement 1.7%).
   **There are no free change labels**; annotation must be budgeted in full.
2. **Guideline titles change between editions** (`Crush Injury` →
   `Crush Injury/Crush Syndrome`), so exact title matching is wrong on the
   merits, not merely imprecise. Token-overlap matching reaches 95.2% (59/62).
3. **Three results in this line of work were initially wrong** because of parser
   artefacts that happened to flatter the study (see `FEASIBILITY.md` §7.1, §8.2).
   Each was caught by disbelieving a convenient number. §10 encodes that as a
   standing rule rather than a habit.

---

## 3. Corpus and split protocol

### 3.1 The NASEMSO corpus is contaminated and is assigned entirely to dev

All three NASEMSO editions produced every observation in §2. They are
**development data**. No confirmatory claim may rest on them.

### 3.2 Test corpus

The test set consists of **edition pairs from protocol sets not yet retrieved
and never inspected**, drawn from a different publisher level than NASEMSO —
state and regional EMS protocol sets (Massachusetts, New York, Connecticut,
Maryland, Georgia, Pennsylvania and comparable), which are *institutional
adaptations* rather than national model guidance.

Eligibility, fixed now:

1. Two or more consecutive published editions are retrievable, including via the
   Wayback CDX index.
2. `corpus_probe.py` returns verdict **USABLE** or **STRONG** on both editions.
3. The publisher is a US government body, so the documents are public records.
   Licensing terms are recorded per source in a provenance header.
4. Each edition parses to ≥ 200 items with < 5% duplicate identifiers.

**Target:** ≥ 6 edition pairs from ≥ 4 distinct publishers. **Minimum viable:**
4 pairs from 3 publishers (below this, see §9).

### 3.3 Revision-magnitude classification — declared before retrieval

Each pair is labelled **minor** or **major** from *publisher metadata only*,
never from measured change:

- **major** — the leading version component increments (2.x → 3.0), or the
  publisher describes it as a full review/revision.
- **minor** — any other increment.

Pairs whose magnitude cannot be determined from publisher metadata are
**excluded**, not guessed. This label is fixed at retrieval time and recorded in
`split_assignment.json` before any alignment is run.

### 3.4 Quarantine

Test documents are not inspected beyond what retrieval and parsing require. No
threshold, regex, matcher parameter or tier definition may be modified in
response to anything observed in a test document. A test document that fails to
parse is **dropped and recorded** (§11), never repaired by inspection.

---

## 4. Methods under evaluation

### 4.1 The method

`item_align.align_items`: guideline correspondence by token-overlap matching
(floor 0.5, containment-biased), then per-item assignment to tiers T1–T6 in the
order defined in `item_align.py`.

### 4.2 Baselines

| # | Baseline | What it isolates |
|---|---|---|
| B1 | **Exact identifier lookup** — match iff `guideline/section/marker_path` is identical | The trivial method. The study's central claim is that this loses provenance on real revisions. |
| B2 | **Text-only nearest neighbour** — match each old item to its highest token-overlap new item corpus-wide, ignoring structure | Isolates the contribution of structure. If B2 matches B0, structure adds nothing. |
| B3 | **`difflib` document diff** — sequence-align the two canonical texts, map items by overlap | The off-the-shelf answer a practitioner would reach for first. |
| B4 | **Exact identifier + text fallback** — B1, then exact-text match within guideline | Isolates the value of the *fuzzy* tiers specifically. |

### 4.3 Frozen parameters

| Parameter | Value |
|---|---|
| Guideline title overlap floor | `0.50`, containment-biased |
| T4 rewording similarity floor | `0.75` token Jaccard |
| T5 moved minimum text length | 25 characters |
| Running-header detection | line recurs on ≥ 50% of pages, ≤ 70 chars |
| Category detection | candidate line recurs above ≥ 3 guidelines |

All were set on dev and are **frozen**. They may not be retuned on test.

---

## 5. Ground truth

There are no free labels (§2 item 1). Ground truth is **annotated**.

### 5.1 Sampling

From each test edition pair, draw a **stratified random sample of 60 old
items**, **10 items per tier across all six tiers (T1–T6)**. T6 is included
in the flat per-tier allocation, not treated as a residual — deletion
recall/precision (§6) cannot be computed without T6 samples, so T6 must be
represented by design, not by leftover shortfall. Where a tier's population
is below 10, the shortfall is redistributed proportionally across the
remaining tiers' *undrawn* population, so the total stays at 60. Stratifying
by predicted tier oversamples rare tiers deliberately; all reported rates are
**reweighted to the population** and the weights are recorded.

*(Corrected 2026-08-17 from an internally inconsistent original: "12 per
tier T1–T5" is 60 only if T6 is excluded from the flat allocation, which
contradicts §6 naming T6-dependent metrics as primary. See §11.)*

Target **≥ 360 annotated items** across ≥ 6 pairs.

### 5.2 Annotation task

For each sampled old item, the annotator sees the item in context and the whole
corresponding new-edition guideline, and records:

- **the corresponding new item**, or **NONE (deleted)**, or **CANNOT DETERMINE**;
- a **relation label**: unchanged / reworded only / substantively changed /
  merged / split / moved.

`CANNOT DETERMINE` is a first-class option. Its rate is reported, not minimised.

### 5.3 Annotators and agreement

Two annotators independently label **all** sampled items; disagreements are
adjudicated by discussion and the pre-adjudication **Cohen's κ is reported**.
Annotators must not have seen any method output for the item they are labelling.
No clinical expertise is required: the judgement is "is this the same
recommendation", a document-correspondence judgement, and the claim is scoped to
that.

---

## 6. Metrics

| Metric | Definition |
|---|---|
| **Correspondence accuracy** | fraction of annotated items where the method's answer (item or NONE) equals the adjudicated answer |
| **Provenance loss rate** | **primary.** Fraction of items with a true correspondence that a method reports as deleted-plus-inserted. This is the harm the study is about. |
| False-correspondence rate | of non-NONE answers, fraction pointing at the wrong new item. A confident wrong link is worse than an admitted unknown. |
| Deletion recall / precision | on truly deleted items |
| Tier precision | per assigned tier, fraction correct |
| `CANNOT DETERMINE` rate | annotation-side, reported per pair |

**Primary outcome: provenance loss rate.** Everything else is secondary.

---

## 7. Hypotheses

Tested on test data only. Each states what confirms and what disconfirms it.

### H1 — Identifier lookup loses provenance on major revisions
On **major** test pairs, B1's provenance loss rate exceeds **10%**.

- **Confirmed if** the point estimate exceeds 0.10 with a bootstrap 95% CI whose
  lower bound also exceeds 0.10.
- **Disconfirmed if** the CI includes or falls below 0.10. *Then identifier
  lookup is adequate in practice and the method contribution collapses; report
  it and reframe as a resource paper.*

### H2 — The loss is revision-magnitude dependent
B1's provenance loss rate is higher on **major** pairs than on **minor** pairs.

- **Confirmed if** the difference is positive with a bootstrap 95% CI excluding
  zero.
- **Disconfirmed if** the CI includes zero. *Then the §2 contrast (22.6% vs
  3.6%) was corpus-specific and must be reported as such.*

### H3 — Structure contributes beyond text similarity
The method's correspondence accuracy exceeds B2's (text-only).

- **Confirmed if** the paired difference is positive with a 95% CI excluding zero.
- **Disconfirmed if** not. *Then structure is decorative, the method reduces to
  text matching, and the paper must say so.*

### H4 — Renumbering with unchanged text is a substantial failure mode
Among items the method assigns to T3, ≥ 80% are adjudicated as true
correspondences with unchanged text.

- **Confirmed if** tier precision for T3 ≥ 0.80.
- **Disconfirmed if** below. *T3 is the paper's cleanest illustration; if it is
  imprecise, that illustration is withdrawn.*

### H5 — The method does not buy accuracy with confident errors
The method's false-correspondence rate does not exceed B1's by more than 5
percentage points.

- **Confirmed if** the CI on the difference has an upper bound below +0.05.
- **Disconfirmed if** above. *A method that finds more links by guessing is not
  an improvement, and H1–H4 would be reported alongside that finding rather than
  as a success.*

**H5 exists because H1–H4 can all be satisfied by a method that guesses more
aggressively.** It is registered to make that failure visible.

---

## 8. Analysis plan

1. **One evaluation run on test data.** Artifacts timestamped; frozen parameters
   verified against §4.3 before results are read.
2. **Uncertainty:** bootstrap 95% CIs, 10,000 resamples, resampled **at the
   edition-pair level**, since items within a pair are not independent.
3. **Method-vs-baseline comparisons** use paired bootstrap over the same pair
   resamples.
4. **Multiplicity:** Benjamini–Hochberg across the H1–H5 family.
5. **Dev results reported separately and labelled exploratory** in every table.
   Any dev/test gap is reported and discussed.
6. **Stratification weights** are reported alongside every population estimate.

### 8.1 Power

With ≥ 6 pairs and ≥ 360 annotated items, and pair-level bootstrap, the binding
constraint is the **number of pairs, not items**. With 6 pairs the CI on a
between-group contrast (H2) is wide; H2 is therefore registered as **secondary**
and will be reported with its CI rather than as a decisive test. H1, H3, H4 and
H5 are within-condition and adequately powered at this sample.

---

## 9. Abort conditions

1. **Fewer than 4 qualifying edition pairs from 3 publishers.** Halt; report the
   NASEMSO work as an exploratory corpus study rather than reporting an
   underpowered confirmatory result.
2. **Fewer than 2 major-revision pairs.** H1 and H2 cannot be tested; report H3–H5
   only and state the limitation.
3. **Annotator κ < 0.60** on the correspondence judgement. The construct is not
   reliably measurable as defined; halt, refine the annotation guideline, and
   re-register before annotating further.
4. **`CANNOT DETERMINE` exceeds 25%** of sampled items. The task is not
   answerable from documents alone at this rate; report that as the finding.
5. **Test contamination** (§3.4). Affected pairs are discarded; if contamination
   cannot be isolated, the confirmatory claim is withdrawn and everything is
   reported as exploratory.

---

## 10. Standing rule on convenient results

Three results in this line of work were initially wrong in the study's favour,
each traced to a parser artefact rather than a finding (`FEASIBILITY.md` §7.1,
§8.2; the anchoring study's H6 probe). Accordingly:

**Any test result that materially favours a hypothesis must be checked by
inspecting intermediate output before it is reported.** At minimum: sample 20
method-assigned correspondences by hand, and confirm the result moves in the
direction a correct fix would move it. This check is mandatory, and the fact
that it was performed is recorded in the paper.

---

## 11. Deviations

Every departure is appended here with a date and reason. Nothing above is edited
after registration.

| Date | Deviation | Reason | Effect on interpretation |
|---|---|---|---|
| 2026-08-16 | **Two further code changes, previously unlogged.** (a) `unmatched_probe.py` added, decomposing the T6 tail; two errors in the decomposition itself corrected (U3 scored against consumed candidates; U5 counted items with plausible distant counterparts as deletions). Defensible deletion 6.0%→**2.5%** of old items. (b) Position-aware title length guard in `item_parser._title_before`, recovering two guidelines whose titles exceed 70 characters. Guideline match 95.2%→**98.4%**; "requires more than an identifier" 10.9%→**10.2%**. Code state moves `2ea8ba2` → `b85b050` → `6990776`. | Both are defect repairs to the measurement apparatus, found by applying §10's standing rule. Neither alters a hypothesis, metric, threshold, split rule or baseline. | **No confirmatory claim is affected — no test document exists.** But recorded here because the header's pinned SHA had drifted from the code that would actually run, and an unlogged drift defeats the purpose of pinning it. **A further consequence must be stated: the dev estimate for H1's quantity has now moved 22.6% → 10.9% → 10.2% across three corrections, against a threshold of 10%. H1 is marginal and may well be disconfirmed.** The threshold remains unrevised. See also `FEASIBILITY.md` §11.3: the earlier claim that this figure was a lower bound was **wrong**, and recovery can move it in either direction. |
| 2026-08-16 | **Three more code changes, previously unlogged: cross-publisher generalisation, then a bug it introduced, then the fix.** (a) Empirical guideline-anchor and boilerplate detection added, extending the corpus from 1 to 2 publishers (NASEMSO + New York). (b) `detect_section_names`, added for the same purpose, admitted ~55 spurious "sections" scraped from what appears to be a table of contents, corrupting T4/T5 on the major NASEMSO pair (10.2%→19.2% on a re-run of the same pair). (c) Fixed with a three-part filter — count and spacing relative to the document's own known anchor, plus date-line exclusion. Dev numbers recomputed on all four pairs; see `FEASIBILITY.md` §12–§14 for the full account. Code state moves `6990776` → `2f0e44e` → `83377e7`. | (a) is the retrieval-generalisation work the study's own design requires (§3.2, ≥4 publishers). (b) is a defect introduced by (a) and repaired under §10's standing rule — caught because a recompute that was expected to be routine produced a number too large to trust on sight. | **No confirmatory claim is affected — no test document exists.** Two things ARE affected. First, `FEASIBILITY.md` §14.3 identifies that a substantial share of NY Collaborative's "needs more than an identifier" figure (39.3%) and the major NASEMSO pair's U1 tail component are inflated by **unresolved guideline titles**, not genuine matching difficulty — the same class of defect §11 fixed for two NASEMSO titles, not yet fixed for New York. These numbers must not be quoted without that caveat. Second, and reassuringly: **U5 (defensible deletion) held at 2.5% of old items across this entire rewrite of the matching pipeline** — a real stability check, not a coincidence, since nothing about the deletion estimate depends on section-name discovery. |
| 2026-08-17 | **New York guideline title extraction fixed** — a pattern-based scope-line skip (audience-specific "Applies to … patients" wordings, previously only caught at exact-string frequency ≥ 20) and a bounded 3-line skip past non-title junk before any title text is collected. Fixes 5 of 7 NY Collaborative untitled guidelines; 2 remain and are not extraction bugs (front matter; a genuinely ambiguous nested "criteria" block). NASEMSO unaffected (68/69 titled, unchanged). Dev numbers recomputed: NY Collaborative "needs more than an ID" 39.3%→36.8%, NY BLS 8.4%→4.2%. Code state `83377e7`→`60c9994`. | Requested follow-up to the `86af03` deviation entry, which had flagged NY Collaborative's 39.3% as substantially inflated by unresolved titles and identified this as the next fix. | No confirmatory claim affected — no test document exists. NY BLS's improvement is clean and attributable to the fix. **NY Collaborative's improvement is only partial (39.3%→36.8%), and this is reported rather than smoothed over: most of its remaining difficulty is not extraction debt.** `FEASIBILITY.md` §15.3 states plainly that NY Collaborative should be read as more trustworthy than before but not yet as clean as NASEMSO or NY BLS — a caveat that must travel with the number in any future use, including §3.2's ≥4-publisher requirement. |
| 2026-08-17 | **Connecticut and Maine retrieved: publisher count now 4/4 per §3.2, item-level parsing does not generalise to either.** Both have real consecutive editions, real text layers, and pass `corpus_probe` triage (Maine STRONG, Connecticut USABLE). Both fail title inspection: auto-detection chose implausible anchors for each (`normal` for Maine, giving vital-signs table headings as "titles" and 19 guidelines for a 200+ page manual; `indications` for Connecticut, giving 571 items across 284 pages). Maine's real per-protocol signal is a running footer (`<name> #<page>`), not yet implemented. Connecticut's content is fundamentally tabular (dosing/triage tables), which the current line-stream parser cannot represent at all — a different extraction model is needed, not a threshold fix. Code state `60c9994`→`bc2e2d0`. | Requested retrieval of two more publishers to satisfy §3.2's numeric requirement. §13.1's own standing instruction — inspect titles by hand before a publisher enters the corpus — was followed, and both failed the inspection rather than being assumed to work from a plausible-looking guideline count. | **§3.2 is satisfied numerically (4 publishers) but not in substance for 2 of the 4.** Connecticut and Maine item-level output **must not be used** for annotation sampling (§5), tier statistics, or any confirmatory analysis until this entry is superseded by a dated update recording real, inspected titles for both. NASEMSO and New York remain the only publishers whose item-level data may currently be used, which is fewer than §3.2 requires — the ≥4-publisher condition is not yet actually met for study purposes, only for document count. See `FEASIBILITY.md` §16. |
| 2026-08-17 | **Maine footer-based guideline detection implemented, gated to fire only when no known section-style anchor exists.** `#1` in Maine's running per-protocol footer verified as a unique per-protocol marker (45 occurrences, zero duplicates, min spacing 38 lines) before being relied on. Maine 2023/2025 now yield 39/42 guidelines, all titled with real protocol names (`Adult Cardiac Arrest`, `Stroke`, …), against 19 guidelines of table-value garbage before. Zero footer/colour-tag contamination in 1,720 items. NASEMSO and New York item counts are **byte-identical** to before this change — the gate (fires only when `_known_anchor_stats` finds neither known anchor) makes regression structurally impossible for them, not merely untested. Maine 2023→2025 edition-pair alignment: 89.1% trivially alignable, in the same range as NASEMSO minor and NY BLS. Code state `bc2e2d0`→`4148732`. | Requested implementation of the footer-based detection diagnosed but not built in the prior entry, to close the gap between §3.2's publisher-count requirement and usable item-level data. | **No confirmatory claim affected — no test document exists.** `FEASIBILITY.md` §17.4 updates the publisher-usability table: **Maine moves from not-usable to usable**, so 3 of 4 retrieved publishers now have trustworthy item-level data (NASEMSO, New York with the §15.3 caveat, Maine). Connecticut remains unusable — it needs table-aware extraction, a different and larger problem, not addressed here. §3.2's ≥4-usable-publisher requirement is therefore still not fully met; either Connecticut must be fixed or a fifth publisher substituted before the confirmatory test set can be assembled. One further scope note for future readers: Maine items are extracted at a single flat section level (`"protocol"`) rather than sub-sectioned by certification level, a stated, deliberate simplification — not a defect, but relevant if any future analysis wants section-level structure for Maine specifically. |
| 2026-08-17 | **Connecticut table extraction fixed via embedded Table-of-Contents row-alignment — a fourth distinct detection strategy alongside NASEMSO's fixed section label, New York's shared strategy, and Maine's per-page footer counter.** ToC rows recovered by Y-coordinate grouping (positional zip tested and rejected: per-page code/name/pagenum counts do not match, 25/28/27 on one page) and a calibrated printed-to-physical page offset (confirmed against a body page's own footer, not assumed). Two real bugs fixed after the first working version produced item counts identical to the pre-fix broken version (571, both times) and was distrusted on sight: a Unicode-ellipsis dotted-leader regex bug leaving `……` inside titles, and bullets sitting on their own line separated from content (11.9% of lines — the same phenomenon checked and ruled out as negligible for Maine at 1.6%). A third apparent bug (mislabeled "Stroke" content) was traced to a substring-matching mistake in the diagnostic script, not the parser. Guidelines 73→125 (clean titles), items 571→2,240, zero-item guidelines reduced to 15/125 (mostly genuine front matter or unmarked-prose protocols). NASEMSO/New York/Maine item counts are **byte-identical** to before — zero regression, by construction (this branch only fires when neither known section anchor nor footer anchors exist). Edition-pair alignment v2025.1→v2025.2: 96.8% trivially alignable. Code state `4148732`→`3dbc436`. | Requested fix for the table-extraction gap diagnosed but deferred in the two prior entries, to close §3.2's ≥4-usable-publisher requirement in substance rather than document count alone. | **No confirmatory claim affected — no test document exists.** `FEASIBILITY.md` §18.5 updates the publisher-usability table: **all four retrieved publishers (NASEMSO, New York with its §15.3 caveat, Maine, Connecticut) now have trustworthy item-level data.** §3.2's numeric requirement is therefore met in substance for the first time this session, not merely in document count as recorded in the two prior entries. Two residual caveats travel with this: item density is genuinely lower and more variable for Connecticut for two different reasons (sparse tables vs. unmarked-prose protocols) that raw item counts conflate and any future cross-publisher comparison must account for; and the 15 remaining zero-item guidelines were spot-checked by category rather than individually confirmed, so a small number could still be genuine extraction gaps rather than front matter. The corpus is now ready for retrieval-phase closure and progression toward the annotation protocol (§5), pending resolution of these residuals if they prove material during annotation. |
| 2026-08-17 | **CONTAMINATION FINDING: no currently-retrieved publisher qualifies as held-out test data under §3.4.** Checked before starting §5's annotation sampling, per instruction to begin the annotation protocol. Every cross-publisher parser change this session was written in direct response to reading that publisher's specific document content — `_SCOPE_LINE` against New York's untitled cases, `detect_footer_anchors` against Maine's footer text, `_ct_toc_entries`/`_merge_bare_markers`/`_CT_BOILERPLATE` against Connecticut's content — which is exactly what §3.4 prohibits ("no threshold, regex, matcher parameter or tier definition may be modified in response to anything observed in a test document"). Full account in `FEASIBILITY.md` §19. Code state `4982a64`→`6562e8c` (documentation only; no parser code changed by this entry). | Requested to start the annotation protocol. Before sampling, checked whether the four retrieved non-NASEMSO publishers actually satisfy the quarantine they were assumed to satisfy. They do not — §3.1's dev/test split assumed a fixed method applied blind to new documents, and did not anticipate that generalising the extraction method itself would require the same kind of publisher-specific inspection dev data gets. | **This blocks §5 as currently scoped.** NASEMSO was always dev (§3.1). New York, Maine and Connecticut are now dev in substance as well, regardless of how they were labelled at retrieval. **No item-level data from any of the four retrieved publishers may be used for annotation sampling, tier statistics, or the confirmatory test** until either (a) a fresh, currently-unretrieved and unread edition pair is obtained and parsed using only the three *already-frozen* strategies with no further code change, or (b) the study is explicitly reframed around a dev/test split that accounts for method-generalisation contamination directly rather than assuming it away. Neither is resolved by this entry; it records the blocker and defers the resolution to explicit decision. The annotation *instrument and sampling code* (§5.1–§5.3 mechanics) may still be built and dry-run against dev data in the meantime, clearly labelled as such, since building tooling is not itself a confirmatory use. |
| 2026-08-16 | **§2's exploratory background numbers are superseded.** A verification pass found an identifier-remapping bug in `item_align.align_items` (documented in `FEASIBILITY.md` §9). Corrected major-bump figures: T3 12.3%→**4.0%**, T4 4.6%→**1.3%**, T6 21.1%→**16.2%**, "requires more than an identifier" 22.6%→**10.9%**. Minor-bump figures unchanged at 3.6%. Code state moves from `2ea8ba2` to the commit carrying this entry. | The remap used `_norm` while identifiers are built with `_norm_title`; the two differ on `/` and `-`, so `str.replace` silently failed for every guideline with punctuation in its title, pushing true identifier matches into the harder tiers. | **No hypothesis, metric, threshold, split rule, baseline or frozen parameter is changed.** §2 is exploratory background and its correction does not affect what is being tested. **But H1's 10% threshold is now marginal rather than comfortable:** it was chosen while dev showed 22.6%, and dev now shows 10.9%. **The threshold is deliberately NOT revised.** Lowering a pre-registered threshold after dev evidence moves against the hypothesis is precisely the behaviour registration exists to prevent, even where technically permitted by the absence of test data. H1 may well be disconfirmed, and that is an acceptable outcome. |
| 2026-08-17 | **Fourth confirmatory pair added (Connecticut v2023.1→v2024.1, 99.0% trivially alignable / 0.5% unmatched), then a full correctness audit run before treating the resulting minimum-viable claim as settled — requested explicitly by the user ("double check if everything we have done till now is correct").** The audit (a) verified the quarantine-discipline claim against `git log --name-only d3068ee..HEAD -- '*.py'` directly rather than self-report — zero `.py` changes confirmed across the entire blind-test phase; (b) computed §3.2's item-count/duplicate-identifier eligibility criteria explicitly for the first time for all four pairs — all eight editions pass with zero duplicate identifiers; (c) verified "consecutive editions" against Pennsylvania's and Connecticut's own official version-history pages directly — both confirmed genuinely consecutive, no skipped intermediate editions; (d) found and fixed one real transcription error (an earlier table had quoted Tennessee's 98.6% titled rate in the trivially-alignable column; the correct figure, 92.7%, was already sitting in `FEASIBILITY.md` §24.1); (e) attempted §3.3's revision-magnitude classification — never previously done prospectively for any of the four pairs — first from external inference about version-number shape, which left Tennessee's magnitude apparently undeterminable and Connecticut's apparently major; then correctly, from each document's own front matter (Tennessee: both editions self-described as "Revised," no version scheme; Pennsylvania: both editions explicitly self-described as "an update to the version that was effective on [prior date]"; Connecticut: all three editions open with word-for-word identical "living document... edited... at any time" boilerplate, no full-review language differentiating any transition) — **all four pairs classify as minor**, resolving the open question. A fifth try at a second Connecticut pair (v2017.1→v2022.1, an older pre-modern-format edition) failed honestly — 195 items against v2022.1's 1212, 33.3% untitled, garbage continuation-header anchor, 0.0% trivially alignable — kept as data showing Connecticut's clean parsing is specific to its 2022+ document format, not a property of the publisher across its full history. Full account in `FEASIBILITY.md` §43-44. Code state unchanged at `d3068ee` (documentation only). | Requested by the user first to close the pair-count gap left by the prior entry ("do what is necessary"), then explicitly to audit everything done so far for correctness before accepting the result, then ("do what needs to be done") to resolve the revision-magnitude question the audit had deliberately left open rather than resolving it unilaterally in whichever direction was convenient. | **§3.2's minimum-viable confirmatory test set (≥4 pairs from ≥3 distinct publishers) is now met, verified, and properly classified**: Tennessee 2017→2018, Pennsylvania 2021→2023, Connecticut v2022.1→v2023.1, and Connecticut v2023.1→v2024.1, all four minor revisions. This is the less dramatic of the two outcomes the audit's open question could have produced (the alternative — some pairs being major revisions that still aligned cleanly — would have been a stronger result); it is nonetheless a genuine, properly-verified confirmatory result, not merely an asserted one. One procedural deviation is logged, not hidden: the §3.3 classification was performed after every pair's alignment percentage was already known rather than before, as the section requires in spirit — the classification question itself (does the publisher call this an "update" or a "full review"?) is independent of the measured alignment score and could not have been biased by it in either direction, but the order of operations remains a deviation from stated procedure. The target (≥6 pairs / ≥4 publishers) is not yet met. |
| 2026-08-17 | **Contamination blocker (the "CONTAMINATION FINDING" entry above) resolved for Connecticut via its own logged option (a): fresh, previously-unread editions of the three dev-in-substance publishers were retrieved and parsed using only the three already-frozen strategies, with zero further code change.** New York Collaborative v23.1/v24.1, Maine 2013/2019, and Connecticut v2022.1/v2023.1 were confirmed genuinely untouched by cross-referencing against every dev-phase section (`FEASIBILITY.md` §12-18) that names which specific editions were inspected while building `_KNOWN_ANCHORS`, `detect_footer_anchors`, and `detect_ct_toc_anchors`, then downloaded and run through `parse()`/`item_align.py` with no code change regardless of outcome — the same zero-reaction discipline applied to every blind-test state in `FEASIBILITY.md` §21-41. Connecticut v2022.1→v2023.1: 0% preamble/untitled both editions, full 92/93-item title lists read end to end and confirmed real, 85.5% trivially alignable / 5.7% unmatched — a genuine clean pass matching Tennessee and Pennsylvania. New York and Maine also parse cleanly (0% preamble, real titles throughout) but show poor automated alignment (42.4% and 63.3% unmatched) traced by hand inspection to genuine large-scale edition-to-edition revision (renames, splits, consolidations), not parser defect — logged as a new category, "clean parse, high genuine revision," distinct from both clean and failed. Full account in `FEASIBILITY.md` §42. Code state unchanged at `d3068ee` (documentation only; no `.py` file touched). | Requested by the user to check whether NY/ME/CT had editions never inspected during dev, then to retrieve and test them, as a resolution path for the standing contamination blocker rather than either alternative the blocker entry left open (accept the block permanently, or reframe the dev/test split). | **This is the first entry in this table that adds to, rather than merely documents defects in, the confirmatory test set.** §3.2's minimum-viable publisher count (≥3 distinct publishers) is now met for the first time: Tennessee, Pennsylvania, and Connecticut are three genuine clean pairs from three distinct, non-contaminated publishers. The minimum-viable **pair** count (≥4) is not yet met — one more pair, from any of these three already-validated publishers, would close it without further publisher hunting. New York's and Maine's item-level data remains **not usable for the confirmatory pair count** (their alignment quality does not meet the clean bar), but is legitimately usable for the study's discussion of automated alignment's limits, and remains available as raw material for the annotation phase (§5) if the user later chooses to sample from the "requires more than an identifier" tiers specifically. |
| 2026-08-17 | **Pre-committed stopping rule for the major-pair search, logged before running any further candidate against it, per user instruction to build "a concrete stopping rule" that "avoids endless searching" and is not adjusted mid-search.** §45 established H1/H2 require a major pair and none currently exists; a genuine attempt (NY 2017→2019, §45.1) failed on parsing quality, not availability. Committing the following before continuing: **eligibility gate** for any new candidate — (a) positive, document-sourced evidence of a major revision (version-scheme reset or explicit "full review/complete revision" language) found in the publisher's own material before retrieval, and (b) both editions from a document generation already confirmed clean by prior blind testing, directly excluding the failure mode that sank the NY attempt (a major revision that also changed document format). **Acceptance bar** for any tested candidate — combined preamble + untitled rate <10% on both editions, matching the bar every currently-accepted pair already clears; no case-by-case leniency. **Cap** — at most 5 new candidates total across the search, not counting a costless re-analysis of Rhode Island's and Vermont's already-collected data for revision magnitude and failure-mode classification. **Terminal condition** — if the cap is reached with no accepted candidate, stop permanently, freeze the dataset at 4 minor pairs from 3 publishers, and proceed fully into the annotation phase (§5) with H1 and H2 documented as untestable with the current dataset in the paper itself, not left as an unresolved thread. Annotation sampling on the 4 existing pairs begins immediately and does not wait on the search's outcome, since neither depends on the other. | Requested by the user via a structured request for a decision framework with an explicit stopping rule, to be applied "while preserving methodological rigor," explicitly ruling out ad hoc exceptions, weakened rejection criteria, and endless searching. | **Binding going forward**: any candidate major pair tested after this entry must be logged against these exact criteria, pass/fail, with no retroactive loosening if the cap is reached without success. This entry itself does not change §3.2's minimum-viable status (already met) or add any data; it constrains how the still-open H1/H2 gap may be pursued from here. |
| 2026-08-17 | **Major-pair search terminated early, invoking the stopping rule's terminal condition before the 5-candidate cap was reached.** The two cost-free diagnostics ran first (`FEASIBILITY.md` §46): Rhode Island and Vermont both classify as minor from their own front matter (same living-document framing as every accepted pair), closing Option 5 without needing to revisit their already-known parsing failures. New York's modern `vYY.Z` era's one candidate outside the dev-touched v26.0, v25.0, was found to have been superseded by v25.1 before its effective date ever arrived — never the operative document in practice, disqualified on evidence quality regardless of parsing. With these closed, Option 1 (major pair within an already-clean publisher) is exhausted across all three eligible publishers with **zero of the 5 candidate-cap slots used**. Rather than spending slots on Option 2 (entirely new publishers), the search is stopped now: the same document-text check that found zero major-revision language across Tennessee, Pennsylvania, and Connecticut is evidence, not just absence of luck, that explicit self-described major revisions may not be a convention this document genre (state EMS protocol manuals) uses at all — most describe themselves as continuously-revised living documents. This lowers Option 2's expected value below Option 1's already-assessed low probability, since Option 2 must still separately clear the rare clean-parsing bar. Dataset frozen at 4 minor pairs from 3 publishers. Proceeding into the annotation phase (§5) on this dataset, with H1 and H2 documented as untestable with current data — not a disconfirmation of either hypothesis, an absence of the required stratum. | User asked "What should we do now?" after the diagnostics closed Option 1 with the cap unused, a genuine decision point the stopping rule was built to force rather than let default. Decided per the user's own earlier-requested Phase 2 analysis: "commit to stopping and shipping... rather than open-ended searching," now that the bounded search has run its course without success. | H1 and H2 remain untestable with the current confirmatory test set; this must be stated plainly in the eventual paper as a scoped limitation, not omitted or downplayed. H3 and H4 proceed to real (not dry-run) annotation sampling on the 4 valid pairs now. The major-pair gap is not permanently closed — a future genuinely-untouched candidate meeting §11's logged eligibility gate could still be tested later — but active searching stops here. |
| 2026-08-17 | **Annotation upgraded from two annotators to four, doing full independent redundant labeling (all four label all 240 items, not a split workload) — analysis plan committed here, before opening or reading any of the four completed workbooks, per the same before-not-after discipline used throughout this table.** Section 5.3 specifies exactly two annotators and Cohen's kappa, which is only defined for two raters. With four, the plan is: (a) **Cohen's kappa on the originally-designated Annotator A / Annotator B pair remains the primary, pre-registered §5.3 statistic** — nothing about adding two more people changes what was already committed for that pair; (b) **Fleiss' kappa across all four raters is reported as a supplementary robustness check**, additive to (a), not a replacement; (c) **adjudicated ground truth is majority vote (≥3 of 4 agreeing) where a majority exists**; items without a majority (a 2-2 split, or four-way disagreement) are flagged for genuine discussion-based adjudication per §5.3, not resolved by an arbitrary tie-breaking rule decided after the fact. This plan is fixed before the four completed files are opened. | User obtained four independent annotators instead of two and asked how to make use of the extra labeling capacity; advised in the prior turn to keep A/B as the primary pair and treat additional raters as a supplementary strengthening check (full redundant labeling with Fleiss' kappa) rather than a replacement for the pre-registered design, and to log the plan before seeing results. The user then reported all four had completed their workbooks. | Section 5.3's primary reliability claim is unaffected — it is still computed exactly as pre-registered, on the same two annotators the study always intended. The Fleiss' kappa and 4-rater majority-vote ground truth are additions beyond §5.3's original scope, reported as such, not substituted for it. If Fleiss' kappa and Cohen's kappa (A/B) diverge meaningfully, both are reported — the discrepancy itself is informative and must not be resolved by picking whichever number is more favorable. |
| 2026-08-17 | **A real bug caught and fixed while computing §6's metrics for the first time, per §10's standing rule: `_norm_answer` (the function normalising annotator answers for comparison) returned the special tokens `NONE`/`CANNOT_DETERMINE` uppercase while returning every ordinary item-ID answer lowercase. The new §6 metric code compared against lowercase literals throughout, so every comparison involving a NONE or CANNOT_DETERMINE answer silently failed rather than erroring** — `deletion_recall`/`deletion_precision` came back `null` (zero matching items) for every pair, `provenance_loss_rate` came back exactly `0.0` for every pair, and `cannot_determine_rate` came back `0.0` for every pair, despite directly-confirmed real CANNOT_DETERMINE and NONE answers existing in the data (e.g. Pennsylvania sample_ids S041-S043, unanimously `NONE` across all four annotators). Caught by treating a suspiciously clean all-zero/all-null result as untrustworthy rather than reporting it, the same discipline §10 established for the dev-phase corrections this table already logs. Fixed by making `_norm_answer` lowercase consistently for every value, then the full §6 computation was re-run. **Cohen's kappa and Fleiss' kappa (the prior entry's numbers) are unaffected by this bug and were not re-run** — both compare raters' normalised answers only to each other, never to a hardcoded literal, so a consistent uppercase-vs-lowercase shift changes nothing about which answers are equal to which. Code state: `annotation.py` changed (not the frozen pipeline; see §47). | Discovered while computing §6's metrics for the first time against the completed, fully-adjudicated ground truth (43 items adjudicated per §11's prior "Adjudication workbook" work, merged with 197 majority-vote items). | **The pre-fix numbers were never reported to the user or committed as final — caught before either.** Corrected pooled (240-item) results: cannot_determine_rate 2.92% (7/240, not 0%); provenance_loss_rate_PRIMARY 10.75% raw / **1.48% population-weighted** (not 0%); deletion_recall 36.17% raw / 35.43% weighted; deletion_precision 45.95% raw / 65.89% weighted. Full per-pair and pooled results, both raw and population-reweighted per §5.1, in `annotation_packets/section6_final_metrics.json`. **H4 is confirmed**: pooled T3_renumbered tier precision is 97.06% raw / 94.08% weighted, both comfortably clearing the ≥80% bar. H1 and H2 remain untestable (no major pair exists, per the earlier stopping-rule entries) — the minor-pair provenance loss rate above is a real, useful background number for the eventual paper's discussion, consistent with dev's established "minor bumps lose much less than major ones" pattern, but is not a test of either hypothesis. **H3 is separately untestable for a different reason, newly surfaced here**: it requires comparing against baseline B2 (text-only matching), which was never implemented anywhere in this codebase — only specified in §4 as a design intention. This is a distinct, unaddressed gap, not resolved by anything in this entry. |
| 2026-08-17 | **B2 baseline design and test procedure committed here, before implementation was run against the real 240-item sample — before-not-after discipline, so the design cannot be tuned toward a favorable H3 result.** B2 (`baseline_b2.py`, new file, does not modify `item_align.py` or any other frozen file): for each old item, search similarity against **every** item in the whole new-edition document (no guideline/section restriction, no identifier lookup), using the **identical, unmodified** `item_align._sim` (token-level Jaccard) and `item_align._SIM_FLOOR` (0.75) the real method already uses for its own T4 fallback — same metric, same floor, same greedy one-to-one consumption order, the only variable is candidate-pool scope (global vs. structurally-scoped). This isolates exactly H3's question. Test procedure: for the same 240 sampled items and the same adjudicated ground truth already computed (§6, prior entries), items with `CANNOT_DETERMINE` ground truth are excluded (no truth to score against, consistent with §6's treatment); a paired correct/incorrect indicator is computed per item for both the method and B2; both a RAW (unweighted sample) and a population-WEIGHTED (per §5.1) paired-difference bootstrap 95% CI are reported, 10,000 resamples, items resampled with replacement while each item's own `sample_weight` stays fixed within a resample. H3 is confirmed only if the point estimate is positive AND the 95% CI lower bound also excludes zero, exactly as §7 states — checked for both the raw and weighted versions, both reported regardless of which way either points. | Requested by the user ("start with B2") after the prior entry surfaced H3 as untestable for want of an implemented baseline, distinct from H1/H2's unresolved major-pair gap. | Nothing about the already-computed §6/H4 results changes. This entry commits only the design and test procedure; the actual comparison has not yet been run as of this entry — see the following entry for the result. |
| 2026-08-17 | **H3 result: NOT CONFIRMED, raw and weighted, run exactly per the design committed in the prior entry with no post-hoc change.** Pooled (209 usable of 240 items, `CANNOT_DETERMINE` excluded): method accuracy 75.12%, B2 accuracy 79.43%; paired-difference (method − B2) point estimate **−0.0431 raw / −0.0215 weighted**, both negative — the opposite direction from what §7 hypothesized — with 95% CIs [−0.101, 0.014] raw and [−0.059, 0.014] weighted, neither excluding zero, so the pre-registered confirmation criterion (positive point estimate AND CI lower bound excluding zero) fails outright rather than narrowly. Per-pair results are heterogeneous, not uniform: Tennessee and Pennsylvania trend toward the method (Pennsylvania's raw CI lower bound is exactly 0.0); both Connecticut pairs trend toward B2, and on Connecticut v2023.1→v2024.1 the effect is significant in B2's favour (raw CI [−0.339, −0.136], entirely negative). Per §10's standing rule (inspect intermediate output before reporting), applied here to a result that disfavours rather than favours the hypothesis on the view that a surprising result deserves the same scrutiny as a convenient one: the Connecticut v2023.1→v2024.1 disagreements were spot-checked by hand and traced to a real, coherent mechanism, not a comparison bug — the method's T2 tier ("identifier matched, text changed") trusts that a stable bullet number in a long medication-reference appendix still points at the same conceptual item after edition-to-edition insertions shift every subsequent bullet's number; B2's unscoped global search is immune to this specific failure mode. Full account, table, and mechanism in `FEASIBILITY.md` §53. Code state unchanged at `d3068ee` for the frozen pipeline; `baseline_b2.py` (new) and `annotation_packets/run_h3_test.py` (new) are the only code added, neither modifying `corpus_probe.py`, `item_parser.py`, or `item_align.py`. | Fulfills the "see the following entry for the result" promise left open by the prior entry; the test was run immediately after committing the design, with the sanity check performed before this write-up per §10. | **H3 is disconfirmed by the pre-registered criterion — reported plainly, not softened.** This does not change H4 (still confirmed) or the §6 metrics, which describe the method's own performance rather than a comparison. It does mean the paper cannot claim the structural method demonstrably outperforms naive global text matching on this dataset; §53.3 records a specific, mechanistic, non-uniform explanation (ID-trust vulnerability under bullet-list renumbering, concentrated in one document format) rather than a bare "B2 wins" headline, and flags that B2's own blind spot — vulnerability to coincidental high-similarity matches in a much larger candidate pool — is untested here because it requires a major-revision pair, which §46 already established does not exist in the current dataset. |
| 2026-08-18 | **Exploratory decomposition of the H3 result by old-edition marker kind (bullet/sub-bullet vs. numeric/alpha/roman/paren), performed at the user's explicit request to characterize the §53.2 mechanism further rather than draft the paper or revise B2's design.** `annotation_packets/diagnose_t2_mechanism.py` (new, one-off, no frozen file touched, no re-run of the H3 test itself) splits the same 209 usable items using `old_marker_path`, already present in each `annotation_packet.csv`. Result: on ordinal-marker items (137/209, 66%), the method leads B2 by 5.1 points (76.64% vs. 71.53%) — the hypothesized direction. On bullet/sub-bullet-marker items (72/209, 34%; these carry no true ordinal and are numbered by position, per `item_parser.py`'s own marker-kind design), B2 leads by 22.2 points (94.44% vs. 72.22%), concentrated in the method's T2 (id-trust, 40.00% vs. 90.00%) and, newly surfaced, T6 tiers (method calls these "unmatched/deleted"; 91.67% of the time B2 finds the true match elsewhere — the method is manufacturing false deletions for this item class, not merely mis-matching them). Connecticut v2023.1→v2024.1's significant pooled effect (§53.1) decomposes to bullet items alone (65.00% vs. 100.00%, n=40); its ordinal items in the same pair are exactly tied (89.47% vs. 89.47%, n=19). Full account `FEASIBILITY.md` §54. | Requested by the user ("yes do that") after being asked to choose between drafting the paper, characterizing the T2 mechanism further, or reconsidering B2's design; recommended characterizing further as the only option that does not risk post-hoc-tuning the already-reported, pre-registered H3 comparison (§10's standing rule). | **Does not change H3's status.** §7's criterion was specified pooled, and a post-hoc favourable subgroup split does not retroactively confirm a pooled-disconfirmed hypothesis — H3 remains NOT CONFIRMED, unrevised. What changes is the precision of the disconfirmation for the eventual paper: "B2 beats the method" is not a uniform result but is fully attributable to a specific, mechanistically-identified, and structurally explicable item class (positionally-numbered bullet markers, no true ordinal) that is a minority (34%) of the sample; on the 66% majority with true ordinals, the pre-registered hypothesis's direction holds, undramatically and without a formal test of that subgroup alone (no bootstrap CI was computed for the subgroup split — it is reported descriptively, not as a second confirmatory claim). This additionally surfaces a new, previously unlogged failure mode not recorded in Appendix A/B: bullet-marker items disproportionately produce false "deleted" (T6) calls under the current method, distinct from and additional to the T2 mis-correspondence mechanism §53.2 already logged. |

---

## Appendix A — Reproduction

```
cd sop-guard/backend
python -m app.research.cross_edition.corpus_probe  <edition.pdf>
python -m app.research.cross_edition.item_parser   <edition.pdf> --json items.json
python -m app.research.cross_edition.item_align    <old.pdf> <new.pdf>
```

## Appendix B — Known weaknesses at registration

Recorded so they cannot be presented later as discoveries.

1. **21.1% of items are unmatched on the dev major pair**, mixing genuine
   deletion with residual parser failure. The annotation in §5 exists partly to
   decompose this; until then it is reported, never claimed as deletion.
2. **Two guidelines never parse a title** in any NASEMSO edition
   (`<untitled@…>`).
3. **Guideline matching is permissive by design** — containment-biased overlap
   paired `Cyanide Exposure` with a truncated `Exposure`. A manual audit of all
   accepted guideline pairs is required before publication.
4. **Offsets carry a 3–4% mismatch tail** against `canonical_text`,
   uninvestigated.
5. **Sections yielding no items** (~160–170 per edition) have not been checked
   for whether any contain real recommendations.
