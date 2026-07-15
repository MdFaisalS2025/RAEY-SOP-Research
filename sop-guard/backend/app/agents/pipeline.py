"""
Meridian Agentic Pipeline
---------------------------
Sequential pipeline: intake -> retrieve -> generate -> verify -> gate.
Research prototype  - NOT for clinical use.
"""

import re
import time
from typing import Any, AsyncIterator

from app.config import settings
from app.schemas.schemas import QueryResponse, RetrievedChunk, VerificationResult, VerificationStatus
from app.rag.hybrid_retriever import HybridRetriever
from app.rag.llm_generator import LLMGenerator
from app.rag.multihop import MultiHopRetriever
from app.rag.reranker import get_shared_reranker, CrossEncoderReranker
from app.rag.evidence_sufficiency import EvidenceSufficiencyChecker, build_corpus_vocabulary
from app.rag.hyde import generate_hypothetical_doc
from app.verifier.verifier import ProceduralFaithfulnessVerifier
from app.agents.query_agent import QueryUnderstandingAgent
from app.rag.citation_tracker import citation_coverage
from app.agents.routing import classify_intent, build_external_evidence_answer, build_no_evidence_answer
from app.integrations.evidence_registry import search_all as search_external_evidence
from app.rag.entity_graph import DRUG_LEXICON, CONDITION_LEXICON
from app.services import answer_cache
from app.services.query_clarification import detect_ambiguity
from app.services.query_decomposition import split_multi_part_query

#: Cheap "does this look like a clinical question at all" gate for the
#: post-generation fallback below - without it, an off-domain question
#: (hospital parking, cafeteria hours) that happens to share one common
#: English word ("validation", "lunch") with some indexed paper's title
#: would surface that paper as "external evidence", which is misleading
#: for a clinical-answer product. A hospital-admin question with genuinely
#: no clinical vocabulary and no literature-seeking phrasing should abstain
#: outright (Route D) rather than search external literature (Route B).
_CLINICAL_VOCAB = {w.lower() for w in DRUG_LEXICON} | {w.lower() for w in CONDITION_LEXICON}


def _looks_clinical(query: str) -> bool:
    low = query.lower()
    if any(term in low for term in _CLINICAL_VOCAB):
        return True
    return classify_intent(query) != "internal"


