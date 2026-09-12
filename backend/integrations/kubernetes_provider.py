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


class KubernetesProvider(InfraProvider):
    kind = "kubernetes"

    def __init__(self, name: str, config: Dict[str, Any]) -> None:
        super().__init__(name, config)
        self.kubeconfig = config["kubeconfig"]
        self.context = config["context"]
        self.namespace = config.get("namespace", "default")
        self.prometheus = config.get("prometheus")
        # Runbooks are declared per environment: a cluster may only fix what its operator allows.
        self.runbooks: Dict[str, Dict[str, Any]] = config.get("runbooks", {})
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

        for key, book in self.runbooks.items():
            name = book["target"].split("/", 1)[1]
            var, expected = book["env"], book["value"]
            try:
                actual = self._deployment_env(name).get(var)
            except ProviderError as e:
                evidence.append(finding("Blocked", f"{name} {var}",
                                        f"could not read the deployment: {e}",
                                        f"kubectl -n {self.namespace} get deploy {name}"))
                continue
            source = f"kubectl -n {self.namespace} get deploy {name} -o jsonpath=…env"
            if actual is None:
                evidence.append(finding("Blocked", f"{name} {var}",
                                        "variable is not set on the deployment", source))
            elif actual != expected:
                evidence.append(finding("Verified", f"{name} {var}",
                                        f"{actual} — baseline is {expected}", source))
                if proposal is None:
                    proposal = self._build_proposal(key, book, actual)
            else:
                evidence.append(finding("Verified", f"{name} {var}", actual, source))

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

    def _build_proposal(self, key: str, book: Dict[str, Any], actual: str) -> Dict[str, Any]:
        name = book["target"].split("/", 1)[1]
        live = json.loads(self._kubectl("get", "deploy", name, "-o", "json"))
        action = {
            "action_id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
            "environment": self.name,
            "runbook": book.get("runbook", key),
            "target": book["target"],
            "summary": book["summary"],
            "parameters": {"name": book["env"], "value": book["value"]},
            "observed": actual,
            # Pinning means an approval cannot be replayed against a cluster that has since moved.
            "uid": live["metadata"]["uid"],
            "resource_version": live["metadata"]["resourceVersion"],
            "patch": {"spec": {"template": {"spec": {"containers": [
                {"name": name, "env": [{"name": book["env"], "value": book["value"]}]}]}}}},
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "expires_at": time.time() + 900,
        }
        self._proposals[action["action_id"]] = action
        return action

    def get_proposal(self, action_id: str) -> Optional[Dict[str, Any]]:
        return self._proposals.get(action_id)

    def apply(self, action: Dict[str, Any], approver: str) -> Dict[str, Any]:
        if action.get("applied_at"):
            raise ProviderError("This action was already applied; approvals are not replayable.")
        if time.time() > action["expires_at"]:
            raise ProviderError("Proposal expired after 15 minutes. Re-diagnose and approve the new one.")

        name = action["target"].split("/", 1)[1]
        live = json.loads(self._kubectl("get", "deploy", name, "-o", "json"))
        if live["metadata"]["resourceVersion"] != action["resource_version"]:
            raise ProviderError(
                "The deployment changed since this was proposed. Re-diagnose rather than apply a "
                "stale patch."
            )

        self._kubectl("patch", "deploy", name, "--type", "strategic", "-p",
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
