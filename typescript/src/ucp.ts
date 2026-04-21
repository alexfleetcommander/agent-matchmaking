import {
  CAPABILITY_DOMAINS,
  Availability,
  Capability,
  Capacity,
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
} from "./schema";

// ---------------------------------------------------------------------------
// UCPBuilder
// ---------------------------------------------------------------------------

export class UCPBuilder {
  private _identity = new Identity();
  private _capabilities: Capability[] = [];
  private _performance = new Performance();
  private _cost = new Cost();
  private _availability = new Availability();
  private _extensions: Record<string, unknown> = {};
  private _trustTier = "declared";

  identity(opts: {
    ampId?: string;
    a2aCard?: string;
    cocChainId?: string;
    did?: string;
  } = {}): this {
    this._identity = new Identity(opts);
    return this;
  }

  addRegistry(registryType: string, listingId: string): this {
    this._identity.registries.push(new RegistryListing(registryType, listingId));
    return this;
  }

  addCapability(opts: {
    domain: string;
    subdomain?: string;
    description?: string;
    inputModalities?: string[];
    outputModalities?: string[];
    toolsUsed?: string[];
    ampCapabilityCode?: string;
  }): this {
    this._capabilities.push(new Capability({
      domain: opts.domain,
      subdomain: opts.subdomain,
      description: opts.description,
      inputModalities: opts.inputModalities,
      outputModalities: opts.outputModalities,
      toolsUsed: opts.toolsUsed,
      taxonomyCodes: new TaxonomyCodes("", opts.ampCapabilityCode ?? ""),
    }));
    return this;
  }

  performance(opts: {
    arpComposite?: number;
    asaCompletionRate?: number;
    asaSampleSize?: number;
    medianResponseMs?: number;
    p95ResponseMs?: number;
    throughputPerHour?: number;
  } = {}): this {
    this._performance = new Performance({
      reliability: new ReliabilityMetrics(
        opts.asaCompletionRate ?? 0,
        opts.asaSampleSize ?? 0,
      ),
      quality: new QualityMetrics({ arpCompositeScore: opts.arpComposite ?? 0 }),
      speed: new SpeedMetrics(
        opts.medianResponseMs ?? 0,
        opts.p95ResponseMs ?? 0,
        opts.throughputPerHour ?? 0,
      ),
    });
    return this;
  }

  cost(opts: {
    pricingModel?: string;
    baseAmount?: number;
    basePer?: string;
    currency?: string;
    supportsNegotiation?: boolean;
    supportsAuction?: boolean;
    paymentRails?: string[];
  } = {}): this {
    this._cost = new Cost({
      pricingModel: opts.pricingModel ?? "posted_price",
      baseRate: new CostRate(opts.baseAmount ?? 0, opts.currency ?? "USD", opts.basePer ?? "request"),
      supportsNegotiation: opts.supportsNegotiation ?? false,
      supportsAuction: opts.supportsAuction ?? false,
      paymentRails: opts.paymentRails ?? [],
    });
    return this;
  }

  availability(opts: {
    status?: string;
    lifecycleStage?: string;
    currentLoadPct?: number;
    maxConcurrent?: number;
  } = {}): this {
    this._availability = new Availability(
      opts.status ?? "active",
      opts.lifecycleStage ?? "operational",
      new Capacity(opts.currentLoadPct ?? 0, opts.maxConcurrent ?? 1),
    );
    return this;
  }

  trustTier(tier: string): this {
    this._trustTier = tier;
    return this;
  }

  extension(key: string, value: unknown): this {
    this._extensions[key] = value;
    return this;
  }

