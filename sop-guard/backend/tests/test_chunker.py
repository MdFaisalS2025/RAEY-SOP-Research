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


class TestSopLevelClinicalEntities:
    """Real bug (P1.1): a bucket-style chunk (e.g. all thresholds for a SOP
    concatenated into one 'Clinical Thresholds and Values' chunk) often
    doesn't repeat the SOP's drug name on every line, so a literal-substring
    entity-grounding check failed even when the correct SOP was retrieved.
    Every chunk of a SOP should carry the SOP's own entities regardless of
    which specific chunk_type it is."""

    def test_every_chunk_carries_sop_level_entities(self):
        chunks = create_sop_chunks(
            raw_text=SAMPLE_RAW, structured=SAMPLE_STRUCTURED,
            sop_id="SOP-TEST-1", sop_title="Sepsis Management Protocol",
        )
        for c in chunks:
            assert "norepinephrine" in c.get("clinical_entities", []), c["chunk_type"]

    def test_entity_present_even_when_absent_from_that_specific_chunk_text(self):
        """Step 1's own chunk text ("Screen with qSOFA.") never mentions
        norepinephrine - it only appears elsewhere in the raw SOP text -
        but the chunk should still carry it as a SOP-level entity."""
        chunks = create_sop_chunks(
            raw_text=SAMPLE_RAW, structured=SAMPLE_STRUCTURED,
            sop_id="SOP-TEST-1", sop_title="Sepsis Management Protocol",
        )
        step1 = next(c for c in chunks if c["chunk_type"] == "step" and c["step_order"] == 1)
        assert "norepinephrine" not in step1["text"].lower()
        assert "norepinephrine" in step1["clinical_entities"]

    def test_no_entities_when_sop_names_none(self):
        raw = "GENERIC POLICY\n\n1. SCOPE\nApplies to all staff.\n"
        chunks = create_sop_chunks(
            raw_text=raw, structured={}, sop_id="SOP-TEST-2", sop_title="Generic Policy",
        )
        for c in chunks:
            assert c.get("clinical_entities") == []


class TestIndividualThresholdChunks:
    """Real bug (P2.5): a single bucket chunk concatenating every threshold
    for a SOP is topically diffuse - the cross-encoder reranker scores a
    multi-fact passage far lower than a focused single-fact one, even when
    the fact asked about is right there. Thresholds are now chunked
    individually (mirroring the existing per-step chunking), as natural
    sentences with the SOP title and abbreviation spelled out, both of
    which measurably improved reranker relevance scores."""

    _STRUCTURED = {
        "thresholds": [
            {"parameter": "MAP", "value": ">=65 mmHg", "action": "Initiate vasopressor if MAP <65 mmHg"},
            {"parameter": "Lactate", "value": ">2 mmol/L", "action": "Repeat within 2-4 hours"},
        ],
    }

    def test_one_chunk_per_threshold_entry(self):
        chunks = create_sop_chunks(
            raw_text="SEPSIS PROTOCOL", structured=self._STRUCTURED,
            sop_id="SOP-X", sop_title="Sepsis Management Protocol",
        )
        individual = [c for c in chunks if c["chunk_type"] == "threshold"]
        assert len(individual) == 2

    def test_individual_chunk_is_a_natural_sentence_with_title_and_action(self):
        chunks = create_sop_chunks(
            raw_text="SEPSIS PROTOCOL", structured=self._STRUCTURED,
            sop_id="SOP-X", sop_title="Sepsis Management Protocol",
        )
        map_chunk = next(c for c in chunks if c["chunk_type"] == "threshold" and "MAP" in c["text"])
        assert map_chunk["text"].startswith("Sepsis Management Protocol.")
        assert ">=65 mmHg" in map_chunk["text"]
        assert "Initiate vasopressor" in map_chunk["text"]  # action not silently dropped

    def test_known_abbreviation_is_spelled_out_inline(self):
        chunks = create_sop_chunks(
            raw_text="SEPSIS PROTOCOL", structured=self._STRUCTURED,
            sop_id="SOP-X", sop_title="Sepsis Management Protocol",
        )
        map_chunk = next(c for c in chunks if c["chunk_type"] == "threshold" and "MAP" in c["text"])
        assert "mean arterial pressure" in map_chunk["text"].lower()

    def test_combined_chunk_still_exists_as_threshold_sequence(self):
        """A broad 'what are all the thresholds' query still has one chunk
        covering every threshold at once - retyped so it doesn't compete
        with the individual chunks for the same boost weight."""
        chunks = create_sop_chunks(
            raw_text="SEPSIS PROTOCOL", structured=self._STRUCTURED,
            sop_id="SOP-X", sop_title="Sepsis Management Protocol",
        )
        combined = [c for c in chunks if c["chunk_type"] == "threshold_sequence"]
        assert len(combined) == 1
        assert "MAP" in combined[0]["text"]
        assert "Lactate" in combined[0]["text"]

    def test_unknown_abbreviation_is_left_unexpanded(self):
        structured = {"thresholds": [{"parameter": "XYZ", "value": "5 units", "action": ""}]}
        chunks = create_sop_chunks(
            raw_text="TEST", structured=structured, sop_id="SOP-X", sop_title="Test Protocol",
        )
        chunk = next(c for c in chunks if c["chunk_type"] == "threshold")
        assert "(" not in chunk["text"]  # no fabricated expansion
