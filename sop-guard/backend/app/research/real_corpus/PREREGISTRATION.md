# Pre-registration: structural anchoring of paraphrased content to source spans

**Status:** frozen on registration. Nothing below may be changed after the tag is
cut; changes go in §12 (Deviations) as dated, reasoned entries appended to the end
of this file, never as edits to the text above it.

**Registered:** 2026-08-15
**Registration tag:** `prereg-anchoring-v1`
**Registered by:** Mohamed Faisal Sindhi (sindhi@usf.edu, GitHub `MdFaisalS2025`)
— *corrected 2026-08-15 after tagging; see §12*
**Target venue:** ECIR 2027, short paper track (abstract 2026-10-05, paper 2026-10-12)
**Code state at registration:** `119234d117c60513d3d2c55ac62515b2d2a50a03`
(commit "Pin research module state ahead of anchoring pre-registration", which
pins `pilot_eval.py`, `corpus.py`, `paraphrases.py`, `FINDINGS.md`, the baseline
run artifact, and the two production modules the harness imports —
`app/rag/chunker.py` and `app/rag/embedding_cache.py`. See Appendix A item 1.)
**Corpus hash at registration:** `41d45128b1f927ad118e51a1a1c1c6bdd274f022`
**Baseline run artifact:** `results/pilot_run_20260815T184348Z.json`
(5 documents, 38 pairs, embedding model `BAAI/bge-small-en-v1.5`,
thresholds `marker_min_containment=0.6`, `fuzzy_min_ratio=0.3`,
`embed_span_min_similarity=0.5` — matching §5)

---

## 1. Purpose of this document, and its limits

This pre-registration exists because every threshold and design decision in the
existing pilot was calibrated on the same 38 pairs it was evaluated against. That
is disclosed in `FINDINGS.md` §9 item 4, and it is the single most reviewer-visible
weakness in the work. This document fixes that by declaring, before any new data is
collected or any new evaluation is run, exactly what will be measured, on what data,
with which frozen parameters, and what result would count as confirming or
disconfirming each hypothesis.

**What this document does NOT claim.** It does not make the existing pilot results
confirmatory. Those results were exploratory, they generated the hypotheses below,
and they are reported as exploratory in any resulting paper. The confirmatory claim
attaches only to the held-out test documents defined in §3, which do not exist in
the corpus at the time of registration.

---

## 2. Background: what has already been observed

Stated so a reader can see exactly which observations generated these hypotheses,
and therefore which parts of the analysis cannot be treated as confirmatory. All
numbers below are from the exploratory pilot recorded in `FINDINGS.md`, on 5
documents and 38 pairs.

1. `quote` (W3C `TextQuoteSelector`-style) achieved 0.0 coverage on paraphrased
   content, as expected by construction: there is no verbatim string to find.
2. `structural` with an absolute lexical containment gate at 0.60 achieved
   coverage 0.500, mean IoU 0.500, false-anchor rate 0.0 across the full 5-document
   set. Coverage was substantially worse on longer, more heavily reworded items
   (AHRQ 0.333) than on short ones (CDC 0.667).
3. Two absolute *semantic* gate designs were calibrated against 1,767
   same-document negative pairs and both failed. Whole-block cosine: correct-pair
   scores 0.70–0.95 (median 0.839), wrong-pair scores reaching 0.886; best
   achievable threshold 0.70 giving recall 0.970 at a 10.4% false-positive rate.
   Clause-level semantic containment at the codebase's existing 0.55 threshold:
   77% of the 1,767 wrong pairs scored a perfect 1.0.
4. `structural_margin` — the same marker location, gated by strict relative
   ranking against sibling items — achieved coverage 1.0, mean IoU 0.999,
   false-anchor rate 0.0 on the 33-pair non-adversarial subset, with the correct
   block the argmax in 33/33 cases (minimum positive margin 0.017, median 0.110).
5. On the 38-pair set including the synthetic adversarial decoy document,
   `structural_margin` produced a false-anchor rate of 0.057 (2 of 5 adversarial
   pairs). The cause was diagnosed architecturally: rival lookups reuse the same
   naive first-match marker search as the primary candidate, so each rival is
   compared against its own decoy rather than its real content.

