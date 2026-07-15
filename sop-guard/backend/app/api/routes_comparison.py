"""
Meridian SOP vs External Protocol Comparison Routes
-------------------------------------------------------
Research prototype - NOT for clinical use.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.db import get_db
from app.models.models import SOP
from app.services.sop_comparison import compare_sop_to_reference, compare_sop_to_dynamic_evidence, REFERENCE_PROTOCOLS
from app.integrations.evidence_registry import search_all as search_external_evidence
from app.rag.faithfulness_nli import get_similarity_fn
from app.services.activity import log_activity

router = APIRouter(tags=["Protocol Comparison"])


@router.get("/api/sops/{sop_id}/protocol-comparison")
async def get_protocol_comparison(sop_id: str, db: AsyncSession = Depends(get_db)):
    sop = (await db.execute(select(SOP).where(SOP.sop_id == sop_id))).scalar_one_or_none()
    if not sop:
        raise HTTPException(status_code=404, detail=f"SOP {sop_id} not found.")

    internal_steps = [
        s.get("action", "") for s in (sop.structured_json or {}).get("steps", [])
    ]
    sim_fn = get_similarity_fn()

    if sop_id in REFERENCE_PROTOCOLS:
        # Highest-quality path: a real, named guideline bundle transcribed
        # step-by-step (see sop_comparison.py's REFERENCE_PROTOCOLS).
        result = compare_sop_to_reference(sop_id, internal_steps, sim_fn=sim_fn)
    else:
        # Every other SOP: build the reference dynamically from the
        # highest-graded live evidence for this SOP's topic, so comparison
        # works for any SOP rather than only the ones we've hand-curated.
        try:
            evidence_records = await search_external_evidence(sop.title, max_results=15)
        except Exception:
            evidence_records = []
        result = compare_sop_to_dynamic_evidence(sop_id, internal_steps, evidence_records, sim_fn=sim_fn)

    if result is None:
        return {
            "available": False,
            "reason": "No sufficiently strong or moderate-grade external evidence was found for this SOP's topic, "
                      "so no meaningful comparison could be built.",
        }

    log_activity(
        action="comparison_generated", sop_id=sop_id, sop_title=sop.title,
        details=f"{result['mode']}: {result['summary']['overall_alignment']}",
    )
    return {"available": True, "sop_title": sop.title, "sop_version": sop.version, **result}
