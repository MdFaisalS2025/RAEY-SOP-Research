"""
SOP-Guard Multi-Hop Retrieval
Detects cross-SOP references and retrieves linked content.
Research prototype. Not for clinical use.
"""

import re
from typing import Any, Optional
import logging

logger = logging.getLogger(__name__)

# Patterns that indicate cross-references to other SOPs or sections
REFERENCE_PATTERNS = [
    r"(?:see|refer to|follow|per|according to|as per|outlined in)\s+(?:the\s+)?['\"]?([A-Z][A-Za-z\s\-]{5,60}(?:Protocol|Procedure|Guidelines?|Policy|SOP))['\"]?",
    r"(?:SOP[-\s]?(?:[A-Z]{2,5}[-\s]?\d{3}))",
    r"(?:Section|section)\s+(\d+(?:\.\d+)?)",
    r"(?:follow|use|apply)\s+(?:the\s+)?(\w+\s+(?:protocol|procedure|guideline))",
]


class MultiHopRetriever:
    """
    Detects cross-references in retrieved chunks and performs
    second-hop retrieval to gather linked evidence.
    """

    def __init__(self, retriever, max_hops: int = 2):
        """
        Args:
            retriever: The primary retriever (HybridRetriever) to use for second-hop queries.
            max_hops: Maximum number of retrieval hops (default 2).
        """
        self.retriever = retriever
        self.max_hops = max_hops

    def retrieve_with_hops(
        self,
        query: str,
        first_hop_results: list[dict[str, Any]],
        top_k: int = 8,
        query_type: str = "general",
    ) -> dict[str, Any]:
        """
        Analyze first-hop results for cross-references and perform second-hop retrieval.

        Returns dict with:
            chunks: merged and deduplicated chunks
            hops: list of hop descriptions
            second_hop_queries: queries used for second hop
        """
        hops = [{"hop": 1, "chunks": len(first_hop_results), "reason": "Primary retrieval"}]
        all_chunks = list(first_hop_results)
        seen_chunk_ids = {c.get("chunk_id", f"first_{i}") for i, c in enumerate(first_hop_results)}

        if self.max_hops < 2 or not first_hop_results:
            return {
                "chunks": all_chunks[:top_k],
                "hops": hops,
                "second_hop_queries": [],
            }

        # Detect references in top chunks
        second_hop_queries = []
        first_hop_sops = {c.get("sop_id", "") for c in first_hop_results}

        for chunk in first_hop_results[:5]:
            text = chunk.get("text", chunk.get("chunk_text", ""))
            references = self._detect_references(text)

            for ref in references:
                ref_text = ref.get("reference", "")
                # Skip self-references
                if any(ref_text.lower() in chunk.get("sop_title", "").lower() for _ in [1]):
                    continue
                if ref_text not in second_hop_queries:
                    second_hop_queries.append(ref_text)

        if not second_hop_queries:
            return {
                "chunks": all_chunks[:top_k],
                "hops": hops,
                "second_hop_queries": [],
            }

        # Perform second-hop retrieval
        second_hop_chunks = []
        for ref_query in second_hop_queries[:3]:  # Limit to 3 second-hop queries
            try:
                hop2_results = self.retriever.search(
                    ref_query, top_k=3, query_type=query_type, expand_query=False
                )
                for chunk in hop2_results:
                    cid = chunk.get("chunk_id", chunk.get("sop_id", "") + str(chunk.get("chunk_index", "")))
                    if cid not in seen_chunk_ids:
                        chunk["hop"] = 2
                        chunk["hop_reason"] = f"Referenced: {ref_query[:60]}"
                        second_hop_chunks.append(chunk)
                        seen_chunk_ids.add(cid)
            except Exception as e:
                logger.warning(f"Second-hop retrieval failed for '{ref_query}': {e}")

        if second_hop_chunks:
            hops.append({
                "hop": 2,
                "chunks": len(second_hop_chunks),
                "reason": f"Cross-references found: {', '.join(second_hop_queries[:3])}",
            })
            # Add second-hop chunks with lower priority
            for chunk in second_hop_chunks:
                chunk["relevance_score"] = chunk.get("relevance_score", 0) * 0.7
            all_chunks.extend(second_hop_chunks)

        # Re-sort by relevance
        all_chunks.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)

        return {
            "chunks": all_chunks[:top_k],
            "hops": hops,
            "second_hop_queries": second_hop_queries,
        }

    def _detect_references(self, text: str) -> list[dict[str, str]]:
        """Detect cross-references to other SOPs or sections in chunk text."""
        references = []

        for pattern in REFERENCE_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                ref_text = match.group(0).strip()
                # Extract the meaningful part
                if match.lastindex and match.lastindex >= 1:
                    ref_text = match.group(1).strip()

                if len(ref_text) > 3 and ref_text not in [r["reference"] for r in references]:
                    references.append({
                        "reference": ref_text,
                        "context": text[max(0, match.start()-30):match.end()+30].strip(),
                        "type": "sop_reference",
                    })

        return references[:5]  # Limit references per chunk
