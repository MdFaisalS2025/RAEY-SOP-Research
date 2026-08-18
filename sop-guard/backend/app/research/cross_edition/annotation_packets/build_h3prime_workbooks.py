"""
One-off script: builds the 2-annotator workbooks for the H3' follow-up
sample (h3prime_tennessee_2022_2024/), reusing the exact same instructions
text, column layout, and blind-design formatting already built and
validated in build_annotator_workbooks.py - imported directly rather than
duplicated, so any formatting fix there does not silently diverge here.

Not part of the research pipeline itself.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.build_h3prime_workbooks
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

from app.research.cross_edition.annotation_packets.build_annotator_workbooks import (  # noqa: E402
    Workbook, build_instructions_sheet, build_pair_sheet, load_pair,
)

BASE = Path(__file__).parent
SLUG = "h3prime_tennessee_2022_2024"
TITLE = "Tennessee 2022-23 -> Sept2024 (H3' follow-up)"


def build_workbook(annotator_label: str, out_path: Path):
    wb = Workbook()
    build_instructions_sheet(wb, annotator_label)
    rows, ctx = load_pair(SLUG)
    build_pair_sheet(wb, TITLE, rows, ctx)
    wb.save(out_path)
    print(f"wrote {out_path}  ({len(rows)} rows)")


if __name__ == "__main__":
    out_dir = BASE / SLUG
    build_workbook("Annotator E", out_dir / "Annotator_E_ANNOTATION.xlsx")
    build_workbook("Annotator F", out_dir / "Annotator_F_ANNOTATION.xlsx")
