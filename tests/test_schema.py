"""Tests for schema data structures and serialization."""

import json
from agent_matchmaking.schema import (
    CAPABILITY_DOMAINS,
    DEFAULT_WEIGHTS,
    PROTOCOL_VERSION,
    TRUST_TIERS,
    Availability,
    Capability,
    Cost,
    CostRate,
    Identity,
    MatchConstraints,
    MatchRequest,
    MatchResponse,
    MatchResult,
    Performance,
    QualityMetrics,
    RegistryListing,
    ReliabilityMetrics,
    TaskDescription,
    TrustVerification,
    UnifiedCapabilityProfile,
)


def test_constants():
    assert len(CAPABILITY_DOMAINS) == 8
    assert "research" in CAPABILITY_DOMAINS
    assert len(TRUST_TIERS) == 4
    assert sum(DEFAULT_WEIGHTS.values()) == 1.0


def test_identity_roundtrip():
    ident = Identity(
        amp_id="amp:agent:test123",
        a2a_card="https://example.com/.well-known/agent.json",
        coc_chain_id="coc:chain:sha256:abc",
        did="did:web:example.com",
        registries=[RegistryListing("google_cloud", "gc-123")],
    )
    d = ident.to_dict()
    restored = Identity.from_dict(d)
    assert restored.amp_id == "amp:agent:test123"
    assert restored.a2a_card == "https://example.com/.well-known/agent.json"
    assert len(restored.registries) == 1
    assert restored.registries[0].registry_type == "google_cloud"


def test_capability_roundtrip():
    cap = Capability(
        domain="security",
        subdomain="code_review",
        description="Python security code review",
        input_modalities=["text", "code_repository"],
        output_modalities=["structured_data", "report"],
        tools_used=["sast_scanner", "linter"],
    )
    d = cap.to_dict()
    restored = Capability.from_dict(d)
    assert restored.domain == "security"
    assert restored.subdomain == "code_review"
    assert "sast_scanner" in restored.tools_used


def test_ucp_roundtrip():
    ucp = UnifiedCapabilityProfile(
        identity=Identity(amp_id="amp:agent:test-roundtrip"),
        capabilities=[
            Capability(domain="research", subdomain="competitive_analysis",
                       description="Competitive research agent"),
        ],
        performance=Performance(
            quality=QualityMetrics(arp_composite_score=85.0),
            reliability=ReliabilityMetrics(asa_completion_rate=0.95, asa_sample_size=100),
        ),
        cost=Cost(base_rate=CostRate(amount=0.05, currency="USD", per="request")),
        trust_tier="measured",
    )
    d = ucp.to_dict()
    assert d["protocol_version"] == PROTOCOL_VERSION

    # Full JSON roundtrip
    json_str = json.dumps(d)
    restored = UnifiedCapabilityProfile.from_dict(json.loads(json_str))
    assert restored.identity.amp_id == "amp:agent:test-roundtrip"
    assert restored.trust_tier == "measured"
    assert restored.performance.quality.arp_composite_score == 85.0
    assert restored.primary_domain() == "research"


def test_match_request_roundtrip():
    req = MatchRequest(
        requester_id="amp:agent:requester-1",
        task=TaskDescription(
            description="Code review for Python microservice",
            domain="security",
            subdomain="code_review",
            budget_max=50.0,
            deadline_ms=3600000,
        ),
        constraints=MatchConstraints(min_trust_score=60, max_results=5),
    )
    d = req.to_dict()
    restored = MatchRequest.from_dict(d)
    assert restored.requester_id == "amp:agent:requester-1"
    assert restored.task.domain == "security"
    assert restored.task.budget_max == 50.0
    assert restored.constraints.min_trust_score == 60


def test_match_response_roundtrip():
    resp = MatchResponse(
        request_id="mr-test-001",
        results=[
            MatchResult(
                rank=1,
                agent_id="amp:agent:best",
                compatibility_score=89.3,
                dimensional_scores={"capability_match": 95.0, "trust_score": 88.0},
                trust_verification=TrustVerification(coc_chain_verified=True, coc_chain_length_days=127),
            ),
        ],
    )
    d = resp.to_dict()
    json_str = json.dumps(d)
    restored = MatchResponse.from_dict(json.loads(json_str))
    assert len(restored.results) == 1
    assert restored.results[0].agent_id == "amp:agent:best"
    assert restored.results[0].trust_verification.coc_chain_verified


def test_ucp_hash_deterministic():
    ucp = UnifiedCapabilityProfile(
        identity=Identity(amp_id="amp:agent:hash-test"),
        capabilities=[Capability(domain="research", description="test")],
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-01T00:00:00Z",
    )
    h1 = ucp.hash()
    h2 = ucp.hash()
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex
