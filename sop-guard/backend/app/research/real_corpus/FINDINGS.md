# Phase U research log: structural anchoring for provenance of paraphrased knowledge-base content

Status: **pilot-stage, not publication-ready.** This document is the durable record of what has
actually been measured so far, kept in the repo (not in any external planning tool) so it survives
independently and a future session — or a human — can resume without re-deriving any of it.

Last updated: 2026-08-06.

---

## 1. The claim, and why it might be novel

RAG systems increasingly cite *derived* representations of source documents (LLM-extracted or
hand-authored structured entries) rather than verbatim spans. When such a system wants to show
"here is exactly where this came from," it can only point at the derived entry, not the original
text — because the derived entry is a paraphrase, and paraphrases don't appear verbatim in the
source.

**Prior art check (done before claiming novelty):**
the W3C Web Annotation Data Model (`TextQuoteSelector` + `TextPositionSelector`, implemented in
Hypothes.is) already solves stale-offset recovery by re-anchoring on a verbatim quote match. That
is real, standardized prior art — **do not claim novelty for verbatim quote-anchoring.** But it
assumes the cited text exists verbatim somewhere in the source. It cannot help when the citation is
a genuine paraphrase, because there is no verbatim quote to search for. That gap — anchoring
paraphrased (not verbatim) content to its source span — is what this project's `_locate_step_by_number`
(in `app/rag/chunker.py`, production code) attempts, and what this pilot evaluates.

**The proposed method ("structural anchoring"):** anchor a paraphrase to its source span using the
document's *own* structural markers (numbered steps, headings) rather than text similarity to the
source, gated by some acceptance check so the system abstains rather than fabricates when it isn't
confident. Two different acceptance-gate designs have been tried here; see §5–§6.

---

## 2. Corpus

All documents are real, public-domain (US federal, 17 U.S.C. §105, no territorial restriction)
government guideline text, retrieved live via a browser tool (not simulated), stored under `raw/`
with a provenance header per file (source URL, retrieval date, publisher, license, numbering
scheme, and any construction notes). **Never mix this corpus with `app/demo_data/` (RAEY's own
synthetic SOP corpus) — they exist for entirely different purposes and must not be conflated.**

| doc_id | Source | Items | Structure |
|---|---|---|---|
| `cdc_core_practices` | CDC Core Infection Prevention and Control Practices | 20 parsed (6 duplicate IDs, see below) | Category headings, numbered 1–8 with lettered subcategories 5a–5f |
| `cdc_disinfection_sterilization` | CDC Disinfection/Sterilization Guideline | 95 | Deep alphanumeric numbering (`1.a`, `2.b.i`, `7.aa`, `7.am.1`) |
| `ahrq_cauti_appropriate_indications` | AHRQ CAUTI Implementation Guide, "Appropriate Indications" | 6 | Numbered 1–6, each 3–6 sentences (long, heavily paraphrasable) |
| `ahrq_cauti_inappropriate_indications` | AHRQ CAUTI Implementation Guide, "Inappropriate Indications" | 3 (of 4 real; item 4 and its nested duplicate-numbered sublist deliberately excluded, see file header) | Same style |
| `adversarial_decoy_markers` | **Synthetic**, constructed for this corpus, clearly labeled as such in its own header | 5 | Numbered References section (decoys) placed before a numbered Recommendations section (real), reusing the same numbers 1–5 — models a real pattern already observed in the other four files (footnote markers, "References and resources: 1-12" ranges) |

**Real corpus messiness found and documented, not smoothed over:**
- `cdc_core_practices` reuses six item IDs (`5a`–`5f` each appear twice: once as a passing mention
  under the parent section, once as the full subsection). Deliberately excluded from paraphrase
  pairs so the pilot measures anchoring accuracy, not ID-disambiguation (a separate, harder,
  real problem, flagged here for future work, not solved).
- AHRQ's numbering is CSS `<ol>` list-style-type output, not literal characters in the page's HTML
  text nodes — it had to be reconstructed at retrieval time (see the file headers), which is a
  genuinely different and arguably more realistic numbering-representation problem than CDC's
  typed-in numbers. A naive HTML-to-text ingestion pipeline that doesn't reconstruct list markers
  would silently lose this document's numbering entirely.
