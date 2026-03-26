"""Federation router — adapter pattern for cross-platform registry queries.

Dispatches queries to multiple registries in parallel with configurable
timeout. Each registry is accessed through a RegistryAdapter subclass
(Section 7.1).
"""

import time as _time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import Any, Callable, Dict, List, Optional

from .schema import (
    FederationQuery,
    FederationResult,
    MatchRequest,
    UnifiedCapabilityProfile,
    _now_iso,
)
from .discovery import deduplicate, normalize_results, translate_to_federation_query


# ---------------------------------------------------------------------------
# Registry Adapter (abstract base)
# ---------------------------------------------------------------------------

class RegistryAdapter:
    """Base class for registry adapters (Section 7.1).

    Subclass and implement `search()` to connect a new registry.
    """

    name: str = "base"

    def search(self, query: FederationQuery) -> List[UnifiedCapabilityProfile]:
        """Execute a search against this registry. Override in subclasses."""
        raise NotImplementedError

    def health_check(self) -> bool:
        """Return True if the registry is reachable."""
        return True


class LocalStoreAdapter(RegistryAdapter):
    """Adapter that searches the local MatchmakingStore."""

    name = "local"

    def __init__(self, store: Any) -> None:
        self._store = store

    def search(self, query: FederationQuery) -> List[UnifiedCapabilityProfile]:
        return self._store.search_ucps(
            domain=query.domain,
            subdomain=query.subdomain,
            text=query.query_text,
        )


class StaticAdapter(RegistryAdapter):
    """Adapter backed by a static list of UCPs (useful for testing)."""

    name = "static"

    def __init__(self, ucps: List[UnifiedCapabilityProfile], name: str = "static") -> None:
        self._ucps = ucps
        self.name = name

    def search(self, query: FederationQuery) -> List[UnifiedCapabilityProfile]:
        text_lower = query.query_text.lower()
        results = []
        for ucp in self._ucps:
            for cap in ucp.capabilities:
                if (
                    (not query.domain or cap.domain == query.domain)
                    and (not text_lower or text_lower in cap.description.lower())
                ):
                    results.append(ucp)
                    break
        return results[:query.max_results]


class CallbackAdapter(RegistryAdapter):
    """Adapter that delegates to a callback function."""

    def __init__(
        self,
        name: str,
        search_fn: Callable[[FederationQuery], List[UnifiedCapabilityProfile]],
    ) -> None:
        self.name = name
        self._search_fn = search_fn

    def search(self, query: FederationQuery) -> List[UnifiedCapabilityProfile]:
        return self._search_fn(query)


# ---------------------------------------------------------------------------
# Federation Router
# ---------------------------------------------------------------------------

class FederationRouter:
    """Routes queries to registered adapters in parallel (Section 7.1).

    Architecture:
        Match Engine  <->  FederationRouter  <->  RegistryAdapter[]
    """

    def __init__(self, timeout_ms: int = 5000, max_workers: int = 10) -> None:
        self._adapters: Dict[str, RegistryAdapter] = {}
        self.timeout_ms = timeout_ms
        self.max_workers = max_workers

    def register(self, adapter: RegistryAdapter) -> None:
        self._adapters[adapter.name] = adapter

    def unregister(self, name: str) -> None:
        self._adapters.pop(name, None)

    @property
    def registry_names(self) -> List[str]:
        return list(self._adapters.keys())

    def query(
        self,
        request: MatchRequest,
        registries: Optional[List[str]] = None,
    ) -> List[FederationResult]:
        """Dispatch federation query to all (or specified) adapters in parallel.

        Returns one FederationResult per adapter.
        """
        fed_query = translate_to_federation_query(request)

        # Determine which adapters to query
        if registries and "all" not in registries:
            adapters = {n: a for n, a in self._adapters.items() if n in registries}
        else:
            adapters = dict(self._adapters)

        if not adapters:
            return []

        timeout_sec = self.timeout_ms / 1000.0
        results: List[FederationResult] = []

        def _query_adapter(name_adapter):
            name, adapter = name_adapter
            start = _time.monotonic()
            try:
                ucps = adapter.search(fed_query)
                elapsed = int((_time.monotonic() - start) * 1000)
                normalized = normalize_results(ucps, source_registry=name)
                return FederationResult(
                    registry_name=name,
                    ucps=normalized,
                    query_time_ms=elapsed,
                )
            except Exception as e:
                elapsed = int((_time.monotonic() - start) * 1000)
                return FederationResult(
                    registry_name=name,
                    ucps=[],
                    query_time_ms=elapsed,
                    error=str(e),
                )

        # Parallel dispatch (Step 2)
        workers = min(self.max_workers, len(adapters))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(_query_adapter, (name, adapter)): name
                for name, adapter in adapters.items()
            }
            for future in futures:
                try:
                    result = future.result(timeout=timeout_sec)
                    results.append(result)
                except FuturesTimeout:
                    name = futures[future]
                    results.append(FederationResult(
                        registry_name=name,
                        ucps=[],
                        error="timeout",
                    ))
                except Exception as e:
                    name = futures[future]
                    results.append(FederationResult(
                        registry_name=name,
                        ucps=[],
                        error=str(e),
                    ))

        return results

    def federated_search(
        self,
        request: MatchRequest,
        registries: Optional[List[str]] = None,
    ) -> List[UnifiedCapabilityProfile]:
        """Full federated search: query all registries, normalize, deduplicate.

        Convenience method combining query + deduplication.
        """
        results = self.query(request, registries)

        all_ucps: List[UnifiedCapabilityProfile] = []
        for result in results:
            all_ucps.extend(result.ucps)

        return deduplicate(all_ucps)
