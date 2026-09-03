# Two-Lane Literature Search Design (AUTH-008) — 2026-09-02, corrected through fourth pass

Redesign of Appendix K.3/K.4/K.4a following independent review (`AUDIT_LOG.md` Entry 014), which
found AUTH-007's single, undifferentiated, capped-sample search inadequate as a design-informing
search. This document is the design and feasibility-testing record. **No official search has been
executed under this design.** All counts below come from real, direct API queries — total-count and
sentinel-membership checks only, never a capped "export" presented as a search result.

**Second-pass refinement (2026-09-02):** a second independent audit of the first-pass design
(Entry 015) required nine further corrections; all were addressed with real, re-run evidence
(Entry 016), but that pass's own "CONDITIONAL PASS" conclusion was itself rejected on a third
independent audit — see immediately below.

**Third-pass correction (2026-09-02):** a third independent audit rejected the second pass's
conditional-pass language outright and required six further, more exacting corrections: a
genuinely-on-task sentinel verified from each paper's actual text (not title terms); a stricter
methodological reassessment of conformal prediction's inclusion in Lane 2; correction of internal
inconsistencies (chainable-seed count, workload-total defensibility claims, arXiv's dual
classification); PubMed MeSH-term feasibility testing; explicit non-equivalence of self-audit and
formal PRESS peer review; and a strict PASS/FAIL result with no conditional language. **This pass's
result was FAIL**, with four concrete blockers — one of which (the clinical-sentinel gate) was itself
found circular on a further audit; see immediately below.

**Fourth-pass corrective planning (2026-09-02):** following the third-pass FAIL, the investigator
directed five corrective planning items, addressed with real evidence: (1) the circular clinical-
sentinel gate repaired via a component-validation framework (four components: clinical-maintenance
terminology, alignment methods, legislative precedents, and any known exact clinical precedent —
components a/b/c satisfied by verified sentinels, component d left as an open empirical question, not
a pass or proof of novelty); (2) a frozen reviewer-capacity-gate formula, with documented-hours and
pilot-timed-rate inputs correctly left as blank sign-off fields rather than invented; (3) a concise,
unsigned independent search-strategy review package drafted; (4) staffing clarified (Mohamed Faisal
Sindhi confirmed as primary stage-1 screener; independent search-strategy reviewer and stage-2 checker
both remain `TO_BE_APPOINTED`); (5) the PASS/FAIL gate reassessed. **This pass's result remains FAIL**,
now with three remaining blockers, all staffing/sign-off items rather than design defects — see the
PASS/FAIL recommendation at the end. Official execution remains unauthorized.

## Why two lanes

Appendix K.1's topic scope contains two structurally different kinds of literature:

- A **narrow, task-specific** question this study is actually about: how do recommendations/
  guidelines/protocols/bills change across versions, and how have others matched, aligned, or
  tracked that change? This can be searched directly, completely, and reproducibly — a real
  systematic/scoping search.
- A **broad background landscape**: the general state of retrieval, reranking, entity resolution,
  assignment/matching, and set-valued prediction methodology, which K.1 also lists as in-scope
  because M1–M4 draw on it. Searching this landscape as an undifferentiated pool (AUTH-007's Family
  6: up to 2.58 million records) is neither reproducible as a "search" in the systematic-review
  sense nor a proportionate way to establish awareness of prior method-family work. A structured
  review anchored on authoritative surveys and landmark papers serves the same purpose at a
  defensible scale.

Conflating the two into one undifferentiated four-to-six-family search (the AUTH-005/AUTH-007
lineage) produced either near-zero recall (AUTH-005) or millions of undifferentiated hits
(AUTH-007). Separating them lets each lane use a design suited to what it is actually trying to find.

---

## Lane 1 — Task-focused systematic/scoping search

**Scope:** version-to-version alignment, recommendation matching/change, and guideline/protocol
evolution — in both the clinical-guideline domain and the legislative/regulatory-text domain (K.1
names both).

**Design principle, evidenced by testing below:** narrow, established, *multi-word* phrases for the
change/version concept (not bare generic words like "update" or "match," which collide with huge
swaths of unrelated literature), ANDed with a domain-specific textual-unit concept restricted to
title/abstract. No generic IR-method vocabulary in Lane 1 — that is Lane 2's job.

### Concept blocks

| Block | Terms |
|---|---|
| **L1-Change** | `"guideline update*"`, `"guideline change*"`, `"guideline revision*"`, `"recommendation change*"`, `"recommendation update*"`, `"living guideline*"`, `"version alignment"`, `"recommendation matching"`, `"guideline recommendation change*"` |
| **L1-ClinicalUnit** (broad) | `guideline*`, `recommendation*`, `protocol*` |
| **L1-ClinicalUnit** (narrow) | `"clinical guideline*"`, `"practice guideline*"`, `"medical guideline*"` |
| **L1-LegChange** | `"text reuse"`, `"bill similarity"`, `"legislative influence"`, `"version alignment"`, `"sentence alignment"`, `"policy diffusion"`, `"model legislation"` |
| **L1-LegUnit** | `"legislative bill*"`, `"state bill*"`, `"legislative text"`, `"regulatory text"`, `statute*`, `legislation` |