- `ahrq_cauti_inappropriate_indications`'s source page reuses "1–4" a second time for a nested
  sublist within item 4 — a real numbering collision within one page, not manufactured. Item 4 and
  its sublist are excluded from this file entirely for the same reason as the CDC duplicates.

**Paraphrase construction (Tier A only so far — see §8 for what Tier B would require):** all 38
paraphrases in `paraphrases.py` are hand-authored by a human paraphraser reading the real source
text and rewording it — explicitly *not* generated by the anchoring method itself, satisfying the
method/corpus separation a real evaluation needs. One authoring mistake was caught and is
documented rather than hidden: an early CDC paraphrase (`core_practices` #3) invented content not
present in the source; it was diagnosed via containment-score outlier detection (0.154 vs. the next
lowest 0.429) and the containment gate correctly rejected it. Left in the corpus as an honest
example rather than quietly fixed, because it demonstrates the gate catching a real fabrication.

---

## 3. Methods evaluated (`pilot_eval.py`)

All five baselines plus the method under test are implemented standalone with zero import
dependency on the demo-SOP pipeline or `app/demo_data`. **Correction (Phase X):** this
previously claimed zero dependency on production code at all, which was overstated in two
concrete ways, now fixed rather than just disclosed: (a) `embed_span` and `structural_margin`
depend on `app.rag.embedding_cache`'s configured dense model - a real, load-bearing coupling,
now made explicit and loud-failing instead of hidden behind a bare `except: pass`; (b) the
containment stopword list used to gate `structural`'s accept/reject decision was a separate,
independently-drifted 28-word copy of `app/rag/chunker.py`'s 24-word list - meaning the "same
0.60 threshold" this pilot and production both cite was actually being applied to two different
metrics. `pilot_eval.py` now imports `chunker._CONTAINMENT_STOPWORDS` and `chunker._containment`
directly rather than reimplementing them, so the threshold is genuinely shared. See
`pilot_eval.py`'s module docstring for the full, current dependency list.

1. **`quote`** — W3C-`TextQuoteSelector`-style: exact substring, then whitespace-normalized
   substring. This is what `_locate_span` in `app/rag/chunker.py` already does for verbatim content.
2. **`fuzzy`** — `difflib.SequenceMatcher` sliding window over the raw text.
3. **`embed_span`** — best-matching single line by cosine similarity, using the project's real
   dense embedding backend (bge-small-en-v1.5, confirmed active during every run in this log).
4. **`whole_doc`** — floor baseline: always returns the entire document.
5. **`structural`** — locate via the document's own numbering marker (regex, generalized from
   `_locate_step_by_number`), gated by **asymmetric lexical containment**
   (`_containment(a,b) = |tokens(a)∩tokens(b)| / |tokens(a)|`, paraphrase `a` against the located
   block `b`), threshold 0.60 — the design as it exists in production code today.
6. **`structural_margin`** — same marker-based location, but gated by **relative ranking**: the
   candidate must out-score every other real item in the same document for that paraphrase (strict
   inequality, no tuned margin constant). See §6.

**Metrics:** `coverage` (fraction resolved non-null), `localization_accuracy` (fraction of non-null
spans overlapping ground truth), `mean_iou` (intersection-over-union against ground truth — added
mid-pilot after a binary-overlap metric was found too permissive on wide ground-truth spans; see
§4), `false_anchor_rate` (of non-null, non-floor returns, the fraction that do NOT overlap ground
truth — the headline safety metric per the never-fabricate design principle: a confident wrong span
is worse than an abstention).

Reproduce any result in this document: `cd sop-guard/backend && python -m app.research.real_corpus.pilot_eval`
(also writes a timestamped JSON snapshot to `results/`, added in Phase X so runs are diffable
instead of only living in hand-transcribed tables like the ones below).

**A note on reproducibility of §4 and §5 specifically.** Those two sections record pilot runs
against smaller, earlier states of the corpus (24 pairs / 2 CDC docs, then 33 pairs / 4 docs) that
no longer exist as an isolated subset in `paraphrases.py` - the fixture has only ever grown, and
running `pilot_eval.py` today always evaluates the full current 38-pair / 5-document corpus. Their
tables are kept verbatim below as the historical narrative record (the falsified-hypothesis
finding in §5 is real and stands), but treat them as a written record, not something byte-for-byte
reproducible by re-running today's code - and note both fixes described in §8.1 postdate them, so
even the same subset would score slightly differently under current code. §8.1's corrected table is
the one that's actually reproducible right now.

