import {
  MatchRequest,
  UnifiedCapabilityProfile,
  genId,
  nowIso,
} from "./schema";

// ---------------------------------------------------------------------------
// Price estimation
// ---------------------------------------------------------------------------

export function estimateCost(ucp: UnifiedCapabilityProfile, taskComplexity = 1.0): number {
  const base = ucp.cost.baseRate.amount;
  const variable = ucp.cost.variableRate.amount * taskComplexity * 1000;
  return base + variable;
}

// ---------------------------------------------------------------------------
// Mechanism 1: Posted Price (Section 8.2)
// ---------------------------------------------------------------------------

export interface PostedPriceResultDict {
  agent_id: string;
  estimated_cost: number;
  currency: string;
  pricing_model: string;
}

export class PostedPriceResult {
  agentId: string;
  estimatedCost: number;
  currency: string;
  pricingModel: string;

  constructor(agentId = "", estimatedCost = 0, currency = "USD", pricingModel = "posted_price") {
    this.agentId = agentId;
    this.estimatedCost = estimatedCost;
    this.currency = currency;
    this.pricingModel = pricingModel;
  }

  toDict(): PostedPriceResultDict {
    return {
      agent_id: this.agentId,
      estimated_cost: Math.round(this.estimatedCost * 10000) / 10000,
      currency: this.currency,
      pricing_model: this.pricingModel,
    };
  }
}

export function postedPrice(
  candidates: UnifiedCapabilityProfile[],
  taskComplexity = 1.0,
): PostedPriceResult[] {
  return candidates.map((ucp) => new PostedPriceResult(
    ucp.identity.ampId,
    estimateCost(ucp, taskComplexity),
    ucp.cost.baseRate.currency,
    ucp.cost.pricingModel,
  ));
}

// ---------------------------------------------------------------------------
// Mechanism 2: Request for Quote (Section 8.2)
// ---------------------------------------------------------------------------

export interface QuoteDict {
  quote_id: string;
  agent_id: string;
  amount: number;
  currency: string;
  terms: string;
  validity_window_ms: number;
  timestamp: string;
}

export class Quote {
  quoteId: string;
  agentId: string;
  amount: number;
  currency: string;
  terms: string;
  validityWindowMs: number;
  timestamp: string;

  constructor(opts: {
    quoteId?: string;
    agentId?: string;
    amount?: number;
    currency?: string;
    terms?: string;
    validityWindowMs?: number;
    timestamp?: string;
  } = {}) {
    this.quoteId = opts.quoteId || genId("quote");
    this.agentId = opts.agentId ?? "";
    this.amount = opts.amount ?? 0;
    this.currency = opts.currency ?? "USD";
    this.terms = opts.terms ?? "";
    this.validityWindowMs = opts.validityWindowMs ?? 3600000;
    this.timestamp = opts.timestamp || nowIso();
  }

  toDict(): QuoteDict {
    return {
      quote_id: this.quoteId,
      agent_id: this.agentId,
      amount: Math.round(this.amount * 10000) / 10000,
      currency: this.currency,
      terms: this.terms,
      validity_window_ms: this.validityWindowMs,
      timestamp: this.timestamp,
    };
  }

  static fromDict(d: Partial<QuoteDict>): Quote {
    return new Quote({
      quoteId: d.quote_id ?? "",
      agentId: d.agent_id ?? "",
      amount: d.amount ?? 0,
      currency: d.currency ?? "USD",
      terms: d.terms ?? "",
      validityWindowMs: d.validity_window_ms ?? 3600000,
      timestamp: d.timestamp ?? "",
    });
  }
}

export class RFQSession {
  rfqId: string;
  request: MatchRequest;
  quotes: Quote[];
  selectedQuote: Quote | null;
  createdAt: string;

  constructor(request: MatchRequest) {
    this.rfqId = genId("rfq");
    this.request = request;
    this.quotes = [];
    this.selectedQuote = null;
    this.createdAt = nowIso();
  }

  addQuote(quote: Quote): void {
    this.quotes.push(quote);
  }

  rankQuotes(
    trustScores?: Record<string, number>,
    qualityWeight = 0.5,
    priceWeight = 0.5,
  ): Quote[] {
    const ts = trustScores ?? {};
    if (this.quotes.length === 0) return [];

    const maxAmount = Math.max(...this.quotes.map((q) => q.amount)) || 1.0;

    const scored: Array<[number, Quote]> = this.quotes.map((q) => {
      const priceScore = maxAmount > 0 ? (1.0 - q.amount / maxAmount) * 100 : 50;
      const trust = ts[q.agentId] ?? 50;
      const combined = priceWeight * priceScore + qualityWeight * trust;
      return [combined, q];
    });

    scored.sort((a, b) => b[0] - a[0]);
    return scored.map(([, q]) => q);
  }

