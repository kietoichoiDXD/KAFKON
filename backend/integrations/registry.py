"""The set of environments this instance can investigate.

Adding a cluster, an account or a service is an entry in integrations.yaml — not a code change.
The file is read once per process; restart the API after editing it.
"""
import os
from pathlib import Path
from typing import Dict, List, Optional

import yaml

from .http_provider import HttpProvider
from .infra_base import InfraProvider, ProviderError
from .kubernetes_provider import KubernetesProvider

PROVIDERS = {
    "kubernetes": KubernetesProvider,
    "http": HttpProvider,
}

CONFIG_PATH = Path(os.environ.get(
    "SCRIBEBA_INTEGRATIONS",
    Path(__file__).resolve().parent.parent.parent / "integrations.yaml",
))


class Registry:
    def __init__(self, path: Path = CONFIG_PATH) -> None:
        self.path = Path(path)
        self._providers: Dict[str, InfraProvider] = {}
        self.notifications: List[dict] = []
        self.errors: List[str] = []
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        doc = yaml.safe_load(self.path.read_text(encoding="utf-8")) or {}
        self.notifications = doc.get("notifications", []) or []
        for entry in doc.get("environments", []):
            name = entry.get("name")
            kind = entry.get("kind")
            if not name or kind not in PROVIDERS:
                self.errors.append(f"skipped {name or '<unnamed>'}: unknown kind {kind!r}")
                continue
            config = {k: v for k, v in entry.items() if k not in ("name", "kind")}
            # Let a path like ~/.lab-state/kubeconfig work without the caller expanding it.
            for key in ("kubeconfig",):
                if key in config:
                    config[key] = os.path.expanduser(str(config[key]))
            try:
                self._providers[name] = PROVIDERS[kind](name, config)
            except Exception as e:  # a bad entry must not take the other environments down
                self.errors.append(f"skipped {name}: {type(e).__name__}: {e}")

    # ---- access ----

    def names(self) -> List[str]:
        return list(self._providers)

    def describe(self) -> List[dict]:
        return [p.describe() for p in self._providers.values()]

    def get(self, name: Optional[str] = None) -> InfraProvider:
        if not self._providers:
            raise ProviderError(
                f"No environments are configured. Add one to {self.path.name} — see the "
                f"integrations.yaml in the repository root for the shape."
            )
        if name is None:
            return next(iter(self._providers.values()))
        if name not in self._providers:
            raise ProviderError(
                f"No environment named {name!r}. Configured: {', '.join(self._providers)}."
            )
        return self._providers[name]


_registry: Optional[Registry] = None


def registry() -> Registry:
    global _registry
    if _registry is None:
        _registry = Registry()
    return _registry


def reload() -> Registry:
    """Re-read the file, for after someone edits it."""
    global _registry
    _registry = Registry()
    return _registry
