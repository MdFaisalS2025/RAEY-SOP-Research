"""
Regression tests for HybridRetriever's context_query parameter.

Real bug this guards against: multi-turn chat follow-ups used to retrieve
by concatenating the last 2 user questions into one string (see
app/api/routes_chat.py before this fix). A strong, specific first question
("What are the steps for sepsis management?") dominated TF-IDF/dense
scoring for every follow-up regardless of what the follow-up actually
asked, so every reply in a conversation kept answering from the same
evidence. context_query scores prior turns as a separate, discounted
signal instead, so the current question's own relevance always drives
ranking.
"""

from app.rag.hybrid_retriever import HybridRetriever


def _chunk(sop_title: str, text: str, chunk_type: str = "step_sequence") -> dict:
    return {
        "sop_id": sop_title.replace(" ", "_"),
        "sop_title": sop_title,
        "chunk_type": chunk_type,
        "text": text,
        "chunk_text": text,
        "department": "General",
        "status": "active",
    }


CHUNKS = [
    _chunk(
        "Sepsis Management Protocol",
        "Sepsis management steps: screen with qSOFA, obtain blood cultures, "
        "measure lactate, administer antibiotics within one hour, begin fluid "
        "resuscitation, start norepinephrine if hypotensive.",
    ),
    _chunk(
        "Central Line Insertion Protocol",
        "Central line insertion monitoring steps: verify catheter tip position "
        "with chest x-ray, monitor insertion site for infection signs daily, "
        "check dressing integrity, document line days for removal planning.",
    ),
    _chunk(
        "Fall Prevention Protocol",
        "Fall prevention steps: assess fall risk on admission, apply yellow "
        "wristband for high-risk patients, place bed alarm, round hourly.",
    ),
]


class TestContextQueryDoesNotDominate:
    def test_followup_ranks_its_own_topic_first_despite_strong_context(self):
        """The real regression: a follow-up about central lines must rank
        the central line chunk first even when the prior turn was a
        strong, specific sepsis question."""
        retriever = HybridRetriever(CHUNKS)
        followup = "What should a nurse monitor after central line insertion?"
        prior_question = "What are the steps for sepsis management?"

        results = retriever.search(followup, top_k=3, context_query=prior_question)
        assert results[0]["sop_title"] == "Central Line Insertion Protocol"

    def test_no_context_query_is_backward_compatible(self):
        """Omitting context_query must behave exactly as before - same
        top result as with an explicit empty string."""
        retriever = HybridRetriever(CHUNKS)
        query = "What should a nurse monitor after central line insertion?"

        default_results = retriever.search(query, top_k=3)
        explicit_empty_results = retriever.search(query, top_k=3, context_query="")

        assert default_results[0]["sop_title"] == explicit_empty_results[0]["sop_title"]
        assert default_results[0]["sop_title"] == "Central Line Insertion Protocol"

    def test_context_query_can_assist_a_vague_followup(self):
        """A follow-up too vague to stand alone ('what about contraindications?')
        should still lean on prior context to stay on-topic, rather than
        returning unrelated chunks."""
        retriever = HybridRetriever(CHUNKS)
        vague_followup = "What else should be documented?"
        prior_question = "What should a nurse monitor after central line insertion?"

        with_context = retriever.search(vague_followup, top_k=3, context_query=prior_question)
        without_context = retriever.search(vague_followup, top_k=3)

        # With context, the central line chunk should rank at least as
        # well as (and typically better than) it does without any prior
        # context to lean on.
        with_rank = next(
            (i for i, c in enumerate(with_context) if c["sop_title"] == "Central Line Insertion Protocol"),
            len(with_context),
        )
        without_rank = next(
            (i for i, c in enumerate(without_context) if c["sop_title"] == "Central Line Insertion Protocol"),
            len(without_context),
        )
        assert with_rank <= without_rank