  select(quoteId: string): Quote | null {
    for (const q of this.quotes) {
      if (q.quoteId === quoteId) {
        this.selectedQuote = q;
        return q;
      }
    }
    return null;
  }

  toDict(): Record<string, unknown> {
    return {
      rfq_id: this.rfqId,
      request_id: this.request.requestId,
      quotes: this.quotes.map((q) => q.toDict()),
      selected_quote: this.selectedQuote ? this.selectedQuote.toDict() : null,
      created_at: this.createdAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Mechanism 3: Auction — Vickrey sealed-bid second-price (Section 6.3/8.2)
// ---------------------------------------------------------------------------

export interface BidDict {
  bid_id: string;
  agent_id: string;
  amount: number;
  currency: string;
  timestamp: string;
}

export class Bid {
  bidId: string;
  agentId: string;
  amount: number;
  currency: string;
  timestamp: string;

  constructor(opts: {
    bidId?: string;
    agentId?: string;
    amount?: number;
    currency?: string;
    timestamp?: string;
  } = {}) {
    this.bidId = opts.bidId || genId("bid");
    this.agentId = opts.agentId ?? "";
    this.amount = opts.amount ?? 0;
    this.currency = opts.currency ?? "USD";
    this.timestamp = opts.timestamp || nowIso();
  }

  toDict(): BidDict {
    return {
      bid_id: this.bidId,
      agent_id: this.agentId,
      amount: Math.round(this.amount * 10000) / 10000,
      currency: this.currency,
      timestamp: this.timestamp,
    };
  }

  static fromDict(d: Partial<BidDict>): Bid {
    return new Bid({
      bidId: d.bid_id ?? "",
      agentId: d.agent_id ?? "",
      amount: d.amount ?? 0,
      currency: d.currency ?? "USD",
      timestamp: d.timestamp ?? "",
    });
  }
}

export interface AuctionResultDict {
  auction_id: string;
  format: string;
  winner_id: string;
  winning_bid: number;
  clearing_price: number;
  total_bids: number;
  timestamp: string;
}

export class AuctionResult {
  auctionId: string;
  format: string;
  winnerId: string;
  winningBid: number;
  clearingPrice: number;
  totalBids: number;
  timestamp: string;

  constructor(opts: {
    auctionId?: string;
    auctionFormat?: string;
    winnerId?: string;
    winningBid?: number;
    clearingPrice?: number;
    totalBids?: number;
    timestamp?: string;
  } = {}) {
    this.auctionId = opts.auctionId || genId("auction");
    this.format = opts.auctionFormat ?? "vickrey";
    this.winnerId = opts.winnerId ?? "";
    this.winningBid = opts.winningBid ?? 0;
    this.clearingPrice = opts.clearingPrice ?? 0;
    this.totalBids = opts.totalBids ?? 0;
    this.timestamp = opts.timestamp || nowIso();
  }

  toDict(): AuctionResultDict {
    return {
      auction_id: this.auctionId,
      format: this.format,
      winner_id: this.winnerId,
      winning_bid: Math.round(this.winningBid * 10000) / 10000,
      clearing_price: Math.round(this.clearingPrice * 10000) / 10000,
      total_bids: this.totalBids,
      timestamp: this.timestamp,
    };
  }
}

export function vickreyAuction(
  bids: Bid[],
  minTrustScore = 0,
  trustScores?: Record<string, number>,
): AuctionResult | null {
  const ts = trustScores ?? {};

  const qualified = bids.filter(
    (b) => (ts[b.agentId] ?? 100) >= minTrustScore,
  );

  if (qualified.length === 0) return null;

  qualified.sort((a, b) => a.amount - b.amount);

  const winner = qualified[0];
  const clearingPrice = qualified.length > 1 ? qualified[1].amount : winner.amount;

  return new AuctionResult({
    auctionFormat: "vickrey",
    winnerId: winner.agentId,
    winningBid: winner.amount,
    clearingPrice,
    totalBids: bids.length,
  });
}

export function englishAuction(
  bids: Bid[],
  minTrustScore = 0,
  trustScores?: Record<string, number>,
): AuctionResult | null {
  const ts = trustScores ?? {};

  const qualified = bids.filter(
    (b) => (ts[b.agentId] ?? 100) >= minTrustScore,
  );

  if (qualified.length === 0) return null;

  qualified.sort((a, b) => a.amount - b.amount);
  const winner = qualified[0];

  return new AuctionResult({
    auctionFormat: "english",
    winnerId: winner.agentId,
    winningBid: winner.amount,
    clearingPrice: winner.amount,
    totalBids: bids.length,
  });
}
