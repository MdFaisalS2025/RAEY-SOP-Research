# Stage-authorization register — DRAFT_FOR_REVIEW

Required by the standing execution-authorization rule (FND-011): "Approval, provisional adoption,
formal adoption, or freezing of a rule that governs an activity does not authorize execution of
that activity. Every operational stage requires a separate, explicit, verbatim, dated authorization
identifying the permitted activity, scope, responsible persons, approved inputs, governing protocol
version and hash, start conditions, stop conditions, and prohibited adjacent activities." This
register is append-only and separate from `DECISION_REGISTER.md`, which records *what rules were
adopted*, not *what activities were authorized to execute*.

---

## AUTH-001 — Phase A planning-document drafting

- **Authorized activity:** creating and updating planning and draft-protocol files inside
  `C:\Users\Faisal\Desktop\Hospital SOP's Research\research\unified-ems-recommendation-alignment`.
- **Scope:** limited to the following files: `planning/FINAL_PLANNING_PACKAGE.md`,
  `planning/DECISION_REGISTER.md`, `planning/CRITICAL_PATH.md`, `planning/RISK_REGISTER.md`,
  `planning/PLACEHOLDER_REGISTER.md`, `planning/STAGE_AUTHORIZATION_REGISTER.md`,
  `planning/OPEN_QUESTIONS.md`, `protocol/PROTOCOL.md`, `protocol/APPENDICES.md`,
  `protocol/AUDIT_LOG.md`, `protocol/README.md`, and the project `README.md` as needed to link
  these documents.
- **Responsible person:** Mohamed Faisal Sindhi (authorizing), Claude (drafting agent).
- **Approved inputs:** the full decision history recorded in `DECISION_REGISTER.md` as of
  2026-08-29; no external search, acquisition, or personnel contact.
- **Governing protocol version/hash:** none yet — no protocol version exists; this authorization
  precedes and produces the first drafted (not frozen) protocol version.
- **Start condition:** explicit authorization message, 2026-08-29: "I approve Phase A
  planning-document drafting only. This authorization permits creating and updating planning and
  draft-protocol files inside [this directory]. It does not authorize any research execution,
  external action, or protocol freeze."
- **Stop condition:** drafting of the listed files completes; this authorization does not extend to
  any subsequent drafting session or to any file outside the listed set.
- **Prohibited adjacent activities (explicitly restated from the authorizing message):** web
  search, literature search execution, jurisdiction surveying, document download, contacting or
  recruiting personnel, HRPP/IRB submission, running pilots, implementing models, performing
  experiments, preregistering, publishing, protocol freeze, and modification of the archive, Paper 1
  materials, publication worktree, RAEY application, website, corpus, or development-history
  folders.
- **Status:** ACTIVE — in progress as of this entry.

---

## AUTH-002 — Operational-template drafting (custody agreement, statistician checklist,
methodological-review checklist, stage-authorization template, stop-condition cross-references)

- **Authorized activity:** drafting five operational artifacts inside the same workspace, filling
  gaps identified in a read-only readiness assessment: (1) a blank custody/access agreement and
  split-key-holder acknowledgement template; (2) a consolidated Statistical Reviewer Task Checklist;
  (3) a consolidated Independent Methodological Reviewer Checklist; (4) a blank, reusable
  Stage-Authorization Request template; (5) cross-reference notes linking the protocol's existing,
  already-adopted stop/pause/abort conditions to one another — explicitly **not** a new standalone
  stop-conditions index or register.
- **Scope:** placed only inside files already authorized under AUTH-001 —
  `protocol/APPENDICES.md` and `planning/STAGE_AUTHORIZATION_REGISTER.md` (this file). No new file
  created. No change to any decision recorded in `DECISION_REGISTER.md`; every new artifact cites
  existing decision IDs rather than adopting new rules.
- **Responsible person:** Mohamed Faisal Sindhi (authorizing), Claude (drafting agent).
- **Approved inputs:** the read-only readiness assessment conducted this session (existing/complete/
  partial/missing determination for all five items) and the full decision history in
  `DECISION_REGISTER.md` as of 2026-09-01; no external search, acquisition, or personnel contact.
- **Governing protocol version/hash:** none yet — `PROTOCOL.md`/`APPENDICES.md` remain
  `PROVISIONALLY_ADOPTED` (draft), not frozen.
- **Start condition:** explicit authorization message, 2026-09-01: "Approved 2026-09-01 - proceed
  with edits 1-5 as proposed. Place them in existing authorized planning/protocol files. No
  standalone stop-conditions index; use cross-references only. Placeholders only. Log as AUTH-002."
- **Stop condition:** drafting of the five listed artifacts completes; this authorization does not
  extend to any subsequent drafting session or to any file outside `protocol/APPENDICES.md` and
  `planning/STAGE_AUTHORIZATION_REGISTER.md`.
- **Prohibited adjacent activities (explicitly restated from the authorizing message and its own
  standing constraints):** web search, document selection/inspection/download, literature-search
  execution, contacting or recruiting personnel, HRPP/IRB submission, running pilots, implementing
  models, freezing/preregistering/publishing anything, inventing any pilot-dependent value,
  timestamp, personnel name, or statistical specification (placeholders only), and modification of
  the archive, Paper 1 materials, publication worktree, RAEY application, website, corpus, or
  development-history folders.
- **Status:** ACTIVE — in progress as of this entry.

---

## Blank template — Stage-Authorization Request (AUTH-002, item 4)

