"""
Version-history and comparison chat-intent handling.

Real gap this closes (Phase B.1): "what changed in the sepsis SOP?" and
"compare the anticoagulation SOP with current evidence" are real chat
questions with real backend data behind them (SOPVersionRecord,
sop_comparison.py) - but a chat message asking either one used to fall
straight into normal RAG retrieval/generation, which has no access to
version-history rows or comparison scoring and would either hallucinate
an answer or abstain. This module lets the chat routes special-case those
two query types: identify the SOP via the pipeline's own retriever (cheap,
no LLM call), then build an answer directly from the same DB-backed logic
routes_sop_versions.py / routes_comparison.py already expose over HTTP -
reusing that logic rather than duplicating it.

Falls through (returns None) whenever the SOP can't be confidently
identified or has no data to report, so the caller's normal pipeline.run()
path is always the safe default - this never blocks or replaces retrieval,
it only short-circuits it when it can give a strictly better answer.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import SOP, SOPVersionRecord
from app.schemas.schemas import QueryResponse, RetrievedChunk
from app.api.routes_sop_versions import _version_sort_key

#: Below this relevance score, retrieval's top SOP guess is too weak to
#: safely name in a version-history/comparison answer - fall through to
#: normal RAG instead of asserting a possibly-wrong SOP.
_MIN_SOP_MATCH_SCORE = 0.3


def _identify_top_sop(retriever, query: str) -> Optional[tuple[str, str, float]]:
    """Cheap SOP identification via the existing retriever - no LLM call.
    Returns (sop_id, sop_title, relevance_score) or None if no confident match."""
    results = retriever.search(query, top_k=3, query_type="general")
    if not results:
        return None
    top = results[0]
    score = top.get("relevance_score", 0.0)
    if score < _MIN_SOP_MATCH_SCORE:
        return None
    return top.get("sop_id", ""), top.get("sop_title", "Unknown SOP"), score


async def try_version_history_answer(
    db: AsyncSession, retriever, query: str,
) -> Optional[QueryResponse]:
    """Builds a version-history answer directly from SOPVersionRecord rows
    for the SOP the query appears to be about. Returns None (fall through
    to normal RAG) if no SOP can be confidently identified or it has no
    recorded version history - most demo SOPs don't, since seeding a full
    history is only meaningful for the ones used to demonstrate the
    governance workflow."""
    identified = _identify_top_sop(retriever, query)
    if identified is None:
        return None
    sop_id, sop_title, score = identified

    rows = (await db.execute(
        select(SOPVersionRecord).where(SOPVersionRecord.sop_id == sop_id)
    )).scalars().all()
    if not rows:
        return None
    ordered = sorted(rows, key=lambda r: _version_sort_key(r.version_number))

    lines = [f"Based on the version history for {sop_title}:\n"]
    for v in ordered:
        lines.append(f"- v{v.version_number} ({v.status}, effective {v.effective_date or 'n/a'}):")
        if v.summary_of_changes:
            lines.append(f"  {v.summary_of_changes}")
        if v.reason_for_change:
            lines.append(f"  Reason: {v.reason_for_change}")
        if v.changed_by:
            lines.append(f"  Changed by: {v.changed_by} ({v.changed_by_role or 'role not recorded'})")
    lines.append(f"\nSource: {sop_title}, Version History ({len(ordered)} version(s) on record)")
    answer = "\n".join(lines)

    return QueryResponse(
        answer=answer,
        query_type="version_history",
        route="sop_library",
        confidence=0.85,
        confidence_tier="High Confidence",
        retrieved_chunks=[RetrievedChunk(
            chunk_text=answer, section_title="Version History",
            sop_title=sop_title, sop_id=sop_id, relevance_score=score,
        )],
        reasoning_trace=[
            "Query classified as: version_history",
            f"Identified SOP via retrieval: {sop_title} (score {score:.3f})",
            f"Answered directly from {len(ordered)} SOPVersionRecord row(s) - no generation model used.",
        ],
    )


async def try_comparison_answer(
    db: AsyncSession, retriever, query: str,
) -> Optional[QueryResponse]:
    """Builds a comparison answer directly from the same scoring
    (compare_sop_to_reference / compare_sop_to_dynamic_evidence) the
    "Compare with Clinical Evidence" button already uses. Returns None
    (fall through to normal RAG) if no SOP can be confidently identified
    or no meaningful comparison could be built (e.g. no strong/moderate
    external evidence found for the topic)."""
    from app.services.sop_comparison import (
        compare_sop_to_reference, compare_sop_to_dynamic_evidence, REFERENCE_PROTOCOLS,
    )
    from app.integrations.evidence_registry import search_all as search_external_evidence
    from app.rag.faithfulness_nli import get_similarity_fn

    identified = _identify_top_sop(retriever, query)
    if identified is None:
        return None
    sop_id, sop_title, score = identified

    sop = (await db.execute(select(SOP).where(SOP.sop_id == sop_id))).scalar_one_or_none()
    if sop is None:
        return None
    internal_steps = [s.get("action", "") for s in (sop.structured_json or {}).get("steps", [])]
    sim_fn = get_similarity_fn()

    if sop_id in REFERENCE_PROTOCOLS:
        result = compare_sop_to_reference(sop_id, internal_steps, sim_fn=sim_fn)
    else:
        try:
            evidence_records = await search_external_evidence(sop_title, max_results=15)
        except Exception:
            evidence_records = []
        result = compare_sop_to_dynamic_evidence(sop_id, internal_steps, evidence_records, sim_fn=sim_fn)

    if result is None:
        return None

    summary = result["summary"]
    lines = [
        f"Based on comparing {sop_title} (v{sop.version}) with {result['reference_source'].get('name', 'external evidence')}:\n",
        f"Overall alignment: {summary['overall_alignment']}",
        f"- {summary['match_count']} of {summary['total_reference_steps']} reference points fully match the current SOP.",
    ]
    if summary["partial_count"]:
        lines.append(f"- {summary['partial_count']} partially match.")
    if summary["missing_count"]:
        lines.append(f"- {summary['missing_count']} are not reflected in the current SOP.")
    lines.append(f"\n{summary['recommended_action']}")
    lines.append(f"\nSource: {sop_title}, Protocol Comparison ({result['mode']} reference)")
    answer = "\n".join(lines)

    return QueryResponse(
        answer=answer,
        query_type="comparison",
        route="hybrid",
        confidence=0.8,
        confidence_tier="High Confidence",
        retrieved_chunks=[RetrievedChunk(
            chunk_text=answer, section_title="Protocol Comparison",
            sop_title=sop_title, sop_id=sop_id, relevance_score=score,
        )],
        reasoning_trace=[
            "Query classified as: comparison",
            f"Identified SOP via retrieval: {sop_title} (score {score:.3f})",
            f"Answered directly from protocol-comparison scoring ({result['mode']} reference) - no generation model used.",
        ],
    )
