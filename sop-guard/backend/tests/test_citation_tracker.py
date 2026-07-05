"""Tests for the numbered citation tracker: numbering, dedupe, invalid stripping."""

from app.rag.citation_tracker import build_numbered_context, extract_citations


def _chunks():
    return [
        {"sop_id": "A", "sop_title": "Sepsis SOP", "section_title": "Doses",
         "chunk_index": 0, "text": "Max norepinephrine dose is 3 mcg/kg/min."},
        {"sop_id": "B", "sop_title": "Transfusion SOP", "section_title": "Thresholds",
         "chunk_index": 0, "text": "Transfuse when hemoglobin is below 7 g/dL."},
    ]


def test_numbering_sequential():
    context, records = build_numbered_context(_chunks())
    assert [r["number"] for r in records] == [1, 2]
    assert "[1]" in context and "[2]" in context


def test_dedupe_identical_chunks():
    chunks = _chunks()
    # Duplicate the first chunk exactly.
    chunks.append(dict(chunks[0]))
    _, records = build_numbered_context(chunks)
    # Duplicate should be collapsed -> only 2 distinct citations.
    assert len(records) == 2


def test_valid_markers_kept_and_flagged():
    _, records = build_numbered_context(_chunks())
    answer = "The max dose is 3 mcg/kg/min [1]. Transfuse below 7 g/dL [2]."
    cleaned, updated = extract_citations(answer, records)
    assert "[1]" in cleaned and "[2]" in cleaned
    assert all(r["cited_in_answer"] for r in updated)


def test_invalid_marker_stripped():
    _, records = build_numbered_context(_chunks())
    answer = "Some claim [9] that is not backed by a real source."
    cleaned, updated = extract_citations(answer, records)
    assert "[9]" not in cleaned
    assert not any(r["cited_in_answer"] for r in updated)
