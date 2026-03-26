"""Local append-only JSONL store for AMP records.

Same pattern as Chain of Consciousness and Agent Rating Protocol:
one JSON record per line, append-only, no deletion.
"""

import json
import threading
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypeVar

from .schema import (
    FederationResult,
    MatchRequest,
    MatchResponse,
    UnifiedCapabilityProfile,
)

T = TypeVar("T")


class MatchmakingStore:
    """Append-only local store backed by JSONL files.

    Maintains separate files for:
    - ucps.jsonl          -- Unified Capability Profiles (latest wins per amp_id)
    - requests.jsonl      -- MatchRequest records
    - responses.jsonl     -- MatchResponse records
    - federation.jsonl    -- FederationResult records
    """

    def __init__(self, directory: str = ".amp") -> None:
        self.directory = Path(directory)
        self._lock = threading.Lock()
        self.directory.mkdir(parents=True, exist_ok=True)

    def _file_path(self, record_type: str) -> Path:
        return self.directory / f"{record_type}.jsonl"

    def _append(self, record_type: str, data: Dict[str, Any]) -> None:
        path = self._file_path(record_type)
        line = json.dumps(data, separators=(",", ":"), ensure_ascii=True)
        with self._lock:
            with open(path, "a", encoding="utf-8") as f:
                f.write(line + "\n")

    def _read_all_raw(self, record_type: str) -> List[Dict[str, Any]]:
        path = self._file_path(record_type)
        if not path.exists():
            return []
        records: List[Dict[str, Any]] = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return records

    def _read_all(
        self,
        record_type: str,
        from_dict: Callable[[Dict[str, Any]], T],
    ) -> List[T]:
        results: List[T] = []
        for d in self._read_all_raw(record_type):
            try:
                results.append(from_dict(d))
            except (KeyError, ValueError):
                continue
        return results

    # -- UCPs --

    def save_ucp(self, ucp: UnifiedCapabilityProfile) -> str:
        self._append("ucps", ucp.to_dict())
        return ucp.amp_id

    def get_all_ucps(self) -> List[UnifiedCapabilityProfile]:
        return self._read_all("ucps", UnifiedCapabilityProfile.from_dict)

    def get_ucp(self, amp_id: str) -> Optional[UnifiedCapabilityProfile]:
        """Get the latest snapshot of a UCP (last write wins)."""
        latest = None
        for u in self.get_all_ucps():
            if u.identity.amp_id == amp_id:
                latest = u
        return latest

    def get_ucps_by_domain(self, domain: str) -> List[UnifiedCapabilityProfile]:
        """Get latest UCPs whose primary domain matches."""
        latest: Dict[str, UnifiedCapabilityProfile] = {}
        for u in self.get_all_ucps():
            latest[u.identity.amp_id] = u
        return [u for u in latest.values() if u.primary_domain() == domain]

    def search_ucps(
        self,
        domain: str = "",
        subdomain: str = "",
        text: str = "",
    ) -> List[UnifiedCapabilityProfile]:
        """Simple keyword search over stored UCPs."""
        latest: Dict[str, UnifiedCapabilityProfile] = {}
        for u in self.get_all_ucps():
            latest[u.identity.amp_id] = u

        results = []
        text_lower = text.lower()
        for u in latest.values():
            match = True
            if domain and not any(c.domain == domain for c in u.capabilities):
                match = False
            if subdomain and not any(c.subdomain == subdomain for c in u.capabilities):
                match = False
            if text_lower:
                cap_text = " ".join(
                    c.description.lower() + " " + c.domain + " " + c.subdomain
                    for c in u.capabilities
                )
                if text_lower not in cap_text:
                    match = False
            if match:
                results.append(u)
        return results

    # -- Requests --

    def save_request(self, request: MatchRequest) -> str:
        self._append("requests", request.to_dict())
        return request.request_id

    def get_requests(self) -> List[MatchRequest]:
        return self._read_all("requests", MatchRequest.from_dict)

    def get_request(self, request_id: str) -> Optional[MatchRequest]:
        for r in self.get_requests():
            if r.request_id == request_id:
                return r
        return None

    # -- Responses --

    def save_response(self, response: MatchResponse) -> str:
        self._append("responses", response.to_dict())
        return response.request_id

    def get_responses(self) -> List[MatchResponse]:
        return self._read_all("responses", MatchResponse.from_dict)

    # -- Federation --

    def save_federation_result(self, result: FederationResult) -> None:
        self._append("federation", result.to_dict())

    def get_federation_results(self) -> List[FederationResult]:
        return self._read_all("federation", FederationResult.from_dict)

    # -- Statistics --

    def stats(self) -> Dict[str, Any]:
        ucps = self.get_all_ucps()
        latest_ucps: Dict[str, UnifiedCapabilityProfile] = {}
        for u in ucps:
            latest_ucps[u.identity.amp_id] = u

        domain_counts: Dict[str, int] = {}
        for u in latest_ucps.values():
            d = u.primary_domain() or "unknown"
            domain_counts[d] = domain_counts.get(d, 0) + 1

        tier_counts: Dict[str, int] = {}
        for u in latest_ucps.values():
            tier_counts[u.trust_tier] = tier_counts.get(u.trust_tier, 0) + 1

        def _file_size(name: str) -> int:
            p = self._file_path(name)
            return p.stat().st_size if p.exists() else 0

        return {
            "directory": str(self.directory),
            "ucps": {
                "unique_count": len(latest_ucps),
                "snapshots_count": len(ucps),
                "file_size_bytes": _file_size("ucps"),
                "by_domain": domain_counts,
                "by_trust_tier": tier_counts,
            },
            "requests": {
                "count": len(self._read_all_raw("requests")),
                "file_size_bytes": _file_size("requests"),
            },
            "responses": {
                "count": len(self._read_all_raw("responses")),
                "file_size_bytes": _file_size("responses"),
            },
            "federation": {
                "count": len(self._read_all_raw("federation")),
                "file_size_bytes": _file_size("federation"),
            },
        }
