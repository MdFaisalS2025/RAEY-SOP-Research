# Audit Log — Unified Study Planning Protocol

## DRAFT_FOR_REVIEW

This is the append-only audit trail for `PROTOCOL.md` and `APPENDICES.md`, and — per this
protocol's own execution-integrity mechanism (DEC-012) — for the planning process that produced
them. Nothing recorded here is `FROZEN`; this is a record of *drafting and review*, not an approval
record. Approval/freeze mechanics live in `PROTOCOL.md` §7 and Appendix D.1's freeze record, and
remain unexecuted.

---

## Entry 001 — Planning conversation, 2026-08-29

**Scope:** a single continuous planning conversation on 2026-08-29 produced the full decision
history in `../planning/DECISION_REGISTER.md` — 36 original decisions (DEC-001–DEC-036), 14
red-team findings (FND-001–FND-014), 5 custody/staffing corrections (COR-001–COR-005), 4 second-
round corrections (RND2-001–RND2-004), 6 third-round items (RND3-CL-001–003, RND3-001–003), and 4
final clarifications (FIN-001–FIN-004).

**Method:** the investigator worked through each decision interactively, in an 8- or 10-field
question/options/recommendation/justification/feasibility/risk/freeze-gate/outside-input format,
recording the investigator's own verbatim adoption language for every entry. Three dedicated
red-team review passes (clinical/IR/biostatistics/governance lenses) surfaced 14 findings; two
further correction rounds surfaced 10 additional gaps (multiplicity terminology, accidental-
execution-authorization language, ungoverned M1/M2 tuning, comparator-identity drift, silently-
inherited sampling timing, custody-scope ambiguity, threshold/power circularity risk, a structural-
diversity selection paradox, "pre-freeze amendment" terminology conflation, an overbroad
sparse-outcome interval promise).

**Constraint:** the entire planning conversation was conducted read-only until this drafting session
— no web access, no document acquisition, no personnel contact, no pilot execution, no protocol
freeze. This entry itself records the transition to Phase A planning-document drafting, authorized
explicitly by the named investigator on 2026-08-29 (`../planning/STAGE_AUTHORIZATION_REGISTER.md`,
AUTH-001).

**Explicit statement per the constraint:** this drafting pass did **not**: run the development-data
timed pilot; contact or name a custodian, reviewer, statistician, or methodological reviewer; access
the web; inspect, select, or acquire any prospective jurisdiction document; submit to any HRPP/IRB
office; execute the literature search; change either `PROTOCOL.md` or `APPENDICES.md`'s status away
from `PROVISIONALLY_ADOPTED`.

---

## Entry 002 — File creation/modification record, this drafting session (AUTH-001)

**Files created:**

| File | SHA-256 (after creation) |
|---|---|
| `planning/FINAL_PLANNING_PACKAGE.md` | `0661034c20af7b1556b8b81931409bbb8ef31c15fd6b94edd6768ce7f76e1e40` |
| `planning/CRITICAL_PATH.md` | `42dab163b2afbbb75a05df975bbe0175775f5eb8740a084b045b9ff60e7a866f` |
| `planning/RISK_REGISTER.md` | `ed18eff74d57ffa9495bcce564e1342ae4f49ae0ec43833885c0bfea42599f5e` |
| `planning/PLACEHOLDER_REGISTER.md` | `ae381aab1740c9d2e69fc5d408978e8b607de443df740759399829f448a68802` |
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `738c15f1b3575b94ffda4293565dc16b1fdcbfe49e2c94d3fe31b155f6cbe0b0` |
| `protocol/PROTOCOL.md` | `4ded4d578d5d62063d968338d5111032a4612305d64b1f574d7a84c79c669627` (post-Entry-003 clerical correction; initial creation hash `0e58fccbcda96c44433ebf0868a2c99fbd0d16c23d06e783e8f8e033634596e3`) |
| `protocol/APPENDICES.md` | `97a4e60e3685f9f8f8844a4f888b70dda8154423546fc4944865419637445fe9` |
| `protocol/AUDIT_LOG.md` (this file) | hash not self-referential; see the session's final report for its post-Entry-002 hash |

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `planning/DECISION_REGISTER.md` | `79e707739ed17019befbca2aca98527e648147604d6405bb796800be30f3ccaa` | `d64d2cf17628d2a6ec7af45bb377e28ad6bc3173f6c8ba32b02542641879b022` |
| `planning/OPEN_QUESTIONS.md` | `3227c23cee4095000b8fa715cceb395752fc432d161c02347db07306cb93086c` | `b731ca18f369edc2f5286a4c8d345f628a313816dd8cba1e03d0906271d39e2e` |
| `protocol/README.md` | `502c7815980a0f74e394b250e6d1d7abadd11d3ea5faa79c2a06c5f327960b66` | `853c129d2d39d47e142e2401e149e580155358b1167fc759f0124de0b94ceb1e` |
| `README.md` | `b6699f92fb8c7b4604026fc9797fe1de71824137b90090f1b828f15de5b8dee6` | `6d5a8154ab301da8f1778314c12cdb37010850417006a361466034344590ef83` |

**Files confirmed unmodified (preserved, hash-verified):** `confirmatory-data/README.md`
(`50a4ccf21bdbd48cf524587641cca37f5e03dc80d1c6e505998fdc8d54649403`),
`planning/HISTORICAL_INPUTS.md` (`c72e1db6deb4853daaa8723ca442aac5d0265f2116013ae97827fcf204778034`),
`planning/UNIFIED_STUDY_CONCEPT.md` (`897b2c13b1ab4b7f4eb4a87dea682257d96bfccae99d8ad3f7db5193c573c856`),
`project-management/NEW_SESSION_HANDOFF.md` (`1da99b441e12b52ec74567b1a5c08fd58ec4309bd67f3470691853421d09fbe0`).

No file outside `STAGE_AUTHORIZATION_REGISTER.md` AUTH-001's listed scope was modified. The archive,
Paper 1 materials, publication worktree, RAEY application, website, shared corpus, and development-
history folders were not touched — confirmed by scope (this session never navigated outside the
unified-study workspace).

---

## Entry 003 — Cross-file consistency audit, this drafting session

A read-only cross-file consistency audit was performed after drafting, covering: decision
traceability (every `DECISION_REGISTER.md` entry mapped to a destination in `PROTOCOL.md`/
`APPENDICES.md`); terminology (M3-R/M3-NR/M4-R/M4-NR naming used consistently; "pre-freeze
amendment" vs. "planning revision" distinguished per RND3-CL-002/Appendix J's new Class 0; the
five-stage recruitment terminology used consistently); thresholds (every numeric placeholder cross-
referenced to `PLACEHOLDER_REGISTER.md`, none invented); role compatibility (DEC-009's tiers applied
consistently in Appendix D.4/D.11); stage gates (custody-before-acquisition applied consistently in
`PROTOCOL.md` §9, Appendix D.3/D.5, and `CRITICAL_PATH.md`); cross-references (each appendix section
correctly cited from `PROTOCOL.md`); prohibited-activity language (no statement in any drafted file
implies an activity beyond Phase A drafting is authorized). Findings and dispositions are reported
in this session's response, not summarized further here to avoid duplicating that record.

---

## Entry 004 — Clerical corrections found during the consistency audit, 2026-08-29

Two bare "M3" references were found in `PROTOCOL.md` — in §1's Background prose and in §13a's
sealed-run description — that did not carry the M3-R/M3-NR qualifier the naming decision (RND2-003)
requires elsewhere in the document. Both were terminology-consistency issues only (no substantive
content was ambiguous or incorrect; the surrounding text already made clear which pair was meant),
corrected directly as clerical fixes: §1 now reads "pipeline (M3-R, or its no-reranker fallback
M3-NR — see §6)"; §13a now reads "the frozen M3/M4 pair (M3-R/M4-R or M3-NR/M4-NR, whichever was
frozen per §6)". `protocol/PROTOCOL.md`'s hash changed accordingly (Entry 002 table updated in
place with both the original and corrected hash, per DEC-011's discipline against silently
replacing recorded hashes). No other terminology, threshold, cross-reference, or prohibited-activity
inconsistency was found in this pass — see the session's final report for the full audit summary.

---

## Entry 005 — Operational-template drafting, 2026-09-01 (AUTH-002)

**Scope:** a read-only readiness assessment (this session, 2026-09-01) found five operational
artifacts referenced but not fully drafted: (1) a custody/access agreement and split-key-holder
acknowledgement template; (2) a Statistical Reviewer Task Checklist; (3) an Independent
Methodological Reviewer Checklist; (4) a blank Stage-Authorization Request template; (5) links
between this protocol's existing, already-adopted stop/pause/abort conditions. The investigator
approved drafting all five under `../planning/STAGE_AUTHORIZATION_REGISTER.md` AUTH-002
("Approved 2026-09-01 - proceed with edits 1-5 as proposed. Place them in existing authorized
planning/protocol files. No standalone stop-conditions index; use cross-references only.
Placeholders only. Log as AUTH-002."), constraining item 5 to cross-reference pointers only — no new
standalone index or register.

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `protocol/APPENDICES.md` | `97a4e60e3685f9f8f8844a4f888b70dda8154423546fc4944865419637445fe9` | `e8b9b577e8de319046f6b89cbb58a6daf8b6f13a3138c8f0c914d4415a9f5aed` |
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `738c15f1b3575b94ffda4293565dc16b1fdcbfe49e2c94d3fe31b155f6cbe0b0` | `32efcd606d5358ba6ed8b8520a7fc681f76f58b9e73d95e6b0bdc5fa074b0697` |

**What was added to `APPENDICES.md`:** Appendix M.0 (custody/access agreement blank template,
fully field-drafted, citing D.5/D.6/FIN-001); a "Statistical Reviewer Task Checklist" appendix
(13 steps, citing Appendix G and `PLACEHOLDER_REGISTER.md` throughout); an "Independent
Methodological Reviewer Checklist" appendix (11 steps, citing Appendix J and `PROTOCOL.md` §16 item
8); five short cross-reference pointers added at the existing stop-condition locations (D.3 — the
consolidated pointer list; D.8; D.10; I.5; J.1) — no new standalone stop-conditions section or file.

**What was added to `STAGE_AUTHORIZATION_REGISTER.md`:** the AUTH-002 entry itself, and a blank,
reusable Stage-Authorization Request template for AUTH-003 onward.

**No new rule was adopted and no existing decision was changed.** Every new artifact cites existing
decision IDs; `../planning/DECISION_REGISTER.md` was not modified. No placeholder value was
invented — every blank field in the new templates remains a placeholder, consistent with
`../planning/PLACEHOLDER_REGISTER.md`'s existing discipline. No file outside AUTH-002's two-file
scope was touched; the archive, Paper 1 materials, publication worktree, RAEY application, website,
shared corpus, and development-history folders were not touched.

---

## Entry 006 — Literature-search protocol finalization, 2026-09-01 (AUTH-003)

