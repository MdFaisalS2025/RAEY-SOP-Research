# Reproducibility artifact: cross-edition provenance for revised protocol documents

Standalone reproducibility package for the study governed by
`PREREGISTRATION.md` (frozen hypotheses/methods, append-only deviations
log) and `FEASIBILITY.md` (full research narrative, numbered sections
§1–§63 at time of writing). Extracted from a larger, unrelated
application codebase (`sop-guard`) so a reviewer does not need the whole
product repository to check this study's code and results.

## What's here

```
PREREGISTRATION.md       Frozen study design + dated deviations log (source of truth)
FEASIBILITY.md           Full narrative: every finding, numbered sections
CORPUS_MANIFEST.md        Every source document: URL, retrieval note, SHA-256 hash
requirements.txt          Third-party dependencies
code/
  app/research/cross_edition/
    corpus_probe.py        FROZEN pipeline (pinned SHA d3068ee, see PREREGISTRATION.md header)
    item_parser.py          FROZEN
    edition_align.py        FROZEN
    item_align.py            FROZEN
    item_align_v2.py        Post-hoc T2-tier fix (FEASIBILITY.md §57), NOT frozen
    baseline_b1_b3_b4.py    B1/B3/B4 baselines
    baseline_b2.py          B2 baseline (text-only, global search)
    baseline_b5.py          B5 baseline (embeddings, post-hoc)
    uscode_corpus.py         Second-domain (US Code) corpus builder
    structure_ablation.py    Structure-quality degradation experiment (§61)
    run_uscode_experiment.py Second-domain replication (§63)
    unmatched_probe.py       T6 tail decomposition
    annotation.py            Sampling, packet generation, kappa/Fleiss' kappa
    annotation_packets/      Every driver script + its data + its result JSON,
                              co-located because the scripts locate sibling data
                              by relative path (Path(__file__).parent / ...)
  app/rag/embeddings.py     B5's only dependency outside cross_edition/
```

## Which files are FROZEN and why that matters

Four files (`corpus_probe.py`, `item_parser.py`, `edition_align.py`,
`item_align.py`) are pinned at commit `d3068ee` and were never modified
after the study's confirmatory phase began — every other file in this
repository was extended freely. This is the entire empirical basis for
trusting the confirmatory results: nothing in the matching *logic* was
ever tuned in response to test-document content. Verify this claim
yourself if you have the full git history:

```bash
git diff --name-only d3068ee..HEAD -- '*/cross_edition/corpus_probe.py' \
  '*/cross_edition/item_parser.py' '*/cross_edition/edition_align.py' \
  '*/cross_edition/item_align.py'
# must print nothing
```

This artifact directory doesn't carry git history (it's a flat export),
so that check is only runnable against the source repository — but the
four files here were copied byte-for-byte and diffed against the source
repository's copies as part of building this artifact (see the commit
message that added this directory).

## Setup

```bash
pip install -r requirements.txt
```

`sentence-transformers` downloads `BAAI/bge-small-en-v1.5` (~130 MB) on
first use for the B5 baseline. Everything else runs with no network
access once the corpus is downloaded (see `CORPUS_MANIFEST.md`).

## Reproducing a result

1. Download the source documents per `CORPUS_MANIFEST.md`, verify hashes.
2. Each script under `code/app/research/cross_edition/` and its
   `annotation_packets/` subdirectory documents its own run command and
   any path constants that need pointing at your local corpus copy — read
   the module docstring at the top of the script you want to run.
3. Most `annotation_packets/run_*.py` scripts insert `code/` onto
   `sys.path` themselves (`sys.path.insert(0, str(Path(__file__)...))`) —
   run them from anywhere with `python -m app.research.cross_edition...`
   after `cd`-ing into `code/`, or adjust the path insertion to match
   your layout.
4. Result JSONs already present in `annotation_packets/*.json` are the
   actual outputs this study reports — re-running should reproduce them
   exactly (all scripts fix their random seeds; see each script's header).
   `structure_ablation.py`'s r=0 case reproducing `FEASIBILITY.md` §53.1's
   75.12% exactly is the single most load-bearing sanity check in the
   whole pipeline, and is checked automatically at the start of that
   script's run.

## What is NOT in this artifact

- Source PDFs/XML themselves (see `CORPUS_MANIFEST.md` — download and
  verify by hash instead; keeps this artifact's size reasonable and
  avoids redistributing large third-party government publications
  wholesale).
- The unrelated `sop-guard` application this research lived alongside.
  Nothing in this artifact depends on it beyond the one `app/rag/embeddings.py`
  module copied in above.
- The paper draft itself (not yet written at the time this artifact was
  assembled).

## Annotation data

`annotation_packets/*/annotation_packet.csv` + `annotation_context.json`
are the blind annotator-facing materials (method predictions withheld,
matching `PREREGISTRATION.md` §5.3's blind design). The completed
annotator workbooks (`Annotator_A/`, `Annotator_B/`, etc.) contain typed
judgments only — no personal information beyond the annotator letter
label used throughout this study.

**Known limitation, disclosed rather than hidden**: the original 4-rater
round (`PREREGISTRATION.md`'s 2026-08-18 CRITICAL CORRECTION entry) was
found to be two duplicated 2-annotator pairs, not four independent
raters — corrected in place to the genuine 2-annotator design (Cohen's
κ = 0.8168), with no change to any downstream ground truth or metric
(every disagreement was already independently adjudicated regardless of
believed rater count). Read that entry before citing this study's
inter-annotator agreement figures.
