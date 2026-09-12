"""Read the AIOps lab, diagnose what is wrong, and propose the exact fix.

Same discipline as the rest of ScribeBA: every claim carries Verified / Inferred / Assumed /
Blocked, and the fix is a named runbook with an exact patch — never an arbitrary command.

Boundaries this module keeps:
  * Reads go through kubectl with the kubeconfig named by LAB_KUBECONFIG.
  * A write happens only when a human posts an approval naming the action_id it saw.
  * The only writes allowed are the runbooks in RUNBOOKS. There is no free-form patch path.
"""
import json
import os
import subprocess
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx

KUBECONFIG = os.environ.get("LAB_KUBECONFIG", os.path.expanduser("~/.lab-state/admin-kubeconfig"))
CONTEXT = os.environ.get("LAB_CONTEXT", "capstone-aiops-lab")
NAMESPACE = os.environ.get("LAB_NAMESPACE", "lab-app")
PROM = os.environ.get("LAB_PROMETHEUS", "http://localhost:19090")

# The runbook catalog from the handoff. A proposal may only name one of these, and the patch is
# built here rather than accepted from the caller.
RUNBOOKS: Dict[str, Dict[str, Any]] = {
    "restore-endpoint/cart": {
        "target": "deployment/cart",
        "summary": "Point cart back at the in-cluster Valkey service",
        "env": ("VALKEY_ADDR", "valkey:6379"),
    },
    "restore-endpoint/catalog": {
        "target": "deployment/catalog",
        "summary": "Point catalog back at the in-cluster PostgreSQL service",
        "env": ("DB_CONNECTION_STRING",
                "postgres://lab:$(DB_PASSWORD)@postgresql:5432/lab?sslmode=disable"),
    },
}

# Proposals live for the length of a demo, in memory. A restart drops them, which is correct:
# an approval must refer to a proposal someone actually saw.
_PROPOSALS: Dict[str, Dict[str, Any]] = {}


def _kubectl(*args: str, timeout: int = 60) -> str:
    out = subprocess.run(
        ["kubectl", "--kubeconfig", KUBECONFIG, "--context", CONTEXT, "-n", NAMESPACE, *args],
        capture_output=True, text=True, timeout=timeout,
    )
    if out.returncode != 0:
        raise RuntimeError((out.stderr or out.stdout).strip()[:400])
    return out.stdout


def _promql(query: str) -> Optional[float]:
    try:
        r = httpx.get(f"{PROM}/api/v1/query", params={"query": query}, timeout=10.0)
        result = r.json()["data"]["result"]
        return float(result[0]["value"][1]) if result else None
    except Exception:
        return None  # A dead tunnel is missing evidence, never a healthy verdict.


def _deployment_env(name: str) -> Dict[str, str]:
    raw = _kubectl("get", "deploy", name, "-o", "json")
    spec = json.loads(raw)["spec"]["template"]["spec"]["containers"][0]
    return {e["name"]: e.get("value", "") for e in spec.get("env", [])}


def cluster_state() -> Dict[str, Any]:
    pods = []
    for line in _kubectl("get", "pods", "--no-headers").strip().splitlines():
        parts = line.split()
        if len(parts) >= 5:
            pods.append({"name": parts[0], "ready": parts[1], "status": parts[2],
                         "restarts": parts[3], "age": parts[4]})
    prom_up = _promql("vector(1)") is not None
    return {
        "namespace": NAMESPACE,
        "context": CONTEXT,
        "pods": pods,
        "metrics": {
            "rps": _promql("sum(rate(lab_http_requests_total[2m]))"),
            "error_rate": _promql(
                'sum(rate(lab_http_requests_total{status=~"5.."}[2m])) '
                '/ clamp_min(sum(rate(lab_http_requests_total[2m])), 0.001)'
            ),
            "p95_seconds": _promql(
                "histogram_quantile(0.95, sum by (le) (rate(lab_http_request_seconds_bucket[5m])))"
            ),
            "available": prom_up,
        },
    }


