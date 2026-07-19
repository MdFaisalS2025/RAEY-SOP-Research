"""
Tests for the abstention gate (EvidenceSufficiencyChecker + the mock
generator's own relevance floor).

Calibration note (read before changing thresholds): this corpus does not
have a single relevance-score cutoff that cleanly separates "genuinely
out of scope" from "genuinely in scope but weakly retrieved" queries.
Verified directly against the live query pipeline (plain TF-IDF, no
reranker - see hybrid_retriever.py for why): an off-topic oncology query
scored 0.165 top-chunk relevance, which is *higher* than several
genuinely in-scope queries in the same eval set (0.088, 0.153, 0.160).
There is no threshold that catches that oncology query without also
rejecting those legitimate ones.

The 0.05 floor here is deliberately modest: it only catches near-zero
relevance (queries with essentially no lexical overlap with the corpus
at all), which is real but narrow protection. Don't raise this threshold
to try to close the moderate-relevance gap; the score distributions
above show it will just break legitimate weak queries without reliably
catching the harder OOS cases.

The entity_grounding check (see TestEvidenceSufficiencyChecker's
test_named_entity_* tests) is the "different signal" this note used to
say wasn't implemented: it flags queries that name a specific lexicon
drug/condition absent from the retrieved text, independent of the
generic keyword-overlap score. It's narrow by design - it only fires
when the query names something from entity_graph's ~70-term lexicon, so
it doesn't cover every wrong-domain query, but it catches cases the
keyword-overlap check misses (shared generic words masking a missing
named entity).
"""

import pytest

from app.rag.evidence_sufficiency import EvidenceSufficiencyChecker
from app.rag.generator import MockGenerator, _MIN_RELEVANCE


@pytest.fixture
def checker():
    return EvidenceSufficiencyChecker()


def _chunk(score: float, text: str = "sepsis lactate vasopressor norepinephrine dose threshold") -> dict:
    return {"chunk_text": text, "text": text, "relevance_score": score, "chunk_type": "threshold"}


class TestEvidenceSufficiencyChecker:
    def test_very_low_relevance_is_insufficient(self, checker):
        """A near-zero top score (the old 0.005 floor let this through) must fail."""
        chunks = [_chunk(0.01)]
        result = checker.check("unrelated off-topic question", chunks, "general")
        assert result["sufficient"] is False

    def test_strong_relevance_and_overlap_is_sufficient(self, checker):
        chunks = [_chunk(0.3, "sepsis lactate threshold monitoring")]
        result = checker.check(
            "What lactate level indicates severe sepsis?", chunks, "threshold"
        )
        assert result["sufficient"] is True

    def test_no_chunks_is_insufficient(self, checker):
        result = checker.check("anything", [], "general")
        assert result["sufficient"] is False
        assert result["score"] == 0.0

    def test_named_entity_absent_from_evidence_is_flagged(self, checker):
        """
        CRAG-style signal: the query names a specific lexicon drug
        (vancomycin) that never appears in the retrieved text, even though
        the chunks share enough generic words to pass keyword overlap.
        """
        chunks = [_chunk(0.3, "dose threshold monitoring management protocol")]
        result = checker.check("What is the vancomycin dose threshold?", chunks, "threshold")
        names = [c["name"] for c in result["checks"]]
        assert "entity_grounding" in names
        entity_check = next(c for c in result["checks"] if c["name"] == "entity_grounding")
        assert entity_check["passed"] is False

    def test_named_entity_present_in_evidence_passes(self, checker):
        chunks = [_chunk(0.3, "vancomycin dose threshold monitoring")]
        result = checker.check("What is the vancomycin dose threshold?", chunks, "threshold")
        entity_check = next(c for c in result["checks"] if c["name"] == "entity_grounding")
        assert entity_check["passed"] is True

    def test_query_with_no_lexicon_entity_skips_check(self, checker):
        chunks = [_chunk(0.3, "documentation timing requirements signature checklist")]
        result = checker.check("When must the checklist be signed?", chunks, "general")
        names = [c["name"] for c in result["checks"]]
        assert "entity_grounding" not in names

    def test_entity_present_via_chunk_level_clinical_entities_not_literal_text(self, checker):
        """Real bug (P1.1): a bucket-style 'Clinical Thresholds' chunk lists
        '2.0-3.0: INR target (DVT/PE/AFib)' without repeating the drug name
        'warfarin' anywhere in that chunk's own text - even though the chunk
        indisputably belongs to the Anticoagulation SOP, which chunker.py
        now tags with SOP-level clinical_entities at index time. The
        entity-grounding check must accept that as grounding, not just a
        literal substring match in the chunk text."""
        chunk = _chunk(0.5, "INR target (DVT/PE/AFib): 2.0-3.0")
        chunk["clinical_entities"] = ["warfarin", "heparin"]
        result = checker.check("What is the target INR for warfarin?", [chunk], "threshold")
        entity_check = next(c for c in result["checks"] if c["name"] == "entity_grounding")
        assert entity_check["passed"] is True

    def test_chunk_level_entities_do_not_ground_an_unlisted_drug(self):
        """The chunk-level entity list only grounds drugs it actually
        contains - it isn't a wildcard that grounds anything."""
        chunk = _chunk(0.5, "INR target (DVT/PE/AFib): 2.0-3.0")
        chunk["clinical_entities"] = ["warfarin"]
        checker = EvidenceSufficiencyChecker()
        result = checker.check("What is the vancomycin dose?", [chunk], "threshold")
        entity_check = next(c for c in result["checks"] if c["name"] == "entity_grounding")
        assert entity_check["passed"] is False


