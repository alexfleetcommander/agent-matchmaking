"""Unified Capability Profile — create, validate, and convert UCPs.

Handles interoperability with A2A Agent Cards, MCP tool manifests,
and OpenClaw SKILL.md specs (Section 5.3).
"""

from typing import Any, Dict, List, Optional

from .schema import (
    CAPABILITY_DOMAINS,
    Availability,
    Capability,
    Capacity,
    ComplexityRange,
    Cost,
    CostRate,
    Identity,
    Performance,
    QualityMetrics,
    RegistryListing,
    ReliabilityMetrics,
    SpeedMetrics,
    TaxonomyCodes,
    UnifiedCapabilityProfile,
    _gen_id,
    _now_iso,
)


class UCPBuilder:
    """Fluent builder for constructing UCPs."""

    def __init__(self) -> None:
        self._identity = Identity()
        self._capabilities: List[Capability] = []
        self._performance = Performance()
        self._cost = Cost()
        self._availability = Availability()
        self._extensions: Dict[str, Any] = {}
        self._trust_tier = "declared"

    def identity(
        self,
        amp_id: str = "",
        a2a_card: str = "",
        coc_chain_id: str = "",
        did: str = "",
    ) -> "UCPBuilder":
        self._identity = Identity(
            amp_id=amp_id, a2a_card=a2a_card,
            coc_chain_id=coc_chain_id, did=did,
        )
        return self

    def add_registry(self, registry_type: str, listing_id: str) -> "UCPBuilder":
        self._identity.registries.append(
            RegistryListing(registry_type=registry_type, listing_id=listing_id)
        )
        return self

    def add_capability(
        self,
        domain: str,
        subdomain: str = "",
        description: str = "",
        input_modalities: Optional[List[str]] = None,
        output_modalities: Optional[List[str]] = None,
        tools_used: Optional[List[str]] = None,
        amp_capability_code: str = "",
    ) -> "UCPBuilder":
        self._capabilities.append(Capability(
            domain=domain,
            subdomain=subdomain,
            description=description,
            input_modalities=input_modalities or [],
            output_modalities=output_modalities or [],
            tools_used=tools_used or [],
            taxonomy_codes=TaxonomyCodes(amp_capability=amp_capability_code),
        ))
        return self

    def performance(
        self,
        arp_composite: float = 0.0,
        asa_completion_rate: float = 0.0,
        asa_sample_size: int = 0,
        median_response_ms: int = 0,
        p95_response_ms: int = 0,
        throughput_per_hour: int = 0,
    ) -> "UCPBuilder":
        self._performance = Performance(
            reliability=ReliabilityMetrics(
                asa_completion_rate=asa_completion_rate,
                asa_sample_size=asa_sample_size,
            ),
            quality=QualityMetrics(arp_composite_score=arp_composite),
            speed=SpeedMetrics(
                median_response_time_ms=median_response_ms,
                p95_response_time_ms=p95_response_ms,
                throughput_tasks_per_hour=throughput_per_hour,
            ),
        )
        return self

    def cost(
        self,
        pricing_model: str = "posted_price",
        base_amount: float = 0.0,
        base_per: str = "request",
        currency: str = "USD",
        supports_negotiation: bool = False,
        supports_auction: bool = False,
        payment_rails: Optional[List[str]] = None,
    ) -> "UCPBuilder":
        self._cost = Cost(
            pricing_model=pricing_model,
            base_rate=CostRate(amount=base_amount, currency=currency, per=base_per),
            supports_negotiation=supports_negotiation,
            supports_auction=supports_auction,
            payment_rails=payment_rails or [],
        )
        return self

    def availability(
        self,
        status: str = "active",
        lifecycle_stage: str = "operational",
        current_load_pct: int = 0,
        max_concurrent: int = 1,
    ) -> "UCPBuilder":
        self._availability = Availability(
            status=status,
            alp_lifecycle_stage=lifecycle_stage,
            capacity=Capacity(
                current_load_pct=current_load_pct,
                max_concurrent_tasks=max_concurrent,
            ),
        )
        return self

    def trust_tier(self, tier: str) -> "UCPBuilder":
        self._trust_tier = tier
        return self

    def extension(self, key: str, value: Any) -> "UCPBuilder":
        self._extensions[key] = value
        return self

    def build(self) -> UnifiedCapabilityProfile:
        return UnifiedCapabilityProfile(
            identity=self._identity,
            capabilities=self._capabilities,
            performance=self._performance,
            cost=self._cost,
            availability=self._availability,
            extensions=self._extensions,
            trust_tier=self._trust_tier,
        )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

class UCPValidationError(Exception):
    pass


