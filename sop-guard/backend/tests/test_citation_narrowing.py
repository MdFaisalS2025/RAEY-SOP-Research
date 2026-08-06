"""Tests for sentence-level citation narrowing (Q2.6):
build_numbered_spans + narrow_citation_spans in citation_tracker.py."""

from app.rag.citation_tracker import build_numbered_spans, narrow_citation_spans


def _fake_sim(_unused=None):
    """A fake sim_fn: word-overlap ratio (Jaccard-ish) between `a` and `b`
    - deterministic and threshold-crossing (>= 0.55 for genuinely similar
    sentences) without depending on a real embedding model."""
    def sim(a, b):
        wa = set(a.lower().split())
        wb = set(b.lower().split())
        if not wa or not wb:
            return 0.0
        return len(wa & wb) / len(wa | wb)
    return sim


def _records(*numbers):
    return [{"number": n} for n in numbers]


def test_narrow_citation_spans_locates_matching_sentence():
    raw_text = (
        "4. PROCEDURE\n"
        "Step 1: Screen for suspected sepsis using qSOFA criteria.\n"
        "Step 2: Measure serum lactate within one hour of recognition.\n"
        "Step 3: Obtain blood cultures before administering antibiotics.\n"
    )
    chunk_text = "4. PROCEDURE\nStep 2: Measure serum lactate within one hour of recognition."
    char_start = raw_text.index("Step 2:")
    char_end = char_start + len("Step 2: Measure serum lactate within one hour of recognition.")

    records = _records(1)
    spans = {1: {"char_start": char_start, "char_end": char_end, "raw_text": raw_text}}
    texts = {1: chunk_text}
    answer = "Measure serum lactate within one hour of recognition. [1]"

    narrow_citation_spans(answer, records, texts, spans, _fake_sim())

    rec = records[0]
    assert rec["passage_basis"] == "sentence_semantic"
    assert rec["passage_start"] is not None and rec["passage_end"] is not None
    assert raw_text[rec["passage_start"]:rec["passage_end"]] == "Step 2: Measure serum lactate within one hour of recognition."
    # Bounded to the chunk's own span - never before char_start or after char_end.
    assert char_start <= rec["passage_start"] < rec["passage_end"] <= char_end


def test_narrow_citation_spans_no_sim_fn_leaves_all_none():
    records = _records(1)
    spans = {1: {"char_start": 0, "char_end": 20, "raw_text": "x" * 20}}
    texts = {1: "some chunk text here"}

    narrow_citation_spans("An answer. [1]", records, texts, spans, None)

    rec = records[0]
    assert rec["passage_start"] is None
    assert rec["passage_end"] is None
    assert rec["passage_basis"] == ""
    assert rec["passage_similarity"] is None


def test_narrow_citation_spans_below_threshold_leaves_none():
    raw_text = "Step 1: Do something completely unrelated to the answer sentence."
    records = _records(1)
    spans = {1: {"char_start": 0, "char_end": len(raw_text), "raw_text": raw_text}}
    texts = {1: raw_text}

    def never_matches(a, b):
        return 0.1  # below _PASSAGE_SIM_THRESHOLD (0.55)

    narrow_citation_spans("An unrelated answer sentence entirely. [1]", records, texts, spans, never_matches)

    rec = records[0]
    assert rec["passage_start"] is None
    assert rec["passage_basis"] == ""


def test_narrow_citation_spans_missing_chunk_offsets_leaves_none():
    # A chunk with no offsets at all (e.g. a summary/step_sequence chunk,
    # which never gets char_start/char_end) must not produce a fabricated
    # passage span.
    records = _records(1)
    spans = {1: {"char_start": None, "char_end": None, "raw_text": ""}}
    texts = {1: "Measure lactate within one hour."}

    narrow_citation_spans("Measure lactate within one hour. [1]", records, texts, spans, _fake_sim())

    rec = records[0]
    assert rec["passage_start"] is None
    assert rec["passage_basis"] == ""


def test_build_numbered_spans_dedupes_and_numbers_like_build_numbered_context():
    chunks = [
        {"sop_id": "A", "chunk_index": 0, "text": "first chunk text",
         "char_start": 5, "char_end": 25, "sop_raw_text": "x" * 30},
        {"sop_id": "A", "chunk_index": 0, "text": "first chunk text",  # duplicate, same id
         "char_start": 999, "char_end": 1000, "sop_raw_text": "y" * 30},
        {"sop_id": "B", "chunk_index": 0, "text": "second chunk text",
         "char_start": None, "char_end": None, "sop_raw_text": ""},
    ]
    spans = build_numbered_spans(chunks)
    assert set(spans.keys()) == {1, 2}
    assert spans[1] == {"char_start": 5, "char_end": 25, "raw_text": "x" * 30}
    assert spans[2] == {"char_start": None, "char_end": None, "raw_text": ""}
