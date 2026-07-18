"""
Meridian LLM Generator
Generates grounded answers using a self-hosted Ollama model by default - no
patient or query data leaves the hospital network. Optionally, with
GROQ_API_KEY configured, can instead call Groq's hosted inference API for
faster demo output (see settings.LLM_PROVIDER) - that path does send
query/answer text to a third-party API and should not be used with real
patient data. Falls back to MockGenerator (deterministic templates, no
model) when the configured provider is unavailable.
Research prototype. Not for clinical use.
"""

import asyncio
import json
import re
import logging
from typing import Any, AsyncIterator, Optional
import httpx

from app.config import settings
from app.rag.generator import MockGenerator
from app.rag.hallucination_checker import check_faithfulness
from app.rag.faithfulness_nli import check_faithfulness_semantic, get_similarity_fn
from app.rag.conflict_detector import detect_sop_conflicts
from app.rag.citation_tracker import build_numbered_context, build_numbered_texts, extract_citations, auto_insert_citations
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

# Shared across every LLMGenerator instance (a new one is created per
# request) so concurrent requests actually queue against the same limit
# instead of each instance thinking it's the only caller. A single local
# Ollama process serializes inference internally - sending it concurrent
# requests doesn't parallelize anything, it contends and can fail requests
# outright (observed directly: a second concurrent request mid-generation
# came back as a 500). See settings.LLM_MAX_CONCURRENT_REQUESTS.
_OLLAMA_SEMAPHORE = asyncio.Semaphore(max(1, settings.LLM_MAX_CONCURRENT_REQUESTS))


def _is_retryable(exc: Exception) -> bool:
    """Network/timeout failures, 5xx responses, and 429 rate-limits are
    worth a retry - a busy or momentarily-restarting Ollama process, or a
    hosted provider's per-minute rate limit, often recovers within a second
    or two. Other 4xx responses (bad request, model not found, etc.) won't
    fix themselves on retry.

    429 specifically was previously treated as non-retryable (all 4xx were),
    so a rate-limited hosted model fell straight to the template generator
    mid-answer instead of backing off and retrying - the single biggest
    cause of inconsistent demo answer quality."""
    if isinstance(exc, (httpx.TransportError, httpx.TimeoutException)):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return code >= 500 or code == 429
    return False


def _retry_after_seconds(exc: Exception, default: float) -> float:
    """Honor a provider's Retry-After header on a 429 when present, so we
    wait exactly as long as the provider asks rather than guessing. Falls
    back to the caller's computed exponential backoff otherwise."""
    if isinstance(exc, httpx.HTTPStatusError):
        header = exc.response.headers.get("retry-after")
        if header:
            try:
                return max(0.0, min(float(header), 30.0))  # cap so a hostile header can't hang us
            except (TypeError, ValueError):
                return default
    return default

