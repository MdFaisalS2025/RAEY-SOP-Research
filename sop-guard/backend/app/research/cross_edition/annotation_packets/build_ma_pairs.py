"""
One-off script: draws the stratified sample and generates blind annotator
workbooks for the seventh/eighth confirmatory pairs committed in
PREREGISTRATION.md's 2026-08-24 "Seventh and eighth confirmatory pairs"
entry - Massachusetts v2025.1->v2026.1 and v2026.1->v2026.2, the study's
fourth publisher.

Massachusetts requires item_parser_ma.py (new, not frozen) instead of the
frozen item_parser.parse - reuses annotation.stratified_sample/
write_annotation_packet COMPLETELY UNCHANGED via the same monkeypatch-
injection pattern vlm_rescue_attempt.py established: item_align.parse and
item_parser.parse are temporarily pointed at item_parser_ma.parse for
exactly these two PDF paths, restored immediately after. Neither
item_align.py, item_parser.py, edition_align.py, nor corpus_probe.py is
ever modified.

Two new annotators (next available letters after the main round's A-D,
the H3' follow-up's E-H, and the fifth/sixth pairs' I/J): Annotator K
and Annotator L.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.build_ma_pairs
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition import item_align, item_parser  # noqa: E402
from app.research.cross_edition.item_parser_ma import parse as parse_ma  # noqa: E402
from app.research.cross_edition import annotation  # noqa: E402
from app.research.cross_edition.annotation_packets.build_annotator_workbooks import (  # noqa: E402
    Workbook, build_instructions_sheet, build_pair_sheet, load_pair,
)

BASE = Path(__file__).parent
SP = r"C:\Users\Faisal\Desktop\Hospital SOP's Research\corpus\protocols"

PAIRS = [
    ("massachusetts_v20251_v20261", "Massachusetts v2025.1→v2026.1 (new pair 7)",
     f"{SP}\\ma_2025_fresh.pdf", f"{SP}\\ma_v20261.pdf"),
    ("massachusetts_v20261_v20262", "Massachusetts v2026.1→v2026.2 (new pair 8)",
     f"{SP}\\ma_v20261.pdf", f"{SP}\\ma_v20262.pdf"),
]


def _ma_parse(path: str, doc_id: str | None = None, _cache: dict = {}):
    if path not in _cache:
        _cache[path] = parse_ma(path, doc_id)
    return _cache[path]


def draw_and_write():
    orig_align_parse = item_align.parse
    orig_item_parser_parse = item_parser.parse
    item_align.parse = _ma_parse
    item_parser.parse = _ma_parse
    try:
        for slug, title, old_pdf, new_pdf in PAIRS:
            print(f"=== {title} ===")
            result = annotation.stratified_sample(old_pdf, new_pdf)
            print("  population by tier:",
                  {t: len(v) for t, v in result.get("by_tier", {}).items()}
                  if "by_tier" in result else "(see result dict shape)")
            csv_path, ctx_path = annotation.write_annotation_packet(result, str(BASE / slug))
            print(f"  wrote {csv_path}")
            print(f"  wrote {ctx_path}")
    finally:
        item_align.parse = orig_align_parse
        item_parser.parse = orig_item_parser_parse


def build_workbook(annotator_label: str, out_path: Path):
    wb = Workbook()
    build_instructions_sheet(wb, annotator_label)
    for slug, title, _old, _new in PAIRS:
        rows, ctx = load_pair(slug)
        build_pair_sheet(wb, title, rows, ctx)
    wb.save(out_path)
    print(f"wrote {out_path}  ({len(PAIRS)} pairs, 60 rows each)")


if __name__ == "__main__":
    draw_and_write()
    build_workbook("Annotator K", BASE / "Annotator_K_ANNOTATION.xlsx")
    build_workbook("Annotator L", BASE / "Annotator_L_ANNOTATION.xlsx")
