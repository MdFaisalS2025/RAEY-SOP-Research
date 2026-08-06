"""Tests for citation deep-linking character offsets (Phase P3).

Guards specifically against the match.start() off-by-one this replaced
(the section regex's leading `(?:^|\\n)` made the old offsets one
character early), and against ever fabricating an offset for chunk types
that don't have one contiguous span in the source document.
"""

from app.rag.chunker import create_sop_chunks, _locate_span, _anchor_for, _locate_step_by_number, _containment

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


def _chunks():
    return create_sop_chunks(
        raw_text=SAMPLE_RAW,
        structured=SAMPLE_STRUCTURED,
        sop_id="SOP-TEST-1",
        sop_title="Sepsis Management Protocol",
        department="ICU",
    )


def test_section_chunk_offsets_point_at_the_section_title():
    """Regression guard for the match.start() vs match.start(1) off-by-one:
    raw_text[char_start:char_start+len(section_title)] must be the section
    title itself, not one character short/long."""
    chunks = _chunks()
    section_chunks = [c for c in chunks if c["chunk_type"] == "section"]
    assert section_chunks, "expected at least one section chunk"
    for c in section_chunks:
        assert c["char_start"] is not None
        assert c["char_end"] is not None
        assert c["char_end"] > c["char_start"]
        title = c["section_title"]
        located = SAMPLE_RAW[c["char_start"]:c["char_start"] + len(title)]
        assert located == title


def test_verbatim_step_chunks_contain_their_step_text():
    chunks = _chunks()
    step_chunks = [c for c in chunks if c["chunk_type"] == "step"]
    assert step_chunks
    for c in step_chunks:
        if c["offset_source"] != "verbatim":
            continue
        assert c["char_start"] is not None and c["char_end"] is not None
        span = SAMPLE_RAW[c["char_start"]:c["char_end"]]
        # The step's raw text (without the synthesized "Step N: " prefix)
        # must appear inside the located span.
        raw_step_text = c["text"].split(": ", 1)[1]
        assert raw_step_text in span


def test_summary_and_sequence_chunks_never_fabricate_offsets():
    chunks = _chunks()
    for c in chunks:
        if c["chunk_type"] in ("summary", "step_sequence", "threshold_sequence"):
            assert c["char_start"] is None
            assert c["char_end"] is None
            assert c["offset_source"] == ""


def test_full_text_chunk_spans_the_whole_document():
    chunks = _chunks()
    full = [c for c in chunks if c["chunk_type"] == "full_text"]
    assert full, "SAMPLE_RAW is well under the 8000-char full_text cutoff"
    c = full[0]
    assert c["char_start"] == 0
    assert c["char_end"] == len(SAMPLE_RAW)
    assert c["offset_source"] == "whole_doc"


def test_no_chunk_has_end_before_or_equal_to_start():
    chunks = _chunks()
    for c in chunks:
        if c["char_start"] is None:
            continue
        assert c["char_end"] > c["char_start"]


def test_locate_span_never_fabricates_when_needle_absent():
    start, end, source = _locate_span(SAMPLE_RAW, "text that does not appear anywhere")
    assert start is None
    assert end is None
    assert source == ""


def test_locate_span_finds_verbatim_match():
    needle = "Maximum norepinephrine dose is 3 mcg/kg/min."
    start, end, source = _locate_span(SAMPLE_RAW, needle)
    assert source == "verbatim"
    assert SAMPLE_RAW[start:end] == needle


def test_locate_span_finds_whitespace_normalized_match():
    # Same words, different internal spacing/line-wrap than the source.
    needle = "Maximum norepinephrine   dose is\n3 mcg/kg/min."
    start, end, source = _locate_span(SAMPLE_RAW, needle)
    assert source == "normalized"
    assert start is not None and end is not None
    assert "Maximum norepinephrine" in SAMPLE_RAW[start:end]


# ─── offset_anchor (Phase Q2.1) ─────────────────────────────────────────────
# Bug A: the frontend sanity check used to compare a chunk's stored offsets
# against its *display* snippet, which is title-prefixed for section chunks
# ("{sop_title} - {section_title}:\n{section_text}") - so the check rejected
# every correctly-located section offset in the corpus. offset_anchor is a
# verbatim, un-prefixed slice of raw_text at the stored span, purpose-built
# for that comparison.

def test_every_offset_chunk_has_a_matching_anchor():
    """raw_text.startswith(anchor, char_start) must hold for every chunk
    that has offsets - the exact property the frontend's sanity check
    relies on."""
    chunks = _chunks()
    checked = 0
    for c in chunks:
        if c["char_start"] is None:
            assert c["offset_anchor"] == ""
            continue
        assert c["offset_anchor"] != ""
        assert SAMPLE_RAW.startswith(c["offset_anchor"], c["char_start"])
        checked += 1
    assert checked > 0, "expected at least one offset-bearing chunk in the fixture"


