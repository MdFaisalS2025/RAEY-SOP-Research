"""
New Hampshire-specific guideline-boundary detection, built as a NEW,
separate module - does NOT modify item_parser.py, item_align.py,
edition_align.py, or corpus_probe.py, all frozen at d3068ee.

WHY THIS EXISTS
----------------
Same motivation as item_parser_ma.py (see that module's docstring for
the general pattern): New Hampshire Patient Care Protocols has neither
of item_parser.py's two known anchor conventions, and the frozen
parser's generic fallback produces mostly non-title fragments as
"guidelines" (FEASIBILITY.md section 93) - drug-name/medication
fragments and OCR-adjacent noise, not real protocol titles.

THE REAL ANCHOR
----------------
Unlike Massachusetts, New Hampshire has NO table of contents anywhere
in the document (confirmed by direct search). What it DOES have:

1. A running page-header protocol id, same convention as Massachusetts
   ("General Patient Care   1.0", "Medical Protocol   2.1") - reused
   here via the identical CAT_NUM/NUM_ONLY page-mode-voting approach
   item_parser_ma.py already established, since the mechanism (an id
   appearing at least twice per page, modal per page, forward-filled
   across continuation pages) is publisher-agnostic.

2. The real protocol TITLE sits just above the recurring department
   footer line ("New Hampshire Department of Safety, Division of Fire
   Standards and Training & Emergency Medical Services"), which appears
   on every content page - not just guideline-start pages, unlike
   Maine's or Massachusetts's anchors. The title is 1-2 short lines
   immediately above that footer, distinguishable from body prose by
   item_parser._looks_like_title (imported, unchanged) and from
   recurring boilerplate ("EMT STANDING ORDERS", "PARAMEDIC EXTENDED
   CARE ORDERS", ...) by item_parser.detect_boilerplate (imported,
   unchanged) - both reused exactly as item_parser.py's own NASEMSO/
   New York title-walk already relies on them.

KNOWN, DISCLOSED LIMITATION
----------------------------
A handful of consecutive protocol ids (out of ~108) resolve to the
SAME title text - e.g. 5.2/5.3/5.4 all "Analgesia and Sedation for
Invasive Airway Device". Hand inspection (FEASIBILITY.md section 94)
found these are genuine certification-level sub-splits of one named
procedure (this document does not always suffix them Adult/Pediatric
the way Massachusetts does), not a detection bug - but this means
item_id collisions are possible for these ids specifically, and
item_align's title-based guideline matching will treat them as one
guideline. Not fixed here; disclosed rather than silently smoothed
over, matching this study's standing discipline for known-imperfect
but net-usable extraction (the same disclosure Maine's flat-sectioning
limitation already carries).

Produces an item_parser.ParsedEdition, exactly interchangeable with
parse()'s own return type - same "swap what feeds the frozen aligner,
never the aligner itself" discipline as item_parser_ma.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.item_parser_nh <pdf>
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

from app.research.cross_edition.item_parser import (
    Item, ParsedEdition, _classify, _strip_marker, _looks_like_title,
    detect_boilerplate, _ROMAN_LETTERS, _norm_title,
)

_ID = r"\d\.\d{1,2}[A-Z]{0,2}"
_CAT_NUM = re.compile(rf"^([A-Za-z][A-Za-z &/\-]{{3,55}}?)\s+({_ID})\s*$")
_NUM_ONLY = re.compile(rf"^\s*({_ID})\s*$")
_DEPT_FOOTER = re.compile(r"new hampshire department of safety", re.IGNORECASE)
_YEAR_STUB = re.compile(r"^\d{4}$")
_STOP_WORDS = {"draft", "e", "a", "p", "x", "fr"}

_VERSION_LINE = re.compile(r"patient care protocols", re.IGNORECASE)
_CONTINUES = re.compile(r"^(protocol|procedure)\s+continue[ds]?\.?\s*$", re.IGNORECASE)


def _is_furniture(line: str, boilerplate: set[str]) -> bool:
    s = line.strip()
    if not s:
        return True
    if _CAT_NUM.match(s) or _NUM_ONLY.match(s):
        return True
    if _DEPT_FOOTER.search(s) or _VERSION_LINE.search(s):
        return True
    if _CONTINUES.match(s) or _YEAR_STUB.match(s):
        return True
    if s in boilerplate:
        return True
    return False


def _title_above_footer(lines: list[str], boilerplate: set[str]) -> str | None:
    for i, ln in enumerate(lines):
        if _DEPT_FOOTER.search(ln):
            parts: list[str] = []
            j, scanned = i - 1, 0
            while j >= 0 and len(parts) < 2 and scanned < 8:
                t = lines[j].strip()
                scanned += 1
                if not t:
                    j -= 1
                    continue
                if _DEPT_FOOTER.search(t):
                    break
                if (_YEAR_STUB.match(t) or _CAT_NUM.match(t) or _NUM_ONLY.match(t)
                        or t in boilerplate or t.lower().rstrip(".") in _STOP_WORDS):
                    j -= 1
                    continue
                if not _looks_like_title(t):
                    break
                parts.insert(0, t)
                j -= 1
            return " ".join(parts).strip() if parts else None
    return None


def _page_ids_and_titles(pdf_path: str) -> tuple[list[str | None], list[str | None], list[list[str]]]:
    import fitz
    doc = fitz.open(pdf_path)
    page_lines = [[ln.strip() for ln in doc[p].get_text().split("\n") if ln.strip()]
                  for p in range(len(doc))]
    all_lines = [ln for pl in page_lines for ln in pl]
    boilerplate = detect_boilerplate(all_lines, min_reuse=15)

    ids: list[str | None] = []
    titles: list[str | None] = []
    for lines in page_lines:
        cands = []
        for ln in lines:
            m = _CAT_NUM.match(ln)
            if m:
                cands.append(m.group(2))
                continue
            m = _NUM_ONLY.match(ln)
            if m:
                cands.append(m.group(1))
        ids.append(Counter(cands).most_common(1)[0][0] if cands else None)
        titles.append(_title_above_footer(lines, boilerplate))
    return ids, titles, page_lines


def _spans(ids: list[str | None]) -> list[tuple[str, int, int]]:
    filled: list[str | None] = []
    last = None
    for pid in ids:
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
    page_lines: list[list[str]], start_page: int, end_page: int,
    guideline: str, boilerplate: set[str], seen_ids: dict[str, int],
) -> tuple[list[Item], int]:
    items: list[Item] = []
    stack: list[tuple[str, str]] = []
    path: list[str] = []
    ambiguous = 0
    last: Item | None = None
    offset = 0

    for pno in range(start_page, end_page + 1):
        for line in page_lines[pno]:
            if _is_furniture(line, boilerplate):
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
    ids, titles, page_lines = _page_ids_and_titles(pdf_path)
    all_lines = [ln for pl in page_lines for ln in pl]
    boilerplate = detect_boilerplate(all_lines, min_reuse=15)
    spans = _spans(ids)

    filled_titles: list[str | None] = []
    last_t = None
    for t in titles:
        if t is not None:
            last_t = t
        filled_titles.append(last_t)

    ed = ParsedEdition(
        doc_id=doc_id or Path(pdf_path).stem, source_path=pdf_path,
        canonical_text="", n_pages=n_pages, anchor="nh_footer_title+header",
    )

    seen_ids: dict[str, int] = {}
    unresolved = 0
    for pid, start, end in spans:
        titles_in_span = [filled_titles[p] for p in range(start, end + 1) if filled_titles[p]]
        title = Counter(titles_in_span).most_common(1)[0][0] if titles_in_span else None
        if title is None:
            title = "<preamble>" if pid is None else f"<untitled@{pid}>"
            if pid is not None:
                unresolved += 1
        if title not in ed.guidelines and title != "<preamble>":
            ed.guidelines.append(title)
        items, ambiguous = _extract_span_items(page_lines, start, end, title, boilerplate, seen_ids)
        ed.items.extend(items)
        ed.ambiguous_markers += ambiguous

    flat_lines: list[str] = []
    for pl in page_lines:
        for line in pl:
            if not _is_furniture(line, boilerplate):
                flat_lines.append(line)
    ed.canonical_text = "\n".join(flat_lines)
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
    for g in ed.guidelines[:20]:
        print("  ", g)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
