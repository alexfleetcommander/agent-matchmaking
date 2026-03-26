# agent-matchmaking

Cross-platform discovery and trust-weighted matching for the autonomous agent economy.

Reference implementation of the **Agent Matchmaking Protocol (AMP)** — the market/discovery layer (Layer 4) of the [AB Support Trust Ecosystem](https://vibeagentmaking.com).

## Install

```bash
pip install agent-matchmaking
```

**Requirements:** Python 3.8+. Zero runtime dependencies.

**Optional trust integrations:**
```bash
pip install agent-matchmaking[trust]   # all trust stack protocols
pip install agent-matchmaking[arp]     # agent-rating-protocol only
pip install agent-matchmaking[dev]     # pytest for development
```

## What It Does

AMP solves the matching problem for the fragmented agent marketplace:

1. **Capability Description** — Unified Capability Profile (UCP) format, interoperable with A2A Agent Cards, MCP manifests, OpenClaw specs
2. **Compatibility Matching** — Multi-dimensional scoring: capability, trust, cost, availability, style, domain relevance
3. **Cross-Platform Discovery** — Federated queries across siloed marketplaces via adapter pattern
4. **Price Discovery** — Posted price, Request for Quote (RFQ), Vickrey auction
5. **Trust-Weighted Ranking** — Four-tier hierarchy (Declared -> Attested -> Measured -> Verified) consuming CoC, ARP, ASA, AJP, ALP data

## CLI Quick Start

```bash
# Register agents
agent-match register --domain security --description "Python security code review" --price 0.05 --arp-score 85
agent-match register --domain security --description "SAST vulnerability scanner" --price 0.10 --arp-score 92

# Find agents
agent-match search "security"
agent-match search --domain security

# Get ranked matches
agent-match match "security code review for Python microservice" --domain security --budget 1.0

# Check store status
agent-match status

# JSON output
agent-match --json match "code review" --domain security
```

## Python API

### Create a UCP

```python
from agent_matchmaking import UCPBuilder

ucp = (
    UCPBuilder()
    .identity(amp_id="amp:agent:my-agent", a2a_card="https://example.com/.well-known/agent.json")
    .add_capability(
        domain="security",
        subdomain="code_review",
        description="Python security code review with SAST/DAST integration",
        tools_used=["bandit", "semgrep"],
    )
    .performance(arp_composite=88.0, asa_completion_rate=0.99, asa_sample_size=200)
    .cost(base_amount=0.05, currency="USD")
    .availability(lifecycle_stage="operational", max_concurrent=10)
    .trust_tier("verified")
    .build()
)
```

### Run a Match

```python
from agent_matchmaking import (
    MatchRequest, TaskDescription, MatchConstraints,
    MatchmakingStore, ranked_search,
)

store = MatchmakingStore(".amp")
store.save_ucp(ucp)

request = MatchRequest(
    requester_id="amp:agent:requester-1",
    task=TaskDescription(
        description="Review Python microservice for security vulnerabilities",
        domain="security",
        budget_max=50.0,
        deadline_ms=3600000,
    ),
    constraints=MatchConstraints(min_trust_score=60, max_results=5),
)

candidates = store.get_all_ucps()
response = ranked_search(request, candidates)

for result in response.results:
    print(f"#{result.rank} {result.agent_id} — score: {result.compatibility_score:.1f}")
```

### Federated Search

```python
from agent_matchmaking import FederationRouter, StaticAdapter, CallbackAdapter

router = FederationRouter(timeout_ms=5000)

# Register adapters for different registries
router.register(StaticAdapter(my_local_agents, name="local"))
router.register(CallbackAdapter("clawhub", clawhub_search_fn))

# Federated search across all registries
ucps = router.federated_search(request)
```

### Convert from Existing Formats

```python
from agent_matchmaking import from_a2a_agent_card, from_mcp_manifest, from_openclaw_skill

# A2A Agent Card -> UCP
ucp = from_a2a_agent_card({"name": "SecurityBot", "url": "...", "skills": [...]})

# MCP Tool Manifest -> UCP
ucp = from_mcp_manifest({"tools": [{"name": "scanner", "description": "..."}]})

# OpenClaw SKILL.md -> UCP
ucp = from_openclaw_skill({"name": "web-research-v3", "required_binaries": ["curl"]})
```

### Price Discovery

```python
from agent_matchmaking import vickrey_auction, Bid, RFQSession

# Vickrey auction: lowest bidder wins, pays second-lowest price
bids = [
    Bid(agent_id="a1", amount=10.0),
    Bid(agent_id="a2", amount=8.0),
    Bid(agent_id="a3", amount=12.0),
]
result = vickrey_auction(bids)
# result.winner_id == "a2", result.clearing_price == 10.0

# RFQ session
session = RFQSession(request)
session.add_quote(Quote(agent_id="a1", amount=10.0, terms="net30"))
ranked = session.rank_quotes(trust_scores={"a1": 85.0})
```

### Trust Scoring

```python
from agent_matchmaking import compute_trust_score, baseline_trust_score

# Full trust computation
score = compute_trust_score(
    chain_age_days=180,
    anchor_count=2160,
    arp_composite=88.0,
    asa_completion_rate=0.98,
    asa_sample_size=200,
    ajp_dispute_rate=0.02,
    ajp_unfavorable_rate=0.1,
)

# New agent baseline
baseline = baseline_trust_score(
    has_corporate_validation=True,
    has_a2a_verified_domain=True,
)
```

## Architecture

```
agent_matchmaking/
  schema.py      — Data structures, constants, JSON schemas
  ucp.py         — UCP builder, validation, format converters
  matching.py    — Multi-dimensional matching (ranked search, Gale-Shapley)
  ranking.py     — Trust-weighted ranking (4-tier hierarchy)
  discovery.py   — Query translation, normalization, deduplication
  federation.py  — Federation router with adapter pattern
  pricing.py     — Posted price, RFQ, Vickrey/English auctions
  store.py       — Append-only JSONL persistence
  cli.py         — CLI entry point (agent-match)
```

## Trust Ecosystem Position

AMP sits at Layer 4 of the trust stack:

```
Layer 4: AMP (Matchmaking)     <- this package
Layer 3: AJP (Accountability)
Layer 2: ASA (Agreements) + ALP (Lifecycle)
Layer 1: CoC (Provenance) + ARP (Reputation)
```

## Capability Taxonomy

8 Level-1 domains: `research`, `development`, `analysis`, `communication`, `operations`, `creative`, `security`, `domain_specific`

## VAM-SEC Disclaimer

This software is provided as a reference implementation of the Agent Matchmaking Protocol. It is designed for research, prototyping, and educational use. Production deployments should implement additional security hardening, rate limiting, input validation, and monitoring appropriate to their threat model. See the [whitepaper security analysis](https://vibeagentmaking.com/whitepaper/matchmaking-protocol/) for threat model details.

## License

Apache 2.0 — see [LICENSE](LICENSE)

## Links

- [Whitepaper](https://vibeagentmaking.com/whitepaper/matchmaking-protocol/)
- [Trust Ecosystem](https://vibeagentmaking.com)
- [GitHub](https://github.com/brycebostick/agent-matchmaking)
