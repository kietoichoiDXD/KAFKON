"""Declarative checks for a Kubernetes environment.

The first version of the console only knew one incident: an environment variable that no longer
matched the baseline. That is one of eight cases in the lab and one of very many in real life, and
every new one meant editing Python.

A check is now a dict in integrations.yaml. It says what to look at, what the baseline is, and —
when it can be repaired — which runbook and patch would repair it. Everything below is read-only
inspection plus a patch builder; nothing here decides to write.
"""
import json
from typing import Any, Callable, Dict, List, Optional, Tuple

from .infra_base import finding

# A check returns (evidence, repair) where repair is None when there is nothing to propose.
Repair = Optional[Dict[str, Any]]
Result = Tuple[Dict[str, str], Repair]


def _container(deploy: Dict[str, Any], name: Optional[str] = None) -> Dict[str, Any]:
    containers = deploy["spec"]["template"]["spec"]["containers"]
    if name:
        for c in containers:
            if c["name"] == name:
                return c
    return containers[0]


def check_env(kubectl, ns: str, spec: Dict[str, Any]) -> Result:
    """An env var drifted from the baseline — the lab's F02 and F03."""
    name = spec["target"].split("/", 1)[1]
    var, expected = spec["env"], str(spec["value"])
    source = f"kubectl -n {ns} get deploy {name} -o jsonpath=…env"
    deploy = json.loads(kubectl("get", "deploy", name, "-o", "json"))
    env = {e["name"]: e.get("value", "") for e in _container(deploy).get("env", [])}
    actual = env.get(var)

    if actual is None:
        return finding("Blocked", f"{name} {var}", "variable is not set on the deployment", source), None
    if actual == expected:
        return finding("Verified", f"{name} {var}", actual, source), None
    return (
        finding("Verified", f"{name} {var}", f"{actual} — baseline is {expected}", source),
        {"observed": actual, "parameters": {"name": var, "value": expected},
         "patch": {"spec": {"template": {"spec": {"containers": [
             {"name": _container(deploy)["name"], "env": [{"name": var, "value": expected}]}]}}}}},
    )


def check_image(kubectl, ns: str, spec: Dict[str, Any]) -> Result:
    """A deployment is running an image that is not the baseline — F04."""
    name = spec["target"].split("/", 1)[1]
    expected = str(spec["value"])
    source = f"kubectl -n {ns} get deploy {name} -o jsonpath=…image"
    deploy = json.loads(kubectl("get", "deploy", name, "-o", "json"))
    container = _container(deploy)
    actual = container.get("image", "")

    if actual == expected:
        return finding("Verified", f"{name} image", actual, source), None
    return (
        finding("Verified", f"{name} image", f"{actual} — baseline is {expected}", source),
        {"observed": actual, "parameters": {"name": "image", "value": expected},
         "patch": {"spec": {"template": {"spec": {"containers": [
             {"name": container["name"], "image": expected}]}}}}},
    )


def check_replicas(kubectl, ns: str, spec: Dict[str, Any]) -> Result:
    """Scaled to zero, or below the floor the service needs — F08."""
    name = spec["target"].split("/", 1)[1]
    expected = int(spec["value"])
    source = f"kubectl -n {ns} get deploy {name} -o jsonpath=…replicas"
    deploy = json.loads(kubectl("get", "deploy", name, "-o", "json"))
    actual = int(deploy["spec"].get("replicas", 0))

    if actual >= expected:
        return finding("Verified", f"{name} replicas", str(actual), source), None
    return (
        finding("Verified", f"{name} replicas",
                f"{actual} — this service needs at least {expected}", source),
        {"observed": str(actual), "parameters": {"name": "replicas", "value": str(expected)},
         "patch": {"spec": {"replicas": expected}}},
    )


