"""
Meridian Citation Tracker
Numbered inline citation pipeline: builds numbered context blocks for the
LLM prompt, validates [N] markers in the generated answer, and returns
citation metadata records.
Research prototype. Not for clinical use.
"""

import re
from typing import Any


def _chunk_id(chunk: dict[str, Any]) -> str:
    """Build a stable-ish identity key for deduping chunks."""
    explicit = chunk.get("chunk_id") or chunk.get("id")
    if explicit:
        return str(explicit)
    return "|".join([
        str(chunk.get("sop_id", "")),
        str(chunk.get("section_title", "")),
        str(chunk.get("chunk_index", "")),
        (chunk.get("text") or chunk.get("chunk_text") or "")[:80],
    ])


def build_numbered_context(chunks: list[dict], max_chars: int = 4000) -> tuple[str, list[dict]]:
    """
    Assign citation numbers [1], [2], ... to retrieved chunks in order
    (deduped by chunk id) and build a labeled context block for the LLM.

    Returns (context_string, citation_records).
    """
    context_parts: list[str] = []
    citation_records: list[dict] = []
    seen: set[str] = set()
    total = 0
    number = 0

    for chunk in chunks:
        cid = _chunk_id(chunk)
        if cid in seen:
            continue

        text = chunk.get("text", chunk.get("chunk_text", "")) or ""
        sop_title = chunk.get("sop_title", "Unknown SOP")
        section = chunk.get("section_title", "")
        chunk_type = chunk.get("chunk_type", "")

        label = sop_title
        if section:
            label += f" - {section}"
        if chunk_type:
            label += f", {chunk_type}"

        entry = f"[{number + 1}] ({label})\n{text}\n"
        if total + len(entry) > max_chars:
            break

        seen.add(cid)
        number += 1
        context_parts.append(entry)
        total += len(entry)

        citation_records.append({
            "number": number,
            "sop_id": chunk.get("sop_id", ""),
            "sop_title": sop_title,
            "section_title": section,
            "chunk_type": chunk_type,
            "snippet": text[:200],
            "relevance_score": chunk.get("relevance_score", 0.0),
            "cited_in_answer": False,
            "version": chunk.get("version", ""),
            "effective_date": chunk.get("effective_date", ""),
            "review_date": chunk.get("review_date", ""),
            "status": chunk.get("status", "active"),
            # Exact character offsets for citation deep-linking (Phase P3).
            # Preserve None as-is - never fabricate an offset.
            "char_start": chunk.get("char_start"),
            "char_end": chunk.get("char_end"),
            "offset_source": chunk.get("offset_source", ""),
            # Verbatim head of raw_text at the stored span - the frontend's
            # purpose-built check for whether these offsets still point at
            # the same text (Phase Q2.1; never derived from `snippet`
            # above, which is title-prefixed for section chunks).
            "offset_anchor": chunk.get("offset_anchor") or "",
        })

    return "\n".join(context_parts), citation_records


def build_numbered_texts(chunks: list[dict]) -> dict[int, str]:
    """Same dedup + numbering order as build_numbered_context, but returns
    the FULL chunk text keyed by citation number (build_numbered_context's
    citation_records only keep a 200-char snippet, which is deliberately
    kept small since those records get serialized to the frontend on every
    answer - full text is only needed server-side, for auto_insert_citations
    below, so it's kept out of the API payload)."""
    texts: dict[int, str] = {}
    seen: set[str] = set()
    number = 0
    for chunk in chunks:
        cid = _chunk_id(chunk)
        if cid in seen:
            continue
        seen.add(cid)
        number += 1
        texts[number] = chunk.get("text", chunk.get("chunk_text", "")) or ""
    return texts