---

## 4. Pilot 1 — CDC only, 24 pairs (2026-08-05)

| method | coverage | localization_acc | mean_iou | false_anchor_rate |
|---|---|---|---|---|
| `quote` | 0.0 | 0.0 | 0.0 | 0.0 |
| `fuzzy` | 0.875 | 0.75 | 0.34 | 0.143 |
| `embed_span` | 1.0 | 1.0 | 0.764 | 0.0 |
| `whole_doc` | 1.0 | 1.0 | 0.029 | 0.0 |
| `structural` | 0.667 | 0.667 | 0.666 | 0.0 |

**Finding:** on this pilot, `structural` (the method under test) has lower coverage and
localization accuracy than the `embed_span` baseline, though matching it on false-anchor safety
(0.0 both) and beating `fuzzy`'s 0.143 false-anchor rate. All 8 `structural` misses were diagnosed
individually: 7 are the containment gate correctly declining honest vocabulary substitution
("refreshed at least yearly" for source "annually as a refresher"); 1 is the item-3 fabrication
noted in §2. A methodology bug in the pilot itself was caught and fixed here too: `whole_doc`'s
binary-overlap accuracy of 1.0 was misleading (its ground-truth spans are wide multi-paragraph
blocks, so anything landing inside counts as "correct") — adding `mean_iou` correctly exposes it as
useless (0.029) despite the inflated binary number.

---

## 5. Pilot 2 — CDC + AHRQ, 33 pairs (2026-08-06)

Added specifically to test whether `structural`'s coverage disadvantage was an artifact of CDC's
short, mostly one-line recommendations under-sampling the method's intended target case (long,
heavily paraphrased content).

Full-corpus:

| method | coverage | mean_iou | false_anchor_rate |
|---|---|---|---|
| `structural` | 0.576 | 0.575 | 0.0 |
| `embed_span` | 1.0 | 0.812 | 0.0 |
| `fuzzy` | 0.697 | 0.279 | 0.13 |

Split by corpus (the number that actually answers the question):

| method | CDC coverage (n=24) | CDC IoU-when-fired | AHRQ coverage (n=9) | AHRQ IoU-when-fired |
|---|---|---|---|---|
| `structural` | 0.667 | 0.999 | **0.333** | 0.999 |
| `embed_span` | 1.0 | 0.764 | 1.0 | **0.943** |
| `fuzzy` | 0.875 | 0.388 | 0.222 | 0.526 |

**Finding — the hypothesis was falsified, not confirmed.** Coverage on the longer AHRQ items
*dropped to half* the CDC rate (33% vs. 67%), while `embed_span`'s coverage stayed perfect and its
precision-when-matched *improved* on the harder content (0.943 vs. 0.764 IoU). **Mechanism (not
speculation — this is what the data shows):** `structural`'s gate is a purely lexical overlap ratio,
and longer, more naturally-reworded paraphrases mechanically have lower token overlap with their
source than short ones, independent of semantic faithfulness. `embed_span` has no such penalty —
more content just gives cosine similarity more signal. When `structural` *does* clear its gate,
precision is excellent (IoU 0.999 on both corpora, zero false anchors throughout) — the mechanism
isn't broken, it's a lexical floor being asked to do a semantic job, and the mismatch gets worse
exactly where the method was designed to matter most.

---

## 6. Semantic-gate redesign attempts (2026-08-06)

Two designs, both calibrated on the full 33-pair corpus using real embeddings (not simulated), both
**failed** — with a shared, precisely diagnosed mechanism, not just a bad threshold pick.

**Attempt A — whole-block cosine similarity** in place of lexical containment. Calibrated against
1,767 real same-document negative pairs (every paraphrase vs. every *other* item's block in the
same document). No threshold separates the classes: correct-pair scores range 0.70–0.95 (median
0.839), but wrong-pair scores go as high as 0.886 — higher than most correct pairs' own true-match
scores. Best achievable threshold (0.70): recall 0.970, false-positive rate 10.4%.

**Attempt B — clause-level semantic containment** (closer structural analog to the original
metric), using the codebase's own already-calibrated 0.55 threshold from `app/rag/faithfulness_semantic.py`.
Worse than useless: 77% of all 1,767 wrong same-document pairs still scored a perfect 1.0,
indistinguishable from correct pairs.

