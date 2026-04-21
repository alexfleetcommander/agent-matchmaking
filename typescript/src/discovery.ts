import {
  FederationQuery,
  MatchRequest,
  RegistryListing,
  UnifiedCapabilityProfile,
  nowIso,
} from "./schema";

// ---------------------------------------------------------------------------
// Query translation (Step 1 of Section 7.2)
// ---------------------------------------------------------------------------

export function translateToFederationQuery(request: MatchRequest): FederationQuery {
  return new FederationQuery({
    queryText: request.task.description,
    domain: request.task.domain,
    subdomain: request.task.subdomain,
    constraints: {
      min_trust_score: request.constraints.minTrustScore,
      max_results: request.constraints.maxResults * 5,
    },
    maxResults: request.constraints.maxResults * 5,
  });
}

// ---------------------------------------------------------------------------
// Response normalization (Step 3)
// ---------------------------------------------------------------------------

export function normalizeResults(
  ucps: UnifiedCapabilityProfile[],
  sourceRegistry = "",
): UnifiedCapabilityProfile[] {
  const normalized: UnifiedCapabilityProfile[] = [];
  for (const ucp of ucps) {
    if (!ucp.identity.ampId) continue;
    if (sourceRegistry) {
      const registries = new Set(ucp.identity.registries.map((r) => r.registryType));
      if (!registries.has(sourceRegistry)) {
        ucp.identity.registries.push(
          new RegistryListing(sourceRegistry, ucp.identity.ampId),
        );
      }
    }
    normalized.push(ucp);
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Deduplication and conflict resolution (Step 4, Section 7.2)
// ---------------------------------------------------------------------------

function identityKey(ucp: UnifiedCapabilityProfile): string {
  const ident = ucp.identity;
  if (ident.did) return `did:${ident.did}`;
  if (ident.cocChainId) return `coc:${ident.cocChainId}`;
  if (ident.a2aCard) return `a2a:${ident.a2aCard}`;
  return `amp:${ident.ampId}`;
}

function mergeUcps(ucps: UnifiedCapabilityProfile[]): UnifiedCapabilityProfile {
  const tierOrder: Record<string, number> = { verified: 0, measured: 1, attested: 2, declared: 3 };
  const sorted = [...ucps].sort(
    (a, b) => (tierOrder[a.trustTier] ?? 4) - (tierOrder[b.trustTier] ?? 4),
  );
  const primary = sorted[0];

  const allRegistries: Record<string, RegistryListing> = {};
  for (const ucp of ucps) {
    for (const reg of ucp.identity.registries) {
      const key = `${reg.registryType}:${reg.listingId}`;
      if (!(key in allRegistries)) allRegistries[key] = reg;
    }
  }
  primary.identity.registries = Object.values(allRegistries);

  const seenCaps = new Set<string>();
  const mergedCaps = [];
  for (const ucp of sorted) {
    for (const cap of ucp.capabilities) {
      const capKey = `${cap.domain}:${cap.subdomain}:${cap.description.slice(0, 50)}`;
      if (!seenCaps.has(capKey)) {
        seenCaps.add(capKey);
        mergedCaps.push(cap);
      }
    }
  }
  primary.capabilities = mergedCaps;

  for (const ucp of sorted.slice(1)) {
    const p = ucp.performance;
    const pp = primary.performance;
    if (p.quality.arpCompositeScore > pp.quality.arpCompositeScore) pp.quality = p.quality;
    if (p.reliability.asaSampleSize > pp.reliability.asaSampleSize) pp.reliability = p.reliability;
    if (p.disputeProfile.ajpSampleSize > pp.disputeProfile.ajpSampleSize) pp.disputeProfile = p.disputeProfile;
  }

  primary.extensions.merged_from_sources = ucps.length;
  primary.extensions.source_trust_tiers = ucps.map((u) => u.trustTier);
  primary.updatedAt = nowIso();

  return primary;
}

export function deduplicate(ucps: UnifiedCapabilityProfile[]): UnifiedCapabilityProfile[] {
  const groups: Record<string, UnifiedCapabilityProfile[]> = {};
  for (const ucp of ucps) {
    const key = identityKey(ucp);
    if (!(key in groups)) groups[key] = [];
    groups[key].push(ucp);
  }

  const results: UnifiedCapabilityProfile[] = [];
  for (const group of Object.values(groups)) {
    if (group.length === 1) {
      results.push(group[0]);
    } else {
      results.push(mergeUcps(group));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Full discovery pipeline
// ---------------------------------------------------------------------------

export function discover(
  _request: MatchRequest,
  registryUcps: Record<string, UnifiedCapabilityProfile[]>,
): UnifiedCapabilityProfile[] {
  const allUcps: UnifiedCapabilityProfile[] = [];
  for (const [registryName, ucps] of Object.entries(registryUcps)) {
    allUcps.push(...normalizeResults(ucps, registryName));
  }
  return deduplicate(allUcps);
}
