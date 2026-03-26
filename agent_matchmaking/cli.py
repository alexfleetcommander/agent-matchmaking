"""CLI entry point for agent-matchmaking.

Commands:
  search    Find agents by capability description
  match     Get ranked matches for a task
  register  Register an agent capability profile
  status    Show store statistics
"""

import argparse
import json
import sys
from typing import List, Optional

from .schema import (
    Capability,
    Cost,
    CostRate,
    Identity,
    MatchConstraints,
    MatchRequest,
    Performance,
    QualityMetrics,
    ReliabilityMetrics,
    TaskDescription,
    UnifiedCapabilityProfile,
)
from .store import MatchmakingStore
from .matching import ranked_search
from .ucp import UCPBuilder, validate_ucp


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="agent-match",
        description="Agent Matchmaking Protocol — cross-platform discovery "
                    "and trust-weighted matching for the agent economy",
    )
    parser.add_argument(
        "--store",
        default=".amp",
        help="Path to the AMP data directory (default: .amp)",
    )
    parser.add_argument(
        "--json", action="store_true", dest="json_output",
        help="Output as JSON",
    )

    sub = parser.add_subparsers(dest="command", help="Available commands")

    # search
    p_search = sub.add_parser("search", help="Find agents by capability")
    p_search.add_argument("query", nargs="?", default="", help="Search query text")
    p_search.add_argument("--domain", default="", help="Filter by domain")
    p_search.add_argument("--subdomain", default="", help="Filter by subdomain")
    p_search.add_argument("--max-results", type=int, default=10, help="Max results")

    # match
    p_match = sub.add_parser("match", help="Get ranked matches for a task")
    p_match.add_argument("description", help="Task description")
    p_match.add_argument("--domain", default="", help="Task domain")
    p_match.add_argument("--subdomain", default="", help="Task subdomain")
    p_match.add_argument("--budget", type=float, default=0.0, help="Max budget (USD)")
    p_match.add_argument("--deadline-ms", type=int, default=0, help="Deadline in ms")
    p_match.add_argument("--max-results", type=int, default=10, help="Max results")
    p_match.add_argument("--min-trust", type=float, default=0.0, help="Minimum trust score")
    p_match.add_argument(
        "--requester-id", default="cli-user",
        help="Requester agent ID",
    )

    # register
    p_reg = sub.add_parser("register", help="Register an agent capability profile")
    p_reg.add_argument("--agent-id", default="", help="Agent ID (auto-generated if empty)")
    p_reg.add_argument("--domain", required=True, help="Primary capability domain")
    p_reg.add_argument("--subdomain", default="", help="Capability subdomain")
    p_reg.add_argument("--description", required=True, help="Capability description")
    p_reg.add_argument("--a2a-card", default="", help="A2A Agent Card URL")
    p_reg.add_argument("--did", default="", help="DID identifier")
    p_reg.add_argument("--coc-chain", default="", help="CoC chain ID")
    p_reg.add_argument("--price", type=float, default=0.0, help="Base price per request (USD)")
    p_reg.add_argument(
        "--arp-score", type=float, default=0.0,
        help="ARP composite score (0-100)",
    )
    p_reg.add_argument(
        "--tools", default="",
        help="Comma-separated list of tools used",
    )

    # status
    sub.add_parser("status", help="Show store statistics")

    return parser


def _output(data: object, as_json: bool = False) -> None:
    if as_json:
        if hasattr(data, "to_dict"):
            data = data.to_dict()  # type: ignore[union-attr]
        print(json.dumps(data, indent=2))
    else:
        if isinstance(data, dict):
            for k, v in data.items():
                print(f"  {k}: {v}")
        elif isinstance(data, list):
            for item in data:
                if hasattr(item, "to_dict"):
                    print(f"  - {json.dumps(item.to_dict())}")
                else:
                    print(f"  - {item}")
        else:
            print(data)


