"""
Cross-edition alignment probe: does (guideline title, section name) work as
an alignment unit across consecutive editions of the same protocol set?

THE QUESTION
------------
The cross-edition provenance study asks: given a recommendation in edition N,
where did it go in edition N+1? Answering that needs an alignment unit that
survives revision. FEASIBILITY.md §3.1 argued the unit should be
(guideline title, section name) rather than numbering, because numbering is
exactly what gets renumbered between editions.

That was an argument from document structure. This module tests it.

WHAT IT MEASURES
----------------
  matched / added / removed  - how many guidelines align by title, and how
                               many exist in only one edition. High match
                               rates mean the alignment unit works; a long
                               unmatched tail means it does not.
  section stability          - for matched guidelines, do the same named
                               sections appear in both editions?
  content change             - per (guideline, section), did the text change?
                               This is the free change label the study needs:
                               it is computed, not annotated.
  revision-date signal       - do the documents' own per-guideline Revision
                               Date fields agree with the computed change?
                               FEASIBILITY.md §3.2 flagged this as unverified
                               and potentially collapsing the labelling
                               burden. This is where it gets verified.

STATUS: exploratory. No pre-registration covers the cross-edition study yet
(the anchoring registrations deliberately do not, and must not be stretched
to). Everything here is corpus characterisation, not hypothesis testing.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.edition_align old.pdf new.pdf

Research prototype. Not for clinical use.
"""

from __future__ import annotations

import difflib
import re
import sys
from dataclasses import dataclass, field

from app.research.cross_edition.corpus_probe import extract_text

# The template slots observed in both NASEMSO editions (corpus_probe.py
# reports them). Order does not matter; membership does. Trailing whitespace
# is stripped before lookup because the source wraps inconsistently.
_SECTION_NAMES = {
    "aliases", "patient care goals", "patient presentation", "patient management",
    "inclusion criteria", "exclusion criteria", "assessment",
    "treatment and interventions", "patient safety considerations",
    "notes/educational pearls", "key documentation elements", "quality improvement",
    "performance measures", "references", "revision date", "key considerations",
    "pertinent assessment findings", "notes", "educational pearls",
}

# Running header on every page, plus bare page numbers. Both must go before
# any offset or content comparison - the same class of problem handled by
# real_corpus/corpus.py::_load_raw for provenance headers.
_RUNNING_HEADER = re.compile(r"^\s*(Updated\s+\w+\s+\d+,?\s*\d{4}|\d{1,4}|\s*)\s*$", re.I)

# A bare date line, e.g. "September 8, 2017" / "June 29,2018". Used to skip
# a preceding Revision Date value when walking backwards for a title.
_DATE_LINE = re.compile(
    r"^\s*(January|February|March|April|May|June|July|August|September|October|"
    r"November|December)\s+\d{1,2}\s*,?\s*\d{4}\s*$", re.I,
)


@dataclass
class Guideline:
    title: str
    sections: dict[str, str] = field(default_factory=dict)
    revision_date: str = ""


def _clean_lines(text: str) -> list[str]:
    out = []
    for ln in text.split("\n"):
        s = ln.rstrip()
        if _RUNNING_HEADER.match(s):
            continue
        out.append(s)
    return out


