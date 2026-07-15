"""Tests for app/services/query_decomposition.py."""

from app.services.query_decomposition import split_multi_part_query


def test_splits_on_and_before_question_word():
    parts = split_multi_part_query("What is the max dose and when should I escalate?")
    assert parts == ["What is the max dose", "when should I escalate?"]


def test_splits_on_semicolon():
    parts = split_multi_part_query("What is the max dose; when should I escalate?")
    assert len(parts) == 2


def test_does_not_split_compound_noun_phrase():
    assert split_multi_part_query("What are the signs and symptoms of sepsis?") == []


def test_does_not_split_single_question():
    assert split_multi_part_query("What is the maximum norepinephrine dose?") == []


def test_caps_at_max_parts():
    q = "What is A and when is B and how is C and why is D?"
    parts = split_multi_part_query(q)
    assert len(parts) <= 3
