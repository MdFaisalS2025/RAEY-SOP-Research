"""
Meridian Mock Generator
------------------------
Compose answers from retrieved chunks in mock mode.
Research prototype  - NOT for clinical use.
"""

import re
from typing import Any

from app.rag.citation_tracker import (
    build_numbered_context, build_numbered_texts, build_numbered_spans,
    extract_citations, narrow_citation_spans, _chunk_id,
)

# Minimum relevance score to consider a chunk useful. This only catches
# queries with essentially no lexical overlap with the corpus at all - it
# does NOT reliably separate "wrong domain" from "right domain, weak
# match". Verified directly: with a plain TF-IDF retriever (no reranker;
# see hybrid_retriever.py for why the reranker is disabled), an
# out-of-scope oncology query scored 0.165 top-chunk relevance - *higher*
# than several genuinely in-scope queries in the same eval set (0.088,
# 0.153, 0.160). A single relevance-score threshold cannot separate those
# without also rejecting the legitimate ones. Domain-mismatch detection at
# moderate relevance levels is an open problem here; a corpus-entity/
# vocabulary check (e.g. does the query mention any known drug/condition
# from entity_graph.py's lexicon) would be a stronger signal than raw
# top-K score, but isn't implemented. This floor is kept because it still
# does useful, narrow work: catching near-zero-relevance queries.
_MIN_RELEVANCE = 0.05

