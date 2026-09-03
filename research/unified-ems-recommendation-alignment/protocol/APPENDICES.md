# Appendices to the Unified EMS Recommendation-Alignment Study Protocol

## DRAFT_FOR_REVIEW

**Status: `PROVISIONALLY_ADOPTED` (draft), same as `PROTOCOL.md`.** Nothing here is `FROZEN`;
nothing here authorizes acquisition, recruitment beyond informal inquiry, or literature-search
execution. Provisions marked "adopted unchanged from the archive" reuse the archived Paper 2
protocol's technical detail at
`../../archive/two-paper-program-2026-08-28/paper-2-prospective-alignment/protocol/APPENDICES.md`
as a **historical, non-governing reference** — every such provision was independently re-adopted in
`../planning/DECISION_REGISTER.md`, not imported by silence.

---

## Appendix A — Recommendation-unit definition

**Adopted unchanged from the archive (DEC-014).** Two-layer representation: immutable parser spans
(addressable items) → adjudicated semantic recommendation units. Publisher document structure is
extraction evidence only; it does not determine the scientific unit.

**Core rule:** a recommendation is the smallest clinically interpretable unit specifying one
principal clinical action for one target population or indication. Structurally separate spans are
grouped when they jointly express inseparable parameters of that action; a span is separated when it
introduces a different principal action, population, indication, decision branch, or independently
executable instruction.

**Boundary rules** (full text, archived, re-adopted): alternatives addressing the same decision
remain one set-valued recommendation; sequential actions are separate. Contraindications/stop
conditions stay attached when they qualify only that action. Conditional branches split when
different conditions lead to different actions. Cross-references are not recommendations unless
they contain an actionable instruction. Headings, rationale, administrative text are excluded.
Table rows may produce multiple recommendations. Every semantic recommendation retains links to all
contributing parser spans, pages, headings, source offsets.

**Decision-branch/algorithm handling:** each terminal branch is its own recommendation; a terminal
branch includes conditions inherited from all upstream decision nodes; two branches with different
conditions stay separate even if actions are identical; multiple independently-executable actions at
one terminal branch are separated; a decision node containing only a condition is not itself a
recommendation; a terminal outcome directing intentional non-action IS a recommendation; loopbacks
are represented once with every applicable path retained as provenance. Escape hatch:
`COMPOSITE_UNRESOLVED` for flowcharts that cannot be decomposed without losing meaning — excluded
from the primary recommendation-level analysis, reported separately with a prespecified sensitivity
analysis (DEC-014).

**Process:** semantic grouping is completed and frozen *before* model predictions are generated.
Two reviewers independently group a calibration sample on development documents; **validated for
annotator comprehension, boundary agreement, cross-format applicability, and workload on the frozen
development corpus before formal freeze — any clarification from that exercise uses development
data only, documented prospectively, never confirmatory documents or model results (DEC-014).**

---

## Appendix B — Eligibility, comparable scope, modular documents

### B.1 Eligible authority

**Adopted unchanged (DEC-015).** Strict, state-government-issuer test, applied only to the
confirmatory cohort. An eligible protocol series must be issued, formally adopted, or formally
designated as the statewide model by a state/jurisdictional government EMS office, department of
health, statutory EMS board, or equivalent public authority. Endorsement, hosting, funding,
recognition, or common use alone is insufficient. Regional systems, private associations, hospitals,
vendors, medical directors, or quasi-official organizations do not qualify unless a qualifying
government authority formally adopted/designated them statewide. Home-rule jurisdictions remain
surveyed but may be classified as having no eligible confirmatory series. Excluded jurisdictions
receive a documented exclusion reason. No relaxation of this rule to reach a target cohort size —
apply the frozen minimum-cohort/infeasibility rules instead (DEC-015, FND-005).

**Challenge set (FND-009, new):** quasi-official/regional/unusually-modular/scan-heavy/structurally-
atypical materials may be prospectively defined as an optional, separately-governed challenge-set
collection — never entering development or confirmatory cohorts, never a confirmatory replacement,
never influencing model selection/thresholds/the primary analysis, permanently assigned to the
challenge role once inspected or acquired, reported only as clearly-labeled exploratory evidence if
ever analyzed at all. Defining the role does not authorize acquisition or commit to analysis; if
unused, the manuscript reports that no challenge-set analysis was conducted.

### B.2 Adult/pediatric scope

**Adopted unchanged (DEC-016).** Adult/general volume only for the primary confirmatory cohort;
pediatric-only volumes deferred to a separately-approved future/exploratory study. A combined
all-ages manual, or a general manual with integrated pediatric sections, remains eligible in full.

### B.3 Modular-document rule

**Adopted unchanged (DEC-016).** A modular protocol set is one edition only when: (1) the publisher
identifies the modules as a coordinated statewide release; (2) a complete module inventory can be
established for both editions; (3) the relevant adult/general modules are available in both
editions; (4) module identity/dates/version relationships/omissions are documented; (5) the
combined modules satisfy the same provenance/completeness/parsing/comparable-scope requirements as
a single-volume protocol. Two-person eligibility review resolves uncertainty under a prespecified
rule. No informally mixed modules assembled merely to preserve a jurisdiction — failure triggers the
frozen exclusion and cross-jurisdiction replacement procedure.

### B.4 Comparable clinical scope

**Adopted unchanged (DEC-016).** The archived 10-domain checklist (resuscitation; cardiovascular;
respiratory; neurologic; trauma; medical emergencies; toxicology; obstetric care; medication
guidance; transport/destination decisions) applies consistently.

---

## Appendix C — Randomization: seed and mapping algorithm

**Adopted with a simplified mechanism (DEC-019).** External public verifiable randomness, drawn only
after the complete eligible-jurisdiction list is frozen and hashed.

**Algorithm:**
1. A prespecified public randomness value, obtained only after the eligible manifest is frozen.
2. Convert that value and each canonical jurisdiction identifier into a deterministic SHA-256
   ranking key under a fully published byte-encoding specification.
3. Sort by that key — a deterministic ranking, not a language-specific shuffle.
4. Implement independently in two separate scripts/environments; both must produce identical ranking
   keys and the complete ordering before role assignment is accepted.
5. Publish pseudocode, encoding rules, test vectors, software versions, randomness-source evidence,
   frozen eligible-manifest hash, and final ordering commitment.
6. On disagreement: halt role assignment, document the discrepancy, correct the implementation
   without inspecting downstream documents or outcomes, rerun both versions.

**Fallback:** a prespecified secondary public randomness source and timeout, set before
eligible-manifest freeze.

---

## Appendix D — Timeline, custody, access control, replacement

### D.1 Freeze record (unpopulated)

Required fields: `protocol_version`, `protocol_sha256`, `approval_timestamp_utc`,
`document_availability_cutoff_utc`, `approving_investigators`, `custody_mechanism_hash`,
`authorized_next_stage`.

### D.2 Availability-evidence rules

**Adopted unchanged from the archive's discipline, applied within the corrected survey timing
(DEC-017).** Recorded in ISO 8601 UTC. Later publication/upload/replacement cannot change which
edition was most recent at the cutoff. A document discovered after cutoff may still qualify if
auditable evidence shows pre-cutoff availability. Consecutive-edition status is verified **at
survey time**, against each publisher's own official version-history or archive evidence, not
deferred to a later audit — for each candidate pair: protocol-series identity; edition labels;
publication/effective dates; official version-history/archive evidence; intervening
editions/supplements/interim updates; whether files were silently replaced at the same URL; modular-
release relationships; reviewer conclusion + supporting official-source evidence. Incomplete or
contradictory official history → unresolved status → excluded, unless a frozen resolution procedure
establishes succession.

### D.3 Acquisition-before-randomization sequence

(1) Freeze governance protocol; (2) metadata-only survey of all 52 jurisdictions — **no document
content touched, custody not required**; (3) **custody must be operational** (COR-001) — then
acquire candidate files into custody-controlled quarantine; (4) validate authenticity, succession,
file integrity, parser readiness; (5) complete independent eligibility review; (6) freeze the
complete eligible-pair manifest; (7) obtain the external random value (Appendix C); (8) randomize
eligible jurisdictions; (9) assign confirmatory/replacement/development/challenge roles; (10) seal
the selected packages; (11) keep model developers blinded until their configurations and analysis
code are frozen.

**Stop-condition cross-references (new, AUTH-002; index only, not a new rule):** this sequence
pauses automatically if custody is not operational at step 3 (D.5, D.6). This protocol's other
pause/abort/halt points, gathered here only as pointers: the replacement-window-closing trigger
(D.8); the post-unblinding cohort-integrity abort (D.10); the reference-standard abort conditions —
staffing failure after 3 attempts, an unresolved drift pause, a defective reference key, copied/
fabricated answers (Appendix I.5); the Class-3 amendment pause procedure (Appendix J.1); and each
activity's own `stop_condition` field in `../planning/STAGE_AUTHORIZATION_REGISTER.md`. No single
mechanism supersedes another; each governs only its own stage.

### D.4 Access-control matrix

**Adopted with the minimal-team role registry (DEC-009).**

| Role | Candidate metadata | Raw candidate files | Confirmatory content | Queue order | Reference answers | Model predictions |
|---|---|---|---|---|---|---|
| Investigator/Model Developer | Yes | Development only | After authorization | No | No | Yes (development) |
| Confirmatory Evaluator (Sindhi, under compatibility exception) | Coded metadata | No | Sealed confirmatory package only, at execution time | No | No — blind to reference truth | Generates once, under seal |
| Eligibility reviewer | Yes | Yes | For eligibility only | No | No | No |
| Custodian/split-key holder | Yes | Yes | Yes | Yes | Sealed only | Sealed only |
| Correspondence reviewers (non-clinical, clinical) | Limited | Required pair only | Yes | No | Own answers only | No |
| Adjudicator (also QC/drift/Training-Lead) | Limited | Required pair only | Yes | No | Disagreement records; development-gold answers; logged, immutable-hash-referenced pre-adjudication reviewer-answer records | No |
| Statistical reviewer | Coded metadata | No | No — blinded to M4's comparative development effect until threshold/floor commitment (RND3-001/002) | No | After seal | After seal |

