"""
SOP-Guard SMART on FHIR Launch Simulation
--------------------------------------------
Simulates the SMART App Launch handshake (https://hl7.org/fhir/smart-app-launch/)
for demo purposes only, since there is no real EHR sandbox wired up here.

Production SMART launch requires a real EHR sandbox (e.g. Epic on FHIR,
the SMART Health IT sandbox) to perform the actual OAuth2 authorization
code exchange against a FHIR authorization server. This module only
validates that the expected launch parameters are present and returns
simulated context, it does not perform any real authentication.

Research prototype  - NOT for clinical use.
"""

import secrets

from fastapi import APIRouter, HTTPException, Query as QueryParam

router = APIRouter(tags=["SMART on FHIR"])

SIM_PATIENT = "sim-patient-12"
SIM_ENCOUNTER = "sim-encounter-7"


@router.get("/smart/launch")
async def smart_launch(
    iss: str = QueryParam(..., description="FHIR issuer / base URL"),
    launch: str = QueryParam(..., description="Opaque EHR launch id"),
):
    """Simulated SMART App Launch entry point.

    Validates that `iss` and `launch` are present (as a real EHR launch
    would supply) and returns a redirect-style payload pointing at the
    simulated authorize endpoint, with simulated launch context.
    """
    if not iss or not launch:
        raise HTTPException(status_code=400, detail="iss and launch are required.")

    state = secrets.token_urlsafe(16)
    return {
        "authorization_url": f"/smart/authorize?state={state}",
        "launch_context": {
            "patient": SIM_PATIENT,
            "encounter": SIM_ENCOUNTER,
        },
    }


@router.get("/smart/authorize")
async def smart_authorize(state: str | None = QueryParam(None)):
    """Simulated token response for the SMART launch demo.

    In production this would be a real OAuth2 authorization code / token
    exchange against the EHR's FHIR authorization server.
    """
    return {
        "access_token": "sop-guard-demo-token",
        "patient": SIM_PATIENT,
        "scope": "patient/*.read launch",
    }
