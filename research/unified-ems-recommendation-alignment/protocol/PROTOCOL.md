# Unified EMS Recommendation-Alignment Study — Data Collection & Dataset Governance Protocol

## DRAFT_FOR_REVIEW

**Document status: `PROVISIONALLY_ADOPTED` (draft). This document is NOT `FORMALLY_APPROVED`, NOT
`FROZEN`, NOT PREREGISTERED, and does NOT authorize document acquisition, jurisdiction survey,
reviewer recruitment beyond informal inquiry, literature-search execution, or model work.** See §2
for the status taxonomy and §16 for what remains before this protocol can freeze. Full decision
history, verbatim adoption language, and alternatives considered live in
`../planning/DECISION_REGISTER.md`. Technical detail, algorithms, thresholds, and instrument
templates live in `APPENDICES.md`. The dated record of every review, correction, and drafting event
on these documents lives in `AUDIT_LOG.md`.

---

## 1. Background and rationale

Paper 1 (`sop-guard/backend/app/research/cross_edition/`, untouched by this planning process)
evaluated cross-edition provenance recovery using a restricted-candidate search design and reported
a final confirmatory corpus of **8 edition pairs from 4 independent publishers** (Tennessee,
Pennsylvania, Connecticut ×3, Massachusetts ×2; 480 sampled items, 469 scored) — verified directly
against `PREREGISTRATION.md` and `MANUSCRIPT.md` (DEC-002, FIN-003). An earlier, superseded
checkpoint in the same research log reported "4 pairs, 2 publishers"; the two figures are never
interchangeable and this document uses only the verified final corpus figures. Paper 1 diagnosed a
specific defect — a restricted-candidate reference standard that could not see moves crossing
outside the algorithm's own pre-selected guideline — and measured real, uncorrected weaknesses in
merge (38.1% correct) and split (1/3 correct) recovery under single-successor scoring.

This unified study asks: across a nationally representative, randomly assigned cohort of U.S.
jurisdictions, does an **assignment-aware, set-valued alignment stage** (M4) improve
recommendation-counterpart recovery beyond an otherwise identical hybrid retrieval-and-reranking
pipeline (M3-R, or its no-reranker fallback M3-NR — see §6), when every method searches the
**complete** later edition? Paper 1 is retired as an
active research question and serves only as development evidence and methodological background
(DEC-002).

---

## 2. Status taxonomy

| Status | Meaning |
|---|---|
| `PROPOSED` | A candidate rule has been articulated but not checked for internal consistency. |
| `PROVISIONALLY_ADOPTED` | The named investigator has recorded a verbatim, dated adoption. **This is where every decision in this protocol currently sits.** |
| `FORMALLY_APPROVED` | All missing parameters supplied, internal contradictions removed, the pre-freeze crosswalk verified, the complete protocol independently reviewed. |
| `FROZEN` | Named investigator and custodian have approved it, the protocol and attachments are hashed, and an exact UTC freeze timestamp is recorded. |
| `AMENDED` / `SUPERSEDED` / `REJECTED` | Post-freeze or corrected states — see §14. |

A decision reaches `FROZEN` only after: all missing parameters supplied; internal contradictions
removed; the complete protocol reviewed by an independent human methodological reviewer (DEC-010);
the investigator and custodian approve; the protocol and attachments are hashed; the exact UTC
freeze timestamp is recorded (Appendix D.1). Provisional adoption of any rule below never
authorizes the activity it governs (FND-011) — see `../planning/STAGE_AUTHORIZATION_REGISTER.md`.

---

## 3. Required order

1. Design and provisionally adopt the data-collection protocol *(this document and its appendices,
   in progress — DEC-001 through FIN-004)*.
2. Complete development-track work (unit definition, parser build, M1/M2/M3/M4 development,
   literature search, pilot) — may proceed in parallel with step 1, gated only by "development data
   only" (DEC-001).
3. Freeze and timestamp eligibility, selection, replacement, custody, and statistical rules (§7's
   freeze record).