Minimum constraints (DEC-009's three-tier compatibility, full list in `DECISION_REGISTER.md`
DEC-009): the custodian cannot combine with model development, annotation, adjudication, cohort
selection, or outcome analysis; an adjudicator cannot decide a query on which they made the initial
judgment; a single person cannot provide both independent initial judgments on one query; the model
developer cannot access sealed confirmatory content before authorization; a statistician cannot
self-verify code they authored without a second reviewer. Role combination never expands
permissions — the most restrictive applicable rule governs.

### D.5 Custody protocol

**Corrected (COR-001, strengthened FIN-001).** Custody mechanism — independence criteria, access
matrix, sealing procedure, release triggers, split-key fallback, audit requirements, failure
procedure — frozen with the protocol. **A qualified custodian, or the prespecified two-person
split-key fallback (never a single self-held key), must be identified, provide written acceptance,
and complete the custody/access agreement before any prospective confirmatory-candidate document is
downloaded, opened, inspected, or stored** — before acquisition (Appendix D.3 step 3), not merely
before eligible-manifest freeze. **Custody protection persists through primary-analysis lock, or a
separately frozen final-disposition rule, even for a document later excluded from the cohort — an
excluded confirmatory-candidate document can never become development material or be exposed to
model-developer personnel.** If neither custodian nor fallback is operational at the acquisition
gate, acquisition automatically pauses. The investigator alone approves the scientific protocol; the
custodian signs the custody agreement and confirms operational readiness before acquisition
authorization — a separate act. Two encrypted packages (confirmatory, replacement); SHA-256 per
plaintext file, deterministic manifest hash, SHA-256 per encrypted package; hashes timestamped
before model developers receive confirmatory material.

**Confirmatory release** only after: governance gates pass, reference standard sealed, confirmatory
model configuration frozen, analysis code frozen, investigator + custodian sign release
authorization. Release triggers the D.9 single sealed-run discipline.

### D.6 Custody search process (superseding the prior deadline)

**Time-boxed search + split-key fallback, deadline moved before acquisition (COR-001).** Actively
seek an independent custodian from protocol approval until a prespecified deadline no later than
document acquisition. Define the custodian's independence, responsibilities, access restrictions,
release triggers, and required written acknowledgement before recruitment begins. If no suitable
custodian is secured by the deadline, automatically activate the split-key fallback: the
investigator and one uninvolved adult each hold separate key material; neither can independently
decrypt the sealed confirmatory package; the second key holder must have no role in method
development, pair selection, annotation, adjudication, or statistical analysis. Publish or
independently timestamp cryptographic commitments; document every access attempt and key-transfer
event. Single-person self-held fallback is never permitted.

### D.7 Within- vs. cross-jurisdiction replacement

**Adopted unchanged (DEC-020).** Always cross-jurisdiction; no within-jurisdiction substitution.
Each jurisdiction contributes at most one objectively designated pair. Permitted retries: correct
retrieval/documentation mechanics only when jurisdiction, series, and prespecified editions remain
unchanged — never new post-rejection eligibility evidence, edition substitution, gate relaxation, or
reopened eligibility judgment merely to preserve the jurisdiction. Status codes:
`EXCLUDED_BEFORE_RANDOMIZATION`, `FAILED_AFTER_SELECTION`, `REPLACED_CROSS_JURISDICTION`,
`RETAINED_CHALLENGE_ONLY`.

### D.8 Replacement-window-closing trigger