def diagnose() -> Dict[str, Any]:
    """Compare the running config against the baseline and label every claim."""
    evidence: List[Dict[str, str]] = []
    proposal = None

    state = cluster_state()
    unhealthy = [p for p in state["pods"] if p["ready"].split("/")[0] != p["ready"].split("/")[1]]
    evidence.append({
        "label": "Verified" if not unhealthy else "Blocked",
        "field": "Pod readiness",
        "value": "every pod reports Ready" if not unhealthy
                 else ", ".join(f"{p['name']} {p['ready']}" for p in unhealthy),
        "source": f"kubectl -n {NAMESPACE} get pods",
    })

    for key, book in RUNBOOKS.items():
        name = book["target"].split("/", 1)[1]
        var, expected = book["env"]
        try:
            actual = _deployment_env(name).get(var)
        except RuntimeError as e:
            evidence.append({"label": "Blocked", "field": f"{name} {var}",
                             "value": f"could not read the deployment: {e}", "source": "kubectl get deploy"})
            continue
        if actual is None:
            evidence.append({"label": "Blocked", "field": f"{name} {var}",
                             "value": "variable is not set on the deployment", "source": f"kubectl get deploy {name}"})
        elif actual != expected:
            evidence.append({
                "label": "Verified", "field": f"{name} {var}",
                "value": f"{actual} — baseline is {expected}",
                "source": f"kubectl -n {NAMESPACE} get deploy {name} -o jsonpath=…env",
            })
            if proposal is None:
                proposal = _build_proposal(key, var, expected, actual)
        else:
            evidence.append({"label": "Verified", "field": f"{name} {var}", "value": actual,
                             "source": f"kubectl get deploy {name}"})

    er = state["metrics"]["error_rate"]
    if not state["metrics"]["available"]:
        evidence.append({"label": "Blocked", "field": "Error rate",
                         "value": "Prometheus is unreachable — absence of data is not health",
                         "source": f"{PROM}/api/v1/query"})
    elif er is not None:
        evidence.append({
            "label": "Verified" if er > 0.02 else "Inferred",
            "field": "Error rate (2m)",
            "value": f"{er * 100:.2f}% of requests are 5xx",
            "source": 'sum(rate(lab_http_requests_total{status=~"5.."}[2m])) / …',
        })

    return {"state": state, "evidence": evidence, "proposal": proposal,
            "healthy": proposal is None and not unhealthy}


def _build_proposal(runbook_key: str, var: str, expected: str, actual: str) -> Dict[str, Any]:
    book = RUNBOOKS[runbook_key]
    name = book["target"].split("/", 1)[1]
    live = json.loads(_kubectl("get", "deploy", name, "-o", "json"))
    action = {
        "action_id": f"ACT-{uuid.uuid4().hex[:8].upper()}",
        "runbook": runbook_key.split("/")[0],
        "target": book["target"],
        "summary": book["summary"],
        "parameters": {"name": var, "value": expected},
        "observed": actual,
        # Pinning to the live object means an approval cannot be replayed against a changed cluster.
        "uid": live["metadata"]["uid"],
        "resource_version": live["metadata"]["resourceVersion"],
        "patch": {
            "spec": {"template": {"spec": {"containers": [{"name": name, "env": [
                {"name": var, "value": expected}]}]}}}
        },
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "expires_at": time.time() + 900,
    }
    _PROPOSALS[action["action_id"]] = action
    return action


def apply_action(action_id: str, approver: str) -> Dict[str, Any]:
    """Apply an approved proposal. Refuses anything it did not itself propose."""
    action = _PROPOSALS.get(action_id)
    if action is None:
        raise RuntimeError("Unknown action_id. Re-run the diagnosis and approve what it proposes.")
    if action.get("applied_at"):
        raise RuntimeError("This action was already applied; approvals are not replayable.")
    if time.time() > action["expires_at"]:
        raise RuntimeError("Proposal expired after 15 minutes. Re-diagnose and approve the new one.")

    name = action["target"].split("/", 1)[1]
    live = json.loads(_kubectl("get", "deploy", name, "-o", "json"))
    if live["metadata"]["resourceVersion"] != action["resource_version"]:
        raise RuntimeError(
            "The deployment changed since this was proposed. Re-diagnose rather than apply a stale patch."
        )

    _kubectl("patch", "deploy", name, "--type", "strategic", "-p", json.dumps(action["patch"]))
    action["applied_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    action["approver"] = approver
    return {"applied": True, "action_id": action_id, "approver": approver,
            "at": action["applied_at"], "note": "applied means the API write succeeded, not that the "
                                                "business flow recovered — run verify next"}


def verify() -> Dict[str, Any]:
    """Recovery is a business claim, so it needs more than a Ready pod."""
    d = diagnose()
    rollout = _kubectl("rollout", "status", "deploy/cart", "--timeout", "5s").strip() \
        if any(p["name"].startswith("cart") for p in d["state"]["pods"]) else ""
    return {
        "config_restored": d["proposal"] is None,
        "pods_ready": all(p["ready"].split("/")[0] == p["ready"].split("/")[1] for p in d["state"]["pods"]),
        "error_rate": d["state"]["metrics"]["error_rate"],
        "rollout": rollout,
        "evidence": d["evidence"],
        # `or 1` would be wrong here: a 0.0 error rate is falsy, so a fully recovered service
        # would be reported as not recovered. Missing evidence is the only reason to say no.
        "recovered": d["proposal"] is None
                     and d["state"]["metrics"]["available"]
                     and d["state"]["metrics"]["error_rate"] is not None
                     and d["state"]["metrics"]["error_rate"] < 0.02,
    }
