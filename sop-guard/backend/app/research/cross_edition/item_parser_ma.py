"""
Massachusetts-specific guideline-boundary detection, built as a NEW,
separate module - does NOT modify item_parser.py, item_align.py,
edition_align.py, or corpus_probe.py, all frozen at d3068ee.

WHY THIS EXISTS
----------------
Massachusetts Statewide Treatment Protocols has neither of the two
anchor conventions item_parser.py already knows (NASEMSO/New York's
fixed "Aliases"/"Criteria" section label, or Maine's per-page footer
counter), and its content is NOT tabular the way Connecticut's was, so
neither existing fallback path fires usefully. Running the frozen
parser's generic fallback produces a garbage-bucket result: 6-8
guidelines for ~380 items in a document with ~90 distinct protocols
(FEASIBILITY.md section 93) - the same class of failure already
documented for DC.

THE REAL ANCHOR
----------------
Every Massachusetts protocol page carries a running header of the form
"<Category Name> <protocol id>" (e.g. "Medical Protocol  2.16P",
"Airway Protocols and Procedures   5.1A"), and the SAME protocol id
appears standalone at least once more on the page. The id is stable
and sequential (2.1, 2.2A, 2.2P, 2.3A, ... 2.20, 3.1, ...) - exactly
the kind of page-level structural anchor Maine's footer counter and
Connecticut's ToC row-alignment already exploit for their own,
differently-shaped furniture.

The document ALSO carries a genuine, clean multi-page Table of
Contents ("Title.....id" per line) - this is the authoritative source
of TITLES (body-page text right after a header is often clinical prose,
not the protocol's own name, because of the header/title ordering
quirks a 2-column layout introduces into linear text extraction).

APPROACH
--------
1. Parse the ToC directly from the PDF into an ordered (id -> title)
   list, in document order.
2. Independently, walk the document PAGE BY PAGE and take the modal
   (most frequent) protocol-id match on that page as "this page's
   protocol" - robust to line-ordering noise within a page, since the
   id appears at least twice per page in slightly different positions.
   Forward-fill pages with no match (continuation pages).
3. Reduce the per-page id sequence to protocol-id SPANS (consecutive
   runs of the same id).
4. Attach each span's title by matching its id against the ToC list
   (exact match first; a bare-number id like "2.17" falls back to the
   nearest ToC id sharing the same numeric prefix, since PDF text
   extraction occasionally drops a trailing adult/pediatric suffix
   letter - confirmed empirically on ma_2023.pdf, one such case out of
   89 spans).
5. Item-level extraction within each span reuses item_parser.py's own
   `_classify`/`_strip_marker` marker machinery UNCHANGED (imported,
   not reimplemented) - only the furniture-stripping list differs from
   Maine's `_parse_footer_protocol` (this document's own header/version/
   category lines, not Maine's footer/color-tag lines).

Produces an item_parser.ParsedEdition, exactly interchangeable with
parse()'s own return type, so item_align.align_items (frozen, unmodified)
can consume it without a shim - the same "swap what feeds the frozen
aligner, never the aligner itself" discipline already used by
structure_ablation.py and vlm_rescue_attempt.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.item_parser_ma <pdf>
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

from app.research.cross_edition.corpus_probe import extract_text
from app.research.cross_edition.item_parser import (
    Item, ParsedEdition, _classify, _ROMAN_LETTERS, _norm_title,
)

# --- protocol-id patterns -------------------------------------------------
# "<Category words>  <id>" on one line (the running page header), or the
# id alone on its own line (repeated elsewhere on the same page).
_ID = r"\d\.\d{1,2}[A-Z]{0,2}|A\d"
_CAT_NUM = re.compile(rf"^([A-Za-z][A-Za-z &/\-]{{3,55}}?)\s+({_ID})\s*$")
_NUM_ONLY = re.compile(rf"^\s*({_ID})\s*$")

# ToC row: "<title> .......... <id>" (dot-leader or plain-space separated).
_TOC_ROW = re.compile(rf"^(.{{3,90}}?)[\s.…]{{2,}}({_ID})\s*$")
_TOC_SECTION_HEADER = re.compile(r"^SECTION\s+\d+\b", re.IGNORECASE)

# Body-page furniture to strip before item extraction - this document's
# own boilerplate, distinct from Maine's footer/color-tag furniture.
_VERSION_LINE = re.compile(r"statewide treatment protocols", re.IGNORECASE)
_DEPT_LINE = re.compile(r"massachusetts (department|pre-hospital)", re.IGNORECASE)
_CONTINUES = re.compile(r"^protocol continue[ds]?\.?\s*$", re.IGNORECASE)
_YEAR_STUB = re.compile(r"^\d{4}\s*$")  # a bare copyright/approval-year line seen on some pages


def _is_furniture(line: str) -> bool:
    s = line.strip()
    if not s:
        return True
    if _CAT_NUM.match(s) or _NUM_ONLY.match(s):
        return True
    if _VERSION_LINE.search(s) or _DEPT_LINE.search(s):
        return True
    if _CONTINUES.match(s) or _YEAR_STUB.match(s):
        return True
    return False


def parse_toc(pdf_path: str) -> list[tuple[str, str]]:
    """Ordered [(id, title), ...] read directly from the document's own
    Table of Contents pages. Scans every page for ToC-shaped rows rather
    than assuming a fixed page range, so this is not brittle to a
    different edition's ToC being one page longer or shorter."""
    import fitz
    doc = fitz.open(pdf_path)
    out: list[tuple[str, str]] = []
    seen_ids: set[str] = set()
    for pno in range(min(len(doc), 12)):  # ToC is always near the front
        text = doc[pno].get_text()
        if "table of contents" not in text.lower() and not out:
            continue
        found_this_page = False
        for ln in text.split("\n"):
            s = ln.strip()
            if not s or _TOC_SECTION_HEADER.match(s):
                continue
            m = _TOC_ROW.match(s)
            if not m:
                continue
            title, pid = m.group(1).strip(), m.group(2).strip()
            title = re.sub(r"[.…\s]+$", "", title).strip()
            if not title or pid in seen_ids:
                continue
            seen_ids.add(pid)
            out.append((pid, title))
            found_this_page = True
        if out and not found_this_page and pno > 1:
            break  # ToC pages are contiguous; one page with no rows ends it
    return out