**Consequence for the design.** Because all five observations were made on the
existing five documents, **those five documents are treated as contaminated and are
assigned entirely to the development set.** No test-set document exists yet.

---

## 3. Corpus and split protocol

### 3.1 Split rule — fixed now, before any new document is retrieved

- **Development set:** the five existing documents (`cdc_core_practices`,
  `cdc_disinfection_sterilization`, `ahrq_cauti_appropriate_indications`,
  `ahrq_cauti_inappropriate_indications`, `adversarial_decoy_markers`), plus
  approximately half of all newly retrieved documents.
- **Test set:** the remaining newly retrieved documents. **Zero overlap of
  documents between dev and test.** Splitting is at the document level, never the
  item or pair level, because items within one document share vocabulary and
  numbering scheme and would leak.
- **Assignment procedure:** newly retrieved documents are assigned to dev or test
  by a seeded pseudorandom draw (`random.Random(20261005)`), stratified by
  numbering scheme (flat-numeric, deep-alphanumeric, reconstructed-list), executed
  **before any paraphrase is authored for that document** and recorded in
  `split_assignment.json` at the time of assignment.
- **Target size:** 12–20 documents total, 200–300 pairs total. If fewer than 10
  documents are parseable by 2026-09-04, the target reduces to 12 documents and
  200 pairs (see §11).

### 3.2 Test-set quarantine

From the moment of assignment until the single evaluation run defined in §9:

- No test-set document is read, inspected, or debugged by the experimenter beyond
  what parsing requires.
- No metric is computed on test-set pairs.
- No threshold, regex, gate, or parser is modified in response to anything observed
  in a test document.

If a parser bug makes a test document unparseable, the document is **dropped from
the study entirely** and the drop is recorded in §12. It is not moved to dev and it
is not fixed by inspecting its content, because either action would leak.

### 3.3 Document eligibility

Documents are eligible if and only if they are:

1. Works of the US federal government, in the public domain under 17 U.S.C. §105.
   State and non-US-government sources are excluded from this study to avoid the
   licensing question entirely.
2. Structured with explicit item numbering or lettering that survives text
   extraction.
3. Composed of items long enough to paraphrase meaningfully (≥ 3 sentences for at
   least some items).
4. Retrieved with a complete provenance header in `raw/` recording source URL,
   retrieval date, publisher, licence, numbering scheme, and any construction notes,
   matching the existing five files' format.

At least two newly retrieved documents must contain a genuine numbered reference or
bibliography section, so that the adversarial decoy condition is exercised on real
rather than only synthetic material.

### 3.4 Paraphrase authoring

- **Tier A:** authored by the primary experimenter, by reading the source item and
  rewording it, without consulting the anchoring code's behaviour on that item.
- **Tier B:** authored by a second person who has not seen any Tier A pair for the
  same document and has no knowledge of the methods under test. Target 100–150
  pairs. Tier B is analysed as a separate stratum (§8, H4).
- Every pair record gains three fields not present at registration:
  `split` (`"dev"` / `"test"`), `author` (`"A"` / `"B"`), and
  `intended_distance` (`"near"` / `"far"`), declared by the author at authoring
  time and never revised afterwards.
- Items with ambiguous or duplicated `item_id` values (e.g. the known
  `cdc_core_practices` 5a–5f duplication) remain excluded, as in the pilot. This
  study measures anchoring, not ID disambiguation.
- Authoring errors discovered later are **recorded, not silently corrected**,
  following the precedent of the `core_practices` item-3 fabrication already
  documented in `FINDINGS.md` §2.

---

## 4. Methods under evaluation

All six are already implemented in `pilot_eval.py` and are evaluated unchanged
except where §5 specifies. Method names below are the exact function names.

