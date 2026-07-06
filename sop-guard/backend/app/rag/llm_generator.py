"""
SOP-Guard LLM Generator
Generates grounded answers using Ollama or OpenAI-compatible LLMs.
Falls back to MockGenerator when no LLM is available.
Research prototype. Not for clinical use.
"""

import re
import logging
from typing import Any, Optional
import httpx

from app.config import settings
from app.rag.generator import MockGenerator
from app.rag.hallucination_checker import check_faithfulness
from app.rag.faithfulness_nli import check_faithfulness_semantic
from app.rag.conflict_detector import detect_sop_conflicts
from app.rag.citation_tracker import build_numbered_context, extract_citations
from app.rag.entity_graph import conflicts_for_sops


def _merge_graph_conflicts(sop_conflicts: list[dict], retrieved_chunks: list[dict]) -> list[dict]:
    """Merge entity-graph conflicts relevant to the retrieved SOPs; dedupe by message."""
    try:
        sop_keys = set()
        for c in retrieved_chunks:
            if c.get("sop_id"):
                sop_keys.add(c["sop_id"])
            if c.get("sop_title"):
                sop_keys.add(c["sop_title"])
        graph_conflicts = conflicts_for_sops(sop_keys)
        seen = {c.get("message", "") for c in sop_conflicts}
        merged = list(sop_conflicts)
        for gc in graph_conflicts:
            if gc.get("message", "") not in seen:
                seen.add(gc.get("message", ""))
                merged.append(gc)
        return merged
    except Exception:
        return sop_conflicts

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are SOP-Guard, a clinical SOP assistant for hospital staff. Answer questions based ONLY on the provided SOP content.

