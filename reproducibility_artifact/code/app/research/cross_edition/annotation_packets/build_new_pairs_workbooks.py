"""
One-off script: builds the 2-annotator blind workbooks for the two new
confirmatory pairs committed in PREREGISTRATION.md's 2026-08-23
"Fifth and sixth confirmatory pairs" entry - Tennessee Sept2024->09.11.2025
and Connecticut v2024.1->v2025.1 - reusing build_annotator_workbooks.py's
own instructions text, column layout, and blind-design formatting
imported directly, exactly the same reuse pattern build_h3prime_workbooks.py
already established for the H3' follow-up pair.

Scoped to just these two new pairs, not merged into the original 4-pair
combined workbooks the existing Annotator A-D already completed - adding
rows to an already-submitted design would not be a fair comparison to
redo, and this study's own standing discipline is never to retroactively
alter an already-collected instrument.

Two annotators (next available letters after the main round's A-D and
the H3' follow-up's E-H): Annotator I and Annotator J.

Not part of the research pipeline itself.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.build_new_pairs_workbooks
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.annotation_packets.build_annotator_workbooks import (  # noqa: E402
    Workbook, build_instructions_sheet, build_pair_sheet, load_pair,
)

BASE = Path(__file__).parent

PAIRS = [
    ("tennessee_sept2024_20250911", "Tennessee Sept2024→09.11.2025 (new pair 5)"),
    ("connecticut_v20241_v20251", "Connecticut v2024.1→v2025.1 (new pair 6)"),
]


def build_workbook(annotator_label: str, out_path: Path):
    wb = Workbook()
    build_instructions_sheet(wb, annotator_label)
    for slug, title in PAIRS:
        rows, ctx = load_pair(slug)
        build_pair_sheet(wb, title, rows, ctx)
    wb.save(out_path)
    print(f"wrote {out_path}  ({sum(1 for _ in PAIRS)} pairs, 60 rows each)")


if __name__ == "__main__":
    build_workbook("Annotator I", BASE / "Annotator_I_ANNOTATION.xlsx")
    build_workbook("Annotator J", BASE / "Annotator_J_ANNOTATION.xlsx")
