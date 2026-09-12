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

async def notify(channel: str, action: Dict[str, Any]) -> Dict[str, Any]:
    """Put the proposal in front of a human where they already are."""
    from .platforms.slack_adapter import SlackAdapter

    slack = SlackAdapter()
    if not slack.is_live:
        raise ProviderError("No Slack token configured, so the approval request cannot be sent.")

    p = action["parameters"]
    text = (
        f"🚨 *ScribeBA — approval needed*  `{action['action_id']}`\n"
        f"*{action['summary']}*\n"
        f"• Environment: `{action.get('environment', 'default')}`\n"
        f"• Runbook: `{action['runbook']}`  ·  Target: `{action['target']}`\n"
        f"• Change: `{p['name']}={action['observed']}` → `{p['name']}={p['value']}`\n"
        f"• Pinned to resourceVersion `{action['resource_version']}` — refused if the deployment "
        f"changes before approval\n"
        f"_Nothing has been written. Approve in the Incidents console._"
    )
    ts = await slack._post(channel, None, text)
    action["notified"] = {"channel": channel, "ts": ts}
    return {"channel": channel, "ts": ts}


async def notify_outcome(action: Dict[str, Any], outcome: str) -> None:
    """Close the loop in the same place the request was made."""
    target = (action or {}).get("notified")
    if not target:
        return
    from .platforms.slack_adapter import SlackAdapter
    try:
        await SlackAdapter()._post(target["channel"], target["ts"], outcome)
    except Exception as e:  # a failed notification must not hide the applied write
        print(f"[ops] outcome notification failed: {e}")