Rules:
- Answer ONLY from the provided content. Never add information not in the SOPs.
- If the content does not answer the question, say: "This information is not covered in the available SOPs."
- CRITICAL: Answer the SPECIFIC question asked. If asked about one medication dose, answer only that dose — do not list the entire protocol.
- For procedure questions: list numbered steps in order. Use the format "1. Step description"
- For threshold / dose / medication questions: state the specific value directly first (e.g., "Maximum dose: 3 mcg/kg/min"), then context.
- For contraindication questions: clearly state what should NOT be done and why.
- For monitoring questions: list what to check and how often.
- Use ## for section headings, ### for sub-headings if multiple sections are needed.
- Use **bold** to highlight critical values, doses, and warnings.
- Use bullet points (- item) for lists of values or conditions.
- Use > for critical thresholds or warnings (e.g., > **Critical**: Lactate ≥ 4 mmol/L requires immediate action)
- Include specific numbers, dosages, units, and time frames from the SOP.
- Keep answers focused and concise — do not repeat the full protocol if the question is about one specific value.
- End with the source SOP name on its own line prefixed with "Source:".
- Cite sources inline using [1], [2] notation matching the numbered SOP content blocks. Every clinical claim (dose, threshold, step, contraindication) MUST carry a citation marker. Do not invent citation numbers.
"""

def _build_context(chunks: list[dict[str, Any]], max_chars: int = 4000) -> str:
    """Build context string from retrieved chunks."""
    context_parts = []
    total = 0
    for chunk in chunks:
        text = chunk.get("text", chunk.get("chunk_text", ""))
        sop_title = chunk.get("sop_title", "Unknown SOP")
        section = chunk.get("section_title", "")
        chunk_type = chunk.get("chunk_type", "")

        header = f"[{sop_title}"
        if section:
            header += f" - {section}"
        if chunk_type:
            header += f" ({chunk_type})"
        header += "]"

        entry = f"{header}\n{text}\n"
        if total + len(entry) > max_chars:
            break
        context_parts.append(entry)
        total += len(entry)

    return "\n---\n".join(context_parts)


def _parse_followups(answer: str) -> tuple[str, list[str]]:
    """Split follow-up questions off the answer. Returns (answer, questions)."""
    try:
        if "FOLLOWUPS:" not in answer:
            return answer, []
        main, _, tail = answer.partition("FOLLOWUPS:")
        questions = []
        for line in tail.strip().splitlines():
            q = re.sub(r"^\s*(?:[-*]|\d+[.)])\s*", "", line).strip()
            if q:
                questions.append(q)
            if len(questions) == 3:
                break
        return main.rstrip(), questions
    except Exception:
        return answer, []


class LLMGenerator:
    """Generator that uses Ollama or OpenAI-compatible API for answer generation."""

    def __init__(
        self,
        provider: str = "",
        model: str = "",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.provider = provider or settings.LLM_PROVIDER
        self.model = model or settings.LLM_MODEL
        self.api_key = api_key or settings.LLM_API_KEY
        self.base_url = base_url or settings.LLM_BASE_URL
        self._mock = MockGenerator()
        self._available: Optional[bool] = None

        # Default Ollama settings
        if self.provider == "ollama":
            self.base_url = self.base_url or "http://localhost:11434"
            self.model = self.model or "llama3.2"

    async def _check_available(self) -> bool:
        """Check if the LLM backend is reachable."""
        if self._available is not None:
            return self._available

        if self.provider == "mock":
            self._available = False
            return False

        try:
            if self.provider == "ollama":
                async with httpx.AsyncClient(timeout=3.0) as client:
                    r = await client.get(f"{self.base_url}/api/tags")
                    self._available = r.status_code == 200
            elif self.provider in ("openai", "anthropic"):
                self._available = bool(self.api_key)
            else:
                self._available = False
        except Exception:
            self._available = False

        logger.info(f"LLM provider '{self.provider}' available: {self._available}")
        return self._available

    async def generate_answer(
        self,
        query: str,
        retrieved_chunks: list[dict[str, Any]],
        query_type: str = "general",
        news2_score: Optional[int] = None,
        history_context: str = "",
    ) -> dict[str, Any]:
        """Generate answer using LLM if available, otherwise fall back to mock."""

        available = await self._check_available()
        if not available:
            result = self._mock.generate_answer(query, retrieved_chunks, query_type)
            result["generation_mode"] = "mock"
            # Still run faithfulness + conflict checks on mock answers.
            # Primary signal is semantic (falls back to keyword automatically).
            result["faithfulness"] = check_faithfulness_semantic(result.get("answer", ""), retrieved_chunks)
            result["faithfulness_keyword"] = check_faithfulness(result.get("answer", ""), retrieved_chunks)
            result["sop_conflicts"] = _merge_graph_conflicts(
                detect_sop_conflicts(retrieved_chunks), retrieved_chunks
            )
            # Respect the mock generator's own inline_citations/
            # followup_questions/abstained values instead of hardcoding
            # them here - the mock generator now builds real [N] markers
            # and template follow-ups, so overwriting them unconditionally
            # would silently discard that data on every mock-mode query
            # (the default install, with no LLM configured).
            result.setdefault("inline_citations", [])
            result.setdefault("followup_questions", [])
            result["abstained"] = result.get("abstained", False)
            return result

        # Build numbered citation context from chunks
        context, citation_records = build_numbered_context(retrieved_chunks)

        # Build prompt
        if query_type in ("procedure_steps", "sequence"):
            instruction = "List the procedure steps in numbered order. Include all steps from the SOP. Include specific values and time frames."
        elif query_type == "threshold":
            instruction = "Answer the SPECIFIC threshold question asked. State the exact value first (e.g., 'Maximum: X units'), then include units, clinical context, and what action to take when the threshold is crossed. Do NOT list the entire protocol."
        elif query_type == "contraindication":
            instruction = "List all contraindications and restrictions relevant to the question. For each, state clearly what must NOT be done and what to use instead or monitor instead."
        elif query_type == "monitoring":
            instruction = "List what should be monitored, how often, and what values or signs to watch for. Include specific numeric targets where available."
        elif query_type == "medication":
            instruction = "Answer the SPECIFIC medication question asked. State the key value first (e.g., 'Maximum dose: X mcg/kg/min'). Then include: route, frequency, titration guidance, and restrictions. Do NOT list the entire protocol — focus only on the specific medication asked about."
        else:
            instruction = "Answer the specific question directly. Use numbered steps for procedures, bullet points for lists of values. Include clinical numbers, doses, and time frames."

        history_block = ""
        if history_context:
            history_block = f"Conversation so far:\n{history_context}\n\n"

        user_prompt = f"""Based on the following SOP content, answer the question.

{instruction}

