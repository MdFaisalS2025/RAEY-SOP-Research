"""
Meridian Privacy Routes
-----------------------
Backs the Ask Meridian composer's PHI indicator. Scans free text for likely
Protected Health Information (PHI) / direct identifiers using the rule-based,
OpenMed-inspired guard (app/privacy/phi_guard.py) and returns a redacted copy.

Stateless and LLM-free: no query text is persisted or forwarded anywhere by
this endpoint - it exists precisely so PHI can be caught *before* a question
reaches the model.

Research prototype. Not for clinical use.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.privacy.phi_guard import scan, get_phi_provider

router = APIRouter(prefix="/api/privacy", tags=["Privacy"])

# Cap the scanned length so a pathological paste can't tie up the regex engine;
# the composer never sends more than a question's worth of text anyway.
_MAX_SCAN_CHARS = 4000


class ScanRequest(BaseModel):
    text: str = ""


@router.post("/scan")
async def scan_text(req: ScanRequest):
    """Detect + redact PHI in `text`. Returns has_phi, per-span type/offsets,
    and a redacted copy the client can drop into the composer."""
    return scan((req.text or "")[:_MAX_SCAN_CHARS])


@router.get("/status")
async def privacy_status():
    """Honest provider status for the Settings/provider surface."""
    provider = get_phi_provider()
    return {
        "phi_guard": provider.name,
        "active": True,
        "openmed_integrated": False,
        "note": (
            "Rule-based, OpenMed-inspired heuristic detector. Catches common "
            "direct identifiers (name, MRN, dates, phone, email, SSN, address) "
            "before a question reaches the model. Not exhaustive or "
            "clinical-grade de-identification."
        ),
    }