# Patterns to strip from chunk text during cleaning
_NOISE_PATTERNS = [
    re.compile(r"^DISCLAIMER.*$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"SYNTHETIC SOP[^\n]*", re.IGNORECASE),
    re.compile(r"^Version\s+\d+\.\d+\s*\|?\s*Effective.*$", re.MULTILINE | re.IGNORECASE),
    re.compile(r"\n{3,}", re.MULTILINE),
]


class MockGenerator:
    """Generate answers from retrieved chunks without calling an LLM."""

    def generate_answer(
        self,
        query: str,
        retrieved_chunks: list[dict[str, Any]],
        query_type: str = "general",
    ) -> dict[str, Any]:
        """
        Compose an answer from the top retrieved chunks.

        Returns dict with: answer, citations, reasoning_trace.
        """
        reasoning_trace = [
            f"Query classified as: {query_type}",
            f"Retrieved {len(retrieved_chunks)} chunks",
        ]

        # Filter to chunks with meaningful relevance
        good_chunks = [
            c for c in retrieved_chunks
            if c.get("relevance_score", 0) >= _MIN_RELEVANCE
        ]

        # Abstention: if no relevant chunks found
        if not good_chunks:
            reasoning_trace.append("No sufficiently relevant chunks found - abstaining.")
            return {
                "answer": (
                    "I cannot safely answer this question based on the available SOPs. "
                    "Please consult the relevant department or clinical supervisor."
                ),
                "citations": [],
                "inline_citations": [],
                "followup_questions": [],
                "reasoning_trace": reasoning_trace,
                "confidence": 0.1,
                "abstained": True,
            }

        reasoning_trace.append(f"{len(good_chunks)} chunks above relevance threshold.")

        top_chunk = good_chunks[0]
        sop_title = top_chunk.get("sop_title", "Unknown SOP")
        section = top_chunk.get("section_title", "")
        top_text = top_chunk.get("text", top_chunk.get("chunk_text", ""))

        source_label = f"Source: {sop_title}"
        if section:
            source_label += f", {section}"

        citations = []
        for chunk in good_chunks[:3]:
            ct = chunk.get("sop_title", "Unknown SOP")
            cs = chunk.get("section_title", "")
            label = f"[Source: {ct}"
            if cs:
                label += f", {cs}"
            label += "]"
            citations.append(label)
            reasoning_trace.append(
                f"Used chunk from '{ct}' (score: {chunk.get('relevance_score', 0):.3f})"
            )

        # Number every good chunk (not just the top 3 used for the plain
        # `citations` strings above) using the same identity/ordering the
        # LLM path uses, so mock-mode answers get real [N] markers and the
        # frontend Sources panel - previously empty in mock mode, the
        # default install - has something to render.
        citation_map: dict[str, int] = {}
        for c in good_chunks:
            key = _chunk_id(c)
            if key not in citation_map:
                citation_map[key] = len(citation_map) + 1
        _, citation_records = build_numbered_context(good_chunks)

        # Build answer based on query type
        if query_type in ("sequence", "procedure_steps", "monitoring"):
            answer = self._build_sequence_answer(sop_title, top_text, good_chunks, citation_map)
        elif query_type in ("threshold", "medication"):
            answer = self._build_threshold_answer(sop_title, top_text, good_chunks, citation_map, query=query)
        elif query_type == "contraindication":
            answer = self._build_contraindication_answer(sop_title, top_text, good_chunks, citation_map)
        else:
            answer = self._build_general_answer(sop_title, top_text, good_chunks, citation_map)

        answer += f"\n\n{source_label}"

        # Validate/strip [N] markers and mark which citation records were
        # actually used - same post-processing the LLM path does, so both
        # generation modes produce consistent inline_citations shapes.
        answer, citation_records = extract_citations(answer, citation_records)

        # Narrow each citation's highlight to the specific sentence the
        # answer actually used (Q2.6) - mock mode is the default install
        # (no LLM configured), so this is the majority code path, not a
        # secondary one. Never fatal to the answer itself; falls back to
        # leaving passage_* fields empty on any failure.
        try:
            from app.rag.faithfulness_semantic import get_similarity_fn
            numbered_texts = build_numbered_texts(good_chunks)
            numbered_spans = build_numbered_spans(good_chunks)
            narrow_citation_spans(answer, citation_records, numbered_texts, numbered_spans, get_similarity_fn())
        except Exception:
            pass

        # Confidence based on top chunk relevance
        top_score = good_chunks[0].get("relevance_score", 0)
        num_good = len(good_chunks)
        if top_score > 0.05:
            confidence = 0.85
        elif top_score > 0.03:
            confidence = 0.70
        elif top_score > 0.01:
            confidence = 0.55
        else:
            confidence = 0.30
        # Boost slightly if multiple good chunks found
        if num_good >= 3 and confidence < 0.90:
            confidence += 0.05

        return {
            "answer": answer,
            "citations": citations,
            "inline_citations": citation_records,
            "followup_questions": self._template_followups(query_type),
            "reasoning_trace": reasoning_trace,
            "confidence": round(confidence, 2),
            "abstained": False,
        }

    @staticmethod
    def _template_followups(query_type: str) -> list[str]:
        """
        Fixed per-query-type follow-up suggestions. These are template-based,
        not personalized to the specific SOP or answer content (the mock
        generator has no LLM to draft bespoke ones) - deliberately generic
        rather than fabricated specifics.
        """
        templates: dict[str, list[str]] = {
            "threshold": [
                "What should be done if this threshold is exceeded?",
                "Are there contraindications to consider first?",
                "Who should be notified if this value is abnormal?",
            ],
            "medication": [
                "What should be done if this threshold is exceeded?",
                "Are there contraindications to consider first?",
                "Who should be notified if this value is abnormal?",
            ],
            "sequence": [
                "What equipment is needed for this procedure?",
                "What are the contraindications for this procedure?",
                "How is this procedure documented?",
            ],
            "procedure_steps": [
                "What equipment is needed for this procedure?",
                "What are the contraindications for this procedure?",
                "How is this procedure documented?",
            ],
            "contraindication": [
                "What should be used instead?",
                "What should be monitored if this situation arises?",
                "Who should be notified?",
            ],
            "monitoring": [
                "What is the escalation threshold for these values?",
                "How should abnormal findings be documented?",
                "Who should be notified of abnormal values?",
            ],
        }
        return templates.get(query_type, [
            "What are the key thresholds in this protocol?",
            "What are the contraindications?",
            "What are the procedural steps?",
        ])

    # ------------------------------------------------------------------
    # Helper: extract key sentences
    # ------------------------------------------------------------------

    @staticmethod
    def _is_noise_line(line: str) -> bool:
        """Check if a line is noise that should be filtered from answers."""
        line = line.strip()
        if not line or len(line) < 15:
            return True
        upper = line.upper()
        # Headers and disclaimers
        if any(p in upper for p in ["DISCLAIMER", "SYNTHETIC SOP", "RESEARCH DEMONSTRATION"]):
            return True
        if re.match(r"^VERSION\s+\d|^EFFECTIVE\s+\d", upper):
            return True
        # Section number headers like "1. PURPOSE" or "7. DOCUMENTATION"
        if re.match(r"^\d+\.\s+[A-Z]{3,}$", line.strip()):
            return True
        # Chunk headers like "Sepsis Management Protocol - 2. SCOPE:"
        if re.match(r"^[A-Z][a-z].*Protocol\s*-\s*\d+\.", line):
            return True
        if re.match(r"^[A-Z][a-z].*Protocol\s*-\s*[A-Z]", line):
            return True
        # Chunk headers containing " - " followed by section-style names
        if re.match(
            r"^.{5,}\s+-\s+(?:Contraindications|Warnings|Thresholds|Steps|Procedure|"
            r"Scope|Purpose|Definitions|Documentation|References|Overview|Summary)\b",
            line, re.IGNORECASE,
        ):
            return True
        # All-caps short lines (section headers)
        if line.isupper() and len(line) < 50:
            return True
        # Very short lines that are just labels
        if len(line) < 20 and not re.search(r"\d", line):
            return True
        return False

    @staticmethod
    def _extract_key_sentences(text: str, max_sentences: int = 4, citation_number: "int | None" = None) -> list[str]:
        """Extract the most informative sentences, filtering all noise.

        citation_number is appended as [N] to every returned line when
        provided - only pass it when `text` is known to come from a single
        chunk (e.g. the top chunk), since a citation on aggregated
        multi-chunk text would misattribute the source.
        """
        lines = text.split("\n")
        good = []
        for line in lines:
            line = line.strip().lstrip("- ")
            if not line or len(line) < 20:
                continue
            if MockGenerator._is_noise_line(line):
                continue
            # Skip lines that are just section references
            if re.match(r"^[A-Z][a-z]+ .+ Protocol - \d+\.", line):
                continue
            if re.match(r"^\d+\.\s+[A-Z]{2,}$", line):
                continue
            # Prefer lines with actionable content
            good.append(line)

        # Prioritize lines with clinical actions
        action_words = {"administer", "monitor", "assess", "check", "obtain", "measure", "start",
                        "stop", "hold", "give", "apply", "place", "remove", "notify", "document",
                        "verify", "confirm", "ensure", "initiate", "discontinue", "titrate"}

        scored = []
        for line in good:
            words = set(line.lower().split())
            action_score = len(words & action_words)
            has_number = bool(re.search(r"\d", line))
            scored.append((action_score + (1 if has_number else 0), line))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = [s[1] for s in scored[:max_sentences]]
        if citation_number is not None:
            top = [MockGenerator._mark(s, citation_number) for s in top]
        return top

    @staticmethod
    def _mark(line: str, citation_number: "int | None") -> str:
        """Append a [N] citation marker to a line when a number is known."""
        return f"{line} [{citation_number}]" if citation_number is not None else line

    # ------------------------------------------------------------------
    # Scanning helpers for cross-cutting concerns
    # ------------------------------------------------------------------

    @staticmethod
    def _scan_thresholds(chunks_or_text, citation_map: dict[str, int] | None = None) -> list[tuple[str, "int | None"]]:
        """Extract lines containing threshold-like clinical values.

        Accepts either a string (combined text) or a list of chunk dicts.
        When given chunks, prioritizes threshold-typed chunks and pairs each
        line with its originating chunk's citation number (via
        citation_map), so callers can attach a real [N] marker instead of
        guessing. Returns (line, citation_number_or_None) tuples; the
        string-input path (ambiguous origin) always returns None numbers.
        """
        found: list[tuple[str, int | None]] = []
        seen: set[str] = set()

        def _matches(stripped: str) -> bool:
            return bool(re.search(
                r"[><≥≤]=?\s*\d"
                r"|(?:target|threshold|maximum|minimum|dose|rate|limit)\b.*\d",
                stripped, re.IGNORECASE,
            ))

        if isinstance(chunks_or_text, list):
            priority = [c for c in chunks_or_text if c.get("chunk_type") == "threshold"]
            other = [c for c in chunks_or_text if c.get("chunk_type") != "threshold"]
            for c in priority + other:
                text = c.get("text", c.get("chunk_text", ""))
                num = (citation_map or {}).get(_chunk_id(c))
                for line in text.split("\n"):
                    stripped = line.strip().lstrip("- ")
                    if not stripped or len(stripped) < 10 or stripped in seen:
                        continue
                    if _matches(stripped):
                        seen.add(stripped)
                        found.append((stripped, num))
        else:
            for line in chunks_or_text.split("\n"):
                stripped = line.strip().lstrip("- ")
                if not stripped or len(stripped) < 10 or stripped in seen:
                    continue
                if _matches(stripped):
                    seen.add(stripped)
                    found.append((stripped, None))
        return found

    @staticmethod
    def _scan_contraindications(chunks_or_text, citation_map: dict[str, int] | None = None) -> list[tuple[str, "int | None"]]:
        """Extract lines with contraindication/warning language.

        Accepts either a string (combined text) or a list of chunk dicts.
        When given chunks, prioritizes contraindication-typed chunks and
        pairs each line with its originating chunk's citation number (see
        _scan_thresholds for why). Returns (line, citation_number_or_None).
        """
        keywords = [
            "do not", "don't", "contraindicated", "avoid", "must not",
            "should not", "never", "caution", "prohibited", "warning",
        ]
        found: list[tuple[str, int | None]] = []
        seen: set[str] = set()

        def _matches(stripped: str) -> bool:
            return not MockGenerator._is_noise_line(stripped) and any(k in stripped.lower() for k in keywords)

        if isinstance(chunks_or_text, list):
            priority = [c for c in chunks_or_text if c.get("chunk_type") == "contraindication"]
            other = [c for c in chunks_or_text if c.get("chunk_type") != "contraindication"]
            for c in priority + other:
                text = c.get("text", c.get("chunk_text", ""))
                num = (citation_map or {}).get(_chunk_id(c))
                for line in text.split("\n"):
                    stripped = line.strip().lstrip("- ")
                    if not stripped or len(stripped) < 10 or stripped in seen:
                        continue
                    if _matches(stripped):
                        seen.add(stripped)
                        found.append((stripped, num))
        else:
            for line in chunks_or_text.split("\n"):
                stripped = line.strip().lstrip("- ")
                if not stripped or len(stripped) < 10 or stripped in seen:
                    continue
                if _matches(stripped):
                    seen.add(stripped)
                    found.append((stripped, None))
        return found

    # ------------------------------------------------------------------
    # Answer builders
    # ------------------------------------------------------------------

    def _build_sequence_answer(
        self, sop_title: str, top_text: str, chunks: list[dict], citation_map: "dict[str, int] | None" = None
    ) -> str:
        """Extract and present numbered steps cleanly."""
        primary_sop = chunks[0].get("sop_id", "") if chunks else ""
        same_sop = [c for c in chunks if c.get("sop_id") == primary_sop]

        # Strategy 1: Look for a step_sequence chunk (has all steps)
        for chunk in same_sop:
            if chunk.get("chunk_type") == "step_sequence":
                text = chunk.get("text", chunk.get("chunk_text", ""))
                num_cite = (citation_map or {}).get(_chunk_id(chunk))
                steps = re.findall(
                    r"Step\s+(\d+)\s*:\s*(.+?)(?=Step\s+\d+\s*:|$)",
                    text, re.DOTALL | re.IGNORECASE
                )
                if steps:
                    lines = []
                    for num, content in sorted(steps, key=lambda x: int(x[0])):
                        first_line = content.strip().split("\n")[0].strip()
                        if first_line and len(first_line) > 5:
                            lines.append(self._mark(f"{num}. {first_line}", num_cite))
                    if lines:
                        return (
                            f"Based on the {sop_title}, follow these steps:\n\n"
                            + "\n".join(lines)
                            + self._append_extras(same_sop, citation_map)
                        )

        # Strategy 2: Collect individual step chunks
        step_chunks = [c for c in same_sop if c.get("chunk_type") == "step"]
        if step_chunks:
            lines = []
            for chunk in step_chunks:
                text = chunk.get("text", chunk.get("chunk_text", ""))
                num_cite = (citation_map or {}).get(_chunk_id(chunk))
                match = re.match(r"Step\s+(\d+)\s*:\s*(.+)", text, re.DOTALL | re.IGNORECASE)
                if match:
                    num = match.group(1)
                    content = match.group(2).strip().split("\n")[0].strip()
                    if content and len(content) > 5:
                        lines.append((int(num), self._mark(f"{num}. {content}", num_cite)))
            if lines:
                lines.sort(key=lambda x: x[0])
                return (
                    f"Based on the {sop_title}, follow these steps:\n\n"
                    + "\n".join(l[1] for l in lines)
                    + self._append_extras(same_sop, citation_map)
                )

        # Strategy 3: Parse steps from combined text of all chunks
        combined = "\n".join(c.get("text", c.get("chunk_text", "")) for c in same_sop)

        step_explicit = re.findall(
            r"Step\s+(\d+)\s*:\s*(.+?)(?=Step\s+\d+\s*:|$)",
            combined, re.DOTALL | re.IGNORECASE,
        )

        lines = []
        if step_explicit:
            for num, text in step_explicit:
                first_line = text.strip().split("\n")[0].strip()
                if first_line and len(first_line) > 5:
                    lines.append((int(num), f"{num}. {first_line}"))

        if not lines:
            numbered = re.findall(
                r"(?:^|\n)\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.\s|\n\n|$)",
                combined, re.DOTALL,
            )
            for num, text in numbered:
                first_line = text.strip().split("\n")[0].strip()
                if (first_line and len(first_line) > 10 and not first_line.isupper()
                    and first_line.upper() not in ("PURPOSE", "SCOPE", "DEFINITIONS", "DOCUMENTATION", "REFERENCES")):
                    lines.append((int(num), f"{num}. {first_line}"))

        if lines:
            seen = set()
            unique = []
            for num, line in sorted(lines, key=lambda x: x[0]):
                if num not in seen:
                    seen.add(num)
                    unique.append(line)
            return (
                f"Based on the {sop_title}, follow these steps:\n\n"
                + "\n".join(unique)
                + self._append_extras(same_sop, citation_map)
            )

        return (
            f"Based on the {sop_title}, the relevant procedural steps are:\n\n"
            + self._clean_text(top_text)
        )

    def _append_extras(self, chunks: list[dict], citation_map: "dict[str, int] | None" = None) -> str:
        """Append thresholds and warnings from non-step chunks."""
        extras = ""

        # Scan for thresholds
        thresholds = self._scan_thresholds(chunks, citation_map)
        if thresholds:
            extras += "\n\nKey thresholds:\n" + "\n".join(f"- {self._mark(t, n)}" for t, n in thresholds[:5])

        # Scan for contraindications
        contras = self._scan_contraindications(chunks, citation_map)
        if contras:
            extras += "\n\nImportant:\n" + "\n".join(f"- {self._mark(c, n)}" for c, n in contras[:3])

        return extras

    @staticmethod
    def _format_threshold_line(raw: str) -> str:
        """Re-format a threshold line into 'Parameter: value (context)' form.

        Input examples:
            >=65 mmHg: MAP
            MAP target: >=65 mmHg
            Lactate >2 mmol/L (repeat within 2-4 hours)
        All should become parameter-first with contextual parenthetical.
        """
        # Pattern A: "value: parameter" (backwards) e.g. ">=65 mmHg: MAP"
        m = re.match(
            r"^([><≥≤]=?\s*\d[\d.]*\s*\S+)\s*:\s*(.+)$", raw
        )
        if m:
            value, param = m.group(1).strip(), m.group(2).strip()
            return f"{param}: {value}"

        # Pattern B: already "parameter: value ..." — return as-is
        m2 = re.match(r"^([A-Za-z][\w\s]{2,30}):\s*(.+)$", raw)
        if m2:
            return raw

        # Pattern C: inline like "MAP >=65 mmHg" or "Lactate >2 mmol/L (...)"
        m3 = re.match(
            r"^([A-Za-z][\w\s]{1,30}?)\s+([><≥≤]=?\s*\d.*)$", raw
        )
        if m3:
            param, rest = m3.group(1).strip(), m3.group(2).strip()
            return f"{param}: {rest}"

        # Default: return the line cleaned up
        return raw

    def _build_threshold_answer(
        self, sop_title: str, top_text: str, chunks: list[dict], citation_map: "dict[str, int] | None" = None,
        query: str = "",
    ) -> str:
        """Extract and present threshold values with clinical context."""
        primary_sop = chunks[0].get("sop_id", "") if chunks else ""
        same_sop = [c for c in chunks if c.get("sop_id") == primary_sop]

        # Strategy 1: prefer threshold-typed chunks (pre-structured data)
        threshold_chunks = [
            c for c in same_sop if c.get("chunk_type") == "threshold"
        ]
        other_chunks = [
            c for c in same_sop[:4] if c.get("chunk_type") != "threshold"
        ]
        ordered_chunks = threshold_chunks + other_chunks

        combined = "\n".join(
            c.get("text", c.get("chunk_text", "")) for c in ordered_chunks
        )
        combined = self._clean_text(combined)

        threshold_lines = self._scan_thresholds(ordered_chunks, citation_map)
        threshold_line_set = {t for t, _ in threshold_lines}

        # Also extract action triggers (lines with "if", "when", "escalate",
        # "notify", "alert" near a number or threshold)
        action_triggers: list[str] = []
        for line in combined.split("\n"):
            stripped = line.strip().lstrip("- ")
            if not stripped or len(stripped) < 10:
                continue
            if self._is_noise_line(stripped):
                continue
            if re.search(
                r"(?:if|when|escalate|notify|alert|contact|call)\b",
                stripped, re.IGNORECASE,
            ) and re.search(r"\d", stripped):
                if stripped not in threshold_line_set and stripped not in action_triggers:
                    action_triggers.append(stripped)

        if threshold_lines:
            # Individual threshold chunks are prefixed "{sop_title}. " in
            # their raw text (see chunker.py) - that repetition helps the
            # cross-encoder relevance judge, which scores an isolated
            # abbreviation-only fact much lower than one with its SOP
            # context attached, but it reads as redundant noise in the
            # displayed answer (which already opens with "Based on the
            # {sop_title}..."). Strip it here, right before display.
            title_prefix = f"{sop_title}. "
            formatted = [
                self._mark(
                    self._format_threshold_line(t[len(title_prefix):] if t.startswith(title_prefix) else t),
                    n,
                )
                for t, n in threshold_lines[:10]
            ]
            items = "\n".join(f"- {t}" for t in formatted)
            answer = (
                f"Based on the {sop_title}, the relevant clinical values are:\n\n"
                f"{items}"
            )
            if action_triggers:
                answer += "\n\nWhen to act:\n"
                answer += "\n".join(f"- {a}" for a in action_triggers[:5])
            # Real gap found in a full-app audit: "What is the maximum
            # norepinephrine dose?" returned the starting dose and the
            # vasopressin-escalation threshold - genuinely the closest
            # values in the SOP - with nothing indicating that neither one
            # is actually a stated maximum. A physician skimming the answer
            # could read either number as "the max." If the query explicitly
            # asks for a max/min/ceiling/upper limit and none of the
            # extracted lines contain that same word, say so rather than
            # silently substituting the nearest related value.
            # Bare "min" is deliberately excluded: it collides with the
            # per-minute rate unit ("mcg/kg/min") that appears in nearly
            # every dose threshold, which caused false positives here.
            _BOUND_WORD_RE = re.compile(r"\b(max|maximum|minimum|upper limit|ceiling)\b", re.IGNORECASE)
            asks_for_bound = bool(_BOUND_WORD_RE.search(query))
            if asks_for_bound and not any(
                _BOUND_WORD_RE.search(t) for t, _ in threshold_lines
            ):
                answer += (
                    "\n\nNote: This SOP does not state an explicit maximum/minimum for this value - "
                    "the values above are the closest related thresholds found."
                )
            return answer

        # Fallback: use key sentences (top_text is definitively from the
        # single top chunk, so it's safe to attribute)
        top_cite = (citation_map or {}).get(_chunk_id(chunks[0])) if chunks else None
        key = self._extract_key_sentences(top_text, 3, citation_number=top_cite)
        if key:
            return (
                f"Based on the {sop_title}:\n\n"
                + "\n".join(f"- {s}" for s in key)
            )
        return (
            f"Based on the {sop_title}:\n\n"
            f"{self._clean_text(top_text)}"
        )

    def _build_contraindication_answer(
        self, sop_title: str, top_text: str, chunks: list[dict], citation_map: "dict[str, int] | None" = None
    ) -> str:
        """Extract and present contraindications in grouped format."""
        primary_sop = chunks[0].get("sop_id", "") if chunks else ""
        same_sop = [c for c in chunks if c.get("sop_id") == primary_sop]

        # Prefer contraindication-typed chunks first
        contra_chunks = [
            c for c in same_sop if c.get("chunk_type") == "contraindication"
        ]
        other_chunks = [
            c for c in same_sop[:4] if c.get("chunk_type") != "contraindication"
        ]
        ordered_chunks = contra_chunks + other_chunks

        contras = self._scan_contraindications(ordered_chunks, citation_map)

        # Group into "Do NOT" items, "Use instead" alternatives, and
        # monitoring requirements
        do_not: list[str] = []
        use_instead: list[str] = []
        monitor: list[str] = []
        for c, n in contras:
            # Skip any remaining noise that slipped through
            if self._is_noise_line(c):
                continue
            marked = self._mark(c, n)
            low = c.lower()
            if any(k in low for k in ["instead", "alternative", "substitute", "use "]):
                use_instead.append(marked)
            elif any(k in low for k in ["monitor", "observe", "watch for", "check"]):
                monitor.append(marked)
            else:
                do_not.append(marked)

        if do_not or use_instead or monitor:
            answer = f"Based on the {sop_title}, the following restrictions apply:"

            if do_not:
                answer += "\n\nDo NOT:\n"
                answer += "\n".join(f"- {d}" for d in do_not[:6])

            if use_instead:
                answer += "\n\nUse instead:\n"
                answer += "\n".join(f"- {u}" for u in use_instead[:4])

            if monitor:
                answer += "\n\nMonitor for:\n"
                answer += "\n".join(f"- {m}" for m in monitor[:4])

            return answer

        # Fallback (top_text is definitively from the single top chunk)
        top_cite = (citation_map or {}).get(_chunk_id(chunks[0])) if chunks else None
        key = self._extract_key_sentences(top_text, 3, citation_number=top_cite)
        if key:
            return (
                f"Based on the {sop_title}, the relevant cautions are:\n\n"
                + "\n".join(f"- {s}" for s in key)
            )
        return (
            f"Based on the {sop_title}, the relevant cautions are:\n\n"
            f"{self._clean_text(top_text)}"
        )

    def _build_general_answer(
        self, sop_title: str, top_text: str, chunks: list[dict], citation_map: "dict[str, int] | None" = None
    ) -> str:
        """Provide a clean summary from top chunks."""
        primary_sop = chunks[0].get("sop_id", "") if chunks else ""
        same_sop = [c for c in chunks if c.get("sop_id") == primary_sop]

        # Try to find step-type chunks first
        step_chunks = [c for c in same_sop if c.get("chunk_type") in ("step", "step_sequence")]
        if step_chunks:
            return self._build_sequence_answer(sop_title, top_text, chunks, citation_map)

        # Try to find threshold chunks
        threshold_chunks = [c for c in same_sop if c.get("chunk_type") == "threshold"]
        if threshold_chunks:
            return self._build_threshold_answer(sop_title, top_text, chunks, citation_map)

        # Try to find contraindication chunks
        contra_chunks = [c for c in same_sop if c.get("chunk_type") == "contraindication"]
        if contra_chunks:
            return self._build_contraindication_answer(sop_title, top_text, chunks, citation_map)

        # General: extract key sentences per chunk (not a blind text join,
        # so each sentence keeps a real [N] marker back to its own chunk
        # instead of being unattributable) and cap the combined total.
        sentences: list[str] = []
        for chunk in same_sop[:4]:
            chunk_text = chunk.get("text", chunk.get("chunk_text", ""))
            num_cite = (citation_map or {}).get(_chunk_id(chunk))
            sentences.extend(
                self._extract_key_sentences(chunk_text, max_sentences=2, citation_number=num_cite)
            )
        sentences = sentences[:6]

        if sentences:
            points = "\n".join(f"- {s}" for s in sentences)
            return f"Based on the {sop_title}:\n\n{points}"

        return f"Based on the {sop_title}:\n\n{self._clean_text(top_text)}"

    def generate_structured_answer(
        self,
        query: str,
        retrieved_chunks: list[dict],
        query_type: str = "general",
        query_analysis: dict | None = None,
    ) -> dict:
        """
        Generate a structured answer with separate sections for
        summary, steps, thresholds, safety notes, and citations.
        """
        good_chunks = [c for c in retrieved_chunks if c.get("relevance_score", 0) >= _MIN_RELEVANCE]

        if not good_chunks:
            return {
                "answer": "I could not find enough support in the SOP library to answer safely. Open the source SOP or ask a clinical reviewer.",
                "summary": "Insufficient evidence to answer.",
                "steps": [],
                "thresholds": [],
                "safety_notes": ["No relevant SOP sections were found for this query."],
                "citations": [],
                "confidence": 0.1,
                "evidence_sufficient": False,
                "reasoning_trace": ["No relevant chunks found. Refusing to answer."],
            }

        # Build the main answer using existing method
        answer_result = self.generate_answer(query, retrieved_chunks, query_type)

        # Extract structured components from chunks
        primary_sop = good_chunks[0].get("sop_id", "") if good_chunks else ""
        same_sop = [c for c in good_chunks if c.get("sop_id") == primary_sop]

        steps = []
        thresholds = []
        safety_notes = []

        for chunk in same_sop:
            chunk_type = chunk.get("chunk_type", "")
            text = chunk.get("text", chunk.get("chunk_text", ""))

            if chunk_type == "step" or chunk_type == "step_sequence":
                # Extract individual steps
                step_lines = re.findall(r"Step\s+(\d+)\s*:\s*(.+?)(?=Step\s+\d+|$)", text, re.DOTALL | re.IGNORECASE)
                for num, content in step_lines:
                    steps.append({"step": int(num), "text": content.strip().split("\n")[0]})

            if chunk_type == "threshold":
                # Extract threshold lines
                for line in text.split("\n"):
                    line = line.strip().lstrip("- ")
                    if re.search(r"[><≥≤]=?\s*\d|(?:target|threshold|maximum|minimum|dose)\b.*\d", line, re.IGNORECASE):
                        thresholds.append(line)

            if chunk_type == "contraindication":
                for line in text.split("\n"):
                    line = line.strip().lstrip("- ")
                    if any(w in line.lower() for w in ["do not", "avoid", "contraindicated", "never", "must not", "caution", "warning"]):
                        safety_notes.append(line)

        # Build citations
        citations = []
        seen_sops = set()
        for chunk in good_chunks[:5]:
            sid = chunk.get("sop_id", "")
            if sid in seen_sops:
                continue
            seen_sops.add(sid)
            citations.append({
                "sop_id": sid,
                "sop_title": chunk.get("sop_title", "Unknown SOP"),
                "section_id": chunk.get("section_id", ""),
                "section_title": chunk.get("section_title", ""),
                "chunk_type": chunk.get("chunk_type", ""),
                "relevance_score": chunk.get("relevance_score", 0),
                "snippet": chunk.get("text", chunk.get("chunk_text", ""))[:200],
            })

        # Evidence sufficiency
        top_score = good_chunks[0].get("relevance_score", 0)
        evidence_sufficient = top_score > 0.005 and len(good_chunks) >= 2

        # Summary
        sop_title = good_chunks[0].get("sop_title", "the relevant SOP")
        summary = f"Based on the {sop_title}."
        if not evidence_sufficient:
            summary = "Limited evidence found. Please verify against the source SOP."

        return {
            "answer": answer_result["answer"],
            "summary": summary,
            "steps": steps[:15],
            "thresholds": thresholds[:10],
            "safety_notes": safety_notes[:10],
            "citations": citations,
            "confidence": answer_result["confidence"],
            "evidence_sufficient": evidence_sufficient,
            "reasoning_trace": answer_result["reasoning_trace"],
        }

    @staticmethod
    def _clean_text(text: str) -> str:
        """Clean raw chunk text for presentation."""
        for pat in _NOISE_PATTERNS:
            text = pat.sub("", text)
        # Filter individual lines through the noise check, but keep
        # moderately short lines (>= 15 chars) that aren't boilerplate.
        cleaned_lines: list[str] = []
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped:
                cleaned_lines.append("")
                continue
            low = stripped.lower()
            # Drop disclaimer / synthetic / version lines
            if low.startswith("disclaimer") or "synthetic sop" in low:
                continue
            if low.startswith("version") and "effective" in low:
                continue
            # Drop bare section headers like "1. PURPOSE"
            if re.match(r"^\d+\.\s*[A-Z]{3,}$", stripped):
                continue
            cleaned_lines.append(stripped)
        text = "\n".join(cleaned_lines)
        # Collapse multiple blank lines
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        return text
