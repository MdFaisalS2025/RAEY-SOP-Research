"""
SOP-Guard Text Diff (Redline)
------------------------------
Word-level diff between two blocks of text, for the governance proposal
redline viewer (like Word's "Track Changes"). Uses only the stdlib
difflib - no new dependency needed for this.

Research prototype. Not for clinical use.
"""

import difflib
import re
from typing import TypedDict


class DiffSegment(TypedDict):
    type: str  # "equal" | "insert" | "delete"
    text: str


# Split on whitespace but keep it attached to the following token, so
# re-joining segments reproduces the original spacing exactly.
_TOKEN_RE = re.compile(r"\s*\S+|\s+$")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text or "")


def compute_word_diff(old_text: str, new_text: str) -> list[DiffSegment]:
    """
    Word-level redline diff between old_text and new_text.

    Returns a list of segments in display order: "equal" segments are
    unchanged text, "delete" segments were removed (render strikethrough),
    "insert" segments were added (render underlined). Adjacent tokens of
    the same type are merged into one segment for cleaner rendering.
    """
    old_tokens = _tokenize(old_text)
    new_tokens = _tokenize(new_text)

    matcher = difflib.SequenceMatcher(a=old_tokens, b=new_tokens, autojunk=False)
    segments: list[DiffSegment] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            segments.append({"type": "equal", "text": "".join(old_tokens[i1:i2])})
        elif tag == "delete":
            segments.append({"type": "delete", "text": "".join(old_tokens[i1:i2])})
        elif tag == "insert":
            segments.append({"type": "insert", "text": "".join(new_tokens[j1:j2])})
        elif tag == "replace":
            segments.append({"type": "delete", "text": "".join(old_tokens[i1:i2])})
            segments.append({"type": "insert", "text": "".join(new_tokens[j1:j2])})

    # Merge adjacent same-type segments (replace produces delete+insert
    # pairs per opcode, which can leave consecutive same-type runs).
    merged: list[DiffSegment] = []
    for seg in segments:
        if merged and merged[-1]["type"] == seg["type"]:
            merged[-1] = {"type": seg["type"], "text": merged[-1]["text"] + seg["text"]}
        elif seg["text"]:
            merged.append(seg)

    return merged


def diff_stats(segments: list[DiffSegment]) -> dict:
    """Word-count summary of a diff: how much was added/removed/unchanged."""
    added = sum(len(s["text"].split()) for s in segments if s["type"] == "insert")
    removed = sum(len(s["text"].split()) for s in segments if s["type"] == "delete")
    unchanged = sum(len(s["text"].split()) for s in segments if s["type"] == "equal")
    return {"words_added": added, "words_removed": removed, "words_unchanged": unchanged}