For use starting at AUTH-003. Copy this block, fill every field, and append it as a new dated entry
— never edit or overwrite a prior entry (see `PROTOCOL.md` §2 / DEC-012's append-only discipline).
An authorization is not valid, and no governed activity may begin, until every field below is
completed with a direct, dated, verbatim statement from the named investigator (never inferred —
DEC-011, the approval-provenance rule) and this register carries the completed entry.

```
## AUTH-0XX — [short activity name]

- **Authorized activity:** [exact activity, stated concretely]
- **Scope:** [exact files/folders/systems affected — nothing broader]
- **Responsible person:** [named individual(s)]
- **Approved inputs:** [what may inform this activity — and what may not]
- **Governing protocol version/hash:** [cite `PROTOCOL.md` §2's status/version, or "none yet"]
- **Start condition:** [verbatim, dated authorization statement — quoted in full]
- **Stop condition:** [exact condition under which this authorization ends]
- **Prohibited adjacent activities:** [restated explicitly, not left implicit]
- **Status:** [ACTIVE / COMPLETE / SUPERSEDED]
```

---

## AUTH-003 — Design-informing literature-search protocol finalization

- **Authorized activity:** inspecting all existing literature-workstream provisions
  (`DECISION_REGISTER.md` DEC-032, COR-005, FND-013; `PROTOCOL.md` §15; `APPENDICES.md` Appendix K;
  the archived Paper 2 protocol's Appendix K as historical, non-governing reference) and reconciling
  them into one auditable, finalized literature-search protocol covering databases/sources, concepts
  and draft query families, eligibility/exclusion, screening, deduplication, the two-cutoff rule,
  late-publication addendum handling, evidence extraction, novelty-claim handling, method-change
  routing through the amendment procedure, reproducibility fields, and stop/completion criteria —
  plus its operational search-log and extraction-record templates.
- **Scope:** planning-document edits only, inside files already governed by this workspace's
  drafting discipline — `protocol/APPENDICES.md`, `protocol/PROTOCOL.md`,
  `planning/PLACEHOLDER_REGISTER.md`, `planning/CRITICAL_PATH.md`,
  `planning/STAGE_AUTHORIZATION_REGISTER.md` (this file), `protocol/AUDIT_LOG.md`. No new file
  created. No document selection, jurisdiction identification, EMS-document acquisition, web
  browsing, or literature-search execution of any kind.
- **Responsible person:** Mohamed Faisal Sindhi (authorizing), Claude (drafting agent).
- **Approved inputs:** the existing decision history and protocol text as of 2026-09-01; the
  archived Paper 2 Appendix K read as historical reference only (not modified); no external search,
  web browsing, document retrieval, or personnel contact.
- **Governing protocol version/hash:** none yet — `PROTOCOL.md`/`APPENDICES.md` remain
  `PROVISIONALLY_ADOPTED` (draft), not frozen.
- **Start condition:** explicit authorization message, 2026-09-01: "Approved 2026-09-01 as
  AUTH-003: finalize the design-informing literature-search protocol and its operational
  search-log/extraction templates within existing unified-study planning/protocol files. First
  inspect all existing literature-workstream provisions and reconcile them into one auditable
  protocol covering databases/sources, concepts and draft query families, eligibility/exclusion,
  screening, deduplication, two-cutoff rule, late-publication addendum, evidence extraction,
  novelty-claim handling, method-change routing through the amendment procedure, reproducibility
  fields, and stop/completion criteria. Use placeholders where an institutional or later-approved
  value is unknown. Do not execute searches, browse the web, retrieve papers, choose protocol
  jurisdictions, acquire EMS documents, contact anyone, submit HRPP/IRB, run pilots, implement
  models, freeze/preregister/publish, or touch protected files. Make only planning-document edits,
  log AUTH-003 and hashes, run a consistency audit, then stop and report unresolved substantive
  choices and the exact approval needed before literature-search execution."
- **Stop condition:** finalization of Appendix K and its operational templates completes, the
  consistency audit is run, and the report is delivered; this authorization does not extend to any
  subsequent drafting session, to actual search execution, or to any file outside the six listed.
- **Prohibited adjacent activities (explicitly restated from the authorizing message and standing
  constraints):** web search, document/paper retrieval, literature-search execution, choosing or
  inspecting prospective EMS protocol jurisdictions, acquiring EMS documents, contacting or
  recruiting anyone, HRPP/IRB submission, running pilots, implementing models, freezing/
  preregistering/publishing anything, inventing any institutional or later-approved value
  (placeholders only), and modification of the archive, Paper 1 materials, publication worktree,
  RAEY application, website, corpus, or development-history folders.
- **Status:** ACTIVE — in progress as of this entry.

---

## AUTH-004 — Write resolved Appendix K decisions (K.3/K.4/K.6/K.13) into protocol files

- **Authorized activity:** writing the four Appendix K decisions resolved through a conversational,
  one-at-a-time walkthrough (this session, 2026-09-02) into the existing authorized planning/
  protocol files — K.3 (database/source list, legal-index placeholder dropped), K.4 (three-query-
  family execution plan: B1+B2, B1+B2+B3, B2+B3), K.6 (single stage-1 reviewer + independent stage-2
  checker procedure), K.13 (30-day manuscript-update search interval) — logging each as its own
  dated `DECISION_REGISTER.md` entry, updating `APPENDICES.md`/`PLACEHOLDER_REGISTER.md`/
  `PROTOCOL.md` for consistency, plus a stale-line correction in `planning/OPEN_QUESTIONS.md`
  explicitly added to scope by the authorizing message.
- **Scope:** `planning/DECISION_REGISTER.md`, `protocol/APPENDICES.md`,
  `planning/PLACEHOLDER_REGISTER.md`, `protocol/PROTOCOL.md`,
  `planning/STAGE_AUTHORIZATION_REGISTER.md` (this file), `protocol/AUDIT_LOG.md`,
  `planning/OPEN_QUESTIONS.md`. No new file created. No document selection, jurisdiction
  identification, EMS-document acquisition, web browsing, or literature-search execution of any
  kind.
- **Responsible person:** Mohamed Faisal Sindhi (authorizing), Claude (drafting agent).
- **Approved inputs:** the four decision resolutions reached conversationally in this session's
  Appendix K walkthrough (K.3, K.4, K.6, K.13), each confirmed via an explicit investigator choice;
  the existing decision/placeholder history as of 2026-09-02; no external search, web browsing,
  document retrieval, or personnel contact.
- **Governing protocol version/hash:** none yet — `PROTOCOL.md`/`APPENDICES.md` remain
  `PROVISIONALLY_ADOPTED` (draft), not frozen.
- **Start condition:** explicit authorization message, 2026-09-02: "Approved 2026-09-02 as AUTH-004:
  proceed with the planning-file edits exactly as proposed, including the adopted K.3, K.4, K.6, and
  K.13 decisions and the stale OPEN_QUESTIONS.md correction. Do not execute the literature search or
  begin any other stage."
- **Stop condition:** the four decisions are logged in `DECISION_REGISTER.md`, Appendix K.3/K.4/K.6/
  K.13 are rewritten to remove resolved-placeholder language and cite the new decision IDs,
  `PLACEHOLDER_REGISTER.md`/`PROTOCOL.md` are updated for consistency, the `OPEN_QUESTIONS.md` stale
  line is corrected, hashes are logged, and the report is delivered; this authorization does not
  extend to literature-search execution (reserved for a separate AUTH-005 gate) or to any file
  outside the seven listed.
- **Prohibited adjacent activities (explicitly restated from the authorizing message and standing
  constraints):** web search, document/paper retrieval, literature-search execution, choosing or
  inspecting prospective EMS protocol jurisdictions, acquiring EMS documents, contacting or
  recruiting anyone, HRPP/IRB submission, running pilots, implementing models, freezing/
  preregistering/publishing anything, inventing any institutional or later-approved value
  (placeholders only), and modification of the archive, Paper 1 materials, publication worktree,
  RAEY application, website, corpus, or development-history folders.
- **Status:** ACTIVE — in progress as of this entry.

---

## AUTH-005 — Design-informing literature-search execution

- **Authorized activity:** executing Appendix K's finalized design-informing literature search
  using the adopted K.3 sources and K.4 query families; logging exact queries, sources, UTC
  execution times, hit counts, exports, retries, access gaps, deduplication, and the cutoff;
  preserving an unscreened deduplicated master set; running provisional, clearly-labeled AI
  screening that does not substitute for the required human stage-1/stage-2 decisions.
- **Scope:** a new directory, `protocol/literature-search/` (raw exports, `SEARCH_LOG.md`,
  `DEDUPLICATED_MASTER_SET.md`), plus logging updates to `protocol/AUDIT_LOG.md`,
  `planning/STAGE_AUTHORIZATION_REGISTER.md` (this file), `planning/PLACEHOLDER_REGISTER.md`, and
  `planning/CRITICAL_PATH.md`'s literature-search row. No jurisdiction search, no EMS-protocol or
  study-document acquisition, no personnel contact, no HRPP/IRB submission, no model/method
  implementation or alteration, no freeze/preregistration/publication, no protected file touched.
  This file scope was not specified in the authorizing message itself (unlike AUTH-002/003/004); it
  is applied here under the same "exact files affected, nothing broader" discipline as prior
  rounds, disclosed explicitly in `AUDIT_LOG.md` Entry 008.
- **Responsible person:** Mohamed Faisal Sindhi (authorizing), Claude (execution agent).
- **Approved inputs:** Appendix K.3 (databases, LIT-001) and K.4 (query families, LIT-002) exactly
  as adopted; no query, source, or filter beyond what those two subsections specify. EMBASE/CINAHL
  usable only with legitimate institutional access, otherwise logged `NOT_AVAILABLE`.
- **Governing protocol version/hash:** none yet — `PROTOCOL.md`/`APPENDICES.md` remain
  `PROVISIONALLY_ADOPTED` (draft), not frozen.
- **Start condition:** explicit authorization message, 2026-09-02: "Approved 2026-09-02 as AUTH-005.
  Execute Appendix K's finalized design-informing literature search using the adopted K.3 sources
  and K.4 queries. Use EMBASE/CINAHL only with legitimate access; otherwise log unavailable. Log
  exact queries, sources, UTC times, hit counts, exports, retries, access gaps, citation chaining,
  deduplication, and cutoff. Preserve an unscreened deduplicated master set. AI screening must
  remain clearly provisional and cannot replace the required human stage-1 and independent stage-2
  decisions. Do not search for EMS protocols or jurisdictions, acquire study documents, contact
  people, submit HRPP/IRB, implement or alter models/methods, freeze, preregister, publish, or touch
  protected files. Stop after search organization and report coverage, counts, access gaps,
  provisional totals, cutoff, and the human-review gate."
- **Stop condition:** all nine adopted K.3 sources have a logged K.10-shaped record (success,
  failure, or `NOT_AVAILABLE`) for all three K.4 families; the unscreened deduplicated master set is
  preserved; provisional AI screening totals and the design-informing cutoff are computed and
  logged; the report is delivered. **Note:** Semantic Scholar's three families ended `FAILED`
  (rate-limited, no API key) after one retry each — per K.18, this means the design-informing search
  is not yet fully *complete* (a `FAILED` status, unlike a reasoned `NOT_AVAILABLE`, does not
  satisfy K.18's per-source completion condition); this authorization's stop condition is "search
  organized and reported," not "K.18 completion," and does not itself extend to a further retry
  attempt.
- **Prohibited adjacent activities (explicitly restated from the authorizing message):** searching
  for EMS protocols or jurisdictions, acquiring study documents, contacting people, submitting
  HRPP/IRB materials, implementing or altering models/methods, freezing, preregistering, publishing,
  or touching protected files (archive, Paper 1 materials, publication worktree, RAEY application,
  website, corpus, development-history folders); real (non-provisional) screening; citation
  chaining (gated on human-confirmed stage-2 inclusions per Appendix K.8, none exist yet).
- **Status:** COMPLETE (as executed; see stop-condition note on K.18's separate, not-yet-met
  completion bar) — 2026-09-02.

**Subsequent validity determination:** AUTH-005 completed its narrow execution instructions but did
not produce a valid or complete design-informing search. Independent sensitivity checking found
known relevant literature missed by the exact-phrase architecture. The artifacts are therefore
retained as an `INCOMPLETE_PARTIAL_PILOT`; no design-informing cutoff was established. A corrected
K.3/K.4/K.4a plan has been drafted as a pre-freeze planning revision. Its official rerun is not
authorized by AUTH-005 and requires a new explicit authorization after approval of that revision.

---

## AUTH-006 — Independent audit/correction of the AUTH-005 sensitivity revision, plus query
translation table, sentinel bibliography, and sentinel-validation execution

- **Authorized activity:** (1) an independent audit of Entry 009's correction and of Appendix
  K.3/K.4/K.4a, `PROTOCOL.md`, `STAGE_AUTHORIZATION_REGISTER.md`, `CRITICAL_PATH.md`,
  `PLACEHOLDER_REGISTER.md`, `SEARCH_LOG.md`, and `DEDUPLICATED_MASTER_SET.md`, not accepted
  uncritically; (2) correcting any scientific or consistency defect found (planning-document edits
  only); (3) building a complete database-specific query translation table for Appendix K.4's broad
  concept blocks, and a frozen sentinel bibliography (persistent identifiers, expected-index
  coverage) for Appendix K.4a; (4) executing sentinel-validation queries against the real, public
  APIs of K.3's structured databases (arXiv, PubMed/MEDLINE, OpenAlex, Crossref, Semantic Scholar if
  accessible) to test whether each database's translation retrieves its expected sentinels, with
  full request/timestamp/result/hash logging, and prospective query revision plus retest logged if
  an indexed sentinel is missed — never tuning against non-sentinel yield. **Explicitly excluded from
  this authorization:** execution of the official corrected design-informing search itself (Appendix
  K.4's full query families against all of K.3), reserved for a separate AUTH-007 gate created only
  after this authorization's sentinel gate passes, per this authorization's own text (item 5 below).
- **Scope:** `protocol/AUDIT_LOG.md`, `planning/STAGE_AUTHORIZATION_REGISTER.md` (this file),
  `protocol/PROTOCOL.md`, `protocol/APPENDICES.md`, `planning/PLACEHOLDER_REGISTER.md`,
  `planning/CRITICAL_PATH.md`, plus new files inside the existing `protocol/literature-search/`
  directory (a query-translation-table file, a sentinel-bibliography file, a sentinel-validation-log
  file, and new `raw/` sentinel-check export files). No jurisdiction search, no EMS-protocol or
  study-document acquisition, no personnel contact, no HRPP/IRB submission, no model/method
  implementation or alteration, no freeze/preregistration/publication, no protected file touched
  (archive, Paper 1 materials, publication worktree, RAEY application, website, corpus,
  development-history folders). `AUTH-005`'s own entry above is not edited or overwritten — its
  record stands exactly as logged, preserved per this authorization's own instruction.
- **Responsible person:** Mohamed Faisal Sindhi (authorizing, via this session's task instructions,
  2026-09-02), Claude (audit/drafting/execution agent).
- **Approved inputs:** the existing decision/protocol/audit history through Entry 009 and AUTH-005;
  real, documented public-API responses from arXiv, PubMed/MEDLINE, OpenAlex, Crossref, and Semantic
  Scholar (if accessible) for sentinel-retrieval testing only, plus ordinary bibliographic web
  lookups strictly to verify a candidate sentinel's own identity/persistent-identifier/indexing
  status (not to search for EMS jurisdiction protocols or acquire study documents, which remain
  prohibited). No personnel contact.
- **Governing protocol version/hash:** none yet — `PROTOCOL.md`/`APPENDICES.md` remain
  `PROVISIONALLY_ADOPTED` (draft), not frozen.
- **Start condition:** explicit authorization message, 2026-09-02 (quoted in full): "Work on the
  unified EMS recommendation-alignment study's literature stage only. Faisal has authorized Codex to
  approve steps when they are methodologically correct. Collaborate with the existing planning
  package and preserve all prior audit evidence. Required order: 1. Read and independently audit the
  recent Entry 009 correction, Appendix K.3/K.4/K.4a, PROTOCOL.md, STAGE_AUTHORIZATION_REGISTER.md,
  CRITICAL_PATH.md, PLACEHOLDER_REGISTER.md, SEARCH_LOG.md, and DEDUPLICATED_MASTER_SET.md. 2. Fix
  any scientific or consistency defects you find. Do not accept the draft merely because Codex wrote
  it. 3. Build a complete database-specific query translation table and a frozen sentinel
  bibliography with persistent identifiers and index-coverage expectations. Use broad,
  sensitivity-first terminology and stepped families. Do not search for EMS jurisdiction protocols or
  acquire study documents. 4. Run sentinel validation only. Preserve exact requests, timestamps,
  results, exports/screenshots where applicable, and SHA-256 hashes. If an indexed sentinel is
  missed, revise the translation prospectively, log the revision, and retest. Do not tune against
  non-sentinel yield. 5. Once every usable source translation passes its sentinel gate, record a
  dated methodological approval and create a new stage authorization for the official corrected
  literature search. Do not claim coverage for unavailable databases. Use reproducible
  OpenAlex/Crossref supplementation and documented manual workflows where technically possible. 6.
  Execute the official corrected search once, with exact query logs, raw exports, timestamps, counts,
  and hashes. Preserve AUTH-005 separately as an incomplete pilot. Do not overwrite it. 7.
  Deduplicate results reproducibly and prepare the unscreened master set. Do not replace required
  human screening with AI screening. AI may create a clearly labeled prioritization aid only. 8. Run
  a final cross-file consistency and integrity audit. Ensure no false cutoff remains. A final
  design-informing cutoff may be recorded only if Appendix K.18 is genuinely satisfied; otherwise
  identify the exact unmet human or access gate without calling the search complete. 9. Report
  exactly what was completed, source-by-source coverage, counts, remaining mandatory human tasks, all
  modified/created files, and verification results. Boundaries: literature only. No jurisdiction
  survey, EMS protocol search/download, method/model implementation, reviewer contact, HRPP/IRB
  action, preregistration, protocol freeze, or protected Paper 1/archive/application/website/corpus
  edits. Use simple academic language and no exaggerated novelty claims." This single message
  authorizes AUTH-006's narrower item-1–4 scope now and explicitly instructs the drafting agent to
  create AUTH-007 itself once the sentinel gate passes (item 5) — read together with AUTH-004's
  precedent of the investigator directing the agent to log a decision and proceed, not a delegation
  of open-ended authority beyond what this message states.
- **Stop condition:** the independent audit is complete and its findings reported; every identified
  defect is corrected and logged; a complete query translation table and frozen sentinel bibliography
  are compiled; sentinel validation is executed against every source with working, accessible public
  API query mechanics, with any missed-indexed-sentinel revision/retest logged; results are reported.
  Does not extend to executing the official corrected design-informing search (reserved for AUTH-007)
  or to any file outside the listed scope.
- **Prohibited adjacent activities (explicitly restated from the authorizing message and standing
  constraints):** jurisdiction survey, EMS-protocol search/download or study-document acquisition,
  method/model implementation, reviewer/personnel contact, HRPP/IRB action, preregistration, protocol
  freeze, edits to Paper 1/archive/application/website/corpus/protected files; tuning the translation
  against non-sentinel yield; executing the full official search under this gate; claiming coverage
  for a database that was not actually, successfully queried.
- **Status:** COMPLETE — 2026-09-02 (see `AUDIT_LOG.md` Entries 010–011 and
  `../protocol/literature-search/SENTINEL_VALIDATION_LOG.md` for the full record).

---

## Methodological approval — sentinel gate, 2026-09-02

Recorded per this session's own task instructions ("once every usable source translation passes its
sentinel gate, record a dated methodological approval"). Basis: `../protocol/literature-search/
SENTINEL_VALIDATION_LOG.md`'s three-round, evidence-driven validation (eight real, independently-
identifier-verified sentinels; every miss root-caused against the sentinel's own actual text before
any fix; every fix independently retested and confirmed).

**Determination:** the corrected Appendix K.4 translation (K.3/K.4/K.4a as revised in Entries 009–
010, with the block and family revisions logged in `QUERY_TRANSLATION_TABLE.md`) is methodologically
adequate to proceed to the official design-informing search for the following sources, each of which
retrieves every sentinel its own real text supports: **arXiv, PubMed/MEDLINE, OpenAlex**. Crossref is
approved for inclusion as a reproducible supplemental source (K.3) with a documented sensitivity
caveat (large OR-blocks underperform short queries on its relevance search — not a defect in the
block content itself). Semantic Scholar, Google Scholar, and ACL Anthology are **not** covered by
this approval — their translations are drafted but not sentinel-validated; each will be attempted at
official-search execution time and logged honestly as `NOT_AVAILABLE`, `FAILED`, or a genuine but
sentinel-unverified result, never claimed as validated by this approval. EMBASE, CINAHL, ACM Digital
Library, and IEEE Xplore remain `NOT_AVAILABLE` (no institutional access), unchanged from AUTH-005.
**No coverage is claimed for any database beyond what was actually, successfully queried this
session or the next.**

---

## AUTH-007 — Official corrected design-informing literature search execution

- **Authorized activity:** executing Appendix K.4's corrected, sentinel-validated query design (six
  families: the original four stepped combinations, the K.4 targeted named-task phrases, and the
  new Family 6 method-only family) against every K.3 source with genuine, working access this
  session (arXiv, PubMed/MEDLINE, OpenAlex, Crossref, and Semantic Scholar — attempted, logged
  honestly regardless of outcome), and attempting Google Scholar/ACL Anthology via a documented
  manual/browser workflow where technically possible; logging exact queries, timestamps, hit counts,
  bounded raw exports, and hashes (K.10); preserving AUTH-005 unchanged as an incomplete pilot;
  deduplicating the pooled results reproducibly; preparing the unscreened master set; not performing
  or substituting for K.6 human screening (a clearly labeled, non-authoritative AI prioritization aid
  is permitted).
- **Scope:** `protocol/literature-search/` (new/updated `SEARCH_LOG.md` rows for the official pass,
  a new results/export subdirectory, an updated `DEDUPLICATED_MASTER_SET.md`), plus logging updates
  to `protocol/AUDIT_LOG.md`, `planning/STAGE_AUTHORIZATION_REGISTER.md` (this file),
  `planning/PLACEHOLDER_REGISTER.md`, and `planning/CRITICAL_PATH.md`'s literature-search row. No
  jurisdiction search, no EMS-protocol or study-document acquisition, no personnel contact, no
  HRPP/IRB submission, no model/method implementation or alteration, no freeze/preregistration/
  publication, no protected file touched. `SEARCH_LOG.md`'s existing AUTH-005 rows are preserved
  exactly as logged, never overwritten — the official pass adds new, separately labeled rows.
- **Responsible person:** Mohamed Faisal Sindhi (authorizing, via this session's task instructions,
  2026-09-02), Claude (execution agent).
- **Approved inputs:** the corrected K.3/K.4/K.4a translation as sentinel-validated in
  `SENTINEL_VALIDATION_LOG.md`; the methodological approval immediately above; no query, source, or
  filter beyond what `QUERY_TRANSLATION_TABLE.md` specifies.
- **Governing protocol version/hash:** none yet — `PROTOCOL.md`/`APPENDICES.md` remain
  `PROVISIONALLY_ADOPTED` (draft), not frozen.
- **Start condition:** this session's task instructions, 2026-09-02 (quoted in full under AUTH-006
  above — the same message's item 6 states: "Execute the official corrected search once, with exact
  query logs, raw exports, timestamps, counts, and hashes. Preserve AUTH-005 separately as an
  incomplete pilot. Do not overwrite it," and item 5 directs the executing agent to create this very
  authorization once the sentinel gate passes), read together with the methodological-approval
  determination immediately above, which is the specific trigger condition item 5 names.
- **Stop condition:** every listed source has a logged K.10-shaped record (success with a bounded
  export, failure, or a reasoned `NOT_AVAILABLE`) for all six families; deduplication is complete and
  documented; the unscreened master set is preserved; the report is delivered. Does not extend to
  K.6 screening, citation chaining (gated on human-confirmed stage-2 inclusions, K.8), jurisdiction
  survey, or EMS-document acquisition.
- **Prohibited adjacent activities (restated):** searching for EMS protocols or jurisdictions,
  acquiring study documents, contacting people, submitting HRPP/IRB materials, implementing or
  altering models/methods, freezing, preregistering, publishing, touching protected files; real
  (non-provisional) screening; citation chaining; overwriting or reinterpreting AUTH-005's own
  record; claiming coverage for a database not actually, successfully queried this pass.
- **Status:** COMPLETE — 2026-09-02 (execution, deduplication, and master-set preparation done; see
  `AUDIT_LOG.md` Entries 011–013, `SEARCH_LOG.md`'s "Official Search Execution" section, and
  `DEDUPLICATED_MASTER_SET.md`'s "Official Deduplicated Master Set" section. **Note:** this stop
  condition — "search organized and reported" — is met; Appendix K.18's own, separate completion bar
  is not, since K.6 human screening and K.8 citation chaining have not occurred, matching the same
  distinction AUTH-005 drew for itself).

**Subsequent validity determination (2026-09-02, `AUDIT_LOG.md` Entry 014):** an independent review
found AUTH-007's execution does not meet the bar for a completed or representative design-informing
search: its exports are 200-of-up-to-3.4-million capped samples, not a comprehensive corpus or a
prespecified probability sample; Family 6 searched the undifferentiated general method literature
rather than a targeted set serving the review question; Crossref was queried with a query style its
own sentinel test had already shown fails, and Semantic Scholar/Google Scholar/ACL Anthology were
queried without ever being sentinel-validated. AUTH-007 is therefore redesignated
`INCOMPLETE_SEARCH_FEASIBILITY_EXECUTION` — its real evidence (query syntax, true total counts,
per-source sentinel behavior) is retained and reused as feasibility input to a redesigned two-lane
search (AUTH-008 below), but it is not the master set K.6 screening will act on, and it supports no
coverage or completeness claim. Its own artifacts (`SEARCH_LOG.md`'s table, the 3,464-record
deduplicated set) are preserved exactly as logged, not deleted or overwritten.

---

## AUTH-008 — Two-lane literature-search redesign (design and feasibility testing only, no execution)

- **Authorized activity:** per Entry 014's correction, redesigning Appendix K's search architecture
  into two lanes — Lane 1 (a narrow, task-focused, fully-exportable systematic/scoping search for
  version-to-version alignment, recommendation matching/change, and guideline/protocol evolution) and
  Lane 2 (a structured method-landscape review via prespecified authoritative review/seminal-paper
  seeds plus one round of citation chaining, explicitly not claimed as an exhaustive systematic
  search of all IR literature); a yield-feasibility gate based only on total counts and export
  completeness (never on inspecting favorable results); a workload table for candidate
  screening-burden thresholds (no invented final number, since reviewer capacity is not yet known); a
  truthful, limited-role Google Scholar/ACL Anthology supplementary workflow; a core-vs-supplemental
  determination for every K.3 source; and consistency updates across the planning/protocol files.
  Testing this authorizes: query syntax validation, total-count checks, complete-export feasibility
  checks, and sentinel-retrieval checks only. **Explicitly excluded:** executing another official,
  capped-sample "final" search of the kind AUTH-007 ran; any K.6 screening; any citation-chaining
  execution (K.8, itself gated on human-confirmed stage-2 inclusions that do not exist).
- **Scope:** `protocol/AUDIT_LOG.md`, `planning/STAGE_AUTHORIZATION_REGISTER.md` (this file),
  `protocol/PROTOCOL.md`, `protocol/APPENDICES.md`, `planning/CRITICAL_PATH.md`,
  `planning/PLACEHOLDER_REGISTER.md`, `planning/OPEN_QUESTIONS.md`, plus new/updated files inside
  `protocol/literature-search/` (a Lane 1/Lane 2 design document, updated or new query-translation
  and sentinel-validation records, a workload-feasibility table). AUTH-007's own artifacts are not
  edited or overwritten. No jurisdiction search, no EMS-protocol or study-document acquisition, no
  personnel contact, no HRPP/IRB submission, no model/method implementation, no
  freeze/preregistration/publication, no protected file touched.
- **Responsible person:** Mohamed Faisal Sindhi (authorizing, via this session's correction
  instructions, 2026-09-02), Claude (audit/design/testing agent).
- **Approved inputs:** the existing decision/protocol/audit history through Entry 014, including
  AUTH-007's own real evidence (query syntax, total counts, sentinel behavior) reused as feasibility
  input; real, documented public-API responses for syntax/count/export/sentinel testing only — never
  another full "official" capped-sample execution.
- **Governing protocol version/hash:** none yet — `PROTOCOL.md`/`APPENDICES.md` remain
  `PROVISIONALLY_ADOPTED` (draft), not frozen.
- **Start condition:** this session's correction instructions, 2026-09-02 (quoted in full): "Critical
  correction after independent review. Continue in the same literature task. Do not begin K.6
  screening and do not treat the 3,464-record AUTH-007 set as the official screening corpus. Preserve
  every AUTH-006/AUTH-007 artifact and log, but record AUTH-007 as an incomplete search-feasibility
  execution, not a completed or representative design-informing search. [Reasons 1–5 and required
  work items A–H as stated verbatim in this session's transcript.] Boundaries remain literature only.
  No EMS jurisdiction/protocol search or acquisition, model implementation, recruitment/contact, IRB
  action, freeze, preregistration, publication, or protected-file edits." Item H of that message
  explicitly instructs: "Stop after producing the corrected two-lane design, exact candidate queries,
  sentinel/count/export-feasibility evidence, and a clear recommendation. Do not execute another
  official search or screen records yet. Codex will independently audit and, if correct, authorize
  the next execution."
- **Stop condition:** the two-lane design, exact candidate queries (Lane 1) and seed-selection
  criteria (Lane 2), the yield-feasibility gate and workload table, the Google Scholar/ACL Anthology
  workflow, the core-vs-supplemental determination, and consistent file updates are delivered and
  reported; this authorization does **not** extend to executing an official Lane 1/Lane 2 search or
  to any K.6/K.8 activity — those require a further, separate authorization after independent review.
- **Prohibited adjacent activities (restated):** executing another "official" capped-sample search
  presented as complete; K.6 screening; K.8 citation-chaining execution; jurisdiction survey;
  EMS-document acquisition; personnel contact; HRPP/IRB submission; model/method implementation;
  freezing/preregistering/publishing; touching protected files; inventing a screening-burden
  threshold not derived from known reviewer capacity; disguising an inaccessible subscription
  database's absence as covered by OpenAlex/Crossref.
- **Status:** COMPLETE — 2026-09-02 (two-lane design, tested candidate queries, seed-selection
  criteria and citation-chaining feasibility findings, yield-feasibility workload table, Google
  Scholar/ACL Anthology workflow, and core-vs-supplemental determination all delivered; see
  `AUDIT_LOG.md` Entry 015 and `protocol/literature-search/TWO_LANE_SEARCH_DESIGN.md`. Per this
  authorization's own stop condition, no official Lane 1/Lane 2 execution occurred and none is
  authorized by this entry — an independent audit and a further, separate authorization are required
  first).

**Second-pass refinement determination (2026-09-02, `AUDIT_LOG.md` Entry 016):** a second independent
audit found the first-pass design conditionally sound but required nine further corrections before
execution could be authorized (on-task version-alignment sentinels; a rebuilt, methodologically
tighter Lane 2 seed map; a PRESS-modeled search-quality checklist; locking Lane 1 to its narrow-unit
variant; a legislative-family sentinel-coverage test; exact final query strings with
complete-pagination reconciliation; and a formal execution manifest/acceptance-check specification).
All nine were addressed with real, re-run API evidence under this same AUTH-008 scope (design and
feasibility testing only — no new execution authority created). Overall second-pass finding:
**CONDITIONAL PASS** — one open item remains (arXiv's narrow-unit Lane 1 count, blocked by a live rate
limit this session, to be confirmed before execution given arXiv's already-minor, non-core Lane 1
role). **Execution of an official Lane 1/Lane 2 search is still not authorized by AUTH-008** — this
second-pass refinement is itself subject to further independent audit before any execution
authorization is granted.

**Third-pass correction determination (2026-09-02, `AUDIT_LOG.md` Entry 017):** a third independent
audit rejected the second pass's `CONDITIONAL PASS` outright — no conditional-pass language is
permitted — and required six further, more exacting corrections, all performed under this same
AUTH-008 scope (design/feasibility testing only; no new execution authority created): (1) every Lane 1
sentinel claimed "directly on-task" re-verified from its own full text, not title terms — S5
disqualified (its actual task is evidence surveillance, not version-to-version counterpart recovery);
S7/S8 confirmed genuinely on-task for the legislative sub-family; a dedicated further search for a
qualifying clinical-domain sentinel found none — an open, disclosed gap; (2) conformal prediction
removed from Lane 2 — its FND-002-based justification did not survive direct verification against
`DECISION_REGISTER.md`'s actual text, which names no calibration mechanism; (3) internal
inconsistencies corrected (chainable-seed count 5, not 4 or 6; real backward+forward citation totals
per seed, 54–269 range; arXiv given one unambiguous classification — non-core for Lane 1, core for
Lane 2 only; the ~3,476-record Lane 1 total relabeled an estimated workload, not "defensible," with a
required reviewer-capacity gate named as a blocker); (4) PubMed MeSH terms tested and adopted (680 →
1,179 clinical records, no sentinel lost, exact pagination reconciliation); (5) formal PRESS peer
review recorded as a required, separate human gate, explicitly not equivalent to the self-audit
performed here; (6) a strict PASS/FAIL result with a concrete blocker list, no conditional language.
**Overall third-pass finding: FAIL.** Four concrete blockers: no genuinely on-task, indexed sentinel
exists for Lane 1's clinical sub-family; no prespecified reviewer-capacity gate is set; no formal
PRESS peer review has been performed; no stage-1/stage-2 reviewer is appointed. AUTH-005 and AUTH-007
remain preserved unchanged as historical failed/feasibility work; the literature cutoff remains
UNSET. **Execution of an official Lane 1/Lane 2 search remains unauthorized by AUTH-008.** This is a
correction pass only — clearing all four blockers and a further independent audit are required before
any execution authorization is granted.

**Fourth-pass corrective planning determination (2026-09-02, `AUDIT_LOG.md` Entry 018):** following
the third-pass FAIL, the investigator confirmed staffing (Mohamed Faisal Sindhi as primary stage-1
screener; an independent search-strategy reviewer to be appointed later, identity not yet known; a
stage-2 checker to be appointed, Dr. Nasir Uddin one possible candidate, not assumed) and directed five
corrective planning items, all performed under this same AUTH-008 scope (design/feasibility testing
only; no new execution authority created): (1) **the circular clinical-sentinel gate repaired** — the
single exact-intersection requirement is replaced by a component-validation framework (clinical
guideline/protocol maintenance terminology; genuine document/sentence/version-alignment methods;
legislative/regulatory cross-version precedents; and retrieval of any known exact clinical precedent if
one is identified), with components (a)/(b)/(c) confirmed satisfied by verified sentinels and component
(d)'s absence of an exact clinical precedent explicitly recorded as neither a pass nor proof of
novelty — only an empirical research-gap conclusion once the completed official search, screening, and
citation chaining actually run and find none; a per-component abort rule replaces the prior all-or-
nothing gate; (2) **a frozen reviewer-capacity gate** — a complete formula (stage-1/stage-2 hour
estimates, a 20%-default contingency margin, a PASS/FAIL condition) with two required inputs
(documented available hours; a pilot-timed screening rate from a small, explicitly non-official
development sample) left as blank sign-off fields, not invented, and a prespecified relevance-neutral
query-refinement procedure if the gate fails; (3) a concise, unsigned independent search-strategy
review package drafted (`protocol/literature-search/INDEPENDENT_REVIEW_PACKAGE.md`) — exact query
strings, database roles, component sentinels, pagination checks, a PRESS-informed self-check
explicitly marked as not equivalent to formal review, and a reviewer response form (approve/revise/
reject, comments, qualifications, name, date, signature) requiring reviewer independence from query
construction; (4) staffing clarified across `PLACEHOLDER_REGISTER.md`, `CRITICAL_PATH.md`, and
Appendix K.6 — Sindhi as stage-1, independent search-strategy reviewer and stage-2 checker both
`TO_BE_APPOINTED`, no unnecessary permanent roles added; (5) the PASS/FAIL gate reassessed. **Overall
fourth-pass finding: FAIL.** Internal design items (the component framework, the capacity formula) are
verified and pass on their own terms, but overall execution readiness remains FAIL until three
remaining blockers clear: the reviewer-capacity sign-off fields are populated and the gate passes; an
independent search-strategy reviewer is appointed and returns a signed response; and a stage-2
screening checker is appointed. AUTH-005 and AUTH-007 remain preserved unchanged; the literature cutoff
remains UNSET. **Execution of an official Lane 1/Lane 2 search remains unauthorized by AUTH-008.** This
is a corrective planning pass only — clearing all three blockers is required before any execution
authorization is granted.

---

## AUTH-009 — AI-assisted literature-screening workflow redesign (design and planning only, no
execution)

- **Authorized activity:** per the investigator's determination that personally screening the full
  Lane 1 + Lane 2 pre-dedup workload (~4,173 records, `TWO_LANE_SEARCH_DESIGN.md`) as sole title/
  abstract screener is not feasible, redesigning Appendix K.6's screening procedure into an AI-assisted
  structured evidence review: (1) replacing Mohamed Faisal Sindhi's role as mandatory reader of every
  record with a frozen, calibrated AI classification stage, preserving him as investigator and primary
  human verifier; (2) specifying a pre-execution freeze checklist for the AI system (model/version,
  prompt, output schema, temperature/settings, eligibility rubric mapping, deterministic batching/retry
  rules, evidence fields and reason codes, code/configuration hashes, and a firm prohibition on post-hoc
  changes after seeing official-corpus or confirmatory implications); (3) designing a development-only
  calibration plan (independently investigator-labeled, blind to AI output, with a non-contamination
  rule against the official corpus, a Clopper-Pearson-based sample-size formula and planning table, and
  a provisional recall/sensitivity gate); (4) designing the official workflow (mandatory human
  verification of every AI INCLUDE/UNCERTAIN record; a reproducibly sampled, blinded, stratified audit
  of AI EXCLUDE records with prespecified strata, seed, inclusion probabilities, and Horvitz-Thompson
  weighting/reporting; a frozen three-level escalation ladder triggered by any audited false exclusion,
  never resolved by silent isolated correction; an adjudication path for AI-vs-human disagreement and
  ambiguous clinical/methodological cases); (5) recalculating human workload for the investigator's
  actual tasks, not all records, via formulas and clearly labeled scenario tables, with no exact time
  claimed before calibration/deduplication data exist; (6) specifying transparency/reporting
  requirements (the term "AI-assisted structured literature review," explicit non-equivalence to a
  fully human dual-screened systematic review, mandatory disclosure items, and no PRISMA-compliance
  claim unless genuinely met); (7) reaffirming the independent search-strategy reviewer as an unchanged,
  separate gate, and redesignating the former stage-2 checker as a **screening adjudicator** with an
  exact new deadline (before human verification begins, not before official search execution) and a
  restated minimal qualification; (8) reassessing the archived flat 10% exclusion-audit figure against
  three candidate designs and recommending one, not merely the cheapest; (9) updating all relevant
  planning/protocol files and creating the needed screening-protocol/reviewer instrument; (10) logging
  a strict, non-conditional PASS/FAIL status across three named readiness dimensions. **Explicitly
  excluded from this authorization:** selecting or configuring an actual AI model; running any
  calibration; drawing or labeling any calibration sample; classifying any record, official or
  calibration; performing any human verification or exclusion audit; appointing or contacting the
  screening adjudicator or any other personnel; executing the official Lane 1/Lane 2 search itself
  (AUTH-008's blockers are unaffected); freezing/preregistering/publishing anything; acquiring any EMS
  protocol; and touching any protected path.
- **Scope:** `protocol/AUDIT_LOG.md`, `planning/STAGE_AUTHORIZATION_REGISTER.md` (this file),
  `planning/DECISION_REGISTER.md` (LIT-005–LIT-009), `protocol/PROTOCOL.md` §15–§16,
  `protocol/APPENDICES.md` Appendix K.6, `planning/PLACEHOLDER_REGISTER.md`,
  `planning/CRITICAL_PATH.md`, `planning/OPEN_QUESTIONS.md`, plus two new files inside
  `protocol/literature-search/`: `AI_ASSISTED_SCREENING_DESIGN.md` and
  `SCREENING_VERIFICATION_INSTRUMENT.md`. AUTH-005/AUTH-007's own artifacts, and AUTH-008's own text,
  are not edited or overwritten. No jurisdiction search, no EMS-protocol or study-document acquisition,
  no personnel contact, no HRPP/IRB submission, no model/method implementation, no
  freeze/preregistration/publication, no protected file touched, no execution of official screening or
  the official Lane 1/Lane 2 search.
- **Responsible person:** Mohamed Faisal Sindhi (authorizing, via this session's task instructions,
  2026-09-03), Claude (design agent).
- **Approved inputs:** the existing decision/protocol/audit history through Entry 018 and AUTH-008,
  including `TWO_LANE_SEARCH_DESIGN.md`'s reviewer-capacity gate formula (reused and extended) and the
  DEC-019 deterministic-sampling precedent (reused for the exclusion-audit seed); the preserved AUTH-007
  historical record set (`INCOMPLETE_SEARCH_FEASIBILITY_EXECUTION`, 3,464 records) as a candidate
  calibration source, subject to the mandatory overlap-and-strip check; no external search, web
  browsing, document retrieval, model execution, or personnel contact.
- **Governing protocol version/hash:** none yet — `PROTOCOL.md`/`APPENDICES.md` remain
  `PROVISIONALLY_ADOPTED` (draft), not frozen.
- **Start condition:** explicit authorization message, 2026-09-03 (quoted in full): "Continue the
  unified EMS recommendation-alignment study in planning-only mode. The latest files are in
  research/unified-ems-recommendation-alignment. No Claude study session is active, and the last
  completed state is AUDIT_LOG Entry 018 / fourth-pass literature gate repair. The investigator has
  decided that personally screening roughly 4,000 records is infeasible. Redesign the literature-
  screening workflow as an AI-assisted structured evidence review suitable for a methodological
  research paper, not as a fully human-screened systematic review. This is a substantive prospective
  planning amendment, not execution authorization. Requirements: 1. Replace Mohamed Faisal Sindhi as
  the mandatory primary screener of every record with a frozen AI-first screening workflow. Preserve
  him as investigator and human verifier. 2. Before official screening, freeze: the screening model and
  exact version; prompt/instructions and output schema; temperature/settings where applicable;
  eligibility rubric; deterministic batching/retry rules; evidence fields and reason codes; code/
  configuration hashes; prohibition on changing the system after seeing confirmatory/model-performance
  implications. 3. Calibration must use a development-only set independently labeled by the investigator,
  not official search records if that would contaminate the official corpus. Define a realistic
  calibration sample and gates emphasizing sensitivity/recall for relevant studies. Do not invent
  performance results. Keep all numeric thresholds provisional unless already justified; identify which
  must be frozen before execution. 4. Official workflow: AI classifies every deduplicated title/abstract
  as INCLUDE, EXCLUDE, or UNCERTAIN with reason codes. Human investigator reviews every INCLUDE and
  UNCERTAIN. Human investigator reviews a reproducibly sampled, blinded, stratified random audit of AI
  EXCLUDE records. Prespecify audit strata, seed, inclusion probabilities, and weighting/reporting. Any
  audited false exclusion triggers a frozen escalation ladder, such as expanding the exclusion audit
  and, if error thresholds are crossed, human review of the affected stratum or all exclusions. Do not
  silently correct isolated errors without invoking the escalation rule. Preserve an
  adjudication/escalation path for ambiguous clinical or methodological cases. 5. Workload must be
  recalculated for the investigator's actual human tasks, not all records. Provide formulas and scenario
  tables, clearly labeled planning estimates. Do not claim an exact time until calibration and
  deduplication data exist. 6. Transparency: Label the process 'AI-assisted structured literature
  review' or another accurate term. Explicitly state it is not a conventional fully human dual-screened
  systematic review. Require reporting of model/version, prompts, calibration results, human
  verification counts, exclusion-audit sampling, false-exclusion findings, escalations, and final flow
  counts. Do not use PRISMA-compliance language unless every applicable requirement is genuinely met; a
  PRISMA-style flow diagram may be used with accurate labeling. 7. Independent search-strategy review
  remains a separate human gate. The reviewer is TO_BE_APPOINTED. The stage-2 screening checker should
  no longer be a mandatory pre-search-execution appointment if the revised workflow can responsibly
  delay that role until adjudication/verification; define the exact deadline and minimal qualification
  instead of creating unnecessary permanent roles. 8. Reassess whether the existing 10% exclusion audit
  is necessary or whether a smaller statistically justified initial stratified audit with escalation
  gives similar protection at lower burden. Provide 2-3 designs with workload/risk tradeoffs and
  recommend one. Do not select a design merely to minimize work. 9. Update all relevant
  planning/protocol files and create any needed screening protocol/reviewer instrument. Append the audit
  trail with real before/after hashes. Keep AUTH-005/AUTH-007 historical artifacts unchanged, cutoff
  UNSET, and do not execute the official search, screen records, acquire EMS protocols, implement
  models, freeze/preregister, or contact personnel. 10. End with a strict status: internal AI-assisted
  screening design PASS/FAIL; independent search-review readiness PASS/FAIL; official search-execution
  readiness PASS/FAIL; exact remaining blockers. No conditional-pass wording. Stop for Codex independent
  audit. Continue from where you left off." A follow-up message confirmed this remained the exact
  pending task after a transient session interruption, directing verification that no task files
  changed during the failed attempt before completing the same planning-only revision and stopping for
  Codex audit — verified: every file this entry's baseline hashes cover matched Entry 018's logged
  "after" hashes exactly before any edit in this pass began.
- **Stop condition:** the AI-assisted screening design, freeze checklist, calibration plan, official
  workflow with escalation ladder, workload formulas, transparency requirements, personnel/deadline
  redesign, and exclusion-audit design comparison are delivered; all listed planning/protocol files are
  updated; `AUDIT_LOG.md` carries a new entry with real before/after hashes; a strict, non-conditional
  three-part PASS/FAIL status with exact blockers is reported. This authorization does **not** extend to
  executing official screening, running or calibrating any AI model, appointing or contacting personnel,
  or executing the official Lane 1/Lane 2 search.
- **Prohibited adjacent activities (restated):** EMS jurisdiction/protocol search or acquisition, model
  implementation or execution, calibration execution, official-record classification, human
  verification or audit execution, recruitment/contact, IRB action, freeze, preregistration,
  publication, protected-file edits, and execution of the official Lane 1/Lane 2 search.
- **Status:** COMPLETE — 2026-09-03 (design delivered; see `AUDIT_LOG.md` Entry 019,
  `protocol/literature-search/AI_ASSISTED_SCREENING_DESIGN.md`, and
  `protocol/literature-search/SCREENING_VERIFICATION_INSTRUMENT.md`. Per this authorization's own stop
  condition, no AI model was selected/run/calibrated, no record was classified or screened, no personnel
  were appointed or contacted, and no official Lane 1/Lane 2 execution occurred or is authorized by this
  entry).

---

*Every activity listed in `CRITICAL_PATH.md` beyond Phase A drafting and AUTH-002 through AUTH-009's
narrow scopes remains unauthorized — in particular, execution of a Lane 1/Lane 2 official search,
real (non-provisional) screening (AI or human), citation chaining, jurisdiction survey, and EMS-document
acquisition are not authorized by AUTH-008 or AUTH-009 and require their own separate gates. Future
entries append below, never overwrite AUTH-001 through AUTH-009.*
