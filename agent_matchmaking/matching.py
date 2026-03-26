"""Multi-dimensional matching engine — capability match, trust-weighted
ranking, compatibility scoring (Section 6).

Supports three modes: ranked search, stable matching (Gale-Shapley),
and auction matching.
"""

import heapq
import math
from typing import Any, Callable, Dict, List, Optional, Tuple

from .schema import (
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
    _now_iso,
)
from .ranking import trust_score_from_ucp, trust_tier_weight


# ---------------------------------------------------------------------------
# Similarity helpers (zero-dependency keyword-based)
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> set:
    """Simple whitespace + punctuation tokenizer."""
    import re
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


# ---------------------------------------------------------------------------
# Dimensional scoring functions (Section 6.2)
# ---------------------------------------------------------------------------

def capability_match_score(task: TaskDescription, ucp: UnifiedCapabilityProfile) -> float:
    """C_capability(R, A) = sim * tool_bonus * complexity_fit (Section 6.2)."""
    task_tokens = _tokenize(task.description + " " + task.domain + " " + task.subdomain)

    best_sim = 0.0
    tool_bonus = 1.0
    complexity_fit = 1.0

    for cap in ucp.capabilities:
        cap_tokens = _tokenize(
            cap.description + " " + cap.domain + " " + cap.subdomain
            + " " + " ".join(cap.tools_used)
        )
        sim = _jaccard(task_tokens, cap_tokens)
        # Domain exact match bonus
        if task.domain and cap.domain == task.domain:
            sim = min(1.0, sim + 0.3)
        if task.subdomain and cap.subdomain == task.subdomain:
            sim = min(1.0, sim + 0.2)
        best_sim = max(best_sim, sim)

        # Tool bonus: up to 1.2 for tool matches
        if task.input_spec:
            required_tools = task.input_spec.get("required_tools", [])
            if required_tools:
                matched_tools = len(set(required_tools) & set(cap.tools_used))
                if matched_tools > 0:
                    tool_bonus = min(1.2, 1.0 + 0.1 * matched_tools)

    return best_sim * tool_bonus * complexity_fit * 100


def cost_alignment_score(task: TaskDescription, ucp: UnifiedCapabilityProfile) -> float:
    """C_cost(R, A) = max(0, 100 - penalty * |estimated - budget|) (Section 6.2)."""
    if task.budget_max <= 0:
        return 50.0  # no budget specified = neutral

    estimated = ucp.cost.base_rate.amount
    if estimated <= 0:
        return 50.0  # unknown cost = neutral

    diff = abs(estimated - task.budget_max)
    penalty = 100 / max(task.budget_max, 1.0)  # normalize to budget scale
    return max(0.0, min(100.0, 100 - penalty * diff))


def availability_score(task: TaskDescription, ucp: UnifiedCapabilityProfile) -> float:
    """C_availability(R, A) = lifecycle * capacity * deadline_fit (Section 6.2)."""
    # Lifecycle check: hard zero for inactive
    if ucp.availability.alp_lifecycle_stage in INACTIVE_STATUSES:
        return 0.0

    # Capacity score: inverse of load
    cap = ucp.availability.capacity
    capacity_score = max(0.0, 100 - cap.current_load_pct)

    # Deadline fit
    deadline_fit = 100.0
    if task.deadline_ms > 0 and ucp.performance.speed.median_response_time_ms > 0:
        if ucp.performance.speed.median_response_time_ms > task.deadline_ms:
            # Over deadline: penalize proportionally
            ratio = task.deadline_ms / ucp.performance.speed.median_response_time_ms
            deadline_fit = ratio * 100
        # Within deadline: full score
    elif task.deadline_ms > 0 and cap.estimated_queue_time_ms > 0:
        if cap.estimated_queue_time_ms > task.deadline_ms:
            deadline_fit = 50.0

    return (capacity_score / 100) * (deadline_fit / 100) * 100


def style_compatibility_score(
    task: TaskDescription,
    ucp: UnifiedCapabilityProfile,
    interaction_history: Optional[Dict[str, float]] = None,
) -> float:
    """C_style(R, A) = format_match * interaction_history (Section 6.2)."""
    format_match = 50.0  # default neutral
    output_format = task.output_spec.get("format", "")
    if output_format:
        for cap in ucp.capabilities:
            if output_format in cap.output_modalities:
                format_match = 100.0
                break

    # Interaction history (collaborative filtering placeholder)
    history_score = 50.0
    if interaction_history and ucp.identity.amp_id in interaction_history:
        history_score = interaction_history[ucp.identity.amp_id]

    return (format_match / 100) * (history_score / 100) * 100