def build_numbered_spans(chunks: list[dict]) -> dict[int, dict]:
    """Same dedup + numbering order as build_numbered_context/
    build_numbered_texts, but returns each chunk's whole-chunk character
    offsets plus its SOP's full raw_text, keyed by citation number - the
    inputs narrow_citation_spans needs to map a narrowed sentence back to
    real document offsets. Kept separate from build_numbered_texts because
    raw_text (a whole SOP document) is much larger than a single chunk's
    text and only narrow_citation_spans needs it."""
    spans: dict[int, dict] = {}
    seen: set[str] = set()
    number = 0
    for chunk in chunks:
        cid = _chunk_id(chunk)
        if cid in seen:
            continue
        seen.add(cid)
        number += 1
        spans[number] = {
            "char_start": chunk.get("char_start"),
            "char_end": chunk.get("char_end"),
            "raw_text": chunk.get("sop_raw_text") or "",
        }
    return spans


_MARKER_RE = re.compile(r"\[(\d+)\]")


def extract_citations(answer: str, citation_records: list[dict]) -> tuple[str, list[dict]]:
    """
    Validate [N] markers in the answer against citation_records.
    Marks cited_in_answer on valid records, strips invalid markers.

    Returns (cleaned_answer, updated_records).
    """
    valid_numbers = {rec["number"] for rec in citation_records}
    cited: set[int] = set()

    def _replace(match: re.Match) -> str:
        n = int(match.group(1))
        if n in valid_numbers:
            cited.add(n)
            return match.group(0)
        return ""

    cleaned = _MARKER_RE.sub(_replace, answer)
    # Tidy whitespace left behind by stripped markers
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r" +([.,;:!?])", r"\1", cleaned)

    updated = []
    for rec in citation_records:
        rec = dict(rec)
        rec["cited_in_answer"] = rec["number"] in cited
        updated.append(rec)

    return cleaned, updated


def extract_citation_numbers(text: str) -> list[int]:
    """[N] markers present in a piece of text, in order, deduped."""
    seen: list[int] = []
    for m in _MARKER_RE.finditer(text):
        n = int(m.group(1))
        if n not in seen:
            seen.append(n)
    return seen


_TRAILING_MARKERS_RE = re.compile(r"^(?:\s*\[(\d+)\])+")


def attach_citation_numbers(answer: str, sentences: list[dict]) -> None:
    """
    Mutates `sentences` in place, adding a `citation_numbers` field to each.

    Both faithfulness checkers split the answer into sentences with a regex
    that splits *between* a sentence's ending punctuation and a following
    "[N]" marker (e.g. "...organism. [1]" becomes "...organism." and "[1]"
    as separate fragments), and drops short marker-only fragments - so the
    marker is never actually inside any kept sentence's text. Rather than
    fight that in the splitter, locate each (already-split, already
    truncated-to-200-chars) sentence back in the original answer and read
    off whatever [N] marker(s) immediately follow it there instead - robust
    to exactly how the splitter fragmented things, since it works from the
    source text rather than the split output.
    """
    search_from = 0
    for sent in sentences:
        text = sent.get("text", "")
        idx = answer.find(text, search_from) if text else -1
        if idx == -1:
            sent["citation_numbers"] = []
            continue
        end = idx + len(text)
        m = _TRAILING_MARKERS_RE.match(answer[end:end + 40])
        sent["citation_numbers"] = [int(n) for n in re.findall(r"\d+", m.group(0))] if m else []
        search_from = end


def _split_sentences_for_citation(answer: str) -> list[str]:
    raw = re.split(r"(?<=[.!?])\s+|\n+", answer.strip())
    return [s.strip() for s in raw if s.strip()]


