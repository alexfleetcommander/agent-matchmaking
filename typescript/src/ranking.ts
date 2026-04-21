import {
  DEFAULT_TRUST_BASELINE,
  DEFAULT_TRUST_WEIGHTS,
  TRUST_BASELINE_ADJUSTMENTS,
  TRUST_TIER_WEIGHTS,
  UnifiedCapabilityProfile,
} from "./schema";

// ---------------------------------------------------------------------------
// Confidence factors
// ---------------------------------------------------------------------------

export function confidenceFactor(sampleSize: number, threshold = 100): number {
  if (sampleSize >= threshold) return 1.0;
  if (sampleSize <= 0) return 0.5;
  return 0.5 + 0.5 * (sampleSize / threshold);
}

export function anchorDensityFactor(chainAgeDays: number, anchorCount: number): number {
  if (chainAgeDays <= 0) return 0.5;
  const expectedAnchors = chainAgeDays * 12;
  if (expectedAnchors <= 0) return 0.5;
  const ratio = anchorCount / expectedAnchors;
  return Math.max(0.5, Math.min(1.5, 0.5 + ratio));
}

// ---------------------------------------------------------------------------
// Component scores (Section 9.3)
// ---------------------------------------------------------------------------

export function identityConfidence(chainAgeDays = 0, anchorCount = 0): number {
  if (chainAgeDays <= 0) return 0.0;
  const density = anchorDensityFactor(chainAgeDays, anchorCount);
  const raw = Math.log2(1 + chainAgeDays) * density * 15;
  return Math.min(100.0, raw);
}

export function performanceQuality(arpComposite = 0, domainArp?: number): number {
  return domainArp !== undefined && domainArp !== null ? domainArp : arpComposite;
}

export function reliabilityScore(asaCompletionRate = 0, asaSampleSize = 0): number {
  return asaCompletionRate * 100 * confidenceFactor(asaSampleSize);
}

export function riskScore(ajpDisputeRate = 0, ajpUnfavorableRate = 0): number {
  return ajpDisputeRate * ajpUnfavorableRate * 100;
}

// ---------------------------------------------------------------------------
// Composite trust score
// ---------------------------------------------------------------------------

export function computeTrustScore(opts: {
  chainAgeDays?: number;
  anchorCount?: number;
  arpComposite?: number;
  domainArp?: number;
  asaCompletionRate?: number;
  asaSampleSize?: number;
  ajpDisputeRate?: number;
  ajpUnfavorableRate?: number;
  weights?: Record<string, number>;
} = {}): number {
  const w = opts.weights ?? DEFAULT_TRUST_WEIGHTS;

  const idConf = identityConfidence(opts.chainAgeDays ?? 0, opts.anchorCount ?? 0);
  const perfQ = performanceQuality(opts.arpComposite ?? 0, opts.domainArp);
  const relS = reliabilityScore(opts.asaCompletionRate ?? 0, opts.asaSampleSize ?? 0);
  const rsk = riskScore(opts.ajpDisputeRate ?? 0, opts.ajpUnfavorableRate ?? 0);

  const score =
    (w.identity ?? 0.20) * idConf +
    (w.performance ?? 0.40) * perfQ +
    (w.reliability ?? 0.25) * relS +
    (w.risk ?? 0.15) * (100 - rsk);

  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// New-agent baseline (Section 9.4)
// ---------------------------------------------------------------------------

export function baselineTrustScore(opts: {
  hasCorporateValidation?: boolean;
  hasCommunityReviews10Plus?: boolean;
  hasA2aVerifiedDomain?: boolean;
  hasDidVerifiable?: boolean;
} = {}): number {
  let score = DEFAULT_TRUST_BASELINE;
  if (opts.hasCorporateValidation) score += TRUST_BASELINE_ADJUSTMENTS.corporate_marketplace_validation;
  if (opts.hasCommunityReviews10Plus) score += TRUST_BASELINE_ADJUSTMENTS.community_reviews_10plus;
  if (opts.hasA2aVerifiedDomain) score += TRUST_BASELINE_ADJUSTMENTS.a2a_card_verified_domain;
  if (opts.hasDidVerifiable) score += TRUST_BASELINE_ADJUSTMENTS.did_verifiable_controller;
  return Math.min(100, score);
}

// ---------------------------------------------------------------------------
// Trust score from UCP (convenience)
// ---------------------------------------------------------------------------

export function trustScoreFromUcp(
  ucp: UnifiedCapabilityProfile,
  chainAgeDays = 0,
  anchorCount = 0,
  weights?: Record<string, number>,
): number {
  const perf = ucp.performance;
  const quality = perf.quality;
  const rel = perf.reliability;
  const dispute = perf.disputeProfile;

  const hasTrustData =
    quality.arpCompositeScore > 0 ||
    rel.asaCompletionRate > 0 ||
    dispute.ajpSampleSize > 0 ||
    chainAgeDays > 0;

  if (!hasTrustData) {
    const corporateRegistries = new Set(["google_cloud", "salesforce", "aws", "servicenow"]);
    return baselineTrustScore({
      hasCorporateValidation: ucp.identity.registries.some(
        (r) => corporateRegistries.has(r.registryType),
      ),
      hasCommunityReviews10Plus: false,
      hasA2aVerifiedDomain: !!ucp.identity.a2aCard,
      hasDidVerifiable: !!ucp.identity.did,
    });
  }

  let unfavorableRate = 0;
  if (dispute.ajpDisputeRate > 0 && dispute.ajpFavorableResolutionRate < 1.0) {
    unfavorableRate = 1.0 - dispute.ajpFavorableResolutionRate;
  }

  return computeTrustScore({
    chainAgeDays,
    anchorCount,
    arpComposite: quality.arpCompositeScore,
    asaCompletionRate: rel.asaCompletionRate,
    asaSampleSize: rel.asaSampleSize,
    ajpDisputeRate: dispute.ajpDisputeRate,
    ajpUnfavorableRate: unfavorableRate,
    weights,
  });
}

export function trustTierWeight(tier: string): number {
  return TRUST_TIER_WEIGHTS[tier] ?? 0.25;
}
