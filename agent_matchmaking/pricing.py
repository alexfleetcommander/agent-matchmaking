"""Price discovery mechanisms — posted price, RFQ, and auction (Section 8).

Supports three mechanisms selectable per match request.
"""

import time as _time
from typing import Any, Callable, Dict, List, Optional, Tuple

from .schema import (
    MatchRequest,
    UnifiedCapabilityProfile,
    _gen_id,
    _now_iso,
)


# ---------------------------------------------------------------------------
# Price estimation
# ---------------------------------------------------------------------------

def estimate_cost(
    ucp: UnifiedCapabilityProfile,
    task_complexity: float = 1.0,
) -> float:
    """Estimate cost for a task based on UCP pricing model.

    Args:
        ucp: The agent's UCP with cost section.
        task_complexity: Multiplier for variable costs (1.0 = average).

    Returns:
        Estimated total cost in the agent's base currency.
    """
    base = ucp.cost.base_rate.amount
    variable = ucp.cost.variable_rate.amount * task_complexity * 1000  # assume ~1000 units
    return base + variable


# ---------------------------------------------------------------------------
# Mechanism 1: Posted Price (Section 8.2)
# ---------------------------------------------------------------------------

class PostedPriceResult:
    """Result from posted-price mechanism."""

    __slots__ = ("agent_id", "estimated_cost", "currency", "pricing_model")

    def __init__(
        self,
        agent_id: str = "",
        estimated_cost: float = 0.0,
        currency: str = "USD",
        pricing_model: str = "posted_price",
    ) -> None:
        self.agent_id = agent_id
        self.estimated_cost = estimated_cost
        self.currency = currency
        self.pricing_model = pricing_model

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_id": self.agent_id,
            "estimated_cost": round(self.estimated_cost, 4),
            "currency": self.currency,
            "pricing_model": self.pricing_model,
        }


def posted_price(
    candidates: List[UnifiedCapabilityProfile],
    task_complexity: float = 1.0,
) -> List[PostedPriceResult]:
    """Mechanism 1: Estimate costs from posted pricing models."""
    results = []
    for ucp in candidates:
        cost = estimate_cost(ucp, task_complexity)
        results.append(PostedPriceResult(
            agent_id=ucp.identity.amp_id,
            estimated_cost=cost,
            currency=ucp.cost.base_rate.currency,
            pricing_model=ucp.cost.pricing_model,
        ))
    return results


# ---------------------------------------------------------------------------
# Mechanism 2: Request for Quote (Section 8.2)
# ---------------------------------------------------------------------------

class Quote:
    """A price quote from an agent."""

    __slots__ = (
        "quote_id", "agent_id", "amount", "currency",
        "terms", "validity_window_ms", "timestamp",
    )

    def __init__(
        self,
        agent_id: str = "",
        amount: float = 0.0,
        currency: str = "USD",
        terms: str = "",
        validity_window_ms: int = 3600000,
        quote_id: str = "",
        timestamp: str = "",
    ) -> None:
        self.quote_id = quote_id or _gen_id("quote")
        self.agent_id = agent_id
        self.amount = amount
        self.currency = currency
        self.terms = terms
        self.validity_window_ms = validity_window_ms
        self.timestamp = timestamp or _now_iso()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "quote_id": self.quote_id,
            "agent_id": self.agent_id,
            "amount": round(self.amount, 4),
            "currency": self.currency,
            "terms": self.terms,
            "validity_window_ms": self.validity_window_ms,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Quote":
        return cls(
            quote_id=d.get("quote_id", ""),
            agent_id=d.get("agent_id", ""),
            amount=d.get("amount", 0.0),
            currency=d.get("currency", "USD"),
            terms=d.get("terms", ""),
            validity_window_ms=d.get("validity_window_ms", 3600000),
            timestamp=d.get("timestamp", ""),
        )


class RFQSession:
    """Manages a Request for Quote session (Section 8.2).

    Flow:
        1. Create RFQ with task description
        2. Solicit quotes from matched agents
        3. Collect quotes
        4. Select best quote
    """

    def __init__(self, request: MatchRequest) -> None:
        self.rfq_id = _gen_id("rfq")
        self.request = request
        self.quotes: List[Quote] = []
        self.selected_quote: Optional[Quote] = None
        self.created_at = _now_iso()

    def add_quote(self, quote: Quote) -> None:
        self.quotes.append(quote)

    def rank_quotes(
        self,
        trust_scores: Optional[Dict[str, float]] = None,
        quality_weight: float = 0.5,
        price_weight: float = 0.5,
    ) -> List[Quote]:
        """Rank quotes by combined price + trust score.

        Lower price = better. Higher trust = better.
        """
        trust_scores = trust_scores or {}

        scored: List[Tuple[float, Quote]] = []
        if not self.quotes:
            return []

        max_amount = max(q.amount for q in self.quotes) or 1.0

        for q in self.quotes:
            # Price score: lower is better, normalized to [0, 100]
            price_score = (1.0 - q.amount / max_amount) * 100 if max_amount > 0 else 50.0
            trust = trust_scores.get(q.agent_id, 50.0)
            combined = price_weight * price_score + quality_weight * trust
            scored.append((combined, q))

        scored.sort(key=lambda x: -x[0])
        return [q for _, q in scored]

    def select(self, quote_id: str) -> Optional[Quote]:
        """Accept a quote by ID."""
        for q in self.quotes:
            if q.quote_id == quote_id:
                self.selected_quote = q
                return q
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rfq_id": self.rfq_id,
            "request_id": self.request.request_id,
            "quotes": [q.to_dict() for q in self.quotes],
            "selected_quote": self.selected_quote.to_dict() if self.selected_quote else None,
            "created_at": self.created_at,
        }


