"""Tests for citation_tracker.auto_insert_citations - the server-side
safety net that fills in [N] markers for sentences the model left
uncited, using the same similarity signal the faithfulness checker uses.
"""

from app.rag.citation_tracker import auto_insert_citations, build_numbered_texts, extract_citations


def _fake_sim(sentence: str, chunk_text: str) -> float:
    """Deterministic stand-in for a real embedding similarity function:
    shared-word overlap ratio, high enough to cross the 0.55 threshold
    when the sentence and chunk share their distinctive vocabulary."""
    s_words = set(sentence.lower().split())
    c_words = set(chunk_text.lower().split())
    if not s_words:
        return 0.0
    return len(s_words & c_words) / len(s_words)


def test_inserts_marker_for_uncited_sentence():
    answer = "Norepinephrine is the first-line vasopressor for septic shock."
    numbered_texts = {1: "Norepinephrine is the first-line vasopressor for septic shock, start at 0.05 mcg/kg/min."}
    result = auto_insert_citations(answer, numbered_texts, _fake_sim, threshold=0.5)
    assert "[1]" in result


def test_leaves_already_cited_sentences_alone():
    answer = "Norepinephrine is first-line. [1] Vasopressin is second-line."
    numbered_texts = {
        1: "Norepinephrine is first-line vasopressor.",
        2: "Vasopressin is the second-line agent added above 0.5 mcg/kg/min.",
    }
    result = auto_insert_citations(answer, numbered_texts, _fake_sim, threshold=0.3)
    # First sentence's existing [1] is untouched (not duplicated)
    assert result.count("[1]") == 1
    # Second, previously-uncited sentence gets its own marker
    assert "[2]" in result


def test_no_op_without_similarity_function():
    answer = "Some clinical statement without any citation marker at all here."
    numbered_texts = {1: "Some clinical statement without any citation marker at all here."}
    result = auto_insert_citations(answer, numbered_texts, None)
    assert result == answer


def test_skips_short_and_boilerplate_lines():
    answer = "Source: Sepsis Management Protocol\n\n---\nResearch prototype disclaimer text here."
    numbered_texts = {1: "Sepsis Management Protocol source text."}
    result = auto_insert_citations(answer, numbered_texts, _fake_sim, threshold=0.1)
    assert "[1]" not in result


def test_build_numbered_texts_matches_dedup_order():
    chunks = [
        {"sop_id": "A", "section_title": "S1", "chunk_index": 0, "text": "First chunk text."},
        {"sop_id": "A", "section_title": "S1", "chunk_index": 0, "text": "First chunk text."},  # dup
        {"sop_id": "B", "section_title": "S2", "chunk_index": 1, "text": "Second chunk text."},
    ]
    texts = build_numbered_texts(chunks)
    assert texts == {1: "First chunk text.", 2: "Second chunk text."}


def test_inserted_markers_get_validated_by_extract_citations():
    """End-to-end: a marker auto_insert_citations adds should pass through
    extract_citations exactly like one the model wrote, and mark the
    corresponding record as cited_in_answer."""
    answer = "Norepinephrine is the first-line vasopressor for septic shock."
    numbered_texts = {1: "Norepinephrine is the first-line vasopressor for septic shock, start at 0.05 mcg/kg/min."}
    cited_answer = auto_insert_citations(answer, numbered_texts, _fake_sim, threshold=0.5)

    citation_records = [{"number": 1, "sop_title": "Sepsis SOP", "cited_in_answer": False}]
    cleaned, updated = extract_citations(cited_answer, citation_records)
    assert updated[0]["cited_in_answer"] is True
    assert "[1]" in cleaned