def domain_relevance_score(task: TaskDescription, ucp: UnifiedCapabilityProfile) -> float:
    """C_domain(R, A) = arp_domain_score * asa_domain_compliance (Section 6.2)."""
    domain = task.domain

    # ARP domain score: check dimensional scores for the domain
    arp_domain = 50.0
    dim_scores = ucp.performance.quality.arp_dimensional_scores
    if domain and dim_scores:
        # Look for domain-related keys
        for key in (domain, f"{domain}_accuracy", "accuracy"):
            if key in dim_scores:
                arp_domain = dim_scores[key]
                break

    # ASA domain compliance: use overall completion rate as proxy
    asa_domain = ucp.performance.reliability.asa_completion_rate * 100
    if asa_domain <= 0:
        asa_domain = 50.0

    return (arp_domain / 100) * (asa_domain / 100) * 100


# ---------------------------------------------------------------------------
# Composite compatibility score (Section 6.2)
# ---------------------------------------------------------------------------

def compatibility_score(
    request: MatchRequest,
    ucp: UnifiedCapabilityProfile,
    chain_age_days: int = 0,
    anchor_count: int = 0,
    interaction_history: Optional[Dict[str, float]] = None,
) -> Tuple[float, Dict[str, float]]:
    """Compute composite compatibility score S(R, A).

    Returns (total_score, dimensional_scores_dict).
    """
    w = request.weights
    task = request.task

    scores = {
        "capability_match": capability_match_score(task, ucp),
        "trust_score": trust_score_from_ucp(ucp, chain_age_days, anchor_count),
        "cost_alignment": cost_alignment_score(task, ucp),
        "availability": availability_score(task, ucp),
        "style_compatibility": style_compatibility_score(task, ucp, interaction_history),
        "domain_relevance": domain_relevance_score(task, ucp),
    }

    # Trust tier scaling: verified agents get full weight, declared get 25%
    tier_scale = trust_tier_weight(ucp.trust_tier)
    scores["trust_score"] *= tier_scale

    total = sum(w.get(k, 0.0) * v for k, v in scores.items())
    return total, scores


# ---------------------------------------------------------------------------
# Constraint filtering (Section 6.1)
# ---------------------------------------------------------------------------

def passes_constraints(
    ucp: UnifiedCapabilityProfile,
    constraints: MatchConstraints,
    trust_score_val: float = 0.0,
) -> bool:
    """Check if a UCP passes all hard constraints."""
    if constraints.min_trust_score > 0 and trust_score_val < constraints.min_trust_score:
        return False

    dispute_rate = ucp.performance.dispute_profile.ajp_dispute_rate
    if dispute_rate > constraints.max_dispute_rate:
        return False

    if constraints.required_lifecycle_status:
        if ucp.availability.alp_lifecycle_stage not in constraints.required_lifecycle_status:
            return False

    if constraints.excluded_agents:
        if ucp.identity.amp_id in constraints.excluded_agents:
            return False

    if constraints.required_registries:
        agent_registries = {r.registry_type for r in ucp.identity.registries}
        if not any(reg in agent_registries for reg in constraints.required_registries):
            return False

    return True


# ---------------------------------------------------------------------------
# Mode 1: Ranked Search (Section 6.3)
# ---------------------------------------------------------------------------

def ranked_search(
    request: MatchRequest,
    candidates: List[UnifiedCapabilityProfile],
    chain_ages: Optional[Dict[str, int]] = None,
    anchor_counts: Optional[Dict[str, int]] = None,
    interaction_history: Optional[Dict[str, float]] = None,
) -> MatchResponse:
    """Execute ranked search matching (default mode).

    O(n log k) where n = candidates, k = max_results.
    """
    import time as _time
    start = _time.monotonic()

    chain_ages = chain_ages or {}
    anchor_counts = anchor_counts or {}
    total_candidates = len(candidates)
    filtered_count = 0
    scored: List[Tuple[float, int, MatchResult]] = []

    for idx, ucp in enumerate(candidates):
        aid = ucp.identity.amp_id
        age = chain_ages.get(aid, 0)
        anchors = anchor_counts.get(aid, 0)

        total, dim_scores = compatibility_score(
            request, ucp, age, anchors, interaction_history,
        )

        if not passes_constraints(ucp, request.constraints, dim_scores.get("trust_score", 0)):
            filtered_count += 1
            continue

        result = MatchResult(
            agent_id=aid,
            compatibility_score=total,
            dimensional_scores=dim_scores,
            ucp_summary={
                "primary_capability": ucp.capabilities[0].description if ucp.capabilities else "",
                "arp_composite": ucp.performance.quality.arp_composite_score,
                "asa_completion_rate": ucp.performance.reliability.asa_completion_rate,
                "estimated_cost": {
                    "amount": ucp.cost.base_rate.amount,
                    "currency": ucp.cost.base_rate.currency,
                },
            },
            trust_verification=TrustVerification(
                coc_chain_verified=age > 0,
                coc_chain_length_days=age,
                arp_score_verified=ucp.performance.quality.arp_composite_score > 0,
                asa_history_verified=ucp.performance.reliability.asa_sample_size > 0,
                ajp_record_verified=ucp.performance.dispute_profile.ajp_sample_size > 0,
            ),
            registries_found_on=[r.registry_type for r in ucp.identity.registries],
        )

        # Use heap for O(n log k) top-k
        if len(scored) < request.constraints.max_results:
            heapq.heappush(scored, (total, idx, result))
        elif total > scored[0][0]:
            heapq.heapreplace(scored, (total, idx, result))

    # Sort by score descending, assign ranks
    scored.sort(key=lambda x: -x[0])
    results = []
    for rank, (score, _, result) in enumerate(scored, 1):
        result.rank = rank
        results.append(result)

    elapsed_ms = int((_time.monotonic() - start) * 1000)

    return MatchResponse(
        request_id=request.request_id,
        results=results,
        metadata=MatchMetadata(
            total_candidates_evaluated=total_candidates,
            candidates_filtered_by_constraints=filtered_count,
            candidates_scored=total_candidates - filtered_count,
            query_time_ms=elapsed_ms,
        ),
    )


