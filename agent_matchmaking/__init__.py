"""Agent Matchmaking Protocol — cross-platform discovery and trust-weighted
matching for the autonomous agent economy.

A pip-installable implementation of the Agent Matchmaking Protocol (AMP),
companion to Chain of Consciousness, Agent Rating Protocol, Agent Service
Agreements, Agent Justice Protocol, and Agent Lifecycle Protocol.
"""

from .schema import (
    # Constants
    AUCTION_FORMATS,
    CAPABILITY_DOMAINS,
    DEFAULT_TRUST_BASELINE,
    DEFAULT_TRUST_WEIGHTS,
    DEFAULT_WEIGHTS,
    LIFECYCLE_STATUSES,
    MATCHING_MODES,
    PRICING_MECHANISMS,
    PROTOCOL_VERSION,
    SCHEMA_VERSION,
    TRUST_TIERS,
    TRUST_TIER_WEIGHTS,
    # Data structures — UCP
    Availability,
    Capability,
    Capacity,
    ComplexityRange,
    Cost,
    CostRate,
    FreeTier,
    Identity,
    Performance,
    QualityMetrics,
    RegistryListing,
    ReliabilityMetrics,
    SpeedMetrics,
    TaxonomyCodes,
    UnifiedCapabilityProfile,
    UCP,
    DisputeProfile,
    # Data structures — Match
    FederationConfig,
    FederationQuery,
    FederationResult,
    MatchConstraints,
    MatchMetadata,
    MatchRequest,
    MatchResponse,
    MatchResult,
    TaskDescription,
    TrustVerification,
)
from .store import MatchmakingStore
from .ucp import (
    UCPBuilder,
    UCPValidationError,
    from_a2a_agent_card,
    from_mcp_manifest,
    from_openclaw_skill,
    validate_ucp,
)
from .ranking import (
    baseline_trust_score,
    compute_trust_score,
    confidence_factor,
    identity_confidence,
    performance_quality,
    reliability_score,
    risk_score,
    trust_score_from_ucp,
    trust_tier_weight,
)
from .matching import (
    capability_match_score,
    compatibility_score,
    cost_alignment_score,
    availability_score,
    domain_relevance_score,
    passes_constraints,
    ranked_search,
    stable_matching,
    style_compatibility_score,
)
from .discovery import (
    deduplicate,
    discover,
    normalize_results,
    translate_to_federation_query,
)
from .federation import (
    CallbackAdapter,
    FederationRouter,
    LocalStoreAdapter,
    RegistryAdapter,
    StaticAdapter,
)
from .pricing import (
    AuctionResult,
    Bid,
    PostedPriceResult,
    Quote,
    RFQSession,
    english_auction,
    estimate_cost,
    posted_price,
    vickrey_auction,
)

__all__ = [
    # Constants
    "AUCTION_FORMATS",
    "CAPABILITY_DOMAINS",
    "DEFAULT_TRUST_BASELINE",
    "DEFAULT_TRUST_WEIGHTS",
    "DEFAULT_WEIGHTS",
    "LIFECYCLE_STATUSES",
    "MATCHING_MODES",
    "PRICING_MECHANISMS",
    "PROTOCOL_VERSION",
    "SCHEMA_VERSION",
    "TRUST_TIERS",
    "TRUST_TIER_WEIGHTS",
    # Schema — UCP
    "Availability",
    "Capability",
    "Capacity",
    "ComplexityRange",
    "Cost",
    "CostRate",
    "DisputeProfile",
    "FreeTier",
    "Identity",
    "Performance",
    "QualityMetrics",
    "RegistryListing",
    "ReliabilityMetrics",
    "SpeedMetrics",
    "TaxonomyCodes",
    "UnifiedCapabilityProfile",
    "UCP",
    # Schema — Match
    "FederationConfig",
    "FederationQuery",
    "FederationResult",
    "MatchConstraints",
    "MatchMetadata",
    "MatchRequest",
    "MatchResponse",
    "MatchResult",
    "TaskDescription",
    "TrustVerification",
    # Store
    "MatchmakingStore",
    # UCP Builder
    "UCPBuilder",
    "UCPValidationError",
    "from_a2a_agent_card",
    "from_mcp_manifest",
    "from_openclaw_skill",
    "validate_ucp",
    # Ranking
    "baseline_trust_score",
    "compute_trust_score",
    "confidence_factor",
    "identity_confidence",
    "performance_quality",
    "reliability_score",
    "risk_score",
    "trust_score_from_ucp",
    "trust_tier_weight",
    # Matching
    "capability_match_score",
    "compatibility_score",
    "cost_alignment_score",
    "availability_score",
    "domain_relevance_score",
    "passes_constraints",
    "ranked_search",
    "stable_matching",
    "style_compatibility_score",
    # Discovery
    "deduplicate",
    "discover",
    "normalize_results",
    "translate_to_federation_query",
    # Federation
    "CallbackAdapter",
    "FederationRouter",
    "LocalStoreAdapter",
    "RegistryAdapter",
    "StaticAdapter",
    # Pricing
    "AuctionResult",
    "Bid",
    "PostedPriceResult",
    "Quote",
    "RFQSession",
    "english_auction",
    "estimate_cost",
    "posted_price",
    "vickrey_auction",
]

__version__ = "0.1.0"
