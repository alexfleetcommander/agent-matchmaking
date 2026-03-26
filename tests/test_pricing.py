"""Tests for price discovery mechanisms."""

from agent_matchmaking.pricing import (
    Bid,
    Quote,
    RFQSession,
    english_auction,
    estimate_cost,
    posted_price,
    vickrey_auction,
)
from agent_matchmaking.schema import MatchRequest, TaskDescription
from agent_matchmaking.ucp import UCPBuilder


def _make_priced_agent(agent_id, base_price):
    return (
        UCPBuilder()
        .identity(amp_id=agent_id)
        .add_capability(domain="research", description="test agent")
        .cost(base_amount=base_price)
        .build()
    )


def test_estimate_cost():
    ucp = _make_priced_agent("a1", 0.05)
    cost = estimate_cost(ucp, task_complexity=1.0)
    assert cost >= 0.05


def test_posted_price_multiple():
    agents = [
        _make_priced_agent("a1", 0.05),
        _make_priced_agent("a2", 0.10),
        _make_priced_agent("a3", 0.01),
    ]
    results = posted_price(agents)
    assert len(results) == 3
    # All should have valid costs
    for r in results:
        assert r.estimated_cost >= 0


def test_vickrey_auction_basic():
    bids = [
        Bid(agent_id="a1", amount=10.0),
        Bid(agent_id="a2", amount=8.0),
        Bid(agent_id="a3", amount=12.0),
    ]
    result = vickrey_auction(bids)
    assert result is not None
    assert result.winner_id == "a2"  # lowest bidder
    assert result.winning_bid == 8.0
    assert result.clearing_price == 10.0  # second-lowest price
    assert result.total_bids == 3
    assert result.format == "vickrey"


def test_vickrey_auction_single_bidder():
    bids = [Bid(agent_id="a1", amount=10.0)]
    result = vickrey_auction(bids)
    assert result is not None
    assert result.winner_id == "a1"
    assert result.clearing_price == 10.0  # pays own price when alone


def test_vickrey_auction_trust_filter():
    bids = [
        Bid(agent_id="a1", amount=5.0),
        Bid(agent_id="a2", amount=8.0),
    ]
    trust_scores = {"a1": 30.0, "a2": 80.0}
    result = vickrey_auction(bids, min_trust_score=50.0, trust_scores=trust_scores)
    assert result is not None
    assert result.winner_id == "a2"  # a1 filtered out


def test_english_auction():
    bids = [
        Bid(agent_id="a1", amount=10.0),
        Bid(agent_id="a2", amount=7.0),
    ]
    result = english_auction(bids)
    assert result is not None
    assert result.winner_id == "a2"
    assert result.clearing_price == 7.0


def test_rfq_session():
    req = MatchRequest(task=TaskDescription(description="test task"))
    session = RFQSession(req)

    session.add_quote(Quote(agent_id="a1", amount=10.0, terms="net30"))
    session.add_quote(Quote(agent_id="a2", amount=8.0, terms="prepaid"))
    session.add_quote(Quote(agent_id="a3", amount=12.0, terms="net30"))

    assert len(session.quotes) == 3

    # Rank by price only
    ranked = session.rank_quotes(price_weight=1.0, quality_weight=0.0)
    assert ranked[0].agent_id == "a2"  # cheapest first

    # Select a quote
    selected = session.select(session.quotes[1].quote_id)
    assert selected is not None
    assert session.selected_quote is not None

    d = session.to_dict()
    assert d["rfq_id"].startswith("rfq-")
    assert len(d["quotes"]) == 3


def test_rfq_rank_with_trust():
    req = MatchRequest(task=TaskDescription(description="test"))
    session = RFQSession(req)

    session.add_quote(Quote(agent_id="a1", amount=5.0))
    session.add_quote(Quote(agent_id="a2", amount=10.0))

    # a2 has much higher trust, should rank higher with quality weight
    ranked = session.rank_quotes(
        trust_scores={"a1": 30.0, "a2": 90.0},
        price_weight=0.3,
        quality_weight=0.7,
    )
    assert ranked[0].agent_id == "a2"
