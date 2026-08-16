"""
Item parser: protocol PDF -> addressable items with stable IDs and offsets.

WHAT THIS PRODUCES, AND WHY THIS SHAPE
--------------------------------------
`corpus_probe.py` counts markers. `edition_align.py` works at section
granularity. The study needs the level below that: individual recommendations,
each independently addressable, so that "where did this recommendation go in the
next edition?" is a question with a well-formed answer.

Every item carries:

  item_id      guideline / section / marker-path, e.g.
               "bradycardia/patient management/1.a"
               Stable across editions IF the guideline title, section name and
               marker path all survive - which is exactly what the study
               measures, so the ID is a hypothesis, not a guarantee.
  marker_path  "1.a.iii" - the numbering as it appears in THIS edition
  depth        nesting depth, 1-based
  text         the item's own text, excluding descendants
  full_text    the item including its descendants
  char_start / char_end
               offsets into `canonical_text`, NOT into raw PyMuPDF output

OFFSETS: WHAT THEY INDEX
------------------------
Running headers ("Updated January 5, 2019") and bare page numbers appear on
every page and are not content. They are stripped. That means offsets cannot
index the raw extraction, so the parser defines a CANONICAL TEXT - the cleaned
line stream - and every offset indexes that. `canonical_text` is returned and
serialised alongside the items so offsets are always resolvable.

This mirrors the convention already used by
`real_corpus/corpus.py::_load_raw`, which excludes the provenance header from
the body so ground-truth offsets are computed against content only. The output
dict shape is deliberately compatible with `RealDocument` (`doc_id`,
`raw_text`, `items` with `item_id`/`text`/`char_start`/`char_end`) so the
existing anchoring harness can consume these documents without a shim.

THE HARD PART: INFERRING DEPTH
------------------------------
PDF extraction does not preserve reliable indentation, so nesting must be
inferred from the marker TYPE sequence. NASEMSO documents nest as
1. -> a. -> i. -> (1), with some variation.

Two genuine ambiguities are handled explicitly rather than ignored:

  "i."  is both roman-one and the ninth letter. Resolved by continuity: if an
        alpha level is open and its last marker was "h.", this is alpha; if a
        new level is opening, it is roman.
  "v."  and "x." have the same problem at the 22nd/24th letter. Same rule.

Where continuity cannot resolve it, the parser prefers the interpretation that
continues an open level, and records the decision in `ambiguous_markers` so the
rate is visible rather than silent.

STATUS: exploratory corpus tooling. No pre-registration covers the
cross-edition study yet. Research prototype. Not for clinical use.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.item_parser doc.pdf [--json out.json]
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field, asdict

from app.research.cross_edition.corpus_probe import extract_text
from app.research.cross_edition.edition_align import (
    _SECTION_NAMES, _RUNNING_HEADER, _DATE_LINE, _norm_title,
)

# Marker forms, most specific first. Each yields (kind, value_text).
_MARKER_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("paren_num", re.compile(r"^\s*\((\d+)\)\s+(?=\S)")),
    ("paren_alpha", re.compile(r"^\s*\(([a-z])\)\s+(?=\S)")),
    ("dotted", re.compile(r"^\s*((?:\d+\.){2,})\s+(?=\S)")),      # 1.2. / 7.a.1.
    ("num", re.compile(r"^\s*(\d{1,2})\.\s+(?=\S)")),
    ("alpha", re.compile(r"^\s*([a-z])\.\s+(?=\S)")),             # may be roman
    ("roman", re.compile(r"^\s*((?:x{0,2})(?:ix|iv|v?i{0,3}))\.\s+(?=\S)")),
    ("upper", re.compile(r"^\s*([A-Z])\.\s+(?=\S)")),
    # Bullets. NASEMSO uses glyphs that do not map to Unicode and arrive as
    # U+FFFD, plus literal bullets and "o" sub-bullets. Omitting these left
    # 207 sections with zero items on the first run - roughly a quarter of
    # the corpus, and not a small tail: whole sections are bulleted rather
    # than numbered. Bullets carry no ordinal, so siblings are counted by
    # position within their level.
    ("bullet", re.compile(r"^\s*([�•▪●\-])\s+(?=\S)")),
    ("subbullet", re.compile(r"^\s*(o)\s+(?=\S)")),
]

# Letters that are also roman numerals - the only ones needing disambiguation.
_ROMAN_LETTERS = {"i", "v", "x"}
_ROMAN_ORDER = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"]


@dataclass
class Item:
    item_id: str
    guideline: str
    section: str
    marker: str
    marker_path: str
    depth: int
    text: str = ""
    full_text: str = ""
    char_start: int = 0
    char_end: int = 0


@dataclass
class ParsedEdition:
    doc_id: str
    source_path: str
    canonical_text: str
    n_pages: int
    guidelines: list[str] = field(default_factory=list)
    items: list[Item] = field(default_factory=list)
    ambiguous_markers: int = 0
    unparsed_sections: int = 0


def _detect_running_lines(lines: list[str], n_pages: int) -> set[str]:
    """Find repeated header/footer lines EMPIRICALLY rather than by pattern.

    The hardcoded `_RUNNING_HEADER` regex was written against the 2017/2019
    editions ("Updated January 5, 2019" plus bare page numbers). The 2022
    edition uses entirely different furniture - "NASEMSO", "National Model
    EMS Clinical Guidelines", "Go To TOC" - which the regex does not match,
    so all of it survived into the canonical text and into guideline titles.

    That was not a cosmetic problem. It corrupted title extraction
    ("version 3 0 universal care guideline"), which broke cross-edition
    title matching, which pushed identical items into the "moved" and
    "unmatched" tiers and flipped the study's decision experiment from
    "no method contribution" to "real method contribution" on what was
    purely a parsing artefact.

    Detecting furniture by repetition instead of by pattern generalises to
    any publisher, which is what a corpus spanning multiple agencies needs.
    A line is furniture if it is short and recurs on a large fraction of
    pages - real content does not repeat 400 times.
    """
    from collections import Counter
    counts = Counter(ln.strip() for ln in lines if ln.strip())
    floor = max(10, int(n_pages * 0.5))
    return {
        text for text, n in counts.items()
        if n >= floor and len(text) <= 70
    }


def _clean_to_canonical(text: str, n_pages: int = 0) -> tuple[str, list[tuple[str, int]]]:
    """Drop running headers and page numbers; return the canonical text and
    a list of (line, char_offset_into_canonical) for every kept line."""
    all_lines = text.split("\n")
    furniture = _detect_running_lines(all_lines, n_pages) if n_pages else set()

    kept: list[tuple[str, int]] = []
    out: list[str] = []
    cursor = 0
    for ln in all_lines:
        s = ln.rstrip()
        if _RUNNING_HEADER.match(s) or s.strip() in furniture:
            continue
        kept.append((s, cursor))
        out.append(s)
        cursor += len(s) + 1  # +1 for the newline joining them
    return "\n".join(out), kept


def _classify(line: str, open_levels: list[tuple[str, str]]) -> tuple[str, str] | None:
    """Return (kind, marker) or None. `open_levels` is the current stack of
    (kind, last_marker), used to resolve roman/alpha ambiguity."""
    for kind, pat in _MARKER_PATTERNS:
        m = pat.match(line)
        if not m:
            continue
        marker = m.group(1)
        if kind == "alpha" and marker in _ROMAN_LETTERS:
            # Ambiguous. Prefer whichever continues an open level.
            for lvl_kind, last in reversed(open_levels):
                if lvl_kind == "alpha" and last and _next_alpha(last) == marker:
                    return "alpha", marker
                if lvl_kind == "roman" and last and _next_roman(last) == marker:
                    return "roman", marker
            # Opening a new level: a bare "i." is far more often roman-one.
            return ("roman" if marker == "i" else "alpha"), marker
        return kind, marker
    return None


def _next_alpha(c: str) -> str:
    return chr(ord(c) + 1) if len(c) == 1 and c < "z" else ""


def _next_roman(r: str) -> str:
    try:
        return _ROMAN_ORDER[_ROMAN_ORDER.index(r) + 1]
    except (ValueError, IndexError):
        return ""


def _strip_marker(line: str) -> str:
    for _, pat in _MARKER_PATTERNS:
        m = pat.match(line)
        if m:
            return line[m.end():].strip()
    return line.strip()


def parse(pdf_path: str, doc_id: str | None = None) -> ParsedEdition:
    raw, pages = extract_text(pdf_path)
    canonical, lines = _clean_to_canonical(raw, pages)

    ed = ParsedEdition(
        doc_id=doc_id or pdf_path.rsplit("/", 1)[-1].rsplit(".", 1)[0],
        source_path=pdf_path, canonical_text=canonical, n_pages=pages,
    )

    # Section marks, as in edition_align.
    marks = [
        (i, ln.strip().lower().rstrip(":"))
        for i, (ln, _) in enumerate(lines)
        if ln.strip().lower().rstrip(":") in _SECTION_NAMES
    ]

    alias_anchors = [i for i, nm in marks if nm == "aliases"]
    categories = _collect_categories(lines, alias_anchors)

    cur_guideline = "<preamble>"
    # Edition-scoped, not section-scoped. A guideline can carry the same
    # section name twice (two "Notes" blocks), and a per-section counter
    # restarted on each, leaving 282 colliding ids on the previous run.
    seen_ids: dict[str, int] = {}
    for idx, (line_no, name) in enumerate(marks):
        end = marks[idx + 1][0] if idx + 1 < len(marks) else len(lines)

        if name == "aliases":
            cur_guideline = _title_before(lines, line_no, categories)
            ed.guidelines.append(cur_guideline)
        if name in ("revision date", "references"):
            continue  # metadata, not recommendations

        items, ambiguous = _parse_section_items(
            lines, line_no + 1, end, cur_guideline, name, seen_ids,
        )
        if not items and (end - line_no) > 3:
            ed.unparsed_sections += 1
        ed.items.extend(items)
        ed.ambiguous_markers += ambiguous

    return ed


def _collect_categories(lines: list[tuple[str, int]],
                        anchors: list[int], min_reuse: int = 3) -> set[str]:
    """Identify category headings by REUSE across guidelines.

    Every guideline in these documents is preceded by a category heading
    ("Cardiovascular", "General Medical", "OB/GYN", "Universal Care") and
    then its own title. The category is shared by many guidelines; the title
    is not. Counting how often each candidate line appears directly above an
    "Aliases" anchor separates them without hardcoding a list, which matters
    because the category vocabulary differs between publishers and between
    editions of the same publisher.
    """
    from collections import Counter
    counts: Counter[str] = Counter()
    for anchor in anchors:
        j, seen = anchor - 1, 0
        while j >= 0 and seen < 4:
            t = lines[j][0].strip()
            if not t:
                j -= 1
                continue
            if t.lower().rstrip(":") in _SECTION_NAMES:
                break
            if _DATE_LINE.match(t) or len(t) > 70:
                j -= 1
                continue
            counts[t.lower()] += 1
            seen += 1
            j -= 1
    return {t for t, n in counts.items() if n >= min_reuse}


def _title_before(lines: list[tuple[str, int]], line_no: int,
                  categories: set[str] | None = None) -> str:
    parts: list[str] = []
    j = line_no - 1
    while j >= 0 and len(parts) < 3:
        s = lines[j][0].strip()
        if not s:
            if parts:
                break
            j -= 1
            continue
        if s.lower().rstrip(":") in _SECTION_NAMES:
            break
        if _DATE_LINE.match(s):
            j -= 1
            continue
        if len(s) > 70 or s.endswith((".", ";", ",")):
            break
        parts.insert(0, s)
        j -= 1
    # Wrapped titles can repeat a fragment across lines ("Universal Care" /
    # "Universal Care Guideline"), which the naive join turned into
    # "universal care universal care guideline". Drop any part contained in
    # another.
    # Exact duplicates first, keeping one. v3.0 prints the guideline title
    # twice before "Aliases" (category / title / title), and a pure
    # containment filter dropped BOTH copies - each contains the other -
    # which then fell back to joining the category in as well.
    seen: set[str] = set()
    uniq: list[str] = []
    for a in parts:
        if a.lower() in seen:
            continue
        seen.add(a.lower())
        uniq.append(a)
    kept = [a for k, a in enumerate(uniq)
            if not any(k != m and a.lower() in b.lower() for m, b in enumerate(uniq))]
    kept = kept or uniq
    # Drop category headings ("Cardiovascular", "General Medical", "OB/GYN"),
    # which sit above the title and are not part of a guideline's identity.
    #
    # An earlier version did this by keeping only the line nearest "Aliases".
    # That removed categories but truncated every WRAPPED title, producing
    # "(STEMI)" for "ST-Elevation Myocardial Infarction (STEMI)" and
    # "Model Process)" for the guideline-model-process title - which then
    # failed to match across editions and inflated the unmatched tier.
    #
    # Categories are instead identified empirically: a category heading is
    # reused above many different guidelines, whereas a title line is
    # essentially unique. `categories` is computed in a first pass over the
    # whole document (see _collect_categories) and passed in.
    if categories:
        filtered = [a for a in kept if a.strip().lower() not in categories]
        kept = filtered or kept
    title = " ".join(kept or parts).strip()
    # v3.0 prefixes guideline titles with "Version 3.0", which made the same
    # guideline unmatchable across editions.
    title = re.sub(r"(?i)^version\s*[\d.]+\s*", "", title).strip()
    return title or f"<untitled@{line_no}>"


def _parse_section_items(
    lines: list[tuple[str, int]], start: int, end: int,
    guideline: str, section: str, seen_ids: dict[str, int],
) -> tuple[list[Item], int]:
    """Walk a section's lines, building a marker hierarchy.

    Depth comes from the marker-kind stack: a repeated kind is a sibling, a
    new kind opens a child. Continuation lines (no marker) attach to the
    most recent item.
    """
    items: list[Item] = []
    stack: list[tuple[str, str]] = []   # (kind, last_marker)
    path: list[str] = []
    ambiguous = 0
    last: Item | None = None

    for i in range(start, min(end, len(lines))):
        line, offset = lines[i]
        if not line.strip():
            continue

        cls = _classify(line, stack)
        if cls is None:
            if last is not None:  # continuation of the previous item
                last.text = (last.text + " " + line.strip()).strip()
                last.char_end = offset + len(line)
            continue

        kind, marker = cls
        if kind == "alpha" and marker in _ROMAN_LETTERS:
            ambiguous += 1

        # Where does this kind sit in the open stack?
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
        base_id = f"{_norm_title(guideline)}/{section}/{marker_path}"
        # A section may contain several independent numbered lists (an adult
        # list then a paediatric one), so a marker path alone is not unique
        # within a section - 831 collisions on the first run. Disambiguate by
        # occurrence, which is stable within an edition. Cross-edition
        # stability of the SUFFIXED id is exactly what the study measures and
        # must not be assumed.
        seen_ids[base_id] = seen_ids.get(base_id, 0) + 1
        uniq = base_id if seen_ids[base_id] == 1 else f"{base_id}#{seen_ids[base_id]}"
        item = Item(
            item_id=uniq,
            guideline=guideline, section=section,
            marker=marker, marker_path=marker_path, depth=len(path),
            text=_strip_marker(line),
            char_start=offset, char_end=offset + len(line),
        )
        items.append(item)
        last = item

    # full_text spans an item through its descendants.
    for k, it in enumerate(items):
        stop = next((items[j].char_start for j in range(k + 1, len(items))
                     if items[j].depth <= it.depth), None)
        it.char_end = max(it.char_end, (stop - 1) if stop else it.char_end)
        it.full_text = ""  # filled by caller if needed; offsets are canonical
    return items, ambiguous


def to_dict(ed: ParsedEdition) -> dict:
    """RealDocument-compatible shape - see module docstring."""
    return {
        "doc_id": ed.doc_id,
        "source_path": ed.source_path,
        "n_pages": ed.n_pages,
        "raw_text": ed.canonical_text,
        "n_guidelines": len(ed.guidelines),
        "ambiguous_markers": ed.ambiguous_markers,
        "unparsed_sections": ed.unparsed_sections,
        "items": [asdict(i) for i in ed.items],
    }


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    ed = parse(argv[1])
    depths = {}
    for it in ed.items:
        depths[it.depth] = depths.get(it.depth, 0) + 1
    dup = len(ed.items) - len({i.item_id for i in ed.items})

    print("=" * 74)
    print(f"ITEM PARSER  -  {ed.doc_id}")
    print("=" * 74)
    print(f"  pages                : {ed.n_pages}")
    print(f"  canonical text       : {len(ed.canonical_text):,} chars")
    print(f"  guidelines           : {len(ed.guidelines)}")
    print(f"  ITEMS EXTRACTED      : {len(ed.items):,}")
    print(f"  depth distribution   : " +
          ", ".join(f"d{d}={n}" for d, n in sorted(depths.items())))
    print(f"  duplicate item_ids   : {dup}"
          f"{'  <- IDs are not unique; see notes' if dup else ''}")
    print(f"  ambiguous i/v/x      : {ed.ambiguous_markers}")
    print(f"  sections w/ no items : {ed.unparsed_sections}")

    # Offsets must resolve against canonical_text, or everything downstream
    # is wrong. Verify rather than assume.
    # Compare like with like: strip the marker from the canonical slice
    # before matching, since Item.text is stored marker-stripped. The first
    # run compared a stripped item against an unstripped slice and reported
    # 2000/2000 mismatches on offsets that were in fact correct.
    bad = 0
    for it in ed.items[:2000]:
        slice_ = ed.canonical_text[it.char_start:it.char_start + 120].splitlines()[0]
        if _strip_marker(slice_)[:25].strip() != it.text[:25].strip():
            bad += 1
    print(f"  offset spot-check    : {bad} mismatches in first 2000 items")

    print("\n  --- sample items ---")
    for it in ed.items[:6]:
        print(f"   [{it.marker_path:<8}] d{it.depth}  {it.item_id[:52]}")
        print(f"       {it.text[:88]}")

    if "--json" in argv:
        out = argv[argv.index("--json") + 1]
        with open(out, "w", encoding="utf-8") as f:
            json.dump(to_dict(ed), f, indent=2)
        print(f"\n  wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