# ---------------------------------------------------------------------------
# Mechanism 3: Auction — Vickrey sealed-bid second-price (Section 6.3/8.2)
# ---------------------------------------------------------------------------

class Bid:
    """A bid in an auction."""

    __slots__ = ("bid_id", "agent_id", "amount", "currency", "timestamp")

    def __init__(
        self,
        agent_id: str = "",
        amount: float = 0.0,
        currency: str = "USD",
        bid_id: str = "",
        timestamp: str = "",
    ) -> None:
        self.bid_id = bid_id or _gen_id("bid")
        self.agent_id = agent_id
        self.amount = amount
        self.currency = currency
        self.timestamp = timestamp or _now_iso()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bid_id": self.bid_id,
            "agent_id": self.agent_id,
            "amount": round(self.amount, 4),
            "currency": self.currency,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "Bid":
        return cls(
            bid_id=d.get("bid_id", ""),
            agent_id=d.get("agent_id", ""),
            amount=d.get("amount", 0.0),
            currency=d.get("currency", "USD"),
            timestamp=d.get("timestamp", ""),
        )


class AuctionResult:
    """Result of an auction."""

    __slots__ = (
        "auction_id", "format", "winner_id",
        "winning_bid", "clearing_price",
        "total_bids", "timestamp",
    )

    def __init__(
        self,
        auction_id: str = "",
        auction_format: str = "vickrey",
        winner_id: str = "",
        winning_bid: float = 0.0,
        clearing_price: float = 0.0,
        total_bids: int = 0,
        timestamp: str = "",
    ) -> None:
        self.auction_id = auction_id or _gen_id("auction")
        self.format = auction_format
        self.winner_id = winner_id
        self.winning_bid = winning_bid
        self.clearing_price = clearing_price
        self.total_bids = total_bids
        self.timestamp = timestamp or _now_iso()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "auction_id": self.auction_id,
            "format": self.format,
            "winner_id": self.winner_id,
            "winning_bid": round(self.winning_bid, 4),
            "clearing_price": round(self.clearing_price, 4),
            "total_bids": self.total_bids,
            "timestamp": self.timestamp,
        }


def vickrey_auction(
    bids: List[Bid],
    min_trust_score: float = 0.0,
    trust_scores: Optional[Dict[str, float]] = None,
) -> Optional[AuctionResult]:
    """Sealed-bid second-price (Vickrey) auction (Section 6.3).

    Lowest bidder wins, pays the second-lowest price.
    Bidders below min_trust_score are disqualified.
    """
    trust_scores = trust_scores or {}

    # Filter by trust threshold
    qualified = [
        b for b in bids
        if trust_scores.get(b.agent_id, 100.0) >= min_trust_score
    ]

    if not qualified:
        return None

    # Sort by amount (ascending — lowest wins)
    qualified.sort(key=lambda b: b.amount)

    winner = qualified[0]
    # Second-price: winner pays the second-lowest bid
    clearing_price = qualified[1].amount if len(qualified) > 1 else winner.amount

    return AuctionResult(
        auction_format="vickrey",
        winner_id=winner.agent_id,
        winning_bid=winner.amount,
        clearing_price=clearing_price,
        total_bids=len(bids),
    )


def english_auction(
    bids: List[Bid],
    min_trust_score: float = 0.0,
    trust_scores: Optional[Dict[str, float]] = None,
) -> Optional[AuctionResult]:
    """English (descending-price) auction.

    For agent matching, "English" means agents bid progressively lower.
    Last remaining bidder (lowest price meeting trust threshold) wins.
    """
    trust_scores = trust_scores or {}

    qualified = [
        b for b in bids
        if trust_scores.get(b.agent_id, 100.0) >= min_trust_score
    ]

    if not qualified:
        return None

    qualified.sort(key=lambda b: b.amount)
    winner = qualified[0]

    return AuctionResult(
        auction_format="english",
        winner_id=winner.agent_id,
        winning_bid=winner.amount,
        clearing_price=winner.amount,
        total_bids=len(bids),
    )
