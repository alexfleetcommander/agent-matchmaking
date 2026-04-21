import { createHash, randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------

export const PROTOCOL_VERSION = "1.0.0";
export const SCHEMA_VERSION = "1.0.0";

export const CAPABILITY_DOMAINS = [
  "research", "development", "analysis", "communication",
  "operations", "creative", "security", "domain_specific",
] as const;
export type CapabilityDomain = (typeof CAPABILITY_DOMAINS)[number];

export const TRUST_TIERS = ["declared", "attested", "measured", "verified"] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

export const TRUST_TIER_WEIGHTS: Record<string, number> = {
  declared: 0.25,
  attested: 0.50,
  measured: 0.75,
  verified: 1.00,
};

export const MATCHING_MODES = ["ranked_search", "stable_matching", "auction"] as const;
export type MatchingMode = (typeof MATCHING_MODES)[number];

export const PRICING_MECHANISMS = ["posted_price", "rfq", "auction"] as const;
export type PricingMechanism = (typeof PRICING_MECHANISMS)[number];

export const AUCTION_FORMATS = ["english", "vickrey", "combinatorial"] as const;
export type AuctionFormat = (typeof AUCTION_FORMATS)[number];

export const LIFECYCLE_STATUSES = [
  "operational", "provisioned", "migrating", "retraining",
  "suspended", "deprecated", "decommissioned",
] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const ACTIVE_STATUSES: readonly string[] = ["operational"];
export const INACTIVE_STATUSES: readonly string[] = ["deprecated", "decommissioned"];

export const DEFAULT_WEIGHTS: Record<string, number> = {
  capability_match: 0.30,
  trust_score: 0.25,
  cost_alignment: 0.15,
  availability: 0.10,
  style_compatibility: 0.05,
  domain_relevance: 0.15,
};

export const DEFAULT_TRUST_WEIGHTS: Record<string, number> = {
  identity: 0.20,
  performance: 0.40,
  reliability: 0.25,
  risk: 0.15,
};

export const DEFAULT_TRUST_BASELINE = 40;

export const TRUST_BASELINE_ADJUSTMENTS: Record<string, number> = {
  corporate_marketplace_validation: 15,
  community_reviews_10plus: 10,
  a2a_card_verified_domain: 5,
  did_verifiable_controller: 5,
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

export function genId(prefix = "amp"): string {
  return `${prefix}-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function hashDict(d: Record<string, unknown>): string {
  const canonicalStr = canonicalJsonStringify(d);
  return createHash("sha256").update(canonicalStr, "utf-8").digest("hex");
}

function canonicalJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalJsonStringify(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((k) => JSON.stringify(k) + ":" + canonicalJsonStringify(obj[k]));
    return "{" + pairs.join(",") + "}";
  }
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// Dict interfaces (snake_case for wire format)
// ---------------------------------------------------------------------------

export interface RegistryListingDict {
  type: string;
  listing_id: string;
}

export interface IdentityDict {
  amp_id: string;
  a2a_card: string;
  coc_chain_id: string;
  did: string;
  registries: RegistryListingDict[];
}

export interface TaxonomyCodesDict {
  onet_soc: string;
  amp_capability: string;
}

export interface ComplexityRangeDict {
  min: string;
  max: string;
}

export interface CapabilityDict {
  domain: string;
  subdomain: string;
  description: string;
  input_modalities: string[];
  output_modalities: string[];
  tools_used: string[];
  complexity_range: ComplexityRangeDict;
  taxonomy_codes: TaxonomyCodesDict;
}

export interface ReliabilityMetricsDict {
  asa_completion_rate: number;
  asa_sample_size: number;
  uptime_30d: number;
}

export interface QualityMetricsDict {
  arp_composite_score: number;
  arp_dimensional_scores: Record<string, number>;
  qv_pass_rate: number;
  qv_sample_size: number;
}

export interface SpeedMetricsDict {
  median_response_time_ms: number;
  p95_response_time_ms: number;
  throughput_tasks_per_hour: number;
}

export interface DisputeProfileDict {
  ajp_dispute_rate: number;
  ajp_favorable_resolution_rate: number;
  ajp_sample_size: number;
}

export interface PerformanceDict {
  reliability: ReliabilityMetricsDict;
  quality: QualityMetricsDict;
  speed: SpeedMetricsDict;
  dispute_profile: DisputeProfileDict;
}

export interface CostRateDict {
  amount: number;
  currency: string;
  per: string;
}

export interface FreeTierDict {
  requests_per_month: number;
}

export interface CostDict {
  pricing_model: string;
  base_rate: CostRateDict;
  variable_rate: CostRateDict;
  supports_negotiation: boolean;
  supports_auction: boolean;
  payment_rails: string[];
  free_tier?: FreeTierDict;
}

export interface CapacityDict {
  current_load_pct: number;
  max_concurrent_tasks: number;
  estimated_queue_time_ms: number;
}

export interface AvailabilityDict {
  status: string;
  alp_lifecycle_stage: string;
  capacity: CapacityDict;
}

export interface UCPDict {
  schema_version: string;
  protocol_version: string;
  identity: IdentityDict;
  capabilities: CapabilityDict[];
  performance: PerformanceDict;
  cost: CostDict;
  availability: AvailabilityDict;
  extensions: Record<string, unknown>;
  trust_tier: string;
  created_at: string;
  updated_at: string;
}

export interface TaskDescriptionDict {
  description: string;
  domain: string;
  subdomain: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  deadline_ms: number;
  budget: { max_amount: number; currency: string };
}

export interface MatchConstraintsDict {
  min_trust_score: number;
  max_dispute_rate: number;
  required_lifecycle_status: string[];
  excluded_agents: string[];
  required_registries: string[];
  max_results: number;
}

export interface FederationConfigDict {
  registries: string[];
  timeout_ms: number;
}

export interface MatchRequestDict {
  match_request: {
    request_id: string;
    requester_id: string;
    task: TaskDescriptionDict;
    weights: Record<string, number>;
    constraints: MatchConstraintsDict;
    federation: FederationConfigDict;
    matching_mode: string;
    price_discovery: string;
    timestamp: string;
  };
}

export interface TrustVerificationDict {
  coc_chain_verified: boolean;
  coc_chain_length_days: number;
  arp_score_verified: boolean;
  asa_history_verified: boolean;
  ajp_record_verified: boolean;
  verification_timestamp: string;
}

export interface MatchResultDict {
  rank: number;
  agent_id: string;
  compatibility_score: number;
  dimensional_scores: Record<string, number>;
  ucp_summary: Record<string, unknown>;
  trust_verification: TrustVerificationDict;
  registries_found_on: string[];
}

export interface MatchMetadataDict {
  registries_queried: number;
  registries_responded: number;
  total_candidates_evaluated: number;
  candidates_filtered_by_constraints: number;
  candidates_scored: number;
  query_time_ms: number;
}

export interface MatchResponseDict {
  match_response: {
    request_id: string;
    timestamp: string;
    results: MatchResultDict[];
    metadata: MatchMetadataDict;
  };
}

export interface FederationQueryDict {
  query: {
    text: string;
    domain: string;
    subdomain: string;
    constraints: Record<string, unknown>;
    max_results: number;
  };
}

export interface FederationResultDict {
  registry_name: string;
  ucps: UCPDict[];
  query_time_ms: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Data classes — Identity Section (Section 5.2.1)
// ---------------------------------------------------------------------------

export class RegistryListing {
  registryType: string;
  listingId: string;

  constructor(registryType = "", listingId = "") {
    this.registryType = registryType;
    this.listingId = listingId;
  }

  toDict(): RegistryListingDict {
    return { type: this.registryType, listing_id: this.listingId };
  }

  static fromDict(d: Partial<RegistryListingDict>): RegistryListing {
    return new RegistryListing(d.type ?? "", d.listing_id ?? "");
  }
}

export class Identity {
  ampId: string;
  a2aCard: string;
  cocChainId: string;
  did: string;
  registries: RegistryListing[];

  constructor(opts: {
    ampId?: string;
    a2aCard?: string;
    cocChainId?: string;
    did?: string;
    registries?: RegistryListing[];
  } = {}) {
    this.ampId = opts.ampId || genId("amp:agent");
    this.a2aCard = opts.a2aCard ?? "";
    this.cocChainId = opts.cocChainId ?? "";
    this.did = opts.did ?? "";
    this.registries = opts.registries ?? [];
  }

  toDict(): IdentityDict {
    return {
      amp_id: this.ampId,
      a2a_card: this.a2aCard,
      coc_chain_id: this.cocChainId,
      did: this.did,
      registries: this.registries.map((r) => r.toDict()),
    };
  }

  static fromDict(d: Partial<IdentityDict>): Identity {
    return new Identity({
      ampId: d.amp_id ?? "",
      a2aCard: d.a2a_card ?? "",
      cocChainId: d.coc_chain_id ?? "",
      did: d.did ?? "",
      registries: (d.registries ?? []).map((r) => RegistryListing.fromDict(r)),
    });
  }
}

// ---------------------------------------------------------------------------
// Data classes — Capability Section (Section 5.2.2)
// ---------------------------------------------------------------------------

export class TaxonomyCodes {
  onetSoc: string;
  ampCapability: string;

  constructor(onetSoc = "", ampCapability = "") {
    this.onetSoc = onetSoc;
    this.ampCapability = ampCapability;
  }

  toDict(): TaxonomyCodesDict {
    return { onet_soc: this.onetSoc, amp_capability: this.ampCapability };
  }

  static fromDict(d: Partial<TaxonomyCodesDict>): TaxonomyCodes {
    return new TaxonomyCodes(d.onet_soc ?? "", d.amp_capability ?? "");
  }
}

export class ComplexityRange {
  minDesc: string;
  maxDesc: string;

  constructor(minDesc = "", maxDesc = "") {
    this.minDesc = minDesc;
    this.maxDesc = maxDesc;
  }

  toDict(): ComplexityRangeDict {
    return { min: this.minDesc, max: this.maxDesc };
  }

  static fromDict(d: Partial<ComplexityRangeDict>): ComplexityRange {
    return new ComplexityRange(d.min ?? "", d.max ?? "");
  }
}

export class Capability {
  domain: string;
  subdomain: string;
  description: string;
  inputModalities: string[];
  outputModalities: string[];
  toolsUsed: string[];
  complexityRange: ComplexityRange;
  taxonomyCodes: TaxonomyCodes;

  constructor(opts: {
    domain?: string;
    subdomain?: string;
    description?: string;
    inputModalities?: string[];
    outputModalities?: string[];
    toolsUsed?: string[];
    complexityRange?: ComplexityRange;
    taxonomyCodes?: TaxonomyCodes;
  } = {}) {
    this.domain = opts.domain ?? "";
    this.subdomain = opts.subdomain ?? "";
    this.description = opts.description ?? "";
    this.inputModalities = opts.inputModalities ?? [];
    this.outputModalities = opts.outputModalities ?? [];
    this.toolsUsed = opts.toolsUsed ?? [];
    this.complexityRange = opts.complexityRange ?? new ComplexityRange();
    this.taxonomyCodes = opts.taxonomyCodes ?? new TaxonomyCodes();
  }

  toDict(): CapabilityDict {
    return {
      domain: this.domain,
      subdomain: this.subdomain,
      description: this.description,
      input_modalities: this.inputModalities,
      output_modalities: this.outputModalities,
      tools_used: this.toolsUsed,
      complexity_range: this.complexityRange.toDict(),
      taxonomy_codes: this.taxonomyCodes.toDict(),
    };
  }

  static fromDict(d: Partial<CapabilityDict>): Capability {
    return new Capability({
      domain: d.domain ?? "",
      subdomain: d.subdomain ?? "",
      description: d.description ?? "",
      inputModalities: d.input_modalities ?? [],
      outputModalities: d.output_modalities ?? [],
      toolsUsed: d.tools_used ?? [],
      complexityRange: ComplexityRange.fromDict(d.complexity_range ?? {}),
      taxonomyCodes: TaxonomyCodes.fromDict(d.taxonomy_codes ?? {}),
    });
  }
}

// ---------------------------------------------------------------------------
// Data classes — Performance Section (Section 5.2.3)
// ---------------------------------------------------------------------------

export class ReliabilityMetrics {
  asaCompletionRate: number;
  asaSampleSize: number;
  uptime30d: number;

  constructor(asaCompletionRate = 0, asaSampleSize = 0, uptime30d = 0) {
    this.asaCompletionRate = asaCompletionRate;
    this.asaSampleSize = asaSampleSize;
    this.uptime30d = uptime30d;
  }

  toDict(): ReliabilityMetricsDict {
    return {
      asa_completion_rate: this.asaCompletionRate,
      asa_sample_size: this.asaSampleSize,
      uptime_30d: this.uptime30d,
    };
  }

  static fromDict(d: Partial<ReliabilityMetricsDict>): ReliabilityMetrics {
    return new ReliabilityMetrics(
      d.asa_completion_rate ?? 0,
      d.asa_sample_size ?? 0,
      d.uptime_30d ?? 0,
    );
  }
}

export class QualityMetrics {
  arpCompositeScore: number;
  arpDimensionalScores: Record<string, number>;
  qvPassRate: number;
  qvSampleSize: number;

  constructor(opts: {
    arpCompositeScore?: number;
    arpDimensionalScores?: Record<string, number>;
    qvPassRate?: number;
    qvSampleSize?: number;
  } = {}) {
    this.arpCompositeScore = opts.arpCompositeScore ?? 0;
    this.arpDimensionalScores = opts.arpDimensionalScores ?? {};
    this.qvPassRate = opts.qvPassRate ?? 0;
    this.qvSampleSize = opts.qvSampleSize ?? 0;
  }

  toDict(): QualityMetricsDict {
    return {
      arp_composite_score: this.arpCompositeScore,
      arp_dimensional_scores: { ...this.arpDimensionalScores },
      qv_pass_rate: this.qvPassRate,
      qv_sample_size: this.qvSampleSize,
    };
  }

  static fromDict(d: Partial<QualityMetricsDict>): QualityMetrics {
    return new QualityMetrics({
      arpCompositeScore: d.arp_composite_score ?? 0,
      arpDimensionalScores: d.arp_dimensional_scores ?? {},
      qvPassRate: d.qv_pass_rate ?? 0,
      qvSampleSize: d.qv_sample_size ?? 0,
    });
  }
}

export class SpeedMetrics {
  medianResponseTimeMs: number;
  p95ResponseTimeMs: number;
  throughputTasksPerHour: number;

  constructor(medianMs = 0, p95Ms = 0, throughput = 0) {
    this.medianResponseTimeMs = medianMs;
    this.p95ResponseTimeMs = p95Ms;
    this.throughputTasksPerHour = throughput;
  }

  toDict(): SpeedMetricsDict {
    return {
      median_response_time_ms: this.medianResponseTimeMs,
      p95_response_time_ms: this.p95ResponseTimeMs,
      throughput_tasks_per_hour: this.throughputTasksPerHour,
    };
  }

  static fromDict(d: Partial<SpeedMetricsDict>): SpeedMetrics {
    return new SpeedMetrics(
      d.median_response_time_ms ?? 0,
      d.p95_response_time_ms ?? 0,
      d.throughput_tasks_per_hour ?? 0,
    );
  }
}

export class DisputeProfile {
  ajpDisputeRate: number;
  ajpFavorableResolutionRate: number;
  ajpSampleSize: number;

  constructor(disputeRate = 0, favorableRate = 0, sampleSize = 0) {
    this.ajpDisputeRate = disputeRate;
    this.ajpFavorableResolutionRate = favorableRate;
    this.ajpSampleSize = sampleSize;
  }

  toDict(): DisputeProfileDict {
    return {
      ajp_dispute_rate: this.ajpDisputeRate,
      ajp_favorable_resolution_rate: this.ajpFavorableResolutionRate,
      ajp_sample_size: this.ajpSampleSize,
    };
  }

  static fromDict(d: Partial<DisputeProfileDict>): DisputeProfile {
    return new DisputeProfile(
      d.ajp_dispute_rate ?? 0,
      d.ajp_favorable_resolution_rate ?? 0,
      d.ajp_sample_size ?? 0,
    );
  }
}

export class Performance {
  reliability: ReliabilityMetrics;
  quality: QualityMetrics;
  speed: SpeedMetrics;
  disputeProfile: DisputeProfile;

  constructor(opts: {
    reliability?: ReliabilityMetrics;
    quality?: QualityMetrics;
    speed?: SpeedMetrics;
    disputeProfile?: DisputeProfile;
  } = {}) {
    this.reliability = opts.reliability ?? new ReliabilityMetrics();
    this.quality = opts.quality ?? new QualityMetrics();
    this.speed = opts.speed ?? new SpeedMetrics();
    this.disputeProfile = opts.disputeProfile ?? new DisputeProfile();
  }

  toDict(): PerformanceDict {
    return {
      reliability: this.reliability.toDict(),
      quality: this.quality.toDict(),
      speed: this.speed.toDict(),
      dispute_profile: this.disputeProfile.toDict(),
    };
  }

  static fromDict(d: Partial<PerformanceDict>): Performance {
    return new Performance({
      reliability: ReliabilityMetrics.fromDict(d.reliability ?? {}),
      quality: QualityMetrics.fromDict(d.quality ?? {}),
      speed: SpeedMetrics.fromDict(d.speed ?? {}),
      disputeProfile: DisputeProfile.fromDict(d.dispute_profile ?? {}),
    });
  }
}

// ---------------------------------------------------------------------------
// Data classes — Cost Section (Section 5.2.4)
// ---------------------------------------------------------------------------

export class CostRate {
  amount: number;
  currency: string;
  per: string;

  constructor(amount = 0, currency = "USD", per = "request") {
    this.amount = amount;
    this.currency = currency;
    this.per = per;
  }

  toDict(): CostRateDict {
    return { amount: this.amount, currency: this.currency, per: this.per };
  }

  static fromDict(d: Partial<CostRateDict>): CostRate {
    return new CostRate(d.amount ?? 0, d.currency ?? "USD", d.per ?? "request");
  }
}

export class FreeTier {
  requestsPerMonth: number;

  constructor(requestsPerMonth = 0) {
    this.requestsPerMonth = requestsPerMonth;
  }

  toDict(): FreeTierDict {
    return { requests_per_month: this.requestsPerMonth };
  }

  static fromDict(d: Partial<FreeTierDict>): FreeTier {
    return new FreeTier(d.requests_per_month ?? 0);
  }
}

export class Cost {
  pricingModel: string;
  baseRate: CostRate;
  variableRate: CostRate;
  supportsNegotiation: boolean;
  supportsAuction: boolean;
  paymentRails: string[];
  freeTier: FreeTier | null;

  constructor(opts: {
    pricingModel?: string;
    baseRate?: CostRate;
    variableRate?: CostRate;
    supportsNegotiation?: boolean;
    supportsAuction?: boolean;
    paymentRails?: string[];
    freeTier?: FreeTier | null;
  } = {}) {
    this.pricingModel = opts.pricingModel ?? "posted_price";
    this.baseRate = opts.baseRate ?? new CostRate();
    this.variableRate = opts.variableRate ?? new CostRate(0, "USD", "output_token");
    this.supportsNegotiation = opts.supportsNegotiation ?? false;
    this.supportsAuction = opts.supportsAuction ?? false;
    this.paymentRails = opts.paymentRails ?? [];
    this.freeTier = opts.freeTier ?? null;
  }

  toDict(): CostDict {
    const d: CostDict = {
      pricing_model: this.pricingModel,
      base_rate: this.baseRate.toDict(),
      variable_rate: this.variableRate.toDict(),
      supports_negotiation: this.supportsNegotiation,
      supports_auction: this.supportsAuction,
      payment_rails: this.paymentRails,
    };
    if (this.freeTier) {
      d.free_tier = this.freeTier.toDict();
    }
    return d;
  }

  static fromDict(d: Partial<CostDict>): Cost {
    const ft = d.free_tier;
    return new Cost({
      pricingModel: d.pricing_model ?? "posted_price",
      baseRate: CostRate.fromDict(d.base_rate ?? {}),
      variableRate: CostRate.fromDict(d.variable_rate ?? {}),
      supportsNegotiation: d.supports_negotiation ?? false,
      supportsAuction: d.supports_auction ?? false,
      paymentRails: d.payment_rails ?? [],
      freeTier: ft ? FreeTier.fromDict(ft) : null,
    });
  }
}

// ---------------------------------------------------------------------------
// Data classes — Availability Section (Section 5.2.5)
// ---------------------------------------------------------------------------

export class Capacity {
  currentLoadPct: number;
  maxConcurrentTasks: number;
  estimatedQueueTimeMs: number;

  constructor(loadPct = 0, maxConcurrent = 1, queueTimeMs = 0) {
    this.currentLoadPct = loadPct;
    this.maxConcurrentTasks = maxConcurrent;
    this.estimatedQueueTimeMs = queueTimeMs;
  }

  toDict(): CapacityDict {
    return {
      current_load_pct: this.currentLoadPct,
      max_concurrent_tasks: this.maxConcurrentTasks,
      estimated_queue_time_ms: this.estimatedQueueTimeMs,
    };
  }

  static fromDict(d: Partial<CapacityDict>): Capacity {
    return new Capacity(
      d.current_load_pct ?? 0,
      d.max_concurrent_tasks ?? 1,
      d.estimated_queue_time_ms ?? 0,
    );
  }
}

export class Availability {
  status: string;
  alpLifecycleStage: string;
  capacity: Capacity;

  constructor(status = "active", alpLifecycleStage = "operational", capacity?: Capacity) {
    this.status = status;
    this.alpLifecycleStage = alpLifecycleStage;
    this.capacity = capacity ?? new Capacity();
  }

  toDict(): AvailabilityDict {
    return {
      status: this.status,
      alp_lifecycle_stage: this.alpLifecycleStage,
      capacity: this.capacity.toDict(),
    };
  }

  static fromDict(d: Partial<AvailabilityDict>): Availability {
    return new Availability(
      d.status ?? "active",
      d.alp_lifecycle_stage ?? "operational",
      Capacity.fromDict(d.capacity ?? {}),
    );
  }
}

// ---------------------------------------------------------------------------
// Unified Capability Profile (Section 5.2)
// ---------------------------------------------------------------------------

export class UnifiedCapabilityProfile {
  identity: Identity;
  capabilities: Capability[];
  performance: Performance;
  cost: Cost;
  availability: Availability;
  extensions: Record<string, unknown>;
  trustTier: string;
  createdAt: string;
  updatedAt: string;

  constructor(opts: {
    identity?: Identity;
    capabilities?: Capability[];
    performance?: Performance;
    cost?: Cost;
    availability?: Availability;
    extensions?: Record<string, unknown>;
    trustTier?: string;
    createdAt?: string;
    updatedAt?: string;
  } = {}) {
    this.identity = opts.identity ?? new Identity();
    this.capabilities = opts.capabilities ?? [];
    this.performance = opts.performance ?? new Performance();
    this.cost = opts.cost ?? new Cost();
    this.availability = opts.availability ?? new Availability();
    this.extensions = opts.extensions ?? {};
    this.trustTier = opts.trustTier ?? "declared";
    const now = nowIso();
    this.createdAt = opts.createdAt || now;
    this.updatedAt = opts.updatedAt || now;
  }

  get ampId(): string {
    return this.identity.ampId;
  }

  primaryDomain(): string {
    if (this.capabilities.length > 0) return this.capabilities[0].domain;
    return "";
  }

  toDict(): UCPDict {
    return {
      schema_version: SCHEMA_VERSION,
      protocol_version: PROTOCOL_VERSION,
      identity: this.identity.toDict(),
      capabilities: this.capabilities.map((c) => c.toDict()),
      performance: this.performance.toDict(),
      cost: this.cost.toDict(),
      availability: this.availability.toDict(),
      extensions: this.extensions,
      trust_tier: this.trustTier,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
    };
  }

  static fromDict(d: Partial<UCPDict>): UnifiedCapabilityProfile {
    return new UnifiedCapabilityProfile({
      identity: Identity.fromDict(d.identity ?? {}),
      capabilities: (d.capabilities ?? []).map((c) => Capability.fromDict(c)),
      performance: Performance.fromDict(d.performance ?? {}),
      cost: Cost.fromDict(d.cost ?? {}),
      availability: Availability.fromDict(d.availability ?? {}),
      extensions: (d.extensions ?? {}) as Record<string, unknown>,
      trustTier: d.trust_tier ?? "declared",
      createdAt: d.created_at ?? "",
      updatedAt: d.updated_at ?? "",
    });
  }

  hash(): string {
    return hashDict(this.toDict() as unknown as Record<string, unknown>);
  }
}

export const UCP = UnifiedCapabilityProfile;

// ---------------------------------------------------------------------------
// Match Request (Section 6.1)
// ---------------------------------------------------------------------------

export class TaskDescription {
  description: string;
  domain: string;
  subdomain: string;
  inputSpec: Record<string, unknown>;
  outputSpec: Record<string, unknown>;
  deadlineMs: number;
  budgetMax: number;
  budgetCurrency: string;

  constructor(opts: {
    description?: string;
    domain?: string;
    subdomain?: string;
    inputSpec?: Record<string, unknown>;
    outputSpec?: Record<string, unknown>;
    deadlineMs?: number;
    budgetMax?: number;
    budgetCurrency?: string;
  } = {}) {
    this.description = opts.description ?? "";
    this.domain = opts.domain ?? "";
    this.subdomain = opts.subdomain ?? "";
    this.inputSpec = opts.inputSpec ?? {};
    this.outputSpec = opts.outputSpec ?? {};
    this.deadlineMs = opts.deadlineMs ?? 0;
    this.budgetMax = opts.budgetMax ?? 0;
    this.budgetCurrency = opts.budgetCurrency ?? "USD";
  }

  toDict(): TaskDescriptionDict {
    return {
      description: this.description,
      domain: this.domain,
      subdomain: this.subdomain,
      input: this.inputSpec,
      output: this.outputSpec,
      deadline_ms: this.deadlineMs,
      budget: { max_amount: this.budgetMax, currency: this.budgetCurrency },
    };
  }

  static fromDict(d: Partial<TaskDescriptionDict>): TaskDescription {
    const budget = (d.budget ?? {}) as { max_amount?: number; currency?: string };
    return new TaskDescription({
      description: d.description ?? "",
      domain: d.domain ?? "",
      subdomain: d.subdomain ?? "",
      inputSpec: (d.input ?? {}) as Record<string, unknown>,
      outputSpec: (d.output ?? {}) as Record<string, unknown>,
      deadlineMs: d.deadline_ms ?? 0,
      budgetMax: budget.max_amount ?? 0,
      budgetCurrency: budget.currency ?? "USD",
    });
  }
}

export class MatchConstraints {
  minTrustScore: number;
  maxDisputeRate: number;
  requiredLifecycleStatus: string[];
  excludedAgents: string[];
  requiredRegistries: string[];
  maxResults: number;

  constructor(opts: {
    minTrustScore?: number;
    maxDisputeRate?: number;
    requiredLifecycleStatus?: string[];
    excludedAgents?: string[];
    requiredRegistries?: string[];
    maxResults?: number;
  } = {}) {
    this.minTrustScore = opts.minTrustScore ?? 0;
    this.maxDisputeRate = opts.maxDisputeRate ?? 1.0;
    this.requiredLifecycleStatus = opts.requiredLifecycleStatus ?? ["operational"];
    this.excludedAgents = opts.excludedAgents ?? [];
    this.requiredRegistries = opts.requiredRegistries ?? [];
    this.maxResults = opts.maxResults ?? 10;
  }

  toDict(): MatchConstraintsDict {
    return {
      min_trust_score: this.minTrustScore,
      max_dispute_rate: this.maxDisputeRate,
      required_lifecycle_status: this.requiredLifecycleStatus,
      excluded_agents: this.excludedAgents,
      required_registries: this.requiredRegistries,
      max_results: this.maxResults,
    };
  }

  static fromDict(d: Partial<MatchConstraintsDict>): MatchConstraints {
    return new MatchConstraints({
      minTrustScore: d.min_trust_score ?? 0,
      maxDisputeRate: d.max_dispute_rate ?? 1.0,
      requiredLifecycleStatus: d.required_lifecycle_status ?? ["operational"],
      excludedAgents: d.excluded_agents ?? [],
      requiredRegistries: d.required_registries ?? [],
      maxResults: d.max_results ?? 10,
    });
  }
}

export class FederationConfig {
  registries: string[];
  timeoutMs: number;

  constructor(registries?: string[], timeoutMs = 5000) {
    this.registries = registries ?? ["all"];
    this.timeoutMs = timeoutMs;
  }

  toDict(): FederationConfigDict {
    return { registries: this.registries, timeout_ms: this.timeoutMs };
  }

  static fromDict(d: Partial<FederationConfigDict>): FederationConfig {
    return new FederationConfig(d.registries ?? ["all"], d.timeout_ms ?? 5000);
  }
}

export class MatchRequest {
  requestId: string;
  requesterId: string;
  task: TaskDescription;
  weights: Record<string, number>;
  constraints: MatchConstraints;
  federation: FederationConfig;
  matchingMode: string;
  priceDiscovery: string;
  timestamp: string;

  constructor(opts: {
    requestId?: string;
    requesterId?: string;
    task?: TaskDescription;
    weights?: Record<string, number>;
    constraints?: MatchConstraints;
    federation?: FederationConfig;
    matchingMode?: string;
    priceDiscovery?: string;
    timestamp?: string;
  } = {}) {
    this.requestId = opts.requestId || genId("mr");
    this.requesterId = opts.requesterId ?? "";
    this.task = opts.task ?? new TaskDescription();
    this.weights = opts.weights ?? { ...DEFAULT_WEIGHTS };
    this.constraints = opts.constraints ?? new MatchConstraints();
    this.federation = opts.federation ?? new FederationConfig();
    this.matchingMode = opts.matchingMode ?? "ranked_search";
    this.priceDiscovery = opts.priceDiscovery ?? "posted_price";
    this.timestamp = opts.timestamp || nowIso();
  }

  toDict(): MatchRequestDict {
    return {
      match_request: {
        request_id: this.requestId,
        requester_id: this.requesterId,
        task: this.task.toDict(),
        weights: this.weights,
        constraints: this.constraints.toDict(),
        federation: this.federation.toDict(),
        matching_mode: this.matchingMode,
        price_discovery: this.priceDiscovery,
        timestamp: this.timestamp,
      },
    };
  }

  static fromDict(d: Record<string, unknown>): MatchRequest {
    const mr = ((d as any).match_request ?? d) as Record<string, unknown>;
    return new MatchRequest({
      requestId: (mr.request_id as string) ?? "",
      requesterId: (mr.requester_id as string) ?? "",
      task: TaskDescription.fromDict((mr.task ?? {}) as Partial<TaskDescriptionDict>),
      weights: (mr.weights as Record<string, number>) ?? { ...DEFAULT_WEIGHTS },
      constraints: MatchConstraints.fromDict((mr.constraints ?? {}) as Partial<MatchConstraintsDict>),
      federation: FederationConfig.fromDict((mr.federation ?? {}) as Partial<FederationConfigDict>),
      matchingMode: (mr.matching_mode as string) ?? "ranked_search",
      priceDiscovery: (mr.price_discovery as string) ?? "posted_price",
      timestamp: (mr.timestamp as string) ?? "",
    });
  }
}

// ---------------------------------------------------------------------------
// Match Response (Section 6.4)
// ---------------------------------------------------------------------------

export class TrustVerification {
  cocChainVerified: boolean;
  cocChainLengthDays: number;
  arpScoreVerified: boolean;
  asaHistoryVerified: boolean;
  ajpRecordVerified: boolean;
  verificationTimestamp: string;

  constructor(opts: {
    cocChainVerified?: boolean;
    cocChainLengthDays?: number;
    arpScoreVerified?: boolean;
    asaHistoryVerified?: boolean;
    ajpRecordVerified?: boolean;
    verificationTimestamp?: string;
  } = {}) {
    this.cocChainVerified = opts.cocChainVerified ?? false;
    this.cocChainLengthDays = opts.cocChainLengthDays ?? 0;
    this.arpScoreVerified = opts.arpScoreVerified ?? false;
    this.asaHistoryVerified = opts.asaHistoryVerified ?? false;
    this.ajpRecordVerified = opts.ajpRecordVerified ?? false;
    this.verificationTimestamp = opts.verificationTimestamp || nowIso();
  }

  toDict(): TrustVerificationDict {
    return {
      coc_chain_verified: this.cocChainVerified,
      coc_chain_length_days: this.cocChainLengthDays,
      arp_score_verified: this.arpScoreVerified,
      asa_history_verified: this.asaHistoryVerified,
      ajp_record_verified: this.ajpRecordVerified,
      verification_timestamp: this.verificationTimestamp,
    };
  }

  static fromDict(d: Partial<TrustVerificationDict>): TrustVerification {
    return new TrustVerification({
      cocChainVerified: d.coc_chain_verified ?? false,
      cocChainLengthDays: d.coc_chain_length_days ?? 0,
      arpScoreVerified: d.arp_score_verified ?? false,
      asaHistoryVerified: d.asa_history_verified ?? false,
      ajpRecordVerified: d.ajp_record_verified ?? false,
      verificationTimestamp: d.verification_timestamp ?? "",
    });
  }
}

export class MatchResult {
  rank: number;
  agentId: string;
  compatibilityScore: number;
  dimensionalScores: Record<string, number>;
  ucpSummary: Record<string, unknown>;
  trustVerification: TrustVerification;
  registriesFoundOn: string[];

  constructor(opts: {
    rank?: number;
    agentId?: string;
    compatibilityScore?: number;
    dimensionalScores?: Record<string, number>;
    ucpSummary?: Record<string, unknown>;
    trustVerification?: TrustVerification;
    registriesFoundOn?: string[];
  } = {}) {
    this.rank = opts.rank ?? 0;
    this.agentId = opts.agentId ?? "";
    this.compatibilityScore = opts.compatibilityScore ?? 0;
    this.dimensionalScores = opts.dimensionalScores ?? {};
    this.ucpSummary = opts.ucpSummary ?? {};
    this.trustVerification = opts.trustVerification ?? new TrustVerification();
    this.registriesFoundOn = opts.registriesFoundOn ?? [];
  }

  toDict(): MatchResultDict {
    const rounded: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.dimensionalScores)) {
      rounded[k] = Math.round(v * 100) / 100;
    }
    return {
      rank: this.rank,
      agent_id: this.agentId,
      compatibility_score: Math.round(this.compatibilityScore * 100) / 100,
      dimensional_scores: rounded,
      ucp_summary: this.ucpSummary,
      trust_verification: this.trustVerification.toDict(),
      registries_found_on: this.registriesFoundOn,
    };
  }

  static fromDict(d: Partial<MatchResultDict>): MatchResult {
    return new MatchResult({
      rank: d.rank ?? 0,
      agentId: d.agent_id ?? "",
      compatibilityScore: d.compatibility_score ?? 0,
      dimensionalScores: d.dimensional_scores ?? {},
      ucpSummary: (d.ucp_summary ?? {}) as Record<string, unknown>,
      trustVerification: TrustVerification.fromDict(d.trust_verification ?? {}),
      registriesFoundOn: d.registries_found_on ?? [],
    });
  }
}

export class MatchMetadata {
  registriesQueried: number;
  registriesResponded: number;
  totalCandidatesEvaluated: number;
  candidatesFilteredByConstraints: number;
  candidatesScored: number;
  queryTimeMs: number;

  constructor(opts: {
    registriesQueried?: number;
    registriesResponded?: number;
    totalCandidatesEvaluated?: number;
    candidatesFilteredByConstraints?: number;
    candidatesScored?: number;
    queryTimeMs?: number;
  } = {}) {
    this.registriesQueried = opts.registriesQueried ?? 0;
    this.registriesResponded = opts.registriesResponded ?? 0;
    this.totalCandidatesEvaluated = opts.totalCandidatesEvaluated ?? 0;
    this.candidatesFilteredByConstraints = opts.candidatesFilteredByConstraints ?? 0;
    this.candidatesScored = opts.candidatesScored ?? 0;
    this.queryTimeMs = opts.queryTimeMs ?? 0;
  }

  toDict(): MatchMetadataDict {
    return {
      registries_queried: this.registriesQueried,
      registries_responded: this.registriesResponded,
      total_candidates_evaluated: this.totalCandidatesEvaluated,
      candidates_filtered_by_constraints: this.candidatesFilteredByConstraints,
      candidates_scored: this.candidatesScored,
      query_time_ms: this.queryTimeMs,
    };
  }

  static fromDict(d: Partial<MatchMetadataDict>): MatchMetadata {
    return new MatchMetadata({
      registriesQueried: d.registries_queried ?? 0,
      registriesResponded: d.registries_responded ?? 0,
      totalCandidatesEvaluated: d.total_candidates_evaluated ?? 0,
      candidatesFilteredByConstraints: d.candidates_filtered_by_constraints ?? 0,
      candidatesScored: d.candidates_scored ?? 0,
      queryTimeMs: d.query_time_ms ?? 0,
    });
  }
}

export class MatchResponse {
  requestId: string;
  timestamp: string;
  results: MatchResult[];
  metadata: MatchMetadata;

  constructor(opts: {
    requestId?: string;
    results?: MatchResult[];
    metadata?: MatchMetadata;
    timestamp?: string;
  } = {}) {
    this.requestId = opts.requestId ?? "";
    this.timestamp = opts.timestamp || nowIso();
    this.results = opts.results ?? [];
    this.metadata = opts.metadata ?? new MatchMetadata();
  }

  toDict(): MatchResponseDict {
    return {
      match_response: {
        request_id: this.requestId,
        timestamp: this.timestamp,
        results: this.results.map((r) => r.toDict()),
        metadata: this.metadata.toDict(),
      },
    };
  }

  static fromDict(d: Record<string, unknown>): MatchResponse {
    const mr = ((d as any).match_response ?? d) as Record<string, unknown>;
    return new MatchResponse({
      requestId: (mr.request_id as string) ?? "",
      timestamp: (mr.timestamp as string) ?? "",
      results: ((mr.results as MatchResultDict[]) ?? []).map((r) => MatchResult.fromDict(r)),
      metadata: MatchMetadata.fromDict((mr.metadata ?? {}) as Partial<MatchMetadataDict>),
    });
  }
}

// ---------------------------------------------------------------------------
// Federation Query / Response (Section 7.2)
// ---------------------------------------------------------------------------

export class FederationQuery {
  queryText: string;
  domain: string;
  subdomain: string;
  constraints: Record<string, unknown>;
  maxResults: number;

  constructor(opts: {
    queryText?: string;
    domain?: string;
    subdomain?: string;
    constraints?: Record<string, unknown>;
    maxResults?: number;
  } = {}) {
    this.queryText = opts.queryText ?? "";
    this.domain = opts.domain ?? "";
    this.subdomain = opts.subdomain ?? "";
    this.constraints = opts.constraints ?? {};
    this.maxResults = opts.maxResults ?? 50;
  }

  toDict(): FederationQueryDict {
    return {
      query: {
        text: this.queryText,
        domain: this.domain,
        subdomain: this.subdomain,
        constraints: this.constraints,
        max_results: this.maxResults,
      },
    };
  }

  static fromDict(d: Record<string, unknown>): FederationQuery {
    const q = ((d as any).query ?? d) as Record<string, unknown>;
    return new FederationQuery({
      queryText: (q.text as string) ?? "",
      domain: (q.domain as string) ?? "",
      subdomain: (q.subdomain as string) ?? "",
      constraints: (q.constraints ?? {}) as Record<string, unknown>,
      maxResults: (q.max_results as number) ?? 50,
    });
  }
}

export class FederationResult {
  registryName: string;
  ucps: UnifiedCapabilityProfile[];
  queryTimeMs: number;
  error: string;

  constructor(opts: {
    registryName?: string;
    ucps?: UnifiedCapabilityProfile[];
    queryTimeMs?: number;
    error?: string;
  } = {}) {
    this.registryName = opts.registryName ?? "";
    this.ucps = opts.ucps ?? [];
    this.queryTimeMs = opts.queryTimeMs ?? 0;
    this.error = opts.error ?? "";
  }

  toDict(): FederationResultDict {
    const d: FederationResultDict = {
      registry_name: this.registryName,
      ucps: this.ucps.map((u) => u.toDict()),
      query_time_ms: this.queryTimeMs,
    };
    if (this.error) {
      d.error = this.error;
    }
    return d;
  }

  static fromDict(d: Partial<FederationResultDict>): FederationResult {
    return new FederationResult({
      registryName: d.registry_name ?? "",
      ucps: (d.ucps ?? []).map((u) => UnifiedCapabilityProfile.fromDict(u)),
      queryTimeMs: d.query_time_ms ?? 0,
      error: d.error ?? "",
    });
  }
}
