"""
SOP-Guard Mock Generator
------------------------
Compose answers from retrieved chunks in mock mode.
Research prototype  - NOT for clinical use.
"""

import re
from typing import Any

# Minimum relevance score to consider a chunk useful
_MIN_RELEVANCE = 0.01

_DISCLAIMER = (
    "\n\n---\n"
    "Research prototype - verify against official SOP documents."
)

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
                "reasoning_trace": reasoning_trace,
                "confidence": 0.1,
            }

        reasoning_trace.append(f"{len(good_chunks)} chunks above relevance threshold.")

        top_chunk = good_chunks[0]
        sop_title = top_chunk.get("sop_title", "Unknown SOP")
        section = top_chunk.get("section_title", "")
        top_text = top_chunk.get("chunk_text", "")

        source_label = f"**Source:** {sop_title}"
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

        # Build answer based on query type
        if query_type in ("sequence", "procedure_steps", "monitoring"):
            answer = self._build_sequence_answer(sop_title, top_text, good_chunks)
        elif query_type in ("threshold", "medication"):
            answer = self._build_threshold_answer(sop_title, top_text, good_chunks)
        elif query_type == "contraindication":
            answer = self._build_contraindication_answer(sop_title, top_text, good_chunks)
        else:
            answer = self._build_general_answer(sop_title, top_text, good_chunks)

        answer += f"\n\n{source_label}"
        answer += _DISCLAIMER

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
            "reasoning_trace": reasoning_trace,
            "confidence": round(confidence, 2),
        }

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
    def _extract_key_sentences(text: str, max_sentences: int = 4) -> list[str]:
        """Extract the most informative sentences, filtering all noise."""
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
        return [s[1] for s in scored[:max_sentences]]

    # ------------------------------------------------------------------
    # Scanning helpers for cross-cutting concerns
    # ------------------------------------------------------------------

    @staticmethod
    def _scan_thresholds(chunks_or_text) -> list[str]:
        """Extract lines containing threshold-like clinical values.

        Accepts either a string (combined text) or a list of chunk dicts.
        When given chunks, prioritizes threshold-typed chunks.
        """
        found: list[str] = []

        if isinstance(chunks_or_text, list):
            # Prioritize threshold chunks first
            priority_texts = []
            other_texts = []
            for c in chunks_or_text:
                text = c.get("text", c.get("chunk_text", ""))
                if c.get("chunk_type") == "threshold":
                    priority_texts.append(text)
                else:
                    other_texts.append(text)
            combined = "\n".join(priority_texts + other_texts)
        else:
            combined = chunks_or_text

        for line in combined.split("\n"):
            stripped = line.strip().lstrip("- ")
            if not stripped or len(stripped) < 10:
                continue
            if re.search(
                r"[><≥≤]=?\s*\d"
                r"|(?:target|threshold|maximum|minimum|dose|rate|limit)\b.*\d",
                stripped, re.IGNORECASE,
            ):
                if stripped not in found:
                    found.append(stripped)
        return found

    @staticmethod
    def _scan_contraindications(chunks_or_text) -> list[str]:
        """Extract lines with contraindication/warning language.

        Accepts either a string (combined text) or a list of chunk dicts.
        When given chunks, prioritizes contraindication-typed chunks.
        """
        keywords = [
            "do not", "don't", "contraindicated", "avoid", "must not",
            "should not", "never", "caution", "prohibited", "warning",
        ]
        found: list[str] = []

        if isinstance(chunks_or_text, list):
            priority_texts = []
            other_texts = []
            for c in chunks_or_text:
                text = c.get("text", c.get("chunk_text", ""))
                if c.get("chunk_type") == "contraindication":
                    priority_texts.append(text)
                else:
                    other_texts.append(text)
            combined = "\n".join(priority_texts + other_texts)
        else:
            combined = chunks_or_text

        for line in combined.split("\n"):
            stripped = line.strip().lstrip("- ")
            if not stripped or len(stripped) < 10:
                continue
            # Skip chunk headers and boilerplate
            if MockGenerator._is_noise_line(stripped):
                continue
            if any(k in stripped.lower() for k in keywords):
                if stripped not in found:
                    found.append(stripped)
        return found

    # ------------------------------------------------------------------
    # Answer builders
    # ------------------------------------------------------------------

    def _build_sequence_answer(
        self, sop_title: str, top_text: str, chunks: list[dict]
    ) -> str:
        """Extract and present numbered steps cleanly."""
        primary_sop = chunks[0].get("sop_id", "") if chunks else ""
        same_sop = [c for c in chunks if c.get("sop_id") == primary_sop]

        # Strategy 1: Look for a step_sequence chunk (has all steps)
        for chunk in same_sop:
            if chunk.get("chunk_type") == "step_sequence":
                text = chunk.get("text", chunk.get("chunk_text", ""))
                steps = re.findall(
                    r"Step\s+(\d+)\s*:\s*(.+?)(?=Step\s+\d+\s*:|$)",
                    text, re.DOTALL | re.IGNORECASE
                )
                if steps:
                    lines = []
                    for num, content in sorted(steps, key=lambda x: int(x[0])):
                        first_line = content.strip().split("\n")[0].strip()
                        if first_line and len(first_line) > 5:
                            lines.append(f"{num}. {first_line}")
                    if lines:
                        return (
                            f"Based on the {sop_title}, follow these steps:\n\n"
                            + "\n".join(lines)
                            + self._append_extras(same_sop)
                        )

        # Strategy 2: Collect individual step chunks
        step_chunks = [c for c in same_sop if c.get("chunk_type") == "step"]
        if step_chunks:
            lines = []
            for chunk in step_chunks:
                text = chunk.get("text", chunk.get("chunk_text", ""))
                match = re.match(r"Step\s+(\d+)\s*:\s*(.+)", text, re.DOTALL | re.IGNORECASE)
                if match:
                    num = match.group(1)
                    content = match.group(2).strip().split("\n")[0].strip()
                    if content and len(content) > 5:
                        lines.append((int(num), f"{num}. {content}"))
            if lines:
                lines.sort(key=lambda x: x[0])
                return (
                    f"Based on the {sop_title}, follow these steps:\n\n"
                    + "\n".join(l[1] for l in lines)
                    + self._append_extras(same_sop)
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
                + self._append_extras(same_sop)
            )

        return (
            f"Based on the {sop_title}, the relevant procedural steps are:\n\n"
            + self._clean_text(top_text)
        )

    def _append_extras(self, chunks: list[dict]) -> str:
        """Append thresholds and warnings from non-step chunks."""
        extras = ""

        # Scan for thresholds
        thresholds = self._scan_thresholds(chunks)
        if thresholds:
            extras += "\n\nKey thresholds:\n" + "\n".join(f"- {t}" for t in thresholds[:5])

        # Scan for contraindications
        contras = self._scan_contraindications(chunks)
        if contras:
            extras += "\n\nImportant:\n" + "\n".join(f"- {c}" for c in contras[:3])

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
        self, sop_title: str, top_text: str, chunks: list[dict]
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

        threshold_lines = self._scan_thresholds(ordered_chunks)

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
                if stripped not in threshold_lines and stripped not in action_triggers:
                    action_triggers.append(stripped)

        if threshold_lines:
            formatted = [self._format_threshold_line(t) for t in threshold_lines[:10]]
            items = "\n".join(f"- {t}" for t in formatted)
            answer = (
                f"Based on the {sop_title}, the relevant clinical values are:\n\n"
                f"{items}"
            )
            if action_triggers:
                answer += "\n\nWhen to act:\n"
                answer += "\n".join(f"- {a}" for a in action_triggers[:5])
            return answer

        # Fallback: use key sentences
        key = self._extract_key_sentences(top_text, 3)
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
        self, sop_title: str, top_text: str, chunks: list[dict]
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

        contras = self._scan_contraindications(ordered_chunks)

        # Group into "Do NOT" items, "Use instead" alternatives, and
        # monitoring requirements
        do_not: list[str] = []
        use_instead: list[str] = []
        monitor: list[str] = []
        for c in contras:
            # Skip any remaining noise that slipped through
            if self._is_noise_line(c):
                continue
            low = c.lower()
            if any(k in low for k in ["instead", "alternative", "substitute", "use "]):
                use_instead.append(c)
            elif any(k in low for k in ["monitor", "observe", "watch for", "check"]):
                monitor.append(c)
            else:
                do_not.append(c)

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

        # Fallback
        key = self._extract_key_sentences(top_text, 3)
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
        self, sop_title: str, top_text: str, chunks: list[dict]
    ) -> str:
        """Provide a clean summary from top chunks."""
        primary_sop = chunks[0].get("sop_id", "") if chunks else ""
        same_sop = [c for c in chunks if c.get("sop_id") == primary_sop]

        # Try to find step-type chunks first
        step_chunks = [c for c in same_sop if c.get("chunk_type") in ("step", "step_sequence")]
        if step_chunks:
            return self._build_sequence_answer(sop_title, top_text, chunks)

        # Try to find threshold chunks
        threshold_chunks = [c for c in same_sop if c.get("chunk_type") == "threshold"]
        if threshold_chunks:
            return self._build_threshold_answer(sop_title, top_text, chunks)

        # Try to find contraindication chunks
        contra_chunks = [c for c in same_sop if c.get("chunk_type") == "contraindication"]
        if contra_chunks:
            return self._build_contraindication_answer(sop_title, top_text, chunks)

        # General: extract key sentences from all same-SOP chunks
        all_text = "\n".join(c.get("text", c.get("chunk_text", "")) for c in same_sop[:4])
        sentences = self._extract_key_sentences(all_text, max_sentences=6)

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
