import {
  DEFAULT_WEIGHTS,
  INACTIVE_STATUSES,
  MatchConstraints,
  MatchMetadata,
  MatchRequest,
  MatchResponse,
  MatchResult,
  TaskDescription,
  TrustVerification,
  UnifiedCapabilityProfile,
} from "./schema";
import { trustScoreFromUcp, trustTierWeight } from "./ranking";

// ---------------------------------------------------------------------------
// Similarity helpers (zero-dependency keyword-based)
// ---------------------------------------------------------------------------

function tokenize(text: string): Set<string> {
  const matches = text.toLowerCase().match(/[a-z0-9]+/g);
  return new Set(matches ?? []);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

// ---------------------------------------------------------------------------
// Dimensional scoring functions (Section 6.2)
// ---------------------------------------------------------------------------

export function capabilityMatchScore(
  task: TaskDescription,
  ucp: UnifiedCapabilityProfile,
): number {
  const taskTokens = tokenize(task.description + " " + task.domain + " " + task.subdomain);

  let bestSim = 0;
  let toolBonus = 1.0;

  for (const cap of ucp.capabilities) {
    const capTokens = tokenize(
      cap.description + " " + cap.domain + " " + cap.subdomain +
      " " + cap.toolsUsed.join(" "),
    );
    let sim = jaccard(taskTokens, capTokens);
    if (task.domain && cap.domain === task.domain) sim = Math.min(1, sim + 0.3);
    if (task.subdomain && cap.subdomain === task.subdomain) sim = Math.min(1, sim + 0.2);
    bestSim = Math.max(bestSim, sim);

    if (task.inputSpec) {
      const requiredTools = (task.inputSpec.required_tools ?? []) as string[];
      if (requiredTools.length > 0) {
        const capToolSet = new Set(cap.toolsUsed);
        let matched = 0;
        for (const t of requiredTools) if (capToolSet.has(t)) matched++;
        if (matched > 0) toolBonus = Math.min(1.2, 1.0 + 0.1 * matched);
      }
    }
  }

  return bestSim * toolBonus * 100;
}

export function costAlignmentScore(
  task: TaskDescription,
  ucp: UnifiedCapabilityProfile,
): number {
  if (task.budgetMax <= 0) return 50;
  const estimated = ucp.cost.baseRate.amount;
  if (estimated <= 0) return 50;
  const diff = Math.abs(estimated - task.budgetMax);
  const penalty = 100 / Math.max(task.budgetMax, 1);
  return Math.max(0, Math.min(100, 100 - penalty * diff));
}

export function availabilityScore(
  task: TaskDescription,
  ucp: UnifiedCapabilityProfile,
): number {
  if (INACTIVE_STATUSES.includes(ucp.availability.alpLifecycleStage)) return 0;

  const cap = ucp.availability.capacity;
  const capacityScore = Math.max(0, 100 - cap.currentLoadPct);

  let deadlineFit = 100;
  if (task.deadlineMs > 0 && ucp.performance.speed.medianResponseTimeMs > 0) {
    if (ucp.performance.speed.medianResponseTimeMs > task.deadlineMs) {
      const ratio = task.deadlineMs / ucp.performance.speed.medianResponseTimeMs;
      deadlineFit = ratio * 100;
    }
  } else if (task.deadlineMs > 0 && cap.estimatedQueueTimeMs > 0) {
    if (cap.estimatedQueueTimeMs > task.deadlineMs) deadlineFit = 50;
  }

  return (capacityScore / 100) * (deadlineFit / 100) * 100;
}

export function styleCompatibilityScore(
  task: TaskDescription,
  ucp: UnifiedCapabilityProfile,
  interactionHistory?: Record<string, number>,
): number {
  let formatMatch = 50;
  const outputFormat = (task.outputSpec.format ?? "") as string;
  if (outputFormat) {
    for (const cap of ucp.capabilities) {
      if (cap.outputModalities.includes(outputFormat)) {
        formatMatch = 100;
        break;
      }
    }
  }

  let historyScore = 50;
  if (interactionHistory && ucp.identity.ampId in interactionHistory) {
    historyScore = interactionHistory[ucp.identity.ampId];
  }

  return (formatMatch / 100) * (historyScore / 100) * 100;
}

export function domainRelevanceScore(
  task: TaskDescription,
  ucp: UnifiedCapabilityProfile,
): number {
  const domain = task.domain;

  let arpDomain = 50;
  const dimScores = ucp.performance.quality.arpDimensionalScores;
  if (domain && Object.keys(dimScores).length > 0) {
    for (const key of [domain, `${domain}_accuracy`, "accuracy"]) {
      if (key in dimScores) {
        arpDomain = dimScores[key];
        break;
      }
    }
  }

  let asaDomain = ucp.performance.reliability.asaCompletionRate * 100;
  if (asaDomain <= 0) asaDomain = 50;

  return (arpDomain / 100) * (asaDomain / 100) * 100;
}

// ---------------------------------------------------------------------------
// Composite compatibility score (Section 6.2)
// ---------------------------------------------------------------------------

export function compatibilityScore(
  request: MatchRequest,
  ucp: UnifiedCapabilityProfile,
  chainAgeDays = 0,
  anchorCount = 0,
  interactionHistory?: Record<string, number>,
): [number, Record<string, number>] {
  const w = request.weights;
  const task = request.task;

  const scores: Record<string, number> = {
    capability_match: capabilityMatchScore(task, ucp),
    trust_score: trustScoreFromUcp(ucp, chainAgeDays, anchorCount),
    cost_alignment: costAlignmentScore(task, ucp),
    availability: availabilityScore(task, ucp),
    style_compatibility: styleCompatibilityScore(task, ucp, interactionHistory),
    domain_relevance: domainRelevanceScore(task, ucp),
  };

  const tierScale = trustTierWeight(ucp.trustTier);
  scores.trust_score *= tierScale;

  let total = 0;
  for (const [k, v] of Object.entries(scores)) {
    total += (w[k] ?? 0) * v;
  }
  return [total, scores];
}

// ---------------------------------------------------------------------------
// Constraint filtering (Section 6.1)
// ---------------------------------------------------------------------------

export function passesConstraints(
  ucp: UnifiedCapabilityProfile,
  constraints: MatchConstraints,
  trustScoreVal = 0,
): boolean {
  if (constraints.minTrustScore > 0 && trustScoreVal < constraints.minTrustScore) return false;

  if (ucp.performance.disputeProfile.ajpDisputeRate > constraints.maxDisputeRate) return false;

  if (constraints.requiredLifecycleStatus.length > 0) {
    if (!constraints.requiredLifecycleStatus.includes(ucp.availability.alpLifecycleStage)) return false;
  }

  if (constraints.excludedAgents.length > 0) {
    if (constraints.excludedAgents.includes(ucp.identity.ampId)) return false;
  }

  if (constraints.requiredRegistries.length > 0) {
    const agentRegistries = new Set(ucp.identity.registries.map((r) => r.registryType));
    if (!constraints.requiredRegistries.some((reg) => agentRegistries.has(reg))) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Mode 1: Ranked Search (Section 6.3)
// ---------------------------------------------------------------------------

export function rankedSearch(
  request: MatchRequest,
  candidates: UnifiedCapabilityProfile[],
  chainAges?: Record<string, number>,
  anchorCounts?: Record<string, number>,
  interactionHistory?: Record<string, number>,
): MatchResponse {
  const start = performance.now();

  const ages = chainAges ?? {};
  const anchors = anchorCounts ?? {};
  const totalCandidates = candidates.length;
  let filteredCount = 0;

  const scored: Array<{ score: number; idx: number; result: MatchResult }> = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    const ucp = candidates[idx];
    const aid = ucp.identity.ampId;
    const age = ages[aid] ?? 0;
    const anchorCt = anchors[aid] ?? 0;

    const [total, dimScores] = compatibilityScore(
      request, ucp, age, anchorCt, interactionHistory,
    );

    if (!passesConstraints(ucp, request.constraints, dimScores.trust_score ?? 0)) {
      filteredCount++;
      continue;
    }

    const result = new MatchResult({
      agentId: aid,
      compatibilityScore: total,
      dimensionalScores: dimScores,
      ucpSummary: {
        primary_capability: ucp.capabilities.length > 0 ? ucp.capabilities[0].description : "",
        arp_composite: ucp.performance.quality.arpCompositeScore,
        asa_completion_rate: ucp.performance.reliability.asaCompletionRate,
        estimated_cost: {
          amount: ucp.cost.baseRate.amount,
          currency: ucp.cost.baseRate.currency,
        },
      },
      trustVerification: new TrustVerification({
        cocChainVerified: age > 0,
        cocChainLengthDays: age,
        arpScoreVerified: ucp.performance.quality.arpCompositeScore > 0,
        asaHistoryVerified: ucp.performance.reliability.asaSampleSize > 0,
        ajpRecordVerified: ucp.performance.disputeProfile.ajpSampleSize > 0,
      }),
      registriesFoundOn: ucp.identity.registries.map((r) => r.registryType),
    });

    scored.push({ score: total, idx, result });

    if (scored.length > request.constraints.maxResults * 2) {
      scored.sort((a, b) => b.score - a.score);
      scored.length = request.constraints.maxResults;
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const topResults = scored.slice(0, request.constraints.maxResults);

  const results: MatchResult[] = [];
  for (let rank = 0; rank < topResults.length; rank++) {
    topResults[rank].result.rank = rank + 1;
    results.push(topResults[rank].result);
  }

  const elapsedMs = Math.round(performance.now() - start);

  return new MatchResponse({
    requestId: request.requestId,
    results,
    metadata: new MatchMetadata({
      totalCandidatesEvaluated: totalCandidates,
      candidatesFilteredByConstraints: filteredCount,
      candidatesScored: totalCandidates - filteredCount,
      queryTimeMs: elapsedMs,
    }),
  });
}

// ---------------------------------------------------------------------------
// Mode 2: Stable Matching — Gale-Shapley (Section 6.3)
// ---------------------------------------------------------------------------

export function stableMatching(
  requests: MatchRequest[],
  candidates: UnifiedCapabilityProfile[],
  agentPreferences?: (ucp: UnifiedCapabilityProfile, req: MatchRequest) => number,
  chainAges?: Record<string, number>,
  anchorCounts?: Record<string, number>,
): Record<string, string> {
  const ages = chainAges ?? {};
  const anchors = anchorCounts ?? {};

  const taskPrefs: Record<string, string[]> = {};
  for (const req of requests) {
    const scores: Array<[number, string]> = [];
    for (const ucp of candidates) {
      const aid = ucp.identity.ampId;
      const [total] = compatibilityScore(
        req, ucp, ages[aid] ?? 0, anchors[aid] ?? 0,
      );
      scores.push([total, aid]);
    }
    scores.sort((a, b) => b[0] - a[0]);
    taskPrefs[req.requestId] = scores.map(([, aid]) => aid);
  }

  const defaultAgentPref = (ucp: UnifiedCapabilityProfile, req: MatchRequest): number => {
    let score = 0;
    if (req.task.domain) {
      for (const cap of ucp.capabilities) {
        if (cap.domain === req.task.domain) { score += 50; break; }
      }
    }
    if (req.task.budgetMax > 0) score += Math.min(50, req.task.budgetMax);
    return score;
  };

  const prefFn = agentPreferences ?? defaultAgentPref;

  const agentPrefs: Record<string, string[]> = {};
  for (const ucp of candidates) {
    const aid = ucp.identity.ampId;
    const scores: Array<[number, string]> = requests.map((req) => [
      prefFn(ucp, req), req.requestId,
    ]);
    scores.sort((a, b) => b[0] - a[0]);
    agentPrefs[aid] = scores.map(([, rid]) => rid);
  }

  const agentRank: Record<string, Record<string, number>> = {};
  for (const [aid, prefs] of Object.entries(agentPrefs)) {
    agentRank[aid] = {};
    for (let i = 0; i < prefs.length; i++) agentRank[aid][prefs[i]] = i;
  }

  const freeTasks: string[] = Object.keys(taskPrefs);
  const proposalIdx: Record<string, number> = {};
  for (const rid of freeTasks) proposalIdx[rid] = 0;
  const currentMatch: Record<string, string> = {};
  const taskMatch: Record<string, string> = {};

  while (freeTasks.length > 0) {
    const rid = freeTasks.shift()!;
    const prefs = taskPrefs[rid];
    const idx = proposalIdx[rid];

    if (idx >= prefs.length) continue;

    const aid = prefs[idx];
    proposalIdx[rid] = idx + 1;

    if (!(aid in currentMatch)) {
      currentMatch[aid] = rid;
      taskMatch[rid] = aid;
    } else {
      const currentRid = currentMatch[aid];
      const ranks = agentRank[aid] ?? {};
      if ((ranks[rid] ?? requests.length) < (ranks[currentRid] ?? requests.length)) {
        currentMatch[aid] = rid;
        taskMatch[rid] = aid;
        delete taskMatch[currentRid];
        freeTasks.push(currentRid);
      } else {
        freeTasks.push(rid);
      }
    }
  }

  return taskMatch;
}