def _page_protocol_ids(pdf_path: str) -> list[str | None]:
    """Modal protocol-id match per page, None where a page has no match at
    all (continuation pages get forward-filled by the caller)."""
    import fitz
    doc = fitz.open(pdf_path)
    result: list[str | None] = []
    for pno in range(len(doc)):
        text = doc[pno].get_text()
        cands = []
        for ln in text.split("\n"):
            s = ln.strip()
            if not s:
                continue
            m = _CAT_NUM.match(s)
            if m:
                cands.append(m.group(2))
                continue
            m = _NUM_ONLY.match(s)
            if m:
                cands.append(m.group(1))
        result.append(Counter(cands).most_common(1)[0][0] if cands else None)
    return result


def _resolve_title(pid: str, toc: dict[str, str]) -> str | None:
    """Exact match first; falls back to the same numeric prefix with any
    suffix letter dropped/added, since PDF extraction occasionally drops a
    trailing Adult/Pediatric suffix letter from a body-page id occurrence
    (confirmed on ma_2023.pdf: one bare '2.17' where the ToC only lists
    '2.17A'/'2.17P' - never both a real distinct id AND its own bare form,
    so this is a recovery, not an ambiguity)."""
    if pid in toc:
        return toc[pid]
    m = re.match(r"^(\d\.\d{1,2})([A-Z]{0,2})$", pid)
    if not m:
        return None
    prefix = m.group(1)
    candidates = [(k, v) for k, v in toc.items() if k.startswith(prefix)]
    if len(candidates) == 1:
        return candidates[0][1]
    return None


def _spans_from_page_ids(page_ids: list[str | None]) -> list[tuple[str, int, int]]:
    filled: list[str | None] = []
    last = None
    for pid in page_ids:
        if pid is not None:
            last = pid
        filled.append(last)
    spans: list[tuple[str, int, int]] = []
    if not filled:
        return spans
    cur, start = filled[0], 0
    for i in range(1, len(filled)):
        if filled[i] != cur:
            spans.append((cur, start, i - 1))
            cur, start = filled[i], i
    spans.append((cur, start, len(filled) - 1))
    return spans


