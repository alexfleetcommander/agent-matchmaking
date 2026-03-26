"""Core data structures, constants, and JSON schemas for the Agent Matchmaking Protocol.

All data classes use plain dicts and dataclass-like patterns with zero
external dependencies.  Serialization is via to_dict/from_dict.
"""

import hashlib
import json
import math
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Protocol constants
# ---------------------------------------------------------------------------

PROTOCOL_VERSION = "1.0.0"
SCHEMA_VERSION = "1.0.0"

# Level-1 capability domains (Section 5.4)
CAPABILITY_DOMAINS = (
    "research",
    "development",
    "analysis",
    "communication",
    "operations",
    "creative",
    "security",
    "domain_specific",
)

# Trust tiers (Section 9.2)
TRUST_TIERS = ("declared", "attested", "measured", "verified")
TRUST_TIER_WEIGHTS = {
    "declared": 0.25,
    "attested": 0.50,
    "measured": 0.75,
    "verified": 1.00,
}

# Matching modes (Section 6.3)
MATCHING_MODES = ("ranked_search", "stable_matching", "auction")

# Pricing mechanisms (Section 8.2)
PRICING_MECHANISMS = ("posted_price", "rfq", "auction")

# Auction formats
AUCTION_FORMATS = ("english", "vickrey", "combinatorial")

# Lifecycle statuses for availability filtering
LIFECYCLE_STATUSES = (
    "operational",
    "provisioned",
    "migrating",
    "retraining",
    "suspended",
    "deprecated",
    "decommissioned",
)

ACTIVE_STATUSES = ("operational",)
INACTIVE_STATUSES = ("deprecated", "decommissioned")

# Default matching weights (Section 6.2)
DEFAULT_WEIGHTS = {
    "capability_match": 0.30,
    "trust_score": 0.25,
    "cost_alignment": 0.15,
    "availability": 0.10,
    "style_compatibility": 0.05,
    "domain_relevance": 0.15,
}

# Default trust composition weights (Section 9.3)
DEFAULT_TRUST_WEIGHTS = {
    "identity": 0.20,
    "performance": 0.40,
    "reliability": 0.25,
    "risk": 0.15,
}

