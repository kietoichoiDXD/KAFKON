"""Any service reachable over HTTP, with no agent and no cluster access.

This exists to keep the interface honest. Plenty of infrastructure cannot be patched by us — a
managed service, a partner's API, a staging box behind a tunnel — but it can still be probed, and
a probe is real evidence. The provider reports what it measured and offers no proposal, so the
console says there is nothing to approve instead of inventing an action it cannot perform.
"""
import time
from typing import Any, Dict, List

import httpx

from .infra_base import InfraProvider, finding


class HttpProvider(InfraProvider):
    kind = "http"

    def __init__(self, name: str, config: Dict[str, Any]) -> None:
        super().__init__(name, config)
        self.checks: List[Dict[str, Any]] = config.get("checks", [])
        self.timeout = float(config.get("timeout_seconds", 8))
        self.slow_ms = float(config.get("slow_ms", 1500))

    def target(self) -> str:
        first = self.checks[0]["url"] if self.checks else "no checks configured"
        more = f" +{len(self.checks) - 1} more" if len(self.checks) > 1 else ""
        return f"{first}{more}"

    def _probe(self, check: Dict[str, Any]) -> Dict[str, Any]:
        url, expect = check["url"], int(check.get("expect_status", 200))
        started = time.perf_counter()
        try:
            r = httpx.get(url, timeout=self.timeout, follow_redirects=True)
            ms = (time.perf_counter() - started) * 1000
            return {"url": url, "status": r.status_code, "ms": round(ms, 1),
                    "ok": r.status_code == expect, "expect": expect}
        except Exception as e:
            ms = (time.perf_counter() - started) * 1000
            return {"url": url, "status": None, "ms": round(ms, 1), "ok": False,
                    "expect": expect, "error": f"{type(e).__name__}: {e}"[:160]}

    def state(self) -> Dict[str, Any]:
        results = [self._probe(c) for c in self.checks]
        answered = [r for r in results if r["status"] is not None]
        failing = [r for r in results if not r["ok"]]
        return {
            "environment": self.name,
            "kind": self.kind,
            "checks": results,
            "metrics": {
                "error_rate": (len(failing) / len(results)) if results else None,
                "p95_seconds": (max(r["ms"] for r in answered) / 1000) if answered else None,
                "rps": None,
                "available": bool(answered),
            },
        }

    def diagnose(self) -> Dict[str, Any]:
        state = self.state()
        evidence: List[Dict[str, str]] = []

        if not self.checks:
            evidence.append(finding("Blocked", "Checks",
                                    "no checks are configured for this environment",
                                    "integrations.yaml"))
            return {"state": state, "evidence": evidence, "proposal": None, "healthy": False}

        for r in state["checks"]:
            name = r["url"]
            if r["status"] is None:
                evidence.append(finding("Blocked", name,
                                        f"no response — {r.get('error', 'unreachable')}",
                                        f"GET {name}"))
            elif not r["ok"]:
                evidence.append(finding("Verified", name,
                                        f"HTTP {r['status']}, expected {r['expect']}",
                                        f"GET {name}"))
            elif r["ms"] > self.slow_ms:
                evidence.append(finding("Verified", name,
                                        f"HTTP {r['status']} but took {r['ms']:.0f} ms",
                                        f"GET {name}"))
            else:
                evidence.append(finding("Verified", name,
                                        f"HTTP {r['status']} in {r['ms']:.0f} ms",
                                        f"GET {name}"))

        blocked = any(e["label"] == "Blocked" for e in evidence)
        failing = [r for r in state["checks"] if not r["ok"]]
        if failing and not blocked:
            evidence.append(finding(
                "Inferred", "Scope",
                f"{len(failing)} of {len(state['checks'])} endpoints are failing — the fault is "
                f"not isolated to one route" if len(failing) > 1
                else "a single endpoint is failing; the rest answer normally",
                "derived from the probes above",
            ))

        # Deliberately no proposal: this provider has no way to change the thing it measured.
        return {"state": state, "evidence": evidence, "proposal": None,
                "healthy": not failing and not blocked}

    def verify(self) -> Dict[str, Any]:
        d = self.diagnose()
        return {
            "environment": self.name,
            "config_restored": None,  # nothing to restore from here
            "pods_ready": None,
            "error_rate": d["state"]["metrics"]["error_rate"],
            "evidence": d["evidence"],
            "recovered": d["healthy"],
        }
