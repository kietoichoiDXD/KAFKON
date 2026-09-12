"""The incident console, across every configured environment.

The providers live in backend/integrations/; this module is the thin layer the API, the TUI and
the chat router all call. It holds two things a provider should not: the proposal ledger that
makes approvals un-replayable, and the Slack notifications that put a human in the loop.

Boundaries kept here:
  * A write happens only through a proposal this process issued and a human approved.
  * The only writes possible are the runbooks declared in integrations.yaml.
  * A refusal is reported to whoever was asked to approve, not swallowed.
"""
from typing import Any, Dict, List, Optional

from .integrations.infra_base import ProviderError
from .integrations.registry import registry

# Proposals live for the length of a session. A restart drops them, which is correct: an approval
# must refer to a proposal someone actually saw.
_PROPOSALS: Dict[str, Dict[str, Any]] = {}


def environments() -> List[Dict[str, Any]]:
    r = registry()
    return [{**d, "errors": r.errors} for d in r.describe()]


def _provider(name: Optional[str] = None):
    return registry().get(name)


def cluster_state(environment: Optional[str] = None) -> Dict[str, Any]:
    return _provider(environment).state()


def diagnose(environment: Optional[str] = None) -> Dict[str, Any]:
    p = _provider(environment)
    d = p.diagnose()
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
    return _provider(action.get("environment")).apply(action, approver)


def verify(environment: Optional[str] = None) -> Dict[str, Any]:
    return _provider(environment).verify()


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
