"""
Meridian Query Route
---------------------
Research prototype  - NOT for clinical use.
"""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.db import get_db
from app.models.models import SOP, SOPChunk, Query
from app.schemas.schemas import QueryRequest, QueryResponse
from app.agents.pipeline import MeridianPipeline
from app.services.sop_structurer import structure_sop
from app.services.activity import log_activity
from app.services.query_log import log_query_result

router = APIRouter(tags=["Query"])


async def _load_chunks(db: AsyncSession) -> tuple[list[dict], dict[str, dict]]:
    """Load all SOP chunks + structured SOP data from the DB. Shared by the
    streaming and non-streaming query endpoints."""
    chunk_rows = (await db.execute(
        select(
            SOPChunk, SOP.sop_id.label("sop_sop_id"), SOP.title.label("sop_title"), SOP.structured_json,
            SOP.version, SOP.effective_date, SOP.review_date, SOP.status, SOP.raw_text,
        )
        .join(SOP, SOPChunk.sop_id == SOP.id)
    )).all()

    chunks = []
    structured_sops: dict[str, dict] = {}
    for row in chunk_rows:
        chunk = row[0]
        chunks.append({
            "chunk_text": chunk.chunk_text,
            "text": chunk.chunk_text,
            "section_title": chunk.section_title,
            "sop_title": row.sop_title,
            "sop_id": row.sop_sop_id,
            "chunk_type": getattr(chunk, "chunk_type", "section") or "section",
            "chunk_index": chunk.chunk_index,
            "version": row.version or "",
            "effective_date": row.effective_date or "",
            "review_date": row.review_date or "",
            "status": row.status or "active",
            "char_start": chunk.char_start,
            "char_end": chunk.char_end,
            "offset_source": chunk.offset_source or "",
            "offset_anchor": chunk.offset_anchor or "",
            # SOP's full raw text - needed to map a narrowed citation
            # sentence back to real document offsets (Q2.6). Not sent to
            # the frontend (schemas.py's citation passthrough only carries
            # the fields citation_tracker.py explicitly builds).
            "sop_raw_text": row.raw_text or "",
        })
        if row.sop_sop_id not in structured_sops and row.structured_json:
            structured_sops[row.sop_sop_id] = row.structured_json

    return chunks, structured_sops


async def _persist_query_result(req: QueryRequest, result: QueryResponse, db: AsyncSession) -> None:
    """Activity log + DB storage for a completed query result. Never raises
    - a storage failure must not fail the response, since the answer has
    already been generated and verified. Shared by the streaming and
    non-streaming query endpoints. Mutates result.answer_id in place."""
    log_activity(
        "query_submitted",
        sop_id=result.retrieved_chunks[0].sop_id if result.retrieved_chunks else "",
        sop_title=result.retrieved_chunks[0].sop_title if result.retrieved_chunks else "",
        user_role=req.user_role or "viewer",
        department=req.department or "",
        query=req.query,
        confidence=result.confidence,
    )

    try:
        query_record = Query(
            query_text=req.query,
            query_type=result.query_type,
            user_role=req.user_role or "",
            department=req.department or "",
            answer_text=result.answer,
            confidence_score=result.confidence,
            verification_status=result.verification_result.status.value if result.verification_result else "",
        )
        db.add(query_record)
        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"[Meridian] Warning: failed to store query record: {e}")

    result.answer_id = await log_query_result(db, req.query, result, user_id=req.user_role or "")


