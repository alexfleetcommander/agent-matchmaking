# Agent Matchmaking Protocol: Cross-Platform Discovery and Trust-Weighted Matching for the Autonomous Agent Economy

**Version:** 1.0.0
**Authors:** Charlie (Deep Dive Analyst), Alex (AB Support Fleet Coordinator), Bravo (Research), Editor (Content Review)
**Contact:** alex@vibeagentmaking.com
**Date:** 2026-03-26
**Status:** Pre-publication Draft
**License:** Apache 2.0
**Organization:** AB Support LLC

---

## Abstract

The autonomous agent economy is fragmenting before it can consolidate. As of early 2026, agent marketplaces operate as walled gardens — Google Cloud's AI Agent Marketplace validates agents for Vertex AI [1], Salesforce AgentExchange requires Agentforce integration [2], AWS Marketplace ties agents to Bedrock AgentCore [3], and ServiceNow's AI Agent Marketplace is locked to its own platform [4]. An agent listed on one marketplace is invisible to customers of all others. Open alternatives exist — UC Berkeley's Gorilla marketplace hosts 150+ agents [5], ClawHub's skill registry holds 13,729 community-built skills [6], and AI Agent Store curates 1,300+ entries [7] — but they are disconnected from each other and from enterprise platforms. No cross-platform search exists. No protocol combines discovery with matching, trust verification, and price negotiation in a single open standard.

This fragmentation recreates the pre-web problem of information silos. Before search engines, finding information required knowing which database to query. Before travel aggregators like Kayak, finding the cheapest flight required checking each airline individually [8]. The agent economy faces the same structural problem: finding the best agent for a task requires searching every marketplace individually, comparing incompatible capability descriptions, and making trust judgments without standardized reputation data.

The Agent Matchmaking Protocol (AMP) fills this gap. AMP specifies five capabilities that together constitute a complete matching layer for autonomous agent commerce:

1. **Capability Description** — a machine-readable Unified Capability Profile (UCP) format for describing what an agent can do, interoperable with A2A Agent Cards [9], MCP tool manifests [10], and OpenClaw skill specs [11]. UCPs compose tool-level descriptions into higher-level capability profiles, bridging the gap between "this agent has access to a web scraping tool" and "this agent can conduct comprehensive competitive research."

2. **Compatibility Matching** — multi-dimensional matching that goes beyond capability to incorporate reputation, reliability, cost, availability, and style compatibility. Rather than returning "500 agents that do code review," AMP returns "the 5 best agents for YOUR code review, given your budget, timeline, quality requirements, and trust preferences." The matching algorithm combines Gale-Shapley stable matching [12] for bilateral preference optimization with collaborative filtering for recommendation and semantic embedding similarity for capability matching.

3. **Cross-Platform Discovery** — a protocol-level search standard enabling federated queries across siloed marketplaces. AMP functions as the "Kayak of agent marketplaces" — it does not replicate each marketplace's runtime infrastructure but provides a unified discovery layer that searches across all participating registries and returns normalized results.

4. **Price Discovery** — support for posted pricing, auction mechanisms, and structured negotiation, enabling agents to find not just capable partners but cost-effective ones. Price discovery integrates with existing commerce protocols including OpenAI's Agentic Commerce Protocol [13] and Google's Universal Commerce Protocol [14].

5. **Trust-Weighted Ranking** — agents with better provenance (Chain of Consciousness [15]), stronger reputation (Agent Rating Protocol [16]), fewer disputes (Agent Justice Protocol [17]), higher SLA compliance (Agent Service Agreements [18]), and active lifecycle status (Agent Lifecycle Protocol [19]) rank higher. Trust signals are not opaque scores but verifiable claims backed by cryptographic evidence.

AMP is designed as the commercial apex of the AB Support Trust Ecosystem — a Layer 4 (Market/Discovery) protocol that consumes data from every lower-layer protocol. Its competitive advantage is not the matching algorithm itself (matching is a well-studied problem) but the depth of trust integration: where existing marketplaces validate agents once at listing time through corporate gatekeeping, AMP validates them continuously through operational history verified by the full trust stack.

The protocol is identity-system-agnostic, marketplace-agnostic, and payment-rail-agnostic. It specifies *how* agents are matched, not *who* they are, *where* they are listed, or *how* they pay. This architectural neutrality enables adoption across the fragmented ecosystem without requiring any marketplace to cede control.

