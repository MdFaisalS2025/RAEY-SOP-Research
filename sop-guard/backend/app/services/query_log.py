"""
Shared QueryLogRecord persistence.

Both the one-shot /api/query endpoint and the conversational /api/chat
endpoints answer questions through the same MeridianPipeline, but only the
one-shot endpoint used to write a QueryLogRecord row - the chat endpoints
(the actual "Ask Meridian" UI most users hit) never logged a query's route,
abstention, or confidence at all. That silently blinded any route-based
analytics (e.g. "which topics keep landing on no_evidence/external_evidence")
to the primary usage path. This module is the single write path both
endpoints now share, so every answered query is logged the same way
regardless of which endpoint produced it.

Research prototype. Not for clinical use.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import QueryLogRecord
from app.schemas.schemas import QueryResponse


async def log_query_result(
    db: AsyncSession, query_text: str, result: QueryResponse, user_id: str = "",
) -> int | None:
    """Best-effort QueryLogRecord write. Never raises - a logging failure
    must not fail a response that's already been generated and verified.
    Returns the new row's id, or None if the write failed."""
    try:
        faith = result.faithfulness or {}
        faith_score = float(faith.get("overall_faithfulness", 0.0)) if isinstance(faith, dict) else 0.0
        cited = sum(1 for c in (result.inline_citations or []) if c.get("cited_in_answer"))
        log = QueryLogRecord(
            query_text=query_text,
            answer_text=result.answer,
            query_type=result.query_type,
            generation_mode=next(
                (t.split(": ", 1)[1] for t in result.reasoning_trace if t.startswith("Generation mode:")),
                "",
            ),
            confidence=result.confidence,
            faithfulness_score=round(faith_score, 3),
            citation_count=cited,
            abstained="true" if result.abstained else "false",
            route=result.route,
            user_id=user_id,
            citations_json=result.inline_citations or [],
        )
        db.add(log)
        await db.flush()
        log_id = log.id
        await db.commit()
        return log_id
    except Exception as e:
        await db.rollback()
        print(f"[Meridian] Warning: failed to write query audit log: {e}")
        return None
