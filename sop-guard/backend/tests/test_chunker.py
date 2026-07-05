"""Tests that the SOP-aware chunker produces typed chunks."""

from app.rag.chunker import create_sop_chunks

SAMPLE_RAW = """SEPSIS MANAGEMENT PROTOCOL

1. SCREENING
Screen all patients with qSOFA. If qSOFA >= 2 escalate.

2. TREATMENT
Administer broad-spectrum antibiotics within 1 hour.
Maximum norepinephrine dose is 3 mcg/kg/min.
"""

SAMPLE_STRUCTURED = {
    "steps": [
        {"step_number": 1, "text": "Screen with qSOFA."},
        {"step_number": 2, "text": "Give antibiotics within 1 hour."},
    ],
    "thresholds": [{"value": "3 mcg/kg/min", "context": "max norepinephrine dose"}],
    "contraindications": [{"text": "Avoid fluids in cardiogenic shock"}],
}


def test_chunker_yields_typed_chunks():
    chunks = create_sop_chunks(
        raw_text=SAMPLE_RAW,
        structured=SAMPLE_STRUCTURED,
        sop_id="SOP-TEST-1",
        sop_title="Sepsis Management Protocol",
        department="ICU",
    )
    assert len(chunks) > 0
    types = {c["chunk_type"] for c in chunks}
    # Expect the key typed chunks to appear.
    assert "summary" in types
    assert "step" in types
    assert "threshold" in types
    assert "contraindication" in types


def test_every_chunk_has_required_fields():
    chunks = create_sop_chunks(
        raw_text=SAMPLE_RAW,
        structured=SAMPLE_STRUCTURED,
        sop_id="SOP-TEST-1",
        sop_title="Sepsis Management Protocol",
    )
    for c in chunks:
        assert c.get("text")
        assert c.get("chunk_type")
        assert c.get("chunk_id")
