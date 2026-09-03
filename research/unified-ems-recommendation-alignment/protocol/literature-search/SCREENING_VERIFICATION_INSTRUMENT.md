# Screening Verification Instrument — DRAFT, BLANK TEMPLATE

**Status: drafted 2026-09-03 as a companion to `AI_ASSISTED_SCREENING_DESIGN.md`. Blank. Not yet used —
no AI classification has run, so there is nothing to verify or audit yet.** This is the operational
worksheet the primary human verifier (Mohamed Faisal Sindhi) and the screening adjudicator
(`TO_BE_APPOINTED`, §8.2 of the design document) actually complete, one row per record, during human
verification (§6.2) and the exclusion audit (§6.3). It exists to satisfy the requirement for a concrete
screening-protocol/reviewer instrument, not merely a narrative description of the workflow.

---

## Part 1 — INCLUDE / UNCERTAIN verification log (§6.2: every AI INCLUDE and UNCERTAIN record)

One row per record. Completed in full for **every** AI `INCLUDE` and every AI `UNCERTAIN` record — no
sampling at this stage.

| Field | Entry |
|---|---|
| Record ID (dedup key) | |
| AI decision | INCLUDE / UNCERTAIN |
| AI reason code(s) | |
| AI confidence | LOW / MEDIUM / HIGH |
| Reviewer (always Mohamed Faisal Sindhi at this stage) | |
| Review date/time (UTC) | |
| Human decision | ☐ CONFIRM_INCLUDE ☐ OVERRIDE_TO_EXCLUDE ☐ ESCALATE_TO_ADJUDICATOR |
| Human rationale (brief, cites K.5/K.1/K.2 as applicable) | |
| If ESCALATE_TO_ADJUDICATOR: reason for escalation | |

**Disagreement/escalation rule:** any record marked `ESCALATE_TO_ADJUDICATOR` routes to Part 3 below.
An unresolved disagreement between the human verifier and the adjudicator defaults to inclusion through
full-text screening (K.6's existing rule, unchanged) — never silent exclusion.

---

## Part 2 — EXCLUDE audit log (§6.3: reproducibly sampled, stratified audit)

One row per **audited** record only (not every AI EXCLUDE — see `AI_ASSISTED_SCREENING_DESIGN.md` §6.a
for the stratified sampling design and §6.b for the seed/selection procedure that determines which
records appear here).

| Field | Entry |
|---|---|
| Record ID (dedup key) | |
| Audit stratum | High-risk / Low-risk / Other |
| `audit_rank` value (from the deterministic seeded procedure) | |
| AI decision | EXCLUDE |
| AI reason code(s) | |
| AI confidence | LOW / MEDIUM / HIGH |
| Reviewer | |
| Review date/time (UTC) | |
| Blinded review: was reviewer aware this record was an AI EXCLUDE at review time? | ☐ Yes ☐ No (state actual blinding method used) |
| Human finding | ☐ CONFIRMED_EXCLUDE (AI decision correct) ☐ FALSE_EXCLUSION (should have been INCLUDE/UNCERTAIN) |
| If FALSE_EXCLUSION: what should the decision have been? | INCLUDE / UNCERTAIN |
| If FALSE_EXCLUSION: escalation level triggered (§6.4) | Level 1 / Level 2 / Level 3 |
| If FALSE_EXCLUSION: entry logged in the append-only deviations log (DEC-012)? | ☐ Yes — deviations-log reference: _____ |

**Escalation-ladder cross-reference:** any `FALSE_EXCLUSION` finding here triggers `AI_ASSISTED_
SCREENING_DESIGN.md` §6.4's ladder automatically — it is never resolved by editing this row alone. The
specific response required (stratum doubling, 100% stratum review, or full-corpus review) is logged in
Part 4 below, not decided ad hoc.

---

## Part 3 — Adjudication log (§6.5: disagreements and ambiguous cases)

One row per case routed to the screening adjudicator (`TO_BE_APPOINTED`, §8.2).

| Field | Entry |
|---|---|
| Record ID | |
| Source of referral | ☐ Part 1 escalation ☐ Part 2 false-exclusion finding ☐ Ambiguous clinical/methodological case raised directly |
| Primary verifier's position | |
| Adjudicator name | |
| Adjudicator's independent assessment | |
| Resolution (by discussion, logged) | |
| If unresolved: default applied | Included through full-text screening (K.6 default) |
| Date/time (UTC) | |

---

## Part 4 — Escalation-ladder event log (§6.4)

One row per Level-1/2/3 event triggered by Part 2. This is the authoritative record of every escalation
this study's screening stage ever invoked — required for the transparency reporting in
`AI_ASSISTED_SCREENING_DESIGN.md` §7, item 8.

| Field | Entry |
|---|---|
| Event date/time (UTC) | |
| Triggering record ID(s) | |
| Stratum affected | |
| Escalation level reached | 1 / 2 / 3 |
| Trigger condition met (state exactly, per §6.4's table) | |
| Response taken | |
| If Level 3: was a §4.4 post-hoc system correction triggered? | ☐ Yes — describe: _____ ☐ No |
| If a system correction was triggered: fresh calibration re-run reference | |
| Effect on final flow counts (K.18 evidence table) | |

---

## Part 5 — Calibration labeling log (§5.2, used once per calibration round, not per official record)

Completed once for the calibration sample, before any AI output is viewed for that sample.

| Field | Entry |
|---|---|
| Calibration round # | |
| Source of calibration sample (§5.1: (a) fresh development-only pull, or (b) AUTH-007 historical-set sub-sample) | |
| `N_calibration` (total sample size) | |
| Investigator labeling start/end date/time (UTC) — confirms blind to AI output | |
| `n_rel` (records the investigator labeled truly relevant) | |
| AI classification run date/time (UTC) — confirms after investigator labeling locked | |
| AI misses (truly-relevant records AI routed to EXCLUDE) | |
| Observed recall | |
| Clopper-Pearson lower 95% bound | |
| Gate result | ☐ PASS ☐ FAIL |
| If FAIL: revision made, fresh-draw requirement acknowledged | |
| Overlap-and-strip check performed against official corpus (§5.1)? | ☐ Yes — records stripped: _____ ☐ N/A (official corpus not yet built) |

---

*This instrument is blank as of this drafting pass. It becomes a real, dated record only once AI
classification, human verification, and the exclusion audit actually execute — none of which is
authorized by this document (see `AI_ASSISTED_SCREENING_DESIGN.md` §9).*
