"""
Meridian Application Settings Routes
------------------------------------
Backs the handful of Settings-page controls that actually change pipeline
behavior at runtime: the evidence-sufficiency confidence threshold and
which external evidence sources are queried. See services/app_settings.py.

Research prototype. Not for clinical use.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.services.app_settings import get_settings, update_settings
from app.privacy.phi_guard import get_phi_provider
from app.models.models import StaffUser
from app.services.auth import require_permission

router = APIRouter(prefix="/api/settings", tags=["Settings"])


def _privacy_status() -> dict:
    """Honest privacy/provider status surfaced on the Settings page. Kept in
    sync with GET /api/privacy/status - both read the same live provider."""
    return {
        "phi_guard": get_phi_provider().name,
        "active": True,
        "openmed_integrated": False,
        "note": (
            "Rule-based, OpenMed-inspired heuristic. Flags common direct "
            "identifiers before a question reaches the model. Not exhaustive "
            "or clinical-grade de-identification."
        ),
    }


class SettingsUpdate(BaseModel):
    confidence_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    enabled_evidence_sources: list[str] | None = None


@router.get("")
async def read_settings():
    return {**get_settings(), "privacy": _privacy_status()}


@router.put("")
async def write_settings(
    payload: SettingsUpdate,
    user: StaffUser = Depends(require_permission("configure_system")),
):
    return update_settings(
        confidence_threshold=payload.confidence_threshold,
        enabled_evidence_sources=payload.enabled_evidence_sources,
    )