# New-agent baseline trust (Section 9.4)
DEFAULT_TRUST_BASELINE = 40
TRUST_BASELINE_ADJUSTMENTS = {
    "corporate_marketplace_validation": 15,
    "community_reviews_10plus": 10,
    "a2a_card_verified_domain": 5,
    "did_verifiable_controller": 5,
}


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _gen_id(prefix: str = "amp") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _hash_dict(d: Dict[str, Any]) -> str:
    raw = json.dumps(d, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Data classes — Identity Section (Section 5.2.1)
# ---------------------------------------------------------------------------

class RegistryListing:
    """A registry where the agent is listed."""

    __slots__ = ("registry_type", "listing_id")

    def __init__(self, registry_type: str = "", listing_id: str = "") -> None:
        self.registry_type = registry_type
        self.listing_id = listing_id

    def to_dict(self) -> Dict[str, Any]:
        return {"type": self.registry_type, "listing_id": self.listing_id}

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "RegistryListing":
        return cls(registry_type=d.get("type", ""), listing_id=d.get("listing_id", ""))


class Identity:
    """UCP Identity Section (Section 5.2.1)."""

    __slots__ = ("amp_id", "a2a_card", "coc_chain_id", "did", "registries")

    def __init__(
        self,
        amp_id: str = "",
        a2a_card: str = "",
        coc_chain_id: str = "",
        did: str = "",
        registries: Optional[List[RegistryListing]] = None,
    ) -> None:
        self.amp_id = amp_id or _gen_id("amp:agent")
        self.a2a_card = a2a_card
        self.coc_chain_id = coc_chain_id
        self.did = did
        self.registries = registries or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "amp_id": self.amp_id,
            "a2a_card": self.a2a_card,
            "coc_chain_id": self.coc_chain_id,
            "did": self.did,
            "registries": [r.to_dict() for r in self.registries],
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Identity":
        return cls(
            amp_id=d.get("amp_id", ""),
            a2a_card=d.get("a2a_card", ""),
            coc_chain_id=d.get("coc_chain_id", ""),
            did=d.get("did", ""),
            registries=[RegistryListing.from_dict(r) for r in d.get("registries", [])],
        )


# ---------------------------------------------------------------------------
# Data classes — Capability Section (Section 5.2.2)
# ---------------------------------------------------------------------------

class TaxonomyCodes:
    __slots__ = ("onet_soc", "amp_capability")

    def __init__(self, onet_soc: str = "", amp_capability: str = "") -> None:
        self.onet_soc = onet_soc
        self.amp_capability = amp_capability

    def to_dict(self) -> Dict[str, Any]:
        return {"onet_soc": self.onet_soc, "amp_capability": self.amp_capability}

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TaxonomyCodes":
        return cls(onet_soc=d.get("onet_soc", ""), amp_capability=d.get("amp_capability", ""))


class ComplexityRange:
    __slots__ = ("min_desc", "max_desc")

    def __init__(self, min_desc: str = "", max_desc: str = "") -> None:
        self.min_desc = min_desc
        self.max_desc = max_desc

    def to_dict(self) -> Dict[str, Any]:
        return {"min": self.min_desc, "max": self.max_desc}

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ComplexityRange":
        return cls(min_desc=d.get("min", ""), max_desc=d.get("max", ""))


class Capability:
    """A single capability entry in the UCP (Section 5.2.2)."""

    __slots__ = (
        "domain", "subdomain", "description",
        "input_modalities", "output_modalities",
        "tools_used", "complexity_range", "taxonomy_codes",
    )

    def __init__(
        self,
        domain: str = "",
        subdomain: str = "",
        description: str = "",
        input_modalities: Optional[List[str]] = None,
        output_modalities: Optional[List[str]] = None,
        tools_used: Optional[List[str]] = None,
        complexity_range: Optional[ComplexityRange] = None,
        taxonomy_codes: Optional[TaxonomyCodes] = None,
    ) -> None:
        self.domain = domain
        self.subdomain = subdomain
        self.description = description
        self.input_modalities = input_modalities or []
        self.output_modalities = output_modalities or []
        self.tools_used = tools_used or []
        self.complexity_range = complexity_range or ComplexityRange()
        self.taxonomy_codes = taxonomy_codes or TaxonomyCodes()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain,
            "subdomain": self.subdomain,
            "description": self.description,
            "input_modalities": self.input_modalities,
            "output_modalities": self.output_modalities,
            "tools_used": self.tools_used,
            "complexity_range": self.complexity_range.to_dict(),
            "taxonomy_codes": self.taxonomy_codes.to_dict(),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Capability":
        return cls(
            domain=d.get("domain", ""),
            subdomain=d.get("subdomain", ""),
            description=d.get("description", ""),
            input_modalities=d.get("input_modalities", []),
            output_modalities=d.get("output_modalities", []),
            tools_used=d.get("tools_used", []),
            complexity_range=ComplexityRange.from_dict(d.get("complexity_range", {})),
            taxonomy_codes=TaxonomyCodes.from_dict(d.get("taxonomy_codes", {})),
        )


# ---------------------------------------------------------------------------
# Data classes — Performance Section (Section 5.2.3)
# ---------------------------------------------------------------------------

class ReliabilityMetrics:
    __slots__ = ("asa_completion_rate", "asa_sample_size", "uptime_30d")

    def __init__(
        self,
        asa_completion_rate: float = 0.0,
        asa_sample_size: int = 0,
        uptime_30d: float = 0.0,
    ) -> None:
        self.asa_completion_rate = asa_completion_rate
        self.asa_sample_size = asa_sample_size
        self.uptime_30d = uptime_30d

    def to_dict(self) -> Dict[str, Any]:
        return {
            "asa_completion_rate": self.asa_completion_rate,
            "asa_sample_size": self.asa_sample_size,
            "uptime_30d": self.uptime_30d,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "ReliabilityMetrics":
        return cls(
            asa_completion_rate=d.get("asa_completion_rate", 0.0),
            asa_sample_size=d.get("asa_sample_size", 0),
            uptime_30d=d.get("uptime_30d", 0.0),
        )


class QualityMetrics:
    __slots__ = (
        "arp_composite_score", "arp_dimensional_scores",
        "qv_pass_rate", "qv_sample_size",
    )

    def __init__(
        self,
        arp_composite_score: float = 0.0,
        arp_dimensional_scores: Optional[Dict[str, float]] = None,
        qv_pass_rate: float = 0.0,
        qv_sample_size: int = 0,
    ) -> None:
        self.arp_composite_score = arp_composite_score
        self.arp_dimensional_scores = arp_dimensional_scores or {}
        self.qv_pass_rate = qv_pass_rate
        self.qv_sample_size = qv_sample_size

    def to_dict(self) -> Dict[str, Any]:
        return {
            "arp_composite_score": self.arp_composite_score,
            "arp_dimensional_scores": dict(self.arp_dimensional_scores),
            "qv_pass_rate": self.qv_pass_rate,
            "qv_sample_size": self.qv_sample_size,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "QualityMetrics":
        return cls(
            arp_composite_score=d.get("arp_composite_score", 0.0),
            arp_dimensional_scores=d.get("arp_dimensional_scores", {}),
            qv_pass_rate=d.get("qv_pass_rate", 0.0),
            qv_sample_size=d.get("qv_sample_size", 0),
        )


class SpeedMetrics:
    __slots__ = ("median_response_time_ms", "p95_response_time_ms", "throughput_tasks_per_hour")

    def __init__(
        self,
        median_response_time_ms: int = 0,
        p95_response_time_ms: int = 0,
        throughput_tasks_per_hour: int = 0,
    ) -> None:
        self.median_response_time_ms = median_response_time_ms
        self.p95_response_time_ms = p95_response_time_ms
        self.throughput_tasks_per_hour = throughput_tasks_per_hour

    def to_dict(self) -> Dict[str, Any]:
        return {
            "median_response_time_ms": self.median_response_time_ms,
            "p95_response_time_ms": self.p95_response_time_ms,
            "throughput_tasks_per_hour": self.throughput_tasks_per_hour,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "SpeedMetrics":
        return cls(
            median_response_time_ms=d.get("median_response_time_ms", 0),
            p95_response_time_ms=d.get("p95_response_time_ms", 0),
            throughput_tasks_per_hour=d.get("throughput_tasks_per_hour", 0),
        )


class DisputeProfile:
    __slots__ = ("ajp_dispute_rate", "ajp_favorable_resolution_rate", "ajp_sample_size")

    def __init__(
        self,
        ajp_dispute_rate: float = 0.0,
        ajp_favorable_resolution_rate: float = 0.0,
        ajp_sample_size: int = 0,
    ) -> None:
        self.ajp_dispute_rate = ajp_dispute_rate
        self.ajp_favorable_resolution_rate = ajp_favorable_resolution_rate
        self.ajp_sample_size = ajp_sample_size

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ajp_dispute_rate": self.ajp_dispute_rate,
            "ajp_favorable_resolution_rate": self.ajp_favorable_resolution_rate,
            "ajp_sample_size": self.ajp_sample_size,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "DisputeProfile":
        return cls(
            ajp_dispute_rate=d.get("ajp_dispute_rate", 0.0),
            ajp_favorable_resolution_rate=d.get("ajp_favorable_resolution_rate", 0.0),
            ajp_sample_size=d.get("ajp_sample_size", 0),
        )


class Performance:
    """UCP Performance Section (Section 5.2.3)."""

    __slots__ = ("reliability", "quality", "speed", "dispute_profile")

    def __init__(
        self,
        reliability: Optional[ReliabilityMetrics] = None,
        quality: Optional[QualityMetrics] = None,
        speed: Optional[SpeedMetrics] = None,
        dispute_profile: Optional[DisputeProfile] = None,
    ) -> None:
        self.reliability = reliability or ReliabilityMetrics()
        self.quality = quality or QualityMetrics()
        self.speed = speed or SpeedMetrics()
        self.dispute_profile = dispute_profile or DisputeProfile()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reliability": self.reliability.to_dict(),
            "quality": self.quality.to_dict(),
            "speed": self.speed.to_dict(),
            "dispute_profile": self.dispute_profile.to_dict(),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Performance":
        return cls(
            reliability=ReliabilityMetrics.from_dict(d.get("reliability", {})),
            quality=QualityMetrics.from_dict(d.get("quality", {})),
            speed=SpeedMetrics.from_dict(d.get("speed", {})),
            dispute_profile=DisputeProfile.from_dict(d.get("dispute_profile", {})),
        )


# ---------------------------------------------------------------------------
# Data classes — Cost Section (Section 5.2.4)
# ---------------------------------------------------------------------------

class CostRate:
    __slots__ = ("amount", "currency", "per")

    def __init__(self, amount: float = 0.0, currency: str = "USD", per: str = "request") -> None:
        self.amount = amount
        self.currency = currency
        self.per = per

    def to_dict(self) -> Dict[str, Any]:
        return {"amount": self.amount, "currency": self.currency, "per": self.per}

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "CostRate":
        return cls(amount=d.get("amount", 0.0), currency=d.get("currency", "USD"), per=d.get("per", "request"))


class FreeTier:
    __slots__ = ("requests_per_month",)

    def __init__(self, requests_per_month: int = 0) -> None:
        self.requests_per_month = requests_per_month

    def to_dict(self) -> Dict[str, Any]:
        return {"requests_per_month": self.requests_per_month}

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "FreeTier":
        return cls(requests_per_month=d.get("requests_per_month", 0))


class Cost:
    """UCP Cost Section (Section 5.2.4)."""

    __slots__ = (
        "pricing_model", "base_rate", "variable_rate",
        "supports_negotiation", "supports_auction",
        "payment_rails", "free_tier",
    )

    def __init__(
        self,
        pricing_model: str = "posted_price",
        base_rate: Optional[CostRate] = None,
        variable_rate: Optional[CostRate] = None,
        supports_negotiation: bool = False,
        supports_auction: bool = False,
        payment_rails: Optional[List[str]] = None,
        free_tier: Optional[FreeTier] = None,
    ) -> None:
        self.pricing_model = pricing_model
        self.base_rate = base_rate or CostRate()
        self.variable_rate = variable_rate or CostRate(amount=0.0, per="output_token")
        self.supports_negotiation = supports_negotiation
        self.supports_auction = supports_auction
        self.payment_rails = payment_rails or []
        self.free_tier = free_tier

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "pricing_model": self.pricing_model,
            "base_rate": self.base_rate.to_dict(),
            "variable_rate": self.variable_rate.to_dict(),
            "supports_negotiation": self.supports_negotiation,
            "supports_auction": self.supports_auction,
            "payment_rails": self.payment_rails,
        }
        if self.free_tier:
            d["free_tier"] = self.free_tier.to_dict()
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Cost":
        ft = d.get("free_tier")
        return cls(
            pricing_model=d.get("pricing_model", "posted_price"),
            base_rate=CostRate.from_dict(d.get("base_rate", {})),
            variable_rate=CostRate.from_dict(d.get("variable_rate", {})),
            supports_negotiation=d.get("supports_negotiation", False),
            supports_auction=d.get("supports_auction", False),
            payment_rails=d.get("payment_rails", []),
            free_tier=FreeTier.from_dict(ft) if ft else None,
        )


# ---------------------------------------------------------------------------
# Data classes — Availability Section (Section 5.2.5)
# ---------------------------------------------------------------------------

class Capacity:
    __slots__ = ("current_load_pct", "max_concurrent_tasks", "estimated_queue_time_ms")

    def __init__(
        self,
        current_load_pct: int = 0,
        max_concurrent_tasks: int = 1,
        estimated_queue_time_ms: int = 0,
    ) -> None:
        self.current_load_pct = current_load_pct
        self.max_concurrent_tasks = max_concurrent_tasks
        self.estimated_queue_time_ms = estimated_queue_time_ms

    def to_dict(self) -> Dict[str, Any]:
        return {
            "current_load_pct": self.current_load_pct,
            "max_concurrent_tasks": self.max_concurrent_tasks,
            "estimated_queue_time_ms": self.estimated_queue_time_ms,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Capacity":
        return cls(
            current_load_pct=d.get("current_load_pct", 0),
            max_concurrent_tasks=d.get("max_concurrent_tasks", 1),
            estimated_queue_time_ms=d.get("estimated_queue_time_ms", 0),
        )


class Availability:
    """UCP Availability Section (Section 5.2.5)."""

    __slots__ = ("status", "alp_lifecycle_stage", "capacity")

    def __init__(
        self,
        status: str = "active",
        alp_lifecycle_stage: str = "operational",
        capacity: Optional[Capacity] = None,
    ) -> None:
        self.status = status
        self.alp_lifecycle_stage = alp_lifecycle_stage
        self.capacity = capacity or Capacity()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "alp_lifecycle_stage": self.alp_lifecycle_stage,
            "capacity": self.capacity.to_dict(),
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Availability":
        return cls(
            status=d.get("status", "active"),
            alp_lifecycle_stage=d.get("alp_lifecycle_stage", "operational"),
            capacity=Capacity.from_dict(d.get("capacity", {})),
        )


# ---------------------------------------------------------------------------
# Unified Capability Profile (Section 5.2)
# ---------------------------------------------------------------------------

class UnifiedCapabilityProfile:
    """Complete UCP — the canonical agent description format for AMP."""

    __slots__ = (
        "identity", "capabilities", "performance",
        "cost", "availability", "extensions",
        "trust_tier", "created_at", "updated_at",
    )

    def __init__(
        self,
        identity: Optional[Identity] = None,
        capabilities: Optional[List[Capability]] = None,
        performance: Optional[Performance] = None,
        cost: Optional[Cost] = None,
        availability: Optional[Availability] = None,
        extensions: Optional[Dict[str, Any]] = None,
        trust_tier: str = "declared",
        created_at: str = "",
        updated_at: str = "",
    ) -> None:
        self.identity = identity or Identity()
        self.capabilities = capabilities or []
        self.performance = performance or Performance()
        self.cost = cost or Cost()
        self.availability = availability or Availability()
        self.extensions = extensions or {}
        self.trust_tier = trust_tier
        now = _now_iso()
        self.created_at = created_at or now
        self.updated_at = updated_at or now

    @property
    def amp_id(self) -> str:
        return self.identity.amp_id

    def primary_domain(self) -> str:
        if self.capabilities:
            return self.capabilities[0].domain
        return ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "schema_version": SCHEMA_VERSION,
            "protocol_version": PROTOCOL_VERSION,
            "identity": self.identity.to_dict(),
            "capabilities": [c.to_dict() for c in self.capabilities],
            "performance": self.performance.to_dict(),
            "cost": self.cost.to_dict(),
            "availability": self.availability.to_dict(),
            "extensions": self.extensions,
            "trust_tier": self.trust_tier,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "UnifiedCapabilityProfile":
        return cls(
            identity=Identity.from_dict(d.get("identity", {})),
            capabilities=[Capability.from_dict(c) for c in d.get("capabilities", [])],
            performance=Performance.from_dict(d.get("performance", {})),
            cost=Cost.from_dict(d.get("cost", {})),
            availability=Availability.from_dict(d.get("availability", {})),
            extensions=d.get("extensions", {}),
            trust_tier=d.get("trust_tier", "declared"),
            created_at=d.get("created_at", ""),
            updated_at=d.get("updated_at", ""),
        )

    def hash(self) -> str:
        return _hash_dict(self.to_dict())


# Convenience alias
UCP = UnifiedCapabilityProfile


# ---------------------------------------------------------------------------
# Match Request (Section 6.1)
# ---------------------------------------------------------------------------

class TaskDescription:
    __slots__ = (
        "description", "domain", "subdomain",
        "input_spec", "output_spec",
        "deadline_ms", "budget_max", "budget_currency",
    )

    def __init__(
        self,
        description: str = "",
        domain: str = "",
        subdomain: str = "",
        input_spec: Optional[Dict[str, Any]] = None,
        output_spec: Optional[Dict[str, Any]] = None,
        deadline_ms: int = 0,
        budget_max: float = 0.0,
        budget_currency: str = "USD",
    ) -> None:
        self.description = description
        self.domain = domain
        self.subdomain = subdomain
        self.input_spec = input_spec or {}
        self.output_spec = output_spec or {}
        self.deadline_ms = deadline_ms
        self.budget_max = budget_max
        self.budget_currency = budget_currency

    def to_dict(self) -> Dict[str, Any]:
        return {
            "description": self.description,
            "domain": self.domain,
            "subdomain": self.subdomain,
            "input": self.input_spec,
            "output": self.output_spec,
            "deadline_ms": self.deadline_ms,
            "budget": {"max_amount": self.budget_max, "currency": self.budget_currency},
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TaskDescription":
        budget = d.get("budget", {})
        return cls(
            description=d.get("description", ""),
            domain=d.get("domain", ""),
            subdomain=d.get("subdomain", ""),
            input_spec=d.get("input", {}),
            output_spec=d.get("output", {}),
            deadline_ms=d.get("deadline_ms", 0),
            budget_max=budget.get("max_amount", 0.0),
            budget_currency=budget.get("currency", "USD"),
        )


class MatchConstraints:
    __slots__ = (
        "min_trust_score", "max_dispute_rate",
        "required_lifecycle_status", "excluded_agents",
        "required_registries", "max_results",
    )

    def __init__(
        self,
        min_trust_score: float = 0.0,
        max_dispute_rate: float = 1.0,
        required_lifecycle_status: Optional[List[str]] = None,
        excluded_agents: Optional[List[str]] = None,
        required_registries: Optional[List[str]] = None,
        max_results: int = 10,
    ) -> None:
        self.min_trust_score = min_trust_score
        self.max_dispute_rate = max_dispute_rate
        self.required_lifecycle_status = required_lifecycle_status or ["operational"]
        self.excluded_agents = excluded_agents or []
        self.required_registries = required_registries or []
        self.max_results = max_results

    def to_dict(self) -> Dict[str, Any]:
        return {
            "min_trust_score": self.min_trust_score,
            "max_dispute_rate": self.max_dispute_rate,
            "required_lifecycle_status": self.required_lifecycle_status,
            "excluded_agents": self.excluded_agents,
            "required_registries": self.required_registries,
            "max_results": self.max_results,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "MatchConstraints":
        return cls(
            min_trust_score=d.get("min_trust_score", 0.0),
            max_dispute_rate=d.get("max_dispute_rate", 1.0),
            required_lifecycle_status=d.get("required_lifecycle_status", ["operational"]),
            excluded_agents=d.get("excluded_agents", []),
            required_registries=d.get("required_registries", []),
            max_results=d.get("max_results", 10),
        )


class FederationConfig:
    __slots__ = ("registries", "timeout_ms")

    def __init__(
        self,
        registries: Optional[List[str]] = None,
        timeout_ms: int = 5000,
    ) -> None:
        self.registries = registries or ["all"]
        self.timeout_ms = timeout_ms

    def to_dict(self) -> Dict[str, Any]:
        return {"registries": self.registries, "timeout_ms": self.timeout_ms}

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "FederationConfig":
        return cls(registries=d.get("registries", ["all"]), timeout_ms=d.get("timeout_ms", 5000))


class MatchRequest:
    """AMP Match Request (Section 6.1)."""

    __slots__ = (
        "request_id", "requester_id", "task", "weights",
        "constraints", "federation", "matching_mode",
        "price_discovery", "timestamp",
    )

    def __init__(
        self,
        requester_id: str = "",
        task: Optional[TaskDescription] = None,
        weights: Optional[Dict[str, float]] = None,
        constraints: Optional[MatchConstraints] = None,
        federation: Optional[FederationConfig] = None,
        matching_mode: str = "ranked_search",
        price_discovery: str = "posted_price",
        request_id: str = "",
        timestamp: str = "",
    ) -> None:
        self.request_id = request_id or _gen_id("mr")
        self.requester_id = requester_id
        self.task = task or TaskDescription()
        self.weights = weights or dict(DEFAULT_WEIGHTS)
        self.constraints = constraints or MatchConstraints()
        self.federation = federation or FederationConfig()
        self.matching_mode = matching_mode
        self.price_discovery = price_discovery
        self.timestamp = timestamp or _now_iso()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "match_request": {
                "request_id": self.request_id,
                "requester_id": self.requester_id,
                "task": self.task.to_dict(),
                "weights": self.weights,
                "constraints": self.constraints.to_dict(),
                "federation": self.federation.to_dict(),
                "matching_mode": self.matching_mode,
                "price_discovery": self.price_discovery,
                "timestamp": self.timestamp,
            }
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "MatchRequest":
        mr = d.get("match_request", d)
        return cls(
            request_id=mr.get("request_id", ""),
            requester_id=mr.get("requester_id", ""),
            task=TaskDescription.from_dict(mr.get("task", {})),
            weights=mr.get("weights", dict(DEFAULT_WEIGHTS)),
            constraints=MatchConstraints.from_dict(mr.get("constraints", {})),
            federation=FederationConfig.from_dict(mr.get("federation", {})),
            matching_mode=mr.get("matching_mode", "ranked_search"),
            price_discovery=mr.get("price_discovery", "posted_price"),
            timestamp=mr.get("timestamp", ""),
        )


# ---------------------------------------------------------------------------
# Match Response (Section 6.4)
# ---------------------------------------------------------------------------

class TrustVerification:
    __slots__ = (
        "coc_chain_verified", "coc_chain_length_days",
        "arp_score_verified", "asa_history_verified",
        "ajp_record_verified", "verification_timestamp",
    )

    def __init__(
        self,
        coc_chain_verified: bool = False,
        coc_chain_length_days: int = 0,
        arp_score_verified: bool = False,
        asa_history_verified: bool = False,
        ajp_record_verified: bool = False,
        verification_timestamp: str = "",
    ) -> None:
        self.coc_chain_verified = coc_chain_verified
        self.coc_chain_length_days = coc_chain_length_days
        self.arp_score_verified = arp_score_verified
        self.asa_history_verified = asa_history_verified
        self.ajp_record_verified = ajp_record_verified
        self.verification_timestamp = verification_timestamp or _now_iso()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "coc_chain_verified": self.coc_chain_verified,
            "coc_chain_length_days": self.coc_chain_length_days,
            "arp_score_verified": self.arp_score_verified,
            "asa_history_verified": self.asa_history_verified,
            "ajp_record_verified": self.ajp_record_verified,
            "verification_timestamp": self.verification_timestamp,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "TrustVerification":
        return cls(**{k: d.get(k, v) for k, v in {
            "coc_chain_verified": False,
            "coc_chain_length_days": 0,
            "arp_score_verified": False,
            "asa_history_verified": False,
            "ajp_record_verified": False,
            "verification_timestamp": "",
        }.items()})


class MatchResult:
    """A single agent result within a MatchResponse."""

    __slots__ = (
        "rank", "agent_id", "compatibility_score",
        "dimensional_scores", "ucp_summary",
        "trust_verification", "registries_found_on",
    )

    def __init__(
        self,
        rank: int = 0,
        agent_id: str = "",
        compatibility_score: float = 0.0,
        dimensional_scores: Optional[Dict[str, float]] = None,
        ucp_summary: Optional[Dict[str, Any]] = None,
        trust_verification: Optional[TrustVerification] = None,
        registries_found_on: Optional[List[str]] = None,
    ) -> None:
        self.rank = rank
        self.agent_id = agent_id
        self.compatibility_score = compatibility_score
        self.dimensional_scores = dimensional_scores or {}
        self.ucp_summary = ucp_summary or {}
        self.trust_verification = trust_verification or TrustVerification()
        self.registries_found_on = registries_found_on or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rank": self.rank,
            "agent_id": self.agent_id,
            "compatibility_score": round(self.compatibility_score, 2),
            "dimensional_scores": {k: round(v, 2) for k, v in self.dimensional_scores.items()},
            "ucp_summary": self.ucp_summary,
            "trust_verification": self.trust_verification.to_dict(),
            "registries_found_on": self.registries_found_on,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "MatchResult":
        return cls(
            rank=d.get("rank", 0),
            agent_id=d.get("agent_id", ""),
            compatibility_score=d.get("compatibility_score", 0.0),
            dimensional_scores=d.get("dimensional_scores", {}),
            ucp_summary=d.get("ucp_summary", {}),
            trust_verification=TrustVerification.from_dict(d.get("trust_verification", {})),
            registries_found_on=d.get("registries_found_on", []),
        )


class MatchMetadata:
    __slots__ = (
        "registries_queried", "registries_responded",
        "total_candidates_evaluated", "candidates_filtered_by_constraints",
        "candidates_scored", "query_time_ms",
    )

    def __init__(
        self,
        registries_queried: int = 0,
        registries_responded: int = 0,
        total_candidates_evaluated: int = 0,
        candidates_filtered_by_constraints: int = 0,
        candidates_scored: int = 0,
        query_time_ms: int = 0,
    ) -> None:
        self.registries_queried = registries_queried
        self.registries_responded = registries_responded
        self.total_candidates_evaluated = total_candidates_evaluated
        self.candidates_filtered_by_constraints = candidates_filtered_by_constraints
        self.candidates_scored = candidates_scored
        self.query_time_ms = query_time_ms

    def to_dict(self) -> Dict[str, Any]:
        return {
            "registries_queried": self.registries_queried,
            "registries_responded": self.registries_responded,
            "total_candidates_evaluated": self.total_candidates_evaluated,
            "candidates_filtered_by_constraints": self.candidates_filtered_by_constraints,
            "candidates_scored": self.candidates_scored,
            "query_time_ms": self.query_time_ms,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "MatchMetadata":
        return cls(**{k: d.get(k, 0) for k in cls.__slots__})


class MatchResponse:
    """AMP Match Response (Section 6.4)."""

    __slots__ = ("request_id", "timestamp", "results", "metadata")

    def __init__(
        self,
        request_id: str = "",
        results: Optional[List[MatchResult]] = None,
        metadata: Optional[MatchMetadata] = None,
        timestamp: str = "",
    ) -> None:
        self.request_id = request_id
        self.timestamp = timestamp or _now_iso()
        self.results = results or []
        self.metadata = metadata or MatchMetadata()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "match_response": {
                "request_id": self.request_id,
                "timestamp": self.timestamp,
                "results": [r.to_dict() for r in self.results],
                "metadata": self.metadata.to_dict(),
            }
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "MatchResponse":
        mr = d.get("match_response", d)
        return cls(
            request_id=mr.get("request_id", ""),
            timestamp=mr.get("timestamp", ""),
            results=[MatchResult.from_dict(r) for r in mr.get("results", [])],
            metadata=MatchMetadata.from_dict(mr.get("metadata", {})),
        )


# ---------------------------------------------------------------------------
# Federation Query / Response (Section 7.2)
# ---------------------------------------------------------------------------

class FederationQuery:
    """Query sent to a registry adapter."""

    __slots__ = ("query_text", "domain", "subdomain", "constraints", "max_results")

    def __init__(
        self,
        query_text: str = "",
        domain: str = "",
        subdomain: str = "",
        constraints: Optional[Dict[str, Any]] = None,
        max_results: int = 50,
    ) -> None:
        self.query_text = query_text
        self.domain = domain
        self.subdomain = subdomain
        self.constraints = constraints or {}
        self.max_results = max_results

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": {
                "text": self.query_text,
                "domain": self.domain,
                "subdomain": self.subdomain,
                "constraints": self.constraints,
                "max_results": self.max_results,
            }
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "FederationQuery":
        q = d.get("query", d)
        return cls(
            query_text=q.get("text", ""),
            domain=q.get("domain", ""),
            subdomain=q.get("subdomain", ""),
            constraints=q.get("constraints", {}),
            max_results=q.get("max_results", 50),
        )


class FederationResult:
    """Response from a single registry adapter."""

    __slots__ = ("registry_name", "ucps", "query_time_ms", "error")

    def __init__(
        self,
        registry_name: str = "",
        ucps: Optional[List[UnifiedCapabilityProfile]] = None,
        query_time_ms: int = 0,
        error: str = "",
    ) -> None:
        self.registry_name = registry_name
        self.ucps = ucps or []
        self.query_time_ms = query_time_ms
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "registry_name": self.registry_name,
            "ucps": [u.to_dict() for u in self.ucps],
            "query_time_ms": self.query_time_ms,
        }
        if self.error:
            d["error"] = self.error
        return d

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "FederationResult":
        return cls(
            registry_name=d.get("registry_name", ""),
            ucps=[UnifiedCapabilityProfile.from_dict(u) for u in d.get("ucps", [])],
            query_time_ms=d.get("query_time_ms", 0),
            error=d.get("error", ""),
        )
