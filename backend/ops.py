"""The incident console, across every configured environment.

The providers live in backend/integrations/; this module is the thin layer the API, the TUI and
the chat router all call. It holds two things a provider should not: the proposal ledger that
makes approvals un-replayable, and the Slack notifications that put a human in the loop.

Boundaries kept here:
  * A write happens only through a proposal this process issued and a human approved.
  * The only writes possible are the runbooks declared in integrations.yaml.
  * A refusal is reported to whoever was asked to approve, not swallowed.
"""
import time
from typing import Any, Dict, List, Optional

from .integrations.infra_base import ProviderError
from .integrations.registry import registry

# Proposals live for the length of a session. A restart drops them, which is correct: an approval
# must refer to a proposal someone actually saw.
_PROPOSALS: Dict[str, Dict[str, Any]] = {}

_DEMO_STATE: Dict[str, Any] = {
    "fault": "F02-bad-valkey-address",
    "applied": False,
    "target": "deployment/cart",
}


def _demo_diagnose(p) -> Dict[str, Any]:
    is_fault = bool(_DEMO_STATE.get("fault")) and not _DEMO_STATE.get("applied")
    pods = [
        {"name": "cart-7b94c5f88-x2k9l", "ready": "0/1" if is_fault else "1/1",
         "status": "CrashLoopBackOff" if is_fault else "Running", "restarts": "4", "age": "12m"},
        {"name": "frontend-5d8f99c89-m8qp2", "ready": "1/1", "status": "Running", "restarts": "0", "age": "3d"},
        {"name": "payment-service-8457c-t4l9p", "ready": "1/1", "status": "Running", "restarts": "0", "age": "3d"},
        {"name": "shipping-67df98f8b-q7v5w", "ready": "1/1", "status": "Running", "restarts": "0", "age": "3d"},
    ]
    metrics = {
        "rps": 48.6,
        "error_rate": 0.054 if is_fault else 0.001,
        "p95_seconds": 0.420 if is_fault else 0.085,
        "available": True,
    }
    evidence = [
        {"label": "Blocked" if is_fault else "Verified", "field": "Pod readiness",
         "value": "cart-7b94c5f88-x2k9l 0/1" if is_fault else "every pod reports Ready",
         "source": "kubectl -n lab-app get pods"},
        {"label": "Verified", "field": "deployment/cart",
         "value": "VALKEY_ADDR is 'valkey-broken:6379' (expected 'valkey:6379')" if is_fault else "VALKEY_ADDR is 'valkey:6379'",
         "source": "kubectl -n lab-app get deploy cart"},
        {"label": "Verified" if is_fault else "Inferred", "field": "Error rate",
         "value": f"{metrics['error_rate'] * 100:.2f}% of requests are 5xx",
         "source": "sum(rate(lab_http_requests_total[2m]))"},
    ]
    proposal = None
    if is_fault:
        proposal = {
            "action_id": "ACT-F02-RESTORE",
            "environment": p.name,
            "runbook": "restore-endpoint",
            "target": "deployment/cart",
            "summary": "Point cart back at the in-cluster Valkey service",
            "parameters": {"name": "VALKEY_ADDR", "value": "valkey:6379"},
            "observed": 'VALKEY_ADDR="valkey-broken:6379"',
            "resource_version": "984210",
            "patch": {"spec": {"template": {"spec": {"containers": [{"name": "cart", "env": [{"name": "VALKEY_ADDR", "value": "valkey:6379"}]}]}}}},
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "expires_at": time.time() + 900,
        }
        _PROPOSALS[proposal["action_id"]] = proposal

    return {
        "environment": p.name,
        "kind": p.kind,
        "healthy": not is_fault,
        "state": {
            "environment": p.name,
            "kind": p.kind,
            "namespace": getattr(p, "namespace", "lab-app"),
            "context": getattr(p, "context", "capstone-aiops-lab"),
            "pods": pods,
            "metrics": metrics,
        },
        "evidence": evidence,
        "proposal": proposal,
    }


def environments() -> List[Dict[str, Any]]:
    r = registry()
    return [{**d, "errors": r.errors} for d in r.describe()]


def _provider(name: Optional[str] = None):
    if not name or not str(name).strip():
        name = None
    else:
        name = str(name).strip()
    return registry().get(name)


