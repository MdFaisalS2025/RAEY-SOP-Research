"""
SOP-Guard Agentic Pipeline
---------------------------
Sequential pipeline: intake -> retrieve -> generate -> verify -> gate.
Research prototype  - NOT for clinical use.
"""

import re
import time
from typing import Any, AsyncIterator

from app.schemas.schemas import QueryResponse, RetrievedChunk, VerificationResult, VerificationStatus
from app.rag.hybrid_retriever import HybridRetriever
from app.rag.llm_generator import LLMGenerator
from app.rag.multihop import MultiHopRetriever
from app.rag.evidence_sufficiency import EvidenceSufficiencyChecker, build_corpus_vocabulary
from app.rag.hyde import generate_hypothetical_doc
from app.verifier.verifier import ProceduralFaithfulnessVerifier
from app.agents.query_agent import QueryUnderstandingAgent
from app.rag.citation_tracker import citation_coverage


class SOPGuardPipeline:
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

        # Evidence sufficiency check
        evidence = self.evidence_checker.check(query, retrieved, query_type)
        reasoning.append(f"Evidence: {'sufficient' if evidence['sufficient'] else 'insufficient'} (score: {evidence['score']})")
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
            return {
                "abstain": QueryResponse(
                    answer="I could not find enough support in the SOP library to answer safely. "
                           + ". ".join(evidence["recommendations"]),
                    citations=[],
                    confidence=0.1,
                    verification_result=None,
                    retrieved_chunks=response_chunks,
                    reasoning_trace=reasoning,
                    query_type=query_type,
                    abstained=True,
                    entities=analysis.get("entities", {}),
                )
            }

        return {
            "retrieved": retrieved,
            "query_type": query_type,
            "reasoning": reasoning,
            "evidence": evidence,
            "analysis": analysis,
            "t_start": t_start,
        }

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
        """
        prep = await self._prepare(query, news2_score=news2_score, use_hyde=use_hyde, retrieval_query=retrieval_query)
        if "abstain" in prep:
            yield {"type": "final", "response": prep["abstain"]}
            return

        retrieved, query_type, reasoning, evidence, analysis, t_start = (
            prep["retrieved"], prep["query_type"], prep["reasoning"], prep["evidence"], prep["analysis"], prep["t_start"]
        )

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

        response = self._finalize(gen_result, retrieved, query_type, reasoning, evidence, analysis, t_start, t_generate)
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
        """Execute the full pipeline."""

        prep = await self._prepare(query, news2_score=news2_score, use_hyde=use_hyde, retrieval_query=retrieval_query)
        if "abstain" in prep:
            return prep["abstain"]

        retrieved, query_type, reasoning, evidence, analysis, t_start = (
            prep["retrieved"], prep["query_type"], prep["reasoning"], prep["evidence"], prep["analysis"], prep["t_start"]
        )

        # 3. Generate
        t0 = time.perf_counter()
        gen_result = await self.generator.generate_answer(
            query, retrieved, query_type,
            news2_score=news2_score,
            history_context=history_context,
        )
        t_generate = round((time.perf_counter() - t0) * 1000)

        # 4-5. Verify, confidence-gate, and build the response
        return self._finalize(gen_result, retrieved, query_type, reasoning, evidence, analysis, t_start, t_generate)

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