def main(argv: Optional[List[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 0

    store = MatchmakingStore(args.store)
    json_out = args.json_output

    try:
        if args.command == "search":
            results = store.search_ucps(
                domain=args.domain,
                subdomain=args.subdomain,
                text=args.query,
            )
            results = results[:args.max_results]
            print(f"Found {len(results)} agent(s):")
            for ucp in results:
                cap_desc = ucp.capabilities[0].description if ucp.capabilities else "no description"
                print(f"  {ucp.identity.amp_id} [{ucp.trust_tier}] — {cap_desc[:80]}")
            if json_out:
                _output([u.to_dict() for u in results], True)

        elif args.command == "match":
            task = TaskDescription(
                description=args.description,
                domain=args.domain,
                subdomain=args.subdomain,
                deadline_ms=args.deadline_ms,
                budget_max=args.budget,
            )
            request = MatchRequest(
                requester_id=args.requester_id,
                task=task,
                constraints=MatchConstraints(
                    max_results=args.max_results,
                    min_trust_score=args.min_trust,
                ),
            )

            # Get all UCPs from store
            candidates = store.get_all_ucps()
            # Deduplicate to latest per amp_id
            latest: dict = {}
            for u in candidates:
                latest[u.identity.amp_id] = u
            candidates = list(latest.values())

            if not candidates:
                print("No agents registered. Use 'agent-match register' to add agents.")
                return 0

            response = ranked_search(request, candidates)

            # Save request and response
            store.save_request(request)
            store.save_response(response)

            print(f"Match results for: {args.description}")
            print(f"  Candidates evaluated: {response.metadata.total_candidates_evaluated}")
            print(f"  Candidates scored: {response.metadata.candidates_scored}")
            print(f"  Query time: {response.metadata.query_time_ms}ms")
            print()

            for r in response.results:
                print(f"  #{r.rank} {r.agent_id}")
                print(f"     Score: {r.compatibility_score:.1f}")
                cap = r.ucp_summary.get("primary_capability", "")
                print(f"     Capability: {cap[:70]}")
                cost_info = r.ucp_summary.get("estimated_cost", {})
                if cost_info.get("amount", 0) > 0:
                    print(f"     Est. cost: {cost_info['amount']} {cost_info.get('currency', 'USD')}")
                tv = r.trust_verification
                verified_count = sum([
                    tv.coc_chain_verified, tv.arp_score_verified,
                    tv.asa_history_verified, tv.ajp_record_verified,
                ])
                print(f"     Trust signals verified: {verified_count}/4")
                print()

            if json_out:
                _output(response.to_dict(), True)

        elif args.command == "register":
            builder = UCPBuilder()
            builder.identity(
                amp_id=args.agent_id,
                a2a_card=args.a2a_card,
                did=args.did,
                coc_chain_id=args.coc_chain,
            )

            tools = [t.strip() for t in args.tools.split(",") if t.strip()] if args.tools else []
            builder.add_capability(
                domain=args.domain,
                subdomain=args.subdomain,
                description=args.description,
                tools_used=tools,
            )

            if args.price > 0:
                builder.cost(base_amount=args.price)

            if args.arp_score > 0:
                builder.performance(arp_composite=args.arp_score)

            # Set trust tier based on available signals
            if args.coc_chain:
                builder.trust_tier("verified")
            elif args.a2a_card or args.did:
                builder.trust_tier("attested")
            else:
                builder.trust_tier("declared")

            ucp = builder.build()

            # Validate
            warnings = validate_ucp(ucp)
            if warnings:
                for w in warnings:
                    print(f"  Warning: {w}", file=sys.stderr)

            store.save_ucp(ucp)
            print(f"Registered: {ucp.identity.amp_id}")
            print(f"  Domain: {args.domain}")
            print(f"  Trust tier: {ucp.trust_tier}")
            if json_out:
                _output(ucp.to_dict(), True)

        elif args.command == "status":
            stats = store.stats()
            print("Agent Matchmaking Protocol Store")
            print(f"  Directory: {stats['directory']}")
            print(f"  UCPs: {stats['ucps']['unique_count']} unique ({stats['ucps']['snapshots_count']} snapshots)")
            if stats['ucps']['by_domain']:
                print("  By domain:")
                for domain, count in stats['ucps']['by_domain'].items():
                    print(f"    {domain}: {count}")
            if stats['ucps']['by_trust_tier']:
                print("  By trust tier:")
                for tier, count in stats['ucps']['by_trust_tier'].items():
                    print(f"    {tier}: {count}")
            print(f"  Requests: {stats['requests']['count']}")
            print(f"  Responses: {stats['responses']['count']}")
            print(f"  Federation queries: {stats['federation']['count']}")
            if json_out:
                _output(stats, True)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
