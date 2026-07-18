"""
Tests for QueryUnderstandingAgent's entity extraction, specifically the
word-boundary fix for a substring false-positive: "epinephrine" is a
substring of "norepinephrine", so a plain `drug in q_lower` check matched
both drugs on every norepinephrine-only question. This polluted anything
downstream that consumes entities (e.g. the query-page PubMed evidence
search term, which searched "norepinephrine epinephrine" and got
low-relevance results back).
"""

from app.agents.query_agent import QueryUnderstandingAgent


def test_norepinephrine_query_does_not_also_match_epinephrine():
    agent = QueryUnderstandingAgent()
    result = agent.analyze("What is the maximum norepinephrine dose for septic shock?")
    assert "norepinephrine" in result["entities"]["drugs"]
    assert "epinephrine" not in result["entities"]["drugs"]


def test_epinephrine_query_matches_only_epinephrine():
    agent = QueryUnderstandingAgent()
    result = agent.analyze("What is the epinephrine dose for anaphylaxis?")
    assert "epinephrine" in result["entities"]["drugs"]
    assert "norepinephrine" not in result["entities"]["drugs"]


def test_septic_shock_query_matches_condition_not_substring_fragments():
    agent = QueryUnderstandingAgent()
    result = agent.analyze("What is the target MAP in septic shock?")
    assert "septic shock" in result["entities"]["conditions"]


class TestDeltaThresholdClassification:
    """Real bug (P1.1): 'stop' is a substring of 'stopping', so "What
    temperature rise requires stopping a transfusion?" scored 1.0 for
    contraindication (matched "stop") but 0.0 for threshold (no keyword
    like "level"/"limit"/"target" was present) - even though the question
    is squarely asking for a threshold value. This misrouted retrieval to
    the wrong chunk type and caused a false abstention."""

    def test_delta_threshold_phrasing_classifies_as_threshold_not_contraindication(self):
        agent = QueryUnderstandingAgent()
        result = agent.analyze("What temperature rise requires stopping a transfusion?")
        assert result["query_type"] == "threshold"

    def test_genuine_contraindication_question_still_classifies_correctly(self):
        agent = QueryUnderstandingAgent()
        result = agent.analyze("What must be avoided during a transfusion reaction?")
        assert result["query_type"] == "contraindication"

    def test_other_delta_words_also_classify_as_threshold(self):
        agent = QueryUnderstandingAgent()
        for q in [
            "What SBP drop indicates a transfusion reaction?",
            "What HR increase should prompt stopping the infusion?",
        ]:
            assert agent.analyze(q)["query_type"] == "threshold", q
