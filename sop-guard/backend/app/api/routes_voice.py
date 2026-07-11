"""
Meridian Voice Transcription Route
------------------------------------
Research prototype  - NOT for clinical use.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.config import settings
from app.schemas.schemas import TranscriptionResponse

router = APIRouter(tags=["Voice"])

# Mock transcriptions keyed by approximate audio length ranges
_MOCK_TRANSCRIPTIONS = [
    "What is the sepsis management protocol for ICU patients?",
    "What are the steps for medication administration?",
    "What is the maximum fluid resuscitation volume before reassessment?",
    "What are the contraindications for warfarin administration?",
    "Walk me through the emergency department triage procedure.",
]


@router.post("/api/voice/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Accept an audio file and return a transcription.
    In mock mode, returns a predetermined clinical query.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file.")

    # Estimate duration from file size (very rough: ~16KB/s for typical audio)
    estimated_duration = max(1.0, len(content) / 16000.0)

    if settings.WHISPER_MODE == "mock":
        # Select a mock transcription based on file size hash
        idx = len(content) % len(_MOCK_TRANSCRIPTIONS)
        text = _MOCK_TRANSCRIPTIONS[idx]

        return TranscriptionResponse(
            text=text,
            duration_seconds=round(estimated_duration, 1),
            mode="mock",
        )

    # API mode placeholder
    raise HTTPException(
        status_code=501,
        detail="Whisper API mode not yet implemented. Set WHISPER_MODE=mock.",
    )