{history_block}Question: {query}

SOP Content:
{context}

After your answer, on a new line write 'FOLLOWUPS:' followed by exactly 3 short follow-up questions a clinician might ask next, one per line.

Answer:"""

        # Append NEWS2 context if provided
        if news2_score is not None:
            news2_context = f"\n\nPatient Context: NEWS2 Score = {news2_score}"
            if news2_score >= 7:
                news2_context += " (HIGH risk — consider ICU referral per NEWS2 protocol)"
            elif news2_score >= 5:
                news2_context += " (MEDIUM risk — urgent clinical review needed)"
            elif news2_score >= 3:
                news2_context += " (LOW-MEDIUM risk — increased monitoring)"
            else:
                news2_context += " (LOW risk — routine monitoring)"
            user_prompt = user_prompt + news2_context

        try:
            answer_text = await self._call_llm(user_prompt)

            # Parse follow-up questions out of the answer
            answer_text, followup_questions = _parse_followups(answer_text)

            # Validate inline [N] citation markers
            answer_text, citation_records = extract_citations(answer_text, citation_records)

            # Structured abstention detection
            abstained = "not covered in the available sops" in answer_text.lower()

            # Build citations
            sop_titles = []
            seen = set()
            for chunk in retrieved_chunks[:5]:
                title = chunk.get("sop_title", "Unknown SOP")
                if title not in seen:
                    seen.add(title)
                    sop_titles.append(title)

            citations = [f"[Source: {t}]" for t in sop_titles]

            # Add disclaimer
            answer_text += "\n\nSource: " + ", ".join(sop_titles)
            answer_text += "\n\n---\nResearch prototype. Check the source SOP before acting on this information."

            # Estimate confidence from chunk scores
            top_score = retrieved_chunks[0].get("relevance_score", 0) if retrieved_chunks else 0
            confidence = min(0.95, max(0.5, top_score * 8))

            # Faithfulness check (semantic primary, keyword kept alongside)
            faithfulness = check_faithfulness_semantic(answer_text, retrieved_chunks)
            faithfulness_keyword = check_faithfulness(answer_text, retrieved_chunks)

            # Conflict detection (pairwise + entity graph)
            sop_conflicts = _merge_graph_conflicts(
                detect_sop_conflicts(retrieved_chunks), retrieved_chunks
            )

            return {
                "answer": answer_text,
                "citations": citations,
                "reasoning_trace": [
                    f"Query type: {query_type}",
                    f"LLM provider: {self.provider} ({self.model})",
                    f"Context: {len(retrieved_chunks)} chunks, {len(context)} chars",
                    f"Generated answer: {len(answer_text)} chars",
                ],
                "confidence": round(confidence, 2),
                "generation_mode": "llm",
                "faithfulness": faithfulness,
                "faithfulness_keyword": faithfulness_keyword,
                "sop_conflicts": sop_conflicts,
                "inline_citations": citation_records,
                "followup_questions": followup_questions,
                "abstained": abstained,
            }
        except Exception as e:
            logger.warning(f"LLM generation failed: {e}. Falling back to mock.")
            result = self._mock.generate_answer(query, retrieved_chunks, query_type)
            result["generation_mode"] = "mock_fallback"
            result["reasoning_trace"].append(f"LLM failed ({e}), used mock fallback")
            result.setdefault("inline_citations", [])
            result.setdefault("followup_questions", [])
            result["abstained"] = result.get("abstained", False)
            return result

    async def _call_llm(self, prompt: str) -> str:
        """Call the configured LLM."""
        if self.provider == "ollama":
            return await self._call_ollama(prompt)
        elif self.provider == "openai":
            return await self._call_openai(prompt)
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

    async def _call_ollama(self, prompt: str) -> str:
        """Call Ollama API."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "system": SYSTEM_PROMPT,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 1024,
                    },
                },
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "").strip()

    async def _call_openai(self, prompt: str) -> str:
        """Call OpenAI-compatible API."""
        base = self.base_url or "https://api.openai.com/v1"
        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base}/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 1024,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()


def get_generator() -> LLMGenerator:
    """Get the configured generator."""
    return LLMGenerator(
        provider=settings.LLM_PROVIDER,
        model=settings.LLM_MODEL,
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
    )
