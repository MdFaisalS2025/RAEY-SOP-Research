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

**Current code state:** `6990776` — update this line, and add a §11 entry, on
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

From each test edition pair, draw a **stratified random sample of 60 old items**,
allocated across the tiers the method assigns (12 per tier T1–T5, and any T6
shortfall redistributed proportionally). Stratifying by predicted tier
oversamples rare tiers deliberately; all reported rates are **reweighted to the
population** and the weights are recorded.

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
| 2026-08-16 | **§2's exploratory background numbers are superseded.** A verification pass found an identifier-remapping bug in `item_align.align_items` (documented in `FEASIBILITY.md` §9). Corrected major-bump figures: T3 12.3%→**4.0%**, T4 4.6%→**1.3%**, T6 21.1%→**16.2%**, "requires more than an identifier" 22.6%→**10.9%**. Minor-bump figures unchanged at 3.6%. Code state moves from `2ea8ba2` to the commit carrying this entry. | The remap used `_norm` while identifiers are built with `_norm_title`; the two differ on `/` and `-`, so `str.replace` silently failed for every guideline with punctuation in its title, pushing true identifier matches into the harder tiers. | **No hypothesis, metric, threshold, split rule, baseline or frozen parameter is changed.** §2 is exploratory background and its correction does not affect what is being tested. **But H1's 10% threshold is now marginal rather than comfortable:** it was chosen while dev showed 22.6%, and dev now shows 10.9%. **The threshold is deliberately NOT revised.** Lowering a pre-registered threshold after dev evidence moves against the hypothesis is precisely the behaviour registration exists to prevent, even where technically permitted by the absence of test data. H1 may well be disconfirmed, and that is an acceptable outcome. |

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
