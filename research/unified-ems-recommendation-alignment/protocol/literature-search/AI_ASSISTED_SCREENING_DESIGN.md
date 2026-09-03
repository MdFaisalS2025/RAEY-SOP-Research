# AI-Assisted Structured Literature Screening — Design (AUTH-009, planning/design only)

**Status: DRAFT_FOR_REVIEW, design and feasibility planning only. No AI model has been selected,
configured, run, or calibrated. No record has been screened. This document amends Appendix K.6's
screening-reviewer arrangement; it does not authorize executing that arrangement — execution requires
its own separate stage authorization per FND-011, logged in `../../planning/
STAGE_AUTHORIZATION_REGISTER.md`.**

This document exists because the investigator determined that personally screening the full Lane 1 +
Lane 2 pre-dedup workload (~4,173 records, per `TWO_LANE_SEARCH_DESIGN.md`'s workload table) as sole
title/abstract screener is not feasible. It replaces Appendix K.6's prior arrangement — a single human
stage-1 reviewer (Mohamed Faisal Sindhi) screening **every** deduplicated record, checked by an
independent stage-2 checker — with a frozen, calibrated **AI-first classification stage**, followed by
**mandatory human verification of every AI INCLUDE and UNCERTAIN decision**, plus a **reproducible,
stratified, blinded audit of a sample of AI EXCLUDE decisions** with a prespecified escalation ladder.
Mohamed Faisal Sindhi is preserved as investigator and as the primary human verifier — he is no longer
required to personally read every one of ~4,000+ title/abstracts himself.

**Explicitly not decided or performed by this document:** the specific model/version; the exact prompt
text; the exact numeric thresholds (recall target, sampling fractions, escalation cutoffs); execution
of calibration; execution of official screening. All of these are named below as required freeze items
with either a formula, a provisional default, or a blank sign-off field — never an invented result.

---

## 1. Terminology (adopted for this study, per transparency requirement)

This screening process is, and must always be described in any manuscript, protocol summary, or
presentation as, an **"AI-assisted structured literature review"** (or, where more context is useful,
"AI-assisted structured evidence review with human verification and audited exclusions"). It is
**explicitly not a conventional fully human dual-screened systematic review**, and no text in this
study may describe it as one. See §7 for the full transparency/reporting requirement this labeling
rule is part of.

---

## 2. Role redesign summary

| Role | Prior arrangement (LIT-003, Appendix K.6, superseded by this document) | New arrangement (this document) |
|---|---|---|
| Stage-1 screener of every record | Mohamed Faisal Sindhi (human), reading all ~4,173 pre-dedup title/abstracts | **Frozen AI classification system** (§3) — mechanical, no per-record human time cost beyond system operation/monitoring |
| Human verification | N/A (stage-1 *was* the human) | **Mohamed Faisal Sindhi** reviews every AI **INCLUDE** and every AI **UNCERTAIN** record (§5.1) |
| Exclusion checking | Stage-2 checker reviews a frozen random 10% sample of the human stage-1 reviewer's exclusions | **Mohamed Faisal Sindhi** reviews a reproducibly sampled, blinded, stratified audit of AI **EXCLUDE** records, sized and stratified per §6, with a frozen escalation ladder (§6.4) |
| Independent adjudicator / second reviewer | Stage-2 checker (`TO_BE_APPOINTED`), reviewing all inclusions/uncertain plus 10% of exclusions, required **before official search execution** | Redesignated **screening adjudicator** (`TO_BE_APPOINTED`) — resolves AI-vs-human and human-uncertain disagreements and absorbs escalation-ladder capacity; required **before the human-verification stage begins**, not before official search execution (§8.2) |
| Independent search-strategy reviewer | `TO_BE_APPOINTED`, reviews the locked Lane 1/Lane 2 **query design** (`INDEPENDENT_REVIEW_PACKAGE.md`) | **Unchanged.** A separate gate from screening; still required before official Lane 1/Lane 2 execution (§8.1). |

Investigator and human-verifier roles are retained by Mohamed Faisal Sindhi throughout; nothing in
this redesign removes him from the process — it removes the requirement that he personally read every
record.

---

## 3. Pre-execution freeze checklist

**No AI screening of any record — official or calibration — may begin until every row below is either
frozen (a concrete, hashed, dated value) or explicitly marked "not applicable, frozen as N/A."** This
mirrors K.4a's sentinel-gate discipline and the reviewer-capacity gate's blank-sign-off-field
discipline in `TWO_LANE_SEARCH_DESIGN.md` — required inputs are named precisely, never invented here.

| # | Item | Requirement | Status |
|---|---|---|---|
| 1 | Screening model and exact version | Full model identifier and version/build string (e.g., a dated model snapshot, not a moving "latest" alias), frozen and hashed before calibration begins | **BLANK — to be completed** |
| 2 | Prompt / instructions | Exact, complete prompt text (system + task instructions), SHA-256 hashed as a versioned file | **Drafted in outline (§4.1); exact production text BLANK — to be completed and hashed** |
| 3 | Output schema | Exact JSON schema every model output must validate against (§4.1) | **Drafted below; schema_version to be frozen with a hash** |
| 4 | Temperature / decoding settings | Temperature, top-p, max-output-length, and any seed/determinism setting, frozen | **BLANK — provisional recommendation: temperature 0 (or lowest available) for maximal determinism; to be confirmed and frozen** |
| 5 | Eligibility rubric | Appendix K.5 (include/exclude criteria) — already adopted, unchanged in substance by this document | **Frozen (K.5), reason-code mapping added in §4.2** |
| 6 | Deterministic batching/retry rules | §4.3 | **Drafted below; batch size and retry-count provisional, to be frozen** |
| 7 | Evidence fields and reason codes | §4.1–4.2 | **Drafted below (taxonomy); frozen as a versioned, hashed reason-code table before execution** |
| 8 | Code/configuration hashes | SHA-256 of the prompt file, schema file, reason-code table, and the classification-pipeline code itself | **N/A until the above are implemented — to be computed and logged at execution authorization time** |
| 9 | Prohibition on post-hoc changes | §4.4 | **Adopted as a firm rule by this document (no blank field — this is a rule, not a value)** |

**No official or calibration screening run may begin while any BLANK row above remains unpopulated.**
Populating these rows is itself a planning/design act (permitted under this authorization's scope);
*running* the frozen system against calibration or official records is not (§9).

---

## 4. Frozen system specification

### 4.1 Output schema (draft, to be frozen with a `schema_version` and hash before execution)

Every model call returns one JSON object per record, validated against this schema before any
downstream use:

```
{
  "record_id":        string   // the deduplicated master set's own dedup key
  "decision":         "INCLUDE" | "EXCLUDE" | "UNCERTAIN"
  "reason_codes":     [string, ...]   // >=1 code from the frozen taxonomy, §4.2
  "k1_scope_items":   [string, ...]   // K.1 topic-scope item(s) matched, if any (empty for EXCLUDE)
  "rationale":        string   // free-text justification, bounded length, quoting/paraphrasing
                                // title+abstract evidence only — no outside knowledge
  "confidence":       "LOW" | "MEDIUM" | "HIGH"
  "model_name":       string
  "model_version":    string
  "prompt_hash":      string   // sha256 of the exact frozen prompt used
  "schema_version":   string
  "batch_id":         string
  "timestamp_utc":    string   // ISO 8601
}
```

**Fail-open rule (default under invalidity, mirroring K.6's existing "unresolved disagreement defaults
to inclusion" discipline):** any output that fails schema validation, is missing a required field, or
carries a `decision` value outside the three permitted values is **not** silently discarded, auto-
corrected, or defaulted to `EXCLUDE`. It is programmatically routed to `UNCERTAIN` with a system reason
code `UNC-SCHEMA-FAIL`, logged with the raw malformed response preserved, and surfaced to human
verification exactly like any other `UNCERTAIN` record. A record can be excluded from human review
**only** by a validly-schema'd `EXCLUDE` decision with a valid reason code — never by a processing
failure of any kind.

### 4.2 Reason-code taxonomy (draft; frozen as a versioned table before execution)

Every decision carries at least one reason code. Codes are additive (a record may carry more than
one); this is a starting taxonomy for freeze review, not a claim that it is exhaustive — any code added
during calibration (§5) is logged as a dated taxonomy revision **before** calibration is scored, never
added mid-calibration or after seeing official-corpus behavior (§4.4).

| Code | Decision | Meaning | K.5 / K.1 tie |
|---|---|---|---|
| `INC-CLIN-VERSION` | INCLUDE | Clinical guideline/protocol version, update, or recommendation-change focus | K.1 recommendation evolution/versioning (clinical) |
| `INC-LEG-ALIGN` | INCLUDE | Legislative/regulatory text alignment or change-tracking | K.1 legislative/regulatory-text alignment |
| `INC-RETRIEVAL-RERANK` | INCLUDE | Dense retrieval, lexical retrieval, or neural reranking/cross-encoder method | K.1 method scope |
| `INC-ENTITY-ASSIGN` | INCLUDE | Entity resolution, record linkage, or graph/bipartite/assignment matching | K.1 method scope |
| `INC-SET-VALUED` | INCLUDE | Set-valued prediction or structured output | K.1 method scope |
| `INC-DOC-ALIGN` | INCLUDE | Document/sentence/version-alignment method (domain-general) | K.1 / K.4a component (b) |
| `INC-EMS-INFORMATICS` | INCLUDE | EMS/prehospital-protocol informatics specifically | K.1 topic scope |
| `INC-COREF-EVAL` | INCLUDE | Coreference/entity-linking evaluation methodology | K.1 topic scope |
| `EXC-OUT-OF-SCOPE` | EXCLUDE | No K.1 topic-scope item plausibly matched | K.5 exclude |
| `EXC-OPINION-NO-METHOD` | EXCLUDE | Opinion/editorial, no described method or evaluation | K.5 exclude |
| `EXC-SUPERSEDED-VERSION` | EXCLUDE | Preprint superseded by its own later published version | K.5 / K.7 |
| `EXC-NO-USABLE-ABSTRACT` | EXCLUDE | Non-English with no usable English abstract | K.5 exclude |
| `EXC-SUPERFICIAL-OVERLAP` | EXCLUDE | Keyword overlap only, no substantive K.1 relevance | K.5 exclude |
| `EXC-WRONG-TASK` | EXCLUDE | Adjacent terminology but a different actual task (e.g., evidence surveillance rather than version/counterpart alignment — the S5 pattern, `SENTINEL_BIBLIOGRAPHY.md`) | K.2 rubric |
| `UNC-AMBIGUOUS-SCOPE` | UNCERTAIN | Plausible K.1 match, insufficient abstract detail to decide | — |
| `UNC-BORDERLINE-METHOD` | UNCERTAIN | Some method overlap, unclear against K.2's four rubric dimensions | K.2 |
| `UNC-CONFLICTING-SIGNALS` | UNCERTAIN | Title and abstract point in different directions | — |
| `UNC-LOW-CONFIDENCE` | UNCERTAIN | Model's own confidence below the frozen `HIGH`/`MEDIUM` floor, independent of other codes | — |
| `UNC-SCHEMA-FAIL` | UNCERTAIN | System-assigned; output failed schema validation (§4.1) | — |

### 4.3 Deterministic batching and retry rules

- **Order:** records are submitted in a single fixed, non-relevance-derived order — ascending by the
  deduplicated master set's own `record_id` (dedup key) — fixed *before* any classification call is
  made and never reordered afterward, including after partial results are seen.
- **Batch size:** a fixed batch size `B` per model call (provisional default: 25 records/batch — to be
  frozen; chosen for context-length/logging manageability, not for any content reason).
- **Per-batch logging:** `batch_id`, the exact ordered `record_id` list, request timestamp (UTC), the
  complete raw model response, the parsed/validated output, and the schema-validation result for each
  record — logged for every batch, including failed ones.
- **System/API-failure retry:** a batch that fails at the transport/API level (timeout, rate limit,
  malformed response envelope) is logged `FAILED` with the reason, then retried under the **identical**
  frozen prompt/settings — up to `R` retries (provisional default: 3, exponential backoff) — mirroring
  Appendix K.12's existing retry procedure for search execution. A batch that exhausts retries is logged
  `FAILED` and re-attempted in a separately logged pass; never silently dropped.
- **No individual re-prompting:** a record-level schema failure or a low-confidence output is **never**
  individually re-submitted with reworded, clarified, or "help it get this one right" prompt text. The
  only two permitted responses to a record-level output problem are (a) the fail-open `UNCERTAIN` route
  (§4.1) or (b) a full, documented, prospective system correction under §4.4 — never an ad hoc one-off
  re-ask.

### 4.4 Prohibition on post-hoc changes (adopted rule, not a blank field)

Once the frozen system (model+version, prompt, schema, settings, reason-code taxonomy, batching/retry
rules) **passes calibration (§5) and every item in §3's checklist is hashed and logged**, no component
may be changed on the basis of:

- the pattern of INCLUDE/EXCLUDE/UNCERTAIN decisions it produces on the **official** corpus;
- any observed or anticipated effect on the study's novelty claim (K.15) or on confirmatory results;
- an informal impression that a specific official-corpus decision "looks wrong."

**The only permitted post-freeze changes** are: (a) a documented, prospective correction triggered
specifically by the exclusion-audit escalation ladder's Level-3 trigger (§6.4) — a verified, systematic
error pattern, not an isolated one; or (b) a technical bug fix that does not alter the rubric/prompt's
substantive judgment (e.g., a schema-parsing bug), itself logged as a retry-procedure-style event, never
presented as a silent judgment change. Any other proposed change after seeing official-corpus behavior
is treated exactly as a post-hoc query-tuning violation under this study's existing "do not tune against
yield" discipline (`AUDIT_LOG.md` Entry 009) and requires **restarting calibration from a fresh
development-only sample** before the system can be re-frozen and re-authorized.

---

## 5. Calibration plan

### 5.1 Calibration sample: source and non-contamination rule

**Requirement (per this session's authorizing instruction):** the calibration sample must be
independently labeled by the investigator and must not be drawn from official search records if doing
so would contaminate the official corpus. Two candidate sources are both permitted, **conditional on
the mandatory overlap-and-strip check below**:

- **(a)** A fresh, small, dedicated development-only pull from the K.3 core sources (PubMed, OpenAlex),
  using query terms deliberately *different* from the frozen Lane 1/Lane 2 strings (e.g., an adjacent
  or broader draw), logged under a new K.14-style source classification,
  `DEVELOPMENT_CALIBRATION_ONLY`, and never merged into the official deduplicated master set file.
- **(b)** A random sub-sample drawn from the preserved AUTH-007 historical set
  (`INCOMPLETE_SEARCH_FEASIBILITY_EXECUTION`, 3,464 records) — already real, on-topic, and explicitly
  not the official corpus. This source carries a higher expected overlap with the eventual official
  Lane 1/Lane 2 corpus (same topic area, likely shared DOIs/arXiv IDs/PMIDs), so it requires the
  overlap-and-strip check below to matter in practice, not merely in principle.

**Mandatory overlap-and-strip check (applies regardless of source (a) or (b)):** once the official Lane
1/Lane 2 deduplicated master set exists, every calibration-sample record is checked against it by the
same K.7 identifier priority (DOI → arXiv ID → PMID → normalized title+year). **Any record found in
both sets has its calibration-time label (investigator's and the AI's) discarded for official-corpus
purposes** — it is reclassified fresh by the frozen AI system exactly like every other official record,
and the substitution is logged (record ID, calibration label discarded, official label assigned). No
calibration-time judgment, human or AI, may be carried over into an official-corpus decision under any
circumstance.

### 5.2 Blinded, independent labeling procedure

1. The investigator (Mohamed Faisal Sindhi) labels the full calibration sample — a binary/ternary
   relevance judgment against K.5 — reading only the title/abstract exactly as the AI system will see
   it, **blind to any AI output** (no AI classification has been run on this sample yet at labeling
   time, or if it has, the investigator does not view it before finishing their own labels). This
   mirrors the blinding discipline already adopted elsewhere in this protocol (the statistician's
   blinded threshold charter, RND3-001) for the same reason — labeling after seeing the thing being
   measured is not independent measurement.
2. The frozen AI system (§4) classifies the identical calibration sample.
3. The two label sets are compared **only after both are complete and locked** — never iteratively,
   never with one informing the other mid-process.

### 5.3 Sample-size formula and planning table (formula-based; not a claimed result)

Calibration must produce enough truly-relevant records (by the investigator's independent label) to
estimate the AI system's **recall/sensitivity for relevant records** — i.e., the fraction of truly-
relevant records the AI does *not* route to `EXCLUDE` — with a defensible lower confidence bound, since
this study's priority is catching missed-relevant records, not overall accuracy.

Let `n_rel` = number of truly-relevant records in the calibration sample (by investigator label), `p` =
assumed prevalence of relevant records in the calibration pool. Required total calibration sample size:

```
N_calibration = ceil(n_rel / p)
```

**Recall lower-bound table** (exact Clopper-Pearson one-sided 95% lower confidence bound, computed
directly — not approximated — for a given number of relevant records and observed misses; this is a
statistical planning table, not a claimed calibration result, since no calibration has run):

| `n_rel` (relevant records) | 0 misses: recall / lower 95% CI | 1 miss: recall / lower 95% CI | 2 misses: recall / lower 95% CI |
|---|---|---|---|
| 30 | 100.0% / 90.5% | 96.7% / 85.1% | 93.3% / 80.5% |
| 50 | 100.0% / 94.2% | 98.0% / 90.9% | 96.0% / 87.9% |
| 75 | 100.0% / 96.1% | 98.7% / 93.8% | 97.3% / 91.8% |
| 100 | 100.0% / 97.0% | 99.0% / 95.3% | 98.0% / 93.8% |
| 150 | 100.0% / 98.0% | 99.3% / 96.9% | 98.7% / 95.9% |
| 200 | 100.0% / 98.5% | 99.5% / 97.7% | 99.0% / 96.9% |

**Total calibration sample size required to reach a given `n_rel`, by assumed prevalence:**

| `n_rel` needed | prevalence 10% | prevalence 15% | prevalence 20% | prevalence 30% |
|---|---|---|---|---|
| 50 | 500 | 334 | 250 | 167 |
| 75 | 750 | 500 | 375 | 250 |
| 100 | 1,000 | 667 | 500 | 334 |
| 150 | 1,500 | 1,000 | 750 | 500 |

**Reading example (illustration of the formula, not a decision):** if the true prevalence of relevant
records is around 15% and the investigator wants a lower-bound recall estimate that clears ~95% even
if the AI misses one relevant record in calibration, `n_rel` ≈ 100 is needed (95.3% lower bound at 1
miss), requiring `N_calibration` ≈ 667 total records at 15% prevalence. **The actual prevalence is not
known until the calibration sample is drawn and labeled** — this table exists so the investigator can
pick a defensible target once a rough prevalence estimate is available (e.g., from a very small initial
draw), not to fix `N_calibration` here.

### 5.4 Calibration gate (provisional threshold, must be frozen before execution)

**Provisional default gate:** the frozen AI system passes calibration only if its recall for truly-
relevant records (investigator-labeled `INCLUDE`-or-borderline-relevant, i.e., anything that should not
be a confident `EXCLUDE`) achieves a Clopper-Pearson lower-95%-confidence-bound **≥ 95%** on the
calibration sample, treating any AI `EXCLUDE` of a truly-relevant record as a miss (an AI `UNCERTAIN`
or `INCLUDE` of a truly-relevant record counts as recall-preserved, since both route to human review).

This 95% figure is a **commonly-cited convention in ML-/text-mining-assisted screening practice**
(analogous to recall targets cited in Cochrane-affiliated technology-assisted-screening guidance) —
**it is not derived from this study's own data**, is explicitly labeled provisional, and must be
confirmed or explicitly changed (with a stated reason) by the investigator before it governs execution,
exactly as the 20% contingency margin in `TWO_LANE_SEARCH_DESIGN.md`'s reviewer-capacity gate is
labeled a disclosed convention rather than a derived value.

**If the gate fails:** the prompt/rubric/reason-code taxonomy may be revised **before** calibration is
scored again — but only via a documented, dated revision, re-run against a **fresh** calibration draw
(never the same labeled sample re-used, which would let the system be tuned directly against known
answers) — mirroring §4.4's ban on tuning against already-seen results, applied here to the calibration
stage itself.

**Sign-off fields (blank; must be populated before execution):**

| Field | Value |
|---|---|
| Assumed prevalence used for sample-size planning | ___ (to be completed) |
| `N_calibration` (total sample size drawn) | ___ (to be completed) |
| `n_rel` (truly-relevant records found, investigator label) | ___ (to be completed) |
| AI misses (truly-relevant records the AI routed to `EXCLUDE`) | ___ (to be completed) |
| Observed recall / Clopper-Pearson lower 95% bound | ___ (to be computed) |
| Recall gate threshold (default 95%; state if adjusted, with reason) | 95% (default; adjustable with logged reason) |
| PASS/FAIL against the gate | **Cannot be evaluated — calibration not yet run. Treated as FAIL by default until populated and passing.** |

---

## 6. Official screening workflow

### 6.1 AI classification stage

Every deduplicated Lane 1 + Lane 2 title/abstract record is classified by the frozen system (§4) into
exactly one of `INCLUDE` / `EXCLUDE` / `UNCERTAIN`, with reason codes, per the batching/retry rules of
§4.3. This stage requires no human screening time; it requires system operation, monitoring, and full
K.10-style logging of every batch.

### 6.2 Mandatory human verification of INCLUDE and UNCERTAIN

**Mohamed Faisal Sindhi reviews every single AI `INCLUDE` and every single AI `UNCERTAIN` record** —
no sampling at this stage, full coverage, using the verification instrument
(`SCREENING_VERIFICATION_INSTRUMENT.md`). Each reviewed record receives a human decision
(`CONFIRM_INCLUDE` / `OVERRIDE_TO_EXCLUDE` / `ESCALATE_TO_ADJUDICATOR`) and a brief rationale. This
satisfies K.5's eligibility authority requirement — the AI's `INCLUDE`/`UNCERTAIN` output is a
**prioritization/routing aid**, never itself an eligibility decision, exactly as the existing K.6
principle already holds for any AI-assisted step in this protocol.

### 6.3 Stratified, blinded, reproducible audit of AI EXCLUDE records

See §6 heading below for the full stratification/seed/weighting design (moved to its own numbered
section, §6, given its required level of detail) — summarized here: a reproducibly sampled subset of AI
`EXCLUDE` records is reviewed by the investigator, blind to the fact that a given record was an AI
`EXCLUDE` versus a randomly interspersed check record where feasible, stratified by reason code and a
risk-tier proxy, at unequal sampling fractions, with a frozen escalation ladder governing any finding.

### 6.4 Escalation ladder (frozen; applies to every audited false exclusion)

A **false exclusion** is any audited AI `EXCLUDE` record that the investigator's blinded human review
determines should have been `INCLUDE` or `UNCERTAIN`. **An isolated false exclusion is never silently
corrected on its own** — every finding triggers the ladder below, logged in the append-only deviations
log (DEC-012):

| Level | Trigger | Required response |
|---|---|---|
| **0 — baseline** | No finding yet | Initial stratified audit per §6.2–6.3 below runs as designed |
| **1 — single finding** | Any one audited `EXCLUDE` record found false | (a) Log the finding (record ID, stratum, reason code, cause) in the deviations log; (b) **double** the audit sample within that record's specific stratum, drawn via the same deterministic seeded procedure extended (not re-randomized from scratch); (c) route the specific record to the adjudicator (§8.2) for a documented correction decision |
| **2 — stratum threshold crossed** | The audited false-exclusion rate within a stratum (after Level-1 expansion) has a point estimate exceeding **5%** (provisional default, tied to the 95% calibration recall target — i.e., an audited stratum performing worse than the calibration-time recall floor), **or** the same reason code produces ≥2 findings | Escalate to **100% human review of every AI `EXCLUDE` record in that entire stratum** |
| **3 — cross-stratum threshold crossed** | Two or more strata cross Level 2, **or** the overall Horvitz-Thompson-weighted false-exclusion-rate estimate across all strata (§6.4 formula, below) exceeds 5% | Escalate to **100% human review of every AI `EXCLUDE` record across the entire corpus** (the audit becomes a full human screen), **and** trigger the §4.4 post-hoc-correction path — a mandatory, documented review of the prompt/rubric/reason-code taxonomy before the frozen system is used again, following a fresh calibration re-run |

At every level, the finding, the response taken, and its effect on the final flow counts are logged —
never resolved by quietly changing one record's status without invoking the level it triggers.

### 6.5 Adjudication path

Any of the following routes to the adjudicator (§8.2), not to the primary human verifier alone: (a) a
Level-1+ audited false exclusion; (b) any record the primary human verifier marks
`ESCALATE_TO_ADJUDICATOR` during §6.2's INCLUDE/UNCERTAIN review; (c) any ambiguous clinical or
methodological case where the primary verifier is unsure whether K.2's rubric is cleared. Disagreements
are resolved by discussion and logged; an unresolved disagreement defaults to inclusion through full-
text screening, unchanged from K.6's existing rule.

---

## 6 (continued) — Exclusion-audit design: options considered and recommendation

Per the reassessment requirement: the archived/prior 10% flat exclusion-audit figure (LIT-003) was
never itself statistically derived — it was carried over unmodified from the archived precedent. Three
designs were considered.

### Design A — Flat, unstratified 10% simple random sample (status quo, reinterpreted)

Draw a simple random 10% sample of all AI `EXCLUDE` records; no stratification; no escalation ladder
beyond ad hoc handling of any finding.

- **Workload:** fixed at 10% of the exclude set regardless of composition.
- **Risk:** treats all exclude reason codes and confidence levels identically. A rare but high-risk
  reason code (e.g., `EXC-WRONG-TASK`, the exact failure mode `SENTINEL_BIBLIOGRAPHY.md`'s S5 case
  illustrates) could, by chance, receive little or no audit coverage if it is a small fraction of total
  excludes. No prespecified response if an error is found — silent one-off correction risk.
- **Simplicity:** highest; easiest to explain and reproduce without further methodological machinery.

### Design B — Stratified initial audit with a frozen escalation ladder (recommended)

Stratify AI `EXCLUDE` records by reason code × a risk-tier proxy (derived from AI confidence and the
existing `n_families` heuristic already defined in `DEDUPLICATED_MASTER_SET.md`); sample each stratum
at an unequal, risk-weighted fraction (provisional defaults: 20% for high-risk strata, 10% for
unclassified/medium strata, 5% for low-risk strata — **provisional, to be frozen**); apply the §6.4
escalation ladder to any finding.

- **Workload:** lower expected initial burden than a flat 10% in the common case (system performing
  well), because low-risk strata are sampled below 10% — but the escalation ladder means realized
  burden **grows automatically and substantially** the moment a real problem is found, unlike Design A.
- **Risk:** more complex to prespecify and reproduce; strata must be locked from AI-output fields alone
  (reason code, confidence, `n_families`) **before** sampling, never redefined after seeing which
  specific records fall where, to avoid data-dependent stratification bias.
- **Statistical grounding:** reporting uses a Horvitz-Thompson estimator (below) to produce an unbiased
  overall false-exclusion-rate estimate despite unequal stratum sampling fractions — a real
  improvement over Design A's uniform-but-arbitrary 10%.

### Design C — Sequential/adaptive audit with a formal stopping rule

Draw an initial small stratified batch (e.g., ~50–100 records); compute a running false-exclusion-rate
estimate; continue in fixed increments until either a precision target is met with zero findings
(allowing an early stop below either Design A or B's size) or a finding triggers the same escalation
ladder.

- **Workload:** potentially the smallest expected burden of the three if the AI is genuinely accurate
  (the likely case if calibration passed) — earliest possible stop.
- **Risk:** requires genuine sequential-testing correction to avoid the "optional stopping" inflation
  this protocol already treats seriously elsewhere (the sparse-outcome freeze-before-sampling rule,
  RND3-CL-003/FIN-002) — this is not a formula a non-statistician should freeze alone, and the
  appointed statistician (`TO_BE_APPOINTED`) has not been asked to specify or validate it for this use.

### Recommendation: Design B

**Design B is recommended, not because it minimizes work — Design C has a lower expected burden in the
likely best case — but because it is the best-justified design given actual current staffing.** Design
C requires a statistician's sequential-testing specification this study does not yet have committed to
this task; freezing an ad hoc stopping rule without that review would risk exactly the kind of
undisciplined, unreviewed statistical machinery this protocol elsewhere rejects (e.g., FND-002's removal
of unjustified conformal-prediction machinery, `AUDIT_LOG.md` Entry 017). Design A is retained as the
methodologically simplest fallback if Design B's stratification proves impractical to specify cleanly
at execution time, but it is not preferred, because it gives every reason code and confidence level
equal audit weight regardless of actual risk, and it has no prespecified response to a finding beyond
ad hoc correction — which item 4 of this amendment specifically forbids.

### 6.a Audit strata (locked definition, to be applied to whatever the official AI-EXCLUDE set turns out
to contain)

| Stratum | Definition | Provisional initial sampling fraction |
|---|---|---|
| High-risk | `EXC-WRONG-TASK` or `EXC-SUPERFICIAL-OVERLAP` reason code, **or** AI confidence = `LOW`/`MEDIUM`, **or** `n_families` ≥ 2 (matched by multiple Lane 1/Lane 2 query families — the existing `DEDUPLICATED_MASTER_SET.md` heuristic) | **20%** (provisional, to be frozen) |
| Low-risk | `EXC-OPINION-NO-METHOD` or `EXC-NO-USABLE-ABSTRACT` reason code, **and** AI confidence = `HIGH`, **and** `n_families` = 1 | **5%** (provisional, to be frozen) |
| Other / unclassified | Any AI-`EXCLUDE` record not meeting either definition above | **10%** (provisional, to be frozen — the legacy default, retained where no sharper risk signal exists) |

A record belongs to exactly one stratum (high-risk takes priority if multiple conditions apply).
Stratum membership is computed entirely from AI-output fields already logged at classification time
(§4.1) — never redefined after sampling, and never informed by which records "look interesting."

### 6.b Seed and sampling procedure (deterministic, reproducible)

Reusing the identical deterministic mechanism already adopted for jurisdiction randomization (DEC-019),
rather than an arbitrary or software-RNG seed:

```
audit_rank(record) = SHA-256( record_id || "EMS-LIT-EXCLUSION-AUDIT-v1" || deduplicated_master_set_hash )
```

Within each stratum, sort ascending by `audit_rank`; select the first `ceil(stratum_size × sampling_fraction)`
records. **Two independently-coded implementations of this procedure must agree**, mirroring DEC-019's
own dual-implementation requirement — this is not optional for a reproducibility-critical sampling step.
Level-1 escalation (§6.4) extends the same stratum's selection by continuing down the identical sorted
list (next-ranked records), never re-drawing with a new seed.

### 6.c Weighting and reporting (Horvitz-Thompson estimator)

Because sampling fractions differ by stratum, the overall false-exclusion-rate estimate reported in the
final evidence table is **inverse-probability weighted**, not a naive average across strata:

```
FER_hat = (1 / N_total_excludes) × Σ_h ( n_h_errors / π_h )
```

where `π_h` is stratum `h`'s realized sampling fraction (including any Level-1 expansion), `n_h_errors`
is the count of audited false exclusions found in stratum `h`, and `N_total_excludes` is the total
number of AI `EXCLUDE` records across all strata. This is reported alongside the raw per-stratum finding
counts and the escalation level ultimately reached, in the final K.9-style evidence table and the
transparency report (§7). A formal variance/CI for `FER_hat` is computed at execution time (a standard
Horvitz-Thompson variance formula); if the appointed statistician is available by then, their review is
sought, consistent with this protocol's general preference for statistician review of estimator
variance wherever one is appointed and available.

---

## 7. Transparency and reporting requirements

Every manuscript, protocol summary, or presentation describing this literature review must:

1. Use the term **"AI-assisted structured literature review"** (§1) and state explicitly, in the same
   paragraph, that **this is not a conventional fully human dual-screened systematic review.**
2. Report the frozen **model name and exact version** (§3, item 1).
3. Report or cite the **exact frozen prompt** (§3, item 2) — full text in a supplement/appendix, or a
   stated hash plus availability statement if length precludes inline inclusion.
4. Report **calibration results**: sample size, assumed/observed prevalence, `n_rel`, misses, observed
   recall, the Clopper-Pearson lower-confidence bound achieved, and the frozen threshold it was measured
   against (§5.4's sign-off table, populated).
5. Report **human verification counts**: total AI `INCLUDE`, total AI `UNCERTAIN`, human
   confirm/override/escalate counts for each.
6. Report **exclusion-audit sampling**: the design used (§6, Design A/B/C), strata definitions and
   sizes, the seed/procedure (§6.b), realized sampling fractions per stratum, and total records audited.
7. Report **false-exclusion findings**: count, stratum, reason code, and the escalation level each
   triggered (§6.4).
8. Report **escalations**: every Level-1/2/3 event, its trigger, and its resolution (including any
   §4.4 post-hoc system correction and the fresh calibration re-run that followed it, if triggered).
9. Report **final flow counts**: records identified per source, deduplicated total, AI `INCLUDE` /
   `EXCLUDE` / `UNCERTAIN` counts, human-verified final includes, and audit-confirmed exclude total —
   the K.18 evidence table, populated for this workflow.
10. **Never claim PRISMA compliance** unless every applicable PRISMA item is genuinely met — given the
    non-standard, AI-first screening stage, this is unlikely by default. **A PRISMA-style flow diagram
    may still be used**, provided it is labeled accurately (e.g., "PRISMA-style flow diagram, adapted;
    this review's screening stage deviates from standard PRISMA dual-human-screening methodology — see
    Methods for the AI-assisted procedure") rather than presented as a standard PRISMA diagram.

---

## 8. Personnel and gate timing

### 8.1 Independent search-strategy reviewer — unchanged

This role (reviews the locked Lane 1/Lane 2 **query design**, `INDEPENDENT_REVIEW_PACKAGE.md`) is
**not affected by this amendment**. It remains `TO_BE_APPOINTED`, remains required before official Lane
1/Lane 2 search execution, and remains a separate gate from screening — screening design changes do not
substitute for, delay, or satisfy this requirement.

### 8.2 Screening adjudicator (redesignated from "stage-2 checker") — new deadline and qualification

**Redesignation rationale:** the prior K.6 arrangement required a stage-2 checker to be appointed
**before official search execution**, because that checker's job (double-checking every human stage-1
decision plus 10% of exclusions) could only begin once stage-1 screening was already substantially
complete, and a frozen corpus with no checker available would be stuck. Under this redesign, the AI
classification stage requires no human at all, and the primary human-verification stage (§6.2) can
begin the moment AI classification completes — but §6.5's adjudication path (disagreements, escalations,
ambiguous clinical/methodological cases) can be triggered by the very first record the primary verifier
reviews. **This role is therefore required no later than the point human verification begins** — i.e.,
after AI classification completes and immediately before Mohamed Faisal Sindhi begins reviewing
`INCLUDE`/`UNCERTAIN` records or the exclusion audit — **not before official Lane 1/Lane 2 search
execution.** This is an exact deadline, not an open-ended delay: the role cannot be left unfilled once
AI output exists and human review is about to start, since the very first ambiguous case or audit
finding may require it.

**Minimal qualification (unchanged in substance from LIT-003, restated for this role):**

- Independent of both the AI screening system's construction (prompt/rubric/reason-code taxonomy, §4)
  and the Lane 1/Lane 2 query construction — not the same person who built or tuned either.
- Able to make literature-relevance judgments against K.1/K.2/K.5 without requiring supervision.
- Available on short notice once human verification begins, since escalation-ladder events (§6.4) are,
  by design, unpredictable in timing.

**Dr. Nasir Uddin remains one possible candidate, not assumed**, per the existing standing rule (LIT-003)
— another suitably experienced person may serve instead, and no unnecessary permanent role is created
beyond what §6.5's adjudication path actually requires.

---

## 9. What this document does and does not authorize

**Authorizes (design/planning only, under AUTH-009):** the freeze-checklist structure (§3); the output
schema and reason-code taxonomy as drafted, pending final freeze (§4); the calibration plan, formulas,
and provisional gate (§5); the official-workflow design, audit stratification, seed procedure, and
escalation ladder (§6); the transparency/reporting requirements (§7); the personnel/deadline redesign
(§8); and the companion `SCREENING_VERIFICATION_INSTRUMENT.md`.

**Does not authorize:** selecting or configuring an actual AI model; running any calibration; drawing or
labeling a calibration sample; classifying any official-corpus record; performing any human verification
or exclusion audit; appointing or contacting the screening adjudicator or any other personnel;
freezing/preregistering/publishing anything; executing the official Lane 1/Lane 2 search itself (a
separate, still-unmet gate — `TWO_LANE_SEARCH_DESIGN.md`'s PASS/FAIL section); or touching any protected
path (archive, Paper 1 materials, publication worktree, RAEY application, website, corpus,
development-history folders). **No AI screening system has been run against any record — calibration or
official — as of this document.**