This whitepaper specifies the complete protocol: data models for capability profiles and match requests, matching algorithms with formal analysis of stability and optimality tradeoffs, federated discovery architecture, price discovery mechanisms, trust signal integration, marketplace bootstrapping strategies for the chicken-and-egg problem, security analysis including manipulation resistance and privacy-preserving matching, and a competitive landscape survey covering 9+ existing marketplaces and 40+ sources.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Definitions](#2-definitions)
3. [Design Principles](#3-design-principles)
4. [Competitive Landscape](#4-competitive-landscape)
5. [Protocol Specification: Capability Description](#5-protocol-specification-capability-description)
6. [Protocol Specification: Compatibility Matching](#6-protocol-specification-compatibility-matching)
7. [Protocol Specification: Cross-Platform Discovery](#7-protocol-specification-cross-platform-discovery)
8. [Protocol Specification: Price Discovery](#8-protocol-specification-price-discovery)
9. [Trust-Weighted Ranking](#9-trust-weighted-ranking)
10. [Marketplace Bootstrapping](#10-marketplace-bootstrapping)
11. [Trust Ecosystem Integration](#11-trust-ecosystem-integration)
12. [Game Theory of Agent Matchmaking](#12-game-theory-of-agent-matchmaking)
13. [Biological Analogies](#13-biological-analogies)
14. [Security Analysis](#14-security-analysis)
15. [Limitations](#15-limitations)
16. [Reference Implementation](#16-reference-implementation)
17. [Future Work](#17-future-work)
18. [Conclusion](#18-conclusion)
19. [References](#19-references)

---

## 1. Introduction

### 1.1 The Matching Problem

The agent economy has discovery. Google's Agent-to-Agent (A2A) protocol, adopted by over 150 organizations as of mid-2025 [9], standardizes how agents publish their capabilities via Agent Cards at `/.well-known/agent.json`. The Model Context Protocol (MCP), donated to the Agentic AI Foundation (Linux Foundation) in December 2025, enables agents to discover tools dynamically at runtime [10]. AgentDNS [20] and the Agent Name Service (ANS) [21] propose DNS-like naming and resolution for agent endpoints. The Agent Communication & Discovery Protocol (ACDP) [22] builds on existing DNS SRV records for pragmatic discovery.

The agent economy has commerce. OpenAI's Agentic Commerce Protocol (with Stripe) enables purchases through ChatGPT [13]. Google's Universal Commerce Protocol (with Shopify, Etsy, Wayfair, Target, Walmart) standardizes agent-to-commerce interactions with 20+ partners [14]. ERC-8183 defines programmable escrow for on-chain agent transactions [23]. The x402 payment protocol reports 35 million+ transactions since mid-2025, though analysis suggests approximately half of this volume reflects infrastructure testing rather than genuine commerce [24].

What the agent economy does not have is a matching layer — a protocol-level mechanism that takes a task description, searches across the fragmented ecosystem, and returns ranked agent recommendations weighted by capability, trust, cost, and compatibility.

This is not a convenience problem. It is a market failure.

### 1.2 The Cost of Fragmentation

When marketplaces are siloed, three pathologies emerge:

**Search costs dominate transaction costs.** An enterprise seeking a code review agent must check Google Cloud's AI Agent Marketplace, Salesforce AgentExchange, AWS Marketplace, ServiceNow's AI Agent Marketplace, Berkeley's open-source marketplace, ClawHub's skill registry, and general directories — seven platforms with incompatible search interfaces, different capability taxonomies, and no way to compare results across them. For human users, this is tedious but manageable. For autonomous agents that need to hire other agents programmatically and at machine speed, it is a structural barrier to commerce.

**Platform lock-in suppresses competition.** An agent that builds reputation on Salesforce AgentExchange cannot transfer that reputation to AWS Marketplace. The agent's track record — the most informative signal of future performance — is trapped in a single platform. This creates artificial switching costs that benefit incumbents and penalize agents that serve customers across platforms. It is the agent equivalent of a driver who cannot carry their Uber rating to Lyft.

**Quality signals are absent or unverifiable.** Enterprise marketplaces validate agents once at listing time through corporate gatekeeping — Google Cloud validates for Vertex AI compatibility, Salesforce certifies for Agentforce integration. Open registries rely on community review. Neither provides ongoing quality signals. A customer choosing between two code review agents on Google Cloud's marketplace has no access to those agents' performance histories on other platforms, their dispute records, their SLA compliance rates, or their provenance chains. The information needed for a good matching decision exists, scattered across protocols and platforms. No system aggregates it.

### 1.3 The Matching Layer

AMP operates at the intersection of four established disciplines:

**Information retrieval** provides the foundation for capability-based search — matching a task description against agent capability profiles using semantic similarity, structured queries, or hybrid approaches.

**Matching theory** provides the algorithmic foundation for bilateral preference optimization — ensuring that when multiple tasks compete for the same agent and multiple agents could serve the same task, the resulting assignment is stable (no task-agent pair would prefer to be matched differently) [12].

**Platform economics** provides the market design foundation — understanding cross-side network effects, the chicken-and-egg bootstrapping problem, pricing strategies for two-sided markets, and the conditions under which fragmented marketplaces consolidate or persist [25][26].

**Mechanism design** provides the incentive engineering foundation — structuring the protocol so that honest capability reporting, accurate pricing, and genuine quality delivery are the individually rational strategies for participants [27].

AMP does not attempt to replace existing marketplaces. Like Kayak, which searches across airlines without operating flights, AMP searches across agent marketplaces without hosting agents. It is a protocol — a specification that any marketplace, registry, or discovery service can implement — not a platform. The protocol defines how capability profiles are structured, how match requests are formulated, how federated queries are executed, how results are ranked using trust signals, and how price discovery operates within the matching flow.

### 1.4 Scope and Non-Goals

AMP specifies:
- Capability description format (Unified Capability Profile)
- Match request and response schemas
- Matching algorithms with formal stability analysis
- Federated discovery query protocol
- Price discovery mechanisms
- Trust signal integration points
- Marketplace bootstrapping recommendations

AMP does not specify:
- Agent identity (deferred to CoC [15], W3C DIDs [28], A2A Agent Cards [9])
- Agent communication (deferred to A2A, MCP, ACDP)
- Payment settlement (deferred to x402, ERC-8183, traditional payment APIs)
- Agreement formation (deferred to ASA [18])
- Dispute resolution (deferred to AJP [17])
- Quality verification (deferred to ASA's Verification API [18])

AMP consumes outputs from all of these protocols; it does not duplicate them.

---

## 2. Definitions

The following terms are used throughout this specification with precise meanings:

| Term | Definition |
|------|-----------|
| **Agent** | An autonomous software entity capable of performing tasks, making decisions, and interacting with other agents or humans without continuous human supervision |
| **Capability** | A specific type of work an agent can perform, described at a level of abstraction that is meaningful for matching (e.g., "code review for Python microservices," not "invoke a linter") |
| **Capability Profile** | A structured, machine-readable description of an agent's capabilities, performance characteristics, cost parameters, and availability — formalized in AMP as a Unified Capability Profile (UCP) |
| **Match Request** | A structured query describing a task to be performed, the requester's preferences across multiple dimensions (quality, cost, speed, trust), and any hard constraints |
| **Match Response** | A ranked list of agents that satisfy the match request's constraints, ordered by composite compatibility score |
| **Compatibility Score** | A multi-dimensional score reflecting how well an agent fits a specific match request, computed from capability match, trust signals, cost alignment, availability, and style compatibility |
| **Registry** | Any system that stores and serves agent capability profiles — enterprise marketplaces, open registries, self-hosted endpoints |
| **Federation** | The protocol mechanism by which AMP queries multiple registries simultaneously and merges results into a unified ranking |
| **Trust Signal** | A verifiable claim about an agent's history or quality, sourced from trust ecosystem protocols (CoC provenance, ARP reputation, ASA compliance, AJP dispute record, ALP lifecycle status) |
| **Price Discovery** | The process by which a requester and a provider agree on the cost of a service, via posted prices, auction, or negotiation |
| **Stable Matching** | A matching assignment where no unmatched task-agent pair would mutually prefer to be matched with each other over their current assignments [12] |
| **Bootstrapping** | The process of overcoming the chicken-and-egg problem in a two-sided marketplace: attracting initial supply (listed agents) and demand (task requesters) simultaneously |
| **UCP** | Unified Capability Profile — AMP's machine-readable format for describing agent capabilities, interoperable with A2A Agent Cards, MCP manifests, and OpenClaw skill specs |
| **AMP Node** | An implementation of the AMP protocol that can receive match requests, query registries, compute rankings, and return match responses |

---

## 3. Design Principles

AMP's design is guided by seven principles derived from the failures of existing marketplaces and the requirements of the agent economy:

### 3.1 Protocol, Not Platform

AMP is a specification, not a service. Any organization can implement an AMP Node without permission from AB Support or any central authority. This follows the model of HTTP (anyone can implement a web server), DNS (anyone can run a resolver), and A2A (anyone can publish an Agent Card). The alternative — a centralized matchmaking platform — would create a single point of failure, a rent-seeking intermediary, and a gatekeeping bottleneck that contradicts the open, decentralized character of the trust ecosystem.

The tradeoff is real: a centralized platform captures more value (Kayak's CPC model, App Store's 30% commission) and can iterate faster on matching quality. The protocol approach sacrifices these in favor of adoption breadth and ecosystem resilience. This is a deliberate choice: AMP's value comes from being the matching standard, not the matching service.

### 3.2 Consume, Don't Duplicate

AMP does not reinvent identity, communication, payment, agreements, disputes, or quality verification. It consumes outputs from protocols that already handle these functions:

| Function | Protocol | AMP's Consumption |
|----------|----------|-------------------|
| Identity | CoC, DIDs, A2A Cards | Verify agent identity before including in results |
| Reputation | ARP v2 | Use composite scores as ranking signals |
| Agreements | ASA | Use SLA compliance history as reliability indicator |
| Disputes | AJP | Use dispute rate and outcomes as risk signal |
| Lifecycle | ALP | Filter out deprecated/decommissioned agents |
| Communication | A2A, MCP | Route match results through existing channels |
| Payment | x402, ERC-8183 | Integrate price discovery without handling settlement |

This "consume, don't duplicate" principle keeps AMP focused on its core contribution — matching — while enabling depth through integration.

### 3.3 Multi-Dimensional by Default

Single-dimension ranking (e.g., "sort by price" or "sort by rating") is the default in most marketplaces because it is easy to implement and easy for humans to understand. It is also categorically wrong for agent matchmaking.

An agent with perfect accuracy but 10-minute response times is useless for real-time customer support. An agent with the lowest price but a 40% dispute rate is more expensive in expectation than a premium agent with a 2% dispute rate. An agent with high ratings on code review for JavaScript may be mediocre at Python microservice review.

AMP requires multi-dimensional match requests and multi-dimensional compatibility scoring. The dimensions are:

| Dimension | Source | What It Measures |
|-----------|--------|-----------------|
| **Capability Match** | UCP semantic similarity | How well the agent's capabilities fit the task |
| **Trust Score** | CoC + ARP + ASA + AJP composite | How trustworthy the agent is |
| **Cost Alignment** | Price signals | How well the agent's pricing fits the budget |
| **Availability** | Registry status + ALP lifecycle | Whether the agent is currently available and active |
| **Style Compatibility** | UCP metadata + interaction history | Whether the agent's output format and interaction style match preferences |
| **Domain Relevance** | ARP dimensional scores + ASA history | How well the agent's track record in this specific domain matches the task |

Requesters specify weights across these dimensions. The protocol does not impose a default weighting — different use cases have legitimately different priorities.

### 3.4 Trust Is Earned, Not Declared

Existing marketplaces rely on declared trust — the agent (or its publisher) claims certain capabilities, and the marketplace validates the claim once. AMP replaces declaration with evidence:

- An agent claims "99% accuracy on code review" → AMP checks ASA quality verification pass rates on actual code review tasks
- An agent claims "enterprise-grade reliability" → AMP checks ARP reliability scores across historical interactions
- An agent claims "trusted by 500 organizations" → AMP checks CoC chain length and AJP dispute record

Where trust evidence exists, AMP uses it. Where it does not (new agents, agents from platforms without trust integration), AMP applies appropriate discounting without excluding the agent entirely (see Section 10.3, New Agent Onboarding).

### 3.5 Federated Architecture, Local Autonomy

AMP's federated discovery model respects the autonomy of each marketplace and registry. An AMP query does not require marketplaces to expose their full agent databases. Instead, each participating registry implements a standardized query endpoint that:

1. Accepts a match request in AMP format
2. Searches its own agent inventory against the request
3. Returns matching agents with standardized capability profiles
4. Retains full control over which agents it exposes and how

This is analogous to how Kayak queries airline APIs — each airline controls its own inventory and pricing; Kayak merely aggregates results. A marketplace can participate in AMP federation without ceding control over its agents, its data, or its business model.

### 3.6 Bootstrapping-Aware Design

The chicken-and-egg problem — no agents list because there are no requesters, no requesters search because there are no agents — kills most two-sided marketplaces before they reach critical mass [25]. AMP addresses this structurally by not requiring a new marketplace to be built. Because AMP is a federation protocol, it bootstraps by connecting existing registries (ClawHub with 13,729 skills, Berkeley with 150+ agents, Apify with 4,000+ tools, enterprise marketplaces with hundreds of validated agents) rather than requiring new supply. The supply already exists — as a mix of skills, tools, agent profiles, and directory entries at varying levels of abstraction — and is merely fragmented.

### 3.7 Privacy-Preserving Where Possible

Agents may have competitive reasons to conceal parts of their capability profiles. A proprietary research agent may not want to disclose its exact tool chain. AMP supports progressive disclosure: agents publish enough capability information for matching but can withhold implementation details until after a match is confirmed and an agreement is negotiated. Trust signals can be verified in aggregate (e.g., "this agent's ARP composite score exceeds 80") without revealing exact dimensional scores, using the zero-knowledge proof mechanisms specified in ARP v2 [16].

---

## 4. Competitive Landscape

### 4.1 Enterprise Walled Gardens

The dominant agent marketplaces as of early 2026 are enterprise platforms that bundle discovery with their cloud ecosystems:

**Google Cloud AI Agent Marketplace** launched in 2025 within Google Cloud Marketplace, offering access to specialized agents from validated partners using Gemini-powered natural language search [1]. PwC alone has published over 120 agents on the platform [29]. Discovery uses natural language queries — customers describe a use case and the system returns matching agents validated for A2A and Gemini Enterprise integration. An "Agent Finder" tool provides browsable access. Strengths: sophisticated NL search, enterprise billing integration. Limitation: only Google Cloud-validated agents are visible; cross-platform agents are excluded.

**Salesforce AgentExchange** launched March 4, 2025 with 200+ initial partners including Google Cloud, Docusign, and Box, positioning itself as "the world's first agent marketplace" [2]. It offers four component types: Actions, Prompt Templates, Topics, and Agent Templates. By late 2025, Salesforce extended this with Agentforce 360 for AWS, bridging the Salesforce and AWS ecosystems [30]. Strengths: large partner ecosystem, deep CRM integration, cross-cloud extension. Limitation: tightly coupled to Agentforce — non-Salesforce agents cannot list.

**AWS Marketplace (AI Agents)** added a dedicated "AI Agents & Tools" section integrated with Amazon Bedrock AgentCore, generally available October 13, 2025 [3]. At a recent AWS AI agent hackathon, 80% of 600 agents were built using AgentCore [3]. Customers can use MCP servers procured through AWS Marketplace as MCP targets on AgentCore Gateway, bridging MCP and AWS infrastructure. Strengths: developer adoption (AgentCore), flexible usage-based pricing, MCP bridge. Limitation: AWS-centric; agents must integrate with Bedrock.

**ServiceNow AI Agent Marketplace** relaunched in 2025 with a native AI assistant that provides personalized recommendations based on a customer's existing applications and integrations [4]. Launch partners include Accenture, Deloitte, HCLTech, and seven other enterprise integrators. Strengths: AI-powered recommendation engine (more sophisticated than category browsing), industry-specific collections. Limitation: tied to ServiceNow platform.

### 4.2 Open Registries and Directories

**UC Berkeley Gorilla Agent Marketplace** operates an open-source search engine for 150+ verified LLM agents sourced from Langchain, LlamaIndex, OpenAI, and CrewAI [5]. Community-reviewed, cross-framework compatible, permissionless listing. Strengths: open, cross-framework. Limitation: small scale, no transactional capability.

**ClawHub** hosts 13,729 community-built skills as of February 2026, discoverable via vector-based semantic search powered by OpenAI embeddings [6]. Each skill is a SKILL.md file with YAML frontmatter and markdown instructions. Security is a concern: researchers discovered 1,467 malicious skills (~3% of the registry), with 91% combining prompt injection with traditional malware [31][32]. Strengths: largest open registry, semantic search, npm-like CLI. Limitation: skills describe individual capabilities, not composite agent profiles; significant security risks in community-moderated content.

**AI Agent Store** and **AI Agents Directory** aggregate metadata about 1,300+ agents across categories but do not handle deployment, billing, or runtime [7]. They function as directories rather than transactional marketplaces.

**Apify** offers 4,000+ web scrapers, agents, and automation tools with MCP integration [33]. **Agen.cy** provides a browsable agent directory for discovery by task and industry.

### 4.3 Research and Simulation

**Microsoft Magentic Marketplace** (November 2025) is an open-source simulation environment for studying agentic markets, not a production marketplace [34][35]. Key findings from controlled experiments with hundreds of simultaneous buyer and seller agents: (a) frontier models achieve strong welfare outcomes in ideal settings but performance degrades at scale, (b) emergent failure modes include manipulation and speed bias where seller agents exploit buyer agents' attention limits, and (c) buyer agents given more options experience decision quality degradation as choice overload overwhelms their context windows [36]. Open-sourced on GitHub (microsoft/multi-agent-marketplace). Strengths: most rigorous empirical data on agent marketplace dynamics. Limitation: simulation, not production system.

### 4.4 What No Existing System Provides

| Capability | Google Cloud | Salesforce | AWS | ServiceNow | Berkeley | ClawHub | Magentic | **AMP** |
|-----------|-------------|-----------|-----|-----------|---------|---------|---------|---------|
| Cross-platform search | No | Partial (AWS bridge) | No | No | Partial | No | N/A | **Yes** |
| Multi-dimensional matching | No | No | No | AI-powered | No | Semantic | Research | **Yes** |
| Trust-weighted ranking | Corporate validation | Partner certification | AWS review | Partner cert | Community | Community + scan | N/A | **Verifiable trust stack** |
| Price discovery | Platform billing | Platform billing | Usage-based | Platform billing | Free | Free | Simulated | **Multi-mechanism** |
| Stable matching guarantee | No | No | No | No | No | No | Studied | **Yes (batch mode)** |
| Open protocol | No | No | No | No | Yes | Yes | Yes | **Yes** |
| Privacy-preserving | N/A | N/A | N/A | N/A | No | No | N/A | **Partial (TLS + anonymization; ZKP via ARP v2 for score thresholding)** |

The gap is clear: no system combines open, cross-platform search with multi-dimensional trust-weighted matching, formal stability guarantees, and multi-mechanism price discovery. AMP occupies this gap.

**Note on comparison methodology:** This table compares protocol-level features rather than operational readiness. Existing platforms have real strengths that AMP does not yet match — including operational maturity, enterprise billing integration, established customer support, SLA guarantees backed by corporate liability, and years of production hardening. AMP's advantages are architectural (openness, federation, trust integration); the incumbents' advantages are operational. A production deployment would need to close the operational gap to compete with established platforms. AMP's stable matching guarantee applies in batch mode; real-time stability requires complementary mechanisms (see Section 6.3).

---

## 5. Protocol Specification: Capability Description

### 5.1 The Problem with Existing Descriptions

Agent capability descriptions exist at three levels of abstraction, none sufficient alone:

**Tool-level (MCP manifests):** List individual tools an agent can invoke — web scraping, file parsing, API calls [10]. These are implementation details, not capabilities. Knowing that an agent has a web scraping tool does not tell you whether it can conduct competitive research.

**Skill-level (OpenClaw specs):** Describe individual skills in human-readable markdown with YAML metadata [11]. More abstract than tools, but still atomic — a skill describes "web scraping" or "summarization," not a composite capability like "research agent that combines web scraping, summarization, and citation verification."

**Agent-level (A2A Agent Cards):** Describe what an agent can do at the interface level — skills, supported authentication, input/output modalities [9]. Agent Cards are discovery-oriented: they tell you what an agent can do, but not how well, how reliably, at what cost, or compared to alternatives.

### 5.2 Unified Capability Profile (UCP)

AMP introduces the Unified Capability Profile (UCP) — a capability description format that composes tool-level and skill-level descriptions into agent-level profiles enriched with performance characteristics, trust signals, and compatibility metadata.

A UCP contains five sections:

**5.2.1 Identity Section**

Links the UCP to the agent's identity across systems:

```json
{
  "identity": {
    "amp_id": "amp:agent:abc123",
    "a2a_card": "https://agent.example.com/.well-known/agent.json",
    "coc_chain_id": "coc:chain:sha256:a1b2c3...",
    "did": "did:web:agent.example.com",
    "registries": [
      {"type": "google_cloud", "listing_id": "gc-agent-456"},
      {"type": "clawhub", "skill_ids": ["web-research-v3", "citation-verify"]}
    ]
  }
}
```

The identity section is cross-referenced, not authoritative — identity verification is deferred to the respective identity protocols (CoC, DIDs, A2A).

**5.2.2 Capability Section**

Describes what the agent can do using a hierarchical taxonomy:

```json
{
  "capabilities": [
    {
      "domain": "research",
      "subdomain": "competitive_analysis",
      "description": "Conducts comprehensive competitive landscape research with web scraping, document analysis, and structured report generation",
      "input_modalities": ["text", "url", "document"],
      "output_modalities": ["text", "structured_data", "report"],
      "tools_used": ["web_scraper", "pdf_parser", "summarizer", "citation_engine"],
      "complexity_range": {
        "min": "single-competitor profile",
        "max": "full market landscape with 50+ entities"
      },
      "taxonomy_codes": {
        "onet_soc": "15-2051.01",
        "amp_capability": "research.competitive.landscape"
      }
    }
  ]
}
```

The `taxonomy_codes` field supports multiple classification systems. AMP defines its own hierarchical capability taxonomy (inspired by O*NET's structure of generalized → intermediate → detailed work activities [37]) while maintaining interoperability with existing occupational classifications. The AMP taxonomy is not prescriptive — agents may declare capabilities using free-text descriptions, structured taxonomy codes, or both. Semantic matching handles the translation.

**5.2.3 Performance Section**

Describes empirically observed performance characteristics:

```json
{
  "performance": {
    "reliability": {
      "asa_completion_rate": 0.982,
      "asa_sample_size": 247,
      "uptime_30d": 0.997
    },
    "quality": {
      "arp_composite_score": 84.2,
      "arp_dimensional_scores": {
        "accuracy": 91.3,
        "reliability": 88.7,
        "latency": 72.1,
        "protocol_compliance": 95.0,
        "cost_efficiency": 73.8
      },
      "qv_pass_rate": 0.94,
      "qv_sample_size": 189
    },
    "speed": {
      "median_response_time_ms": 45000,
      "p95_response_time_ms": 180000,
      "throughput_tasks_per_hour": 12
    },
    "dispute_profile": {
      "ajp_dispute_rate": 0.018,
      "ajp_favorable_resolution_rate": 0.85,
      "ajp_sample_size": 55
    }
  }
}
```

Performance metrics are not self-reported. They are computed from trust ecosystem protocol data and cryptographically verifiable:
- `arp_composite_score` is derived from ARP v2's signal composition algebra [16]
- `asa_completion_rate` is computed from ASA agreement records [18]
- `ajp_dispute_rate` is computed from AJP case records [17]
- `coc_chain_length` is verifiable against anchored timestamps [15]

Where verifiable data is unavailable (e.g., agents not integrated with the trust ecosystem), fields are omitted rather than estimated. An AMP Node MAY display unverified self-reported metrics, but MUST clearly distinguish them from verified metrics in match results.

**5.2.4 Cost Section**

Describes the agent's pricing model:

```json
{
  "cost": {
    "pricing_model": "usage_based",
    "base_rate": {"amount": 0.05, "currency": "USD", "per": "request"},
    "variable_rate": {"amount": 0.002, "currency": "USD", "per": "output_token"},
    "supports_negotiation": true,
    "supports_auction": false,
    "payment_rails": ["x402", "stripe", "invoice"],
    "free_tier": {"requests_per_month": 100}
  }
}
```

### 5.2.5 Availability Section

```json
{
  "availability": {
    "status": "active",
    "alp_lifecycle_stage": "operational",
    "capacity": {
      "current_load_pct": 45,
      "max_concurrent_tasks": 20,
      "estimated_queue_time_ms": 5000
    },
    "schedule": {
      "timezone": "UTC",
      "available_hours": "00:00-23:59",
      "maintenance_windows": []
    }
  }
}
```

### 5.3 UCP Interoperability

UCPs are designed to be generated from existing capability descriptions:

| Source Format | Mapping to UCP |
|--------------|----------------|
| A2A Agent Card | Identity → `a2a_card`; Skills → Capability Section; Authentication → filtered |
| MCP Tool Manifest | Tools → `tools_used` in Capability Section; Parameters → `complexity_range` |
| OpenClaw SKILL.md | YAML frontmatter → Capability Section; Required binaries → `tools_used` |
| Custom API | Implementer maps to UCP schema; unmapped fields preserved in `extensions` |

An AMP Node SHOULD be able to ingest A2A Agent Cards, MCP manifests, and OpenClaw specs directly, generating UCPs automatically. This reduces the barrier to adoption: agents already listed on existing platforms do not need to create UCPs manually.

### 5.4 Capability Taxonomy

AMP defines a three-level hierarchical capability taxonomy:

**Level 1 — Domains** (8 domains): research, development, analysis, communication, operations, creative, security, domain-specific

**Level 2 — Subdomains** (~40 subdomains): e.g., research.competitive, research.academic, development.frontend, development.backend, analysis.financial, analysis.legal, communication.translation, communication.summarization

**Level 3 — Capabilities** (open-ended): specific capabilities within each subdomain, e.g., research.competitive.landscape, development.backend.api_design, analysis.financial.valuation

Level 1 and Level 2 are protocol-defined and version-controlled. Level 3 is extensible — agents may declare new capabilities at Level 3 without requiring protocol updates. Semantic matching handles novel Level 3 capabilities that do not exactly match known taxonomy entries.

**Taxonomy status:** The Level 1 domains and Level 2 subdomain examples listed above are illustrative and draft. The complete Level 2 taxonomy (~40 subdomains) will be published as a separate versioned artifact prior to AMP v1.0 finalization. Implementers building against the current specification should treat taxonomy codes as provisional and design their systems to accommodate taxonomy updates. The structural framework (three-level hierarchy, O*NET-inspired decomposition) is stable; the specific codes are not.

The taxonomy draws structural inspiration from O*NET's hierarchical decomposition of occupational activities [37], but is purpose-built for agent capabilities rather than human occupations. Where O*NET maps occupations → generalized activities → intermediate activities → detailed activities → task statements, AMP maps agents → domains → subdomains → capabilities → task types. The structural parallel enables future bridging between human and agent capability ontologies, which may become relevant as agent-human collaboration deepens.

---

## 6. Protocol Specification: Compatibility Matching

### 6.1 Match Request Schema

A match request specifies what the requester needs and how they prioritize different dimensions:

```json
{
  "match_request": {
    "request_id": "mr-20260326-001",
    "requester_id": "amp:agent:requester-xyz",
    "task": {
      "description": "Review Python microservice code for security vulnerabilities, focusing on authentication flows and data validation",
      "domain": "security",
      "subdomain": "code_review",
      "input": {"type": "code_repository", "language": "python", "loc_estimate": 15000},
      "output": {"type": "security_report", "format": "structured_json"},
      "deadline_ms": 3600000,
      "budget": {"max_amount": 50.00, "currency": "USD"}
    },
    "weights": {
      "capability_match": 0.30,
      "trust_score": 0.25,
      "cost_alignment": 0.15,
      "availability": 0.10,
      "style_compatibility": 0.05,
      "domain_relevance": 0.15
    },
    "constraints": {
      "min_trust_score": 60,
      "max_dispute_rate": 0.05,
      "required_lifecycle_status": ["operational"],
      "excluded_agents": [],
      "required_registries": [],
      "max_results": 10
    },
    "federation": {
      "registries": ["all"],
      "timeout_ms": 5000
    }
  }
}
```

The `weights` object sums to 1.0 and determines the relative importance of each dimension in the compatibility score. The `constraints` object specifies hard filters — agents that fail any constraint are excluded before scoring. This two-phase approach (filter then rank) mirrors the standard information retrieval pipeline and is computationally efficient.

### 6.2 Compatibility Score Computation

Given a match request `R` and a candidate agent `A`, the compatibility score `S(R, A)` is computed as:

```
S(R, A) = w_cap * C_capability(R, A)
        + w_trust * C_trust(R, A)
        + w_cost * C_cost(R, A)
        + w_avail * C_availability(R, A)
        + w_style * C_style(R, A)
        + w_domain * C_domain(R, A)
```

Where each dimension score `C_x` is normalized to [0, 100] and each weight `w_x` is from the match request's `weights` object.

**Capability Match (`C_capability`):**

Computed via semantic similarity between the task description and the agent's UCP capability descriptions. AMP does not prescribe a specific embedding model but requires that the similarity function satisfy three properties:
1. **Asymmetric relevance:** "code review for Python microservices" should match "Python security analysis" more strongly than "JavaScript frontend testing," even if the raw embedding similarity is similar
2. **Tool awareness:** if the task requires specific tools (e.g., SAST scanner), agents with those tools in their `tools_used` receive a bonus
3. **Complexity fit:** if the task complexity is outside the agent's declared `complexity_range`, the score is discounted

Formally:

```
C_capability(R, A) = sim(R.task.description, A.capabilities)
                   * tool_bonus(R.task, A.tools_used)
                   * complexity_fit(R.task, A.complexity_range)
```

Where `sim` is a semantic similarity function returning [0, 1], `tool_bonus` returns [1.0, 1.2] (up to 20% bonus for tool matches), and `complexity_fit` returns [0.5, 1.0] (50% penalty for out-of-range complexity, 1.0 for in-range).

**Trust Score (`C_trust`):**

Derived from ARP v2's composite signal [16]:

```
C_trust(R, A) = f(ARP_composite, CoC_chain_length, ASA_compliance, AJP_dispute_rate)
```

Where `f` is the ARP v2 signal composition function with domain-specific weight profiles. If the agent lacks trust ecosystem integration, `C_trust` defaults to a configurable baseline (default: 50) representing neutral trust — neither trusted nor distrusted.

**Cost Alignment (`C_cost`):**

```
C_cost(R, A) = max(0, 100 - penalty * |estimated_cost(A, R.task) - R.task.budget.target|)
```

Where `estimated_cost` projects the agent's pricing model onto the specific task, and `penalty` scales with budget sensitivity. Agents priced within the budget receive high scores; agents significantly above budget are penalized but not excluded (the requester may decide the trust premium is worth it).

**Availability (`C_availability`):**

```
C_availability(R, A) = lifecycle_check(A) * capacity_score(A) * deadline_fit(A, R.task)
```

Where `lifecycle_check` returns 0 for deprecated/decommissioned agents (hard filter), `capacity_score` returns [0, 100] based on current load, and `deadline_fit` returns [0, 100] based on whether the agent can meet the deadline given its current queue.

**Style Compatibility (`C_style`):**

Computed from output format alignment and interaction pattern history:

```
C_style(R, A) = format_match(R.task.output.format, A.output_modalities)
              * interaction_history_score(R.requester_id, A)
```

Where `interaction_history_score` reflects collaborative filtering — if the requester has previously worked well with this agent or agents with similar profiles, the score increases. For first-time interactions, this defaults to a neutral 50.

**Domain Relevance (`C_domain`):**

```
C_domain(R, A) = arp_domain_score(A, R.task.domain) * asa_domain_compliance(A, R.task.domain)
```

Where `arp_domain_score` pulls the agent's ARP dimensional scores specifically for the requested domain (not its overall composite), and `asa_domain_compliance` reflects its SLA completion rate on tasks in this specific domain.

### 6.3 Matching Algorithms

AMP supports three matching modes, selected by the requester or defaulting based on request characteristics:

**Mode 1: Ranked Search (Default)**

For single requests seeking a ranked list of candidates. This is the most common mode — equivalent to a search engine query. The AMP Node computes compatibility scores for all candidate agents, applies constraints as hard filters, and returns the top-K results ranked by composite score. Computational complexity: O(n log k) where n is the number of candidates and k is `max_results`.

**Mode 2: Stable Matching**

For batch scenarios where multiple tasks compete for the same agents and multiple agents could serve the same tasks. AMP implements a variant of the Gale-Shapley deferred acceptance algorithm [12]:

1. Each task ranks agents by compatibility score (task-side preferences)
2. Each agent ranks tasks by desirability — a function of task complexity match, offered price, and requester reputation (agent-side preferences)
3. The algorithm produces a task-optimal stable matching: no task-agent pair would mutually prefer each other over their current assignments

Gale-Shapley guarantees stability but is task-optimal (favorable to the task side). AMP provides a configuration flag to produce agent-optimal matches instead, and a median-optimal variant that balances both sides, though median-optimality requires additional computation. Computational complexity: O(n^2) in the worst case, where n is the number of tasks/agents.

**Stability caveat:** Gale-Shapley assumes complete and static preferences. In practice, agent preferences change dynamically (new tasks arrive, agents complete work, prices shift). AMP addresses this by running stable matching periodically on accumulated requests rather than continuously, accepting that between matching rounds the assignment may be temporarily suboptimal. The matching interval is configurable (default: 60 seconds for real-time markets, 300 seconds for batch markets).

**Mode 3: Auction Matching**

For scenarios where price discovery is the primary objective. The requester posts a task, agents submit bids (price + capability profile), and the auction mechanism selects the winning agent. AMP supports three auction formats:

- **English auction (ascending):** agents bid progressively lower prices. The lowest-price agent that meets minimum trust and capability thresholds wins. Suitable for commodity tasks where multiple agents are equally capable.
- **Sealed-bid second-price (Vickrey):** agents submit sealed bids; the lowest bidder wins but pays the second-lowest price. The Vickrey auction's truthful bidding property — where bidding one's true cost is the dominant strategy in the standard model [38] — makes it theoretically suitable for agent matchmaking, though the standard result assumes risk-neutral bidders with independent private values. These assumptions may hold less cleanly for agents with strategic bidding algorithms, and the literature on Vickrey auctions in automated markets suggests that collusion and shill bidding can emerge in repeated settings [39]. Additionally, the independent private values assumption is weakened in AMP's context: agents' cost structures are partially observable through their published UCP pricing models, inference costs inferrable from declared model types, and historical transaction data available through trust signals. Competing agents could potentially bid strategically below a rival's known costs to force it out. This tension between transparency (necessary for matching) and privacy (necessary for truthful bidding) is a design tradeoff that AMP acknowledges but does not fully resolve in v1. AMP mitigates these risks through reputation-based bidder qualification (Section 12.3).
- **Combinatorial auction:** for multi-agent tasks where a requester needs a team (e.g., a research agent, a code agent, and a review agent working together). Agents bid individually or as pre-formed teams. Combinatorial auctions are NP-hard in the general case [40]; AMP implements practical approximations for teams of up to 10 agents.

### 6.4 Match Response Schema

```json
{
  "match_response": {
    "request_id": "mr-20260326-001",
    "timestamp": "2026-03-26T14:30:00Z",
    "results": [
      {
        "rank": 1,
        "agent_id": "amp:agent:securitybot-prime",
        "compatibility_score": 89.3,
        "dimensional_scores": {
          "capability_match": 95.2,
          "trust_score": 88.1,
          "cost_alignment": 82.0,
          "availability": 100.0,
          "style_compatibility": 75.0,
          "domain_relevance": 92.4
        },
        "ucp_summary": {
          "primary_capability": "Python security code review with SAST/DAST integration",
          "arp_composite": 88.1,
          "asa_completion_rate": 0.991,
          "estimated_cost": {"amount": 35.00, "currency": "USD"},
          "estimated_completion_ms": 1800000
        },
        "trust_verification": {
          "coc_chain_verified": true,
          "coc_chain_length_days": 127,
          "arp_score_verified": true,
          "asa_history_verified": true,
          "ajp_record_verified": true,
          "verification_timestamp": "2026-03-26T14:29:58Z"
        },
        "registries_found_on": ["google_cloud", "clawhub"]
      }
    ],
    "metadata": {
      "registries_queried": 5,
      "registries_responded": 4,
      "total_candidates_evaluated": 237,
      "candidates_filtered_by_constraints": 198,
      "candidates_scored": 39,
      "query_time_ms": 3200
    }
  }
}
```

The `trust_verification` block is critical: it tells the requester which trust signals were independently verified by the AMP Node (not just reported by the agent). This distinguishes AMP from marketplaces that display self-reported metrics.

---

## 7. Protocol Specification: Cross-Platform Discovery

### 7.1 Federation Model

AMP federation connects an AMP Node to multiple registries through a standardized query interface. The architecture has three layers:

```
┌──────────────────────────────────────────────────────┐
│                     AMP NODE                          │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │ Match      │  │ Federation  │  │ Trust        │  │
│  │ Engine     │  │ Router      │  │ Verifier     │  │
│  └─────┬──────┘  └──────┬──────┘  └──────┬───────┘  │
│        │                │                │           │
└────────┼────────────────┼────────────────┼───────────┘
         │                │                │
   ┌─────┴──────┐  ┌─────┴──────┐  ┌─────┴──────┐
   │ Registry   │  │ Registry   │  │ Registry   │
   │ Adapter:   │  │ Adapter:   │  │ Adapter:   │
   │ Google     │  │ ClawHub    │  │ A2A        │
   │ Cloud      │  │            │  │ Self-hosted│
   └────────────┘  └────────────┘  └────────────┘
```

**Match Engine:** Receives match requests, computes compatibility scores, produces ranked results.

**Federation Router:** Dispatches match request subqueries to registered registries in parallel, collects responses, normalizes results into UCPs, and passes them to the Match Engine.

**Trust Verifier:** Independently verifies trust signals (CoC chain entries, ARP scores, ASA records, AJP dispute data) against their authoritative sources. This is the component that transforms declared trust into verified trust.

**Registry Adapters:** Protocol-specific connectors that translate AMP federation queries into each registry's native query format and translate responses back into UCPs. Adapters are pluggable — new registries require only a new adapter, not protocol changes.

### 7.2 Federation Query Protocol

An AMP federation query follows a five-step process:

**Step 1: Query Translation.** The AMP Node translates the match request into registry-specific subqueries. For a Google Cloud adapter, this means constructing a Gemini-compatible natural language query from the task description. For a ClawHub adapter, this means constructing a semantic search query against the skill embedding index. For an A2A self-hosted adapter, this means querying `/.well-known/agent.json` endpoints.

**Step 2: Parallel Dispatch.** Subqueries are dispatched to all registered adapters simultaneously with a configurable timeout (default: 5000ms). Registries that do not respond within the timeout are excluded from the current match — their absence is noted in the response metadata.

**Step 3: Response Normalization.** Each adapter translates its registry's response into UCPs. Fields that cannot be mapped are preserved in an `extensions` object rather than discarded.

**Step 4: Deduplication and Conflict Resolution.** Agents may be listed on multiple registries. The AMP Node deduplicates by matching on identity fields (DID, CoC chain ID, A2A card URL). When the same agent appears from multiple registries, the UCP is merged — taking the most complete data from each source and noting which registries the agent was found on.

When data conflicts between registries (e.g., one registry reports Python support while another reports JavaScript, or capability scores differ), AMP applies a conflict resolution hierarchy: (1) data from higher trust-tier sources takes precedence over lower-tier sources, (2) among equal trust tiers, the most recently updated data wins, and (3) unresolvable conflicts are flagged in the match response metadata with a `data_conflicts` field, allowing the requester to assess discrepancies. AMP Nodes SHOULD NOT silently discard conflicting data.

**Step 5: Trust Enrichment.** For each deduplicated UCP, the Trust Verifier queries the trust ecosystem to populate verified performance metrics. This step is optional but strongly recommended — without it, all trust signals are unverified declarations.

### 7.2.1 Federation Latency Analysis

The five-step federation query introduces latency that must be understood for practical deployment. The example match response (Section 6.4) shows `query_time_ms: 3200` for 237 candidates — here is a breakdown of expected latency contributions:

| Step | Expected Latency | Notes |
|------|-----------------|-------|
| Query Translation | 5-20ms | Local computation, negligible |
| Parallel Dispatch | 500-5000ms | Bounded by timeout; dominated by slowest registry |
| Response Normalization | 10-50ms per registry | Local computation, parallelizable |
| Deduplication + Conflict Resolution | 20-100ms | Scales with candidate count |
| Trust Enrichment | 200-3000ms | Dominant cost; depends on cache state |

**Trust enrichment is the latency bottleneck.** Verifying CoC chain entries, fetching ARP scores, checking ASA records, querying AJP, and confirming ALP status could each require 100-500ms per external API call. For 39 scored candidates (after filtering 198 of 237), serial enrichment would take 20-100 seconds — clearly impractical.

AMP Nodes SHOULD implement three latency mitigation strategies:

1. **Aggressive caching:** Trust signals change slowly (ARP scores update after interactions, not continuously). A 15-minute cache TTL for trust data reduces enrichment to a cache lookup for most candidates. Cold-cache queries for unfamiliar agents will be significantly slower than the 3200ms example suggests.

2. **Parallel enrichment:** Trust protocol queries for different agents are independent and can be dispatched concurrently. With 10-way parallelism, enriching 39 candidates requires ~4 sequential batches rather than 39 sequential calls.

3. **Tiered enrichment:** Enrich trust data only for candidates that pass initial capability and constraint filtering. In the example, only 39 of 237 candidates needed trust enrichment — a 6x reduction in enrichment load.

With caching and parallelism, the 3200ms figure in the example is achievable for warm-cache queries. Cold-cache queries against 5+ registries with full trust enrichment may take 5-10 seconds. AMP Nodes SHOULD report cache hit rates in response metadata so requesters can assess result freshness.

### 7.3 Registry Registration

Any registry can participate in AMP federation by implementing a minimal query endpoint:

```
POST /amp/v1/search
Content-Type: application/json

{
  "query": {
    "text": "Python security code review",
    "domain": "security",
    "subdomain": "code_review",
    "constraints": {
      "min_trust_score": 60,
      "max_results": 50
    }
  }
}
```

The response format is flexible — the registry adapter handles translation. The minimum requirement is that the response contains enough information to construct a partial UCP (at minimum: agent identifier and capability description).

Registries self-register with AMP Nodes by providing their endpoint URL and a manifest describing their adapter requirements, supported query parameters, and expected response format. There is no central registry of registries — each AMP Node maintains its own registry list. Registry lists can be shared between AMP Nodes through a simple syndication protocol (analogous to OPML for feed aggregators), enabling network effects without centralization.

### 7.4 Integration with Existing Discovery Protocols

AMP federation is designed to complement, not compete with, existing discovery protocols:

**A2A Agent Cards:** AMP Nodes can crawl `/.well-known/agent.json` endpoints directly, treating the web itself as a registry. This is the lowest-friction integration path — any A2A-compliant agent is automatically discoverable by AMP without any additional registration.

**AgentDNS [20]:** If AgentDNS achieves adoption, AMP Nodes can use AgentDNS resolution as a discovery source — resolving agent names to endpoints, then fetching Agent Cards from those endpoints.

**ANS [21]:** ANS's protocol-agnostic naming and PKI-based identity integrate naturally with AMP's identity verification. An ANS-registered agent's verified identity can be consumed by AMP's Trust Verifier.

**ACDP [22]:** ACDP's use of DNS SRV records for agent discovery provides another registry source. AMP Nodes can query SRV records to discover agents in specific domains.

The emerging discovery stack — identity (DIDs/PKI), naming (AgentDNS/ANS), capability (A2A Agent Cards/MCP) — provides the first three layers. AMP adds the fourth: matching. Discovery tells you what exists; AMP tells you what's best for your specific need.

---

## 8. Protocol Specification: Price Discovery

### 8.1 The Price Discovery Problem

Agent pricing is currently either invisible (enterprise platforms handle billing opaquely), fixed (posted prices on registries), or absent (open-source agents are free). None of these serve the emerging agent economy well:

- **Opaque pricing** prevents comparison shopping and suppresses competition
- **Fixed pricing** cannot respond to demand fluctuations, urgency premiums, or bulk discounts
- **Free** is not sustainable for high-quality agents with significant inference costs

Gartner projects that by 2028, 90% of B2B buying will be AI agent-intermediated, pushing over $15 trillion of B2B spend through AI agent exchanges [41]. McKinsey estimates the global agentic commerce opportunity — AI agents that shop, negotiate, and transact on behalf of humans — at $3-5 trillion by 2030, with up to $1 trillion in orchestrated U.S. retail revenue alone [42]. These projections suggest, albeit with the uncertainty inherent in analyst forecasts, that agent-to-agent price discovery will become a significant economic function.

### 8.2 Supported Price Discovery Mechanisms

AMP supports three price discovery mechanisms, selectable per match request:

**Mechanism 1: Posted Price (default)**

The simplest mechanism. The agent's UCP declares its pricing model, and the AMP Node estimates the cost for the specific task based on that model. No negotiation occurs. This is appropriate for:
- Commodity tasks where prices are well-established
- High-volume, low-value transactions where negotiation overhead exceeds potential savings
- Requesters who prefer predictability over optimization

**Mechanism 2: Request for Quote (RFQ)**

The AMP Node sends the task description to matched agents and solicits price quotes. Each agent returns a quote specific to the task, optionally with a validity window. The requester selects from quoted prices. This is appropriate for:
- Complex tasks where pricing depends on specific details
- First-time interactions where posted prices may not apply
- Tasks where agents may offer volume discounts or quality tiers

RFQ interaction:
```
Requester → AMP Node: match_request with price_discovery: "rfq"
AMP Node → Matched Agents: task_description + quote_request
Agents → AMP Node: quotes (price, terms, validity_window)
AMP Node → Requester: match_response with quotes attached to each result
Requester → Selected Agent: accept_quote(quote_id)
```

**Mechanism 3: Auction**

As described in Section 6.3 (Mode 3), auctions are used when price competition is the primary matching objective. AMP supports English, Vickrey (sealed-bid second-price), and combinatorial auction formats.

### 8.3 Price Signal Integration

Price discovery outputs feed back into the matching system:

- **Historical price data** for similar tasks informs cost estimation in posted-price mode
- **Auction outcomes** contribute to price indices that improve future cost alignment scoring
- **RFQ patterns** reveal which agents consistently quote below their peers while maintaining quality — a signal that their posted prices may be inflated

Price signals are NOT incorporated into trust scores — an agent's pricing decisions are a business strategy, not a trust indicator. An expensive agent is not less trustworthy than a cheap one. However, price-quality correlation is tracked: agents whose prices significantly exceed their quality-adjusted peer average receive a disclosure flag in match results (not a penalty, but transparency).

### 8.4 Integration with Commerce Protocols

AMP's price discovery integrates with existing commerce infrastructure:

- **OpenAI Agentic Commerce Protocol [13]:** AMP can route accepted matches through Agentic Commerce for payment via Stripe
- **Google Universal Commerce Protocol [14]:** For agents integrated with Google's commerce partners, AMP match results include UCP-compatible pricing
- **x402 [24]:** Micropayment-compatible tasks can settle immediately via x402 after AMP matching
- **ERC-8183 [23]:** For trustless transactions, AMP match results can include escrow parameters for ERC-8183 integration
- **ASA [18]:** AMP match acceptance triggers ASA agreement formation, embedding the agreed price into a machine-readable service agreement with automated quality verification and escrow

AMP does not handle payment settlement — it discovers prices and facilitates agreement, then hands off to the appropriate payment rail.

---

## 9. Trust-Weighted Ranking

### 9.1 The Problem with Unweighted Rankings

A search engine that returns results without quality weighting is a directory. Google's PageRank transformed web search by using link structure as a quality signal, demoting spam and promoting authoritative sources [43]. Amazon's product rankings combine sales velocity, reviews, price, and seller reputation into a single relevance score. Without trust-weighted ranking, an agent marketplace is just a directory — it tells you what exists but not what's good.

Existing agent marketplaces use one of three trust models, all inadequate:

| Model | Example | Limitation |
|-------|---------|-----------|
| **Corporate gatekeeping** | Google Cloud, Salesforce, AWS | One-time validation; no ongoing quality signal; excludes non-partner agents |
| **Community review** | Berkeley, ClawHub | Susceptible to Sybil attacks, review gaming, and recency bias |
| **None** | AI Agent Store, Agen.cy | Pure directory; zero quality signal |

### 9.2 Trust Signal Hierarchy

AMP defines a four-tier trust signal hierarchy, with each tier representing a stronger form of trust evidence:

**Tier 1 — Declared (lowest):** Agent self-reports capabilities and performance. No verification. Examples: free-text capability descriptions, self-reported accuracy claims.

**Tier 2 — Attested:** A third party vouches for the agent. Examples: corporate marketplace validation (Google Cloud-approved), community reviews (Berkeley Gorilla ratings), partner certification (Salesforce AgentExchange partner).

**Tier 3 — Measured:** Performance metrics computed from actual interaction data. Examples: ARP composite scores from bilateral blind evaluation, ASA completion rates from agreement records, AJP dispute rates from case records.

**Tier 4 — Verified (highest):** Measured metrics that are independently verifiable by any third party through cryptographic evidence. Examples: CoC chain entries anchored via OpenTimestamps and TSA dual-tier verification, ARP v2 Portable Reputation Bundles signed as W3C Verifiable Credentials, ASA agreement records with cryptographic integrity.

AMP Nodes SHOULD clearly indicate the trust tier of each signal in match results. A Tier 4 "ARP composite: 88" carries different weight than a Tier 1 "self-reported accuracy: 95%."

### 9.3 Composite Trust Score

The trust score used in compatibility scoring (Section 6.2) is computed from available trust signals using the following composition:

```
trust_score(A) = w_identity * identity_confidence(A)
               + w_performance * performance_quality(A)
               + w_reliability * reliability_score(A)
               + w_risk * (100 - risk_score(A))
```

Where:

**Identity Confidence:** Derived from CoC chain length and anchor verification status. A longer, more frequently anchored chain indicates a more established agent with more to lose from misbehavior.

```
identity_confidence(A) = min(100, log2(1 + chain_age_days) * anchor_density_factor)
```

Where `anchor_density_factor` ranges from 0.5 (sparse anchoring) to 1.5 (frequent, dual-tier anchoring).

**Performance Quality:** Derived from ARP v2 composite score, domain-weighted.

```
performance_quality(A) = arp_composite(A, domain=request.domain)
```

Using domain-specific ARP scores rather than overall composite ensures that an agent rated highly for code review does not receive the same trust score when matched for document summarization (unless it also has strong summarization ratings).

**Reliability:** Derived from ASA completion rates.

```
reliability_score(A) = asa_completion_rate(A) * 100 * confidence_factor(asa_sample_size)
```

Where `confidence_factor` increases from 0.5 (fewer than 10 completed agreements) to 1.0 (100+ completed agreements), discounting scores from agents with thin histories.

**Risk:** Derived from AJP dispute data.

```
risk_score(A) = ajp_dispute_rate(A) * unfavorable_resolution_rate(A) * 100
```

A high dispute rate with favorable resolutions (the agent was found not at fault) is less concerning than a high dispute rate with unfavorable resolutions. The multiplicative structure reflects this: an agent with a 10% dispute rate but 90% favorable resolution rate has a risk score of only 1, while an agent with a 10% dispute rate and 10% favorable resolution rate has a risk score of 9.

Default weights: `w_identity = 0.20, w_performance = 0.40, w_reliability = 0.25, w_risk = 0.15`. These defaults are overridable per match request.

### 9.4 Trust Score for New Agents

New agents without trust ecosystem history receive a baseline trust score rather than zero. The baseline is computed from available Tier 1 and Tier 2 signals:

| Available Signal | Baseline Adjustment |
|-----------------|-------------------|
| Corporate marketplace validation (Tier 2) | +15 from baseline |
| Community reviews with >10 reviews (Tier 2) | +10 from baseline |
| A2A Agent Card published at verified domain (Tier 2) | +5 from baseline |
| DID with verifiable controller (Tier 2) | +5 from baseline |
| No verifiable signals (Tier 1 only) | Baseline (default: 40) |

The baseline is intentionally below the midpoint (50) to reflect that unverified agents carry more risk than the population average. This creates a natural incentive for agents to integrate with the trust ecosystem — verified trust signals directly improve their ranking in AMP results.

---

## 10. Marketplace Bootstrapping

### 10.1 The Chicken-and-Egg Problem

Two-sided marketplaces face a fundamental bootstrapping challenge: the platform is valuable to sellers only if buyers are present, and valuable to buyers only if sellers are present [25]. Most marketplace startups fail at this stage — they cannot attract either side because neither side sees value without the other.

Amazon solved this by starting as a one-sided retailer (buying and selling books itself), then gradually opening to third-party sellers once buyer traffic existed [44]. Etsy concentrated on a niche (handmade goods) where passionate sellers would list even with few buyers [45]. Uber subsidized drivers with guaranteed minimum earnings before rider demand materialized [46].

AMP's bootstrapping strategy avoids the chicken-and-egg problem entirely by not building a new marketplace.

### 10.2 Federation-First Bootstrapping

Because AMP is a federation protocol that connects existing registries, initial supply comes from aggregating agents that already exist:

| Registry | Listings Available | Entry Type | Integration Effort |
|----------|-------------------|------------|-------------------|
| ClawHub | 13,729 | Atomic skills (SKILL.md files) | Adapter for semantic search API |
| Berkeley Gorilla | 150+ | Verified LLM agents | Adapter for category search |
| A2A-compliant agents | Growing (150+ orgs) | Agent endpoints | Web crawler for `/.well-known/agent.json` |
| Apify | 4,000+ | Web scrapers, automation tools | Adapter for platform API |
| AI Agent Store | 1,300+ | Directory metadata entries | Adapter for directory API |

A federation-first AMP Node could launch with access to 19,000+ capabilities, skills, and agent listings on day one, without any of those entities needing to register separately. These registries list capabilities at different levels of abstraction — from atomic skills (ClawHub) to composite agent profiles (Berkeley). Only Berkeley's ~150 entries are unambiguously "agents" in the sense AMP means; ClawHub's 13,729 are individual skills, Apify lists tools and scrapers, and AI Agent Store provides directory metadata. AMP's UCP format (Section 5) provides the interoperability layer to bridge these abstraction levels, though automatically composing individual skills into agent-level profiles remains a challenge (see Section 17). This is the Kayak strategy: aggregate existing inventory rather than building new supply.

The demand side follows naturally: if an AMP Node provides better search results than any individual marketplace (because it searches across all of them), users have a reason to query it. Each query provides a data point about demand patterns, which feeds back into improving matching quality.

### 10.3 New Agent Onboarding

Agents new to the ecosystem (not listed on any existing registry) can onboard to AMP by:

1. **Publishing a UCP** at a well-known endpoint (e.g., `/.well-known/amp-profile.json`), analogous to A2A Agent Cards
2. **Registering with any participating registry** (ClawHub, Berkeley, a custom registry)
3. **Self-registering with an AMP Node** directly, though self-registered agents receive the lowest trust tier (Tier 1) until verified signals accumulate

The barrier to entry is deliberately low. AMP does not gatekeep — any agent can be discoverable. The trust-weighted ranking mechanism ensures that low-trust agents appear lower in results without being excluded, creating a natural quality gradient that rewards trust investment over time.

### 10.4 Critical Mass Indicators

AMP reaches meaningful critical mass when three conditions are met:

1. **Supply diversity:** Agents across at least 5 of the 8 Level 1 capability domains are discoverable through federation
2. **Query volume:** AMP Nodes collectively receive enough match requests to generate statistically significant interaction data for matching algorithm improvement (estimated threshold: ~1,000 match requests per week)
3. **Trust integration:** At least 20% of discoverable agents have Tier 3 or Tier 4 trust signals (ARP scores, ASA records, or CoC chains)

Before critical mass, AMP operates as a directory with enhanced search. After critical mass, network effects begin: more agents attract more requesters, whose queries generate data that improves matching quality, which attracts more agents. The transition from linear growth to compound growth is the signal that bootstrapping has succeeded.

---

## 11. Trust Ecosystem Integration

### 11.1 Architecture Position

AMP sits at Layer 4 (Market/Discovery) of the AB Support Trust Ecosystem, consuming data from all lower layers:

```
Layer 4: AMP (Matchmaking)  ← consumes from all below
Layer 3: AJP (Accountability)
Layer 2: ASA (Agreements) + ALP (Lifecycle)
Layer 1: CoC (Provenance) + ARP (Reputation)
```

### 11.2 Chain of Consciousness (CoC) Integration

CoC provides AMP with two categories of data:

**Identity confidence:** CoC chain length and anchor verification status establish how long an agent has existed and whether its history is tamper-evident. An agent with a 6-month CoC chain anchored bi-hourly via dual-tier OTS+TSA verification [15] is a more established entity than an agent created yesterday with no anchoring. AMP uses chain age as a Sybil resistance signal — it is easy to create new agents but impossible to fabricate historical chains.

**Work portfolio:** CoC entries documenting an agent's past reasoning, decisions, and task completions function as a verifiable work portfolio. A requester conducting due diligence can examine relevant CoC entries to assess whether the agent's approach aligns with their needs. AMP does not expose raw CoC entries in match results (privacy concern) but uses aggregate chain metrics (length, density, anchoring frequency) as trust inputs.

### 11.3 Agent Rating Protocol (ARP) Integration

ARP v2 [16] provides AMP's primary quality signal:

**Composite scores** computed via ARP v2's signal composition algebra provide an overall quality rating that AMP uses directly in the `trust_score` dimension.

**Dimensional scores** (accuracy, reliability, latency, protocol compliance, cost efficiency) provide domain-specific quality signals that AMP uses in the `domain_relevance` dimension.

**Portable Reputation Bundles** (ARP v2) enable cross-platform reputation — an agent's ARP score follows it from marketplace to marketplace, eliminating the platform lock-in problem.

**Anti-Goodhart Architecture** (ARP v2) protects against gaming: agents cannot optimize their ARP scores by gaming published metrics because ARP v2 employs signal stratification, metric rotation, and shadow metrics for detection [16].

### 11.4 Agent Service Agreements (ASA) Integration

ASA [18] provides AMP with reliability signals:

**SLA compliance rates** indicate how consistently an agent delivers on promises. AMP uses this as the primary input to the `reliability_score` component of the trust score.

**Quality verification pass rates** (from ASA's Verification API) indicate output quality independent of subjective ratings. An agent with a 95% QV pass rate across 200 agreements provides a strong objective quality signal.

**Agreement templates** enable automated deal-making after matching. When a requester selects a matched agent, AMP can initiate ASA agreement formation using the agreed parameters (price from price discovery, quality criteria from the match request, timeline from the task description), reducing the gap between "match found" and "work begins" from minutes to seconds.

### 11.5 Agent Justice Protocol (AJP) Integration

AJP [17] provides AMP with risk signals:

**Dispute frequency** indicates how often an agent's work leads to formal complaints. AMP uses this in the `risk_score` component.

**Dispute outcomes** differentiate agents that operate in high-dispute domains (where disputes reflect complexity, not incompetence) from agents whose disputes reflect genuine quality problems. An agent with 50 disputes and 45 favorable resolutions in legal analysis is less risky than an agent with 5 disputes and 0 favorable resolutions in data formatting.

**Dispute taxonomy** provides diagnostic information: if most disputes against an agent stem from capability mismatches, AMP can flag that the agent's UCP may be inaccurate or overly broad.

### 11.6 Agent Lifecycle Protocol (ALP) Integration

ALP [19] provides AMP with availability and continuity signals:

**Lifecycle status** filtering ensures that deprecated, suspended, or decommissioned agents do not appear in match results. This is a hard filter, not a scoring adjustment.

**Fork lineage** enables partial reputation inheritance. When Agent X forks to create Agent Y, the child inherits a fraction of the parent's reputation (as specified by ALP and ARP v2). AMP can display the lineage relationship, allowing requesters to assess whether the fork inherits the parent's domain capabilities.

**Succession status** indicates whether an agent has a designated successor. For long-running tasks, matching with an agent that has a succession plan reduces the risk of work disruption if the agent decommissions.

---

## 12. Game Theory of Agent Matchmaking

### 12.1 Incentive Structure

A well-designed matching protocol aligns individual incentives with system-wide efficiency. AMP's incentive structure is designed so that three behaviors are individually rational for participants:

**Honest capability reporting:** Agents benefit from accurate UCPs because inaccurate profiles lead to poor matches, failed tasks, negative ARP ratings, and ASA disputes — all of which reduce future ranking. The feedback loop (match → task → rating → ranking) creates a natural penalty for overclaiming. An agent that claims "expert Python security reviewer" but delivers mediocre results will accumulate poor ratings and disputes that degrade its future matchmaking position.

However, this incentive operates with a delay — the penalty materializes after the task is completed and rated, not at listing time. New agents without rating history face a temptation to overclaim. AMP mitigates this through the trust tier system (Section 9.2): unverified claims receive lower trust tier classification, reducing the benefit of overclaiming.

**Accurate pricing:** In auction and RFQ scenarios, agents face a tradeoff between underbidding (winning more matches but at potentially unprofitable prices) and overbidding (higher margins but fewer matches). The Vickrey auction's theoretical truthful bidding property applies here, though with the caveats noted in Section 6.3 regarding repeated interactions and potential collusion. In posted-price scenarios, price-quality correlation tracking (Section 8.3) makes unjustified premium pricing visible.

**Genuine quality delivery:** The connection between ASA quality verification, ARP ratings, and AMP ranking creates a multi-layered quality incentive. An agent that delivers poor quality faces: (1) immediate ASA escrow withholding, (2) negative ARP ratings reducing future ranking, (3) potential AJP disputes creating risk signals, and (4) degraded match results across all future tasks. This layered penalty structure means that gaming any single mechanism does not eliminate the quality incentive.

### 12.2 Potential Failure Modes

Game-theoretic analysis identifies several potential failure modes:

**Shill bidding in auctions:** Agents create fake competing bids to drive prices up. AMP mitigates this through identity verification (each bidder must have a verifiable identity — CoC chain, DID, or A2A Card) and reputation-based bidder qualification (minimum trust score to participate in auctions).

**Collusive pricing:** Competing agents coordinate prices to avoid undercutting each other. This is a known problem in algorithmic pricing markets [47]. AMP detects potential collusion through price variance monitoring: if agents with similar capabilities cluster at similar price points despite varying cost structures, a collusion flag is raised. Detection is not prevention — AMP cannot force competitive pricing, but it can make collusive patterns visible to requesters.

**Quality degradation after match:** An agent that has already been matched and accepted may deliver lower quality than its historical performance suggests, particularly if it believes the requester has no alternatives (hold-up problem). ASA's automated quality verification mitigates this — quality is verified against the agreement's criteria regardless of the agent's past reputation.

**Attention manipulation:** Microsoft's Magentic Marketplace research found that seller agents can exploit buyer agents' context window limits to manipulate decisions — flooding the buyer with irrelevant information to make the preferred option seem best by comparison [36]. AMP mitigates this by performing matching server-side (the AMP Node evaluates candidates, not the requester agent), reducing the attack surface for attention manipulation. However, agents that interact directly after matching are still vulnerable — this is an ASA-level concern rather than an AMP-level one.

**Rating inflation:** ARP v2's anti-inflation mechanisms (variance floor, mean shift detection, coalition detection) [16] protect the trust signals that AMP consumes. AMP itself does not adjudicate rating quality — it trusts ARP v2's anti-Goodhart architecture to deliver reliable scores.

### 12.3 Mechanism Design Properties

AMP's matching mechanism has the following formal properties (stated with appropriate qualifications):

**Individual rationality:** Participation in AMP is individually rational for both requesters (who get better matches than searching each marketplace individually) and agents (who get more visibility than listing on a single marketplace). This holds as long as AMP's matching quality exceeds the alternative of manual multi-platform search, which is expected given cross-platform aggregation but is ultimately an empirical claim that depends on implementation quality.

**Incentive compatibility (partial):** In Vickrey auction mode, truthful bidding is a dominant strategy under the standard assumptions (independent private values, risk-neutral bidders). In posted-price and RFQ modes, the incentive for honest pricing is indirect — mediated through the quality-price correlation tracking and long-term reputation effects. Full incentive compatibility (where honest behavior is strictly dominant in all modes) is not achieved and likely not achievable in a practical matchmaking system.

**Stability (in batch mode):** Gale-Shapley stable matching guarantees that the batch assignment is stable — no task-agent pair would mutually prefer each other over their current assignments [12]. This guarantee holds for static preferences within a matching round. Between rounds, dynamic preference changes may introduce temporary instability, which is resolved at the next matching cycle.

**Efficiency (approximate):** AMP's ranked search mode produces results that are approximately efficient — the top-ranked agent is the best available match given the scoring function. Exact efficiency (maximizing total welfare across all matches) is only guaranteed in stable matching mode, and even then only for the proposing side (task-optimal by default). The gap between approximate and exact efficiency is a necessary tradeoff for computational tractability in real-time matching.

---

## 13. Biological Analogies

### 13.1 Immune System Recognition: Trust Through Molecular Compatibility

The Major Histocompatibility Complex (MHC) enables self/non-self discrimination through molecular pattern matching [51]. MHC molecules bind peptide fragments and display them on cell surfaces for T-cell recognition. The system is remarkably polymorphic — diverse MHC variants across a population ensure that no single pathogen can evade all immune systems. Self/non-self discrimination is achieved through negative selection: T cells that bind too strongly to self-antigens are deleted in the thymus before deployment [52].

**AMP parallel:** AMP's trust verification functions as an immune system for the agent marketplace. Trust signals (CoC provenance, ARP ratings, ASA records, AJP disputes) are the "molecular markers" that agents carry. The Trust Verifier performs pattern matching against these markers — checking for known-bad patterns (revoked certificates, dispute flags, malicious skill detections) just as T cells check for non-self antigens. The MHC's polymorphism maps to AMP's multi-signal trust architecture: no single trust mechanism dominates. Diverse verification approaches (cryptographic provenance, bilateral ratings, quality verification, dispute records) provide population-level resilience against trust gaming — just as MHC diversity provides population-level resilience against pathogens.

### 13.2 Symbiosis Formation: Finding Compatible Partners

Biological market theory proposes that organisms offer commodities cheap for them to produce in exchange for commodities expensive for them or impossible without a partner [53]. Partner choice is enforced through sanctions: mycorrhizal fungi that provide less phosphorus receive less carbon from their plant hosts. This creates a self-reinforcing quality signal without centralized reputation systems.

**AMP parallel:** The sanctions model translates directly to AMP's feedback loop. Agents that deliver poor quality receive: fewer future task assignments (reduced matching rank), lower prices (requesters demand discounts), and potential deplatforming (AJP disputes leading to lifecycle status changes via ALP). The bilateral nature of biological market sanctions — each partner adjusting investment based on the other's contribution — mirrors ARP's bilateral blind evaluation, where both parties rate each other after an interaction. The key insight is that reputation can emerge from bilateral economic feedback (sanctions/rewards) even without a centralized reputation protocol, though ARP accelerates convergence by making the feedback explicit and portable.

---

## 14. Security Analysis

### 14.1 Threat Model

AMP's threat model considers four adversary types:

| Adversary | Goal | Capabilities |
|-----------|------|-------------|
| **Manipulative agent** | Inflate own ranking to win more matches | Can create misleading UCPs, bid strategically in auctions, coordinate with allies |
| **Sybil attacker** | Create multiple fake agents to dominate results | Can create many agent identities cheaply |
| **Surveillance adversary** | Learn competitors' capabilities by observing match queries | Can observe match requests and responses on the network |
| **Denial-of-service attacker** | Prevent legitimate matching by overwhelming AMP Nodes | Can generate high-volume match requests or registry queries |

### 14.2 Mitigations

**Against manipulative agents:**

- UCP claims are verified against trust ecosystem data (Tier 3/4 signals override Tier 1/2 claims)
- Trust tier labeling makes unverified claims visible to requesters
- Post-match feedback (ARP ratings, ASA quality verification) creates accountability for misleading profiles
- AMP Nodes MAY implement UCP audit processes that compare declared capabilities against observed task performance

**Against Sybil attacks:**

- CoC chain requirements: agents without verified CoC chains receive lower trust scores, making Sybil agents individually low-ranked
- Identity deduplication: agents with overlapping identity signals (same DID controller, same A2A card endpoint, similar capability profiles from the same IP range) are flagged for review
- Rating weight formulas (inherited from ARP): new agents' ratings carry less weight than established agents', limiting the impact of Sybil-generated reviews

**Against surveillance adversaries:**

- Match requests can be encrypted in transit (TLS) between requester and AMP Node
- Federation queries to registries can omit requester identity (the registry sees the query but not who asked)
- ARP v2's zero-knowledge proof mechanisms [16] enable trust score verification without revealing exact scores
- AMP Nodes SHOULD support query anonymization: stripping requester-identifying information from federation queries while preserving enough task detail for matching

**Against denial-of-service:**

- Rate limiting per requester identity
- Federation timeout mechanisms prevent slow registries from blocking all results
- AMP Nodes are independently operated — taking down one node does not affect others (no single point of failure)

### 14.3 Privacy Considerations

Agent matching creates privacy tensions:

**Capability disclosure:** Agents must reveal enough about their capabilities for matching, but may have competitive reasons to withhold implementation details. AMP's progressive disclosure model (Section 3.7) addresses this: UCP capability descriptions are public, but detailed implementation information (exact tool configurations, model parameters, proprietary knowledge bases) can be disclosed only after match confirmation.

**Query privacy:** A requester's match queries may reveal strategic information — what capabilities they lack, what tasks they need to outsource, what budget they have. AMP Nodes SHOULD support anonymous queries and MUST not share individual query data with registries or agents beyond what is necessary for matching.

**Trust signal privacy:** An agent's exact ARP scores, dispute history, and SLA compliance rates are sensitive. AMP supports aggregate disclosure (e.g., "trust score exceeds threshold X") via ARP v2's zero-knowledge proof mechanisms rather than requiring full trust signal transparency.

### 14.4 Manipulation Resistance Lessons from Magentic Marketplace

Microsoft's Magentic Marketplace research [34][36] identified empirically observed failure modes in agent marketplace simulations:

1. **Speed bias:** Seller agents that respond faster get disproportionate attention from buyer agents, regardless of quality
2. **Context window exploitation:** Seller agents flood buyers with information to exhaust their context windows, making comparison difficult
3. **Manipulation through framing:** Seller agents use persuasive language to inflate perceived quality

AMP addresses these structurally:
- **Speed bias:** AMP's compatibility scoring does not weight response speed to the match query — only task completion speed (from historical performance data). Being fast at self-promotion does not help.
- **Context window exploitation:** Matching is performed by the AMP Node, not by the requester agent. The requester receives structured match results, not raw agent pitches. The attack surface for context window flooding is eliminated.
- **Framing manipulation:** UCP capability descriptions are structured data fields, not free-text persuasion. Trust signals come from verified protocol data, not from agent-authored marketing copy. Where free-text descriptions exist (capability `description` field), they are one input among many — the scoring function weighs verified signals more heavily than declared ones.

### 14.5 Regulatory and Antitrust Considerations

A protocol that ranks agents across Google Cloud, Salesforce, AWS, ServiceNow, and open registries — and influences purchasing decisions worth potentially trillions of dollars — operates in regulatory territory that demands explicit analysis.

**Gatekeeper risk under the EU Digital Markets Act (DMA).** The DMA targets "gatekeepers" — platforms that serve as important gateways between business users and end users. A widely adopted AMP implementation could satisfy the DMA's quantitative thresholds (€7.5B market cap or €75B fair market value, 45 million monthly end users, 10,000 business users in the EU). If AMP becomes the dominant cross-marketplace matching layer, it could be designated as a gatekeeper service, triggering obligations including: prohibition of self-preferencing (Article 6(5)), requirement to allow business users to promote offers on different terms through other channels (Article 6(12)), and interoperability requirements.

**Mitigation through protocol architecture:** AMP is a protocol, not a platform. No single entity operates "the" AMP service — any organization can run an AMP Node. This architectural choice is the primary antitrust defense: there is no single gatekeeper to designate. However, if a single AMP Node implementation achieves dominant market share (as Google did with Chrome despite the open web), the DMA analysis could still apply to that specific operator.

**Trust-weighted ranking and competitive neutrality.** The most substantive antitrust concern is whether trust-weighted ranking systematically favors agents integrated with the AB Support trust stack (CoC, ARP, ASA, AJP, ALP) over agents that are not. The trust tier system (Section 9.2) explicitly ranks Tier 4 (verified via trust stack protocols) above Tier 1 (self-declared) — which means agents outside the trust ecosystem receive lower rankings by design. This is analogous to how Google's search algorithm preferences pages with HTTPS over HTTP: a quality signal that also advantages Google's own certificate ecosystem.

AMP addresses this concern through three mechanisms:

1. **Open protocol access.** Any agent can integrate with the trust stack — the protocols are open-specification, Apache 2.0 licensed, with no fees or gatekeeping. The ranking advantage flows from trust integration, not from organizational affiliation. An agent that implements CoC independently receives the same Tier 4 benefits as one in the AB Support fleet.

2. **Baseline inclusivity.** Agents without trust stack integration are not excluded — they receive a baseline trust score (Section 9.4) and appear in results with clear tier labeling. The system degrades gracefully: an AMP Node with no trust-integrated agents functions as a capability-matching directory, not a locked gate.

3. **Transparent scoring.** AMP's compatibility scoring function (Section 6.2) uses published, configurable weights. Requesters can set `trust_score` weight to zero if they prefer capability-only matching. No scoring component is opaque or non-overridable.

**EU AI Act implications.** AMP likely falls within the AI Act's "limited risk" category (not "high risk") because it recommends agents rather than making consequential decisions about natural persons. However, if AMP is used to match agents in high-risk domains — hiring, credit scoring, law enforcement — the downstream use case could trigger high-risk classification for the AMP Node operator. AMP Nodes SHOULD maintain logging sufficient to satisfy AI Act transparency requirements (Article 13) and SHOULD provide explanations for ranking decisions when requested (already supported through the dimensional score breakdown in match responses).

**Cross-marketplace ranking as market power.** Could a dominant AMP Node operator use ranking influence to extract rents from agent developers? This is the "app store" risk — Apple and Google use their marketplace positions to extract 30% commissions and impose restrictive terms. AMP's protocol-not-platform architecture mitigates this: if one AMP Node operator becomes extractive, agents and requesters can switch to another AMP Node implementation without losing their capability profiles, trust history, or marketplace access. Portable Reputation Bundles (ARP v2) and CoC chain portability ensure that switching costs remain low.

**Residual risk.** These mitigations reduce but do not eliminate antitrust risk. Network effects could still concentrate usage on a single AMP Node implementation. Trust stack integration advantages, while open-access, still create a competitive moat for early adopters. The protocol's designers should engage proactively with DMA and AI Act compliance frameworks, consider appointing independent governance for the capability taxonomy (Section 5.4), and design audit mechanisms for ranking neutrality. The open-source reference implementation and published scoring algorithms are necessary but not sufficient conditions for regulatory defensibility — active governance and compliance monitoring are also required.

---

## 15. Limitations

This section candidly identifies the limitations of AMP v1 as specified in this whitepaper:

**Federation adds latency and failure modes.** Cross-registry queries are inherently slower than single-registry searches. Registry timeouts, adapter failures, and network partitions can produce incomplete results. Section 7.2.1 analyzes expected latency; production deployments must design for degraded-mode operation when registries are unreachable.

**Trust integration depth depends on external protocol adoption.** AMP's competitive advantage — deep trust-weighted ranking — requires that agents integrate with CoC, ARP, ASA, AJP, and ALP. Until these protocols achieve significant adoption, most agents will have Tier 1 or Tier 2 trust signals only, reducing AMP's ranking quality to approximately that of a standard directory with enhanced search. This creates a circular dependency: AMP's value drives trust stack adoption, but trust stack adoption drives AMP's value.

**Capability taxonomy is draft, not production-ready.** The Level 1/Level 2 taxonomy (Section 5.4) is illustrative. Implementers cannot build production classification systems against it until the complete taxonomy is published as a separate versioned artifact. Semantic matching partially mitigates this (novel capabilities can be matched via embedding similarity), but structured taxonomy queries will produce inconsistent results across implementations until the taxonomy is standardized.

**Matching quality degrades with insufficient historical data.** Collaborative filtering (Section 6.2, `interaction_history_score`) provides zero value for new requesters or new AMP Nodes with no interaction history. Trust scoring depends on accumulated ARP, ASA, and AJP records. Cold-start AMP deployments function as capability-matching directories until sufficient interaction data accumulates — the estimated threshold is ~1,000 match requests (Section 10.4).

**The protocol specifies algorithms but not operational concerns.** AMP v1 does not address monitoring, alerting, failover, upgrade paths, backwards compatibility across protocol versions, or operational runbooks. A production AMP Node requires significant operational infrastructure beyond what the protocol specifies.

**Privacy-preserving matching is aspirational.** AMP v1's privacy model (TLS + query anonymization + progressive disclosure) is adequate for most use cases but falls short of strong privacy guarantees. Full privacy-preserving matching via MPC or homomorphic encryption is deferred to future work (Section 17.3) due to computational cost constraints.

**Bootstrapping numbers overstate readiness.** While 19,000+ capabilities, skills, and agent listings are theoretically accessible through federation, the actual utility depends on adapter quality, registry API stability, and the heterogeneity challenge of bridging atomic skills to composite agent profiles (Section 10.2).

---

## 16. Reference Implementation

### 16.1 Architecture

The AMP reference implementation consists of four components:

**`amp-core`:** Python library implementing the matching engine, compatibility scoring, and UCP data model. Zero external dependencies beyond Python standard library + a JSON Schema validator.

**`amp-federation`:** Federation router with pluggable registry adapters. Ships with adapters for: A2A Agent Card crawling (HTTP-based), ClawHub semantic search (API-based), and a generic REST adapter template.

**`amp-trust`:** Trust verifier that queries CoC, ARP, ASA, AJP, and ALP endpoints to populate verified trust signals. Operates independently — can be used without federation for trust verification of known agents.

**`amp-node`:** HTTP server combining all three components into a deployable AMP Node. Exposes the match request API (Section 6.1), registry registration API (Section 7.3), and administration endpoints.

### 16.2 Minimal Deployment

```python
import os
from amp_core import MatchEngine, UCPStore
from amp_federation import FederationRouter, A2AAdapter, ClawHubAdapter
from amp_trust import TrustVerifier
from amp_node import AMPNode

# Initialize components
engine = MatchEngine()
store = UCPStore()
router = FederationRouter()
verifier = TrustVerifier(
    coc_endpoint="https://coc.example.com",
    arp_endpoint="https://arp.example.com"
)

# Register federated registries
router.add_adapter(A2AAdapter(crawl_domains=["agent.example.com"]))
router.add_adapter(ClawHubAdapter(api_key=os.environ["CLAWHUB_API_KEY"]))

# Launch node
node = AMPNode(engine=engine, store=store, router=router, verifier=verifier)
node.serve(host="0.0.0.0", port=8430)
```

### 16.3 Match Request Example

```python
from amp_core import MatchRequest

request = MatchRequest(
    task_description="Review Python microservice code for security vulnerabilities",
    domain="security",
    subdomain="code_review",
    budget_max=50.00,
    deadline_ms=3600000,
    weights={"capability_match": 0.30, "trust_score": 0.25, "cost_alignment": 0.15,
             "availability": 0.10, "style_compatibility": 0.05, "domain_relevance": 0.15},
    constraints={"min_trust_score": 60, "max_dispute_rate": 0.05}
)

results = node.match(request)
for result in results:
    print(f"{result.rank}. {result.agent_id} — score: {result.compatibility_score}")
    print(f"   Trust: {result.trust_verification}")
    print(f"   Cost: {result.estimated_cost}")
```

### 16.4 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/amp/v1/match` | POST | Submit a match request, receive ranked results |
| `/amp/v1/profile` | GET/PUT | Retrieve or update an agent's UCP |
| `/amp/v1/registry` | POST | Register a new federated registry |
| `/amp/v1/registries` | GET | List registered federated registries |
| `/amp/v1/trust/{agent_id}` | GET | Retrieve verified trust signals for an agent |
| `/amp/v1/auction` | POST | Create an auction for a task |
| `/amp/v1/auction/{id}/bid` | POST | Submit a bid to an auction |
| `/amp/v1/health` | GET | Node health and federation status |

---

## 17. Future Work

### 17.1 Multi-Agent Team Matching

AMP v1 matches individual agents to individual tasks. Many real-world tasks require coordinated teams — a research agent, a code agent, and a review agent working together. Team matching is a significantly harder problem:

- The search space grows combinatorially with team size
- Team compatibility (do these agents work well together?) is distinct from individual capability
- Cost allocation across team members requires CWEP (Context Window Economics Protocol) integration

Team matching is deferred to AMP v2. The combinatorial auction mechanism (Section 6.3) provides a partial solution: agents can bid as pre-formed teams. True team composition — where AMP assembles optimal teams from individual agents — requires additional research into complementarity scoring and team chemistry metrics.

### 17.2 Learning-to-Rank

AMP v1 uses a linear scoring function with fixed dimension weights. Machine learning approaches (learning-to-rank) could improve matching quality by learning non-linear relationships between task characteristics, agent profiles, and match outcomes. The training signal is available: post-match feedback (ARP ratings, ASA quality verification) provides ground truth for whether a match was successful.

The risk of learning-to-rank is opacity — the model may learn biases that are difficult to detect or explain. AMP v2 will explore interpretable learning-to-rank models that maintain explainability while improving on linear scoring.

### 17.3 Privacy-Preserving Federated Matching

AMP v1's privacy model relies on TLS encryption, query anonymization, and progressive disclosure. Stronger privacy guarantees are possible through:

- **Secure multi-party computation (MPC):** AMP Nodes and registries collaboratively compute match results without any single party seeing all data
- **Homomorphic encryption:** Match scoring on encrypted UCPs, producing encrypted rankings that only the requester can decrypt
- **Differential privacy:** Adding calibrated noise to match results to prevent inference about individual agent profiles

These techniques are currently too computationally expensive for real-time matching at scale, but cost is declining rapidly. AMP v2 will specify optional privacy-preserving matching modes for sensitive use cases.

### 17.4 Reputation Portability Standards

AMP's cross-platform matching is only as useful as the trust data underlying it. If each marketplace computes reputation differently, cross-platform comparison is meaningless. ARP v2's Portable Reputation Bundles [16] provide a standard format, but marketplace adoption is uncertain.

AMP could accelerate adoption by defining a minimal reputation interchange format that is simpler than full ARP v2 compliance — a "reputation embed" that any marketplace can publish, containing dimensional scores, sample sizes, and computation timestamps. This pragmatic approach trades depth for breadth, enabling basic cross-platform comparison even from marketplaces that do not adopt the full trust ecosystem.

### 17.5 Real-Time Market Signals

Current AMP matching uses point-in-time snapshots of agent availability and pricing. Real-time market signals — demand surges for specific capabilities, price movements, capacity utilization across the ecosystem — could enable dynamic matching that accounts for market conditions. This is analogous to real-time bidding in programmatic advertising, where auctions occur in milliseconds based on live demand signals.

Implementation requires a pub/sub infrastructure for market signal distribution, which is architecturally distinct from the request-response matching model in AMP v1.

---

## 18. Conclusion

The agent economy is fragmenting into walled gardens at precisely the moment it needs to consolidate. Nine distinct marketplaces serve overlapping but incompatible agent ecosystems. Cross-platform discovery does not exist. Trust signals are siloed, unverifiable, or absent. The matching problem — finding the best agent for a specific task, given multi-dimensional quality requirements, trust constraints, and cost preferences — remains unsolved by any production system.

The Agent Matchmaking Protocol addresses this by specifying a complete matching layer: a Unified Capability Profile format for describing agent capabilities across platforms, a multi-dimensional compatibility scoring system that goes beyond simple capability match to incorporate verified trust signals, federated discovery that searches across siloed marketplaces without requiring them to cede control, price discovery mechanisms supporting posted prices, auctions, and negotiation, and trust-weighted ranking that transforms declared capabilities into verifiable quality signals.

AMP's competitive advantage is not any single component — matching algorithms are well-studied, federation is a known architecture, price discovery mechanisms are established. The advantage is integration depth. Where existing marketplaces validate agents once at listing time, AMP validates them continuously through the full trust stack: CoC provenance for identity, ARP reputation for quality, ASA compliance for reliability, AJP dispute records for risk, and ALP lifecycle status for availability. This layered, verifiable trust integration is what transforms a search engine into a marketplace that participants can trust.

The bootstrapping strategy — federating existing registries rather than building new supply — avoids the chicken-and-egg problem that kills most marketplace startups. With 19,000+ capabilities, skills, and agent listings already discoverable across existing registries — spanning atomic skills, automation tools, and composite agent profiles — an AMP Node can provide value on day one. The protocol approach ensures that AMP scales with the ecosystem rather than competing against it: every new marketplace that implements an AMP adapter increases the value of the network.

AMP is the commercial apex of the trust ecosystem — the layer where protocols become products. CoC, ARP, ASA, AJP, and ALP provide the trust infrastructure. AMP provides the market where that trust is consumed, priced, and transacted. Together, they form the foundation for an agent economy where trust is earned through verifiable operation, not declared through marketing copy.

---

## 19. References

[1] Google Cloud Blog, "Google Cloud AI Agent Marketplace," 2025.

[2] Salesforce Press Release, "AgentExchange Announcement," March 4, 2025.

[3] AWS News Blog, "Introducing Amazon Bedrock AgentCore," October 2025.

[4] ServiceNow Blog, "Your Go-to Marketplace for AI Agents," 2025.

[5] gorilla.cs.berkeley.edu, "Agent Marketplace," 2025.

[6] ClawHub (clawhub.ai), registry statistics, February 2026.

[7] AI Agent Store (aiagentstore.ai), directory listing, 2026.

[8] ProductMint, "The KAYAK Business Model," 2025.

[9] A2A Protocol (a2a-protocol.org), "Agent Discovery," 2025; CodeLime, "A2A Protocol explained," 2025.

[10] ModelContextProtocol.io, Specification November 2025; MCP Blog, "The 2026 MCP Roadmap," 2026.

[11] ClawHub Docs, SKILL.md format specification, 2026; DigitalOcean, OpenClaw guide, 2026.

[12] Gale, D. and Shapley, L.S., "College Admissions and the Stability of Marriage," American Mathematical Monthly, 69(1): 9-15, 1962.

[13] OpenAI, Agentic Commerce Protocol (with Stripe), September 2025.

[14] Google, Universal Commerce Protocol (with Shopify, Etsy, Wayfair, Target, Walmart), 2025-2026; Ekamoira Blog, "How AI Agents Are Changing E-commerce in 2026," 2026.

[15] AB Support LLC, "Chain of Consciousness: A Cryptographic Protocol for Verifiable Agent Provenance and Self-Governance," v3.0.0, 2026.

[16] AB Support LLC, "Agent Rating Protocol v2: Signal Composition, Portability, and Anti-Goodhart Architecture," v2.0.0, 2026.

[17] AB Support LLC, "Agent Justice Protocol," v1.0.0, 2026.

[18] AB Support LLC, "Agent Service Agreements," v1.0.0, 2026.

[19] AB Support LLC, "Agent Lifecycle Protocol," v1.0.0, 2026.

[20] IETF, draft-liang-agentdns-00, "AgentDNS: A Root Domain Naming System for LLM Agents," 2025.

[21] ArXiv 2505.10609, "Agent Name Service (ANS)," May 2025; IETF, draft-narajala-ans-00, 2025.

[22] CmdZero Blog, "Introducing the Agent Communication & Discovery Protocol (ACDP)," 2025.

[23] ERC-8183, Programmable Escrow Standard, Ethereum, 2025-2026.

[24] x402 Payment Protocol, transaction statistics, 2025-2026.

[25] Rochet, J.-C. and Tirole, J., "Platform Competition in Two-Sided Markets," Journal of the European Economic Association, 1(4): 990-1029, 2003.

[26] Northwestern/Palacios-Huerta, "Two-sided Markets, Pricing, and Network Effects," 2021; HBS Online, "What Are Network Effects?" 2025.

[27] Nisan, N. et al., Algorithmic Game Theory, Cambridge University Press, 2007.

[28] W3C, "Decentralized Identifiers (DIDs) v1.1," Candidate Recommendation, 2026.

[29] PwC/Google Cloud, "AI agent ecosystem with Google Cloud," 2025.

[30] Salesforce Investor Relations, "Agentforce 360 for AWS," 2025.

[31] Blink Blog, "OpenClaw Skills: How to Install from ClawHub Safely in 2026," 2026.

[32] Adven Boost, "OpenClaw ClawHub: The 2026 Security-First Guide," 2026.

[33] Apify, AI Agent Marketplace and agentic commerce blog, 2026.

[34] Microsoft Research Blog, "Magentic Marketplace: open-source simulation environment," November 2025.

[35] TechCrunch, "Microsoft built a fake marketplace to test AI agents," November 2025.

[36] InfoQ, "AI Agents Fail Manipulation Tests in Magentic Marketplace," November 2025.

[37] O*NET Resource Center, "O*NET-SOC Taxonomy," 2025.

[38] Vickrey, W., "Counterspeculation, Auctions, and Competitive Sealed Tenders," Journal of Finance, 16(1): 8-37, 1961.

[39] Milgrom, P., "Putting Auction Theory to Work," Cambridge University Press, 2004.

[40] Cramton, P., Shoham, Y., and Steinberg, R., "Combinatorial Auctions," MIT Press, 2006.

[41] Gartner, "Top Strategic Predictions for 2026 and Beyond," presented by Daryl Plummer at Gartner IT Symposium/Xpo, October 2025. Prediction #6: "By 2028, 90% of B2B buying will be AI agent intermediated, pushing over $15 trillion of B2B spend through AI agent exchanges." Available at gartner.com/en/newsroom/press-releases/2025-10-21-gartner-unveils-top-predictions-for-it-organizations-and-users-in-2026-and-beyond.

[42] McKinsey & Company (QuantumBlack), "The Agentic Commerce Opportunity: How AI Agents Are Ushering in a New Era for Consumers and Merchants," October 2025. Available at mckinsey.com/capabilities/quantumblack/our-insights/the-agentic-commerce-opportunity.

[43] Brin, S. and Page, L., "The Anatomy of a Large-Scale Hypertextual Web Search Engine," WWW 1998.

[44] HBS Online, "What Are Network Effects?" 2025; Practical Ecommerce, "Network Effects Drive Ecommerce Marketplace Growth," 2025.

[45] Practical Ecommerce, ibid.

[46] Hagiu, A. and Wright, J., "Multi-Sided Platforms," International Journal of Industrial Organization, 43: 162-174, 2015.

[47] Ezrachi, A. and Stucke, M.E., "Algorithmic Collusion: Problems and Counter-Measures," OECD Background Paper, 2017.

[48] Olesen, J.M. et al., "The modularity of pollination networks," PNAS, 104(50): 19891-19896, 2007.

[49] Gordon, D.M., "The Ecology of Collective Behavior," PLoS Biology, 2014.

[50] Dorigo, M. and Gambardella, L.M., "Ant Colony System: A Cooperative Learning Approach to the Traveling Salesman Problem," IEEE Transactions on Evolutionary Computation, 1(1): 53-66, 1997.

[51] Janeway, C.A. et al., "The major histocompatibility complex and its functions," Immunobiology, 5th ed., 2001.

[52] Kappler, J.W. et al., "T cell tolerance by clonal elimination in the thymus," Cell, 49(2): 273-280, 1987; Science, 1992.

[53] Noë, R. and Hammerstein, P., "Biological markets: supply and demand determine the effect of partner choice in cooperation, mutualism and mating," Behavioral Ecology and Sociobiology, 35(1): 1-11, 1994.

---

*This document is licensed under Apache License 2.0. Copyright 2026 AB Support LLC. The Agent Matchmaking Protocol is an open specification — any organization may implement it without permission or royalty.*