def auto_insert_citations(
    answer: str,
    numbered_chunk_texts: dict[int, str],
    sim_fn,
    threshold: float = 0.55,
) -> str:
    """
    Server-side safety net for citation coverage: for any substantive
    sentence that has NO [N] marker at all, find the source chunk it's
    most semantically similar to (same matching approach and threshold as
    faithfulness_semantic.check_faithfulness_semantic) and insert that
    citation number - rather than depending on the model to reliably
    follow the "cite inline as [1], [2]" prompt instruction, which smaller
    local models in particular skip on a large fraction of answers.

    Only fills gaps: sentences that already carry a marker - whether
    immediately inside the sentence text or trailing right after it (e.g.
    "...organism. [1]", where a naive split would separate the marker
    from its sentence at the period+space) - are left untouched, using
    the same find-in-original-text + read-trailing-marker approach as
    attach_citation_numbers above, so this never overrides or
    second-guesses a citation the model did provide.

    `sim_fn` is the same cosine-similarity callable check_faithfulness_semantic
    uses; when dense embeddings aren't available (sim_fn is None), this is a
    no-op and the answer is returned unchanged - there is no keyword-based
    equivalent precise enough to safely attribute a sentence to one specific
    source among several.
    """
    if not sim_fn or not numbered_chunk_texts:
        return answer

    sentences = _split_sentences_for_citation(answer)
    insertions: list[tuple[int, int]] = []  # (position, citation_number)
    search_from = 0

    for raw_sent in sentences:
        # A marker trailing sentence N (e.g. "...shock. [1]") has no
        # sentence-ending punctuation of its own to split on, so the naive
        # splitter glues it onto the FRONT of sentence N+1's text instead
        # (e.g. "[1] Vasopressin..."). Strip any such leading marker before
        # treating what's left as this sentence's own content - otherwise
        # sentence N+1 would be mistaken for already-cited using a marker
        # that actually belongs to sentence N.
        sent = _TRAILING_MARKERS_RE.sub("", raw_sent).strip()
        if not sent:
            continue
        idx = answer.find(sent, search_from)
        if idx == -1:
            continue
        end = idx + len(sent)
        search_from = end

        if (
            len(sent) <= 20
            or sent.startswith(("#", "Source:", "---", ">"))
            or "research prototype" in sent.lower()
            or _MARKER_RE.search(sent)  # marker inside the sentence itself
            or _TRAILING_MARKERS_RE.match(answer[end:end + 40])  # marker right after it
        ):
            continue

        best_num, best_sim = None, 0.0
        for num, text in numbered_chunk_texts.items():
            if not text:
                continue
            try:
                sim = float(sim_fn(sent, text))
            except Exception:
                sim = 0.0
            if sim > best_sim:
                best_sim, best_num = sim, num

        if best_num is not None and best_sim >= threshold:
            insertions.append((end, best_num))

    if not insertions:
        return answer

    # Splice right-to-left so earlier positions stay valid as we insert.
    result = answer
    for pos, num in sorted(insertions, key=lambda p: p[0], reverse=True):
        result = f"{result[:pos]} [{num}]{result[pos:]}"
    return result


_PASSAGE_SIM_THRESHOLD = 0.55  # same bar as faithfulness_semantic's _SUPPORTED_THRESHOLD


