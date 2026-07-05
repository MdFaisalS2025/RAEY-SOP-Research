"""
SOP-Guard Conversational Chat Routes
------------------------------------
Multi-turn chat sessions over the existing agentic RAG pipeline.
Research prototype. Not for clinical use.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.models import ChatSessionRecord, ChatMessageRecord
from app.agents.pipeline import SOPGuardPipeline
from app.services.chunk_loader import load_chunks

router = APIRouter(tags=["Chat"])


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

    # 1. Load last 6 messages as history (chronological order)
    history = list(reversed((await db.execute(
        select(ChatMessageRecord)
        .where(ChatMessageRecord.session_id == session_id)
        .order_by(ChatMessageRecord.created_at.desc(), ChatMessageRecord.id.desc())
        .limit(6)
    )).scalars().all()))

    # 2. Contextualized retrieval query: prepend the last 2 user questions
    retrieval_query = req.content
    prior_user_questions = [m.content for m in history if m.role == "user"][-2:]
    if prior_user_questions:
        context_line = " ".join(prior_user_questions)
        retrieval_query = f"{context_line} {req.content}"

    # 4. History context block for generation: last 2 Q/A pairs, 200 chars each
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

    # 3. Run pipeline with contextualized retrieval query, raw display query
    chunks, structured_sops = await load_chunks(db)
    if not chunks:
        raise HTTPException(status_code=404, detail="No SOPs loaded.")

    pipeline = SOPGuardPipeline(chunks, structured_sops)
    result = await pipeline.run(
        query=req.content,
        news2_score=req.news2_score,
        retrieval_query=retrieval_query,
        history_context=history_context,
    )

    # 5. Persist both messages (best-effort)
    user_msg_id = None
    assistant_msg_id = None
    try:
        user_msg = ChatMessageRecord(
            session_id=session_id, role="user", content=req.content, citations=[]
        )
        assistant_msg = ChatMessageRecord(
            session_id=session_id,
            role="assistant",
            content=result.answer,
            citations=result.inline_citations or [],
        )
        db.add(user_msg)
        db.add(assistant_msg)
        # Set a session title from the first question
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
        print(f"[SOP-Guard] Warning: failed to persist chat messages: {e}")

    # 6. Full QueryResponse shape plus session_id and message_id
    payload = result.model_dump()
    payload["session_id"] = session_id
    payload["message_id"] = assistant_msg_id
    payload["user_message_id"] = user_msg_id
    return payload
