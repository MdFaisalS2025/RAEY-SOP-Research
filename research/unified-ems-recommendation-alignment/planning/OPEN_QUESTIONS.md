# Open questions before protocol freeze — DRAFT_FOR_REVIEW

Status update, 2026-08-29: the twelve original questions below have each been given a governing
**rule** in `DECISION_REGISTER.md` (PROVISIONALLY_ADOPTED, none FROZEN). Resolving the *rule* is not
the same as resolving the *value* — most rules explicitly defer their numeric content to the
Unified Development Feasibility and Calibration Pilot (FND-008) or to blinded statistician review.
See `PLACEHOLDER_REGISTER.md` for every value still outstanding.

1. **Jurisdiction universe** — rule adopted (DEC-015): 50 states + DC + Puerto Rico, government-
   issuance-only eligible-authority test. Not yet frozen.
2. **Authority, protocol-scope, edition, successive-pair eligibility rules** — rule adopted
   (DEC-015, DEC-016, DEC-017: consecutive-edition verification built into survey time). Not yet
   frozen.
3. **Availability cutoff timestamp, survey window, target/minimum cohort, replacement-window
   deadline** — the *derivation rule* is adopted (DEC-008: workload-plus-statistical-floor formula,
   never a fixed placeholder number); the exact values await the pilot and blinded power-guard
   simulations (RND3-002). See `PLACEHOLDER_REGISTER.md`.
4. **Deterministic jurisdiction role assignment and public randomness** — rule adopted (DEC-019:
   SHA-256 ranking-key sort, dual independent implementations). Not yet frozen or executed.
5. **Operational custodian, reviewers, adjudicator, QC** — role structure adopted (DEC-005, DEC-007/
   COR-001, DEC-009, DEC-025); named individuals remain `TO_BE_APPOINTED` pending recruitment
   (COR-003/COR-004). Custody now gates document acquisition specifically, not merely
   eligible-manifest freeze, and persists through primary-analysis lock (FIN-001).
6. **Annotation timing measurement** — folded into the Unified Development Feasibility and
   Calibration Pilot's module 3 (FND-008); not yet executed.
7. **Recommendation-unit, duplicate, parser-correction, localized-exclusion, unscorable-item
   rules** — rule structure adopted (DEC-014, DEC-021, DEC-023); numeric ceilings await pilot
   validation.
8. **Primary estimand, practical-importance threshold, inference, missingness, multiplicity, with
   statistical review** — structure fully adopted (DEC-028, DEC-029 as corrected by RND2-001;
   concordance rule FND-003; blinded threshold charter RND3-001; blinded power-guard RND3-002).
   Statistical review is required and blinded to M4's comparative development-set effect by design.
9. **Exact M1–M4 implementations and development-only tuning rubric** — resolved: M1/M2 rubric
   (RND2-002), M3-R/M3-NR reranker validation and stable naming (DEC-027, RND2-003). Not yet
   executed.
10. **Reproducible literature review before fixing novelty claims** — resolved: two-cutoff design
    (DEC-032), event-based cutoff timing (COR-005), sequencing before method/estimand freeze
    (FND-013). Search execution was granted and run (AUTH-005, incomplete pilot; AUTH-006/AUTH-007,
    2026-09-02) — but independent review found AUTH-007's exports were capped samples, not a
    complete search, and redesignated it `INCOMPLETE_SEARCH_FEASIBILITY_EXECUTION`
    (`AUDIT_LOG.md` Entry 014). Appendix K is now a two-lane redesign (AUTH-008, design/feasibility
    testing only), corrected through a fourth independent-audit pass (`AUDIT_LOG.md` Entries
    016–018: locked narrow-unit MeSH-expanded Lane 1 default, rebuilt seven-seed Lane 2, PRESS-
    modeled checklist, execution manifest, a component-validation framework replacing a circular
    clinical-sentinel gate, and a frozen reviewer-capacity-gate formula with blank sign-off fields;
    overall fourth-pass finding **FAIL**, three remaining blockers named). **AUTH-009 (2026-09-03)**
    then redesigned K.6 itself as an AI-assisted structured screening workflow, since the investigator
    determined personally screening ~4,173 records is infeasible: a frozen, calibrated AI system now
    classifies every record, Mohamed Faisal Sindhi is preserved as investigator/primary human verifier
    (no longer sole stage-1 reader) reviewing every AI INCLUDE/UNCERTAIN record plus a stratified,
    escalation-governed audit of AI EXCLUDE records, and the former stage-2 checker is redesignated
    screening adjudicator with a later but exact deadline (before human verification begins, not
    before official search execution) — design/planning only, no AI model run, no record classified
    (`AI_ASSISTED_SCREENING_DESIGN.md`, `SCREENING_VERIFICATION_INSTRUMENT.md`) — still awaiting the
    reviewer-capacity gate populated/passing (now recalculated for AI-assisted workload), an
    independent search-strategy reviewer appointed and signed off, the AI system frozen and its
    calibration gate passed, a screening adjudicator appointed, and a further independent audit before
    an official Lane 1/Lane 2 execution — no design-informing cutoff exists.
