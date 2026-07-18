"""
Meridian Conversational Chat Routes
------------------------------------
Multi-turn chat sessions over the existing agentic RAG pipeline.
Research prototype. Not for clinical use.
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.models import ChatSessionRecord, ChatMessageRecord
from app.agents.pipeline import MeridianPipeline
from app.services.chunk_loader import load_chunks
from app.services.activity import log_activity
from app.services.query_log import log_query_result
from app.privacy.phi_guard import get_phi_provider

router = APIRouter(tags=["Chat"])


def _audit_phi(content: str) -> None:
    """Best-effort PHI audit on an inbound question. Records only the *types*
    and count of identifiers detected - never the raw PHI text - so the audit
    trail can show 'PHI was present and flagged' without itself becoming a
    place PHI is stored. Never raises: a guard failure must not block answering.

    Detection here is advisory/annotative only (matches the composer's
    non-blocking indicator); the question is still answered normally."""
    try:
        spans = get_phi_provider().detect(content or "")
        if spans:
            types = sorted({s.type for s in spans})
            log_activity(
                action="phi_detected",
                details=f"{len(spans)} identifier(s) flagged before generation: {', '.join(types)}",
            )
    except Exception as e:  # pragma: no cover - defensive
        print(f"[Meridian] Warning: PHI audit failed: {e}")


class ChatSessionCreate(BaseModel):
    title: str = ""


class ChatMessageCreate(BaseModel):
    content: str
    news2_score: Optional[int] = None


def _message_to_dict(m: ChatMessageRecord) -> dict:
    return {
        "id": m.id,
        "session_id": m.session_id,
        "role": m.role,
        "content": m.content,
        "citations": m.citations or [],
        "created_at": m.created_at.isoformat() if m.created_at else "",
    }


@router.post("/api/chat/sessions")
async def create_session(req: Optional[ChatSessionCreate] = None, db: AsyncSession = Depends(get_db)):
    """Create a new chat session."""
    title = (req.title if req else "") or "New conversation"
    session = ChatSessionRecord(title=title)
    db.add(session)
    await db.flush()
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat() if session.created_at else "",
    }


@router.get("/api/chat/sessions/{session_id}")
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get a chat session with all its messages."""
    session = (await db.execute(
        select(ChatSessionRecord).where(ChatSessionRecord.id == session_id)
    )).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Chat session {session_id} not found.")

    messages = (await db.execute(
        select(ChatMessageRecord)
        .where(ChatMessageRecord.session_id == session_id)
        .order_by(ChatMessageRecord.created_at.asc(), ChatMessageRecord.id.asc())
    )).scalars().all()

    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat() if session.created_at else "",
        "messages": [_message_to_dict(m) for m in messages],
    }


async def _build_context(session_id: int, db: AsyncSession) -> tuple[list[ChatMessageRecord], str, str]:
    """Load recent history and derive the contextualized retrieval query +
    the Q/A history block for generation. Shared by the streaming and
    non-streaming chat-message endpoints."""
    history = list(reversed((await db.execute(
        select(ChatMessageRecord)
        .where(ChatMessageRecord.session_id == session_id)
        .order_by(ChatMessageRecord.created_at.desc(), ChatMessageRecord.id.desc())
        .limit(6)
    )).scalars().all()))

    history_lines = []
    pairs: list[tuple[str, str]] = []
    pending_q: Optional[str] = None
    for m in history:
        if m.role == "user":
            pending_q = m.content
        elif m.role == "assistant" and pending_q is not None:
            pairs.append((pending_q, m.content))
            pending_q = None
    for q, a in pairs[-2:]:
        history_lines.append(f"Q: {q[:200]}")
        history_lines.append(f"A: {a[:200]}")
    history_context = "\n".join(history_lines)

    return history, history_context


