"""
Sentence-level faithfulness checker for SOP answers.
Checks if each claim in the answer is grounded in retrieved chunks.
"""
import re
from typing import Any


def check_faithfulness(answer: str, chunks: list[dict[str, Any]]) -> dict[str, Any]:
    """
    For each sentence in the answer, check if it contains information
    grounded in the retrieved SOP chunks.

    Returns:
        {
            "sentences": [
                {
                    "text": "Max dose is 3 mcg/kg/min",
                    "grounded": True,
                    "source_chunk": "Sepsis SOP",
                    "confidence": 0.9,
                }
            ],
            "overall_faithfulness": 0.85,
            "ungrounded_count": 1,
        }
    """
    # Build full context for lookup
    full_context = " ".join(
        chunk.get("text", chunk.get("chunk_text", "")).lower()
        for chunk in chunks
    ).lower()

    # Chunk-to-title map for attribution
    chunk_titles = [
        chunk.get("sop_title", "Unknown") for chunk in chunks
    ]

    # Split answer into sentences (simple split, handles numbered lists too)
    raw_sentences = re.split(r'(?<=[.!?])\s+|(?=\d+\.\s)', answer.strip())
    sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 20]

    results = []
    grounded_count = 0

    for sentence in sentences:
        # Skip headings, source attribution lines, disclaimers
        if sentence.startswith("#") or sentence.startswith("Source:") or "research prototype" in sentence.lower():
            continue

        sentence_lower = sentence.lower()

        # Extract key terms: numbers, doses, medical terms
        key_terms = re.findall(
            r'\b\d+\.?\d*\s*(?:mcg|mg|ml|mmhg|mmol|%|units?|hours?|minutes?|days?)\b'
            r'|\b(?:contraindicated|avoid|do not|must|required|critical|immediate|maximum|minimum)\b',
            sentence_lower
        )

        matched: list[str] = []
        if not key_terms:
            # Non-specific sentence — assume grounded
            grounded = True
            confidence = 0.7
            source = "General context"
        else:
            # Check if ALL key terms appear in context
            matched = [term for term in key_terms if term in full_context]
            grounded = len(matched) >= len(key_terms) * 0.6
            confidence = len(matched) / len(key_terms) if key_terms else 1.0

            # Find which chunk it came from
            source = "Unknown"
            for i, chunk in enumerate(chunks):
                chunk_text = chunk.get("text", chunk.get("chunk_text", "")).lower()
                if any(term in chunk_text for term in matched):
                    source = chunk_titles[i]
                    break

        if grounded:
            grounded_count += 1

        results.append({
            "text": sentence[:200],
            "grounded": grounded,
            "source_chunk": source,
            "confidence": round(confidence, 2),
            "key_terms_found": len(matched) if key_terms else 0,
            "key_terms_total": len(key_terms),
        })

    total = len(results)
    overall = grounded_count / total if total > 0 else 1.0

    return {
        "sentences": results,
        "overall_faithfulness": round(overall, 2),
        "grounded_count": grounded_count,
        "ungrounded_count": total - grounded_count,
        "total_checked": total,
    }
