"""
Second-domain corpus (Workstream B, novelty-audit plan): US Code Title 18
(Crimes and Criminal Procedure), two official release points (PL 117-81,
2021; PL 118-158, 2024) - a genuine version pair, both release points
confirmed to have actually touched Title 18, not an arbitrary snapshot
pair. Retrieved directly from uscode.house.gov's official USLM XML
releases (user's explicit download permission).

WHY THIS DOMAIN: EMS protocol PDFs sit at one end of the structure-
detection-quality spectrum (heuristic anchor detection, real errors -
section 56). US Code XML sits at the opposite end: OLRC-published,
machine-readable, with STABLE, OFFICIAL section identifiers and clean
chapter/section nesting - structure detection is close to perfect by
construction. Demonstrating the section 61 threshold/crossover in BOTH
domains is the cross-domain replication check (HC3) the novelty-audit
plan calls for.

Builds genuine item_parser.Item / ParsedEdition objects (the SAME
dataclasses the frozen PDF pipeline uses) from the XML, so the REAL,
UNMODIFIED item_align.align_items can run on this input via the same
monkeypatch-parse() pattern structure_ablation.py already uses - no
parallel alignment logic is written, no risk of diverging from the
studied method.

Mapping: USC chapter -> guideline (chapters are named, coherent topic
groupings, the closest analog to a protocol guideline - Title 18 has
141 chapters averaging ~10 sections each, comparable in scale to the
EMS corpus's ~12-24 items/guideline). USC section -> item, with item_id
set to the section's own OFFICIAL USLM identifier (e.g.
"/us/usc/t18/s2") rather than a reconstructed one - this IS the ground
truth for correspondence, not an approximation of it.

REPEALED SECTIONS: USC commonly preserves a repealed section's number
as a placeholder ("SS 2331. Repealed.") to keep later numbering stable.
A repealed section's identifier persisting across editions is NOT a
true content correspondence - its content is gone, same as if it had
been deleted outright. Detected by a case-insensitive "repealed" match
in the section's heading and treated as a true deletion in ground
truth (title/section list of a repealed section's own identifier is
recorded separately, see `usc_ground_truth`).

Does not modify item_parser.py, item_align.py, corpus_probe.py, or
edition_align.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.uscode_corpus
"""
from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

from app.research.cross_edition.item_parser import Item, ParsedEdition

_NS = "{http://xml.house.gov/schemas/uslm/1.0}"
_REPEALED_RE = re.compile(r"\brepealed\b", re.I)


def _local(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def _text_of(elem: ET.Element) -> str:
    """All text content under this element, tags stripped, whitespace
    collapsed - matches item_parser.Item.text's role (marker-stripped
    body text) closely enough for token-level similarity matching."""
    parts = list(elem.itertext())
    t = " ".join(p.strip() for p in parts if p and p.strip())
    return re.sub(r"\s+", " ", t).strip()


@dataclass
class USCSection:
    identifier: str
    chapter_identifier: str
    chapter_heading: str
    heading: str
    text: str
    repealed: bool


def parse_uscode_xml(xml_path: str) -> list[USCSection]:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    sections: list[USCSection] = []

    def walk(elem: ET.Element, chapter_id: str | None, chapter_heading: str | None):
        tag = _local(elem.tag)
        if tag == "chapter":
            chapter_id = elem.get("identifier", chapter_id)
            heading_el = elem.find(f"{_NS}heading")
            chapter_heading = (heading_el.text or "").strip() if heading_el is not None else chapter_heading
        elif tag == "section" and chapter_id is not None:
            ident = elem.get("identifier")
            if ident:
                heading_el = elem.find(f"{_NS}heading")
                heading = (heading_el.text or "").strip() if heading_el is not None else ""
                text = _text_of(elem)
                repealed = bool(_REPEALED_RE.search(heading)) or (
                    len(text) < 40 and bool(_REPEALED_RE.search(text))
                )
                sections.append(USCSection(
                    identifier=ident, chapter_identifier=chapter_id,
                    chapter_heading=chapter_heading or "UNKNOWN",
                    heading=heading, text=text, repealed=repealed,
                ))
            # Sections don't nest further sections; still recurse in case
            # of unusual structure, harmless either way.
        for child in elem:
            walk(child, chapter_id, chapter_heading)

    walk(root, None, None)
    return sections


def to_parsed_edition(sections: list[USCSection], doc_id: str) -> ParsedEdition:
    """Builds a genuine item_parser.ParsedEdition/Item structure so the
    real, unmodified item_align.align_items can run on it unchanged."""
    items: list[Item] = []
    guidelines: list[str] = []
    seen_guidelines: set[str] = set()

    offset = 0
    canonical_parts: list[str] = []
    for sec in sections:
        gtitle = f"{sec.chapter_heading} [{sec.chapter_identifier}]"
        if gtitle not in seen_guidelines:
            seen_guidelines.add(gtitle)
            guidelines.append(gtitle)

        marker = sec.identifier.rsplit("/s", 1)[-1] if "/s" in sec.identifier else sec.identifier
        body = sec.text
        start = offset
        canonical_parts.append(body)
        offset += len(body) + 1

        items.append(Item(
            item_id=sec.identifier,  # the USC's own official identifier - ground truth itself
            guideline=gtitle, section="usc", marker=marker, marker_path=marker,
            depth=1, text=body, full_text=body,
            char_start=start, char_end=offset - 1,
        ))

    return ParsedEdition(
        doc_id=doc_id, source_path=doc_id, canonical_text="\n".join(canonical_parts),
        n_pages=0, guidelines=guidelines, items=items,
        ambiguous_markers=0, unparsed_sections=0, anchor="uscode_xml",
    )


def usc_ground_truth(old_sections: list[USCSection], new_sections: list[USCSection]) -> dict[str, str]:
    """{old_identifier: new_identifier or 'NONE'}. True correspondence =
    identical official identifier present in both editions AND not
    repealed in the new edition (a repealed section's surviving
    identifier is a true deletion of content, not a correspondence)."""
    new_by_id = {s.identifier: s for s in new_sections}
    gt: dict[str, str] = {}
    for s in old_sections:
        new = new_by_id.get(s.identifier)
        if new is not None and not new.repealed:
            gt[s.identifier] = s.identifier
        else:
            gt[s.identifier] = "NONE"
    return gt


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    old_sections = parse_uscode_xml(argv[1])
    new_sections = parse_uscode_xml(argv[2])
    print(f"old: {len(old_sections)} sections, "
          f"{len({s.chapter_identifier for s in old_sections})} chapters, "
          f"{sum(1 for s in old_sections if s.repealed)} repealed")
    print(f"new: {len(new_sections)} sections, "
          f"{len({s.chapter_identifier for s in new_sections})} chapters, "
          f"{sum(1 for s in new_sections if s.repealed)} repealed")
    gt = usc_ground_truth(old_sections, new_sections)
    persisted = sum(1 for v in gt.values() if v != "NONE")
    print(f"ground truth: {persisted}/{len(gt)} old sections persist "
          f"(non-repealed identifier match) in the new edition")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