def test_section_chunk_anchor_is_not_title_prefixed():
    """Regression guard for Bug A itself: a section chunk's anchor must
    reflect raw_text at char_start verbatim - it must never be built by
    prefixing the SOP title the way the chunk's display `text` field is
    ("{sop_title} - {section_title}:\n..."). Checked against the "1.
    SCREENING" section specifically (not the document's own title
    heading, which legitimately starts with "SEPSIS MANAGEMENT
    PROTOCOL" in raw_text itself and would give a false pass/fail either
    way)."""
    chunks = _chunks()
    screening = next(c for c in chunks if c["chunk_type"] == "section" and c["section_title"] == "1. SCREENING")
    assert screening["offset_anchor"].startswith("1. SCREENING")
    assert not screening["offset_anchor"].lower().startswith("sepsis management protocol - 1. screening")


def test_anchor_for_returns_empty_string_when_span_is_none():
    assert _anchor_for(SAMPLE_RAW, None, None) == ""
    assert _anchor_for(SAMPLE_RAW, 0, None) == ""


def test_anchor_for_caps_at_anchor_len():
    from app.rag.chunker import _ANCHOR_LEN
    long_text = "x" * 500
    anchor = _anchor_for(long_text, 0, 500)
    assert len(anchor) == _ANCHOR_LEN


# ─── step-number anchoring (Phase Q2.2) ─────────────────────────────────────
# _locate_span alone can't find a paraphrased step (structured_json's steps
# are editorial paraphrases of raw_text, not verbatim slices) - the demo
# corpus measured 216 of 219 step chunks unlocatable before this rung
# existed. _locate_step_by_number anchors to the SOP's own "Step N:"
# numbering instead, gated by a containment check so a mismatched/reordered
# SOP still returns NULL rather than confidently pointing at the wrong step.

def test_step_anchor_covers_paraphrased_demo_steps():
    """Ground truth from the real demo corpus (backend/app/demo_data/
    demo_sops.py, 22 SOPs): running create_sop_chunks over every one
    should locate all but a small residual of the 219 step chunks -
    216 via the step_anchor rung, 3 already verbatim."""
    from app.demo_data.demo_sops import DEMO_SOPS

    total_steps = 0
    unlocated = 0
    for sop in DEMO_SOPS:
        chunks = create_sop_chunks(
            raw_text=sop["raw_text"],
            structured=sop.get("structured_json") or {},
            sop_id=sop["sop_id"],
            sop_title=sop["title"],
            department=sop.get("department", ""),
            version=sop.get("version", ""),
        )
        for c in chunks:
            if c["chunk_type"] != "step":
                continue
            total_steps += 1
            if c["char_start"] is None:
                unlocated += 1

    assert total_steps >= 200
    assert unlocated <= 19, f"expected >=200/219 step chunks locatable, got {total_steps - unlocated}/{total_steps}"


def test_step_anchor_locates_a_paraphrased_step():
    raw = "1. PROCEDURE\nStep 1: Screen for sepsis using qSOFA (altered mentation, systolic BP <=100 mmHg, respiratory rate >=22/min). If qSOFA >=2, proceed to full SOFA assessment.\nStep 2: Obtain blood cultures.\n"
    paraphrase = "Screen with qSOFA (altered mentation, SBP <=100, RR >=22). If qSOFA >=2, perform full SOFA assessment."
    start, end, source = _locate_step_by_number(raw, 1, paraphrase)
    assert source == "step_anchor"
    assert start is not None and end is not None
    assert raw[start:end].startswith("Step 1:")
    assert "qSOFA" in raw[start:end]


def test_step_anchor_rejects_mismatched_numbering():
    """A "Step 3:" marker whose content has nothing to do with the
    paraphrase must not be anchored to - the containment gate should
    reject it and return NULL rather than pointing at the wrong step."""
    raw = "Step 3: Document patient consent for the procedure in the chart.\n"
    unrelated_paraphrase = "Administer broad-spectrum antibiotics within one hour of sepsis recognition."
    start, end, source = _locate_step_by_number(raw, 3, unrelated_paraphrase)
    assert start is None and end is None and source == ""


def test_step_anchor_returns_none_when_step_number_absent():
    raw = "Step 1: Do the first thing.\nStep 2: Do the second thing.\n"
    start, end, source = _locate_step_by_number(raw, 5, "Do the fifth thing.")
    assert start is None and end is None and source == ""


def test_containment_is_asymmetric():
    """The gate measures how much of the (short) paraphrase's vocabulary
    the (long) raw block covers - not the reverse, and not a symmetric
    overlap ratio. A short paraphrase fully covered by a much longer raw
    block should score 1.0 even though the raw block introduces many
    words the paraphrase never used."""
    paraphrase = "Measure lactate"
    raw_block = "Step 3: Measure serum lactate level within one hour of triage. If lactate exceeds 2 mmol/L, repeat within two to four hours."
    assert _containment(paraphrase, raw_block) == 1.0
