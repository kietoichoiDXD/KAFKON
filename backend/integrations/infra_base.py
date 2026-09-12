"""What an infrastructure integration has to provide.

The incident console started life bolted to one Kubernetes namespace. Anything ScribeBA can
investigate has the same shape underneath — read the live state, say what you can prove, propose
one named action, apply it only on approval, then check whether the business recovered — so that
shape is the interface and the rest is a plug-in.

A provider that cannot remediate is still a provider: return no proposal and the console will say
there is nothing to approve rather than inventing an action.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class Finding(Dict[str, Any]):
    """{label, field, value, source} — the same four evidence labels used everywhere else."""


def finding(label: str, field: str, value: str, source: str) -> Dict[str, str]:
    return {"label": label, "field": field, "value": value, "source": source}


class InfraProvider(ABC):
    """One connected environment: a cluster, an account, a host, a URL."""

    #: short machine name, unique within the registry
    name: str
    #: what kind of thing this is, for display: "kubernetes", "http", …
    kind: str

    def __init__(self, name: str, config: Dict[str, Any]) -> None:
        self.name = name
        self.config = config

    # ---- read ----

    @abstractmethod
    def state(self) -> Dict[str, Any]:
        """Live state: resources plus whatever metrics this environment exposes."""

    @abstractmethod
    def diagnose(self) -> Dict[str, Any]:
        """Return {state, evidence, proposal, healthy}.

        `evidence` is a list of findings, each carrying the command or query that produced it.
        `proposal` is None when there is nothing this provider knows how to fix.
        """

    # ---- write, only through a named action ----

    def apply(self, action: Dict[str, Any], approver: str) -> Dict[str, Any]:
        """Apply an approved action. Providers without remediation may leave this unimplemented."""
        raise NotImplementedError(
            f"{self.name} ({self.kind}) can report what it sees but cannot change it."
        )

    @abstractmethod
    def verify(self) -> Dict[str, Any]:
        """Did the business flow recover? Distinct from 'the write succeeded'."""

    # ---- description ----

    def describe(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "kind": self.kind,
            "can_remediate": type(self).apply is not InfraProvider.apply,
            "target": self.target(),
        }

    @abstractmethod
    def target(self) -> str:
        """One line naming what this points at, for the environment picker."""


class ProviderError(RuntimeError):
    """Raised when an environment cannot be read — never silently treated as healthy."""
