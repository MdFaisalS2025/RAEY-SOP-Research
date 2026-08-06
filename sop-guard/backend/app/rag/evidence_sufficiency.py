"""
Meridian Evidence Sufficiency Checker
Determines if retrieved evidence is adequate to answer safely.
Research prototype. Not for clinical use.
"""

import re
from typing import Any
import logging

from app.rag.entity_graph import DRUG_LEXICON, CONDITION_LEXICON

logger = logging.getLogger(__name__)

# Sorted longest-first so multi-word entries (e.g. "septic shock") match
# before their single-word substrings (e.g. "shock").
_LEXICON_ENTITIES = sorted(set(DRUG_LEXICON) | set(CONDITION_LEXICON), key=len, reverse=True)
_LEXICON_PATTERNS = [(name, re.compile(r"\b" + re.escape(name) + r"\b")) for name in _LEXICON_ENTITIES]


def _extract_lexicon_entities(query: str) -> list[str]:
    """Find known drug/condition names mentioned in the query text."""
    low = query.lower()
    return [name for name, pattern in _LEXICON_PATTERNS if pattern.search(low)]


_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "to", "of",
    "in", "on", "for", "and", "or", "this", "that", "it", "with", "as", "at",
    "by", "from", "should", "must", "will", "what", "when", "how", "does",
    "can", "could", "would", "you", "your", "which", "who", "why", "there",
}


def confidence_tier(score: float) -> str:
    """Labels the checker's 0-1 `score` (fraction of sufficiency checks
    passed) into a physician-readable band for explainability - shown in
    Trust Details / the pipeline trace rather than a bare number.

    Not calibrated the way min_semantic_relevance/semantic_dominance_*
    below are (measured score distributions from real matched-vs-mismatched
    queries) - `score` here is a discrete pass-count fraction (5, 6, or 7
    checks depending on which conditional checks fired for a given query -
    see `check()`), not a continuous similarity score, so there's no
    distribution to separate. These boundaries are a display/explainability
    policy choice, not a measured discriminator: roughly "5 or 6 of 6-7
    checks" reads as High, "about 2 in 3" as Moderate, "about 2 in 5" as
    Weak. A consequence worth knowing: because `total` varies per query, the
    same literal number of failed checks can land in a different tier
    depending on how many checks ran - e.g. 1 failure out of 6 (0.833)
    reads as Moderate, but 1 failure out of 7 (0.857) reads as High. This
    doesn't affect the real sufficiency gate (`sufficient` in check() below,
    which is score plus hard gates, not this label), only the tier text
    shown to the reader.
    """
    if score >= 0.85:
        return "High Confidence"
    if score >= 0.65:
        return "Moderate Confidence"
    if score >= 0.40:
        return "Weak Match"
    return "No Reliable Match"


def build_corpus_vocabulary(chunks: list[dict[str, Any]]) -> set[str]:
    """
    Content-word vocabulary across the entire indexed corpus (not just the
    top-K retrieved chunks). Used for a cheap, corpus-wide "does this query
    use vocabulary that appears ANYWHERE in what we've indexed" signal -
    complementary to keyword_overlap, which only compares against the top
    5 retrieved chunks and can't tell "weakly related to the top match"
    apart from "unrelated to the entire corpus".
    """
    vocab: set[str] = set()
    for c in chunks:
        text = c.get("text") or c.get("chunk_text") or ""
        vocab.update(w for w in re.findall(r"[a-z]{3,}", text.lower()) if w not in _STOPWORDS)
    return vocab


