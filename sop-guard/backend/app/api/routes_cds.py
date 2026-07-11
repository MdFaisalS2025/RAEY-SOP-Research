"""
Meridian CDS Hooks Service
---------------------------
Standard-compliant CDS Hooks v2 discovery + order-select service.
https://cds-hooks.org

Research prototype. Not for clinical use.
"""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.rag.hybrid_retriever import HybridRetriever
from app.rag.entity_graph import DRUG_LEXICON, build_graph, find_conflicts
from app.services.chunk_loader import load_chunks

router = APIRouter(tags=["CDS Hooks"])

SERVICE_ID = "meridian-protocol-check"


@router.get("/cds-services")
async def cds_discovery():
    """CDS Hooks discovery endpoint."""
    return {
        "services": [
            {
                "hook": "order-select",
                "title": "Meridian Protocol Check",
                "description": (
                    "Checks draft medication orders against hospital SOPs and "
                    "flags protocol guidance, thresholds, and cross-SOP conflicts. "
                    "Research prototype. Not for clinical use."
                ),
                "id": SERVICE_ID,
            }
        ]
    }


def _extract_medication(body: dict[str, Any]) -> tuple[str, str]:
    """Extract (medication, dose) from a CDS Hooks request or the simple fallback."""
    medication = ""
    dose = ""
    try:
        context = body.get("context", {}) or {}

        # Standard: context.draftOrders is a FHIR Bundle
        draft = context.get("draftOrders", {}) or {}
        entries = draft.get("entry", []) if isinstance(draft, dict) else []
        for entry in entries:
            resource = (entry or {}).get("resource", {}) or {}
            med_cc = resource.get("medicationCodeableConcept", {}) or {}
            text = med_cc.get("text", "")
            if not text:
                for coding in med_cc.get("coding", []) or []:
                    if coding.get("display"):
                        text = coding["display"]
                        break
            if text:
                medication = text
                for di in resource.get("dosageInstruction", []) or []:
                    if di.get("text"):
                        dose = di["text"]
                        break
                break

        # Simple fallback shapes
        if not medication:
            medication = body.get("medication", "") or context.get("medication", "")
            dose = dose or body.get("dose", "") or context.get("dose", "")
    except Exception:
        pass
    return (medication or "").strip(), (dose or "").strip()


def _match_drug(medication: str) -> str:
    """Match the free-text medication name against the drug lexicon."""
    med = medication.lower()
    for drug in DRUG_LEXICON:
        if drug in med:
            return drug
    return med.split()[0] if med else ""


@router.post(f"/cds-services/{SERVICE_ID}")
async def protocol_check(body: dict, db: AsyncSession = Depends(get_db)):
    """CDS Hooks order-select service: return SOP guidance cards."""
    medication, dose = _extract_medication(body if isinstance(body, dict) else {})
    if not medication:
        return {"cards": []}

    drug = _match_drug(medication)

    try:
        chunks, _ = await load_chunks(db)
    except Exception:
        chunks = []
    if not chunks:
        return {"cards": []}

    # Retrieve SOP guidance for the medication
    query = f"{medication} dose administration protocol"
    if dose:
        query += f" {dose}"
    try:
        retriever = HybridRetriever(chunks)
        retrieved = retriever.search(query, top_k=5, query_type="medication")
    except Exception:
        retrieved = []

    # Keep chunks that actually mention the drug, fall back to top hits
    relevant = [
        c for c in retrieved
        if drug and drug in (c.get("chunk_text") or c.get("text") or "").lower()
    ] or retrieved[:2]

    # Entity-graph conflict check for this drug
    indicator = "info"
    conflict_msgs: list[str] = []
    try:
        graph = build_graph(chunks)
        for c in find_conflicts(graph):
            if c["type"] == "DRUG" and c["entity"] == drug:
                indicator = "critical"
                conflict_msgs.append(c["message"])
    except Exception:
        pass

    if indicator != "critical" and any(
        (c.get("chunk_type") or "") in ("threshold", "contraindication")
        for c in relevant
    ):
        indicator = "warning"

    cards = []
    for c in relevant[:3]:
        text = (c.get("chunk_text") or c.get("text") or "").strip()
        detail = text[:300]
        if conflict_msgs:
            detail = (conflict_msgs[0] + " " + detail)[:300]
        cards.append({
            "summary": f"{c.get('sop_title', 'SOP guidance')}: {c.get('section_title') or medication}"[:140],
            "indicator": indicator,
            "detail": detail,
            "source": {"label": "Meridian", "url": "http://localhost:3000/library"},
            "links": [
                {
                    "label": "View full SOP",
                    "url": "http://localhost:3000/library",
                    "type": "absolute",
                }
            ],
        })

    return {"cards": cards}
