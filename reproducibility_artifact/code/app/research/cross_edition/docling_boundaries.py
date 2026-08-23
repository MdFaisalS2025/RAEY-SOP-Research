"""
Docling as an alternative guideline-boundary source (audit round 3,
Phase 3) - a real, second mid-range anchor for section 61's structure-
quality curve, alongside our own parser (measured F1~0.79, section 64)
and US Code XML (~1.0, section 63).

Design: our parser's ITEM extraction and the existing 233-item ground
truth stay completely fixed. ONLY guideline-boundary detection is
swapped to Docling's section-header output, scored the SAME way our own
parser's boundary F1 was measured in section 64 - match_guidelines
(frozen, unchanged) against the SAME two annotators' Tennessee ground
truth, with the same collision-artifact correction (run_calibration.py's
corrected_f1, reused unchanged) applied for direct comparability.

Docling's "section_header" label spans multiple hierarchy levels mixed
together - a repeated running page-header, table-of-contents entries,
top-level category headers, and per-protocol sub-headers all carry the
same label (verified directly: 735 raw section_header items on the 2017
edition, including "TENNESSEE EMERGENCY MEDICAL SERVICES PROTOCOL
GUIDELINES" repeated dozens of times). Rather than hand-classifying
hierarchy levels (a new, untested heuristic this study would have to
invent and could not validate), this reuses match_guidelines' own
token-overlap scoring to let noise self-penalize through the precision
term - exactly the property already relied on for boundary_scoring.py's
scoring of our own parser's output. The one filtering step applied
BEFORE scoring, not after seeing results: deduplicate to DISTINCT header
strings, matching how our own parser's `.guidelines` is inherently a
deduplicated list (one entry per distinct guideline, not one per page
occurrence) - without this, a header repeated on every page would be
counted as dozens of separate "candidate guidelines," an obviously unfair
denominator inflation unrelated to Docling's real boundary-detection
quality.

Does not modify item_align.py, item_parser.py, corpus_probe.py,
edition_align.py, or run_boundary_scoring.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.docling_boundaries
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def extract_docling_headers(pdf_path: str) -> list[str]:
    """Distinct (deduplicated) section-header strings, in first-seen
    order, from Docling's own layout model - no filtering beyond
    deduplication, so match_guidelines' own scoring is what determines
    which of these are genuine boundary matches."""
    from docling.document_converter import DocumentConverter
    conv = DocumentConverter()
    result = conv.convert(pdf_path)
    doc = result.document

    # AUDIT ROUND 4 FIX (2026-08-22): the str(item.label) == "section_header"
    # equality test below is brittle against a Docling version change -
    # DocItemLabel is an enum whose str() rendering already differed once
    # in this study's own history ('DocLayNet.SECTION_HEADER' assumed vs.
    # the actual 'section_header', caught by inspecting the label
    # distribution directly per the section-70 pre-commitment). A future
    # version bump that changes the rendering again would silently filter
    # every item out, producing headers=[] -> corrected_f1 ~0, which looks
    # exactly like a real (very bad) Docling result rather than a broken
    # check. Assert non-empty against the total item count so that failure
    # mode raises instead of masquerading as a measurement.
    all_items = list(doc.iterate_items())
    seen: set[str] = set()
    headers: list[str] = []
    for item, _level in all_items:
        if not hasattr(item, "label") or str(item.label) != "section_header":
            continue
        text = item.text.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        headers.append(text)

    if not headers:
        raise RuntimeError(
            f"extract_docling_headers found 0 section_header items among "
            f"{len(all_items)} total document items for {pdf_path!r}. This "
            f"almost certainly means the label string 'section_header' no "
            f"longer matches this Docling version's str(item.label) "
            f"rendering (see the 2026-08-18 pre-commitment entry for the "
            f"prior occurrence of exactly this failure) - not that Docling "
            f"genuinely found zero headers in a multi-page protocol "
            f"document. Inspect Counter(str(i.label) for i, _ in "
            f"doc.iterate_items()) before trusting any score computed from "
            f"an empty header list."
        )
    return headers


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    headers = extract_docling_headers(argv[1])
    print(f"{len(headers)} distinct section headers")
    for h in headers[:30]:
        print(" ", repr(h))
    if argv[2:]:
        out = Path(argv[2])
        with open(out, "w", encoding="utf-8") as f:
            json.dump(headers, f, indent=2, ensure_ascii=False)
        print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
