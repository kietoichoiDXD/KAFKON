"""Kubernetes + Prometheus, as one pluggable environment.

Everything that used to be module-level constants in ops.py is configuration now, so a second
cluster is a second entry in integrations.yaml rather than a second copy of this file.
"""
import json
import subprocess
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx

from .infra_base import InfraProvider, ProviderError, finding
from .k8s_checks import CHECKS


class KubernetesProvider(InfraProvider):
    kind = "kubernetes"

    def __init__(self, name: str, config: Dict[str, Any]) -> None:
        super().__init__(name, config)
        self.kubeconfig = config["kubeconfig"]
        self.context = config["context"]
        self.namespace = config.get("namespace", "default")
        self.prometheus = config.get("prometheus")
        # Checks are declared per environment: a cluster is only inspected and repaired in the
        # ways its operator wrote down. `runbooks:` is the older env-only shape, still accepted.
        self.checks: List[Dict[str, Any]] = list(config.get("checks", []))
        for key, book in (config.get("runbooks") or {}).items():
            self.checks.append({
                "kind": "env",
                "runbook": book.get("runbook", key.split("/")[0]),
                "target": book["target"],
                "summary": book["summary"],
                "env": book["env"],
                "value": book["value"],
            })
        # Faults are a drill tool, kept behind the same allowlist discipline as the repairs.
        self.faults: List[Dict[str, Any]] = list(config.get("faults", []))
        self.queries: Dict[str, str] = config.get("queries", {})
        self._proposals: Dict[str, Dict[str, Any]] = {}

    def target(self) -> str:
        return f"{self.context} · {self.namespace}"

    # ---- reads ----

    def _kubectl(self, *args: str, timeout: int = 60) -> str:
        out = subprocess.run(
            ["kubectl", "--kubeconfig", self.kubeconfig, "--context", self.context,
             "-n", self.namespace, *args],
            capture_output=True, text=True, timeout=timeout,
        )
        if out.returncode != 0:
            raise ProviderError((out.stderr or out.stdout).strip()[:400])
        return out.stdout

    def _promql(self, query: str) -> Optional[float]:
        if not self.prometheus or not query:
            return None
        try:
            r = httpx.get(f"{self.prometheus}/api/v1/query", params={"query": query}, timeout=10.0)
            result = r.json()["data"]["result"]
            return float(result[0]["value"][1]) if result else None
        except Exception:
            return None  # A dead tunnel is missing evidence, never a healthy verdict.

    def _deployment_env(self, name: str) -> Dict[str, str]:
        spec = json.loads(self._kubectl("get", "deploy", name, "-o", "json"))
        container = spec["spec"]["template"]["spec"]["containers"][0]
        return {e["name"]: e.get("value", "") for e in container.get("env", [])}

    def state(self) -> Dict[str, Any]:
        pods = []
        for line in self._kubectl("get", "pods", "--no-headers").strip().splitlines():
            parts = line.split()
            if len(parts) >= 5:
                pods.append({"name": parts[0], "ready": parts[1], "status": parts[2],
                             "restarts": parts[3], "age": parts[4]})
        return {
            "environment": self.name,
            "kind": self.kind,
            "namespace": self.namespace,
            "context": self.context,
            "pods": pods,
            "metrics": {
                "rps": self._promql(self.queries.get("rps", "")),
                "error_rate": self._promql(self.queries.get("error_rate", "")),
                "p95_seconds": self._promql(self.queries.get("p95_seconds", "")),
                "available": self._promql("vector(1)") is not None,
            },
        }

    def diagnose(self) -> Dict[str, Any]:
        evidence: List[Dict[str, str]] = []
        proposal = None
        state = self.state()

        unhealthy = [p for p in state["pods"]
                     if p["ready"].split("/")[0] != p["ready"].split("/")[1]]
        evidence.append(finding(
            "Verified" if not unhealthy else "Blocked",
            "Pod readiness",
            "every pod reports Ready" if not unhealthy
            else ", ".join(f"{p['name']} {p['ready']}" for p in unhealthy),
            f"kubectl -n {self.namespace} get pods",
        ))

        for spec in self.checks:
            kind = spec.get("kind", "env")
            runner = CHECKS.get(kind)
            if runner is None:
                evidence.append(finding("Blocked", spec.get("target", kind),
                                        f"unknown check kind {kind!r}", "integrations.yaml"))
                continue
            try:
                ev, repair = runner(self._kubectl, self.namespace, spec)
            except ProviderError as e:
                evidence.append(finding("Blocked", spec.get("target", kind),
                                        f"could not read it: {e}",
                                        f"kubectl -n {self.namespace}"))
                continue
            except Exception as e:
                evidence.append(finding("Blocked", spec.get("target", kind),
                                        f"{type(e).__name__}: {e}", f"kubectl -n {self.namespace}"))
                continue
            evidence.append(ev)
            # First repairable finding wins: one incident, one named action.
            if repair and proposal is None:
                proposal = self._build_proposal(spec, repair)

        m = state["metrics"]
        if self.prometheus and not m["available"]:
            evidence.append(finding("Blocked", "Error rate",
                                    "Prometheus is unreachable — absence of data is not health",
                                    f"{self.prometheus}/api/v1/query"))
        elif m["error_rate"] is not None:
            evidence.append(finding(
                "Verified" if m["error_rate"] > 0.02 else "Inferred",
                "Error rate",
                f"{m['error_rate'] * 100:.2f}% of requests are 5xx",
                self.queries.get("error_rate", ""),
            ))

        return {"state": state, "evidence": evidence, "proposal": proposal,
                "healthy": proposal is None and not unhealthy}

    # ---- proposal and write ----

    def _build_proposal(self, spec: Dict[str, Any], repair: Dict[str, Any]) -> Dict[str, Any]:
        resource, name = spec["target"].split("/", 1)
        live = json.loads(self._kubectl("get", resource, name, "-o", "json"))
        action = {
            "action_id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
            "environment": self.name,
            "runbook": spec.get("runbook", spec.get("kind", "repair")),
            "target": spec["target"],
            "summary": spec.get("summary", f"Restore {spec['target']} to the baseline"),
            "parameters": repair["parameters"],
            "observed": repair["observed"],
            # Pinning means an approval cannot be replayed against a cluster that has since moved.
            "uid": live["metadata"]["uid"],
            "resource_version": live["metadata"]["resourceVersion"],
            "patch": repair["patch"],
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "expires_at": time.time() + 900,
        }
        self._proposals[action["action_id"]] = action
        return action

    # ---- drills ----

    def list_faults(self) -> List[Dict[str, Any]]:
        return [{k: f[k] for k in ("name", "summary", "expect", "target") if k in f}
                for f in self.faults]

    def trigger(self, fault_name: str) -> Dict[str, Any]:
        """Inject one declared fault. Anything not in the file is refused."""
        for f in self.faults:
            if f["name"] == fault_name:
                resource, name = f["target"].split("/", 1)
                self._kubectl("patch", resource, name, "--type", "strategic",
                              "-p", json.dumps(f["patch"]))
                return {"triggered": f["name"], "target": f["target"],
                        "summary": f["summary"], "expect": f.get("expect", ""),
                        "at": time.strftime("%Y-%m-%d %H:%M:%S")}
        raise ProviderError(
            f"No fault named {fault_name!r}. Declared: "
            f"{', '.join(f['name'] for f in self.faults) or 'none'}."
        )

    def get_proposal(self, action_id: str) -> Optional[Dict[str, Any]]:
        return self._proposals.get(action_id)

    def apply(self, action: Dict[str, Any], approver: str) -> Dict[str, Any]:
        if action.get("applied_at"):
            raise ProviderError("This action was already applied; approvals are not replayable.")
        if time.time() > action["expires_at"]:
            raise ProviderError("Proposal expired after 15 minutes. Re-diagnose and approve the new one.")

        resource, name = action["target"].split("/", 1)
        live = json.loads(self._kubectl("get", resource, name, "-o", "json"))
        if live["metadata"]["resourceVersion"] != action["resource_version"]:
            raise ProviderError(
                "The deployment changed since this was proposed. Re-diagnose rather than apply a "
                "stale patch."
            )

        self._kubectl("patch", resource, name, "--type", "strategic", "-p",
                      json.dumps(action["patch"]))
        action["applied_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        action["approver"] = approver
        return {"applied": True, "action_id": action["action_id"], "approver": approver,
                "at": action["applied_at"],
                "note": "applied means the API write succeeded, not that the business flow "
                        "recovered — run verify next"}

    def verify(self) -> Dict[str, Any]:
        d = self.diagnose()
        m = d["state"]["metrics"]
        threshold = float(self.config.get("healthy_error_rate", 0.02))
        return {
            "environment": self.name,
            "config_restored": d["proposal"] is None,
            "pods_ready": all(p["ready"].split("/")[0] == p["ready"].split("/")[1]
                              for p in d["state"]["pods"]),
            "error_rate": m["error_rate"],
            "evidence": d["evidence"],
            # `or 1` would be wrong: a 0.0 error rate is falsy, and a fully recovered service
            # would be reported as not recovered. Missing evidence is the only reason to say no.
            "recovered": d["proposal"] is None
                         and (not self.prometheus or m["available"])
                         and (m["error_rate"] is None or m["error_rate"] < threshold),
        }