| Name | Function | Description |
|---|---|---|
| `quote` | `method_quote` | Exact substring, then whitespace-normalised substring. W3C `TextQuoteSelector` analogue. |
| `fuzzy` | `method_fuzzy` | `difflib.SequenceMatcher` sliding window, best-scoring window above a minimum ratio. |
| `embed_span` | `method_embed_span` | Best-matching single line by cosine similarity over the configured dense backend. |
| `whole_doc` | `method_whole_doc` | Floor baseline; always returns the entire document. |
| `structural` | `method_structural` | Marker-located block, gated by absolute asymmetric lexical containment. |
| `structural_margin` | `method_structural_margin` | Marker-located block, gated by strict relative ranking against all sibling items in the same document. |

### 4.1 One new method, declared in advance

`structural_margin_decoy_robust` — identical to `structural_margin` except that the
candidate-location step rejects a marker match if either condition holds:

1. The match begins after the start offset of a heading matching
   `(?im)^\s*(references|bibliography|resources|further reading|citations)\b`.
2. The matched line contains no token from a fixed recommendation-language lexicon
   (`should`, `must`, `shall`, `recommend`, `recommended`, `do not`, `avoid`,
   `ensure`, `perform`, `use`).

Both conditions are applied to the primary candidate **and to every rival lookup**,
because the diagnosed failure in §2 item 5 was that rivals were corrupted the same
way as the candidate. The lexicon above is fixed at registration and will not be
tuned.

---

## 5. Frozen parameters

These values are frozen at registration. They are the values currently in the code
and they will not be re-tuned on dev or test.

| Parameter | Value | Location |
|---|---|---|
| `_MARKER_MIN_CONTAINMENT` | `0.60` | `pilot_eval.py` |
| `fuzzy` minimum ratio | `0.30` | `method_fuzzy` |
| `embed_span` minimum similarity | `0.50` | `method_embed_span` |
| `structural_margin` gate | strict inequality; ties rejected; **no margin constant** | `method_structural_margin` |
| Embedding backend | `bge-small-en-v1.5` | `app.config.settings.RAG_EMBEDDING_MODEL` |
| Split seed | `20261005` | §3.1 |

**Rationale for freezing rather than re-tuning.** Re-tuning on the enlarged dev set
would produce better numbers and a weaker paper. The claim under test is about the
*form* of the gate — absolute versus relative — not about the value of any constant.
Introducing a tuned margin constant would make the relative gate's result
uninterpretable as evidence for that distinction.

**Exception, declared in advance:** if the embedding backend is unavailable at run
time, `embed_span` and `structural_margin` cannot be evaluated and the study halts
rather than reporting a partial table (see §11). A backend substitution is a
deviation requiring a §12 entry.

---

## 6. Metrics — exact definitions as implemented

Taken verbatim from `pilot_eval.run_pilot()`. Where two metrics treat abstention
differently, this is stated rather than smoothed over.

| Metric | Definition | Denominator | Abstention treated as |
|---|---|---|---|
| `coverage` | Fraction of pairs where the method returned a non-null span that is not the whole-document floor | all pairs | not covered |
| `localization_accuracy` | Fraction of returned spans that overlap ground truth | **non-null spans only** | excluded |
| `mean_iou` | Mean intersection-over-union against ground truth | **all pairs** | scored 0.0 |
| `false_anchor_rate` | Fraction of non-null, non-floor returns that do **not** overlap ground truth | non-null, non-floor returns | excluded |

**Declared inconsistency.** `localization_accuracy` excludes abstentions from its
denominator while `mean_iou` scores them as 0.0. These two numbers therefore
penalise abstention differently and are not directly comparable. Both are reported
as-is rather than harmonised, because changing either definition now would break
comparability with the exploratory pilot numbers in §2. In addition, an
**IoU-when-fired** figure (mean IoU over non-null returns only) is reported
alongside `mean_iou` as a secondary descriptive statistic, matching the split
reporting already used in `FINDINGS.md` §5.

**Primary safety metric:** `false_anchor_rate`. A confidently wrong span is a worse
outcome than an abstention, and this metric is the one on which the method's safety
claim stands or falls.

---

## 7. Primary and secondary outcomes

- **Primary outcome:** `false_anchor_rate` of `structural_margin` on the held-out
  test set, non-adversarial documents.
- **Co-primary outcome:** separability of correct-pair and same-document
  negative-pair similarity distributions on the test set (H2).