**Mechanism:** every item within one clinical guideline document shares heavy domain vocabulary and
register ("catheter," "patient," "should," "indication"). General-purpose sentence embeddings pick
up that shared topical signal, so *within one document* they cannot reliably tell "this exact
recommendation" from "a different recommendation in the same document" — sibling-item semantic
variance is small relative to the embedding space's absolute similarity scale. This is consistent
with (not contradictory to) `embed_span`'s success: `embed_span` works by **relative ranking**
(argmax over every line in the document), which tolerates a compressed similarity range because the
true match only needs to be the best, not to clear an absolute floor in isolation. `structural`'s
design — locate one candidate, then accept/reject it against a fixed floor — is an **absolute-gate**
problem, exactly where this pilot shows embedding similarity breaks down. This mechanistic
conclusion directly motivated §7.

---

## 7. Relative-margin gate — `structural_margin` (2026-08-06)

**Design:** same marker-based location as `structural`, but the candidate must out-score every real
sibling item in the same document for that specific paraphrase — turning accept/reject into the
same relative comparison that makes `embed_span` work, while still anchoring provenance to a real
structural marker rather than a bare best-line guess. No tuned margin constant (strict inequality
only), deliberately, to avoid fitting a threshold to a 33-pair sample.

**Pre-registration check, done before trusting the aggregate number:** ranked the correct block
against all real sibling blocks for every one of the 33 pairs. The correct block was the argmax in
**33/33** cases, with a real positive margin every time (min 0.017, median 0.110) — not a
razor's-edge result inflated by a lucky threshold.

Full-pilot result:

| method | coverage | mean_iou | false_anchor_rate |
|---|---|---|---|
| `structural` (lexical gate) | 0.576 | 0.575 | 0.0 |
| `embed_span` | 1.0 | 0.812 | 0.0 |
| `structural_margin` (relative gate) | **1.0** | **0.999** | **0.0** |

Matches `embed_span` on coverage, matches the zero false-anchor rate, and **exceeds `embed_span` on
precision** (0.999 vs. 0.812 mean IoU) because it returns the exact marker-bounded block, not a
single best-matching line. This is a genuine, mechanistically-explained positive result — the first
one this whole pilot arc produced.

**Two honest limits, stated before this goes near a paper draft:**
1. n=33 is small, and 33/33 is exactly the number that most needs a bigger sample before being
   trusted as a headline claim.
2. This whole pilot's false-anchor metric, for *every* method, had only ever tested "pick the right
   item among the document's own real structured items" — never "reject a spurious non-item marker
   match" (a citation number, a dosage figure, a cross-reference that coincidentally matches the
   item_id regex). That's a real production threat this corpus's clean, hand-curated items hadn't
   exercised. §8 closes it.

---

## 8. Adversarial decoy test (2026-08-06)

Built specifically to close limitation 2 above: `adversarial_decoy_markers.txt` (synthetic,
labeled as such — see its own header), modeling a numbered-references-before-numbered-content
pattern already present in the other four documents. `corpus.py::_parse_adversarial_decoy_markers`
deliberately excludes the decoy References section from ground truth, so it exists purely as bait
for the methods under test — raw_text contains it, but it is never a correct answer.

Full-corpus result, 38 pairs / 5 documents:

| method | coverage | mean_iou | false_anchor_rate |
|---|---|---|---|
| `structural` (lexical gate) | 0.500 | 0.500 | **0.0** |
| `structural_margin` (relative gate) | 0.921 | 0.868 | **0.057** |

