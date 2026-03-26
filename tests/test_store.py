"""Tests for the append-only JSONL store."""

import tempfile
import os

from agent_matchmaking.store import MatchmakingStore
from agent_matchmaking.schema import (
    MatchRequest,
    MatchResponse,
    MatchResult,
    TaskDescription,
    UnifiedCapabilityProfile,
    Identity,
    Capability,
)


def _make_temp_store():
    tmpdir = tempfile.mkdtemp(prefix="amp_test_")
    return MatchmakingStore(os.path.join(tmpdir, ".amp"))


def test_store_save_and_get_ucp():
    store = _make_temp_store()
    ucp = UnifiedCapabilityProfile(
        identity=Identity(amp_id="amp:agent:store-test"),
        capabilities=[Capability(domain="research", description="test agent")],
    )
    store.save_ucp(ucp)
    retrieved = store.get_ucp("amp:agent:store-test")
    assert retrieved is not None
    assert retrieved.identity.amp_id == "amp:agent:store-test"


def test_store_latest_wins():
    store = _make_temp_store()
    # Save two versions
    ucp1 = UnifiedCapabilityProfile(
        identity=Identity(amp_id="amp:agent:versioned"),
        capabilities=[Capability(domain="research", description="v1")],
        trust_tier="declared",
    )
    store.save_ucp(ucp1)

    ucp2 = UnifiedCapabilityProfile(
        identity=Identity(amp_id="amp:agent:versioned"),
        capabilities=[Capability(domain="research", description="v2")],
        trust_tier="measured",
    )
    store.save_ucp(ucp2)

    latest = store.get_ucp("amp:agent:versioned")
    assert latest is not None
    assert latest.trust_tier == "measured"
    assert latest.capabilities[0].description == "v2"


def test_store_search_by_domain():
    store = _make_temp_store()
    store.save_ucp(UnifiedCapabilityProfile(
        identity=Identity(amp_id="a1"),
        capabilities=[Capability(domain="security", description="sec agent")],
    ))
    store.save_ucp(UnifiedCapabilityProfile(
        identity=Identity(amp_id="a2"),
        capabilities=[Capability(domain="research", description="res agent")],
    ))
    store.save_ucp(UnifiedCapabilityProfile(
        identity=Identity(amp_id="a3"),
        capabilities=[Capability(domain="security", description="another sec")],
    ))

    sec = store.search_ucps(domain="security")
    assert len(sec) == 2


def test_store_search_by_text():
    store = _make_temp_store()
    store.save_ucp(UnifiedCapabilityProfile(
        identity=Identity(amp_id="a1"),
        capabilities=[Capability(domain="security", description="Python code review for vulnerabilities")],
    ))
    store.save_ucp(UnifiedCapabilityProfile(
        identity=Identity(amp_id="a2"),
        capabilities=[Capability(domain="creative", description="Generate artwork")],
    ))

    results = store.search_ucps(text="python")
    assert len(results) == 1
    assert results[0].identity.amp_id == "a1"


def test_store_requests():
    store = _make_temp_store()
    req = MatchRequest(
        requester_id="test",
        task=TaskDescription(description="test task"),
    )
    store.save_request(req)
    requests = store.get_requests()
    assert len(requests) == 1


def test_store_stats():
    store = _make_temp_store()
    store.save_ucp(UnifiedCapabilityProfile(
        identity=Identity(amp_id="a1"),
        capabilities=[Capability(domain="research", description="test")],
        trust_tier="declared",
    ))
    stats = store.stats()
    assert stats["ucps"]["unique_count"] == 1
    assert "by_domain" in stats["ucps"]
    assert "by_trust_tier" in stats["ucps"]