def narrow_citation_spans(
    answer: str,
    citation_records: list[dict],
    numbered_chunk_texts: dict[int, str],
    numbered_spans: dict[int, dict],
    sim_fn,
) -> None:
    """
    Mutates `citation_records` in place, adding passage_start/passage_end/
    passage_basis/passage_similarity to each record - narrows a citation's
    highlight from the whole chunk span (up to ~2000 chars) down to the
    specific sentence within it that the answer actually used, addressing
    "SOPs will be huge with long texts, show exactly which part is being
    referenced" (Q2.6).

    Never a guess: every record gets passage_start=None/passage_basis=""
    by default, and those stay unset whenever there's no sim_fn, the
    chunk has no offsets (char_start/char_end/raw_text), or no chunk
    sentence clears _PASSAGE_SIM_THRESHOLD against the answer sentence(s)
    that cited it. In every one of those cases the existing whole-chunk
    char_start/char_end (never touched here) remains the honest fallback
    highlight - narrowing is additive, not a replacement.
    """
    for rec in citation_records:
        rec["passage_start"] = None
        rec["passage_end"] = None
        rec["passage_basis"] = ""
        rec["passage_similarity"] = None

    if not sim_fn or not answer:
        return

    # Reuse the same find-in-original-text + read-trailing-marker approach
    # as attach_citation_numbers/auto_insert_citations above, so this is
    # robust to exactly how the naive sentence splitter fragments the
    # marker away from the sentence it belongs to.
    cited_sentences: dict[int, list[str]] = {}
    search_from = 0
    for raw_sent in _split_sentences_for_citation(answer):
        sent = _TRAILING_MARKERS_RE.sub("", raw_sent).strip()
        if not sent:
            continue
        idx = answer.find(sent, search_from)
        if idx == -1:
            continue
        end = idx + len(sent)
        search_from = end

        nums: set[int] = set()
        inline = _MARKER_RE.search(sent)
        if inline:
            nums.add(int(inline.group(1)))
        trailing = _TRAILING_MARKERS_RE.match(answer[end:end + 40])
        if trailing:
            nums |= {int(n) for n in re.findall(r"\d+", trailing.group(0))}
        if not nums:
            continue

        clean_sent = _MARKER_RE.sub("", sent).strip()
        if not clean_sent:
            continue
        for n in nums:
            cited_sentences.setdefault(n, []).append(clean_sent)

    by_number = {rec["number"]: rec for rec in citation_records}
    for num, answer_sents in cited_sentences.items():
        rec = by_number.get(num)
        span = numbered_spans.get(num)
        chunk_text = numbered_chunk_texts.get(num)
        if rec is None or not span or not chunk_text:
            continue
        char_start, char_end = span.get("char_start"), span.get("char_end")
        raw_text = span.get("raw_text")
        if char_start is None or char_end is None or not raw_text:
            continue

        candidates = _split_sentences_for_citation(chunk_text)
        if not candidates:
            continue

        best_sentence, best_sim = None, 0.0
        for a_sent in answer_sents:
            for c_sent in candidates:
                if len(c_sent) < 15:
                    continue
                try:
                    sim = float(sim_fn(a_sent, c_sent))
                except Exception:
                    sim = 0.0
                if sim > best_sim:
                    best_sim, best_sentence = sim, c_sent

        if best_sentence is None or best_sim < _PASSAGE_SIM_THRESHOLD:
            continue

        # Bounded to the chunk's own span so a sentence that happens to
        # repeat elsewhere in the document can't relocate the highlight.
        # Deliberately an exact substring match, not a fuzzy one: for
        # step_anchor chunks (Q2.2) `best_sentence` is itself a paraphrase
        # of the real raw_text wording, so this legitimately misses and
        # falls through to no narrowing (the whole-chunk highlight stays)
        # rather than risk a fuzzy match confidently landing on the wrong
        # words. Verbatim/offset section chunks (Q2.1, the majority case)
        # match exactly here.
        idx = raw_text.find(best_sentence, char_start, char_end)
        if idx == -1:
            continue

        rec["passage_start"] = idx
        rec["passage_end"] = idx + len(best_sentence)
        rec["passage_basis"] = "sentence_semantic"
        rec["passage_similarity"] = round(best_sim, 3)


def citation_coverage(answer: str) -> float:
    """
    Fraction of substantive answer sentences that carry a [N] marker.

    Shared by the RAGAS-lite eval (app/evaluation/ragas_lite.py) and the
    live pipeline's confidence gate (app/agents/pipeline.py) - moved here
    so both read the same definition of "substantive sentence" instead of
    two regexes silently drifting apart.
    """
    # Real bug found empirically (D6, corpus-expansion pass): the sentence
    # split fires on the whitespace between a sentence-ending period and a
    # trailing "[N]" marker - e.g. "...organism. [1]" splits into
    # "...organism." and "[1]" as two separate fragments. The marker
    # fragment is 3 characters, so the length filter below drops it, and
    # the sentence it was marking is left looking uncited. This was already
    # true for every mock-generated answer (every threshold/step line ends
    # with ". [N]") - it just wasn't caught before because a live-LLM
    # answer's different sentence shape occasionally kept the aggregate
    # average above zero, masking a metric that was silently broken for
    # the deterministic mock path the whole time. The negative lookahead
    # keeps a trailing "[N]" attached to the sentence it belongs to.
    raw = re.split(r"(?<=[.!?])\s+(?!\[\d+\])|\n+", answer.strip())
    sentences = [
        s.strip() for s in raw
        if len(s.strip()) > 20
        and not s.strip().startswith("#")
        and not s.strip().startswith("Source:")
        and "research prototype" not in s.lower()
        and not s.strip().startswith("---")
    ]
    if not sentences:
        return 0.0
    cited = sum(1 for s in sentences if _MARKER_RE.search(s))
    return round(cited / len(sentences), 3)