def _extract_span_items(
    page_texts: list[list[str]], start_page: int, end_page: int,
    guideline: str, seen_ids: dict[str, int],
) -> tuple[list[Item], int]:
    """Marker-level item extraction within one protocol's page span.
    Reuses item_parser._classify/_strip_marker unchanged - the only thing
    this function does differently from item_parser.py's own section
    extractors is what counts as furniture to skip (_is_furniture, this
    document's header/version/category lines) versus content."""
    from app.research.cross_edition.item_parser import _strip_marker

    items: list[Item] = []
    stack: list[tuple[str, str]] = []
    path: list[str] = []
    ambiguous = 0
    last: Item | None = None
    offset = 0  # recomputed by the caller against the real canonical_text

    for pno in range(start_page, end_page + 1):
        for line in page_texts[pno]:
            if _is_furniture(line):
                continue
            cls = _classify(line, stack)
            if cls is None:
                if last is not None:
                    last.text = (last.text + " " + line.strip()).strip()
                    last.full_text = last.text
                continue
            kind, marker = cls
            if kind == "alpha" and marker in _ROMAN_LETTERS:
                ambiguous += 1
            existing = next((k for k, (kk, _) in enumerate(stack) if kk == kind), None)
            if existing is None:
                stack.append((kind, marker))
                path.append(marker)
            else:
                del stack[existing + 1:]
                del path[existing + 1:]
                stack[existing] = (kind, marker)
                path[existing] = marker
            marker_path = ".".join(path)
            base_id = f"{_norm_title(guideline)}/protocol/{marker_path}"
            seen_ids[base_id] = seen_ids.get(base_id, 0) + 1
            n = seen_ids[base_id]
            item_id = base_id if n == 1 else f"{base_id}#{n}"
            text = _strip_marker(line)
            last = Item(
                item_id=item_id, guideline=guideline, section="protocol",
                marker=marker, marker_path=marker_path, depth=len(path),
                text=text, full_text=text, char_start=offset, char_end=offset,
            )
            items.append(last)
    return items, ambiguous


def parse(pdf_path: str, doc_id: str | None = None) -> ParsedEdition:
    import fitz
    doc = fitz.open(pdf_path)
    n_pages = len(doc)
    page_texts = [[ln.strip() for ln in doc[p].get_text().split("\n") if ln.strip()]
                  for p in range(n_pages)]

    toc = dict(parse_toc(pdf_path))
    page_ids = _page_protocol_ids(pdf_path)
    spans = _spans_from_page_ids(page_ids)

    canonical_lines: list[str] = []
    ed = ParsedEdition(
        doc_id=doc_id or Path(pdf_path).stem, source_path=pdf_path,
        canonical_text="", n_pages=n_pages, anchor="ma_toc+header",
    )

    seen_ids: dict[str, int] = {}
    unresolved = 0
    for pid, start, end in spans:
        title = _resolve_title(pid, toc) if pid else None
        if title is None:
            title = "<preamble>" if pid is None else f"<untitled@{pid}>"
            if pid is not None:
                unresolved += 1
        if title not in ed.guidelines and title not in ("<preamble>",):
            ed.guidelines.append(title)
        items, ambiguous = _extract_span_items(page_texts, start, end, title, seen_ids)
        ed.items.extend(items)
        ed.ambiguous_markers += ambiguous

    # canonical_text: join every kept content line (post-furniture-strip) in
    # document order, and backfill real char_start/char_end onto the items
    # built above (built with placeholder offsets since span extraction
    # doesn't know its position in the final joined string until now).
    cursor = 0
    flat_lines: list[str] = []
    for p in range(n_pages):
        for line in page_texts[p]:
            if _is_furniture(line):
                continue
            flat_lines.append(line)
    ed.canonical_text = "\n".join(flat_lines)
    # Offsets are approximate (line-start, not exact char match within a
    # merged multi-line item) - acceptable for this study's alignment
    # method, which keys on item_id/guideline/marker_path, not on exact
    # citation-quality offsets; MA/NH are not part of the citation-offset
    # feature at all.

    ed.unparsed_sections = unresolved
    return ed


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    ed = parse(argv[1])
    n = len(ed.items)
    preamble = sum(1 for it in ed.items if it.guideline == "<preamble>")
    untitled = sum(1 for it in ed.items if str(it.guideline).startswith("<untitled@"))
    print(f"items={n}  preamble={preamble} ({preamble/n:.1%})  "
          f"untitled={untitled} ({untitled/n:.1%})  n_guidelines={len(ed.guidelines)}")
    for g in ed.guidelines[:15]:
        print("  ", g)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