# ---------------------------------------------------------------------------
# Mode 2: Stable Matching — Gale-Shapley (Section 6.3)
# ---------------------------------------------------------------------------

def stable_matching(
    requests: List[MatchRequest],
    candidates: List[UnifiedCapabilityProfile],
    agent_preferences: Optional[Callable[[UnifiedCapabilityProfile, MatchRequest], float]] = None,
    chain_ages: Optional[Dict[str, int]] = None,
    anchor_counts: Optional[Dict[str, int]] = None,
) -> Dict[str, str]:
    """Deferred-acceptance (Gale-Shapley) stable matching.

    Returns dict mapping request_id -> agent amp_id.
    Task-optimal by default (tasks propose).
    """
    chain_ages = chain_ages or {}
    anchor_counts = anchor_counts or {}

    # Build task-side preference lists
    task_prefs: Dict[str, List[str]] = {}
    for req in requests:
        scores = []
        for ucp in candidates:
            aid = ucp.identity.amp_id
            total, _ = compatibility_score(
                req, ucp,
                chain_ages.get(aid, 0),
                anchor_counts.get(aid, 0),
            )
            scores.append((total, aid))
        scores.sort(reverse=True)
        task_prefs[req.request_id] = [aid for _, aid in scores]

    # Build agent-side preference lists
    def _default_agent_pref(ucp: UnifiedCapabilityProfile, req: MatchRequest) -> float:
        # Agents prefer tasks that match their domain and pay well
        score = 0.0
        if req.task.domain:
            for cap in ucp.capabilities:
                if cap.domain == req.task.domain:
                    score += 50
        if req.task.budget_max > 0:
            score += min(50, req.task.budget_max)
        return score

    pref_fn = agent_preferences or _default_agent_pref

    agent_prefs: Dict[str, List[str]] = {}
    for ucp in candidates:
        aid = ucp.identity.amp_id
        scores = [(pref_fn(ucp, req), req.request_id) for req in requests]
        scores.sort(reverse=True)
        agent_prefs[aid] = [rid for _, rid in scores]

    # Agent preference rank lookup
    agent_rank: Dict[str, Dict[str, int]] = {}
    for aid, prefs in agent_prefs.items():
        agent_rank[aid] = {rid: i for i, rid in enumerate(prefs)}

    # Gale-Shapley: tasks propose
    free_tasks = list(task_prefs.keys())
    proposal_idx: Dict[str, int] = {rid: 0 for rid in free_tasks}
    current_match: Dict[str, str] = {}  # agent_id -> request_id
    task_match: Dict[str, str] = {}  # request_id -> agent_id

    while free_tasks:
        rid = free_tasks.pop(0)
        prefs = task_prefs[rid]
        idx = proposal_idx[rid]

        if idx >= len(prefs):
            continue  # exhausted all options

        aid = prefs[idx]
        proposal_idx[rid] = idx + 1

        if aid not in current_match:
            current_match[aid] = rid
            task_match[rid] = aid
        else:
            current_rid = current_match[aid]
            ranks = agent_rank.get(aid, {})
            if ranks.get(rid, len(requests)) < ranks.get(current_rid, len(requests)):
                # Agent prefers new task
                current_match[aid] = rid
                task_match[rid] = aid
                del task_match[current_rid]
                free_tasks.append(current_rid)
            else:
                free_tasks.append(rid)

    return task_match
