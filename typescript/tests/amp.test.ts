import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";

import {
  // Constants
  PROTOCOL_VERSION,
  SCHEMA_VERSION,
  CAPABILITY_DOMAINS,
  TRUST_TIERS,
  TRUST_TIER_WEIGHTS,
  MATCHING_MODES,
  PRICING_MECHANISMS,
  AUCTION_FORMATS,
  LIFECYCLE_STATUSES,
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  DEFAULT_WEIGHTS,
  DEFAULT_TRUST_WEIGHTS,
  DEFAULT_TRUST_BASELINE,
  TRUST_BASELINE_ADJUSTMENTS,
  // Helpers
  genId,
  hashDict,
  nowIso,
  // Schema classes
  RegistryListing,
  Identity,
  TaxonomyCodes,
  ComplexityRange,
  Capability,
  ReliabilityMetrics,
  QualityMetrics,
  SpeedMetrics,
  DisputeProfile,
  Performance,
  CostRate,
  FreeTier,
  Cost,
  Capacity,
  Availability,
  UnifiedCapabilityProfile,
  TaskDescription,
  MatchConstraints,
  FederationConfig,
  MatchRequest,
  TrustVerification,
  MatchResult,
  MatchMetadata,
  MatchResponse,
  FederationQuery,
  FederationResult,
  // Store
  MatchmakingStore,
  // UCP Builder
  UCPBuilder,
  UCPValidationError,
  fromA2aAgentCard,
  fromMcpManifest,
  fromOpenclawSkill,
  inferDomain,
  validateUcp,
  // Ranking
  baselineTrustScore,
  computeTrustScore,
  confidenceFactor,
  identityConfidence,
  performanceQuality,
  reliabilityScore,
  riskScore,
  trustScoreFromUcp,
  trustTierWeight,
  // Matching
  capabilityMatchScore,
  compatibilityScore,
  costAlignmentScore,
  availabilityScore,
  domainRelevanceScore,
  passesConstraints,
  rankedSearch,
  stableMatching,
  styleCompatibilityScore,
  // Discovery
  deduplicate,
  discover,
  normalizeResults,
  translateToFederationQuery,
  // Federation
  CallbackAdapter,
  FederationRouter,
  StaticAdapter,
  // Pricing
  AuctionResult,
  Bid,
  PostedPriceResult,
  Quote,
  RFQSession,
  englishAuction,
  estimateCost,
  postedPrice,
  vickreyAuction,
} from "../src/index";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeUcp(opts: {
  ampId?: string;
  domain?: string;
  description?: string;
  arpComposite?: number;
  asaCompletionRate?: number;
  asaSampleSize?: number;
  basePrice?: number;
  trustTier?: string;
  lifecycleStage?: string;
  loadPct?: number;
  medianResponseMs?: number;
  disputeRate?: number;
  favorableRate?: number;
  disputeSamples?: number;
} = {}): UnifiedCapabilityProfile {
  return new UCPBuilder()
    .identity({ ampId: opts.ampId })
    .addCapability({
      domain: opts.domain ?? "development",
      description: opts.description ?? "Build software applications",
    })
    .performance({
      arpComposite: opts.arpComposite ?? 75,
      asaCompletionRate: opts.asaCompletionRate ?? 0.92,
      asaSampleSize: opts.asaSampleSize ?? 50,
      medianResponseMs: opts.medianResponseMs ?? 500,
    })
    .cost({ baseAmount: opts.basePrice ?? 0.05 })
    .availability({
      lifecycleStage: opts.lifecycleStage ?? "operational",
      currentLoadPct: opts.loadPct ?? 20,
    })
    .trustTier(opts.trustTier ?? "measured")
    .build();
}

function makeRequest(opts: {
  description?: string;
  domain?: string;
  budgetMax?: number;
  deadlineMs?: number;
  maxResults?: number;
  minTrust?: number;
} = {}): MatchRequest {
  return new MatchRequest({
    requesterId: "test-requester",
    task: new TaskDescription({
      description: opts.description ?? "Build a web API",
      domain: opts.domain ?? "development",
      budgetMax: opts.budgetMax ?? 1.0,
      deadlineMs: opts.deadlineMs ?? 0,
    }),
    constraints: new MatchConstraints({
      maxResults: opts.maxResults ?? 10,
      minTrustScore: opts.minTrust ?? 0,
    }),
  });
}