class TestMockGeneratorAbstention:
    def test_abstains_and_flags_when_no_chunk_clears_relevance_floor(self):
        """
        Regression test for a real bug: the mock generator's own abstention
        decision (no chunk above _MIN_RELEVANCE) must be reflected in the
        returned "abstained" flag. It previously wasn't propagated by the
        caller in one code path, so a query the mock generator correctly
        refused to answer could still be reported as a confident,
        non-abstained response depending on which branch handled it.
        """
        gen = MockGenerator()
        chunks = [{"sop_title": "Unrelated Protocol", "chunk_text": "irrelevant text",
                   "relevance_score": _MIN_RELEVANCE / 2}]
        result = gen.generate_answer("some off-topic question", chunks, "general")
        assert result["abstained"] is True
        assert result["confidence"] <= 0.1

    def test_does_not_abstain_when_a_chunk_clears_the_floor(self):
        gen = MockGenerator()
        chunks = [{"sop_title": "Sepsis Management Protocol", "chunk_text": "Lactate >2 mmol/L triggers repeat measurement.",
                   "relevance_score": _MIN_RELEVANCE + 0.05}]
        result = gen.generate_answer("What lactate level triggers repeat measurement?", chunks, "threshold")
        assert result["abstained"] is False


class TestSemanticRelevanceGate:
    """
    Hard gate fed by the real cross-encoder score (app/rag/reranker.py's
    CrossEncoderReranker), attached to chunks as `rerank_score` by
    pipeline.py before the sufficiency check runs. Catches same-token,
    different-domain confusions (e.g. "heat stroke" vs. a SOP about
    cerebrovascular stroke) that lexical/embedding-cosine overlap and the
    ~70-term entity_grounding lexicon both miss. See the diagnostic run
    referenced in evidence_sufficiency.py's min_semantic_relevance default
    for the real score distribution this threshold was calibrated against.
    """

    def test_absent_rerank_score_skips_check(self, checker):
        """Backward compatible: chunks without rerank_score (e.g. any test
        or code path that doesn't run the cross-encoder) leave this check
        inactive rather than failing closed."""
        chunks = [_chunk(0.3)]
        result = checker.check("What is the vasopressor dose threshold?", chunks, "threshold")
        names = [c["name"] for c in result["checks"]]
        assert "semantic_relevance" not in names

    def test_low_rerank_score_hard_gates_insufficient(self, checker):
        """A confidently topic-mismatched candidate (e.g. 'heat stroke'
        scored against a cerebrovascular-stroke SOP) must veto sufficiency
        even when other soft signals pass."""
        chunk = _chunk(0.3, "stroke protocol door-to-CT target time thrombolysis")
        chunk["rerank_score"] = -6.5
        result = checker.check("What is the protocol for heat stroke?", [chunk], "procedure_steps")
        check = next(c for c in result["checks"] if c["name"] == "semantic_relevance")
        assert check["passed"] is False
        assert result["sufficient"] is False

    def test_high_rerank_score_passes(self, checker):
        chunk = _chunk(0.3, "sepsis lactate vasopressor norepinephrine dose threshold")
        chunk["rerank_score"] = 5.0
        result = checker.check(
            "What are the steps for sepsis management?", [chunk], "procedure_steps"
        )
        check = next(c for c in result["checks"] if c["name"] == "semantic_relevance")
        assert check["passed"] is True

    def test_uses_max_score_among_top_candidates(self, checker):
        """One strong candidate among several weak ones should still pass -
        the gate looks at the best evidence, not the average."""
        weak1 = _chunk(0.3, "irrelevant filler text")
        weak1["rerank_score"] = -8.0
        weak2 = _chunk(0.3, "more irrelevant filler")
        weak2["rerank_score"] = -7.0
        strong = _chunk(0.3, "sepsis lactate vasopressor norepinephrine dose threshold")
        strong["rerank_score"] = 4.0
        result = checker.check(
            "What are the steps for sepsis management?", [weak1, weak2, strong], "procedure_steps"
        )
        check = next(c for c in result["checks"] if c["name"] == "semantic_relevance")
        assert check["passed"] is True
        assert check["value"] == 4.0

    def test_dominant_but_below_floor_score_still_passes(self, checker):
        """Real regression: 'What should a nurse monitor after central
        line insertion?' scored -2.23 against the correct SOP (below the
        -2.0 absolute floor) purely because of its short, monitoring-style
        phrasing - not because it's off-topic. When every other candidate
        in the top-5 belongs to a clearly different, unrelated SOP and
        scores far worse, that decisive dominance is itself evidence of
        genuine relevance and should rescue the match."""
        chunk = _chunk(0.3, "central line insertion site monitoring dressing change")
        chunk["rerank_score"] = -2.23
        chunk["sop_id"] = "central-line"
        rival1 = _chunk(0.3, "unrelated discharge planning content")
        rival1["rerank_score"] = -11.2
        rival1["sop_id"] = "discharge"
        rival2 = _chunk(0.3, "unrelated blood transfusion content")
        rival2["rerank_score"] = -11.0
        rival2["sop_id"] = "transfusion"
        result = checker.check(
            "What should a nurse monitor after central line insertion?",
            [chunk, rival1, rival2], "monitoring",
        )
        check = next(c for c in result["checks"] if c["name"] == "semantic_relevance")
        assert check["passed"] is True

    def test_narrow_margin_below_floor_still_hard_gates(self, checker):
        """Guard against re-breaking the original bug: 'heat stroke' scored
        -3.0 against a cerebrovascular-stroke SOP, only narrowly ahead of a
        different SOP at -6.45. A narrow margin must NOT be treated as
        dominance - the dominance fallback requires a wide, decisive gap,
        not merely being the least-bad candidate."""
        chunk = _chunk(0.3, "stroke protocol door-to-CT target time thrombolysis")
        chunk["rerank_score"] = -3.0
        chunk["sop_id"] = "code-stroke"
        rival = _chunk(0.3, "cardiac arrest resuscitation protocol")
        rival["rerank_score"] = -6.45
        rival["sop_id"] = "code-blue"
        result = checker.check(
            "What is the protocol for heat stroke?", [chunk, rival], "procedure_steps",
        )
        check = next(c for c in result["checks"] if c["name"] == "semantic_relevance")
        assert check["passed"] is False
        assert result["sufficient"] is False

    def test_low_absolute_score_not_rescued_even_with_no_rivals(self, checker):
        """The dominance fallback still requires a floor - a single weak
        candidate with no competing SOP in the top-5 must not be rescued
        just because nothing else was retrieved."""
        chunk = _chunk(0.3, "irrelevant unrelated content")
        chunk["rerank_score"] = -11.2
        chunk["sop_id"] = "patient-flow"
        result = checker.check(
            "What is the cafeteria menu?", [chunk], "general",
        )
        check = next(c for c in result["checks"] if c["name"] == "semantic_relevance")
        assert check["passed"] is False

    def test_gray_zone_score_with_no_rivals_is_not_trivially_dominant(self, checker):
        """Real regression (P2.5): 'What is the protocol for heat stroke?'
        retrieved 5 candidates that were ALL from Code Stroke Response
        Protocol (no rival SOP represented at all in the top-5), with a
        best score of -3.0 - inside the -6.0..-2.0 gray zone, below the
        absolute floor but above the dominance floor. Because rival_scores
        was empty, margin defaulted to infinity and trivially passed,
        letting an off-topic query (heat stroke != cerebrovascular stroke)
        confidently match the wrong SOP. No rivals present must mean the
        dominance fallback does not apply, not that it auto-passes."""
        chunk = _chunk(0.3, "code stroke door-to-ct door-to-needle thrombolysis")
        chunk["rerank_score"] = -3.0
        chunk["sop_id"] = "code-stroke"
        result = checker.check(
            "What is the protocol for heat stroke?", [chunk], "general",
        )
        check = next(c for c in result["checks"] if c["name"] == "semantic_relevance")
        assert check["passed"] is False


