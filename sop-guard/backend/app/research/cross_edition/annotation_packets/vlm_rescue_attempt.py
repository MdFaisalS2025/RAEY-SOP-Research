"""
Exploratory, one-off script (audit round 4 follow-up): tests whether
VLM-identified guideline boundaries can rescue a failing cross-edition
pair whose alignment problem was diagnosed as an anchor-detection
failure - built for DC (FEASIBILITY.md section 83), reusable against
any future candidate with a similar failure mode.

Does NOT modify item_parser.py, item_align.py, corpus_probe.py, or
edition_align.py - operates entirely on in-memory copies of already-
parsed editions, reusing structure_ablation.py's established
monkeypatch-parse() pattern for testing "what if" scenarios against the
real, unmodified item_align.align_items.

Approach:
1. Get VLM titles for both editions (vlm_boundaries.extract_vlm_titles).
2. Locate each title's position in canonical_text, guarding against the
   known table-of-contents pitfall (a naive first-match search can land
   in the ToC rather than the body) by only accepting a match at or
   after the marker-parser's own first non-preamble item - a signal
   that real body content has started.
3. Reassign every item's .guideline to whichever VLM-title span its
   char_start falls into.
4. Re-run item_align.align_items on the VLM-remapped editions and
   compare against the original, unmodified alignment.

Requires GEMINI_API_KEY in the environment (never read back or logged
by this module).

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.vlm_rescue_attempt <old.pdf> <new.pdf> <old_vlm_cache.json> <new_vlm_cache.json> <original_trivially_alignable_pct> <original_unmatched_pct>
"""
from __future__ import annotations

import copy
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.item_parser import parse  # noqa: E402
from app.research.cross_edition import item_align  # noqa: E402
from app.research.cross_edition.vlm_boundaries import extract_vlm_titles  # noqa: E402


def remap_to_vlm_boundaries(ed, vlm_titles: list[str]):
    """Returns a deep copy of ed with every item's .guideline reassigned
    to the VLM title whose span it falls into. Guards against the known
    ToC pitfall: a title match before the first non-preamble item in the
    ORIGINAL marker-parser's own output is rejected (real body content
    has not started yet at that offset)."""
    ed2 = copy.deepcopy(ed)
    text = ed2.canonical_text

    first_real_item = next((it for it in ed2.items if it.guideline != "<preamble>"), None)
    body_start = first_real_item.char_start if first_real_item else 0

    positions = []
    for title in vlm_titles:
        idx = text.find(title, body_start)
        if idx == -1:
            continue  # title not found verbatim in this edition's text
        positions.append((idx, title))
    positions.sort()

    if not positions:
        return ed2, 0, len(vlm_titles)

    for it in ed2.items:
        best_title = "<preamble>"
        for pos, title in positions:
            if pos <= it.char_start:
                best_title = title
            else:
                break
        it.guideline = best_title

    ed2.guidelines = sorted({t for _, t in positions})
    return ed2, len(positions), len(vlm_titles)


def run_rescue_attempt(old_pdf: str, new_pdf: str, old_cache: str, new_cache: str) -> dict:
    old_ed, new_ed = parse(old_pdf), parse(new_pdf)

    old_vlm = extract_vlm_titles(old_pdf, old_cache)["titles"]
    new_vlm = extract_vlm_titles(new_pdf, new_cache)["titles"]

    old_remapped, old_found, old_total = remap_to_vlm_boundaries(old_ed, old_vlm)
    new_remapped, new_found, new_total = remap_to_vlm_boundaries(new_ed, new_vlm)

    fake_editions = {old_pdf: old_remapped, new_pdf: new_remapped}

    def fake_parse(path, doc_id=None, _fe=fake_editions):
        return _fe[path]

    orig_parse = item_align.parse
    item_align.parse = fake_parse
    try:
        result = item_align.align_items(old_pdf, new_pdf)
    finally:
        item_align.parse = orig_parse

    all_results = result["_all_results"]
    tiers = Counter(r["tier"] for r in all_results)
    n = len(all_results)
    trivial = tiers["T1_id_exact"] + tiers["T2_id_text_changed"]
    unmatched = tiers["T6_unmatched_old"]

    return {
        "n": n, "tiers": dict(tiers),
        "trivially_alignable_pct": round(trivial / n, 4) if n else 0,
        "unmatched_pct": round(unmatched / n, 4) if n else 0,
        "vlm_mapping_success": {
            "old": round(old_found / old_total, 4) if old_total else 0,
            "new": round(new_found / new_total, 4) if new_total else 0,
        },
    }


def main(argv: list[str]) -> int:
    if len(argv) < 5:
        print(__doc__)
        return 2
    old_pdf, new_pdf, old_cache, new_cache = argv[1], argv[2], argv[3], argv[4]
    result = run_rescue_attempt(old_pdf, new_pdf, old_cache, new_cache)

    print(f"VLM mapping success: old={result['vlm_mapping_success']['old']:.1%}  "
          f"new={result['vlm_mapping_success']['new']:.1%}")
    for t, c in result["tiers"].items():
        print(f"  {t:20s} {c:5d}  {c / result['n']:.1%}")
    print(f"\n  trivially alignable: {result['trivially_alignable_pct']:.1%}")
    print(f"  unmatched:           {result['unmatched_pct']:.1%}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
