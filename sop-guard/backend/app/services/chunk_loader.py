"""
Shared helper: load all SOP chunks (and structured SOP data) from the DB
in the dict shape expected by the retrieval pipeline.

Research prototype. Not for clinical use.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import SOP, SOPChunk


async def load_chunks(db: AsyncSession) -> tuple[list[dict], dict[str, dict]]:
    chunk_rows = (await db.execute(
        select(
            SOPChunk, SOP.sop_id.label("sop_sop_id"), SOP.title.label("sop_title"), SOP.structured_json,
            SOP.version, SOP.effective_date, SOP.review_date, SOP.status,
        )
        .join(SOP, SOPChunk.sop_id == SOP.id)
    )).all()

    chunks: list[dict] = []
    structured_sops: dict[str, dict] = {}
    for row in chunk_rows:
        chunk = row[0]
        chunks.append({
            "chunk_text": chunk.chunk_text,
            "text": chunk.chunk_text,
            "section_title": chunk.section_title,
            "sop_title": row.sop_title,
            "sop_id": row.sop_sop_id,
            "chunk_type": getattr(chunk, "chunk_type", "section") or "section",
            "chunk_index": chunk.chunk_index,
            "version": row.version or "",
            "effective_date": row.effective_date or "",
            "review_date": row.review_date or "",
            "status": row.status or "active",
        })
        if row.sop_sop_id not in structured_sops and row.structured_json:
            structured_sops[row.sop_sop_id] = row.structured_json
    return chunks, structured_sops
