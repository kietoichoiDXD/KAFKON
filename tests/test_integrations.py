"""Adding infrastructure should be a config entry, not a code change.

These tests pin the contract the registry and the providers have to keep, including the parts
that exist to stop a demo from lying: a provider that cannot remediate proposes nothing, and an
unreadable environment is Blocked rather than healthy.
"""
import tempfile
import unittest
from pathlib import Path

from backend.integrations.http_provider import HttpProvider
from backend.integrations.infra_base import InfraProvider, ProviderError
from backend.integrations.kubernetes_provider import KubernetesProvider
from backend.integrations.registry import Registry

CONFIG = """
environments:
  - name: cluster-a
    kind: kubernetes
    kubeconfig: /tmp/does-not-exist
    context: ctx-a
    namespace: team-a
    runbooks:
      restore-endpoint/cart:
        runbook: restore-endpoint
        target: deployment/cart
        summary: Point cart back at Valkey
        env: VALKEY_ADDR
        value: valkey:6379
    faults:
      - name: F02-valkey-endpoint
        summary: Point cart at a Valkey that does not exist
        expect: restore-endpoint on deployment/cart
        target: deployment/cart
        patch: {spec: {replicas: 0}}
  - name: cluster-b
    kind: kubernetes
    kubeconfig: /tmp/also-missing
    context: ctx-b
    namespace: team-b
  - name: public-api
    kind: http
    checks:
      - url: http://127.0.0.1:9/health
  - name: broken
    kind: something-else
"""


def _registry() -> Registry:
    d = Path(tempfile.mkdtemp())
    p = d / "integrations.yaml"
    p.write_text(CONFIG, encoding="utf-8")
    return Registry(p)


class TestRegistry(unittest.TestCase):
    def setUp(self):
        self.r = _registry()

    def test_every_valid_environment_is_registered(self):
        self.assertEqual(self.r.names(), ["cluster-a", "cluster-b", "public-api"])

    def test_an_unknown_kind_is_skipped_not_fatal(self):
        self.assertNotIn("broken", self.r.names())
        self.assertTrue(any("broken" in e for e in self.r.errors))

    def test_two_clusters_are_separate_providers(self):
        a, b = self.r.get("cluster-a"), self.r.get("cluster-b")
        self.assertIsNot(a, b)
        self.assertEqual(a.namespace, "team-a")
        self.assertEqual(b.namespace, "team-b")
        # Checks belong to the environment: cluster-b declares none, so it can propose nothing.
        self.assertEqual(b.checks, [])
        # cluster-a's legacy `runbooks:` block is accepted and normalised into an env check.
        self.assertEqual([c["kind"] for c in a.checks], ["env"])
        self.assertEqual(a.checks[0]["runbook"], "restore-endpoint")

    def test_naming_an_unknown_environment_says_what_exists(self):
        with self.assertRaises(ProviderError) as ctx:
            self.r.get("staging")
        self.assertIn("cluster-a", str(ctx.exception))

    def test_no_name_returns_the_first(self):
        self.assertEqual(self.r.get().name, "cluster-a")

    def test_kinds_are_described_for_the_picker(self):
        by_name = {d["name"]: d for d in self.r.describe()}
        self.assertEqual(by_name["cluster-a"]["kind"], "kubernetes")
        self.assertTrue(by_name["cluster-a"]["can_remediate"])
        # The HTTP provider watches from outside and cannot change what it measures.
        self.assertFalse(by_name["public-api"]["can_remediate"])


class TestFaultDrills(unittest.TestCase):
    """A drill can only break what the file says, and only what a runbook can undo."""

    def setUp(self):
        self.r = _registry()

    def test_declared_faults_are_listed(self):
        faults = self.r.get("cluster-a").list_faults()
        self.assertEqual([f["name"] for f in faults], ["F02-valkey-endpoint"])
        self.assertIn("expect", faults[0])

    def test_an_undeclared_fault_is_refused_by_name(self):
        with self.assertRaises(Exception) as ctx:
            self.r.get("cluster-a").trigger("delete-everything")
        self.assertIn("F02-valkey-endpoint", str(ctx.exception))

    def test_an_environment_without_drills_has_none(self):
        self.assertEqual(self.r.get("cluster-b").list_faults(), [])

    def test_a_read_only_environment_cannot_be_broken_either(self):
        with self.assertRaises(NotImplementedError):
            self.r.get("public-api").trigger("anything")


class TestProviderContract(unittest.TestCase):
    def test_both_providers_implement_the_interface(self):
        for cls in (KubernetesProvider, HttpProvider):
            self.assertTrue(issubclass(cls, InfraProvider), cls.__name__)
            for method in ("state", "diagnose", "verify", "target"):
                self.assertTrue(callable(getattr(cls, method)), f"{cls.__name__}.{method}")

    def test_a_read_only_provider_refuses_to_apply(self):
        p = HttpProvider("public-api", {"checks": [{"url": "http://127.0.0.1:9/health"}]})
        with self.assertRaises(NotImplementedError):
            p.apply({"action_id": "ACT-X"}, "operator")

    def test_an_unreachable_endpoint_is_blocked_not_healthy(self):
        p = HttpProvider("down", {"checks": [{"url": "http://127.0.0.1:9/health"}], "timeout_seconds": 1})
        d = p.diagnose()
        self.assertFalse(d["healthy"])
        self.assertEqual(d["proposal"], None)
        self.assertTrue(any(e["label"] == "Blocked" for e in d["evidence"]))

    def test_no_checks_configured_is_blocked(self):
        d = HttpProvider("empty", {}).diagnose()
        self.assertFalse(d["healthy"])
        self.assertTrue(any(e["label"] == "Blocked" for e in d["evidence"]))

    def test_an_unreadable_cluster_raises_rather_than_reporting_health(self):
        p = KubernetesProvider("cluster-a", {
            "kubeconfig": "/tmp/does-not-exist", "context": "ctx-a", "namespace": "team-a"})
        with self.assertRaises(Exception):
            p.state()


if __name__ == "__main__":
    unittest.main()
