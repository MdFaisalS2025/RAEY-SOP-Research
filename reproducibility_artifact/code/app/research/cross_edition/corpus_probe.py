"""
Cross-edition study: corpus triage probe.

WHAT THIS IS FOR
----------------
The cross-edition provenance paper ("Where did this recommendation go?")
depends on one fact that was unverified through three planning rounds:
whether published clinical protocol PDFs carry a usable text layer, and
whether their structural markers survive extraction. If they are scans, or
if numbering is lost, the corpus cost multiplies and the study needs
rethinking.

This module answers that question for any candidate document, and reports
the same inventory every time so documents can be compared and triaged
before anyone invests in parsing them properly.

Run it on a candidate BEFORE adding it to the corpus:

    cd sop-guard/backend
    python -m app.research.cross_edition.corpus_probe /path/to/doc.pdf

WHAT IT CHECKS, AND WHY EACH MATTERS
------------------------------------
  text layer        - is it a scan? If chars/page is near zero, OCR is
                      required and the document is deprioritised.
  numbered lines    - the anchoring/alignment method needs structural
                      markers. A document with no numbering is useless to
                      this study regardless of how good its content is.
  numeric+unit      - doses, thresholds, time windows. These are the
                      divergence signal for the change-classification half
                      of the study.
  section template  - documents built from a fixed named-section template
                      (Inclusion Criteria / Patient Management / ...) give
                      stable SEMANTIC anchors across editions, which is far
                      more robust than numbering alone, since numbering is
                      exactly what gets renumbered between editions.
  revision metadata - some documents carry per-item revision dates. Where
                      both editions carry them, comparing them yields
                      change labels directly from the documents, at zero
                      annotation cost.

FIRST RESULT (NASEMSO National Model EMS Clinical Guidelines v2.2, 2019)
-----------------------------------------------------------------------
  372 pages, 798,680 chars, 18,561 lines  -> real text layer, not a scan
  5,329 numbered lines (28.7% of lines)   -> dense structural markers
  873 numeric+unit values                 -> real divergence signal
  ~66-69 guidelines, 16 recurring section names, per-guideline
  "Revision Date" fields (66 found, though 63 share one value in this
  edition - the release date - so within-edition they carry little
  information; their value is in the ACROSS-edition comparison)

Known extraction artefacts on that document, recorded rather than smoothed
over: bullet glyphs do not map to Unicode and arrive as U+FFFD; some
guideline titles wrap across lines, so title extraction anchored on the
following "Aliases" label picks up fragments ("(STEMI)", "Guideline Model
Process)"). Both are fixable in a real parser; neither threatens the study.

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import collections
import json
import re
import sys
from pathlib import Path

# Structural marker: "1." / "1.2." / "a." / "iv." / "(3)" at line start,
# followed by real content. Deliberately permissive - this is triage, not
# the production parser.
# Must stay in step with item_parser._MARKER_PATTERNS. It did not, and the
# divergence was dangerous: this pattern omitted BULLETS, so the New York
# protocol set triaged at 0.2-0.3% "numbered lines" and scored WEAK, when the
# actual parser finds a marker on 42% of its lines. Triage that rejects usable
# documents is worse than no triage, because the rejection is never revisited.
_MARKER = re.compile(
    r"^\s*("
    r"(?:\d+\.)+"           # 1.  /  1.2.
    r"|[a-z]\."             # a.
    r"|[ivxlc]+\."          # iv.
    r"|\([a-z0-9]+\)"       # (1) / (a)
    r"|[�•▪●‣⁃-]"  # bullets, incl. unmapped glyphs
    r"|o"                   # sub-bullet
    r")\s+\S"
)

# Dose / threshold / time-window values. These are what a divergence
# detector actually compares between editions.
_NUMERIC_UNIT = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:mcg|mg|mL|ml|mmHg|mmol|kg|min|hours?|J|%)\b"
)

# A line that is nothing but a short Title Case phrase - candidate section
# heading in a templated document.
_HEADING = re.compile(r"^([A-Z][A-Za-z/\-' ]{5,45})\s*$")

_REVISION_LABEL = re.compile(r"^\s*Revision Date\s*$", re.IGNORECASE)


def extract_text(pdf_path: str) -> tuple[str, int]:
    """Returns (text, page_count). PyMuPDF only - it is already a
    dependency of app/services/document_parser.py, so this adds nothing
    new to the environment."""
    try:
        import fitz
    except ImportError as e:  # pragma: no cover
        raise RuntimeError(
            "PyMuPDF (fitz) is required. It is already used by "
            "app/services/document_parser.py; install it in this environment."
        ) from e
    doc = fitz.open(pdf_path)
    return "\n".join(doc[i].get_text() for i in range(doc.page_count)), doc.page_count


def probe(pdf_path: str) -> dict:
    text, pages = extract_text(pdf_path)
    lines = [ln.rstrip() for ln in text.split("\n")]
    nonblank = [ln for ln in lines if ln.strip()]

    numbered = [ln for ln in lines if _MARKER.match(ln)]
    numeric = _NUMERIC_UNIT.findall(text)

    headings = collections.Counter(
        m.group(1).strip() for ln in lines if (m := _HEADING.match(ln))
    )
    # A section name that recurs many times across a long document is a
    # template slot, not prose. The cutoff is deliberately crude: this is
    # triage, and the human reads the list anyway.
    template = {k: v for k, v in headings.items() if v >= max(5, pages // 40)}

    revisions = []
    for i, ln in enumerate(lines):
        if _REVISION_LABEL.match(ln):
            for j in range(i + 1, min(i + 4, len(lines))):
                if lines[j].strip():
                    revisions.append(lines[j].strip())
                    break

    chars_per_page = len(text) / max(1, pages)
    return {
        "file": Path(pdf_path).name,
        "pages": pages,
        "chars": len(text),
        "chars_per_page": round(chars_per_page, 1),
        # The gate. Below ~200 chars/page a document is effectively a scan.
        "text_layer": "scanned/absent" if chars_per_page < 200 else "present",
        "lines_nonblank": len(nonblank),
        "numbered_lines": len(numbered),
        "numbered_line_pct": round(100 * len(numbered) / max(1, len(nonblank)), 1),
        "numeric_unit_values": len(numeric),
        "numeric_unit_sample": numeric[:8],
        "template_sections": dict(sorted(template.items(), key=lambda kv: -kv[1])),
        "revision_fields_found": len(revisions),
        "revision_distinct_values": len(set(revisions)),
        "revision_sample": collections.Counter(revisions).most_common(5),
        "replacement_char_count": text.count("�"),
        "verdict": _verdict(chars_per_page, len(numbered), len(nonblank)),
    }


def _verdict(chars_per_page: float, numbered: int, nonblank: int) -> str:
    if chars_per_page < 200:
        return "REJECT - no usable text layer; would require OCR"
    pct = 100 * numbered / max(1, nonblank)
    if pct < 3:
        return "WEAK - text extracts but few structural markers; low value for this study"
    if pct < 10:
        return "USABLE - some structural markers; check the sample before committing"
    return "STRONG - dense structural markers and a real text layer"


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        print("usage: python -m app.research.cross_edition.corpus_probe <file.pdf> [...]")
        return 2
    reports = []
    for path in argv[1:]:
        r = probe(path)
        reports.append(r)
        print("=" * 74)
        print(f"{r['file']}")
        print("=" * 74)
        print(f"  text layer      : {r['text_layer']}  ({r['chars_per_page']} chars/page, {r['pages']} pages)")
        print(f"  numbered lines  : {r['numbered_lines']} ({r['numbered_line_pct']}% of non-blank)")
        print(f"  numeric+unit    : {r['numeric_unit_values']}  e.g. {r['numeric_unit_sample'][:5]}")
        print(f"  template slots  : {len(r['template_sections'])}")
        for name, count in list(r["template_sections"].items())[:10]:
            print(f"      {count:>4}  {name}")
        print(f"  revision fields : {r['revision_fields_found']} "
              f"({r['revision_distinct_values']} distinct)")
        if r["replacement_char_count"]:
            print(f"  NOTE            : {r['replacement_char_count']} U+FFFD replacement chars "
                  f"(glyphs that did not map; usually bullets)")
        print(f"\n  VERDICT: {r['verdict']}\n")
    print(json.dumps(reports, indent=2)[:0])  # keep json importable without printing
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
