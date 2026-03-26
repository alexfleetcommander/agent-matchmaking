"""Tests for trust-weighted ranking."""

from agent_matchmaking.ranking import (
    baseline_trust_score,
    compute_trust_score,
    confidence_factor,
    identity_confidence,
    performance_quality,
    reliability_score,
    risk_score,
    trust_score_from_ucp,
)
from agent_matchmaking.ucp import UCPBuilder


def test_confidence_factor_bounds():
    assert confidence_factor(0) == 0.5
    assert confidence_factor(100) == 1.0
    assert confidence_factor(50) == 0.75
    assert 0.5 <= confidence_factor(1) <= 1.0


def test_identity_confidence_zero_chain():
    assert identity_confidence(0, 0) == 0.0


def test_identity_confidence_long_chain():
    score = identity_confidence(365, 4380)  # 1 year, ~12/day
    assert score > 0
    assert score <= 100.0


def test_performance_quality_domain():
    assert performance_quality(80.0, domain_arp=90.0) == 90.0
    assert performance_quality(80.0) == 80.0


def test_reliability_score_with_confidence():
    # High completion rate, good sample size
    score = reliability_score(0.95, 100)
    assert score == 95.0  # 0.95 * 100 * 1.0

    # Same rate, small sample
    score_small = reliability_score(0.95, 5)
    assert score_small < 95.0


def test_risk_score():
    # No disputes
    assert risk_score(0.0, 0.0) == 0.0
    # High dispute, high unfavorable
    high = risk_score(0.10, 0.90)
    assert abs(high - 9.0) < 0.01
    # High dispute, low unfavorable (agent was justified)
    low = risk_score(0.10, 0.10)
    assert abs(low - 1.0) < 0.01


def test_compute_trust_score_bounds():
    score = compute_trust_score(
        chain_age_days=365, anchor_count=4380,
        arp_composite=90.0,
        asa_completion_rate=0.98, asa_sample_size=200,
        ajp_dispute_rate=0.01, ajp_unfavorable_rate=0.1,
    )
    assert 0 <= score <= 100


def test_compute_trust_score_zero():
    score = compute_trust_score()
    # With no data, only the risk component (100 - 0 = 100) * 0.15 = 15
    assert score >= 0


def test_baseline_trust_no_signals():
    score = baseline_trust_score()
    assert score == 40.0


def test_baseline_trust_corporate():
    score = baseline_trust_score(has_corporate_validation=True)
    assert score == 55.0


def test_baseline_trust_all_signals():
    score = baseline_trust_score(
        has_corporate_validation=True,
        has_community_reviews_10plus=True,
        has_a2a_verified_domain=True,
        has_did_verifiable=True,
    )
    assert score == 75.0


def test_trust_score_from_ucp_with_data():
    ucp = (
        UCPBuilder()
        .identity(amp_id="test-agent")
        .add_capability(domain="research", description="test")
        .performance(arp_composite=85.0, asa_completion_rate=0.95, asa_sample_size=100)
        .trust_tier("measured")
        .build()
    )
    score = trust_score_from_ucp(ucp, chain_age_days=100, anchor_count=1200)
    assert 0 <= score <= 100
    assert score > 30  # Should be meaningfully above baseline


def test_trust_score_from_ucp_no_data():
    ucp = (
        UCPBuilder()
        .identity(amp_id="new-agent", a2a_card="https://example.com/agent.json")
        .add_capability(domain="research", description="test")
        .trust_tier("declared")
        .build()
    )
    score = trust_score_from_ucp(ucp)
    # Should get baseline + a2a bonus
    assert score == 45.0  # 40 + 5