class MeridianPipeline:
    """
    Agentic RAG pipeline for clinical SOP question-answering
    with procedural faithfulness verification.
    """

    def __init__(self, chunks: list[dict[str, Any]], structured_sops: dict[str, dict] | None = None):
        """
        Args:
            chunks: All available SOP chunks for retrieval.
            structured_sops: Mapping of sop_id -> structured SOP data.
        """
        self.retriever = HybridRetriever(chunks)
        self.multihop = MultiHopRetriever(self.retriever)
        # Real semantic-relevance judge (see evidence_sufficiency.py's
        # semantic_relevance check) - process-wide singleton so the model
        # loads once, not on every request. Deliberately never passed into
        # HybridRetriever: it's used to score the sufficiency decision, not
        # to reorder retrieval - see _prepare() below for why.
        self.reranker = get_shared_reranker(
            backend=settings.RAG_RERANKER_BACKEND, model_name=settings.RAG_RERANKER_MODEL
        )
        self.evidence_checker = EvidenceSufficiencyChecker(
            corpus_vocabulary=build_corpus_vocabulary(chunks)
        )
        self.generator = LLMGenerator()
        self.verifier = ProceduralFaithfulnessVerifier()
        self.query_agent = QueryUnderstandingAgent()
        self.structured_sops = structured_sops or {}

    async def _prepare(
        self,
        query: str,
        news2_score: int | None = None,
        use_hyde: bool = False,
        retrieval_query: str | None = None,
    ) -> dict[str, Any]:
        """Steps 1-2 shared by both the single-shot and streaming pipelines:
        query understanding, optional HyDE expansion, retrieval, multi-hop,
        and the evidence-sufficiency gate. Returns either
        {"abstain": QueryResponse} when there isn't enough evidence to
        answer, or {"retrieved": ..., "query_type": ..., "reasoning": ...,
        "evidence": ..., "analysis": ...} to continue into generation.
        """
        t_start = time.perf_counter()

        # 1. Query Understanding
        t0 = time.perf_counter()
        analysis = self.query_agent.analyze(query)
        query_type = analysis["query_type"]
        t_intake = round((time.perf_counter() - t0) * 1000)
        reasoning = [f"Pipeline started for query: '{query[:80]}...'"]
        reasoning.extend(analysis["trace"])
        reasoning.append(f"Timing - Query understanding: {t_intake}ms")

        # 1b. Optional HyDE query expansion
        retrieval_query = retrieval_query or query
        if use_hyde:
            try:
                if await self.generator._check_available():
                    hypo = await generate_hypothetical_doc(query, self.generator._call_llm)
                    if hypo:
                        retrieval_query = f"{query}\n{hypo}"
                        reasoning.append(f"HyDE: expanded query with hypothetical doc ({len(hypo)} chars)")
                    else:
                        reasoning.append("HyDE: no hypothetical doc generated, using original query")
                else:
                    reasoning.append("HyDE requested but LLM unavailable, using original query")
            except Exception as e:
                reasoning.append(f"HyDE failed ({e}), using original query")

        # 2. Retrieve (with query-type boosting and synonym expansion)
        t0 = time.perf_counter()
        retrieved = self.retriever.search(retrieval_query, top_k=8, query_type=query_type)
        t_retrieve = round((time.perf_counter() - t0) * 1000)
        reasoning.append(f"Retrieved {len(retrieved)} chunks")
        reasoning.append(f"Timing - Retrieval: {t_retrieve}ms")
        if hasattr(self.retriever, 'get_retrieval_trace'):
            trace = self.retriever.get_retrieval_trace(query, query_type)
            reasoning.append(f"Retrieval: {trace['retrieval_method']}, variants: {len(trace['query_variants'])}")

        # 2b. Multi-part questions ("what's the dose and when do I
        # escalate?") get a retrieval pass per sub-question so the part
        # asked second isn't starved by a single blended query - merged
        # into `retrieved` before multi-hop/evidence-sufficiency run, so
        # everything downstream (verification, citations, generation)
        # sees one combined chunk set exactly as before.
        sub_questions = split_multi_part_query(query)
        if sub_questions:
            reasoning.append(f"Multi-part question detected: {len(sub_questions)} sub-questions")
            seen_ids = {c.get("chunk_id", c.get("sop_id", "") + str(c.get("chunk_index", ""))) for c in retrieved}
            for sub_q in sub_questions:
                try:
                    sub_chunks = self.retriever.search(sub_q, top_k=4, query_type=query_type)
                except Exception as e:
                    reasoning.append(f"Sub-question retrieval failed for '{sub_q[:60]}': {e}")
                    continue
                added = 0
                for c in sub_chunks:
                    cid = c.get("chunk_id", c.get("sop_id", "") + str(c.get("chunk_index", "")))
                    if cid in seen_ids:
                        continue
                    seen_ids.add(cid)
                    retrieved.append(c)
                    added += 1
                reasoning.append(f"Sub-question '{sub_q[:60]}': +{added} chunks")
            retrieved.sort(key=lambda c: c.get("relevance_score", 0), reverse=True)

        # Multi-hop retrieval
        t0 = time.perf_counter()
        hop_result = self.multihop.retrieve_with_hops(query, retrieved, top_k=8, query_type=query_type)
        t_multihop = round((time.perf_counter() - t0) * 1000)
        retrieved = hop_result["chunks"]
        for hop in hop_result["hops"]:
            reasoning.append(f"Hop {hop['hop']}: {hop['chunks']} chunks ({hop['reason']})")
        if hop_result["second_hop_queries"]:
            reasoning.append(f"Second-hop queries: {hop_result['second_hop_queries']}")
        reasoning.append(f"Timing - Multi-hop: {t_multihop}ms")

        # Score (not reorder) the top candidates for genuine semantic
        # relevance, independent of lexical/embedding-cosine overlap - this
        # is what actually distinguishes "heat stroke" from a SOP whose
        # steps densely repeat the literal token "stroke" (cerebrovascular
        # stroke), something no keyword or dense-cosine signal reliably
        # catches on its own. Passing a *copy* of the list means the
        # cross-encoder's internal sort never touches `retrieved`'s own
        # order - generation, citations, and verification below see exactly
        # the same ranking as before this change. Only run for the genuine
        # cross-encoder: if get_reranker() fell back to the heuristic
        # reranker (model unavailable), its score is on an incomparable
        # scale, so skip attaching it rather than mislabel it - see
        # evidence_sufficiency.py's semantic_relevance check for the
        # corresponding read side of this.
        if retrieved and isinstance(self.reranker, CrossEncoderReranker):
            try:
                self.reranker.rerank(retrieval_query, list(retrieved[:5]), top_k=5)
            except Exception as e:
                reasoning.append(f"Semantic relevance scoring failed ({e}), skipping")

        # Evidence sufficiency check
        evidence = self.evidence_checker.check(query, retrieved, query_type)
        reasoning.append(f"Evidence: {'sufficient' if evidence['sufficient'] else 'insufficient'} (score: {evidence['score']})")
        intent = classify_intent(query)
        reasoning.append(f"Routing intent: {intent}")

        # Ambiguity check: a dose/threshold question naming no specific
        # drug/condition, with plausible matches in more than one SOP,
        # should ask which one rather than guess or abstain. Checked before
        # both the sufficient and insufficient branches below, since an
        # ambiguous query can retrieve evidence that looks "sufficient" for
        # entirely the wrong drug.
        ambiguity = detect_ambiguity(query_type, analysis.get("entities", {}), retrieved)
        if ambiguity:
            reasoning.append(f"Ambiguous query detected: {ambiguity['question']}")
            return {
                "abstain": QueryResponse(
                    answer=ambiguity["question"],
                    citations=[],
                    confidence=0.0,
                    verification_result=None,
                    retrieved_chunks=[],
                    reasoning_trace=reasoning,
                    query_type=query_type,
                    abstained=False,
                    entities=analysis.get("entities", {}),
                    route="clarification",
                    needs_clarification=True,
                    clarification_question=ambiguity["question"],
                    clarification_options=ambiguity["options"],
                )
            }

        if not evidence["sufficient"]:
            reasoning.append(f"Missing: {', '.join(evidence['missing'])}")
            response_chunks = [
                RetrievedChunk(
                    chunk_text=c.get("chunk_text", ""),
                    section_title=c.get("section_title", ""),
                    sop_title=c.get("sop_title", ""),
                    sop_id=c.get("sop_id", ""),
                    relevance_score=c.get("relevance_score", 0.0),
                )
                for c in retrieved
            ]

            # Route B/D: no sufficient internal SOP evidence. Before
            # abstaining, check external literature - this is the seam
            # that used to not exist (see routing.py docstring).
            external_results: list[dict] = []
            try:
                external_results = await search_external_evidence(query, max_results=5)
            except Exception:
                external_results = []

            if external_results:
                # Route B
                ext_answer = build_external_evidence_answer(query, external_results)
                reasoning.extend(ext_answer["reasoning_trace"])
                return {
                    "abstain": QueryResponse(
                        answer=ext_answer["answer"],
                        citations=ext_answer["citations"],
                        inline_citations=ext_answer.get("inline_citations", []),
                        confidence=ext_answer["confidence"],
                        verification_result=None,
                        retrieved_chunks=response_chunks,
                        reasoning_trace=reasoning,
                        query_type=query_type,
                        abstained=False,
                        entities=analysis.get("entities", {}),
                        route="external_evidence",
                        external_evidence=external_results,
                    )
                }

            # Route D: neither internal nor external evidence available.
            reasoning.append("Route D: no internal or external evidence found")
            return {
                "abstain": QueryResponse(
                    answer=build_no_evidence_answer(evidence["recommendations"]),
                    citations=[],
                    confidence=0.1,
                    verification_result=None,
                    retrieved_chunks=response_chunks,
                    reasoning_trace=reasoning,
                    query_type=query_type,
                    abstained=True,
                    entities=analysis.get("entities", {}),
                    route="no_evidence",
                )
            }

        # Route A/C: sufficient internal SOP evidence. If the query
        # explicitly asks for a comparison against literature, also pull
        # external evidence and mark this a hybrid answer (Route C) -
        # the internal generation path below is unchanged either way.
        route = "sop_library"
        external_evidence: list[dict] = []
        if intent == "hybrid":
            try:
                external_evidence = await search_external_evidence(query, max_results=5)
            except Exception:
                external_evidence = []
            if external_evidence:
                route = "hybrid"
                reasoning.append(f"Route C: hybrid - {len(external_evidence)} external records alongside internal SOP evidence")

        return {
            "retrieved": retrieved,
            "query_type": query_type,
            "reasoning": reasoning,
            "evidence": evidence,
            "analysis": analysis,
            "t_start": t_start,
            "route": route,
            "external_evidence": external_evidence,
        }

    async def _post_generation_fallback(
        self, query: str, gen_result: dict[str, Any], route: str, external_evidence: list[dict],
    ) -> tuple[dict[str, Any], str, list[dict]]:
        """Route A/C only decide "is there SOP evidence" from the coarse
        EvidenceSufficiencyChecker score in _prepare(). The generator can
        still abstain afterwards on its own, stricter grounds (see
        generator.py's _MIN_RELEVANCE / the LLM's own "not covered"
        instruction) - e.g. a loosely-matching chunk clears the sufficiency
        bar but doesn't actually answer the question. Previously that left
        the response mislabeled "Sourced from: SOP Library" with a generic
        refusal, and skipped the external-evidence fallback entirely. Treat
        it the same as Route B/D instead: try external evidence, then fall
        back to the standard "No validated evidence found" answer."""
        if not gen_result.get("abstained") or route != "sop_library":
            return gen_result, route, external_evidence
        results: list[dict] = []
        if _looks_clinical(query):
            try:
                results = await search_external_evidence(query, max_results=5)
            except Exception:
                results = []
        if results:
            ext_answer = build_external_evidence_answer(query, results)
            merged = {**gen_result, **ext_answer, "abstained": False}
            return merged, "external_evidence", results
        merged = {
            **gen_result,
            "answer": build_no_evidence_answer([
                "Try rephrasing with more specific clinical terms.",
                "The query may not match any uploaded SOP content.",
            ]),
            "citations": [],
            "confidence": 0.1,
        }
        return merged, "no_evidence", external_evidence

    def _finalize(
        self,
        gen_result: dict[str, Any],
        retrieved: list[dict],
        query_type: str,
        reasoning: list[str],
        evidence: dict,
        analysis: dict,
        t_start: float,
        t_generate: float,
        route: str = "sop_library",
        external_evidence: list[dict] | None = None,
    ) -> QueryResponse:
        """Steps 4-5 shared by both pipelines: verify against the structured
        SOP, gate confidence, and build the final QueryResponse."""
        answer = gen_result["answer"]
        citations = gen_result["citations"]
        confidence = gen_result["confidence"]
        reasoning.append(f"Generation mode: {gen_result.get('generation_mode', 'unknown')}")
        reasoning.extend(gen_result["reasoning_trace"])
        reasoning.append(f"Timing - Generation: {t_generate}ms")

        t0 = time.perf_counter()
        merged_structured = self._merge_structured_sops(retrieved)
        verification = self.verifier.verify(answer, retrieved, merged_structured)
        t_verify = round((time.perf_counter() - t0) * 1000)
        reasoning.append(f"Verification: {verification.status.value} (score: {verification.overall_score})")
        reasoning.append(f"Timing - Verification: {t_verify}ms")

        coverage = citation_coverage(answer)
        reasoning.append(f"Citation coverage: {coverage}")
        final_confidence = self._confidence_gate(
            confidence, verification,
            num_chunks=len(retrieved),
            evidence_score=evidence.get("score", 0.0) if isinstance(evidence, dict) else 0.0,
            query_type=query_type,
            citation_coverage_score=coverage,
        )
        t_total = round((time.perf_counter() - t_start) * 1000)
        reasoning.append(f"Final confidence after gating: {final_confidence}")
        reasoning.append(f"Timing - Total pipeline: {t_total}ms")

        response_chunks = [
            RetrievedChunk(
                chunk_text=c.get("chunk_text", ""),
                section_title=c.get("section_title", ""),
                sop_title=c.get("sop_title", ""),
                sop_id=c.get("sop_id", ""),
                relevance_score=c.get("relevance_score", 0.0),
            )
            for c in retrieved
        ]

        return QueryResponse(
            answer=answer,
            citations=citations,
            confidence=final_confidence,
            verification_result=verification,
            retrieved_chunks=response_chunks,
            reasoning_trace=reasoning,
            query_type=query_type,
            faithfulness=gen_result.get("faithfulness"),
            sop_conflicts=gen_result.get("sop_conflicts", []),
            inline_citations=gen_result.get("inline_citations", []),
            followup_questions=gen_result.get("followup_questions", []),
            abstained=gen_result.get("abstained", False),
            entities=analysis.get("entities", {}),
            route=route,
            external_evidence=external_evidence or [],
        )

    async def run_streaming(
        self,
        query: str,
        user_role: str = "",
        department: str = "",
        news2_score: int | None = None,
        use_hyde: bool = False,
        retrieval_query: str | None = None,
        history_context: str = "",
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream tokens as the model generates the answer, then yield one
        final event carrying the same QueryResponse the non-streaming
        pipeline returns (verification, citations, faithfulness all run
        after the full text is assembled - see LLMGenerator.stream_answer).

        Yields ``{"type": "token", "text": str}`` events, then exactly one
        ``{"type": "final", "response": QueryResponse}`` event.

        Cache-only for standalone questions (no conversation history - see
        answer_cache.py for why): a hit is delivered as a single token
        event carrying the whole cached answer, so the caller's streaming
        UI works identically whether the answer was just generated or
        served from cache.
        """
        cache_eligible = not history_context
        if cache_eligible:
            cached = answer_cache.get(query, news2_score)
            if cached is not None:
                yield {"type": "token", "text": cached.answer}
                yield {"type": "final", "response": cached}
                return

        prep = await self._prepare(query, news2_score=news2_score, use_hyde=use_hyde, retrieval_query=retrieval_query)
        if "abstain" in prep:
            yield {"type": "final", "response": prep["abstain"]}
            return

        retrieved, query_type, reasoning, evidence, analysis, t_start = (
            prep["retrieved"], prep["query_type"], prep["reasoning"], prep["evidence"], prep["analysis"], prep["t_start"]
        )
        route, external_evidence = prep.get("route", "sop_library"), prep.get("external_evidence", [])

        t0 = time.perf_counter()
        gen_result: dict[str, Any] | None = None
        async for event in self.generator.stream_answer(
            query, retrieved, query_type,
            news2_score=news2_score,
            history_context=history_context,
        ):
            if event["type"] == "token":
                yield {"type": "token", "text": event["text"]}
            elif event["type"] == "final":
                gen_result = {k: v for k, v in event.items() if k != "type"}
        t_generate = round((time.perf_counter() - t0) * 1000)

        if gen_result is None:
            # Defensive fallback - stream_answer always yields a final
            # event, but never leave the client hanging if that changes.
            gen_result = {
                "answer": "Generation did not complete.", "citations": [], "confidence": 0.1,
                "reasoning_trace": [], "generation_mode": "error",
            }

        gen_result, route, external_evidence = await self._post_generation_fallback(query, gen_result, route, external_evidence)
        response = self._finalize(gen_result, retrieved, query_type, reasoning, evidence, analysis, t_start, t_generate, route=route, external_evidence=external_evidence)
        if cache_eligible and not response.abstained:
            answer_cache.set(query, news2_score, response)
        yield {"type": "final", "response": response}

    async def run(
        self,
        query: str,
        user_role: str = "",
        department: str = "",
        news2_score: int | None = None,
        use_hyde: bool = False,
        retrieval_query: str | None = None,
        history_context: str = "",
    ) -> QueryResponse:
        """Execute the full pipeline.

        Cache-only for standalone questions (no conversation history) - see
        answer_cache.py for what that trades off and why.
        """
        cache_eligible = not history_context
        if cache_eligible:
            cached = answer_cache.get(query, news2_score)
            if cached is not None:
                return cached

        prep = await self._prepare(query, news2_score=news2_score, use_hyde=use_hyde, retrieval_query=retrieval_query)
        if "abstain" in prep:
            return prep["abstain"]

        retrieved, query_type, reasoning, evidence, analysis, t_start = (
            prep["retrieved"], prep["query_type"], prep["reasoning"], prep["evidence"], prep["analysis"], prep["t_start"]
        )
        route, external_evidence = prep.get("route", "sop_library"), prep.get("external_evidence", [])

        # 3. Generate
        t0 = time.perf_counter()
        gen_result = await self.generator.generate_answer(
            query, retrieved, query_type,
            news2_score=news2_score,
            history_context=history_context,
        )
        t_generate = round((time.perf_counter() - t0) * 1000)

        gen_result, route, external_evidence = await self._post_generation_fallback(query, gen_result, route, external_evidence)

        # 4-5. Verify, confidence-gate, and build the response
        response = self._finalize(gen_result, retrieved, query_type, reasoning, evidence, analysis, t_start, t_generate, route=route, external_evidence=external_evidence)
        if cache_eligible and not response.abstained:
            answer_cache.set(query, news2_score, response)
        return response

    def _classify_query(self, query: str) -> str:
        """Classify query type using keyword matching."""
        q = query.lower()

        threshold_kw = [
            "dose", "dosage", "how much", "how many", "maximum", "minimum",
            "threshold", "limit", "rate", "level", "value", "range", "target",
            "mmhg", "ml", "mg", "units", "mmol", "bpm", "percentage",
        ]
        sequence_kw = [
            "steps", "procedure", "process", "order", "sequence", "first",
            "then", "after", "before", "protocol", "how to", "what do i do",
            "walk me through", "guide",
        ]
        contra_kw = [
            "contraindication", "avoid", "not allowed", "cannot", "should not",
            "warning", "danger", "risk", "allergy", "allergic", "when not to",
            "do not", "don't", "never",
        ]

        scores = {
            "threshold": sum(1 for kw in threshold_kw if kw in q),
            "sequence": sum(1 for kw in sequence_kw if kw in q),
            "contraindication": sum(1 for kw in contra_kw if kw in q),
        }

        best = max(scores, key=scores.get)
        if scores[best] == 0:
            return "general"
        return best

    def _merge_structured_sops(self, retrieved_chunks: list[dict]) -> dict:
        """Get structured data from the PRIMARY (top-scoring) SOP only."""
        if not retrieved_chunks:
            return {"steps": [], "thresholds": [], "contraindications": []}

        primary_sop_id = retrieved_chunks[0].get("sop_id", "")
        structured = self.structured_sops.get(primary_sop_id, {})
        return {
            "steps": structured.get("steps", []),
            "thresholds": structured.get("thresholds", []),
            "contraindications": structured.get("contraindications", []),
        }

    def _confidence_gate(
        self,
        raw_confidence: float,
        verification: VerificationResult,
        num_chunks: int = 0,
        evidence_score: float = 0.0,
        query_type: str = "general",
        citation_coverage_score: float | None = None,
    ) -> float:
        """Compute final confidence from retrieval, generation, and verification signals."""
        score = raw_confidence

        # Boost from evidence quality
        if num_chunks >= 3:
            score = max(score, 0.6)
        if evidence_score >= 0.75:
            score = max(score, 0.65)

        # Verification result impact depends on query type and score
        if verification.status == VerificationStatus.passed:
            score = max(score, 0.8)
            if verification.overall_score >= 0.8:
                score = max(score, 0.85)
        elif verification.status == VerificationStatus.warning:
            # Warning with high evidence = still decent confidence
            if evidence_score >= 0.75:
                score = min(max(score, 0.6), 0.7)
            else:
                score = min(score, 0.65)
        elif verification.status == VerificationStatus.failed:
            # Scale by how badly verification failed and evidence quality
            if verification.overall_score >= 0.4 and evidence_score >= 0.75:
                score = min(max(score, 0.55), 0.65)
            elif verification.overall_score >= 0.3:
                score = min(score, 0.55)
            else:
                score = min(score * 0.5, 0.35)

        # Citation-coverage cap: the checks above can boost confidence to
        # 0.8+ purely from verification/evidence signals, even if most of
        # the answer's sentences aren't attributed to any specific source
        # chunk (both generators now emit real [N] markers - see
        # generator.py/llm_generator.py - so low coverage is a genuine
        # grounding-quality signal, not a generator limitation). A
        # confidently-worded but poorly-cited answer shouldn't outrank one
        # that's actually traceable to its sources.
        if citation_coverage_score is not None and citation_coverage_score < 0.3:
            score = min(score, 0.65)

        return round(score, 2)
