"""
Meridian OpenEvidence Provider (architecture-ready placeholder)
-------------------------------------------------------------------
OpenEvidence (openevidence.com) provides evidence-grounded clinical answers
from trusted medical sources, but there is no public API this project can
call - no API key, no documented endpoint, no organization account. This
module exists so the *shape* of a real integration is already in place
(same EvidenceSource ABC every other source implements, same registry
slot), without pretending one exists.

search() always returns [] here. This is deliberate, not a stub bug: a
"MockOpenEvidenceProvider" that fabricates plausible-looking search results
would be indistinguishable from a real integration in the UI, which is
exactly the misleading impression this module exists to avoid. If a real
OpenEvidence API becomes available, implement search() for real here (using
OPENEVIDENCE_API_KEY/BASE_URL/ORG_ID from app.config) and flip its status
in provider_status() below - everything else (registry wiring, UI provider
list) is already ready for that.

Research prototype. Not for clinical use.
"""

from typing import Any

from app.config import settings
from app.integrations.evidence_source import EvidenceSource

OPENEVIDENCE_NOTES = (
    "No public OpenEvidence API is configured in this deployment. This provider is "
    "architecture-ready and will activate automatically once OPENEVIDENCE_API_KEY and "
    "OPENEVIDENCE_BASE_URL are set and a real integration is implemented."
)


class OpenEvidenceSource(EvidenceSource):
    source_type = "openevidence"
    display_name = "OpenEvidence"

    async def search(self, term: str, max_results: int = 5) -> list[dict[str, Any]]:
        # Deliberately always empty - see module docstring. Never returns
        # fabricated results, regardless of whether env vars are set.
        return []


def provider_status() -> dict[str, Any]:
    """Honest status for GET /api/evidence/providers - never reports
    "active" here, since no code path actually calls a real OpenEvidence
    API yet, even if OPENEVIDENCE_API_KEY happens to be set."""
    configured = bool(settings.OPENEVIDENCE_API_KEY and settings.OPENEVIDENCE_BASE_URL)
    return {
        "key": "openevidence",
        "name": "OpenEvidence",
        "status": "requires_api_key" if configured else "not_configured",
        "capabilities": ["evidence-grounded clinical Q&A (not yet implemented)"],
        "requires": ["OPENEVIDENCE_API_KEY", "OPENEVIDENCE_BASE_URL"],
        "notes": OPENEVIDENCE_NOTES,
    }