Families: **Clinical** = L1-Change AND L1-ClinicalUnit (broad or narrow variant); **Legislative** =
L1-LegChange AND L1-LegUnit. `*` = truncation on PubMed; explicit word-form variants on arXiv/
OpenAlex (no truncation support there, per `QUERY_TRANSLATION_TABLE.md`'s established finding).

### Tested total counts and sentinel retrieval (real API calls, 2026-09-02)

| Database | Family | Total count | Sentinels retrieved |
|---|---|---|---|
| PubMed | Clinical (broad unit) | **2,398** | S5 ✓, S6 ✓ |
| PubMed | Clinical (narrow unit) | **680** | S5 ✓, S6 ✓ |
| PubMed | Legislative | **50** | — (not independently retested; low count is itself the finding — legislative topics are expectedly rare in a biomedical database) |
| OpenAlex | Clinical (broad unit) | **5,850** | S5 ✓, S6 ✓ |
| OpenAlex | Clinical (narrow unit) | **1,335** | S5 ✓, S6 ✓ |
| OpenAlex | Legislative | **912** | S7 ✓, S8 ✓ |
| arXiv | Clinical | **1** | not retested (count itself shows arXiv is a minor source for this domain) |
| arXiv | Legislative | **1** (HTTP 500 status returned alongside a parseable body — arXiv's backend is unreliable for combined queries, a known, already-documented limitation) | not retested |
| Crossref | Clinical | **2,200,120** | not retested — see below |
| Crossref | Legislative | **375,795** | not retested — see below |

**Crossref finding (third confirmation of the same limitation):** even Lane 1's much narrower,
phrase-based queries return hundreds of thousands to millions of results on Crossref. This rules out
Crossref as a Lane 1 search engine entirely, regardless of query narrowing — `query.bibliographic`
is a relevance-ranked full-text match with no way to enforce the phrase/field precision Lane 1
needs. Crossref is not used for Lane 1 search; see the core-vs-supplemental determination below.

### On-task sentinel verification — corrected, third pass (item 1)

A second independent audit rejected the prior pass's handling of this item: testing Kuznetsov/
Vecalign, finding neither on-task, and folding both into Lane 2 does not satisfy the actual
requirement — a Lane 1 query must retrieve a **genuinely domain-and-task-relevant, indexed** sentinel
whose real subject (verified from the paper's own text, not title terms) is cross-version
recommendation/guideline/protocol **or** legislative-text counterpart alignment. This pass re-examines
every existing Lane 1 sentinel's **full abstract text**, not its title, against that bar, and searches
specifically for a qualifying clinical-domain candidate. Every finding below is stated directly, with
no redefinition of "directly on-task" after the fact.

**S5 does not qualify — verified from the paper itself, not title terms.** S5 ("High-precision
information retrieval for rapid clinical guideline updates," npj Digital Medicine 2025) was read in
full (abstract, `lane-design/test_kuznetsov_sentinel.py`-adjacent verification call, OpenAlex work
`W4409861609`). Its actual task is **evidence surveillance**: retrieving new clinical-trial
publications so guideline committees can decide whether to update a recommendation ("precision-focused
literature search filters tailored specifically for guideline maintenance," benchmarked against
identifying "pivotal publications for guideline updates"). It does **not** compare two guideline
*versions* to recover which recommendation in version *N* corresponds to, replaces, or was newly added
relative to version *N-1* — there is no version-to-version counterpart-recovery step anywhere in its
described method. **S5 is disqualified as an on-task Lane 1 sentinel** and is relabeled in
`SENTINEL_BIBLIOGRAPHY.md` as validating a related-but-distinct concept (evidence-retrieval-for-
guideline-maintenance), not version-to-version counterpart alignment.

**S7 and S8 do qualify — verified from the paper itself.** Both were re-read in full this pass
(abstracts above, OpenAlex works `W2510302779` and `W3199860868`). S7 (Legislative Influence Detector)
detects **text reuse across bills** — i.e., finds which specific bill's text another bill's text
actually corresponds to/originates from, a genuine textual-counterpart-recovery task, not merely topic
similarity. S8 (Learning Bill Similarity) is explicitly a **bill-to-bill and section-to-section
correspondence task** ("bill-to-bill linkages," a 5-class relation-classification scheme at the
subsection level capturing derivation, reordering, and paraphrasing between bill pairs) — this is
counterpart alignment by definition, at exactly the granularity (section/subsection) this study's own
M4 operates at. **Both qualify as genuinely on-task, indexed sentinels**, and both were already
confirmed retrieved by the locked OpenAlex legislative family (first-pass finding, unchanged: S7 ✓,
S8 ✓). **This satisfies the requirement for the legislative half of Lane 1.**

**No qualifying clinical-domain sentinel was found, despite a dedicated search.** Five real,
independent searches were run this pass for a clinical-guideline-domain paper whose actual task is
matching/aligning individual recommendations between two guideline versions or editions (search
records: real web searches for "mapping recommendation changes between successive clinical guideline
versions," "guideline recommendations... previous version... alignment... automatic detection,"
"recommendation matching guideline editions text alignment," and "living guideline update tracking
recommendation diff NLP method paper"). Candidates surfaced (GGPONC/S4, CREST, the Next Generation
Evidence system/S5, various guideline-information-extraction and LLM-guideline-reasoning papers) were
each checked against the actual bar and **none perform version-to-version recommendation counterpart
matching** — they extract, classify, or retrieve evidence *for* guidelines, or annotate a *single*
guideline's structure, but none compare two guideline versions to recover corresponding/changed
recommendations as their stated task.

**Stated transparently: no genuinely on-task, indexed, clinical-domain sentinel was found** despite a
dedicated search. The legislative sub-family, by contrast, has two: S7 and S8 are genuinely on-task
and confirmed retrieved. **The third-pass conclusion drawn from this finding — that Lane 1's clinical
sub-family therefore design-FAILS outright — was itself corrected on a fourth independent audit as
circular:** requiring proof that an exact clinical version-to-version counterpart-alignment paper
already exists, before the design that will *search for* such literature can be validated, effectively
demands the study's own novelty question be answered in advance by a design-stage literature check.
The correction below replaces that single exact-intersection gate.

### Component-validation framework — replaces the single exact-intersection gate (item 1, fourth pass)

Rather than one all-or-nothing "does an exact clinical counterpart-alignment sentinel exist" test,
each Lane 1/Lane 2 family is validated **component-by-component**, and each component requires a
verified, eligible sentinel **only where that kind of literature is known to exist**:

| Component | Requirement | Verified sentinel(s) | Status |
|---|---|---|---|
| **(a) Clinical guideline/protocol maintenance and version/change terminology** | A sentinel confirmed retrieved by the locked, MeSH-expanded PubMed clinical family | S5, S6 | **Satisfied** — both confirmed retrieved (count 1 each; see "Final locked query strings" below). |
| **(b) Genuine document/sentence/version-alignment methods** | A verified, indexed sentinel for the general version/sentence-alignment method area, serving Lane 2 | S9 (Kuznetsov), S10 (Vecalign) | **Satisfied** — both real, indexed, confirmed correctly outside Lane 1's domain-restricted search (as it should be — they are domain-general), and used as Lane 2 seeds. |
| **(c) Legislative or regulatory cross-version/text-reuse precedents** | A sentinel confirmed retrieved by the locked OpenAlex legislative family | S7, S8 | **Satisfied** — both confirmed retrieved, both genuinely on-task from full-text verification (third pass). |
| **(d) Retrieval of any known exact clinical precedent, if one is identified** | A sentinel for a paper that performs *exact* clinical-domain version-to-version recommendation counterpart matching | *None identified* | **No sentinel to require.** This is not a failed requirement — it is an honestly empty cell, because a dedicated five-search effort (above) found no such paper in the literature indexed by the sources this session can query. |

**The absence of an exact clinical precedent (component d) is neither a PASS nor proof of novelty
before execution.** Treating an empty component-(d) cell as either "the design is validated, move on"
or "the study is proven novel" would both be premature — the honest status is that this specific,
narrow question (does exact clinical recommendation-counterpart-alignment literature already exist and
is it indexed) remains **open**, and can only be closed empirically: **it becomes a research-gap
conclusion only if the completed official search, K.6 screening, and K.8 citation chaining are
actually run and genuinely find no such paper** — not asserted here from a design-stage check alone.
S5 is **not** eligible for component (d) (verified, third pass, to perform evidence surveillance, not
counterpart recovery) but **is** eligible for, and satisfies, component (a).

**Abort rule (component-level):** components (a), (b), and (c) — where sentinels are known to exist —
must each have their sentinel(s) confirmed retrieved by the query/seed set actually used before
official execution. **A failure to retrieve a required component's sentinel pauses execution for that
component specifically** and requires a documented, prospective correction (query revision,
source-classification change, or explicit scope narrowing) before that component runs again — the
existing K.4a sentinel-miss-pause rule, now applied per component. Component (d) has no abort
condition (nothing to miss); its "no known precedent identified" status is carried forward as an
explicit open question for the official search to test, not silently dropped.

**Lane 1 status under this framework: components (a) and (c) — all that Lane 1 itself can be tested
against — are both satisfied.** Component (b) is satisfied via Lane 2. Component (d) remains
genuinely open, pending actual execution, and is tracked as such rather than forced into a premature
pass or fail.

Kuznetsov (S9) and Vecalign (S10) remain in the bibliography as real, verified, indexed items — not
because either is a Lane 1 sentinel (neither is: both are confirmed, by the same real membership tests
run this pass, to be domain-general method papers outside Lane 1's clinical/legislative restriction),
but because both are genuinely useful Lane 2 seeds for the version/sentence-alignment method area
(component b, above).

### Final locked query strings and complete-pagination feasibility (item 6, second pass)

Exact, final candidate strings for both core Lane 1 sources, re-run independently from the first-pass
counts to confirm stability, plus a **complete-pagination reconciliation test** — paging through the
*entire* result set via ordinary pagination and confirming the sum of unique record IDs collected
exactly equals the source's own reported total (never retaining the full corpus at this design/
feasibility stage — the count and ID-list are read only long enough to reconcile, then discarded,
consistent with the "no official execution yet" boundary).

**PubMed/MEDLINE (E-utilities `esearch`, `db=pubmed`, `retmode=json`, field tag `[tiab]`):**

- Clinical, free-text only (superseded baseline, kept for comparison): `("guideline update*"[tiab] OR "guideline change*"[tiab] OR "guideline revision*"[tiab] OR "recommendation change*"[tiab] OR "recommendation update*"[tiab] OR "living guideline*"[tiab] OR "version alignment"[tiab] OR "recommendation matching"[tiab] OR "guideline recommendation change*"[tiab]) AND ("clinical guideline*"[tiab] OR "practice guideline*"[tiab] OR "medical guideline*"[tiab])`
  Re-run count: **680** (sha256 `c9780f87bd4054b235242a4d6565e38394909d9d58c85406d962f4060d682a55`) —
  identical to the first-pass count, confirming query stability.
  **Pagination reconciliation:** 4 pages of `retmax=200` (200/200/200/80), reported total 680, unique
  IDs collected 680, **match: True**, zero within-batch duplicates on any page.
- **Clinical, MeSH-expanded — new locked default (item 4):** `("guideline update*"[tiab] OR "guideline change*"[tiab] OR "guideline revision*"[tiab] OR "recommendation change*"[tiab] OR "recommendation update*"[tiab] OR "living guideline*"[tiab] OR "version alignment"[tiab] OR "recommendation matching"[tiab] OR "guideline recommendation change*"[tiab]) AND ("clinical guideline*"[tiab] OR "practice guideline*"[tiab] OR "medical guideline*"[tiab] OR "Practice Guidelines as Topic"[Mesh] OR "Guidelines as Topic"[Mesh])`
  Count: **1,179** (sha256 `49365efb01cd08f93042487730329922916e7f4b13eda7b7102f52a049ab3d5b`) — +499
  records (+73%) over the free-text-only baseline, with **both S5 and S6 still retrieved** (membership
  count 1 each) and **complete-pagination reconciliation exact** (6 pages of `retmax=200`:
  200×5 + 179; reported total 1,179; unique IDs collected 1,179; match: True; zero duplicates). Real,
  tested, positive result — see item 4 discussion below for what was and was not tried.
- Legislative (supplementary, not core — item 5): `("text reuse"[tiab] OR "bill similarity"[tiab] OR "legislative influence"[tiab] OR "version alignment"[tiab] OR "sentence alignment"[tiab] OR "policy diffusion"[tiab] OR "model legislation"[tiab]) AND ("legislative bill*"[tiab] OR "state bill*"[tiab] OR "legislative text"[tiab] OR "regulatory text"[tiab] OR statute*[tiab] OR legislation[tiab])`
  Re-run count: **50** (sha256 `f474d8a70a54244eb31abb77d4ff1e8b575edd63b049ca509c2ef25f3732fbd4`) —
  identical to the first-pass count. (No MeSH expansion applies here — "Guidelines as Topic" and
  similar biomedical MeSH headings have no legislative-domain equivalent in PubMed's controlled
  vocabulary.)

### PubMed strategy strengthening — MeSH terms (item 4, third pass)

Tested directly (`lane-design/test_pubmed_mesh.py`, real `esearch` calls, 2026-09-02): adding
`"Practice Guidelines as Topic"[Mesh] OR "Guidelines as Topic"[Mesh]` as OR-alternatives inside the
clinical domain-unit block, while retaining all existing free-text sensitivity terms unchanged. This
increases the clinical family from 680 to **1,179** records — a real sensitivity gain (records indexed
under the MeSH heading but not using the exact free-text phrases "clinical/practice/medical
guideline*"), confirmed to retain both existing on-task-adjacent sentinels (S5, S6) and to remain
completely, exactly reconcilable via ordinary pagination. Because this result strictly dominates the
free-text-only baseline (more sensitive, no sentinel lost, still fully exportable, still a manageable
size), **the MeSH-expanded query (1,179 records) is adopted as Lane 1's new locked PubMed clinical
default**, superseding the 680-record free-text-only version. Other MeSH alternatives (e.g.,
`"Guideline Adherence"[Mesh]`, `"Practice Guideline"[Publication Type]`) were considered but not
separately tested this pass — MeSH expansion is not claimed exhaustive, only demonstrably beneficial
over the untested baseline for the two headings actually run.

**OpenAlex (`works` endpoint, `filter=title_and_abstract.search:...`, repeated-key AND semantics):**

- Clinical (locked default): `title_and_abstract.search:"guideline update"|"guideline change"|"guideline revision"|"recommendation change"|"recommendation update"|"living guideline"|"version alignment"|"recommendation matching"|"guideline recommendation change",title_and_abstract.search:"clinical guideline"|"clinical guidelines"|"practice guideline"|"practice guidelines"|"medical guideline"|"medical guidelines"`
  **Pagination reconciliation** (cursor paging, `per-page=200`): 7 pages
  (200×6 + 135), reported total 1,335, unique IDs collected 1,335, **match: True**.
- Legislative (core per item 5): `title_and_abstract.search:"text reuse"|"bill similarity"|"legislative influence"|"version alignment"|"sentence alignment"|"policy diffusion"|"model legislation",title_and_abstract.search:"legislative bill"|"legislative bills"|"state bill"|"state bills"|"legislative text"|"regulatory text"|statute|statutes|legislation`
  **Pagination reconciliation:** 5 pages (200×4 + 112), reported total 912, unique IDs collected 912,
  **match: True**.

**arXiv — one unambiguous classification (item 3, corrected):** the prior pass described arXiv both
as "core for Lane 2" and, separately, as carrying a "minor role for Lane 1," which is exactly the kind
of dual classification the second audit flagged as ambiguous. Corrected to a single, unambiguous rule:
**arXiv is classified NON-CORE for Lane 1 and is excluded from the locked Lane 1 execution manifest
entirely.** Its established first-pass counts of 1 (broad-unit clinical and legislative variants) are
retained only as the *evidence* that justified this exclusion, not as a placeholder family still
notionally "included." **arXiv is core for Lane 2 only** — its actual role in this design is
supplying and verifying Lane 2 seeds and citation-chaining candidates (DPR, ColBERT, the entity-
matching survey, Kuznetsov, Vecalign all have arXiv identifiers), a role fully independent of Lane 1
search execution. Consequence: no arXiv Lane 1 query appears in the execution manifest below, and no
further arXiv Lane 1 count needs confirming before execution — the rate-limit issue noted in the prior
pass (a narrow-unit clinical re-test blocked by HTTP 429) is now moot, since that query is not part of
the locked design.

### Recommendation — LOCKED to the narrow-unit variant, MeSH-expanded (item 4, corrected third pass)

The **narrow-unit clinical variant, MeSH-expanded (1,179 PubMed / 1,335 OpenAlex) plus the legislative
family (OpenAlex core 912; PubMed 50 non-blocking supplementary)** is now **locked as the sole Lane 1
default**, not "recommended." Two candidate sentinels tested against the broad-unit variant (S9
Kuznetsov, S10 Vecalign) showed the broad variant's only additional "hit" over the narrow variant
(S9, count 1) was verified term-by-term to be a **false-positive match on the unrelated phrase
"annotation guidelines,"** not genuine clinical-guideline content — so the broad variant provides no
real sensitivity gain for any sentinel tested to date, only additional noise (2,398 vs. 1,179 PubMed;
5,850 vs. 1,335 OpenAlex). Per this design's own gate rule, the narrow-unit variant is locked; the
broad-unit variant is retained only as a documented sensitivity alternative, not part of the locked
execution manifest. **This lock does not resolve item 1's blocker** — locking the query width is a
separate question from whether that query is validated by a genuinely on-task sentinel, and the
clinical sub-family's on-task-sentinel gap (above) remains open regardless of which width is locked.

Both locked families are completely, reproducibly exportable via ordinary pagination — verified for
total-count/pagination reconciliation (see "Final locked query strings and complete-pagination
feasibility" below). The combined pre-deduplication total (~3,476, narrow + MeSH-expanded) is stated
as an **estimated workload**, not asserted as "defensible" on its own — defensibility requires the
prespecified reviewer-capacity gate named in the workload table below, which is not yet set and is
recorded as a required blocker, not an optional nicety.

### Legislative-family sentinel coverage finding (item 5, second pass)

**OpenAlex legislative family:** materially covers its directly relevant sentinels — both S7
("The Legislative Influence Detector," text reuse in state legislation) and S8 ("Learning Bill
Similarity") are confirmed retrieved (✓, ✓, from the first-pass design testing). This is adequate,
real coverage; the OpenAlex legislative family (912 records) is retained unchanged as Lane 1 core.

**PubMed legislative family:** cannot be sentinel-validated at all. Neither S7 nor S8 is PubMed-
indexed (both are KDD/EMNLP computer-science venues, confirmed non-biomedical), and no other
legislative-domain sentinel in this bibliography is PubMed-indexed either — there is no available
PubMed-indexed legislative sentinel to test against. Combined with its low absolute yield (50 records)
and the structural mismatch of searching a biomedical database for legislative-text literature, PubMed
legislative is **narrowed from a mandatory Lane 1 core family to a supplementary, non-blocking
attempt**: it may still be queried and its results retained, but a PubMed legislative-family
retrieval failure or gap does not gate Lane 1 completion, and it carries no sentinel-validated
sensitivity claim. OpenAlex remains the sole *core, sentinel-validated* legislative source. This
narrowing is recorded here rather than silently dropping the family, consistent with item 5's
instruction.

---

## Lane 2 — Structured method-landscape review

**Scope:** lexical retrieval, dense retrieval, reranking, assignment/global matching, set-valued
prediction, and relevant evaluation methods (K.1's standalone method-scope items).

**This lane is not a database search.** It is a curated review: a small, prespecified set of real,
verified seeds (authoritative surveys/tutorials where one exists, otherwise a landmark paper),
extended by *one round* of citation chaining — but only where that chaining is itself feasible at a
defensible scale, tested directly rather than assumed.

### Seed-selection criteria

For each K.1 method area: (1) prefer a recent, well-cited *survey or tutorial* over a single
seminal paper, since surveys are inherently more comprehensive and typically far less cited than the
landmark papers they summarize (a citation-graph-size consideration, tested below); (2) where no
survey exists or the area's own literature was already found as sentinels, use the verified seminal
paper directly; (3) every seed's identifier is confirmed by direct API lookup before use, exactly as
`SENTINEL_BIBLIOGRAPHY.md` already required for K.4a.

### Verified candidate seeds and citation-chaining feasibility — REBUILT, corrected third pass (items 2/3)

The second independent audit found the original seed map included two "weak analogies" (DETR and
conformal prediction) and lacked a direct seed for version/sentence alignment. DETR was removed and
conformal prediction was retained with a justification in the second-pass response. **The third
independent audit rejected that justification**: a fixed predicted-set cap
(FND-002) is not, by itself, evidence that this study's *planned* method uses conformal calibration —
the cap could equally be satisfied by plain top-*k* thresholding with no coverage guarantee at all.
Checked directly this pass: `DECISION_REGISTER.md`'s verbatim FND-002 text specifies only a frozen
maximum set size, an invalid-output rule for over-cap predictions, and development-only sensitivity
analyses to justify the numeric cap — **no calibration set, nonconformity score, coverage target, or
any other conformal-specific mechanism is named anywhere in the protocol.** No planned algorithm or
registered evaluation uses conformal calibration/coverage. Per the audit's own rule ("the predicted-set
cap alone is insufficient justification"), **conformal prediction is removed** as a remote analogy,
alongside DETR. The seed map is rebuilt below, method-area by method-area, with each seed's relevance
justified against a specific, checked study need rather than general fame or superficial resemblance.

| Method area | Seed | Identifier | OpenAlex cited-by | Study-specific relevance | Backward refs | Forward cites | Chaining feasibility |
|---|---|---|---|---|---|---|---|
| Lexical retrieval | Robertson & Zaragoza, "The Probabilistic Relevance Framework: BM25 and Beyond" (2009) | DOI 10.1561/1500000019 | 3,116 | M1's candidate-generation stage is a lexical-retrieval step (`PLACEHOLDER_REGISTER.md`'s M1 candidate configuration row: "index/matching parameters"); BM25 is the standard baseline this literature area is built on. | — | 3,116 | **Infeasible to chain.** Direct manual anchor (K.9 extraction), not a chaining seed. |
| Dense retrieval | Karpukhin et al., DPR (2020) | arXiv:2004.04906 / DOI 10.18653/v1/2020.emnlp-main.550 | 142 (OpenAlex; likely an undercount — see note) | M2's embedding-model/fusion-weight candidate configuration is exactly a dense-retrieval design choice. | 49 | 142 | Feasible — 191 combined, one small batch. |
| Reranking / late interaction | Khattab & Zaharia, ColBERT (2020) | arXiv:2004.12832 | 1,200 | M3-R (reranker candidate) is directly the model family ColBERT represents. | — | 1,200 | **Infeasible to chain.** Direct manual anchor only. |
| Entity resolution / record linkage **and** assignment/global matching | Barlaug & Gulla, "Neural Networks for Entity Matching: A Survey" (2021) | arXiv:2010.11075 | 121 | M4's recommendation-to-recommendation matching across guideline/bill versions is structurally an entity-matching/record-linkage problem; entity-matching surveys of this kind already cover blocking-then-matching and one-to-many/many-to-many assignment strategies as part of their scope, so this single seed now explicitly covers **both** K.1's "entity resolution" and "assignment/global matching" method-scope items. | 148 | 121 | Feasible — 269 combined, one small batch. |
| Version/document alignment (task-specific method) | Kuznetsov et al., "Revise and Resubmit" (2022) | DOI 10.1162/coli_a_00455 | 17 | Directly defines and operationalizes "version alignment" as a task on paired document revisions — the closest existing method-literature analogue to M4's own version-to-version recommendation matching, confirmed (S9) to sit outside Lane 1's domain-restricted search. | 75 | 17 | Feasible — 92 combined. |
| Sentence/version alignment method | Thompson & Koehn, "Vecalign" (2019) | DOI 10.18653/v1/D19-1136 | 64 | A concrete, linear-time automatic sentence-alignment algorithm — directly informs how M4 could align matched recommendation text at the sentence level, confirmed (S10) to sit outside Lane 1's domain-restricted search. | 27 | 64 | Feasible — 91 combined. |
| Legislative/regulatory sequence alignment (crossover with Lane 1) | Burgess et al., "The Legislative Influence Detector" (2016) | DOI 10.1145/2939672.2939697 | 41 | Also a Lane 1 legislative sentinel (S7, re-verified this pass as genuinely on-task — see above); dual-purpose as a Lane 2 seed for text-reuse-detection methodology applied to legislative text. | 13 | 41 | Feasible — 54 combined. |
| ~~Assignment / bipartite matching~~ | ~~Carion et al., DETR (2020)~~ | — | — | **REMOVED.** No precise, study-specific justification tying its Hungarian-matching component to M4 or its evaluation was found. Scope now covered on-domain by the entity-matching survey above. | — | — | — |
| ~~Set-valued prediction (uncertainty framing)~~ | ~~Angelopoulos & Bates, "A Gentle Introduction to Conformal Prediction..." (2021)~~ | — | — | **REMOVED, corrected third pass.** FND-002's predicted-set cap alone does not establish that the study's planned method uses conformal calibration/coverage (verified directly against `DECISION_REGISTER.md`'s FND-002 text — no calibration mechanism is named); a top-*k* cap with no coverage guarantee satisfies FND-002 equally well. No specific planned algorithm or registered evaluation uses conformal prediction. | — | — | — |

**Seven retained seeds, corrected count (item 3):** two are non-chainable direct manual anchors (BM25,
ColBERT); **five are chainable** — DPR, the entity-matching survey, Kuznetsov, Vecalign, and Burgess
LID (not four, as the first-pass workload table incorrectly stated, and not six, since conformal
prediction is now removed). Real backward-reference + forward-citation totals per chainable seed:
DPR 191, entity-matching survey 269, Kuznetsov 92, Vecalign 91, Burgess LID 54 — a real range of
**54–269 records per seed**, summing to **697 records, pre-deduplication**, not the earlier
unsubstantiated "~100–150 each, rough estimate." **Overlap/dedup is acknowledged, not estimated:**
these five seeds are drawn from adjacent NLP/IR subfields and will very likely share some backward
references (e.g., common embedding or transformer papers cited by both DPR and the entity-matching
survey); the true post-dedup count is lower than 697 but is not claimed here without actually running
the dedup step against real retrieved records at execution time — 697 is stated as a raw,
pre-deduplication upper bound, not a final estimate.

**Data-quality note carried forward from `SENTINEL_VALIDATION_LOG.md`:** DPR's OpenAlex citation
count (142) is suspect — the same record was already found to carry a citation-string abstract
instead of real text, so its citation-graph completeness in OpenAlex is also plausibly degraded, not
a true reflection of DPR's actual influence. This is disclosed, not corrected (no query can fix
missing platform data); if DPR's own citation count needs verifying at execution time, Semantic
Scholar's `citationCount` field (once accessible) is a documented cross-check.

**Lane 2 is not, and must never be presented as, an exhaustive systematic search of the IR/entity-
resolution/matching literature.** Its evidence-table entries (K.9) are labeled by source type
(`SEED`, `SEED_CITATION_FORWARD`, `SEED_CITATION_BACKWARD`) so a reader can see exactly how each
record was found, distinct from Lane 1's search-derived records.

---

## Yield-feasibility gate and workload table (no invented threshold)

**Gate rule:** a candidate query or citation-chaining pass is evaluated on two facts only — its
**total count** and whether that count is **completely exportable** via ordinary pagination (no
technical cap forcing a partial sample). Neither judgment inspects which specific records would be
retrieved or whether they look favorable to any hypothesis — the gate is checked before anyone reads
the result content, exactly as `AUDIT_LOG.md` Entry 009's "do not tune against yield" rule already
requires.

The pre-dedup counts below are a **planning upper bound only** — the input to the frozen
reviewer-capacity gate defined in the next section, not a claim that any total is itself "defensible."
Rates use a commonly-cited title/abstract screening range (0.75–2 minutes per record) for illustration
only; the actual capacity gate (below) uses a pilot-timed rate, not this borrowed range:

| Candidate set | Records | Hours at 0.75 min/rec | Hours at 1.5 min/rec | Hours at 2 min/rec |
|---|---|---|---|---|
| PubMed Legislative (supplementary, non-core) | 50 | 0.6 | 1.3 | 1.7 |
| OpenAlex Legislative (core) | 912 | 11.4 | 22.8 | 30.4 |
| PubMed Clinical, free-text only (superseded — see MeSH-expanded row) | 680 | 8.5 | 17.0 | 22.7 |
| PubMed Clinical, **MeSH-expanded (locked default)** | 1,179 | 14.7 | 29.5 | 39.3 |
| OpenAlex Clinical (narrow, locked default) | 1,335 | 16.7 | 33.4 | 44.5 |
| **Locked Lane 1 total (narrow + MeSH-expanded, pre-dedup)** | **~3,476** | **43.5** | **86.9** | **115.9** |
| PubMed Clinical (broad-unit sensitivity alternative, not default) | 2,398 | 30.0 | 60.0 | 79.9 |
| OpenAlex Clinical (broad-unit sensitivity alternative, not default) | 5,850 | 73.1 | 146.3 | 195.0 |
| Lane 2 — 5 chainable seeds, real backward+forward totals (DPR 191, entity-matching survey 269, Kuznetsov 92, Vecalign 91, Burgess LID 54), pre-dedup | 697 | 8.7 | 17.4 | 23.2 |

Deduplication (Lane 1 has heavy PubMed/OpenAlex overlap for biomedical content; Lane 2's five seeds
share subfields and likely share some backward references) will reduce the pre-dedup totals
meaningfully, but the true post-dedup number is not claimed here without actually running the
reproducible dedup step at execution time — this table intentionally uses raw, honestly labeled
pre-dedup counts rather than an estimated reduction.

---

## Reviewer-capacity gate — frozen formula, sign-off fields left blank (item 2, fourth pass)

**Superseded by AUTH-009 (2026-09-03) — screening itself is now AI-assisted, not human stage-1
reading of every record.** The formula below assumed Mohamed Faisal Sindhi personally screens all
`TOTAL_LANE1_LANE2_RECORDS`; the investigator determined that workload infeasible. `stage1_hours_
estimate` below is retained **unmodified, as the historical record of what a fully-human stage-1 would
have required** — it is no longer the governing capacity calculation. The current, governing workload
recalculation (AI classification requiring no human screening time; human verification of every AI
`INCLUDE`/`UNCERTAIN` record; a stratified, escalation-governed audit of AI `EXCLUDE` records) lives in
`AI_ASSISTED_SCREENING_DESIGN.md` §5 (calibration) and §6.c (audit-driven human workload). The
reviewer-capacity **gate itself remains required and unmet** — its two blank sign-off inputs
(`AVAILABLE_HOURS`, `PILOT_RATE_MIN_PER_RECORD`) are still needed, now applied to the smaller,
AI-assisted workload rather than the full pre-dedup count.

**Staffing (confirmed 2026-09-02):** Mohamed Faisal Sindhi (investigator) is the **primary stage-1
screener**. The stage-2 checker remains `TO_BE_APPOINTED` (Dr. Nasir Uddin is one possible candidate,
not assumed). This gate applies to stage-1's estimated workload directly and to stage-2's estimated
workload once a checker is appointed.

**Capacity vs. execution — explicitly distinguished:** the *technical* capacity to execute/export
Lane 1/Lane 2 (API queries, pagination, hashing) is already demonstrated (see "Final locked query
strings and complete-pagination feasibility," below) and requires no human screening capacity at all.
**Screening capacity is a separate question.** Running the official search before a screener's
capacity is confirmed to fit the resulting workload — or before a stage-2 checker exists at all — would
produce a frozen corpus (K.11's cutoff, once set, does not reopen) that no one can finish processing.
For this reason, **the reviewer-capacity gate below, and stage-2 checker appointment, are both
pre-execution gates, not merely pre-screening ones.**

**Two required inputs, neither invented here — left as explicit sign-off fields:**

1. **Documented available screening hours** (`AVAILABLE_HOURS`) — the primary screener's actual
   confirmed hours available for stage-1 screening within a stated window (e.g., hours/week × weeks
   before the next planning gate), and the stage-2 checker's equivalent once appointed. **Not
   invented; left blank below for the investigator to complete.**
2. **Pilot-timed screening rate** (`PILOT_RATE_MIN_PER_RECORD`) — a conservative minutes-per-record
   rate established by the primary screener timing themselves on a **small, explicitly non-official
   development/pilot sample** (a randomly drawn set of title/abstracts — e.g., ~20–30 records — pulled
   from a source *other* than the locked official query, or from a clearly marked practice subset never
   entered into the official screening log). This pilot **does not count as official screening** and
   its records are never treated as included/excluded in the real corpus. **Not invented here; left
   blank below.**

**Frozen formula (complete; only the two inputs above are blank):**

```
stage1_hours_estimate  = TOTAL_LANE1_LANE2_RECORDS × PILOT_RATE_MIN_PER_RECORD / 60
stage2_hours_estimate  = (predicted_inclusions_plus_uncertain + 0.10 × predicted_exclusions)
                          × STAGE2_RATE_MIN_PER_RECORD / 60
required_capacity      = (stage1_hours_estimate + stage2_hours_estimate) × (1 + CONTINGENCY_MARGIN)

PASS  iff  AVAILABLE_HOURS(stage-1) ≥ stage1_hours_estimate × (1 + CONTINGENCY_MARGIN)
           AND AVAILABLE_HOURS(stage-2, once checker appointed) ≥ stage2_hours_estimate × (1 + CONTINGENCY_MARGIN)
FAIL  otherwise
```

- `TOTAL_LANE1_LANE2_RECORDS` = the locked pre-dedup total from the table above (~3,476 Lane 1 +
  697 Lane 2 = **~4,173**, before the reproducible dedup step reduces it further at execution time —
  using the higher, undeduplicated figure keeps this a conservative planning bound).
- `predicted_inclusions_plus_uncertain` and `predicted_exclusions`: since real inclusion/exclusion
  counts do not exist before stage-1 runs, use a **conservative planning-stage inclusion-rate
  assumption**, drawn from the commonly-cited systematic-review inclusion-rate range (roughly 5–30% of
  screened records survive to full-text/inclusion), not a single invented figure — e.g., at a 30%
  (conservative-high) assumed inclusion rate on ~4,173 records: `predicted_inclusions_plus_uncertain`
  ≈ 1,252, `predicted_exclusions` ≈ 2,921, so stage-2 covers ≈ 1,252 + 292 ≈ 1,544 records — a bound,
  not a forecast, and this specific rate stays a **sign-off-adjustable assumption**, not frozen fact.
- `STAGE2_RATE_MIN_PER_RECORD`: stage-2 full-text/adjudication checking is typically slower than
  stage-1 title/abstract screening; absent a pilot-timed stage-2 rate, use the same
  `PILOT_RATE_MIN_PER_RECORD` as a conservative floor (a real stage-2 rate, once piloted by the
  appointed checker, should replace it).
- `CONTINGENCY_MARGIN`: a standard planning buffer, disclosed rather than silently assumed — **20%**
  by default (a conventional project-planning margin, not a value derived from this study's own data);
  the investigator may adjust it, logged as such, but it is not left at 0%.

**Sign-off fields (blank; must be populated and the PASS condition must hold before execution):**

| Field | Value |
|---|---|
| `AVAILABLE_HOURS` (stage-1, Sindhi) | ___ (to be completed) |
| `AVAILABLE_HOURS` (stage-2, once checker appointed) | ___ (to be completed) |
| `PILOT_RATE_MIN_PER_RECORD` (from a real, timed, non-official pilot sample) | ___ (to be completed) |
| Assumed inclusion-rate for stage-2 planning (5–30% range; state the chosen value) | ___ (to be completed) |
| `CONTINGENCY_MARGIN` (default 20%; state if adjusted) | 20% (default; adjustable) |
| Resulting `required_capacity` (computed once the above are filled) | ___ (to be computed) |
| PASS/FAIL against `AVAILABLE_HOURS` | **Cannot be evaluated — inputs not yet provided. Treated as FAIL by default until populated and passing.** |

**If the gate fails (computed `required_capacity` exceeds `AVAILABLE_HOURS`):** query refinement may
occur **only** by prespecified, relevance-neutral rules — e.g., uniformly tightening truncation,
restricting to title-only rather than title+abstract fields, adding a disclosed publication-date limit
applied identically regardless of content, or dropping a specific *whole* concept-block variant (never
narrowing based on which records look favorable or unfavorable once retrieved). **Any such refinement
must repeat the full sentinel/count/complete-pagination review before execution** — it does not skip
back to this gate with an unverified new query.

**Stage-2 note (unchanged):** the formula above is a planning estimate; K.6/LIT-003's actual stage-2
pass covers real inclusions/uncertain records plus a random 10% sample of exclusions, with the true
size known only once stage-1 completes.

---

## Google Scholar / ACL Anthology — truthful, limited supplementary role

Neither is used as a primary Lane 1 or Lane 2 source. Both remain access-limited for the reasons
already logged (`SEARCH_LOG.md`, `QUERY_TRANSLATION_TABLE.md`): no reproducible, verifiable
structured count is obtainable without either a human manually conducting and screenshotting the
search (Google Scholar) or accepting a simple free-text site index with no Boolean/count guarantees
(ACL Anthology).

- **Google Scholar:** if used at all, restricted to a **named-record verification check** —
  confirming a specific candidate found elsewhere is indexed there, or a bounded first-page manual
  spot-check for a handful of the narrowest Lane 1 queries — never presented as a ranked or capped
  "result count" standing in for a real search, and never used to claim broader coverage than what a
  human actually, personally viewed and logged (K.10: exact displayed query, filters, time, and
  count, captured by the human who ran it).
- **ACL Anthology:** limited role as a **venue-scoped supplementary check** for Lane 2's NLP-specific
  seeds and their citation-chaining candidates (ACL Anthology already scopes to NLP venues, so it is
  most useful for confirming an NLP paper's presence/venue metadata, not as an independent broad
  search). Its own site search returns no verifiable count; used only to confirm specific known
  papers, not to add un-verifiable new candidates.

Neither source contributes a "total count" row to the workload table above — their role is
verification/spot-check, not corpus contribution, and this is stated in Appendix K directly (see file
updates below) so it is never later mistaken for a covered database.

---

## Core vs. supplemental database determination

| Database | Classification | Justification |
|---|---|---|
| PubMed/MEDLINE | **Core for Lane 1** | Full Boolean control, truncation, MeSH support (item 4), verified retrieval of the legislative-domain on-task sentinels' clinical-adjacent counterparts, complete exportability via `retmax` pagination, complete-pagination reconciliation passed exactly. |
| OpenAlex | **Core for Lane 1** | Same properties (field-restricted Boolean filter, complete-pagination reconciliation passed exactly); also the widest general coverage of any source available this session, and one of K.3's designated reproducible supplemental indexes — its role is upgraded to core specifically *because* it independently passed the same tests PubMed did, not merely because it is broad. |
| arXiv | **One unambiguous classification (item 3, corrected): NON-CORE for Lane 1 (excluded from the execution manifest); Core for Lane 2 only** — CS/NLP method literature is exactly what arXiv indexes best (DPR/ColBERT/entity-matching-survey/Kuznetsov/Vecalign seeds are all arXiv- or ACL-Anthology-indexed), while its tested Lane 1 counts of 1 (broad-unit clinical and legislative variants) confirm it is not where clinical-guideline or legislative-change literature concentrates. No arXiv Lane 1 query is part of the locked design. |
| Crossref | **Supplemental only** — DOI resolution, dedup-key confirmation, and citation-metadata verification (as already used throughout `SENTINEL_BIBLIOGRAPHY.md`'s own identifier checks). **Not used for Lane 1 or Lane 2 search execution** — three independent tests (original block query, round-4 spot-check, and this design's narrower Lane 1 phrasing) all show its relevance search cannot support any of this project's query styles at a workable scale. This is a considered exclusion, stated here, not a silent omission. |
| Semantic Scholar | **Supplemental, access-gated** — never sentinel-validated this session (rate-limited on every attempt across three sessions of testing); if API access is arranged (a key, or a session outside the rate-limit window), it is re-evaluated for core status using the same sentinel-gate test as PubMed/OpenAlex before being trusted, not assumed valid retroactively. |
| Google Scholar, ACL Anthology | **Supplemental, verification-only** — see the workflow above. |
| ACM Digital Library, IEEE Xplore, EMBASE, CINAHL | **Unavailable** — no institutional access confirmed this session (unchanged since AUTH-005). **Their absence is not disguised by OpenAlex or Crossref's partial coverage of ACM/IEEE-published works** — OpenAlex indexing *some* papers that happen to be published in ACM/IEEE venues is not the same as searching those platforms' own specialized indices, controlled vocabularies, or full-text search, and is never described as equivalent coverage in any file this session touches. |

---

## Search-strategy quality checklist (PRESS-modeled) — item 5, corrected third pass

Modeled on the Peer Review of Electronic Search Strategies (PRESS) checklist's structure. **This is a
self-check against PRESS's dimensions and is explicitly not equivalent to formal PRESS peer review.**
The second independent audit specifically rejected treating a self-audit as satisfying this gate.
Formal PRESS review requires an independent, qualified second reviewer — not the same agent that
built the queries — to actually apply the checklist against the locked query set, and none has been
appointed (`PLACEHOLDER_REGISTER.md`'s reviewer row, `TO_BE_APPOINTED`). **Formal PRESS peer review is
recorded as a required, separate human quality gate that must be satisfied before official execution
— it is a hard blocker, not a nice-to-have, and nothing in this document downgrades or waives it.**

| PRESS dimension | Self-check finding (not a substitute for formal review) |
|---|---|
| **Boolean/logic structure** | Each Lane 1 family is a single two-block AND (change-concept block OR-ed internally, ANDed with a domain-unit block OR-ed internally) — a simple, auditable structure verified against real API responses, not assumed correct from the string alone. No nested Boolean beyond one level. |
| **Subject headings (MeSH etc.)** | **Tested this pass (item 4):** `"Practice Guidelines as Topic"[Mesh]` and `"Guidelines as Topic"[Mesh]` added to the PubMed clinical domain-unit block, re-run, confirmed to increase sensitivity (680 → 1,179) with no sentinel lost and exact pagination reconciliation — now the locked PubMed clinical default. No MeSH equivalent applies to OpenAlex/arXiv (no controlled vocabulary) or to the legislative family (no legislative MeSH headings exist in PubMed). Other candidate MeSH headings were not exhaustively tried. |
| **Spelling, syntax, line errors** | Every string above was executed against its live API and returned a real, reproducible count (re-run at least twice for every core family, with identical results) — a functional syntax check, not a manual proofread. No truncation-syntax mixing between databases (PubMed `*` vs. explicit word-form lists for OpenAlex, per `QUERY_TRANSLATION_TABLE.md`'s established finding). |
| **Search limits (date, language, type)** | **None applied.** No publication-date, language, or document-type filter is used in any Lane 1 or Lane 2 query tested this pass — consistent with a sensitivity-first, unrestricted design. If a limit is added later (e.g., a manuscript-update cutoff per DEC-032), it must be separately logged and re-tested against the sentinel set, not silently folded in. |
| **Line-by-line translation across databases** | Each concept block has an explicit per-database translation (`title_and_abstract.search` OpenAlex filter syntax vs. `[tiab]`/`[Mesh]` PubMed field tags), shown side-by-side above and in `QUERY_TRANSLATION_TABLE.md`. Truncation (`*`) is PubMed-only; OpenAlex uses explicit plural/word-form enumeration, a documented asymmetry, not an oversight. arXiv is excluded from Lane 1 entirely (item 3), so no Lane 1 arXiv translation is claimed. |
| **Peer review sign-off** | **Not performed. `TO_BE_APPOINTED`.** This checklist row itself is a self-audit by the same agent that built the queries — explicitly **not** formal PRESS peer review, and not treated as equivalent to it anywhere in this document. This is recorded as a required pre-execution blocker (see PASS/FAIL, below), not a placeholder that can be silently skipped. |

---

## Execution manifest and acceptance checks (item 7, second pass)

This specifies what an official Lane 1/Lane 2 execution (once separately authorized) must record and
verify per query, so that "the search ran" and "the search is verifiably complete and reconcilable"
are never conflated again (the AUTH-007 root cause per `AUDIT_LOG.md` Entry 014).

**Per-query manifest fields (recorded before, during, and after each query):**

1. **Query hash** — SHA-256 of the exact query string (or exact filter/parameter set) submitted, taken
   *before* the request fires, so the logged hash cannot be adjusted after seeing the result.
2. **Source** — database/API name and endpoint URL.
3. **Timestamp** — UTC timestamp of each request (initial query and every pagination request).
4. **Reported total** — the count value the API itself returns for the query (`esearchresult.count`,
   `meta.count`, `opensearch:totalResults`, etc.), captured once at the first request.
5. **Pages expected vs. received** — computed page count from `ceil(reported_total / page_size)`
   versus the number of pagination requests actually completed before a stop condition.
6. **Record IDs received** — the full set of unique per-database identifiers (PMID, OpenAlex `id`,
   arXiv id) collected across all pages.
7. **Duplicate-page detection** — a check, after each page, that no record ID returned on that page
   was already collected from an earlier page of the *same* query (paging-offset bugs surface as
   duplicate IDs across adjacent pages, not just as an undercount).
8. **Total reconciliation** — `len(unique record IDs collected) == reported_total`, checked once
   pagination completes. **This is the completion gate** — not HTTP `200`/`SUCCESS` status, closing
   the exact gap K.18 was rewritten to close in the first pass.
9. **Raw-file hashes** — SHA-256 of each raw per-page response file as saved to disk, recorded
   alongside the page number and request timestamp.
10. **Abort-on-mismatch rule** — if total reconciliation fails (7≠4, or step 8's equality is false)
    for any query, that query's execution **halts and is logged as a mismatch**, not silently retried
    with a different page size or accepted as "close enough." A mismatch requires a documented,
    prospective correction (a config change, a confirmed API bug with a workaround, or a decision to
    exclude that source) before that specific query is re-attempted — mirroring K.4a's existing
    sentinel-miss-pauses-execution rule, now extended to pagination integrity.

**What this manifest does not do:** it does not itself constitute an execution authorization. It is
the acceptance-check specification an execution must satisfy; running it against real data is a
separate, further-authorized act (item 9 below).

---

## PASS/FAIL recommendation — reassessed fourth pass (item 5)

**Recommendation: FAIL.** No conditional-pass language is used. Internal design items may — and, where
verified, do — pass on their own terms; **overall execution readiness remains FAIL** until the three
remaining blockers below clear, each requiring a human action this session cannot perform (an
independent review, a documented capacity confirmation, a staffing appointment) — not a further design
correction.

| # | Item | Result | Basis |
|---|---|---|---|
| 1 | On-task sentinel — component-validation framework | **PASS (design item, corrected)** | The single exact-intersection requirement (repaired as circular) is replaced by a four-component framework. Components (a) clinical guideline-maintenance terminology, (b) genuine alignment methods, and (c) legislative cross-version precedents each have verified sentinels confirmed retrieved by the locked query/seed set. Component (d), an exact clinical precedent, has none identified — explicitly recorded as an **open empirical question**, not a pass, not a fail, not proof of novelty; it resolves only once the completed official search, K.6 screening, and K.8 citation chaining actually run. |
| 2 | Conformal prediction reassessed | **PASS** | Unchanged from the third pass: checked directly against `DECISION_REGISTER.md`'s FND-002 text, no calibration mechanism named, removed from Lane 2. |
| 3 | Internal-consistency corrections | **PASS** | Unchanged from the third pass: chainable-seed count 5, real citation totals, arXiv given one classification. |
| 4 | PubMed MeSH strengthening | **PASS** | Unchanged from the third pass: 680 → 1,179 records, sentinels retained, exact pagination reconciliation. |
| 5 | Reviewer-capacity gate — frozen formula | **PASS (design item); BLOCKED (sign-off)** | A complete formula is defined (stage-1/stage-2 estimates, 20%-default contingency margin, explicit PASS/FAIL condition). The two required inputs (documented available hours; a pilot-timed screening rate) are correctly left as blank sign-off fields rather than invented — this is the formula's intended design, not a defect — but **the gate itself cannot be evaluated as passing until those fields are populated**, so it defaults to FAIL for execution-readiness purposes until then. |
| 6 | Independent search-strategy review package | **PASS (design item); BLOCKED (unsigned)** | `INDEPENDENT_REVIEW_PACKAGE.md` is complete — exact query strings, database roles, component sentinels, pagination checks, a PRESS-informed self-check explicitly marked non-equivalent to formal review, and a reviewer response form. It is correctly unsigned and makes no claim of formal PRESS review, but the review itself has not occurred. |
| 7 | Staffing clarified | **PASS (partial)** | Mohamed Faisal Sindhi confirmed as investigator and primary human verifier (redesignated 2026-09-03, AUTH-009, from "primary stage-1 screener" — screening itself is now AI-first) — no longer a placeholder. Independent search-strategy reviewer and the screening adjudicator (redesignated from stage-2 checker) both remain `TO_BE_APPOINTED` (no unnecessary permanent roles added; Dr. Nasir Uddin named as one possible, not assumed, adjudicator candidate). |
| 8 | AUTH-005/AUTH-007 preserved; cutoff UNSET; strict PASS/FAIL | **PASS** | Verified unchanged (hashes in `AUDIT_LOG.md` Entry 018); cutoff reverified UNSET by direct grep after every edit this pass; this section uses strict PASS/FAIL with a concrete blocker list, no conditional-pass wording. |

**Concrete pre-search-execution blocker list (must all clear before official Lane 1/Lane 2 execution
can be authorized) — two, revised down from three by AUTH-009 (2026-09-03):**

1. **Reviewer-capacity sign-off fields are not yet populated.** Requires the primary verifier's
   documented available hours and a pilot-timed screening rate (from a small, explicitly non-official
   development sample), entered into the sign-off table above, with the resulting PASS/FAIL condition
   actually evaluated and passing. **Note (AUTH-009):** the workload this gate sizes is now the
   AI-assisted human-verification + audit workload, not the full pre-dedup record count — see
   `AI_ASSISTED_SCREENING_DESIGN.md` §5–§6 for the recalculated formulas and scenario tables.
2. **No independent search-strategy reviewer is appointed**, and `INDEPENDENT_REVIEW_PACKAGE.md`
   remains unsigned. Requires appointing a reviewer independent of query construction, sufficiently
   experienced in systematic/scoping search methodology, and obtaining their completed response form.

**No longer a pre-search-execution blocker, superseded by AUTH-009 (2026-09-03):** a stage-2 screening
checker (now redesignated **screening adjudicator**) is no longer required **before official
execution** — screening is now AI-assisted (`AI_ASSISTED_SCREENING_DESIGN.md`), and this role is
required no later than the point human verification begins (after AI classification completes), not
before official Lane 1/Lane 2 search execution. **This does not mean the role is unnecessary** — it
remains a required, unmet appointment before human verification can begin (tracked in
`PLACEHOLDER_REGISTER.md` and `AI_ASSISTED_SCREENING_DESIGN.md` §8.2), and is a real blocker to *that*
later stage; it is simply no longer counted at *this* gate.

**What is explicitly no longer a blocker, and why:** the prior "no genuinely on-task, indexed sentinel
for Lane 1's clinical sub-family" item is resolved by the component-validation framework, not by
finding a new sentinel — components (a)–(c) are satisfied, and component (d)'s absence is a legitimate
open question the design correctly defers to actual execution rather than resolving in advance.

None of the three remaining blockers were treated as satisfied by assertion, redefinition, or
self-audit. **No official Lane 1/Lane 2 search was executed. No cutoff was set. No records were
screened. No EMS protocols were acquired. No protected paths were touched.** This document,
`SENTINEL_BIBLIOGRAPHY.md`, `INDEPENDENT_REVIEW_PACKAGE.md`, and the cross-file updates described in
`AUDIT_LOG.md` Entry 018 constitute the full fourth-pass deliverable. This is a corrective planning
pass only — execution requires clearing all three blockers above and a further, separate, dated
authorization after this FAIL determination is reviewed.
