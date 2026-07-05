"""HyDE: Hypothetical Document Embeddings query expansion. Optional, off by default."""

import logging

logger = logging.getLogger(__name__)

_HYDE_PROMPT = (
    "Write a short hypothetical SOP excerpt (3-4 sentences) that would answer "
    "this question. Write it in the style of a hospital standard operating "
    "procedure, with specific clinical detail. Do not say it is hypothetical.\n\n"
    "Question: {query}\n\nHypothetical SOP excerpt:"
)


async def generate_hypothetical_doc(query: str, llm_call) -> str:
    """
    Ask the LLM to write a short hypothetical SOP excerpt answering the query.

    Args:
        query: The user's question.
        llm_call: Async callable taking a prompt string and returning text.

    Returns the hypothetical excerpt, or an empty string on failure.
    """
    try:
        doc = await llm_call(_HYDE_PROMPT.format(query=query))
        return (doc or "").strip()
    except Exception as e:
        logger.warning(f"HyDE generation failed, proceeding without expansion: {e}")
        return ""