**Adopted unchanged (DEC-020), floor per DEC-008/FND-005.** Closes at the earliest of: statistically-
justified target pairs sealed; frozen queue exhausted (triggers the statistical-floor feasibility
check); the survey-and-acquisition deadline; any confirmatory method receiving any confirmatory
representation. If the cohort falls below the statistically-justified minimum at the deadline, the
study stops before modeling and requires the formal infeasibility decision — never a lowered floor.
*(See D.3 for the full cross-reference list of this protocol's other pause/abort/halt points.)*

### D.9 — Confirmatory Evaluator and single sealed-run discipline

**Adopted unchanged, with Sindhi as Evaluator under the compatibility exception (DEC-030).**
Before release: freeze/hash cohort manifest, data package, parser, M1–M4 implementations,
dependencies, model artifacts/API versions, configuration, seeds, analysis scripts, expected
outputs, execution instructions. During execution, the stricter Evaluator restrictions govern:
receive the sealed package only on the documented release trigger; execute the single prespecified
end-to-end job; record console output, environment details, timestamps, hashes, generated
artifacts; transfer outputs to the authorized analysis location. Never inspect individual cases,
tune parameters, alter code, choose among runs, manually repair outputs, or rerun for unfavorable
results. Rerun permitted only for a prespecified, independently-verifiable technical failure (e.g.,
incomplete execution, corrupted transfer, infrastructure interruption), fully logged before
rerunning, preserving the failed run, using the identical frozen specification. No separate
Confirmatory Evaluator recruited unless a final access-control audit finds the combined role cannot
satisfy these restrictions.

### D.10 — Post-unblinding cohort-integrity abort condition

**Adopted unchanged, with a clerical-vs-composition distinction (DEC-031).** After unblinding, any
change to confirmatory cohort membership, jurisdiction identity, edition-pair identity, included
sections, sampled-query membership, or reference-standard inclusion invalidates the registered
primary analysis. The originally frozen cohort/sample remains the only basis for the registered
primary result. A revised-cohort analysis may still be conducted when scientifically necessary, but
labeled exploratory/corrected reanalysis, reported alongside the original, with a complete
explanation. Mechanically-verifiable clerical corrections (display label, file-path reference,
transcription field) preserving committed identity/hash follow the ordinary correction mechanism —
if a purported clerical correction changes *which* jurisdiction/edition/section/query/annotation is
analyzed, it is a composition change and the bright-line rule applies.
*(See D.3 for the full cross-reference list of this protocol's other pause/abort/halt points.)*

### D.11 — Provisional Role Registry

**Adopted as an eight-role registry for the minimal team (DEC-009).** See `PROTOCOL.md` §9a and
`DECISION_REGISTER.md` DEC-009 for the full role list, qualification standards, and the three
compatibility tiers (prohibited / allowed-with-review / generally-allowed).

---

## Appendix E — Parser correction, failure tiers, pinning, development-corpus diversity

### E.1 Manual parser-correction ceiling

**Structure adopted, numbers deferred to the pilot (DEC-021).** Provisional benchmarks 5% (item)
and 5% (page), evaluated — not assumed — via the Unified Development Feasibility and Calibration
Pilot module 1. Permitted correction types, prohibited types (rewriting, filling from the other
edition, clinical inference, manual content addition, consulting model output), OCR qualification,
zero/near-zero-item automatic failure, two-person verification, append-only correction log: adopted
unchanged from the archived technical detail. Manual correction remains structural only,
edition-isolated, fully logged, performed without access to model outputs or the counterpart
edition's correspondence results.

### E.2 Blank-page definition

Adopted unchanged (archived detail): a page counts as publisher-inserted blank only if it contains
no clinical text/table/figure/algorithm/footnote/continuation marker, confirmed by two parser-QC
reviewers.

### E.3 Jurisdiction-wide parser-failure contingency: three-tier structure

**Structure adopted, numbers deferred to the pilot (DEC-021).** Tier 1 (pass with limited
correction), Tier 2 (pass with localized exclusion, provisional 10% benchmark), Tier 3 (pair
failure → jurisdiction-wide failure, cross-jurisdiction replacement) — full mechanics adopted
unchanged from the archived technical detail, including the combined-burden rule (correction rate +
excluded item fraction ≤ provisional 10%).

### E.4 Pinned/hashed parser and development-corpus diversity procedure

**Parser pinning adopted unchanged (archived detail).** Extends Paper 1's `item_parser.py`/
`corpus_probe.py` lineage; fully committed, hashed, versioned, and sealed before jurisdiction survey
or confirmatory acquisition begins.

**Development-corpus diversity procedure (new, RND3-003, fully specified):** before inspecting any
document content, freeze: the eligible development-jurisdiction list; allowable metadata sources and
proxy fields (file type; stated accessibility; scan/text status when explicitly reported; page
count or byte size when exposed without opening content; modular-vs-single-volume publication;
previously documented publisher-format conventions — never model performance or informal browsing);
the structural-diversity scoring rule; deterministic tie-breaking; the initial selection size (3–5
jurisdictions, per DEC-003); a complete ranked reserve order; the diversity-adequacy test; the
maximum expansion size and stopping rule. Permanently designate the initial selections and the full
reserve jurisdictions as development-only **before any document is opened or downloaded**. After
acquisition, assess actual structural coverage using the frozen rule; if inadequate, add the next
reserve jurisdiction mechanically — never a discretionary swap for one that "parses poorly" or
"lacks the anticipated structure." Every inspected/acquired jurisdiction, including activated
reserves, is permanently barred from confirmatory/challenge roles.

---

## Appendix F — Provenance-completeness rubric, licensing

**Adopted unchanged (DEC-018) plus per-document licensing (DEC-035).** Hard gates (binary, no
partial credit): eligible issuing authority; official/permitted source; edition identity;
publication/effective chronology; complete document/modular set; file-format validation; structural
integrity; no unresolved truncation; SHA-256 + byte size; duplicate-byte status resolved;
mutable-URL status investigated; protocol scope established; license/research-use status
recorded/compatible; parser-readiness disposition completed; independent eligibility agreement.
Soft flags: closed list, logged only, never scored, never a tie-break. Byte-identical copies across
official URLs = one document identity; canonical source by a prespecified mechanical rule
(publisher-primary first, stable official archive second).

**Licensing/redistribution (DEC-035):** determined per document. Public availability is never
automatically public-domain/redistribution authorization. Recorded per file: publisher/rights
holder; official source URL; stated copyright/license; public-domain basis; terms-of-use
restrictions; permission correspondence; redistribution classification; reviewer/decision date.
Three release classes: (1) full-byte redistribution permitted; (2) redistribution unclear/restricted
— metadata/URL/filename/size/checksum/retrieval instructions only; (3) redistribution prohibited/
access-controlled — provenance record and reproducibility instructions only. Uncertain cases
reviewed through institutional/library/legal guidance where available.

---

## Appendix G — Statistical analysis plan

### G.1 Primary confirmatory question

Does M4 (of whichever suffix) improve recommendation-counterpart recovery beyond M3 (of the matched
suffix), on a prospectively selected cohort of successive EMS protocol editions? M3 and M4 share
every component except assignment-aware alignment (DEC-027, RND2-002, RND2-003).

### G.2 Primary outcome

Pair-macro-averaged bidirectional set F1. Edge cases: both sets empty → F1=1; exactly one empty →
F1=0; partial split/merge recovery gets partial credit; `CANNOT_DETERMINE` excluded from the primary
denominator per §G.6, counts reported.

### G.3 Predicted-set policy

**Structure frozen, value from the pilot (FND-002).** A frozen maximum predicted-set size exists;
outputs above it are protocol-invalid, never silently truncated, manually corrected, or selectively
rerun. Before freeze, specify: whether the cap applies separately per direction; whether the same
cap applies to every method; empty-prediction handling; scoring of over-cap/malformed/duplicate-
containing outputs; interaction with abstention; logging/abort thresholds for invalid outputs;
sensitivity analyses with alternative caps. Justified from the frozen development corpus's observed
split/merge set sizes — provisional benchmark 5, never revised using confirmatory relation sizes or
performance.

### G.4 Aggregation

Design-weighted within-direction statistic given disproportionate stratified sampling (Appendix
H.5): `F1_bar_jd = Σ_h (M_jdh / M_jd) · F1_bar_jdh`. Equal weight to both directions per pair, equal
weight to every pair in the cohort estimate.

### G.5 Primary analysis and inference

**Hierarchy corrected (DEC-029):** the exact pair-level sign-flip/permutation test is the **primary
hypothesis test**; the pair-level bootstrap is the **primary confidence interval**; paired-*t* is a
**sensitivity analysis only** — reversed from a paired-*t*-primary design, given the confirmatory
cohort may contain only ~15–18 pairs. The statistical reviewer must fully specify, before freeze:
the exact null hypothesis; exchangeability assumptions; the test statistic; whether enumeration is
full (2^J) or Monte Carlo (and why); treatment of exact-zero differences; the precise relationship
between the sign-flip test and the bootstrap interval.

**Concordance rule (FND-003):** the primary statistical-superiority claim is supported only when
*both* the sign-flip test rejects H0 at the frozen alpha *and* the bootstrap CI's lower bound
exceeds zero. If only one condition is satisfied, the primary result is reported inconclusive — the
more favorable reading is never selected. Practical importance is assessed separately: **three
possible conclusions** — no confirmed statistical superiority; confirmed statistical superiority
without established practical importance; confirmed statistical superiority with practical
importance established.

### G.6 Secondary and exploratory outcomes

**Estimation-only, no adjusted hypothesis tests (RND2-001).** Report effect sizes, denominators, and
nominal confidence intervals — never secondary p-values, a declared confirmatory family, binary
verdicts, or interval-exclusion-of-zero treated as confirmatory. Secondary intervals are explicitly
labeled non-simultaneous, descriptive. **Sparse-outcome rule (RND3-CL-003, timing tightened
FIN-002):** the interval-eligibility threshold and method are frozen **before confirmatory sampling
begins**, never chosen after relation counts are observed; a confidence interval is reported for a
secondary outcome only where the observed sample size supports a statistically meaningful interval;
outcomes too sparse (e.g., a 1–3% relation rate at single-digit counts) report only counts,
denominators, and an explicit non-estimability statement. Secondary outcome list: exact-set
accuracy; set precision/recall; old→new vs. new→old separately; no-successor detection; new-
recommendation detection; candidate recall at frozen k; M1-vs-M2, M2-vs-M3-R diagnostics;
abstention/indeterminate rates; annotation/adjudication workload (U-005). If any secondary outcome
is later proposed for confirmatory status, this requires a substantive planning revision before the
statistical plan is frozen, or a genuine Class-3 amendment after freeze (Appendix J.1) — never added
once results are visible.

**Descriptive, not estimation-required (DEC-029):** split and merge recovery — counts, denominators,
estimates and uncertainty where meaningful, explicit limitations, never elevated to confirmatory
status without a separately approved sampling/weighting design.

### G.7 Required sensitivity analyses

Adopted unchanged (archived list): Tier-2 pair exclusion; `COMPOSITE_UNRESOLVED`/`CANNOT_DETERMINE`
staged thresholds; direction; weighting; leave-one-pair-out influence; cohort-size robustness; set-
scoring alternatives (exact-set accuracy, Jaccard) as interpretation aids only, never a primary
substitute.

### G.8 Practical importance threshold — blinded charter

**New mechanism (RND3-001, constrained FIN-004).** The statistical reviewer sets and documents the
practical-importance threshold **without access to the observed development-set M4-versus-comparator
effect estimate, its direction, confidence interval, or pair-level differences.** Justified via a
prespecified threshold-setting charter: clinical/operational interpretation; expected human-review
burden reduction; consequences of incorrect/missed correspondences; the absolute scale and
mathematical behavior of set F1; simulation-based precision/decision properties; external
methodological evidence. M4's development performance may be computed for engineering/configuration
purposes, but its **comparative effect** is never communicated to the statistician before the
threshold is committed, timestamped, hashed. After commitment, development results may describe
**computational/operational feasibility only** (runtime, throughput) — never M4's comparative
effect, at any point, even post-commitment. An inadvertent unblinding before commitment is a
documented breach, triggering an independent replacement reviewer or the full-blinding fallback.

### G.9 Power and precision — blinded scenario range

**New mechanism (RND3-002, constrained FIN-004).** Cohort-size/statistical-floor planning is based
on: the independently-committed practical-importance threshold; a prespecified range of smaller/
equal/larger plausible effects; Paper 1's pair-level variability (historical evidence only,
conservatively inflated for the broader prospective task — never M4's own point estimate);
simulations across plausible heterogeneity, missingness, indeterminate rates, weighting variation,
pair attrition; the exact-test p-value granularity at each candidate pair count; confidence-interval
precision targets; confirmed reviewer workload and eligible-jurisdiction feasibility. The
statistician never receives M4's observed comparative effect, direction, interval, or pair-level
differences when setting the floor; no discounted version substitutes. The floor is selected from
inferential validity/precision requirements across the prespecified scenario range, not the scenario
most favorable to M4. Operating characteristics reported for every evaluated pair count and effect
scenario. Post-commitment, M4 development results describe computational/operational feasibility
only — never lower the floor, change the effect range, or revise the threshold.

---

## Appendix H — Recommendation-sampling protocol

### H.1 Timed pilot

**Folded into the Unified Development Feasibility and Calibration Pilot, module 3 (FND-008).** Not
yet run.

### H.2 Provisional planning placeholders

15–18 pairs / ~20 queries per direction survive only as **feasibility-testing scenarios** (DEC-008),
never adopted commitments.

### H.3 Census threshold for small inventories

**Structure adopted, multiplier deferred to N (DEC-023).** `n_jd = M_jd` if `M_jd ≤ floor(1.5×N)`,
else N. Evaluated during pilot modules 6/8; not frozen until N and reviewer capacity are
established.

### H.4 Sampling frame and batch timing

**Batch only, never rolling (RND2-004).** Sampling begins only after the complete confirmatory
cohort is finalized, validated, hashed, and sealed — the full stratified sampling frame/allocation
executes as one auditable batch event. Reasons (adopted from the archive, re-confirmed): prevents
annotation work on a later-replaced pair; ensures every sampled pair belongs to the final sealed
cohort; one auditable sampling event; consistent frozen-parameter application; prevents early
annotation findings from influencing later decisions; prevents reviewer-learning bias across pairs;
simplifies inclusion-probability verification. **No rolling confirmatory sampling, annotation, QC
practice, or reviewer training on pairs merely because they clear QC early** — reviewer training and
workflow rehearsal use development-only materials exclusively. Workload compression is addressed
through acquisition scheduling, reviewer availability planning, prespecified annotation batches
after sealing, and timeline extension — never through early exposure to confirmatory samples.

### H.5 Structural strata, allocation, weighting

**Adopted unchanged, explicitly separate from clinical routing (DEC-022).** Four mutually-exclusive
structural strata (decision-branch, table-derived, dosing-parameter, plain-single-action), fixed
precedence, guaranteed-minimum quarter allocation with deterministic shortfall redistribution — used
*only* for sampling-frame construction. Clinical-review routing (DEC-004) applies independently
after an item is sampled, recorded as a separate variable from primary sampling stratum. Structural
strata are never redefined around reviewer qualifications; clinical routing never changes inclusion
probability or replaces sampled items.

### H.6 Duplicate/overlapping queries

**Adopted unchanged (DEC-023).** NOT deduplicated before sampling — each location-specific semantic
recommendation stays a distinct frame unit; duplicates flagged and tracked (exact/near-duplicate
group IDs, occurrence locations, contextual metadata); sampling stays at occurrence level; a
counterpart judgment is never auto-copied across occurrences; a prespecified sensitivity analysis
caps each duplicate group to equal total weight.

### H.7 Unscorable-sample replacement

Adopted unchanged (archived detail): Category A (frame-ineligible, replacement permitted via the
frozen reserve order) vs. Category B (valid recommendation, indeterminate correspondence,
replacement prohibited — follows Appendix G.7's missing-reference rules).

---

## Appendix I — Reviewer training and annotation-quality gates

### I.1 Reviewer qualifications and independence

**Clinical-qualification standard adopted unchanged (FND-001).** A reviewer satisfies the clinical
floor if currently/previously licensed EMS clinician, EMS physician, or clinician with documented
prehospital protocol experience; ≥1 year relevant experience; documented familiarity with dosing,
treatment algorithms, contraindications, population distinctions, protocol interpretation; the same
study-specific training/calibration/retraining/drift/recusal rules as every reviewer. EMS educators
or paramedic-level professionals may qualify when they satisfy this standard through credentials,
documented experience, and demonstrated familiarity. **The standard is never broadened or lowered
because recruitment is difficult** — if no qualified candidate is available, the staffing-
infeasibility and timeline rules apply instead. Clinical-floor **trigger** (DEC-004, broader than
the archive): decision-branch and dosing-parameter strata; any query in any stratum where
correspondence depends on clinical equivalence, changed indications, contraindications, population,
route, dose, timing, treatment intent; any reviewer-flagged escalation; uncertainty defaults to
clinical review.

### I.2 Training materials and Training Lead

**New role assignment (FND-006).** The investigator may prepare initial training materials, rule
summaries, and development-only worked examples. Before reviewer training/calibration begins, the
adjudicator, acting as Training Lead, independently reviews and approves: category coverage; example
selection; answer keys; scoring logic; boundary/correspondence rationales; clinical-escalation
triggers; calibration-set difficulty; absence of confirmatory material; consistency with the frozen
protocol. The Training Lead must not be evaluated by the same undisclosed calibration key they
approved; if the adjudicator also performs initial correspondence review, key approval/scoring for
that person's own qualification goes to another qualified reviewer. Clinically sensitive examples
also receive clinical verification from a non-self-grading person. Approved training/calibration
packages frozen and hashed before reviewer qualification.

### I.3 Calibration metrics and thresholds

**Adopted unchanged (DEC-024), all five gates and the 3-attempt limit apply to every confirmatory
correspondence annotator regardless of team size** — no reduced gate count, no lowered thresholds.
Metrics/denominators/thresholds/calibration-set difficulty validated on development-only materials,
then frozen; not changed in response to an individual reviewer's performance after qualification
begins.

**High-risk categories (FND-010):** split; merge; new/no-predecessor; no-successor; decision-branch/
algorithm; table-derived; dosing-parameter; moved; heavily-rewritten. Operational definitions
(directionality, multi-label membership, precedence, distinction from sampling strata/clinical
routing/relation labels/QC flags) frozen before use; minimum counts from the pilot; no confirmatory
sampling quotas for rare relation types without a separately approved probability-sampling design;
new categories may be logged exploratorily but a new *mandatory* category requires documented
approval before confirmatory sampling.

**Failure contingency:** if either sole reviewer fails to qualify after three total attempts —
disqualify, recruit/train a replacement under identical frozen requirements, recalculate feasible
cohort size/query count/timeline/capacity, delay or invoke the infeasibility rule if adequate
staffing cannot be secured, never lower the standard to retain the planned cohort.

### I.4 Drift monitoring, QC re-review, fatigue controls

**QC/drift folded into the adjudicator (DEC-025).** The adjudicator, remaining independent of model
development, administers blinded gold/repeat items, calculates prespecified agreement/drift metrics,
triggers pauses under frozen thresholds, conducts independent QC re-review, adjudicates disagreements
when uninvolved in the original judgment, documents retraining/recertification/restart decisions.
Cannot serve as either initial reviewer for queries they adjudicate or QC-review. QC items selected
through a frozen procedure; scoring mechanical; no threshold changes after viewing production
results; recusal to another qualified person when the adjudicator contributed an initial judgment.
Gold-item rate, batch cadence, drift thresholds, pause rules, recertification procedure validated on
development-only pilot data. A minimum additional qualified person is recruited only if one person
cannot perform the combined function without conflicts or excessive workload.

**Adjudication trigger (DEC-026):** mandatory whenever the two initial reviewers' sets are not
exactly identical — no Jaccard/similarity shortcut. Mandatory adjudicative review of double-empty
agreement in high-risk categories (shared omission ≠ agreement).

**Fatigue/workload controls (DEC-026):** apply to the adjudicator's *combined* adjudication/QC/
drift-monitoring workload — maximum items/minutes per session/day, required breaks, maximum
consecutive high-complexity items, batch size/cadence, turnaround expectations, pause rules, set
from the pilot, frozen before confirmatory annotation, never relaxed informally. Overload triggers
prespecified sample-size/scheduling adjustment, timeline extension, or limited recruitment — never a
standards change.

### I.5 Adjudication, fatigue, abort, sealing

Adopted unchanged (archived detail): strict `A=B` agreement requirement; Jaccard is an agreement
statistic only, never a shortcut; adjudicator reviews blind to model output; reference-standard
abort conditions (cannot staff after 3 attempts, an unresolved drift pause, a defective reference
key, copied/fabricated answers) route to documented stop-and-escalate; sealing requires every
disagreement adjudicated or `CANNOT_DETERMINE`, QC re-review complete, audit trail intact, final
hash computed, investigator + custodian sign off.
*(See Appendix D.3 for the full cross-reference list of this protocol's other pause/abort/halt
points.)*

---

## Appendix — Unified Development Feasibility and Calibration Pilot (new, FND-008)

Run only on the frozen development corpus, one approved pilot protocol, shared identifiers,
versioned instruments, single audit trail. Nine sequential/dependency-gated modules:

1. Parser and extraction validation.
2. Recommendation-unit boundary and grouping validation.
3. Correspondence-annotation timing and agreement.
4. Clinical-escalation, adjudication, QC, and drift workload.
5. Fatigue, batch-size, and reviewer-capacity validation.
6. Sampling, census-threshold, duplicate, reserve-list, and weighting behavior.
7. Predicted-set-cap and invalid-output validation.
8. Pair-count, query-count, precision, power, and inference simulations — **blind to M4's
   comparative development-set effect** (RND3-002, FIN-004).
9. End-to-end operational rehearsal without confirmatory data.

Each module: prespecified inputs, outputs, success criteria, responsible roles, revision rules.
Later modules begin only when dependencies pass. May produce empirical inputs to freeze thresholds,
never tuned to favorable model results. A targeted repeat only after a documented development-only
failure, applied consistently, never selectively. All pilot versions preserved; every rule change
reported.

---

## Appendix — M1/M2 development-only tuning rubric (new, RND2-002)

Before tuning begins, freeze: candidate algorithms and parameter ranges; text preprocessing/
tokenization choices; dense-model eligibility/version requirements; fusion method and candidate-
depth ranges; development-only evaluation metrics; **pair-grouped** (not item-grouped)
cross-validation procedure; aggregation/tie-breaking rules; computational budget; maximum
configuration count; stopping rule; failure/missing-output handling; reproducibility/licensing
criteria. Every attempted configuration, seed, score, runtime, failure, selection decision
preserved. No search-space expansion in response to disappointing results without a documented
pre-freeze revision. M1/M2 configurations frozen and hashed before confirmatory work. M3-R/M3-NR
inherit the frozen M2 pipeline exactly, adding only the reranking stage (or nothing); M4-R/M4-NR
inherit the identical frozen pre-assignment pipeline exactly, adding only assignment-aware
alignment.

---

## Appendix J — Protocol-deviation decision tree

**Adopted unchanged (DEC-033, DEC-034), with the planning-revision-vs-amendment boundary corrected
(RND3-CL-002).**

| Class | Authorized by | Re-freeze? | Manuscript reporting |
|---|---|---|---|
| **0. Planning revision** *(new distinction, RND3-CL-002)* — a change made *before* the affected provision is frozen | Investigator, under DEC-011's verbatim discipline | No — it is not yet frozen | Reflected directly in the frozen version once reached |
| **1. Clerical** (no cohort/analytic effect, post-freeze) | Any named investigator | No — changelog entry | Protocol-version changelog |
| **2. Rule-governed data-integrity correction** | Whoever the invoked rule already names | No — execution logged | Via the rule's own artifact |
| **3. Pre-unblinding amendment** (genuine change to an *already-frozen* provision, before reference-standard sealing) | Investigators + custodian + independent methodological reviewer | Yes — protocol_version increments | Full protocol-deviation appendix |
| **4. Post-unblinding deviation** | Highest bar: all named investigators + custodian + written pre-commitment not outcome-motivated | Frozen primary analysis never silently revised (Appendix J.2 exception) | Primary reported as frozen; deviation reported separately, exploratory |
| **5. Exploratory change** | Research-team discretion | No | Exploratory-results section only |

### J.1 Class 3 pause procedure

Adopted unchanged (archived detail): full pause of everything reasonably capable of being affected;
documented amendment proposal with immutable ID; investigator review blind to model results;
independent methodological reviewer assesses bias risk/scope/confirmatory viability; new verbatim
dated approval before resuming; version increment/hash/preservation; prospective application under
the frozen cutoff; documentation of required rework/exclusion. If the amendment occurs after any
relevant unblinding or outcome access, routes to the stricter post-unblinding rules instead.
*(See Appendix D.3 for the full cross-reference list of this protocol's other pause/abort/halt
points.)*

### J.2 Class 4 implementation-bug exception

**Verifier mapped to established roles (DEC-034).** Statistical/analysis-code bugs → statistical
reviewer; parser/data-transformation/cohort-application/annotation-processing/model-execution/other
implementation bugs → independent methodological reviewer; mixed bugs → joint review. No
self-verification without an additional qualified reviewer. Bug existence/origin/scope/correction
established before examining effect on the result wherever technically possible. Original output
always preserved and reported alongside the correction with a complete audit trail. Confirmatory
status follows the frozen post-unblinding bug rule, never decided from the corrected effect. If
reviewers cannot agree it's a mechanically-verifiable implementation bug (not a protocol/cohort
change), the original registered analysis stays primary and any correction is exploratory.
**Cohort-composition changes are categorically excluded from this exception — governed instead by
Appendix D.10's absolute bright line.**

---

## Appendix K — Literature and novelty workstream (finalized under AUTH-003)

**This appendix reconciles every previously-adopted literature-workstream provision (DEC-032,
COR-005, FND-013) plus the archived Paper 2 protocol's scope/rubric/role-separation/source-
classification content (historical reference, independently re-adopted here, not imported by
silence) into one auditable protocol. Its existence, however complete, does not authorize search
execution — execution requires its own separate stage authorization under FND-011 (K.19).** Runs in
parallel with development-track work; touches only published literature and development data.

**Sequencing (FND-013):** the approved search must complete and be reviewed *before* M1–M4, the
comparator, primary estimand, practical-importance threshold, and confirmatory analysis plan are
finalized/frozen. Revisions during this pre-freeze stage are ordinary planning revisions (Appendix
J, Class 0), not Class-3 amendments. After freeze, a literature-driven change routes through Class 3
— never Class 4 (K.16).

### K.1 Purpose and topic scope

Two purposes, kept structurally distinct: (a) **design-informing** — evidence that may inform M1–M4
method-family selection, the comparator definition, the primary estimand, threshold-setting
evidence (via the statistical reviewer's blinded charter, Appendix G.8), and the confirmatory
analysis plan, only before freeze; (b) **novelty-claim support** at manuscript stage (K.15), which
remains revisable against later evidence even after the confirmatory design is frozen.

**Topic scope (adopted, extended unchanged from the archive):** recommendation evolution/
versioning; document/protocol alignment across editions; entity resolution and record linkage;
dense retrieval; neural reranking and cross-encoder relevance models; graph/bipartite matching and
assignment algorithms; set-valued prediction and structured output; legislative/regulatory-text
alignment and change-tracking; clinical-guideline-updating informatics specifically; coreference/
entity-linking evaluation methodology; EMS/prehospital-protocol informatics specifically.

### K.2 Method-eligibility rubric (adopted, unchanged in substance from the archive)

Scores every candidate prior method against the four dimensions defining M4's claimed contribution:
(1) full-edition search vs. restricted-candidate; (2) assignment-aware/globally-consistent matching
vs. greedy pairwise; (3) explicit split/merge/no-successor/new-recommendation handling; (4)
set-valued vs. single-best-match output. Frozen before use. A prior method clearing all four
dimensions must be surfaced in the manuscript, never omitted, regardless of how it affects the
novelty claim — the same disclosure discipline as Paper 1's standing rule on convenient results
(`../planning/FINAL_PLANNING_PACKAGE.md` §14).

### K.3 Databases and sources (redesigned as a two-lane strategy after independent review found AUTH-007's single undifferentiated search inadequate — `AUDIT_LOG.md` Entry 014; full design and testing record: `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md`)

Appendix K now separates a narrow, task-focused search (**Lane 1**) from a structured review of the
broader method landscape (**Lane 2**) — see K.4 below for why. Source roles differ by lane:

- **Core, for Lane 1 search:** PubMed/MEDLINE; OpenAlex. Both independently passed sentinel
  validation and produce completely, reproducibly exportable result sets at the recommended query
  width (`TWO_LANE_SEARCH_DESIGN.md`).
- **Core, for Lane 2's seeds and citation chaining:** arXiv (best coverage of the CS/NLP method
  literature K.1 names).
- **Supplemental only, not used for search execution in either lane:** Crossref (DOI resolution,
  dedup-key confirmation, citation metadata — three independent tests confirmed its relevance search
  cannot support this project's query styles at a workable scale, regardless of how narrowly the
  query is phrased); Semantic Scholar (never sentinel-validated — rate-limited on every attempt
  across this session; re-evaluated for core status only if access is arranged and it then passes
  the same sentinel gate as PubMed/OpenAlex).
- **Supplemental, verification-only role (never a corpus-contributing search):** Google Scholar
  (named-record verification or a bounded, human-conducted, screenshotted spot-check only — never a
  ranked/capped count presented as a search result); ACL Anthology (venue-scoped confirmation of
  specific NLP papers found elsewhere, not an independent broad search — its own site index returns
  no verifiable count).
- **Unavailable — reported honestly, not disguised by other sources' partial coverage:** ACM Digital
  Library; IEEE Xplore; EMBASE; CINAHL. No institutional access confirmed (unchanged since AUTH-005).
  OpenAlex or Crossref indexing *some* papers that happen to be published in ACM/IEEE venues is
  explicitly **not** treated as equivalent to searching those platforms' own indices.
- **Grey literature (K.8):** conference proceedings not indexed elsewhere; EMS-specific
  practitioner/professional-association publications; government/national-statistics-office
  data-science technical reports not indexed in any structured bibliographic database (e.g., the ONS
  Data Science Campus/NICE "NORMA" tool, per K.4a) — background/context only, never K.2's
  method-eligibility determination alone.

A dedicated legal/regulatory-text-alignment-specific index was considered and dropped (LIT-001): EMS
protocols are not legislative text, and the NLP/IR venues above already cover the relevant
methodology; Lane 1's legislative sub-family (below) covers the legislative-text-alignment
*methodology* literature K.1 separately names.

**Placeholder:** `[INSTITUTIONAL_ACCESS_CONFIRMATION]` per subscription database, to be resolved
before that database's query executes; a database without confirmed access by the execution window
is logged as `NOT_AVAILABLE` with a reason (K.18), never silently dropped without a record.

### K.4 Two-lane search design (redesigned 2026-09-02 after independent review; full candidate
queries, tested counts, and sentinel evidence: `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md`)

**Why two lanes.** AUTH-005's exact-phrase design returned zero results (too narrow). The
AUTH-006/AUTH-007 four-block, six-family redesign fixed that but, tested at scale, produced result
universes up to 3,383,372 (OpenAlex) with only a 200-record capped sample exported per
source/family — neither a complete export nor a prespecified probability sample, and therefore not a
valid design-informing search (`AUDIT_LOG.md` Entry 014). The root problem was combining two
structurally different questions into one query architecture: a narrow, answerable question this
study is actually about (how recommendations/guidelines/protocols/bills change across versions, and
how others have matched or tracked that change), and a broad background landscape (general retrieval/
matching/set-prediction methodology) that K.1 also lists in scope. Separating them lets each be
searched in a way that is actually complete and reproducible.

**Lane 1 — task-focused systematic/scoping search.** Narrow, established, multi-word phrases for the
change/version concept (not bare generic words, which collide with unrelated literature) ANDed with a
domain-specific textual-unit concept, in both the clinical-guideline and legislative/regulatory-text
domains K.1 names. **Locked default, MeSH-expanded** (a third-pass search-quality strengthening,
tested and adopted: adding PubMed MeSH headings "Practice Guidelines as Topic"/"Guidelines as Topic"
raised the clinical family from 680 to 1,179 with no sentinel lost and exact pagination
reconciliation): PubMed 1,179 + OpenAlex 1,335 (clinical, narrow-unit, MeSH-expanded, now the sole
default) plus OpenAlex 912 (legislative, core) + PubMed 50 (legislative, narrowed to a non-blocking
supplementary attempt — no PubMed-indexed legislative sentinel exists to validate it against). The
broad-unit clinical variant is retained only as a documented sensitivity alternative, not the default.
**On-task sentinel status (fourth-pass component-validation framework, K.4a below):** the legislative
sub-family is validated by two genuinely on-task, indexed sentinels (S7, S8 — both confirmed, from
their own full text, to perform legislative-text counterpart alignment, and both confirmed retrieved).
The clinical sub-family is validated **componentwise**, not by a single exact-intersection
requirement: it is confirmed retrieved against verified sentinels for clinical guideline/protocol
maintenance terminology (S5, S6 — component a) and, via Lane 2, genuine document/version-alignment
methods (S9, S10 — component b); **no exact clinical recommendation-counterpart-alignment sentinel is
known to exist** (component d has no eligible sentinel to require), and this absence is explicitly
**not** treated as either a pass or as proof of novelty — it becomes an empirical research-gap
conclusion only once the completed official search, K.6 screening, and K.8 citation chaining actually
run and find none. Full block definitions, exact final query strings, family formulas, the
component-validation framework, and the broad-unit alternative are in `TWO_LANE_SEARCH_DESIGN.md`.

**Lane 2 — structured method-landscape review.** Not a database search. A small, prespecified,
identifier-verified set of seeds (a survey/tutorial where one exists, otherwise a verified landmark
paper or, for the version/sentence-alignment method area, a directly on-task paper confirmed to sit
outside Lane 1's domain-restricted search) covering lexical retrieval, dense retrieval, reranking,
entity resolution and assignment/global matching (jointly, via one entity-matching survey whose scope
already spans both), and version/document alignment plus sentence alignment (K.1's method-scope
items), extended by **one round of citation chaining only where that chaining is itself a manageable,
fully-exportable size** — tested directly per seed (citation counts range from 17 to 3,116 across the
seven retained seeds; five are chainable with real backward+forward totals of 54–269 records each,
697 combined pre-dedup). The two most highly-cited seeds (BM25 survey, ColBERT) are included as direct
manual anchors instead of chaining points, since chaining from them would reproduce the same
uncontrolled-scale problem this redesign exists to fix. Two seeds from the original design were
**removed**: DETR (no precise, study-specific justification tied it to M4 or its evaluation) and, on
third-pass review, **conformal prediction** — checked directly against `DECISION_REGISTER.md`'s
verbatim FND-002 text, which specifies only a fixed predicted-set cap with no calibration set,
nonconformity score, or coverage-guarantee mechanism named anywhere in the protocol; a plain top-*k*
cap satisfies FND-002 equally well, so the cap alone does not establish that this study's planned
method uses conformal calibration. Both removed scopes are now covered on-domain by seeds already in
the table rather than by remote cross-domain analogies. **Lane 2 is never presented as an exhaustive
search of the IR/entity-resolution/matching literature** — its K.9 records carry a source-type tag
(`SEED`, `SEED_CITATION_FORWARD`, `SEED_CITATION_BACKWARD`) distinguishing them from Lane 1's
search-derived records.

**Yield-feasibility gate:** a candidate query or citation-chaining pass is evaluated on its total
count and whether that count is completely exportable — never on inspecting which specific records
would be retrieved. No final screening-burden threshold is fixed here since the appointed reviewer's
real capacity is not yet known (`TO_BE_APPOINTED`); `TWO_LANE_SEARCH_DESIGN.md` provides a workload
table (records × screening-time-per-record, at three candidate rates) for the investigator to apply
once capacity is known, rather than an invented number. **This capacity gate is a required
pre-execution blocker, not merely an open item** — its absence is one of the concrete blockers named
in `TWO_LANE_SEARCH_DESIGN.md`'s third-pass PASS/FAIL determination (overall result: **FAIL**).

**AUTH-007's real evidence (query syntax validity, true total counts, per-source sentinel behavior)
is preserved and reused as feasibility input to this design — not discarded, and not treated as the
completed search.**

### K.4a Sentinel-paper validation gate

**Status:** the K.4a discipline (frozen, identifier-verified, indexed-only sentinels; a miss pauses
execution and requires a documented correction before proceeding) is unchanged and applies to Lane 1
and Lane 2 exactly as before — see `SENTINEL_BIBLIOGRAPHY.md` for the ten verified sentinels (S1–S8
from the first pass; S9/S10 added specifically to test on-task version-alignment coverage) and
`SENTINEL_VALIDATION_LOG.md` for the validation record that produced the current query translation.
**Third-pass correction:** every sentinel claimed as "directly on-task" must now be re-verified from
its own full text, not title terms — this found S5 (previously the strongest claimed clinical
sentinel) actually performs evidence surveillance, not version-to-version counterpart recovery, and
disqualified it; S7 and S8 were confirmed, from their own text, to genuinely perform legislative-text
counterpart alignment. Because no exact clinical-domain counterpart-alignment paper is known to exist
in the literature this session searched, the third pass initially treated the clinical sub-family as
failing outright — a fourth-pass correction found this treatment circular (it demanded proof that the
very literature gap the study exists to test was already filled) and replaced it below.

**Fourth-pass correction — component-validation framework (replaces the single exact-intersection
requirement):** K.4a's on-task-sentinel gate does **not** require that an exact clinical
recommendation-counterpart-alignment paper already exist before Lane 1's clinical sub-family can be
treated as validated. Instead, each Lane 1/Lane 2 family is validated component-by-component, and each
component needs a verified, eligible sentinel **only where that kind of literature is known to
exist**:

- **(a) Clinical guideline/protocol maintenance and version/change terminology** — verified sentinels
  exist (S5, S6) and are confirmed retrieved by the locked, MeSH-expanded PubMed clinical family.
- **(b) Genuine document/sentence/version-alignment methods** — verified sentinels exist (S9
  Kuznetsov, S10 Vecalign), confirmed real and indexed, serving Lane 2's version/sentence-alignment
  seed area (not a Lane 1 clinical-family retrieval claim, since both are domain-general).
- **(c) Legislative or regulatory cross-version/text-reuse precedents** — verified sentinels exist
  (S7, S8) and are confirmed retrieved by the locked OpenAlex legislative family.
- **(d) Retrieval of any known exact clinical precedent, if one is identified** — none is known to
  exist in this bibliography as of this pass (S5 does not qualify here; see below). This component has
  no sentinel to require *because none is known to exist*, not because the requirement was waived.

**The absence of an exact clinical precedent (component d) is neither a PASS nor proof of novelty
before execution.** It becomes an empirical research-gap conclusion only if the completed official
search, screening (K.6), and citation chaining (K.8) are actually run and genuinely find none — never
asserted in advance from a design-stage literature check alone. **S5 is preserved as ineligible for
component (d)** (it is not an exact-task sentinel — verified from its own text, third pass) but **may
serve component (a)**, where it is genuinely eligible (clinical guideline-maintenance/evidence-
retrieval terminology, confirmed retrieved).

**Abort rule (component-level, replacing the prior single-gate rule):** before official execution, each
of components (a), (b), and (c) — the components where sentinels are known to exist — must have its
sentinel(s) confirmed retrieved by the locked query/seed set actually used. **A failure to retrieve a
required component's sentinel pauses execution for that component specifically** and requires a
documented, prospective correction (a query revision, a source-classification change, or an explicit
scope narrowing) before that component is used again — mirroring K.4a's existing sentinel-miss-pause
rule, now applied per component rather than as one all-or-nothing gate. Component (d) has no abort
condition, since it has no sentinel to miss; its status is simply logged as "no known precedent
identified this pass," carried forward for the official search to test.

**Independent review found one instance where this discipline was not actually followed
through to execution**: Crossref's own sentinel test failed (a full translated block returned 0
results for a known-indexed sentinel that a short natural-language query for the same record
retrieved), yet AUTH-007 still executed the identical failing-style query against Crossref rather
than pausing that source's execution — corrected in this redesign by removing Crossref from active
search execution entirely (K.3), not merely re-disclosing the same limitation and proceeding again.
Semantic Scholar, Google Scholar, and ACL Anthology remain **not sentinel-tested**; none may be
treated as validated, and Lane 1/Lane 2 execution does not depend on them (K.3's supplemental/
verification-only classification for all three).

Before any official Lane 1/Lane 2 execution, each database translation actually used for search must
be tested against the frozen sentinel set, and **a miss must pause that source's execution** — not be
logged as a caveat while the same query runs anyway. The official search begins only after the
complete translation table and sentinel test are approved for every source it will actually query.

### K.5 Eligibility and exclusion criteria (draft)

**Include:** peer-reviewed work, or arXiv/ACL-Anthology preprints; describes a method or evaluation
directly relevant to at least one K.2 rubric dimension or K.1 topic-scope item; available at minimum
as an English abstract (full non-English text triaged case-by-case, logged).

**Exclude:** opinion/editorial pieces with no described method or evaluation; a preprint superseded
by its own published version (K.7 retains only the most complete/final version, cross-referenced);
work with only superficial keyword overlap and no substantive relevance to K.1's scope (a logged
screening judgment, not a silent drop).

