"""Tests for the word-level redline diff (app/services/text_diff.py)."""

from app.services.text_diff import compute_word_diff, diff_stats


def test_identical_text_is_all_equal():
    segments = compute_word_diff("Give 500mL bolus.", "Give 500mL bolus.")
    assert len(segments) == 1
    assert segments[0]["type"] == "equal"


def test_word_replaced():
    segments = compute_word_diff("Give 500mL bolus.", "Give 1000mL bolus.")
    types = [s["type"] for s in segments]
    assert "delete" in types and "insert" in types
    deleted = "".join(s["text"] for s in segments if s["type"] == "delete")
    inserted = "".join(s["text"] for s in segments if s["type"] == "insert")
    assert "500mL" in deleted
    assert "1000mL" in inserted


def test_appended_sentence_is_pure_insert():
    old = "Start norepinephrine at 0.05 mcg/kg/min."
    new = "Start norepinephrine at 0.05 mcg/kg/min. Titrate to MAP >=65."
    segments = compute_word_diff(old, new)
    assert segments[0]["type"] == "equal"
    assert segments[-1]["type"] == "insert"
    assert "Titrate" in segments[-1]["text"]


def test_empty_old_text_is_pure_insert():
    segments = compute_word_diff("", "Brand new SOP text.")
    assert len(segments) == 1
    assert segments[0]["type"] == "insert"


def test_diff_stats_counts_words():
    segments = compute_word_diff("Give 500mL bolus.", "Give 1000mL bolus now.")
    stats = diff_stats(segments)
    assert stats["words_added"] >= 1
    assert stats["words_removed"] >= 1


def test_reassembled_text_matches_originals():
    """Concatenating all-old-side segments should reproduce old_text, and
    likewise for new_text - the tokenizer must not lose/duplicate text."""
    old = "Step 1: don gloves. Step 2: don gown. Step 3: enter room."
    new = "Step 1: don gloves and gown. Step 2: enter room carefully."
    segments = compute_word_diff(old, new)
    reconstructed_old = "".join(s["text"] for s in segments if s["type"] in ("equal", "delete"))
    reconstructed_new = "".join(s["text"] for s in segments if s["type"] in ("equal", "insert"))
    assert reconstructed_old == old
    assert reconstructed_new == new
