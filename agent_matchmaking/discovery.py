"""Cross-platform search — query translation, response normalization,
and deduplication (Section 7).

Discovery handles the logic of searching across heterogeneous registries
and merging results. Federation handles the network layer (adapters,
parallel dispatch, timeouts).
"""

from typing import Any, Dict, List, Optional, Set, Tuple

from .schema import (
    FederationQuery,
    MatchRequest,
    UnifiedCapabilityProfile,
    _now_iso,
)


# ---------------------------------------------------------------------------
# Query translation (Step 1 of Section 7.2)
# ---------------------------------------------------------------------------

def translate_to_federation_query(request: MatchRequest) -> FederationQuery:
    """Translate a MatchRequest into a FederationQuery for registry adapters."""
    return FederationQuery(
        query_text=request.task.description,
        domain=request.task.domain,
        subdomain=request.task.subdomain,
        constraints={
            "min_trust_score": request.constraints.min_trust_score,
            "max_results": request.constraints.max_results * 5,  # over-fetch for dedup
        },
        max_results=request.constraints.max_results * 5,
    )


# ---------------------------------------------------------------------------
# Response normalization (Step 3)
# ---------------------------------------------------------------------------

def normalize_results(
    ucps: List[UnifiedCapabilityProfile],
    source_registry: str = "",
) -> List[UnifiedCapabilityProfile]:
    """Ensure all UCPs have minimum required fields populated."""
    normalized = []
    for ucp in ucps:
        if not ucp.identity.amp_id:
            continue
        # Tag source registry if not already present
        if source_registry:
            registries = {r.registry_type for r in ucp.identity.registries}
            if source_registry not in registries:
                from .schema import RegistryListing
                ucp.identity.registries.append(
                    RegistryListing(registry_type=source_registry, listing_id=ucp.identity.amp_id)
                )
        normalized.append(ucp)
    return normalized


# ---------------------------------------------------------------------------
# Deduplication and conflict resolution (Step 4, Section 7.2)
# ---------------------------------------------------------------------------

def _identity_key(ucp: UnifiedCapabilityProfile) -> str:
    """Generate a deduplication key from identity fields.

    Priority: DID > CoC chain ID > A2A card URL > AMP ID.
    """
    ident = ucp.identity
    if ident.did:
        return f"did:{ident.did}"
    if ident.coc_chain_id:
        return f"coc:{ident.coc_chain_id}"
    if ident.a2a_card:
        return f"a2a:{ident.a2a_card}"
    return f"amp:{ident.amp_id}"


def deduplicate(ucps: List[UnifiedCapabilityProfile]) -> List[UnifiedCapabilityProfile]:
    """Deduplicate UCPs from multiple registries, merging data.

    When the same agent appears from multiple sources:
    - Merge registries_found_on
    - Take the most complete performance data
    - Use the highest trust tier
    - Flag unresolvable conflicts in extensions
    """
    groups: Dict[str, List[UnifiedCapabilityProfile]] = {}
    for ucp in ucps:
        key = _identity_key(ucp)
        if key not in groups:
            groups[key] = []
        groups[key].append(ucp)

    results: List[UnifiedCapabilityProfile] = []
    for key, group in groups.items():
        if len(group) == 1:
            results.append(group[0])
            continue

        # Merge: pick the "best" as primary, then merge secondary info
        merged = _merge_ucps(group)
        results.append(merged)

    return results


def _merge_ucps(ucps: List[UnifiedCapabilityProfile]) -> UnifiedCapabilityProfile:
    """Merge multiple UCPs for the same agent into one."""
    # Sort by trust tier (verified > measured > attested > declared)
    tier_order = {"verified": 0, "measured": 1, "attested": 2, "declared": 3}
    sorted_ucps = sorted(ucps, key=lambda u: tier_order.get(u.trust_tier, 4))
    primary = sorted_ucps[0]

    # Merge registries
    all_registries = {}
    for ucp in ucps:
        for reg in ucp.identity.registries:
            key = f"{reg.registry_type}:{reg.listing_id}"
            if key not in all_registries:
                all_registries[key] = reg
    primary.identity.registries = list(all_registries.values())

    # Merge capabilities: union of unique descriptions
    seen_caps: Set[str] = set()
    merged_caps = []
    for ucp in sorted_ucps:
        for cap in ucp.capabilities:
            cap_key = f"{cap.domain}:{cap.subdomain}:{cap.description[:50]}"
            if cap_key not in seen_caps:
                seen_caps.add(cap_key)
                merged_caps.append(cap)
    primary.capabilities = merged_caps

    # Take best performance data
    for ucp in sorted_ucps[1:]:
        p = ucp.performance
        pp = primary.performance
        if p.quality.arp_composite_score > pp.quality.arp_composite_score:
            pp.quality = p.quality
        if p.reliability.asa_sample_size > pp.reliability.asa_sample_size:
            pp.reliability = p.reliability
        if p.dispute_profile.ajp_sample_size > pp.dispute_profile.ajp_sample_size:
            pp.dispute_profile = p.dispute_profile

    # Note merge in extensions
    sources = [u.trust_tier for u in ucps]
    primary.extensions["merged_from_sources"] = len(ucps)
    primary.extensions["source_trust_tiers"] = sources
    primary.updated_at = _now_iso()

    return primary


# ---------------------------------------------------------------------------
# Full discovery pipeline
# ---------------------------------------------------------------------------

def discover(
    request: MatchRequest,
    registry_ucps: Dict[str, List[UnifiedCapabilityProfile]],
) -> List[UnifiedCapabilityProfile]:
    """Full discovery pipeline: normalize + deduplicate across registries.

    Args:
        request: The match request (used for query context).
        registry_ucps: Dict mapping registry_name -> list of UCPs returned.

    Returns:
        Deduplicated, normalized list of UCPs ready for matching.
    """
    all_ucps: List[UnifiedCapabilityProfile] = []
    for registry_name, ucps in registry_ucps.items():
        normalized = normalize_results(ucps, source_registry=registry_name)
        all_ucps.extend(normalized)

    return deduplicate(all_ucps)