4. Conduct jurisdiction survey (metadata-only) and acquisition (custody-gated) under those rules
   (Appendix D.3's sequence).
5. Validate, deduplicate, hash, and seal the dataset.
6. Build the two-reviewer, full-edition, set-valued reference standard via **batch** sampling only
   (Appendix H.4, RND2-004).
7. Only then execute the single sealed confirmatory run (Appendix D.9, DEC-030).

No step may begin before the preceding step is complete and, where specified, formally frozen, and
no step may begin without its own separate execution authorization (FND-011).

---

## 4. Primary universe and confirmatory cohort

- **Universe:** 52 jurisdictions = 50 U.S. states + Washington, DC + Puerto Rico. Never described
  as "52 states" (DEC-015).
- **Confirmatory cohort:** target/minimum/maximum not yet numerically fixed — derived from the
  workload-plus-statistical-floor formula (DEC-008), never a placeholder default. At most one
  confirmatory pair per jurisdiction. Development, confirmatory, and challenge roles are mutually
  exclusive (README's already-adopted core rule). Paper 1 and all development-exposed pairs are
  barred from confirmatory evidence forever (DEC-002).

---

## 5. Development/confirmatory track architecture

Two explicit tracks (DEC-001):

- **Development track** — recommendation-unit definition/calibration, literature-search protocol,
  governance drafting, feasibility planning, parser build (DEC-003), M1/M2 tuning (RND2-002),
  M3-R/M3-NR reranker validation (DEC-027). Gated only on "development data only, never
  confirmatory content" plus each activity's own separate execution authorization.
- **Confirmatory track (strictly sequential)** — metadata-only survey → **custody operational
  before acquisition** (COR-001) → acquisition → validation → eligibility review →
  eligible-manifest freeze → randomization → role assignment/sealing → **batch sampling only**
  (RND2-004) → annotation/adjudication → reference-standard sealing → single sealed confirmatory
  run → locked analysis.

The absolute firewall: nothing on the confirmatory track may influence any development-track
decision; development-track pairs, including all of Paper 1's, can never re-enter as confirmatory
evidence.

---

## 6. Method definitions and the primary comparison

| Label | Method |
|---|---|
| **M1** | Lexical retrieval only |
| **M2** | Hybrid retrieval (lexical + dense) |
| **M3-R** | Hybrid retrieval + frozen, development-data-validated reranker (**primary comparator, if the reranker validation succeeds**) |
| **M4-R** | M3-R + assignment-aware, set-valued alignment (**primary intervention, if M3-R is used**) |
| **M3-NR** | The prespecified no-reranker comparator (activates only if no reranker candidate materially improves over M2 on development data) |
| **M4-NR** | M3-NR + assignment-aware, set-valued alignment |

Only one matched pair — M3-R vs. M4-R, or M3-NR vs. M4-NR — enters confirmatory evaluation
(RND2-003). If M3-NR is operationally identical to M2, that equivalence is disclosed explicitly. M1
and M2 are governed by their own full development-only tuning rubric (RND2-002), inherited exactly
by M3/M4 without modification. Every protocol document, manifest, and result table reports both the
human-readable label and the configuration hash. The R/NR suffix is never removed or renamed after
viewing confirmatory results.

**Primary confirmatory question:** does assignment-aware alignment improve recommendation-
counterpart recovery beyond an otherwise identical retrieval-and-reranking pipeline, on a
prospectively selected cohort of successive EMS protocol editions? M3 and M4 (of whichever suffix)
share every component except assignment-aware alignment.

M1-vs-M2 and M2-vs-M3-R comparisons are **secondary, estimation-only diagnostics** (RND2-001), not
part of the primary confirmatory claim.

---

## 7. Timeline: freeze, cutoff, deadlines

Two distinct UTC timestamps: protocol freeze timestamp (the exact instant of formal approval, not
during any design conversation), and document-availability cutoff (same instant, unless amended).

**Freeze record** (required fields — Appendix D.1, currently unpopulated): `protocol_version`,
`protocol_sha256`, `approval_timestamp_utc`, `document_availability_cutoff_utc`,
`approving_investigators`, `custody_mechanism_hash`, `authorized_next_stage`. Note: the freeze
record's custody field records the frozen custody **mechanism**, not necessarily a confirmed
custodian identity — the actual custodian must be confirmed no later than document acquisition
(COR-001), which may occur after protocol freeze.

**Survey-and-acquisition deadline:** not yet fixed — awaits the same workload/power derivation as
§4's cohort size (DEC-008).

**Literature design-informing cutoff:** the exact UTC timestamp at which the corrected, approved
search completes and its results are logged. **No cutoff currently exists.** AUTH-005 was an
incomplete sensitivity pilot (COR-005; Appendix K.4–K.4a). AUTH-007 (2026-09-02) executed a search
but, on independent review, was found to be a capped-sample feasibility execution, not a complete or
representative design-informing search — redesignated `INCOMPLETE_SEARCH_FEASIBILITY_EXECUTION`
(`AUDIT_LOG.md` Entry 014). Appendix K is now a two-lane design (§15); K.11's cutoff cannot be
recorded until an official Lane 1/Lane 2 execution completes and K.18's screening/citation-chaining
requirements are met — neither has occurred.

---

## 8. Eligibility and comparable scope

Strict government-issuance-only eligible-authority test (DEC-015); adult/general scope only,
five-condition modular-document rule, 10-domain comparable-scope checklist (DEC-016). Full detail:
Appendix B.

---

## 9. Acquisition sequence, randomization, custody

Full detail: Appendix C, D. **Custody is required operational — a confirmed custodian with written
acceptance, or the activated two-person split-key fallback — before any prospective
confirmatory-candidate document is downloaded, opened, inspected, or stored** (COR-001). Custody
protection persists through primary-analysis lock, or a separately frozen final-disposition rule,
even for a document later excluded from the cohort; an excluded confirmatory-candidate document can
never become development material or be exposed to model-developer personnel (FIN-001). If neither
custodian nor fallback is operational at the acquisition gate, acquisition automatically pauses.
Metadata-only jurisdiction survey (frozen fields only, no document content) does not require
custody and may be separately authorized independent of it.

**Randomization:** deterministic SHA-256 ranking-key sort, drawn only after the eligible-jurisdiction
manifest is frozen and hashed, two independently-coded implementations must agree (DEC-019). Full
algorithm: Appendix C.

---

## 9a. Named personnel and the provisional role registry

**Mohamed Faisal Sindhi** — Lead Investigator, Operational Researcher, Model Developer, and
Confirmatory Evaluator (under the documented compatibility exception, DEC-030), Corresponding
Author. **Dr. Nasir Uddin** — Faculty Mentor and Senior Academic Advisor: periodic methodological
guidance, feedback, draft/final-submission review, meeting arrangement, committee-presentation
preparation. Carries no operational access-matrix permission and is explicitly not a substitute for
required independent annotation or adjudication (DEC-005, DEC-009).

Every other operational role — eligibility reviewer, correspondence reviewers (non-clinical and
clinically-qualified), adjudicator (also QC/drift-monitoring, DEC-025, and Training Lead, FND-006),
data custodian/split-key holder, statistical reviewer, independent methodological reviewer — is
`TO_BE_APPOINTED`, defined with a qualification standard (Appendix I.1's clinical standard,
FND-001), an operational gate, and a role-combination compatibility tier (DEC-009), recruited under
the five-stage staging rule (COR-003) in the priority order (COR-004).

---

## 10. Replacement logic

Always cross-jurisdiction, never within-jurisdiction; one objectively pre-specified pair per
jurisdiction; narrow permitted-retry list (mechanics only); four-code status taxonomy; frozen
concealed reserve queue (DEC-020). Full detail: Appendix D.7–D.8.

---

## 11. The recommendation unit

Two-layer definition: immutable parser spans → semantic recommendation units defined by clinical
action + population/indication, adopted unchanged from the archived design and validated on the
frozen development corpus before freeze (DEC-014). Full boundary rules: Appendix A.

---

## 12. Parser pipeline, correction limits, failure handling

Layer-1 structural parser pinned and hashed before jurisdiction survey/confirmatory acquisition
begins. Manual correction capped by structure (5%/10% are provisional benchmarks pending
development-pilot validation, not fixed values — DEC-021). Development corpus (Paper 1's four
publishers + 3–5 additional jurisdictions selected via a fully metadata-only, pre-frozen diversity
procedure — RND3-003) is used to validate these ceilings. Full detail: Appendix E.

---

## 13. Primary confirmatory question and statistical plan

**Primary outcome:** design-weighted, pair-macro average of the within-pair bidirectional set-F1
difference between the matched M4/M3 pair (absolute F1-point difference), pair as the unit of
inference (DEC-028).

**Primary inference:** exact pair-level sign-flip/permutation test (primary hypothesis test);
pair-level bootstrap (primary confidence interval); paired-*t* (sensitivity only) — this hierarchy,
reversed from the archive's original design, is specifically chosen given the confirmatory cohort
may contain only ~15–18 independent pairs (DEC-029). The statistical reviewer must fully specify
the sign-flip test's null hypothesis, exchangeability assumptions, test statistic, enumeration/
Monte-Carlo choice, zero-difference treatment, and relation to the bootstrap interval before freeze.

**Concordance rule (FND-003):** the primary superiority claim requires *both* the sign-flip test
rejecting H0 at the frozen alpha *and* the bootstrap CI's lower bound exceeding zero; discordance is
reported inconclusive.

**Practical-importance threshold:** set by the statistical reviewer, blinded to M4's comparative
development-set effect, direction, CI, and pair-level differences, via a prespecified
threshold-setting charter, committed/timestamped/hashed before M4's comparative effect is ever
communicated to the reviewer (RND3-001). Three possible conclusions are reported: no confirmed
statistical superiority; confirmed statistical superiority without established practical
importance; confirmed statistical superiority with practical importance established.

**Multiplicity:** secondary outcomes are estimation-only — no p-values, no declared confirmatory
family, no binary verdicts (RND2-001). The single primary comparison is the only confirmatory
hypothesis test.

**Sparse-outcome reporting:** the interval-eligibility rule and method freeze before confirmatory
*sampling* begins, never chosen after relation counts are observed (RND3-CL-003, FIN-002).

Full statistical algorithm, secondary/exploratory outcome lists, the blinded power-guard scenario
range, and required sensitivity analyses: Appendix G.

---

## 13a. Confirmatory evaluation: single sealed run

Mohamed Faisal Sindhi executes the frozen M3/M4 pair (M3-R/M4-R or M3-NR/M4-NR, whichever was
frozen per §6) against the sealed confirmatory package exactly once, under the
documented Model-Developer/Confirmatory-Evaluator compatibility exception, with the Evaluator's
stricter access/blinding rules governing for the execution's duration (DEC-030). Full detail:
Appendix D.9, M.17–M.19.

---

## 14. Reference-standard construction: sampling and reviewer quality

**Sampling is batch, not rolling** — begins only after the entire confirmatory cohort clears QC and
is sealed (RND2-004). Reviewer training and workflow rehearsal use development-only materials
exclusively, even for pairs that individually clear QC early.

**N is not yet set.** The Unified Development Feasibility and Calibration Pilot (Appendix — new,
FND-008) must complete before the per-direction query count is frozen.

**Reviewer quality:** every confirmatory query independently reviewed by two people, at least one
clinically qualified per query, with the clinical floor triggered by stratum membership *and* by
content/relation-dependence, *and* by any reviewer's escalation, *and* by default under uncertainty
(DEC-004). Reviewers qualify via the archive's unchanged five-gate calibration battery and 3-attempt
limit (DEC-024), with an explicit contingency for the minimal team's lack of redundancy. QC/drift
monitoring and Training-Lead functions are folded into the adjudicator role (DEC-025, FND-006).

Full sampling mechanics, calibration metrics/thresholds, drift-monitoring design, adjudication
rules, fatigue controls, sealing requirements: Appendix H, I.

---

## 15. Literature and novelty workstream

Runs in parallel with development-track work; must complete and be reviewed before M1–M4's
configuration locks and before reference-standard sealing (FND-013). AUTH-005 is preserved as an
incomplete pilot because its exact-phrase search failed sensitivity checks and most planned sources
were not successfully searched. A corrected four-block/six-family translation was built,
sentinel-validated, and executed under AUTH-007 (2026-09-02) — but independent review found that
execution's exports were 200-of-up-to-3.4-million capped samples, not a complete or representative
search, and that one source (Crossref) was queried despite its own sentinel test already failing.
AUTH-007 is redesignated `INCOMPLETE_SEARCH_FEASIBILITY_EXECUTION` (`AUDIT_LOG.md` Entry 014); its
real evidence — query syntax, true total counts, per-source sentinel behavior — is preserved and
reused, but its 3,464-record deduplicated set is **not** the master set K.6 screening will act on.

**Appendix K is now redesigned as a two-lane strategy** (K.3–K.4a, `AUDIT_LOG.md` Entry 014 onward;
full design and testing record: `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md`): **Lane 1**,
a narrow, task-focused, completely-exportable systematic/scoping search for version-to-version
alignment, recommendation matching/change, and guideline/protocol evolution (tested default:
~680–2,398 PubMed + ~912–1,335 OpenAlex records depending on width, every candidate sentinel-
verified); and **Lane 2**, a structured method-landscape review built from a small set of
identifier-verified authoritative seeds plus citation chaining only where that chaining is itself a
manageable, exportable size (tested per seed; three highly-cited landmark papers are included
directly rather than chained from). Two literature dates unchanged: a design-informing cutoff
(event-based per COR-005) and a manuscript-update cutoff. Appendix K's other sections (eligibility/
exclusion K.5, screening/reviewer arrangement K.6, deduplication K.7, citation chaining/grey
literature K.8, evidence-extraction and search-log templates K.9–K.10, the two-cutoff rule and retry
procedure K.11–K.12, late-publication handling K.13, source classification K.14, novelty-claim
language K.15, method-change routing K.16, reproducibility fields K.17, and stop/completion criteria
K.18) are unchanged in structure, with K.18 now explicitly requiring a *complete, uncapped* export
per Lane 1 family, closing the gap that let AUTH-007's capped samples read as `SUCCESS`.

**AUTH-008 (2026-09-02) authorizes this redesign and its feasibility testing only — not execution of
an official Lane 1/Lane 2 search, and not K.6/K.8 activity.** A second independent audit
(`AUDIT_LOG.md` Entry 016) required nine further corrections, all addressed with real, re-run API
evidence, concluding a `CONDITIONAL PASS`. **A third independent audit rejected that conditional-pass
language outright** (`AUDIT_LOG.md` Entry 017) and required six further, more exacting corrections:
a genuinely on-task sentinel verified from each paper's own text (not title terms); a stricter
reassessment of conformal prediction (removed — its stated justification did not survive direct
verification against `DECISION_REGISTER.md`'s FND-002 text); correction of internal inconsistencies
(chainable-seed count, workload-total defensibility claims, arXiv's classification); PubMed MeSH-term
feasibility testing (tested and adopted, 680 → 1,179 clinical records); explicit non-equivalence of
self-audit and formal PRESS peer review; and a strict PASS/FAIL result. Overall third-pass result:
**FAIL**, with four concrete blockers, one of which (no genuinely on-task, indexed sentinel for Lane
1's clinical sub-family) was itself found circular on a **fourth independent audit** (`AUDIT_LOG.md`
Entry 018): it demanded proof that the exact literature the study exists to search for already
existed. That gate is replaced with a **component-validation framework** — clinical-maintenance
terminology, alignment methods, and legislative precedents (components a/b/c) are each validated
against verified sentinels and confirmed satisfied; an exact clinical precedent (component d) has no
sentinel because none is known to exist, and its absence is explicitly neither a pass nor proof of
novelty — it is resolved only once the completed official search, screening, and citation chaining
actually run. A **frozen reviewer-capacity-gate formula** was also added (sign-off fields for
documented available hours and a pilot-timed screening rate left blank, not invented), and staffing
was clarified: Mohamed Faisal Sindhi (investigator) is the confirmed primary stage-1 screener; an
unsigned independent search-strategy review package was drafted
(`protocol/literature-search/INDEPENDENT_REVIEW_PACKAGE.md`). **Overall fourth-pass result: FAIL**,
three remaining concrete blockers: reviewer-capacity sign-off fields not yet populated; no independent
search-strategy reviewer appointed; no stage-2 screening checker appointed. **Execution is still not
authorized.** The remaining open literature-workstream items are: populating and passing the
reviewer-capacity gate; appointing an independent search-strategy reviewer and obtaining a signed
response on the review package; appointing the K.6 stage-2 checker (Dr. Nasir Uddin is one possible
candidate, not assumed); institutional access confirmation for subscription databases and a decision
on the Semantic Scholar/Google Scholar/ACL Anthology coverage gaps (K.3, now resolved to
supplemental-only roles for the two-lane design); and, once an official search actually executes,
conducting screening (K.6, now redesigned per AUTH-009 below) and citation chaining (K.8) against its
results — outside any AI agent's authority (K.19).

**AUTH-009 (2026-09-03) — K.6 redesigned as an AI-assisted structured screening workflow (design/
planning only, not execution).** The investigator determined that personally screening the full Lane
1 + Lane 2 pre-dedup workload (~4,173 records) as sole title/abstract screener is not feasible. K.6 is
redesigned (LIT-005–LIT-009): a frozen, calibrated AI system classifies every deduplicated record as
`INCLUDE`/`EXCLUDE`/`UNCERTAIN` with reason codes; Mohamed Faisal Sindhi (investigator), preserved as
the primary human verifier, reviews every AI `INCLUDE`/`UNCERTAIN` record and a reproducibly sampled,
blinded, stratified audit of AI `EXCLUDE` records governed by a frozen three-level escalation ladder;
the former stage-2 checker role is redesignated **screening adjudicator**, still `TO_BE_APPOINTED`, but
required only before human verification begins rather than before official search execution. Full
design, freeze checklist (model/version, prompt, schema, temperature, batching/retry rules, reason
codes, hashes, no-post-hoc-tuning rule), a development-only calibration plan emphasizing recall (blank
sign-off fields, Clopper-Pearson-based formulas, provisional 95% recall gate), three considered
exclusion-audit designs with a recommended stratified/escalation design (replacing the archived flat
10% figure), workload-recalculation formulas, and transparency/reporting requirements (labeled "AI-
assisted structured literature review," explicit non-PRISMA-compliance unless genuinely met):
`protocol/literature-search/AI_ASSISTED_SCREENING_DESIGN.md`; operational worksheet:
`protocol/literature-search/SCREENING_VERIFICATION_INSTRUMENT.md`. **This authorization is design/
planning only** — it does not select or run any AI model, draw or label any calibration sample,
classify any record, perform any human verification or audit, appoint or contact the adjudicator, or
execute the official Lane 1/Lane 2 search. All AUTH-008 blockers (reviewer-capacity sign-off, independent
search-strategy reviewer appointment/signature) remain unmet and are unaffected by this redesign; the
former "no stage-2 checker appointed" blocker is superseded by the adjudicator's later, but still real,
deadline (before human verification begins, not before this planning pass). See
`../planning/STAGE_AUTHORIZATION_REGISTER.md` AUTH-009 and `AUDIT_LOG.md` Entry 019 for the full record.

---

## 16. What remains before this protocol can freeze

This protocol is `PROVISIONALLY_ADOPTED`, not `FROZEN`. Named, concrete gaps:

1. **Development-corpus diversity procedure** — parameters specified in structure (RND3-003) but
   not yet executed; the additional 3–5 jurisdictions are not yet identified or acquired.
2. **Timed pilot** (the Unified Development Feasibility and Calibration Pilot, FND-008) has not run
   — every numeric threshold in `../planning/PLACEHOLDER_REGISTER.md` awaits it.
3. **Named custodian, second key-holder, statistician, independent methodological reviewer, clinical
   and non-clinical reviewers, adjudicator** — all `TO_BE_APPOINTED`; recruitment requires informal-
   inquiry authorization (not yet granted) and, for stages beyond informal inquiry, the HRPP/IRB
   determination (not yet submitted).
4. **HRPP/IRB determination** — submission drafted under this Phase A authorization but not yet
   submitted; blocks formal recruitment, the pilot's human-subjects modules, and confirmatory
   annotation.
5. **Blinded statistical-review commitments** — the practical-importance threshold charter and the
   power-guard scenario range must be committed by the statistical reviewer, blind to M4's
   comparative development-set effect, before either can be treated as available for freeze.
6. **Literature search** — protocol **finalized** under AUTH-003 (Appendix K.1–K.19) with its
   substantive decision content (K.3/K.4/K.6/K.13) **resolved** under AUTH-004 (LIT-001–LIT-004);
   AUTH-005's execution (2026-09-02) was an `INCOMPLETE_PARTIAL_PILOT` (`AUDIT_LOG.md` Entry 009);
   a corrected four-block translation was built, sentinel-validated, and executed under AUTH-006/
   AUTH-007 (2026-09-02, `AUDIT_LOG.md` Entries 010–012), but independent review found that
   execution's exports were capped samples (200 of up to 3.4 million) rather than a complete or
   representative search, and redesignated it `INCOMPLETE_SEARCH_FEASIBILITY_EXECUTION`
   (`AUDIT_LOG.md` Entry 014). **Appendix K is now redesigned as a two-lane strategy** (K.3–K.4a) —
   Lane 1 (task-focused, completely-exportable search, locked to its narrow-unit, MeSH-expanded
   default) and Lane 2 (structured method-landscape review via a rebuilt seven-seed set and
   feasibility-tested citation chaining) — under AUTH-008 (design and feasibility testing only,
   2026-09-02, corrected through a fourth independent-audit pass: a component-validation framework
   replaced the third pass's circular clinical-sentinel gate, and a frozen reviewer-capacity-gate
   formula was added with sign-off fields left blank; `AUDIT_LOG.md` Entries 014–018; full record:
   `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md`). **K.6 screening itself is further
   redesigned under AUTH-009 (2026-09-03, design/planning only) as an AI-assisted structured
   workflow** — a frozen, calibrated AI classification stage plus mandatory human verification of every
   AI INCLUDE/UNCERTAIN record and a stratified, escalation-governed audit of AI EXCLUDE records,
   replacing the requirement that Mohamed Faisal Sindhi personally screen all ~4,173 records
   (`protocol/literature-search/AI_ASSISTED_SCREENING_DESIGN.md`,
   `SCREENING_VERIFICATION_INSTRUMENT.md`). **Not yet complete:** populating and passing the
   reviewer-capacity gate (now recalculated for AI-assisted human workload, not the full pre-dedup
   count); appointing an independent search-strategy reviewer and obtaining a signed response on
   `protocol/literature-search/INDEPENDENT_REVIEW_PACKAGE.md`; freezing the AI screening system (model/
   version, prompt, schema, settings, reason codes, hashes — currently all blank/draft) and passing its
   development-only calibration gate; appointing the screening adjudicator (required before human
   verification begins, not before official search execution — a later but still real deadline);
   a further independent audit of this AI-assisted design and a separate authorization to execute it
   officially; the AI-assisted screening workflow itself (K.6) and citation chaining (K.8), outside any
   AI agent's authority to perform unsupervised (K.19); Semantic Scholar/Google Scholar/ACL
   Anthology/ACM/IEEE/EMBASE/CINAHL coverage gaps (now resolved to supplemental-only roles for the
   two-lane design, not eliminated). **No design-informing cutoff (K.11) exists.** Must complete before
   M1–M4/estimand/threshold/analysis-plan freeze.
7. **M1/M2/M3/M4 development** — gated on the sealed development corpus; not yet begun.
8. **Independent methodological reviewer's full consistency audit** — required before freeze;
   reviewer not yet identified.
9. **Formal investigator + custodian approval, protocol versioning, timestamp, cryptographic
   hashing** — mechanics specified (§7, Appendix D.1) but not executed.
10. **Repository selection** for the reproducibility release — criteria adopted (DEC-036), no
    evaluation performed.

Producing this document does not resolve any of these ten items. It exists to make them legible
before the next authorization decision.