No eligibility criterion may be relaxed or tightened after screening begins to manufacture or avoid
a particular novelty conclusion (K.2's disclosure discipline).

### K.6 Screening procedure (redesigned as an AI-assisted structured workflow, LIT-005–LIT-009,
2026-09-03 — supersedes LIT-003's single-human-stage-1-screener arrangement)

**This is an "AI-assisted structured literature review," explicitly not a conventional fully human
dual-screened systematic review** (K.6's own transparency requirement, restated from `AI_ASSISTED_
SCREENING_DESIGN.md` §1/§7). The investigator determined that personally screening the full Lane 1 +
Lane 2 pre-dedup workload (~4,173 records) as sole title/abstract screener is not feasible. Full design,
freeze checklist, calibration plan, workflow, exclusion-audit stratification/escalation ladder, workload
formulas, and transparency requirements: `protocol/literature-search/AI_ASSISTED_SCREENING_DESIGN.md`;
the operational worksheet: `protocol/literature-search/SCREENING_VERIFICATION_INSTRUMENT.md`.
**Redesign only — not execution.** No AI model has been selected, configured, run, or calibrated as of
this pass; no record has been screened.

**Stages (two-stage structure preserved, mechanism changed):** (1) a frozen, calibrated AI system
classifies every deduplicated title/abstract as `INCLUDE`/`EXCLUDE`/`UNCERTAIN` with reason codes
against K.5/K.2 (mechanical, not itself an eligibility decision — an AI classification never
substitutes for required human eligibility authority, K.19); (2) full-text screening of everything a
human confirms as eligible, scored against K.2's rubric, unchanged from the prior K.6 structure.

**Reviewer arrangement (LIT-005–LIT-009, staffing confirmed 2026-09-03):** **Mohamed Faisal Sindhi
(investigator) is preserved as investigator and as the primary human verifier** — no longer the
mandatory reader of every record, but the mandatory human reviewer of every AI `INCLUDE` and every AI
`UNCERTAIN` record, and of a reproducibly sampled, blinded, stratified audit of AI `EXCLUDE` records
(design, strata, seed, and a frozen escalation ladder: `AI_ASSISTED_SCREENING_DESIGN.md` §6). The
former "stage-2 checker" role is redesignated the **screening adjudicator** — resolving AI-vs-human and
human-uncertain disagreements and absorbing escalation-ladder capacity — remaining `TO_BE_APPOINTED`
(Dr. Nasir Uddin one possible candidate, not assumed), but **required no later than the point human
verification begins** (after AI classification completes, immediately before the human-verification
stage starts) rather than before official search execution, since the AI classification stage itself
requires no human at all (`AI_ASSISTED_SCREENING_DESIGN.md` §8.2). If the appointee changes, a qualified
replacement follows the identical procedure and the change is logged. Freezing the AI system (model,
prompt, schema, settings, reason codes, batching/retry rules — `AI_ASSISTED_SCREENING_DESIGN.md` §3–§4)
and passing a development-only calibration gate emphasizing recall/sensitivity (§5) are **both required
pre-execution gates**, alongside the existing reviewer-capacity and independent search-strategy-review
gates (`TWO_LANE_SEARCH_DESIGN.md`), before official screening may begin.

**Exclusion-audit design:** the archived flat-10%-of-exclusions figure is reassessed, not assumed
adequate by carryover — `AI_ASSISTED_SCREENING_DESIGN.md` §6 documents three candidate designs and
recommends a stratified initial audit (reason code × risk tier, unequal sampling fractions) with a
frozen, three-level escalation ladder that expands audit coverage automatically — up to full-corpus
human review — the moment a real error is found, rather than a fixed percentage regardless of what the
audit uncovers. An isolated false exclusion is never silently corrected without invoking the ladder.

Disagreements are resolved by discussion and logged; an unresolved disagreement defaults to
inclusion through stage 2 rather than silent exclusion (unchanged).

### K.7 Deduplication procedure (draft)

Deduplicate by DOI first; then by normalized title + first-author + year; then by manual review of
remaining near-duplicates (preprint/published-version pairs, conference/journal-extended-version
pairs). Retain the most complete/final version; log the superseded identifier as a cross-reference —
never silently discard.

### K.8 Citation chaining and grey-literature handling (draft)

Forward/backward citation chaining is performed **once**, on the design-informing search's included
full-text set — not iteratively re-expanded, to keep the cutoff well-defined (K.11). Newly
surfaced candidates are screened under the identical K.5/K.6 procedure and logged with a
`CITATION_CHAINED` source classification (K.14). Grey literature (K.3) is logged and may inform
background/context discussion but never alone satisfies K.2's method-eligibility determination — a
method-eligibility claim requires a peer-reviewed or preprint-indexed source.

### K.9 Evidence-extraction record — field-drafted template (new, drafted under AUTH-003)

For every full-text-included source: citation/identifier (DOI/arXiv ID); title, authors, year,
venue; K.2 rubric score per dimension with written justification; task/domain; dataset(s) used;
reported metrics relevant to K.1's scope; stated limitations; source classification code (K.14);
reviewer name and date; extraction-confidence flag (low/medium/high) for cases routed to
adjudication under K.6's disagreement procedure.

### K.10 Literature search-log record — field-drafted template (new, drafted under AUTH-003)

Per database/query execution: database/platform name; exact query string as executed; filters
applied (date range, language, document type, field restriction); execution timestamp (ISO 8601
UTC); raw result count; export-file identifier and SHA-256 checksum; executing reviewer. Logged for
every execution, including failed/retried searches (K.12) and citation-chaining passes (K.8).

### K.11 Design-informing cutoff (adopted unchanged, COR-005)

**Current state:** no design-informing cutoff has been established. AUTH-005 was an incomplete
pilot of a sensitivity-deficient query design. A cutoff will be recorded only when the corrected,
approved search satisfies K.18.

The exact UTC timestamp at which the final approved database/source search completes and its
results/query/platform/filters/result-count/export-file/checksum are logged (K.10) — an event, not
a pre-picked calendar date. For multi-database searches: a separate execution timestamp per
database/query; the global cutoff = the latest completed approved search; no silent reruns/
additions after that point; failed searches route through the frozen retry procedure (K.12); later
searching is the separately-governed manuscript-update search (K.13).

### K.12 Retry procedure for failed or partial searches (new, drafted under AUTH-003 — fills a gap COR-005 named but left unspecified)

A search execution that fails outright (platform error, connectivity failure, no export produced)
is logged `FAILED` with the failure reason, then retried under the identical frozen query/filters;
the retry's own execution timestamp is the one counted toward K.11's cutoff calculation if the
original never completed. A search that completes but produces a truncated or incomplete export is
logged `PARTIAL` and retried in full — a partial result is never silently accepted as final.

### K.13 Manuscript-update cutoff and late-publication handling (adopted, LIT-004)

A prespecified update search: before the first complete manuscript draft; again within **30 days**
before submission (LIT-004, re-adopting the archived precedent); again before a major revision if
substantial time has passed.

Work published after the design-informing cutoff (K.11) but identified by a later update search is
handled as follows: acknowledged via a dated addendum in Discussion/Limitations, never reopening the
confirmatory analysis or M1–M4 configuration — **unless** it reveals a fundamental ethical or
validity problem, in which case it routes through Appendix J's Class-3 pre-unblinding procedure (if
before unblinding) or Appendix D.10's bright line (if after), never handled ad hoc outside those
mechanisms (K.16).

### K.14 Source classification codes (adopted, extended from the archive)

`DESIGN_INFORMING`; `POST_CUTOFF_PRE_ANALYSIS`; `POST_CUTOFF_POST_ANALYSIS`; `MANUSCRIPT_UPDATE`;
`DISCOVERED_DURING_PEER_REVIEW`; and, new: `CITATION_CHAINED` (K.8); `GREY_LITERATURE` (K.3, K.8).
Every extracted source (K.9) carries exactly one primary classification code, assigned at
extraction time and never silently reclassified.

### K.15 Novelty-claim language (adopted, unchanged from the archive)

Dated, scoped, never absolute — e.g., "To our knowledge, based on the prespecified literature search
completed on [K.11's design-informing cutoff timestamp], no prospective evaluation had compared
these alignment stages using a full-edition, bidirectional, set-valued reference standard across
successive U.S. EMS protocol editions." If later evidence changes this assessment, the claim is
revised, never concealed (K.2's disclosure discipline).

### K.16 Method-change routing (adopted, FND-013, cross-referenced to Appendix J)

**Before** M1–M4/comparator/estimand/threshold/analysis-plan freeze: literature-informed revisions
are ordinary planning revisions (Appendix J, Class 0) — logged, not requiring the Class-3
procedure. **After** freeze: any literature-driven proposal to change M1–M4, the comparator,
outcome, estimand, threshold, sampling, or analysis plan must route through Appendix J.1's Class-3
pre-unblinding amendment procedure; never Class-4 (Appendix J.2 is reserved for implementation bugs,
not literature-driven design changes). **After unblinding:** new literature may update
related-work/limitations/novelty-language/future-work only, never the registered primary analysis
(Appendix D.10's bright line).

### K.17 Reproducibility fields (new, drafted under AUTH-003, consolidating K.9/K.10)

The complete literature-workstream reproducibility package: every search-log record (K.10); every
evidence-extraction record (K.9); the frozen query-family specification (K.4) and its per-database
syntax translations as executed; the deduplication decision log (K.7); the citation-chaining pass
record (K.8); the design-informing and manuscript-update cutoff timestamps and their triggering log
entries (K.11, K.13); the final evidence table, hashed. Released per the already-adopted phased
schedule (DEC-036) — development-track materials, rolling release permitted once QA'd.

### K.18 Stop and completion criteria (new, drafted under AUTH-003 — fills a gap not previously named)

The design-informing search is **complete** when: the K.4a sentinel gate has passed for every source
actually used; every approved Lane 1 family has executed, with a complete (uncapped) export, against
every K.3 source classified core for Lane 1 search, and every approved Lane 2 seed/citation-chaining
pass has executed against every K.3 source classified core for Lane 2 — where "a complete (uncapped)
export" is verified per query against the execution manifest and acceptance checks in
`TWO_LANE_SEARCH_DESIGN.md` (query hash, reported total, pages expected vs. received, duplicate-page
detection, and total reconciliation — `len(unique IDs collected) == reported total` — with execution
halting and logging a mismatch, not silently retrying or accepting a near match, on any failure) — or
a source's
non-availability/supplemental classification is logged with a reason (K.3), with manual workflows
used where specified rather than treating lack of an API alone as non-availability; all citation-
chaining (K.8) is complete; all results pass through deduplication (K.7) and
two-stage screening (K.6); every full-text-included source has a completed extraction record (K.9);
the evidence table is compiled and hashed; the global design-informing cutoff timestamp is computed
and logged (K.11). Completion does **not** require a minimum number of included sources — a
genuinely sparse literature is a valid, reportable finding, never a reason to broaden K.5's
eligibility criteria after the fact.

Execution **stops** before completion only if: a technical/access failure makes completion
infeasible within a reasonable retry effort (K.12) — this routes to the formal infeasibility/delay
decision, never a silent scope reduction; or the investigator issues an explicit stop instruction,
logged as that authorization's own `stop_condition` (FND-011, `../planning/
STAGE_AUTHORIZATION_REGISTER.md`).

### K.19 Role separation and execution-authorization reminder (adopted, unchanged from the archive; FND-011 restated)

Literature reviewers get unrestricted access to published literature and development data, but the
same confirmatory-content prohibition applies as to any other pre-unblinding role — no
literature-workstream activity may involve inspecting, selecting, or acquiring prospective EMS
protocol documents. **This appendix's existence, however complete, does not authorize search
execution.** Execution requires its own separate, explicit, dated stage authorization under
FND-011, logged in `../planning/STAGE_AUTHORIZATION_REGISTER.md`.

---

## Appendix L — Pre-freeze audit crosswalks

### L.1 Crosswalk 1: Paper 1 → unified study

| Convention | Status | Reason |
|---|---|---|
| Unit of analysis | **Modified** → two-layer (Appendix A) | Cross-jurisdiction comparability |
| No-peeking discipline | **Modified/strengthened** — bounded/logged correction plus custody-before-acquisition (Appendix D.5, moved earlier than the archive's original design) | Paper 1's own experience showed extraction-generalization work can silently contaminate quarantine |
| Multiplicity | **Rejected** automatic correction of any kind for secondary outcomes — estimation-only (RND2-001), a further step beyond the archive's Holm-not-BH choice | Both Holm and BH machinery risked the exact "danger of multiplicity machinery on heterogeneous test statistics" Paper 1's own experience warned against; estimation-only removes the choice entirely |
| Restricted-candidate design | **Rejected**: full-edition search required (Appendix A, H.4) | Paper 1's own diagnosed candidate-set bias in its reference standard |
| Reference truth | **Modified**: bidirectional, set-valued correspondence (Appendix I) | Correspondence can be one-to-many/many-to-one |
| Reranker inclusion | **Modified**: development-data validation required before freeze, no-reranker fallback available (DEC-027) | Paper 1's own B6/B7 findings: neither reranker helped, one significantly hurt |
| Annotator clinical qualification | **Modified/departed**: content- and escalation-triggered clinical floor (DEC-004), broader than a blanket per-query requirement but grounded in the same I.1 standard | Paper 1 needed no clinical expertise for its lower-stakes correspondence task; this study's richer unit definition needs it selectively |
| Confirmatory-corpus figures | **Verified, not assumed** (FIN-003) | Paper 1's own log shows a superseded "4 pairs, 2 publishers" checkpoint distinct from the final "8 pairs, 4 publishers" corpus — never treated as interchangeable |

### L.2 Crosswalk 2: risk → control

See `../planning/RISK_REGISTER.md` for the complete table.

### L.3 Crosswalk 3: decision → implementation

See `../planning/DECISION_REGISTER.md` for the authoritative decision-by-decision map; the appendix
cross-reference for each decision is stated in its own register entry.

---

## Appendix M — Operational instrument templates

Field lists for the confirmatory workflow's data-collection instruments (survey record, eligibility
determination, succession/edition-pairing, parser-readiness/QC disposition, localized-exclusion
form, provenance-completeness manifest, sampling-frame/audit record, calibration-attempt record,
correspondence-annotation record, adjudication record, deviation/amendment record, package-release
authorization, curated-training-example record, duplicate/near-duplicate registry, gold-bank
registry, blind-repeat registry, confirmatory-evaluation-execution record, model-configuration-
freeze manifest, prediction-seal manifest, post-amendment resumption record, post-unblinding
cohort-integrity incident record, personnel-transition record) are adopted structurally from the
archive's own M.1–M.22 templates, consolidated per DEC-005/DEC-009's minimal-team roster and this
protocol's corrections (custody-before-acquisition, stable M3-R/NR naming, blinded statistical
commitments). Blank instruments are drafted, not yet field-tested — a named gap in `PROTOCOL.md`
§16.

### M.0 — Custodian / split-key-holder agreement (new, fully field-drafted under AUTH-002)

Unlike the structurally-listed instruments above, this template is fully drafted here because
Appendix D.5–D.6 require a signed agreement to exist **before any confirmatory-candidate document is
downloaded, opened, inspected, or stored** — it is the one instrument gating an acquisition-sequence
stage directly. Blank template; no name, date, or value is filled in below.

- **Role** (select one): Custodian — or, if the split-key fallback is activated (D.6): Investigator's
  key holder / Second (uninvolved) key holder.
- **Named individual:** [placeholder]. **Date of acceptance (ISO 8601 UTC):** [placeholder].
- **Independence declaration:** signer holds no role in model development, pair selection,
  annotation, adjudication, or statistical analysis (D.5); a second key holder additionally holds no
  role in method development, pair selection, annotation, adjudication, or statistical analysis
  (D.6). Signer initials confirming this is true as of the acceptance date.
- **Access-matrix acknowledgment:** signer confirms having reviewed and accepting Appendix D.4's
  access-control matrix as it applies to this role.
- **Custody-mechanism acknowledgment:** signer confirms understanding of the sealing procedure,
  release triggers, audit requirements, and failure procedure (D.5).
- **Split-key-specific fields** (complete only if the fallback is activated, D.6): confirmation that
  no single person, including the investigator, can independently decrypt the sealed confirmatory
  package; acknowledgment that every access attempt and key-transfer event will be documented.
- **Persistence acknowledgment (FIN-001):** signer confirms understanding that custody protection
  persists through primary-analysis lock, or a separately frozen final-disposition rule, even for a
  document later excluded from the cohort, and that an excluded confirmatory-candidate document can
  never become development material or be exposed to model-developer personnel.
- **Revocation/replacement conditions:** [placeholder — to be specified by the investigator and
  custodian before this template is used, not invented here].
- **Signature block:** signer name, date, role; investigator countersignature, date.

---

## Appendix N — Staging and authorization definitions (new)

**Five-stage recruitment terminology (COR-003):** (1) informal availability inquiry — role,
qualification requirements, approximate workload, timeline, and that participation depends on
institutional guidance and later approval; no research data, identifiable performance data, training
materials, calibration content, protected documents, or access credentials shared/collected. (2)
Formal recruitment — approved role description, study information, compensation terms,
confidentiality requirements, institutionally required consent/acknowledgement. (3) Onboarding —
qualification verification, role identifiers, conflict-of-interest and access agreements, approved
systems. (4) Training and qualification — study materials, calibration exercises, scoring,
retraining, certification. (5) Study activity or data collection — eligibility review, annotation,
adjudication, QC, custody, statistical review, methodological review, or other governed duties.
Stage 1 may proceed before the HRPP/IRB determination; every later stage requires it. Stage
advancement is a dated entry in the personnel and authorization log (`../planning/
STAGE_AUTHORIZATION_REGISTER.md`).

**Standing execution-authorization rule (FND-011):** provisional adoption, formal adoption, or
freezing of a rule governing an activity never authorizes execution of that activity. Every
operational stage requires its own separate, explicit, verbatim, dated authorization identifying
the permitted activity, scope, responsible persons, approved inputs, governing protocol
version/hash, start conditions, stop conditions, and prohibited adjacent activities — logged in
`../planning/STAGE_AUTHORIZATION_REGISTER.md`, separate from `../planning/DECISION_REGISTER.md`.

---

## Appendix — Statistical Reviewer Task Checklist (new, drafted under AUTH-002)

Consolidates obligations already adopted in Appendix G and `PLACEHOLDER_REGISTER.md` into an ordered
sequence for the appointed statistical reviewer. This checklist creates no new rule; every step cites
its governing decision. Sign-off on the final step is required before `PROTOCOL.md` can move from
`PROVISIONALLY_ADOPTED` to `FORMALLY_APPROVED` (`PROTOCOL.md` §2, §16 item 5).

1. **Independence confirmation.** Sign a declaration of no operational stake in the confirmatory
   outcome before freeze, consistent with Appendix D.4's compatibility constraints (DEC-009).
2. **Blinding acknowledgment.** Confirm, in writing, that you have not been shown and will not seek
   M4's comparative development-set effect, its direction, confidence interval, or pair-level
   differences before the threshold and floor commitments in steps 5–6 (RND3-001, RND3-002).
3. **Specify the primary inference procedure in full.** The sign-flip/permutation test's exact null
   hypothesis, exchangeability assumptions, test statistic, full-enumeration (2^J) vs. Monte Carlo
   choice and justification, treatment of exact-zero differences, and its precise relationship to the
   pair-level bootstrap confidence interval (Appendix G.5, DEC-029).
4. **Specify the bootstrap procedure.** Resampling method, resample count, interval construction.
5. **Draft and commit the practical-importance threshold-setting charter — blinded.** Using
   clinical/operational interpretation, expected review-burden reduction, set-F1's absolute scale and
   mathematical behavior, simulation-based precision/decision properties, and external methodological
   evidence; timestamp and hash the commitment **before** any comparative M4 effect is communicated
   to you (Appendix G.8).
6. **Draft and commit the power-guard scenario range — blinded.** Using the already-committed
   threshold, a prespecified range of plausible smaller/equal/larger effects, Paper 1's pair-level
   variability (historical evidence only, conservatively inflated — never M4's own point estimate),
   and simulations across heterogeneity/missingness/indeterminate-rate/weighting/attrition assumptions
   (Appendix G.9).
7. **Specify the predicted-set-cap sensitivity analyses** once the pilot's module-7 value is
   available (Appendix G.3, FND-002).
8. **Specify the sparse-outcome interval-eligibility threshold and method** — before confirmatory
   *sampling* begins, never after relation counts are observed (Appendix G.6, RND3-CL-003, FIN-002).
9. **Specify the census-threshold multiplier N** once pilot modules 6/8 complete (Appendix H.3,
   DEC-023).
10. **Review the M1/M2 development-only tuning rubric's pair-grouped cross-validation procedure**
    for statistical validity before M1/M2 tuning is treated as complete (Appendix — M1/M2 rubric,
    RND2-002).
11. **Post-commitment review restriction.** After steps 5–6 are committed, you may review
    development results strictly for computational/operational feasibility (runtime, throughput) —
    never M4's comparative effect, at any point thereafter (Appendix G.8, G.9).
12. **Independent code review.** Any statistical/analysis code you author is verified by a second
    qualified reviewer before self-certification (Appendix D.4).
13. **Sign-off.** Record a dated, verbatim statement that all of the above is complete and
    internally consistent, required before `FORMALLY_APPROVED` status.

An inadvertent blinding breach at any point before step 5/6's commitment is a documented breach,
triggering an independent replacement reviewer or the full-blinding fallback (Appendix G.8).

---

## Appendix — Independent Methodological Reviewer Checklist (new, drafted under AUTH-002)

Consolidates the reviewer's duties already adopted in Appendix J and `PROTOCOL.md` §16 item 8 into an
explicit checklist, matching the scope this drafting session used for its own read-only consistency
audit. Creates no new rule. Sign-off on the final step is required before `PROTOCOL.md` can move from
`PROVISIONALLY_ADOPTED` to `FORMALLY_APPROVED` (`PROTOCOL.md` §2, §16 item 8).

1. **Independence confirmation.** Sign a declaration of no role in model development, cohort
   selection, annotation, adjudication, or outcome analysis before freeze (Appendix D.4/D.11,
   DEC-009).
2. **Decision traceability.** Verify every entry in `../planning/DECISION_REGISTER.md` maps to a
   destination in `PROTOCOL.md`/`APPENDICES.md`; flag anything adopted but not implemented, or
   implemented but not traceable to an adopted decision.
3. **Terminology consistency.** M3-R/M3-NR/M4-R/M4-NR naming used consistently everywhere (RND2-003);
   the five-stage recruitment terminology (Appendix N, COR-003) used consistently; "planning
   revision" (Class 0) correctly distinguished from "amendment" (Class 3) (Appendix J,
   RND3-CL-002).
4. **Threshold/value audit.** Every numeric value traces to `../planning/PLACEHOLDER_REGISTER.md` or
   a frozen pilot result — none invented, none silently carried over from the archive without its own
   decision ID.
5. **Role-compatibility audit.** Appendix D.4/D.11's three-tier compatibility rules applied
   consistently everywhere a role appears; no undocumented exception.
6. **Stage-gate audit.** Custody-before-acquisition (D.5), batch-only sampling (H.4), the blinded
   threshold/floor charter (G.8/G.9), and every other stage-gate rule stated consistently across
   `PROTOCOL.md`, `APPENDICES.md`, and `../planning/CRITICAL_PATH.md`.
7. **Cross-reference audit.** Every appendix section correctly cited from `PROTOCOL.md` and vice
   versa; no dangling reference.
8. **Prohibited-activity language audit.** No statement anywhere implies an activity is authorized
   beyond what `../planning/STAGE_AUTHORIZATION_REGISTER.md` actually records (FND-011).
9. **Bias-risk assessment**, when a Class-3 amendment is pending: scope, confirmatory viability, and
   whether the proposal is outcome-motivated (Appendix J.1).
10. **Bug-verification duties**, when applicable: for parser/data-transformation/cohort-application/
    annotation-processing/model-execution/other implementation bugs, establish existence, origin,
    scope, and correction *before* examining effect on the result; joint review with the statistical
    reviewer for mixed bugs; cohort-composition changes are categorically excluded from this
    exception and route to Appendix D.10 instead (Appendix J.2).
11. **Sign-off.** Record a dated, verbatim statement that this audit is complete, with every finding
    disposed of as clerical (corrected directly) or substantive (routed through Appendix J's
    class structure for the investigator's approval — never silently resolved).