async def _persist_chat_messages(
    session: ChatSessionRecord, session_id: int, req: ChatMessageCreate,
    history: list[ChatMessageRecord], answer: str, citations: list, db: AsyncSession,
) -> tuple[Optional[int], Optional[int]]:
    """Best-effort persistence of the user + assistant messages. Never
    raises - the answer has already been generated."""
    user_msg_id = None
    assistant_msg_id = None
    try:
        user_msg = ChatMessageRecord(
            session_id=session_id, role="user", content=req.content, citations=[]
        )
        assistant_msg = ChatMessageRecord(
            session_id=session_id, role="assistant", content=answer, citations=citations or [],
        )
        db.add(user_msg)
        db.add(assistant_msg)
        if not history and (not session.title or session.title == "New conversation"):
            session.title = req.content[:120]
        await db.flush()
        user_msg_id = user_msg.id
        assistant_msg_id = assistant_msg.id
        await db.commit()
    except Exception as e:
        try:
            await db.rollback()
        except Exception:
            pass
        print(f"[Meridian] Warning: failed to persist chat messages: {e}")
    return user_msg_id, assistant_msg_id


@router.post("/api/chat/sessions/{session_id}/messages")
async def post_message(
    session_id: int, req: ChatMessageCreate, db: AsyncSession = Depends(get_db)
):
    """Send a message in a chat session and get a pipeline-generated answer."""
    session = (await db.execute(
        select(ChatSessionRecord).where(ChatSessionRecord.id == session_id)
    )).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Chat session {session_id} not found.")

    history, history_context = await _build_context(session_id, db)
    # Retrieval runs on the new message alone (retrieval_query defaults to
    # `query` when unset) - prior questions go in as context_query instead
    # of being concatenated into one string. Concatenation let a strong
    # earlier question (e.g. "sepsis management") dominate scoring for
    # every follow-up regardless of what the follow-up actually asked,
    # since both ended up in the same bag-of-words - see the context_query
    # docstring on HybridRetriever.search for the fix.
    prior_user_questions = [m.content for m in history if m.role == "user"][-2:]
    context_query = " ".join(prior_user_questions)

    chunks, structured_sops = await load_chunks(db)
    if not chunks:
        raise HTTPException(status_code=404, detail="No SOPs loaded.")

    _audit_phi(req.content)
    pipeline = MeridianPipeline(chunks, structured_sops)
    result = await pipeline.run(
        query=req.content,
        news2_score=req.news2_score,
        context_query=context_query,
        history_context=history_context,
    )

    user_msg_id, assistant_msg_id = await _persist_chat_messages(
        session, session_id, req, history, result.answer, result.inline_citations, db
    )
    result.answer_id = await log_query_result(db, req.content, result)

    payload = result.model_dump()
    payload["session_id"] = session_id
    payload["message_id"] = assistant_msg_id
    payload["user_message_id"] = user_msg_id
    return payload


@router.post("/api/chat/sessions/{session_id}/messages/stream")
async def post_message_stream(
    session_id: int, req: ChatMessageCreate, db: AsyncSession = Depends(get_db)
):
    """Streaming variant of post_message: tokens arrive live over SSE, the
    final event carries the same payload shape (plus session_id/message_id)
    the non-streaming endpoint returns, and both messages are persisted once
    generation completes - identical guarantees, just delivered live."""
    session = (await db.execute(
        select(ChatSessionRecord).where(ChatSessionRecord.id == session_id)
    )).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Chat session {session_id} not found.")

    history, history_context = await _build_context(session_id, db)
    # See the matching comment in post_message above: context_query (not
    # concatenation) is what keeps follow-ups from all retrieving the
    # same evidence as the first question in the conversation.
    prior_user_questions = [m.content for m in history if m.role == "user"][-2:]
    context_query = " ".join(prior_user_questions)

    chunks, structured_sops = await load_chunks(db)
    if not chunks:
        raise HTTPException(status_code=404, detail="No SOPs loaded.")

    _audit_phi(req.content)
    pipeline = MeridianPipeline(chunks, structured_sops)

    async def event_stream():
        async for event in pipeline.run_streaming(
            query=req.content,
            news2_score=req.news2_score,
            context_query=context_query,
            history_context=history_context,
        ):
            if event["type"] == "token":
                yield f"data: {json.dumps({'type': 'token', 'text': event['text']})}\n\n"
            elif event["type"] == "final":
                result = event["response"]
                user_msg_id, assistant_msg_id = await _persist_chat_messages(
                    session, session_id, req, history, result.answer, result.inline_citations, db
                )
                result.answer_id = await log_query_result(db, req.content, result)
                payload = json.loads(result.model_dump_json())
                payload["session_id"] = session_id
                payload["message_id"] = assistant_msg_id
                payload["user_message_id"] = user_msg_id
                yield f"data: {json.dumps({'type': 'final', 'response': payload})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