@router.post("/api/query", response_model=QueryResponse)
async def submit_query(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    """
    Submit a clinical SOP question. The pipeline retrieves relevant SOP
    chunks, generates an answer, and verifies procedural faithfulness.
    """
    chunks, structured_sops = await _load_chunks(db)
    if not chunks:
        raise HTTPException(status_code=404, detail="No SOPs loaded. Upload SOPs first or restart to load demo data.")

    pipeline = MeridianPipeline(chunks, structured_sops)
    result = await pipeline.run(
        query=req.query,
        user_role=req.user_role or "",
        department=req.department or "",
        news2_score=req.news2_score,
    )

    await _persist_query_result(req, result, db)
    return result


@router.post("/api/query/stream")
async def submit_query_stream(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    """
    Streaming variant of /api/query: tokens are sent to the client as the
    self-hosted model generates them (Server-Sent Events), so the UI can
    render the answer live instead of waiting for the full response.
    Verification, citations, and faithfulness still only run once the full
    text is assembled - the same as the non-streaming endpoint - and are
    delivered in one final SSE event with the complete QueryResponse.
    """
    chunks, structured_sops = await _load_chunks(db)
    if not chunks:
        raise HTTPException(status_code=404, detail="No SOPs loaded. Upload SOPs first or restart to load demo data.")

    pipeline = MeridianPipeline(chunks, structured_sops)

    async def event_stream():
        async for event in pipeline.run_streaming(
            query=req.query,
            user_role=req.user_role or "",
            department=req.department or "",
            news2_score=req.news2_score,
        ):
            if event["type"] == "token":
                yield f"data: {json.dumps({'type': 'token', 'text': event['text']})}\n\n"
            elif event["type"] == "final":
                result: QueryResponse = event["response"]
                await _persist_query_result(req, result, db)
                payload = json.loads(result.model_dump_json())
                yield f"data: {json.dumps({'type': 'final', 'response': payload})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/api/query/history")
async def get_query_history(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get recent query history for the current session."""
    rows = (await db.execute(
        select(Query).order_by(Query.created_at.desc()).limit(limit)
    )).scalars().all()

    return {
        "queries": [
            {
                "id": q.id,
                "query": q.query_text,
                "query_type": q.query_type,
                "confidence": q.confidence_score,
                "verification": q.verification_status,
                "timestamp": q.created_at.isoformat() if q.created_at else "",
            }
            for q in rows
        ]
    }


@router.post("/api/query/report")
async def generate_report(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    """Generate a comprehensive query report for printing or archiving."""
    chunk_rows = (await db.execute(
        select(
            SOPChunk, SOP.sop_id.label("sop_sop_id"), SOP.title.label("sop_title"), SOP.structured_json,
            SOP.version, SOP.effective_date, SOP.review_date, SOP.status, SOP.raw_text,
        )
        .join(SOP, SOPChunk.sop_id == SOP.id)
    )).all()

    chunks = []
    structured_sops: dict[str, dict] = {}
    for row in chunk_rows:
        chunk = row[0]
        chunks.append({
            "chunk_text": chunk.chunk_text,
            "text": chunk.chunk_text,
            "section_title": chunk.section_title,
            "sop_title": row.sop_title,
            "sop_id": row.sop_sop_id,
            "chunk_type": getattr(chunk, "chunk_type", "section") or "section",
            "chunk_index": chunk.chunk_index,
            "version": row.version or "",
            "effective_date": row.effective_date or "",
            "review_date": row.review_date or "",
            "status": row.status or "active",
            "char_start": chunk.char_start,
            "char_end": chunk.char_end,
            "offset_source": chunk.offset_source or "",
            "offset_anchor": chunk.offset_anchor or "",
            # SOP's full raw text - needed to map a narrowed citation
            # sentence back to real document offsets (Q2.6). Not sent to
            # the frontend (schemas.py's citation passthrough only carries
            # the fields citation_tracker.py explicitly builds).
            "sop_raw_text": row.raw_text or "",
        })
        if row.sop_sop_id not in structured_sops and row.structured_json:
            structured_sops[row.sop_sop_id] = row.structured_json

    if not chunks:
        raise HTTPException(status_code=404, detail="No SOPs loaded.")

    pipeline = MeridianPipeline(chunks, structured_sops)
    result = await pipeline.run(
        query=req.query,
        user_role=req.user_role or "",
        department=req.department or "",
    )

    # Build comprehensive report
    report = {
        "header": {
            "title": "Meridian Clinical Query Report",
            "system": "Meridian v1.0.0",
            "disclaimer": "Research prototype. Not for clinical use. Verify all information against official SOP documents.",
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "query": req.query,
            "query_type": result.query_type,
        },
        "result": {
            "answer": result.answer,
            "confidence": result.confidence,
            "confidence_label": (
                "High - Well supported by SOP evidence"
                if result.confidence >= 0.7
                else "Medium - Partially supported, verify details"
                if result.confidence >= 0.5
                else "Low - Limited evidence, consult source SOP"
            ),
        },
        "verification": {
            "status": result.verification_result.status.value if result.verification_result else "not checked",
            "score": result.verification_result.overall_score if result.verification_result else 0,
            "explanation": result.verification_result.explanation if result.verification_result else "",
            "checks_passed": sum(
                1 for c in (
                    result.verification_result.threshold_checks
                    + result.verification_result.sequence_checks
                    + result.verification_result.contraindication_checks
                ) if c.status == "pass"
            ) if result.verification_result else 0,
            "checks_total": len(
                result.verification_result.threshold_checks
                + result.verification_result.sequence_checks
                + result.verification_result.contraindication_checks
            ) if result.verification_result else 0,
        },
        "sources": [
            {
                "sop_title": c.sop_title,
                "section": c.section_title,
                "relevance": f"{c.relevance_score * 100:.0f}%",
                "excerpt": c.chunk_text[:300],
            }
            for c in result.retrieved_chunks[:5]
        ],
        "pipeline_trace": result.reasoning_trace,
        "footer": {
            "note": "This report was generated by Meridian, a research prototype for clinical SOP question-answering. Always verify information against official hospital SOPs before clinical use.",
        },
    }

    return JSONResponse(content=report)


@router.get("/api/conflicts/graph")
async def conflicts_graph(db: AsyncSession = Depends(get_db)):
    """Entity-graph (GraphRAG-lite) cross-SOP conflict report."""
    from app.rag.entity_graph import get_global_graph, init_entity_graph, find_conflicts
    from app.services.chunk_loader import load_chunks

    graph = get_global_graph()
    if not graph:
        # Lazy build if startup hook did not run (e.g. tests)
        try:
            chunks, _ = await load_chunks(db)
            graph = init_entity_graph(chunks)
        except Exception:
            graph = {}

    conflicts = find_conflicts(graph)
    edge_count = sum(len(edges) for edges in graph.values())
    return {
        "conflicts": conflicts,
        "conflict_count": len(conflicts),
        "entity_count": len(graph),
        "edge_count": edge_count,
    }


@router.get("/api/llm/status")
async def llm_status():
    """Check the status of the configured LLM provider."""
    from app.rag.llm_generator import LLMGenerator
    gen = LLMGenerator()
    available = await gen._check_available()
    return {
        # gen.model defaults to settings.LLM_MODEL ("gpt-4o-mini") even when
        # provider="mock" and no model is ever actually invoked - reporting
        # that name here would falsely imply a real model is backing answers.
        "provider": gen.provider,
        "model": gen.model if gen.provider != "mock" else None,
        "available": available,
        "mode": "llm" if available else "mock",
    }


@router.get("/api/embedding/status")
async def embedding_status():
    """Check whether retrieval is using real dense embeddings or the TF-IDF fallback."""
    from app.rag.embedding_cache import get_shared_embedding_provider, is_dense_backend_active

    provider = get_shared_embedding_provider()
    dense_active = is_dense_backend_active()
    return {
        "backend": provider.backend_name,
        "dense_active": dense_active,
        "mode": "semantic" if dense_active else "tfidf",
        "description": (
            "Using sentence-transformers for semantic similarity, blended with keyword matching."
            if dense_active
            else "Using TF-IDF keyword matching. Install sentence-transformers for semantic search."
        ),
    }
