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
