"""
Phase U pilot evaluation: structural anchoring vs. four baselines, on a real
public-domain corpus (2 CDC documents, 24 hand-paraphrased items - see
paraphrases.py's docstring for construction).

This is a PILOT, not the full-scale corpus the Phase U plan calls for
(target 30-60 documents, thousands of Tier-A pairs plus a hand-verified
Tier-B set). It exists to prove the evaluation methodology end-to-end on
real, non-synthetic, non-Meridian-authored text before committing to the
much larger sourcing and annotation effort - and to surface real failure
modes a synthetic corpus can't (see corpus.py's duplicate-ID finding).

Methods compared, in the same order as the Phase U plan's baseline list:
  1. quote        - W3C-TextQuoteSelector-style: exact substring, then
                     whitespace-normalized substring. This is exactly what
                     _locate_span in app/rag/chunker.py already does -
                     reimplemented standalone here so this harness has zero
                     import dependency on the demo-SOP pipeline.
  2. fuzzy         - difflib.SequenceMatcher sliding window over line-sized
                     chunks of raw_text, picking the best-scoring window.
                     The prototype chunker.py's docstring says was tried and
                     rejected for the demo corpus; re-tested here on real
                     text rather than taken on faith.
  3. embed_span    - best-matching single line by cosine similarity via the
                     project's real dense embedding backend
                     (bge-small-en-v1.5, already loaded in this environment)
                     - skipped gracefully if unavailable.
  4. whole_doc     - floor: always returns the entire document.
  5. structural    - THE METHOD UNDER TEST. Anchors to the document's own
                     ID marker (e.g. "7.aa." or "5. ") via regex, gated by
                     the same asymmetric containment check chunker.py uses
                     for _locate_step_by_number, generalized here to work
                     against either document's numbering scheme rather than
                     a hardcoded "Step N:" pattern.

Metrics:
  localization_accuracy - fraction of returned (non-null) spans that
    OVERLAP the ground-truth span for that item_id.
  false_anchor_rate     - of NON-null, NON-whole-doc-floor returns, the
    fraction that do NOT overlap the ground-truth span. This is the
    headline safety metric per the Phase U plan: a method that returns
    wrong-but-confident spans is worse than one that abstains.
  coverage               - fraction of items where the method returned
    something other than null and other than the whole_doc floor.

Run: python -m app.research.real_corpus.pilot_eval
"""

import difflib
import re

from app.research.real_corpus.corpus import load_real_corpus, RealDocument
from app.research.real_corpus.paraphrases import PARAPHRASES

_CONTAINMENT_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "to", "of",
    "in", "on", "for", "and", "or", "this", "that", "it", "with", "as", "at",
    "by", "from", "should", "must", "will", "when", "how", "does", "can",
    "could", "would", "each", "any", "all", "not", "if", "then", "used",
}


def _tokens(s: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]{3,}", s.lower()) if t not in _CONTAINMENT_STOPWORDS}


def _containment(a: str, b: str) -> float:
    """Fraction of a's tokens present in b - asymmetric, same rationale as
    chunker.py's _containment: a is the (possibly compressed) paraphrase,
    b is the longer real block being anchored to."""
    ta, tb = _tokens(a), _tokens(b)
    return 0.0 if not ta else len(ta & tb) / len(ta)


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def method_quote(raw_text: str, paraphrase: str, item_id: str) -> tuple[int, int] | None:
    idx = raw_text.find(paraphrase)
    if idx != -1:
        return idx, idx + len(paraphrase)
    norm_needle = _normalize(paraphrase)
    if len(norm_needle) < 8:
        return None
    norm_chars, index_map = [], []
    prev_space = False
    for i, ch in enumerate(raw_text):
        if ch.isspace():
            if not prev_space:
                norm_chars.append(" ")
                index_map.append(i)
            prev_space = True
        else:
            norm_chars.append(ch.lower())
            index_map.append(i)
            prev_space = False
    normalized = "".join(norm_chars)
    idx = normalized.find(norm_needle)
    if idx == -1:
        return None
    start = index_map[idx]
    end = index_map[min(idx + len(norm_needle) - 1, len(index_map) - 1)] + 1
    return start, end


