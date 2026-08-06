"""Tests for the numbered citation tracker: numbering, dedupe, invalid stripping."""

from app.rag.citation_tracker import (
    build_numbered_context, extract_citations, attach_citation_numbers, citation_coverage,
)


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


def test_citation_records_carry_offset_fields_when_present():
    chunks = _chunks()
    chunks[0]["char_start"] = 10
    chunks[0]["char_end"] = 45
    chunks[0]["offset_source"] = "verbatim"
    _, records = build_numbered_context(chunks)
    assert records[0]["char_start"] == 10
    assert records[0]["char_end"] == 45
    assert records[0]["offset_source"] == "verbatim"


def test_citation_records_preserve_none_offsets_without_fabricating():
    # Real chunks (e.g. summary/step_sequence) never set char_start/end -
    # the records must carry None through, never coerce to 0.
    _, records = build_numbered_context(_chunks())
    for r in records:
        assert r["char_start"] is None
        assert r["char_end"] is None
        assert r["offset_source"] == ""


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


def test_attach_citation_numbers_binds_trailing_marker():
    answer = "1. Contact: private room or cohort. [1]\n2. Contact: don gloves. [1]\n3. No marker here."
    sentences = [
        {"text": "Contact: private room or cohort."},
        {"text": "Contact: don gloves."},
        {"text": "No marker here."},
    ]
    attach_citation_numbers(answer, sentences)
    assert sentences[0]["citation_numbers"] == [1]
    assert sentences[1]["citation_numbers"] == [1]
    assert sentences[2]["citation_numbers"] == []


def test_attach_citation_numbers_multiple_markers():
    answer = "Combined finding from two sources. [1][2] Another line."
    sentences = [{"text": "Combined finding from two sources."}, {"text": "Another line."}]
    attach_citation_numbers(answer, sentences)
    assert sentences[0]["citation_numbers"] == [1, 2]
    assert sentences[1]["citation_numbers"] == []


def test_attach_citation_numbers_sentence_not_found_is_safe():
    sentences = [{"text": "This text is not in the answer at all."}]
    attach_citation_numbers("Completely different answer text.", sentences)
    assert sentences[0]["citation_numbers"] == []


class TestCitationCoverage:
    """Real bug (found empirically while diagnosing a D6 corpus-expansion
    test failure): the sentence-splitting regex fired on the whitespace
    between a sentence-ending period and a trailing "[N]" marker - e.g.
    "...organism. [1]" split into "...organism." and "[1]" as two separate
    fragments. The 3-character "[1]" fragment failed the length filter and
    was dropped, so the sentence it was marking was counted as uncited even
    though every mock-generated line ends exactly this way (". [N]"). This
    was silently broken for the entire deterministic mock-mode answer
    format the whole time - it just wasn't caught because a live-LLM
    answer's different sentence shape occasionally kept the RAGAS-lite
    aggregate average above zero."""

    def test_marker_immediately_after_sentence_period_counts(self):
        answer = "Norepinephrine starting dose is 0.05 mcg/kg/min, titrated to target. [1]"
        assert citation_coverage(answer) == 1.0

    def test_multiple_bullet_lines_each_with_trailing_marker(self):
        answer = (
            "- Norepinephrine starting dose is 0.05 mcg/kg/min, titrated to target. [1]\n"
            "- MAP target is >=65 mmHg, initiate vasopressor if below target. [4]\n"
        )
        assert citation_coverage(answer) == 1.0

    def test_numbered_step_lines_with_trailing_marker(self):
        answer = (
            "1. Contact: private room or cohort with same organism. [1]\n"
            "2. Contact: don gloves and gown before entering room. [1]\n"
        )
        assert citation_coverage(answer) == 1.0

    def test_sentence_with_no_marker_is_uncited(self):
        answer = "This is a substantive sentence with no citation marker at all."
        assert citation_coverage(answer) == 0.0

    def test_mixed_cited_and_uncited_sentences(self):
        answer = (
            "This substantive sentence has a citation marker attached. [1]\n"
            "This other substantive sentence has no marker attached at all.\n"
        )
        assert citation_coverage(answer) == 0.5
