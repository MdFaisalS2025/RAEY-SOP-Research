"""
Meridian Answer Routing
------------------------------------
Explicit routing between the two, previously-unconnected retrieval paths:
internal SOP chunks (HybridRetriever + EvidenceSufficiencyChecker, in
pipeline.py) and external literature (evidence_registry.search_all).
Historically these were fully independent - the query pipeline only ever
answered from SOP chunks, and /api/evidence/search was a separate frontend
call the pipeline never consulted. This module is the seam between them.

Four routes, decided in pipeline.py's _prepare():
  A. Internal SOP       - SOP evidence sufficient, no explicit external/
                           comparison intent. Unchanged existing behavior.
  B. External Evidence  - SOP evidence insufficient, but the query reads as
                           literature-seeking ("latest recommendations for
                           X") and external sources return results.
  C. Hybrid Retrieval   - SOP evidence sufficient AND the query explicitly
                           asks to compare/reconcile against literature -
                           both groundings are retrieved and shown together.
  D. No Evidence        - SOP evidence insufficient AND external search
                           returns nothing relevant. The system says so
                           explicitly rather than fabricating an answer.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

_EXTERNAL_INTENT_KEYWORDS = [
    "latest", "recent", "recommend", "recommendation", "guideline", "guidance",
    "literature", "research", "study", "studies", "evidence for", "evidence on",
    "current evidence", "new evidence", "up to date", "up-to-date", "published",
]

_HYBRID_INTENT_KEYWORDS = [
    "compare", "comparison", "versus", " vs ", " vs. ", "against the literature",
    "against current", "against guidelines", "our sop", "our protocol",
    "our policy", "how does our", "differ from",
]


def classify_intent(query: str) -> str:
    """Return 'hybrid' | 'external' | 'internal' (default) based on
    surface wording. Deliberately coarse keyword matching, same spirit as
    the query-type classifier in query_agent.py - not a semantic model."""
    q = f" {query.lower()} "
    if any(kw in q for kw in _HYBRID_INTENT_KEYWORDS):
        return "hybrid"
    if any(kw in q for kw in _EXTERNAL_INTENT_KEYWORDS):
        return "external"
    return "internal"


def build_external_evidence_answer(query: str, external_results: list[dict]) -> dict:
    """Route B: no internal SOP match, but external literature is
    available. Builds an answer that is explicit about its source -
    grounded in the external records' titles/journals only, never
    inventing findings the records themselves don't state."""
    top = external_results[:5]
    lines = [
        "No matching internal SOP was found for this question. "
        "Based on external literature (not internal policy):",
        "",
    ]
    citations: list[str] = []
    inline_citations: list[dict] = []
    for i, r in enumerate(top, start=1):
        journal = r.get("journal_display_name") or r.get("journal") or r.get("source_type", "")
        date = r.get("pub_date") or ""
        lines.append(f"[{i}] {r.get('title', '(untitled)')} - {journal}{f' ({date})' if date else ''}")
        # The supporting excerpt (pick_supporting_excerpt, computed and
        # de-duplicated against the title in evidence_registry.search_all)
        # is what actually shows *why* this source is cited, not just its
        # title - empty when no real abstract excerpt was available, so
        # nothing is fabricated or redundantly repeated.
        excerpt = r.get("supporting_excerpt", "")
        title = r.get("title", "")
        if excerpt:
            lines.append(f"    \"{excerpt}\"")
        citations.append(f"[{i}] {journal}")
        # Same shape the frontend's CitationChip already renders for internal
        # SOP citations (see citation-chip.tsx) - reusing it here, rather
        # than leaving these "[n]" markers as unclickable plain text, is
        # what makes external evidence read as verifiable rather than just
        # asserted (the hover-preview-with-source-link pattern Perplexity/
        # OpenEvidence/Claude all use for citations).
        inline_citations.append({
            "number": i,
            "sop_id": r.get("pmid", ""),
            "sop_title": r.get("title", "(untitled)"),
            "section_title": journal,
            "chunk_type": r.get("study_type", "") or r.get("source_type", ""),
            "snippet": excerpt or title,
            "relevance_score": 0.0,
            "cited_in_answer": True,
            "version": "",
            "effective_date": "",
            "review_date": "",
            "status": "external",
            "url": r.get("url", ""),
            "is_external": True,
            "pub_date": date,
        })
    lines.append("")
    lines.append(
        "This reflects external literature only, not institutional policy. "
        "Verify against your department's current SOP and primary sources before acting."
    )
    confidence = min(0.3 + 0.08 * len(top), 0.6)  # capped below internal-SOP confidence ceiling
    return {
        "answer": "\n".join(lines),
        "citations": citations,
        "inline_citations": inline_citations,
        "confidence": round(confidence, 2),
        "reasoning_trace": [f"Route B: external evidence ({len(top)} records), no internal SOP match"],
        "generation_mode": "external_evidence",
    }


def build_no_evidence_answer(recommendations: list[str]) -> str:
    """Route D message. Leads with the exact required phrase so it's
    never ambiguous that this is an explicit non-answer, not a low-
    confidence guess (test_routing.py asserts this exact prefix) - the
    rest of the message is the physician-readable explanation of *why*,
    surfaced verbatim in the "Potential SOP Gap Detected" card
    (chat-answer-message.tsx)."""
    rec_text = (". ".join(recommendations)).strip()
    return "No validated evidence found. No approved SOP achieved sufficient relevance to this question. " + (
        rec_text if rec_text else "Try rephrasing your question or contact the relevant department."
    )
