# agent-matchmaking (TypeScript)

Cross-platform discovery and trust-weighted matching for the autonomous agent economy — TypeScript reference implementation of the Agent Matchmaking Protocol (AMP).

## Quick Start

```bash
npm install
npm run build
npm test
```

## Architecture

| Module | File | Description |
|--------|------|-------------|
| Schema | `src/schema.ts` | All data structures, constants, dict interfaces, and utility helpers |
| Ranking | `src/ranking.ts` | Trust-weighted scoring: identity confidence, performance quality, reliability, risk |
| Matching | `src/matching.ts` | Multi-dimensional matching engine: ranked search, Gale-Shapley stable matching |
| Pricing | `src/pricing.ts` | Price discovery: posted price, RFQ sessions, Vickrey/English auctions |
| Discovery | `src/discovery.ts` | Cross-platform search: query translation, normalization, deduplication |
| Federation | `src/federation.ts` | Registry adapter pattern: parallel dispatch with timeout handling |
| UCP | `src/ucp.ts` | Fluent builder, validation, converters (A2A, MCP, OpenClaw) |
| Store | `src/store.ts` | Append-only JSONL persistence for UCPs, requests, responses, federation results |
| Index | `src/index.ts` | Barrel exports |

## Key Concepts

- **Unified Capability Profile (UCP)**: Canonical agent description format — identity, capabilities, performance, cost, availability
- **Match Request/Response**: Task-driven agent discovery with weighted multi-dimensional scoring
- **Federation**: Cross-registry search via pluggable adapters (local, static, callback)
- **Trust Tiers**: Four-level hierarchy (declared → attested → measured → verified) with numeric weights
- **Pricing Mechanisms**: Posted price, Request for Quote (RFQ), Vickrey sealed-bid second-price auction

## Usage

```typescript
import {
  UCPBuilder,
  MatchRequest,
  TaskDescription,
  MatchConstraints,
  rankedSearch,
  vickreyAuction,
  Bid,
  MatchmakingStore,
} from "agent-matchmaking";

// Register an agent
const ucp = new UCPBuilder()
  .identity({ ampId: "my-agent" })
  .addCapability({ domain: "development", description: "Build REST APIs" })
  .performance({ arpComposite: 85, asaCompletionRate: 0.95, asaSampleSize: 100 })
  .cost({ baseAmount: 0.05 })
  .trustTier("measured")
  .build();

// Create a match request
const request = new MatchRequest({
  requesterId: "task-owner",
  task: new TaskDescription({
    description: "Build a user authentication API",
    domain: "development",
    budgetMax: 1.0,
  }),
  constraints: new MatchConstraints({ maxResults: 5 }),
});

// Run ranked search
const response = rankedSearch(request, [ucp]);

// Persist to JSONL store
const store = new MatchmakingStore(".amp");
store.saveUcp(ucp);
store.saveRequest(request);
store.saveResponse(response);
```

## Deployment

1. `npm run build` — compiles to `dist/`
2. `npm test` — runs 124 tests across 25 suites
3. Published as CommonJS with TypeScript declarations

### Requirements

- Node.js >= 18.0.0
- Zero runtime dependencies

## Ported From

Python reference implementation: `agent_matchmaking/` (10 modules, ~3,400 lines). This TypeScript port is a 1:1 faithful translation with identical wire format (snake_case JSON), matching algorithms, and trust scoring math. CLI intentionally omitted for npm package use.

## Protocol Companions

- Chain of Consciousness (CoC)
- Agent Rating Protocol (ARP)
- Agent Service Agreements (ASA)
- Agent Justice Protocol (AJP)
- Agent Lifecycle Protocol (ALP)