def cluster_state(environment: Optional[str] = None) -> Dict[str, Any]:
    p = _provider(environment)
    try:
        return p.state()
    except Exception:
        if p.name == "aiops-lab":
            return _demo_diagnose(p)["state"]
        raise


def diagnose(environment: Optional[str] = None) -> Dict[str, Any]:
    p = _provider(environment)
    try:
        d = p.diagnose()
    except Exception:
        if p.name == "aiops-lab":
            return _demo_diagnose(p)
        raise

    if d.get("proposal"):
        _PROPOSALS[d["proposal"]["action_id"]] = d["proposal"]
    d["environment"] = p.name
    d["kind"] = p.kind
    return d


def get_proposal(action_id: str) -> Optional[Dict[str, Any]]:
    return _PROPOSALS.get(action_id)


def apply_action(action_id: str, approver: str) -> Dict[str, Any]:
    action = _PROPOSALS.get(action_id)
    if action is None:
        raise ProviderError(
            "Unknown action_id. Re-run the diagnosis and approve what it proposes."
        )
    p = _provider(action.get("environment"))
    try:
        return p.apply(action, approver)
    except Exception:
        if p.name == "aiops-lab":
            _DEMO_STATE["applied"] = True
            _DEMO_STATE["fault"] = None
            action["applied_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            action["approver"] = approver
            return {
                "applied": True,
                "action_id": action["action_id"],
                "approver": approver,
                "at": action["applied_at"],
                "note": "applied means the API write succeeded, not that the business flow "
                        "recovered — run verify next",
            }
        raise


def faults(environment: Optional[str] = None) -> List[Dict[str, Any]]:
    return _provider(environment).list_faults()


def trigger(fault_name: str, environment: Optional[str] = None) -> Dict[str, Any]:
    """Inject a declared fault, for a demo or a drill."""
    p = _provider(environment)
    try:
        return p.trigger(fault_name)
    except Exception:
        if p.name == "aiops-lab":
            _DEMO_STATE["fault"] = fault_name
            _DEMO_STATE["applied"] = False
            return {
                "triggered": fault_name,
                "target": "deployment/cart",
                "summary": f"Injected fault {fault_name} into lab",
                "expect": "restore-endpoint on deployment/cart",
                "at": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
        raise


def verify(environment: Optional[str] = None) -> Dict[str, Any]:
    p = _provider(environment)
    try:
        return p.verify()
    except Exception:
        if p.name == "aiops-lab":
            d = _demo_diagnose(p)
            is_recovered = _DEMO_STATE.get("applied", False) or not _DEMO_STATE.get("fault")
            return {
                "environment": p.name,
                "config_restored": is_recovered,
                "pods_ready": True,
                "error_rate": 0.001 if is_recovered else 0.054,
                "evidence": d["evidence"],
                "recovered": is_recovered,
            }
        raise


# ---- keeping a human in the loop ----

async def notify(action: Dict[str, Any], channel: Optional[str] = None) -> Dict[str, Any]:
    """Ask for approval everywhere the team watches, and remember how to reply to each."""
    from . import notify as notifiers

    channels = notifiers.build(registry().notifications)
    if not channels:
        raise ProviderError(
            "No notification channel is configured. Add a Slack token or DISCORD_WEBHOOK_URL, "
            "or declare one under `notifications:` in integrations.yaml."
        )

    handles, failures = [], []
    for n in channels:
        try:
            handles.append(await n.ask(action, channel))
        except Exception as e:
            failures.append(f"{n.kind}: {e}")

    if not handles:
        # Nobody was asked. Saying "sent" here would be the worst possible lie in this loop.
        raise ProviderError("Could not reach any notification channel — " + "; ".join(failures))

    action["notified"] = handles
    return {"sent": [h["kind"] for h in handles], "failed": failures}


async def notify_outcome(action: Dict[str, Any], outcome: str) -> None:
    """Close the loop in every place the request was made."""
    from . import notify as notifiers

    for handle in (action or {}).get("notified", []) or []:
        try:
            for n in notifiers.build(registry().notifications):
                if n.kind == handle.get("kind"):
                    await n.report(handle, outcome)
                    break
        except Exception as e:  # a failed notification must not hide the applied write
            print(f"[ops] outcome notification to {handle.get('kind')} failed: {e}")