class TestCorpusVocabularyCoverage:
    """
    Cheaper interim signal for out-of-scope queries that name nothing from
    the drug/condition lexicon (so entity_grounding never fires) - checks
    whether the query's content words appear anywhere in the WHOLE indexed
    corpus, not just the top-5 retrieved chunks (keyword_overlap's scope).
    """

    def test_disabled_when_no_corpus_vocabulary_given(self):
        checker = EvidenceSufficiencyChecker()  # no corpus_vocabulary
        chunks = [_chunk(0.3)]
        result = checker.check("What is the chemotherapy dose for lung cancer staging?", chunks, "general")
        names = [c["name"] for c in result["checks"]]
        assert "corpus_vocabulary_coverage" not in names

    def test_flags_query_whose_vocabulary_is_absent_from_corpus(self):
        vocab = {"sepsis", "lactate", "vasopressor", "norepinephrine", "dose", "threshold", "management"}
        checker = EvidenceSufficiencyChecker(corpus_vocabulary=vocab)
        chunks = [_chunk(0.3)]
        result = checker.check("What is the chemotherapy dose for lung cancer staging?", chunks, "general")
        check = next(c for c in result["checks"] if c["name"] == "corpus_vocabulary_coverage")
        assert check["passed"] is False

    def test_passes_query_whose_vocabulary_matches_corpus(self):
        vocab = {"sepsis", "lactate", "vasopressor", "norepinephrine", "dose", "threshold", "management"}
        checker = EvidenceSufficiencyChecker(corpus_vocabulary=vocab)
        chunks = [_chunk(0.3)]
        result = checker.check("What is the norepinephrine dose threshold for sepsis management?", chunks, "threshold")
        check = next(c for c in result["checks"] if c["name"] == "corpus_vocabulary_coverage")
        assert check["passed"] is True

    def test_is_a_soft_signal_not_a_hard_gate(self):
        """
        Unlike entity_grounding, failing this check alone must not flip
        sufficient to False when everything else passes - it's one vote,
        not a veto (see the calibration note at the top of this file for
        why single signals here can't be treated as decisive).
        """
        vocab = {"sepsis", "lactate", "vasopressor", "norepinephrine", "dose", "threshold", "management"}
        checker = EvidenceSufficiencyChecker(corpus_vocabulary=vocab)
        chunks = [_chunk(0.3, "sepsis lactate vasopressor norepinephrine dose threshold management")]
        result = checker.check("What is the chemotherapy staging protocol?", chunks, "general")
        check = next(c for c in result["checks"] if c["name"] == "corpus_vocabulary_coverage")
        assert check["passed"] is False
        # Overlap and relevance still pass since the chunk text matches the
        # query's shared words ("chemotherapy staging protocol" isn't fully
        # disjoint) - this test only asserts the mechanism (soft vote),
        # not a specific sufficient/insufficient outcome.