**The lexical gate passed cleanly** — bibliographic citation text shares almost no vocabulary with
clinical prose, so `_containment` correctly rejects every decoy. **The margin gate produced 2 false
anchors out of 5 adversarial pairs** (items #2 and #4).

**Diagnosed to its exact mechanism, not left as a bare rate:** the false anchors are not the decoy
beating the item's own real content (every decoy scored far below its own item's real text — e.g.
item #2's decoy scored 0.600 vs. the real text's 0.908). The actual bug is architectural:
`method_structural_margin`'s rival lookups reuse the *same* naive first-match marker search as the
primary candidate — so for every rival item_id in this document, the "rival" being compared against
is *also that rival's own decoy*, never its real content. The gate ends up comparing one
citation-noise block against four other near-identical citation-noise blocks, and whichever happens
to sit marginally closer in embedding space to the current paraphrase wins by chance. Items #1, #3,
#5 were correctly rejected (a rival's decoy happened to outscore); items #2 and #4 were wrongly
accepted purely because their own decoy happened to be the arbitrary local winner among noise.

**Conclusion:** the margin gate's safety guarantee is only as good as the candidate-location step
feeding it, on *both* sides of the comparison. A systemic decoy pattern corrupts the entire rival
pool the same way it corrupts the primary search, and a relative comparison between two corrupted
signals is not a safety property. The real fix needs to teach the *location* step to recognize real
content (e.g., a structural cue like "does this occur after a References/Bibliography heading," or
a minimum recommendation-language signal on the candidate line) — not just the accept/reject gate
sitting on top of it. This is flagged as unbuilt future work, not attempted yet (see §9).

### 8.1 Corrected re-run (Phase X, 2026-08-15)

Two real bugs in `pilot_eval.py` were found and fixed, and every table above predates both:

1. **`localization_accuracy` divided by all pairs, not non-null spans**, contradicting its own
   documented definition ("fraction of non-null spans overlapping ground truth" — §3, §4). For a
   method with zero false anchors (like `structural` in every table above), this silently made
   `localization_accuracy` numerically identical to `coverage` by construction — it was never
   actually measuring precision-when-it-fires as a distinct number from how often it fires.
2. **Two different stopword lists were governing the same "0.60 containment" threshold** — see §3's
   correction above. Unifying them onto `chunker.py`'s real list changes which paraphrases clear the
   `structural` gate.

Both fixes change real numbers, not just bookkeeping. Full corrected run, same 38-pair / 5-document
corpus as §8 above, `corpus_hash 41d45128b1f9`, `embedding_model BAAI/bge-small-en-v1.5`:

| method | coverage | localization_accuracy | mean_iou | false_anchor_rate |
|---|---|---|---|---|
| `quote` | 0.0 | 0.0 | 0.0 | 0.0 |
| `fuzzy` | 0.737 | 0.893 | 0.346 | 0.107 |
| `embed_span` | 1.0 | 1.0 | 0.837 | 0.0 |
| `whole_doc` | 1.0 | 1.0 | 0.08 | 0.0 |
| `structural` (lexical gate) | **0.526** | **1.0** | 0.526 | 0.0 |
| `structural_margin` (relative gate) | 0.921 | 0.943 | 0.868 | 0.057 |

What actually moved and why, stated plainly rather than left for a reader to notice:

- **`structural`'s coverage moved from 0.500 to 0.526** (one more pair now clears the containment
  gate) — a direct, real effect of unifying the stopword list, not noise. `false_anchor_rate` and
  `mean_iou`-when-it-fires are unaffected: the method is exactly as precise as before, it just now
  fires on slightly more of the corpus.
- **`structural`'s `localization_accuracy` is now genuinely reported as 1.0, decoupled from its
  0.526 coverage**, correcting the conflation bug above. This is the more important correction:
  the headline claim for `structural` was always "when it answers, it's right" (precision) plus a
  separate, honest "it doesn't always answer" (coverage) — the bug had those two numbers silently
  collapsed into one.
- `structural_margin`'s numbers are unchanged (0.921 / 0.943 / 0.868 / 0.057) — its coverage gate
  doesn't use the containment stopword list at all (it's a relative-ranking comparison, not a
  lexical-overlap threshold), so neither fix touches it. This is expected, not a null result to
  worry about.
- `embed_span`, `whole_doc`, `quote`, `fuzzy` are all unaffected by either fix, as expected — none
  of them call `_containment` or depend on the `localization_accuracy` denominator changing their
  own non-null rate.

Raw per-pair JSON for this run: `results/pilot_run_20260815T184348Z.json`.

---

## 9. What this project has vs. what a real paper submission needs

**Have, as of this log:**
- A working, standalone, reproducible evaluation harness (`pilot_eval.py`) with zero dependency on
  the production pipeline, so results here can't silently drift with app code changes.
- A real (not synthetic), multi-agency, provenance-documented corpus with genuinely messy real-world
  properties (duplicate IDs, reconstructed HTML list numbering, nested numbering collisions).
