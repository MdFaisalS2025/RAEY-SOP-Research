"""
Meridian Application Settings
------------------------------------
Process-lifetime settings store for the handful of Settings-page controls
that actually change pipeline behavior (confidence threshold, which
evidence sources are queried). Same in-memory-store pattern as
services/activity.py - a real research prototype, not backed by a
database migration, but genuinely read by the pipeline/evidence registry
on every request rather than just displayed.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

from app.integrations.evidence_registry import source_names

DEFAULT_CONFIDENCE_THRESHOLD = 0.6

_state: dict = {
    "confidence_threshold": DEFAULT_CONFIDENCE_THRESHOLD,
    "enabled_evidence_sources": set(source_names()),
}


def get_confidence_threshold() -> float:
    return _state["confidence_threshold"]


def get_enabled_evidence_sources() -> list[str]:
    enabled = _state["enabled_evidence_sources"]
    return [s for s in source_names() if s in enabled]


def get_settings() -> dict:
    return {
        "confidence_threshold": _state["confidence_threshold"],
        "enabled_evidence_sources": sorted(_state["enabled_evidence_sources"]),
        "all_evidence_sources": source_names(),
    }


def update_settings(confidence_threshold: float | None = None, enabled_evidence_sources: list[str] | None = None) -> dict:
    if confidence_threshold is not None:
        _state["confidence_threshold"] = max(0.0, min(1.0, confidence_threshold))
    if enabled_evidence_sources is not None:
        valid = set(source_names())
        _state["enabled_evidence_sources"] = {s for s in enabled_evidence_sources if s in valid}
    return get_settings()
