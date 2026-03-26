"""Tests for UCP builder, validation, and converters."""

from agent_matchmaking.ucp import (
    UCPBuilder,
    from_a2a_agent_card,
    from_mcp_manifest,
    from_openclaw_skill,
    validate_ucp,
    _infer_domain,
)
from agent_matchmaking.schema import UnifiedCapabilityProfile, Capability, Identity


def test_builder_basic():
    ucp = (
        UCPBuilder()
        .identity(amp_id="amp:agent:builder-test", a2a_card="https://example.com/agent.json")
        .add_capability(
            domain="development",
            subdomain="backend",
            description="Python API development",
            tools_used=["flask", "fastapi"],
        )
        .performance(arp_composite=82.0, asa_completion_rate=0.95, asa_sample_size=50)
        .cost(base_amount=0.10, currency="USD")
        .availability(lifecycle_stage="operational", max_concurrent=5)
        .trust_tier("measured")
        .build()
    )

    assert ucp.identity.amp_id == "amp:agent:builder-test"
    assert ucp.identity.a2a_card == "https://example.com/agent.json"
    assert len(ucp.capabilities) == 1
    assert ucp.capabilities[0].domain == "development"
    assert "flask" in ucp.capabilities[0].tools_used
    assert ucp.performance.quality.arp_composite_score == 82.0
    assert ucp.cost.base_rate.amount == 0.10
    assert ucp.trust_tier == "measured"


def test_builder_multi_capability():
    ucp = (
        UCPBuilder()
        .add_capability(domain="research", description="Web research")
        .add_capability(domain="analysis", description="Data analysis")
        .add_capability(domain="communication", description="Report writing")
        .build()
    )
    assert len(ucp.capabilities) == 3
    assert ucp.primary_domain() == "research"


def test_validate_valid():
    ucp = UCPBuilder().add_capability(domain="research", description="test").build()
    warnings = validate_ucp(ucp)
    assert len(warnings) == 0


def test_validate_no_capabilities():
    ucp = UnifiedCapabilityProfile(identity=Identity(amp_id="test"))
    warnings = validate_ucp(ucp)
    assert any("at least one capability" in w for w in warnings)


def test_validate_unknown_domain():
    ucp = UnifiedCapabilityProfile(
        capabilities=[Capability(domain="magic", description="magic things")]
    )
    warnings = validate_ucp(ucp)
    assert any("not in standard domains" in w for w in warnings)


def test_from_a2a_agent_card():
    card = {
        "name": "SecurityBot",
        "description": "Enterprise security scanner",
        "url": "https://securitybot.example.com/.well-known/agent.json",
        "skills": [
            {"name": "code_review", "description": "Python security code review"},
            {"name": "vuln_scan", "description": "Vulnerability scanning"},
        ],
    }
    ucp = from_a2a_agent_card(card)
    assert ucp.identity.a2a_card == card["url"]
    assert ucp.trust_tier == "attested"
    assert len(ucp.capabilities) == 2
    assert ucp.extensions["source_format"] == "a2a_agent_card"


def test_from_mcp_manifest():
    manifest = {
        "tools": [
            {"name": "web_scraper", "description": "Scrape web pages for data"},
            {"name": "pdf_parser", "description": "Parse PDF documents"},
        ],
    }
    ucp = from_mcp_manifest(manifest)
    assert len(ucp.capabilities) == 2
    assert ucp.trust_tier == "declared"
    assert ucp.extensions["tool_count"] == 2


def test_from_openclaw_skill():
    skill = {
        "name": "web-research-v3",
        "description": "Research agent for competitive analysis",
        "required_binaries": ["curl", "jq"],
    }
    ucp = from_openclaw_skill(skill)
    assert len(ucp.identity.registries) == 1
    assert ucp.identity.registries[0].registry_type == "clawhub"
    assert "curl" in ucp.capabilities[0].tools_used


def test_infer_domain():
    assert _infer_domain("security audit vulnerability scanner") == "security"
    assert _infer_domain("competitive research survey") == "research"
    assert _infer_domain("build a web application frontend") == "development"
    assert _infer_domain("translate document to Spanish") == "communication"
    assert _infer_domain("monitor infrastructure pipeline automation") == "operations"
    assert _infer_domain("create artwork and designs") == "creative"
    assert _infer_domain("something very generic") == "domain_specific"