def _norm_title(t: str) -> str:
    """Titles wrap across lines and carry inconsistent punctuation and
    parentheticals across editions, so comparison is on a normalised form."""
    t = re.sub(r"\s+", " ", t).strip().lower()
    t = re.sub(r"[‘’“”]", "'", t)
    t = re.sub(r"[^a-z0-9 /&'-]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def parse_edition(pdf_path: str) -> list[Guideline]:
    """Segment a protocol set into guidelines and their named sections.

    Anchor: every guideline contains an 'Aliases' section, and the title is
    the text immediately preceding it. Walking on section names rather than
    numbering is the whole point - see the module docstring.
    """
    text, _ = extract_text(pdf_path)
    lines = _clean_lines(text)

    # Index every line that is exactly a template section name.
    marks: list[tuple[int, str]] = []
    for i, ln in enumerate(lines):
        key = ln.strip().lower().rstrip(":")
        if key in _SECTION_NAMES:
            marks.append((i, key))

    guidelines: list[Guideline] = []
    current: Guideline | None = None

    for idx, (line_no, name) in enumerate(marks):
        end = marks[idx + 1][0] if idx + 1 < len(marks) else len(lines)
        body = "\n".join(lines[line_no + 1:end]).strip()

        if name == "aliases":
            # New guideline. Title = the non-empty lines just above, joined,
            # stopping at the previous section's content.
            title_parts: list[str] = []
            j = line_no - 1
            while j >= 0 and len(title_parts) < 3:
                s = lines[j].strip()
                if not s:
                    if title_parts:
                        break
                    j -= 1
                    continue
                if s.lower().rstrip(":") in _SECTION_NAMES:
                    break
                # Skip a preceding section's VALUE, not just its label. In
                # these documents "Revision Date" often sits immediately
                # before the next guideline's title, so a naive walk picks
                # up the date as the title - which split the Neonatal
                # Resuscitation guideline into a spurious removed/added
                # pair ("september 8 2017 neonatal resuscitation" vs
                # "june 29 2018 neonatal resuscitation") on the first run.
                if _DATE_LINE.match(s):
                    j -= 1
                    continue
                # Stop at obvious body text - titles are short.
                if len(s) > 70 or s.endswith((".", ";", ",")):
                    break
                title_parts.insert(0, s)
                j -= 1
            current = Guideline(title=" ".join(title_parts).strip() or f"<untitled@{line_no}>")
            guidelines.append(current)

        if current is None:
            continue
        if name == "revision date":
            current.revision_date = body.split("\n")[0].strip() if body else ""
        else:
            current.sections[name] = body

    return guidelines


def _changed(a: str, b: str) -> tuple[bool, float]:
    """Returns (changed, similarity). Whitespace-normalised so that pure
    re-flowing between editions is not counted as a content change."""
    na = re.sub(r"\s+", " ", a).strip()
    nb = re.sub(r"\s+", " ", b).strip()
    if na == nb:
        return False, 1.0
    ratio = difflib.SequenceMatcher(None, na, nb).ratio()
    return True, ratio


def align(old_pdf: str, new_pdf: str) -> dict:
    old = parse_edition(old_pdf)
    new = parse_edition(new_pdf)

    old_by = {_norm_title(g.title): g for g in old}
    new_by = {_norm_title(g.title): g for g in new}

    matched = sorted(set(old_by) & set(new_by))
    removed = sorted(set(old_by) - set(new_by))
    added = sorted(set(new_by) - set(old_by))

    section_rows = []
    unchanged = changed = 0
    for key in matched:
        go, gn = old_by[key], new_by[key]
        for sec in sorted(set(go.sections) | set(gn.sections)):
            a, b = go.sections.get(sec), gn.sections.get(sec)
            if a is None or b is None:
                section_rows.append({"guideline": key, "section": sec,
                                     "status": "section_added" if a is None else "section_removed",
                                     "similarity": 0.0})
                changed += 1
                continue
            ch, sim = _changed(a, b)
            section_rows.append({"guideline": key, "section": sec,
                                 "status": "changed" if ch else "unchanged",
                                 "similarity": round(sim, 4)})
            changed += ch
            unchanged += (not ch)

    # Does the documents' own Revision Date field track computed change?
    rev_rows = []
    for key in matched:
        go, gn = old_by[key], new_by[key]
        gl_changed = any(r["status"] != "unchanged"
                         for r in section_rows if r["guideline"] == key)
        rev_rows.append({
            "guideline": key,
            "old_rev": go.revision_date, "new_rev": gn.revision_date,
            "rev_date_differs": go.revision_date != gn.revision_date,
            "content_changed": gl_changed,
        })

    agree = sum(1 for r in rev_rows if r["rev_date_differs"] == r["content_changed"])
    return {
        "old_guidelines": len(old), "new_guidelines": len(new),
        "matched": len(matched), "removed": len(removed), "added": len(added),
        "match_rate": round(len(matched) / max(1, len(old)), 4),
        "removed_titles": removed[:15], "added_titles": added[:15],
        "sections_compared": len(section_rows),
        "sections_unchanged": unchanged, "sections_changed": changed,
        "section_rows": section_rows,
        "revision_rows": rev_rows,
        "rev_date_agreement": round(agree / max(1, len(rev_rows)), 4),
        "rev_date_differs_count": sum(1 for r in rev_rows if r["rev_date_differs"]),
        "content_changed_count": sum(1 for r in rev_rows if r["content_changed"]),
    }


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    r = align(argv[1], argv[2])
    print("=" * 74)
    print("CROSS-EDITION ALIGNMENT PROBE   [exploratory]")
    print("=" * 74)
    print(f"  guidelines      old={r['old_guidelines']}  new={r['new_guidelines']}")
    print(f"  matched by title: {r['matched']}  ({r['match_rate']*100:.1f}% of old)")
    print(f"  removed         : {r['removed']}   added: {r['added']}")
    if r["removed_titles"]:
        print(f"      removed e.g.: {r['removed_titles'][:4]}")
    if r["added_titles"]:
        print(f"      added   e.g.: {r['added_titles'][:4]}")
    print()
    print(f"  sections compared: {r['sections_compared']}")
    print(f"      unchanged    : {r['sections_unchanged']}")
    print(f"      changed      : {r['sections_changed']}")
    print()
    print("  REVISION-DATE SIGNAL (FEASIBILITY.md §3.2)")
    print(f"      guidelines whose Revision Date differs : {r['rev_date_differs_count']}")
    print(f"      guidelines whose content changed       : {r['content_changed_count']}")
    print(f"      agreement between the two              : {r['rev_date_agreement']*100:.1f}%")
    print()
    if r["rev_date_agreement"] > 0.9 and r["rev_date_differs_count"] > 0:
        print("  -> Revision dates track content change. Free change labels available.")
    elif r["rev_date_differs_count"] == 0:
        print("  -> Revision dates do NOT move between these editions. No free labels;")
        print("     the annotation plan in the execution plan stands unchanged.")
    else:
        print("  -> Revision dates move but disagree with computed change. Treat the")
        print("     date field as unreliable and label from content.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
