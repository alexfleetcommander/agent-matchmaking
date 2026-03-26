"""Trust-weighted ranking — compute trust scores from CoC, ARP, ASA, AJP, ALP data.

Implements the four-tier trust hierarchy (Section 9.2) and composite trust
score computation (Section 9.3).
"""

import math
from typing import Any, Dict, Optional

from .schema import (
    DEFAULT_TRUST_BASELINE,
    DEFAULT_TRUST_WEIGHTS,
    TRUST_BASELINE_ADJUSTMENTS,
    TRUST_TIER_WEIGHTS,
    UnifiedCapabilityProfile,
)


# ---------------------------------------------------------------------------
# Confidence factors
# ---------------------------------------------------------------------------

def confidence_factor(sample_size: int, threshold: int = 100) -> float:
    """Scale [0.5, 1.0] based on sample size (Section 9.3)."""
    if sample_size >= threshold:
        return 1.0
    if sample_size <= 0:
        return 0.5
    return 0.5 + 0.5 * (sample_size / threshold)


def anchor_density_factor(
    chain_age_days: int,
    anchor_count: int,
) -> float:
    """Compute anchor density factor [0.5, 1.5] from chain age and anchor count."""
    if chain_age_days <= 0:
        return 0.5
    expected_anchors = chain_age_days * 12  # ~12/day for bi-hourly
    if expected_anchors <= 0:
        return 0.5
    ratio = anchor_count / expected_anchors
    return max(0.5, min(1.5, 0.5 + ratio))


# ---------------------------------------------------------------------------
# Component scores (Section 9.3)
# ---------------------------------------------------------------------------

def identity_confidence(
    chain_age_days: int = 0,
    anchor_count: int = 0,
) -> float:
    """Compute identity confidence from CoC chain metrics.

    identity_confidence(A) = min(100, log2(1 + chain_age_days) * anchor_density_factor)
    """
    if chain_age_days <= 0:
        return 0.0
    density = anchor_density_factor(chain_age_days, anchor_count)
    raw = math.log2(1 + chain_age_days) * density * 15  # scale factor
    return min(100.0, raw)


def performance_quality(
    arp_composite: float = 0.0,
    domain_arp: Optional[float] = None,
) -> float:
    """Performance quality from ARP composite (domain-specific if available)."""
    return domain_arp if domain_arp is not None else arp_composite


def reliability_score(
    asa_completion_rate: float = 0.0,
    asa_sample_size: int = 0,
) -> float:
    """Reliability from ASA completion rates, confidence-adjusted."""
    return asa_completion_rate * 100 * confidence_factor(asa_sample_size)


def risk_score(
    ajp_dispute_rate: float = 0.0,
    ajp_unfavorable_rate: float = 0.0,
) -> float:
    """Risk score from AJP dispute data (Section 9.3).

    risk = dispute_rate * unfavorable_resolution_rate * 100
    Higher = worse.
    """
    return ajp_dispute_rate * ajp_unfavorable_rate * 100


# ---------------------------------------------------------------------------
# Composite trust score
# ---------------------------------------------------------------------------

def compute_trust_score(
    chain_age_days: int = 0,
    anchor_count: int = 0,
    arp_composite: float = 0.0,
    domain_arp: Optional[float] = None,
    asa_completion_rate: float = 0.0,
    asa_sample_size: int = 0,
    ajp_dispute_rate: float = 0.0,
    ajp_unfavorable_rate: float = 0.0,
    weights: Optional[Dict[str, float]] = None,
) -> float:
    """Compute composite trust score (Section 9.3).

    trust_score(A) = w_identity * identity_confidence(A)
                   + w_performance * performance_quality(A)
                   + w_reliability * reliability_score(A)
                   + w_risk * (100 - risk_score(A))
    """
    w = weights or DEFAULT_TRUST_WEIGHTS

    id_conf = identity_confidence(chain_age_days, anchor_count)
    perf_q = performance_quality(arp_composite, domain_arp)
    rel_s = reliability_score(asa_completion_rate, asa_sample_size)
    rsk = risk_score(ajp_dispute_rate, ajp_unfavorable_rate)

    score = (
        w.get("identity", 0.20) * id_conf
        + w.get("performance", 0.40) * perf_q
        + w.get("reliability", 0.25) * rel_s
        + w.get("risk", 0.15) * (100 - rsk)
    )
    return max(0.0, min(100.0, score))


# ---------------------------------------------------------------------------
# New-agent baseline (Section 9.4)
# ---------------------------------------------------------------------------

def baseline_trust_score(
    has_corporate_validation: bool = False,
    has_community_reviews_10plus: bool = False,
    has_a2a_verified_domain: bool = False,
    has_did_verifiable: bool = False,
) -> float:
    """Compute baseline trust score for new agents (Section 9.4)."""
    score = float(DEFAULT_TRUST_BASELINE)
    if has_corporate_validation:
        score += TRUST_BASELINE_ADJUSTMENTS["corporate_marketplace_validation"]
    if has_community_reviews_10plus:
        score += TRUST_BASELINE_ADJUSTMENTS["community_reviews_10plus"]
    if has_a2a_verified_domain:
        score += TRUST_BASELINE_ADJUSTMENTS["a2a_card_verified_domain"]
    if has_did_verifiable:
        score += TRUST_BASELINE_ADJUSTMENTS["did_verifiable_controller"]
    return min(100.0, score)


# ---------------------------------------------------------------------------
# Trust score from UCP (convenience)
# ---------------------------------------------------------------------------

def trust_score_from_ucp(
    ucp: UnifiedCapabilityProfile,
    chain_age_days: int = 0,
    anchor_count: int = 0,
    weights: Optional[Dict[str, float]] = None,
) -> float:
    """Extract trust signals from a UCP and compute composite trust score.

    Falls back to baseline if no trust data is available.
    """
    perf = ucp.performance
    quality = perf.quality
    rel = perf.reliability
    dispute = perf.dispute_profile

    has_trust_data = (
        quality.arp_composite_score > 0
        or rel.asa_completion_rate > 0
        or dispute.ajp_sample_size > 0
        or chain_age_days > 0
    )

    if not has_trust_data:
        return baseline_trust_score(
            has_corporate_validation=any(
                r.registry_type in ("google_cloud", "salesforce", "aws", "servicenow")
                for r in ucp.identity.registries
            ),
            has_community_reviews_10plus=False,
            has_a2a_verified_domain=bool(ucp.identity.a2a_card),
            has_did_verifiable=bool(ucp.identity.did),
        )

    unfavorable_rate = 0.0
    if dispute.ajp_dispute_rate > 0 and dispute.ajp_favorable_resolution_rate < 1.0:
        unfavorable_rate = 1.0 - dispute.ajp_favorable_resolution_rate

    return compute_trust_score(
        chain_age_days=chain_age_days,
        anchor_count=anchor_count,
        arp_composite=quality.arp_composite_score,
        asa_completion_rate=rel.asa_completion_rate,
        asa_sample_size=rel.asa_sample_size,
        ajp_dispute_rate=dispute.ajp_dispute_rate,
        ajp_unfavorable_rate=unfavorable_rate,
        weights=weights,
    )


def trust_tier_weight(tier: str) -> float:
    """Return numeric weight for a trust tier string."""
    return TRUST_TIER_WEIGHTS.get(tier, 0.25)
