"""
B5 model + similarity-floor sensitivity grid (2026-08-18 full-project
audit, Phase 3).

`baseline_b5.py` used the smallest BGE model (`bge-small-en-v1.5`,
384-dim) and a similarity floor (0.85) chosen as a stated convention,
never calibrated - exactly what a reviewer will press on, since B5 is
this study's answer to "did you compare against a modern baseline?".

Sweeps {bge-small-en-v1.5, bge-base-en-v1.5, bge-large-en-v1.5} x
{0.75, 0.80, 0.85, 0.90, 0.95} and reports the ENTIRE 3x5 grid - fixed
here, before any cell is computed, so this cannot become threshold- or
model-tuning after seeing which cell flatters the comparison.

Efficient by construction: embeds each (pair, model) combination ONCE
(baseline_b5.align_items_b5's expensive step) and reuses those cached
embeddings across all 5 floors via
baseline_b5.greedy_match_from_embeddings (cheap - no re-encoding), since
the floor only gates acceptance in an already-computed similarity
matrix, not the embeddings themselves. This is still a real re-run per
floor, not a shortcut around one: greedy consumption order means an
earlier item's acceptance under a given floor changes which candidates
are available to later items, so the matching outcome genuinely depends
on the floor and each floor is scored by actually re-running the greedy
loop, only the (expensive) embedding step is cached.

Joined by parse-order index (sample_join.py), scored against the same
233-item ground truth every other corrected analysis in this study
uses.

Does not modify item_align.py, item_parser.py, corpus_probe.py,
edition_align.py, or app/rag/embeddings.py.

Run:
    cd sop-guard/backend
    python -m app.research.cross_edition.annotation_packets.b5_model_floor_sweep
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))  # backend/ on sys.path

import app.research.cross_edition.annotation_packets.run_h3_test as _rt  # noqa: E402
_rt.ANNOTATOR_FILES = {k: rf"C:\Users\Faisal\Desktop\research paper\Annotator_{k}.xlsx" for k in "ABCD"}
_rt.ADJUDICATION_FILE = r"C:\Users\Faisal\Desktop\research paper\Adjudication_43_items_completed.xlsx"

from app.research.cross_edition.annotation import _norm_answer  # noqa: E402
from app.research.cross_edition.item_parser import parse  # noqa: E402
from app.rag.embeddings import get_embedding_provider  # noqa: E402
from app.research.cross_edition.baseline_b5 import greedy_match_from_embeddings  # noqa: E402
from app.research.cross_edition.annotation_packets.run_h3_test import (  # noqa: E402
    PAIRS, build_ground_truth,
)
from app.research.cross_edition.annotation_packets.sample_join import (  # noqa: E402
    build_index_join,
)

BASE = Path(__file__).parent
MODELS = ["BAAI/bge-small-en-v1.5", "BAAI/bge-base-en-v1.5", "BAAI/bge-large-en-v1.5"]
FLOORS = [0.75, 0.80, 0.85, 0.90, 0.95]


def build_sample_index_and_gt():
    """{pair: [(sample_id, parse_order_index), ...]}, ground_truth"""
    import csv
    ground_truth = build_ground_truth()
    out = {}
    for pair, (slug, old_pdf, new_pdf) in PAIRS.items():
        id_to_index, _ = build_index_join(old_pdf, new_pdf)
        with open(BASE / slug / "annotation_packet.csv", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
        out[pair] = [(r["sample_id"], id_to_index[r["old_item_id"]]) for r in rows]
    return out, ground_truth


def main():
    print("Building sample index + ground truth...")
    sample_index, ground_truth = build_sample_index_and_gt()

    grid: dict[str, dict[str, float]] = {}

    for model_name in MODELS:
        grid[model_name] = {}
        print(f"\n=== Model: {model_name} ===")

        # Embed each pair ONCE for this model, cache old_items/new_items/vecs.
        cache = {}
        provider = get_embedding_provider(backend="auto", model_name=model_name)
        for pair, (slug, old_pdf, new_pdf) in PAIRS.items():
            old_items = parse(old_pdf).items
            new_items = parse(new_pdf).items
            old_vecs = provider.embed_texts([it.text for it in old_items])
            new_vecs = provider.embed_texts([it.text for it in new_items])
            cache[pair] = (old_items, new_items, old_vecs, new_vecs)
            print(f"  {pair}: embedded ({len(old_items)}/{len(new_items)} items)")

        for floor in FLOORS:
            correct = total = 0
            for pair, (old_items, new_items, old_vecs, new_vecs) in cache.items():
                all_results = greedy_match_from_embeddings(
                    old_items, new_items, old_vecs, new_vecs, provider, floor)
                gt = ground_truth[pair]
                for sid, idx in sample_index[pair]:
                    if sid not in gt:
                        continue
                    truth = gt[sid]
                    if truth == "cannot_determine":
                        continue
                    pred = _norm_answer(all_results[idx]["b5_predicted_item_id"])
                    total += 1
                    if pred == truth:
                        correct += 1
            acc = correct / total if total else 0.0
            grid[model_name][str(floor)] = round(acc, 4)
            print(f"  floor={floor:.2f}: accuracy={acc:.4f}  (n={total})")

    print("\n=== Full grid ===")
    print(f"{'model':<28}" + "".join(f"{f:>8.2f}" for f in FLOORS))
    for model_name in MODELS:
        print(f"{model_name:<28}" + "".join(
            f"{grid[model_name][str(f)]:>8.4f}" for f in FLOORS))

    print("\nReference points: method=0.7124, B2=0.7597 (from FEASIBILITY.md section 65)")

    out = BASE / "b5_model_floor_sweep_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"grid": grid, "models": MODELS, "floors": FLOORS,
                    "reference_method_accuracy": 0.7124,
                    "reference_b2_accuracy": 0.7597}, f, indent=2)
    print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
