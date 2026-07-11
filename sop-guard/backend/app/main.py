"""
Meridian  - Agentic RAG for Clinical SOP Question-Answering
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
from app.api import routes_query, routes_sops, routes_feedback, routes_voice, routes_evaluation, routes_activity, routes_evidence, routes_governance, routes_chat, routes_cds, routes_overrides, routes_credits, routes_analytics, routes_smart, routes_capa, routes_settings


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
            await _seed_demo_activity_if_empty()
            await _backfill_review_dates(session)
            return

        for data in DEMO_SOPS:
            structured = data.get("structured_json") or structure_sop(data["raw_text"], data["title"])
            sop = SOP(
                sop_id=data["sop_id"],
                title=data["title"],
                department=data.get("department", "General"),
                version=data.get("version", "1.0"),
                effective_date=data.get("effective_date", ""),
                review_date=data.get("review_date", ""),
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
                review_date=data.get("review_date", ""),
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
        print(f"[Meridian] Loaded {len(DEMO_SOPS)} demo SOPs.")

    await _seed_demo_activity_if_empty()


async def _seed_demo_activity_if_empty() -> None:
    """
    Seed demo activity log entries once per process.

    This used to live inside the SOP-count early-return above, which
    meant it only ever ran the very first time the SQLite DB was
    populated - on every later restart, count > 0 short-circuited before
    this code ran, so the audit trail was silently empty (except for
    activity generated during that session) despite looking like seeded
    demo data was intended. The activity log is in-memory and resets on
    every restart independent of the persisted SOP data, so it needs its
    own gate.
    """
    from app.services.activity import log_activity, has_any_activity

    if has_any_activity():
        return

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


async def _backfill_review_dates(session) -> None:
    """
    Set review_date on existing demo SOP rows that predate this column.

    review_date was added after this project's dev database already had
    SOPs loaded (a persisted SQLite file, unlike the in-memory activity
    log) - the ALTER TABLE migration in db.py adds the column with an
    empty default, but only the SOP-count-based seed path above sets its
    value, and that path is skipped whenever SOPs already exist. Without
    this, every already-populated dev/demo database would show no
    review dates at all on the expiry page.
    """
    from sqlalchemy import select
    from app.models.models import SOP
    from app.demo_data.demo_sops import DEMO_SOPS

    review_dates_by_sop_id = {d["sop_id"]: d.get("review_date", "") for d in DEMO_SOPS if d.get("review_date")}
    if not review_dates_by_sop_id:
        return

    rows = (await session.execute(
        select(SOP).where(SOP.sop_id.in_(review_dates_by_sop_id.keys()))
    )).scalars().all()

    changed = False
    for sop in rows:
        if not sop.review_date and sop.sop_id in review_dates_by_sop_id:
            sop.review_date = review_dates_by_sop_id[sop.sop_id]
            changed = True

    if changed:
        await session.commit()


async def _seed_demo_incidents_if_empty(session) -> None:
    """Seed demo incident + CAPA records once, mirroring the incidents
    the frontend previously hardcoded as mock data - so /incidents shows
    the same illustrative scenarios, now backed by real persisted rows
    with a real CAPA workflow instead of static JSON."""
    from sqlalchemy import select, func
    from app.models.models import IncidentRecord, CAPARecord

    count = (await session.execute(select(func.count(IncidentRecord.id)))).scalar() or 0
    if count > 0:
        return

    demo_incidents = [
        {
            "incident_type": "near_miss", "title": "PPE shortage during isolation patient admission",
            "description": "N95 supply depleted during night shift. Staff used surgical masks for aerosol-generating procedure.",
            "department": "ICU", "severity": "high", "reporter": "Night Shift Charge Nurse",
            "linked_sop_ids": ["IC-PPE-001"],
            "capa": {
                "root_cause": "PPE stockpile reorder trigger was set below actual night-shift consumption rate.",
                "corrective_action": "Emergency N95 restock; night-shift supply check added to handoff checklist.",
                "preventive_action": "Review PPE stockpile thresholds and reorder triggers in IC-PPE-001.",
                "status": "investigating",
            },
        },
        {
            "incident_type": "adverse_event", "title": "Delayed sepsis bundle initiation",
            "description": "1-hour bundle initiated at 82 minutes due to blood culture delay. Lactate not drawn concurrently.",
            "department": "Emergency", "severity": "critical", "reporter": "Dr. Sarah Mitchell",
            "linked_sop_ids": ["SOP-ICU-001"],
            "capa": {
                "root_cause": "SOP did not specify concurrent lactate + blood culture draw, allowing sequential ordering.",
                "corrective_action": "Clarified lab-ordering sequence with ED nursing and pharmacy leads.",
                "preventive_action": "Add concurrent lactate + culture step to the sepsis SOP.",
                "status": "closed",
            },
        },
        {
            "incident_type": "near_miss", "title": "High-alert medication administered without double-check",
            "description": "Insulin drip rate changed without second-nurse verification due to staffing shortage.",
            "department": "Oncology", "severity": "critical", "reporter": "Emily Chen RN",
            "linked_sop_ids": ["SOP-ENDO-004"],
            "capa": {
                "root_cause": "SOP assumes two-nurse coverage at all times; no fallback defined for single-nurse shifts.",
                "corrective_action": "Escalated to pharmacy and nursing leadership; interim telephonic verification used.",
                "preventive_action": "Add a telephonic double-check procedure for single-nurse-coverage scenarios.",
                "status": "action_planned",
            },
        },
        {
            "incident_type": "sentinel_event", "title": "Patient fall with injury during Morse scale assessment",
            "description": "Patient scored 65 (high risk) but fall prevention measures not implemented per SOP timing requirements.",
            "department": "Medical Ward", "severity": "critical", "reporter": "Ward Nurse Manager",
            "linked_sop_ids": [],
            "capa": {
                "root_cause": "SOP allowed up to 4 hours to implement prevention measures after a high-risk score.",
                "corrective_action": "Immediate root-cause analysis; interim 1-hour implementation directive issued to ward staff.",
                "preventive_action": "Tighten SOP timing: prevention measures within 1 hour of assessment, not 4 hours.",
                "status": "closed",
            },
        },
        {
            "incident_type": "near_miss", "title": "MRI patient with undisclosed implant",
            "description": "Patient with cardiac device not identified during pre-MRI screening. Caught by radiographer before scan.",
            "department": "Radiology", "severity": "high", "reporter": "Senior Radiographer",
            "linked_sop_ids": [],
            "capa": {
                "root_cause": "Pre-MRI screening relies on patient self-report with no independent registry cross-check.",
                "corrective_action": "Manual implant registry check added for this case before rescheduling.",
                "preventive_action": "Add mandatory electronic implant registry check to pre-MRI screening SOP.",
                "status": "open",
            },
        },
    ]

    for data in demo_incidents:
        capa_data = data.pop("capa")
        incident = IncidentRecord(**data)
        session.add(incident)
        await session.flush()
        capa = CAPARecord(
            incident_id=incident.id,
            title=f"CAPA for: {incident.title}",
            root_cause=capa_data["root_cause"],
            corrective_action=capa_data["corrective_action"],
            preventive_action=capa_data["preventive_action"],
            status=capa_data["status"],
        )
        session.add(capa)

    await session.commit()
    print(f"[Meridian] Seeded {len(demo_incidents)} demo incidents with CAPA records.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB and load demo data."""
    await init_db()
    await _load_demo_data()
    try:
        async with async_session() as session:
            await routes_governance.seed_notifications_if_empty(session)
    except Exception as e:
        print(f"[Meridian] Warning: notification seed skipped: {e}")
    try:
        async with async_session() as session:
            await _seed_demo_incidents_if_empty(session)
    except Exception as e:
        print(f"[Meridian] Warning: incident seed skipped: {e}")
    print("[Meridian] Backend ready.")
    yield
    print("[Meridian] Shutting down.")


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
        "Meridian is a research prototype. Not for clinical use."
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
app.include_router(routes_capa.router)
app.include_router(routes_settings.router)


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