class TestMedicationChunkTypeMatch:
    """
    Phase B.2: chunk_type_match (check 4) already required threshold/
    contraindication/step chunks for those three query types, but never
    checked "medication" at all - a real gap, since dose/drug questions
    are exactly the case the plan calls out ("dose question -> require a
    threshold/medication chunk"). There's no dedicated chunk_type for
    medication content; dosing/admin/contraindication chunks all count.
    """

    def test_medication_query_with_only_summary_chunks_fails_type_match(self, checker):
        chunks = [{
            "chunk_text": "Sepsis Management Protocol overview: recognize, resuscitate, reassess.",
            "text": "Sepsis Management Protocol overview: recognize, resuscitate, reassess.",
            "relevance_score": 0.3, "chunk_type": "summary",
        }]
        result = checker.check("What norepinephrine dose is used?", chunks, "medication")
        check = next(c for c in result["checks"] if c["name"] == "chunk_type_match")
        assert check["passed"] is False

    def test_medication_query_with_threshold_chunk_passes_type_match(self, checker):
        chunks = [_chunk(0.3, "norepinephrine 0.05 mcg/kg/min titrate to 3 mcg/kg/min")]
        result = checker.check("What norepinephrine dose is used?", chunks, "medication")
        check = next(c for c in result["checks"] if c["name"] == "chunk_type_match")
        assert check["passed"] is True

    def test_medication_query_with_contraindication_chunk_passes_type_match(self, checker):
        chunks = [{
            "chunk_text": "Hold warfarin if INR exceeds 4.0 or active bleeding is present.",
            "text": "Hold warfarin if INR exceeds 4.0 or active bleeding is present.",
            "relevance_score": 0.3, "chunk_type": "contraindication",
        }]
        result = checker.check("When should warfarin be held?", chunks, "medication")
        check = next(c for c in result["checks"] if c["name"] == "chunk_type_match")
        assert check["passed"] is True

    def test_other_query_types_unaffected_by_medication_branch(self, checker):
        """The new elif must not change behavior for query types it doesn't apply to."""
        chunks = [_chunk(0.3, "sepsis lactate threshold monitoring")]
        result = checker.check("What lactate level indicates severe sepsis?", chunks, "general")
        check = next(c for c in result["checks"] if c["name"] == "chunk_type_match")
        assert check["passed"] is True
        assert "checks" in result