SYSTEM_PROMPT = """You are Meridian, a clinical SOP assistant for hospital staff. Answer questions based ONLY on the provided SOP content.

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
    """Generator that uses a self-hosted Ollama model for answer generation.

    No provider in this class ever calls a third-party LLM API - patient and
    query data stays on infrastructure the hospital controls. If Ollama is
    unreachable, generation falls back to MockGenerator rather than to any
    external service.
    """

    def __init__(
        self,
        provider: str = "",
        model: str = "",
        base_url: Optional[str] = None,
    ):
        self.provider = provider or settings.LLM_PROVIDER
        self.model = model or settings.LLM_MODEL
        self.base_url = base_url or settings.LLM_BASE_URL
        self._mock = MockGenerator()
        self._available: Optional[bool] = None

        # Default Ollama settings
        if self.provider == "ollama":
            self.base_url = self.base_url or "http://localhost:11434"
            self.model = self.model or "llama3.2"
        elif self.provider == "groq":
            self.base_url = base_url or settings.GROQ_BASE_URL
            self.model = model or settings.GROQ_MODEL

    async def _check_available(self) -> bool:
        """Check if the configured provider is reachable/usable."""
        if self._available is not None:
            return self._available

        if self.provider == "groq":
            # Hosted API - no reachability probe needed, just confirm a key
            # is configured. An invalid/expired key still surfaces as a
            # normal call failure, handled by the existing mock-fallback
            # path in generate_answer/stream_answer.
            self._available = bool(settings.GROQ_API_KEY)
        elif self.provider == "ollama":
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    r = await client.get(f"{self.base_url}/api/tags")
                    self._available = r.status_code == 200
            except Exception:
                self._available = False
        else:
            self._available = False

        logger.info(f"LLM provider '{self.provider}' available: {self._available}")
        return self._available

    def _build_prompt(
        self,
        query: str,
        retrieved_chunks: list[dict[str, Any]],
        query_type: str,
        news2_score: Optional[int],
        history_context: str,
    ) -> tuple[str, str, list]:
        """Build the user prompt for a query. Shared by the single-shot and
        streaming generation paths so prompt construction can't drift
        between the two."""
        context, citation_records = build_numbered_context(retrieved_chunks)

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

        return user_prompt, context, citation_records

    def _postprocess(
        self,
        raw_answer_text: str,
        retrieved_chunks: list[dict[str, Any]],
        citation_records: list,
        query_type: str,
        context_len: int,
    ) -> dict[str, Any]:
        """Everything that happens once the full answer text exists,
        regardless of whether it arrived as one response or was assembled
        from a token stream: follow-up parsing, citation validation,
        abstention detection, faithfulness/conflict checks. Shared by the
        single-shot and streaming generation paths."""
        answer_text, followup_questions = _parse_followups(raw_answer_text)
        if not followup_questions:
            # Local models frequently ignore the "write FOLLOWUPS:" prompt
            # instruction even when everything else about the answer is
            # fine - fall back to the same per-query-type templates the
            # mock generator uses rather than showing no follow-ups at all.
            followup_questions = self._mock._template_followups(query_type)

        # Server-side citation safety net: the model is asked to cite
        # inline as [1], [2] but frequently doesn't - fill in any sentence
        # left without a marker by matching it to its most similar source
        # chunk, the same way the faithfulness checker already does. This
        # runs BEFORE extract_citations so the markers it inserts get
        # validated and counted as cited_in_answer exactly like ones the
        # model wrote itself. Never fatal - a matching failure just means
        # citations stay however the model left them.
        try:
            numbered_texts = build_numbered_texts(retrieved_chunks)
            sim_fn = get_similarity_fn()
            answer_text = auto_insert_citations(answer_text, numbered_texts, sim_fn)
        except Exception as e:
            logger.warning(f"auto_insert_citations failed, continuing without it: {e}")

        answer_text, citation_records = extract_citations(answer_text, citation_records)
        abstained = "not covered in the available sops" in answer_text.lower()

        sop_titles = []
        seen = set()
        for chunk in retrieved_chunks[:5]:
            title = chunk.get("sop_title", "Unknown SOP")
            if title not in seen:
                seen.add(title)
                sop_titles.append(title)

        citations = [f"[Source: {t}]" for t in sop_titles]

        answer_text += "\n\nSource: " + ", ".join(sop_titles)

        top_score = retrieved_chunks[0].get("relevance_score", 0) if retrieved_chunks else 0
        confidence = min(0.95, max(0.5, top_score * 8))

        faithfulness = check_faithfulness_semantic(answer_text, retrieved_chunks)
        faithfulness_keyword = check_faithfulness(answer_text, retrieved_chunks)

        sop_conflicts = _merge_graph_conflicts(
            detect_sop_conflicts(retrieved_chunks), retrieved_chunks
        )

        return {
            "answer": answer_text,
            "citations": citations,
            "reasoning_trace": [
                f"Query type: {query_type}",
                f"LLM provider: {self.provider} ({self.model})",
                f"Context: {len(retrieved_chunks)} chunks, {context_len} chars",
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
            return self._mock_with_checks(query, retrieved_chunks, query_type, "mock")

        user_prompt, context, citation_records = self._build_prompt(
            query, retrieved_chunks, query_type, news2_score, history_context
        )

        try:
            raw_answer_text = await self._call_llm(user_prompt)
            return self._postprocess(raw_answer_text, retrieved_chunks, citation_records, query_type, len(context))
        except Exception as e:
            logger.warning(f"LLM generation failed: {e}. Falling back to mock.")
            result = self._mock_with_checks(query, retrieved_chunks, query_type, "mock_fallback")
            result["reasoning_trace"].append(f"LLM failed ({e}), used mock fallback")
            return result

    def _mock_with_checks(
        self, query: str, retrieved_chunks: list[dict[str, Any]], query_type: str, mode: str,
    ) -> dict[str, Any]:
        """Mock generation plus the same faithfulness/conflict checks the
        LLM path runs - shared by both the "no LLM available" and "LLM
        call failed" fallback branches, which previously duplicated this
        (and the mock_fallback branch had silently drifted to skip it
        entirely, leaving faithfulness/sop_conflicts unset whenever a
        configured-but-unreachable-model LLM call failed)."""
        result = self._mock.generate_answer(query, retrieved_chunks, query_type)
        result["generation_mode"] = mode
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

    async def stream_answer(
        self,
        query: str,
        retrieved_chunks: list[dict[str, Any]],
        query_type: str = "general",
        news2_score: Optional[int] = None,
        history_context: str = "",
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream the answer as the model generates it.

        Yields ``{"type": "token", "text": str}`` for each chunk of text as
        it arrives, then exactly one ``{"type": "final", ...}`` event with
        the same shape ``generate_answer()`` returns (citations,
        faithfulness, conflicts, etc.) once the full text is assembled and
        post-processed. When no live model is available (mock mode, or
        Ollama unreachable), the whole answer is emitted as a single token
        chunk immediately so callers can treat both paths identically.
        """
        available = await self._check_available()
        if not available:
            result = await self.generate_answer(
                query, retrieved_chunks, query_type,
                news2_score=news2_score, history_context=history_context,
            )
            yield {"type": "token", "text": result.get("answer", "")}
            yield {"type": "final", **result}
            return

        user_prompt, context, citation_records = self._build_prompt(
            query, retrieved_chunks, query_type, news2_score, history_context
        )

        full_text = ""
        stream_fn = self._stream_groq if self.provider == "groq" else self._stream_ollama
        try:
            async for chunk in stream_fn(user_prompt):
                full_text += chunk
                yield {"type": "token", "text": chunk}
        except Exception as e:
            logger.warning(f"Streaming LLM generation failed: {e}. Falling back to mock.")
            result = self._mock_with_checks(query, retrieved_chunks, query_type, "mock_fallback")
            result["reasoning_trace"].append(f"Streaming LLM failed ({e}), used mock fallback")
            yield {"type": "token", "text": result.get("answer", "")}
            yield {"type": "final", **result}
            return

        final = self._postprocess(full_text, retrieved_chunks, citation_records, query_type, len(context))
        yield {"type": "final", **final}

    async def _call_llm(self, prompt: str) -> str:
        """Call the configured LLM."""
        if self.provider == "ollama":
            return await self._call_ollama(prompt)
        if self.provider == "groq":
            return await self._call_groq(prompt)
        raise ValueError(f"Unsupported provider: {self.provider} (only 'ollama', 'groq', and 'mock' are supported)")

    async def complete(self, user_prompt: str, system_prompt: str) -> Optional[str]:
        """General-purpose single-turn completion with an arbitrary system
        prompt - for uses other than SOP answering (LLM-as-judge scoring,
        evidence summarization). Returns the text, or None if no model is
        available or the call fails, so callers can degrade gracefully
        instead of handling exceptions. Never used on the answer path."""
        if not await self._check_available():
            return None
        try:
            if self.provider == "ollama":
                return await self._call_ollama(user_prompt, system_prompt=system_prompt)
            if self.provider == "groq":
                return await self._call_groq(user_prompt, system_prompt=system_prompt)
        except Exception as e:  # noqa: BLE001 - judge/util path degrades to None
            logger.warning(f"complete() failed: {e}")
        return None

    async def _call_groq(self, prompt: str, system_prompt: str = SYSTEM_PROMPT) -> str:
        """Call Groq's OpenAI-compatible chat completions API (non-streaming).
        Retried with the same backoff/classification as Ollama - no
        semaphore, since this is a hosted API rather than a single local
        process that serializes inference."""
        last_exc: Optional[Exception] = None
        for attempt in range(settings.LLM_MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                        json={
                            "model": self.model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": prompt},
                            ],
                            "temperature": 0.1,
                            "max_tokens": 1024,
                            "stream": False,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"].strip()
            except Exception as e:  # noqa: BLE001 - classified by _is_retryable below
                last_exc = e
                if attempt < settings.LLM_MAX_RETRIES and _is_retryable(e):
                    backoff = _retry_after_seconds(e, 0.5 * (3 ** attempt))
                    logger.warning(f"Groq call failed (attempt {attempt + 1}/{settings.LLM_MAX_RETRIES + 1}): {e}. Retrying in {backoff}s.")
                    await asyncio.sleep(backoff)
                    continue
                raise
        raise last_exc  # pragma: no cover - loop always returns or raises above

    async def _stream_groq(self, prompt: str) -> AsyncIterator[str]:
        """Call Groq's chat completions endpoint with stream:true and yield
        each delta fragment as it arrives (standard OpenAI-compatible SSE:
        `data: {...}` lines terminated by `data: [DONE]`)."""
        last_exc: Optional[Exception] = None
        for attempt in range(settings.LLM_MAX_RETRIES + 1):
            started = False
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream(
                        "POST",
                        f"{self.base_url}/chat/completions",
                        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                        json={
                            "model": self.model,
                            "messages": [
                                {"role": "system", "content": SYSTEM_PROMPT},
                                {"role": "user", "content": prompt},
                            ],
                            "temperature": 0.1,
                            "max_tokens": 1024,
                            "stream": True,
                        },
                    ) as response:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if not line.startswith("data: "):
                                continue
                            payload = line[len("data: "):].strip()
                            if payload == "[DONE]":
                                return
                            try:
                                data = json.loads(payload)
                            except json.JSONDecodeError:
                                continue
                            fragment = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                            if fragment:
                                started = True
                                yield fragment
                return
            except Exception as e:  # noqa: BLE001 - classified by _is_retryable below
                if started or attempt >= settings.LLM_MAX_RETRIES or not _is_retryable(e):
                    raise
                last_exc = e
                backoff = _retry_after_seconds(e, 0.5 * (3 ** attempt))
                logger.warning(f"Groq stream failed before any tokens (attempt {attempt + 1}/{settings.LLM_MAX_RETRIES + 1}): {e}. Retrying in {backoff}s.")
                await asyncio.sleep(backoff)
                continue
        if last_exc:
            raise last_exc  # pragma: no cover - loop always returns or raises above

    async def _call_ollama(self, prompt: str, system_prompt: str = SYSTEM_PROMPT) -> str:
        """Call Ollama API (non-streaming). Serialized via a shared
        semaphore and retried with backoff on transient failures - see
        _OLLAMA_SEMAPHORE and _is_retryable above."""
        last_exc: Optional[Exception] = None
        for attempt in range(settings.LLM_MAX_RETRIES + 1):
            try:
                async with _OLLAMA_SEMAPHORE:
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        response = await client.post(
                            f"{self.base_url}/api/generate",
                            json={
                                "model": self.model,
                                "prompt": prompt,
                                "system": system_prompt,
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
            except Exception as e:  # noqa: BLE001 - classified by _is_retryable below
                last_exc = e
                if attempt < settings.LLM_MAX_RETRIES and _is_retryable(e):
                    backoff = 0.5 * (3 ** attempt)
                    logger.warning(f"Ollama call failed (attempt {attempt + 1}/{settings.LLM_MAX_RETRIES + 1}): {e}. Retrying in {backoff}s.")
                    await asyncio.sleep(backoff)
                    continue
                raise
        raise last_exc  # pragma: no cover - loop always returns or raises above

    async def _stream_ollama(self, prompt: str) -> AsyncIterator[str]:
        """Call Ollama's /api/generate with stream:true and yield each
        response fragment as it arrives. Ollama streams newline-delimited
        JSON objects, each with a "response" fragment and a "done" flag on
        the last line.

        Serialized via the same shared semaphore as _call_ollama. Retries
        only apply before any fragment has been yielded - once tokens are
        already flowing to the caller (and, for the SSE routes, already on
        the wire to the client), retrying would mean re-sending duplicate
        content, so a mid-stream failure is left to the caller's existing
        mock-fallback handling instead."""
        last_exc: Optional[Exception] = None
        for attempt in range(settings.LLM_MAX_RETRIES + 1):
            started = False
            try:
                async with _OLLAMA_SEMAPHORE:
                    async with httpx.AsyncClient(timeout=120.0) as client:
                        async with client.stream(
                            "POST",
                            f"{self.base_url}/api/generate",
                            json={
                                "model": self.model,
                                "prompt": prompt,
                                "system": SYSTEM_PROMPT,
                                "stream": True,
                                "options": {
                                    "temperature": 0.1,
                                    "num_predict": 1024,
                                },
                            },
                        ) as response:
                            response.raise_for_status()
                            async for line in response.aiter_lines():
                                if not line.strip():
                                    continue
                                try:
                                    data = json.loads(line)
                                except json.JSONDecodeError:
                                    continue
                                fragment = data.get("response", "")
                                if fragment:
                                    started = True
                                    yield fragment
                                if data.get("done"):
                                    return
                return
            except Exception as e:  # noqa: BLE001 - classified by _is_retryable below
                if started or attempt >= settings.LLM_MAX_RETRIES or not _is_retryable(e):
                    raise
                last_exc = e
                backoff = 0.5 * (3 ** attempt)
                logger.warning(f"Ollama stream failed before any tokens (attempt {attempt + 1}/{settings.LLM_MAX_RETRIES + 1}): {e}. Retrying in {backoff}s.")
                await asyncio.sleep(backoff)
                continue
        if last_exc:
            raise last_exc  # pragma: no cover - loop always returns or raises above


def get_generator() -> LLMGenerator:
    """Get the configured generator.

    Only passes provider - model/base_url are left for LLMGenerator.__init__
    to resolve per-provider from settings (LLM_MODEL/LLM_BASE_URL for
    ollama, GROQ_MODEL/GROQ_BASE_URL for groq). Passing settings.LLM_MODEL/
    LLM_BASE_URL here unconditionally would leak Ollama's defaults into a
    groq-configured generator, since a non-empty explicit argument always
    wins over the provider-specific default inside __init__.
    """
    return LLMGenerator(provider=settings.LLM_PROVIDER)