def check_selector(kubectl, ns: str, spec: Dict[str, Any]) -> Result:
    """A Service selects labels no Pod carries, so it has no endpoints — F01."""
    svc_name = spec["target"].split("/", 1)[1]
    source = f"kubectl -n {ns} get endpoints {svc_name}"
    svc = json.loads(kubectl("get", "svc", svc_name, "-o", "json"))
    selector = svc["spec"].get("selector", {})
    endpoints = json.loads(kubectl("get", "endpoints", svc_name, "-o", "json"))
    addresses = [a for subset in endpoints.get("subsets", []) or []
                 for a in subset.get("addresses", []) or []]

    if addresses:
        return finding("Verified", f"{svc_name} endpoints",
                       f"{len(addresses)} ready endpoint(s), selector {selector}", source), None

    expected = spec.get("value")
    ev = finding("Verified", f"{svc_name} endpoints",
                 f"no ready endpoints — selector {selector} matches no Pod", source)
    if not expected:
        return ev, None  # something is wrong, but this check was not told what right looks like
    want = dict(expected) if isinstance(expected, dict) else {"app": str(expected)}
    if selector == want:
        # The selector is correct, so the fault is elsewhere; do not propose a no-op patch.
        return ev, None
    return ev, {"observed": json.dumps(selector, sort_keys=True),
                "parameters": {"name": "selector", "value": json.dumps(want, sort_keys=True)},
                "patch": {"spec": {"selector": want}}}


def check_probe(kubectl, ns: str, spec: Dict[str, Any]) -> Result:
    """A readiness probe pointed at a path that does not exist — F06."""
    name = spec["target"].split("/", 1)[1]
    expected = str(spec["value"])
    source = f"kubectl -n {ns} get deploy {name} -o jsonpath=…readinessProbe"
    deploy = json.loads(kubectl("get", "deploy", name, "-o", "json"))
    container = _container(deploy)
    probe = container.get("readinessProbe", {}).get("httpGet")

    if not probe:
        return finding("Blocked", f"{name} readiness probe",
                       "no HTTP readiness probe is configured", source), None
    actual = probe.get("path", "")
    if actual == expected:
        return finding("Verified", f"{name} readiness path", actual, source), None
    return (
        finding("Verified", f"{name} readiness path", f"{actual} — baseline is {expected}", source),
        {"observed": actual, "parameters": {"name": "readinessProbe.path", "value": expected},
         "patch": {"spec": {"template": {"spec": {"containers": [
             {"name": container["name"],
              "readinessProbe": {"httpGet": {"path": expected,
                                             "port": probe.get("port")}}}]}}}}},
    )


def check_restarts(kubectl, ns: str, spec: Dict[str, Any]) -> Result:
    """Containers dying and coming back: OOMKilled, CrashLoopBackOff — F05 and F07.

    Deliberately proposes nothing. The right repair for a crash is a judgement — more memory, a
    fixed entrypoint, a rollback — and guessing one would be exactly the behaviour this product
    exists to argue against.
    """
    prefix = spec.get("target", "").split("/", 1)[-1]
    source = f"kubectl -n {ns} get pods -o jsonpath=…containerStatuses"
    pods = json.loads(kubectl("get", "pods", "-o", "json"))
    trouble: List[str] = []

    for pod in pods.get("items", []):
        pod_name = pod["metadata"]["name"]
        if prefix and not pod_name.startswith(prefix):
            continue
        for cs in pod.get("status", {}).get("containerStatuses", []) or []:
            waiting = (cs.get("state", {}).get("waiting") or {}).get("reason")
            terminated = (cs.get("lastState", {}).get("terminated") or {})
            reason, code = terminated.get("reason"), terminated.get("exitCode")
            if waiting in ("CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull"):
                trouble.append(f"{pod_name}: {waiting}")
            elif reason:
                trouble.append(f"{pod_name}: last exit {reason}"
                               + (f" (code {code})" if code is not None else ""))
            elif int(cs.get("restartCount", 0)) > int(spec.get("value", 0)):
                trouble.append(f"{pod_name}: {cs['restartCount']} restarts")

    if not trouble:
        return finding("Verified", "Container restarts",
                       "no crashes, OOM kills or image pull failures", source), None
    return finding("Verified", "Container restarts", "; ".join(trouble[:4]), source), None


CHECKS: Dict[str, Callable[..., Result]] = {
    "env": check_env,
    "image": check_image,
    "replicas": check_replicas,
    "selector": check_selector,
    "probe": check_probe,
    "restarts": check_restarts,
}