11. **Sealed-run custody, access control, abort conditions, post-unblinding bug handling** —
    resolved (DEC-030, DEC-031, DEC-034, COR-001 as strengthened by FIN-001).
12. **Redistribution and licensing limits** — resolved (DEC-035, DEC-036).

## Remaining open items (not fully resolved by a governing rule alone)

- Named custodian, second key-holder, statistician, independent methodological reviewer, clinical
  and non-clinical reviewers, adjudicator — all `TO_BE_APPOINTED`; recruitment blocked on IRB/HRPP
  determination for stages beyond informal inquiry (DEC-006, COR-002).
- IRB/HRPP determination itself — not yet submitted (submission requires its own separate
  authorization).
- Every numeric placeholder in `PLACEHOLDER_REGISTER.md`.
- Repository selection for the reproducibility release (DEC-036) — criteria adopted, no evaluation
  performed yet.
- Literature-search protocol's exact databases/search strings/screening procedure — protocol
  finalized (Appendix K.1–K.19, AUTH-003) and its decision content resolved (K.3/K.4/K.6/K.13,
  AUTH-004, LIT-001–LIT-004, DEC-032); AUTH-007's execution (2026-09-02) was found on independent
  review to be a capped-sample feasibility execution, not a complete search
  (`AUDIT_LOG.md` Entry 014), and Appendix K.3/K.4/K.4a is now redesigned as a two-lane strategy
  (AUTH-008, `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md`) — design and feasibility
  testing only, corrected through a fourth independent-audit pass to overall result **FAIL**
  (`AUDIT_LOG.md` Entries 016–018). Staffing clarified: Mohamed Faisal Sindhi (investigator) was
  confirmed as primary stage-1 screener, then (AUTH-009, 2026-09-03) K.6 itself was redesigned as an
  AI-assisted structured screening workflow — Sindhi preserved as investigator and primary **human
  verifier** rather than sole stage-1 reader of ~4,173 records, since the investigator determined that
  workload infeasible for personal screening
  (`protocol/literature-search/AI_ASSISTED_SCREENING_DESIGN.md`,
  `SCREENING_VERIFICATION_INSTRUMENT.md`; design/planning only — no AI model run, no record
  classified). Remaining open items: populating the reviewer-capacity sign-off fields (documented
  hours, pilot-timed rate, now recalculated for AI-assisted human workload) and confirming the gate
  passes; appointing an independent search-strategy reviewer and obtaining a signed response on
  `protocol/literature-search/INDEPENDENT_REVIEW_PACKAGE.md`; freezing the AI screening system (model/
  version, prompt, schema, settings, reason codes, hashes) and passing its development-only
  calibration gate; appointing the screening adjudicator (Dr. Nasir Uddin is one possible candidate,
  not assumed — required before human verification begins, not before official search execution); a
  further independent audit of the AI-assisted screening design; a further authorization to execute
  Lane 1/Lane 2 officially; and, once that runs, conducting the AI-assisted screening workflow and
  citation chaining against its results.
