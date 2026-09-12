"""Every incident kind the console can recognise, without touching a cluster.

These feed the checks a fake `kubectl` that returns canned JSON, so the whole catalogue is
exercised offline. The cases that matter most are the ones where a check must NOT propose
anything: a correct selector with no endpoints, and a crashing container.
"""
import json
import unittest

from backend.integrations.k8s_checks import CHECKS


def kubectl_returning(objects):
    """A stand-in for the provider's kubectl, keyed by the first two arguments."""
    def _kubectl(*args, **kwargs):
        key = " ".join(args[:3])
        for k, v in objects.items():
            if key.startswith(k):
                return json.dumps(v)
        raise AssertionError(f"unexpected kubectl call: {args}")
    return _kubectl


def deployment(name="cart", env=None, image="repo/cart:lab-v1", replicas=1, probe_path="/healthz"):
    container = {"name": name, "image": image,
                 "env": [{"name": k, "value": v} for k, v in (env or {}).items()]}
    if probe_path:
        container["readinessProbe"] = {"httpGet": {"path": probe_path, "port": 8080}}
    return {"metadata": {"uid": "u-1", "resourceVersion": "100"},
            "spec": {"replicas": replicas, "template": {"spec": {"containers": [container]}}}}


class TestEnvCheck(unittest.TestCase):
    def test_drift_proposes_the_baseline(self):
        k = kubectl_returning({"get deploy cart": deployment(env={"VALKEY_ADDR": "missing:6379"})})
        ev, repair = CHECKS["env"](k, "lab-app", {
            "target": "deployment/cart", "env": "VALKEY_ADDR", "value": "valkey:6379"})
        self.assertEqual(ev["label"], "Verified")
        self.assertIn("missing:6379", ev["value"])
        self.assertEqual(repair["parameters"], {"name": "VALKEY_ADDR", "value": "valkey:6379"})

    def test_matching_value_proposes_nothing(self):
        k = kubectl_returning({"get deploy cart": deployment(env={"VALKEY_ADDR": "valkey:6379"})})
        ev, repair = CHECKS["env"](k, "lab-app", {
            "target": "deployment/cart", "env": "VALKEY_ADDR", "value": "valkey:6379"})
        self.assertIsNone(repair)

    def test_a_missing_variable_is_blocked(self):
        k = kubectl_returning({"get deploy cart": deployment(env={})})
        ev, repair = CHECKS["env"](k, "lab-app", {
            "target": "deployment/cart", "env": "VALKEY_ADDR", "value": "valkey:6379"})
        self.assertEqual(ev["label"], "Blocked")
        self.assertIsNone(repair)


class TestOtherKinds(unittest.TestCase):
    def test_wrong_image_proposes_the_baseline(self):
        k = kubectl_returning({"get deploy cart": deployment(image="repo/cart:does-not-exist")})
        ev, repair = CHECKS["image"](k, "lab-app", {
            "target": "deployment/cart", "value": "repo/cart:lab-v1"})
        self.assertEqual(repair["patch"]["spec"]["template"]["spec"]["containers"][0]["image"],
                         "repo/cart:lab-v1")

    def test_scaled_to_zero_proposes_the_floor(self):
        k = kubectl_returning({"get deploy cart": deployment(replicas=0)})
        ev, repair = CHECKS["replicas"](k, "lab-app", {"target": "deployment/cart", "value": 1})
        self.assertEqual(repair["patch"], {"spec": {"replicas": 1}})
        self.assertEqual(repair["observed"], "0")

    def test_enough_replicas_proposes_nothing(self):
        k = kubectl_returning({"get deploy cart": deployment(replicas=2)})
        _, repair = CHECKS["replicas"](k, "lab-app", {"target": "deployment/cart", "value": 1})
        self.assertIsNone(repair)

    def test_wrong_probe_path_proposes_the_baseline(self):
        k = kubectl_returning({"get deploy web": deployment("web", probe_path="/not-here")})
        ev, repair = CHECKS["probe"](k, "lab-app", {"target": "deployment/web", "value": "/healthz"})
        probe = repair["patch"]["spec"]["template"]["spec"]["containers"][0]["readinessProbe"]
        self.assertEqual(probe["httpGet"]["path"], "/healthz")

    def test_a_wrong_selector_proposes_the_right_one(self):
        k = kubectl_returning({
            "get svc cart": {"spec": {"selector": {"app": "cart-v2"}}},
            "get endpoints cart": {"subsets": []},
        })
        ev, repair = CHECKS["selector"](k, "lab-app", {
            "target": "service/cart", "value": {"app": "cart"}})
        self.assertEqual(repair["patch"], {"spec": {"selector": {"app": "cart"}}})

    def test_a_correct_selector_with_no_endpoints_proposes_nothing(self):
        """Scaled to zero looks like a selector fault. Patching the selector would be a no-op
        that hides the real cause, so this check reports and stands aside."""
        k = kubectl_returning({
            "get svc cart": {"spec": {"selector": {"app": "cart"}}},
            "get endpoints cart": {"subsets": []},
        })
        ev, repair = CHECKS["selector"](k, "lab-app", {
            "target": "service/cart", "value": {"app": "cart"}})
        self.assertIn("no ready endpoints", ev["value"])
        self.assertIsNone(repair)


class TestRestarts(unittest.TestCase):
    def _pods(self, status):
        return {"items": [{"metadata": {"name": "cart-abc"}, "status": status}]}

    def test_oom_is_reported_but_never_auto_repaired(self):
        k = kubectl_returning({"get pods": self._pods({"containerStatuses": [
            {"restartCount": 3, "state": {},
             "lastState": {"terminated": {"reason": "OOMKilled", "exitCode": 137}}}]})})
        ev, repair = CHECKS["restarts"](k, "lab-app", {"target": "pod/cart", "value": 0})
        self.assertIn("OOMKilled", ev["value"])
        self.assertIsNone(repair, "the right fix for a crash is a judgement, not a guess")

    def test_crashloop_is_reported(self):
        k = kubectl_returning({"get pods": self._pods({"containerStatuses": [
            {"restartCount": 5, "state": {"waiting": {"reason": "CrashLoopBackOff"}},
             "lastState": {}}]})})
        ev, _ = CHECKS["restarts"](k, "lab-app", {"target": "pod/cart", "value": 0})
        self.assertIn("CrashLoopBackOff", ev["value"])

    def test_a_quiet_namespace_says_so(self):
        k = kubectl_returning({"get pods": self._pods({"containerStatuses": [
            {"restartCount": 0, "state": {}, "lastState": {}}]})})
        ev, repair = CHECKS["restarts"](k, "lab-app", {"target": "pod/cart", "value": 0})
        self.assertEqual(ev["label"], "Verified")
        self.assertIsNone(repair)


if __name__ == "__main__":
    unittest.main()
