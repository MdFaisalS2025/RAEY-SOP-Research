"""
Meridian Application Settings Routes
------------------------------------
Backs the handful of Settings-page controls that actually change pipeline
behavior at runtime: the evidence-sufficiency confidence threshold and
which external evidence sources are queried. See services/app_settings.py.

Research prototype. Not for clinical use.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.app_settings import get_settings, update_settings

router = APIRouter(prefix="/api/settings", tags=["Settings"])


class SettingsUpdate(BaseModel):
    confidence_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    enabled_evidence_sources: list[str] | None = None


@router.get("")
async def read_settings():
    return get_settings()


@router.put("")
async def write_settings(payload: SettingsUpdate):
    return update_settings(
        confidence_threshold=payload.confidence_threshold,
        enabled_evidence_sources=payload.enabled_evidence_sources,
    )
