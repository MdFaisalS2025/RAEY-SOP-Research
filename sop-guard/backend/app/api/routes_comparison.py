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
from app.services.sop_comparison import (
    compare_sop_to_reference, compare_sop_to_dynamic_evidence, compare_sop_to_guideline,
    REFERENCE_PROTOCOLS, internal_steps_from,
)
from app.integrations.evidence_registry import search_all as search_external_evidence
from app.rag.faithfulness_semantic import get_similarity_fn
from app.services.activity import log_activity

router = APIRouter(tags=["Protocol Comparison"])


@router.get("/api/sops/{sop_id}/protocol-comparison")
async def get_protocol_comparison(sop_id: str, db: AsyncSession = Depends(get_db)):
    sop = (await db.execute(select(SOP).where(SOP.sop_id == sop_id))).scalar_one_or_none()
    if not sop:
        raise HTTPException(status_code=404, detail=f"SOP {sop_id} not found.")

    internal_steps = internal_steps_from(sop.structured_json)
    sim_fn = get_similarity_fn()

    # Real signal, not fabricated: every EvidenceSource implementation's own
    # contract is "never raise - any network/parse failure is caught and
    # degrades to []" (see evidence_source.py's docstring), so an exception
    # actually reaching here means something genuinely broke the request
    # path itself (not a normal provider outage, which already resolves to
    # an empty result indistinguishable from "no evidence exists"). This is
    # the honest boundary of what's detectable with the current provider
    # contract - a per-provider ok/failed/empty breakdown would require
    # changing that contract for every source, which is out of scope here.
    provider_error: str | None = None

    # Live retrieval is the primary path for every SOP, including the one
    # with a stored offline fallback - a real, retrieved guideline's own
    # sentences always outrank a hand-transcribed bundle when available.
    try:
        result = await compare_sop_to_guideline(sop_id, sop.title, internal_steps, sim_fn=sim_fn)
    except Exception as exc:
        result = None
        provider_error = type(exc).__name__

    if result is None and sop_id in REFERENCE_PROTOCOLS:
        # Curated OFFLINE FALLBACK: only reached when live retrieval found
        # nothing, and only for the one SOP with a stored transcription
        # (see sop_comparison.py's REFERENCE_PROTOCOLS / fallback_note).
        result = compare_sop_to_reference(sop_id, internal_steps, sim_fn=sim_fn)

    if result is None:
        # Last resort for every other SOP: compare against evidence titles
        # only, when no guideline document could be found or its abstract
        # yielded nothing extractable.
        try:
            evidence_records = await search_external_evidence(sop.title, max_results=15)
        except Exception as exc:
            evidence_records = []
            provider_error = type(exc).__name__
        result = compare_sop_to_dynamic_evidence(sop_id, internal_steps, evidence_records, sim_fn=sim_fn)

    if result is None:
        if not internal_steps:
            # Blames the right side: an SOP with no parsed steps has
            # nothing to compare regardless of how good the evidence is -
            # the old single message pointed at "no evidence found" even
            # when the real problem was the SOP's own structured_json.
            reason_code = "no_internal_steps"
            reason = "This SOP has no parsed procedure steps, so no comparison could be built regardless of available evidence."
        elif provider_error:
            reason_code = "providers_unreachable"
            reason = (f"External evidence providers could not be reached ({provider_error}). "
                      "This is a connectivity problem, not a genuine absence of evidence - try again shortly.")
        else:
            reason_code = "no_qualifying_evidence"
            reason = ("No sufficiently strong or moderate-grade external evidence was found for this SOP's topic, "
                      "so no meaningful comparison could be built.")
        return {"available": False, "reason_code": reason_code, "reason": reason}

    log_activity(
        action="comparison_generated", sop_id=sop_id, sop_title=sop.title,
        details=f"{result['mode']}: {result['summary']['overall_alignment']}",
    )
    return {"available": True, "sop_title": sop.title, "sop_version": sop.version, **result}