- **Secondary outcomes:** `coverage`, `mean_iou`, IoU-when-fired,
  `localization_accuracy`, all per method; and the same set stratified by
  `intended_distance` and by `author`.

---

## 8. Hypotheses and decision rules

Each hypothesis states in advance what result confirms it and what result
disconfirms it. Hypotheses are tested on the **test set only**.

### H1 — Verbatim anchoring fails on paraphrases
`quote` achieves coverage < 0.05 on the test set.

- **Confirmed if:** coverage < 0.05.
- **Disconfirmed if:** coverage ≥ 0.05, which would indicate the paraphrases retain
  substantial verbatim material and the corpus construction is flawed. *This is a
  corpus validity check as much as a hypothesis; failure here invalidates the study
  and triggers §11.*

### H2 — Absolute semantic gates cannot separate within-document classes
Over all same-document (paraphrase × non-matching sibling item) negative pairs in
the test set, no threshold on whole-block cosine similarity achieves both recall
≥ 0.95 and false-positive rate ≤ 0.05.

- **Confirmed if:** no such threshold exists, i.e. the best achievable operating
  point at recall ≥ 0.95 has FPR > 0.05.
- **Disconfirmed if:** such a threshold exists on test data. *This would be a
  genuine falsification of the paper's central claim and must be reported as such.*
- **Reported regardless:** the full ROC curve and the best achievable operating
  point, whichever way the decision falls.

### H3 — Relative gating outperforms absolute gating
On the test set, non-adversarial documents, `structural_margin` achieves higher
coverage than `structural` **and** a `false_anchor_rate` no higher than
`structural`'s.

- **Confirmed if:** coverage difference is positive with a bootstrap 95% CI
  excluding zero, and the false-anchor-rate difference has a 95% CI whose upper
  bound does not exceed +0.05.
- **Disconfirmed if:** either condition fails.

### H4 — Independently authored paraphrases are harder
`structural_margin` coverage on Tier B pairs is lower than on Tier A pairs.

- **Confirmed if:** the difference is positive (A > B) with a bootstrap 95% CI
  excluding zero.
- **Disconfirmed if:** the CI includes zero or the sign reverses.
- **Note:** H4 is expected to be *confirmed*, which is unfavourable to the method
  and favourable to the paper's honesty. It is registered precisely so the result
  cannot later be presented as a surprise or omitted.

### H5 — The relative gate's safety property is conditional, not inherent
On adversarial-condition documents (those containing genuine numbered reference
sections), `structural_margin` has a `false_anchor_rate` strictly greater than its
rate on non-adversarial test documents; and `structural_margin_decoy_robust`
reduces that rate.

- **Confirmed if:** both parts hold.
- **Partially confirmed if:** the elevation is observed but the fix does not
  reduce it. *This outcome is reported as a negative result for the fix, not
  suppressed.*
- **Disconfirmed if:** no elevation is observed on real adversarial documents,
  which would suggest the synthetic decoy fixture overstated the threat. This too
  is reported.

---

## 9. Analysis plan

1. **One evaluation run on the test set.** A single execution of the harness over
   test documents, producing one timestamped artifact in `results/`. The artifact's
   `corpus_hash` and `thresholds` block are checked against the values recorded in
   this document's header before the numbers are read.
2. **Uncertainty.** Bootstrap 95% confidence intervals, 10,000 resamples,
   resampling **at the document level** rather than the pair level, because pairs
   within a document are not independent. Reported for every primary and secondary
   outcome.
3. **Comparisons between methods** use paired bootstrap over the same document
   resamples.
4. **Stratified reporting**, pre-declared: by `intended_distance` (near / far), by
   `author` (A / B), by numbering scheme, and by adversarial condition.
5. **Multiplicity.** Five hypotheses, each with one pre-declared primary test.
   Benjamini–Hochberg correction is applied across the H1–H5 family. Stratified
   analyses in item 4 are **descriptive and exploratory** and are reported without
   correction and labelled as such.
6. **Dev results are reported separately** and labelled exploratory, alongside test
   results, in every table. A dev/test gap is reported and discussed, not
   suppressed.

---

## 10. What is exploratory, stated in advance

The following are explicitly **not** confirmatory and will be labelled exploratory
wherever they appear:

- Every number produced on the five original documents, including all figures in §2.
- Every stratified breakdown in §9 item 4.
- Any per-document, per-item, or error-category analysis.
- Any additional method, model, or condition added after registration (see §12).
- Qualitative diagnosis of individual failure cases.

---

## 11. Stopping and abort conditions

The study halts, and the halt is reported, if any of the following occurs:

1. **H1 disconfirmed** — the paraphrase corpus retains verbatim material, meaning
   the task is not the task claimed. Corpus is rebuilt; a new pre-registration is
   required.
2. **Embedding backend unavailable or changed** at test-run time. `embed_span` and
   `structural_margin` cannot be evaluated, and a partial table would be
   misleading. Halt, resolve, re-run.
3. **Fewer than 10 documents parseable by 2026-09-04.** Targets reduce to 12
   documents and 200 pairs, and the reduction is recorded in §12. If fewer than 8
   documents are parseable, the test set is too small for a document-level
   bootstrap and the study is deferred rather than reported underpowered.
4. **Test-set contamination.** If any test document is inspected, or any parameter
   is modified in response to test data, the affected documents are discarded and
   the contamination is recorded in §12. If contamination cannot be isolated, the
   confirmatory claim is withdrawn and results are reported as exploratory.

---

## 12. Deviations

Every departure from the above is appended here with a date and a reason. Nothing
above this section is edited after registration. An empty section at submission
time is a claim in itself, and a populated one is not a failure — an unrecorded
deviation is.

| Date | Deviation | Reason | Effect on interpretation |
|---|---|---|---|
| 2026-08-15 | Header field **Registered by** changed from `MdFaisalS2025 (sindhi@usf.edu)` to `Mohamed Faisal Sindhi (sindhi@usf.edu, GitHub MdFaisalS2025)`. | The field was populated from `git config user.name`, which holds a GitHub handle rather than the registrant's name. A registration should identify a person. | **None.** Identity metadata only. No hypothesis, parameter, metric, split rule, or data-handling procedure is affected. The originally tagged commit `862721d` retains the pre-correction text and remains the authoritative registration timestamp; this change is an amendment to it, not a re-registration. |

---

## Appendix A — Known dependencies and reproducibility risks

Recorded at registration because they affect whether these results can be
reproduced or could silently drift.

1. **The harness is not fully decoupled from production code.** Contrary to the
   claim in `FINDINGS.md` §9 ("zero dependency on the production pipeline"), which
   the module docstring of `pilot_eval.py` itself corrects, the harness imports
   `_CONTAINMENT_STOPWORDS` and `_containment` from `app.rag.chunker` and depends on
   `app.rag.embedding_cache`. Decoupling is true only with respect to
   `app/demo_data/` and the demo-SOP pipeline. **A change to `chunker.py`'s
   containment metric or stopword list would silently change `structural`'s
   results.** Mitigation: the commit SHA in this document's header pins the state
   of those modules, and any change to either file between registration and the
   test run is a §12 deviation.

2. **The embedding backend is configuration-dependent.** `run_pilot()` records
   `embedding_model_id` in each artifact. The value at registration is recorded in
   the header; a mismatch at test time is an abort condition (§11 item 2).

3. **`corpus_hash` covers raw text only,** not the paraphrase fixture. A change to
   `paraphrases.py` will not alter the hash. Mitigation: the paraphrase fixture is
   pinned by the commit SHA, and the fixture file must not be modified between
   registration and the test run except by appending new pairs for documents not
   yet evaluated.

4. **Ground-truth offsets are computed against the document body only,** excluding
   the provenance header (`corpus.py::_load_raw`). Any change to header format
   shifts every offset in that document.

---

## Appendix B — Reproduction

```
cd sop-guard/backend
python -m app.research.real_corpus.pilot_eval
```

Every run writes a timestamped artifact to
`app/research/real_corpus/results/pilot_run_<timestamp>.json` containing
`corpus_hash`, `embedding_model_id`, the full `thresholds` block, per-method
summaries, and per-pair raw results. The artifact corresponding to the single
confirmatory test run will be identified by filename in the resulting paper.