def validate_ucp(ucp: UnifiedCapabilityProfile) -> List[str]:
    """Validate a UCP. Returns list of warnings (empty = valid)."""
    warnings: List[str] = []

    if not ucp.identity.amp_id:
        warnings.append("identity.amp_id is required")
    if not ucp.capabilities:
        warnings.append("at least one capability is required")

    for i, cap in enumerate(ucp.capabilities):
        if not cap.domain:
            warnings.append(f"capabilities[{i}].domain is required")
        elif cap.domain not in CAPABILITY_DOMAINS:
            warnings.append(
                f"capabilities[{i}].domain '{cap.domain}' not in standard domains "
                f"({', '.join(CAPABILITY_DOMAINS)})"
            )
        if not cap.description:
            warnings.append(f"capabilities[{i}].description is recommended")

    if ucp.trust_tier not in ("declared", "attested", "measured", "verified"):
        warnings.append(f"trust_tier '{ucp.trust_tier}' is not a recognized tier")

    return warnings


# ---------------------------------------------------------------------------
# Converters — A2A Agent Card → UCP (Section 5.3)
# ---------------------------------------------------------------------------

def from_a2a_agent_card(card: Dict[str, Any]) -> UnifiedCapabilityProfile:
    """Convert an A2A Agent Card (JSON dict) to a UCP.

    A2A Agent Cards typically have: name, description, url, skills[],
    authentication, supportedProtocols.
    """
    identity = Identity(
        a2a_card=card.get("url", ""),
    )

    capabilities = []
    for skill in card.get("skills", []):
        capabilities.append(Capability(
            description=skill.get("description", skill.get("name", "")),
            domain=_infer_domain(skill.get("description", "")),
            subdomain=skill.get("name", ""),
            input_modalities=skill.get("inputModes", []),
            output_modalities=skill.get("outputModes", []),
        ))

    if not capabilities and card.get("description"):
        capabilities.append(Capability(
            description=card["description"],
            domain=_infer_domain(card["description"]),
        ))

    return UnifiedCapabilityProfile(
        identity=identity,
        capabilities=capabilities,
        trust_tier="attested",
        extensions={"source_format": "a2a_agent_card", "original_name": card.get("name", "")},
    )


def from_mcp_manifest(manifest: Dict[str, Any]) -> UnifiedCapabilityProfile:
    """Convert an MCP tool manifest to a UCP.

    MCP manifests list tools with name, description, inputSchema.
    """
    tools = manifest.get("tools", [])

    capabilities = []
    all_tools = []
    for tool in tools:
        all_tools.append(tool.get("name", ""))
        capabilities.append(Capability(
            description=tool.get("description", tool.get("name", "")),
            domain=_infer_domain(tool.get("description", "")),
            tools_used=[tool.get("name", "")],
        ))

    return UnifiedCapabilityProfile(
        identity=Identity(),
        capabilities=capabilities,
        trust_tier="declared",
        extensions={"source_format": "mcp_manifest", "tool_count": len(tools)},
    )


def from_openclaw_skill(skill_yaml: Dict[str, Any], description_md: str = "") -> UnifiedCapabilityProfile:
    """Convert an OpenClaw SKILL.md (parsed YAML frontmatter + body) to a UCP."""
    identity = Identity()
    identity.registries.append(
        RegistryListing(registry_type="clawhub", listing_id=skill_yaml.get("name", ""))
    )

    cap_desc = description_md or skill_yaml.get("description", "")
    capabilities = [Capability(
        description=cap_desc,
        domain=_infer_domain(cap_desc),
        tools_used=skill_yaml.get("required_binaries", []),
    )]

    return UnifiedCapabilityProfile(
        identity=identity,
        capabilities=capabilities,
        trust_tier="attested",
        extensions={"source_format": "openclaw_skill", "skill_name": skill_yaml.get("name", "")},
    )


# ---------------------------------------------------------------------------
# Domain inference helper
# ---------------------------------------------------------------------------

_DOMAIN_KEYWORDS = {
    "research": ["research", "search", "survey", "investigate", "literature", "competitive"],
    "development": ["code", "develop", "build", "program", "software", "api", "frontend", "backend", "deploy"],
    "analysis": ["analy", "data", "financial", "legal", "statistic", "insight", "evaluate"],
    "communication": ["translate", "summar", "write", "email", "chat", "communicat", "document"],
    "operations": ["monitor", "deploy", "automat", "orchestr", "pipeline", "backup", "infra"],
    "creative": ["design", "creat", "art", "image", "video", "music", "generat"],
    "security": ["secur", "audit", "vulnerab", "threat", "pentest", "compliance", "encrypt"],
    "domain_specific": [],
}


def _infer_domain(text: str) -> str:
    """Best-effort domain inference from description text."""
    text_lower = text.lower()
    scores = {}
    for domain, keywords in _DOMAIN_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[domain] = score
    if scores:
        return max(scores, key=scores.get)  # type: ignore[arg-type]
    return "domain_specific"
