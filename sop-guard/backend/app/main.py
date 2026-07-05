"""
SOP-Guard  - Agentic RAG for Clinical SOP Question-Answering
with Procedural Faithfulness Verification.

RESEARCH PROTOTYPE  - NOT FOR CLINICAL USE.
This system is a research tool and must not be used for actual
clinical decision-making without proper validation and regulatory approval.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database.db import init_db, async_session
from app.api import routes_query, routes_sops, routes_feedback, routes_voice, routes_evaluation, routes_activity, routes_evidence, routes_governance, routes_chat, routes_cds, routes_overrides, routes_credits, routes_analytics, routes_smart


async def _load_demo_data() -> None:
    """Load demo SOPs if the database is empty."""
    from sqlalchemy import select, func
    from app.models.models import SOP, SOPChunk
    from app.demo_data.demo_sops import DEMO_SOPS
    from app.services.sop_structurer import structure_sop
    from app.rag.chunker import create_sop_chunks

    async with async_session() as session:
        count = (await session.execute(select(func.count(SOP.id)))).scalar() or 0
        if count > 0:
            return

        for data in DEMO_SOPS:
            structured = data.get("structured_json") or structure_sop(data["raw_text"], data["title"])
            sop = SOP(
                sop_id=data["sop_id"],
                title=data["title"],
                department=data.get("department", "General"),
                version=data.get("version", "1.0"),
                effective_date=data.get("effective_date", ""),
                raw_text=data["raw_text"],
                structured_json=structured,
            )
            session.add(sop)
            await session.flush()

            sop_chunks = create_sop_chunks(
                raw_text=data["raw_text"],
                structured=structured,
                sop_id=data["sop_id"],
                sop_title=data["title"],
                department=data.get("department", "General"),
                version=data.get("version", "1.0"),
                status="active",
                effective_date=data.get("effective_date", ""),
            )
            idx_counter = 0
            for ch in sop_chunks:
                session.add(SOPChunk(
                    sop_id=sop.id,
                    section_title=ch.get("section_title", ""),
                    chunk_text=ch.get("text", ""),
                    chunk_type=ch.get("chunk_type", "section"),
                    chunk_index=idx_counter,
                ))
                idx_counter += 1

        await session.commit()
        print(f"[SOP-Guard] Loaded {len(DEMO_SOPS)} demo SOPs.")

    # Seed demo activity data
    from app.services.activity import log_activity
    demo_activities = [
        ("sop_viewed", "SOP-ICU-001", "Sepsis Management Protocol"),
        ("query_submitted", "SOP-ICU-001", "Sepsis Management Protocol"),
        ("sop_viewed", "SOP-GEN-002", "Blood Transfusion Protocol"),
        ("source_clicked", "SOP-ICU-001", "Sepsis Management Protocol"),
        ("sop_viewed", "SOP-ENDO-004", "Insulin and Hypoglycemia Management Protocol"),
        ("feedback_submitted", "SOP-ICU-001", "Sepsis Management Protocol"),
        ("sop_viewed", "SOP-ICU-003", "Central Line Insertion Protocol"),
        ("query_submitted", "SOP-GEN-002", "Blood Transfusion Protocol"),
    ]
    for action, sid, title in demo_activities:
        log_activity(action, sop_id=sid, sop_title=title)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB and load demo data."""
    await init_db()
    await _load_demo_data()
    try:
        async with async_session() as session:
            await routes_governance.seed_notifications_if_empty(session)
    except Exception as e:
        print(f"[SOP-Guard] Warning: notification seed skipped: {e}")
    print("[SOP-Guard] Backend ready.")
    yield
    print("[SOP-Guard] Shutting down.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Agentic RAG system for clinical SOP question-answering "
        "with procedural faithfulness verification. "
        "RESEARCH PROTOTYPE  - NOT FOR CLINICAL USE."
    ),
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Research disclaimer header middleware
@app.middleware("http")
async def add_research_disclaimer(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Research-Disclaimer"] = (
        "SOP-Guard is a research prototype. Not for clinical use."
    )
    return response


# Routers
app.include_router(routes_query.router)
app.include_router(routes_sops.router)
app.include_router(routes_feedback.router)
app.include_router(routes_voice.router)
app.include_router(routes_evaluation.router)
app.include_router(routes_activity.router)
app.include_router(routes_evidence.router)
app.include_router(routes_governance.router)
app.include_router(routes_chat.router)
app.include_router(routes_cds.router)
app.include_router(routes_overrides.router)
app.include_router(routes_credits.router)
app.include_router(routes_analytics.router)
app.include_router(routes_smart.router)


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "disclaimer": "Research prototype  - NOT for clinical use.",
    }


@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "healthy", "llm_provider": settings.LLM_PROVIDER}