class EvidenceSufficiencyChecker:
    """
    Checks whether retrieved chunks provide enough evidence to answer a query.
    If evidence is insufficient, the system should refuse rather than guess.
    """

    def __init__(
        self,
        min_chunks: int = 1,
        # Matches the _MIN_RELEVANCE floor in rag/generator.py so both gates
        # agree on what counts as "not actually relevant". Only catches
        # near-zero relevance (0.005 let essentially anything through) - see
        # the long comment on _MIN_RELEVANCE for why a single score
        # threshold can't reliably separate wrong-domain queries from
        # weakly-matched legitimate ones in this corpus.
        min_top_score: float = 0.05,
        min_keyword_overlap: float = 0.15,
        corpus_vocabulary: set[str] | None = None,
        min_corpus_vocabulary_coverage: float = 0.34,
        # Calibrated empirically against app/rag/reranker.py's
        # CrossEncoderReranker (cross-encoder/ms-marco-MiniLM-L-6-v2) output
        # on this corpus - raw logits, not a 0-1 probability, so this is
        # NOT comparable to the other 0-1 thresholds above. Real measured
        # values (see the diagnostic run this was calibrated from): true
        # topic-mismatch queries ("heat stroke" vs. Code Stroke Response
        # Protocol - shares the literal token but is a different condition;
        # "jellyfish sting"/"kitchen faucet"/"broken elevator"/"cafeteria
        # menu") scored -3.0 to -11.2. Most legitimate in-corpus queries
        # score +0.68 to +8.9, comfortably above this floor - but short,
        # monitoring-style phrasings of a genuinely correct match can score
        # as low as -3.1, directly overlapping the "heat stroke" case. See
        # the semantic_dominance_floor/_margin fallback below for how that
        # overlap is actually resolved - the absolute floor alone is not
        # sufficient. See test_evidence_sufficiency.py for locked cases.
        min_semantic_relevance: float = -2.0,
        # Fallback for the absolute threshold above: some legitimately
        # in-scope phrasings (short "what should I monitor for X" style
        # questions) score below -2.0 on raw cross-encoder logits, in a
        # range that directly overlaps genuine topic-mismatch queries
        # ("heat stroke" scored -3.0, "central line care" scored -3.1 -
        # no single cutoff separates them). What does separate them: the
        # legitimate query's single best-matching SOP dominates every
        # *other* SOP in the top-5 by a wide margin (or no other SOP even
        # appears), while the mismatch query's best SOP is only narrowly
        # ahead of a different, also-plausible SOP. Both conditions must
        # hold - a merely "less bad than everything else" candidate still
        # has to clear this floor - see test_evidence_sufficiency.py for
        # the calibration cases this was measured against.
        semantic_dominance_floor: float = -6.0,
        semantic_dominance_margin: float = 5.0,
    ):
        self.min_chunks = min_chunks
        self.min_top_score = min_top_score
        self.min_keyword_overlap = min_keyword_overlap
        # Whole-corpus vocabulary (see build_corpus_vocabulary) - optional
        # so existing call sites/tests that construct this checker directly
        # without a corpus don't need to change. None disables check 6.
        self.corpus_vocabulary = corpus_vocabulary
        self.min_corpus_vocabulary_coverage = min_corpus_vocabulary_coverage
        self.min_semantic_relevance = min_semantic_relevance
        self.semantic_dominance_floor = semantic_dominance_floor
        self.semantic_dominance_margin = semantic_dominance_margin

    def check(
        self,
        query: str,
        retrieved_chunks: list[dict[str, Any]],
        query_type: str = "general",
    ) -> dict[str, Any]:
        """
        Evaluate whether retrieved evidence is sufficient.

        Returns:
            sufficient: bool
            score: float (0-1)
            reason: str
            missing: list of what's missing
            recommendations: list of suggested actions
        """
        if not retrieved_chunks:
            return {
                "sufficient": False,
                "score": 0.0,
                "reason": "No chunks retrieved.",
                "missing": ["relevant SOP content"],
                "recommendations": ["Try a more specific question.", "Check if the relevant SOP has been uploaded."],
            }

        checks = []
        missing = []

        # 1. Top score check
        top_score = retrieved_chunks[0].get("relevance_score", 0)
        score_ok = top_score >= self.min_top_score
        checks.append(("relevance_score", score_ok, top_score))
        if not score_ok:
            missing.append("high-relevance source content")

        # 2. Chunk count check
        count_ok = len(retrieved_chunks) >= self.min_chunks
        checks.append(("chunk_count", count_ok, len(retrieved_chunks)))
        if not count_ok:
            missing.append("sufficient source documents")

        # 3. Query keyword overlap
        q_tokens = set(re.findall(r"[a-z]{3,}", query.lower()))
        combined_text = " ".join(
            c.get("text", c.get("chunk_text", "")).lower()
            for c in retrieved_chunks[:5]
        )
        chunk_tokens = set(re.findall(r"[a-z]{3,}", combined_text))
        overlap = len(q_tokens & chunk_tokens) / max(len(q_tokens), 1)
        overlap_ok = overlap >= self.min_keyword_overlap
        checks.append(("keyword_overlap", overlap_ok, round(overlap, 3)))
        if not overlap_ok:
            missing.append("keyword match between query and sources")

        # 4. Chunk type match for specific query types
        chunk_types = {c.get("chunk_type", "") for c in retrieved_chunks[:5]}
        type_match = True
        if query_type == "threshold" and "threshold" not in chunk_types:
            type_match = False
            missing.append("threshold-specific content")
        elif query_type == "contraindication" and "contraindication" not in chunk_types:
            type_match = False
            missing.append("contraindication-specific content")
        elif query_type in ("procedure_steps", "sequence") and not chunk_types & {"step", "step_sequence"}:
            type_match = False
            missing.append("procedure step content")
        elif query_type == "medication" and not chunk_types & {
            "threshold", "threshold_sequence", "step", "contraindication"
        }:
            # Real gap this closes (Phase B.2): dose/drug questions
            # ("what is the maximum norepinephrine dose?") had no
            # chunk-type requirement at all - the other three branches
            # above cover threshold/contraindication/procedure_steps, but
            # "medication" fell through unchecked. There's no dedicated
            # "medication" chunk_type in chunker.py; dosing content lives
            # in threshold chunks (dose values), step chunks (administration
            # instructions), or contraindication chunks (when-not-to-give) -
            # mirrors query_agent.py's _plan_retrieval mapping for this
            # query type. A medication question whose top-5 evidence is
            # only summary/section/full_text chunks is a real sufficiency
            # gap: generic overview text, not the specific dosing/admin
            # detail the question asked for.
            type_match = False
            missing.append("medication-specific content (dose, administration, or contraindication)")
        checks.append(("chunk_type_match", type_match, str(chunk_types)))

        # 5. Entity-lexicon grounding (CRAG-style additional signal). If the
        # query names a specific drug or condition from the known clinical
        # lexicon, that entity should actually show up in the retrieved
        # evidence text. This catches queries that name something no
        # indexed SOP covers (e.g. a chemotherapy question against this
        # sepsis/cardiac-arrest corpus) even when they still clear the
        # generic keyword-overlap bar on shared common words like "dose"
        # or "management". Queries that don't name any lexicon entity at
        # all (most free-text questions) skip this check rather than being
        # penalized for using vocabulary outside our ~70-term lexicon.
        query_entities = _extract_lexicon_entities(query)
        entity_grounded = True
        if query_entities:
            # Chunk-level clinical_entities (attached at index time from the
            # SOP's *full* text - see chunker.py's _sop_level_entities) as a
            # second check alongside literal substring match. A bucket-style
            # chunk ("Clinical Thresholds and Values" concatenating every
            # threshold for the SOP) often doesn't repeat the drug name on
            # every line even when the SOP is unambiguously about that drug
            # - e.g. the Anticoagulation SOP's threshold chunk states "INR
            # target (DVT/PE/AFib): 2.0-3.0" without the word "warfarin",
            # which previously failed this gate and caused a false
            # abstention despite the correct SOP being the clear top match.
            chunk_entities = {
                e for c in retrieved_chunks[:5] for e in c.get("clinical_entities", [])
            }
            ungrounded = [e for e in query_entities if e not in combined_text and e not in chunk_entities]
            entity_grounded = len(ungrounded) == 0
            checks.append(("entity_grounding", entity_grounded, query_entities))
            if not entity_grounded:
                missing.append(f"evidence for named entities ({', '.join(ungrounded)})")

        # 6. Corpus-vocabulary coverage: a cheap, corpus-wide complement to
        # the entity_grounding gate above. entity_grounding only fires when
        # the query names something from the ~70-term drug/condition
        # lexicon; a query that uses no lexicon term at all (e.g. "What is
        # the recommended dose of chemotherapy for stage 3 lung cancer?" -
        # "chemotherapy" isn't in the lexicon) sails through untouched.
        # This checks what fraction of the query's content words appear
        # ANYWHERE in the indexed corpus, not just the top-5 retrieved
        # chunks (keyword_overlap's scope) - a query mostly built from
        # words absent from the whole corpus is a real out-of-scope signal.
        # Soft vote only (unlike entity_grounding): unlike a named entity
        # that's either grounded or not, "uses some unfamiliar vocabulary"
        # is common in legitimate weak queries too, so this must not be a
        # hard gate - see the calibration note in
        # test_evidence_sufficiency.py for why single signals here can't
        # be treated as decisive on their own.
        if self.corpus_vocabulary is not None:
            content_words = {w for w in q_tokens if w not in _STOPWORDS}
            if content_words:
                vocab_coverage = len(content_words & self.corpus_vocabulary) / len(content_words)
                vocab_ok = vocab_coverage >= self.min_corpus_vocabulary_coverage
                checks.append(("corpus_vocabulary_coverage", vocab_ok, round(vocab_coverage, 3)))
                if not vocab_ok:
                    missing.append("corpus vocabulary overlap")

        # 7b. Semantic relevance (cross-encoder) - a real semantic judge of
        # query-vs-evidence relevance, independent of lexical/embedding-
        # cosine overlap. This is what distinguishes "heat stroke" from a
        # SOP whose steps densely repeat the literal token "stroke"
        # (cerebrovascular stroke - a different condition) - something no
        # keyword-overlap or dense-cosine signal above reliably catches on
        # its own, since both would see meaningful token/embedding overlap
        # from the shared word. Hard-gated like entity_grounding below, but
        # only enforced when the pipeline actually attached a genuine
        # cross-encoder score to the top candidates (see
        # app/agents/pipeline.py._prepare) - reads whatever `rerank_score`
        # is present on the chunks it's given rather than taking a
        # parameter, so existing unit tests constructing this checker with
        # synthetic chunks (no rerank_score field) are completely
        # unaffected and this check simply sits out for them.
        scored = [c for c in retrieved_chunks[:5] if "rerank_score" in c]
        semantic_ok = True
        if scored:
            top_semantic = max(c["rerank_score"] for c in scored)
            semantic_ok = top_semantic >= self.min_semantic_relevance
            if not semantic_ok:
                # Dominance fallback: does the best-scoring SOP clearly
                # beat every *other* SOP among the top candidates? Requires
                # an actual rival to be dominant over - real bug found
                # calibrating this: when every one of the top-5 candidates
                # comes from the SAME single SOP (no rival present at all),
                # `rival_scores` was empty and margin defaulted to
                # float("inf"), trivially satisfying the margin check
                # regardless of how weak the absolute score was. That let a
                # -3.0 score (well inside the -6.0..-2.0 gray zone, on a
                # genuinely off-topic query where nothing else was even
                # retrieved) sail through as "dominant" when there was
                # nothing to be dominant over - the opposite of what the
                # fallback is supposed to mean. No rivals now means the
                # fallback doesn't apply at all.
                top_sop = max(scored, key=lambda c: c["rerank_score"]).get("sop_id")
                rival_scores = [c["rerank_score"] for c in scored if c.get("sop_id") != top_sop]
                semantic_ok = bool(rival_scores) and (
                    top_semantic >= self.semantic_dominance_floor
                    and (top_semantic - max(rival_scores)) >= self.semantic_dominance_margin
                )
            checks.append(("semantic_relevance", semantic_ok, round(top_semantic, 3)))
            if not semantic_ok:
                missing.append("semantically relevant evidence (topic mismatch)")

        # 7. SOP status check
        sop_statuses = {c.get("status", "active") for c in retrieved_chunks[:5]}
        status_warning = "archived" in sop_statuses
        if status_warning:
            missing.append("active (non-archived) SOP version")

        # Calculate overall score
        passed = sum(1 for _, ok, _ in checks if ok)
        total = len(checks)
        score = passed / total if total > 0 else 0

        # Must have decent relevance score and, if the query names a
        # specific lexicon entity, that entity must actually be grounded in
        # the retrieved evidence - otherwise the named-entity check would
        # never be more than one vote among several and could be outvoted
        # by generic keyword overlap on shared common words. semantic_ok is
        # the same kind of hard gate, but generalizes past the ~70-term
        # lexicon entity_grounded is limited to - see check 7b above.
        from app.services.app_settings import get_confidence_threshold
        sufficient = score >= get_confidence_threshold() and score_ok and entity_grounded and semantic_ok

        reason = f"Evidence check: {passed}/{total} criteria met."
        if not sufficient:
            reason += f" Missing: {', '.join(missing)}."
        if status_warning:
            reason += " Warning: some sources are archived."

        recommendations = []
        if not sufficient:
            recommendations.append("Try rephrasing with more specific clinical terms.")
            if not score_ok:
                recommendations.append("The query may not match any uploaded SOP content.")
            if not semantic_ok:
                recommendations.append("No approved SOP achieved sufficient topical relevance to this question.")
            if missing:
                recommendations.append(f"Consider uploading SOPs that cover: {', '.join(missing[:2])}.")

        return {
            "sufficient": sufficient,
            "score": round(score, 3),
            "confidence_tier": confidence_tier(score),
            "reason": reason,
            "missing": missing,
            "recommendations": recommendations,
            "checks": [{"name": name, "passed": ok, "value": val} for name, ok, val in checks],
            "status_warning": status_warning,
        }
