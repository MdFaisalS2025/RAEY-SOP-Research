"""
SOP-Guard Evidence Sufficiency Checker
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
    ):
        self.min_chunks = min_chunks
        self.min_top_score = min_top_score
        self.min_keyword_overlap = min_keyword_overlap

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
            ungrounded = [e for e in query_entities if e not in combined_text]
            entity_grounded = len(ungrounded) == 0
            checks.append(("entity_grounding", entity_grounded, query_entities))
            if not entity_grounded:
                missing.append(f"evidence for named entities ({', '.join(ungrounded)})")

        # 6. SOP status check
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
        # by generic keyword overlap on shared common words.
        sufficient = score >= 0.6 and score_ok and entity_grounded

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
            if missing:
                recommendations.append(f"Consider uploading SOPs that cover: {', '.join(missing[:2])}.")

        return {
            "sufficient": sufficient,
            "score": round(score, 3),
            "reason": reason,
            "missing": missing,
            "recommendations": recommendations,
            "checks": [{"name": name, "passed": ok, "value": val} for name, ok, val in checks],
            "status_warning": status_warning,
        }
