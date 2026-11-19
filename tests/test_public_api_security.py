"""Bounded regression checks for the public API security boundary."""
import unittest
from unittest.mock import patch

from backend import api


class TestPublicApiSecurity(unittest.TestCase):
    def setUp(self):
        api.app.config["TESTING"] = True
        with api._rate_lock:
            api._rate_buckets.clear()
        self.patches = [
            patch.object(api, "AUTH_ENABLED", True),
            patch.object(api.settings, "scribeba_app_password", "test-only-password"),
            patch.object(api.settings, "scribeba_session_secret", "x" * 40),
            patch.object(api.settings, "scribeba_allowed_origin", "https://studio.example.test"),
            patch.object(api.settings, "nebius_api_key", "test-nebius-key"),
            patch.object(api.settings, "gemini_api_key", "SYNTHETIC_KEY_MUST_NOT_LEAK"),
        ]
        for item in self.patches:
            item.start()
        api.app.secret_key = "x" * 40
        self.client = api.app.test_client()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()

    def _login(self):
        response = self.client.post("/api/auth/login", json={"password": "test-only-password"})
        self.assertEqual(response.status_code, 200)

    def test_private_api_requires_session(self):
        response = self.client.get("/api/byok")
        self.assertEqual(response.status_code, 401)

    def test_security_headers_are_present(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.headers["X-Frame-Options"], "DENY")
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_oversized_json_request_is_rejected(self):
        response = self.client.post(
            "/api/auth/login",
            data=b"x" * (2 * 1024 * 1024 + 1),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 413)

    def test_untrusted_origin_is_rejected(self):
        response = self.client.get("/api/byok", headers={"Origin": "https://attacker.example"})
        self.assertEqual(response.status_code, 403)

    def test_login_rate_limit_is_bounded(self):
        statuses = [
            self.client.post("/api/auth/login", json={"password": "wrong"}).status_code
            for _ in range(7)
        ]
        self.assertEqual(statuses[:6], [401] * 6)
        self.assertEqual(statuses[6], 429)

    def test_nebius_ssrf_target_is_rejected_before_network_request(self):
        self._login()
        with patch.object(api.settings, "nebius_base_url", "https://127.0.0.1/v1"), patch(
            "httpx.get"
        ) as http_get:
            response = self.client.post(
                "/api/byok/test",
                json={"provider": "nebius", "key": "test-only-key", "base_url": "https://api.studio.nebius.ai/v1"},
            )
        http_get.assert_not_called()
        self.assertEqual(response.status_code, 400)
        self.assertIn("restricted", response.get_json()["message"])

    def test_configured_secret_is_never_partially_returned(self):
        self._login()
        response = self.client.get("/api/byok")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["gemini_api_key"], "••••••••")
        self.assertNotIn("SYNTHETIC_KEY_MUST_NOT_LEAK", response.get_data(as_text=True))

    def test_public_error_response_hides_exception_detail(self):
        self._login()
        with patch("backend.ops.environments", side_effect=RuntimeError("synthetic-secret-detail")):
            response = self.client.get("/api/ops/environments")
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("synthetic-secret-detail", response.get_data(as_text=True))
        self.assertEqual(response.get_json()["error"], "Could not load the configured environments.")

    def test_room_responses_strip_connector_credentials(self):
        self._login()
        response = self.client.get("/api/rooms")
        self.assertEqual(response.status_code, 200)
        body = response.get_data(as_text=True)
        self.assertNotIn("webhook_url", body)
        self.assertNotIn("hooks.slack.com/services", body)
        self.assertNotIn("chat_id", body)


if __name__ == "__main__":
    unittest.main()
