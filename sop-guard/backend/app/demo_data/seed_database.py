"""
DISCLAIMER: SYNTHETIC / FICTIONAL DATA FOR RESEARCH ONLY
=========================================================
This script seeds the database with SYNTHETIC SOPs created for the
SOP-Guard research prototype.  The data must NOT be used for real
clinical decisions or patient care.
=========================================================
"""

from __future__ import annotations

import json
import logging
import textwrap
from datetime import date
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.demo_data.demo_sops import DEMO_SOPS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Chunking helper
# ---------------------------------------------------------------------------

def _chunk_text(raw_text: str, chunk_size: int = 500, overlap: int = 50) -> list[dict[str, Any]]:
    """
    Split *raw_text* into overlapping chunks suitable for embedding / RAG.

    Returns a list of dicts: {"chunk_index": int, "text": str, "char_start": int, "char_end": int}
    """
    chunks: list[dict[str, Any]] = []
    start = 0
    idx = 0
    while start < len(raw_text):
        end = min(start + chunk_size, len(raw_text))
        chunks.append({
            "chunk_index": idx,
            "text": raw_text[start:end],
            "char_start": start,
            "char_end": end,
        })
        idx += 1
        start += chunk_size - overlap
    return chunks


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def seed_demo_data(db: AsyncSession) -> None:
    """
    Populate the database with demo SOP data **if it is currently empty**.

    This function is safe to call on every startup  - it no-ops when data
    already exists.

    It attempts to import the ORM models from ``app.models``.  If the models
    module has not yet been fully defined (e.g., early prototype stage), it
    falls back to printing a summary and returning without writing to the DB.
    """
    # ---- Try to import the project's ORM models ----
    try:
        from app.models import SOP, SOPChunk  # type: ignore[attr-defined]
    except (ImportError, AttributeError):
        logger.warning(
            "SOP / SOPChunk models not found in app.models  - "
            "printing demo data summary instead of seeding DB."
        )
        _print_summary()
        return

    # ---- Check whether data already exists ----
    count_result = await db.execute(select(func.count()).select_from(SOP))
    existing_count = count_result.scalar_one()
    if existing_count > 0:
        logger.info(
            "Database already contains %d SOP(s); skipping demo seed.", existing_count
        )
        return

    # ---- Seed SOPs and chunks ----
    logger.info("Seeding database with %d demo SOPs ...", len(DEMO_SOPS))

    for sop_data in DEMO_SOPS:
        sop = SOP(
            sop_id=sop_data["sop_id"],
            title=sop_data["title"],
            department=sop_data["department"],
            version=sop_data["version"],
            effective_date=_parse_date(sop_data["effective_date"]),
            raw_text=sop_data["raw_text"],
            structured_json=json.dumps(sop_data["structured_json"]),
        )
        db.add(sop)
        await db.flush()  # ensure sop.id is available for FK

        chunks = _chunk_text(sop_data["raw_text"])
        for chunk in chunks:
            db.add(
                SOPChunk(
                    sop_id=sop.id,
                    chunk_index=chunk["chunk_index"],
                    text=chunk["text"],
                    char_start=chunk["char_start"],
                    char_end=chunk["char_end"],
                )
            )

    await db.commit()
    logger.info("Demo seed complete: %d SOPs inserted.", len(DEMO_SOPS))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_date(date_str: str) -> date:
    """Parse an ISO-format date string (YYYY-MM-DD)."""
    parts = date_str.split("-")
    return date(int(parts[0]), int(parts[1]), int(parts[2]))


def _print_summary() -> None:
    """Print a human-readable summary of the demo SOPs (fallback mode)."""
    print("\n" + "=" * 60)
    print("SOP-GUARD DEMO DATA SUMMARY (no DB write)")
    print("DISCLAIMER: Synthetic data for research only.")
    print("=" * 60)
    for sop in DEMO_SOPS:
        chunks = _chunk_text(sop["raw_text"])
        structured = sop["structured_json"]
        print(
            f"\n  {sop['sop_id']}  {sop['title']}"
            f"\n    Dept: {sop['department']}  |  Version: {sop['version']}"
            f"  |  Effective: {sop['effective_date']}"
            f"\n    Raw text length: {len(sop['raw_text'])} chars  |  Chunks: {len(chunks)}"
            f"\n    Steps: {len(structured['steps'])}  |  Thresholds: {len(structured['thresholds'])}"
            f"  |  Contraindications: {len(structured['contraindications'])}"
        )
    print("\n" + "=" * 60 + "\n")


# ---------------------------------------------------------------------------
# Standalone execution for quick testing
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    _print_summary()
