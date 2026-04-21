import {
  FederationQuery,
  FederationResult,
  MatchRequest,
  UnifiedCapabilityProfile,
} from "./schema";
import { deduplicate, normalizeResults, translateToFederationQuery } from "./discovery";

// ---------------------------------------------------------------------------
// Registry Adapter (abstract base)
// ---------------------------------------------------------------------------

export abstract class RegistryAdapter {
  abstract readonly name: string;
  abstract search(query: FederationQuery): UnifiedCapabilityProfile[];
  healthCheck(): boolean { return true; }
}

export class LocalStoreAdapter extends RegistryAdapter {
  readonly name = "local";
  private store: { searchUcps(domain: string, subdomain: string, text: string): UnifiedCapabilityProfile[] };

  constructor(store: { searchUcps(domain: string, subdomain: string, text: string): UnifiedCapabilityProfile[] }) {
    super();
    this.store = store;
  }

  search(query: FederationQuery): UnifiedCapabilityProfile[] {
    return this.store.searchUcps(query.domain, query.subdomain, query.queryText);
  }
}

export class StaticAdapter extends RegistryAdapter {
  name: string;
  private ucps: UnifiedCapabilityProfile[];

  constructor(ucps: UnifiedCapabilityProfile[], name = "static") {
    super();
    this.ucps = ucps;
    this.name = name;
  }

  search(query: FederationQuery): UnifiedCapabilityProfile[] {
    const textLower = query.queryText.toLowerCase();
    const results: UnifiedCapabilityProfile[] = [];
    for (const ucp of this.ucps) {
      for (const cap of ucp.capabilities) {
        if (
          (!query.domain || cap.domain === query.domain) &&
          (!textLower || cap.description.toLowerCase().includes(textLower))
        ) {
          results.push(ucp);
          break;
        }
      }
    }
    return results.slice(0, query.maxResults);
  }
}

export class CallbackAdapter extends RegistryAdapter {
  name: string;
  private searchFn: (query: FederationQuery) => UnifiedCapabilityProfile[];

  constructor(name: string, searchFn: (query: FederationQuery) => UnifiedCapabilityProfile[]) {
    super();
    this.name = name;
    this.searchFn = searchFn;
  }

  search(query: FederationQuery): UnifiedCapabilityProfile[] {
    return this.searchFn(query);
  }
}

// ---------------------------------------------------------------------------
// Federation Router
// ---------------------------------------------------------------------------

export class FederationRouter {
  private adapters: Record<string, RegistryAdapter> = {};
  timeoutMs: number;
  maxWorkers: number;

  constructor(timeoutMs = 5000, maxWorkers = 10) {
    this.timeoutMs = timeoutMs;
    this.maxWorkers = maxWorkers;
  }

  register(adapter: RegistryAdapter): void {
    this.adapters[adapter.name] = adapter;
  }

  unregister(name: string): void {
    delete this.adapters[name];
  }

  get registryNames(): string[] {
    return Object.keys(this.adapters);
  }

  query(request: MatchRequest, registries?: string[]): FederationResult[] {
    const fedQuery = translateToFederationQuery(request);

    let adaptersToQuery: Record<string, RegistryAdapter>;
    if (registries && !registries.includes("all")) {
      adaptersToQuery = {};
      for (const [n, a] of Object.entries(this.adapters)) {
        if (registries.includes(n)) adaptersToQuery[n] = a;
      }
    } else {
      adaptersToQuery = { ...this.adapters };
    }

    if (Object.keys(adaptersToQuery).length === 0) return [];

    const results: FederationResult[] = [];

    for (const [name, adapter] of Object.entries(adaptersToQuery)) {
      const start = performance.now();
      try {
        const ucps = adapter.search(fedQuery);
        const elapsedMs = Math.round(performance.now() - start);
        const normalized = normalizeResults(ucps, name);
        results.push(new FederationResult({
          registryName: name,
          ucps: normalized,
          queryTimeMs: elapsedMs,
        }));
      } catch (e) {
        const elapsedMs = Math.round(performance.now() - start);
        results.push(new FederationResult({
          registryName: name,
          ucps: [],
          queryTimeMs: elapsedMs,
          error: String(e),
        }));
      }
    }

    return results;
  }

  federatedSearch(request: MatchRequest, registries?: string[]): UnifiedCapabilityProfile[] {
    const results = this.query(request, registries);
    const allUcps: UnifiedCapabilityProfile[] = [];
    for (const result of results) {
      allUcps.push(...result.ucps);
    }
    return deduplicate(allUcps);
  }
}