- Two honest positive-and-negative result arcs, each with a diagnosed mechanism, not just a number:
  (a) the original lexical gate loses coverage on longer paraphrases, and why; (b) two semantic-gate
  redesigns failed, and why; (c) the relative-margin gate works on clean data, verified two ways
  before trusting it; (d) the same gate has a real, precisely diagnosed limitation under adversarial
  decoy conditions.
- A prior-art check that already killed one over-claim (`offset_anchor` vs. the W3C Web Annotation
  Data Model) before it could contaminate a paper draft.

**Do NOT have yet — needed before a real submission:**
1. **Scale.** Target from the original plan: 30–60 documents, thousands of Tier-A pairs, a
   document-disjoint dev/test split. Currently 5 documents, 38 pairs. The **infrastructure** for
   scale is now built (Phase X): `corpus._REGISTRY` collapses document registration to one
   validated entry per doc_id (previously two dicts that could silently drift), and
   `paraphrases.split_dev_test()` / `assert_document_disjoint()` give every pair a `tier` and a
   real document-disjoint dev/test split, tested in `tests/test_research_corpus_split.py`. What's
   still missing is the **data**: acquiring 25-55 more real documents. A real, reproducible blocker
   was hit attempting this in the same session the infrastructure was built: three independent
   fetch attempts at CDC field-triage guidance (cdc.gov direct, the MMWR HTML mirror, and a PMC
   mirror) each failed - two 403s and one reCAPTCHA wall - matching this file's own earlier note
   that "direct automated fetches of both agencies' own HTML pages 403'd in practice" and that PDF
   fetches / NCBI Bookshelf mirrors worked better for the AHRQ documents already in this corpus.
   A fourth attempt against a guessed NASEMSO PDF URL also 403'd, so the blocker isn't
   cdc.gov-specific - automated WebFetch against these classes of government/association sites is
   unreliable across at least two hosts here. Acquiring the remaining documents needs a session
   with a different fetch mechanism (a real browser session, or manual download by the person
   running this) rather than more guessed URLs against the same automated fetch path.
2. **Tier B (hand-verified, non-self-authored paraphrases).** All 38 pairs here are Tier A
   (hand-authored by one person, not model-generated, not independently verified). The
   synthetic-vs-real RAG evaluation literature (see `2508.11758`, cited in the original plan)
   specifically warns that self-constructed evaluation data tends to be easier than real data —
   Tier B exists to test that threat directly and hasn't been built.
3. **The decoy-robust location fix** described in §8's conclusion — unbuilt. Without it,
   `structural_margin` cannot honestly be claimed as false-anchor-safe in documents containing
   reference lists or other numbered noise, which is most real government guideline PDFs.
4. **A held-out threshold/design freeze.** Every design choice in this log (0.60 containment,
   strict-inequality margin, 0.55 clause threshold) was calibrated and evaluated on the *same* 33–38
   pairs. None of it has been tested on data not used to develop it.
5. **Related work write-up** — the citation list from the original plan (W3C Web Annotation Data
   Model, ALCE, AIS, the 2508.11758 synthetic-RAG paper, the EACL 2026 abstention paper) is compiled
   but not yet engaged with in prose.
6. **A decision on the paper's actual claim**, now that the evidence is in: the honest options,
   per this log, are (a) rebuild the location step to be decoy-robust and re-test before claiming
   anything, (b) frame the contribution around `structural_margin`'s precision advantage over
   embeddings as a complement rather than a replacement, explicitly scoped to documents without
   heavy numbered-reference noise, or (c) report the whole arc — including the two failed
   semantic-gate designs and the adversarial limitation — as the contribution itself (a
   methodology/evaluation paper about anchoring paraphrased content, not a "here is a method that
   wins" paper). No decision has been made; this log intentionally leaves that choice open for
   whoever picks this up next.

**Where the code lives:** `app/research/real_corpus/{corpus.py, paraphrases.py, pilot_eval.py, raw/*.txt}`.
Nothing here is imported by or coupled to RAEY's production pipeline (`app/rag/`,
`app/demo_data/`) — it is a self-contained research module by design, and should stay that way so
this evaluation can never be silently invalidated by an unrelated app change, and so the production
app can never accidentally depend on research-only code.