  build(): UnifiedCapabilityProfile {
    return new UnifiedCapabilityProfile({
      identity: this._identity,
      capabilities: this._capabilities,
      performance: this._performance,
      cost: this._cost,
      availability: this._availability,
      extensions: this._extensions,
      trustTier: this._trustTier,
    });
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class UCPValidationError extends Error {
  constructor(message: string) { super(message); this.name = "UCPValidationError"; }
}

export function validateUcp(ucp: UnifiedCapabilityProfile): string[] {
  const warnings: string[] = [];

  if (!ucp.identity.ampId) warnings.push("identity.amp_id is required");
  if (ucp.capabilities.length === 0) warnings.push("at least one capability is required");

  for (let i = 0; i < ucp.capabilities.length; i++) {
    const cap = ucp.capabilities[i];
    if (!cap.domain) {
      warnings.push(`capabilities[${i}].domain is required`);
    } else if (!CAPABILITY_DOMAINS.includes(cap.domain as any)) {
      warnings.push(
        `capabilities[${i}].domain '${cap.domain}' not in standard domains (${CAPABILITY_DOMAINS.join(", ")})`,
      );
    }
    if (!cap.description) {
      warnings.push(`capabilities[${i}].description is recommended`);
    }
  }

  if (!["declared", "attested", "measured", "verified"].includes(ucp.trustTier)) {
    warnings.push(`trust_tier '${ucp.trustTier}' is not a recognized tier`);
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Converters — A2A Agent Card -> UCP (Section 5.3)
// ---------------------------------------------------------------------------

export function fromA2aAgentCard(card: Record<string, unknown>): UnifiedCapabilityProfile {
  const identity = new Identity({ a2aCard: (card.url as string) ?? "" });

  const capabilities: Capability[] = [];
  const skills = (card.skills ?? []) as Array<Record<string, unknown>>;
  for (const skill of skills) {
    capabilities.push(new Capability({
      description: (skill.description as string) ?? (skill.name as string) ?? "",
      domain: inferDomain((skill.description as string) ?? ""),
      subdomain: (skill.name as string) ?? "",
      inputModalities: (skill.inputModes as string[]) ?? [],
      outputModalities: (skill.outputModes as string[]) ?? [],
    }));
  }

  if (capabilities.length === 0 && card.description) {
    capabilities.push(new Capability({
      description: card.description as string,
      domain: inferDomain(card.description as string),
    }));
  }

  return new UnifiedCapabilityProfile({
    identity,
    capabilities,
    trustTier: "attested",
    extensions: { source_format: "a2a_agent_card", original_name: (card.name as string) ?? "" },
  });
}

export function fromMcpManifest(manifest: Record<string, unknown>): UnifiedCapabilityProfile {
  const tools = (manifest.tools ?? []) as Array<Record<string, unknown>>;

  const capabilities: Capability[] = [];
  for (const tool of tools) {
    capabilities.push(new Capability({
      description: (tool.description as string) ?? (tool.name as string) ?? "",
      domain: inferDomain((tool.description as string) ?? ""),
      toolsUsed: [(tool.name as string) ?? ""],
    }));
  }

  return new UnifiedCapabilityProfile({
    identity: new Identity(),
    capabilities,
    trustTier: "declared",
    extensions: { source_format: "mcp_manifest", tool_count: tools.length },
  });
}

export function fromOpenclawSkill(
  skillYaml: Record<string, unknown>,
  descriptionMd = "",
): UnifiedCapabilityProfile {
  const identity = new Identity();
  identity.registries.push(
    new RegistryListing("clawhub", (skillYaml.name as string) ?? ""),
  );

  const capDesc = descriptionMd || ((skillYaml.description as string) ?? "");
  const capabilities = [new Capability({
    description: capDesc,
    domain: inferDomain(capDesc),
    toolsUsed: (skillYaml.required_binaries as string[]) ?? [],
  })];

  return new UnifiedCapabilityProfile({
    identity,
    capabilities,
    trustTier: "attested",
    extensions: { source_format: "openclaw_skill", skill_name: (skillYaml.name as string) ?? "" },
  });
}

// ---------------------------------------------------------------------------
// Domain inference helper
// ---------------------------------------------------------------------------

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  research: ["research", "search", "survey", "investigate", "literature", "competitive"],
  development: ["code", "develop", "build", "program", "software", "api", "frontend", "backend", "deploy"],
  analysis: ["analy", "data", "financial", "legal", "statistic", "insight", "evaluate"],
  communication: ["translate", "summar", "write", "email", "chat", "communicat", "document"],
  operations: ["monitor", "deploy", "automat", "orchestr", "pipeline", "backup", "infra"],
  creative: ["design", "creat", "art", "image", "video", "music", "generat"],
  security: ["secur", "audit", "vulnerab", "threat", "pentest", "compliance", "encrypt"],
  domain_specific: [],
};

export function inferDomain(text: string): string {
  const textLower = text.toLowerCase();
  const scores: Record<string, number> = {};
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (textLower.includes(kw)) score++;
    }
    if (score > 0) scores[domain] = score;
  }
  if (Object.keys(scores).length > 0) {
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  }
  return "domain_specific";
}
