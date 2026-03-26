"""Tests for discovery and federation."""

from agent_matchmaking.schema import (
    Identity,
    Capability,
    RegistryListing,
    MatchRequest,
    TaskDescription,
    UnifiedCapabilityProfile,
)
from agent_matchmaking.discovery import (
    deduplicate,
    discover,
    normalize_results,
    translate_to_federation_query,
)
from agent_matchmaking.federation import (
    FederationRouter,
    StaticAdapter,
)


def _make_ucp(amp_id, domain="research", did="", a2a="", registries=None):
    return UnifiedCapabilityProfile(
        identity=Identity(
            amp_id=amp_id, did=did, a2a_card=a2a,
            registries=registries or [],
        ),
        capabilities=[Capability(domain=domain, description=f"Agent {amp_id}")],
    )


def test_translate_query():
    req = MatchRequest(
        task=TaskDescription(description="code review", domain="security", subdomain="code_review"),
    )
    fq = translate_to_federation_query(req)
    assert fq.query_text == "code review"
    assert fq.domain == "security"


def test_normalize_adds_registry():
    ucps = [_make_ucp("a1")]
    normalized = normalize_results(ucps, source_registry="google_cloud")
    assert any(r.registry_type == "google_cloud" for r in normalized[0].identity.registries)


def test_deduplicate_by_did():
    ucp1 = _make_ucp("a1", did="did:web:example.com")
    ucp1.identity.registries = [RegistryListing("google_cloud", "gc1")]
    ucp2 = _make_ucp("a2", did="did:web:example.com")
    ucp2.identity.registries = [RegistryListing("clawhub", "ch1")]

    result = deduplicate([ucp1, ucp2])
    assert len(result) == 1
    # Should have registries from both
    reg_types = {r.registry_type for r in result[0].identity.registries}
    assert "google_cloud" in reg_types
    assert "clawhub" in reg_types


def test_deduplicate_distinct():
    ucp1 = _make_ucp("a1")
    ucp2 = _make_ucp("a2")
    result = deduplicate([ucp1, ucp2])
    assert len(result) == 2


def test_discover_pipeline():
    registry_ucps = {
        "google_cloud": [_make_ucp("a1", domain="security")],
        "clawhub": [_make_ucp("a2", domain="security"), _make_ucp("a3", domain="research")],
    }
    req = MatchRequest(task=TaskDescription(description="test"))
    result = discover(req, registry_ucps)
    assert len(result) == 3


def test_federation_router():
    agents_reg1 = [_make_ucp("a1", domain="security", did="did:a1")]
    agents_reg2 = [_make_ucp("a2", domain="research", did="did:a2")]

    router = FederationRouter(timeout_ms=5000)
    router.register(StaticAdapter(agents_reg1, name="registry1"))
    router.register(StaticAdapter(agents_reg2, name="registry2"))

    req = MatchRequest(
        task=TaskDescription(description="security", domain="security"),
    )
    results = router.query(req)
    assert len(results) == 2
    assert all(r.error == "" for r in results)


def test_federation_router_federated_search():
    agents1 = [_make_ucp("a1", domain="security")]
    agents2 = [_make_ucp("a2", domain="security")]

    router = FederationRouter()
    router.register(StaticAdapter(agents1, name="reg1"))
    router.register(StaticAdapter(agents2, name="reg2"))

    req = MatchRequest(
        task=TaskDescription(description="agent", domain="security"),
    )
    ucps = router.federated_search(req)
    assert len(ucps) == 2


def test_federation_specific_registries():
    router = FederationRouter()
    router.register(StaticAdapter([_make_ucp("a1")], name="reg1"))
    router.register(StaticAdapter([_make_ucp("a2")], name="reg2"))

    req = MatchRequest(task=TaskDescription(description="test"))
    results = router.query(req, registries=["reg1"])
    assert len(results) == 1
    assert results[0].registry_name == "reg1"
