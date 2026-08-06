"""
Real-corpus loader for the Phase U structural-anchoring pilot.

Loads the two real, public-domain CDC documents under raw/ and parses each
into (item_id, item_text, char_start, char_end) tuples using that document's
OWN numbering scheme - which differs between the two documents (this is
itself a real, useful property of a genuine external corpus, unlike the
demo corpus's single "Step N:" convention). char_start/char_end are ground
truth: computed directly by locating each parsed item in the same raw_text
string, so they are correct by construction, not estimated.

This is a genuinely different corpus from backend/app/demo_data/ - do not
import from demo_data here, and do not import this module from the main
application; it exists only for the research-evaluation harness in
pilot_eval.py, kept fully separate from Meridian's own SOP corpus so the two
can never be confused.
"""

import os
import re
from dataclasses import dataclass

_RAW_DIR = os.path.join(os.path.dirname(__file__), "raw")


@dataclass
class RealDocument:
    doc_id: str
    source_url: str
    raw_text: str
    items: list[dict]  # each: {"item_id": str, "text": str, "char_start": int, "char_end": int}


def _load_raw(filename: str) -> tuple[str, str]:
    """Return (metadata_header, body_text) - the file's leading metadata
    block (SOURCE:/URL:/... lines up to the '---' separator) is kept
    separate from the body, since ground-truth offsets must be computed
    against the body only (a real citation system wouldn't index the
    provenance header as part of the document)."""
    path = os.path.join(_RAW_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    header, _, body = content.partition("\n---\n")
    return header, body.strip("\n")


def _parse_core_practices(body: str, offset: int = 0) -> list[dict]:
    """CDC Core Practices numbering: category headings only ("1. Leadership
    Support", "5a. Hand Hygiene") - individual bullets under a category are
    NOT separately numbered, so the addressable unit here is the category
    block (heading through the line before the next heading), not a single
    bullet. This generalizes the anchoring method's "structural marker" idea
    from step-numbers to section-numbers.

    `offset` lets a caller parse a SLICE of a larger raw_text (e.g. skipping
    a preceding decoy section - see _parse_adversarial_decoy_markers) while
    still reporting char_start/char_end relative to the full raw_text."""
    heading_re = re.compile(r"(?m)^(\d+[a-z]?)\.\s+(.+)$")
    matches = list(heading_re.finditer(body))
    items = []
    for i, m in enumerate(matches):
        item_id = m.group(1)
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        text = body[start:end].strip()
        items.append({"item_id": item_id, "text": text, "char_start": offset + start, "char_end": offset + start + len(text)})
    return items


def _parse_disinfection_sterilization(body: str) -> list[dict]:
    """CDC Disinfection/Sterilization numbering: individually-numbered
    recommendations at multiple nesting depths - "1.a.", "2.b.i.", "5.n.1.",
    "7.aa.", "7.am.1." - a genuinely harder, deeper scheme than the demo
    corpus's flat "Step N:" convention. Each recommendation is one line (or
    a short run of lines up to the next numbered marker or blank line)."""
    marker_re = re.compile(r"(?m)^(\d+\.(?:[a-z]+\.)*(?:\d+\.)?)\s+")
    matches = list(marker_re.finditer(body))
    items = []
    for i, m in enumerate(matches):
        item_id = m.group(1).rstrip(".")
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        text = body[start:end].strip()
        # A section heading line (e.g. "1. Occupational Health and
        # Exposure") also matches the marker regex but isn't a
        # recommendation - real recommendations in this document are
        # substantially longer than a bare heading.
        if len(text) < 40:
            continue
        items.append({"item_id": item_id, "text": text, "char_start": start, "char_end": start + len(text)})
    return items


def _parse_adversarial_decoy_markers(body: str) -> list[dict]:
    """Ground truth for the synthetic adversarial fixture. Deliberately
    ONLY parses items from the Recommendations section, skipping the
    References section entirely - the References numbers 1-5 exist in
    raw_text purely as decoys for the marker-search methods to be tested
    against, and must NOT appear in ground truth (a method that anchors to
    a reference by mistake should score as a false anchor, not as
    accidentally correct). See the raw .txt file's GROUND TRUTH NOTE."""
    anchor = body.find("Recommendations")
    if anchor == -1:
        return []
    return _parse_core_practices(body[anchor:], offset=anchor)


_PARSERS = {
    "cdc_core_practices": _parse_core_practices,
    "cdc_disinfection_sterilization": _parse_disinfection_sterilization,
    # Same numbering shape as core_practices (digit + period + text, one
    # item per line-through-next-heading block) - but AHRQ's numbers are
    # CSS list-style-type output reconstructed at retrieval time, not
    # literal characters in the source HTML, and each item is 3-6 sentences
    # rather than core_practices' short bullets. See the raw .txt headers.
    "ahrq_cauti_appropriate_indications": _parse_core_practices,
    "ahrq_cauti_inappropriate_indications": _parse_core_practices,
    "adversarial_decoy_markers": _parse_adversarial_decoy_markers,
}

_SOURCE_URLS = {
    "cdc_core_practices": "https://www.cdc.gov/infection-control/hcp/core-practices/index.html",
    "cdc_disinfection_sterilization": "https://www.cdc.gov/infection-control/hcp/disinfection-sterilization/summary-recommendations.html",
    "ahrq_cauti_appropriate_indications": "https://www.ahrq.gov/hai/cauti-tools/guides/implguide-pt3.html",
    "ahrq_cauti_inappropriate_indications": "https://www.ahrq.gov/hai/cauti-tools/guides/implguide-pt3.html",
    "adversarial_decoy_markers": "n/a - synthetic fixture, not a real URL",
}


def load_real_corpus() -> list[RealDocument]:
    docs = []
    for doc_id, parser in _PARSERS.items():
        _, body = _load_raw(f"{doc_id}.txt")
        items = parser(body)
        docs.append(RealDocument(doc_id=doc_id, source_url=_SOURCE_URLS[doc_id], raw_text=body, items=items))
    return docs


if __name__ == "__main__":
    for doc in load_real_corpus():
        print(f"{doc.doc_id}: {len(doc.items)} items")
        for it in doc.items[:3]:
            print(f"  [{it['item_id']}] {it['text'][:70]!r}")
