import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  FederationResult,
  MatchRequest,
  MatchResponse,
  UnifiedCapabilityProfile,
} from "./schema";

export class MatchmakingStore {
  readonly directory: string;

  constructor(directory = ".amp") {
    this.directory = directory;
    mkdirSync(directory, { recursive: true });
  }

  private filePath(recordType: string): string {
    return join(this.directory, `${recordType}.jsonl`);
  }

  private append(recordType: string, data: Record<string, unknown>): void {
    const path = this.filePath(recordType);
    const line = JSON.stringify(data) + "\n";
    writeFileSync(path, line, { flag: "a", encoding: "utf-8" });
  }

  private readAllRaw(recordType: string): Array<Record<string, unknown>> {
    const path = this.filePath(recordType);
    if (!existsSync(path)) return [];
    const content = readFileSync(path, "utf-8");
    const records: Array<Record<string, unknown>> = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed));
      } catch {
        continue;
      }
    }
    return records;
  }

  // -- UCPs --

  saveUcp(ucp: UnifiedCapabilityProfile): string {
    this.append("ucps", ucp.toDict() as unknown as Record<string, unknown>);
    return ucp.ampId;
  }

  getAllUcps(): UnifiedCapabilityProfile[] {
    return this.readAllRaw("ucps").map((d) => {
      try { return UnifiedCapabilityProfile.fromDict(d as any); } catch { return null; }
    }).filter((u): u is UnifiedCapabilityProfile => u !== null);
  }

  getUcp(ampId: string): UnifiedCapabilityProfile | null {
    let latest: UnifiedCapabilityProfile | null = null;
    for (const u of this.getAllUcps()) {
      if (u.identity.ampId === ampId) latest = u;
    }
    return latest;
  }

  getUcpsByDomain(domain: string): UnifiedCapabilityProfile[] {
    const latest: Record<string, UnifiedCapabilityProfile> = {};
    for (const u of this.getAllUcps()) latest[u.identity.ampId] = u;
    return Object.values(latest).filter((u) => u.primaryDomain() === domain);
  }

  searchUcps(domain = "", subdomain = "", text = ""): UnifiedCapabilityProfile[] {
    const latest: Record<string, UnifiedCapabilityProfile> = {};
    for (const u of this.getAllUcps()) latest[u.identity.ampId] = u;

    const results: UnifiedCapabilityProfile[] = [];
    const textLower = text.toLowerCase();
    for (const u of Object.values(latest)) {
      let match = true;
      if (domain && !u.capabilities.some((c) => c.domain === domain)) match = false;
      if (subdomain && !u.capabilities.some((c) => c.subdomain === subdomain)) match = false;
      if (textLower) {
        const capText = u.capabilities
          .map((c) => c.description.toLowerCase() + " " + c.domain + " " + c.subdomain)
          .join(" ");
        if (!capText.includes(textLower)) match = false;
      }
      if (match) results.push(u);
    }
    return results;
  }

  // -- Requests --

  saveRequest(request: MatchRequest): string {
    this.append("requests", request.toDict() as unknown as Record<string, unknown>);
    return request.requestId;
  }

  getRequests(): MatchRequest[] {
    return this.readAllRaw("requests").map((d) => {
      try { return MatchRequest.fromDict(d as any); } catch { return null; }
    }).filter((r): r is MatchRequest => r !== null);
  }

  getRequest(requestId: string): MatchRequest | null {
    for (const r of this.getRequests()) {
      if (r.requestId === requestId) return r;
    }
    return null;
  }

  // -- Responses --

  saveResponse(response: MatchResponse): string {
    this.append("responses", response.toDict() as unknown as Record<string, unknown>);
    return response.requestId;
  }

  getResponses(): MatchResponse[] {
    return this.readAllRaw("responses").map((d) => {
      try { return MatchResponse.fromDict(d as any); } catch { return null; }
    }).filter((r): r is MatchResponse => r !== null);
  }

  // -- Federation --

  saveFederationResult(result: FederationResult): void {
    this.append("federation", result.toDict() as unknown as Record<string, unknown>);
  }

  getFederationResults(): FederationResult[] {
    return this.readAllRaw("federation").map((d) => {
      try { return FederationResult.fromDict(d as any); } catch { return null; }
    }).filter((r): r is FederationResult => r !== null);
  }

  // -- Statistics --

  stats(): Record<string, unknown> {
    const ucps = this.getAllUcps();
    const latestUcps: Record<string, UnifiedCapabilityProfile> = {};
    for (const u of ucps) latestUcps[u.identity.ampId] = u;

    const domainCounts: Record<string, number> = {};
    for (const u of Object.values(latestUcps)) {
      const d = u.primaryDomain() || "unknown";
      domainCounts[d] = (domainCounts[d] ?? 0) + 1;
    }

    const tierCounts: Record<string, number> = {};
    for (const u of Object.values(latestUcps)) {
      tierCounts[u.trustTier] = (tierCounts[u.trustTier] ?? 0) + 1;
    }

    const fileSize = (name: string): number => {
      const p = this.filePath(name);
      return existsSync(p) ? statSync(p).size : 0;
    };

    return {
      directory: this.directory,
      ucps: {
        unique_count: Object.keys(latestUcps).length,
        snapshots_count: ucps.length,
        file_size_bytes: fileSize("ucps"),
        by_domain: domainCounts,
        by_trust_tier: tierCounts,
      },
      requests: {
        count: this.readAllRaw("requests").length,
        file_size_bytes: fileSize("requests"),
      },
      responses: {
        count: this.readAllRaw("responses").length,
        file_size_bytes: fileSize("responses"),
      },
      federation: {
        count: this.readAllRaw("federation").length,
        file_size_bytes: fileSize("federation"),
      },
    };
  }
}