def method_fuzzy(raw_text: str, paraphrase: str) -> tuple[int, int] | None:
    """Sliding window of ~paraphrase-length over raw_text, scored by
    difflib.SequenceMatcher ratio; returns the best-scoring window if it
    clears a minimal plausibility floor (0.3), else None. Deliberately the
    same class of approach chunker.py's docstring says was prototyped and
    rejected - re-run here on real text, not assumed to still fail."""
    window = max(40, len(paraphrase))
    step = max(10, window // 4)
    best_score, best_span = 0.0, None
    for start in range(0, max(1, len(raw_text) - window), step):
        chunk = raw_text[start:start + window]
        score = difflib.SequenceMatcher(None, paraphrase.lower(), chunk.lower()).ratio()
        if score > best_score:
            best_score, best_span = score, (start, start + window)
    if best_score < 0.3:
        return None
    return best_span


def method_embed_span(raw_text: str, paraphrase: str, sim_fn) -> tuple[int, int] | None:
    """Best-matching single line of raw_text by cosine similarity. Returns
    None if similarity never clears 0.5 (mirrors faithfulness_semantic.py's
    partial-support floor, the nearest existing calibrated analog)."""
    lines = raw_text.split("\n")
    offsets = []
    cursor = 0
    for line in lines:
        offsets.append(cursor)
        cursor += len(line) + 1
    best_score, best_idx = 0.0, -1
    for i, line in enumerate(lines):
        if len(line.strip()) < 15:
            continue
        try:
            score = float(sim_fn(paraphrase, line))
        except Exception:
            continue
        if score > best_score:
            best_score, best_idx = score, i
    if best_idx == -1 or best_score < 0.5:
        return None
    start = offsets[best_idx]
    return start, start + len(lines[best_idx])


def method_whole_doc(raw_text: str) -> tuple[int, int]:
    return 0, len(raw_text)


_MARKER_MIN_CONTAINMENT = 0.60


def _marker_pattern(item_id: str) -> str:
    escaped = re.escape(item_id)
    if re.fullmatch(r"\d+[a-z]?", item_id):
        return rf"(?m)^{escaped}\.\s+.*(?:\n(?!\d+[a-z]?\.\s).*)*"
    return rf"(?m)^{escaped}\.\s+.*(?:\n(?!\d+\.(?:[a-z]+\.)*(?:\d+\.)?\s).*)*"


def _locate_block_by_marker(raw_text: str, item_id: str) -> re.Match | None:
    """Anchor to the document's own ID marker for item_id via regex - not a
    text-similarity guess. Two marker shapes covered, matching what
    corpus.py's two real parsers actually produce: "N" / "Na"
    (core_practices' category markers, at line start followed by ". ") and
    "N.letter.letter...(.digit)" (disinfection_sterilization's deep
    numbering, at line start followed by a period and whitespace). Shared by
    both method_structural (lexical gate) and method_structural_margin
    (relative-margin gate) - only the accept/reject decision differs."""
    return re.search(_marker_pattern(item_id), raw_text)


def method_structural(raw_text: str, paraphrase: str, item_id: str) -> tuple[int, int] | None:
    """THE METHOD UNDER TEST (original design), gated by asymmetric lexical
    containment so a coincidentally-matching marker elsewhere in the doc
    still returns None rather than a confident wrong answer."""
    m = _locate_block_by_marker(raw_text, item_id)
    if not m:
        return None
    block = m.group(0)
    if _containment(paraphrase, block) < _MARKER_MIN_CONTAINMENT:
        return None
    return m.start(), m.end()


def method_structural_margin(raw_text: str, paraphrase: str, item_id: str,
                              sibling_ids: list[str], sim_fn) -> tuple[int, int] | None:
    """Same marker-based location as method_structural, but gated by
    RELATIVE ranking against the document's own sibling items rather than an
    absolute similarity floor.

    Built after two absolute semantic-similarity gates (whole-block cosine,
    clause-level semantic containment) were calibrated on this same corpus
    and both failed to separate correct from incorrect matches WITHIN one
    document - sibling items in a clinical guideline share so much domain
    vocabulary that no absolute threshold cleanly separates them (see Phase
    U plan). Embeddings do discriminate correctly in a RELATIVE regime
    (this is also the reason method_embed_span works: it picks an argmax
    over the whole document rather than clearing a fixed bar). So here: the
    marker-located candidate must out-score every other real item in the
    same document for this exact paraphrase, not just clear a floor. No
    additional margin constant beyond strict inequality is used - ties are
    rejected - specifically to avoid fitting a threshold to this pilot's
    35-pair sample (see the plan's own repeated warning against exactly
    that kind of overfitting elsewhere in this evaluation)."""
    m = _locate_block_by_marker(raw_text, item_id)
    if not m:
        return None
    candidate_score = float(sim_fn(paraphrase, m.group(0)))
    for rival_id in sibling_ids:
        if rival_id == item_id:
            continue
        rival_m = _locate_block_by_marker(raw_text, rival_id)
        if rival_m is None:
            continue
        rival_score = float(sim_fn(paraphrase, rival_m.group(0)))
        if rival_score >= candidate_score:
            return None
    return m.start(), m.end()


def _overlaps(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def _iou(a: tuple[int, int], b: tuple[int, int]) -> float:
    """Intersection-over-union of two spans. Added after a real finding
    while running this pilot: cdc_core_practices' ground-truth spans are
    whole multi-paragraph category blocks (often 500+ chars), so a method
    that returns a single matching LINE anywhere inside that block counts
    as "overlapping" under the binary check above even though it located
    only a small, imprecise fraction of the true span. IoU penalizes that
    correctly - a tiny prediction inside a huge true span, or a huge
    prediction (e.g. whole_doc) around a tiny true span, both score low."""
    inter_start, inter_end = max(a[0], b[0]), min(a[1], b[1])
    inter = max(0, inter_end - inter_start)
    union = (a[1] - a[0]) + (b[1] - b[0]) - inter
    return inter / union if union > 0 else 0.0


def run_pilot() -> dict:
    docs: dict[str, RealDocument] = {d.doc_id: d for d in load_real_corpus()}
    sim_fn = None
    try:
        from app.rag.embedding_cache import is_dense_backend_active, dense_similarity
        if is_dense_backend_active():
            sim_fn = dense_similarity
    except Exception:
        pass

    results: dict[str, list[dict]] = {
        "quote": [], "fuzzy": [], "embed_span": [], "whole_doc": [], "structural": [],
        "structural_margin": [],
    }

    for pair in PARAPHRASES:
        doc = docs[pair["doc_id"]]
        item = next(i for i in doc.items if i["item_id"] == pair["item_id"])
        truth = (item["char_start"], item["char_end"])
        paraphrase = pair["paraphrase"]

        span = method_quote(doc.raw_text, paraphrase, pair["item_id"])
        results["quote"].append({"pair": pair, "span": span, "overlaps": bool(span and _overlaps(span, truth)),
                                  "iou": _iou(span, truth) if span else 0.0})

        span = method_fuzzy(doc.raw_text, paraphrase)
        results["fuzzy"].append({"pair": pair, "span": span, "overlaps": bool(span and _overlaps(span, truth)),
                                  "iou": _iou(span, truth) if span else 0.0})

        if sim_fn is not None:
            span = method_embed_span(doc.raw_text, paraphrase, sim_fn)
            results["embed_span"].append({"pair": pair, "span": span, "overlaps": bool(span and _overlaps(span, truth)),
                                           "iou": _iou(span, truth) if span else 0.0})

        span = method_whole_doc(doc.raw_text)
        results["whole_doc"].append({"pair": pair, "span": span, "overlaps": True, "iou": _iou(span, truth)})

        span = method_structural(doc.raw_text, paraphrase, pair["item_id"])
        results["structural"].append({"pair": pair, "span": span, "overlaps": bool(span and _overlaps(span, truth)),
                                       "iou": _iou(span, truth) if span else 0.0})

        if sim_fn is not None:
            sibling_ids = [i["item_id"] for i in doc.items]
            span = method_structural_margin(doc.raw_text, paraphrase, pair["item_id"], sibling_ids, sim_fn)
            results["structural_margin"].append({"pair": pair, "span": span, "overlaps": bool(span and _overlaps(span, truth)),
                                                   "iou": _iou(span, truth) if span else 0.0})

    n = len(PARAPHRASES)
    summary = {}
    for method, rows in results.items():
        if not rows:
            continue
        n_method = len(rows)
        non_null_non_floor = [r for r in rows if r["span"] is not None and method != "whole_doc"]
        localization_accuracy = sum(1 for r in rows if r["overlaps"]) / n_method
        coverage = len(non_null_non_floor) / n_method if method != "whole_doc" else 1.0
        false_anchors = [r for r in non_null_non_floor if not r["overlaps"]]
        false_anchor_rate = (
            len(false_anchors) / len(non_null_non_floor) if non_null_non_floor else 0.0
        )
        mean_iou = sum(r["iou"] for r in rows) / n_method
        summary[method] = {
            "n": n_method,
            "localization_accuracy": round(localization_accuracy, 3),
            "mean_iou": round(mean_iou, 3),
            "coverage": round(coverage, 3),
            "false_anchor_rate": round(false_anchor_rate, 3),
            "false_anchor_examples": [
                {"item_id": r["pair"]["item_id"], "doc_id": r["pair"]["doc_id"]} for r in false_anchors
            ],
        }
    return {"n_pairs": n, "embed_span_available": sim_fn is not None, "summary": summary, "raw_results": results}


def print_report(report: dict) -> None:
    print(f"\nPhase U pilot: {report['n_pairs']} real paraphrase pairs, 2 real CDC documents")
    if not report["embed_span_available"]:
        print("(embed_span baseline skipped - no dense embedding backend active)")
    print(f"\n{'method':<14}{'coverage':<12}{'localization_acc':<20}{'mean_iou':<12}{'false_anchor_rate':<20}")
    for method, s in report["summary"].items():
        print(f"{method:<14}{s['coverage']:<12}{s['localization_accuracy']:<20}{s['mean_iou']:<12}{s['false_anchor_rate']:<20}")
        for ex in s["false_anchor_examples"]:
            print(f"    false anchor: {ex['doc_id']} #{ex['item_id']}")


if __name__ == "__main__":
    print_report(run_pilot())
