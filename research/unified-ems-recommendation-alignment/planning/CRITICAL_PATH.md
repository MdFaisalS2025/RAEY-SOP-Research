# Corrected critical path — DRAFT_FOR_REVIEW

**Nothing below authorizes execution.** Every stage requires its own separate, dated authorization
per `STAGE_AUTHORIZATION_REGISTER.md` (FND-011). This document is a read-only synthesis of
`DECISION_REGISTER.md`, corrected through the final clarification round (FIN-001–FIN-004).

## Ordered sequence

| Phase | Content | Gated by |
|---|---|---|
| **A. Planning-document drafting** | This package, protocol core/appendices, IRB submission draft, literature-search protocol draft, custody agreement draft | Separately authorized — **granted for this drafting session only** (2026-08-29); does not extend to any later drafting session automatically |
| **B. Informal inquiry** | Six roles: custodian/key-holder, adjudicator, clinical reviewer, non-clinical reviewer, statistician, methodological reviewer — priority-ordered per COR-004, pursued in parallel once authorized | Its own separate authorization (not yet granted) |
| **C. IRB/HRPP submission** | Broadly scoped per COR-002/FND-007 | Separate authorization to submit |
| **D. Formal recruitment → onboarding → training** | Per role, five-stage terminology (COR-003) | Written HRPP/IRB determination, per role |
| **E. Development corpus** | Diversity-procedure execution (RND3-003's frozen mechanics) → list freeze (metadata-only) → acquisition → validation/hash/seal → parser/M1/M2/M3-R(NR)/M4-R(NR) development | Separate authorization at each step |
| **F. Unified Development Feasibility and Calibration Pilot** (FND-008, 9 modules) | See §12 of `FINAL_PLANNING_PACKAGE.md` | Sealed dev corpus + IRB determination for human-subjects modules |
| **G. Literature search** | Protocol finalized (AUTH-003) and decision-resolved (AUTH-004) → AUTH-005 preserved as an `INCOMPLETE_PARTIAL_PILOT` after sensitivity failure → a four-block translation was sentinel-validated and executed under AUTH-007 (2026-09-02), but independent review found its exports were capped samples (200 of up to 3.4M) rather than a complete search — redesignated `INCOMPLETE_SEARCH_FEASIBILITY_EXECUTION` (`AUDIT_LOG.md` Entry 014) → Appendix K redesigned as a two-lane strategy under AUTH-008 (Lane 1: task-focused, fully-exportable search, locked to its narrow-unit, MeSH-expanded default at 1,179 PubMed + 1,335 OpenAlex clinical, 912 OpenAlex + 50 PubMed-supplementary legislative; Lane 2: a rebuilt seven-seed set + feasibility-tested citation chaining) → second independent audit required nine corrections, all addressed, concluding `CONDITIONAL PASS` → third independent audit rejected that conclusion and required six further corrections, all addressed, overall finding **FAIL** (four blockers, including a circular clinical-sentinel gate) → **fourth independent audit required the circular gate be replaced with a component-validation framework** (components a/b/c — clinical-maintenance terminology, alignment methods, legislative precedents — all satisfied; component d, an exact clinical precedent, left as an open empirical question resolved only by actual execution) **and a frozen reviewer-capacity-gate formula** (sign-off fields for documented hours and a pilot-timed rate left blank, not invented) — stage-1 primary screener confirmed as Mohamed Faisal Sindhi; an unsigned independent-review package drafted (`INDEPENDENT_REVIEW_PACKAGE.md`) — overall fourth-pass finding **FAIL**, three remaining blockers (capacity sign-off not populated; no independent search-strategy reviewer appointed; no stage-2 checker appointed) — design and feasibility testing only, no official execution yet → **AUTH-009 (2026-09-03) then redesigned K.6 itself as an AI-assisted structured screening workflow** (the investigator determined personally screening ~4,173 records is infeasible): a frozen, calibrated AI system classifies every record INCLUDE/EXCLUDE/UNCERTAIN with reason codes; Mohamed Faisal Sindhi is preserved as investigator/primary human verifier (no longer sole stage-1 reader) reviewing every AI INCLUDE/UNCERTAIN record plus a stratified, blinded, escalation-governed audit of AI EXCLUDE records; the former stage-2 checker is redesignated **screening adjudicator**, required before human verification begins rather than before official search execution — full design: `AI_ASSISTED_SCREENING_DESIGN.md`, `SCREENING_VERIFICATION_INSTRUMENT.md` — **design/planning only, no AI model run, no record classified, no official execution** → **next: populating the reviewer-capacity sign-off (recalculated for AI-assisted workload); appointing an independent search-strategy reviewer and obtaining a signed response; freezing the AI screening system and passing its calibration gate; appointing the screening adjudicator; a further independent audit; then a separate authorization to execute Lane 1/Lane 2 officially; then the AI-assisted screening workflow (K.6) and citation chaining (K.8), none yet begun** | No cutoff currently exists — K.18 requires a complete (uncapped) Lane 1/Lane 2 execution, then K.6 screening and K.8 citation chaining. See `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md`, `SEARCH_LOG.md`, `DEDUPLICATED_MASTER_SET.md`, `QUERY_TRANSLATION_TABLE.md`, `SENTINEL_BIBLIOGRAPHY.md`, and `SENTINEL_VALIDATION_LOG.md` |
| **H. Custody resolved** | Custodian confirmed + signed, or split-key fallback activated — **before any confirmatory document acquisition, not merely before eligible-manifest freeze** (COR-001); protection persists through primary-analysis lock (FIN-001) | Independent of protocol freeze; gates acquisition specifically |
| **I. Protocol freeze** | Custody *mechanism* frozen (not necessarily the person); blinded threshold charter + power-guard simulations complete (RND3-001/002, FIN-004); sparse-outcome rule frozen (RND3-CL-003/FIN-002 — before sampling, this stage); statistician sign-off; independent methodological reviewer's full audit; named-investigator approval; hash/timestamp | F and G complete; custody mechanism finalized |
| **J. Confirmatory track** | Metadata-only survey → **[custody operational here]** → acquisition → validation → eligibility review → eligible-manifest freeze → randomization → role assignment/sealing → **batch sampling only** (RND2-004) → annotation/adjudication → reference-standard sealing → single sealed confirmatory run → locked analysis | Protocol frozen; custody operational before acquisition |
| **K. Manuscript & release** | Development/confirmatory-separated manuscript with clinical-non-deployment disclaimer (FND-012) → phased data release (DEC-036) | J complete |

## Stage gates and prerequisites

- Parser/M1/M2/M3/M4 development: gated on sealed development corpus (DEC-003).
- Reviewer recruitment (stage 2+), training-data collection, the pilot, confirmatory annotation:
  gated on the IRB/HRPP determination (DEC-006).
- Reviewer calibration: gated on Training-Lead (adjudicator) approval of training materials
  (FND-006).
- **Sparse-outcome interval-eligibility rule and method:** must freeze before confirmatory
  *sampling* begins (FIN-002) — an earlier gate than the primary evaluation itself.
- **Practical-importance threshold and power-simulation scenario range:** must be committed by the
  blinded statistician before the M4-vs-comparator comparative effect is ever communicated to them
  (RND3-001/002).
- Batch sampling: begins only after the complete confirmatory cohort is sealed (RND2-004) — never
  rolling, including for reviewer-training rehearsal.
- M1–M4/comparator/estimand/threshold/analysis-plan freeze: requires the literature search to have
  completed and been reviewed (FND-013).
- Protocol freeze: requires pilot complete, literature search complete, statistician sign-off,
  independent methodological reviewer's audit complete, custody mechanism finalized.
- Jurisdiction survey: cannot begin before protocol is `FROZEN`.
- Document acquisition: cannot begin before custody is operational (COR-001) — auto-pauses
  otherwise.

## Parallel vs. sequential

**Parallel-safe (once separately authorized):** informal inquiry for all six roles; IRB submission
drafting/review; literature-search protocol drafting/approval/execution; custody-mechanism drafting
and custodian outreach; development-corpus diversity-procedure specification.

**Strictly sequential:** diversity-procedure spec → corpus list freeze → acquisition →
validation/seal → parser/M1–M4 work; IRB submission → determination → recruitment/pilot/annotation;
pilot modules 1→2→(3→4→5 and 6→7 partly parallel)→8→9; literature search → method/estimand freeze;
statistician + methodological review → formal approval → freeze; protocol freeze → survey →
**[custody operational]** → acquisition → randomization → **batch** sampling → annotation → sealed
run → analysis.

## Numeric/method placeholders awaiting evidence

See `PLACEHOLDER_REGISTER.md`.

## Decisions requiring literature-review results before freeze

M1–M4 specifications, primary comparator identity (M3-R vs. M3-NR), practical-importance threshold,
confirmatory analysis plan (FND-013).

## Required external roles and latest-secure-by stage

| Role | Latest by |
|---|---|
| Custodian / split-key holder | Before document acquisition (COR-001) |
| Adjudicator (QC/drift/Training-Lead) | Before pilot module 3 |
| Clinical reviewer | Before pilot modules 3–4 |
| Non-clinical reviewer | Before pilot module 3 |
| Statistician | Before pilot module 8; before threshold/power commitment (blinded) |
| Independent methodological reviewer | Before protocol freeze |

Recruitment priority: custodian/key-holder → adjudicator → clinical + non-clinical reviewers →
statistician → methodological reviewer (COR-004), adaptive to observed difficulty.

## Review and approval gates

IRB/HRPP determination → statistical review (multiple thresholds, blinded where specified) →
independent methodological consistency audit → custody resolution → named-investigator + custodian
formal approval, hash, timestamp → `FROZEN`.

## No-peeking, sealing, randomization, replacement, single-run controls

Development corpus sealed before parser/M1–M4 work; SHA-256 ranking-key randomization with dual
independent implementations; concealed cross-jurisdiction-only replacement queue; single sealed
confirmatory run with full pre-freeze hashing, dry-run, one authorized execution, blind model
developers, narrow mechanical-rerun exception; absolute post-unblinding cohort-integrity bright
line; standing execution-authorization meta-rule gating every activity individually; custody
persisting through primary-analysis lock for any confirmatory-candidate document, even if later
excluded (FIN-001).

## Automatic infeasibility/abort conditions

Workload capacity below statistical floor → auto-infeasibility (FND-005); replacement queue
exhausted or cohort below minimum at deadline → formal feasibility decision; reviewer fails
calibration 3× → disqualify/replace/reassess; post-unblinding composition change attempted →
primary analysis invalidated, original cohort stands (DEC-031); predicted-set cap exceeded →
invalid output, never truncated (FND-002); drift-pause thresholds crossed → stop, audit, retrain;
post-unblinding attrition below floor → inconclusive/descriptive, no replacement (FND-005);
custody not operational at acquisition gate → acquisition auto-pauses (COR-001).

## Point protocol drafting may begin

Phase A drafting is now authorized (this session, 2026-08-29), scoped to the file list specified in
the authorization message. Any *further* drafting session, or any drafting beyond that list,
requires its own separate authorization — Phase A authorization does not extend automatically.

## Point each execution activity may be separately authorized

Every activity beyond Phase A drafting — informal inquiry, IRB submission, literature-search
execution, diversity-procedure execution/corpus acquisition, metadata-only survey, document
acquisition (additionally gated on custody), pilot module execution, confirmatory annotation, sealed
confirmatory run, protocol freeze itself — requires its own explicit, dated authorization from the
named investigator, logged in `STAGE_AUTHORIZATION_REGISTER.md`.

## Remaining unresolved assumptions or open questions

- Recruitment sequencing/priority among adjudicator, clinical reviewer, non-clinical reviewer,
  statistician, methodological reviewer, and custodian is prioritized (COR-004) but real-world
  parallel-search bandwidth is not itself a governance decision — an operational matter for the
  investigator.
- The threshold-setting charter's exact simulation parameters and the diversity-adequacy test's
  exact scoring rule remain to be specified in full technical detail at drafting time (see
  `PLACEHOLDER_REGISTER.md`).
- No internal contradictions were found among the decisions and findings synthesized here as of
  this drafting pass (see `FINAL_PLANNING_PACKAGE.md` §20 for the full epistemic-status statement).