const TEST_STORE_DIR = `.amp-test-${Date.now()}`;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Constants", () => {
  it("protocol and schema versions", () => {
    assert.equal(PROTOCOL_VERSION, "1.0.0");
    assert.equal(SCHEMA_VERSION, "1.0.0");
  });

  it("capability domains are 8 items", () => {
    assert.equal(CAPABILITY_DOMAINS.length, 8);
    assert.ok(CAPABILITY_DOMAINS.includes("research"));
    assert.ok(CAPABILITY_DOMAINS.includes("security"));
  });

  it("trust tiers", () => {
    assert.equal(TRUST_TIERS.length, 4);
    assert.equal(TRUST_TIER_WEIGHTS.verified, 1.0);
    assert.equal(TRUST_TIER_WEIGHTS.declared, 0.25);
  });

  it("matching modes and pricing mechanisms", () => {
    assert.equal(MATCHING_MODES.length, 3);
    assert.equal(PRICING_MECHANISMS.length, 3);
    assert.equal(AUCTION_FORMATS.length, 3);
  });

  it("lifecycle statuses", () => {
    assert.equal(LIFECYCLE_STATUSES.length, 7);
    assert.ok(ACTIVE_STATUSES.includes("operational"));
    assert.ok(INACTIVE_STATUSES.includes("deprecated"));
  });

  it("default weights sum to 1.0", () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001);
  });

  it("default trust weights sum to 1.0", () => {
    const sum = Object.values(DEFAULT_TRUST_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001);
  });

  it("baseline trust", () => {
    assert.equal(DEFAULT_TRUST_BASELINE, 40);
    assert.equal(TRUST_BASELINE_ADJUSTMENTS.corporate_marketplace_validation, 15);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("Helpers", () => {
  it("genId produces prefixed IDs", () => {
    const id = genId("test");
    assert.ok(id.startsWith("test-"));
    assert.equal(id.length, 5 + 12);
  });

  it("nowIso returns ISO format without milliseconds", () => {
    const ts = nowIso();
    assert.ok(ts.endsWith("Z"));
    assert.ok(!ts.includes("."));
  });

  it("hashDict produces deterministic SHA-256", () => {
    const h1 = hashDict({ a: 1, b: 2 });
    const h2 = hashDict({ b: 2, a: 1 });
    assert.equal(h1, h2);
    assert.equal(h1.length, 64);
  });
});

// ---------------------------------------------------------------------------
// Schema — Identity
// ---------------------------------------------------------------------------

describe("Schema — Identity", () => {
  it("RegistryListing round-trip", () => {
    const r = new RegistryListing("clawhub", "skill-123");
    const d = r.toDict();
    assert.equal(d.type, "clawhub");
    const r2 = RegistryListing.fromDict(d);
    assert.equal(r2.registryType, "clawhub");
    assert.equal(r2.listingId, "skill-123");
  });

  it("Identity auto-generates amp_id", () => {
    const i = new Identity();
    assert.ok(i.ampId.startsWith("amp:agent-"));
  });

  it("Identity round-trip", () => {
    const i = new Identity({ ampId: "test-1", a2aCard: "https://example.com", did: "did:web:x" });
    const d = i.toDict();
    assert.equal(d.amp_id, "test-1");
    const i2 = Identity.fromDict(d);
    assert.equal(i2.ampId, "test-1");
    assert.equal(i2.a2aCard, "https://example.com");
    assert.equal(i2.did, "did:web:x");
  });
});

// ---------------------------------------------------------------------------
// Schema — Capability
// ---------------------------------------------------------------------------

describe("Schema — Capability", () => {
  it("TaxonomyCodes round-trip", () => {
    const t = new TaxonomyCodes("15-1252.00", "dev.backend");
    const d = t.toDict();
    const t2 = TaxonomyCodes.fromDict(d);
    assert.equal(t2.onetSoc, "15-1252.00");
    assert.equal(t2.ampCapability, "dev.backend");
  });

  it("ComplexityRange round-trip", () => {
    const c = new ComplexityRange("simple CRUD", "distributed system");
    const d = c.toDict();
    const c2 = ComplexityRange.fromDict(d);
    assert.equal(c2.minDesc, "simple CRUD");
    assert.equal(c2.maxDesc, "distributed system");
  });

  it("Capability round-trip", () => {
    const c = new Capability({
      domain: "development",
      subdomain: "backend",
      description: "Build APIs",
      toolsUsed: ["python", "node"],
    });
    const d = c.toDict();
    assert.equal(d.domain, "development");
    assert.deepEqual(d.tools_used, ["python", "node"]);
    const c2 = Capability.fromDict(d);
    assert.equal(c2.domain, "development");
    assert.deepEqual(c2.toolsUsed, ["python", "node"]);
  });
});

// ---------------------------------------------------------------------------
// Schema — Performance
// ---------------------------------------------------------------------------

describe("Schema — Performance", () => {
  it("ReliabilityMetrics round-trip", () => {
    const r = new ReliabilityMetrics(0.95, 200, 99.5);
    const d = r.toDict();
    assert.equal(d.asa_completion_rate, 0.95);
    const r2 = ReliabilityMetrics.fromDict(d);
    assert.equal(r2.asaCompletionRate, 0.95);
    assert.equal(r2.asaSampleSize, 200);
  });

  it("QualityMetrics round-trip", () => {
    const q = new QualityMetrics({ arpCompositeScore: 82.5, arpDimensionalScores: { accuracy: 90 } });
    const d = q.toDict();
    assert.equal(d.arp_composite_score, 82.5);
    const q2 = QualityMetrics.fromDict(d);
    assert.equal(q2.arpCompositeScore, 82.5);
    assert.equal(q2.arpDimensionalScores.accuracy, 90);
  });

  it("SpeedMetrics round-trip", () => {
    const s = new SpeedMetrics(100, 500, 60);
    const d = s.toDict();
    const s2 = SpeedMetrics.fromDict(d);
    assert.equal(s2.medianResponseTimeMs, 100);
    assert.equal(s2.p95ResponseTimeMs, 500);
  });

  it("DisputeProfile round-trip", () => {
    const dp = new DisputeProfile(0.05, 0.8, 20);
    const d = dp.toDict();
    const dp2 = DisputeProfile.fromDict(d);
    assert.equal(dp2.ajpDisputeRate, 0.05);
    assert.equal(dp2.ajpFavorableResolutionRate, 0.8);
  });

  it("Performance round-trip", () => {
    const p = new Performance({
      reliability: new ReliabilityMetrics(0.9, 100, 98),
      quality: new QualityMetrics({ arpCompositeScore: 80 }),
    });
    const d = p.toDict();
    const p2 = Performance.fromDict(d);
    assert.equal(p2.reliability.asaCompletionRate, 0.9);
    assert.equal(p2.quality.arpCompositeScore, 80);
  });
});

// ---------------------------------------------------------------------------
// Schema — Cost
// ---------------------------------------------------------------------------

describe("Schema — Cost", () => {
  it("CostRate round-trip", () => {
    const r = new CostRate(0.05, "USD", "request");
    const d = r.toDict();
    const r2 = CostRate.fromDict(d);
    assert.equal(r2.amount, 0.05);
    assert.equal(r2.currency, "USD");
  });

  it("FreeTier round-trip", () => {
    const f = new FreeTier(1000);
    const d = f.toDict();
    const f2 = FreeTier.fromDict(d);
    assert.equal(f2.requestsPerMonth, 1000);
  });

  it("Cost round-trip with free tier", () => {
    const c = new Cost({ freeTier: new FreeTier(500), supportsNegotiation: true });
    const d = c.toDict();
    assert.ok(d.free_tier);
    assert.equal(d.supports_negotiation, true);
    const c2 = Cost.fromDict(d);
    assert.equal(c2.freeTier!.requestsPerMonth, 500);
    assert.equal(c2.supportsNegotiation, true);
  });

  it("Cost round-trip without free tier", () => {
    const c = new Cost();
    const d = c.toDict();
    assert.equal(d.free_tier, undefined);
    const c2 = Cost.fromDict(d);
    assert.equal(c2.freeTier, null);
  });
});

// ---------------------------------------------------------------------------
// Schema — Availability
// ---------------------------------------------------------------------------

describe("Schema — Availability", () => {
  it("Capacity round-trip", () => {
    const c = new Capacity(50, 10, 200);
    const d = c.toDict();
    const c2 = Capacity.fromDict(d);
    assert.equal(c2.currentLoadPct, 50);
    assert.equal(c2.maxConcurrentTasks, 10);
  });

  it("Availability round-trip", () => {
    const a = new Availability("active", "operational", new Capacity(30, 5));
    const d = a.toDict();
    const a2 = Availability.fromDict(d);
    assert.equal(a2.status, "active");
    assert.equal(a2.alpLifecycleStage, "operational");
    assert.equal(a2.capacity.currentLoadPct, 30);
  });
});

// ---------------------------------------------------------------------------
// Schema — UCP
// ---------------------------------------------------------------------------

describe("Schema — UnifiedCapabilityProfile", () => {
  it("round-trip", () => {
    const ucp = makeUcp({ ampId: "test-agent" });
    const d = ucp.toDict();
    assert.equal(d.schema_version, SCHEMA_VERSION);
    assert.equal(d.identity.amp_id, "test-agent");
    const ucp2 = UnifiedCapabilityProfile.fromDict(d);
    assert.equal(ucp2.ampId, "test-agent");
    assert.equal(ucp2.capabilities[0].domain, "development");
  });

  it("primaryDomain returns first capability domain", () => {
    const ucp = makeUcp({ domain: "research" });
    assert.equal(ucp.primaryDomain(), "research");
  });

  it("empty UCP returns empty primaryDomain", () => {
    const ucp = new UnifiedCapabilityProfile();
    assert.equal(ucp.primaryDomain(), "");
  });

  it("hash is deterministic", () => {
    const ucp = makeUcp({ ampId: "hash-test" });
    assert.equal(ucp.hash(), ucp.hash());
    assert.equal(ucp.hash().length, 64);
  });
});

// ---------------------------------------------------------------------------
// Schema — Match Request/Response
// ---------------------------------------------------------------------------

describe("Schema — MatchRequest", () => {
  it("TaskDescription round-trip", () => {
    const t = new TaskDescription({
      description: "Build API", domain: "development", budgetMax: 5.0,
    });
    const d = t.toDict();
    assert.equal(d.budget.max_amount, 5.0);
    const t2 = TaskDescription.fromDict(d);
    assert.equal(t2.budgetMax, 5.0);
    assert.equal(t2.domain, "development");
  });

  it("MatchConstraints round-trip", () => {
    const mc = new MatchConstraints({ minTrustScore: 30, maxResults: 5 });
    const d = mc.toDict();
    const mc2 = MatchConstraints.fromDict(d);
    assert.equal(mc2.minTrustScore, 30);
    assert.equal(mc2.maxResults, 5);
  });

  it("FederationConfig round-trip", () => {
    const fc = new FederationConfig(["local", "clawhub"], 3000);
    const d = fc.toDict();
    const fc2 = FederationConfig.fromDict(d);
    assert.deepEqual(fc2.registries, ["local", "clawhub"]);
    assert.equal(fc2.timeoutMs, 3000);
  });

  it("MatchRequest round-trip", () => {
    const req = makeRequest({ description: "Deploy ML model" });
    const d = req.toDict();
    assert.ok(d.match_request.request_id.startsWith("mr-"));
    const req2 = MatchRequest.fromDict(d as unknown as Record<string, unknown>);
    assert.equal(req2.task.description, "Deploy ML model");
  });
});

describe("Schema — MatchResponse", () => {
  it("TrustVerification round-trip", () => {
    const tv = new TrustVerification({ cocChainVerified: true, cocChainLengthDays: 90 });
    const d = tv.toDict();
    const tv2 = TrustVerification.fromDict(d);
    assert.equal(tv2.cocChainVerified, true);
    assert.equal(tv2.cocChainLengthDays, 90);
  });

  it("MatchResult round-trip", () => {
    const mr = new MatchResult({
      rank: 1, agentId: "a1", compatibilityScore: 85.123,
      dimensionalScores: { capability_match: 90.456 },
    });
    const d = mr.toDict();
    assert.equal(d.compatibility_score, 85.12);
    assert.equal(d.dimensional_scores.capability_match, 90.46);
    const mr2 = MatchResult.fromDict(d);
    assert.equal(mr2.rank, 1);
    assert.equal(mr2.agentId, "a1");
  });

  it("MatchMetadata round-trip", () => {
    const mm = new MatchMetadata({ totalCandidatesEvaluated: 100, candidatesScored: 80, queryTimeMs: 42 });
    const d = mm.toDict();
    const mm2 = MatchMetadata.fromDict(d);
    assert.equal(mm2.totalCandidatesEvaluated, 100);
    assert.equal(mm2.candidatesScored, 80);
    assert.equal(mm2.queryTimeMs, 42);
  });

  it("MatchResponse round-trip", () => {
    const resp = new MatchResponse({
      requestId: "req-1",
      results: [new MatchResult({ rank: 1, agentId: "a1", compatibilityScore: 80 })],
      metadata: new MatchMetadata({ totalCandidatesEvaluated: 10 }),
    });
    const d = resp.toDict();
    assert.equal(d.match_response.request_id, "req-1");
    const resp2 = MatchResponse.fromDict(d as unknown as Record<string, unknown>);
    assert.equal(resp2.results.length, 1);
    assert.equal(resp2.results[0].agentId, "a1");
  });
});

describe("Schema — Federation", () => {
  it("FederationQuery round-trip", () => {
    const fq = new FederationQuery({ queryText: "code review", domain: "development", maxResults: 20 });
    const d = fq.toDict();
    const fq2 = FederationQuery.fromDict(d as unknown as Record<string, unknown>);
    assert.equal(fq2.queryText, "code review");
    assert.equal(fq2.maxResults, 20);
  });

  it("FederationResult round-trip", () => {
    const fr = new FederationResult({
      registryName: "local",
      ucps: [makeUcp({ ampId: "fr-test" })],
      queryTimeMs: 50,
    });
    const d = fr.toDict();
    assert.equal(d.registry_name, "local");
    const fr2 = FederationResult.fromDict(d);
    assert.equal(fr2.registryName, "local");
    assert.equal(fr2.ucps.length, 1);
  });

  it("FederationResult with error", () => {
    const fr = new FederationResult({ registryName: "broken", error: "timeout" });
    const d = fr.toDict();
    assert.equal(d.error, "timeout");
  });
});

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

describe("Ranking", () => {
  it("confidenceFactor scales from 0.5 to 1.0", () => {
    assert.equal(confidenceFactor(0), 0.5);
    assert.equal(confidenceFactor(100), 1.0);
    assert.equal(confidenceFactor(200), 1.0);
    assert.ok(Math.abs(confidenceFactor(50) - 0.75) < 0.001);
  });

  it("identityConfidence is 0 for no chain", () => {
    assert.equal(identityConfidence(0, 0), 0);
  });

  it("identityConfidence grows with age and anchors", () => {
    const score1 = identityConfidence(30, 100);
    const score2 = identityConfidence(90, 300);
    assert.ok(score2 > score1);
    assert.ok(score1 > 0);
    assert.ok(score2 <= 100);
  });

  it("performanceQuality prefers domain-specific", () => {
    assert.equal(performanceQuality(80, 90), 90);
    assert.equal(performanceQuality(80), 80);
    assert.equal(performanceQuality(80, undefined), 80);
  });

  it("reliabilityScore combines rate and confidence", () => {
    const score = reliabilityScore(0.95, 100);
    assert.ok(Math.abs(score - 95) < 0.01);
    const low = reliabilityScore(0.95, 10);
    assert.ok(low < score);
  });

  it("riskScore is product of rates", () => {
    assert.equal(riskScore(0, 0), 0);
    assert.equal(riskScore(0.1, 0.5), 5);
  });

  it("computeTrustScore produces bounded result", () => {
    const score = computeTrustScore({
      chainAgeDays: 60, anchorCount: 200,
      arpComposite: 80, asaCompletionRate: 0.9, asaSampleSize: 50,
    });
    assert.ok(score >= 0);
    assert.ok(score <= 100);
  });

  it("baselineTrustScore starts at 40 and adjusts", () => {
    assert.equal(baselineTrustScore(), 40);
    assert.equal(baselineTrustScore({ hasCorporateValidation: true }), 55);
    assert.equal(
      baselineTrustScore({
        hasCorporateValidation: true,
        hasCommunityReviews10Plus: true,
        hasA2aVerifiedDomain: true,
        hasDidVerifiable: true,
      }),
      75,
    );
  });

  it("trustScoreFromUcp falls back to baseline", () => {
    const ucp = new UnifiedCapabilityProfile();
    const score = trustScoreFromUcp(ucp);
    assert.equal(score, 40);
  });

  it("trustScoreFromUcp uses trust data when available", () => {
    const ucp = makeUcp({ arpComposite: 80, asaCompletionRate: 0.9, asaSampleSize: 100 });
    const score = trustScoreFromUcp(ucp, 30, 100);
    assert.ok(score > 40);
  });

  it("trustTierWeight returns correct weights", () => {
    assert.equal(trustTierWeight("verified"), 1.0);
    assert.equal(trustTierWeight("declared"), 0.25);
    assert.equal(trustTierWeight("unknown"), 0.25);
  });
});

// ---------------------------------------------------------------------------
// Matching — Dimensional Scores
// ---------------------------------------------------------------------------

describe("Matching — Dimensional Scores", () => {
  it("capabilityMatchScore domain exact match bonus", () => {
    const task = new TaskDescription({ description: "Build web API", domain: "development" });
    const ucp = makeUcp({ domain: "development", description: "Build web API applications" });
    const score = capabilityMatchScore(task, ucp);
    assert.ok(score > 0);
  });

  it("capabilityMatchScore is 0 for unrelated", () => {
    const task = new TaskDescription({ description: "quantum physics simulation" });
    const ucp = makeUcp({ domain: "creative", description: "watercolor painting" });
    const score = capabilityMatchScore(task, ucp);
    assert.ok(score < 10);
  });

  it("costAlignmentScore neutral when no budget", () => {
    const task = new TaskDescription({ budgetMax: 0 });
    const ucp = makeUcp();
    assert.equal(costAlignmentScore(task, ucp), 50);
  });

  it("costAlignmentScore penalizes mismatch", () => {
    const task = new TaskDescription({ budgetMax: 0.05 });
    const cheap = makeUcp({ basePrice: 0.05 });
    const expensive = makeUcp({ basePrice: 5.0 });
    const scoreClose = costAlignmentScore(task, cheap);
    const scoreFar = costAlignmentScore(task, expensive);
    assert.ok(scoreClose > scoreFar);
  });

  it("availabilityScore is 0 for deprecated agents", () => {
    const task = new TaskDescription();
    const ucp = makeUcp({ lifecycleStage: "deprecated" });
    assert.equal(availabilityScore(task, ucp), 0);
  });

  it("availabilityScore reflects load", () => {
    const task = new TaskDescription();
    const light = makeUcp({ loadPct: 10 });
    const heavy = makeUcp({ loadPct: 90 });
    assert.ok(availabilityScore(task, light) > availabilityScore(task, heavy));
  });

  it("styleCompatibilityScore with format match", () => {
    const task = new TaskDescription({ outputSpec: { format: "json" } });
    const ucp = new UCPBuilder()
      .addCapability({ domain: "development", outputModalities: ["json", "csv"] })
      .build();
    const score = styleCompatibilityScore(task, ucp);
    assert.ok(score > 25);
  });

  it("domainRelevanceScore uses dimensional scores", () => {
    const task = new TaskDescription({ domain: "development" });
    const ucp = makeUcp({ arpComposite: 80, asaCompletionRate: 0.9 });
    const score = domainRelevanceScore(task, ucp);
    assert.ok(score > 0);
  });
});

// ---------------------------------------------------------------------------
// Matching — Composite
// ---------------------------------------------------------------------------

describe("Matching — Composite", () => {
  it("compatibilityScore returns total and dimensions", () => {
    const req = makeRequest();
    const ucp = makeUcp();
    const [total, dims] = compatibilityScore(req, ucp);
    assert.ok(total > 0);
    assert.ok("capability_match" in dims);
    assert.ok("trust_score" in dims);
    assert.ok("cost_alignment" in dims);
    assert.ok("availability" in dims);
    assert.ok("style_compatibility" in dims);
    assert.ok("domain_relevance" in dims);
  });

  it("trust tier scales the trust component", () => {
    const req = makeRequest();
    const verified = makeUcp({ trustTier: "verified", arpComposite: 80 });
    const declared = makeUcp({ trustTier: "declared", arpComposite: 80 });
    const [totalV] = compatibilityScore(req, verified, 30, 100);
    const [totalD] = compatibilityScore(req, declared, 30, 100);
    assert.ok(totalV > totalD);
  });
});

// ---------------------------------------------------------------------------
// Matching — Constraints
// ---------------------------------------------------------------------------

describe("Matching — Constraints", () => {
  it("passesConstraints allows valid agent", () => {
    const ucp = makeUcp();
    const c = new MatchConstraints();
    assert.ok(passesConstraints(ucp, c));
  });

  it("passesConstraints filters by trust score", () => {
    const ucp = makeUcp();
    const c = new MatchConstraints({ minTrustScore: 99 });
    assert.ok(!passesConstraints(ucp, c, 50));
  });

  it("passesConstraints filters by dispute rate", () => {
    const ucp = makeUcp({ disputeRate: 0.5 });
    ucp.performance.disputeProfile = new DisputeProfile(0.5, 0.5, 10);
    const c = new MatchConstraints({ maxDisputeRate: 0.1 });
    assert.ok(!passesConstraints(ucp, c));
  });

  it("passesConstraints filters by lifecycle status", () => {
    const ucp = makeUcp({ lifecycleStage: "deprecated" });
    const c = new MatchConstraints({ requiredLifecycleStatus: ["operational"] });
    assert.ok(!passesConstraints(ucp, c));
  });

  it("passesConstraints filters excluded agents", () => {
    const ucp = makeUcp({ ampId: "blocked-agent" });
    const c = new MatchConstraints({ excludedAgents: ["blocked-agent"] });
    assert.ok(!passesConstraints(ucp, c));
  });

  it("passesConstraints filters by registry", () => {
    const ucp = makeUcp();
    const c = new MatchConstraints({ requiredRegistries: ["clawhub"] });
    assert.ok(!passesConstraints(ucp, c));
  });
});

// ---------------------------------------------------------------------------
// Matching — Ranked Search
// ---------------------------------------------------------------------------

describe("Matching — Ranked Search", () => {
  it("returns results ranked by score", () => {
    const req = makeRequest();
    const candidates = [
      makeUcp({ ampId: "a1", arpComposite: 90, asaCompletionRate: 0.99 }),
      makeUcp({ ampId: "a2", arpComposite: 50, asaCompletionRate: 0.7 }),
      makeUcp({ ampId: "a3", arpComposite: 70, asaCompletionRate: 0.85 }),
    ];
    const resp = rankedSearch(req, candidates);
    assert.equal(resp.results.length, 3);
    assert.equal(resp.results[0].rank, 1);
    assert.ok(resp.results[0].compatibilityScore >= resp.results[1].compatibilityScore);
    assert.ok(resp.results[1].compatibilityScore >= resp.results[2].compatibilityScore);
    assert.equal(resp.metadata.totalCandidatesEvaluated, 3);
    assert.equal(resp.metadata.candidatesScored, 3);
  });

  it("respects maxResults", () => {
    const req = makeRequest({ maxResults: 2 });
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeUcp({ ampId: `agent-${i}` }),
    );
    const resp = rankedSearch(req, candidates);
    assert.equal(resp.results.length, 2);
  });

  it("filters out non-matching agents", () => {
    const req = makeRequest({ minTrust: 99 });
    const candidates = [makeUcp({ arpComposite: 50 })];
    const resp = rankedSearch(req, candidates);
    assert.equal(resp.results.length, 0);
    assert.equal(resp.metadata.candidatesFilteredByConstraints, 1);
  });

  it("empty candidates returns empty results", () => {
    const req = makeRequest();
    const resp = rankedSearch(req, []);
    assert.equal(resp.results.length, 0);
    assert.equal(resp.metadata.totalCandidatesEvaluated, 0);
  });

  it("response includes trust verification", () => {
    const req = makeRequest();
    const ucp = makeUcp({ ampId: "trust-test", arpComposite: 80, asaSampleSize: 10 });
    const resp = rankedSearch(req, [ucp], { "trust-test": 30 });
    const result = resp.results[0];
    assert.ok(result.trustVerification.cocChainVerified);
    assert.ok(result.trustVerification.arpScoreVerified);
  });
});

// ---------------------------------------------------------------------------
// Matching — Stable Matching
// ---------------------------------------------------------------------------

describe("Matching — Stable Matching", () => {
  it("produces valid assignment", () => {
    const requests = [
      makeRequest({ description: "Build frontend" }),
      makeRequest({ description: "Deploy infrastructure" }),
    ];
    const candidates = [
      makeUcp({ ampId: "front-dev", description: "Frontend development" }),
      makeUcp({ ampId: "ops-eng", domain: "operations", description: "Infrastructure deployment" }),
    ];
    const matching = stableMatching(requests, candidates);
    assert.ok(Object.keys(matching).length <= 2);
    const assignedAgents = new Set(Object.values(matching));
    assert.ok(assignedAgents.size <= candidates.length);
  });

  it("handles more requests than agents", () => {
    const requests = [
      makeRequest({ description: "Task A" }),
      makeRequest({ description: "Task B" }),
      makeRequest({ description: "Task C" }),
    ];
    const candidates = [makeUcp({ ampId: "solo" })];
    const matching = stableMatching(requests, candidates);
    const assigned = Object.values(matching);
    assert.ok(assigned.length <= 1);
  });
});

// ---------------------------------------------------------------------------
// UCP Builder & Validation
// ---------------------------------------------------------------------------

describe("UCP Builder", () => {
  it("builds a valid UCP", () => {
    const ucp = new UCPBuilder()
      .identity({ ampId: "builder-test" })
      .addCapability({ domain: "research", description: "Literature review" })
      .performance({ arpComposite: 85 })
      .cost({ baseAmount: 0.10, supportsNegotiation: true })
      .availability({ lifecycleStage: "operational", maxConcurrent: 5 })
      .trustTier("measured")
      .extension("source", "test")
      .build();

    assert.equal(ucp.ampId, "builder-test");
    assert.equal(ucp.capabilities[0].domain, "research");
    assert.equal(ucp.performance.quality.arpCompositeScore, 85);
    assert.equal(ucp.cost.supportsNegotiation, true);
    assert.equal(ucp.availability.capacity.maxConcurrentTasks, 5);
    assert.equal(ucp.trustTier, "measured");
    assert.equal(ucp.extensions.source, "test");
  });

  it("addRegistry appends registries", () => {
    const ucp = new UCPBuilder()
      .addRegistry("clawhub", "skill-1")
      .addRegistry("google_cloud", "agent-2")
      .addCapability({ domain: "development" })
      .build();
    assert.equal(ucp.identity.registries.length, 2);
  });
});

describe("UCP Validation", () => {
  it("validates valid UCP", () => {
    const ucp = makeUcp();
    const warnings = validateUcp(ucp);
    assert.equal(warnings.length, 0);
  });

  it("warns on missing amp_id", () => {
    const ucp = new UnifiedCapabilityProfile();
    // Manually clear the auto-generated ID to test validation
    ucp.identity.ampId = "";
    const warnings = validateUcp(ucp);
    assert.ok(warnings.some((w) => w.includes("amp_id")));
  });

  it("warns on empty capabilities", () => {
    const ucp = new UnifiedCapabilityProfile();
    const warnings = validateUcp(ucp);
    assert.ok(warnings.some((w) => w.includes("capability")));
  });

  it("warns on invalid domain", () => {
    const ucp = new UCPBuilder()
      .addCapability({ domain: "nonexistent" as any, description: "test" })
      .build();
    const warnings = validateUcp(ucp);
    assert.ok(warnings.some((w) => w.includes("not in standard domains")));
  });

  it("warns on invalid trust tier", () => {
    const ucp = new UCPBuilder()
      .addCapability({ domain: "development" })
      .trustTier("bogus")
      .build();
    const warnings = validateUcp(ucp);
    assert.ok(warnings.some((w) => w.includes("trust_tier")));
  });
});

// ---------------------------------------------------------------------------
// UCP Converters
// ---------------------------------------------------------------------------

describe("UCP Converters", () => {
  it("fromA2aAgentCard", () => {
    const card = {
      name: "ResearchBot",
      url: "https://example.com/a2a",
      description: "Research assistant",
      skills: [
        { name: "web_search", description: "Search the web for information", inputModes: ["text"], outputModes: ["text", "json"] },
      ],
    };
    const ucp = fromA2aAgentCard(card);
    assert.equal(ucp.identity.a2aCard, "https://example.com/a2a");
    assert.equal(ucp.trustTier, "attested");
    assert.equal(ucp.capabilities.length, 1);
    assert.ok(ucp.capabilities[0].description.includes("Search the web"));
    assert.equal(ucp.extensions.source_format, "a2a_agent_card");
  });

  it("fromMcpManifest", () => {
    const manifest = {
      tools: [
        { name: "code_review", description: "Review code for security vulnerabilities" },
        { name: "deploy", description: "Deploy application to cloud infrastructure" },
      ],
    };
    const ucp = fromMcpManifest(manifest);
    assert.equal(ucp.capabilities.length, 2);
    assert.equal(ucp.trustTier, "declared");
    assert.equal(ucp.extensions.tool_count, 2);
  });

  it("fromOpenclawSkill", () => {
    const skill = { name: "data-analyst", description: "Analyze data sets", required_binaries: ["python3", "pandas"] };
    const ucp = fromOpenclawSkill(skill);
    assert.equal(ucp.identity.registries[0].registryType, "clawhub");
    assert.equal(ucp.trustTier, "attested");
    assert.deepEqual(ucp.capabilities[0].toolsUsed, ["python3", "pandas"]);
  });

  it("inferDomain identifies common domains", () => {
    assert.equal(inferDomain("code review and software development"), "development");
    assert.equal(inferDomain("security audit and vulnerability scanning"), "security");
    assert.equal(inferDomain("data analysis and statistical modeling"), "analysis");
    assert.equal(inferDomain("something completely unrelated xyz"), "domain_specific");
  });
});

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

describe("Discovery", () => {
  it("translateToFederationQuery", () => {
    const req = makeRequest({ description: "Test query", domain: "research" });
    const fq = translateToFederationQuery(req);
    assert.equal(fq.queryText, "Test query");
    assert.equal(fq.domain, "research");
    assert.ok(fq.maxResults > req.constraints.maxResults);
  });

  it("normalizeResults tags source registry", () => {
    const ucp = makeUcp({ ampId: "norm-test" });
    const result = normalizeResults([ucp], "clawhub");
    assert.ok(result[0].identity.registries.some((r) => r.registryType === "clawhub"));
  });

  it("normalizeResults skips empty amp_id", () => {
    const ucp = new UnifiedCapabilityProfile();
    ucp.identity.ampId = "";
    const result = normalizeResults([ucp]);
    assert.equal(result.length, 0);
  });

  it("deduplicate merges by DID", () => {
    const ucp1 = makeUcp({ ampId: "a1" });
    ucp1.identity.did = "did:web:example";
    ucp1.trustTier = "declared";
    const ucp2 = makeUcp({ ampId: "a2" });
    ucp2.identity.did = "did:web:example";
    ucp2.trustTier = "verified";
    const result = deduplicate([ucp1, ucp2]);
    assert.equal(result.length, 1);
    assert.equal(result[0].trustTier, "verified");
  });

  it("deduplicate keeps distinct agents", () => {
    const ucp1 = makeUcp({ ampId: "distinct-1" });
    const ucp2 = makeUcp({ ampId: "distinct-2" });
    const result = deduplicate([ucp1, ucp2]);
    assert.equal(result.length, 2);
  });

  it("discover pipeline", () => {
    const req = makeRequest();
    const ucp1 = makeUcp({ ampId: "disc-1" });
    const ucp2 = makeUcp({ ampId: "disc-2" });
    const registryUcps = { local: [ucp1], clawhub: [ucp2] };
    const result = discover(req, registryUcps);
    assert.equal(result.length, 2);
  });
});

// ---------------------------------------------------------------------------
// Federation
// ---------------------------------------------------------------------------

describe("Federation", () => {
  it("FederationRouter with StaticAdapter", () => {
    const router = new FederationRouter();
    const ucp = makeUcp({ ampId: "fed-1", description: "Build APIs" });
    router.register(new StaticAdapter([ucp], "test-registry"));

    assert.deepEqual(router.registryNames, ["test-registry"]);

    const req = makeRequest({ description: "Build" });
    const results = router.query(req);
    assert.equal(results.length, 1);
    assert.equal(results[0].registryName, "test-registry");
    assert.ok(results[0].ucps.length >= 1);
  });

  it("FederationRouter with CallbackAdapter", () => {
    const router = new FederationRouter();
    const ucp = makeUcp({ ampId: "cb-1" });
    router.register(new CallbackAdapter("custom", () => [ucp]));

    const req = makeRequest();
    const ucps = router.federatedSearch(req);
    assert.ok(ucps.length >= 1);
  });

  it("FederationRouter handles adapter errors", () => {
    const router = new FederationRouter();
    router.register(new CallbackAdapter("failing", () => { throw new Error("boom"); }));

    const req = makeRequest();
    const results = router.query(req);
    assert.equal(results.length, 1);
    assert.ok(results[0].error.includes("boom"));
    assert.equal(results[0].ucps.length, 0);
  });

  it("FederationRouter unregister", () => {
    const router = new FederationRouter();
    router.register(new StaticAdapter([], "to-remove"));
    assert.equal(router.registryNames.length, 1);
    router.unregister("to-remove");
    assert.equal(router.registryNames.length, 0);
  });

  it("FederationRouter filters by registry list", () => {
    const router = new FederationRouter();
    router.register(new StaticAdapter([makeUcp({ ampId: "r1" })], "registry-a"));
    router.register(new StaticAdapter([makeUcp({ ampId: "r2" })], "registry-b"));

    const req = makeRequest();
    const results = router.query(req, ["registry-a"]);
    assert.equal(results.length, 1);
    assert.equal(results[0].registryName, "registry-a");
  });
});

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

describe("Pricing", () => {
  it("estimateCost basic calculation", () => {
    const ucp = makeUcp({ basePrice: 1.0 });
    const cost = estimateCost(ucp);
    assert.ok(cost >= 1.0);
  });

  it("postedPrice returns results for all candidates", () => {
    const candidates = [makeUcp({ ampId: "p1" }), makeUcp({ ampId: "p2" })];
    const results = postedPrice(candidates);
    assert.equal(results.length, 2);
    assert.ok(results[0].toDict().estimated_cost >= 0);
  });

  it("Quote round-trip", () => {
    const q = new Quote({ agentId: "a1", amount: 5.5, terms: "net-30" });
    const d = q.toDict();
    assert.equal(d.agent_id, "a1");
    assert.equal(d.amount, 5.5);
    const q2 = Quote.fromDict(d);
    assert.equal(q2.agentId, "a1");
    assert.equal(q2.terms, "net-30");
  });

  it("RFQSession rank and select", () => {
    const req = makeRequest();
    const session = new RFQSession(req);

    session.addQuote(new Quote({ agentId: "a1", amount: 10.0 }));
    session.addQuote(new Quote({ agentId: "a2", amount: 5.0 }));
    session.addQuote(new Quote({ agentId: "a3", amount: 15.0 }));

    const ranked = session.rankQuotes({ a1: 80, a2: 70, a3: 60 });
    assert.equal(ranked.length, 3);

    const q2 = session.quotes.find((q) => q.agentId === "a2")!;
    const selected = session.select(q2.quoteId);
    assert.ok(selected);
    assert.equal(session.selectedQuote!.agentId, "a2");

    const d = session.toDict();
    assert.ok(d.rfq_id);
    assert.equal((d.selected_quote as any).agent_id, "a2");
  });

  it("RFQSession select returns null for unknown quote", () => {
    const session = new RFQSession(makeRequest());
    assert.equal(session.select("nonexistent"), null);
  });

  it("Bid round-trip", () => {
    const b = new Bid({ agentId: "b1", amount: 3.0 });
    const d = b.toDict();
    const b2 = Bid.fromDict(d);
    assert.equal(b2.agentId, "b1");
    assert.equal(b2.amount, 3.0);
  });

  it("vickreyAuction: winner pays second price", () => {
    const bids = [
      new Bid({ agentId: "a1", amount: 10 }),
      new Bid({ agentId: "a2", amount: 5 }),
      new Bid({ agentId: "a3", amount: 8 }),
    ];
    const result = vickreyAuction(bids);
    assert.ok(result);
    assert.equal(result!.winnerId, "a2");
    assert.equal(result!.winningBid, 5);
    assert.equal(result!.clearingPrice, 8);
    assert.equal(result!.format, "vickrey");
    assert.equal(result!.totalBids, 3);
  });

  it("vickreyAuction: single bid pays own price", () => {
    const bids = [new Bid({ agentId: "solo", amount: 7 })];
    const result = vickreyAuction(bids);
    assert.ok(result);
    assert.equal(result!.clearingPrice, 7);
  });

  it("vickreyAuction: trust filter", () => {
    const bids = [
      new Bid({ agentId: "trusted", amount: 10 }),
      new Bid({ agentId: "untrusted", amount: 5 }),
    ];
    const result = vickreyAuction(bids, 50, { trusted: 80, untrusted: 30 });
    assert.ok(result);
    assert.equal(result!.winnerId, "trusted");
  });

  it("vickreyAuction: no qualified returns null", () => {
    const bids = [new Bid({ agentId: "low", amount: 5 })];
    const result = vickreyAuction(bids, 50, { low: 10 });
    assert.equal(result, null);
  });

  it("englishAuction: lowest bidder wins at own price", () => {
    const bids = [
      new Bid({ agentId: "a1", amount: 10 }),
      new Bid({ agentId: "a2", amount: 3 }),
    ];
    const result = englishAuction(bids);
    assert.ok(result);
    assert.equal(result!.winnerId, "a2");
    assert.equal(result!.clearingPrice, 3);
    assert.equal(result!.format, "english");
  });
});

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

describe("MatchmakingStore", () => {
  let store: MatchmakingStore;

  beforeEach(() => {
    store = new MatchmakingStore(TEST_STORE_DIR);
  });

  afterEach(() => {
    try { rmSync(TEST_STORE_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  it("save and retrieve UCP", () => {
    const ucp = makeUcp({ ampId: "store-test" });
    store.saveUcp(ucp);
    const retrieved = store.getUcp("store-test");
    assert.ok(retrieved);
    assert.equal(retrieved!.ampId, "store-test");
  });

  it("getAllUcps returns all saved", () => {
    store.saveUcp(makeUcp({ ampId: "s1" }));
    store.saveUcp(makeUcp({ ampId: "s2" }));
    const all = store.getAllUcps();
    assert.equal(all.length, 2);
  });

  it("getUcp returns latest snapshot", () => {
    const ucp1 = makeUcp({ ampId: "evolving", arpComposite: 50 });
    store.saveUcp(ucp1);
    const ucp2 = makeUcp({ ampId: "evolving", arpComposite: 90 });
    store.saveUcp(ucp2);
    const latest = store.getUcp("evolving");
    assert.ok(latest);
    assert.equal(latest!.performance.quality.arpCompositeScore, 90);
  });

  it("getUcpsByDomain", () => {
    store.saveUcp(makeUcp({ ampId: "dev1", domain: "development" }));
    store.saveUcp(makeUcp({ ampId: "res1", domain: "research" }));
    const devs = store.getUcpsByDomain("development");
    assert.equal(devs.length, 1);
    assert.equal(devs[0].ampId, "dev1");
  });

  it("searchUcps by text", () => {
    store.saveUcp(makeUcp({ ampId: "api-builder", description: "Build REST APIs" }));
    store.saveUcp(makeUcp({ ampId: "ml-trainer", description: "Train ML models" }));
    const results = store.searchUcps("", "", "rest");
    assert.equal(results.length, 1);
    assert.equal(results[0].ampId, "api-builder");
  });

  it("searchUcps by domain", () => {
    store.saveUcp(makeUcp({ ampId: "d1", domain: "development" }));
    store.saveUcp(makeUcp({ ampId: "d2", domain: "research" }));
    const results = store.searchUcps("research");
    assert.equal(results.length, 1);
    assert.equal(results[0].ampId, "d2");
  });

  it("save and retrieve request", () => {
    const req = makeRequest({ description: "Store test" });
    store.saveRequest(req);
    const retrieved = store.getRequest(req.requestId);
    assert.ok(retrieved);
    assert.equal(retrieved!.task.description, "Store test");
  });

  it("save and retrieve response", () => {
    const resp = new MatchResponse({
      requestId: "resp-test",
      results: [new MatchResult({ rank: 1, agentId: "a1" })],
    });
    store.saveResponse(resp);
    const all = store.getResponses();
    assert.equal(all.length, 1);
    assert.equal(all[0].requestId, "resp-test");
  });

  it("save and retrieve federation result", () => {
    const fr = new FederationResult({ registryName: "local", queryTimeMs: 10 });
    store.saveFederationResult(fr);
    const all = store.getFederationResults();
    assert.equal(all.length, 1);
    assert.equal(all[0].registryName, "local");
  });

  it("stats returns correct counts", () => {
    store.saveUcp(makeUcp({ ampId: "stat1", domain: "development" }));
    store.saveUcp(makeUcp({ ampId: "stat2", domain: "research" }));
    store.saveRequest(makeRequest());

    const s = store.stats() as any;
    assert.equal(s.ucps.unique_count, 2);
    assert.equal(s.ucps.snapshots_count, 2);
    assert.equal(s.requests.count, 1);
    assert.equal(s.ucps.by_domain.development, 1);
    assert.equal(s.ucps.by_domain.research, 1);
  });

  it("getUcp returns null for missing", () => {
    assert.equal(store.getUcp("nonexistent"), null);
  });

  it("getRequest returns null for missing", () => {
    assert.equal(store.getRequest("nonexistent"), null);
  });
});

// ---------------------------------------------------------------------------
// Integration — Full Workflow
// ---------------------------------------------------------------------------

describe("Integration — Full Workflow", () => {
  let store: MatchmakingStore;

  beforeEach(() => {
    store = new MatchmakingStore(TEST_STORE_DIR + "-integ");
  });

  afterEach(() => {
    try { rmSync(TEST_STORE_DIR + "-integ", { recursive: true }); } catch { /* ignore */ }
  });

  it("register -> match -> auction end-to-end", () => {
    // Register agents
    const agents = [
      makeUcp({ ampId: "agent-a", domain: "development", description: "Frontend React development", arpComposite: 85, asaCompletionRate: 0.95, asaSampleSize: 100, basePrice: 0.08 }),
      makeUcp({ ampId: "agent-b", domain: "development", description: "Backend API development", arpComposite: 90, asaCompletionRate: 0.92, asaSampleSize: 80, basePrice: 0.12 }),
      makeUcp({ ampId: "agent-c", domain: "research", description: "Academic literature review", arpComposite: 78, asaCompletionRate: 0.88, asaSampleSize: 60, basePrice: 0.06 }),
    ];
    for (const a of agents) store.saveUcp(a);

    // Match request
    const request = makeRequest({
      description: "Build a React frontend with API integration",
      domain: "development",
      budgetMax: 0.15,
      maxResults: 5,
    });
    store.saveRequest(request);

    // Ranked search
    const candidates = store.getAllUcps();
    const response = rankedSearch(request, candidates);
    store.saveResponse(response);

    assert.ok(response.results.length >= 2);
    assert.equal(response.results[0].rank, 1);
    assert.ok(response.metadata.queryTimeMs >= 0);

    // Vickrey auction among top results
    const bids = response.results.map((r) => new Bid({
      agentId: r.agentId,
      amount: r.compatibilityScore > 20 ? 0.10 : 0.15,
    }));
    const auctionResult = vickreyAuction(bids);
    assert.ok(auctionResult);
    assert.ok(auctionResult!.winnerId);

    // Verify store state
    const stats = store.stats() as any;
    assert.equal(stats.ucps.unique_count, 3);
    assert.equal(stats.requests.count, 1);
    assert.equal(stats.responses.count, 1);
  });

  it("federation -> discovery -> matching pipeline", () => {
    // Set up federation
    const router = new FederationRouter();
    const localUcps = [
      makeUcp({ ampId: "local-1", description: "API development" }),
    ];
    const remoteUcps = [
      makeUcp({ ampId: "remote-1", description: "API development and testing" }),
    ];
    router.register(new StaticAdapter(localUcps, "local"));
    router.register(new StaticAdapter(remoteUcps, "clawhub"));

    // Federated search
    const request = makeRequest({ description: "API development" });
    const discovered = router.federatedSearch(request);

    assert.ok(discovered.length >= 2);

    // Match against discovered agents
    const response = rankedSearch(request, discovered);
    assert.ok(response.results.length >= 1);

    // RFQ session
    const rfq = new RFQSession(request);
    for (const r of response.results) {
      rfq.addQuote(new Quote({ agentId: r.agentId, amount: 0.10 }));
    }
    const ranked = rfq.rankQuotes();
    assert.ok(ranked.length >= 1);
  });
});