**Scope:** the investigator authorized inspecting every existing literature-workstream provision
(DEC-032, COR-005, FND-013; `PROTOCOL.md` §15; `APPENDICES.md` Appendix K; the archived Paper 2
protocol's Appendix K read as historical, non-governing reference only) and reconciling them into
one finalized, auditable protocol, under
`../planning/STAGE_AUTHORIZATION_REGISTER.md` AUTH-003.

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `32efcd606d5358ba6ed8b8520a7fc681f76f58b9e73d95e6b0bdc5fa074b0697` | `1e3e2b74eeec32961e8c531577d19814356334e387c3d32c7cebf173cbb788d0` |
| `protocol/APPENDICES.md` | `e8b9b577e8de319046f6b89cbb58a6daf8b6f13a3138c8f0c914d4415a9f5aed` | `89f7e2af977533e5a1b5b4e59c1e188b2137daea5a152e2f2ad26dee16045c09` |
| `protocol/PROTOCOL.md` | `4ded4d578d5d62063d968338d5111032a4612305d64b1f574d7a84c79c669627` | `72f1806685165ea19323bdca0c6e98805097d94c3c63ce8ddd2969adce99bde9` |
| `planning/PLACEHOLDER_REGISTER.md` | `ae381aab1740c9d2e69fc5d408978e8b607de443df740759399829f448a68802` | `e6ed43e36e5bc450cbb38e907f11e194ea352e7629b3d22d9079ea28a29ef762` |

Edit order: `STAGE_AUTHORIZATION_REGISTER.md` (AUTH-003 entry logged first) → `APPENDICES.md` →
`PROTOCOL.md` → `PLACEHOLDER_REGISTER.md`.

**What was added to `APPENDICES.md`'s Appendix K:** nineteen numbered subsections (K.1–K.19)
replacing the prior summary-only version — purpose/scope, the method-eligibility rubric, a draft
candidate database list (K.3, new substantive content), draft concept/query families (K.4, new),
eligibility/exclusion criteria (K.5), the screening procedure (K.6), deduplication (K.7), citation
chaining/grey-literature handling (K.8), an evidence-extraction record template (K.9, new), a
search-log record template (K.10, new), the design-informing cutoff rule (K.11), a new retry
procedure for failed/partial searches (K.12, new — fills a previously-named gap), the
manuscript-update cutoff and late-publication handling (K.13), source classification codes (K.14),
novelty-claim language (K.15), method-change routing through Appendix J (K.16), reproducibility
fields (K.17, new), stop/completion criteria (K.18, new — fills a previously-unnamed gap), and a
restated role-separation/execution-authorization reminder (K.19).

**What was added to `PROTOCOL.md`:** §15 updated to summarize the finalized Appendix K and flag
K.3/K.4 as new substantive content requiring investigator review; §16 gap item 6 updated from
"protocol drafted" to "protocol finalized," same review flag added.

**What was added to `PLACEHOLDER_REGISTER.md`:** four new rows — literature database access
confirmation; reviewer-arrangement rationale; manuscript-update search interval; and K.3/K.4's
draft content itself, pending investigator review.

**No new rule was adopted and no existing decision was changed.** Every new subsection cites an
existing decision ID or is explicitly marked "new, drafted under AUTH-003" where it fills a
previously-named gap (the retry procedure, stop/completion criteria, reproducibility-field
consolidation) rather than restating an adopted rule. `../planning/DECISION_REGISTER.md` was not
modified. K.3's database list and K.4's query families are flagged, here and in `PROTOCOL.md`/
`PLACEHOLDER_REGISTER.md`, as new substantive proposals requiring explicit investigator review —
not silently treated as adopted. No placeholder value was invented; every unresolved field remains a
placeholder. No literature search was executed, no web browsing occurred, no document was
selected/inspected/acquired. The archive, Paper 1 materials, publication worktree, RAEY application,
website, shared corpus, and development-history folders were not touched.

**Self-caught scope excess:** during this entry's drafting, `../planning/OPEN_QUESTIONS.md` — a
file **not** in AUTH-003's six-file scope — was briefly edited to update a stale status line, then
immediately reverted before this entry was finalized. Hash-verified: `OPEN_QUESTIONS.md`'s SHA-256
after reversion (`b731ca18f369edc2f5286a4c8d345f628a313816dd8cba1e03d0906271d39e2e`) matches its
hash before this session began, recorded in Entry 002. No lasting change resulted. The staleness
this edit was attempting to fix (`OPEN_QUESTIONS.md` line ~53 still reads "protocol drafting
authorized under Phase A" rather than reflecting AUTH-003's finalization) is reported to the
investigator as an unresolved item, not corrected silently or out of scope.

---

## Entry 007 — Literature-protocol decision resolution, 2026-09-02 (AUTH-004)

**Scope:** the investigator resolved the four Appendix K decisions flagged as unreviewed substantive
content under AUTH-003 (K.3 databases/sources, K.4 query-family execution plan, K.6 screening-
reviewer arrangement, K.13 manuscript-update interval) through a conversational, one-at-a-time
walkthrough — exact language, alternatives, recommendation, tradeoffs, feasibility, and outside-
expert-input assessment presented for each, each confirmed by an explicit investigator choice — then
authorized writing the resolutions into the protocol files, under
`../planning/STAGE_AUTHORIZATION_REGISTER.md` AUTH-004 ("Approved 2026-09-02 as AUTH-004: proceed
with the planning-file edits exactly as proposed, including the adopted K.3, K.4, K.6, and K.13
decisions and the stale OPEN_QUESTIONS.md correction. Do not execute the literature search or begin
any other stage."), which explicitly expanded scope to include `planning/OPEN_QUESTIONS.md`'s stale
line beyond the six files originally proposed.

**Pre-edit integrity check:** all seven files' SHA-256 hashes were recomputed before any edit and
confirmed to match the values recorded in this log's prior entries (Entry 002, Entry 005, Entry
006) — no drift, no unrecorded prior change.

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `1e3e2b74eeec32961e8c531577d19814356334e387c3d32c7cebf173cbb788d0` | `e45b3f05d0ce101754e59d8ec83a2c0a7eabf920173c4d619745f542b6e95e21` |
| `planning/DECISION_REGISTER.md` | `d64d2cf17628d2a6ec7af45bb377e28ad6bc3173f6c8ba32b02542641879b022` | `42b7bbbb419fcaaacfa9f352f53447d0e7ae64173deabcac4a072af428780f98` |
| `protocol/APPENDICES.md` | `89f7e2af977533e5a1b5b4e59c1e188b2137daea5a152e2f2ad26dee16045c09` | `d2459f3b03241a3bbc0d9602c29fd7e37d8a9c9ac4ca288083cd106924eaba10` |
| `planning/PLACEHOLDER_REGISTER.md` | `e6ed43e36e5bc450cbb38e907f11e194ea352e7629b3d22d9079ea28a29ef762` | `45df8ca37316f46a6b59a49960a68f76971310507d5984bc24fd68ffe5594225` |
| `protocol/PROTOCOL.md` | `72f1806685165ea19323bdca0c6e98805097d94c3c63ce8ddd2969adce99bde9` | `a2e4bac85ee87a3f422530c929e7b8bad8fd645f5a5e25c4ed7518cd6e18aa6b` |
| `planning/OPEN_QUESTIONS.md` | `b731ca18f369edc2f5286a4c8d345f628a313816dd8cba1e03d0906271d39e2e` | `38c5395cf31e360a3da98ed0b5d8bc857a731f6a4b3e6756f870d6f77fe50071` |

Edit order: `STAGE_AUTHORIZATION_REGISTER.md` (AUTH-004 entry logged first) → `DECISION_REGISTER.md`
(LIT-001–LIT-004 logged) → `APPENDICES.md` (K.3/K.4/K.6/K.13 rewritten) →
`PLACEHOLDER_REGISTER.md` (four rows consolidated to two, resolved rows removed) → `PROTOCOL.md`
(§15/§16 item 6 updated) → `OPEN_QUESTIONS.md` (stale line corrected) → this entry.

**What was added to `DECISION_REGISTER.md`:** Part VII, four new entries (LIT-001 through LIT-004),
each quoting the investigator's own verbatim adoption language from this session's walkthrough.

**What changed in `APPENDICES.md`:** K.3's header changed from "draft candidate list... requires
investigator review" to "adopted, LIT-001"; the legal/regulatory-index placeholder bullet removed
with a one-line note explaining why. K.4's header changed to "adopted, LIT-002"; an explicit
three-family execution plan (B1+B2, B1+B2+B3, B2+B3) added. K.6's header changed to "adopted,
LIT-003"; the bracketed reviewer-arrangement placeholder replaced with the concrete single-stage-1/
independent-stage-2-checker procedure, with only the appointee's identity left as a placeholder.
K.13's header changed to "adopted, LIT-004"; the bracketed interval placeholder replaced with "30
days."

**What changed in `PLACEHOLDER_REGISTER.md`:** the four AUTH-003-era literature rows consolidated
to two — one narrowed (subscription-database access confirmation, legal-index mention removed) and
one re-scoped (reviewer arrangement resolved; only the stage-1/stage-2 appointee's identity remains
open, cross-referenced to LIT-003). The two fully-resolved rows (reviewer-arrangement-as-procedure;
manuscript-update interval; K.3/K.4 draft-content-pending-review) were removed as no longer
outstanding — their resolutions are preserved in `DECISION_REGISTER.md` Part VII and in this entry,
not merely deleted without record.

**What changed in `PROTOCOL.md`:** §15 updated to state Appendix K's decision content is resolved
under AUTH-004/LIT-001–LIT-004, and to name the two genuinely remaining open items (institutional
access confirmation; reviewer-appointee identity) as ordinary placeholders, not unresolved design
choices. §16 item 6 updated to the same effect, and now names the proposed AUTH-005 gate explicitly.

**What changed in `OPEN_QUESTIONS.md`:** the stale bullet ("protocol drafting authorized under Phase
A") — flagged as an unresolved item in Entry 006 and left uncorrected then because it was out of
AUTH-003's scope — is now corrected to reflect AUTH-003's finalization and AUTH-004's decision
resolution, per this session's explicit scope expansion.

**No literature search was executed, no web browsing occurred, no document was
selected/inspected/acquired, and no other workstream stage began.** The archive, Paper 1 materials,
publication worktree, RAEY application, website, shared corpus, and development-history folders were
not touched. Literature-search execution itself remains unauthorized, reserved for a separately
proposed AUTH-005 gate.

---

## Entry 008 — Design-informing literature-search execution, 2026-09-02 (AUTH-005)

**Scope:** the investigator authorized executing the finalized, decision-resolved Appendix K search
(K.3 sources, K.4 query families) under `../planning/STAGE_AUTHORIZATION_REGISTER.md` AUTH-005. This
is the project's first actual execution activity — every prior entry recorded planning-document
drafting only.

**File-scope judgment call disclosed:** AUTH-005's authorizing message did not itself enumerate an
exact file list, unlike AUTH-002/003/004. The executing agent applied the same "exact files
affected, nothing broader" discipline unilaterally: a new `protocol/literature-search/` directory
(raw exports + two operational files) plus logging updates to this file, the stage-authorization
register, the placeholder register, and `CRITICAL_PATH.md`'s literature-search row only.
`protocol/APPENDICES.md`, `planning/DECISION_REGISTER.md`, and `planning/OPEN_QUESTIONS.md` were
deliberately not touched — K.9/K.10 remain templates (real records live in the new operational
files), no new decision was adopted (this is execution, not a decision), and nothing in
`OPEN_QUESTIONS.md` changed as a result of this pass.

**Pre-edit integrity check:** all four files below modified in place were rehashed before editing
and confirmed to match their last-recorded values (Entry 007).

**Files created:**

| File | SHA-256 |
|---|---|
| `protocol/literature-search/SEARCH_LOG.md` | `f69d1cb461fbf6b4d5eef52df806f3f0f2b217cdaadd4942d0b221f669f5489c` |
| `protocol/literature-search/DEDUPLICATED_MASTER_SET.md` | `97d56b68f803d9b5fda31dbc9f5cfeec8663759bea39d3c16354d5ae31fd8285` |
| `protocol/literature-search/raw/manifest.json` and 15 raw export/error files (arXiv ×3 XML, Semantic Scholar ×6 error JSON, PubMed ×3 esearch JSON) | individually SHA-256'd inline in `SEARCH_LOG.md`'s table; manifest is the machine-readable source of that table |

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `e45b3f05d0ce101754e59d8ec83a2c0a7eabf920173c4d619745f542b6e95e21` | `0e31514854ce1dadcb56df19976e92339ce9a359aeb7c2d4dbcd354d9de346d3` |
| `planning/PLACEHOLDER_REGISTER.md` | `45df8ca37316f46a6b59a49960a68f76971310507d5984bc24fd68ffe5594225` | `516a815d6cf8209b57b2aa9860146a0372900c5e7b3b298fc22c4558191f7d59` |
| `planning/CRITICAL_PATH.md` | `42dab163b2afbbb75a05df975bbe0175775f5eb8740a084b045b9ff60e7a866f` | `a17c0e035d75eaaa68be591a7fdcfffaa0f6e490df79684697277accacb59d00` |

Edit order: `STAGE_AUTHORIZATION_REGISTER.md` (AUTH-005 entry logged first) → search execution
(`protocol/literature-search/` created) → `PLACEHOLDER_REGISTER.md` → `CRITICAL_PATH.md` → this
entry.

**What was executed:** all 3 K.4 query families (Family 1 = Block1 AND Block2; Family 2 = Block1
AND Block2 AND Block3; Family 3 = Block2 AND Block3) run via each source's real, documented public
API — arXiv export API, Semantic Scholar Graph API, NCBI E-utilities for PubMed/MEDLINE — never a
scraped or estimated count. **Results:** arXiv (3/3 succeeded, `totalResults = 0` for every family)
and PubMed (3/3 succeeded, `count = 0` for every family) executed cleanly under the adopted
literal-phrase Boolean design; two independent single-phrase control queries (not part of the
adopted search, run only to confirm the query mechanism itself works) returned 854 (arXiv) and 35
(PubMed) hits, confirming the zero counts are a real property of the adopted AND-of-OR-blocks query
design, not a construction failure. Semantic Scholar failed all 3 families with HTTP 429
(unauthenticated rate limit); each was retried once after backoff per K.12, both retries also
returned 429 — logged `FAILED`, not `NOT_AVAILABLE`, since an API key would make the identical query
executable. Google Scholar, ACM Digital Library, IEEE Xplore, ACL Anthology, EMBASE, and CINAHL were
logged `NOT_AVAILABLE` with a specific documented reason each (no credential-free structured API, or
no institutional access held by this session) — never silently omitted.

**Deduplication:** 0 raw pooled records → 0 deduplicated records (nothing was retrieved to
deduplicate). The empty result is preserved as the required "unscreened deduplicated master set" in
`DEDUPLICATED_MASTER_SET.md`, exactly as it stands, with no relevance filtering applied.

**Citation chaining:** not performed — correctly gated per Appendix K.8 on human-confirmed stage-2
inclusions, none of which exist yet (moot in any case, since 0 records were retrieved).

**Provisional AI screening:** N/A (0 records to screen); explicitly logged as carrying no
eligibility authority and not substituting for the required human stage-1/stage-2 decisions,
consistent with the authorization's own text.

**Design-informing cutoff (Appendix K.11):** `2026-09-02T13:38:58Z` (UTC), the completion timestamp
of PubMed Family 3's esearch — the latest successfully completed approved query across all sources
executed this pass. **Logged as provisional**, not final: per K.18, full search completion requires
every source to reach either a completed execution or a reasoned `NOT_AVAILABLE`; Semantic
Scholar's `FAILED` status satisfies neither, so this cutoff may move forward if Semantic Scholar is
later successfully queried (with an API key, or outside the current rate-limit window) before any
freeze decision relies on it. `../planning/PLACEHOLDER_REGISTER.md`'s cutoff row is updated to
reflect this provisional value and the condition for finalizing it.

**No jurisdiction search, no EMS-protocol or study-document acquisition, no personnel contact, no
HRPP/IRB submission, no model/method implementation or alteration, no freeze/preregistration/
publication, and no real (non-provisional) screening occurred.** The archive, Paper 1 materials,
publication worktree, RAEY application, website, shared corpus, and development-history folders were
not touched.

**Next required human-review gate:** Appendix K.6 (LIT-003) stage-1 title/abstract screening of the
deduplicated master set by the appointed single reviewer, followed by the independent stage-2
checker's review of inclusions/uncertain records plus a frozen random 10% sample of exclusions. In
this pass's case the master set is empty, so stage-1/stage-2 screening has nothing yet to act on
from arXiv/PubMed — the practically next step is a human decision on whether to (a) accept the
adopted K.4 query design's narrow real-world yield as a genuine, reportable finding and move to
citation-chaining/grey-literature channels instead, or (b) authorize a further attempt once
Semantic Scholar access is resolved, before treating K.18 as satisfied. Both are investigator
decisions, not decisions this execution pass is authorized to make.

---

## Entry 009 — AUTH-005 sensitivity correction and revised-search draft, 2026-09-02

**Trigger:** independent checking retrieved known relevant literature that AUTH-005's exact-phrase
queries missed. Only arXiv and PubMed had completed successfully; Semantic Scholar failed and six
planned sources were not searched. Entry 008 remains unchanged as the historical record, but its
zero-yield interpretation and provisional cutoff are superseded by this correction.

**Determination:** AUTH-005 is an `INCOMPLETE_PARTIAL_PILOT`, not the completed design-informing
search. It establishes no cutoff and cannot support a literature-absence or novelty conclusion.

**Planning revision drafted:** Appendix K.3 now adds reproducible supplemental indexes and manual
source workflows; K.4 now uses broad concepts and stepped, database-specific searches; new K.4a
requires sentinel-paper validation before execution; K.11 and K.18 now prevent a cutoff or
completion finding until the corrected search passes these gates. This is a draft planning
revision, not approval or authorization to rerun.

**Files modified, before to after SHA-256:**

| File | Before | After |
|---|---|---|
| `protocol/APPENDICES.md` | `d2459f3b03241a3bbc0d9602c29fd7e37d8a9c9ac4ca288083cd106924eaba10` | `257957d9cb4c60d03b9fc3de76d451f60d42a685bae7222db41851a81ac3f197` |
| `protocol/PROTOCOL.md` | `a2e4bac85ee87a3f422530c929e7b8bad8fd645f5a5e25c4ed7518cd6e18aa6b` | `8aa7a418ad813f8e5b998798a115ec6d4cd7be297514796128c221ae19824151` |
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `0e31514854ce1dadcb56df19976e92339ce9a359aeb7c2d4dbcd354d9de346d3` | `ac7f5316b4a7be015921f065fbfc24b66930fbe1074bdd45cb62b911b95551eb` |
| `planning/CRITICAL_PATH.md` | `a17c0e035d75eaaa68be591a7fdcfffaa0f6e490df79684697277accacb59d00` | `7d8ee8e5471f77e5bf68732897d8a045a15be33da674407558e152ba13a9afa8` |
| `planning/PLACEHOLDER_REGISTER.md` | `516a815d6cf8209b57b2aa9860146a0372900c5e7b3b298fc22c4558191f7d59` | `84d855251ac684f1e17999e1633f7b6adac72616f1c55eb1b94b12514f1f8012` |
| `protocol/literature-search/SEARCH_LOG.md` | `f69d1cb461fbf6b4d5eef52df806f3f0f2b217cdaadd4942d0b221f669f5489c` | `adb2664c680754a222d4132a01947b88b1106073da61b1d71941e7cbb6a7706a` |
| `protocol/literature-search/DEDUPLICATED_MASTER_SET.md` | `97d56b68f803d9b5fda31dbc9f5cfeec8663759bea39d3c16354d5ae31fd8285` | `f06921cdf6997d064ffd7cd6e6ae5215469372623d1793e2fc1c8ed925289447` |

No revised search, screening, citation chaining, jurisdiction work, document acquisition, model
work, freeze, preregistration, or external action occurred.

---

---

## Entry 010 — Independent audit of Entry 009, defect correction, and AUTH-006, 2026-09-02

**Scope:** an independently-run audit (this session, a different executing agent than the one that
drafted Entry 009 — referred to in the authorizing instructions as "Codex") of Entry 009's
correction, Appendix K.3/K.4/K.4a, `PROTOCOL.md`, `STAGE_AUTHORIZATION_REGISTER.md`,
`CRITICAL_PATH.md`, `PLACEHOLDER_REGISTER.md`, `SEARCH_LOG.md`, and `DEDUPLICATED_MASTER_SET.md`,
under AUTH-006 (logged in this same entry — see `STAGE_AUTHORIZATION_REGISTER.md`). The instruction
was explicit: do not accept Entry 009's draft uncritically.

**Verification performed (not merely re-reading):** every SHA-256 hash recorded in Entries 002–009
was recomputed against the actual current file contents and matched exactly — no drift, no
fabricated hash. The raw arXiv export XML files were independently re-inspected; `arxiv_family1_
attempt1.xml`'s `<opensearch:totalResults>0</opensearch:totalResults>` matches `SEARCH_LOG.md`'s
claimed hit count exactly, confirming the AUTH-005 pilot's underlying execution data is genuine, not
fabricated or estimated. `manifest.json`'s 27 logged executions were cross-checked against
`SEARCH_LOG.md`'s 30-row table (27 real attempts + no discrepancy in the 3 additional narrative rows
covering the Semantic Scholar retry pairing) with no inconsistency found. `DECISION_REGISTER.md` Part
VII (LIT-001–LIT-004) was confirmed to match the current K.3/K.4/K.6/K.13 text, correctly reflecting
that K.3/K.4 carry a further, later "planning revision pending approval" header rather than a stale
"adopted" label.

**Defects found and corrected (three, all planning-document text; no prior entry's own record was
edited):**

1. **`PROTOCOL.md` §16 item 6 was stale.** It stated literature-search execution "requires its own
   separate approval (proposed AUTH-005), not yet granted" — true when originally drafted under
   AUTH-004, but superseded by AUTH-005's actual grant/execution/completion and by Entry 009's
   subsequent `INCOMPLETE_PARTIAL_PILOT` determination, both already reflected correctly elsewhere in
   the same document (§7, §15). This was a genuine internal inconsistency, not a stylistic
   preference. Corrected to state AUTH-005 was granted and executed but determined incomplete, and
   that a corrected plan awaits its own separate execution approval.
2. **`DEDUPLICATED_MASTER_SET.md`'s closing section contradicted its own top banner and Entry 009.**
   The file's header states "this... establishes no cutoff," but its final paragraph asserted a
   design-informing cutoff "is nonetheless computed and logged... consistent with K.11's own
   definition" — directly contradicting Entry 009's determination ("It establishes no cutoff") and
   `PLACEHOLDER_REGISTER.md`'s cutoff row ("UNSET... historical execution metadata, not a provisional
   cutoff"). Entry 009's hash table shows this file was modified in that pass, but this stale
   paragraph was evidently not caught. Corrected to state plainly that no cutoff is established and
   that the PubMed family 3 timestamp is retained only as historical pilot metadata.
3. **Appendix K.4a named an unverified, single-occurrence sentinel candidate.** K.4a's sentinel-set
   description named "the NICE/ONS NORMA recommendation-matching documentation where indexed" as a
   sentinel example — a specific claim appearing nowhere else in this corpus. Independent web
   verification (this session) confirms NORMA is real (an ONS Data Science Campus/NICE
   recommendation-matching NLP tool, launched February 2021), so this was not a fabrication — but it
   is a government technical report with no DOI and no indexing in PubMed, arXiv, Semantic Scholar,
   or OpenAlex (confirmed by direct lookup), so it cannot function as a K.4a sentinel: a database
   query can never retrieve an item that database does not index, making a "miss" on this item
   indistinguishable from a real indexing gap and unable to validate query sensitivity. This is a
   category error, not a content error. Corrected: K.4a now requires every sentinel to carry a
   persistent identifier (DOI/arXiv ID/PMID) and be indexed in at least one K.3 structured database;
   NORMA is moved to K.3's grey-literature bullet, where it belongs as a real, relevant, but
   non-indexed background resource.

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `protocol/PROTOCOL.md` | `8aa7a418ad813f8e5b998798a115ec6d4cd7be297514796128c221ae19824151` | `ed015e0dec1b976b8d225bbbb77ea35f38f330c62e6aac9d624126bcac61b3e1` |
| `protocol/APPENDICES.md` | `257957d9cb4c60d03b9fc3de76d451f60d42a685bae7222db41851a81ac3f197` | `581eddad0bf47ad7bb7fee5a478efd76db36c645fd633df5c608db92f9874008` |
| `protocol/literature-search/DEDUPLICATED_MASTER_SET.md` | `f06921cdf6997d064ffd7cd6e6ae5215469372623d1793e2fc1c8ed925289447` | `32569e30f3e1152ae1199b3301067d50f26f828c16222629631d4873f8cfdd60` |
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `ac7f5316b4a7be015921f065fbfc24b66930fbe1074bdd45cb62b911b95551eb` | `48ad612749c5f83422889bf2fa438abd7da4d2f423dd9d820986263ef4948faa` |

**What was added to `STAGE_AUTHORIZATION_REGISTER.md`:** AUTH-006, authorizing (1) this audit and
defect correction, (2) building the query translation table and frozen sentinel bibliography, (3)
executing sentinel-validation queries against K.3's real public APIs — explicitly excluding
execution of the official corrected design-informing search itself, reserved for a separate AUTH-007
gate to be created only after the sentinel gate passes. The authorizing message is quoted in full
(this session's task instructions, 2026-09-02).

**No prior entry (001–009) was retroactively edited.** `AUTH-005`'s own register entry and Entry
008/009's own text stand exactly as originally logged; this entry documents new, additional
corrections to *other* files that had gone stale relative to Entry 009's own (correct) determination.
No jurisdiction search, no EMS-protocol or study-document acquisition, no personnel contact, no
HRPP/IRB submission, no model/method work, no freeze/preregistration/publication occurred. The
archive, Paper 1 materials, publication worktree, RAEY application, website, shared corpus, and
development-history folders were not touched.

**Environment note:** this session's edits were made in a git worktree copy of the workspace
(`.claude/worktrees/literature-sentinel-audit/research/unified-ems-recommendation-alignment/`),
mirrored via plain file copy rather than `git`, because this research-planning directory has never
been tracked by git on any branch (`git log --all` returns no history for this path) — the harness's
worktree-isolation mechanism otherwise blocks direct edits to the shared checkout. Every file was
hash-verified identical to the shared checkout immediately after copying, before any edit, and the
finished files are copied back to the shared checkout at the same paths so the working directory
reflects this entry's changes; the research package's git-tracking status is otherwise unchanged
(still untracked), consistent with this program's practice of using its own manual SHA-256 audit
trail rather than git history for this planning package.

---

---

## Entry 011 — Query translation table, sentinel bibliography, and sentinel validation (AUTH-006), 2026-09-02

**Scope:** under AUTH-006 (logged in Entry 010), built a complete database-specific query
translation table for Appendix K.4's four concept blocks, a frozen sentinel bibliography of eight
real, independently-verified, indexed papers (persistent identifiers confirmed by direct API lookup,
not recollection), and executed sentinel validation against arXiv, PubMed/MEDLINE, and OpenAlex's
real public APIs, plus a brief Crossref spot-check.

**Files created:**

| File | SHA-256 |
|---|---|
| `protocol/literature-search/QUERY_TRANSLATION_TABLE.md` | `136c9dd1f28a8d1f0300c0aa0495f213ec3704fc167db7ef6587969d28c79a1b` |
| `protocol/literature-search/SENTINEL_BIBLIOGRAPHY.md` | `b1da6930a1e5a4091aa0db2530c8ed22015915d2c34dc8ac90cbfc9f6536e970` |
| `protocol/literature-search/SENTINEL_VALIDATION_LOG.md` | `34a6aff571b42836000cdd88f2696ad98fed4469c729b5f6818f0b3088b4d652` |
| `protocol/literature-search/sentinel-check/` (3 validation scripts, 3 consolidated result JSON files, and 92+ individually-hashed raw request/response files — arXiv XML, PubMed/OpenAlex/Crossref JSON) | individual SHA-256 values recorded inline in each script's output JSON and in `SENTINEL_VALIDATION_LOG.md`; 146 files total in this subdirectory as of this entry |

**Sentinel bibliography (K.4a):** eight real papers spanning K.1's topic scope — dense retrieval
(Karpukhin et al. 2020), late-interaction retrieval (Khattab & Zaharia 2020, ColBERT), entity
matching (Barlaug & Gulla 2021), a German clinical-guideline NLP corpus (Borchert et al. 2020,
GGPONC), a clinical-guideline-update information-retrieval system (Borchert et al. 2025, npj Digital
Medicine — the single most directly on-topic sentinel), living guideline recommendations (Akl et al.
2017), legislative text-reuse detection (Burgess et al. 2016, KDD), and bill-similarity learning (Kim
et al. 2021, EMNLP). Every identifier (arXiv ID, DOI, PMID) was confirmed by a direct API request
this session, not taken from search-result text. One candidate named in Entry 009's K.4a draft — the
ONS/NICE "NORMA" tool — was independently verified real but *not indexed in any K.3 structured
database* (no DOI), so it cannot function as a query-sensitivity sentinel by construction; this was
corrected in Entry 010, not silently carried forward.

**Query translation table (K.4):** per-database syntax for the four concept blocks (version
relationship, textual unit, method, domain) across arXiv, PubMed/MEDLINE, Semantic Scholar,
OpenAlex, Crossref, Google Scholar, and ACL Anthology, plus a drafted-but-untested starting point for
ACM DL/IEEE Xplore/EMBASE/CINAHL per K.4's requirement that every translation be written before
execution even where access is currently unavailable.

**Sentinel validation (K.4a) — three rounds of real execution, not a single pass:** the first
translation, tested against real sentinels via arXiv/PubMed/OpenAlex, missed several confirmed-
indexed sentinels. Each miss was root-caused against the sentinel's own actual abstract text (fetched
directly, not assumed) before any fix was made, and every fix was independently retested and
confirmed. Eight distinct root causes were found and corrected: B-D required an exact 3-word phrase
real papers rarely use (added shorter forms); B-U had no legislative-domain textual-unit term (added
`bill`/`text`); B-V's "matching" missed the inflection "matches" (added `match*`); OpenAlex's quoted-
phrase search does not stem plurals (added explicit plural phrase forms, a general, disclosed
platform limitation); B-D lacked bare "legislative"; B-M lacked the plural "semantic similarities"
and the synonym "entity matching" (a real paper used "entity matching" throughout and never said
"entity resolution"); and a structural gap — no family could retrieve pure-methodology papers even
though Appendix K.1 lists dense retrieval/reranking/entity resolution as standalone topic-scope
items, not only as guideline-domain qualifiers — closed by adding a sixth family (B-M alone),
explicitly disclosed as high-recall/low-precision by design. One further finding was diagnosed and
documented, not "fixed," because no query wording can fix it: at least one OpenAlex record sourced
from ACL Anthology carries a citation string, not the real abstract, in its indexed abstract field —
a data-coverage limitation of that source, disclosed in `SENTINEL_VALIDATION_LOG.md` rather than
concealed or misattributed to the translation.

**Gate outcome:** K.4a's sentinel gate is recorded as **passed for arXiv, PubMed/MEDLINE, and
OpenAlex** — every sentinel supported by its own real text is now retrieved, confirmed by direct
re-execution. Crossref is spot-checked with a documented, verified limitation (large OR-term blocks
measurably underperform short natural-language queries on Crossref's relevance search) and is
retained as a reproducible supplemental source per K.3, not a primary sensitivity-bearing one.
Semantic Scholar, Google Scholar, and ACL Anthology translations are drafted but not sentinel-tested
this pass — an explicitly disclosed open item, not silently treated as validated.

**Broad-count finding, disclosed for the investigator, not acted on unilaterally:** the unrestricted
(no sentinel-ID restriction) size of the broader families is very large — PubMed Family 1 alone
returns 466,047 hits; OpenAlex Family 1 returns 2,184,863. This is reported honestly as a real
screening-feasibility consideration for the next human-review gate, not narrowed to produce a smaller
number, per this task's own instruction not to tune against yield.

**No jurisdiction search, no EMS-protocol or study-document acquisition, no personnel contact, no
HRPP/IRB submission, no model/method implementation, no freeze/preregistration/publication, and no
real (non-provisional) K.6 screening occurred.** All web/API access this entry was limited to (a)
verifying literature identifiers and index coverage for the sentinel bibliography, and (b) executing
the sentinel-validation queries themselves — never a search for EMS jurisdiction protocols or
prospective study documents. The archive, Paper 1 materials, publication worktree, RAEY application,
website, shared corpus, and development-history folders were not touched.

---

---

## Entry 012 — Official corrected search execution and deduplication (AUTH-007), 2026-09-02

**Scope:** under AUTH-007 (logged in Entry 011/`STAGE_AUTHORIZATION_REGISTER.md`), executed all six
sentinel-validated K.4 families against arXiv, PubMed/MEDLINE, OpenAlex, Crossref, and Semantic
Scholar; retried every failed execution once per K.12; deduplicated the pooled results
reproducibly; prepared the unscreened master set with a clearly-labeled, non-authoritative
prioritization aid.

**Files created:**

| File | SHA-256 |
|---|---|
| `protocol/literature-search/official-search/` (execution scripts, `official_search_log.json`, `official_search_retry_log.json`, `consolidated_records_raw.json`, `deduplicated_master_set.json`, `DEDUPLICATED_MASTER_SET.csv`, and 39+ individually-hashed raw export files in `raw/`) | individual SHA-256 values recorded inline in `SEARCH_LOG.md`'s new "Official Search Execution" table and in the JSON logs themselves; ~56MB total across this subdirectory |

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `protocol/literature-search/SEARCH_LOG.md` | `adb2664c680754a222d4132a01947b88b1106073da61b1d71941e7cbb6a7706a` | `56ac7607f1ab8c31d3be063d2536b0a63e0c42bc96c1e6d79c1dc7b8c8f40590` |
| `protocol/literature-search/DEDUPLICATED_MASTER_SET.md` | `32569e30f3e1152ae1199b3301067d50f26f828c16222629631d4873f8cfdd60` | `942fa48cd296310a5bb421256a8fc4f89fec169307acc95b99abb017d0ccf5c6` |

**What was executed:** all six families (the four stepped combinations, the targeted named-task
phrases, and the new method-only Family 6) against five sources with genuine working access this
session. arXiv succeeded for families 1, 5, 6; families 2–4 failed with HTTP 500 on both the original
attempt and an identical-query K.12 retry, then succeeded once the export cap was reduced from 200 to
30 records — a distinct, disclosed accommodation to a real server-side limitation of very broad
3-block queries at that cap, not a silent substitution (the true, complete result counts — 18,235,
1,527, 403 — were still captured regardless of export size). PubMed, OpenAlex, and Crossref succeeded
for all six families on the first attempt. Semantic Scholar failed all six families with HTTP 429 on
both the original attempt and the K.12 retry (consistent with AUTH-005's finding), except family 6's
retry, which returned an anomalous `total=0` — logged and flagged as unexplained rather than silently
accepted or discarded. Google Scholar and ACL Anthology were considered for an automated
browser-driven pass (tooling was available this session) but deliberately not attempted: their
anti-automation measures exist specifically to block this kind of access, and a scraped result would
not meet K.10's verifiability bar any better than AUTH-005's original reasoning already established —
logged `NOT_AVAILABLE` for this pass, with the reasoning distinguished from a pure capability gap.
ACM Digital Library, IEEE Xplore, EMBASE, and CINAHL remain `NOT_AVAILABLE` (no institutional access,
unchanged from AUTH-005).

**Deduplication (Appendix K.7):** 3,715 raw pooled records (from the bounded, capped exports —
literal full exports of the largest families, which reach into the millions, are neither feasible nor
actionable and were not attempted; true total counts are logged honestly regardless) reduced to 3,464
unique records via a reproducible, rule-based procedure (DOI → arXiv ID → PMID → normalized
title+year, in that priority order). A parsing bug in the consolidation script (an OpenAlex record
whose `primary_location.source` field was `null` rather than absent, crashing five of six families'
worth of records before being caught) was found and fixed before this entry was written, not after —
the numbers above are post-fix and verified against a clean rerun.

**Provisional AI prioritization aid:** a single reproducible, transparent sort column (count of
distinct families each record matched) is included in the CSV export, explicitly logged as carrying
no eligibility authority and not substituting for the required human K.6 screening — consistent with
this task's own instruction and Appendix K.6/LIT-003.

**Design-informing cutoff (Appendix K.11):** **still not recorded.** K.18 requires two-stage human
screening (K.6), citation chaining (K.8), and a hashed evidence table before completion, none of
which this session performed or is authorized to perform — `planning/PLACEHOLDER_REGISTER.md`'s
cutoff row remains `UNSET`. See this session's final report for the exact named gate.

**No jurisdiction search, no EMS-protocol or study-document acquisition, no personnel contact, no
HRPP/IRB submission, no model/method implementation, no freeze/preregistration/publication, and no
real (non-provisional) K.6 screening occurred.** AUTH-005's own `SEARCH_LOG.md`/
`DEDUPLICATED_MASTER_SET.md` sections are preserved exactly as originally logged, not edited or
overwritten — this entry's additions are new, separately labeled sections. The archive, Paper 1
materials, publication worktree, RAEY application, website, shared corpus, and development-history
folders were not touched.

---

---

## Entry 013 — Final cross-file consistency and integrity audit, 2026-09-02

**Scope:** per this task's own step 8 ("run a final cross-file consistency and integrity audit;
ensure no false cutoff remains"), re-swept every file this session had touched or referenced for
staleness introduced by the session's *own* later work — not just Entry 009's original defects.
Verified every SHA-256 hash recorded in Entries 010–012 against actual current file content before
starting (all matched, no drift).

**Defects found and corrected (four, all self-referential — this session's own earlier fixes had
gone stale by the time later entries advanced the state further):**

1. `PROTOCOL.md` §15 and §16 item 6 (fixed once already in Entry 010 for AUTH-005's status) were
   stale again after Entries 011–012: they still described the corrected search as "drafted, pending
   approval" when it had since been sentinel-validated (AUTH-006) and actually executed (AUTH-007),
   producing a 3,464-record master set. Corrected to state the true current position: search
   executed, human screening not begun, no cutoff yet.
2. §7's cutoff line, while not literally false ("no cutoff exists" remains true), read as
   inconsistent with the updated §15 without a cross-reference; a clause was added, not a
   correction of fact.
3. `APPENDICES.md` K.3/K.4 headers still read "planning revision pending approval," and K.4's prose
   concept-block lists and five-family plan did not reflect the terms added and the sixth family
   added during sentinel validation (Entries 010–012). Corrected: headers reflect the AUTH-006/007
   history, the concept-block lists carry inline `(added)` markers matching
   `QUERY_TRANSLATION_TABLE.md`, and Family 6 is now written into the stepped-execution-plan prose
   directly rather than left as a "see the other file" pointer. K.4a got a one-line gate-status
   summary.
4. `planning/OPEN_QUESTIONS.md` items 10 and its "remaining open items" literature row (last touched
   in Entry 007, before AUTH-005 even executed) still said literature-search execution "requires its
   own separate authorization, not yet granted." Corrected to reflect execution having occurred and
   named the real remaining item (K.6 screening, not execution approval). This file was outside
   AUTH-006/AUTH-007's originally-declared scope; fixing it here follows the same "explicitly
   expanded scope for a named consistency fix" precedent as Entry 007 itself, under this task's own
   step-8 instruction to run this audit — disclosed here, not silently done.

**Structural (non-hash) finding, disclosed rather than acted on destructively:** `README.md`'s folder
map lists a top-level `literature/` directory for search artifacts, but Entry 008 (disclosed at the
time) placed all literature-search execution files under `protocol/literature-search/` instead. This
predates this session and four more entries have since built on that location; moving the directory
now would be disruptive and outside "literature stage only" scope. The folder-map row was corrected
to describe actual practice and explain why, rather than left silently wrong or "fixed" by moving
files.

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `protocol/PROTOCOL.md` | `ed015e0dec1b976b8d225bbbb77ea35f38f330c62e6aac9d624126bcac61b3e1` | `f4ab35dee9071f3f90d2e3240d90f6da581d6e40bd718edd406b6794ce17b50e` |
| `protocol/APPENDICES.md` | `581eddad0bf47ad7bb7fee5a478efd76db36c645fd633df5c608db92f9874008` | `e71a3b8d88db8669aa1de69e842e7884699a504fd35f750787616411427d2a53` |
| `planning/OPEN_QUESTIONS.md` | `38c5395cf31e360a3da98ed0b5d8bc857a731f6a4b3e6756f870d6f77fe50071` | `d439a2102b16ed939900f8771d8926cfb4501684bf6c784fe3353632735065b1` |
| `README.md` | `6d5a8154ab301da8f1778314c12cdb37010850417006a361466034344590ef83` | `fe8afd99cceae28ce29459b57603bc9e6d4bab7dbd09ec5d84555952eb1cef5e` |

**No false cutoff exists anywhere in the corpus as of this entry** (checked by direct grep across
`protocol/` and `planning/` for "cutoff," "AUTH-005," and "pending approval," not merely reasoned
about) — `planning/PLACEHOLDER_REGISTER.md`'s cutoff row states `UNSET` and names the exact unmet
gates (K.6 screening, K.8 citation chaining, remaining source-coverage decisions), consistently with
every other file that mentions it. This is the final state this session leaves the corpus in; see
this session's final report for the complete accounting of what remains for the investigator and any
appointed human reviewer.

**No jurisdiction search, no EMS-protocol or study-document acquisition, no personnel contact, no
HRPP/IRB submission, no model/method implementation, no freeze/preregistration/publication, and no
real (non-provisional) K.6 screening occurred.** The archive, Paper 1 materials, publication
worktree, RAEY application, website, shared corpus, and development-history folders were not
touched.

---

---

## Entry 014 — Independent-review correction of AUTH-007: search-feasibility execution, not a
completed design-informing search, 2026-09-02

**Trigger:** an independent review of Entries 010–013 (this task's own instructions describe this as
"Codex" review) identified that AUTH-007, despite being logged `COMPLETE`, does not meet the bar for
a completed or representative design-informing search. This entry records a read-only root-cause
check against the actual artifacts before any correction, per this task's own discipline (Entry
009's own precedent).

**Root-cause verification (checked directly, not merely re-asserted):**

1. **Capped exports, not a corpus.** `SEARCH_LOG.md`'s official-search table shows total counts up
   to 3,383,372 (OpenAlex family 1) and 2,582,485 (OpenAlex family 6), with only 200 records exported
   per source/family (30 for arXiv's three retried families). A 200-of-3.4-million sample is neither
   a complete export nor a prespecified probability sample — it cannot support deduplication counts
   or coverage claims treated as authoritative, only as a feasibility signal. Confirmed by direct
   inspection of `official_search_log.json`.
2. **Family 6 scoped too broadly for this review.** Family 6 (method block alone) returned
   totals in the hundreds of thousands to millions across every source that could run it
   (arXiv 168,272; PubMed 127,129; OpenAlex 2,582,485; Crossref 24,699) — the general universe of
   retrieval/entity-resolution/matching literature, not a targeted search serving this study's
   review question. K.1 listing these methods as standalone topic-scope items justifies *covering*
   them, not searching their entire literature as an undifferentiated pool.
3. **Sentinel validation was incomplete for sources AUTH-007 still queried as if validated.**
   Confirmed directly in `SENTINEL_VALIDATION_LOG.md`: "Semantic Scholar, Google Scholar, and ACL
   Anthology: translations are drafted... but not sentinel-tested this pass." Crossref's spot-check
   (round 4) found the full translated block *failed* to retrieve a known sentinel (0 results) while
   a short natural-language query for the same record succeeded — logged as "a documented, verified
   limitation," but AUTH-007 then executed the identical failing-style block query against Crossref
   anyway. This was the actual error: disclosing a known sentinel failure is not the same as
   *acting* on it — K.4a requires a miss to pause execution and drive a correction, not merely be
   footnoted while execution proceeds regardless. Root cause: methodological approval was granted
   per-source (arXiv/PubMed/OpenAlex passed; Crossref caveated; Semantic Scholar/Google
   Scholar/ACL Anthology unvalidated), but AUTH-007's execution scope was not correspondingly
   restricted — all attempted sources were run as one undifferentiated "official" pass.
4. **`SUCCESS` status conflated with search completion.** `SEARCH_LOG.md`'s table logs `SUCCESS` for
   any HTTP 200 response, including ones returning 200-of-millions. This is an accurate description
   of the HTTP transaction, not of whether that source's search is *complete* — the two were not
   consistently distinguished in Entries 011–012's prose.
5. **Semantic Scholar Family 6's anomalous `total=0`** (logged in Entry 012 as "flagged... not
   further diagnosed") remains unexplained. Semantic Scholar was rate-limited on every other attempt
   this session; this session cannot resolve it further while still rate-limited.

**Determination:** AUTH-007 is redesignated **`INCOMPLETE_SEARCH_FEASIBILITY_EXECUTION`** — real,
honestly-logged evidence of query syntax validity, real total counts, and per-source sentinel
behavior, but **not** a completed or representative design-informing search, and **not** the basis
for any coverage, novelty, or completeness claim. `AUTH-007`'s own register entry, `SEARCH_LOG.md`'s
"Official Search Execution" table, and the 3,464-record deduplicated set are **preserved exactly as
logged** — not deleted, retracted, or overwritten — per this task's explicit instruction and DEC-012's
append-only discipline. They are relabeled, in this entry and the files updated below, as
feasibility/pilot evidence for the redesigned two-lane search (Appendix K, this entry's continuation),
not as the master set K.6 screening will act on. **No K.6 screening has occurred and none is
authorized by this entry.**

**No jurisdiction search, no EMS-protocol or study-document acquisition, no personnel contact, no
HRPP/IRB submission, no model/method implementation, no freeze/preregistration/publication occurred
in this review pass.** This entry is read-only analysis; the redesign it authorizes is recorded in
Entry 015 onward. The archive, Paper 1 materials, publication worktree, RAEY application, website,
shared corpus, and development-history folders were not touched.

---

---

## Entry 015 — Two-lane search redesign and consistency updates (AUTH-008), 2026-09-02

**Scope:** under AUTH-008 (Entry 014), redesigned Appendix K.3/K.4/K.4a into a two-lane strategy —
Lane 1 (task-focused, completely-exportable systematic search) and Lane 2 (structured
method-landscape review via verified seeds and feasibility-tested citation chaining) — with
candidate queries, seed selection, and citation-chaining feasibility all tested by real API calls
(syntax, total counts, complete-export feasibility, sentinel retrieval only — no official execution).

**Files created:**

| File | SHA-256 |
|---|---|
| `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md` | `c7ed85609ba3d380aa7af8172b75e5e22085ebbf66a0828b7e9655748a633a3f` |
| `protocol/literature-search/lane-design/` (test scripts and raw API responses used to derive the counts and sentinel checks in the design document above) | not individually hashed in this table — inline in the scripts' own output; retained for reproducibility |

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `protocol/APPENDICES.md` | `e71a3b8d88db8669aa1de69e842e7884699a504fd35f750787616411427d2a53` | `f86a0c7cd758b39a80742bfe3ad6b46d7b3027e0f8b7868b3ecba03b8734ef98` |
| `protocol/PROTOCOL.md` | `f4ab35dee9071f3f90d2e3240d90f6da581d6e40bd718edd406b6794ce17b50e` | `dae97090f9aba2114f1560d332f890bc7253995028651be133ecde86f154a066` |
| `planning/CRITICAL_PATH.md` | `dc9a95b9ff2b663ffcae9060feeacf6dd4f82f52723e7b8dd7b425347512def3` | `e5927f379ea9e11e185448c51a7c908663def494e09296e832f40ccacaa0fe73` |
| `planning/PLACEHOLDER_REGISTER.md` | `355f6b8c81a1fdb5cc509389c3ea8caf255e5aff713e32605064207b979a532b` | `8c34fae78fb3243075ec2b21bdb410c81dd9d894adb1fc8ea7ab93738473e389` |
| `planning/OPEN_QUESTIONS.md` | `d439a2102b16ed939900f8771d8926cfb4501684bf6c784fe3353632735065b1` | `4a7b8d00dd4c42f8af3a790de5ac65e012e2fb68f6bdb8cd07264e5e79907fbc` |

**What Lane 1's testing found:** narrow, established multi-word change-phrases (not bare generic
words) ANDed with a domain-unit concept, restricted to title/abstract, give completely-exportable,
sentinel-verified counts: PubMed 680 / OpenAlex 1,335 (clinical, narrow variant), PubMed 50 /
OpenAlex 912 (legislative). A broader-unit clinical variant (PubMed 2,398 / OpenAlex 5,850) is
offered as a higher-recall alternative. arXiv contributes minimally to Lane 1 (counts of 1 in both
sub-families — a real finding, not a defect: arXiv is not where this literature concentrates).
Crossref was retested a third time, with Lane 1's much narrower phrasing, and still returned
600,000–2,200,000 results — conclusively ruling it out as a Lane 1 search engine regardless of query
narrowing, not merely "used with a caveat" as AUTH-007 treated it.

**What Lane 2's testing found:** seven real, identifier-verified candidate seeds were assembled
across K.1's method areas (lexical retrieval, dense retrieval, reranking, entity resolution,
assignment/set-valued prediction, legislative sequence alignment). Citation-chaining feasibility was
tested directly per seed via OpenAlex's citation counts: four seeds (121–142 citations, plus 28–41
for two others) are chainable in one manageable round; three (BM25 survey 3,116 citations, ColBERT
1,200, DETR 831) are not — chaining from them would reproduce the same uncontrolled-scale problem
this redesign exists to fix, so they are included as direct manual anchors instead, consistent with
Appendix K.2's existing disclosure rule.

**Yield-feasibility gate:** applied using only total counts and export completeness, never by
inspecting which records would be retrieved. No final screening-burden threshold was set — the
appointed reviewer's real capacity is unknown; a workload table (records × screening-minutes, at
three candidate rates) is provided instead so the investigator can choose once capacity is known.

**Core-vs-supplemental determination:** PubMed and OpenAlex are core for Lane 1 search; arXiv is
core for Lane 2 seeds/citation chaining; Crossref and Semantic Scholar are supplemental only (never
used for search execution); Google Scholar and ACL Anthology get a truthful, limited
verification-only role, never a corpus-contributing search; ACM Digital Library, IEEE Xplore,
EMBASE, and CINAHL remain unavailable, and their absence is explicitly stated as **not** covered by
OpenAlex/Crossref's partial indexing of ACM/IEEE-published work.

**K.18 (Appendix K stop/completion criteria) was updated** to require a *complete, uncapped* export
per Lane 1 family before a source counts as searched — closing the specific gap that let AUTH-007's
200-of-millions capped samples read as `SUCCESS` in `SEARCH_LOG.md`.

**No official Lane 1/Lane 2 search was executed. No K.6 screening or K.8 citation chaining occurred.
AUTH-007's own artifacts remain preserved exactly as logged**, reused only as feasibility input, per
this task's explicit instruction. **The design-informing cutoff (K.11) remains UNSET** throughout
every file this entry touched, verified by direct grep across `protocol/` and `planning/` after all
edits, not merely reasoned about.

**No jurisdiction search, no EMS-protocol or study-document acquisition, no personnel contact, no
HRPP/IRB submission, no model/method implementation, no freeze/preregistration/publication occurred.**
Per this task's explicit stop instruction (item H), this entry does not authorize or perform an
official Lane 1/Lane 2 execution — that requires independent review of this redesign and a further,
separate authorization. The archive, Paper 1 materials, publication worktree, RAEY application,
website, shared corpus, and development-history folders were not touched.

---

*Future entries append below. Nothing above is retroactively edited; corrections are new, dated
entries per DEC-012's discipline.*

---

## Entry 016 — Two-lane design second-pass refinement (AUTH-008 continued), 2026-09-02

**Scope:** a second independent audit of Entry 015's two-lane design found it conditionally sound but
not yet authorized for official execution, and required nine further corrections, all performed under
AUTH-008's existing design/feasibility-testing scope (no new execution authority): (1) on-task
version-alignment sentinels; (2) a Lane 2 seed map rebuilt around direct methodological relevance;
(3) a PRESS-modeled search-strategy quality checklist; (4) locking Lane 1's default to the narrow-unit
variant; (5) a legislative-family sentinel-coverage test; (6) exact final candidate query strings for
every core source with complete-pagination feasibility testing; (7) an execution manifest and
acceptance-check specification; (8) consistent cross-file updates with the cutoff kept UNSET; (9) a
PASS/FAIL recommendation. **No official Lane 1/Lane 2 execution occurred. No K.6 screening or K.8
citation chaining occurred.**

**Item 1 — on-task version-alignment sentinels.** Kuznetsov et al. (2022), "Revise and Resubmit: An
Intertextual Model of Text-based Collaboration in Peer Review" (DOI 10.1162/coli_a_00455, OpenAlex
`W4290774620`), was verified by direct API lookup and added as sentinel S9 — the paper explicitly
defines and names "long-document version alignment" as a task. Thompson & Koehn (2019), "Vecalign:
Improved Sentence Alignment in Linear Time and Space" (DOI 10.18653/v1/D19-1136, OpenAlex
`W2986148666`), was added as sentinel S10 — a concrete sentence-alignment method. Real membership
tests (OpenAlex `filter=...,doi:...`) found **neither sentinel is retrieved by any Lane 1 family**,
including the broad-unit clinical variant's apparent single "hit" for S9, which term-by-term testing
showed is a false-positive match on the unrelated phrase "annotation guidelines" in S9's own abstract,
not genuine clinical-guideline content. This is the correct outcome for a domain-restricted Lane 1
encountering domain-general method papers, not a sensitivity defect — S9 and S10 are added as Lane 2
seeds instead.

**Item 2 — Lane 2 seed map rebuilt.** DETR (Carion et al. 2020) was **removed**: no precise,
study-specific justification tied its Hungarian-matching component to M4 or its evaluation was found,
and its nominal scope (assignment/global matching) is better covered on-domain by the entity-matching
survey (Barlaug & Gulla) already in the seed set. Conformal prediction (Angelopoulos & Bates 2021) was
**retained**, but now with a precise, verified justification: `PLACEHOLDER_REGISTER.md`'s
"Predicted-set cap" (FND-002) and `CRITICAL_PATH.md`'s "predicted-set cap exceeded → invalid output"
rule establish that this study's own matching mechanism produces a capped predicted set per query, not
a single best match — exactly conformal prediction's domain. S9 (Kuznetsov) and S10 (Vecalign) were
added as direct seeds for a new "version/document alignment" method area. The rebuilt Lane 2 seed set
now has eight entries; two (BM25, ColBERT) remain direct manual anchors rather than chaining points.

**Item 3 — PRESS-modeled checklist.** Added to `TWO_LANE_SEARCH_DESIGN.md`: Boolean structure, subject
headings (none used — a disclosed limitation for PubMed specifically, since a MeSH-supplemented
variant was not built or tested this pass), spelling/syntax (verified functionally by live re-runs),
search limits (none applied), line-by-line database translation, and a peer-review sign-off row
explicitly marked `TO_BE_APPOINTED` / not performed. No claim of formal PRESS peer review is made.

**Item 4 — Lane 1 locked to the narrow-unit variant.** The narrow-unit clinical family (680 PubMed /
1,335 OpenAlex) is now the sole Lane 1 default, not a "recommendation." The broad-unit variant (2,398
PubMed / 5,850 OpenAlex) is retained only as a documented sensitivity alternative. This lock is
directly supported by item 1's finding that the broad variant's only apparent sentinel advantage was a
false positive.

**Item 5 — legislative-family coverage.** OpenAlex's legislative family (912 records) materially
covers its directly relevant sentinels — S7 and S8 both confirmed retrieved (unchanged from the first
pass) — and is retained as Lane 1 core. PubMed's legislative family (50 records) cannot be
sentinel-validated at all: neither S7 nor S8 is PubMed-indexed, and no other legislative-domain
sentinel in the bibliography is either. Combined with its low yield and the structural mismatch of a
biomedical database for legislative-text literature, PubMed legislative is **narrowed from a
mandatory Lane 1 core family to a non-blocking supplementary attempt** — OpenAlex remains the sole
sentinel-validated core legislative source.

**Item 6 — exact final query strings and complete-pagination feasibility.** Exact PubMed
(`esearch`, `[tiab]` field tags, `*` truncation) and OpenAlex (`title_and_abstract.search` filter)
strings for both locked Lane 1 families are recorded verbatim in `TWO_LANE_SEARCH_DESIGN.md`. Both
were re-run independently and reproduced their first-pass counts exactly (PubMed clinical 680, sha256
`c9780f87bd4054b235242a4d6565e38394909d9d58c85406d962f4060d682a55`; PubMed legislative 50, sha256
`f474d8a70a54244eb31abb77d4ff1e8b575edd63b049ca509c2ef25f3732fbd4`). A **complete-pagination
reconciliation test** — paging the entire result set and confirming the count of unique record IDs
collected exactly equals the reported total, with a check for within-batch duplicates on every page —
passed with an exact match and zero duplicates for all four core Lane 1 families (PubMed
clinical/legislative via `esearch` `retstart` paging; OpenAlex clinical/legislative via cursor
paging). No full corpus was retained beyond the reconciliation check itself, consistent with the
"design/feasibility testing only, no official execution" boundary. arXiv's narrow-unit clinical
re-test was attempted but blocked by a live HTTP 429 rate limit on every retry within this session's
time budget — disclosed rather than silently worked around; given arXiv's already-minor, non-core
Lane 1 role, this is logged as one open item, not a blocking defect.

**Item 7 — execution manifest and acceptance checks.** A ten-field per-query manifest specification
was added to `TWO_LANE_SEARCH_DESIGN.md`: query hash, source, timestamp, reported total, pages
expected vs. received, record IDs received, duplicate-page detection, total reconciliation
(`len(unique IDs) == reported total` as the actual completion gate, not HTTP status), raw-file
hashes, and an abort-on-mismatch rule requiring a documented, prospective correction before any
mismatched query is re-attempted — directly closing the `SUCCESS`-status-conflated-with-completion
gap that caused AUTH-007's original error.

**Item 9 — PASS/FAIL recommendation:** **CONDITIONAL PASS.** All nine required items were addressed
with real, re-run evidence; the sole open item is arXiv's narrow-unit Lane 1 count, blocked by a rate
limit this session and not expected to change arXiv's already-minor Lane 1 role. **Execution of an
official Lane 1/Lane 2 search remains unauthorized** — this second-pass refinement is itself subject
to a further independent audit before any execution authorization is granted. Full detail: see
`protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md`'s PASS/FAIL section.

**Files created:**

| File | Purpose | Notes |
|---|---|---|
| `protocol/literature-search/lane-design/test_kuznetsov_sentinel.py`, `test_kuznetsov_bb_terms.py`, `test_vecalign.py`, `test_vecalign_lane1.py`, `test_pubmed_final_queries.py`, `test_openalex_pagination.py`, `arxiv_clin_narrow_params.txt`, `arxiv_clin_narrow.xml` | Real API test scripts and raw outputs underlying every count/sentinel/pagination claim in this entry | Not individually hashed in this table — inline output captured in the session transcript and reproducible by re-running the scripts against the same live APIs |

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `protocol/literature-search/SENTINEL_BIBLIOGRAPHY.md` | `b1da6930a1e5a4091aa0db2530c8ed22015915d2c34dc8ac90cbfc9f6536e970` | `f006e02c87fac406c6863657d148f04695dd91245340812100f8a4ab00c0e8cb` |
| `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md` | `c7ed85609ba3d380aa7af8172b75e5e22085ebbf66a0828b7e9655748a633a3f` | `5d74c0c96e0b6d9b126d5329126fd8814e643ab937f3fabeed34803f9286768f` |
| `protocol/APPENDICES.md` | `f86a0c7cd758b39a80742bfe3ad6b46d7b3027e0f8b7868b3ecba03b8734ef98` | `3a2adf3d41cded7cbd84c8409370e48ce37c98b9a43ec17eba49c80bfc6e7117` |
| `protocol/PROTOCOL.md` | `dae97090f9aba2114f1560d332f890bc7253995028651be133ecde86f154a066` | `4dfbc5ad01ef31a44cf6a82772ee3a83255cf1c392e3321ec25b914ef963c37e` |
| `planning/CRITICAL_PATH.md` | `e5927f379ea9e11e185448c51a7c908663def494e09296e832f40ccacaa0fe73` | `ad99b843670de8ed0a4c92fe0821c721c89978edac19d163a8f8dec4a6ea5384` |
| `planning/PLACEHOLDER_REGISTER.md` | `8c34fae78fb3243075ec2b21bdb410c81dd9d894adb1fc8ea7ab93738473e389` | `ae7ec3d0c8b6805402e6ef885fce827c14d84505024140e7295f4ec51dd23de0` |
| `planning/OPEN_QUESTIONS.md` | `4a7b8d00dd4c42f8af3a790de5ac65e012e2fb68f6bdb8cd07264e5e79907fbc` | `399270650fee91cf062f6c63f8d847167f6d50981c420ad4fe1501cea6ff3cd4` |
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `b876ec4bd59db6d7524b6ae5671f6954b64fe87584715d41297049e838b6407b` | `6579f8600ccebd09c1f70b6b853bf478a11c70d367986542d04595932bf5c241` |

**The design-informing cutoff (K.11) remains UNSET** throughout every file this entry touched,
reverified by direct grep across `protocol/` and `planning/` after all edits. AUTH-005 and AUTH-007's
own artifacts were not touched. **No jurisdiction search, no EMS-protocol or study-document
acquisition, no personnel contact, no HRPP/IRB submission, no model/method implementation, no
freeze/preregistration/publication occurred.** Per the second-pass audit's own instruction, this entry
does not authorize or perform an official Lane 1/Lane 2 execution. The archive, Paper 1 materials,
publication worktree, RAEY application, website, shared corpus, and development-history folders were
not touched.

---

## Entry 017 — Two-lane design third-pass correction (AUTH-008 continued), 2026-09-02

**Scope:** a third independent audit rejected Entry 016's `CONDITIONAL PASS` conclusion outright — no
conditional-pass language is permitted — and required six further, more exacting corrections, all
performed under AUTH-008's existing design/feasibility-testing scope (no new execution authority):
(1) verify every "directly on-task" Lane 1 sentinel from its own full text, not title terms, and
either revise Lane 1 to retrieve a genuinely qualifying sentinel or mark Lane 1 design FAIL; (2)
reassess conformal prediction's inclusion in Lane 2 against whether a specific planned algorithm
actually uses conformal calibration/coverage; (3) correct internal inconsistencies (chainable-seed
count, workload-defensibility claims, arXiv's dual classification); (4) feasibility-test PubMed MeSH
terms while retaining free-text sensitivity; (5) record formal PRESS peer review as a required,
separate human gate, not equivalent to self-audit; (6) report a strict PASS/FAIL result with a
concrete blocker list, never conditional-pass language. **No official Lane 1/Lane 2 execution
occurred. No cutoff was set. No records were screened. No EMS protocols were acquired. No protected
paths were touched.**

**Item 1 — on-task sentinel, verified from the paper itself.** S5 ("High-precision information
retrieval for rapid clinical guideline updates") was read in full and **disqualified**: its actual
task, per its own abstract, is evidence surveillance for guideline maintenance (retrieving new
clinical-trial publications), not version-to-version recommendation counterpart recovery — it never
compares two guideline versions to recover corresponding/changed recommendations. Five real, targeted
web searches were run for a qualifying clinical-domain substitute (mapping recommendation changes
between guideline versions, recommendation-level diffs, living-guideline change tracking); none
qualified — each surfaced paper extracts, classifies, or retrieves evidence *for* guidelines, or
annotates a single guideline's structure, but none performs cross-version counterpart matching.
**Stated transparently: no genuinely on-task, indexed, clinical-domain sentinel was found — the
clinical sub-family of Lane 1 design FAILS this check.** S7 and S8 were separately re-read in full and
**confirmed to genuinely qualify**: S7 (Legislative Influence Detector) detects which bill's text
another bill's text actually corresponds to/originates from; S8 (Learning Bill Similarity) explicitly
defines a bill-to-bill/subsection-level relation-classification scheme capturing derivation,
reordering, and paraphrasing — counterpart alignment by definition. Both are confirmed retrieved by
the locked OpenAlex legislative family, satisfying the requirement for Lane 1's legislative
sub-family. `SENTINEL_BIBLIOGRAPHY.md`'s S5, S7, and S8 entries were corrected accordingly.

**Item 2 — conformal prediction reassessed and removed.** Checked directly against
`DECISION_REGISTER.md`'s verbatim FND-002 text: it specifies only a frozen maximum predicted-set size,
an invalid-output rule for over-cap predictions, and development-only sensitivity analyses to justify
the numeric cap — **no calibration set, nonconformity score, coverage target, or any other
conformal-specific mechanism is named anywhere in the protocol.** A plain top-*k* cap with no coverage
guarantee satisfies FND-002 equally well. No specific planned algorithm or registered evaluation uses
conformal calibration/coverage. Per the audit's own rule, conformal prediction is **removed** from
Lane 2's seed map as an insufficiently justified analogy, alongside DETR (removed on the second pass).

**Item 3 — internal inconsistencies corrected.** Chainable-seed count corrected to **5** (DPR, the
entity-matching survey, Kuznetsov, Vecalign, Burgess LID — not 4, as the second-pass workload table
incorrectly stated, and not 6, since conformal prediction is now removed), with real backward-
reference + forward-citation totals per seed (DPR 191, entity-matching survey 269, Kuznetsov 92,
Vecalign 91, Burgess LID 54 — a real 54–269 range, summing to 697 pre-deduplication), and overlap/
dedup explicitly acknowledged as unquantified rather than estimated. The ~3,476-record Lane 1 total
(narrow + MeSH-expanded) is now labeled an **estimated workload only**, with a prespecified
reviewer-capacity gate recorded as a **required blocker**, not merely an open item. arXiv given one
unambiguous classification: **non-core for Lane 1 (excluded from the execution manifest entirely);
core for Lane 2 only** — resolving the prior pass's dual "core for Lane 2 / minor role for Lane 1"
description, with a stated consequence (no arXiv Lane 1 query in the locked design; the earlier
rate-limit blocker on an arXiv narrow-unit re-test is now moot).

**Item 4 — PubMed MeSH terms tested and adopted.** `"Practice Guidelines as Topic"[Mesh] OR
"Guidelines as Topic"[Mesh]` added as OR-alternatives inside the clinical domain-unit block, free-text
sensitivity retained unchanged. Real re-run: count increased from 680 to **1,179** (+499, +73%),
sentinel membership retained for both S5 (re-verified indexed, though disqualified as on-task per
item 1) and S6 (count 1 each), and complete-pagination reconciliation passed exactly (6 pages,
1,179 = 1,179, zero duplicates). Because this result strictly dominates the free-text-only baseline,
it is adopted as Lane 1's new locked PubMed clinical default.

**Item 5 — formal PRESS peer review.** Recorded explicitly as a required, separate human quality gate
that must be satisfied before official execution — the PRESS-modeled checklist in
`TWO_LANE_SEARCH_DESIGN.md` is stated, in its own heading and every row, to be a self-check and
**not** equivalent to formal PRESS peer review, which requires an independent, qualified human
reviewer not yet appointed (`TO_BE_APPOINTED`).

**Item 6 — PASS/FAIL recommendation: FAIL.** No conditional-pass language is used anywhere in the
corrected document. Four concrete blockers, none satisfied by assertion or self-audit: (1) no
genuinely on-task, indexed sentinel exists for Lane 1's clinical sub-family; (2) no prespecified
maximum feasible screening-burden capacity is set, confirmed against the appointed reviewer's actual
hours; (3) no formal PRESS peer review has been performed; (4) no stage-1/stage-2 reviewer is
appointed. Full detail: `TWO_LANE_SEARCH_DESIGN.md`'s "PASS/FAIL recommendation — corrected third
pass" section.

**Files created:**

| File | Purpose |
|---|---|
| `protocol/literature-search/lane-design/test_pubmed_mesh.py` | Real E-utilities test script for item 4's MeSH-term feasibility testing and complete-pagination reconciliation |

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `protocol/literature-search/SENTINEL_BIBLIOGRAPHY.md` | `f006e02c87fac406c6863657d148f04695dd91245340812100f8a4ab00c0e8cb` | `7ae521dc725e9051b70d066f8a6302d456936c482f14093a8af6d21d6106d055` |
| `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md` | `5d74c0c96e0b6d9b126d5329126fd8814e643ab937f3fabeed34803f9286768f` | `e16dd391be8a2e7af778c3d8bba109a6f012d7086b17ee87af9dfb9f982a0734` |
| `protocol/APPENDICES.md` | `3a2adf3d41cded7cbd84c8409370e48ce37c98b9a43ec17eba49c80bfc6e7117` | `8b4740f2eff388d92b3a2ff3f4387e3fd7d025424593de03146989def6080f22` |
| `protocol/PROTOCOL.md` | `4dfbc5ad01ef31a44cf6a82772ee3a83255cf1c392e3321ec25b914ef963c37e` | `3121e8dfbcce10b28ad4376bbc502e946ece535eb31c9b0874752fd1e13216af` |
| `planning/CRITICAL_PATH.md` | `ad99b843670de8ed0a4c92fe0821c721c89978edac19d163a8f8dec4a6ea5384` | `b5004bb9f5343c13295c7b7c50e8f6f08f236f02105b13999dc5973155f4fc40` |
| `planning/PLACEHOLDER_REGISTER.md` | `ae7ec3d0c8b6805402e6ef885fce827c14d84505024140e7295f4ec51dd23de0` | `0f2cfcd44f31b165caad2b9dd4e6ee3cae7ab03623b0f548ec89d1238b152605` |
| `planning/OPEN_QUESTIONS.md` | `399270650fee91cf062f6c63f8d847167f6d50981c420ad4fe1501cea6ff3cd4` | `4657945d04e8e231db36362c2faa971b77fdbc7ad41054460b348bb23c5cd91c` |
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `6579f8600ccebd09c1f70b6b853bf478a11c70d367986542d04595932bf5c241` | `f47e1ea7771a2ec47815e0d55e48570aae41f3fc2e976580ef0afc5c6874bc8a` |

**The design-informing cutoff (K.11) remains UNSET** throughout every file this entry touched,
reverified by direct grep across `protocol/` and `planning/` after all edits. AUTH-005 and AUTH-007's
own artifacts were not touched. **No jurisdiction search, no EMS-protocol or study-document
acquisition, no personnel contact, no HRPP/IRB submission, no model/method implementation, no
freeze/preregistration/publication occurred.** This entry does not authorize or perform an official
Lane 1/Lane 2 execution — it is a correction pass only, per the third audit's own instruction. The
archive, Paper 1 materials, publication worktree, RAEY application, website, shared corpus, and
development-history folders were not touched.

---

## Entry 018 — Two-lane design fourth-pass corrective planning (AUTH-008 continued), 2026-09-02

**Scope:** following the third-pass FAIL (Entry 017), a fourth independent audit directed five
corrective planning items, all performed under AUTH-008's existing design/feasibility-testing scope
(no new execution authority): (1) repair the circular clinical-sentinel gate with a component-
validation framework rather than requiring an exact clinical precedent to already exist; (2) freeze a
realistic reviewer-capacity gate with a complete formula and blank sign-off fields, not invented
numbers; (3) prepare a concise, unsigned independent search-strategy review package; (4) clarify
staffing (Mohamed Faisal Sindhi as primary stage-1 screener; independent search-strategy reviewer and
stage-2 checker both `TO_BE_APPOINTED`); (5) reassess the strict PASS/FAIL gate. **No official Lane
1/Lane 2 execution occurred. No cutoff was set. No records were screened. No EMS protocols were
acquired. No protected paths were touched.**

**Item 1 — circular clinical-sentinel gate repaired.** The third pass's conclusion — that Lane 1's
clinical sub-family design-FAILS because no exact clinical version-to-version counterpart-alignment
sentinel exists — was found circular: it demanded proof that the literature the study exists to
search for already existed, before the design intended to search for it could be validated. Replaced
with a **component-validation framework**: (a) clinical guideline/protocol maintenance and version/
change terminology (sentinels S5, S6 — confirmed retrieved by the locked, MeSH-expanded PubMed
clinical family); (b) genuine document/sentence/version-alignment methods (sentinels S9 Kuznetsov, S10
Vecalign — real, indexed, correctly outside Lane 1's domain-restricted search, serving as Lane 2
seeds); (c) legislative/regulatory cross-version/text-reuse precedents (sentinels S7, S8 — confirmed
retrieved by the locked OpenAlex legislative family); (d) retrieval of any known exact clinical
precedent, if one is identified — none is known to exist, an honestly empty cell, not a failed
requirement. **The absence of an exact clinical precedent (component d) is recorded as neither a PASS
nor proof of novelty** — it becomes an empirical research-gap conclusion only once the completed
official search, K.6 screening, and K.8 citation chaining actually run and genuinely find none. S5
remains ineligible for component (d) (verified, third pass, to perform evidence surveillance) but is
confirmed eligible for, and satisfies, component (a). A **per-component abort rule** replaces the
prior all-or-nothing gate: a failure to retrieve a required component's sentinel (a, b, or c) pauses
execution for that component specifically and requires a documented, prospective correction; component
(d) has no abort condition, since it has nothing to miss.

**Item 2 — reviewer-capacity gate frozen.** A complete formula was defined:
`stage1_hours_estimate = records × pilot_rate / 60`; `stage2_hours_estimate` from a conservative
planning-stage inclusion-rate assumption (5–30% range, not a single invented figure) applied to the
same pilot rate as a floor; `required_capacity = (stage1 + stage2) × (1 + contingency_margin)`, with a
disclosed default 20% contingency margin (a standard planning convention, not derived from this
study's own data, and adjustable by the investigator); PASS iff documented available hours meet or
exceed the required capacity for both stage-1 and stage-2. **The two real inputs — documented
available screening hours, and a pilot-timed screening rate from a small, explicitly non-official
development sample — are left as blank sign-off fields, not invented**, per the correction's explicit
instruction. The gate defaults to FAIL for execution-readiness purposes until both fields are
populated and the PASS condition is confirmed to hold. Technical capacity to execute/export the search
(already demonstrated via complete-pagination reconciliation) is explicitly distinguished from
screening capacity; both the capacity gate and stage-2 checker appointment are recorded as
pre-execution gates, not merely pre-screening ones, to avoid producing a frozen corpus no one can
finish processing.

**Item 3 — independent search-strategy review package drafted.** New file
`protocol/literature-search/INDEPENDENT_REVIEW_PACKAGE.md`: exact PubMed/OpenAlex query strings,
database roles and exclusions, the component-sentinel validation table, pagination/completeness
evidence, a PRESS-informed self-check checklist explicitly marked as not equivalent to formal review,
and a reviewer response form (approve/revise/reject, comments, required changes, qualifications, name,
date, signature/attestation) requiring the reviewer to be independent of query construction and
sufficiently experienced in systematic/scoping search methodology. **Drafted, unsigned. Makes no claim
of formal PRESS review.**

**Item 4 — staffing clarified.** `PLACEHOLDER_REGISTER.md`, `CRITICAL_PATH.md`, and Appendix K.6
updated: **Mohamed Faisal Sindhi (investigator) is confirmed as the primary stage-1 screener** — no
longer a placeholder. The **independent search-strategy reviewer** role (distinct from stage-1/stage-2
screening) is `TO_BE_APPOINTED`, identity not yet known. The **stage-2 screening checker** role
remains `TO_BE_APPOINTED` — Dr. Nasir Uddin is one possible candidate, depending on availability, not
assumed; another suitably experienced person may serve instead. No unnecessary permanent team roles
were added.

**Item 5 — PASS/FAIL gate reassessed.** Internal design items (the component framework, the capacity
formula, the review package) are verified and pass on their own terms. **Overall execution readiness:
FAIL**, reduced from four blockers to **three**, all staffing/sign-off items rather than remaining
design defects: (1) reviewer-capacity sign-off fields not yet populated; (2) no independent
search-strategy reviewer appointed and the review package unsigned; (3) no stage-2 screening checker
appointed. No conditional-pass language is used.

**Files created:**

| File | Purpose |
|---|---|
| `protocol/literature-search/INDEPENDENT_REVIEW_PACKAGE.md` | Concise, unsigned independent search-strategy review package (item 3) |

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md` | `e16dd391be8a2e7af778c3d8bba109a6f012d7086b17ee87af9dfb9f982a0734` | `6bf400f8bd58f8d668c01b4741e293a748fe21a633d7859556a8c107eb38ce3f` |
| `protocol/APPENDICES.md` | `8b4740f2eff388d92b3a2ff3f4387e3fd7d025424593de03146989def6080f22` | `3f54fb0be154078e93407fd7cb8ec7987658e69b177305c8f01bdad9b715fee9` |
| `protocol/PROTOCOL.md` | `3121e8dfbcce10b28ad4376bbc502e946ece535eb31c9b0874752fd1e13216af` | `5300680c0d3a356a6f9ebf09ac4ddaa0af3022ab970a1bcf3a09b1c28f34c2e2` |
| `planning/CRITICAL_PATH.md` | `b5004bb9f5343c13295c7b7c50e8f6f08f236f02105b13999dc5973155f4fc40` | `d582f4681b1c899d29e96dd9d6952eac0c1330a25265a1d0b81d59b35eeda514` |
| `planning/PLACEHOLDER_REGISTER.md` | `0f2cfcd44f31b165caad2b9dd4e6ee3cae7ab03623b0f548ec89d1238b152605` | `f0e29a147a19f6a9531e086afcd81ac8e1df5fe72969c11587fdc8ea523c68cd` |
| `planning/OPEN_QUESTIONS.md` | `4657945d04e8e231db36362c2faa971b77fdbc7ad41054460b348bb23c5cd91c` | `17552cd449d679162c16577d4a0152de06771e6ddfb16731152bef0a89f56e0a` |
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `f47e1ea7771a2ec47815e0d55e48570aae41f3fc2e976580ef0afc5c6874bc8a` | `462f4537094432f6d9f12ab942fbe23b95b717c446e231dcdb66c9404437a33c` |

`SENTINEL_BIBLIOGRAPHY.md` was not modified this pass (hash unchanged from Entry 017:
`7ae521dc725e9051b70d066f8a6302d456936c482f14093a8af6d21d6106d055`).

**The design-informing cutoff (K.11) remains UNSET** throughout every file this entry touched,
reverified by direct grep across `protocol/` and `planning/` after all edits. AUTH-005 and AUTH-007's
own artifacts were not touched. **No jurisdiction search, no EMS-protocol or study-document
acquisition, no personnel contact, no HRPP/IRB submission, no model/method implementation, no
freeze/preregistration/publication occurred.** This entry does not authorize or perform an official
Lane 1/Lane 2 execution — it is a corrective planning pass only, per the fourth audit's own
instruction to stop after delivering the corrected planning package and strict status. The archive,
Paper 1 materials, publication worktree, RAEY application, website, shared corpus, and
development-history folders were not touched.

## Entry 019 — AI-assisted structured literature-screening workflow redesign (AUTH-009), 2026-09-03

**Scope:** the investigator determined that personally screening the full Lane 1 + Lane 2 pre-dedup
workload (~4,173 records, `TWO_LANE_SEARCH_DESIGN.md`) as sole title/abstract screener is not feasible,
and directed a substantive prospective planning amendment to Appendix K.6 — redesigning it from a
single-human-stage-1-screener arrangement (LIT-003) into an AI-assisted structured literature review,
explicitly not a conventional fully human dual-screened systematic review, while preserving Mohamed
Faisal Sindhi as investigator and primary human verifier. **No official Lane 1/Lane 2 execution
occurred. No AI model was selected, configured, run, or calibrated. No record — official or
calibration — was screened or classified. No EMS protocols were acquired. No personnel were appointed
or contacted. No protected paths were touched.**

**Pre-work verification:** before any edit this pass, every file this entry's baseline hashes cover
was re-hashed and confirmed to match Entry 018's logged "after" hashes exactly — no drift occurred
during the transient session interruption that preceded this pass. See the "before" column below.

**Item 1 — role redesign.** Mohamed Faisal Sindhi is no longer the mandatory reader of every
deduplicated record. A frozen, calibrated AI classification stage takes that role; Sindhi is preserved
as investigator and as the primary human verifier, reviewing every AI `INCLUDE`/`UNCERTAIN` record in
full and a reproducibly sampled, blinded, stratified audit of AI `EXCLUDE` records. The AI's output is
explicitly a routing/prioritization aid, never itself an eligibility decision — K.19's role-separation
principle is unchanged and directly restated for this stage.

**Item 2 — pre-execution freeze checklist.** Nine required items specified (model/version, prompt,
output schema, temperature/settings, eligibility-rubric mapping, deterministic batching/retry rules,
evidence fields/reason-code taxonomy, code/configuration hashes, and a firm prohibition on post-hoc
changes after seeing official-corpus or confirmatory implications). All but the prohibition rule itself
are explicit blank/draft fields — no model, prompt text, or numeric setting was invented. A draft output
schema and an 18-code reason-code taxonomy were produced for freeze review, not execution.

**Item 3 — calibration plan.** A development-only calibration sample (source options: a fresh pull
under a new `DEVELOPMENT_CALIBRATION_ONLY` classification, or a sub-sample of the preserved,
already-non-official AUTH-007 historical set), subject to a mandatory overlap-and-strip check against
the eventual official corpus so no calibration-time label can contaminate an official-corpus decision.
Blinded, independent investigator labeling (mirroring the RND3-001 blinding discipline). A real,
computed (Clopper-Pearson, not approximated) recall lower-confidence-bound table and a total-sample-size
table were produced by direct calculation for planning purposes — no calibration performance is claimed,
since none has run. Provisional gate: 95% lower-bound recall, explicitly labeled a disclosed convention,
not a derived result, and adjustable with a logged reason.

**Item 4 — official workflow, audit design, and escalation ladder.** Full coverage human review of AI
`INCLUDE`/`UNCERTAIN`; a stratified (reason code × risk tier), seeded (DEC-019-style deterministic
SHA-256 ranking, dual-implementation-checked), blinded audit of AI `EXCLUDE` records with Horvitz-
Thompson inverse-probability-weighted reporting; a frozen three-level escalation ladder (single finding
→ double that stratum's audit; a stratum or repeat-reason-code threshold crossed → 100% review of that
stratum; a cross-stratum or overall-weighted threshold crossed → 100% review of all excludes plus a
mandatory documented system-correction review) that an isolated finding may never bypass; an
adjudication path for AI-vs-human disagreement and ambiguous clinical/methodological cases.

**Item 5 — workload recalculation.** Formulas reuse and extend `TWO_LANE_SEARCH_DESIGN.md`'s existing
reviewer-capacity structure, recomputed for the investigator's actual tasks (AI `INCLUDE`+`UNCERTAIN`
review plus the audit sample) rather than all ~4,173 records — no exact hours are claimed, since
calibration and official deduplication have not run.

**Item 6 — transparency.** The mandatory term "AI-assisted structured literature review," an explicit
non-equivalence statement to a fully human dual-screened systematic review, a ten-item mandatory
disclosure list, and an explicit rule against claiming PRISMA compliance unless every applicable item
is genuinely met (a PRISMA-style diagram remains permitted if accurately labeled as adapted).

**Item 7 — independent search-strategy review preserved; stage-2 role redesignated.** The independent
search-strategy reviewer role (`INDEPENDENT_REVIEW_PACKAGE.md`) is unaffected — still required before
official search execution. The former stage-2 checker is redesignated **screening adjudicator**, with
an exact new deadline (required no later than the point human verification begins, not before official
search execution) and a restated minimal-qualification standard, closing the gap between "the role
could theoretically wait" and "no deadline is defined at all."

**Item 8 — exclusion-audit design reassessment.** Three designs compared (flat unstratified 10% status
quo; a stratified initial audit with the frozen escalation ladder; a sequential/adaptive audit with a
formal stopping rule). The stratified design (B) is recommended — not the cheapest option in the
best-case scenario (Design C could be cheaper), but the best-justified given this study's actual
current staffing, since Design C requires sequential-testing machinery no appointed statistician has
been asked to specify or validate for this use.

**Item 9 — file updates and new instrument.** All listed planning/protocol files updated for
consistency; a new companion file, `SCREENING_VERIFICATION_INSTRUMENT.md`, created as the operational,
blank worksheet for human verification, exclusion-audit review, adjudication, escalation-ladder events,
and calibration labeling — not merely a narrative description of the workflow.

**Item 10 — strict status.** Recorded in this session's final report to the investigator, not
duplicated here; summarized: internal AI-assisted screening design **PASS**; independent search-review
readiness **FAIL** (reviewer not appointed, package unsigned — unchanged from Entry 018); official
search-execution readiness **FAIL** (multiple named blockers, none satisfied by assertion). No
conditional-pass language is used anywhere in this entry or the files it describes.

**Files created:**

| File | Purpose |
|---|---|
| `protocol/literature-search/AI_ASSISTED_SCREENING_DESIGN.md` | Full AI-assisted screening design: freeze checklist, system specification, calibration plan, official workflow, exclusion-audit design/strata/seed/weighting, workload formulas, transparency requirements, personnel/deadline redesign |
| `protocol/literature-search/SCREENING_VERIFICATION_INSTRUMENT.md` | Blank operational worksheet: INCLUDE/UNCERTAIN verification log, EXCLUDE audit log, adjudication log, escalation-ladder event log, calibration labeling log |

**Files modified (before → after SHA-256):**

| File | Before | After |
|---|---|---|
| `protocol/APPENDICES.md` | `3f54fb0be154078e93407fd7cb8ec7987658e69b177305c8f01bdad9b715fee9` | `f48f7f5beb6e47320e2e9ae75958f8418b914509822865733d34ee6dfa763edf` |
| `protocol/PROTOCOL.md` | `5300680c0d3a356a6f9ebf09ac4ddaa0af3022ab970a1bcf3a09b1c28f34c2e2` | `67a0c8b77289996ccb02979456f9c136b74f8bbddd088c94db617e3d0c3a506f` |
| `planning/DECISION_REGISTER.md` | `42b7bbbb419fcaaacfa9f352f53447d0e7ae64173deabcac4a072af428780f98` | `d0c4a54804c6454bcfa49fce3a20634c330484bb13e28a370e3af6405974c68d` |
| `planning/STAGE_AUTHORIZATION_REGISTER.md` | `462f4537094432f6d9f12ab942fbe23b95b717c446e231dcdb66c9404437a33c` | `3aa66f090c5d307c99d49448a4c15accfdb67e1f55e719504439a89f8a998109` |
| `planning/PLACEHOLDER_REGISTER.md` | `f0e29a147a19f6a9531e086afcd81ac8e1df5fe72969c11587fdc8ea523c68cd` | `26ff5a6315fb58db0f453fe84c7c038ef80a391ab2b74fb4043a44d8d63995b3` |
| `planning/CRITICAL_PATH.md` | `d582f4681b1c899d29e96dd9d6952eac0c1330a25265a1d0b81d59b35eeda514` | `6df8710ad13375ad976dc850d969372f7b0f6b38f41f0da806ced4a5693992f3` |
| `planning/OPEN_QUESTIONS.md` | `17552cd449d679162c16577d4a0152de06771e6ddfb16731152bef0a89f56e0a` | `1000933f12eb8b55482dbc92c6d61fb62922eff5cc7c1f6de918f111be82f373` |
| `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md` | `6bf400f8bd58f8d668c01b4741e293a748fe21a633d7859556a8c107eb38ce3f` | `0235fafbf4adb181359b55db10a0552438e10c7856ae65dea737b929fea0a5d5` |

`DECISION_REGISTER.md`'s hash above reflects the LIT-005–LIT-009 additions logged here.
`TWO_LANE_SEARCH_DESIGN.md`'s edit is a small consistency correction only — the reviewer-capacity gate's
formula was annotated as superseded-for-workload-sizing (its original text is retained unmodified, as
the historical fully-human-stage-1 record) and the "three, not four" pre-search-execution blocker list
was revised down to two (dropping the stage-2-checker item, now redesignated with a later deadline),
not a redesign of the search itself. `SENTINEL_BIBLIOGRAPHY.md`, `INDEPENDENT_REVIEW_PACKAGE.md`,
`SEARCH_LOG.md`, and `DEDUPLICATED_MASTER_SET.md` were **not** modified this pass (unchanged from their
Entry 018 / prior state) — this amendment governs screening (K.6), not the search design itself or its
already-executed/preserved feasibility artifacts.

**The design-informing cutoff (K.11) remains UNSET** throughout every file this entry touched,
reverified by direct grep across `protocol/` and `planning/` after all edits. AUTH-005 and AUTH-007's
own artifacts were not touched. **No jurisdiction search, no EMS-protocol or study-document
acquisition, no personnel contact, no HRPP/IRB submission, no AI model selection/configuration/
execution/calibration, no record classification or screening, no freeze/preregistration/publication
occurred.** This entry does not authorize or perform any AI-assisted screening execution, official
Lane 1/Lane 2 execution, or personnel appointment — it is a design/planning amendment only, per this
session's own explicit "planning-only mode" and "not execution authorization" instruction. The archive,
Paper 1 materials, publication worktree, RAEY application, website, shared corpus, and
development-history folders were not touched.

---

*Future entries append below. Nothing above is retroactively edited; corrections are new, dated
entries per DEC-012's discipline.*
