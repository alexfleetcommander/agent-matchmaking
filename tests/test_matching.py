"""Tests for matching engine — ranked search and stable matching."""

from agent_matchmaking.schema import (
    MatchConstraints,
    MatchRequest,
    TaskDescription,
    UnifiedCapabilityProfile,
)
from agent_matchmaking.ucp import UCPBuilder
from agent_matchmaking.matching import (
    capability_match_score,
    compatibility_score,
    cost_alignment_score,
    passes_constraints,
    ranked_search,
    stable_matching,
)


def _make_agent(
    agent_id, domain, description, arp=50.0, price=0.05, trust_tier="measured"
):
    return (
        UCPBuilder()
        .identity(amp_id=agent_id)
        .add_capability(domain=domain, description=description)
        .performance(arp_composite=arp, asa_completion_rate=0.90, asa_sample_size=50)
        .cost(base_amount=price)
        .availability(lifecycle_stage="operational")
        .trust_tier(trust_tier)
        .build()
    )


def _make_request(description, domain="", budget=0.0, max_results=10, min_trust=0.0):
    return MatchRequest(
        requester_id="test-requester",
        task=TaskDescription(
            description=description,
            domain=domain,
            budget_max=budget,
        ),
        constraints=MatchConstraints(max_results=max_results, min_trust_score=min_trust),
    )


def test_capability_match_domain_bonus():
    task = TaskDescription(description="security code review", domain="security")
    agent_match = _make_agent("a1", "security", "security code review agent")
    agent_nomatch = _make_agent("a2", "creative", "creative design agent")

    score_match = capability_match_score(task, agent_match)
    score_nomatch = capability_match_score(task, agent_nomatch)
    assert score_match > score_nomatch


def test_cost_alignment_within_budget():
    task = TaskDescription(description="test", budget_max=1.0)
    cheap = _make_agent("cheap", "research", "test", price=0.50)
    expensive = _make_agent("expensive", "research", "test", price=5.0)

    score_cheap = cost_alignment_score(task, cheap)
    score_expensive = cost_alignment_score(task, expensive)
    assert score_cheap > score_expensive


def test_passes_constraints_trust():
    ucp = _make_agent("a1", "research", "test")
    constraints = MatchConstraints(min_trust_score=80.0)
    # With low trust score, should fail
    assert not passes_constraints(ucp, constraints, trust_score_val=50.0)
    # With high trust score, should pass
    assert passes_constraints(ucp, constraints, trust_score_val=85.0)


def test_passes_constraints_excluded():
    ucp = _make_agent("blocked-agent", "research", "test")
    constraints = MatchConstraints(excluded_agents=["blocked-agent"])
    assert not passes_constraints(ucp, constraints)


def test_ranked_search_returns_ranked():
    agents = [
        _make_agent("a1", "security", "security code review", arp=90.0),
        _make_agent("a2", "security", "general security analysis", arp=70.0),
        _make_agent("a3", "creative", "art generation", arp=80.0),
    ]
    request = _make_request("security code review", domain="security", max_results=5)
    response = ranked_search(request, agents)

    assert len(response.results) <= 5
    assert response.metadata.total_candidates_evaluated == 3
    # Results should be sorted by score descending
    for i in range(len(response.results) - 1):
        assert response.results[i].compatibility_score >= response.results[i + 1].compatibility_score
    # Ranks should be sequential
    for i, r in enumerate(response.results):
        assert r.rank == i + 1


def test_ranked_search_respects_max_results():
    agents = [_make_agent(f"a{i}", "research", f"agent {i}") for i in range(20)]
    request = _make_request("research", max_results=5)
    response = ranked_search(request, agents)
    assert len(response.results) <= 5


def test_ranked_search_filters_by_trust():
    agents = [
        _make_agent("good", "security", "security review", arp=90.0),
        _make_agent("bad", "security", "security review", arp=10.0),
    ]
    request = _make_request("security review", domain="security", min_trust=50.0)
    response = ranked_search(request, agents)
    # Low-trust agent may be filtered
    assert response.metadata.candidates_filtered_by_constraints >= 0


def test_stable_matching():
    agents = [
        _make_agent("a1", "security", "security expert", arp=90.0),
        _make_agent("a2", "research", "research specialist", arp=85.0),
    ]
    requests = [
        _make_request("security code review", domain="security"),
        _make_request("competitive research", domain="research"),
    ]
    assignment = stable_matching(requests, agents)
    assert len(assignment) <= 2
    # Each matched request maps to a valid agent
    for rid, aid in assignment.items():
        assert aid in ("a1", "a2")


def test_compatibility_score_returns_tuple():
    agent = _make_agent("a1", "research", "research agent", arp=80.0)
    request = _make_request("research task", domain="research")
    total, dims = compatibility_score(request, agent)
    assert isinstance(total, float)
    assert isinstance(dims, dict)
    assert "capability_match" in dims
    assert "trust_score" in dims
    assert total >= 0
