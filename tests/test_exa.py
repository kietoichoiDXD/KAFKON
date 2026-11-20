"""
Unit and Integration Tests for Exa Neural Search & AI Test Grounding.
Canonical conformance to build-with-exa agent skill.
"""

import unittest
import asyncio
from backend.integrations.exa_client import ExaClient, ExaHighlightResult, GroundedTestRequirement


class TestExa(unittest.TestCase):
    def test_exa_local_mock_fallback(self):
        """Verify local deterministic fallback when mode is local or without key."""
        client = ExaClient(api_key="mock_key")
        results = client._local_mock_search("OAuth 2.0 PKCE")
        self.assertGreaterEqual(len(results), 2)
        self.assertIn("RFC 9700", results[0].title)
        self.assertTrue(results[0].url.startswith("https://"))
        self.assertGreater(len(results[0].highlights), 0)

    def test_exa_ground_ai_test_spec(self):
        """Verify AI test case generation and grounded RFC standards synthesis."""
        client = ExaClient()
        grounded = asyncio.run(client.ground_ai_test_spec("Google Workspace SSO"))
        self.assertIsNotNone(grounded)
        self.assertGreater(len(grounded.test_scenarios), 0)
        self.assertGreater(len(grounded.citations), 0)


if __name__ == "__main__":
    unittest.main()
